package com.thesis.mobile.ui.shell

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.SaveableStateHolder
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.clearAndSetSemantics
import com.thesis.mobile.ui.components.pageBackground
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette

/*
 * The shell's animated layers (DESIGN-DIRECTION 4.5, 5.5): the report base layer, the tab layer and the modal
 * layer. Each keys its entries' saved UI state by `entryId` ([SaveableStateHolder]), so scroll positions and
 * fields survive tab switches, pushes and pops (Name(A) → Name(B) → back returns to A's exact scroll), and each
 * applies the predictive-back preview to the page it would close. Generic over the page content, so
 * `ShellLayersTest` drives them with plain scrolling lists.
 */

/** Distances and switches every layer needs. */
internal class ShellLayerEnv(
    val holder: SaveableStateHolder,
    val px: ShellMotionPx,
    val backShiftPx: Float,
    val reducedMotion: Boolean,
    val backPreview: BackPreview,
)

/**
 * The tab layer: the current tab's top entry, with the 4.5 transition for the navigator's last [move] (fade-through
 * between tabs, shared-axis X for push and pop, a crossfade for a replace or a restore, crossfades only under
 * reduced motion). Entries for which [drawnBelow] is true (a `Report`, drawn by [ReportBaseLayer]) leave this
 * layer empty and transparent, so the report underneath shows and takes touches. [hidden]: a modal or the paywall
 * covers the layer, so it is out of the accessibility tree.
 */
@Composable
internal fun TabLayer(
    target: NavEntry,
    move: () -> NavMove,
    env: ShellLayerEnv,
    drawnBelow: (NavEntry) -> Boolean,
    modifier: Modifier = Modifier,
    hidden: Boolean = false,
    content: @Composable (NavEntry) -> Unit,
) {
    // False during the layer's first composition: the first page is simply there, it does not arrive.
    val started = remember { HeldValue(false) }
    SideEffect { started.value = true }
    AnimatedContent(
        targetState = target,
        modifier = modifier.fillMaxSize().hiddenFromAccessibility(hidden),
        transitionSpec = {
            shellTransitionFor(move(), env.reducedMotion).toContentTransform(env.px, pageFadesItsContent = true)
        },
        contentKey = { it.entryId },
        label = "tab-layer"
    ) { entry ->
        if (drawnBelow(entry)) {
            Box(Modifier.fillMaxSize())
        } else {
            // The move this page arrived by (read once, when it is composed as the new target).
            val enteredBy = remember { if (started.value) shellTransitionFor(move(), env.reducedMotion) else null }
            OpaqueEntry(entry, env, fadeContentIn = enteredBy?.incomingPageOpaque == true) { content(entry) }
        }
    }
}

/**
 * The report base layer (4.5 "The report WebView survives pushes over it"): the last `Report` entry of the current
 * stack ([entry]; null when there is none) stays composed under the tab layer while screens are pushed over it, so
 * back returns to the live page with its scroll, without a reload. It moves with the same transitions as the tab
 * layer when it arrives or leaves (pushed, popped, a tab switch), so there is no hard cut.
 *
 * While a screen pushed over it covers it ([coveredBy] != the report), it slides out like the old page of a push
 * (to −24 dp and transparent, 180 ms `EaseExit`) and stays composed; when that screen is popped it slides back
 * (300 ms `EaseEnter`). Reduced motion: it only fades. A report that is leaving keeps whatever cover it had.
 * Touches never reach a covered report: the opaque page above it takes them ([OpaqueEntry]). [hidden]: a modal
 * or the paywall covers it, so it is out of the accessibility tree as well (it does not slide for that).
 */
@Composable
internal fun ReportBaseLayer(
    entry: NavEntry?,
    tabTopId: String,
    move: () -> NavMove,
    env: ShellLayerEnv,
    modifier: Modifier = Modifier,
    hidden: Boolean = false,
    content: @Composable (NavEntry) -> Unit,
) {
    AnimatedContent(
        targetState = entry,
        modifier = modifier.fillMaxSize().hiddenFromAccessibility(hidden),
        // The report has no background of its own (the root's shows through it), so it fades as a whole.
        transitionSpec = { shellTransitionFor(move(), env.reducedMotion).toContentTransform(env.px) },
        contentKey = { it?.entryId },
        label = "report-base-layer"
    ) { report ->
        if (report == null) {
            Box(Modifier.fillMaxSize())
            return@AnimatedContent
        }
        // A report that is no longer the layer's target is leaving (its exit transition is running).
        val leaving = report.entryId != entry?.entryId
        val covered = heldWhile(leaving, report.entryId != tabTopId)
        val cover by animateFloatAsState(
            targetValue = if (covered) 1f else 0f,
            animationSpec = when {
                env.reducedMotion -> ThesisMotion.timed(reduced = false, durationMillis = ThesisMotion.Quick)
                covered -> motionSpec(ThesisMotion.PushOut, easing = ThesisMotion.EaseExit)
                else -> motionSpec(ThesisMotion.Screen, easing = ThesisMotion.EaseEnter)
            },
            label = "report-cover"
        )
        Box(
            Modifier
                .fillMaxSize()
                .graphicsLayer {
                    alpha = 1f - cover
                    if (!env.reducedMotion) translationX = -cover * env.px.shiftPx
                }
                // Hidden under the page above it: out of the accessibility tree too (Compose semantics).
                .hiddenFromAccessibility(covered)
                .backPreview(env.backPreview, report.entryId, env.backShiftPx, env.reducedMotion)
        ) {
            LeaveHook(report.entryId, env.backPreview)
            env.holder.SaveableStateProvider(report.entryId) { content(report) }
        }
    }
}

/**
 * The modal layer (You, its pages, Search, Paywall): rises over everything when the modal stack opens and falls
 * when it closes; pages inside it move on the X axis like a push. [onStack] tells whether an entry is still on the
 * modal stack (to tell a push inside it from a pop). Empty and transparent with no modal, so touches reach the
 * layers under it.
 *
 * While one modal page replaces another, the page background is drawn under the two (the layer's own floor): the
 * leaving page slides out and fades as in a push (180 ms `EaseExit`) and the screens under the modal never show
 * through it or through the strip the new page slides in from.
 */
@Composable
internal fun ModalLayer(
    target: NavEntry?,
    onStack: (NavEntry) -> Boolean,
    env: ShellLayerEnv,
    modifier: Modifier = Modifier,
    content: @Composable (NavEntry) -> Unit,
) {
    val targets = remember { TargetHistory(target) }
    targets.update(target)
    // The modal pages composed right now: two while one replaces the other.
    val composedPages = remember { mutableStateListOf<String>() }
    val floor = target != null && targets.previous != null && composedPages.size > 1
    Box(modifier.fillMaxSize()) {
        if (floor) Box(Modifier.fillMaxSize().pageBackground(LocalThesisPalette.current))
        AnimatedContent(
            targetState = target,
            // Full size in every state, so opening or closing never animates the container from 0 x 0.
            modifier = Modifier.fillMaxSize(),
            transitionSpec = {
                val from = initialState
                val forward = from != null && onStack(from)
                modalTransitionFor(from, targetState, forward, env.reducedMotion)
                    .toContentTransform(env.px, pageFadesItsContent = true)
            },
            contentKey = { it?.entryId },
            label = "modal-layer"
        ) { entry ->
            if (entry != null) {
                val enteredBy = remember {
                    val from = targets.previous
                    modalTransitionFor(from, entry, forward = from != null && onStack(from), env.reducedMotion)
                }
                DisposableEffect(entry.entryId) {
                    composedPages += entry.entryId
                    onDispose { composedPages -= entry.entryId }
                }
                OpaqueEntry(entry, env, fadeContentIn = enteredBy.incomingPageOpaque) { content(entry) }
            } else {
                Box(Modifier.fillMaxSize())
            }
        }
    }
}

/**
 * One page on the shared page background (the window-fixed bitmap, 2.7), with its saved state keyed by `entryId`.
 * Opaque to touch as well as to the eye: a pointer handler on the page stops hit testing here, so a tap on an
 * empty part of a screen pushed over the report never reaches the covered WebView underneath.
 *
 * [fadeContentIn]: the page arrived by shared-axis X ([ShellTransition.incomingPageOpaque]). Its background is
 * opaque from the first frame and only its content fades in (300 ms `EaseEnter`, [pageContentFadeSpec]), so the
 * page it covers never double-exposes with it (4.5). The alpha is read in the draw phase only.
 */
@Composable
private fun OpaqueEntry(entry: NavEntry, env: ShellLayerEnv, fadeContentIn: Boolean, content: @Composable () -> Unit) {
    val contentAlpha = remember { Animatable(if (fadeContentIn) 0f else 1f) }
    LaunchedEffect(contentAlpha) {
        if (contentAlpha.value < 1f) contentAlpha.animateTo(1f, pageContentFadeSpec())
    }
    Box(
        Modifier
            .fillMaxSize()
            .backPreview(env.backPreview, entry.entryId, env.backShiftPx, env.reducedMotion)
            .pageBackground(LocalThesisPalette.current)
            .pointerInput(Unit) {
                awaitPointerEventScope {
                    while (true) awaitPointerEvent()
                }
            }
    ) {
        Box(Modifier.fillMaxSize().graphicsLayer { alpha = contentAlpha.value }) {
            LeaveHook(entry.entryId, env.backPreview)
            env.holder.SaveableStateProvider(entry.entryId) { content() }
        }
    }
}

/** Out of the accessibility tree while [hidden] (a modal or the paywall is over the layer). */
private fun Modifier.hiddenFromAccessibility(hidden: Boolean): Modifier =
    if (hidden) clearAndSetSemantics { } else this

/** Ends the predictive-back preview of [entryId] when its page leaves the composition (its exit has run). */
@Composable
private fun LeaveHook(entryId: String, preview: BackPreview) {
    DisposableEffect(entryId) {
        onDispose { preview.onLeft(entryId) }
    }
}

/** [value], except that while [hold] is true it keeps returning the last value seen before. Not snapshot state. */
@Composable
internal fun <T> heldWhile(hold: Boolean, value: T): T {
    val held = remember { HeldValue(value) }
    if (!hold) held.value = value
    return held.value
}

private class HeldValue<T>(var value: T)

/** The layer's current target and the one before it, updated during composition. Not snapshot state. */
private class TargetHistory(initial: NavEntry?) {
    var current: NavEntry? = initial
        private set
    var previous: NavEntry? = null
        private set

    fun update(target: NavEntry?) {
        if (target?.entryId != current?.entryId) {
            previous = current
            current = target
        }
    }
}
