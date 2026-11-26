package com.thesis.mobile.preview

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.asSkiaBitmap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ComposeUiTest
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.runDesktopComposeUiTest
import androidx.compose.ui.unit.Density
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.IssuerView
import com.thesis.mobile.model.SectionView
import com.thesis.mobile.preview.fixtures.ShellFixtures
import com.thesis.mobile.ui.UiState
import com.thesis.mobile.ui.components.ProvidePageBackground
import com.thesis.mobile.ui.components.pageBackground
import com.thesis.mobile.ui.navigation.Destination
import com.thesis.mobile.ui.navigation.ShellTab
import com.thesis.mobile.ui.shell.AppNavigator
import com.thesis.mobile.ui.shell.ShellActions
import com.thesis.mobile.ui.shell.ThesisShell
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisTheme
import org.jetbrains.skia.EncodedImageFormat
import org.jetbrains.skia.Image
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import kotlin.math.roundToInt

/**
 * PR-4b motion frames on the real shell (DESIGN-DIRECTION 4.4, 4.5): each move is started the way a person starts
 * it (a tap on the row, a back gesture held part way, a pull on the list) and captured at 0, 120 and 240 ms and
 * settled, dark and light. `motion4b-*` in screens.out.
 *
 * - `motion4b-name-open` / `-name-close`: a Names row grows into Name, and shrinks back into its row on back.
 * - `motion4b-research-report` / `-history-report`: a recent report row (Research) and a History row grow into
 *   the report, drawn over the list although the report lives in the base layer.
 * - `motion4b-seek-*`: a back gesture held at 50% over a plain push (History) and over a transformed page (Name),
 *   then cancelled or committed.
 * - `motion4b-refresh`: Names pulled past the threshold, released, refreshing, done.
 */
@OptIn(ExperimentalTestApi::class)
class MotionUpgradeRenders {

    private val reportState = ShellFixtures.state.copy(
        deepDiveReport = DeepDiveReportView(
            reportId = "rep-AAPL", ticker = "AAPL", generatedAt = "2026-11-20T14:00:00Z",
            issuer = IssuerView(name = "Apple Inc.", exchange = "NASDAQ"),
            thesisStatement = "Services keep growing faster than hardware, so margins hold up through the cycle.",
            signalValue = "positive", confidenceLabel = "medium", confidenceScore = 0.7,
            sections = listOf(SectionView(sectionId = "summary", title = "Summary", body = "Revenue grew 6% on Services.")),
        )
    )

    private val frames = listOf(0, 120, 240)

    private class Run(val test: ComposeUiTest, val navigator: AppNavigator, val name: String, val theme: PreviewTheme) {
        var state by mutableStateOf<UiState>(ShellFixtures.state)
        private var elapsed = 0

        /** [ms] of frames one at a time, with effects between them (as on a device). */
        fun step(ms: Int) {
            repeat((ms + 15) / 16) {
                test.mainClock.advanceTimeByFrame()
                test.waitForIdle()
            }
            elapsed += ((ms + 15) / 16) * 16
        }

        fun restart() {
            elapsed = 0
        }

        /** Captures the move's frames at [at] ms after [restart], then the settled frame. */
        fun frames(label: String, at: List<Int>) {
            restart()
            at.forEach { ms ->
                if (ms > elapsed) step(ms - elapsed)
                capture("$label-${ms}ms")
            }
            step(900)
            capture("$label-settled")
        }

        fun capture(label: String) {
            val bitmap = test.onRoot().captureToImage().asSkiaBitmap()
            val png = Image.makeFromBitmap(bitmap).encodeToData(EncodedImageFormat.PNG)!!.bytes
            val file = File(screensOutDir, "motion4b-$name-$label-${theme.suffix}.png").apply { writeBytes(png) }
            assertTrue(file.length() > 0)
            println("rendered ${file.absolutePath}")
        }
    }

    private fun selected(name: String): Boolean =
        System.getProperty("screens.only")?.takeIf { it.isNotBlank() }?.let { Regex(it).containsMatchIn("motion4b-$name") } ?: true

    private fun shell(
        name: String,
        state: UiState = ShellFixtures.state,
        setup: AppNavigator.() -> Unit = {},
        script: Run.() -> Unit,
    ) {
        if (!selected(name)) return
        val density = PhoneSpec.density
        listOf(PreviewTheme.DARK, PreviewTheme.LIGHT).forEach { theme ->
            runDesktopComposeUiTest(
                width = (PhoneSpec.WIDTH_DP * density).roundToInt(),
                height = (PhoneSpec.HEIGHT_DP * density).roundToInt(),
            ) {
                val navigator = AppNavigator().apply(setup)
                val run = Run(this, navigator, name, theme).also { it.state = state }
                val actions = object : ShellActions {
                    override fun onBack(): Boolean = navigator.back()
                    override fun onSelectTab(tab: ShellTab) {
                        navigator.selectTab(tab)
                    }
                    override fun onOpenReport(reportId: String, ticker: String?) {
                        navigator.push(Destination.Report(reportId, ticker))
                    }
                    override fun onOpenHistoryItem(item: com.thesis.mobile.model.ReportHistoryItem) {
                        navigator.push(Destination.Report(item.reportId, item.ticker))
                    }
                    override fun onOpenNameIn(ticker: String, pagerScope: String?, anchor: String?) {
                        navigator.push(Destination.Name(ticker, pagerScope, anchor))
                    }
                    override fun onRefreshNames() {
                        run.state = run.state.copy(isBoardRefreshing = true)
                    }
                }
                mainClock.autoAdvance = false
                setContent {
                    CompositionLocalProvider(LocalDensity provides Density(density, 1f)) {
                        ThesisTheme(mode = theme.mode) {
                            ProvidePageBackground {
                                Box(Modifier.fillMaxSize().pageBackground(LocalThesisPalette.current)) {
                                    ThesisShell(
                                        state = run.state,
                                        navigator = navigator,
                                        actions = actions,
                                        snackbarHostState = remember { SnackbarHostState() },
                                    )
                                }
                            }
                        }
                    }
                }
                run.step(1500)
                run.script()
            }
        }
    }

    private fun Run.tapRow(text: String) {
        test.onAllNodesWithText(text, substring = false).onFirst().performClick()
    }

    // ---- Container transform

    @Test fun nameOpensFromItsRowAndClosesIntoIt() = shell("name", setup = { selectTab(ShellTab.Names) }) {
        tapRow("AAPL")
        frames("open", frames)
        test.runOnIdle { navigator.back() }
        frames("close", frames)
    }

    @Test fun recentReportOpensFromItsResearchRow() =
        shell("research-report", reportState, setup = { selectTab(ShellTab.Research) }) {
            tapRow("AAPL")
            frames("open", frames)
            test.runOnIdle { navigator.back() }
            frames("close", frames)
        }

    @Test fun historyRowOpensItsReport() =
        shell("history-report", reportState, setup = { selectTab(ShellTab.Research); push(Destination.History()) }) {
            tapRow("AAPL")
            frames("open", frames)
        }

    // ---- Seekable predictive back

    private fun Run.holdBack(): BackGestureDriver {
        val driver = BackGestureDriver()
        test.runOnIdle {
            driver.start()
            driver.progress(0f)
        }
        step(32)
        test.runOnIdle { driver.progress(0.25f) }
        step(32)
        capture("held-25")
        test.runOnIdle { driver.progress(0.5f) }
        step(32)
        capture("held-50")
        return driver
    }

    @Test fun backGestureOverAPushCancels() =
        shell("seek-push-cancel", setup = { selectTab(ShellTab.Research); push(Destination.History()) }) {
            val driver = holdBack()
            test.runOnIdle { driver.cancel() }
            frames("cancel", frames)
        }

    @Test fun backGestureOverAPushCommits() =
        shell("seek-push-commit", setup = { selectTab(ShellTab.Research); push(Destination.History()) }) {
            val driver = holdBack()
            test.runOnIdle { driver.commit() }
            frames("commit", frames)
        }

    @Test fun backGestureOverATransformCancels() = shell("seek-name-cancel", setup = { selectTab(ShellTab.Names) }) {
        tapRow("AAPL")
        step(900)
        val driver = holdBack()
        test.runOnIdle { driver.cancel() }
        frames("cancel", frames)
    }

    @Test fun backGestureOverATransformCommits() = shell("seek-name-commit", setup = { selectTab(ShellTab.Names) }) {
        tapRow("AAPL")
        step(900)
        val driver = holdBack()
        test.runOnIdle { driver.commit() }
        frames("commit", frames)
    }

    // ---- Pull to refresh (Material3 1.3)

    @Test fun namesPullToRefresh() = shell("refresh", setup = { selectTab(ShellTab.Names) }) {
        val list = test.onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsProperties.VerticalScrollAxisRange)).onFirst()
        list.performTouchInput {
            down(Offset(centerX, top + height * 0.3f))
            repeat(24) { moveBy(Offset(0f, 24f)) }
        }
        step(32)
        capture("pulled")
        list.performTouchInput { up() }
        frames("release", frames)
        test.runOnIdle { state = state.copy(isBoardRefreshing = false) }
        frames("done", frames)
    }
}
