package com.thesis.mobile.preview

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.thesis.mobile.preview.fixtures.ReportFixtures
import com.thesis.mobile.preview.fixtures.SheetOver
import com.thesis.mobile.preview.fixtures.StandInReportPage
import com.thesis.mobile.ui.components.DockDetent
import com.thesis.mobile.ui.components.NoteSaveState
import com.thesis.mobile.ui.copy.ReportCopy
import com.thesis.mobile.ui.navigation.ThesisBackTopBar
import com.thesis.mobile.ui.screens.DeepDiveLoadingScreen
import com.thesis.mobile.ui.screens.report.CompareStep
import com.thesis.mobile.ui.screens.report.EarlierNote
import com.thesis.mobile.ui.screens.report.ExportJob
import com.thesis.mobile.ui.screens.report.ReportCompareContent
import com.thesis.mobile.ui.screens.report.ReportConvictionContent
import com.thesis.mobile.ui.screens.report.ReportFallbackBanner
import com.thesis.mobile.ui.screens.report.ReportFeedbackPanel
import com.thesis.mobile.ui.screens.report.ReportHostFrame
import com.thesis.mobile.ui.screens.report.ReportNotesPanel
import com.thesis.mobile.ui.screens.report.ReportOpeningBar
import com.thesis.mobile.ui.screens.report.ReportOverflowContent
import com.thesis.mobile.ui.screens.report.earlierReportsFor
import com.thesis.mobile.ui.screens.report.otherNamesFor
import org.junit.Test

/**
 * WP-C renders (docs/app-redesign/DESIGN-DIRECTION.md 5.13 report host, 5.14 generation): both themes, plus the
 * 1.3x / 2.0x, 360 dp, full-page and reduced-motion variants. The WebView is a stand-in page in the harness.
 * Run: render.sh '^report-'
 */
class ReportRenders {

    @Composable
    private fun Frame(
        pageLoaded: Boolean = true,
        progress: Int = 100,
        dockVisible: Boolean = true,
        following: Boolean = true,
        overlays: @Composable androidx.compose.foundation.layout.BoxScope.() -> Unit = {},
    ) {
        ReportHostFrame(
            ticker = "AAPL",
            padding = ReportFixtures.shellPadding,
            onBack = {},
            following = following,
            onFollowChange = {},
            onOverflow = {},
            pageLoaded = pageLoaded,
            progress = progress,
            dockItems = ReportFixtures.dock(),
            dockVisible = dockVisible,
            overlays = overlays,
        ) { modifier -> StandInReportPage(modifier) }
    }

    // ---- 5.13 report host

    @Test fun loaded() { renderScreen("report-host-loaded") { Frame() } }

    @Test fun loadedLargeText() { renderScreen("report-host-loaded-1.3x", fontScale = 1.3f) { Frame() } }

    @Test fun loadedHugeText() { renderScreen("report-host-loaded-2.0x", fontScale = 2.0f) { Frame() } }

    @Test fun loadedNarrow() { renderScreen("report-host-loaded-360dp", widthDp = 360) { Frame(following = false) } }

    @Test fun dockHidden() { renderScreen("report-host-dock-hidden", themes = listOf(PreviewTheme.LIGHT)) { Frame(dockVisible = false) } }

    @Test fun loading() { renderScreen("report-host-loading") { Frame(pageLoaded = false, progress = 40) } }

    @Test
    fun loadingReducedMotion() {
        renderScreen("report-host-loading-reduced", reducedMotion = true, themes = listOf(PreviewTheme.DARK)) {
            Frame(pageLoaded = false, progress = 70)
        }
    }

    @Composable
    private fun Notes(note: String, earlier: EarlierNote?, detent: DockDetent = DockDetent.Half, state: NoteSaveState = NoteSaveState.Saved) {
        Frame(dockVisible = false) {
            ReportNotesPanel(
                visible = true,
                onDismiss = {},
                detent = detent,
                onDetentChange = {},
                note = note,
                onNoteChange = {},
                filing = "10-K FY2025",
                saveState = state,
                savedAgo = "2 min ago",
                onRetry = {},
                onCopy = {},
                earlier = earlier,
            )
        }
    }

    private val earlier = EarlierNote(caption = "FY2024 · 3 Mar", text = ReportFixtures.earlierNote.text)

    @Test fun notesEmptyWithEarlier() { renderScreen("report-notes-earlier") { Notes(note = "", earlier = earlier) } }

    @Test fun notesWithQuote() { renderScreen("report-notes-quote") { Notes(note = ReportFixtures.noteWithQuote, earlier = earlier, detent = DockDetent.Full) } }

    @Test
    fun notesSaveFailed() {
        renderScreen("report-notes-failed", themes = listOf(PreviewTheme.LIGHT)) {
            Notes(note = ReportFixtures.noteWithQuote, earlier = null, state = NoteSaveState.Failed)
        }
    }

    @Test
    fun notesLargeText() {
        renderScreen("report-notes-1.3x", fontScale = 1.3f, themes = listOf(PreviewTheme.DARK)) { Notes(note = "", earlier = earlier) }
    }

    @Test
    fun feedback() {
        renderScreen("report-feedback") {
            Frame(dockVisible = false) {
                ReportFeedbackPanel(visible = true, onDismiss = {}, detent = DockDetent.Half, onDetentChange = {}, onSubmit = { _, _ -> })
            }
        }
    }

    @Composable
    private fun Overflow(exporting: ExportJob) {
        SheetOver(behind = { Frame() }) {
            ReportOverflowContent(exporting = exporting, onClassicView = {}, onExportPdf = {}, onShareCard = {}, onFeedback = {})
        }
    }

    @Test fun overflow() { renderScreen("report-overflow") { Overflow(ExportJob.None) } }

    @Test fun overflowPreparingPdf() { renderScreen("report-overflow-preparing") { Overflow(ExportJob.Pdf) } }

    @Composable
    private fun Compare(step: CompareStep) {
        SheetOver(behind = { Frame() }, title = if (step == CompareStep.Choose) ReportCopy.compareTitle("AAPL") else null) {
            ReportCompareContent(
                ticker = "AAPL",
                step = step,
                onStep = {},
                otherNames = otherNamesFor("AAPL", ReportFixtures.watchlist),
                earlierReports = earlierReportsFor("rep-aapl-2025", "AAPL", ReportFixtures.history),
                onCompareNames = {},
                onCompareReport = {},
            )
        }
    }

    @Test fun compareChoose() { renderScreen("report-compare-choose") { Compare(CompareStep.Choose) } }

    @Test fun compareNames() { renderScreen("report-compare-names") { Compare(CompareStep.Names) } }

    @Test fun compareReports() { renderScreen("report-compare-reports") { Compare(CompareStep.Reports) } }

    @Composable
    private fun Conviction(isPro: Boolean = true) {
        SheetOver(behind = { Frame() }) {
            ReportConvictionContent(
                isPro = isPro,
                timeline = ReportFixtures.convictionTimeline,
                timelineError = null,
                oppositeCase = ReportFixtures.oppositeCase,
                oppositeCaseError = null,
                isGeneratingOppositeCase = false,
                onGenerateOppositeCase = {},
                onRefreshTimeline = {},
                onRequireUpgrade = {},
            )
        }
    }

    @Test fun conviction() { renderScreen("report-conviction") { Conviction() } }

    @Test
    fun convictionHugeText() {
        renderScreen("report-conviction-2.0x", fontScale = 2.0f, themes = listOf(PreviewTheme.DARK)) { Conviction() }
    }

    @Test
    fun convictionFree() {
        renderScreen("report-conviction-free", themes = listOf(PreviewTheme.LIGHT)) { Conviction(isPro = false) }
    }

    @Test
    fun fallbackBanner() {
        renderScreen("report-fallback-banner") {
            Box(Modifier.fillMaxSize()) {
                StandInReportPage(Modifier.fillMaxSize())
                ReportFallbackBanner(onRetry = {}, modifier = Modifier.align(Alignment.BottomCenter))
            }
        }
    }

    // ---- 5.14 generation

    /** The shell's padding for the running entry: the status bar and its back bar above, the gesture bar below. */
    private val runningPadding = PaddingValues(top = 80.dp, bottom = 16.dp)

    @Composable
    private fun Generation(jobStatus: String?, building: Boolean = true) {
        Box(Modifier.fillMaxSize()) {
            DeepDiveLoadingScreen(padding = runningPadding, building = building, ticker = "AAPL", jobStatus = jobStatus, onRetry = {})
            Column {
                Spacer(Modifier.height(24.dp))
                ThesisBackTopBar(title = "", onBack = {}, overHero = true)
            }
        }
    }

    @Test fun generationQueued() { renderScreen("report-generation-queued") { Generation("queued") } }

    @Test fun generationBuilding() { renderScreen("report-generation-building") { Generation("running") } }

    @Test fun generationReady() { renderScreen("report-generation-ready", settleMs = 3_000) { Generation("complete") } }

    @Test fun generationFailed() { renderScreen("report-generation-failed") { Generation("failed") } }

    @Test
    fun generationFullPage() {
        // A tall phone, so the whole chapter list (01 to 13) and the bottom padding are on the PNG: the screen
        // fills the height and scrolls, so cropping to the content would cut at the viewport.
        renderScreen("report-generation-full", heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP, themes = listOf(PreviewTheme.LIGHT)) {
            Generation("running")
        }
    }

    @Test
    fun generationLargeText() {
        renderScreen("report-generation-2.0x", fontScale = 2.0f, themes = listOf(PreviewTheme.DARK)) { Generation("running") }
    }

    @Test
    fun generationNarrow() {
        renderScreen("report-generation-360dp", widthDp = 360, themes = listOf(PreviewTheme.LIGHT)) { Generation("queued") }
    }

    @Test fun openingStoredReport() { renderScreen("report-opening-skeleton") { Generation(jobStatus = null, building = false) } }

    /** The stored report opening under the report's own bar (the chrome the host keeps once the page is in). */
    @Test
    fun openingStoredReportWithReportBar() {
        renderScreen("report-opening-report-bar") {
            DeepDiveLoadingScreen(
                padding = ReportFixtures.shellPadding,
                reportBar = ReportOpeningBar(ticker = "AAPL", onBack = {}, following = true),
            )
        }
    }
}
