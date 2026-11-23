// Small helpers and constants shared by the effects (ported from apps/product-api/src/server.ts).
import type { AnalysisReport } from "../types.ts";
import type { ContrarianSignalValue, EffectsDeps, EffectsStore } from "./types.ts";

export const contrarianAnchorWindowDays = 90;
export const monitorFreshnessWindowDays = 14;
export const freshnessAgingDays = 14;
export const freshnessStaleDays = 45;
export const freshnessTriggeredLookbackDays = 14;

export function nowIso(deps: Pick<EffectsDeps, "now">): string {
  return (deps.now ? deps.now() : new Date()).toISOString();
}

export function asContrarianSignal(value: string | undefined): ContrarianSignalValue | undefined {
  if (value === "positive" || value === "neutral" || value === "negative") {
    return value;
  }
  return undefined;
}

export function extractThesisStatement(report: AnalysisReport): string | undefined {
  const section = report.sections.find((entry) =>
    entry.section_id === "thesis_statement" ||
    entry.title.trim().toLowerCase() === "thesis statement"
  );
  const body = section?.body?.trim();
  return body && body.length > 0 ? body : undefined;
}

export function normalizeTickerSymbol(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const ticker = value.trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,16}$/.test(ticker)) {
    return undefined;
  }
  return ticker;
}

export function addHours(iso: string, hours: number): string {
  return new Date(Date.parse(iso) + hours * 60 * 60 * 1000).toISOString();
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export async function appendAudit(
  store: EffectsStore,
  eventType: string,
  payload: Record<string, unknown>,
  userId?: string,
): Promise<void> {
  await store.appendAuditEvent({
    id: crypto.randomUUID(),
    eventType,
    payload,
    userId,
    createdAt: new Date().toISOString(),
  });
}
