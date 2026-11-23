// Helpers of the Market Pulse build. Copied from apps/product-api/src/pulse/report-builder.ts
// (keep tested logic). Split out so no file passes about 800 lines. The per-user research-state
// merge (withUserResearchState) is not here: M1 serves it at read time.
import type {
  AnalysisReportEvidenceContext,
  AnalysisReportSourceState,
  CanonicalEvent,
  ConfidenceBlock,
  EvidenceRightsMetadata,
  FirstPartyContextItem,
  MacroStressOmission,
  MacroStressSnapshot,
  MarketPulseEditorialItem,
  MarketPulseWatchItem,
  ReportSection,
  StructuralContextPack,
} from "./contracts.ts";
import { section } from "./common.ts";

export interface OfficialMacroSource {
  source_name?: string;
  source_url?: string;
}

export interface OfficialMacroRetrieval {
  source?: OfficialMacroSource;
  retrieved_at?: string;
}

export interface OfficialMacroObservation {
  registry_id?: string;
  value?: number;
  unit?: string;
  period?: string;
  category?: string;
  retrieval?: OfficialMacroRetrieval;
  missing_fields?: unknown[];
}

export interface OfficialMacroTruthData {
  observations?: OfficialMacroObservation[];
  canonical_events?: CanonicalEvent[];
}

export interface OfficialCompanyTruthData {
  ticker?: string;
  canonical_events?: CanonicalEvent[];
}

export interface FirstPartyContextData {
  context_items?: FirstPartyContextItem[];
}

export const firstPartyContextSourceByTicker: Record<string, string> = {
  AAPL: "https://investor.apple.com/investor-relations/",
  MSFT: "https://www.microsoft.com/en-us/investor/default",
  TSLA: "https://ir.tesla.com/",
};

export function scoreLabel(score: number): ConfidenceBlock["label"] {
  if (score >= 0.75) {
    return "high";
  }
  if (score >= 0.55) {
    return "medium";
  }
  if (score >= 0.35) {
    return "low";
  }
  return "insufficient_data";
}

export function buildConfidence(flags: string[]): ConfidenceBlock {
  let score = 0.86;
  for (const flag of flags) {
    if (flag.startsWith("data_unavailable:")) {
      score -= 0.19;
      continue;
    }
    if (flag.startsWith("data_incomplete:")) {
      score -= 0.08;
      continue;
    }
    if (flag.startsWith("omission:")) {
      score -= 0.04;
    }
  }

  const normalized = Math.max(0.1, Number(score.toFixed(2)));
  return {
    score: normalized,
    label: scoreLabel(normalized),
    limiting_factors: flags.length > 0
      ? flags.map((flag) => flag.replaceAll("_", " "))
      : ["No significant limiting factors detected in this cycle."],
  };
}

export function summarizeStructuralContext(
  structuralContext: StructuralContextPack | undefined,
  families: string[],
): string | undefined {
  if (!structuralContext) {
    return undefined;
  }

  const observations = structuralContext.observations.filter((entry) => families.includes(entry.family));
  const summaryParts = observations.slice(0, 2).map((entry) => `${entry.label}: ${entry.summary}`);
  const omission = structuralContext.omissions.find((entry) => entry.source_family === "imf");
  if (omission) {
    summaryParts.push(`Coverage note: ${omission.reason_text}`);
  }
  return summaryParts.length > 0 ? summaryParts.join(" ") : undefined;
}

export function sectionFromEditorialItems(
  id: string,
  title: string,
  items: MarketPulseEditorialItem[],
  status: ReportSection["status"],
): ReportSection {
  const body = items.length > 0
    ? items.map((item) => `${item.title}: ${item.body}`).join(" ")
    : "No material update for this issue.";
  return section(
    id,
    title,
    body,
    status,
    items.flatMap((item) => item.evidence).slice(0, 8),
  );
}

export function sectionFromWatchItems(
  items: MarketPulseWatchItem[],
  status: ReportSection["status"],
): ReportSection {
  const body = items.length > 0
    ? items.map((item) => `${item.title}: ${item.body}`).join(" ")
    : "No dated watch items were available for the next cycle.";
  return section(
    "what_to_watch",
    "What To Watch",
    body,
    status,
    items.flatMap((item) => item.evidence).slice(0, 8),
  );
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asUtcMillis(value: string | undefined): number | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function inCycleWindow(
  value: string | undefined,
  cycleStartMs: number,
  cycleEndMs: number,
): boolean {
  const timestamp = asUtcMillis(value);
  if (timestamp === undefined) {
    return false;
  }
  return timestamp >= cycleStartMs && timestamp <= cycleEndMs;
}

export function asCanonicalEvents(value: unknown): CanonicalEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry) => {
    if (!isObject(entry)) {
      return false;
    }
    return (
      typeof entry.id === "string" &&
      typeof entry.family === "string" &&
      typeof entry.subject_type === "string" &&
      typeof entry.subject_id === "string" &&
      typeof entry.title === "string" &&
      typeof entry.occurred_at === "string" &&
      typeof entry.retrieved_at === "string"
    );
  }) as CanonicalEvent[];
}

export function asFirstPartyContextItems(value: unknown): FirstPartyContextItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry) => {
    if (!isObject(entry)) {
      return false;
    }
    return (
      typeof entry.context_id === "string" &&
      typeof entry.ticker === "string" &&
      typeof entry.title === "string" &&
      typeof entry.summary === "string" &&
      typeof entry.source_url === "string" &&
      typeof entry.source_domain === "string" &&
      typeof entry.retrieved_at === "string" &&
      isObject(entry.rights)
    );
  }) as FirstPartyContextItem[];
}

export function uniqueByCanonicalEventId(events: CanonicalEvent[]): CanonicalEvent[] {
  const seen = new Set<string>();
  const unique: CanonicalEvent[] = [];
  for (const event of events) {
    if (seen.has(event.id)) {
      continue;
    }
    seen.add(event.id);
    unique.push(event);
  }
  return unique;
}

export function uniqueByContextId(items: FirstPartyContextItem[]): FirstPartyContextItem[] {
  const seen = new Set<string>();
  const unique: FirstPartyContextItem[] = [];
  for (const item of items) {
    if (seen.has(item.context_id)) {
      continue;
    }
    seen.add(item.context_id);
    unique.push(item);
  }
  return unique;
}

export function dedupeRights(rights: EvidenceRightsMetadata[]): EvidenceRightsMetadata[] {
  const seen = new Set<string>();
  const deduped: EvidenceRightsMetadata[] = [];
  for (const entry of rights) {
    const key = [
      entry.rights_class,
      entry.display_mode,
      entry.source_rank,
      entry.source_type,
      entry.policy_reason,
    ].join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(entry);
  }
  return deduped;
}

export function officialRights(generatedAt: string): EvidenceRightsMetadata {
  return {
    rights_class: "official_public",
    display_mode: "full_text_allowed",
    source_rank: "official",
    source_type: "official_macro",
    can_store_full_text: true,
    can_display_excerpt: true,
    can_display_link: true,
    policy_reason: "Official public economic releases and filings.",
    reviewed_at: generatedAt,
  };
}

export function contextSourceState(
  macroStatus: ReportSection["status"],
  contextStatus: ReportSection["status"],
  contextCount: number,
): AnalysisReportSourceState {
  if (macroStatus === "complete" && contextCount > 0 && contextStatus === "complete") {
    return "bounded_context";
  }
  if (macroStatus === "complete" && contextCount === 0) {
    return "official";
  }
  if (contextCount > 0 || contextStatus === "data_incomplete") {
    return "partial";
  }
  return "missing";
}

export function toContextOmissions(
  macroStressOmissions: MacroStressOmission[],
  flags: string[],
): AnalysisReportEvidenceContext["omissions"] {
  const omissions = macroStressOmissions.map((omission) => ({
    omission_code: `macro:${omission.registry_id}:${omission.reason_code}`,
    omission_text: omission.reason_text,
    affects_sections: ["macro_stress", "official_macro_pressure"],
  }));

  for (const flag of flags) {
    if (!flag.startsWith("data_")) {
      continue;
    }
    const sectionKey = flag.includes(":") ? flag.split(":")[1] : "uncertainty_flags";
    if (!sectionKey) {
      continue;
    }
    omissions.push({
      omission_code: flag,
      omission_text: flag.replaceAll("_", " "),
      affects_sections: [sectionKey],
    });
  }

  return omissions;
}

export function sectionStatusForMacro(
  macroAvailable: boolean,
  snapshot: MacroStressSnapshot,
): ReportSection["status"] {
  if (!macroAvailable) {
    return "data_unavailable";
  }
  if (snapshot.state === "insufficient_data" || snapshot.omissions.length > 0) {
    return "data_incomplete";
  }
  return "complete";
}
