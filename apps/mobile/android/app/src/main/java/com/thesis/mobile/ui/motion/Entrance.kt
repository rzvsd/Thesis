package com.thesis.mobile.ui.motion

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.AnimationVector1D
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Stable
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.Measurable
import androidx.compose.ui.layout.MeasureResult
import androidx.compose.ui.layout.MeasureScope
import androidx.compose.ui.node.CompositionLocalConsumerModifierNode
import androidx.compose.ui.node.LayoutModifierNode
import androidx.compose.ui.node.ModifierNodeElement
import androidx.compose.ui.node.currentValueOf
import androidx.compose.ui.node.invalidatePlacement
import androidx.compose.ui.platform.InspectorInfo
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import com.thesis.mobile.ui.theme.LocalReducedMotion
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.launch

/*
 * First-open entrance (docs/app-redesign/DESIGN-DIRECTION.md 4.3 rule 2; playbook section 5).
 *
 * Stagger exists only on Home's first open per Pulse issue and on Pulse's first open per issue. It must never
 * replay: not on scroll-back, tab return, refresh or Activity recreation. So the "already shown" memory is not a
 * HashSet in `remember` (disposed with the screen) but an [EntranceRegistry] owned by the navigator, with one
 * [EntranceCoordinator] per back-stack entry (`entryId`) and data identity (the Pulse issue id).
 *
 * The clock is the composition's frame clock (`withFrameMillis`), never `SystemClock`, so the harness's virtual
 * time drives it deterministically. All animated reads happen in the layer block: no recomposition per frame.
 */

/**
 * The seen-set and stagger order for one screen entry and one data identity ([resetKey]).
 *
 * A key is granted an entrance at most once in the coordinator's life ([claim]); the window opens on the first
 * entrance frame and closes [windowMillis] later, after which new keys appear at once. Plain class, UI thread only.
 */
@Stable
class EntranceCoordinator internal constructor(
    /** The data identity this coordinator belongs to (e.g. the Pulse issue id); null for "the entry itself". */
    val resetKey: Any?,
    private val windowMillis: Long = ThesisMotion.EntranceWindow,
    alreadyPlayed: Boolean = false,
) {
    private val seen = HashSet<Any>()
    private var nextOrder = 0
    private var windowStartMs = -1L
    private var closed = alreadyPlayed
    private var tickers = 0

    /** True once any key was claimed, or when the coordinator was restored as already played. */
    val hasPlayed: Boolean get() = closed || seen.isNotEmpty()

    /** True when [key] was claimed before (it will never animate again). */
    fun hasSeen(key: Any): Boolean = key in seen

    /**
     * Claims [key]. Returns its stagger order (0, 1, 2, ...) when it should animate in now, or [NO_ENTRANCE] when
     * it must appear at once: it was claimed before (never replay), or the window has closed. Every call marks
     * [key] as seen, so a second claim of the same key always returns [NO_ENTRANCE].
     */
    fun claim(key: Any): Int {
        if (!seen.add(key)) return NO_ENTRANCE
        if (closed) return NO_ENTRANCE
        return nextOrder++
    }

    /**
     * The frame-clock gate. The first call opens the window at [frameMillis]; returns false once [frameMillis] is
     * more than the window past that, and from then on for good.
     */
    fun isOpenAt(frameMillis: Long): Boolean {
        if (closed) return false
        if (windowStartMs < 0) windowStartMs = frameMillis
        if (frameMillis - windowStartMs > windowMillis) closed = true
        return !closed
    }

    /** Closes the window: keys claimed from now on appear at once. */
    fun close() {
        closed = true
    }

    /**
     * An animating node started driving [isOpenAt] every frame. While at least one does, the window closes on the
     * frame clock, on time, whatever else attaches or detaches.
     */
    internal fun tickerStarted() {
        tickers++
    }

    /**
     * An animating node stopped driving the clock (the window closed, or the node detached: fast fling, tab switch).
     * When the last one stops inside an open window, nothing keeps the clock any more, so the window closes now:
     * a key that first attaches later then appears at once instead of being hidden for a frame.
     */
    internal fun tickerStopped() {
        tickers--
        if (tickers <= 0 && windowStartMs >= 0) closed = true
    }

    companion object {
        /** [claim] result for "appear at once". */
        const val NO_ENTRANCE = -1
    }
}

/**
 * All entrance coordinators of the app, keyed by scope (the back-stack entry's `entryId`). Owned by the navigator
 * (so it lives as long as the back stack, across tab switches and configuration changes) and provided to the UI
 * through [ProvideEntranceScope]. [saveState] / [restoreState] carry "already played" across process death, so a
 * restored Home does not stagger again for the same issue.
 */
@Stable
class EntranceRegistry {
    private val coordinators = HashMap<String, EntranceCoordinator>()
    private val restoredPlayed = HashMap<String, String>()

    /**
     * The coordinator for [scope] and [resetKey]: the same instance while both are unchanged; a fresh one (empty
     * seen-set, new window) when [resetKey] changes, e.g. a new Pulse issue.
     */
    fun coordinator(scope: String, resetKey: Any? = null): EntranceCoordinator {
        val existing = coordinators[scope]
        if (existing != null && existing.resetKey == resetKey) return existing
        val played = restoredPlayed.remove(scope)?.let { it == resetKey.toString() } ?: false
        return EntranceCoordinator(resetKey, alreadyPlayed = played).also { coordinators[scope] = it }
    }

    /** Forgets [scope] (its entry was popped): a new entry for the same screen animates again. */
    fun release(scope: String) {
        coordinators.remove(scope)
        restoredPlayed.remove(scope)
    }

    /** Forgets every scope not in [live] (call after a pop or a deep link replaced stacks). */
    fun retainOnly(live: Collection<String>) {
        coordinators.keys.retainAll(live.toSet())
        restoredPlayed.keys.retainAll(live.toSet())
    }

    /** Number of scopes held (for tests and leak checks). */
    val size: Int get() = coordinators.size

    /** "Already played" markers to put in `SavedStateHandle`: one `scope<US>resetKey` string per played scope. */
    fun saveState(): ArrayList<String> {
        val out = ArrayList<String>()
        restoredPlayed.forEach { (scope, reset) -> out += scope + SEPARATOR + reset }
        coordinators.forEach { (scope, c) -> if (c.hasPlayed) out += scope + SEPARATOR + c.resetKey.toString() }
        return out
    }

    /** Restores [saveState]'s markers: those scopes, with the same reset key, will not animate again. */
    fun restoreState(saved: List<String>) {
        saved.forEach { line ->
            val cut = line.indexOf(SEPARATOR)
            if (cut > 0) restoredPlayed[line.substring(0, cut)] = line.substring(cut + 1)
        }
    }

    private companion object {
        const val SEPARATOR = '\u001F'
    }
}

/**
 * The registry the UI reads. The shell provides the navigator's registry; the default is one process-wide
 * registry, so even an unwired screen never replays its entrance while the process lives.
 */
val LocalEntranceRegistry = staticCompositionLocalOf { EntranceRegistry() }

/** The current back-stack entry's id (the scope of its entrances). The shell provides it per entry. */
val LocalEntranceScope = staticCompositionLocalOf { DEFAULT_ENTRANCE_SCOPE }

/** Scope used when no entry provides one. */
const val DEFAULT_ENTRANCE_SCOPE = "app"

/** Provides [registry] and the entry [scope] (its `entryId`) to [content]. Used by the shell for every entry. */
@Composable
fun ProvideEntranceScope(registry: EntranceRegistry, scope: String, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalEntranceRegistry provides registry, LocalEntranceScope provides scope, content = content)
}

/**
 * The coordinator for this entry and [resetKey] (the data identity: Pulse issue id; not `Unit`). Survives the
 * screen leaving composition, because it lives in the navigator's registry.
 */
@Composable
fun rememberEntranceCoordinator(resetKey: Any? = null): EntranceCoordinator {
    val registry = LocalEntranceRegistry.current
    val scope = LocalEntranceScope.current
    return remember(registry, scope, resetKey) { registry.coordinator(scope, resetKey) }
}

/**
 * First-open entrance: the item rises [offset] (8 dp) and fades in over `Enter` (320 ms, `EaseEnter`), 35 ms after
 * the previous one (cap 8 steps). Only keys claimed within the coordinator's window animate, each at most once;
 * everything else (scrolled in later, returning from a tab, recomposed after disposal) appears at once. Under
 * reduced motion nothing animates, but the key is still marked seen. Reads happen in the layer block only.
 *
 * Use it on Home and Pulse only, on the first 8 blocks; pushed screens arrive whole (4.3 rule 2).
 */
fun Modifier.staggeredEntrance(
    key: Any,
    coordinator: EntranceCoordinator,
    offset: Dp = ThesisMotion.EnterOffset,
): Modifier = this then EntranceElement(key, coordinator, offset)

private data class EntranceElement(
    val key: Any,
    val coordinator: EntranceCoordinator,
    val offset: Dp,
) : ModifierNodeElement<EntranceNode>() {
    override fun create() = EntranceNode(key, coordinator, offset)

    override fun update(node: EntranceNode) {
        node.offset = offset
        if (node.key != key || node.coordinator !== coordinator) {
            val coordinatorChanged = node.coordinator !== coordinator
            node.key = key
            node.coordinator = coordinator
            // The block is already on screen: a new data identity (a new Pulse issue arriving by refresh) or a new
            // key never blanks it or replays a stagger (4.3 rules 2 and 5). Only onAttach (first open) animates.
            if (node.isAttached) node.settle(closeWindow = coordinatorChanged)
        }
    }

    override fun InspectorInfo.inspectableProperties() {
        name = "staggeredEntrance"
        properties["key"] = key
        properties["offset"] = offset
    }
}

private class EntranceNode(
    var key: Any,
    var coordinator: EntranceCoordinator,
    var offset: Dp,
) : Modifier.Node(), LayoutModifierNode, CompositionLocalConsumerModifierNode {
    private var progress: Animatable<Float, AnimationVector1D>? = null

    override fun onAttach() {
        claim()
        // A reused or re-attached node may keep its last placement (with a layer whose animation was cancelled):
        // place again so the layer always matches [progress].
        invalidatePlacement()
    }

    override fun onDetach() {
        progress = null
    }

    /** Swaps [progress] and re-places the content, so the placed layer always matches it. */
    private fun setProgress(value: Animatable<Float, AnimationVector1D>?) {
        if (progress === value) return
        progress = value
        if (isAttached) invalidatePlacement()
    }

    /**
     * Marks [key] seen on the current coordinator without animating and shows the block at once. With
     * [closeWindow] (the coordinator changed under a block that is already on screen) the new coordinator's window
     * closes too: the user already sees this data, so blocks scrolled in later do not stagger either.
     */
    fun settle(closeWindow: Boolean) {
        coordinator.claim(key)
        if (closeWindow) coordinator.close()
        setProgress(null)
    }

    private fun claim() {
        val order = coordinator.claim(key)
        if (order == EntranceCoordinator.NO_ENTRANCE || currentValueOf(LocalReducedMotion)) {
            progress = null
            return
        }
        // Hidden from the very first frame (no flash), then animated once the frame clock confirms the window.
        val anim = Animatable(0f).also { progress = it }
        val gate = coordinator
        coroutineScope.launch {
            if (!gate.isOpenAt(withFrameMillis { it })) {
                setProgress(null)
                return@launch
            }
            // Every animating item keeps the window's clock ticking until the window closes, so it closes on time
            // even if no other item attaches until long after; when the last ticking item detaches early, the
            // window closes with it. Either way a later attach (scroll, tab return) is never hidden for a frame.
            // UNDISPATCHED: the count is taken before the first suspension, so `finally` always balances it.
            launch(start = CoroutineStart.UNDISPATCHED) {
                gate.tickerStarted()
                try {
                    while (gate.isOpenAt(withFrameMillis { it })) Unit
                } finally {
                    gate.tickerStopped()
                }
            }
            anim.animateTo(
                1f,
                tween(ThesisMotion.Enter, ThesisMotion.staggerDelay(order), ThesisMotion.EaseEnter),
            )
            // Done: drop the layer, so a settled block costs nothing.
            if (progress === anim) setProgress(null)
        }
    }

    override fun MeasureScope.measure(measurable: Measurable, constraints: Constraints): MeasureResult {
        val placeable = measurable.measure(constraints)
        val dy = offset.toPx()
        return layout(placeable.width, placeable.height) {
            // Read at placement time, so invalidatePlacement() alone brings the layer in line with [progress].
            val anim = progress
            if (anim == null) {
                placeable.place(0, 0)
            } else {
                // Layer-phase reads: the entrance never recomposes or relayouts the item.
                placeable.placeWithLayer(0, 0) {
                    val t = anim.value
                    alpha = t
                    translationY = (1f - t) * dy
                }
            }
        }
    }
}
