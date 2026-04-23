package com.thesis.mobile.offline

import com.thesis.mobile.model.ConfidenceDisplayView
import com.thesis.mobile.model.DeepDiveCoverageTruthView
import com.thesis.mobile.model.DeepDiveExplainersView
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.DeepDiveStoryHeaderView
import com.thesis.mobile.model.DueDiligenceSectionView
import com.thesis.mobile.model.DueDiligenceView
import com.thesis.mobile.model.FinancialAnalysisView
import com.thesis.mobile.model.FinancialDerivedMetricView
import com.thesis.mobile.model.FinancialHistoryRowView
import com.thesis.mobile.model.FinancialOmissionView
import com.thesis.mobile.model.InvestmentMemoSectionView
import com.thesis.mobile.model.InvestmentMemoView
import com.thesis.mobile.model.IssuerView
import com.thesis.mobile.model.KillSwitchConditionView
import com.thesis.mobile.model.MetricDeltaItemView
import com.thesis.mobile.model.MetricDeltaPanelView
import com.thesis.mobile.model.SectionView
import com.thesis.mobile.model.ValueDisciplineSignalView
import com.thesis.mobile.model.ValueDisciplineView
import com.thesis.mobile.model.ValueTrapWarningView
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OfflineJsonCodecTest {
    @Test
    fun deepDiveReportRoundTrip_preservesPresentationBlocks() {
        val report = DeepDiveReportView(
            reportId = "report_offline_1",
            ticker = "AAPL",
            generatedAt = "2026-04-18T10:00:00Z",
            issuer = IssuerView(
                name = "Apple Inc.",
                exchange = "NASDAQ"
            ),
            schemaVersion = "2.1",
            thesisStatement = "AAPL thesis remains intact.",
            storyHeader = DeepDiveStoryHeaderView(
                headline = "AAPL: thesis stays intact",
                thesisSummary = "The thesis holds.",
                whyNow = "Revenue improved.",
                readerTakeaway = "Read changes first.",
                stanceLabel = "positive"
            ),
            visualPanels = listOf(
                MetricDeltaPanelView(
                    title = "Quarter-over-quarter moves",
                    metrics = listOf(
                        MetricDeltaItemView(
                            label = "Revenue",
                            currentValue = 100.0,
                            referenceValue = 90.0,
                            deltaPct = 11.1,
                            basis = "qoq",
                            direction = "up"
                        )
                    )
                )
            ),
            explainers = DeepDiveExplainersView(
                signal = "Signal explained.",
                confidence = "Confidence explained.",
                freshness = "Freshness explained.",
                valuation = "Valuation explained.",
                omissions = "Omissions explained."
            ),
            coverageTruth = DeepDiveCoverageTruthView(
                summary = "Coverage explained.",
                covered = listOf("Latest quarter"),
                missing = listOf("No major omissions")
            ),
            investmentMemo = InvestmentMemoView(
                promptVersion = "m4.1",
                generationMode = "deterministic_fixture",
                companyAngle = "Quality compounder with resilient cash generation.",
                decisionQuestion = "Does the quality justify today's multiple?",
                sections = listOf(
                    InvestmentMemoSectionView(
                        sectionId = "investment_thesis",
                        title = "Investment Thesis",
                        narrative = "The business remains resilient.",
                        keyPoints = listOf("Cash generation remains strong.")
                    )
                ),
                sparseDataHonestyNote = "Some quarterly details remain unavailable."
            ),
            dueDiligence = DueDiligenceView(
                promptVersion = "dd2.0",
                generationMode = "live_prompt",
                sections = listOf(
                    DueDiligenceSectionView(
                        sectionId = "financial_analysis",
                        title = "Financial Analysis",
                        summary = "Cash generation remained steady through the last cycle.",
                        narrativeParagraphs = listOf(
                            "The balance sheet still offers room to absorb volatility.",
                            "Cash conversion is healthy enough to support the core thesis."
                        ),
                        keyPoints = listOf("Cash conversion stayed healthy."),
                        evidenceRefs = listOf("metric_1", "filing_2025"),
                        omissions = listOf("Quarterly segment detail remains incomplete."),
                        coverageState = "partial"
                    ),
                    DueDiligenceSectionView(
                        sectionId = "competitive_positioning",
                        title = "Competitive Positioning",
                        summary = "Competitive position remains durable.",
                        narrativeParagraphs = listOf("Ecosystem stickiness still matters."),
                        keyPoints = listOf("Installed base remains sticky."),
                        evidenceRefs = listOf("filing_2025"),
                        omissions = emptyList(),
                        coverageState = "full"
                    ),
                    DueDiligenceSectionView(
                        sectionId = "management_and_governance",
                        title = "Management and Governance",
                        summary = "Capital allocation remains disciplined.",
                        narrativeParagraphs = listOf("Management still looks aligned with the thesis."),
                        keyPoints = listOf("Buyback pacing remains disciplined."),
                        evidenceRefs = listOf("filing_2025"),
                        omissions = emptyList(),
                        coverageState = "partial"
                    ),
                    DueDiligenceSectionView(
                        sectionId = "risks_and_challenges",
                        title = "Risks and Challenges",
                        summary = "The next quarter still matters.",
                        narrativeParagraphs = listOf("Execution risk remains the main watch point."),
                        keyPoints = listOf("China demand remains uneven."),
                        evidenceRefs = listOf("metric_1"),
                        omissions = emptyList(),
                        coverageState = "full"
                    ),
                    DueDiligenceSectionView(
                        sectionId = "growth_opportunities_and_outlook",
                        title = "Growth Opportunities and Outlook",
                        summary = "Services durability still supports upside.",
                        narrativeParagraphs = listOf("The outlook remains constructive if services strength holds."),
                        keyPoints = listOf("Services mix still supports upside."),
                        evidenceRefs = listOf("metric_1"),
                        omissions = emptyList(),
                        coverageState = "partial"
                    ),
                    DueDiligenceSectionView(
                        sectionId = "valuation_and_thesis_stance",
                        title = "Valuation and Thesis Stance",
                        summary = "The range still supports a constructive stance.",
                        narrativeParagraphs = listOf("Valuation remains a range, not a point estimate."),
                        keyPoints = listOf("The base case still depends on execution."),
                        evidenceRefs = listOf("metric_1"),
                        omissions = emptyList(),
                        coverageState = "full"
                    )
                )
            ),
            financialAnalysis = FinancialAnalysisView(
                annualHistory = listOf(
                    FinancialHistoryRowView(
                        period = "FY2023",
                        periodType = "annual",
                        fiscalYear = 2023,
                        revenue = 100.0,
                        freeCashFlow = 40.0,
                        debtTotal = 20.0
                    )
                ),
                trendMetrics = listOf(
                    FinancialDerivedMetricView(
                        key = "revenue_growth",
                        label = "Revenue Growth",
                        value = 7.2,
                        unit = "pct",
                        status = "available",
                        direction = "improving",
                        note = "Revenue turned back up."
                    )
                ),
                omissions = listOf(
                    FinancialOmissionView(
                        code = "shares_missing",
                        label = "Share count",
                        reason = "No quarterly share count history.",
                        impacts = listOf("dilution trend")
                    )
                )
            ),
            valueDiscipline = ValueDisciplineView(
                score = 7,
                maxScore = 9,
                availableSignals = 8,
                completeness = "partial",
                contextLabel = "quality_mega_cap",
                interpretation = "Quality is strong, but this is not a cheap stock by default.",
                missingSignals = listOf("Asset turnover"),
                doesNotProve = "It does not prove upside on its own.",
                signals = listOf(
                    ValueDisciplineSignalView(
                        key = "profit_margin",
                        label = "Profit Margin",
                        family = "profitability",
                        status = "pass",
                        reason = "Profitability stayed healthy.",
                        value = 1.0
                    )
                ),
                valueTrapWarning = ValueTrapWarningView(
                    triggered = false,
                    summary = "No value trap warning.",
                    reasonCodes = emptyList()
                )
            ),
            confidence = ConfidenceDisplayView(score = 0.7, label = "medium"),
            signalValue = "positive",
            confidenceLabel = "medium",
            confidenceScore = 0.7,
            killSwitchConditions = listOf(
                KillSwitchConditionView(
                    conditionText = "Revenue growth breaks below the expected band.",
                    signalType = "guidance_revision",
                    direction = "below",
                    thresholdDescription = "5.0 pct"
                )
            ),
            sections = listOf(
                SectionView(
                    sectionId = "thesis_statement",
                    title = "Thesis Statement",
                    body = "AAPL thesis remains intact.",
                    status = "complete"
                )
            )
        )

        val decoded = OfflineJsonCodec.decodeDeepDiveReport(
            OfflineJsonCodec.encodeDeepDiveReport(report)
        )

        assertNotNull(decoded)
        decoded!!
        assertEquals("2026-04-18T10:00:00Z", decoded.generatedAt)
        assertEquals("Apple Inc.", decoded.issuer?.name)
        assertEquals("NASDAQ", decoded.issuer?.exchange)
        assertEquals("AAPL: thesis stays intact", decoded.storyHeader?.headline)
        assertTrue(decoded.visualPanels.single() is MetricDeltaPanelView)
        assertEquals("Coverage explained.", decoded.coverageTruth?.summary)
        assertEquals("Does the quality justify today's multiple?", decoded.investmentMemo?.decisionQuestion)
        assertEquals(6, decoded.dueDiligence?.sections?.size)
        assertEquals(
            listOf(
                "financial_analysis",
                "competitive_positioning",
                "management_and_governance",
                "risks_and_challenges",
                "growth_opportunities_and_outlook",
                "valuation_and_thesis_stance"
            ),
            decoded.dueDiligence?.sections?.map { it.sectionId }
        )
        assertEquals("partial", decoded.dueDiligence?.sections?.first()?.coverageState)
        assertEquals(listOf("metric_1", "filing_2025"), decoded.dueDiligence?.sections?.first()?.evidenceRefs)
        assertEquals(1, decoded.financialAnalysis?.trendMetrics?.size)
        assertEquals("quality_mega_cap", decoded.valueDiscipline?.contextLabel)
        assertEquals(1, decoded.killSwitchConditions.size)
    }
}
