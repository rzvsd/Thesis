package com.thesis.mobile.preview

import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
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
import com.thesis.mobile.ui.UiState
import com.thesis.mobile.ui.components.showThesisSnackbar
import com.thesis.mobile.ui.navigation.Destination
import com.thesis.mobile.ui.navigation.ShellTab
import com.thesis.mobile.ui.platform.PreviewBack
import com.thesis.mobile.ui.shell.AppNavigator
import com.thesis.mobile.ui.shell.ShellActions
import com.thesis.mobile.ui.shell.ThesisShell
import com.thesis.mobile.ui.theme.ThesisTheme
import kotlinx.coroutines.delay
import org.jetbrains.skia.EncodedImageFormat
import org.jetbrains.skia.Image
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import kotlin.math.roundToInt

/**
 * Shell motion frames (PR-2 M3, DESIGN-DIRECTION 4.5 and 4.4): mid-transition captures of each navigation move,
 * the predictive-back exit, the report base layer sliding under a push, the modal stack, reduced motion, the
 * snackbar riding the bottom bar, and the top bar's scroll reveal. `shell-motion-*` in screens.out.
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
        setup: AppNavigator.() -> Unit = {},
        move: suspend (AppNavigator) -> Unit,
    ) {
        val moveAtMs = 400L
        val files = renderScreen(
            name, settleMs = moveAtMs + atMs, frameMs = 10, themes = themes, reducedMotion = reducedMotion, glow = true
        ) {
            val navigator = remember { AppNavigator().apply(setup) }
            val host = remember { SnackbarHostState() }
            if (snackbar != null) LaunchedEffect(Unit) { host.showThesisSnackbar(snackbar) }
            LaunchedEffect(Unit) {
                delay(moveAtMs)
                move(navigator)
            }
            ThesisShell(state = state, navigator = navigator, actions = actionsFor(navigator), snackbarHostState = host)
        }
        files.forEach { assertTrue("${it.name} was not written", it.isFile && it.length() > 0) }
    }

    // ---- Tabs: fade-through (out 90 ms, in 210 ms after 90 with scale .985 → 1)

    @Test fun tabFadeThroughOut() = frame("shell-motion-tab-60ms", 60) { it.selectTab(ShellTab.Names) }
    @Test fun tabFadeThroughIn() = frame("shell-motion-tab-170ms", 170) { it.selectTab(ShellTab.Names) }

    // ---- Push and pop: shared-axis X (in 300 ms from +24 dp, out 180 ms to −24 dp)

    @Test fun pushHistory() = frame("shell-motion-push-100ms", 100) { it.push(Destination.History()) }
    @Test fun popHistory() = frame("shell-motion-pop-100ms", 100, setup = { push(Destination.History()) }) { it.pop() }

    /** Reduced motion (4.8): the same push is a 150 ms crossfade in place, nothing slides. */
    @Test fun pushHistoryReduced() =
        frame("shell-motion-push-reduced-75ms", 75, reducedMotion = true) { it.push(Destination.History()) }

    // ---- The report base layer

    /** A report pushed from Research arrives on the X axis like any push; the bottom bar slides away. */
    @Test fun pushReport() = frame("shell-motion-report-in-120ms", 120, reportState, setup = { selectTab(ShellTab.Research) }) {
        it.push(Destination.Report("rep-AAPL", "AAPL"))
    }

    /** Compare pushed over the live report: the report slides out to −24 dp and fades, but stays composed. */
    @Test fun compareOverReport() = frame(
        "shell-motion-compare-over-report-90ms", 90, reportState,
        setup = { selectTab(ShellTab.Research); push(Destination.Report("rep-AAPL", "AAPL")) }
    ) { it.push(Destination.CompareReports("rep-AAPL", "rep-AAPL-2025")) }

    /** Back from Compare: the same live report slides back in from −24 dp (no reload). */
    @Test fun backToReport() = frame(
        "shell-motion-back-to-report-120ms", 120, reportState,
        setup = {
            selectTab(ShellTab.Research)
            push(Destination.Report("rep-AAPL", "AAPL"))
            push(Destination.CompareReports("rep-AAPL", "rep-AAPL-2025"))
        }
    ) { it.pop() }

    // ---- Predictive back: the leaving page keeps its .90 preview into its exit; the page under it is full size

    @Test fun predictiveBackExit() = frame(
        "shell-motion-predictive-back-60ms", 60, setup = { push(Destination.History()) }
    ) { PreviewBack.press() }

    @Test fun predictiveBackExitFromRightEdge() = frame(
        "shell-motion-predictive-back-right-60ms", 60, setup = { push(Destination.History()) }
    ) { PreviewBack.press(com.thesis.mobile.ui.platform.BackSwipeEdge.Right) }

    // ---- Modal stack: rise and fall 32 dp; pages inside it on the X axis

    @Test fun youRises() = frame("shell-motion-you-rise-120ms", 120, setup = { selectTab(ShellTab.Names) }) {
        it.openModal(Destination.You)
    }

    @Test fun youFalls() = frame("shell-motion-you-fall-100ms", 100, setup = { openModal(Destination.You) }) { it.pop() }

    @Test fun youPagePush() = frame("shell-motion-you-page-100ms", 100, setup = { openModal(Destination.You) }) {
        it.push(Destination.YouPage("appearance"))
    }

    // ---- Snackbar rides the bottom bar down when the bar slides away (no jump)

    @Test fun snackbarFollowsTheBar() = frame(
        "shell-motion-snackbar-bar-120ms", 120, reportState, snackbar = "Notification preference saved.",
        setup = { selectTab(ShellTab.Research) }
    ) { it.push(Destination.Report("rep-AAPL", "AAPL")) }

    // ---- Top bar scroll reveal (4.4): transparent at rest, page bitmap @ 92% + hairline once content is under it

    @OptIn(ExperimentalTestApi::class)
    private fun scrolled(name: String, tab: ShellTab) {
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
                                state = ShellFixtures.state,
                                navigator = navigator,
                                actions = actionsFor(navigator),
                                snackbarHostState = remember { SnackbarHostState() }
                            )
                        }
                    }
                }
                onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsProperties.VerticalScrollAxisRange))
                    .onFirst().performTouchInput { swipeUp(startY = bottom * 0.8f, endY = bottom * 0.55f) }
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
}
