package com.thesis.mobile.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DeepDiveReaderOutlineTest {
    @Test
    fun readerIssuerHelpersPreferIssuerNameAndFallbackToTicker() {
        val issuerReport = DeepDiveReportView(
            reportId = "report_reader_issuer",
            ticker = "AAPL",
            issuer = IssuerView(
                name = "Apple Inc.",
                exchange = "NASDAQ"
            ),
            signalValue = "positive",
            confidenceLabel = "medium",
            confidenceScore = 0.7,
            sections = emptyList()
        )
        val legacyReport = DeepDiveReportView(
            reportId = "report_reader_legacy",
            ticker = "MSFT",
            signalValue = "positive",
            confidenceLabel = "medium",
            confidenceScore = 0.7,
            sections = emptyList()
        )

        assertEquals("Apple Inc.", issuerReport.readerIssuerName())
        assertEquals("AAPL · NASDAQ", issuerReport.readerIssuerMetadataLine())
        assertEquals("MSFT", legacyReport.readerIssuerName())
        assertEquals(null, legacyReport.readerIssuerMetadataLine())
    }

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

    @Test
    fun toReaderOutline_ordersDueDiligenceSectionsAndFallsBackToDueDiligenceRisks() {
        val report = DeepDiveReportView(
            reportId = "report_reader_2",
            ticker = "MSFT",
            dueDiligence = DueDiligenceView(
                promptVersion = "dd2.0",
                generationMode = "live_prompt",
                sections = listOf(
                    DueDiligenceSectionView(
                        sectionId = "valuation_and_thesis_stance",
                        title = "Valuation And Thesis Stance",
                        summary = "The valuation range still supports the thesis.",
                        narrativeParagraphs = listOf("Base valuation remains above spot."),
                        coverageState = "full"
                    ),
                    DueDiligenceSectionView(
                        sectionId = "growth_opportunities_and_outlook",
                        title = "Growth Opportunities And Outlook",
                        summary = "The outlook remains constructive.",
                        narrativeParagraphs = listOf("Upside still depends on sustained cloud demand."),
                        coverageState = "full"
                    ),
                    DueDiligenceSectionView(
                        sectionId = "risks_and_challenges",
                        title = "Risks And Challenges",
                        summary = "Execution still needs to hold through the next quarter.",
                        narrativeParagraphs = listOf("The main risk is that cloud growth decelerates into the next check-in."),
                        keyPoints = listOf("Cloud growth may cool.", "Margin pressure could reappear."),
                        evidenceRefs = listOf("filing_2025"),
                        omissions = listOf("Segment disclosure remains partial."),
                        coverageState = "partial"
                    ),
                    DueDiligenceSectionView(
                        sectionId = "financial_analysis",
                        title = "Financial Analysis",
                        summary = "Cash generation remains strong.",
                        narrativeParagraphs = listOf("Free cash flow still supports the thesis."),
                        coverageState = "full"
                    ),
                    DueDiligenceSectionView(
                        sectionId = "competitive_positioning",
                        title = "Competitive Positioning",
                        summary = "Competitive position remains durable.",
                        narrativeParagraphs = listOf("Installed base still matters."),
                        coverageState = "partial"
                    ),
                    DueDiligenceSectionView(
                        sectionId = "management_and_governance",
                        title = "Management And Governance",
                        summary = "Capital allocation remains disciplined.",
                        narrativeParagraphs = listOf("Management still looks aligned with the thesis."),
                        coverageState = "partial"
                    )
                )
            ),
            signalValue = "positive",
            confidenceLabel = "high",
            confidenceScore = 0.8,
            sections = emptyList()
        )

        val outline = report.toReaderOutline()

        assertTrue(outline.usesStructuredArtifact)
        assertEquals(
            listOf(
                "financial_analysis",
                "competitive_positioning",
                "management_and_governance",
                "risks_and_challenges",
                "growth_opportunities_and_outlook",
                "valuation_and_thesis_stance"
            ),
            outline.dueDiligenceSections.map { it.sectionId }
        )
        assertEquals(listOf("Cloud growth may cool.", "Margin pressure could reappear."), outline.topRisks)
        assertEquals(
            listOf(
                "competitive_positioning",
                "management_and_governance",
                "risks_and_challenges"
            ),
            outline.dueDiligenceEvidenceSections.map { it.sectionId }
        )
    }
}
