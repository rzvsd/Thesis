// Pulse brief plan types.
// Ported from apps/product-api/src/pulse-brief-plan.ts (M4). Logic kept as is; only plumbing changed.
import type { EvidenceItem, Loose } from "../../reports/types.ts";

export type MarketTapeMove = Loose;

export type PulseBriefMode = "quiet" | "normal" | "event";
export type PulseBriefBreadth = "higher" | "lower" | "mixed" | "quiet" | "thin";

export interface PulseBriefMove {
  id: string;
  label: string;
  value?: number;
  change?: number;
  changePct?: number;
  unit?: string;
  family: string;
  direction: "up" | "down" | "flat";
}

export interface PulseBriefDeltaItem {
  label: string;
  detail: string;
  importance: "high" | "medium" | "low";
}

export interface PulseBriefInterestingCandidate {
  code: string;
  facts: string[];
  importance: "high" | "medium" | "low";
}

export interface PulseBriefNameContext {
  tape_relation: "led" | "lagged" | "matched" | "unknown";
  sector_relation?: "led" | "lagged" | "matched" | "unknown";
  pending_event?: string;
  macro_read?: string;
  context_line: string;
}

export interface PulseBriefUserNameRow {
  ticker: string;
  companyName?: string;
  previousClose?: number;
  latestPrice?: number;
  changePct?: number;
  direction: "up" | "down" | "flat";
  note: string;
  context?: PulseBriefNameContext;
}

export interface PulseBriefCalendarItem {
  timeLabel?: string;
  title: string;
  impact: "high" | "medium" | "low";
}

export interface PulseBriefHeadline {
  headline: string;
  sourceName: string;
  sourceUrl?: string;
  publishedAt?: string;
  topic?: string;
}

export interface PulseBriefOmission {
  family: string;
  reason: string;
}

export interface PulseBriefFactPack {
  as_of: string;
  mode: PulseBriefMode;
  morning_verdict: {
    deterministic_label: string;
    reason_codes: string[];
  };
  tape: {
    indices: PulseBriefMove[];
    cross_asset: PulseBriefMove[];
    breadth: PulseBriefBreadth;
    notable_moves: PulseBriefMove[];
  };
  deltas: {
    vs_yesterday: PulseBriefDeltaItem[];
    vs_5d: PulseBriefDeltaItem[];
    unchanged: string[];
    baseline: boolean;
  };
  interesting_candidates: PulseBriefInterestingCandidate[];
  narrative_facts: string[];
  one_thing: PulseBriefInterestingCandidate;
  user_names?: {
    rows: PulseBriefUserNameRow[];
    portfolio_comment_facts: string[];
  };
  calendar?: PulseBriefCalendarItem[];
  headlines?: PulseBriefHeadline[];
  evidence: EvidenceItem[];
  omissions: PulseBriefOmission[];
  sources: string[];
}

export interface PulseBriefCopy {
  the_read: string;
  what_changed_summary: string;
  why_it_matters: string;
  your_names_comment?: string;
  smart_comment: string;
  morning_story: string;
  tape_color: string;
  tape_narrative: string;
  calendar_narrative?: string;
  headlines_narrative?: string;
  names_narrative?: string;
  one_thing: string;
  mood: "confident" | "cautious" | "curious" | "calm";
}

export interface PulseBriefPlan {
  fact_pack: PulseBriefFactPack;
  copy: PulseBriefCopy;
}
