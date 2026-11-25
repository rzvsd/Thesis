package com.thesis.mobile.preview

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.assertIsOn
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasProgressBarRangeInfo
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.Dp
import com.thesis.mobile.preview.fixtures.ReportFixtures
import com.thesis.mobile.preview.fixtures.StandInReportPage
import com.thesis.mobile.ui.components.DockDetent
import com.thesis.mobile.ui.components.NoteSaveState
import com.thesis.mobile.ui.copy.ReportCopy
import com.thesis.mobile.ui.platform.HapticKind
import com.thesis.mobile.ui.platform.PreviewHaptics
import com.thesis.mobile.ui.screens.DeepDiveLoadingScreen
import com.thesis.mobile.ui.screens.report.CompareStep
import com.thesis.mobile.ui.screens.report.EarlierNote
import com.thesis.mobile.ui.screens.report.ExportJob
import com.thesis.mobile.ui.screens.report.ReportCompareContent
import com.thesis.mobile.ui.screens.report.ReportFeedbackPanel
import com.thesis.mobile.ui.screens.report.ReportHostFrame
import com.thesis.mobile.ui.screens.report.ReportNotesPanel
import com.thesis.mobile.ui.screens.report.ReportOverflowContent
import com.thesis.mobile.ui.screens.report.earlierReportsFor
import com.thesis.mobile.ui.screens.report.otherNamesFor
import com.thesis.mobile.ui.theme.ThemeMode
import com.thesis.mobile.ui.theme.ThesisTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test

/**
 * WP-C semantics (5.13, 5.14; rubric A1, A3, H1): 48 dp targets in the host, its panels and sheets; the load
 * progress as a progress bar; picker roles; headings and live regions on the generation screen; the confirm haptic
 * once when a build completes.
 */
class ReportSemanticsTest {

    @get:Rule
    val rule = createComposeRule()

    @Before
    fun clearHaptics() = PreviewHaptics.clear()

    private fun set(content: @Composable () -> Unit) {
        rule.setContent { ThesisTheme(mode = ThemeMode.Light) { content() } }
    }

    @Composable
    private fun Frame(pageLoaded: Boolean = true, progress: Int = 100, overlays: @Composable BoxScope.() -> Unit = {}) {
        ReportHostFrame(
            ticker = "AAPL", padding = ReportFixtures.shellPadding, onBack = {}, following = false, onFollowChange = {},
            onOverflow = {}, pageLoaded = pageLoaded, progress = progress, dockItems = ReportFixtures.dock(),
            dockVisible = true, overlays = overlays,
        ) { modifier -> StandInReportPage(modifier) }
    }

    @Test
    fun hostTargetsAreAtLeast48dp() {
        set { Frame() }
        rule.assertAllLaidOutTargetsAtLeast()
        rule.onNodeWithText(ReportCopy.DOCK_NOTES).assertExists()
    }

    @Test
    fun loadingAnnouncesProgress() {
        set { Frame(pageLoaded = false, progress = 40) }
        rule.waitForIdle()
        val node = rule.onNode(hasProgressBarRangeInfo(ProgressBarRangeInfo(0.4f, 0f..1f))).fetchSemanticsNode()
        assertEquals(ReportCopy.PAGE_LOADING, node.config[SemanticsProperties.ContentDescription].single())
        // The dock waits for the page (the kit keeps it composed, hidden and disabled).
        rule.onNodeWithText(ReportCopy.DOCK_NOTES).assertIsNotEnabled()
    }

    @Test
    fun notesPanelTargets() {
        set {
            Frame {
                ReportNotesPanel(
                    visible = true, onDismiss = {}, detent = DockDetent.Half, onDetentChange = {},
                    note = "", onNoteChange = {}, filing = "10-K FY2025", saveState = NoteSaveState.Idle,
                    savedAgo = null, onRetry = {}, onCopy = null,
                    earlier = EarlierNote("FY2024 · 3 Mar", ReportFixtures.earlierNote.text),
                )
            }
        }
        rule.onNodeWithText(ReportCopy.CARRY_FORWARD).assertExists()
        rule.assertAllLaidOutTargetsAtLeast()
    }

    @Test
    fun focusingTheNoteFieldTakesThePanelTo85Percent() {
        var detent by mutableStateOf(DockDetent.Half)
        val asked = mutableListOf<DockDetent>()
        set {
            Frame {
                ReportNotesPanel(
                    visible = true, onDismiss = {}, detent = detent,
                    onDetentChange = { asked += it; detent = it },
                    note = "", onNoteChange = {}, filing = "10-K FY2025", saveState = NoteSaveState.Idle,
                    savedAgo = null, onRetry = {}, onCopy = null,
                    earlier = EarlierNote("FY2024 · 3 Mar", ReportFixtures.earlierNote.text),
                )
            }
        }
        rule.waitForIdle()
        assertTrue(asked.isEmpty())
        rule.onNode(hasSetTextAction()).performClick()
        rule.waitForIdle()
        assertEquals(listOf(DockDetent.Full), asked)
        assertEquals(DockDetent.Full, detent)
    }

    @Test
    fun overflowShowsTheExportInProgress() {
        set { Column { ReportOverflowContent(exporting = ExportJob.Pdf, onClassicView = {}, onExportPdf = {}, onShareCard = {}, onFeedback = {}) } }
        // The row that replaced Export PDF is announced (A3): TalkBack is not silent until the print dialog opens.
        rule.onNodeWithText(ReportCopy.PREPARING_PDF)
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.LiveRegion, LiveRegionMode.Polite))
        rule.onNodeWithText(ReportCopy.EXPORT_PDF).assertDoesNotExist()
        rule.onNodeWithText(ReportCopy.SHARE_CARD).assertIsNotEnabled()
        rule.onNodeWithText(ReportCopy.CLASSIC_VIEW).assertIsEnabled()
        rule.assertAllLaidOutTargetsAtLeast()
    }

    @Test
    fun comparePickerRowsAreCheckboxes() {
        var compared: List<String>? = null
        set {
            Column {
                ReportCompareContent(
                    ticker = "AAPL", step = CompareStep.Names, onStep = {},
                    otherNames = otherNamesFor("AAPL", ReportFixtures.watchlist),
                    earlierReports = earlierReportsFor("rep-aapl-2025", "AAPL", ReportFixtures.history),
                    onCompareNames = { compared = it }, onCompareReport = {},
                )
            }
        }
        rule.onNodeWithText(ReportCopy.PICK_A_NAME).assertIsNotEnabled()
        rule.onNodeWithText("MSFT").assertRole(Role.Checkbox).assertIsOff().performClick()
        rule.onNodeWithText("MSFT").assertIsOn()
        rule.onNodeWithText("NVDA").performClick()
        rule.onNodeWithText(ReportCopy.compareNamesAction(3)).assertIsEnabled().performClick()
        assertEquals(listOf("AAPL", "MSFT", "NVDA"), compared)
        rule.assertAllLaidOutTargetsAtLeast()
    }

    @Test
    fun feedbackOptionsAreRadioButtons() {
        var sent: Pair<String, String>? = null
        set {
            Box(Modifier.fillMaxSize()) {
                ReportFeedbackPanel(visible = true, onDismiss = {}, detent = DockDetent.Full, onDetentChange = {}, onSubmit = { c, d -> sent = c to d })
            }
        }
        // Nothing chosen at first, so Send waits for a choice.
        ReportCopy.feedbackOptions.forEach { (_, label) -> rule.onNodeWithText(label).assertIsNotSelected() }
        rule.onNodeWithText(ReportCopy.FEEDBACK_SEND).assertIsNotEnabled()
        val (code, label) = ReportCopy.feedbackOptions[1]
        rule.onNodeWithText(label).assertRole(Role.RadioButton).performClick()
        rule.assertAllLaidOutTargetsAtLeast()
        rule.onNodeWithText(ReportCopy.FEEDBACK_SEND).assertIsEnabled().performClick()
        assertEquals(code, sent?.first)
        // The sent state stays until the person closes the panel.
        rule.onNodeWithText(ReportCopy.FEEDBACK_THANKS).assertExists()
        rule.onNodeWithText(ReportCopy.FEEDBACK_DONE).assertExists()
        rule.assertAllLaidOutTargetsAtLeast()
    }

    @Test
    fun compareStepsHaveAWayBackToTheChoice() {
        var step by mutableStateOf(CompareStep.Names)
        set {
            Column {
                ReportCompareContent(
                    ticker = "AAPL", step = step, onStep = { step = it },
                    otherNames = otherNamesFor("AAPL", ReportFixtures.watchlist),
                    earlierReports = earlierReportsFor("rep-aapl-2025", "AAPL", ReportFixtures.history),
                    onCompareNames = {}, onCompareReport = {},
                )
            }
        }
        rule.onNodeWithContentDescription(ReportCopy.compareBack("AAPL")).performClick()
        rule.waitForIdle()
        assertEquals(CompareStep.Choose, step)
        step = CompareStep.Reports
        rule.waitForIdle()
        rule.onNodeWithText(ReportCopy.EARLIER_REPORTS_TITLE).assertIsHeading()
        rule.onNodeWithContentDescription(ReportCopy.compareBack("AAPL")).performClick()
        rule.waitForIdle()
        assertEquals(CompareStep.Choose, step)
    }

    @Test
    fun generationHasAHeadingAndATryAgainLiveRegion() {
        var retried = false
        set { DeepDiveLoadingScreen(building = true, ticker = "AAPL", jobStatus = "failed", onRetry = { retried = true }) }
        // The heading says the build stopped (never "Building the report" over a failure), announced as it changes;
        // no "you can leave", and no lede about the filings under a failure.
        rule.onNodeWithText(ReportCopy.STOPPED_TITLE).assertIsHeading()
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.LiveRegion, LiveRegionMode.Polite))
        rule.onNodeWithText(ReportCopy.BUILDING_TITLE).assertDoesNotExist()
        rule.onNodeWithText(ReportCopy.CAN_LEAVE).assertDoesNotExist()
        rule.onNodeWithText(ReportCopy.BUILDING_LEDE).assertDoesNotExist()
        // The stages show how far the build got; the card says what trying again does (one failure sentence, V3).
        rule.onNode(hasContentDescription(ReportCopy.STAGE_STOPPED, substring = true)).assertExists()
        rule.onNodeWithText(ReportCopy.BUILD_RETRY_TITLE).assertExists()
        rule.onNode(hasClickAction() and androidx.compose.ui.test.hasText(ReportCopy.TRY_AGAIN)).performClick()
        assertTrue(retried)
        val live = rule.onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsProperties.LiveRegion))
        assertTrue(live.fetchSemanticsNodes().isNotEmpty())
    }

    @Test
    fun generationCopyFollowsThePhase() {
        var status by mutableStateOf<String?>("queued")
        set { DeepDiveLoadingScreen(building = true, ticker = "AAPL", jobStatus = status) }
        rule.onNodeWithText(ReportCopy.BUILDING_TITLE).assertIsHeading()
        rule.onNodeWithText(ReportCopy.CAN_LEAVE).assertExists()
        status = "running"
        rule.waitForIdle()
        rule.onNodeWithText(ReportCopy.BUILDING_TITLE).assertIsHeading()
        rule.onNodeWithText(ReportCopy.CAN_LEAVE).assertExists()
        status = "complete"
        rule.waitForIdle()
        rule.onNodeWithText(ReportCopy.READY_TITLE).assertIsHeading()
        rule.onNodeWithText(ReportCopy.BUILDING_TITLE).assertDoesNotExist()
        rule.onNodeWithText(ReportCopy.CAN_LEAVE).assertDoesNotExist()
    }

    @Test
    fun generationListsTheThirteenChapters() {
        set { DeepDiveLoadingScreen(building = true, ticker = "AAPL", jobStatus = "running") }
        ReportCopy.chapters.forEachIndexed { index, name ->
            rule.onNode(hasContentDescription(ReportCopy.chapterRow(index + 1, name)), useUnmergedTree = true).assertExists()
        }
        rule.onNodeWithText(ReportCopy.STAGE_BUILDING).assertExists()
    }

    @Test
    fun completingTheBuildConfirmsOnce() {
        var status by mutableStateOf<String?>("running")
        set { DeepDiveLoadingScreen(building = true, ticker = "AAPL", jobStatus = status) }
        rule.waitForIdle()
        assertTrue(PreviewHaptics.log.none { it == HapticKind.Confirm })
        status = "complete"
        rule.waitForIdle()
        status = "COMPLETE"
        rule.waitForIdle()
        assertEquals(1, PreviewHaptics.log.count { it == HapticKind.Confirm })
    }

    @Test
    fun openingOnAFinishedJobDoesNotConfirm() {
        set { DeepDiveLoadingScreen(building = true, ticker = "AAPL", jobStatus = "complete") }
        rule.waitForIdle()
        assertTrue(PreviewHaptics.log.none { it == HapticKind.Confirm })
    }
}

/** Every clickable's laid-out size (not its expanded touch bounds) is at least [min] (A1). */
private fun ComposeContentTestRule.assertAllLaidOutTargetsAtLeast(min: Dp = MinTouchTarget) {
    val failures = onAllNodes(hasClickAction()).fetchSemanticsNodes().mapNotNull { node ->
        val d = node.layoutInfo.density
        val w = with(d) { node.size.width.toDp() }
        val h = with(d) { node.size.height.toDp() }
        val slack = with(d) { 0.5f.toDp() }
        if (w >= min - slack && h >= min - slack) null else "$w x $h: ${node.config.getOrNull(SemanticsProperties.Text) ?: node.config.getOrNull(SemanticsProperties.ContentDescription)}"
    }
    assertTrue("Touch targets under $min:\n" + failures.joinToString("\n"), failures.isEmpty())
}
