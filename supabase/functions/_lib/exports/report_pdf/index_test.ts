import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { buildInstitutionalPdfExport } from "./index.ts";
import { sampleInstitutionalReport } from "../../reports/testdata/editorial_institutional.ts";
import { sampleLegacyReport, sampleSparseReport } from "../../reports/testdata/editorial_sparse.ts";

// Page counts and sizes match the old buildLegacyInstitutionalPdfExport on the same fixtures
// (checked byte for byte against apps/product-api/src/report-pdf.ts when this was ported).
const cases = [
  { name: "institutional", report: sampleInstitutionalReport("job-1", "rep-1"), pages: 10, bytes: 64205 },
  { name: "sparse", report: sampleSparseReport("job-2", "rep-2"), pages: 6, bytes: 34703 },
  { name: "legacy", report: sampleLegacyReport("job-3", "rep-3"), pages: 6, bytes: 30687 },
];

for (const c of cases) {
  Deno.test(`report PDF (${c.name}) renders like the old writer`, () => {
    const started = performance.now();
    const pdf = buildInstitutionalPdfExport(c.report);
    const ms = performance.now() - started;
    const text = new TextDecoder().decode(pdf.buffer);
    assert(text.startsWith("%PDF-1.4\n"));
    assert(text.endsWith("%%EOF"));
    assertEquals(pdf.pageCount, c.pages);
    assertEquals(pdf.buffer.byteLength, c.bytes);
    assert(ms < 500, `render took ${ms} ms`);
  });
}
