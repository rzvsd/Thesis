package com.thesis.mobile.preview

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.thesis.mobile.model.ConvictionInsightCardView
import com.thesis.mobile.model.ConvictionInsightFindingView
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.OppositeCasePointView
import com.thesis.mobile.model.OppositeCaseReportView
import com.thesis.mobile.model.ScenarioResultView
import com.thesis.mobile.ui.screens.DeepDiveClassic
import com.thesis.mobile.ui.screens.DeepDiveConvictionSection
import com.thesis.mobile.ui.screens.DeepDiveNativeTools
import com.thesis.mobile.ui.screens.DeepDiveFixtures
import com.thesis.mobile.ui.screens.DeepDiveScreen
import com.thesis.mobile.ui.screens.ExportSection
import com.thesis.mobile.ui.screens.MonthlyCoherenceSection
import com.thesis.mobile.ui.screens.NotesSection
import com.thesis.mobile.ui.screens.ReportFeedbackSection
import com.thesis.mobile.ui.screens.SampleDeepDiveContent
import com.thesis.mobile.ui.screens.ScenarioSection
import com.thesis.mobile.ui.theme.ThesisSpace
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * WP-D renders: the classic Deep Dive (5.15) and the sample (5.16), loaded, loading and failed, both themes,
 * 1.3x and 2.0x, 360 dp, full page, reduced motion; the desk tools on their own.
 * Run: gradle -p design-preview test -PrendersOnly -Pscreens.only='^dd-'
 */
class DeepDiveRenders {

    @Composable
    private fun Classic(
        report: DeepDiveReportView?,
        isLoading: Boolean = false,
        error: String? = null,
        tier: String = "PRO",
        note: String = "",
        scenario: ScenarioResultView? = null,
        generating: Boolean = false,
        retryLabel: String? = null,
    ) {
        DeepDiveScreen(
            report = report, isLoading = isLoading, errorMessage = error, userTier = tier,
            reportNoteDraft = note, noteUpdatedAt = "2025-11-03T13:58:00Z", isSavingNote = false,
            convictionTimeline = DeepDiveFixtures.journal, convictionTimelineError = null, oppositeCase = null,
            oppositeCaseError = null, isGeneratingOppositeCase = generating, onReportNoteChange = {},
            onSaveReportNote = {}, onGenerateOppositeCase = {}, onRefreshConvictionTimeline = {},
            scenarioResult = scenario, isRunningScenario = false, onRunScenario = { _, _, _ -> },
            onRequireUpgrade = {}, onSubmitReportFeedback = { _, _ -> }, onNotify = {}, watchlist = listOf("AAPL"),
            onRetry = {}, onBack = {}, padding = PaddingValues(), onOpenScenarioStress = {}, webPage = null,
            onFollowChange = {}, retryLabel = retryLabel,
        )
    }

    private val tools = DeepDiveNativeTools(
        isPro = true, reportNoteDraft = "", noteUpdatedAt = null, isSavingNote = false,
        convictionTimeline = DeepDiveFixtures.journal, convictionTimelineError = null, oppositeCase = null,
        oppositeCaseError = null, isGeneratingOppositeCase = false, scenarioResult = null, isRunningScenario = false,
        onReportNoteChange = {}, onSaveReportNote = {}, onGenerateOppositeCase = {}, onRefreshConvictionTimeline = {},
        onRunScenario = { _, _, _ -> }, onRequireUpgrade = {}, onSubmitReportFeedback = { _, _ -> }, onNotify = {},
        onOpenScenarioStress = null,
    )

    private fun check(files: List<java.io.File>) = files.forEach { assertTrue(it.name, it.length() > 0) }

    @Test fun classic() = check(renderScreen("dd-classic") { Classic(DeepDiveFixtures.structured) })

    @Test
    fun classicFullPage() = check(
        renderScreen("dd-classic-full", heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP) { Classic(DeepDiveFixtures.structured) },
    )

    /** The whole page down to the desk chapter, at a lower density to keep the PNG small. */
    @Test
    fun classicWholePage() = check(
        renderScreen("dd-classic-whole", heightDp = WHOLE_PAGE_DP, density = 1.0f, glow = false) {
            Classic(DeepDiveFixtures.structured, note = "What I believe\n\nServices keep compounding.", scenario = DeepDiveFixtures.scenario)
        },
    )

    /**
     * The page at 360 dp down to the Value chapter: every table fits or wraps its labels, nothing is cut at the
     * panel edge. Not the whole page: with the end of the list in view the scroll-spy selects the last chapter and
     * the pill row animates to it, which deadlocks Compose Desktop (README "deadlock").
     */
    @Test
    fun classicWholePageNarrow() = check(
        renderScreen(
            "dd-classic-whole-360", widthDp = PhoneSpec.NARROW_WIDTH_DP, heightDp = NARROW_PAGE_DP, density = 1.0f,
            glow = false, themes = listOf(PreviewTheme.DARK),
        ) {
            Classic(DeepDiveFixtures.structured, scenario = DeepDiveFixtures.scenario)
        },
    )

    @Test
    fun classicWholePageFree() = check(
        renderScreen("dd-classic-whole-free", heightDp = WHOLE_PAGE_DP, density = 1.0f, glow = false, themes = listOf(PreviewTheme.LIGHT)) {
            Classic(DeepDiveFixtures.structured, tier = "free")
        },
    )

    @Test
    fun classicNarrow() = check(
        renderScreen("dd-classic-360", widthDp = PhoneSpec.NARROW_WIDTH_DP, heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP) {
            Classic(DeepDiveFixtures.structured)
        },
    )

    @Test
    fun classicFont130() = check(
        renderScreen("dd-classic-font130", heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP, fontScale = 1.3f) { Classic(DeepDiveFixtures.structured) },
    )

    @Test
    fun classicFont200() = check(
        renderScreen("dd-classic-font200", widthDp = PhoneSpec.NARROW_WIDTH_DP, heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP, fontScale = 2.0f) {
            Classic(DeepDiveFixtures.structured)
        },
    )

    @Test
    fun classicReducedMotion() = check(
        renderScreen("dd-classic-reduced", reducedMotion = true, settleMs = 0) { Classic(DeepDiveFixtures.structured) },
    )

    @Test
    fun classicLegacy() = check(
        renderScreen("dd-classic-legacy", heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP) { Classic(DeepDiveFixtures.legacy) },
    )

    @Test fun classicLoading() = check(renderScreen("dd-classic-loading") { Classic(null, isLoading = true) })

    /** A stored report opening (a Report entry passes its retry label): the page's skeleton, no build steps. */
    @Test
    fun classicOpening() = check(
        renderScreen("dd-classic-opening") { Classic(null, isLoading = true, retryLabel = "Open report again") },
    )

    /** The classic view when the new view can open: the "Classic view" banner with "Open the new view" (5.15 item 1). */
    @Test
    fun classicWithNewView() = check(
        renderScreen("dd-classic-newview") {
            DeepDiveClassic(
                report = DeepDiveFixtures.structured, tools = tools, following = true, onFollowChange = {}, onBack = {},
                padding = PaddingValues(), onOpenNewView = {},
            )
        },
    )

    @Test
    fun classicFailed() = check(renderScreen("dd-classic-failed") { Classic(null, error = "The report did not open.") })

    @Test
    fun sample() = check(
        renderScreen("dd-sample", heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP) {
            SampleDeepDiveContent(DeepDiveFixtures.sample, DeepDiveFixtures.sampleFiveYear, PaddingValues(), {}, {})
        },
    )

    @Test
    fun sampleWholePage() = check(
        renderScreen("dd-sample-whole", heightDp = WHOLE_PAGE_DP, density = 1.0f, glow = false) {
            SampleDeepDiveContent(DeepDiveFixtures.sample, DeepDiveFixtures.sampleFiveYear, PaddingValues(), {}, {})
        },
    )

    @Test
    fun sampleWholePageNarrow() = check(
        renderScreen(
            "dd-sample-whole-360", widthDp = PhoneSpec.NARROW_WIDTH_DP, heightDp = WHOLE_PAGE_DP, density = 1.0f,
            glow = false, themes = listOf(PreviewTheme.DARK),
        ) {
            SampleDeepDiveContent(DeepDiveFixtures.sample, DeepDiveFixtures.sampleFiveYear, PaddingValues(), {}, {})
        },
    )

    @Test
    fun sampleFont130() = check(
        renderScreen("dd-sample-font130", heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP, fontScale = 1.3f) {
            SampleDeepDiveContent(DeepDiveFixtures.sample, DeepDiveFixtures.sampleFiveYear, PaddingValues(), {}, {})
        },
    )

    @Test
    fun sampleFont200() = check(
        renderScreen(
            "dd-sample-font200", widthDp = PhoneSpec.NARROW_WIDTH_DP, heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP, fontScale = 2.0f,
        ) {
            SampleDeepDiveContent(DeepDiveFixtures.sample, DeepDiveFixtures.sampleFiveYear, PaddingValues(), {}, {})
        },
    )

    @Test
    fun sampleLoading() = check(
        renderScreen("dd-sample-loading") { SampleDeepDiveContent(null, null, PaddingValues(), {}, {}) },
    )

    @Test
    fun sampleFailed() = check(
        renderScreen("dd-sample-failed") { SampleDeepDiveContent(null, null, PaddingValues(), {}, {}, failed = true) },
    )

    /** The desk tools as the new view's tool dialog shows them, one under the other. */
    @Test
    fun deskTools() = check(
        renderScreen("dd-desk-tools", heightDp = DESK_HEIGHT_DP, fitHeight = true) {
            Column(Modifier.padding(ThesisSpace.gutter), verticalArrangement = Arrangement.spacedBy(ThesisSpace.x3)) {
                NotesSection("What I believe\n\nServices keep compounding.", "2025-11-03T13:58:00Z", false, {}, {}, filing = "AAPL 10-K FY2025")
                ScenarioSection(true, DeepDiveFixtures.structured.valuation, false, DeepDiveFixtures.scenario, { _, _, _ -> }, {})
                ReportFeedbackSection { _, _ -> }
                ExportSection(true, {}, {}, {}, {}, {})
                DeepDiveConvictionSection(
                    isPro = true, timeline = DeepDiveFixtures.journal, timelineError = null,
                    oppositeCase = opposite, oppositeCaseError = null, isGeneratingOppositeCase = false,
                    onGenerateOppositeCase = {}, onRefreshTimeline = {}, onRequireUpgrade = {},
                )
                MonthlyCoherenceSection(true, listOf(coherence), null, {}, {})
            }
        },
    )

    @Test
    fun deskToolsFree() = check(
        renderScreen("dd-desk-tools-free", heightDp = DESK_HEIGHT_DP, fitHeight = true) {
            Column(Modifier.padding(ThesisSpace.gutter), verticalArrangement = Arrangement.spacedBy(ThesisSpace.x3)) {
                ScenarioSection(false, DeepDiveFixtures.structured.valuation, false, null, { _, _, _ -> }, {})
                ScenarioSection(true, DeepDiveFixtures.structured.valuation.let { it!!.copy(assumptions = it.assumptions!!.copy(wacc = 0.02)) }, false, null, { _, _, _ -> }, {})
                DeepDiveConvictionSection(
                    isPro = false, timeline = emptyList(), timelineError = null, oppositeCase = null, oppositeCaseError = null,
                    isGeneratingOppositeCase = false, onGenerateOppositeCase = {}, onRefreshTimeline = {}, onRequireUpgrade = {},
                )
                DeepDiveConvictionSection(
                    isPro = true, timeline = emptyList(), timelineError = "The journal did not load.", oppositeCase = null,
                    oppositeCaseError = null, isGeneratingOppositeCase = true, onGenerateOppositeCase = {},
                    onRefreshTimeline = {}, onRequireUpgrade = {},
                )
                MonthlyCoherenceSection(false, emptyList(), null, {}, {})
            }
        },
    )

    private val opposite = OppositeCaseReportView(
        oppositeCaseId = "oc1", sourceReportId = "dd-aapl-2025", ticker = "AAPL",
        thesisSummary = "Services keep compounding.",
        oppositeCaseSummary = "Regulation takes a third off App Store fees and the mix shift stalls.",
        keyPoints = listOf(OppositeCasePointView("Fee cuts", "The EU and US rulings cut take rates.")),
        decisiveFactors = listOf("EU ruling in Q1"),
        generatedAt = "2025-11-02T10:00:00Z",
    )

    private val coherence = ConvictionInsightCardView(
        insightId = "i1", periodStart = "2025-10-01", periodEnd = "2025-10-31", insightType = "monthly", status = "ready",
        title = "Two names lean on the same customer",
        summary = "AAPL and AVGO both depend on iPhone units.",
        findings = listOf(ConvictionInsightFindingView("overlap", "iPhone units", "Both theses need units to hold.", listOf("AAPL", "AVGO"))),
        generatedAt = "2025-11-01T10:00:00Z",
    )

    private companion object {
        const val WHOLE_PAGE_DP = 9_000
        const val NARROW_PAGE_DP = 4_500
        const val DESK_HEIGHT_DP = 6_000
    }
}
