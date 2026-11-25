package com.thesis.mobile.preview

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.Composable
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.thesis.mobile.model.WarRoomView
import com.thesis.mobile.preview.fixtures.ResearchFixtures as F
import com.thesis.mobile.ui.copy.ResearchCopy
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
                onOpenTickerResearch = {}, onOpenRunFromRoute = { _, _ -> }, onRequireUpgrade = {}, zone = F.zone,
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
