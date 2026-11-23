// Small helpers copied from apps/product-api/src/server.ts and sentiment.ts.

export function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number | undefined {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return undefined;
  if (parsed < minimum || parsed > maximum) return undefined;
  return parsed;
}

export function normalizeTickerSymbol(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const ticker = value.trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,16}$/.test(ticker)) return undefined;
  return ticker;
}

export function uniqueUppercaseTickers(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim().toUpperCase()).filter((v) => v.length > 0))];
}

export function dateInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// Strict YYYY-MM-DD that round-trips (sentiment.ts isValidMarketDate).
export function isValidMarketDate(value: string): boolean {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return false;
  const parsed = new Date(`${normalized}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === normalized;
}

export function normalizeDateInput(value: string): string | undefined {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return undefined;
  if (!isValidMarketDate(normalized)) return undefined;
  return normalized;
}

export function isStrictIsoDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return Number.isFinite(Date.parse(`${value}T12:00:00.000Z`));
}

export function addDaysToIsoDate(baseDate: string, days: number): string {
  const base = new Date(`${baseDate}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roundTo(value: number, decimals = 4): number {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

export function normalizeFeedbackMessage(value: unknown, maxLength = 2_000): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return "";
  if (trimmed.length > maxLength) return undefined;
  return trimmed;
}

export function buildUpgradeRequiredPayload(feature: string, errorMessage: string): Record<string, unknown> {
  return { error: "upgrade_required", feature, error_message: errorMessage };
}

export function createId(): string {
  return crypto.randomUUID();
}

// The old server's subscription timezone default (config.ts SUBSCRIPTION_TIMEZONE).
export const subscriptionTimezone = "America/New_York";
