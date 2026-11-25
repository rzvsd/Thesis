package com.thesis.mobile.ui.shell

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.ContentTransform
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.core.FastOutLinearInEasing
import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.SaveableStateHolder
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.UiState
import com.thesis.mobile.ui.navigation.Destination
import com.thesis.mobile.ui.navigation.ShellTab
import com.thesis.mobile.ui.navigation.ThesisBackTopBar
import com.thesis.mobile.ui.navigation.ThesisBottomBar
import com.thesis.mobile.ui.navigation.ThesisTopBar
import com.thesis.mobile.ui.navigation.shellNavItems
import com.thesis.mobile.ui.screens.PaywallScreen
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens

/**
 * The logged-in app (DESIGN-DIRECTION 5.5). Pure: it takes the published [state], the [navigator] (snapshot
 * state, owned by `MainViewModel`), the [actions] and the Android-only [platform] pieces, so design-preview
 * renders it with fixture state for every tab.
 *
 * Layers, bottom to top: root `bg` → the report base layer (a `Report` entry on the current tab stays composed
 * under screens pushed over it, so its WebView keeps scroll and session; its back handlers are off while it is
 * covered) → the tab layer (`AnimatedContent` over the current tab's top entry, 4.5 transitions, each entry's
 * saved state keyed by its `entryId`) → the bottom bar (slides away on Report, ReportClassic, DeepDiveRunning) →
 * the modal layer (You, Search, Paywall destinations) → the paywall sheet → snackbars (one host, last child of the
 * root, so messages raised while You, Search or the paywall is open are seen: 5.5 layer order).
 *
 * Each entry draws its own top bar (5.5 "each screen supplies its top bar") and computes its own insets from its
 * own destination, so in a push or pop the bar moves with its screen and the leaving screen keeps its layout
 * while it slides out (principle 8). Back is the caller's (`BackHandler` in `ThesisApp`, enabled while
 * [AppNavigator.canGoBack]).
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
    val shiftPx = with(LocalDensity.current) { SHARED_AXIS_SHIFT.roundToPx() }
    val modalRisePx = with(LocalDensity.current) { 32.dp.roundToPx() }
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

    val scope = ShellContentScope(
        state = state,
        navigator = navigator,
        actions = actions,
        platform = platform,
        sampleDismissed = sampleDismissed,
        onDismissSample = { sampleDismissed = true }
    )

    Box(modifier = modifier.fillMaxSize().background(ThesisColors.Background)) {
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
                // A report is drawn only by the base layer: on top, this layer stays empty so nothing covers it,
                // and a report that is leaving (another report pushed over it, a tab switch) never builds a
                // second WebView here.
                Box(Modifier.fillMaxSize())
            } else {
                OpaqueEntry(holder, entry) {
                    scope.EntryFrame(entry, inModal = false, bottomBarHeightPx = bottomBarHeightPx)
                }
            }
        }

        ShellBottomBar(
            shown = bottomBarShown,
            reducedMotion = reducedMotion,
            items = shellNavItems(inboxHasNew = state.hasNewInboxItems),
            selectedTag = navigator.selectedTab?.name,
            onSelect = { tag -> ShellTab.entries.firstOrNull { it.name == tag }?.let(actions::onSelectTab) },
            onHeight = { bottomBarHeightPx = it }
        )

        AnimatedContent(
            targetState = modalTop,
            // Full size in both states, so opening or closing never animates the container from 0 x 0.
            modifier = Modifier.fillMaxSize(),
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

        // Above every layer: the bottom bar is visible (and the snackbar sits on it) only on a tab entry with no
        // modal or paywall over it; otherwise the snackbar sits on the navigation bar or the keyboard.
        ShellSnackbarHost(
            hostState = snackbarHostState,
            barHeightPx = { if (bottomBarShown && modalTop == null && !paywallOpen) bottomBarHeightPx else 0 }
        )
    }
}

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
        containerColor = ThesisColors.Background,
        topBar = {
            when (bar) {
                ShellTopBar.Root -> ThesisTopBar(
                    profileSelected = navigator.modalStack.lastOrNull()?.destination.let {
                        it is Destination.You || it is Destination.YouPage
                    },
                    onOpenSearch = actions::onOpenSearch,
                    onOpenProfile = actions::onOpenYou
                )
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

/**
 * The bottom bar, always composed (so its height is known before it shows again) and drawn above the tab layer.
 * Hiding slides it down by its height and fades it (3 #4, `Base`); showing is the reverse; reduced motion fades
 * only (4.8). While hidden it is below the screen edge, out of the accessibility tree, and ignores taps.
 */
@Composable
private fun BoxScope.ShellBottomBar(
    shown: Boolean,
    reducedMotion: Boolean,
    items: List<com.thesis.mobile.ui.navigation.ThesisNavItem>,
    selectedTag: String?,
    onSelect: (String) -> Unit,
    onHeight: (Int) -> Unit
) {
    val hidden by animateFloatAsState(
        targetValue = if (shown) 0f else 1f,
        animationSpec = if (reducedMotion) {
            tween(REDUCED_MS)
        } else {
            tween(BAR_MS, easing = if (shown) LinearOutSlowInEasing else FastOutLinearInEasing)
        },
        label = "bottom-bar"
    )
    ThesisBottomBar(
        items = items,
        selectedTag = selectedTag,
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
 * The shell's only snackbar host, bottom-aligned above the bottom bar when it shows, else above the navigation
 * bar or the keyboard. Its own composable, so keyboard animation frames recompose only this host. Ink container
 * with surface text (3 #23) until the kit's `ThesisSnackbarHost` replaces it.
 */
@Composable
private fun BoxScope.ShellSnackbarHost(hostState: SnackbarHostState, barHeightPx: () -> Int) {
    val density = LocalDensity.current
    val bottomPx = maxOf(
        WindowInsets.ime.getBottom(density),
        WindowInsets.navigationBars.getBottom(density),
        barHeightPx()
    )
    SnackbarHost(
        hostState = hostState,
        modifier = Modifier
            .align(Alignment.BottomCenter)
            .padding(bottom = with(density) { bottomPx.toDp() })
            // The M3 snackbar insets itself 12 dp; 4 more make the 16 dp from the edges of 3 #23.
            .padding(horizontal = ThesisDimens.SpacingXs)
    ) { data ->
        Snackbar(
            snackbarData = data,
            shape = MaterialTheme.shapes.medium,
            containerColor = ThesisColors.TextPrimary,
            contentColor = ThesisColors.Surface,
            actionColor = ThesisColors.Surface,
            dismissActionContentColor = ThesisColors.Surface
        )
    }
}

/** An entry drawn opaque on `bg`, with its own saved state (scroll, fields) keyed by `entryId`. */
@Composable
private fun OpaqueEntry(holder: SaveableStateHolder, entry: NavEntry, content: @Composable () -> Unit) {
    Box(Modifier.fillMaxSize().background(ThesisColors.Background)) {
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
    is Destination.ScenarioStress -> "Scenario Stress"
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

private const val TAB_OUT_MS = 90
private const val TAB_IN_MS = 210
private const val PUSH_IN_MS = 300
private const val PUSH_OUT_MS = 180
private const val REDUCED_MS = 150
private const val BAR_MS = 240

/** Section 4.5: fade-through between tabs, shared-axis X for push and pop, crossfade when motion is reduced. */
private fun AnimatedContentTransitionScope<NavEntry>.tabTransition(
    move: NavMove,
    reducedMotion: Boolean,
    shiftPx: Int
): ContentTransform {
    if (reducedMotion || move == NavMove.Replace || move == NavMove.None || move == NavMove.Modal) {
        return fadeIn(tween(REDUCED_MS)) togetherWith fadeOut(tween(REDUCED_MS))
    }
    return when (move) {
        NavMove.Tab ->
            (fadeIn(tween(TAB_IN_MS, delayMillis = TAB_OUT_MS, easing = LinearOutSlowInEasing)) +
                scaleIn(tween(TAB_IN_MS, delayMillis = TAB_OUT_MS, easing = LinearOutSlowInEasing), initialScale = 0.985f))
                .togetherWith(fadeOut(tween(TAB_OUT_MS, easing = FastOutLinearInEasing)))
        NavMove.Push -> sharedAxisX(forward = true, reducedMotion = false, shiftPx = shiftPx)
        else -> sharedAxisX(forward = false, reducedMotion = false, shiftPx = shiftPx)
    }
}

/** The 4.5 shift of shared-axis X (`ThesisMotion.PushOffset` after F2). */
internal val SHARED_AXIS_SHIFT = 24.dp

/**
 * Shared-axis X (4.5): forward, the new screen comes in from +[shiftPx] with a fade (300 ms) while the old one
 * leaves toward −[shiftPx] with a fade (180 ms); backward mirrors it. A 150 ms crossfade when motion is reduced.
 * Used by pushes and pops in the shell and by Auth ↔ Password reset in `ThesisApp`.
 */
internal fun sharedAxisX(forward: Boolean, reducedMotion: Boolean, shiftPx: Int): ContentTransform {
    if (reducedMotion) return fadeIn(tween(REDUCED_MS)) togetherWith fadeOut(tween(REDUCED_MS))
    val direction = if (forward) 1 else -1
    return (slideInHorizontally(tween(PUSH_IN_MS, easing = LinearOutSlowInEasing)) { direction * shiftPx } +
        fadeIn(tween(PUSH_IN_MS, easing = LinearOutSlowInEasing)))
        .togetherWith(
            slideOutHorizontally(tween(PUSH_OUT_MS, easing = FastOutLinearInEasing)) { -direction * shiftPx } +
                fadeOut(tween(PUSH_OUT_MS, easing = FastOutLinearInEasing))
        )
}

/** Modal rise: 32 dp + fade, 300 ms in, 240 ms out. No size animation (the layer is always full size). */
private fun AnimatedContentTransitionScope<NavEntry?>.modalTransition(
    reducedMotion: Boolean,
    risePx: Int
): ContentTransform {
    if (reducedMotion) {
        return (fadeIn(tween(REDUCED_MS)) togetherWith fadeOut(tween(REDUCED_MS))) using SizeTransform(clip = false)
    }
    return (slideInVertically(tween(300, easing = LinearOutSlowInEasing)) { risePx } +
        fadeIn(tween(300, easing = LinearOutSlowInEasing)))
        .togetherWith(
            slideOutVertically(tween(240, easing = FastOutLinearInEasing)) { risePx } +
                fadeOut(tween(240, easing = FastOutLinearInEasing))
        ) using SizeTransform(clip = false)
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
