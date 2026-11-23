// A small Deep Dive report for effects tests.
import type { AnalysisReport } from "../../types.ts";

export function deepDiveFixture(overrides: Partial<AnalysisReport> = {}): AnalysisReport {
  return {
    report_id: "rpt_1",
    job_id: "job_1",
    schema_version: "2.0",
    type: "deep_dive",
    ticker: "aapl",
    generated_at: "2026-11-20T12:00:00.000Z",
    sections: [
      {
        section_id: "thesis_statement",
        title: "Thesis Statement",
        body: "  Services growth carries margins.  ",
        evidence: [{ evidence_id: "ev_1", source_name: "10-Q", retrieved_at: "2026-11-19T00:00:00.000Z" }],
      },
    ],
    signal: {
      value: "positive",
      reasons: ["Margins expand"],
      evidence: [{
        evidence_id: "ev_0",
        source_name: "Press release",
        retrieved_at: "2026-11-18T00:00:00.000Z",
      }],
    },
    confidence: { label: "medium", score: 0.7 },
    historical_context: { latest_period: "2026Q3" },
    kill_switch_conditions: [
      {
        condition_id: "ks_a",
        condition_text: "Price drops 10%",
        signal_type: "price_move",
        rationale: "Momentum",
      },
      {
        condition_text: "Guidance cut",
        signal_type: "guidance",
        rationale: "Outlook",
        threshold_unit: "pct",
      },
      { condition_text: "CEO leaves", signal_type: "management_change", rationale: "Execution" },
    ],
    name_relationships: [
      {
        source_ticker: "AAPL",
        target_ticker: "TSM",
        relationship_type: "supplier",
        confidence: 0.9,
        evidence_text: "TSM makes the chips",
        rationale: "Sole foundry",
      },
    ],
    ...overrides,
  };
}
