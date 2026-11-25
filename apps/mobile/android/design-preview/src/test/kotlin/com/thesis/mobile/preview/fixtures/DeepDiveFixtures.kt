package com.thesis.mobile.preview.fixtures

import com.thesis.mobile.model.ConfidenceDisplayView
import com.thesis.mobile.model.ConvictionJournalEntryView
import com.thesis.mobile.model.DeepDiveChangeSummaryView
import com.thesis.mobile.model.DeepDiveCoverageTruthView
import com.thesis.mobile.model.DeepDiveExplainersView
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.DeepDiveStoryHeaderView
import com.thesis.mobile.model.DeepDiveTopChangeView
import com.thesis.mobile.model.EducationBoxView
import com.thesis.mobile.model.EvidenceView
import com.thesis.mobile.model.FilingMetricDeltaView
import com.thesis.mobile.model.FilingReadView
import com.thesis.mobile.model.FinancialAnalysisView
import com.thesis.mobile.model.FinancialDerivedMetricView
import com.thesis.mobile.model.FinancialHistoryRowView
import com.thesis.mobile.model.IndicatorView
import com.thesis.mobile.model.IndicatorsReadView
import com.thesis.mobile.model.InvestmentMemoClaimView
import com.thesis.mobile.model.InvestmentMemoSectionView
import com.thesis.mobile.model.InvestmentMemoView
import com.thesis.mobile.model.IssuerView
import com.thesis.mobile.model.KillSwitchConditionView
import com.thesis.mobile.model.MemoClaimSupportRefView
import com.thesis.mobile.model.ReportViewMapper
import com.thesis.mobile.model.ScenarioResultView
import com.thesis.mobile.model.SectionView
import com.thesis.mobile.model.TrustMetadataView
import com.thesis.mobile.model.ValuationAssumptionsView
import com.thesis.mobile.model.ValuationDisplayView
import com.thesis.mobile.model.ValueDisciplineSignalView
import com.thesis.mobile.model.ValueDisciplineView
import com.thesis.mobile.model.ValueTrapWarningView
import com.thesis.mobile.ui.screens.FiveYearSeries
import org.json.JSONObject
import java.io.File

/**
 * Deep Dive classic fixtures (WP-D): a structured report (AAPL-like, every chapter present) and the bundled MSFT
 * sample, read from the app's asset exactly as SampleDeepDiveScreen reads it.
 */
internal object DeepDiveFixtures {

    private fun fy(year: Int, revenue: Double, gross: Double, op: Double, net: Double, fcf: Double) = FinancialHistoryRowView(
        period = "$year-FY", periodType = "annual", fiscalYear = year, revenue = revenue, grossMargin = gross,
        operatingMargin = op, netIncome = net, freeCashFlow = fcf,
    )

    private fun delta(label: String, unit: String, cur: Double, ref: Double, pct: Double, dir: String) = FilingMetricDeltaView(
        label = label, currentPeriod = "2025-FY", referencePeriod = "2024-FY", unit = unit, currentValue = cur,
        referenceValue = ref, deltaPct = pct, direction = dir, plainEnglish = "",
    )

    private fun qdelta(label: String, unit: String, cur: Double, ref: Double, pct: Double, dir: String) = FilingMetricDeltaView(
        label = label, currentPeriod = "2025-Q4", referencePeriod = "2024-Q4", unit = unit, currentValue = cur,
        referenceValue = ref, deltaPct = pct, direction = dir, plainEnglish = "",
    )

    private fun evidence(name: String, n: Int) = List(n) { i ->
        EvidenceView(
            sourceName = "$name ${i + 1}",
            excerpt = "Services revenue rose to a record, with paid subscriptions above one billion.",
            url = if (i % 2 == 0) "https://www.sec.gov/Archives/edgar/data/320193/aapl-2025-$name-$i.htm" else null,
        )
    }

    val structured: DeepDiveReportView = DeepDiveReportView(
        reportId = "dd-aapl-2025",
        ticker = "AAPL",
        generatedAt = "2025-11-03T14:00:00Z",
        issuer = IssuerView(name = "Apple Inc.", exchange = "NASDAQ"),
        thesisStatement = "Services keep growing faster than hardware, so margins hold up through the cycle.",
        storyHeader = DeepDiveStoryHeaderView(
            headline = "Services carry the margin story",
            thesisSummary = "Apple grew revenue 6.4% in fiscal 2025 while Services passed a quarter of sales. " +
                "Gross margin reached 46.9%, the highest in a decade, because the mix keeps shifting to software.",
            whyNow = "The 10-K shows Services gross margin above 75% for the first time. Hardware units were flat.",
            readerTakeaway = "The business is steadier than its hardware cycle suggests; the open question is how long the mix shift lasts.",
            stanceLabel = "constructive",
        ),
        changeSummary = DeepDiveChangeSummaryView(
            previousView = "Hardware cycle drives the year; margins at the mercy of iPhone units.",
            currentView = "Services mix sets the margin; hardware sets the revenue level.",
            topChanges = listOf(
                DeepDiveTopChangeView("Gross margin", "improved", "high", "Mix shift to Services.", "Margin no longer tracks units."),
                DeepDiveTopChangeView("China revenue", "weakened", "medium", "Lower units.", "The largest open risk."),
            ),
        ),
        investmentMemo = InvestmentMemoView(
            promptVersion = "1", generationMode = "llm",
            companyAngle = "A hardware company whose profits now come mostly from software and services.",
            decisionQuestion = "Can Services keep growing faster than hardware for three more years?",
            sections = listOf(
                InvestmentMemoSectionView("business", "The business", "Services reached 26% of revenue and 45% of gross profit.", listOf("Installed base above 2.3 billion devices.")),
                InvestmentMemoSectionView("risks", "Risks", "Regulation of the App Store is the main risk to the mix.", listOf("App Store rules in the EU and US.", "China demand.", "Search payments under review.")),
            ),
            materialClaims = listOf(
                InvestmentMemoClaimView("c1", "business", "Services gross margin was 75.4% in fiscal 2025.", "high", listOf(MemoClaimSupportRefView("filing", "10-K-2025", "10-K segment note"))),
            ),
            unsupportedClaims = listOf("Wearables share is stable."),
            sparseDataHonestyNote = "Segment margins are disclosed once a year, so quarterly figures are estimates.",
        ),
        financialAnalysis = FinancialAnalysisView(
            annualHistory = listOf(
                fy(2020, 274.5e9, 0.382, 0.241, 57.4e9, 73.4e9),
                fy(2021, 365.8e9, 0.418, 0.298, 94.7e9, 93.0e9),
                fy(2022, 394.3e9, 0.433, 0.303, 99.8e9, 111.4e9),
                fy(2023, 383.3e9, 0.441, 0.298, 97.0e9, 99.6e9),
                fy(2024, 391.0e9, 0.462, 0.315, 93.7e9, 108.8e9),
                fy(2025, 416.2e9, 0.469, 0.320, 112.0e9, 98.8e9),
            ),
            trendMetrics = listOf(
                FinancialDerivedMetricView("rev_cagr", "Revenue growth, 5 years a year", 8.7, "pct", "available", "improving"),
                FinancialDerivedMetricView("fcf_margin", "Free cash flow margin", 23.7, "pct", "available", "deteriorating"),
            ),
            qualityMetrics = listOf(
                FinancialDerivedMetricView("accruals", "Accruals ratio", 0.04, "ratio", "available", "stable", note = "Low: earnings are backed by cash."),
            ),
        ),
        valueDiscipline = ValueDisciplineView(
            score = 3, maxScore = 5, availableSignals = 5, completeness = "full", contextLabel = "quality",
            interpretation = "Three of five checks pass: quality and balance sheet do, the price multiple and growth gap do not.",
            doesNotProve = "Passing checks does not say what the shares will do.",
            signals = listOf(
                ValueDisciplineSignalView("roic", "Return on capital", "quality", "pass", "Above 30% for five years."),
                ValueDisciplineSignalView("pe", "Earnings multiple", "price", "fail", "Above its ten-year median."),
            ),
            valueTrapWarning = ValueTrapWarningView(triggered = false, summary = ""),
        ),
        confidence = ConfidenceDisplayView(score = 0.72, label = "Medium"),
        signalValue = null,
        confidenceLabel = "medium",
        confidenceScore = 0.72,
        valuation = ValuationDisplayView(
            fairValueMid = 228.0, fairValueLow = 186.0, fairValueHigh = 262.0, spotPrice = 241.5,
            assumptions = ValuationAssumptionsView("dcf", 10, 0.025, 0.085),
        ),
        trustMetadata = TrustMetadataView(freshnessState = "fresh", evidenceCount = 14),
        killSwitchConditions = listOf(
            KillSwitchConditionView("Services growth falls below hardware growth", "services_growth", "below", "Services growth under 5% for two quarters"),
            KillSwitchConditionView("Gross margin drops", "gross_margin", "below", "Gross margin under 44%"),
        ),
        watchItems = listOf("EU App Store ruling in Q1", "iPhone 17 units in China"),
        coverageTruth = DeepDiveCoverageTruthView(
            summary = "The report covers the 10-K and four quarters. Management commentary is partial.",
            covered = listOf("10-K fiscal 2025", "Four 10-Q filings"),
            missing = listOf("Earnings call transcripts"),
        ),
        explainers = DeepDiveExplainersView(
            signal = "", confidence = "Confidence rises with the number of sources that agree.",
            freshness = "Fresh means the latest filing is in the report.", valuation = "The model range is a discounted cash flow.",
            omissions = "Lines the filing does not disclose are marked, never guessed.",
        ),
        sections = listOf(
            SectionView("financial", "Financial analysis", "Revenue rose on Services; hardware flat.", "complete", evidence("fin", 6)),
            SectionView("competitive", "Competitive position", "Ecosystem lock-in strengthened.", "complete", evidence("comp", 4)),
            SectionView("management", "Management and governance", "Buybacks continued at a slower pace.", "partial", evidence("mgmt", 2)),
            SectionView("risks", "Risks", "Regulation and China.", "complete", evidence("risk", 3)),
        ),
        filingRead = FilingReadView(
            form = "10-K", period = "2025-FY", generationMode = "llm",
            theFilingRead = "Fiscal 2025 was a margin year more than a growth year. Revenue rose 6.4% while gross margin added 70 bps.",
            whatChanged = "Services grew 13% and passed a quarter of revenue; Greater China fell 8%.",
            theGood = "Gross margin is the highest in a decade and free cash flow covered buybacks.",
            theBad = "Free cash flow fell 9% as capital spending rose for data centres.",
            takeaway = "A steadier, more profitable business, with China the line to watch.",
            whatToWatchNext = "The first quarter of fiscal 2026 and the EU ruling on App Store fees.",
            topChanges = listOf("Services passed 26% of revenue.", "Greater China revenue fell 8%."),
            metricDeltas = listOf(
                delta("Revenue", "currency", 416.2e9, 391.0e9, 6.4, "improved"),
                delta("Operating margin", "pct", 32.0, 31.5, 0.5, "improved"),
                delta("Free cash flow", "currency", 98.8e9, 108.8e9, -9.2, "weakened"),
                delta("Gross margin", "pct", 46.9, 46.2, 0.7, "improved"),
                qdelta("Revenue", "currency", 102.5e9, 94.9e9, 8.0, "improved"),
                qdelta("Gross margin", "pct", 47.2, 46.2, 1.0, "improved"),
            ),
        ),
        indicatorsRead = IndicatorsReadView(
            period = "2025-FY", classification = "quality_compounder", classificationConfidence = "Medium",
            classificationReasons = listOf("Returns on capital above 30% for five years."),
            trapWarnings = emptyList(),
            valueLens = "The price assumes Services keep compounding. The multiple is above its own history.",
            businessQuality = "High returns on capital and a growing share of recurring revenue. Hardware is the cyclical part.",
            balanceSheetRead = "Net cash fell as buybacks continued; debt is modest against cash flow.",
            cashFlowRead = "Free cash flow covers buybacks and the dividend with room to spare.",
            fiveYearRead = "Over five years revenue grew about half and operating margin added 790 bps.",
            takeaway = "Quality is high and rising; the price already reflects much of it.",
            whatToWatchNext = "Services growth against hardware.",
            indicators = listOf(
                IndicatorView("profitability", "Return on equity", 151.3, "pct", "2025-FY", ""),
                IndicatorView("profitability", "Net margin", 26.9, "pct", "2025-FY", ""),
                IndicatorView("valuation", "Price to earnings", 33.1, "multiple", "2025-FY", ""),
                IndicatorView("valuation", "Free cash flow yield", 2.7, "pct", "2025-FY", ""),
            ),
            education = listOf(EducationBoxView("Basis points", "One basis point is a hundredth of a percentage point.", "Margin from 46.2% to 46.9% is +70 bps.")),
        ),
    )

    val journal: List<ConvictionJournalEntryView> = listOf(
        ConvictionJournalEntryView(
            journalEntryId = "j1", ticker = "AAPL", eventType = "opposite_case_generated", sourceType = "report",
            sourceId = "oc1", eventAt = "2025-11-02T10:00:00Z", title = "Opposite case built",
            summary = "Regulation could cut App Store fees by a third.",
        ),
        ConvictionJournalEntryView(
            journalEntryId = "j2", ticker = "AAPL", eventType = "kill_switch_alert_fired", sourceType = "alert",
            sourceId = "a1", eventAt = "2025-10-20T10:00:00Z", title = "Gross margin line crossed",
            summary = "Gross margin printed 45.9% against a line of 46%.",
        ),
    )

    val scenario: ScenarioResultView = ScenarioResultView(
        reportId = "dd-aapl-2025",
        base = ValuationDisplayView(fairValueMid = 228.0, fairValueLow = 186.0, fairValueHigh = 262.0, spotPrice = 241.5),
        scenario = ValuationDisplayView(fairValueMid = 251.0, fairValueLow = 205.0, fairValueHigh = 290.0, spotPrice = 241.5),
        deterministicModel = "dcf_v2",
    )

    /** A report with only the legacy sections (no structured memo), as older reports come. */
    val legacy: DeepDiveReportView = DeepDiveReportView(
        reportId = "dd-legacy", ticker = "KO", issuer = IssuerView("The Coca-Cola Company", "NYSE"),
        thesisStatement = "Pricing carries growth while volumes are flat.",
        signalValue = null, confidenceLabel = null, confidenceScore = null,
        sections = listOf(
            SectionView("summary", "Summary", "Organic revenue grew 9% on price; unit cases were flat.", "complete", evidence("ko", 3)),
            SectionView("risks", "Risks", "Currency and sugar taxes.", "partial", evidence("kor", 1)),
        ),
    )

    private val sampleJson: JSONObject by lazy {
        val candidates = listOf(
            File("../app/src/main/assets/sample/deep-dive-sample-msft.json"),
            File("app/src/main/assets/sample/deep-dive-sample-msft.json"),
        )
        JSONObject(candidates.first { it.exists() }.readText())
    }

    /** The bundled MSFT sample, parsed as the app parses it. */
    val sample: DeepDiveReportView by lazy { ReportViewMapper.mapAnalysisReport(sampleJson) }

    /** The sample's five-year series (from `financial_indicators.five_year_trends`). */
    val sampleFiveYear: FiveYearSeries? by lazy { FiveYearSeries.fromIndicatorsJson(sampleJson.optJSONObject("financial_indicators")) }
}
