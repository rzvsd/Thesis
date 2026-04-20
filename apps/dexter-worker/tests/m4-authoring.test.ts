import assert from "node:assert/strict";
import test from "node:test";

import type { AnalysisRequest } from "../../../packages/contracts/src";

import { loadConfig } from "../src/config";
import { runAnalysisPipeline } from "../src/pipeline";
import { validateAnalysisReport } from "../src/schema-validation";

function buildRequest(ticker: string): AnalysisRequest {
  return {
    request_id: `req-m4-${ticker.toLowerCase()}`,
    type: "deep_dive",
    ticker,
    job_id: `job-m4-${ticker.toLowerCase()}`,
    requested_at: "2026-03-15T12:00:00.000Z",
    options: {}
  };
}

function buildFixtureConfig(overrides: Record<string, string> = {}) {
  return loadConfig({
    ...process.env,
    DEXTER_FIXTURE_MODE: "true",
    ...overrides
  });
}

test("M4 authoring emits company-specific memo blocks with claim support", async () => {
  const reports = await Promise.all(
    ["AAPL", "MSFT", "TSLA"].map((ticker) =>
      runAnalysisPipeline(buildRequest(ticker), buildFixtureConfig())
    )
  );

  reports.forEach((report) => {
    assert.equal(validateAnalysisReport(report).length, 0);
    assert.ok(report.investment_memo, "investment_memo should exist");
    const memo = report.investment_memo!;

    assert.equal(memo.prompt_version, "m4-synthesizer-fixture-v1");
    assert.equal(memo.generation_mode, "deterministic_fixture");
    assert.ok(memo.decision_question.includes(report.ticker ?? ""));
    assert.equal(memo.sections.length, 5);
    assert.equal(memo.sections[0]?.section_id, "investment_thesis");
    assert.ok(memo.sections[0]?.narrative.includes(report.ticker ?? ""));
    assert.equal(memo.unsupported_claims.length, 0);

    memo.material_claims.forEach((claim) => {
      assert.ok(claim.supports.length > 0);
      claim.supports.forEach((support) => {
        assert.ok(["metric", "evidence", "omission"].includes(support.support_type));
      });
    });
  });

  const companyAngles = reports.map((report) => report.investment_memo?.company_angle);
  assert.equal(new Set(companyAngles).size, 3);

  const thesisNarratives = reports.map((report) =>
    report.investment_memo?.sections.find((section) => section.section_id === "investment_thesis")
      ?.narrative ?? ""
  );
  assert.equal(new Set(thesisNarratives).size, 3);
  assert.ok(thesisNarratives.every((entry) => !/company remains strong/i.test(entry)));
});

test("M4 sparse fixture keeps omission-forward honesty in memo claims", async () => {
  const report = await runAnalysisPipeline(buildRequest("LIMITED"), buildFixtureConfig());

  assert.equal(validateAnalysisReport(report).length, 0);
  assert.ok(report.investment_memo, "investment_memo should exist");

  const memo = report.investment_memo!;
  assert.ok(memo.sparse_data_honesty_note.includes("Sparse-data handling"));
  assert.ok(
    memo.material_claims.some((claim) =>
      claim.supports.some((support) => support.support_type === "omission")
    ),
    "expected at least one omission-supported claim for sparse fixture"
  );
  assert.ok(
    memo.sections.some((section) =>
      section.section_id === "risks" &&
      (
        section.narrative.toLowerCase().includes("missing") ||
        section.narrative.toLowerCase().includes("omission") ||
        section.narrative.toLowerCase().includes("degraded")
      )
    ),
    "expected risk narrative to mention missing-data context"
  );
});
