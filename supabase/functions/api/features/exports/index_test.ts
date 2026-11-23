import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { Router } from "../../router.ts";
import { type ExportsDeps, exportsRoutes, pgExportsDeps } from "./index.ts";
import type { ReportRecord } from "../../../_lib/reports/types.ts";
import { sampleInstitutionalReport } from "../../../_lib/reports/testdata/editorial_institutional.ts";
import { createPulseReport, createResearchState } from "../../../_lib/exports/pulse/testdata.ts";

function record(id: string, type: ReportRecord["type"], artifactKey: string): ReportRecord {
  return {
    id,
    jobId: `job-${id}`,
    type,
    schemaVersion: "1",
    artifactKey,
    createdAt: "2026-11-23T00:00:00Z",
    isCurrent: true,
  };
}

function setup(opts: { tier?: "FREE" | "PRO"; access?: boolean; researchState?: boolean } = {}) {
  const deepDive = sampleInstitutionalReport("job-r1", "r1");
  const pulse = createPulseReport();
  const pulseDate = String(pulse.cycle_end).slice(0, 10);
  const objects: Record<string, unknown> = { "deep_dive/r1.json": deepDive, "market_pulse/p1.json": pulse };
  const audits: string[] = [];
  const issuer = {
    getSupportedTicker: () => Promise.resolve(undefined),
    fetchStructuralContext: () => Promise.resolve(undefined),
  };
  const deps: ExportsDeps = {
    reports: {
      getReportById: (id) =>
        Promise.resolve(id === "r1" ? record("r1", "deep_dive", "deep_dive/r1.json") : undefined),
      hasReportAccessForUser: () => Promise.resolve(opts.access ?? true),
      readArtifact: (key) => Promise.resolve(objects[key]),
      issuer,
      audit: (type) => {
        audits.push(type);
        return Promise.resolve();
      },
      rateLimit: () => Promise.resolve(null),
    },
    pulse: {
      getLatestReportByType: () => Promise.resolve(record("p1", "market_pulse", "market_pulse/p1.json")),
      getReportByTypeAndDate: (_t, date) =>
        Promise.resolve(
          date === pulseDate ? record("p1", "market_pulse", "market_pulse/p1.json") : undefined,
        ),
      getLatestUserResearchState: () =>
        Promise.resolve(
          opts.researchState ? { stateId: "rs-1", state: createResearchState() } as never : undefined,
        ),
      readArtifact: (key) => Promise.resolve(objects[key]),
      rateLimit: () => Promise.resolve(null),
    },
    tier: () => Promise.resolve(opts.tier ?? "PRO"),
    renderReport: pgExportsDeps.renderReport,
    renderPulse: pgExportsDeps.renderPulse,
  };
  return { deps, audits, pulseDate };
}

async function get(deps: ExportsDeps, path: string) {
  const router = new Router([{ name: "exports", owner: "M4", routes: exportsRoutes(deps) }]);
  const found = router.match("GET", path);
  if (found.kind !== "found") throw new Error(`no route ${path}`);
  const req = new Request(`http://test${path}`);
  return await found.route.handler({
    req,
    url: new URL(req.url),
    path,
    params: found.params,
    auth: { mode: "user", userId: "user-1", accessToken: "t" },
  });
}

async function pdfText(res: Response): Promise<string> {
  return new TextDecoder().decode(new Uint8Array(await res.arrayBuffer()));
}

Deno.test("report PDF: Pro user gets a PDF attachment", async () => {
  const { deps, audits } = setup();
  const res = await get(deps, "/v1/reports/r1/export/pdf");
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("content-type"), "application/pdf");
  assert(
    /^attachment; filename="thesis-deep-dive-[A-Z]+-r1\.pdf"$/.test(res.headers.get("content-disposition")!),
  );
  const text = await pdfText(res);
  assert(text.startsWith("%PDF-1.4"));
  assert(text.endsWith("%%EOF"));
  assertEquals(audits, ["report.exported_pdf"]);
});

Deno.test("report PDF: Free is 403 report_export, no access or unknown is 404", async () => {
  const free = await get(setup({ tier: "FREE" }).deps, "/v1/reports/r1/export/pdf");
  assertEquals(free.status, 403);
  assertEquals(await free.json(), {
    error: "upgrade_required",
    feature: "report_export",
    error_message: "PDF export is available on the Pro tier.",
  });
  assertEquals((await get(setup({ access: false }).deps, "/v1/reports/r1/export/pdf")).status, 404);
  const missing = await get(setup().deps, "/v1/reports/nope/export/pdf");
  assertEquals(missing.status, 404);
  assertEquals((await missing.json()).error, "report_not_found");
});

Deno.test("pulse PDF: latest and by date, private headers, Free users allowed", async () => {
  const { deps, audits, pulseDate } = setup({ tier: "FREE", researchState: true });
  for (const path of ["/pulse/latest/export/pdf", `/pulse/${pulseDate}/export/pdf`]) {
    const res = await get(deps, path);
    assertEquals(res.status, 200, path);
    assertEquals(res.headers.get("content-type"), "application/pdf");
    assertEquals(res.headers.get("cache-control"), "private, no-store");
    assertEquals(res.headers.get("vary"), "Authorization");
    assert(
      res.headers.get("content-disposition")!.startsWith(`attachment; filename="thesis-pulse-${pulseDate}-`),
    );
    assert((await pdfText(res)).startsWith("%PDF-1.4"));
  }
  assertEquals(audits, ["pulse.report_exported_pdf", "pulse.report_exported_pdf"]);
});

Deno.test("pulse PDF: bad date 422, unknown date 404", async () => {
  const { deps } = setup();
  const bad = await get(deps, "/pulse/23-11-2026/export/pdf");
  assertEquals(bad.status, 422);
  assertEquals((await bad.json()).error, "validation_failed");
  const none = await get(deps, "/pulse/2001-01-01/export/pdf");
  assertEquals(none.status, 404);
  assertEquals((await none.json()).error, "report_not_found");
});

Deno.test("export routes need a signed-in user", () => {
  assertEquals(exportsRoutes(setup().deps).map((r) => r.auth), ["user", "user", "user"]);
});
