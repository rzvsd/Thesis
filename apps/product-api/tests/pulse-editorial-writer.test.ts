import assert from "node:assert/strict";
import test from "node:test";

import type { MarketPulseReport } from "../../../packages/contracts/src";
import { applyPulseLlmEditorial } from "../src/pulse-editorial-writer";

function section(section_id: string, title: string) {
  return {
    section_id,
    title,
    body: `${title} deterministic body.`,
    status: "complete" as const,
    evidence: [
      {
        evidence_id: `${section_id}-evidence`,
        source_type: "financial_data" as const,
        source_name: "Fixture Source",
        excerpt: `${title} evidence.`,
        retrieved_at: "2026-04-27T08:00:00.000Z"
      }
    ]
  };
}

const retrieval = {
  source: {
    source_id: "fixture",
    source_family: "fred" as const,
    source_name: "Fixture Source",
    source_url: "https://example.com",
    agency: "FRED"
  },
  retrieved_at: "2026-04-27T08:00:00.000Z",
  retrieval_status: "fresh" as const
};

function fixture(): MarketPulseReport {
  return {
    report_id: "pulse-llm-1",
    schema_version: "1.0.0",
    generated_at: "2026-04-27T08:00:00.000Z",
    cycle_start: "2026-04-26T08:00:00.000Z",
    cycle_end: "2026-04-27T08:00:00.000Z",
    macro_stress: {
      snapshot_id: "macro-1",
      as_of: "2026-04-27",
      generated_at: "2026-04-27T08:00:00.000Z",
      state: "mixed",
      summary: "Macro pressure is mixed.",
      no_material_change: false,
      inputs: [
        {
          registry_id: "rates-10y",
          label: "10Y Treasury",
          category: "rates",
          pressure: "medium",
          source_state: "official",
          reason: "Rates remain relevant."
        }
      ],
      omissions: []
    },
    market_tape: {
      as_of: "2026-04-27",
      coverage_state: "full",
      summary: "The reviewed tape was mixed.",
      indices: [
        {
          instrument_id: "SPX",
          label: "S&P 500",
          family: "core_index",
          period: "2026-04-27",
          value: 5245,
          previous_value: 5220,
          daily_change: 25,
          daily_change_pct: 0.48,
          direction: "up",
          retrieval,
          missing_fields: []
        }
      ],
      sector_leadership: {
        basket_id: "spdr-sector-basket",
        leaders: [],
        laggards: [],
        spread_pct: 0,
        notable: false
      },
      cross_asset: [],
      retrievals: [],
      omissions: []
    },
    editorial_issue: {
      issue_id: "editorial-1",
      headline: "DETERMINISTIC HEADLINE",
      dek: "Deterministic dek.",
      lead: "Deterministic lead paragraph for the issue.",
      freshness_state: "baseline",
      in_this_issue: ["Lead Story", "What Changed"],
      what_changed: [
        {
          kind: "market_tape",
          title: "Tape",
          body: "Deterministic what changed.",
          freshness_state: "baseline",
          importance: "medium",
          evidence: section("market_tape", "Market Tape").evidence
        }
      ],
      why_it_matters: [
        {
          kind: "macro",
          title: "Macro",
          body: "Deterministic why it matters.",
          freshness_state: "baseline",
          importance: "medium",
          evidence: section("official_macro_pressure", "Official Macro Pressure").evidence
        }
      ],
      what_to_watch: [
        {
          kind: "calendar",
          title: "Watch",
          body: "Deterministic what to watch.",
          freshness_state: "baseline",
          importance: "medium",
          evidence: section("what_to_watch", "What To Watch").evidence
        }
      ],
      signal_vs_noise: [
        {
          kind: "context",
          title: "Noise",
          body: "Deterministic signal versus noise.",
          freshness_state: "baseline",
          importance: "medium",
          evidence: section("signal_vs_noise", "Signal vs Noise").evidence
        }
      ],
      coverage_notes: [],
      evidence: section("market_tape", "Market Tape").evidence
    },
    user_research_state: {
      state_id: "state-1",
      user_id: "user-1",
      as_of: "2026-04-27",
      generated_at: "2026-04-27T08:00:00.000Z",
      watchlist_tickers: ["AAPL"],
      holdings: [],
      names: [
        {
          ticker: "AAPL",
          company_name: "Apple Inc.",
          in_watchlist: true,
          daily_delta: {
            state: "unchanged",
            title: "No change",
            body: "AAPL has no material research-state change.",
            evidence_refs: []
          },
          summary: "AAPL remains tracked.",
          what_changed: "No material change.",
          why_it_matters: "It remains relevant to the user.",
          what_to_watch: "Watch filings.",
          evidence_refs: [],
          omissions: []
        }
      ],
      omissions: [],
      evidence_refs: []
    },
    sections: {
      macro_stress: section("macro_stress", "Macro Stress"),
      market_tape: section("market_tape", "Market Tape"),
      official_macro_pressure: section("official_macro_pressure", "Official Macro Pressure"),
      canonical_events: section("canonical_events", "Canonical Events"),
      bounded_context: section("bounded_context", "Bounded Context"),
      uncertainty_flags: section("uncertainty_flags", "Uncertainty Flags"),
      what_changed: section("what_changed", "What Changed"),
      why_it_matters: section("why_it_matters", "Why It Matters"),
      what_to_watch: section("what_to_watch", "What To Watch"),
      signal_vs_noise: section("signal_vs_noise", "Signal vs Noise")
    },
    flags: [],
    confidence: {
      score: 0.82,
      label: "high",
      limiting_factors: []
    }
  };
}

function config(overrides: Partial<Parameters<typeof applyPulseLlmEditorial>[1]["config"]> = {}) {
  return {
    enabled: true,
    apiKey: "test-key",
    baseUrl: "https://openrouter.test/api/v1",
    model: "openai/gpt-5.4-mini",
    timeoutMs: 1000,
    maxTokens: 600,
    promptVersion: "test-prompt",
    ...overrides
  };
}

function markAsChanged(report: MarketPulseReport): MarketPulseReport {
  report.editorial_issue!.what_changed[0]!.freshness_state = "updated";
  report.editorial_issue!.what_changed[0]!.body = "The reviewed market tape moved from mixed to higher.";
  return report;
}

function responseWithDraft(override: Partial<Record<string, string>> = {}): Response {
  return new Response(JSON.stringify({
    choices: [
      {
        message: {
          content: JSON.stringify({
            headline: "TAPE FIRMS AS MACRO STAYS MIXED",
            lede: "The tape improved at the margin while macro pressure stayed mixed. AAPL remains part of the user's research state. The issue stays selective.",
            what_changed: "The main change is a firmer S&P 500 read inside a still mixed macro frame.",
            signal: "The reviewed tape improved.",
            noise: "One day is not a regime shift.",
            backdrop: "Macro regime remains mixed.",
            your_names_summary: "AAPL remains tracked without a research-state change.",
            ...override
          })
        }
      }
    ]
  })) as Response;
}

test("LLM editorial writer applies valid bounded output", async () => {
  const report = markAsChanged(fixture());
  const result = await applyPulseLlmEditorial(report, {
    config: config(),
    now: () => "2026-04-27T08:01:00.000Z",
    fetchImpl: async () => responseWithDraft()
  });

  assert.equal(result.editorial_generation?.status, "generated");
  assert.equal(result.editorial_generation?.provider, "openrouter");
  assert.match(result.editorial_issue?.lead ?? "", /tape improved/i);
  assert.match(result.sections.what_changed?.body ?? "", /firmer S&P 500/);
  assert.match(result.sections.signal_vs_noise?.body ?? "", /Signal:/);
});

test("LLM editorial writer falls back when disabled or missing key", async () => {
  const report = fixture();
  const disabled = await applyPulseLlmEditorial(report, {
    config: config({ enabled: false })
  });
  const missingKey = await applyPulseLlmEditorial(report, {
    config: config({ apiKey: undefined })
  });

  assert.equal(disabled.editorial_generation, undefined);
  assert.equal(missingKey.editorial_generation, undefined);
  assert.equal(disabled.editorial_issue?.headline, "QUIET DAY. NO MATERIAL CHANGE.");
  assert.equal(missingKey.editorial_issue?.headline, "QUIET DAY. NO MATERIAL CHANGE.");
});

test("LLM editorial writer rejects malformed JSON and trading language", async () => {
  const malformedReport = markAsChanged(fixture());
  const tradingReport = markAsChanged(fixture());

  const malformed = await applyPulseLlmEditorial(malformedReport, {
    config: config(),
    fetchImpl: async () =>
      new Response(JSON.stringify({
        choices: [{ message: { content: "not-json" } }]
      })) as Response
  });
  const trading = await applyPulseLlmEditorial(tradingReport, {
    config: config(),
    fetchImpl: async () =>
      new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                headline: "Buy AAPL because the tape is better",
                lede: "Buy AAPL now because the tape improved.",
                what_changed: "AAPL changed.",
                signal: "Buy now.",
                noise: "Ignore risk.",
                backdrop: "Macro is mixed."
              })
            }
          }
        ]
      })) as Response
  });

  assert.equal(malformed.editorial_generation, undefined);
  assert.equal(trading.editorial_generation, undefined);
  assert.equal(malformed.editorial_issue?.headline, "DETERMINISTIC HEADLINE");
  assert.equal(trading.editorial_issue?.headline, "DETERMINISTIC HEADLINE");
});

test("LLM editorial writer rejects unsupported ticker formats", async () => {
  for (const phrase of ["NVDA led the move.", "$NVDA led the move.", "(NVDA) led the move."]) {
    const report = markAsChanged(fixture());
    const result = await applyPulseLlmEditorial(report, {
      config: config(),
      fetchImpl: async () => responseWithDraft({ signal: phrase })
    });

    assert.equal(result.editorial_generation, undefined);
    assert.equal(result.editorial_issue?.headline, "DETERMINISTIC HEADLINE");
  }
});

test("LLM editorial writer allows macro acronyms such as VIX", async () => {
  const report = markAsChanged(fixture());
  const result = await applyPulseLlmEditorial(report, {
    config: config(),
    fetchImpl: async () => responseWithDraft({ signal: "VIX eased." })
  });

  assert.equal(result.editorial_generation?.status, "generated");
  assert.equal(result.sections.signal_vs_noise?.body.includes("VIX eased."), true);
});

test("LLM editorial writer logs structured rejection reason without raw model text", async () => {
  const report = markAsChanged(fixture());
  const lines: string[] = [];
  const originalLog = console.log;
  console.log = (message?: unknown): void => {
    lines.push(String(message));
  };
  try {
    await applyPulseLlmEditorial(report, {
      config: config(),
      fetchImpl: async () => responseWithDraft({ signal: "NVDA led the move." })
    });
  } finally {
    console.log = originalLog;
  }

  assert.equal(lines.length, 1);
  const event = JSON.parse(lines[0]!) as Record<string, unknown>;
  assert.equal(event.level, "WARN");
  assert.equal(event.message, "Pulse LLM editorial pass rejected; deterministic report retained");
  assert.equal(event.reason_category, "unknown_ticker");
  assert.equal(event.report_id, "pulse-llm-1");
  assert.equal(lines[0]!.includes("NVDA led the move"), false);
});
