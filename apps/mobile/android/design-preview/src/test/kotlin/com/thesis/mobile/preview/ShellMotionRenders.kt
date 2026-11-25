package com.thesis.mobile.preview

import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.asSkiaBitmap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.runDesktopComposeUiTest
import androidx.compose.ui.test.swipeUp
import androidx.compose.ui.unit.Density
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.IssuerView
import com.thesis.mobile.model.SectionView
import com.thesis.mobile.preview.fixtures.ShellFixtures
import com.thesis.mobile.preview.fixtures.SamplePageFixture
import com.thesis.mobile.preview.fixtures.heroPlatform
import com.thesis.mobile.preview.fixtures.newAccountState
import com.thesis.mobile.ui.UiState
import com.thesis.mobile.ui.components.showThesisSnackbar
import com.thesis.mobile.ui.navigation.Destination
import com.thesis.mobile.ui.navigation.ShellTab
import com.thesis.mobile.ui.platform.PreviewBack
import com.thesis.mobile.ui.shell.AppNavigator
import com.thesis.mobile.ui.shell.ShellActions
import com.thesis.mobile.ui.shell.ShellPlatform
import com.thesis.mobile.ui.shell.ThesisShell
import com.thesis.mobile.ui.theme.ThesisTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.jetbrains.skia.EncodedImageFormat
import org.jetbrains.skia.Image
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import kotlin.math.roundToInt

/**
 * Shell motion frames (PR-2 M3, DESIGN-DIRECTION 4.5 and 4.4): mid-transition captures of each navigation move,
 * the predictive-back exit, the report base layer sliding under a push, the modal stack, reduced motion, the
 * snackbar riding the bottom bar, and the top bar's scroll reveal. `shell-motion-*` in screens.out. Dark by default;
 * push, predictive back and the You rise/fall render in light too.
 */
class ShellMotionRenders {

    private val reportState = ShellFixtures.state.copy(
        deepDiveReport = DeepDiveReportView(
            reportId = "rep-AAPL", ticker = "AAPL", generatedAt = "2026-11-20T14:00:00Z",
            issuer = IssuerView(name = "Apple Inc.", exchange = "NASDAQ"),
            thesisStatement = "Services keep growing faster than hardware, so margins hold up through the cycle.",
            signalValue = "positive", confidenceLabel = "medium", confidenceScore = 0.7,
            sections = listOf(SectionView(sectionId = "summary", title = "Summary", body = "Revenue grew 6% on Services.")),
        )
    )

    /** Rubric L1: the moves whose frames depend on the palette (cover, rise/fall, back preview) render in both. */
    private val bothThemes = listOf(PreviewTheme.DARK, PreviewTheme.LIGHT)

    private fun actionsFor(navigator: AppNavigator) = object : ShellActions {
        override fun onBack(): Boolean = navigator.back()
        override fun onSelectTab(tab: ShellTab) {
            navigator.selectTab(tab)
        }
    }

    /**
     * Renders the shell over [setup]'s navigator, applies [move] at [moveAtMs] (virtual time), and captures [atMs]
     * after it, so the frame shows the transition in flight.
     */
    private fun frame(
        name: String,
        atMs: Long,
        state: UiState = ShellFixtures.state,
        reducedMotion: Boolean = false,
        themes: List<PreviewTheme> = listOf(PreviewTheme.DARK),
        snackbar: String? = null,
        /** Shown at the move instead of at the start, to capture its entrance. */
        snackbarAtMove: String? = null,
        platform: ShellPlatform = ShellPlatform(),
        /** Published at the move (a report arriving, data loading), before [move] runs. */
        nextState: UiState? = null,
        setup: AppNavigator.() -> Unit = {},
        move: suspend (AppNavigator) -> Unit,
    ) {
        val moveAtMs = 400L
        val files = renderScreen(
            name, settleMs = moveAtMs + atMs, frameMs = 10, themes = themes, reducedMotion = reducedMotion, glow = true
        ) {
            val navigator = remember { AppNavigator().apply(setup) }
            val host = remember { SnackbarHostState() }
            var current by remember { mutableStateOf(state) }
            if (snackbar != null) LaunchedEffect(Unit) { host.showThesisSnackbar(snackbar) }
            LaunchedEffect(Unit) {
                delay(moveAtMs)
                nextState?.let { current = it }
                snackbarAtMove?.let { launch { host.showThesisSnackbar(it) } }
                move(navigator)
            }
            ThesisShell(
                state = current, navigator = navigator, actions = actionsFor(navigator), platform = platform,
                snackbarHostState = host
            )
        }
        files.forEach { assertTrue("${it.name} was not written", it.isFile && it.length() > 0) }
    }

    // ---- Tabs: fade-through (out 90 ms, in 210 ms after 90 with the content's scale .985 → 1). Between two tab
    // roots the bar (THESIS, search, avatar) is drawn once above the pages and stays still while their bodies fade.

    @Test fun tabFadeThroughOut() = frame("shell-motion-tab-60ms", 60) { it.selectTab(ShellTab.Names) }
    @Test fun tabFadeThroughGap() = frame("shell-motion-tab-90ms", 90) { it.selectTab(ShellTab.Names) }
    @Test fun tabFadeThroughIn() = frame("shell-motion-tab-170ms", 170) { it.selectTab(ShellTab.Names) }
    @Test fun tabFadeThroughReduced() = listOf(45L, 150L).forEach { ms ->
        frame("shell-motion-tab-reduced-${ms}ms", ms, reducedMotion = true) { it.selectTab(ShellTab.Names) }
    }

    // ---- Push and pop: shared-axis X in sequence within 300 ms (out 90 ms to −24 dp, then in 210 ms from +24 dp)

    // The old page is seen leaving (0-90 ms) with nothing over it; the new page comes in after it has gone
    // (4.5 "nothing double-exposes"): no frame shows both pages' headlines. ShellDoubleExposureTest checks pixels.
    private val sequenceMs = listOf(0L, 20L, 60L, 120L, 200L, 260L)

    @Test fun pushHistory() = sequenceMs.forEach { ms ->
        frame("shell-motion-push-${ms}ms", ms, themes = bothThemes) { it.push(Destination.History()) }
    }

    @Test fun popHistory() = sequenceMs.forEach { ms ->
        frame("shell-motion-pop-${ms}ms", ms, setup = { push(Destination.History()) }) { it.pop() }
    }
    @Test fun pushMacroStress() = frame("shell-motion-push-macro-80ms", 80, setup = { push(Destination.History()) }) {
        it.push(Destination.MacroStress)
    }

    /** Reduced motion (4.8): the same push is a 150 ms crossfade in place, nothing slides. */
    @Test fun pushHistoryReduced() =
        frame("shell-motion-push-reduced-75ms", 75, reducedMotion = true) { it.push(Destination.History()) }

    // ---- The report base layer

    /** A report pushed from Research arrives on the X axis like any push, after Research has left. */
    @Test fun pushReport() = listOf(120L, 240L).forEach { ms ->
        frame("shell-motion-report-in-${ms}ms", ms, reportState, setup = { selectTab(ShellTab.Research) }) {
            it.push(Destination.Report("rep-AAPL", "AAPL"))
        }
    }

    /** Compare pushed over the live report: the report slides out to −24 dp and fades, but stays composed. */
    @Test fun compareOverReport() = frame(
        "shell-motion-compare-over-report-90ms", 90, reportState,
        setup = { selectTab(ShellTab.Research); push(Destination.Report("rep-AAPL", "AAPL")) }
    ) { it.push(Destination.CompareReports("rep-AAPL", "rep-AAPL-2025")) }

    /**
     * Back from Compare: Compare leaves, then the same live report slides back in from −24 dp (no reload). The
     * two bars never show together.
     */
    @Test fun backToReport() = listOf(60L, 120L, 220L).forEach { ms ->
        frame(
            "shell-motion-back-to-report-${ms}ms", ms, reportState,
            setup = {
                selectTab(ShellTab.Research)
                push(Destination.Report("rep-AAPL", "AAPL"))
                push(Destination.CompareReports("rep-AAPL", "rep-AAPL-2025"))
            }
        ) { it.pop() }
    }

    // ---- Predictive back: the leaving page slides and fades out from its .90 preview, seen to its end; then the
    // page under it comes in at full size

    @Test fun predictiveBackExit() = sequenceMs.forEach { ms ->
        frame("shell-motion-predictive-back-${ms}ms", ms, themes = bothThemes, setup = { push(Destination.History()) }) {
            PreviewBack.press()
        }
    }

    @Test fun predictiveBackExitFromRightEdge() = frame(
        "shell-motion-predictive-back-right-60ms", 60, setup = { push(Destination.History()) }
    ) { PreviewBack.press(com.thesis.mobile.ui.platform.BackSwipeEdge.Right) }

    // ---- Modal stack: rise and fall 32 dp; pages inside it on the X axis

    // The page background covers Names first (150 ms), then You's content rises and fades in
    // (150 ms after 150); on close the content goes first, then the background. The two pages' text never overlaps.
    @Test fun youRises() = listOf(20L, 60L, 120L, 160L, 200L).forEach { ms ->
        frame("shell-motion-you-rise-${ms}ms", ms, themes = bothThemes, setup = { selectTab(ShellTab.Names) }) {
            it.openModal(Destination.You)
        }
    }

    @Test fun youFalls() = listOf(60L, 100L, 150L).forEach { ms ->
        frame("shell-motion-you-fall-${ms}ms", ms, themes = bothThemes, setup = { selectTab(ShellTab.Names); openModal(Destination.You) }) {
            it.pop()
        }
    }

    /** You → Appearance: the old page slides and fades out (90 ms) over the modal floor; no tab layer, no ghosts. */
    @Test fun youPagePush() = listOf(60L, 220L).forEach { ms ->
        frame("shell-motion-you-page-${ms}ms", ms, setup = { openModal(Destination.You) }) {
            it.push(Destination.YouPage("appearance"))
        }
    }

    @Test fun youPagePop() = listOf(60L, 220L).forEach { ms ->
        frame(
            "shell-motion-you-page-pop-${ms}ms", ms,
            setup = { openModal(Destination.You); push(Destination.YouPage("appearance")) }
        ) { it.pop() }
    }

    // ---- Today's root: the sample Deep Dive and Home swap as a content state change (no hard cut)

    private var dismissSample: (() -> Unit)? = null

    private val samplePlatform = ShellPlatform(
        // SampleDeepDiveScreen is Android-only (it is not compiled here): a stand-in with its headline and deck.
        sampleDeepDive = { padding, _, onDismiss ->
            dismissSample = onDismiss
            SamplePageFixture(padding)
        }
    )

    /** "Not now": the sample fades out (150 ms) and Home fades in (240 ms after 60 ms). */
    @Test fun sampleDismissed() = frame("shell-motion-sample-dismiss-120ms", 120, newAccountState, platform = samplePlatform) {
        dismissSample?.invoke()
    }

    /** The empty watchlist and history arrive while Home shows: the sample replaces it with the same fade. */
    @Test fun sampleArrives() = frame(
        "shell-motion-sample-arrives-120ms", 120, ShellFixtures.state.copy(watchlistLoaded = false),
        platform = samplePlatform, nextState = newAccountState
    ) { }

    // ---- A report entry's bar: the interim back bar gives way to the report's own bar (Quick crossfade)

    private val openingReportState = reportState.copy(deepDiveReport = null, isOpeningReport = true)

    @Test fun reportLoading() = frame(
        "shell-motion-report-loading", 0, openingReportState,
        setup = { selectTab(ShellTab.Research); push(Destination.Report("rep-AAPL", "AAPL")) }
    ) { }

    @Test fun reportArrives() = frame(
        "shell-motion-report-loaded-75ms", 75, openingReportState, nextState = reportState,
        setup = { selectTab(ShellTab.Research); push(Destination.Report("rep-AAPL", "AAPL")) }
    ) { }

    // ---- Snackbar: rises 12 dp and fades in (220 ms), no scale (the shell draws the kit snackbar itself)

    @Test fun snackbarRises() = listOf(40L, 120L).forEach { ms ->
        frame("shell-motion-snackbar-in-${ms}ms", ms, snackbarAtMove = "Notification preference saved.") { }
    }

    /** Reduced motion (4.8): at 40 ms the snackbar is already at its resting place, size and opacity. */
    @Test fun snackbarReduced() = frame(
        "shell-motion-snackbar-reduced-40ms", 40, reducedMotion = true, snackbarAtMove = "Notification preference saved."
    ) { }

    // ---- Snackbar rides the bottom bar down when the bar slides away (no jump)

    @Test fun snackbarFollowsTheBar() = frame(
        "shell-motion-snackbar-bar-120ms", 120, reportState, snackbar = "Notification preference saved.",
        setup = { selectTab(ShellTab.Research) }
    ) { it.push(Destination.Report("rep-AAPL", "AAPL")) }

    // ---- Top bar scroll reveal (4.4): transparent at rest, page bitmap @ 92% + hairline once content is under it

    @OptIn(ExperimentalTestApi::class)
    private fun scrolled(
        name: String,
        tab: ShellTab,
        state: UiState = ShellFixtures.state,
        platform: ShellPlatform = ShellPlatform(),
        swipe: Boolean = true
    ) {
        if (!selected(name)) return
        val density = PhoneSpec.density
        PreviewTheme.entries.forEach { theme ->
            runDesktopComposeUiTest(
                width = (PhoneSpec.WIDTH_DP * density).roundToInt(),
                height = (PhoneSpec.HEIGHT_DP * density).roundToInt()
            ) {
                val navigator = AppNavigator().apply { selectTab(tab) }
                setContent {
                    CompositionLocalProvider(LocalDensity provides Density(density, 1f)) {
                        ThesisTheme(mode = theme.mode) {
                            ThesisShell(
                                state = state,
                                navigator = navigator,
                                actions = actionsFor(navigator),
                                platform = platform,
                                snackbarHostState = remember { SnackbarHostState() }
                            )
                        }
                    }
                }
                if (swipe) {
                    onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsProperties.VerticalScrollAxisRange))
                        .onFirst().performTouchInput { swipeUp(startY = bottom * 0.8f, endY = bottom * 0.55f) }
                }
                waitForIdle()
                val bitmap = onRoot().captureToImage().asSkiaBitmap()
                val png = Image.makeFromBitmap(bitmap).encodeToData(EncodedImageFormat.PNG)!!.bytes
                val file = File(screensOutDir, "$name-${theme.suffix}.png").apply { writeBytes(png) }
                assertTrue(file.length() > 0)
                println("rendered ${file.absolutePath}")
            }
        }
    }

    private fun selected(name: String): Boolean =
        System.getProperty("screens.only")?.takeIf { it.isNotBlank() }?.let { Regex(it).containsMatchIn(name) } ?: true

    @Test fun todayScrolledUnderTheBar() = scrolled("shell-motion-today-scrolled", ShellTab.Today)
    @Test fun inboxScrolledUnderTheBar() = scrolled("shell-motion-inbox-scrolled", ShellTab.Inbox)

    // ---- HeroBand under the shell's top bar (2.7): hero palette at rest, paper once collapsed

    @Test fun heroAtRest() = scrolled("shell-motion-hero-rest", ShellTab.Today, newAccountState, heroPlatform(), swipe = false)
    @Test fun heroScrolled() = scrolled("shell-motion-hero-scrolled", ShellTab.Today, newAccountState, heroPlatform())
}
