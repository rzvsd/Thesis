package com.thesis.mobile.ui.shell

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.ContentTransform
import androidx.compose.animation.core.FastOutLinearInEasing
import androidx.compose.animation.core.LinearOutSlowInEasing
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
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.imePadding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.SaveableStateHolder
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
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

/**
 * The logged-in app (DESIGN-DIRECTION 5.5). Pure: it takes the published [state], the [navigator] (snapshot
 * state, owned by `MainViewModel`), the [actions] and the Android-only [platform] pieces, so design-preview
 * renders it with fixture state for every tab.
 *
 * Layers, bottom to top: root `bg` → the report base layer (a `Report` entry on the current tab stays composed
 * under screens pushed over it, so its WebView keeps scroll and session) → the tab layer (`AnimatedContent` over
 * the current tab's top entry, 4.5 transitions, each entry's saved state keyed by its `entryId`) → the modal
 * layer (You, Search, Paywall destinations) → the paywall sheet → snackbars. Back is the caller's
 * (`BackHandler` in `ThesisApp`, enabled while [AppNavigator.canGoBack]).
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
    val shiftPx = with(LocalDensity.current) { 24.dp.roundToPx() }
    val modalRisePx = with(LocalDensity.current) { 32.dp.roundToPx() }
    var sampleDismissed by rememberSaveable { mutableStateOf(false) }

    val tabTop = navigator.tabTop
    val modalTop = navigator.modalStack.lastOrNull()
    val currentStack = navigator.stack(navigator.currentTab)
    val reportBase = currentStack.lastOrNull { it.destination is Destination.Report }

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
        Scaffold(
            containerColor = ThesisColors.Background,
            snackbarHost = { SnackbarHost(snackbarHostState) },
            topBar = {
                when (topBarFor(tabTop.destination)) {
                    ShellTopBar.Root -> ThesisTopBar(
                        profileSelected = modalTop?.destination is Destination.You ||
                            modalTop?.destination is Destination.YouPage,
                        onOpenSearch = actions::onOpenSearch,
                        onOpenProfile = actions::onOpenYou
                    )
                    ShellTopBar.Back -> ThesisBackTopBar(
                        title = titleOf(tabTop.destination, state),
                        onBack = { actions.onBack() }
                    )
                    ShellTopBar.None -> Unit
                }
            },
            bottomBar = {
                if (!tabTop.destination.hidesBottomBar) {
                    ThesisBottomBar(
                        items = shellNavItems(inboxHasNew = state.hasNewInboxItems),
                        selectedTag = navigator.selectedTab?.name,
                        onSelect = { tag ->
                            ShellTab.entries.firstOrNull { it.name == tag }?.let(actions::onSelectTab)
                        }
                    )
                }
            }
        ) { padding ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .consumeWindowInsets(padding)
                    .imePadding()
            ) {
                if (reportBase != null) {
                    key(reportBase.entryId) {
                        holder.SaveableStateProvider(reportBase.entryId) {
                            scope.Content(reportBase, padding)
                        }
                    }
                }
                AnimatedContent(
                    targetState = tabTop,
                    transitionSpec = { tabTransition(navigator.lastMove, reducedMotion, shiftPx) },
                    contentKey = { it.entryId },
                    label = "tab-layer"
                ) { entry ->
                    if (entry.entryId == reportBase?.entryId) {
                        // The base layer draws the report; this layer stays empty so nothing covers it.
                        Box(Modifier.fillMaxSize())
                    } else {
                        OpaqueEntry(holder, entry) { scope.Content(entry, padding) }
                    }
                }
            }
        }

        AnimatedContent(
            targetState = modalTop,
            transitionSpec = { modalTransition(reducedMotion, modalRisePx) },
            contentKey = { it?.entryId },
            label = "modal-layer"
        ) { entry ->
            if (entry != null) {
                OpaqueEntry(holder, entry) {
                    Scaffold(
                        containerColor = ThesisColors.Background,
                        topBar = { ThesisBackTopBar(title = titleOf(entry.destination, state), onBack = { actions.onBack() }) }
                    ) { padding ->
                        Box(Modifier.fillMaxSize().consumeWindowInsets(padding).imePadding()) {
                            scope.Content(entry, padding)
                        }
                    }
                }
            } else {
                Box(Modifier)
            }
        }

        if (!state.paywallFeature.isNullOrBlank()) {
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

/** Tab roots get brand + search + avatar; screens with their own header get none; the rest a back bar. */
internal fun topBarFor(destination: Destination): ShellTopBar = when (destination) {
    Destination.Today, Destination.Names, Destination.Research, Destination.Inbox -> ShellTopBar.Root
    is Destination.Pulse, is Destination.WeeklyDigest, Destination.MacroStress, is Destination.History,
    is Destination.Report, is Destination.ReportClassic, is Destination.DeepDiveRunning -> ShellTopBar.None
    else -> ShellTopBar.Back
}

internal fun titleOf(destination: Destination, state: UiState): String = when (destination) {
    is Destination.WarRoom -> state.warRoom?.ticker?.let { "$it War Room" } ?: "War Room"
    is Destination.ScenarioStress -> "Scenario Stress"
    is Destination.Name -> destination.ticker
    is Destination.CompareReports -> "Compare reports"
    is Destination.CompareNames -> "Compare names"
    Destination.You, is Destination.YouPage -> "You"
    Destination.Search -> "Search"
    is Destination.Paywall -> "Thesis Pro"
    else -> ""
}

private const val TAB_OUT_MS = 90
private const val TAB_IN_MS = 210
private const val PUSH_IN_MS = 300
private const val PUSH_OUT_MS = 180
private const val REDUCED_MS = 150

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
        NavMove.Push ->
            (slideInHorizontally(tween(PUSH_IN_MS, easing = LinearOutSlowInEasing)) { shiftPx } +
                fadeIn(tween(PUSH_IN_MS, easing = LinearOutSlowInEasing)))
                .togetherWith(
                    slideOutHorizontally(tween(PUSH_OUT_MS, easing = FastOutLinearInEasing)) { -shiftPx } +
                        fadeOut(tween(PUSH_OUT_MS, easing = FastOutLinearInEasing))
                )
        else ->
            (slideInHorizontally(tween(PUSH_IN_MS, easing = LinearOutSlowInEasing)) { -shiftPx } +
                fadeIn(tween(PUSH_IN_MS, easing = LinearOutSlowInEasing)))
                .togetherWith(
                    slideOutHorizontally(tween(PUSH_OUT_MS, easing = FastOutLinearInEasing)) { shiftPx } +
                        fadeOut(tween(PUSH_OUT_MS, easing = FastOutLinearInEasing))
                )
    }
}

/** Modal rise: 32 dp + fade, 300 ms in, 240 ms out. */
private fun AnimatedContentTransitionScope<NavEntry?>.modalTransition(
    reducedMotion: Boolean,
    risePx: Int
): ContentTransform {
    if (reducedMotion) return fadeIn(tween(REDUCED_MS)) togetherWith fadeOut(tween(REDUCED_MS))
    return (slideInVertically(tween(300, easing = LinearOutSlowInEasing)) { risePx } +
        fadeIn(tween(300, easing = LinearOutSlowInEasing)))
        .togetherWith(
            slideOutVertically(tween(240, easing = FastOutLinearInEasing)) { risePx } +
                fadeOut(tween(240, easing = FastOutLinearInEasing))
        )
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
