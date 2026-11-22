import assert from "node:assert/strict";
import { createServer, type Server, type ServerResponse } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";

import type { MarketPulseReport, UserResearchState } from "../../../packages/contracts/src";
import { loadConfig } from "../src/config";
import { assertPulseCopyGrounded, buildDexterPulseBrief } from "../src/pulse-brief";

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

async function startPriceMock(): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((request, response) => {
    if (!request.url?.startsWith("/v8/finance/chart/AAPL")) {
      sendJson(response, 404, { status: "not_found" });
      return;
    }
    sendJson(response, 200, {
      chart: {
        result: [
          {
            indicators: {
              quote: [
                {
                  close: [171.5, null, 174.2]
                }
              ]
            }
          }
        ]
      }
    });
  });
  server.listen(0);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function reportFixture(): MarketPulseReport {
  return {
    report_id: "pulse-1",
    schema_version: "1.0.0",
    generated_at: "2026-03-21T08:00:00.000Z",
    cycle_start: "2026-03-20T23:59:00.000Z",
    cycle_end: "2026-03-21T23:59:00.000Z",
    macro_stress: {
      as_of: "2026-03-21",
      state: "elevated",
      score: 58,
      categories: [
        { category: "rates", label: "Rates", score: 60, state: "elevated", observations: [], omissions: [] },
        { category: "inflation", label: "Inflation", score: 60, state: "elevated", observations: [], omissions: [] },
        { category: "labor", label: "Labor", score: 50, state: "watch", observations: [], omissions: [] },
        { category: "growth", label: "Growth", score: 55, state: "watch", observations: [], omissions: [] },
        { category: "energy", label: "Energy", score: 45, state: "calm", observations: [], omissions: [] }
      ],
      retrievals: [],
      omissions: []
    },
    market_tape: {
      as_of: "2026-03-21",
      coverage_state: "partial",
      summary: "Tape was higher.",
      indices: [
        {
          instrument_id: "SP500",
          label: "S&P 500",
          family: "core_index",
          period: "2026-03-21",
          value: 5287.76,
          previous_value: 5158.2,
          daily_change: 129.56,
          daily_change_pct: 2.51,
          direction: "up",
          unit: "index"
        }
      ],
      sector_leadership: { leaders: [], laggards: [] },
      cross_asset: [],
      retrievals: [],
      omissions: []
    },
    morning_edition: {
      headline_digest: [],
      portfolio_radar: [],
      market_board: [],
      today_catalysts: [],
      sector_pulse: [],
      coverage_notes: []
    },
    sections: {
      macro_stress: section("macro_stress"),
      market_tape: section("market_tape"),
      official_macro_pressure: section("official_macro_pressure"),
      bounded_context: section("bounded_context"),
      canonical_events: section("canonical_events"),
      uncertainty_flags: section("uncertainty_flags"),
      macro_releases: section("macro_releases"),
      rates_fx_commodities: section("rates_fx_commodities"),
      news_summary: section("news_summary"),
      market_moves: section("market_moves")
    },
    flags: [],
    confidence: {
      score: 0.78,
      label: "high",
      limiting_factors: []
    }
  } as unknown as MarketPulseReport;
}

function section(sectionId: string) {
  return {
    section_id: sectionId,
    title: sectionId,
    body: "Fixture section.",
    status: "complete" as const,
    evidence: []
  };
}

function userStateFixture(): UserResearchState {
  return {
    state_id: "state-1",
    user_id: "user-1",
    as_of: "2026-03-21",
    generated_at: "2026-03-21T08:10:00.000Z",
    watchlist_tickers: ["AAPL"],
    holdings: [{ ticker: "AAPL", quantity: 2, cost_basis: 170, updated_at: "2026-03-21T08:00:00.000Z" }],
    names: [],
    omissions: [],
    evidence: []
  } as unknown as UserResearchState;
}

test("Dexter Pulse brief adds price-backed portfolio rows and bounded copy", async () => {
  const priceMock = await startPriceMock();
  try {
    const config = loadConfig({
      DEXTER_FIXTURE_MODE: "true",
      DEXTER_PULSE_PRICE_BASE_URL: priceMock.baseUrl
    });
    const result = await buildDexterPulseBrief(
      {
        report: reportFixture(),
        user_id: "user-1",
        as_of: "2026-03-21",
        user_research_state: userStateFixture(),
        tickers: ["AAPL"]
      },
      config,
      "2026-03-21T08:15:00.000Z"
    );

    const row = result.report.morning_edition?.portfolio_radar[0];
    assert.equal(result.analyst, "dexter");
    assert.equal(row?.ticker, "AAPL");
    assert.equal(row?.previous_close, 171.5);
    assert.equal(row?.latest_price, 174.2);
    assert.equal(row?.evidence[0]?.source_name, "Dexter price tracker");
    assert.equal(result.report.editorial_generation?.mode, "deterministic");
    assert.match(result.report.brief_editorial?.the_read ?? "", /Risk appetite|Markets were/);
    assert.match(result.report.brief_editorial?.why_it_matters ?? "", /company-specific evidence|conviction/i);
    assert.match(result.report.brief_editorial?.smart_comment ?? "", /cleaner tape|market day/i);
  } finally {
    await closeServer(priceMock.server);
  }
});

test("Dexter Pulse brief does not fetch prices from Yahoo by default", async () => {
  const config = loadConfig({
    DEXTER_FIXTURE_MODE: "true",
    SENTIMENT_YAHOO_BASE_URL: "https://query1.finance.yahoo.com"
  });
  assert.equal(config.pulsePriceBaseUrl, undefined);

  const originalFetch = globalThis.fetch;
  const fetched: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request) => {
    fetched.push(String(url));
    throw new Error("unexpected network call");
  }) as typeof fetch;
  try {
    const report = reportFixture();
    const result = await buildDexterPulseBrief(
      {
        report,
        user_id: "user-1",
        as_of: "2026-03-21",
        user_research_state: userStateFixture(),
        tickers: ["AAPL"]
      },
      config,
      "2026-03-21T08:15:00.000Z"
    );

    assert.deepEqual(fetched, []);
    assert.deepEqual(
      result.report.morning_edition?.portfolio_radar ?? [],
      report.morning_edition?.portfolio_radar ?? []
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("LLM Pulse copy is accepted only when grounded in the report facts", () => {
  const report = reportFixture();
  const grounded = "The S&P 500 rose 2.51% to 5,287.76 on March 21, a firmer session that still needs confirmation from the rest of the tape.";
  assert.doesNotThrow(() => assertPulseCopyGrounded({ the_read: grounded, mood: "calm" }, report));

  const rejected: Array<[string, RegExp]> = [
    ["The S&P 500 rose 3.4% on March 21, a firmer session that still needs confirmation from the rest of the tape.", /number not in the fact pack/],
    ["Reuters says the S&P 500 rose 2.51% on March 21, a firmer session that still needs confirmation from the tape.", /source not in the fact pack/],
    ["The S&P 500 rose 2.51% on April 21, a firmer session that still needs confirmation from the rest of the tape.", /date not in the fact pack/],
    ["The S&P 500 rose 2.51% on March 21, driven by cooler inflation data that still needs confirmation from the tape.", /unsupported causality/]
  ];
  for (const [text, error] of rejected) {
    assert.throws(() => assertPulseCopyGrounded({ the_read: text }, report), error);
  }
});
