package com.thesis.mobile.offline

import com.thesis.mobile.model.ConfidenceDisplayView
import com.thesis.mobile.model.DeepDiveCoverageTruthView
import com.thesis.mobile.model.DeepDiveExplainersView
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.DeepDiveStoryHeaderView
import com.thesis.mobile.model.MetricDeltaItemView
import com.thesis.mobile.model.MetricDeltaPanelView
import com.thesis.mobile.model.SectionView
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
            confidence = ConfidenceDisplayView(score = 0.7, label = "medium"),
            signalValue = "positive",
            confidenceLabel = "medium",
            confidenceScore = 0.7,
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
    }
}
