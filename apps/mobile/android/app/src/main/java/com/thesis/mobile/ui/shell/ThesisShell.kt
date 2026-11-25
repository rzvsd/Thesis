package com.thesis.mobile.ui.shell

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animate
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.updateTransition
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
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
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarData
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarVisuals
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.AccessibilityManager
import androidx.compose.ui.platform.LocalAccessibilityManager
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.dismiss
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.IntOffset
import com.thesis.mobile.ui.UiState
import com.thesis.mobile.ui.components.BottomBarItem
import com.thesis.mobile.ui.components.LoadingHairline
import com.thesis.mobile.ui.components.LocalPageBackgroundCache
import com.thesis.mobile.ui.components.ProvidePageBackground
import com.thesis.mobile.ui.components.ThesisBottomBar
import com.thesis.mobile.ui.components.ThesisSnackbar
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.navigation.Destination
import com.thesis.mobile.ui.navigation.ShellRootTopBar
import com.thesis.mobile.ui.navigation.ShellTab
import com.thesis.mobile.ui.navigation.ThesisBackTopBar
import com.thesis.mobile.ui.navigation.shellNavItems
import com.thesis.mobile.ui.platform.ThesisBackHandler
import com.thesis.mobile.ui.platform.ThesisPredictiveBackHandler
import com.thesis.mobile.ui.screens.PaywallScreen
import com.thesis.mobile.ui.theme.Kit
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.ThesisSpace
import kotlin.math.roundToInt
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * The logged-in app (DESIGN-DIRECTION 5.5). Pure: it takes the published [state], the [navigator] (snapshot
 * state, owned by `MainViewModel`), the [actions] and the Android-only [platform] pieces, so design-preview
 * renders it with fixture state for every tab.
 *
 * Layers, bottom to top (ShellLayers.kt): root `bg` → the report base layer (a `Report` entry on the current tab
 * stays composed under screens pushed over it, so its WebView keeps scroll and session; it slides out like the old
 * page of a push and back on the pop; its back handlers are off while it is covered) → the tab layer
 * (`AnimatedContent` over the current tab's top entry, 4.5 transitions, each entry's saved state keyed by its
 * `entryId`) → the bottom bar (slides away on Report, ReportClassic, DeepDiveRunning) → the modal layer (You,
 * Search, Paywall destinations: rise and fall, X axis inside) → the paywall → snackbars (one host, last child of
 * the root, so messages raised while You or Search is open are seen: 5.5 layer order). Every move animates: no
 * layer appears or disappears in a hard cut. A tab root's bar (brand, search, avatar) is drawn once above the tab
 * layer while the layer is on tab roots only, so a switch between two roots fades the page bodies through and the
 * identical bar stays still ([SharedRootTopBar]); in a push or pop the bar moves with its screen. The paywall is
 * still a `Dialog` (its own window, with the platform's window animation); 5.23 (WP-G) makes it a full-screen
 * destination.
 *
 * Each entry draws its own top bar (5.5 "each screen supplies its top bar") and computes its own insets from its
 * own destination, so in a push or pop the bar moves with its screen and the leaving screen keeps its layout
 * while it slides out (principle 8). The bar reveals its background and hairline when content scrolls under it,
 * and over a HeroBand it reads the hero palette, as do the status bar icons ([ScreenChrome], 2.7), which switch to
 * a new page's once the page it replaces has gone ([rememberFrontEntryId]).
 *
 * Back (4.5): a predictive back handler, enabled while [AppNavigator.canGoBack], previews the pop on the page it
 * closes only (scale to .90, 8 dp away from the swipe edge; still under reduced motion, 4.8); on commit that page
 * slides and fades out from the previewed transform (nothing is drawn over it until it has gone), then the page
 * under it comes in at full size; a cancel settles back
 * with `spatialSlow`. While the paywall is open, back closes it. The whole tree sits on one shared page
 * background (2.7).
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
    val density = LocalDensity.current
    val backPreview = remember { BackPreview() }
    val env = remember(holder, density, reducedMotion, backPreview) {
        ShellLayerEnv(
            holder = holder,
            px = with(density) { ShellMotionPx(SHARED_AXIS_SHIFT.roundToPx(), ThesisMotion.ModalOffset.roundToPx()) },
            backShiftPx = with(density) { PREDICTIVE_BACK_SHIFT.toPx() },
            reducedMotion = reducedMotion,
            backPreview = backPreview
        )
    }
    var sampleDismissed by rememberSaveable { mutableStateOf(false) }
    var bottomBarHeightPx by remember { mutableIntStateOf(0) }
    // Each composed entry's chrome (scroll under the bar, HeroBand), by entryId: the status bar follows the top one.
    val chromes = remember { mutableStateMapOf<String, ScreenChrome>() }

    val tabTop = navigator.tabTop
    val modalTop = navigator.modalStack.lastOrNull()
    val currentStack = navigator.stack(navigator.currentTab)
    val reportBase = currentStack.lastOrNull { it.destination is Destination.Report }
    val paywallOpen = !state.paywallFeature.isNullOrBlank()
    val bottomBarShown = !tabTop.destination.hidesBottomBar
    // A modal or the paywall is over the tab layer, the report and the bottom bar: they leave the accessibility tree.
    val coveredByModal = modalTop != null || paywallOpen

    // Drop the saved UI state of entries that left every stack.
    val liveIds = navigator.liveEntryIds()
    val shownIds = remember { mutableSetOf<String>() }
    LaunchedEffect(liveIds) {
        (shownIds - liveIds).forEach(holder::removeState)
        shownIds.retainAll(liveIds)
        shownIds.addAll(liveIds)
    }

    // Status bar icons (2.7): light over a HeroBand at rest (both themes), else the theme's. ThesisApp applies it.
    // They follow the page in front, which changes once the page it replaces has gone, not in a move's first frame.
    val front = rememberFrontEntryId(navigator, reducedMotion)
    val statusBarOverHero by remember(front, chromes) {
        derivedStateOf { chromes[front.value]?.overHero == true }
    }
    val onStatusBarOverHero by rememberUpdatedState(platform.onStatusBarOverHero)
    LaunchedEffect(statusBarOverHero) { onStatusBarOverHero(statusBarOverHero) }
    DisposableEffect(Unit) { onDispose { onStatusBarOverHero(false) } }

    // Predictive back (4.5). Registered before the layers, so a report WebView's own "back within the page"
    // handler (registered later) wins while it has history and the report is not covered.
    val backScope = rememberCoroutineScope()
    ThesisPredictiveBackHandler(enabled = navigator.canGoBack && !paywallOpen) { events ->
        // The page this back closes: the top modal, else the tab's top entry (a report is drawn by the base layer).
        val closing = navigator.top.entryId
        backPreview.start(closing)
        try {
            events.collect { event -> backPreview.update(event.progress, event.swipeEdge) }
            actions.onBack()
            backPreview.commit(backScope, stillOnScreen = navigator.top.entryId == closing)
        } catch (cancelled: CancellationException) {
            backPreview.cancel(backScope)
            throw cancelled
        }
    }
    ThesisBackHandler(enabled = paywallOpen) { actions.onDismissPaywall() }

    // The tab roots' shared bar: the entries composed in the tab layer, and the root whose bar the shell draws.
    val tabEntries = remember { mutableStateListOf<NavEntry>() }
    val rootBarShared by remember(navigator, backPreview) {
        derivedStateOf {
            usesRootBar(navigator.tabTop.destination) && tabEntries.isNotEmpty() &&
                tabEntries.all { usesRootBar(it.destination) } && backPreview.entryId == null
        }
    }
    // The bar shows the target root's chrome, or for the first frame of a switch (before the new root has
    // registered its chrome) the one it showed before, so it never drops out.
    val topChrome = chromes[tabTop.entryId]
    val sharedBar = heldWhile(hold = topChrome == null, value = topChrome?.let { tabTop to it })
    val drawSharedBar = rootBarShared && sharedBar != null

    val scope = ShellContentScope(
        state = state,
        navigator = navigator,
        actions = actions,
        platform = platform,
        sampleDismissed = sampleDismissed,
        onDismissSample = { sampleDismissed = true },
        chromes = chromes,
        rootBarShared = drawSharedBar
    )

    ShellPageBackground(modifier) {
        Box(Modifier.fillMaxSize()) {
            ReportBaseLayer(
                entry = reportBase,
                tabTopId = tabTop.entryId,
                move = { navigator.lastMove },
                env = env,
                hidden = coveredByModal
            ) { report ->
                // Back handlers inside the report (the WebView's history) only while it is what the user sees.
                val covered = report.entryId != navigator.tabTop.entryId || coveredByModal
                CompositionLocalProvider(LocalEntryCovered provides covered) {
                    platform.backScope(covered) {
                        scope.EntryFrame(report, inModal = false, bottomBarHeightPx = bottomBarHeightPx)
                    }
                }
            }

            TabLayer(
                target = tabTop,
                move = { navigator.lastMove },
                env = env,
                hidden = coveredByModal,
                // A report is drawn only by the base layer: on top, this layer stays empty so nothing covers it,
                // and a report that is leaving (another report pushed over it, a tab switch) never builds a
                // second WebView here.
                drawnBelow = { it.destination is Destination.Report },
                composed = tabEntries
            ) { entry ->
                scope.EntryFrame(entry, inModal = false, bottomBarHeightPx = bottomBarHeightPx)
            }

            if (drawSharedBar && sharedBar != null) {
                scope.SharedRootTopBar(entry = sharedBar.first, chrome = sharedBar.second, covered = coveredByModal)
            }

            val barHidden by animateFloatAsState(
                targetValue = if (bottomBarShown) 0f else 1f,
                animationSpec = if (reducedMotion) {
                    motionSpec(ThesisMotion.Quick, easing = ThesisMotion.EaseStandard)
                } else {
                    motionSpec(ThesisMotion.Base, easing = if (bottomBarShown) ThesisMotion.EaseEnter else ThesisMotion.EaseExit)
                },
                label = "bottom-bar"
            )
            ShellBottomBar(
                shown = bottomBarShown,
                covered = coveredByModal,
                hidden = { barHidden },
                reducedMotion = reducedMotion,
                items = shellNavItems(inboxHasNew = state.hasNewInboxItems),
                selectedKey = navigator.selectedTab?.name,
                onSelect = { key -> ShellTab.entries.firstOrNull { it.name == key }?.let(actions::onSelectTab) },
                onHeight = { bottomBarHeightPx = it }
            )

            ModalLayer(
                target = modalTop,
                onStack = { entry -> navigator.modalStack.any { it.entryId == entry.entryId } },
                env = env
            ) { entry ->
                scope.EntryFrame(entry, inModal = true, bottomBarHeightPx = bottomBarHeightPx)
            }

            if (paywallOpen) {
                // A Dialog: its own window, with the platform's window animation and no reduced-motion path. The
                // one entry into the shell that is not a 4.5 move: 5.23 (WP-G) makes Paywall a modal-stack
                // destination, which rises through ModalLayer, and this branch goes (HANDOFF-M3).
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

            // Above every layer. The snackbar rides on the bottom bar while the bar shows on a tab entry with no
            // modal or paywall over it, and glides with the bar when it slides away or back (no jump);
            // otherwise it sits on the navigation bar or the keyboard.
            // The bar's own hide progress (same easing, so they move as one), times whether anything covers the bar.
            val barCovered by animateFloatAsState(
                targetValue = if (modalTop != null || paywallOpen) 1f else 0f,
                animationSpec = ThesisMotion.timed(reducedMotion, ThesisMotion.Base),
                label = "snackbar-bar-covered"
            )
            ShellSnackbarHost(
                hostState = snackbarHostState,
                barPx = {
                    // Reduced motion (4.8): the bar only fades, so the snackbar moves to its new place at once
                    // instead of sliding with the bar's 150 ms fade.
                    val hiddenNow = if (reducedMotion) (if (bottomBarShown) 0f else 1f) else barHidden
                    bottomBarHeightPx * (1f - hiddenNow) * (1f - barCovered)
                }
            )
        }
    }
}

/**
 * The entry in front, for the status bar's icons (2.7): [AppNavigator.top], except that after a move the new top
 * takes over only at the move's [frontChangeMillis] (once the page it replaces has gone, or half way through a
 * crossfade), so the new page's icons never sit over the leaving page. Timed on the animation clock (no `delay`),
 * so it is instant when the system turns animations off.
 */
@Composable
private fun rememberFrontEntryId(navigator: AppNavigator, reducedMotion: Boolean): State<String> {
    val topId = navigator.top.entryId
    val modalTop = navigator.modalStack.lastOrNull()
    val modals = remember { TargetHistory(modalTop) }
    val modalBefore = modals.current
    modals.update(modalTop)
    // The move that brought [topId] in: the modal layer's when the modal top changed, else the tab layer's.
    val move = if (modalBefore?.entryId != modalTop?.entryId) {
        val forward = modalBefore != null && navigator.modalStack.any { it.entryId == modalBefore.entryId }
        modalTransitionFor(modalBefore, modalTop, forward, reducedMotion)
    } else {
        shellTransitionFor(navigator.lastMove, reducedMotion)
    }
    val front = remember { mutableStateOf(topId) }
    LaunchedEffect(topId) {
        if (front.value != topId) {
            animate(0f, 1f, animationSpec = motionSpec(move.frontChangeMillis, easing = ThesisMotion.Linear)) { _, _ -> }
            front.value = topId
        }
    }
    return front
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

/**
 * One entry's page: its own top bar ([topBarFor], or a back bar on the modal stack), its own insets and its own
 * [ScreenChrome]. The bar shows its background and hairline once content scrolls under it, and reads the hero
 * palette while a HeroBand is under it (4.4, 2.7). The bottom inset is the bottom bar's height when this entry's
 * destination shows the bar, else the navigation bar, so an entry that is leaving keeps its layout while the bar
 * slides in or away.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ShellContentScope.EntryFrame(entry: NavEntry, inModal: Boolean, bottomBarHeightPx: Int) {
    val bar = if (inModal) ShellTopBar.Back else topBarFor(entry.destination, state)
    val reserveBottomBar = !inModal && !entry.destination.hidesBottomBar && bottomBarHeightPx > 0
    val chrome = rememberScreenChrome()
    DisposableEffect(entry.entryId, chrome) {
        chromes[entry.entryId] = chrome
        onDispose { if (chromes[entry.entryId] === chrome) chromes.remove(entry.entryId) }
    }
    CompositionLocalProvider(LocalScreenChrome provides chrome) {
        Scaffold(
            // The page background is painted under the entry (OpaqueEntry, or the root for the report base layer).
            containerColor = Color.Transparent,
            topBar = { EntryTopBarSlot(entry, bar, chrome) },
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
                    .nestedScroll(chrome.nestedScroll)
            ) {
                Content(entry, padding)
            }
        }
    }
}

/**
 * The top bar slot of [entry]. A change of [bar] (a report's interim back bar giving way to the report's own bar
 * once it has loaded) crossfades over `Quick` instead of cutting; the slot takes the new bar's height at once, so
 * the page's padding does not move twice.
 *
 * A screen that declares its HeroBand ([HeroUnderBars]) does so right after its first composition: the bar is
 * rebuilt then, so it starts in the hero palette instead of fading into it as the screen opens. Only then: once
 * the page has drawn two frames, a HeroBand that comes or goes (a state change of the screen) crossfades the bar's
 * palette over 200 ms (4.4) like a collapse.
 */
@Composable
private fun ShellContentScope.EntryTopBarSlot(entry: NavEntry, bar: ShellTopBar, chrome: ScreenChrome) {
    var settled by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        repeat(SETTLE_FRAMES) { withFrameNanos { } }
        settled = true
    }
    val heroKey = heldWhile(hold = settled, value = chrome.heroBand)
    AnimatedContent(
        targetState = bar,
        transitionSpec = {
            val fade = ThesisMotion.timed<Float>(reduced = false, durationMillis = ThesisMotion.Quick)
            (fadeIn(fade) togetherWith fadeOut(fade)) using SizeTransform(clip = false) { _, _ -> snap() }
        },
        label = "top-bar-slot"
    ) { shown ->
        key(heroKey) {
            EntryTopBar(entry, shown, chrome)
        }
    }
}

/** Frames after which a page's HeroBand declaration no longer rebuilds its bar (see [EntryTopBarSlot]). */
private const val SETTLE_FRAMES = 2

/**
 * The tab roots' bar, drawn once above the tab layer while the layer shows tab roots only ([ShellContentScope.rootBarShared]):
 * in a switch between two roots the page bodies fade through under it and the bar itself stays still (no blink
 * of identical chrome). It shows [entry]'s refresh hairline and [chrome]'s scroll reveal, which crossfades (200 ms)
 * when the new root's differs. The roots' own bars are kept, invisible and out of the accessibility tree, and take
 * over in a push or pop, where the bar moves with its screen. [covered]: a modal or the paywall is over it.
 */
@Composable
private fun ShellContentScope.SharedRootTopBar(entry: NavEntry, chrome: ScreenChrome, covered: Boolean) {
    Box(Modifier.fillMaxWidth().then(if (covered) Modifier.clearAndSetSemantics {} else Modifier)) {
        EntryTopBar(entry, ShellTopBar.Root, chrome, shared = true)
    }
}

/**
 * The shell's top bar for [entry]: scroll reveal and the hero palette come from [chrome]. A tab root's own bar is
 * invisible while the shared bar ([shared] = true) is drawn in its place.
 */
@Composable
private fun ShellContentScope.EntryTopBar(entry: NavEntry, bar: ShellTopBar, chrome: ScreenChrome, shared: Boolean = false) {
    when (bar) {
        ShellTopBar.Root -> Box(
            // Under the shared bar: same pixels in the same place, so it can take over in any frame.
            if (!shared && rootBarShared) Modifier.graphicsLayer { alpha = 0f }.clearAndSetSemantics {} else Modifier
        ) {
            ShellRootTopBar(
                initials = initialsOf(state.userProfile?.email),
                onOpenSearch = actions::onOpenSearch,
                onOpenProfile = actions::onOpenYou,
                collapsed = chrome.collapsed,
                overHero = chrome.heroBand
            )
            // Interim (5.5) until PR-3 puts the hairline in each root's ScreenHeader: over the bar's bottom edge,
            // no layout shift. It fades in and out with the refresh instead of appearing and vanishing.
            // Composed while refreshing or fading out; the alpha is read in the draw phase only (4.3.9).
            val refreshing = rootRefreshing(entry.destination, state)
            val fade = updateTransition(refreshing, label = "refresh-hairline")
            val shown = fade.animateFloat(
                transitionSpec = { ThesisMotion.timed(reduced = false, durationMillis = ThesisMotion.Quick) },
                label = "refresh-hairline-alpha"
            ) { on -> if (on) 1f else 0f }
            // Not under the shared bar, which draws its own (one infinite animation on screen, 4.3.10).
            if ((fade.currentState || fade.targetState) && (shared || !rootBarShared)) {
                LoadingHairline(
                    active = refreshing,
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .graphicsLayer { alpha = shown.value }
                )
            }
        }
        ShellTopBar.Back -> ThesisBackTopBar(
            title = titleOf(entry.destination, state),
            onBack = { actions.onBack() },
            collapsed = chrome.collapsed,
            overHero = chrome.heroBand
        )
        ShellTopBar.None -> Unit
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
 * only (4.8). While hidden it is below the screen edge, out of the accessibility tree, and ignores taps; under a
 * modal or the paywall ([covered]) it is out of the accessibility tree too. The
 * selected tab's glyph and colour crossfade in the kit bar (150 ms); no tab is selected while a modal is open.
 */
@Composable
private fun BoxScope.ShellBottomBar(
    shown: Boolean,
    covered: Boolean,
    hidden: () -> Float,
    reducedMotion: Boolean,
    items: List<BottomBarItem>,
    selectedKey: String?,
    onSelect: (String) -> Unit,
    onHeight: (Int) -> Unit
) {
    ThesisBottomBar(
        items = items,
        selectedKey = selectedKey,
        onSelect = { tag -> if (shown) onSelect(tag) },
        modifier = Modifier
            .align(Alignment.BottomCenter)
            .onSizeChanged { onHeight(it.height) }
            .graphicsLayer {
                val progress = hidden()
                alpha = 1f - progress
                translationY = when {
                    progress >= 1f -> size.height
                    reducedMotion -> 0f
                    else -> progress * size.height
                }
            }
            .then(if (shown && !covered) Modifier else Modifier.clearAndSetSemantics {})
    )
}

/**
 * The shell's only snackbar host (3 #23, 4.4), bottom-aligned above the bottom bar ([barPx], animated), the
 * navigation bar or the keyboard, whichever is highest. The lift is read in the layout phase, so keyboard and bar
 * animation frames only move the host.
 *
 * It draws the kit's [ThesisSnackbar] itself instead of going through Material3's `SnackbarHost`, whose own
 * fade-and-scale (from .8, which 4.3.8 rules out) would run on top of the kit's motion and ignore reduced motion.
 * Each snackbar rises 12 dp and fades in over 220 ms (`EaseEnter`) and fades out over 150 ms (`EaseExit`) when it
 * times out, its action is tapped or it is dismissed; under reduced motion (4.8) it shows and hides at once.
 * Messages go through `showThesisSnackbar`, which this host times out ([snackbarTimeoutMillis]).
 */
@Composable
private fun BoxScope.ShellSnackbarHost(hostState: SnackbarHostState, barPx: () -> Float) {
    val ime = WindowInsets.ime
    val navigationBars = WindowInsets.navigationBars
    val reduced = LocalReducedMotion.current
    val accessibility = LocalAccessibilityManager.current
    val current = hostState.currentSnackbarData
    // The snackbar on screen: the current one, or the one before while it fades out.
    var shown by remember { mutableStateOf<SnackbarData?>(null) }
    val progress = remember { Animatable(0f) }
    val scope = rememberCoroutineScope()
    val hide: suspend () -> Unit = {
        if (reduced) {
            progress.snapTo(0f)
        } else {
            progress.animateTo(0f, motionSpec(ThesisMotion.Quick, easing = ThesisMotion.EaseExit))
        }
    }
    LaunchedEffect(current) {
        if (shown != null && shown !== current) hide()
        shown = current
        val data = current ?: return@LaunchedEffect
        if (reduced) {
            progress.snapTo(1f)
        } else {
            progress.snapTo(0f)
            progress.animateTo(1f, motionSpec(ThesisMotion.Dialog, easing = ThesisMotion.EaseEnter))
        }
        val timeout = snackbarTimeoutMillis(data.visuals, accessibility) ?: return@LaunchedEffect
        delay(timeout)
        hide()
        data.dismiss()
    }
    val data = shown ?: return
    val rise = with(LocalDensity.current) { ThesisMotion.SnackbarOffset.toPx() }
    Box(
        Modifier
            .align(Alignment.BottomCenter)
            .offset {
                val lift = maxOf(ime.getBottom(this), navigationBars.getBottom(this), barPx().roundToInt())
                IntOffset(0, -lift)
            }
            .padding(ThesisSpace.l)
            .semantics {
                dismiss {
                    scope.launch { hide(); data.dismiss() }
                    true
                }
            }
    ) {
        ThesisSnackbar(
            message = data.visuals.message,
            actionLabel = data.visuals.actionLabel,
            onAction = { scope.launch { hide(); data.performAction() } },
            modifier = Modifier.graphicsLayer {
                val shownFraction = progress.value
                alpha = shownFraction
                translationY = (1f - shownFraction) * rise
            }
        )
    }
}

/**
 * How long [visuals] stays up, stretched to the user's accessibility timeout ("Time to take action") as
 * Material3's own host does; null: until dismissed. `showThesisSnackbar` posts `Indefinite` messages that this
 * host times out itself: 4 s, or 8 s with an action (3 #23). `Short` and `Long` keep Material3's 4 s and 10 s.
 */
internal fun snackbarTimeoutMillis(visuals: SnackbarVisuals, accessibility: AccessibilityManager?): Long? {
    val hasAction = visuals.actionLabel != null
    val base = when (visuals.duration) {
        SnackbarDuration.Short -> SNACKBAR_SHORT_MS
        SnackbarDuration.Long -> SNACKBAR_LONG_MS
        SnackbarDuration.Indefinite -> if (hasAction) Kit.SNACKBAR_ACTION_MS else Kit.SNACKBAR_MS
    }
    return accessibility?.calculateRecommendedTimeoutMillis(base, containsText = true, containsControls = hasAction) ?: base
}

/** Material3's `SnackbarDuration.Short` and `Long`, for a message posted with plain `showSnackbar`. */
private const val SNACKBAR_SHORT_MS = 4_000L
private const val SNACKBAR_LONG_MS = 10_000L

internal enum class ShellTopBar { Root, Back, None }

/**
 * Tab roots get brand + search + avatar; screens with their own header get none; the rest a back bar.
 * A report draws its own bar only once it is loaded: while it loads, fails to open, or while a build runs
 * (`DeepDiveRunning`, 5.14 "under the top bar, back allowed"), the shell gives it a back bar, because the
 * bottom bar is hidden there and the loading and error states have no back control of their own.
 */
internal fun topBarFor(destination: Destination, state: UiState): ShellTopBar = when {
    usesRootBar(destination) -> ShellTopBar.Root
    else -> topBarBelowRoot(destination, state)
}

/** The four tab roots, which get the brand + search + avatar bar. */
internal fun usesRootBar(destination: Destination): Boolean = when (destination) {
    Destination.Today, Destination.Names, Destination.Research, Destination.Inbox -> true
    else -> false
}

private fun topBarBelowRoot(destination: Destination, state: UiState): ShellTopBar = when (destination) {
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
    val onDismissSample: () -> Unit,
    /** Each composed entry's [ScreenChrome] by `entryId` (EntryFrame registers it; the status bar reads it). */
    val chromes: MutableMap<String, ScreenChrome> = mutableMapOf(),
    /** The shell draws the tab roots' bar above the tab layer ([SharedRootTopBar]): the roots' own bars hide. */
    val rootBarShared: Boolean = false
)
