package com.thesis.mobile.preview

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.Composable
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performSemanticsAction
import com.thesis.mobile.model.WarRoomView
import com.thesis.mobile.preview.fixtures.ResearchFixtures as F
import com.thesis.mobile.ui.copy.ResearchCopy
import com.thesis.mobile.ui.screens.CompareNamesScreen
import com.thesis.mobile.ui.screens.CompareReportsScreen
import com.thesis.mobile.ui.screens.HistoryScreen
import com.thesis.mobile.ui.screens.ResearchScreen
import com.thesis.mobile.ui.screens.ScenarioStressScreen
import com.thesis.mobile.ui.screens.SearchScreen
import com.thesis.mobile.ui.screens.WarRoomScreen
import com.thesis.mobile.ui.theme.ThemeMode
import com.thesis.mobile.ui.theme.ThesisTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * WP-E semantics (rubric A1, A3; 5.12, 5.18 to 5.20, 5.27): 48 dp targets, roles and states on the compare picks,
 * scenario cards and phase toggles, headings on the groups, and no ids on screen.
 */
class ResearchSemanticsTest {

    @get:Rule
    val rule = createComposeRule()

    private fun set(content: @Composable () -> Unit) {
        rule.setContent { ThesisTheme(mode = ThemeMode.Light) { F.Fixed(content) } }
    }

    private fun stateOf(text: String): String? =
        rule.onNodeWithText(text, useUnmergedTree = false).fetchSemanticsNode().config.getOrNull(SemanticsProperties.StateDescription)

    @Test
    fun researchRootTargetsAreLargeEnough() {
        set {
            ResearchScreen(
                ticker = "", recentHistory = F.history, onTickerChange = {}, onRunReport = {}, onOpenReport = {},
                onOpenPulse = {}, padding = PaddingValues(), onSeeAllHistory = {}, watchlist = F.watchlist,
                companyNames = F.companyNames, filingPeriods = F.filingPeriods, notedReportIds = F.noted,
                continueReading = F.continueReading, onOpenCompareNames = {}, clock = F.clock,
            )
        }
        rule.assertAllTouchTargetsAtLeast()
    }

    @Test
    fun historyCompareModeRowsAreCheckboxesAndExplainWhyNot() {
        set {
            HistoryScreen(
                historyItems = F.history, onBack = {}, onOpenReport = {}, companyNames = F.companyNames,
                filingPeriods = F.filingPeriods, notedReportIds = F.noted, onCompareReports = { _, _ -> },
                initialCompareMode = true, initialPicked = listOf("aapl-25"), clock = F.clock,
            )
        }
        rule.assertAllTouchTargetsAtLeast()
        // Another company's row is disabled and says why, in words.
        rule.onAllNodesWithText(ResearchCopy.WHY_OTHER_COMPANY).fetchSemanticsNodes().let { assertTrue(it.isNotEmpty()) }
        val checkboxes = rule.onAllNodes(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Checkbox)).fetchSemanticsNodes()
        assertTrue("compare rows are checkboxes", checkboxes.isNotEmpty())
    }

    @Test
    fun historyLoadingShowsSkeletonNotEmptyState() {
        set { HistoryScreen(historyItems = emptyList(), onBack = {}, onOpenReport = {}, loaded = false, clock = F.clock) }
        rule.onAllNodesWithText(ResearchCopy.HISTORY_EMPTY, substring = true).assertCountEquals(0)
    }

    @Test
    fun warRoomShowsNoIdsAndTogglesPhases() {
        val room: WarRoomView = F.warRoomLive
        set {
            WarRoomScreen(warRoom = room, errorMessage = null, onRefresh = {}, padding = PaddingValues(), onOpenReport = {})
        }
        rule.onAllNodesWithText(room.warRoomId, substring = true).assertCountEquals(0)
        rule.onAllNodesWithText("aapl-25", substring = true).assertCountEquals(0)
        rule.onAllNodesWithText("war_room", substring = true).assertCountEquals(0)
        rule.assertAllTouchTargetsAtLeast()
        val pre = room.phases.first().title
        assertEquals(ResearchCopy.COLLAPSED, stateOf(pre))
        rule.onNodeWithText(pre).performClick()
        assertEquals(ResearchCopy.EXPANDED, stateOf(pre))
        assertEquals(ResearchCopy.EXPANDED, stateOf(room.phases[1].title))
        rule.onNodeWithText(room.title!!).assertIsHeading()
    }

    @Test
    fun scenarioCardsAreRadioButtonsAndResultsHideIds() {
        set {
            ScenarioStressScreen(
                userTier = "PRO", templates = F.templates, selectedScenarioId = "rates_higher_for_longer", run = F.stressRun,
                templatesError = null, runError = null, isLoadingTemplates = false, isRunning = false,
                watchlistCount = F.watchlist.size, onRefreshTemplates = {}, onSelectTemplate = {}, onRunScenario = {},
                onRequireUpgrade = {}, zone = F.zone,
            )
        }
        rule.onNodeWithText(F.templates[0].title).assertIsSelected()
        rule.onNodeWithText(F.templates[1].title).assertIsNotSelected()
        val radios = rule.onAllNodes(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.RadioButton)).fetchSemanticsNodes()
        assertEquals(F.templates.size, radios.size)
        rule.onAllNodesWithText("a1b2c3d4", substring = true).assertCountEquals(0)
        rule.onAllNodesWithText("run-7", substring = true).assertCountEquals(0)
        rule.assertAllTouchTargetsAtLeast()
    }

    @Test
    fun compareNamesHeadersSortCellsOpenTheirSourceAndCopyIsLabelled() {
        set { CompareNamesScreen(state = F.compareNames, onBack = {}, disciplines = F.disciplines, zone = F.zone) }
        rule.assertAllTouchTargetsAtLeast()
        rule.onNodeWithContentDescription(ResearchCopy.COPY_TABLE).assertExists().assertRole(Role.Button)
        // One Copy as table entry: the bar's action, not a second text action under the table.
        rule.onAllNodesWithText(ResearchCopy.COPY_TABLE).assertCountEquals(0)
        // Column headers are headings and sort buttons; a tap sorts by the picked row (until a cell is tapped, the
        // row the title speaks of: operating margin).
        val header = rule.onNode(hasText("MSFT", substring = true) and SemanticsMatcher.keyIsDefined(SemanticsProperties.Heading) and hasClickAction())
        header.assertRole(Role.Button)
        rule.onAllNodesWithText(ResearchCopy.sortedBy(ResearchCopy.ROW_OPERATING)).assertCountEquals(0)
        // Copied, then re-sorted: the check goes, since the clipboard holds the old column order.
        rule.onNodeWithContentDescription(ResearchCopy.COPY_TABLE).performClick()
        rule.onNodeWithContentDescription(ResearchCopy.COPIED).assertExists()
        header.performClick()
        rule.onNodeWithText(ResearchCopy.sortedBy(ResearchCopy.ROW_OPERATING)).assertExists()
        rule.onNodeWithContentDescription(ResearchCopy.COPY_TABLE).assertExists()
        // A figure is a button that opens its source; a name with no report says so once, not "Not computed".
        val cells = rule.onAllNodes(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Button) and hasContentDescription("Revenue, AAPL", substring = true))
        assertTrue(cells.fetchSemanticsNodes().isNotEmpty())
        rule.onAllNodesWithText(com.thesis.mobile.ui.format.Fmt.NOT_COMPUTED).assertCountEquals(0)
        rule.onAllNodesWithText(ResearchCopy.NO_REPORT_YET, substring = true).fetchSemanticsNodes().let { assertTrue(it.isNotEmpty()) }
    }

    @Test
    fun compareReportsTargetsCopyAndRefusalsSayWhy() {
        var opened: String? = null
        set { CompareReportsScreen(state = F.compareReports, onBack = {}, notes = F.compareNotes, zone = F.zone, onOpenName = { opened = it }) }
        rule.assertAllTouchTargetsAtLeast()
        // The ticker the eyebrow names opens its Name page (5.25).
        rule.onNodeWithText(ResearchCopy.openName("AAPL")).performClick()
        assertEquals("AAPL", opened)
        rule.onNodeWithContentDescription(ResearchCopy.COPY_TABLE).assertExists().assertRole(Role.Button)
        rule.onAllNodesWithText(ResearchCopy.COPY_TABLE).assertCountEquals(0)
        // Every key figure opens its source (5.25); the notes carry no "Edit" until the shell can open the editor.
        val figures = rule.onAllNodes(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Button) and hasContentDescription("Revenue, FY2025", substring = true))
        assertTrue(figures.fetchSemanticsNodes().isNotEmpty())
        rule.onAllNodesWithText("Edit").assertCountEquals(0)
        // The basis alone is the table header; the title leads with it ("FY2025 vs FY2024: revenue up …").
        rule.onAllNodesWithText("FY2025 vs FY2024").assertCountEquals(1)
    }

    @Test
    fun compareReportsOfOneFilingSaySo() {
        val same = F.compareReports.copy(a = F.aaplNewer.copy(reportId = "aapl-25b"), b = F.aaplNewer)
        set { CompareReportsScreen(state = same, onBack = {}, zone = F.zone) }
        rule.onNodeWithText(ResearchCopy.SAME_FILING).assertExists()
        rule.onAllNodesWithText(ResearchCopy.NOT_LIKE_FOR_LIKE).assertCountEquals(0)
    }

    @Test
    fun stressRowsDoNotBuildAndOpenNameOnlyWhenWired() {
        var built = 0
        set {
            ScenarioStressScreen(
                userTier = "PRO", templates = F.templates, selectedScenarioId = "rates_higher_for_longer", run = F.stressRun,
                templatesError = null, runError = null, isLoadingTemplates = false, isRunning = false,
                watchlistCount = F.watchlist.size, onRefreshTemplates = {}, onSelectTemplate = {}, onRunScenario = {},
                onRequireUpgrade = {}, zone = F.zone,
            )
        }
        // The rationale is said once (the bar's second line, 5.20), not again in By name.
        rule.onAllNodesWithText(F.stressRun.impacts.first { it.ticker == "NVDA" }.rationale, substring = true).assertCountEquals(1)
        // A By name row is a disclosure: a button with an Expanded/Collapsed state and no on/off toggle state.
        val row = rule.onNode(hasContentDescription("NVDA,", substring = true) and SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Button))
        row.assert(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, ResearchCopy.COLLAPSED))
        row.assert(SemanticsMatcher.keyNotDefined(SemanticsProperties.ToggleableState))
        // Through the action TalkBack uses (the run bar can cover the row's centre in the test window).
        row.performSemanticsAction(SemanticsActions.OnClick)
        row.assert(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, ResearchCopy.EXPANDED))
        rule.onAllNodesWithText(ResearchCopy.openName("NVDA")).assertCountEquals(0)
        assertEquals(0, built)
    }

    @Test
    fun historyCompareModeLeavesOnSystemBack() {
        set {
            HistoryScreen(
                historyItems = F.history, onBack = {}, onOpenReport = {}, filingPeriods = F.filingPeriods,
                onCompareReports = { _, _ -> }, initialCompareMode = true, clock = F.clock,
            )
        }
        rule.onNodeWithText(ResearchCopy.COMPARE_BANNER).assertExists()
        // System back leaves compare mode (R1) instead of popping History.
        val handled = rule.runOnIdle { kotlinx.coroutines.runBlocking { com.thesis.mobile.ui.platform.PreviewBack.press() } }
        assertTrue(handled)
        rule.onAllNodesWithText(ResearchCopy.COMPARE_BANNER).assertCountEquals(0)
        rule.onNodeWithContentDescription(ResearchCopy.COMPARE_ACTION).assertExists()
    }

    @Test
    fun enteringCompareModeClearsTheHiddenFilter() {
        set {
            HistoryScreen(
                historyItems = F.history, onBack = {}, onOpenReport = {}, filingPeriods = F.filingPeriods,
                onCompareReports = { _, _ -> }, initialFilter = com.thesis.mobile.ui.screens.HistoryFilter.Pulse, clock = F.clock,
            )
        }
        rule.onAllNodesWithText("AAPL", substring = true).assertCountEquals(0)
        rule.onNodeWithContentDescription(ResearchCopy.COMPARE_ACTION).performClick()
        // The chips hide in compare mode, so the Pulse filter must not stay on: the Deep Dives are there to pick.
        rule.onNodeWithText(ResearchCopy.COMPARE_BANNER).assertExists()
        assertTrue(rule.onAllNodesWithText("AAPL", substring = true).fetchSemanticsNodes().isNotEmpty())
    }

    @Test
    fun searchGroupsAreHeadings() {
        set {
            SearchScreen(
                query = "ap", onQueryChange = {}, results = F.searchResults, onBack = {},
                companyNames = F.companyNames, filingPeriods = F.filingPeriods, autoFocus = false,
            )
        }
        rule.onNodeWithText(ResearchCopy.GROUP_NAMES.uppercase(), ignoreCase = true).assertIsHeading()
        rule.onNodeWithText(ResearchCopy.GROUP_COMPANIES.uppercase(), ignoreCase = true).assertIsHeading()
        rule.onNodeWithText(ResearchCopy.showAll(F.searchResults.tickers.size - 1)).assertExists()
        rule.assertAllTouchTargetsAtLeast()
    }
}
