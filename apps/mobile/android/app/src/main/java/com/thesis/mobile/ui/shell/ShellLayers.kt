package com.thesis.mobile.ui.shell

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.EnterExitState
import androidx.compose.animation.ExperimentalAnimationApi
import androidx.compose.animation.ExperimentalSharedTransitionApi
import androidx.compose.animation.core.rememberTransition
import androidx.compose.animation.core.updateTransition
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.SaveableStateHolder
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.semantics.clearAndSetSemantics
import com.thesis.mobile.ui.components.TopBarInsets
import com.thesis.mobile.ui.components.pageBackground
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.platform.RenderFlags
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.heroOf

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
 * covers the layer, so it is out of the accessibility tree. [composed], when given, holds the entries composed in
 * the layer right now (two while one replaces the other), and [moving], when given, the ids of those whose enter or
 * exit is still running, so the shell can tell a settled tab root from one in a move.
 *
 * The layer runs on [seek]'s SeekableTransitionState (PR-4b): it follows [target] with `animateTo` (a frame or two
 * after the navigator moves; the shell drives the report base layer from [TabSeek.shown] so both stay in step),
 * and a back gesture scrubs a pop with its progress ([TabSeek], ShellBackSeek.kt). A page opened from a list row
 * ([originOf]) grows from it as a shared-bounds container transform (ShellTransform.kt).
 */
// EnterExitState and AnimatedVisibilityScope.transition: experimental in Compose 1.6, stable since 1.7.
@OptIn(ExperimentalAnimationApi::class, ExperimentalSharedTransitionApi::class)
@Composable
internal fun TabLayer(
    target: NavEntry,
    move: () -> NavMove,
    env: ShellLayerEnv,
    drawnBelow: (NavEntry) -> Boolean,
    modifier: Modifier = Modifier,
    hidden: Boolean = false,
    composed: MutableList<NavEntry>? = null,
    moving: MutableList<String>? = null,
    originOf: (NavEntry) -> Rect? = { null },
    seek: TabSeek? = null,
    content: @Composable (NavEntry) -> Unit,
) {
    val tabSeek = seek ?: remember { TabSeek(target) }
    LaunchedEffect(target, tabSeek.gesture) { tabSeek.drive(target) }
    // While a back gesture scrubs (or settles back), the layer is moving as a pop, whatever the last move was.
    val layerMove = { if (tabSeek.gesture != null) NavMove.Pop else move() }
    val layerTransition = rememberTransition(tabSeek.transitionState, label = "tab-layer")
    var layerTopLeft by remember { mutableStateOf(Offset.Zero) }
    WithShellTransformScope(
        modifier
            .fillMaxSize()
            .hiddenFromAccessibility(hidden)
            .onGloballyPositioned { layerTopLeft = it.positionInWindow() }
    ) {
        val shared = LocalShellTransformScope.current
        val layerTransform = rememberLayerTransform(layerTransition.currentState, layerTransition.targetState, layerMove, env.reducedMotion, originOf)
        layerTransition.AnimatedContent(
            modifier = Modifier.fillMaxSize(),
            transitionSpec = {
                val move = tabTransitionFor(
                    layerMove(),
                    env.reducedMotion,
                    pushedFromRow = originOf(targetState) != null,
                    poppedToRow = originOf(initialState) != null,
                )
                // A back gesture scrubs a plain pop with the page under coming in beneath the page on top.
                (if (move == ShellTransition.Backward && tabSeek.seeking) ShellTransition.BackSeek else move)
                    .toContentTransform(env.px, tabSeek.edge)
            },
            contentKey = { it.entryId },
        ) { entry ->
            if (composed != null) {
                DisposableEffect(entry.entryId) {
                    composed += entry
                    onDispose { composed.removeAll { it.entryId == entry.entryId } }
                }
            }
            if (moving != null) {
                val atRest = transition.currentState == transition.targetState
                DisposableEffect(entry.entryId, atRest) {
                    if (!atRest) moving += entry.entryId
                    onDispose { moving.remove(entry.entryId) }
                }
            }
            if (drawnBelow(entry)) {
                Box(Modifier.fillMaxSize())
            } else {
                // Fade-through's .985 → 1 scale moves the page's content only: the page background (the window-fixed
                // bitmap with its glow) never moves during foreground motion (4.3.4).
                val scaleIn = remember { shellTransitionFor(layerMove(), env.reducedMotion) == ShellTransition.FadeThrough }
                val contentScale = transition.animateFloat(
                    transitionSpec = { if (scaleIn && targetState == EnterExitState.Visible) fadeThroughInSpec() else snapSpec() },
                    label = "tab-content-scale"
                ) { state -> if (state == EnterExitState.PreEnter && scaleIn) ThesisMotion.TabScaleFrom else 1f }
                // Container transform (4.5): a page opened from a list row grows from the row's bounds over the list
                // and shrinks back into them on the pop. Decided once per direction, from the move that brought it in
                // and the one that takes it out, so a later shared-axis push over it never shrinks it.
                val origin = originOf(entry)
                val canTransform = origin != null && !env.reducedMotion && shared != null
                val revealIn = remember { canTransform && layerMove() == NavMove.Push }
                val leaving = transition.targetState == EnterExitState.PostExit
                val revealOut = remember(leaving) { leaving && canTransform && layerMove() == NavMove.Pop }
                val reveal = transformProgress(revealIn, revealOut, label = "tab-container-reveal")
                val clock = transformClock(revealIn, revealOut, label = "tab-container-clock")
                // Only while the move runs (a page opened from a row is a plain page once it rests).
                val inMove = transition.currentState != transition.targetState
                val transforming = canTransform && inMove && (if (leaving) revealOut else revealIn)
                // This page as the list under another page's transform: the scrim over it, and the row placeholder.
                val under = layerTransform?.takeIf { it.page.entryId != entry.entryId }
                val scrim = transformScrim(under?.transition)
                val palette = LocalThesisPalette.current
                // The page under a held back gesture (a plain pop): its content is cleared toward the .90 preview's
                // edges, so the preview never cuts a glyph of it; eased off on commit or cancel.
                val peeked = (tabSeek.gesture as? BackGesture.Seeking)?.takeIf { !it.intoRow }?.peek?.entryId == entry.entryId
                val clearAround = animateFloatAsState(
                    targetValue = if (peeked && !env.reducedMotion) 1f else 0f,
                    animationSpec = if (peeked) snapSpec() else motionSpec(ThesisMotion.Quick, easing = ThesisMotion.EaseStandard),
                    label = "tab-clear-around-preview"
                )
                Box(
                    if (canTransform && shared != null) {
                        val state = with(shared) { rememberSharedContentState(TransformKey(entry.entryId)) }
                        val clip = remember { TransformClip { reveal.value } }
                        Modifier
                            .fillMaxSize()
                            .transformBounds(shared, this, state, clip)
                            // At the row the container fades with the row's content under it (no pop at either end).
                            .graphicsLayer {
                                alpha = if (transforming) transformContainerAlpha(reveal.value, clock.value, out = leaving) else 1f
                            }
                    } else {
                        Modifier.fillMaxSize()
                    }
                ) {
                    OpaqueEntry(
                        entry, env,
                        // The page's content arrives over the last 70% of the transform; on the way back it recedes
                        // over the first 70% of the time, until the container hands over to the row.
                        contentAlpha = if (transforming) {
                            if (leaving) {
                                { transformContentAlphaOut(clock.value) }
                            } else {
                                { transformContentAlpha(reveal.value) }
                            }
                        } else {
                            { 1f }
                        },
                        contentScale = { contentScale.value },
                        // The row's `surface` gives way to the page's `bg` as it grows.
                        surfaceVeil = if (transforming) {
                            { 1f - reveal.value }
                        } else {
                            { 0f }
                        },
                        clearAroundPreview = { clearAround.value },
                    ) { content(entry) }
                }
                if (under != null) {
                    // The list stays put and recedes under the scrim while the page grows over it (drawn over the
                    // list's page, under the page in transform, which moves in the transform scope's overlay).
                    Box(Modifier.fillMaxSize().drawBehind { drawRect(palette.scrim, alpha = scrim.value) }) {
                        if (shared != null && !drawnBelow(under.page)) {
                            TransformOrigin(shared, this@AnimatedContent, TransformKey(under.page.entryId), under.origin, layerTopLeft)
                        }
                    }
                }
            }
        }
    }
}

/**
 * The report base layer (4.5 "The report WebView survives pushes over it"): the last `Report` entry of the current
 * stack ([entry]; null when there is none) stays composed under the tab layer while screens are pushed over it, so
 * back returns to the live page with its scroll, without a reload. It moves with the same transitions as the tab
 * layer when it arrives or leaves (pushed, popped, a tab switch), so there is no hard cut.
 *
 * While a screen pushed over it covers it ([tabTopId] != the report), it slides out like the old page of a push
 * (to −24 dp and transparent, 90 ms `EaseExit`) and stays composed; when that screen is popped it slides back
 * like the new page of a pop (210 ms `EaseEnter`), once the popped screen has gone (after 90 ms), so the two
 * never show at once. Reduced motion: it only fades. A report that is leaving keeps whatever cover it had.
 * Touches never reach a covered report: the opaque page above it takes them ([OpaqueEntry]). [hidden]: a modal
 * or the paywall covers it, so it is out of the accessibility tree as well (it does not slide for that).
 *
 * A report opened from a History or Research row ([originOf], PR-4b) grows from the row over the list and shrinks
 * back into it, as a shared-bounds transform: it moves in the transform scope's overlay, so it is drawn over the
 * tab layer (where the list is) for that move only, and the WebView stays in this layer the whole time. The WebView
 * is kept out of the overlay (shared elements do not support View interop there): the container carries the
 * report's own cover instead (`bg` under the top bar, then the navy hero, [drawReportCover]); the content fades in
 * over it in place once the bounds settle (`Quick`), and on the way back fades out over the shrink's first 75 ms
 * (`ReportContentOut`, the one window in which it is drawn in the overlay; a device-gate item) instead of leaving
 * in one frame.
 */
@OptIn(ExperimentalAnimationApi::class, ExperimentalSharedTransitionApi::class)
@Composable
internal fun ReportBaseLayer(
    entry: NavEntry?,
    tabTopId: String,
    move: () -> NavMove,
    env: ShellLayerEnv,
    modifier: Modifier = Modifier,
    hidden: Boolean = false,
    originOf: (NavEntry) -> Rect? = { null },
    content: @Composable (NavEntry) -> Unit,
) {
    val layerTransition = updateTransition(entry, label = "report-base-layer")
    var layerTopLeft by remember { mutableStateOf(Offset.Zero) }
    WithShellTransformScope(
        modifier
            .fillMaxSize()
            .hiddenFromAccessibility(hidden)
            .onGloballyPositioned { layerTopLeft = it.positionInWindow() }
    ) {
        val shared = LocalShellTransformScope.current
        val layerTransform = rememberLayerTransform(layerTransition.currentState, layerTransition.targetState, move, env.reducedMotion, originOf)
        layerTransition.AnimatedContent(
            modifier = Modifier.fillMaxSize(),
            // The report has no background of its own (the root's shows through it); it fades as a whole, like a page.
            transitionSpec = {
                val transform = layerTransformOf(initialState, targetState, move(), env.reducedMotion, originOf)
                (transform?.transition ?: shellTransitionFor(move(), env.reducedMotion)).toContentTransform(env.px)
            },
            contentKey = { it?.entryId },
        ) { report ->
            // The state this layer leaves on a push from a row (or returns to on the pop into it) holds the row's
            // placeholder, so the report's bounds start (or end) at the row.
            val placeholder = layerTransform?.takeIf { it.page.entryId != report?.entryId }
            if (report == null) {
                Box(Modifier.fillMaxSize()) {
                    if (placeholder != null && shared != null) {
                        TransformOrigin(shared, this@AnimatedContent, TransformKey(placeholder.page.entryId), placeholder.origin, layerTopLeft)
                    }
                }
                return@AnimatedContent
            }
            // A report that is no longer the layer's target is leaving (its exit transition is running).
            val leaving = report.entryId != entry?.entryId
            val covered = heldWhile(leaving, report.entryId != tabTopId)
            val cover by animateFloatAsState(
                targetValue = if (covered) 1f else 0f,
                animationSpec = when {
                    env.reducedMotion -> ThesisMotion.timed(reduced = false, durationMillis = ThesisMotion.Quick)
                    // The old page of a push; then, uncovered, the new page of a pop (after the popped page's exit).
                    covered -> sharedAxisOutSpec()
                    else -> sharedAxisInSpec()
                },
                label = "report-cover"
            )
            val origin = originOf(report)
            val canTransform = origin != null && !env.reducedMotion && shared != null
            val revealIn = remember { canTransform && move() == NavMove.Push }
            val exiting = this.transition.targetState == EnterExitState.PostExit
            val revealOut = remember(exiting) { exiting && canTransform && move() == NavMove.Pop }
            val reveal = transformProgress(revealIn, revealOut, label = "report-container-reveal")
            val clock = transformClock(revealIn, revealOut, label = "report-container-clock")
            // Only while the move runs: at rest the report draws on the root's background again, like any report.
            val inMove = this.transition.currentState != this.transition.targetState
            val transforming = canTransform && inMove && (if (exiting) revealOut else revealIn)
            // The WebView (an AndroidView, which shared elements do not support in the overlay) is kept out of the
            // overlay: it is at alpha 0 while the container grows from the row, and fades in once the bounds have
            // settled and the report is drawn in this layer again. On the way back it fades out over the first
            // `ReportContentOut` (75 ms) of the shrink, so the text does not vanish in one frame. Meanwhile the
            // container carries the report's own cover ([drawReportCover]) under it.
            val contentIn by animateFloatAsState(
                targetValue = if (transforming) 0f else 1f,
                animationSpec = when {
                    !transforming -> motionSpec(ThesisMotion.Quick, easing = ThesisMotion.EaseStandard)
                    exiting -> motionSpec(ThesisMotion.ReportContentOut, easing = ThesisMotion.Linear)
                    else -> snapSpec()
                },
                label = "report-content-in"
            )
            val coverOn = canTransform && (transforming || (revealIn && !exiting && contentIn < 1f))
            val palette = LocalThesisPalette.current
            val hero = remember(palette) { heroOf(palette) }
            // The top bar's insets (status bar and cutout, no IME), read in the draw phase only while the cover is
            // drawn: an IME frame on a report never recomposes this layer.
            val topInsets = TopBarInsets
            Box(Modifier.fillMaxSize()) {
                Box(
                    Modifier
                        .fillMaxSize()
                        .then(
                            if (canTransform && shared != null) {
                                val state = with(shared) { rememberSharedContentState(TransformKey(report.entryId)) }
                                val clip = remember { TransformClip { reveal.value } }
                                Modifier.transformBounds(shared, this@AnimatedContent, state, clip)
                            } else {
                                Modifier
                            }
                        )
                        .graphicsLayer {
                            alpha = (1f - cover) *
                                if (transforming) transformContainerAlpha(reveal.value, clock.value, out = exiting) else 1f
                            if (!env.reducedMotion) translationX = -cover * env.px.shiftPx
                        }
                        // Hidden under the page above it: out of the accessibility tree too (Compose semantics).
                        .hiddenFromAccessibility(covered)
                        .backPreview(env.backPreview, report.entryId, env.backShiftPx, env.reducedMotion)
                        // The report draws on the root's page background; in transform it carries its own, since
                        // it is drawn over the list.
                        .then(if (transforming) Modifier.pageBackground(palette) else Modifier)
                ) {
                    if (coverOn) {
                        // The report's cover (top bar `bg`, then the navy hero), from the row's `surface` at the row;
                        // once the bounds settle it fades out as the content fades in over it.
                        Box(
                            Modifier
                                .fillMaxSize()
                                .graphicsLayer { alpha = if (transforming) 1f else 1f - contentIn }
                                .drawBehind {
                                    drawReportCover(
                                        palette, hero, topInsets.getTop(this) + ThesisSpace.topBar.toPx(), RenderFlags.pageGlow,
                                        rowVeil = if (transforming) 1f - reveal.value else 0f
                                    )
                                }
                        )
                    }
                    Box(Modifier.fillMaxSize().graphicsLayer { alpha = contentIn }) {
                        LeaveHook(report.entryId, env.backPreview)
                        env.holder.SaveableStateProvider(report.entryId) { content(report) }
                    }
                }
                if (placeholder != null && shared != null) {
                    TransformOrigin(shared, this@AnimatedContent, TransformKey(placeholder.page.entryId), placeholder.origin, layerTopLeft)
                }
            }
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
 * leaving page slides out and fades as in a push (90 ms `EaseExit`) and the screens under the modal never show
 * through it or through the strip the new page slides in from.
 *
 * Rise and Fall fade the page (its background) in place over the tab page and move only its content 32 dp
 * ([ModalContentMotion]): on a rise the content rises and fades in once the background covers the page under it
 * (150 ms, the content from 120 ms, once under 1% of the page under it shows), on a fall it fades out before the
 * background, so the two pages' text never overlaps.
 */
// EnterExitState and AnimatedVisibilityScope.transition: experimental in Compose 1.6, stable since 1.7.
@OptIn(ExperimentalAnimationApi::class)
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
                    .toContentTransform(env.px)
            },
            contentKey = { it?.entryId },
            label = "modal-layer"
        ) { entry ->
            if (entry != null) {
                val motionIn = remember {
                    val from = targets.previous
                    ModalContentMotion.of(modalTransitionFor(from, entry, forward = from != null && onStack(from), env.reducedMotion))
                }
                // Once this page is no longer the target, how it leaves (the layer's target is already the new one).
                val leaving = transition.targetState == EnterExitState.PostExit
                val motionOut = if (leaving) {
                    ModalContentMotion.of(modalTransitionFor(entry, targets.current, forward = onStack(entry), env.reducedMotion))
                } else {
                    ModalContentMotion.None
                }
                val contentAlpha = transition.animateFloat(
                    transitionSpec = {
                        val entering = targetState == EnterExitState.Visible
                        modalContentAlphaSpec(if (entering) motionIn else motionOut, entering)
                    },
                    label = "modal-content-alpha"
                ) { state ->
                    when (state) {
                        EnterExitState.PreEnter -> if (motionIn == ModalContentMotion.Rise) 0f else 1f
                        EnterExitState.Visible -> 1f
                        EnterExitState.PostExit -> if (motionOut == ModalContentMotion.Fall) 0f else 1f
                    }
                }
                val contentDrop = transition.animateFloat(
                    transitionSpec = {
                        val entering = targetState == EnterExitState.Visible
                        modalContentOffsetSpec(if (entering) motionIn else motionOut, entering)
                    },
                    label = "modal-content-drop"
                ) { state ->
                    when (state) {
                        EnterExitState.PreEnter -> if (motionIn == ModalContentMotion.Rise) 1f else 0f
                        EnterExitState.Visible -> 0f
                        EnterExitState.PostExit -> if (motionOut == ModalContentMotion.Fall) 1f else 0f
                    }
                }
                DisposableEffect(entry.entryId) {
                    composedPages += entry.entryId
                    onDispose { composedPages -= entry.entryId }
                }
                OpaqueEntry(
                    entry, env,
                    contentAlpha = { contentAlpha.value },
                    contentOffsetY = { contentDrop.value * env.px.risePx }
                ) { content(entry) }
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
 * [contentAlpha], [contentOffsetY] and [contentScale] move the content inside the page while its background stays
 * (a modal's rise and fall, [ModalContentMotion]; fade-through's scale); [surfaceVeil] lays `surface` over the
 * background (a container transform's row colour); [clearAroundPreview] clears the content toward the edges of the
 * back preview over it ([clearAroundBackPreview]). All are read in the draw phase only.
 */
@Composable
private fun OpaqueEntry(
    entry: NavEntry,
    env: ShellLayerEnv,
    contentAlpha: () -> Float = { 1f },
    contentOffsetY: () -> Float = { 0f },
    contentScale: () -> Float = { 1f },
    surfaceVeil: () -> Float = { 0f },
    clearAroundPreview: () -> Float = { 0f },
    content: @Composable () -> Unit,
) {
    val palette = LocalThesisPalette.current
    // The page's window position outside the back-preview layer (it includes a push's slide, so the background
    // stays window-fixed while the page slides): the preview then scales the page and its background as one surface.
    var origin by remember { mutableStateOf(Offset.Zero) }
    Box(
        Modifier
            .fillMaxSize()
            .onGloballyPositioned { origin = it.positionInWindow() }
            .backPreview(env.backPreview, entry.entryId, env.backShiftPx, env.reducedMotion)
            .pageBackground(palette, origin = { origin })
            // A page in a container transform starts as the row's `surface` over its background (4.5).
            .drawBehind {
                val veil = surfaceVeil()
                if (veil > 0f) drawRect(palette.surface, alpha = veil)
            }
            .pointerInput(Unit) {
                awaitPointerEventScope {
                    while (true) awaitPointerEvent()
                }
            }
    ) {
        Box(
            Modifier
                .fillMaxSize()
                .graphicsLayer {
                    alpha = contentAlpha()
                    translationY = contentOffsetY()
                    val scale = contentScale()
                    scaleX = scale
                    scaleY = scale
                    // Offscreen only while the strips around a back preview are cleared (DstOut needs its own layer).
                    compositingStrategy = if (clearAroundPreview() > 0f) CompositingStrategy.Offscreen else CompositingStrategy.Auto
                }
                .drawWithContent {
                    drawContent()
                    val clear = clearAroundPreview()
                    if (clear > 0f) clearAroundBackPreview(env.backPreview, clear, env.backShiftPx, palette.ink)
                }
        ) {
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
internal class TargetHistory(initial: NavEntry?) {
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
