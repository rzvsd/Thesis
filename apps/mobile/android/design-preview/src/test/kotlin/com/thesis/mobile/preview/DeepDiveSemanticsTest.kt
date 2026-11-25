package com.thesis.mobile.preview

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.UriHandler
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.hasScrollToIndexAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.unit.dp
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.preview.fixtures.DeepDiveFixtures
import com.thesis.mobile.ui.copy.DeepDiveCopy
import com.thesis.mobile.ui.screens.DeepDiveScreen
import com.thesis.mobile.ui.screens.ExportSection
import com.thesis.mobile.ui.screens.ReportFeedbackSection
import com.thesis.mobile.ui.screens.ScenarioSection
import com.thesis.mobile.ui.theme.ThemeMode
import com.thesis.mobile.ui.theme.ThesisTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * WP-D semantics: headings, 48 dp targets, roles, evidence links that open, "Add to note" on paragraphs (long-press
 * and the TalkBack action), feedback with no preselection, what-if validation.
 */
class DeepDiveSemanticsTest {

    @get:Rule
    val rule = createComposeRule()

    private val opened = mutableListOf<String>()
    private val note = mutableListOf<String>()
    private val runs = mutableListOf<Triple<Int?, Double?, Double?>>()

    private val uriHandler = object : UriHandler {
        override fun openUri(uri: String) {
            opened += uri
        }
    }

    private fun setReport(report: DeepDiveReportView = DeepDiveFixtures.structured, tier: String = "PRO") {
        rule.setContent {
            ThesisTheme(mode = ThemeMode.Light) {
                CompositionLocalProvider(LocalUriHandler provides uriHandler) {
                    Column(Modifier.width(PhoneSpec.WIDTH_DP.dp).height(PhoneSpec.HEIGHT_DP.dp)) {
                        DeepDiveScreen(
                            report = report, isLoading = false, errorMessage = null, userTier = tier,
                            reportNoteDraft = "", noteUpdatedAt = null, isSavingNote = false,
                            convictionTimeline = DeepDiveFixtures.journal, convictionTimelineError = null,
                            oppositeCase = null, oppositeCaseError = null, isGeneratingOppositeCase = false,
                            onReportNoteChange = { note += it }, onSaveReportNote = {}, onGenerateOppositeCase = {},
                            onRefreshConvictionTimeline = {}, scenarioResult = null, isRunningScenario = false,
                            onRunScenario = { y, g, w -> runs += Triple(y, g, w) }, onRequireUpgrade = {},
                            onSubmitReportFeedback = { _, _ -> }, onNotify = {}, watchlist = listOf("AAPL"),
                            onRetry = {}, onBack = {}, padding = PaddingValues(), webPage = null,
                        )
                    }
                }
            }
        }
    }

    private fun scrollTo(text: String) {
        rule.onNode(
            hasScrollToIndexAction() and SemanticsMatcher.keyIsDefined(SemanticsProperties.VerticalScrollAxisRange),
        )
            .performScrollToNode(hasText(text))
    }

    @Test
    fun companyAndChapterTitlesAreHeadings() {
        setReport()
        rule.onNodeWithText("Apple Inc.").assertIsHeading()
        scrollTo("Services carry the margin story")
        rule.onNodeWithText("Services carry the margin story").assertIsHeading()
    }

    @Test
    fun visibleTargetsAreAtLeast48dp() {
        setReport()
        rule.assertAllTouchTargetsAtLeast()
        scrollTo("Revenue up 6.4% in fiscal 2025")
        rule.assertAllTouchTargetsAtLeast()
    }

    @Test
    fun chapterPillsAreTabs() {
        setReport()
        rule.onNodeWithText(DeepDiveCopy.chFiling).assertRole(Role.Tab)
    }

    @Test
    fun evidenceRowsOpenTheirWebAddress() {
        setReport()
        scrollTo("fin 1")
        rule.onNodeWithText("fin 1").performClick()
        assertEquals(listOf("https://www.sec.gov/Archives/edgar/data/320193/aapl-2025-fin-0.htm"), opened)
    }

    @Test
    fun upshotOffersAddToNote() {
        setReport()
        val takeaway = DeepDiveFixtures.structured.storyHeader!!.readerTakeaway
        scrollTo(takeaway)
        val node = rule.onNodeWithText(takeaway).fetchSemanticsNode()
        val actions = node.config.getOrElse(SemanticsActions.CustomActions) { emptyList() }
        val add = actions.firstOrNull { it.label == DeepDiveCopy.addToNote }
        assertTrue("Upshot has no \"Add to note\" action", add != null)
        rule.runOnIdle { add!!.action() }
        rule.onAllNodesWithText(DeepDiveCopy.copyParagraph).onFirst().assertExists()
        rule.onAllNodesWithText(DeepDiveCopy.addToNote).onFirst().performClick()
        rule.waitForIdle()
        assertEquals(1, note.size)
        assertTrue(note.single(), note.single().startsWith("> “$takeaway” (Ch. 01 Summary, AAPL 10-K FY2025)"))
    }

    @Composable
    private fun Tools(content: @Composable () -> Unit) {
        ThesisTheme(mode = ThemeMode.Light) {
            Column(Modifier.width(PhoneSpec.WIDTH_DP.dp).verticalScroll(rememberScrollState())) { content() }
        }
    }

    @Test
    fun feedbackHasNoPreselectionAndSendsOnce() {
        val sent = mutableListOf<Pair<String, String>>()
        rule.setContent { Tools { ReportFeedbackSection { c, d -> sent += c to d } } }
        rule.onNodeWithText(DeepDiveCopy.send).assertIsNotEnabled()
        rule.onNodeWithText("Too generic").assertRole(Role.RadioButton).performClick()
        rule.onNodeWithText(DeepDiveCopy.send).assertIsEnabled().performClick()
        assertEquals(listOf("generic" to ""), sent)
        rule.onNodeWithText(DeepDiveCopy.sent).assertExists()
        rule.assertAllTouchTargetsAtLeast()
    }

    @Test
    fun whatIfChecksInputsAndSendsFractions() {
        rule.setContent {
            Tools {
                ScenarioSection(true, DeepDiveFixtures.structured.valuation, false, null, { y, g, w -> runs += Triple(y, g, w) }, {})
            }
        }
        rule.onNodeWithText(DeepDiveCopy.runScenario).performClick()
        assertEquals(10, runs.single().first)
        assertEquals(0.025, runs.single().second!!, 1e-9)
        assertEquals(0.085, runs.single().third!!, 1e-9)
        rule.onNodeWithText("8.5").performTextReplacement("2")
        rule.onNodeWithText(DeepDiveCopy.errWaccAboveGrowth).assertExists()
        rule.onNodeWithText(DeepDiveCopy.runScenario).assertIsNotEnabled()
        rule.assertAllTouchTargetsAtLeast()
    }

    @Test
    fun exportRowsAreButtonsAndAskForProFirst() {
        val upgrades = mutableListOf<String>()
        var exported = 0
        rule.setContent { Tools { ExportSection(false, { upgrades += it }, {}, { exported++ }, {}, {}) } }
        rule.onNodeWithText(DeepDiveCopy.exportPdf).performClick()
        assertEquals(listOf("report_export"), upgrades)
        assertEquals(0, exported)
        rule.assertAllTouchTargetsAtLeast()
    }
}
