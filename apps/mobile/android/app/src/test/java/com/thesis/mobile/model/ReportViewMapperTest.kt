package com.thesis.mobile.model

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ReportViewMapperTest {
    @Test
    fun mapAnalysisReport_parsesPresentationBlocksAndPanels() {
        val json = JSONObject(
            """
            {
              "report_id": "report_1",
              "job_id": "job_1",
              "schema_version": "2.1",
              "type": "deep_dive",
              "ticker": "AAPL",
              "generated_at": "2026-04-18T10:00:00Z",
              "story_header": {
                "headline": "AAPL: services strength keeps the thesis alive",
                "thesis_summary": "The thesis is intact, but hardware recovery still matters.",
                "why_now": "Revenue moved up while valuation stayed disciplined.",
                "reader_takeaway": "Read changes first, then check proof.",
                "stance_label": "positive"
              },
              "change_summary": {
                "previous_view": "Prior thesis watched hardware weakness.",
                "current_view": "Current view is more balanced.",
                "top_changes": [
                  {
                    "title": "Revenue reset the tone",
                    "direction": "up",
                    "impact_level": "high",
                    "why_it_changed": "Revenue improved year over year.",
                    "why_it_matters": "It supports the execution thesis."
                  }
                ]
              },
              "visual_panels": [
                {
                  "type": "metric_delta",
                  "title": "Quarter-over-quarter moves",
                  "metrics": [
                    {
                      "label": "Revenue",
                      "current_value": 100.0,
                      "reference_value": 90.0,
                      "delta_pct": 11.1,
                      "basis": "qoq",
                      "direction": "up"
                    }
                  ]
                },
                {
                  "type": "trust_scorecard",
                  "title": "Trust and Freshness",
                  "freshness_state": "fresh",
                  "contradiction_state": "none",
                  "valuation_state": "available",
                  "evidence_count": 4
                }
              ],
              "explainers": {
                "signal": "Signal explains the directional call.",
                "confidence": "Confidence explains the limits.",
                "freshness": "Freshness explains thesis age.",
                "valuation": "Valuation explains the range.",
                "omissions": "Omissions explain what is missing."
              },
              "watch_items": ["Watch margin quality."],
              "coverage_truth": {
                "summary": "The report states what it covers.",
                "covered": ["Latest quarter"],
                "missing": ["No major omissions"]
              },
              "confidence": {
                "score": 0.7,
                "label": "medium",
                "limiting_factors": []
              },
              "signal": {
                "value": "positive",
                "reasons": ["Evidence threshold met."],
                "evidence": []
              },
              "sections": [
                {
                  "section_id": "thesis_statement",
                  "title": "Thesis Statement",
                  "body": "Legacy proof layer remains available.",
                  "status": "complete",
                  "evidence": []
                }
              ],
              "flags": [],
              "data_sources": []
            }
            """.trimIndent()
        )

        val view = ReportViewMapper.mapAnalysisReport(json)

        assertEquals("AAPL", view.ticker)
        assertNotNull(view.storyHeader)
        assertEquals("positive", view.storyHeader?.stanceLabel)
        assertEquals(1, view.changeSummary?.topChanges?.size)
        assertEquals("Watch margin quality.", view.watchItems.single())
        assertEquals("The report states what it covers.", view.coverageTruth?.summary)
        assertTrue(view.visualPanels[0] is MetricDeltaPanelView)
        assertTrue(view.visualPanels[1] is TrustScorecardPanelView)
    }

    @Test
    fun mapAnalysisReport_keepsLegacyReportsReadableWhenPresentationFieldsMissing() {
        val json = JSONObject(
            """
            {
              "report_id": "legacy_report",
              "job_id": "job_legacy",
              "schema_version": "1.0",
              "type": "deep_dive",
              "ticker": "MSFT",
              "generated_at": "2026-04-18T10:00:00Z",
              "confidence": {
                "score": 0.5,
                "label": "low",
                "limiting_factors": ["legacy"]
              },
              "sections": [
                {
                  "section_id": "thesis_statement",
                  "title": "Thesis Statement",
                  "body": "Legacy thesis still renders.",
                  "status": "complete",
                  "evidence": []
                }
              ],
              "flags": [],
              "data_sources": []
            }
            """.trimIndent()
        )

        val view = ReportViewMapper.mapAnalysisReport(json)

        assertEquals("MSFT", view.ticker)
        assertEquals(true, view.isLegacy)
        assertEquals(null, view.storyHeader)
        assertEquals(emptyList<DeepDiveVisualPanelView>(), view.visualPanels)
        assertEquals("Legacy thesis still renders.", view.thesisStatement)
    }
}
