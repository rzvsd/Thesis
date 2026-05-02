import assert from "node:assert/strict";
import test from "node:test";

import type { MarketPulseReport } from "../../../packages/contracts/src";
import { applyPulseBriefLlmEditorial, validatePulseBriefLlmDraft } from "../src/pulse-brief-editor";
import { buildPulseBriefPlan } from "../src/pulse-brief-plan";

const retrieval = {
  source: {
    source_id: "FRED_SP500",
    source_family: "fred" as const,
    source_name: "FRED S&P 500",
    source_url: "https://fred.stlouisfed.org/series/SP500",
    agency: "Federal Reserve Bank of St. Louis",
    agency_series_id: "SP500"
  },
  retrieved_at: "2026-05-01T08:00:00.000Z",
  retrieval_status: "fresh" as const,
  source_period: "2026-05-01"
};

function section(section_id: string, body = `${section_id} body`) {
  return {
    section_id,
    title: section_id,
    body,
    status: "complete" as const,
    evidence: []
  };
}

function report(): MarketPulseReport {
  return {
    report_id: "pulse-brief-test",
    schema_version: "1.0.0",
    generated_at: "2026-05-01T08:00:00.000Z",
    cycle_start: "2026-04-30T08:00:00.000Z",
    cycle_end: "2026-05-01T08:00:00.000Z",
    macro_stress: {
      snapshot_id: "macro-1",
      as_of: "2026-05-01",
      generated_at: "2026-05-01T08:00:00.000Z",
      state: "elevated",
      summary: "Macro pressure is elevated.",
      no_material_change: false,
      inputs: [],
      omissions: []
    },
    market_tape: {
      as_of: "2026-05-01",
      coverage_state: "full",
      summary: "The reviewed tape was higher.",
      indices: [
        {
          instrument_id: "SP500",
          label: "S&P 500",
          family: "core_index",
          period: "2026-05-01",
          value: 5200,
          previous_value: 5150,
          daily_change: 50,
          daily_change_pct: 0.97,
          direction: "up",
          retrieval,
          missing_fields: []
        },
        {
          instrument_id: "NASDAQCOM",
          label: "Nasdaq Composite",
          family: "core_index",
          period: "2026-05-01",
          value: 16000,
          previous_value: 15750,
          daily_change: 250,
          daily_change_pct: 1.59,
          direction: "up",
          retrieval,
          missing_fields: []
        },
        {
          instrument_id: "DJIA",
          label: "Dow Jones Industrial Average",
          family: "core_index",
          period: "2026-05-01",
          value: 39000,
          previous_value: 38850,
          daily_change: 150,
          daily_change_pct: 0.39,
          direction: "up",
          retrieval,
          missing_fields: []
        }
      ],
      cross_asset: [
        {
          instrument_id: "VIXCLS",
          label: "VIX",
          family: "volatility",
          period: "2026-05-01",
          value: 18,
          previous_value: 19.2,
          daily_change: -1.2,
          daily_change_pct: -6.25,
          direction: "down",
          retrieval,
          missing_fields: []
        }
      ],
      retrievals: [retrieval],
      omissions: []
    },
    editorial_issue: {
      issue_id: "issue-1",
      headline: "Deterministic issue",
      dek: "Brief.",
      lead: "Deterministic lead.",
      prior_cycle_end: "2026-04-30T08:00:00.000Z",
      freshness_state: "updated",
      in_this_issue: [],
      what_changed: [
        {
          kind: "market_tape",
          title: "Tape",
          body: "Tape moved from mixed to higher.",
          freshness_state: "updated",
          importance: "high",
          evidence: []
        }
      ],
      why_it_matters: [],
      what_to_watch: [],
      signal_vs_noise: [],
      coverage_notes: [],
      evidence: []
    },
    morning_edition: {
      headline_digest: [],
      portfolio_radar: [
        {
          ticker: "AAPL",
          company_name: "Apple Inc.",
          change_pct: 1.2,
          direction: "up",
          reason: "Moved with tech leadership. No new company-specific evidence.",
          evidence: []
        }
      ],
      market_board: [],
      today_catalysts: [],
      sector_pulse: [],
      coverage_notes: []
    },
    sections: {
      macro_stress: section("macro_stress"),
      market_tape: section("market_tape"),
      official_macro_pressure: section("official_macro_pressure"),
      canonical_events: section("canonical_events"),
      bounded_context: section("bounded_context"),
      uncertainty_flags: section("uncertainty_flags")
    },
    flags: [],
    confidence: {
      score: 0.8,
      label: "high",
      limiting_factors: []
    }
  };
}

test("buildPulseBriefPlan classifies a useful normal/event brief without newspaper fields", () => {
  const plan = buildPulseBriefPlan(report());

  assert.equal(plan.fact_pack.tape.breadth, "higher");
  assert.equal(plan.fact_pack.mode, "event");
  assert.match(plan.copy.morning_line, /threshold|front|risk|attention/i);
  assert.ok(plan.copy.morning_line.split(/\s+/).length <= 22);
  assert.ok(plan.copy.interesting_bit.split(/\s+/).length <= 55);
});

test("validatePulseBriefLlmDraft accepts the locked six-field contract", () => {
  const validated = validatePulseBriefLlmDraft({
    morning_line: "Risk appetite improved, but confirmation still matters.",
    yesterday_comment: "The board was higher while volatility cooled alongside the move.",
    interesting_bit: "The useful part is that the tape improved without asking macro to do more work.",
    your_names_comment: "Your tracked names mostly followed the broader tape.",
    signal: "Risk appetite broadened.",
    noise: "One session is not a regime shift."
  }, report());

  assert.equal(validated.signal, "Risk appetite broadened.");
});

test("validatePulseBriefLlmDraft rejects unsupported ticker, causality, and trading language", () => {
  assert.throws(() => validatePulseBriefLlmDraft({
    morning_line: "NVDA led the move.",
    yesterday_comment: "The board was higher.",
    interesting_bit: "The tape improved.",
    signal: "Risk improved.",
    noise: "One session is noise."
  }, report()), /unsupported ticker/i);

  assert.throws(() => validatePulseBriefLlmDraft({
    morning_line: "Risk improved because yields fell.",
    yesterday_comment: "The board was higher.",
    interesting_bit: "The tape improved.",
    signal: "Risk improved.",
    noise: "One session is noise."
  }, report()), /causality/i);

  assert.throws(() => validatePulseBriefLlmDraft({
    morning_line: "Buy the dip today.",
    yesterday_comment: "The board was higher.",
    interesting_bit: "The tape improved.",
    signal: "Risk improved.",
    noise: "One session is noise."
  }, report()), /trading advice/i);
});

test("applyPulseBriefLlmEditorial stores only bounded brief copy", async () => {
  const result = await applyPulseBriefLlmEditorial(report(), {
    config: {
      enabled: true,
      apiKey: "test-key",
      baseUrl: "https://openrouter.test/api/v1",
      model: "openai/gpt-5.4-mini",
      timeoutMs: 1000,
      maxTokens: 300,
      promptVersion: "brief-test"
    },
    now: () => "2026-05-01T08:01:00.000Z",
    fetchImpl: async () => new Response(JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              morning_line: "Risk appetite improved, but confirmation still matters.",
              yesterday_comment: "The board was higher while volatility cooled alongside the move.",
              interesting_bit: "The useful part is that the tape improved without asking macro to do more work.",
              your_names_comment: "Your tracked names mostly followed the broader tape.",
              signal: "Risk appetite broadened.",
              noise: "One session is not a regime shift."
            })
          }
        }
      ]
    })) as Response
  });

  assert.equal(result.editorial_generation?.status, "generated");
  assert.equal(result.brief_editorial?.signal, "Risk appetite broadened.");
  assert.equal(result.editorial_issue?.headline, "Deterministic issue");
});
