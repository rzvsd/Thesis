// Formatting helpers for the Market Pulse PDF.
// Ported from apps/product-api/src/pulse-brief-render.ts (M4). Logic kept as is; only plumbing changed.
import type { Loose } from "../../reports/types.ts";
import type { PulseBriefCopy, PulseBriefFactPack, PulseBriefMove, PulseBriefUserNameRow } from "./plan.ts";

export type PulseTone = "positive" | "negative" | "caution" | "flat";

export function modeLabel(factPack: PulseBriefFactPack): string {
  if (factPack.mode === "quiet") {
    return "Quiet day - 30 second read";
  }
  if (factPack.mode === "event") {
    return "Event day - deeper read";
  }
  return "Normal day - market story";
}

export function tapeHeading(factPack: PulseBriefFactPack, copy: PulseBriefCopy): string {
  if (factPack.tape.breadth === "quiet") {
    return "Quiet Tape";
  }
  return copy.tape_color;
}

export function deltaHeading(factPack: PulseBriefFactPack): string {
  if (factPack.deltas.baseline) {
    return "Baseline Issue";
  }
  const count = factPack.deltas.vs_yesterday.length;
  if (count === 0) {
    return "Nothing Moved The Needle";
  }
  return count === 1 ? "One Thing Changed" : `${count} Things Changed`;
}

export function formatMove(move: PulseBriefMove): string {
  if (move.family === "rates" && typeof move.change === "number") {
    return `${move.change > 0 ? "+" : ""}${trimNumber(move.change)} pts`;
  }
  if (typeof move.changePct === "number") {
    return formatPct(move.changePct);
  }
  if (typeof move.change === "number") {
    return `${move.change > 0 ? "+" : ""}${trimNumber(move.change)}`;
  }
  return "n/a";
}

export function formatNamePriceLine(row: PulseBriefUserNameRow): string | undefined {
  if (typeof row.latestPrice !== "number" || !Number.isFinite(row.latestPrice)) {
    return undefined;
  }
  if (typeof row.previousClose === "number" && Number.isFinite(row.previousClose)) {
    return `${formatUsd(row.previousClose)} to ${formatUsd(row.latestPrice)}`;
  }
  return `Latest close ${formatUsd(row.latestPrice)}`;
}

// The HTML "toneClass": for stress gauges (VIX, rates, credit) down is good news.
export function moveTone(move: PulseBriefMove): PulseTone {
  if (move.family === "volatility" || move.family === "rates" || move.family === "credit") {
    return move.direction === "down" ? "positive" : move.direction === "up" ? "caution" : "flat";
  }
  return move.direction === "up" ? "positive" : move.direction === "down" ? "negative" : "flat";
}

export function directionTone(direction: string): PulseTone {
  return direction === "up" ? "positive" : direction === "down" ? "negative" : "flat";
}

export function moveDisplayRank(move: PulseBriefMove): number {
  const label = move.label.toLowerCase();
  if (label.includes("s&p 500")) return 10;
  if (label.includes("nasdaq")) return 20;
  if (label.includes("dow")) return 30;
  if (label.includes("russell")) return 40;
  if (label.includes("vix")) return 50;
  if (label.includes("10y")) return 60;
  if (label.includes("2y")) return 70;
  if (label.includes("wti") || label.includes("oil")) return 80;
  return 100;
}

export function dedupeMoves(moves: Loose[]): Loose[] {
  const seen = new Set<string>();
  const result: Loose[] = [];
  for (const move of moves) {
    if (seen.has(move.instrument_id)) {
      continue;
    }
    seen.add(move.instrument_id);
    result.push(move);
  }
  return result;
}

export function shortSectorLabel(label: string): string {
  return label
    .replace(/^FRED\s+/i, "")
    .replace(/\bSelect Sector SPDR\b/i, "")
    .replace(/\bETF\b/i, "")
    .trim()
    .slice(0, 14) || label.slice(0, 8);
}

export function splitParagraphs(value: string): string[] {
  return value
    .split(/\n{2,}/)
    .map((entry) => entry.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 4);
}

export function formatPct(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function trimNumber(value: number): string {
  return value.toFixed(Math.abs(value) >= 10 ? 1 : 2).replace(/\.?0+$/, "");
}

export function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}
