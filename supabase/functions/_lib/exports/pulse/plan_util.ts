// Small text and number helpers shared by the pulse brief plan.
// Ported from apps/product-api/src/pulse-brief-plan.ts (M4). Logic kept as is; only plumbing changed.
import type { PulseBriefMove } from "./plan_types.ts";

export function joinCopy(values: Array<string | undefined>): string | undefined {
  const text = values
    .map((value) => value?.replace(/\s+/g, " ").trim())
    .filter((value): value is string => Boolean(value))
    .join(" ");
  return text.length > 0 ? text : undefined;
}

export function formatMoveChange(move: PulseBriefMove): string {
  if (move.family === "rates" && typeof move.change === "number") {
    return `${move.change > 0 ? "+" : ""}${trimNumber(move.change)} pts`;
  }
  if (typeof move.changePct === "number") {
    return formatPct(move.changePct);
  }
  if (typeof move.change === "number") {
    const suffix = move.unit ? ` ${move.unit}` : "";
    return `${move.change > 0 ? "+" : ""}${trimNumber(move.change)}${suffix}`;
  }
  return "with no clean change value";
}

export function formatPct(value: number): string {
  return `${value > 0 ? "+" : ""}${trimNumber(value)}%`;
}

export function trimNumber(value: number): string {
  return value.toFixed(Math.abs(value) >= 10 ? 1 : 2).replace(/\.?0+$/, "");
}

export function cleanSentence(value: string): string {
  return value.replace(/\s+/g, " ").trim().replace(/\.$/, ".");
}

export function isCustomerSafeDelta(value: string): boolean {
  return !/UserResearchState|regex|text-match|text matched|implementation|runtime|debug|trading signal/i.test(
    value,
  );
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const itemKey = key(item);
    if (seen.has(itemKey)) {
      continue;
    }
    seen.add(itemKey);
    result.push(item);
  }
  return result;
}
