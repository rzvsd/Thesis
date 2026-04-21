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
              "investment_memo": {
                "prompt_version": "m4.1",
                "generation_mode": "deterministic_fixture",
                "company_angle": "Services durability offsets a slower device cycle.",
                "decision_question": "Is services durability enough to defend the current multiple?",
                "sections": [
                  {
                    "section_id": "investment_thesis",
                    "title": "Investment Thesis",
                    "narrative": "Services mix keeps returns steadier than the market expects.",
                    "key_points": ["Services mix is expanding."]
                  },
                  {
                    "section_id": "risks",
                    "title": "Top Risks",
                    "narrative": "Hardware weakness could still drag the setup.",
                    "key_points": ["China demand remains uneven."]
                  }
                ],
                "material_claims": [
                  {
                    "claim_id": "claim_1",
                    "section_id": "investment_thesis",
                    "statement": "Services resilience stabilizes the thesis.",
                    "materiality": "material",
                    "supports": [
                      {
                        "support_type": "metric",
                        "ref_id": "metric_1",
                        "summary": "Services revenue mix improved."
                      }
                    ]
                  }
                ],
                "unsupported_claims": [],
                "sparse_data_honesty_note": "Transcript coverage is limited."
              },
              "financial_analysis": {
                "annual_history": [
                  {
                    "period": "FY2023",
                    "period_type": "annual",
                    "fiscal_year": 2023,
                    "revenue": 383.3,
                    "free_cash_flow": 99.6,
                    "debt_total": 111.1
                  }
                ],
                "quarterly_history": [],
                "trend_metrics": [
                  {
                    "key": "revenue_growth",
                    "label": "Revenue Growth",
                    "value": 5.4,
                    "unit": "pct",
                    "status": "available",
                    "direction": "improving",
                    "note": "Revenue inflected back up."
                  }
                ],
                "quality_metrics": [
                  {
                    "key": "cash_conversion",
                    "label": "Cash Conversion",
                    "value": 92.0,
                    "unit": "pct",
                    "status": "available",
                    "direction": "flat",
                    "note": "Cash conversion remains strong."
                  }
                ],
                "omissions": [
                  {
                    "code": "shares_missing",
                    "label": "Share count detail",
                    "reason": "Quarterly share-count path unavailable.",
                    "impacts": ["dilution trend"]
                  }
                ]
              },
              "value_discipline": {
                "score": 7,
                "max_score": 9,
                "available_signals": 8,
                "completeness": "partial",
                "context_label": "quality_mega_cap",
                "interpretation": "The score supports quality, not cheapness.",
                "missing_signals": ["Asset turnover"],
                "does_not_prove": "This does not make the stock automatically cheap.",
                "signals": [
                  {
                    "key": "profit_margin",
                    "label": "Profit Margin",
                    "family": "profitability",
                    "status": "pass",
                    "reason": "Margins stayed healthy.",
                    "value": 1.0
                  }
                ],
                "value_trap_warning": {
                  "triggered": false,
                  "summary": "No value trap warning.",
                  "reason_codes": []
                }
              },
              "kill_switch_conditions": [
                {
                  "condition_id": "ks_1",
                  "condition_text": "Services growth drops below the target band.",
                  "signal_type": "guidance_revision",
                  "rationale": "Services resilience is a core part of the thesis.",
                  "threshold_value": 5,
                  "threshold_unit": "pct",
                  "direction": "below"
                }
              ],
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
        assertEquals("Is services durability enough to defend the current multiple?", view.investmentMemo?.decisionQuestion)
        assertEquals(1, view.financialAnalysis?.trendMetrics?.size)
        assertEquals("quality_mega_cap", view.valueDiscipline?.contextLabel)
        assertEquals(1, view.killSwitchConditions.size)
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
