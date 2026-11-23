// Shape checks for a stored Market Pulse issue and the date parameter. Copied from
// apps/product-api/src/routes/pulse-routes.ts (isMarketPulseReport) and server.ts/sentiment.ts (normalizeDateInput).
import type { MarketPulseReport } from "../reports/types.ts";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isMarketPulseReport(report: unknown): report is MarketPulseReport {
  if (!isObject(report)) {
    return false;
  }
  if (typeof report.report_id !== "string" || typeof report.generated_at !== "string") {
    return false;
  }
  if (!isObject(report.sections)) {
    return false;
  }
  return (
    isObject(report.sections.market_moves) &&
    isObject(report.sections.market_tape) &&
    isObject(report.sections.macro_releases) &&
    isObject(report.sections.rates_fx_commodities) &&
    isObject(report.sections.news_summary) &&
    isObject(report.sections.uncertainty_flags)
  );
}

function toDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// A real calendar date in YYYY-MM-DD form (weekends and holidays are allowed, as in the old server).
export function normalizeDateInput(value: string): string | undefined {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return undefined;
  }
  const parsed = new Date(`${normalized}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || toDateKey(parsed) !== normalized) {
    return undefined;
  }
  return normalized;
}
