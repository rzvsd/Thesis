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
              "issuer": {
                "name": "Apple Inc.",
                "exchange": "NASDAQ"
              },
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
              "due_diligence": {
                "prompt_version": "dd2.0",
                "generation_mode": "live_prompt",
                "sections": [
                  {
                    "section_id": "financial_analysis",
                    "title": "Financial Analysis",
                    "summary": "Cash generation held up better than the market expected.",
                    "narrative_paragraphs": [
                      "Free cash flow stayed resilient against a mixed device cycle.",
                      "Balance-sheet flexibility still supports the thesis."
                    ],
                    "key_points": ["Cash generation stayed resilient."],
                    "evidence_refs": ["metric_1", "filing_2025"],
                    "omissions": ["Quarterly segment mix remains incomplete."],
                    "coverage_state": "partial"
                  },
                  {
                    "section_id": "competitive_positioning",
                    "title": "Competitive Positioning",
                    "summary": "The moat still comes from ecosystem depth and pricing power.",
                    "narrative_paragraphs": ["Competitive position remains durable."],
                    "key_points": ["Installed base remains sticky."],
                    "evidence_refs": ["filing_2025"],
                    "omissions": [],
                    "coverage_state": "full"
                  },
                  {
                    "section_id": "management_and_governance",
                    "title": "Management and Governance",
                    "summary": "Capital allocation remains disciplined.",
                    "narrative_paragraphs": ["Management still looks aligned with the thesis."],
                    "key_points": ["Buyback pacing remains disciplined."],
                    "evidence_refs": ["filing_2025"],
                    "omissions": [],
                    "coverage_state": "partial"
                  },
                  {
                    "section_id": "risks_and_challenges",
                    "title": "Risks and Challenges",
                    "summary": "The main risk is a weaker hardware recovery.",
                    "narrative_paragraphs": ["Execution risk remains real."],
                    "key_points": ["China demand remains uneven."],
                    "evidence_refs": ["metric_1"],
                    "omissions": [],
                    "coverage_state": "full"
                  },
                  {
                    "section_id": "growth_opportunities_and_outlook",
                    "title": "Growth Opportunities and Outlook",
                    "summary": "Services and installed-base monetization still support the outlook.",
                    "narrative_paragraphs": ["The outlook remains constructive if services durability holds."],
                    "key_points": ["Services mix still supports upside."],
                    "evidence_refs": ["metric_1"],
                    "omissions": [],
                    "coverage_state": "partial"
                  },
                  {
                    "section_id": "valuation_and_thesis_stance",
                    "title": "Valuation and Thesis Stance",
                    "summary": "The range still supports a constructive stance.",
                    "narrative_paragraphs": ["Valuation remains a range, not a point estimate."],
                    "key_points": ["The base case still depends on execution."],
                    "evidence_refs": ["metric_1"],
                    "omissions": [],
                    "coverage_state": "full"
                  }
                ]
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
        assertEquals("2026-04-18T10:00:00Z", view.generatedAt)
        assertEquals("Apple Inc.", view.issuer?.name)
        assertEquals("NASDAQ", view.issuer?.exchange)
        assertNotNull(view.storyHeader)
        assertEquals("positive", view.storyHeader?.stanceLabel)
        assertEquals(1, view.changeSummary?.topChanges?.size)
        assertEquals("Watch margin quality.", view.watchItems.single())
        assertEquals("The report states what it covers.", view.coverageTruth?.summary)
        assertEquals("Is services durability enough to defend the current multiple?", view.investmentMemo?.decisionQuestion)
        assertEquals(6, view.dueDiligence?.sections?.size)
        assertEquals(
            listOf(
                "financial_analysis",
                "competitive_positioning",
                "management_and_governance",
                "risks_and_challenges",
                "growth_opportunities_and_outlook",
                "valuation_and_thesis_stance"
            ),
            view.dueDiligence?.sections?.map { it.sectionId }
        )
        assertEquals("partial", view.dueDiligence?.sections?.first()?.coverageState)
        assertEquals(listOf("metric_1", "filing_2025"), view.dueDiligence?.sections?.first()?.evidenceRefs)
        assertEquals(1, view.financialAnalysis?.trendMetrics?.size)
        assertEquals("quality_mega_cap", view.valueDiscipline?.contextLabel)
        assertEquals(1, view.killSwitchConditions.size)
        assertTrue(view.visualPanels[0] is MetricDeltaPanelView)
        assertTrue(view.visualPanels[1] is TrustScorecardPanelView)
    }

    @Test
    fun mapAnalysisReport_acceptsIssuerAndNarrativeFallbacksDuringRollout() {
        val json = JSONObject(
            """
            {
              "report_id": "report_rollout",
              "job_id": "job_rollout",
              "schema_version": "2.1",
              "type": "deep_dive",
              "ticker": "NVDA",
              "company_name": "NVIDIA Corporation",
              "exchange": "NASDAQ",
              "generated_at": "2026-04-18T10:00:00Z",
              "confidence": {
                "score": 0.6,
                "label": "medium",
                "limiting_factors": []
              },
              "due_diligence": {
                "prompt_version": "dd2.0",
                "generation_mode": "live_prompt",
                "sections": [
                  {
                    "section_id": "financial_analysis",
                    "title": "Financial Analysis",
                    "summary": "Demand remains stronger than feared.",
                    "narrative": "Demand stayed strong through the quarter.\n\nGross margin remained elevated.",
                    "key_points": [],
                    "evidence_refs": ["metric_1"],
                    "omissions": [],
                    "coverage_state": "full"
                  }
                ]
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

        assertEquals("NVIDIA Corporation", view.issuer?.name)
        assertEquals("NASDAQ", view.issuer?.exchange)
        assertEquals(
            listOf(
                "Demand stayed strong through the quarter.",
                "Gross margin remained elevated."
            ),
            view.dueDiligence?.sections?.single()?.narrativeParagraphs
        )
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
        assertEquals("2026-04-18T10:00:00Z", view.generatedAt)
        assertEquals(true, view.isLegacy)
        assertEquals(null, view.storyHeader)
        assertEquals(emptyList<DeepDiveVisualPanelView>(), view.visualPanels)
        assertEquals("Legacy thesis still renders.", view.thesisStatement)
    }
}
