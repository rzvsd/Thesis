import assert from "node:assert/strict";
import test from "node:test";

import type { AnalysisRequest, ReportSection } from "../../../packages/contracts/src";

import { loadConfig, validateLiveModeConfig } from "../src/config";
import { runAnalysisPipeline } from "../src/pipeline";
import { loadRuntimePrompts } from "../src/prompt-store";
import { validateAnalysisReport } from "../src/schema-validation";

function buildRequest(ticker: string): AnalysisRequest {
  return {
    request_id: `req-${ticker.toLowerCase()}`,
    type: "deep_dive",
    ticker,
    job_id: `job-${ticker.toLowerCase()}`,
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

function findSection(sections: ReportSection[], sectionId: string): ReportSection {
  const section = sections.find((entry) => entry.section_id === sectionId);
  assert.ok(section, `expected section ${sectionId} to be present`);
  return section;
}

test("MSFT fixture request produces a schema-valid report with no blank sections", async () => {
  const report = await runAnalysisPipeline(buildRequest("MSFT"), buildFixtureConfig());

  assert.equal(validateAnalysisReport(report).length, 0);
  assert.equal(report.schema_version, "2.0");
  assert.equal(report.type, "deep_dive");
  assert.equal(report.signal?.value, "positive");
  assert.ok(report.sections.every((section) => section.body.trim().length > 0));
  assert.ok(report.sections.every((section) => section.status.length > 0));
  assert.equal(report.sections[0]?.section_id, "thesis_statement");
  assert.ok(report.story_header?.headline.includes("MSFT"));
  assert.ok((report.story_header?.reader_takeaway.length ?? 0) > 20);
  assert.ok((report.change_summary?.top_changes.length ?? 0) >= 1);
  assert.ok(report.visual_panels?.some((panel) => panel.type === "trust_scorecard"));
  assert.ok(report.visual_panels?.some((panel) => panel.type === "metric_delta"));
  assert.ok(report.explainers?.signal.length);
  assert.ok((report.watch_items?.length ?? 0) >= 1);
  assert.ok((report.coverage_truth?.covered.length ?? 0) >= 1);
  assert.ok((report.financial_analysis?.annual_history.length ?? 0) >= 3);
  assert.ok((report.financial_analysis?.trend_metrics.length ?? 0) >= 1);
  assert.ok((report.financial_analysis?.quality_metrics.length ?? 0) >= 1);
  assert.ok((report.value_discipline?.signals.length ?? 0) >= 1);
  assert.ok((report.value_discipline?.available_signals ?? 0) >= 1);
  assert.ok((report.value_discipline?.does_not_prove.length ?? 0) > 20);
  assert.equal(findSection(report.sections, "what_changed").status, "complete");
  assert.ok(["complete", "data_incomplete", "data_unavailable"].includes(
    findSection(report.sections, "value_discipline").status
  ));
  assert.equal(findSection(report.sections, "valuation").status, "complete");
  assert.equal(findSection(report.sections, "quarter_over_quarter_changes").status, "complete");
  assert.equal(findSection(report.sections, "year_over_year_changes").status, "complete");
  assert.equal(findSection(report.sections, "management_commentary").status, "complete");
  assert.equal(report.trust_metadata?.freshness_state, "fresh");
  assert.ok((report.trust_metadata?.evidence_count ?? 0) > 0);
  assert.equal(report.trust_metadata?.thesis_drift.status, "available");
  assert.ok((report.trust_metadata?.quote_provenance.length ?? 0) > 0);
  assert.ok((report.kill_switch_conditions?.length ?? 0) >= 3);
  assert.ok((report.kill_switch_conditions?.length ?? 0) <= 5);
  assert.match(
    findSection(report.sections, "executive_summary").body,
    /This is a research summary, not financial advice\. Always do your own research\./
  );
});

test("LIMITED fixture request degrades affected sections honestly", async () => {
  const report = await runAnalysisPipeline(buildRequest("LIMITED"), buildFixtureConfig());

  assert.equal(report.signal?.value, "no_signal");
  assert.equal(findSection(report.sections, "what_changed").status, "data_incomplete");
  assert.equal(findSection(report.sections, "valuation").status, "data_incomplete");
  assert.equal(
    findSection(report.sections, "acquisitions_major_events").status,
    "data_unavailable"
  );
  assert.equal(
    findSection(report.sections, "management_commentary").status,
    "data_incomplete"
  );
  assert.equal(report.trust_metadata?.thesis_drift.status, "unavailable");
  assert.equal(report.trust_metadata?.valuation_state, "degraded");
  assert.ok((report.trust_metadata?.missing_data_notes.length ?? 0) > 0);
  assert.ok((report.financial_analysis?.omissions.length ?? 0) > 0);
  assert.equal(report.value_discipline?.context_label, "sparse_data");
  assert.ok((report.value_discipline?.missing_signals.length ?? 0) > 0);
  assert.notEqual(report.value_discipline?.completeness, "complete");
  assert.ok(report.coverage_truth?.missing.some((entry) => entry.includes("Valuation")));
  assert.ok(report.coverage_truth?.missing.some((entry) => entry.includes("Annual history is insufficient")));
  assert.ok(report.coverage_truth?.missing.some((entry) => entry.includes("Value signal unavailable")));
  assert.ok(report.explainers?.omissions.includes("Valuation"));
});

test("NOSIG fixture request returns no_signal with an explicit reason", async () => {
  const report = await runAnalysisPipeline(buildRequest("NOSIG"), buildFixtureConfig());

  assert.equal(report.signal?.value, "no_signal");
  assert.ok((report.signal?.reasons.length ?? 0) > 0);
  assert.ok(report.flags.includes("signal_insufficient_data"));
});

test("TIMEOUT fixture request marks the failed section and completes the report", async () => {
  const report = await runAnalysisPipeline(buildRequest("TIMEOUT"), buildFixtureConfig());

  assert.equal(
    findSection(report.sections, "revenue_margin_analysis").status,
    "failed"
  );
  assert.equal(findSection(report.sections, "executive_summary").status, "complete");
});

test("forced failure tickers stop processing with a deterministic error", async () => {
  const config = buildFixtureConfig({
    DEXTER_FORCE_FAIL_TICKERS: "FAILME"
  });

  await assert.rejects(
    () => runAnalysisPipeline(buildRequest("FAILME"), config),
    /Forced failure for ticker FAILME/
  );
});

test("invalid analysis reports are rejected by runtime validation", () => {
  const errors = validateAnalysisReport({
    report_id: "bad-report",
    job_id: "job-bad",
    schema_version: "1.0.0",
    type: "deep_dive",
    generated_at: "not-a-date",
    confidence: {
      score: 0.1,
      label: "low",
      limiting_factors: []
    },
    signal: {
      value: "positive",
      reasons: [],
      evidence: []
    },
    sections: [
      {
        section_id: "executive_summary",
        title: "Executive Summary",
        body: "",
        status: "complete",
        evidence: []
      }
    ],
    flags: [],
    data_sources: []
  });

  assert.ok(errors.some((error) => error.includes("generated_at")));
  assert.ok(errors.some((error) => error.includes("sections[0].body")));
});

test("fixture mode loads prompts from the local manifest", async () => {
  const prompts = await loadRuntimePrompts(buildFixtureConfig());

  assert.equal(prompts.planner.version, "m2-planner-fixture-v1");
  assert.equal(prompts.sectionExecutor.version, "m2-section-fixture-v1");
  assert.equal(prompts.synthesizer.version, "m2-synthesizer-fixture-v1");
  assert.equal(prompts.killSwitchExtractor.version, "m5-kill-switch-fixture-v1");
  assert.equal(prompts.relationshipExtractor.version, "m5-relationship-fixture-v1");
});

test("GRAPH fixture extracts report-backed name relationships", async () => {
  const report = await runAnalysisPipeline(buildRequest("GRAPH"), buildFixtureConfig());

  assert.equal(validateAnalysisReport(report).length, 0);
  assert.ok((report.name_relationships?.length ?? 0) >= 2);
  assert.ok(report.name_relationships?.some((relationship) =>
    relationship.source_ticker === "NVDA" &&
    relationship.target_ticker === "GRAPH" &&
    relationship.relationship_type === "supplier" &&
    relationship.confidence >= 0.7
  ));
  assert.ok(report.name_relationships?.some((relationship) =>
    relationship.source_ticker === "QQQ" &&
    relationship.target_ticker === "GRAPH" &&
    relationship.relationship_type === "sector" &&
    relationship.confidence >= 0.7
  ));
});

test("live mode validation requires model, Anthropic, and LangSmith settings", () => {
  const config = loadConfig({
    PORT: "3002",
    DEXTER_FIXTURE_MODE: "false",
    DEXTER_MODEL: "",
    LANGSMITH_TRACING: "false",
    LANGSMITH_PROJECT: "",
    ANTHROPIC_API_KEY: "",
    FINANCIAL_DATASETS_API_KEY: ""
  });

  const errors = validateLiveModeConfig(config);

  assert.ok(errors.includes("DEXTER_MODEL is required when DEXTER_FIXTURE_MODE=false"));
  assert.ok(errors.includes("ANTHROPIC_API_KEY is required when DEXTER_FIXTURE_MODE=false"));
  assert.ok(
    errors.includes("FINANCIAL_DATASETS_API_KEY is required when DEXTER_FIXTURE_MODE=false")
  );
  assert.ok(errors.includes("LANGSMITH_TRACING=true is required when DEXTER_FIXTURE_MODE=false"));
  assert.ok(errors.includes("LANGSMITH_API_KEY is required when DEXTER_FIXTURE_MODE=false"));
  assert.ok(errors.includes("LANGSMITH_PROJECT is required when DEXTER_FIXTURE_MODE=false"));
});
