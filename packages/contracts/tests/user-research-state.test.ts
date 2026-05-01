import assert from "node:assert/strict";
import test from "node:test";

import type { UserResearchState } from "../src/user-research-state";
import { userResearchStateSchema } from "../src/user-research-state";

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

function schemaErrors(state: UserResearchState): string[] {
  const errors: string[] = [];
  validateWithSchema(state, userResearchStateSchema as JsonSchema, "state", errors);
  return errors;
}

function fixture(): UserResearchState {
  return {
    state_id: "state-1",
    user_id: "user-1",
    as_of: "2026-04-27",
    generated_at: "2026-04-27T08:00:00.000Z",
    prior_state_id: "state-0",
    watchlist_tickers: ["AAPL"],
    holdings: [
      {
        ticker: "AAPL",
        quantity: 2,
        cost_basis: 170,
        label: "Core",
        updated_at: "2026-04-27T07:00:00.000Z"
      }
    ],
    names: [
      {
        ticker: "AAPL",
        company_name: "Apple Inc.",
        in_watchlist: true,
        holding: {
          ticker: "AAPL",
          quantity: 2,
          cost_basis: 170,
          label: "Core",
          updated_at: "2026-04-27T07:00:00.000Z"
        },
        monitor_state: "improved",
        freshness_state: "current",
        latest_report_id: "report-1",
        latest_pulse_id: "pulse-1",
        daily_delta: {
          state: "new_event",
          title: "New event context",
          body: "AAPL has new event context.",
          evidence_refs: []
        },
        summary: "AAPL thesis state is current.",
        what_changed: "AAPL has a new filing context.",
        why_it_matters: "The new context matters to the existing thesis.",
        what_to_watch: "Watch for official filings and earnings updates.",
        evidence_refs: [
          {
            kind: "report",
            ref_id: "report-1",
            ticker: "AAPL",
            captured_at: "2026-04-27T07:00:00.000Z"
          }
        ],
        omissions: []
      }
    ],
    omissions: [],
    evidence_refs: [
      {
        kind: "pulse",
        ref_id: "pulse-1",
        label: "Market Pulse",
        captured_at: "2026-04-27T08:00:00.000Z"
      }
    ]
  };
}

test("UserResearchState contract accepts complete fixture", () => {
  assert.deepEqual(schemaErrors(fixture()), []);
});

test("UserResearchState contract accepts baseline omission-forward fixture", () => {
  const state = fixture();
  const name = state.names[0];
  assert.ok(name);
  delete state.prior_state_id;
  name.daily_delta = {
    state: "needs_deep_dive_refresh",
    title: "Deep Dive needed",
    body: "AAPL does not yet have a completed Deep Dive.",
    evidence_refs: []
  };
  name.omissions = [
    {
      family: "deep_dive",
      code: "deep_dive_missing",
      reason: "No completed Deep Dive exists yet.",
      ticker: "AAPL"
    }
  ];
  state.omissions = [...name.omissions];
  assert.deepEqual(schemaErrors(state), []);
});
