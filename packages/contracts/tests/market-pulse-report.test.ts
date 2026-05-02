import assert from "node:assert/strict";
import test from "node:test";

import type { MarketPulseReport } from "../src/market-pulse-report";
import { marketPulseReportSchema } from "../src/market-pulse-report";

type JsonSchema = {
  type?: string;
  enum?: readonly unknown[];
  required?: readonly string[];
  properties?: Record<string, JsonSchema>;
  additionalProperties?: boolean;
  items?: JsonSchema;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateWithSchema(value: unknown, schema: JsonSchema, path: string, errors: string[]): void {
  if (schema.type === "string" && typeof value !== "string") {
    errors.push(`${path} must be a string`);
    return;
  }
  if (schema.type === "number" && typeof value !== "number") {
    errors.push(`${path} must be a number`);
    return;
  }
  if (schema.type === "boolean" && typeof value !== "boolean") {
    errors.push(`${path} must be a boolean`);
    return;
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path} must be one of: ${schema.enum.join(", ")}`);
    return;
  }
  if (schema.type === "array") {
    if (!Array.isArray(value)) {
      errors.push(`${path} must be an array`);
      return;
    }
    if (schema.items) {
      value.forEach((entry, index) => validateWithSchema(entry, schema.items as JsonSchema, `${path}[${index}]`, errors));
    }
    return;
  }
  if (schema.type === "object" || schema.properties || schema.required) {
    if (!isObject(value)) {
      errors.push(`${path} must be an object`);
      return;
    }
    for (const key of schema.required ?? []) {
      if (value[key] === undefined) {
        errors.push(`${path}.${key} is required`);
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in (schema.properties ?? {}))) {
          errors.push(`${path}.${key} is not allowed`);
        }
      }
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (value[key] !== undefined) {
        validateWithSchema(value[key], child, `${path}.${key}`, errors);
      }
    }
  }
}

function schemaErrors(report: MarketPulseReport): string[] {
  const errors: string[] = [];
  validateWithSchema(report, marketPulseReportSchema as JsonSchema, "report", errors);
  return errors;
}

function reportSection(section_id: string, title: string) {
  return {
    section_id,
    title,
    body: `${title} body.`,
    status: "complete" as const,
    evidence: []
  };
}

function fixture(): MarketPulseReport {
  return {
    report_id: "pulse-1",
    schema_version: "1.0.0",
    generated_at: "2026-04-26T08:00:00.000Z",
    cycle_start: "2026-04-25T08:00:00.000Z",
    cycle_end: "2026-04-26T08:00:00.000Z",
    macro_stress: {
      snapshot_id: "macro-1",
      as_of: "2026-04-26",
      generated_at: "2026-04-26T08:00:00.000Z",
      state: "mixed",
      summary: "Macro signals were mixed.",
      no_material_change: false,
      inputs: [],
      omissions: []
    },
    editorial_issue: {
      issue_id: "pulse-editorial-1",
      headline: "MARKET TAPE KEEPS CONVICTION SELECTIVE",
      dek: "The reviewed tape is mixed.",
      lead: "Good morning. This is the baseline editorial issue.",
      freshness_state: "baseline",
      in_this_issue: ["Lead Story / Market Tape", "What Changed", "What To Watch"],
      what_changed: [
        {
          kind: "market_tape",
          title: "Baseline established",
          body: "Daily deltas start from this issue.",
          freshness_state: "baseline",
          importance: "medium",
          evidence: []
        }
      ],
      why_it_matters: [],
      what_to_watch: [
        {
          kind: "calendar",
          title: "AAPL earnings",
          body: "AAPL has an earnings event in the next week.",
          watch_date: "2026-04-29",
          freshness_state: "new",
          importance: "medium",
          evidence: []
        }
      ],
      signal_vs_noise: [],
      coverage_notes: [],
      evidence: []
    },
    brief_editorial: {
      morning_line: "Risk appetite improved, but confirmation still matters.",
      yesterday_comment: "The board was higher while volatility cooled alongside the move.",
      interesting_bit: "The useful part is that the tape improved without asking macro to do more work.",
      your_names_comment: "Your tracked names mostly followed the broader tape.",
      signal: "Risk appetite broadened.",
      noise: "One session is not a regime shift."
    },
    editorial_generation: {
      mode: "llm",
      status: "generated",
      provider: "openrouter",
      model: "openai/gpt-5.4-mini",
      prompt_version: "ph7-m6-pulse-editorial-v1",
      generated_at: "2026-04-26T08:01:00.000Z",
      source_report_id: "pulse-1",
      coverage_notes: [
        "LLM editorial pass rewrote narrative only; deterministic Pulse data remains authoritative."
      ]
    },
    macro_news: {
      as_of: "2026-04-26",
      state: "shock",
      lead: "A corroborated geopolitical shock is present in approved headlines.",
      items: [
        {
          headline: "Reports say China has attacked Taiwan",
          source_name: "Approved Macro Wire",
          source_url: "https://example.com/taiwan",
          published_at: "2026-04-26T07:00:00.000Z",
          topic: "war_conflict",
          severity: "shock",
          confirmation_state: "corroborated",
          corroboration_count: 2,
          affected_regions: ["Taiwan", "China", "United States"],
          affected_assets: ["semiconductors", "rates", "volatility"],
          why_it_matters: "A conflict shock can alter supply-chain, risk, and macro assumptions.",
          evidence: []
        }
      ],
      omissions: [],
      coverage_notes: []
    },
    morning_edition: {
      headline_digest: [
        {
          headline: "Investors weigh rates and earnings before the open",
          source_name: "Approved Publication",
          source_url: "https://example.com/markets",
          published_at: "2026-04-26T07:00:00.000Z",
          topic: "market",
          evidence: []
        }
      ],
      portfolio_radar: [
        {
          ticker: "AAPL",
          company_name: "Apple Inc.",
          previous_close: 171.5,
          latest_price: 174.2,
          change: 2.7,
          change_pct: 1.57,
          direction: "up",
          reason: "Watchlist price row supplied by the portfolio radar input.",
          evidence: []
        }
      ],
      market_board: [
        {
          label: "S&P 500",
          value: 5245.67,
          one_day_change: 35.55,
          one_day_change_pct: 0.68,
          five_day_change_pct: 1.2,
          direction: "up",
          sparkline: [5200, 5212, 5230, 5224, 5245.67],
          evidence: []
        }
      ],
      today_catalysts: [
        {
          time_label: "14:00",
          title: "AAPL earnings",
          category: "earnings",
          impact: "medium",
          evidence: []
        }
      ],
      sector_pulse: [
        {
          label: "Technology",
          change_pct: 1.2,
          direction: "up",
          evidence: []
        }
      ],
      coverage_notes: []
    },
    sections: {
      macro_stress: reportSection("macro_stress", "Macro Stress"),
      market_tape: reportSection("market_tape", "Market Tape"),
      official_macro_pressure: reportSection("official_macro_pressure", "Official Macro Pressure"),
      canonical_events: reportSection("canonical_events", "Canonical Events"),
      bounded_context: reportSection("bounded_context", "Bounded Context"),
      uncertainty_flags: reportSection("uncertainty_flags", "Uncertainty Flags"),
      what_changed: reportSection("what_changed", "What Changed"),
      why_it_matters: reportSection("why_it_matters", "Why It Matters"),
      what_to_watch: reportSection("what_to_watch", "What To Watch"),
      signal_vs_noise: reportSection("signal_vs_noise", "Signal vs Noise"),
      macro_news: reportSection("macro_news", "Macro News"),
      market_board: reportSection("market_board", "Market Board"),
      portfolio_radar: reportSection("portfolio_radar", "Portfolio Radar"),
      today_catalysts: reportSection("today_catalysts", "Today's Catalysts"),
      headline_digest: reportSection("headline_digest", "Headlines Worth Knowing"),
      sector_pulse: reportSection("sector_pulse", "Sector Pulse")
    },
    flags: [],
    confidence: {
      score: 0.82,
      label: "high",
      limiting_factors: []
    }
  };
}

test("MarketPulseReport contract accepts additive editorial issue and Morning Brief copy", () => {
  const errors = schemaErrors(fixture());
  assert.equal(errors.length, 0, errors.join("\n"));
});

test("MarketPulseReport contract remains backward compatible without editorial issue", () => {
  const report = fixture();
  delete report.editorial_issue;
  delete report.brief_editorial;
  delete report.editorial_generation;
  delete report.macro_news;
  delete report.morning_edition;
  delete report.sections.what_changed;
  delete report.sections.why_it_matters;
  delete report.sections.what_to_watch;
  delete report.sections.signal_vs_noise;
  delete report.sections.macro_news;
  delete report.sections.market_board;
  delete report.sections.portfolio_radar;
  delete report.sections.today_catalysts;
  delete report.sections.headline_digest;
  delete report.sections.sector_pulse;

  const errors = schemaErrors(report);
  assert.equal(errors.length, 0, errors.join("\n"));
});
