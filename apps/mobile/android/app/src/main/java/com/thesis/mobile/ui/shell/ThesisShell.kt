package com.thesis.mobile.ui.shell

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.ContentTransform
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.FiniteAnimationSpec
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.SaveableStateHolder
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.GraphicsLayerScope
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Dp
import com.thesis.mobile.ui.UiState
import com.thesis.mobile.ui.components.BottomBarItem
import com.thesis.mobile.ui.components.LoadingHairline
import com.thesis.mobile.ui.components.LocalPageBackgroundCache
import com.thesis.mobile.ui.components.ProvidePageBackground
import com.thesis.mobile.ui.components.ThesisBottomBar
import com.thesis.mobile.ui.components.ThesisSnackbarHost
import com.thesis.mobile.ui.components.pageBackground
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.navigation.Destination
import com.thesis.mobile.ui.navigation.ShellTab
import com.thesis.mobile.ui.navigation.ThesisBackTopBar
import com.thesis.mobile.ui.navigation.ShellRootTopBar
import com.thesis.mobile.ui.navigation.shellNavItems
import com.thesis.mobile.ui.platform.BackSwipeEdge
import com.thesis.mobile.ui.platform.ThesisBackHandler
import com.thesis.mobile.ui.platform.ThesisPredictiveBackHandler
import com.thesis.mobile.ui.screens.PaywallScreen
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

/**
 * The logged-in app (DESIGN-DIRECTION 5.5). Pure: it takes the published [state], the [navigator] (snapshot
 * state, owned by `MainViewModel`), the [actions] and the Android-only [platform] pieces, so design-preview
 * renders it with fixture state for every tab.
 *
 * Layers, bottom to top: root `bg` → the report base layer (a `Report` entry on the current tab stays composed
 * under screens pushed over it, so its WebView keeps scroll and session; its back handlers are off while it is
 * covered) → the tab layer (`AnimatedContent` over the current tab's top entry, 4.5 transitions, each entry's
 * saved state keyed by its `entryId`) → the bottom bar (slides away on Report, ReportClassic, DeepDiveRunning) →
 * the modal layer (You, Search, Paywall destinations) → the paywall → snackbars (one host, last child of the
 * root, so messages raised while You or Search is open are seen: 5.5 layer order). The paywall is still a
 * `Dialog` (its own window above the activity), so a snackbar raised while it is open (restore, purchase) is
 * drawn under it and seen only once it closes; 5.23 (WP-G) makes the paywall a full-screen destination, which
 * fixes that.
 *
 * Each entry draws its own top bar (5.5 "each screen supplies its top bar") and computes its own insets from its
 * own destination, so in a push or pop the bar moves with its screen and the leaving screen keeps its layout
 * while it slides out (principle 8).
 *
 * Back (4.5): a predictive back handler, enabled while [AppNavigator.canGoBack], previews the pop by scaling the
 * visible page to .90 and shifting it 8 dp away from the swipe edge (under reduced motion the page stays still,
 * 4.8), and commits with `actions.onBack()`; while the paywall is open, back closes it. Both are registered before
 * the layers, so a report WebView's own "back within the page" handler (registered later) wins while it has
 * history and the report is not covered. The whole tree sits on one shared page background (2.7).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ThesisShell(
    state: UiState,
    navigator: AppNavigator,
    actions: ShellActions,
    modifier: Modifier = Modifier,
    platform: ShellPlatform = ShellPlatform(),
    snackbarHostState: SnackbarHostState = remember { SnackbarHostState() }
) {
    val holder = rememberSaveableStateHolder()
    val reducedMotion = LocalReducedMotion.current
    val palette = LocalThesisPalette.current
    val shiftPx = with(LocalDensity.current) { SHARED_AXIS_SHIFT.roundToPx() }
    val modalRisePx = with(LocalDensity.current) { ThesisMotion.ModalOffset.roundToPx() }
    val backShiftPx = with(LocalDensity.current) { PREDICTIVE_BACK_SHIFT.toPx() }
    var sampleDismissed by rememberSaveable { mutableStateOf(false) }
    var bottomBarHeightPx by remember { mutableIntStateOf(0) }

    val tabTop = navigator.tabTop
    val modalTop = navigator.modalStack.lastOrNull()
    val currentStack = navigator.stack(navigator.currentTab)
    val reportBase = currentStack.lastOrNull { it.destination is Destination.Report }
    val paywallOpen = !state.paywallFeature.isNullOrBlank()
    val bottomBarShown = !tabTop.destination.hidesBottomBar
    // The report is what the user sees only as the tab top with nothing over it.
    val reportCovered = reportBase != null &&
        (reportBase.entryId != tabTop.entryId || modalTop != null || paywallOpen)

    // Drop the saved UI state of entries that left every stack.
    val liveIds = navigator.liveEntryIds()
    val shownIds = remember { mutableSetOf<String>() }
    LaunchedEffect(liveIds) {
        (shownIds - liveIds).forEach(holder::removeState)
        shownIds.retainAll(liveIds)
        shownIds.addAll(liveIds)
    }

    // Predictive back (4.5): progress 0..1 of the gesture, and the edge it started from.
    val backProgress = remember { Animatable(0f) }
    var backEdge by remember { mutableStateOf(BackSwipeEdge.Left) }
    // The layer the gesture previews: the modal layer when a modal (You, Search) is open, else the page under it.
    // Fixed when the gesture starts, so the modal keeps its transform while it leaves after the commit.
    var backPreviewsModal by remember { mutableStateOf(false) }
    val backScope = rememberCoroutineScope()
    ThesisPredictiveBackHandler(enabled = navigator.canGoBack && !paywallOpen) { events ->
        backPreviewsModal = navigator.modalStack.isNotEmpty()
        try {
            events.collect { event ->
                backEdge = event.swipeEdge
                backProgress.snapTo(event.progress)
            }
            // Commit: the pop runs from the previewed state and the layer settles back to full size while it plays
            // (no jump to full size first). Interim until PR-2 M3 scales only the leaving page.
            actions.onBack()
            backScope.launch { backProgress.animateTo(0f, ThesisMotion.spatialSlow()) }
        } catch (cancelled: CancellationException) {
            backScope.launch { backProgress.animateTo(0f, ThesisMotion.spatialSlow()) }
            throw cancelled
        }
    }
    ThesisBackHandler(enabled = paywallOpen) { actions.onDismissPaywall() }

    val scope = ShellContentScope(
        state = state,
        navigator = navigator,
        actions = actions,
        platform = platform,
        sampleDismissed = sampleDismissed,
        onDismissSample = { sampleDismissed = true }
    )

    ShellPageBackground(modifier) {
        Box(Modifier.fillMaxSize()) {
            // The visible page follows the back gesture: the report base layer and tab layer, or the modal layer
            // when the gesture closes a modal. Reduced motion: no scale or translation (4.8); back still commits.
            val backPreview: GraphicsLayerScope.() -> Unit = {
                val progress = if (reducedMotion) 0f else backProgress.value
                val scale = 1f - (1f - PREDICTIVE_BACK_SCALE) * progress
                scaleX = scale
                scaleY = scale
                translationX = progress * backShiftPx * if (backEdge == BackSwipeEdge.Left) 1f else -1f
            }
            Box(
                Modifier
                    .fillMaxSize()
                    .graphicsLayer { if (!backPreviewsModal) backPreview() }
            ) {
                if (reportBase != null) {
                    key(reportBase.entryId) {
                        holder.SaveableStateProvider(reportBase.entryId) {
                            platform.backScope(reportCovered) {
                                scope.EntryFrame(reportBase, inModal = false, bottomBarHeightPx = bottomBarHeightPx)
                            }
                        }
                    }
                }
                AnimatedContent(
                    targetState = tabTop,
                    modifier = Modifier.fillMaxSize(),
                    transitionSpec = { tabTransition(navigator.lastMove, reducedMotion, shiftPx) },
                    contentKey = { it.entryId },
                    label = "tab-layer"
                ) { entry ->
                    if (entry.destination is Destination.Report) {
                        // A report is drawn only by the base layer: on top, this layer stays empty so nothing
                        // covers it, and a report that is leaving (another report pushed over it, a tab switch)
                        // never builds a second WebView here.
                        Box(Modifier.fillMaxSize())
                    } else {
                        OpaqueEntry(holder, entry) {
                            scope.EntryFrame(entry, inModal = false, bottomBarHeightPx = bottomBarHeightPx)
                        }
                    }
                }
            }

            ShellBottomBar(
                shown = bottomBarShown,
                reducedMotion = reducedMotion,
                items = shellNavItems(inboxHasNew = state.hasNewInboxItems),
                selectedKey = navigator.selectedTab?.name,
                onSelect = { key -> ShellTab.entries.firstOrNull { it.name == key }?.let(actions::onSelectTab) },
                onHeight = { bottomBarHeightPx = it }
            )

            AnimatedContent(
                targetState = modalTop,
                // Full size in both states, so opening or closing never animates the container from 0 x 0.
                modifier = Modifier
                    .fillMaxSize()
                    .graphicsLayer { if (backPreviewsModal) backPreview() },
                transitionSpec = { modalTransition(reducedMotion, modalRisePx) },
                contentKey = { it?.entryId },
                label = "modal-layer"
            ) { entry ->
                if (entry != null) {
                    OpaqueEntry(holder, entry) {
                        scope.EntryFrame(entry, inModal = true, bottomBarHeightPx = bottomBarHeightPx)
                    }
                } else {
                    // Empty, transparent and without pointer input: touches reach the tab layer underneath.
                    Box(Modifier.fillMaxSize())
                }
            }

            if (paywallOpen) {
                PaywallScreen(
                    alerts = state.alertLedger,
                    watchlist = state.watchlist,
                    offers = state.subscriptionOffers,
                    actionInFlight = state.subscriptionActionInFlight,
                    onPurchase = { preferredType -> platform.startPurchase?.invoke(preferredType) },
                    onRestore = actions::onRestorePurchases,
                    onRefreshOffers = actions::onRefreshOffers,
                    onDismiss = actions::onDismissPaywall
                )
            }

            // Above every layer: the bottom bar is visible (and the snackbar sits on it) only on a tab entry with
            // no modal or paywall over it; otherwise the snackbar sits on the navigation bar or the keyboard.
            ShellSnackbarHost(
                hostState = snackbarHostState,
                barHeightPx = { if (bottomBarShown && modalTop == null && !paywallOpen) bottomBarHeightPx else 0 }
            )
        }
    }
}

/**
 * The shared page background (2.7): reuses the window-sized cache `ThesisApp` provides, else provides one here
 * (design-preview renders the shell on its own).
 */
@Composable
private fun ShellPageBackground(modifier: Modifier, content: @Composable () -> Unit) {
    if (LocalPageBackgroundCache.current != null) {
        Box(modifier.fillMaxSize()) { content() }
    } else {
        ProvidePageBackground(modifier, content)
    }
}

/** Predictive back preview (4.5): the page scales to this and shifts [PREDICTIVE_BACK_SHIFT] at full progress. */
private const val PREDICTIVE_BACK_SCALE = 0.90f
private val PREDICTIVE_BACK_SHIFT: Dp = ThesisMotion.EnterOffset

/**
 * One entry's page: its own top bar ([topBarFor], or a back bar on the modal stack) and its own insets. The
 * bottom inset is the bottom bar's height when this entry's destination shows the bar, else the navigation bar,
 * so an entry that is leaving keeps its layout while the bar slides in or away.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ShellContentScope.EntryFrame(entry: NavEntry, inModal: Boolean, bottomBarHeightPx: Int) {
    val bar = if (inModal) ShellTopBar.Back else topBarFor(entry.destination, state)
    val reserveBottomBar = !inModal && !entry.destination.hidesBottomBar && bottomBarHeightPx > 0
    Scaffold(
        // The page background is painted under the entry (OpaqueEntry, or the root for the report base layer).
        containerColor = Color.Transparent,
        topBar = {
            when (bar) {
                ShellTopBar.Root -> Box {
                    ShellRootTopBar(
                        initials = initialsOf(state.userProfile?.email),
                        onOpenSearch = actions::onOpenSearch,
                        onOpenProfile = actions::onOpenYou
                    )
                    // Interim (5.5) until PR-3 puts the hairline in each root's ScreenHeader: over the bar's
                    // bottom edge, no layout shift.
                    if (rootRefreshing(entry.destination, state)) {
                        LoadingHairline(active = true, modifier = Modifier.align(Alignment.BottomCenter))
                    }
                }
                ShellTopBar.Back -> ThesisBackTopBar(
                    title = titleOf(entry.destination, state),
                    onBack = { actions.onBack() }
                )
                ShellTopBar.None -> Unit
            }
        },
        bottomBar = {
            // Reserves the shell's bottom bar (drawn above the tab layer) in this entry's padding.
            if (reserveBottomBar) {
                val height = with(LocalDensity.current) { bottomBarHeightPx.toDp() }
                Spacer(Modifier.fillMaxWidth().height(height))
            }
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .consumeWindowInsets(padding)
                .imePadding()
        ) {
            Content(entry, padding)
        }
    }
}

/** Whether the tab root [destination] is refreshing its data in the background (the 5.5 refresh flags). */
internal fun rootRefreshing(destination: Destination, state: UiState): Boolean = when (destination) {
    Destination.Today -> state.isPulseRefreshing || state.isMacroRefreshing
    Destination.Names -> state.isBoardRefreshing
    Destination.Research -> state.isHistoryLoading
    Destination.Inbox -> state.isInboxRefreshing
    else -> false
}

/**
 * The bottom bar, always composed (so its height is known before it shows again) and drawn above the tab layer.
 * Hiding slides it down by its height and fades it (3 #4, `Base`); showing is the reverse; reduced motion fades
 * only (4.8). While hidden it is below the screen edge, out of the accessibility tree, and ignores taps.
 */
@Composable
private fun BoxScope.ShellBottomBar(
    shown: Boolean,
    reducedMotion: Boolean,
    items: List<BottomBarItem>,
    selectedKey: String?,
    onSelect: (String) -> Unit,
    onHeight: (Int) -> Unit
) {
    val hidden by animateFloatAsState(
        targetValue = if (shown) 0f else 1f,
        animationSpec = if (reducedMotion) {
            motionSpec(ThesisMotion.Quick, easing = ThesisMotion.EaseStandard)
        } else {
            motionSpec(ThesisMotion.Base, easing = if (shown) ThesisMotion.EaseEnter else ThesisMotion.EaseExit)
        },
        label = "bottom-bar"
    )
    ThesisBottomBar(
        items = items,
        selectedKey = selectedKey,
        onSelect = { tag -> if (shown) onSelect(tag) },
        modifier = Modifier
            .align(Alignment.BottomCenter)
            .onSizeChanged { onHeight(it.height) }
            .graphicsLayer {
                val progress = hidden
                alpha = 1f - progress
                translationY = when {
                    progress >= 1f -> size.height
                    reducedMotion -> 0f
                    else -> progress * size.height
                }
            }
            .then(if (shown) Modifier else Modifier.clearAndSetSemantics {})
    )
}

/**
 * The shell's only snackbar host (the kit's [ThesisSnackbarHost], 3 #23), bottom-aligned above the bottom bar when
 * it shows, else above the navigation bar or the keyboard. Its own composable, so keyboard animation frames
 * recompose only this host. Messages go through `showThesisSnackbar`, which this host times out (4 s, 8 s with an
 * action).
 */
@Composable
private fun BoxScope.ShellSnackbarHost(hostState: SnackbarHostState, barHeightPx: () -> Int) {
    val density = LocalDensity.current
    val bottomPx = maxOf(
        WindowInsets.ime.getBottom(density),
        WindowInsets.navigationBars.getBottom(density),
        barHeightPx()
    )
    ThesisSnackbarHost(
        hostState = hostState,
        modifier = Modifier
            .align(Alignment.BottomCenter)
            .padding(bottom = with(density) { bottomPx.toDp() })
    )
}

/**
 * An entry drawn opaque on the page background (the shared window-fixed bitmap, 2.7), with its own saved state
 * (scroll, fields) keyed by `entryId`.
 */
@Composable
private fun OpaqueEntry(holder: SaveableStateHolder, entry: NavEntry, content: @Composable () -> Unit) {
    Box(Modifier.fillMaxSize().pageBackground(LocalThesisPalette.current)) {
        holder.SaveableStateProvider(entry.entryId) { content() }
    }
}

internal enum class ShellTopBar { Root, Back, None }

/**
 * Tab roots get brand + search + avatar; screens with their own header get none; the rest a back bar.
 * A report draws its own bar only once it is loaded: while it loads, fails to open, or while a build runs
 * (`DeepDiveRunning`, 5.14 "under the top bar, back allowed"), the shell gives it a back bar, because the
 * bottom bar is hidden there and the loading and error states have no back control of their own.
 */
internal fun topBarFor(destination: Destination, state: UiState): ShellTopBar = when (destination) {
    Destination.Today, Destination.Names, Destination.Research, Destination.Inbox -> ShellTopBar.Root
    is Destination.Pulse, is Destination.WeeklyDigest, Destination.MacroStress, is Destination.History -> ShellTopBar.None
    is Destination.Report ->
        if (state.deepDiveReport?.reportId == destination.reportId) ShellTopBar.None else ShellTopBar.Back
    is Destination.ReportClassic ->
        if (state.deepDiveReport?.reportId == destination.reportId) ShellTopBar.None else ShellTopBar.Back
    else -> ShellTopBar.Back
}

internal fun titleOf(destination: Destination, state: UiState): String = when (destination) {
    // The War Room screen carries its own "War Room" headline and ticker; the bar only goes back (rubric V3).
    is Destination.WarRoom -> ""
    // Scenario Stress carries its own "Scenario Stress" headline; the bar only goes back (rubric V3).
    is Destination.ScenarioStress -> ""
    // The placeholder body carries the ticker as its headline; the bar only goes back (rubric V3).
    is Destination.Name -> ""
    is Destination.CompareReports -> "Compare reports"
    is Destination.CompareNames -> "Compare names"
    // You's page carries its own "You" headline; the bar only closes it (no repeated words, rubric V3).
    Destination.You, is Destination.YouPage -> ""
    Destination.Search -> "Search"
    is Destination.Paywall -> "Thesis Pro"
    else -> ""
}

/** Section 4.5: fade-through between tabs, shared-axis X for push and pop, crossfade when motion is reduced. */
private fun AnimatedContentTransitionScope<NavEntry>.tabTransition(
    move: NavMove,
    reducedMotion: Boolean,
    shiftPx: Int
): ContentTransform {
    if (reducedMotion || move == NavMove.Replace || move == NavMove.None || move == NavMove.Modal) {
        return reducedCrossfade()
    }
    return when (move) {
        NavMove.Tab -> {
            val enter =
                motionSpec<Float>(ThesisMotion.TabIn, delayMillis = ThesisMotion.TabOut, easing = ThesisMotion.EaseEnter)
            (fadeIn(enter) + scaleIn(enter, initialScale = ThesisMotion.TabScaleFrom))
                .togetherWith(fadeOut(motionSpec(ThesisMotion.TabOut, easing = ThesisMotion.EaseExit)))
        }
        NavMove.Push -> sharedAxisX(forward = true, reducedMotion = false, shiftPx = shiftPx)
        else -> sharedAxisX(forward = false, reducedMotion = false, shiftPx = shiftPx)
    }
}

/** Reduced motion (4.8): a 150 ms crossfade instead of any slide, scale or rise. */
private fun reducedCrossfade(): ContentTransform =
    fadeIn(motionSpec(ThesisMotion.Quick, easing = ThesisMotion.EaseStandard)) togetherWith
        fadeOut(motionSpec(ThesisMotion.Quick, easing = ThesisMotion.EaseStandard))

/** The 4.5 shift of shared-axis X. */
internal val SHARED_AXIS_SHIFT: Dp = ThesisMotion.PushOffset

/**
 * Shared-axis X (4.5): forward, the new screen comes in from +[shiftPx] with a fade (300 ms) while the old one
 * leaves toward −[shiftPx] with a fade (180 ms); backward mirrors it. A 150 ms crossfade when motion is reduced.
 * Used by pushes and pops in the shell and by Auth ↔ Password reset in `ThesisApp`.
 */
internal fun sharedAxisX(forward: Boolean, reducedMotion: Boolean, shiftPx: Int): ContentTransform {
    if (reducedMotion) return reducedCrossfade()
    val direction = if (forward) 1 else -1
    return (slideInHorizontally(motionSpec(ThesisMotion.Screen, easing = ThesisMotion.EaseEnter)) { direction * shiftPx } +
        fadeIn(motionSpec(ThesisMotion.Screen, easing = ThesisMotion.EaseEnter)))
        .togetherWith(
            slideOutHorizontally(motionSpec(ThesisMotion.PushOut, easing = ThesisMotion.EaseExit)) { -direction * shiftPx } +
                fadeOut(motionSpec(ThesisMotion.PushOut, easing = ThesisMotion.EaseExit))
        )
}

/** Modal rise (4.5): `ModalOffset` + fade, 300 ms in, 240 ms out. No size animation (the layer is always full size). */
private fun AnimatedContentTransitionScope<NavEntry?>.modalTransition(
    reducedMotion: Boolean,
    risePx: Int
): ContentTransform {
    if (reducedMotion) return reducedCrossfade() using SizeTransform(clip = false)
    return (slideInVertically(motionSpec(ThesisMotion.Screen, easing = ThesisMotion.EaseEnter)) { risePx } +
        fadeIn(motionSpec(ThesisMotion.Screen, easing = ThesisMotion.EaseEnter)))
        .togetherWith(
            slideOutVertically(motionSpec(ThesisMotion.ScreenOut, easing = ThesisMotion.EaseExit)) { risePx } +
                fadeOut(motionSpec(ThesisMotion.ScreenOut, easing = ThesisMotion.EaseExit))
        ) using SizeTransform(clip = false)
}

/** A 4.2 timed spec (never snapped: the reduced-motion paths above pick their own crossfade). */
private fun <T> motionSpec(durationMillis: Int, delayMillis: Int = 0, easing: Easing): FiniteAnimationSpec<T> =
    ThesisMotion.timed(reduced = false, durationMillis = durationMillis, delayMillis = delayMillis, easing = easing)

/** Two-letter initials for the You avatar from the account email ("ana.pop@x.com" → "AP"); "Y" with none. */
internal fun initialsOf(email: String?): String {
    val local = email?.substringBefore('@')?.trim().orEmpty()
    val parts = local.split('.', '_', '-', '+').filter { it.isNotBlank() }
    val letters = when {
        parts.size >= 2 -> "${parts[0].first()}${parts[1].first()}"
        parts.size == 1 -> parts[0].take(1)
        else -> "Y"
    }
    return letters.uppercase()
}

/** Shared by every destination's content; see [ShellContentScope.Content] in ShellDestinations.kt. */
internal class ShellContentScope(
    val state: UiState,
    val navigator: AppNavigator,
    val actions: ShellActions,
    val platform: ShellPlatform,
    val sampleDismissed: Boolean,
    val onDismissSample: () -> Unit
)
