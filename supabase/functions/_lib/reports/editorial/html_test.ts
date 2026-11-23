// Port of the editorial HTML parts of apps/product-api/tests/deepdive-m5-pdf-export.test.ts.
// The PDF route and the PDF bytes belong to M4 and are not tested here.
import assert from "node:assert/strict";

import { buildEditorialReportHtml, buildEditorialReportPages } from "./html.ts";
import { assertIncomingAnalysisReport } from "../validation.ts";
import { sampleInstitutionalReport } from "../testdata/editorial_institutional.ts";
import { sampleLegacyReport, sampleSparseReport } from "../testdata/editorial_sparse.ts";

function assertNoDebugLeakage(renderedText: string): void {
  assert.doesNotMatch(renderedText, /Page 1 -/);
  assert.doesNotMatch(renderedText, /Page 9 - Appendix/);
  assert.doesNotMatch(renderedText, /deterministic_dcf/);
  assert.doesNotMatch(renderedText, /quality_mega_cap/);
  assert.doesNotMatch(renderedText, /fresh_transcript_excerpt/);
  assert.doesNotMatch(renderedText, /\bfixture\b/i);
  assert.doesNotMatch(renderedText, /\bdebug\b/i);
  assert.doesNotMatch(renderedText, /\bplaceholder\b/i);
  assert.doesNotMatch(renderedText, /JSON parser/i);
  assert.doesNotMatch(renderedText, /\b[a-z]+(?:_[a-z0-9]+)+\b/);
  assert.doesNotMatch(renderedText, /\bundefined\b/i);
  assert.doesNotMatch(renderedText, /\bnull\b/i);
}

Deno.test("M5.2 editorial HTML has the institutional multi-page layout", () => {
  const reportFixture = sampleInstitutionalReport("job-1", "m5-export-report-001");
  const editorialPages = buildEditorialReportPages(reportFixture);
  const editorialHtml = buildEditorialReportHtml(reportFixture, editorialPages);

  assert.equal(editorialPages.length, 17);
  assert.deepEqual(
    editorialPages.map((page) => page.title),
    [
      "Filing Read",
      "What Changed In The Filing",
      "Good Bad Interesting",
      "Financial Indicators",
      "Benchmarks and Quality",
      "Five-Year Trend Board",
      "Investor Education",
      "Executive Summary",
      "Financial Analysis",
      "Financial Exhibits",
      "Competitive Positioning",
      "Management and Governance",
      "Risks and Challenges",
      "Growth Outlook",
      "Valuation and Stance",
      "Evidence and Omissions",
      "Appendix",
    ],
  );
  assert.match(editorialHtml, /Thesis Due Diligence Report/);
  assert.match(editorialHtml, /Apple Inc\./);
  assert.match(editorialHtml, /The Filing Read/);
  assert.match(editorialHtml, /What this means in plain English/);
  assert.match(editorialHtml, /Numbers first, explanation beside them/);
  assert.match(editorialHtml, /Good \/ Bad \/ Interesting/);
  assert.match(editorialHtml, /Financial Indicators & Value Lens/);
  assert.match(editorialHtml, /Cheap, expensive, or expensive for a reason/);
  assert.match(editorialHtml, /Five-Year Trend Board/);
  assert.match(editorialHtml, /Did the business improve, or did the multiple just expand/);
  assert.match(editorialHtml, /Decision question/);
  assert.match(editorialHtml, /Competitive Positioning/);
  assert.match(editorialHtml, /Financial statement follow-through/);
  assert.match(editorialHtml, /Management and Governance/);
  assert.match(editorialHtml, /Growth Opportunities and Outlook/);
  assert.match(editorialHtml, /Valuation and Thesis Stance/);
  assert.match(editorialHtml, /Evidence, omissions, and source discipline/);
  assert.match(editorialHtml, /Appendix And Source Notes/);
  assert.match(editorialHtml, /Installed-base loyalty/);
  assert.match(editorialHtml, /Page 17 of 17/);
  assertNoDebugLeakage(editorialHtml);
});

Deno.test("M5.2 editorial HTML renders omission-aware fallbacks for sparse reports", () => {
  const reportFixture = sampleSparseReport("job-2", "m5-export-sparse-report-001");
  const editorialPages = buildEditorialReportPages(reportFixture);
  const editorialHtml = buildEditorialReportHtml(reportFixture, editorialPages);

  assert.equal(editorialPages.length, 6);
  assert.deepEqual(
    editorialPages.map((page) => page.title),
    [
      "Executive Summary",
      "Due Diligence Overview",
      "Financial Snapshot",
      "Risks and Valuation Limits",
      "Evidence and Omissions",
      "Appendix",
    ],
  );
  assert.match(editorialHtml, /Apple Inc\./);
  assert.match(editorialHtml, /Due Diligence Overview/);
  assert.match(editorialHtml, /Coverage stays intentionally narrow/);
  assert.match(editorialHtml, /Valuation range is not available for this report/);
  assert.match(editorialHtml, /Page 6 of 6/);
  assertNoDebugLeakage(editorialHtml);
});

Deno.test("editorial HTML renders a legacy report without throwing", () => {
  const legacy = assertIncomingAnalysisReport(sampleLegacyReport("job-3", "m5-export-legacy-report-001"));
  const editorialHtml = buildEditorialReportHtml(legacy);
  assert.match(editorialHtml, /<!doctype html>/);
  assert.match(editorialHtml, /Page 1 of /);
});
