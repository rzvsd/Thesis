// The shared Deep Dive page helpers: loading rules and the render/fallback choice.
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { memoryArtifactReader } from "./artifacts.ts";
import { loadDeepDive, renderDeepDivePage } from "./deep_dive_page.ts";
import { READER_CSP, READER_V2_CSP, readerHtml } from "./share_reader.ts";
import { sampleInstitutionalReport } from "./testdata/editorial_institutional.ts";
import type { AnalysisReport, ReportRecord } from "./types.ts";

const RECORD: ReportRecord = {
  id: "r-1",
  jobId: "job-1",
  type: "deep_dive",
  ticker: "AAPL",
  schemaVersion: "2.0",
  artifactKey: "deep_dive/r-1.json",
  createdAt: "2026-03-30T09:31:00.000Z",
  isCurrent: true,
};

const issuer = {
  getSupportedTicker: () => Promise.resolve({ companyName: "Apple Inc.", exchange: "NASDAQ" }),
  fetchStructuralContext: () => Promise.resolve(undefined),
};

Deno.test("loadDeepDive: deep_dive rows with a valid artifact only; read errors count as missing", async () => {
  const good = memoryArtifactReader({ [RECORD.artifactKey]: sampleInstitutionalReport("job-1", "r-1") });
  assertEquals((await loadDeepDive(good, RECORD))?.report_id, "r-1");
  assertEquals(await loadDeepDive(good, undefined), undefined);
  assertEquals(await loadDeepDive(good, { ...RECORD, type: "market_pulse" }), undefined);
  assertEquals(await loadDeepDive(memoryArtifactReader({}), RECORD), undefined);
  const bad = memoryArtifactReader({ [RECORD.artifactKey]: { report_id: "r-1", type: "deep_dive" } });
  assertEquals(await loadDeepDive(bad, RECORD), undefined);
  assertEquals(await loadDeepDive(() => Promise.reject(new Error("storage down")), RECORD), undefined);
});

Deno.test("renderDeepDivePage: v2 under READER_V2_CSP, editorial under READER_CSP when v2 throws", async () => {
  const report = sampleInstitutionalReport("job-1", "r-1") as unknown as AnalysisReport;
  const read = () => Promise.resolve(undefined);
  const v2 = await renderDeepDivePage({ readArtifact: read, issuer }, "r-1", report, {
    downloadUrl: "https://d",
  });
  assertEquals([v2.csp, v2.fallback], [READER_V2_CSP, false]);
  assertStringIncludes(v2.body, "<title>Apple Inc. Deep Dive</title>");

  const throwing = {
    readArtifact: read,
    issuer,
    renderV2: () => {
      throw new Error("boom");
    },
  };
  const orig = console.error;
  console.error = () => {};
  try {
    const fb = await renderDeepDivePage(throwing, "r-1", report, { downloadUrl: "https://d" });
    assertEquals([fb.csp, fb.fallback], [READER_CSP, true]);
    assertStringIncludes(fb.body, '<a href="https://d"');
    const fbEmbed = await renderDeepDivePage(throwing, "r-1", report, {
      downloadUrl: "https://d",
      embed: true,
    });
    assertEquals(fbEmbed.body.includes("https://d"), false);
    assertEquals(fbEmbed.body.includes("Get the Thesis app"), false);
  } finally {
    console.error = orig;
  }
});

Deno.test("readerHtml: a null download link leaves only the notice in the banner", () => {
  const page = "<html><head></head><body><p>x</p></body></html>";
  assertStringIncludes(readerHtml(page, "https://d"), "Get the Thesis app");
  const embed = readerHtml(page, null);
  assertEquals(embed.includes("Get the Thesis app"), false);
  assertStringIncludes(embed, "Thesis is research, not financial advice.");
});
