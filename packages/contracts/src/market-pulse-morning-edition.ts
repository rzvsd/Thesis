import type { EvidenceItem } from "./evidence-item";
import { evidenceItemSchema } from "./evidence-item";

export type MarketPulseMoveDirection = "up" | "down" | "flat";

export type MarketPulseHeadlineTopic =
  | "market"
  | "macro"
  | "company"
  | "policy"
  | "sector";

export type MarketPulseCatalystCategory =
  | "macro"
  | "fed"
  | "earnings"
  | "company"
  | "market";

export type MarketPulseCatalystImpact = "high" | "medium" | "low";

export interface MarketPulseHeadlineItem {
  headline: string;
  source_name: string;
  source_url?: string;
  published_at?: string;
  topic?: MarketPulseHeadlineTopic;
  evidence: EvidenceItem[];
}

export interface MarketPulsePortfolioRadarRow {
  ticker: string;
  company_name?: string;
  previous_close?: number;
  latest_price?: number;
  change?: number;
  change_pct?: number;
  direction: MarketPulseMoveDirection;
  reason?: string;
  evidence: EvidenceItem[];
}

export interface MarketPulseMarketBoardCard {
  label: string;
  value?: number;
  one_day_change?: number;
  one_day_change_pct?: number;
  five_day_change_pct?: number;
  direction: MarketPulseMoveDirection;
  sparkline?: number[];
  evidence: EvidenceItem[];
}

export interface MarketPulseCatalystItem {
  time_label?: string;
  title: string;
  category: MarketPulseCatalystCategory;
  impact: MarketPulseCatalystImpact;
  evidence: EvidenceItem[];
}

export interface MarketPulseSectorPulseItem {
  label: string;
  change_pct?: number;
  direction: MarketPulseMoveDirection;
  evidence: EvidenceItem[];
}

export interface MarketPulseMorningEdition {
  headline_digest: MarketPulseHeadlineItem[];
  portfolio_radar: MarketPulsePortfolioRadarRow[];
  market_board: MarketPulseMarketBoardCard[];
  today_catalysts: MarketPulseCatalystItem[];
  sector_pulse: MarketPulseSectorPulseItem[];
  coverage_notes: string[];
}

export const marketPulseMoveDirections = ["up", "down", "flat"] as const;

export const marketPulseHeadlineTopics = [
  "market",
  "macro",
  "company",
  "policy",
  "sector"
] as const;

export const marketPulseCatalystCategories = [
  "macro",
  "fed",
  "earnings",
  "company",
  "market"
] as const;

export const marketPulseCatalystImpacts = ["high", "medium", "low"] as const;

export const marketPulseHeadlineItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "source_name", "evidence"],
  properties: {
    headline: { type: "string" },
    source_name: { type: "string" },
    source_url: { type: "string" },
    published_at: { type: "string" },
    topic: { enum: marketPulseHeadlineTopics },
    evidence: {
      type: "array",
      items: evidenceItemSchema
    }
  }
} as const;

export const marketPulsePortfolioRadarRowSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ticker", "direction", "evidence"],
  properties: {
    ticker: { type: "string" },
    company_name: { type: "string" },
    previous_close: { type: "number" },
    latest_price: { type: "number" },
    change: { type: "number" },
    change_pct: { type: "number" },
    direction: { enum: marketPulseMoveDirections },
    reason: { type: "string" },
    evidence: {
      type: "array",
      items: evidenceItemSchema
    }
  }
} as const;

export const marketPulseMarketBoardCardSchema = {
  type: "object",
  additionalProperties: false,
  required: ["label", "direction", "evidence"],
  properties: {
    label: { type: "string" },
    value: { type: "number" },
    one_day_change: { type: "number" },
    one_day_change_pct: { type: "number" },
    five_day_change_pct: { type: "number" },
    direction: { enum: marketPulseMoveDirections },
    sparkline: {
      type: "array",
      items: { type: "number" }
    },
    evidence: {
      type: "array",
      items: evidenceItemSchema
    }
  }
} as const;

export const marketPulseCatalystItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "category", "impact", "evidence"],
  properties: {
    time_label: { type: "string" },
    title: { type: "string" },
    category: { enum: marketPulseCatalystCategories },
    impact: { enum: marketPulseCatalystImpacts },
    evidence: {
      type: "array",
      items: evidenceItemSchema
    }
  }
} as const;

export const marketPulseSectorPulseItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["label", "direction", "evidence"],
  properties: {
    label: { type: "string" },
    change_pct: { type: "number" },
    direction: { enum: marketPulseMoveDirections },
    evidence: {
      type: "array",
      items: evidenceItemSchema
    }
  }
} as const;

export const marketPulseMorningEditionSchema = {
  $id: "MarketPulseMorningEdition",
  type: "object",
  additionalProperties: false,
  required: [
    "headline_digest",
    "portfolio_radar",
    "market_board",
    "today_catalysts",
    "sector_pulse",
    "coverage_notes"
  ],
  properties: {
    headline_digest: {
      type: "array",
      items: marketPulseHeadlineItemSchema
    },
    portfolio_radar: {
      type: "array",
      items: marketPulsePortfolioRadarRowSchema
    },
    market_board: {
      type: "array",
      items: marketPulseMarketBoardCardSchema
    },
    today_catalysts: {
      type: "array",
      items: marketPulseCatalystItemSchema
    },
    sector_pulse: {
      type: "array",
      items: marketPulseSectorPulseItemSchema
    },
    coverage_notes: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;
