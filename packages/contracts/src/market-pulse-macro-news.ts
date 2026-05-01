import type { EvidenceItem } from "./evidence-item";
import { evidenceItemSchema } from "./evidence-item";

export type MarketPulseMacroNewsTopic =
  | "geopolitical"
  | "macro_policy"
  | "central_bank"
  | "war_conflict"
  | "trade"
  | "energy"
  | "supply_chain";

export type MarketPulseMacroNewsSeverity = "normal" | "notable" | "shock";

export type MarketPulseMacroNewsConfirmationState =
  | "reported"
  | "corroborated"
  | "official_confirmed";

export type MarketPulseMacroNewsState = "calm" | "watch" | "shock";

export interface MarketPulseMacroNewsItem {
  headline: string;
  source_name: string;
  source_url?: string;
  published_at?: string;
  topic: MarketPulseMacroNewsTopic;
  severity: MarketPulseMacroNewsSeverity;
  confirmation_state: MarketPulseMacroNewsConfirmationState;
  corroboration_count: number;
  affected_regions: string[];
  affected_assets: string[];
  why_it_matters: string;
  evidence: EvidenceItem[];
}

export interface MarketPulseMacroNewsOmission {
  omission_id: string;
  family: "macro_news" | "geopolitical_risk";
  reason_code: string;
  reason_text: string;
  blocking: boolean;
}

export interface MarketPulseMacroNewsPack {
  as_of: string;
  state: MarketPulseMacroNewsState;
  lead: string;
  items: MarketPulseMacroNewsItem[];
  omissions: MarketPulseMacroNewsOmission[];
  coverage_notes: string[];
}

export const marketPulseMacroNewsTopics = [
  "geopolitical",
  "macro_policy",
  "central_bank",
  "war_conflict",
  "trade",
  "energy",
  "supply_chain"
] as const;

export const marketPulseMacroNewsSeverities = ["normal", "notable", "shock"] as const;

export const marketPulseMacroNewsConfirmationStates = [
  "reported",
  "corroborated",
  "official_confirmed"
] as const;

export const marketPulseMacroNewsStates = ["calm", "watch", "shock"] as const;

export const marketPulseMacroNewsItemSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "headline",
    "source_name",
    "topic",
    "severity",
    "confirmation_state",
    "corroboration_count",
    "affected_regions",
    "affected_assets",
    "why_it_matters",
    "evidence"
  ],
  properties: {
    headline: { type: "string" },
    source_name: { type: "string" },
    source_url: { type: "string" },
    published_at: { type: "string" },
    topic: { enum: marketPulseMacroNewsTopics },
    severity: { enum: marketPulseMacroNewsSeverities },
    confirmation_state: { enum: marketPulseMacroNewsConfirmationStates },
    corroboration_count: { type: "number" },
    affected_regions: {
      type: "array",
      items: { type: "string" }
    },
    affected_assets: {
      type: "array",
      items: { type: "string" }
    },
    why_it_matters: { type: "string" },
    evidence: {
      type: "array",
      items: evidenceItemSchema
    }
  }
} as const;

export const marketPulseMacroNewsOmissionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["omission_id", "family", "reason_code", "reason_text", "blocking"],
  properties: {
    omission_id: { type: "string" },
    family: {
      type: "string",
      enum: ["macro_news", "geopolitical_risk"]
    },
    reason_code: { type: "string" },
    reason_text: { type: "string" },
    blocking: { type: "boolean" }
  }
} as const;

export const marketPulseMacroNewsPackSchema = {
  $id: "MarketPulseMacroNewsPack",
  type: "object",
  additionalProperties: false,
  required: ["as_of", "state", "lead", "items", "omissions", "coverage_notes"],
  properties: {
    as_of: { type: "string" },
    state: { enum: marketPulseMacroNewsStates },
    lead: { type: "string" },
    items: {
      type: "array",
      items: marketPulseMacroNewsItemSchema
    },
    omissions: {
      type: "array",
      items: marketPulseMacroNewsOmissionSchema
    },
    coverage_notes: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;
