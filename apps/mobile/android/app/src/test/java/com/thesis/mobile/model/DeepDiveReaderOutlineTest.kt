package com.thesis.mobile.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DeepDiveReaderOutlineTest {
    @Test
    fun toReaderOutline_groupsPanelsAndPrefersMemoRisks() {
        val report = DeepDiveReportView(
            reportId = "report_reader_1",
            ticker = "AAPL",
            investmentMemo = InvestmentMemoView(
                promptVersion = "m4.1",
                generationMode = "deterministic_fixture",
                companyAngle = "Quality compounder.",
                decisionQuestion = "Does the setup still justify the multiple?",
                sections = listOf(
                    InvestmentMemoSectionView(
                        sectionId = "risks",
                        title = "Top Risks",
                        narrative = "Key risk narrative.",
                        keyPoints = listOf("Demand may weaken.", "Margins may compress.")
                    )
                ),
                sparseDataHonestyNote = "Transcript coverage is limited."
            ),
            signalValue = "positive",
            confidenceLabel = "medium",
            confidenceScore = 0.7,
            visualPanels = listOf(
                MetricDeltaPanelView(title = "Margin profile"),
                RangeBandPanelView(title = "Valuation range"),
                EvidenceLadderPanelView(title = "Evidence ladder"),
                TimelinePanelView(title = "Catalyst timeline")
            ),
            watchItems = listOf("Fallback risk"),
            sections = emptyList()
        )

        val outline = report.toReaderOutline()

        assertTrue(outline.usesStructuredArtifact)
        assertEquals(1, outline.financialPanels.size)
        assertEquals(1, outline.valuationPanels.size)
        assertEquals(1, outline.evidencePanels.size)
        assertEquals(1, outline.riskPanels.size)
        assertEquals(listOf("Demand may weaken.", "Margins may compress."), outline.topRisks)
    }
}
