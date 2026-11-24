import assert from "node:assert/strict";
import test from "node:test";

import type { AnalysisRequest } from "../../../../packages/contracts/src";

import { loadConfig } from "../../src/config";
import type { FactPack } from "../../src/fact-pack/types";
import { runAnalysisPipeline } from "../../src/pipeline";
import { validateAnalysisReport } from "../../src/schema-validation";
import { CIK, FAST, SEC, acmeFacts, acmeSubmissions, fakeSec } from "./sec-samples";

function request(ticker: string): AnalysisRequest {
  return {
    request_id: `req-${ticker.toLowerCase()}`,
    type: "deep_dive",
    ticker,
    job_id: `job-${ticker.toLowerCase()}`,
    requested_at: "2026-03-15T12:00:00.000Z",
    options: {}
  };
}

// The fixture run for MSFT, with SEC answering from the Acme samples under MSFT's ticker.
const routes = {
  [SEC.tickers]: { "0": { cik_str: 320193, ticker: "MSFT", title: "Acme Devices Inc." } },
  [SEC.facts(CIK)]: acmeFacts(),
  [SEC.submissions(CIK)]: acmeSubmissions()
};

test("fixture run attaches report.fact_pack, schema 2.1, and posts the rows to the ingest route", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-03-15T12:00:00.000Z") });
  const config = loadConfig({
    ...process.env,
    DEXTER_FIXTURE_MODE: "true",
    DEXTER_FACT_PACK: "on",
    THESIS_API_URL: "https://api.example.test/functions/v1/api",
    THESIS_INTERNAL_TOKEN: "runner-token"
  });
  const posted: Array<{ url: string; body: { ticker: string; latest_period: string; snapshots: unknown[] } }> = [];
  const report = await runAnalysisPipeline(request("MSFT"), config, {
    factPack: {
      secFetch: fakeSec(routes).fetch,
      build: { clientOptions: FAST },
      ingestFetch: (url, init) => {
        posted.push({ url, body: JSON.parse(String(init?.body)) });
        return Promise.resolve(new Response('{"status":"ok"}', { status: 200 }));
      }
    }
  });

  assert.equal(report.schema_version, "2.1");
  assert.deepEqual(validateAnalysisReport(report), []);
  const pack = (report as typeof report & { fact_pack?: FactPack }).fact_pack;
  assert.ok(pack);
  assert.equal(pack.ticker, "MSFT");
  assert.equal(pack.latest_filing?.period_label, "2025-Q1");
  assert.equal(pack.annual.length, 4);
  assert.equal(posted.length, 1);
  assert.equal(posted[0]?.url, "https://api.example.test/functions/v1/api/internal/financials/ingest");
  assert.equal(posted[0]?.body.ticker, "MSFT");
  assert.equal(posted[0]?.body.latest_period, "2025-Q1");
  assert.equal(posted[0]?.body.snapshots.length, 4);
});

test("an SEC failure leaves no fact_pack and the run still completes", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-03-15T12:00:00.000Z") });
  const config = loadConfig({ ...process.env, DEXTER_FIXTURE_MODE: "true", DEXTER_FACT_PACK: "on" });
  let ingests = 0;
  const report = await runAnalysisPipeline(request("MSFT"), config, {
    factPack: {
      secFetch: fakeSec({ [SEC.tickers]: 503 }).fetch,
      build: { clientOptions: FAST },
      ingestFetch: () => {
        ingests += 1;
        return Promise.resolve(new Response("{}", { status: 200 }));
      }
    }
  });
  assert.equal(report.schema_version, "2.1");
  assert.equal("fact_pack" in report, false);
  assert.deepEqual(validateAnalysisReport(report), []);
  assert.equal(ingests, 0);
});
