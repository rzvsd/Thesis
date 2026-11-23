// Copied from apps/product-api/src/pulse/common.ts (keep tested logic). Only imports changed.
import type { CanonicalEvent, EvidenceItem, MarketTapePack, ReportSection } from "./contracts.ts";

export interface MarketPulseCalendarEvent {
  ticker: string;
  event_type: "earnings";
  event_date: string;
  event_time?: "before_market" | "after_market" | "during_market";
  provider?: string;
  retrieved_at?: string;
  reason_text?: string;
}

export function section(
  id: string,
  title: string,
  body: string,
  status: ReportSection["status"],
  evidence: EvidenceItem[],
): ReportSection {
  return {
    section_id: id,
    title,
    body,
    status,
    evidence,
  };
}

export function toEvidence(
  sourceType: EvidenceItem["source_type"],
  sourceName: string,
  excerpt: string,
  retrievedAt: string,
  url?: string,
): EvidenceItem {
  return {
    evidence_id: crypto.randomUUID(),
    source_type: sourceType,
    source_name: sourceName,
    excerpt,
    retrieved_at: retrievedAt,
    url,
  };
}

export function displayMovePct(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/a";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function shortTapeLabel(label: string): string {
  const normalized = label.toLowerCase();
  if (normalized.includes("s&p")) {
    return "S&P 500";
  }
  if (normalized.includes("nasdaq")) {
    return "Nasdaq";
  }
  if (normalized.includes("dow")) {
    return "Dow";
  }
  if (normalized.includes("russell")) {
    return "Russell 2000";
  }
  if (normalized.includes("vix")) {
    return "VIX";
  }
  return label;
}

export function tapeBreadth(pack: MarketTapePack | undefined): "higher" | "lower" | "mixed" | "thin" {
  const core = pack?.indices.filter((entry) => entry.family === "core_index") ?? [];
  if (core.length < 2) {
    return "thin";
  }
  const up = core.filter((entry) => entry.direction === "up").length;
  const down = core.filter((entry) => entry.direction === "down").length;
  if (up >= 3) {
    return "higher";
  }
  if (down >= 3) {
    return "lower";
  }
  return "mixed";
}

export function strongestTapeMove(
  pack: MarketTapePack | undefined,
): MarketTapePack["indices"][number] | undefined {
  return [...(pack?.indices ?? [])]
    .filter((entry) => typeof entry.daily_change_pct === "number")
    .sort((left, right) => Math.abs(right.daily_change_pct ?? 0) - Math.abs(left.daily_change_pct ?? 0))[0];
}

export function weakestTapeMove(
  pack: MarketTapePack | undefined,
): MarketTapePack["indices"][number] | undefined {
  return [...(pack?.indices ?? [])]
    .filter((entry) => typeof entry.daily_change_pct === "number")
    .sort((left, right) => (left.daily_change_pct ?? 0) - (right.daily_change_pct ?? 0))[0];
}

export function findCrossAssetMove(
  pack: MarketTapePack | undefined,
  family: MarketTapePack["cross_asset"][number]["family"],
): MarketTapePack["cross_asset"][number] | undefined {
  return pack?.cross_asset.find((entry) => entry.family === family);
}

export function formatCalendarTiming(value: MarketPulseCalendarEvent["event_time"]): string {
  switch (value) {
    case "before_market":
      return "before the open";
    case "after_market":
      return "after the close";
    case "during_market":
      return "during the session";
    default:
      return "timing pending";
  }
}

export function calendarEvidence(event: MarketPulseCalendarEvent, generatedAt: string): EvidenceItem {
  return toEvidence(
    "financial_data",
    "Earnings calendar",
    `${event.ticker} earnings scheduled for ${event.event_date}.`,
    event.retrieved_at ?? generatedAt,
  );
}

export function normalizeCalendarEvents(
  events: MarketPulseCalendarEvent[] | undefined,
  tickers: string[],
  cycleEnd: string,
): MarketPulseCalendarEvent[] {
  const watched = new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean));
  const start = cycleEnd.slice(0, 10);
  const endDate = new Date(`${start}T12:00:00.000Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 7);
  const end = endDate.toISOString().slice(0, 10);
  return (events ?? [])
    .map((event) => ({
      ...event,
      ticker: event.ticker.trim().toUpperCase(),
    }))
    .filter((event) =>
      watched.has(event.ticker) &&
      event.event_type === "earnings" &&
      event.event_date >= start &&
      event.event_date <= end
    )
    .sort((left, right) =>
      left.event_date.localeCompare(right.event_date) || left.ticker.localeCompare(right.ticker)
    );
}

export function directionFromChange(value: number | undefined): "up" | "down" | "flat" {
  if (typeof value !== "number" || Math.abs(value) < 0.005) {
    return "flat";
  }
  return value > 0 ? "up" : "down";
}

export function readableCoverageNote(flag: string): string {
  const [, sectionName = "coverage"] = flag.split(":");
  const label = sectionName.replaceAll("_", " ");
  if (flag.startsWith("data_unavailable:")) {
    return `${label} was unavailable for this run.`;
  }
  if (flag.startsWith("data_incomplete:")) {
    return `${label} coverage was incomplete for this run.`;
  }
  return flag.replaceAll("_", " ");
}

export function toCanonicalEventEvidence(event: CanonicalEvent): EvidenceItem {
  const sourceName = event.source?.source?.source_name?.trim() || "official_source";
  const sourceUrl = event.source?.source?.source_url;
  const sourceType: EvidenceItem["source_type"] = event.family === "filing_posted" ? "filing" : "macro_data";
  return toEvidence(sourceType, sourceName, event.title, event.retrieved_at, sourceUrl);
}
