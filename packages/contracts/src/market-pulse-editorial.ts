import type { EvidenceItem } from "./evidence-item";
import { evidenceItemSchema } from "./evidence-item";

export type MarketPulseEditorialFreshnessState =
  | "baseline"
  | "new"
  | "updated"
  | "unchanged"
  | "omitted";

export type MarketPulseEditorialItemKind =
  | "market_tape"
  | "macro"
  | "calendar"
  | "company_event"
  | "coverage"
  | "context";

export type MarketPulseEditorialImportance = "high" | "medium" | "low";

export interface MarketPulseEditorialItem {
  kind: MarketPulseEditorialItemKind;
  title: string;
  body: string;
  freshness_state: MarketPulseEditorialFreshnessState;
  importance: MarketPulseEditorialImportance;
  evidence: EvidenceItem[];
}

export interface MarketPulseWatchItem extends MarketPulseEditorialItem {
  watch_date?: string;
}

export interface MarketPulseEditorialIssue {
  issue_id: string;
  headline: string;
  dek: string;
  lead: string;
  prior_cycle_end?: string;
  freshness_state: MarketPulseEditorialFreshnessState;
  in_this_issue: string[];
  what_changed: MarketPulseEditorialItem[];
  why_it_matters: MarketPulseEditorialItem[];
  what_to_watch: MarketPulseWatchItem[];
  signal_vs_noise: MarketPulseEditorialItem[];
  coverage_notes: string[];
  evidence: EvidenceItem[];
}

export const marketPulseEditorialFreshnessStates = [
  "baseline",
  "new",
  "updated",
  "unchanged",
  "omitted"
] as const;

export const marketPulseEditorialItemKinds = [
  "market_tape",
  "macro",
  "calendar",
  "company_event",
  "coverage",
  "context"
] as const;

export const marketPulseEditorialImportanceLevels = [
  "high",
  "medium",
  "low"
] as const;

export const marketPulseEditorialItemSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "kind",
    "title",
    "body",
    "freshness_state",
    "importance",
    "evidence"
  ],
  properties: {
    kind: { enum: marketPulseEditorialItemKinds },
    title: { type: "string" },
    body: { type: "string" },
    freshness_state: { enum: marketPulseEditorialFreshnessStates },
    importance: { enum: marketPulseEditorialImportanceLevels },
    evidence: {
      type: "array",
      items: evidenceItemSchema
    }
  }
} as const;

export const marketPulseWatchItemSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "kind",
    "title",
    "body",
    "freshness_state",
    "importance",
    "evidence"
  ],
  properties: {
    ...marketPulseEditorialItemSchema.properties,
    watch_date: { type: "string" }
  }
} as const;

export const marketPulseEditorialIssueSchema = {
  $id: "MarketPulseEditorialIssue",
  type: "object",
  additionalProperties: false,
  required: [
    "issue_id",
    "headline",
    "dek",
    "lead",
    "freshness_state",
    "in_this_issue",
    "what_changed",
    "why_it_matters",
    "what_to_watch",
    "signal_vs_noise",
    "coverage_notes",
    "evidence"
  ],
  properties: {
    issue_id: { type: "string" },
    headline: { type: "string" },
    dek: { type: "string" },
    lead: { type: "string" },
    prior_cycle_end: { type: "string" },
    freshness_state: { enum: marketPulseEditorialFreshnessStates },
    in_this_issue: {
      type: "array",
      items: { type: "string" }
    },
    what_changed: {
      type: "array",
      items: marketPulseEditorialItemSchema
    },
    why_it_matters: {
      type: "array",
      items: marketPulseEditorialItemSchema
    },
    what_to_watch: {
      type: "array",
      items: marketPulseWatchItemSchema
    },
    signal_vs_noise: {
      type: "array",
      items: marketPulseEditorialItemSchema
    },
    coverage_notes: {
      type: "array",
      items: { type: "string" }
    },
    evidence: {
      type: "array",
      items: evidenceItemSchema
    }
  }
} as const;
