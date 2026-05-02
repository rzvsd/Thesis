import assert from "node:assert/strict";
import test from "node:test";

import type { EvidenceItem, ReportSection } from "../../../../packages/contracts/src";
import { buildEvidenceDebateToolResult } from "../../src/tools/evidence-debate/evidence-debate-tool";
import type { FinancialAnalysisToolData } from "../../src/tools/financial-analysis/financial-analysis-tool";

const officialEvidence: EvidenceItem = {
  evidence_id: "ev-sec-1",
  source_type: "filing",
  source_name: "SEC EDGAR",
  excerpt: "Revenue and margin evidence from filing.",
  retrieved_at: "2026-05-01T00:00:00.000Z",
  url: "https://www.sec.gov/example"
};

function section(section_id: string, status: ReportSection["status"], evidence: EvidenceItem[]): ReportSection {
  return {
    section_id,
    title: section_id,
    body: "Reviewed evidence for the section.",
    status,
    evidence
  };
}

test("evidence debate scores complete official evidence above incomplete evidence", async () => {
  const complete = await buildEvidenceDebateToolResult({
    ticker: "AAPL",
    sections: [
      section("financial_analysis", "complete", [officialEvidence]),
      section("risks_and_challenges", "complete", [officialEvidence])
    ]
  }, "2026-05-01T00:00:00.000Z");
  const incomplete = await buildEvidenceDebateToolResult({
    ticker: "AAPL",
    sections: [
      section("financial_analysis", "data_incomplete", []),
      section("risks_and_challenges", "complete", [])
    ]
  }, "2026-05-01T00:00:00.000Z");

  assert.ok((complete.data?.claim_quality_score ?? 0) > (incomplete.data?.claim_quality_score ?? 1));
  assert.ok((incomplete.omissions.length ?? 0) > 0);
});

test("evidence debate lowers score when financial validator reports red flags", async () => {
  const noFlags = await buildEvidenceDebateToolResult({
    ticker: "AAPL",
    sections: [section("financial_analysis", "complete", [officialEvidence])]
  }, "2026-05-01T00:00:00.000Z");
  const financialTool: FinancialAnalysisToolData = {
    metrics: [],
    red_flags: [{
      code: "revenue_contraction",
      detail: "Revenue declined more than 10% year over year.",
      severity: "high"
    }]
  };
  const withFlags = await buildEvidenceDebateToolResult({
    ticker: "AAPL",
    sections: [section("financial_analysis", "complete", [officialEvidence])],
    financialTool
  }, "2026-05-01T00:00:00.000Z");

  assert.ok((withFlags.data?.claim_quality_score ?? 1) < (noFlags.data?.claim_quality_score ?? 0));
  assert.doesNotMatch(JSON.stringify(withFlags.data), /\bbuy\b|\bsell\b|\bhold\b|\bbull\b|\bbear\b/i);
});
