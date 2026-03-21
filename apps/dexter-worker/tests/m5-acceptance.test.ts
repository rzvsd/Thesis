import assert from "node:assert/strict";
import test from "node:test";

import type { AnalysisRequest } from "../../../packages/contracts/src";

import { loadConfig } from "../src/config";
import { runAnalysisPipeline } from "../src/pipeline";
import { validateAnalysisReport } from "../src/schema-validation";

const DISCLAIMER_TEXT = "This is a research summary, not financial advice. Always do your own research.";

const EXPECTED_SECTION_TITLES = [
  "Executive Summary",
  "Quarter-over-Quarter Changes",
  "Year-over-Year Changes",
  "Revenue and Margin Analysis",
  "Debt and Liquidity",
  "Acquisitions and Major Events",
  "Management Commentary",
  "Research Signal",
  "Confidence Score and Limiting Factors",
  "Evidence References"
] as const;

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

function assertContainsDisclaimer(report: unknown): void {
  assert.ok(
    JSON.stringify(report).includes(DISCLAIMER_TEXT),
    "expected the canonical M5 disclaimer text to appear somewhere in the report"
  );
}

test("M5 fixture report matches the PRD surface-A section split", async () => {
  const report = await runAnalysisPipeline(buildRequest("MSFT"), buildFixtureConfig());

  assert.equal(validateAnalysisReport(report).length, 0);
  assert.equal(report.type, "deep_dive");
  assert.ok(report.sections.every((section) => section.body.trim().length > 0));
  assert.ok(report.sections.every((section) => section.status.length > 0));

  const sectionTitles = report.sections.map((section) => section.title);
  for (const title of EXPECTED_SECTION_TITLES) {
    assert.ok(
      sectionTitles.includes(title),
      `expected section title ${title} to be present`
    );
  }

  assertContainsDisclaimer(report);

  assert.ok(report.signal, "expected a signal block on the report");
  assert.notEqual(report.signal?.value, "no_signal");
  assert.ok((report.signal?.evidence.length ?? 0) >= 2);
  assert.ok(report.signal?.evidence.every((item) => item.source_name.trim().length > 0));

  const sectionEvidenceCounts = new Map(report.sections.map((section) => [
    section.title,
    section.evidence.length
  ]));
  for (const title of [
    "Executive Summary",
    "Quarter-over-Quarter Changes",
    "Year-over-Year Changes",
    "Revenue and Margin Analysis",
    "Debt and Liquidity",
    "Acquisitions and Major Events",
    "Management Commentary"
  ] as const) {
    assert.ok(
      (sectionEvidenceCounts.get(title) ?? 0) >= 1,
      `expected section ${title} to carry at least one evidence item`
    );
  }
});

test("M5 limited fixture report downgrades to no_signal with explicit reasons", async () => {
  const report = await runAnalysisPipeline(buildRequest("LIMITED"), buildFixtureConfig());

  assert.equal(report.signal?.value, "no_signal");
  assert.ok((report.signal?.reasons.length ?? 0) >= 1);
  assert.ok(report.flags.includes("signal_insufficient_data"));
  assertContainsDisclaimer(report);
});

test("M5 timeout fixture report still finishes with explicit degradation", async () => {
  const report = await runAnalysisPipeline(buildRequest("TIMEOUT"), buildFixtureConfig());

  assert.equal(validateAnalysisReport(report).length, 0);
  assert.ok(report.sections.some((section) => section.status === "failed"));
  assert.ok(report.sections.every((section) => section.body.trim().length > 0));
  assert.equal(
    report.sections.find((section) => section.section_id === "executive_summary")?.status,
    "complete"
  );
  assertContainsDisclaimer(report);
});
