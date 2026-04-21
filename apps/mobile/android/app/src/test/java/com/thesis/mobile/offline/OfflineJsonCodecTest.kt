package com.thesis.mobile.offline

import com.thesis.mobile.model.ConfidenceDisplayView
import com.thesis.mobile.model.DeepDiveCoverageTruthView
import com.thesis.mobile.model.DeepDiveExplainersView
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.DeepDiveStoryHeaderView
import com.thesis.mobile.model.FinancialAnalysisView
import com.thesis.mobile.model.FinancialDerivedMetricView
import com.thesis.mobile.model.FinancialHistoryRowView
import com.thesis.mobile.model.FinancialOmissionView
import com.thesis.mobile.model.InvestmentMemoSectionView
import com.thesis.mobile.model.InvestmentMemoView
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
        assertEquals("AAPL: thesis stays intact", decoded.storyHeader?.headline)
        assertTrue(decoded.visualPanels.single() is MetricDeltaPanelView)
        assertEquals("Coverage explained.", decoded.coverageTruth?.summary)
        assertEquals("Does the quality justify today's multiple?", decoded.investmentMemo?.decisionQuestion)
        assertEquals(1, decoded.financialAnalysis?.trendMetrics?.size)
        assertEquals("quality_mega_cap", decoded.valueDiscipline?.contextLabel)
        assertEquals(1, decoded.killSwitchConditions.size)
    }
}
