// Small helpers copied from apps/product-api/src/server.ts and sentiment.ts.
import type {
  AlertLedgerCategory,
  AlertRouteTarget,
  AudienceMember,
  KillSwitchSignalType,
  NotificationType,
  PushTarget,
} from "./types.ts";

export const defaultTimeZone = "America/New_York";

export function createId(): string {
  return crypto.randomUUID();
}

// A stable id in UUID shape built from a key. Used so a retried run writes the same alert row.
export async function stableId(key: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)));
  const hex = [...digest.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${
    hex.slice(20, 32)
  }`;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ---- Dates ----

function toDateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseStrictMarketDate(value: string): Date | undefined {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return undefined;
  const parsed = new Date(`${normalized}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  if (toDateKey(parsed) !== normalized) return undefined;
  return parsed;
}

export function isValidMarketDate(value: string): boolean {
  return parseStrictMarketDate(value) !== undefined;
}

// Returns the date when it is a real YYYY-MM-DD calendar date.
export function normalizeDateInput(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return undefined;
  return isValidMarketDate(normalized) ? normalized : undefined;
}

export function isStrictIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return Number.isFinite(Date.parse(`${value}T12:00:00.000Z`));
}

export function dateInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(date);
}

export function addDaysToIsoDate(baseDate: string, days: number): string {
  const base = new Date(`${baseDate}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function isWeekendIsoDate(value: string): boolean {
  const d = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return false;
  return d.getUTCDay() === 0 || d.getUTCDay() === 6;
}

export function isSundayIsoDate(value: string): boolean {
  const d = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.getUTCDay() === 0;
}

export function nextBusinessDate(baseDate: string): string {
  let candidate = addDaysToIsoDate(baseDate, 1);
  while (isWeekendIsoDate(candidate)) candidate = addDaysToIsoDate(candidate, 1);
  return candidate;
}

export function previousCalendarMonthPeriod(now: Date, timeZone: string): {
  periodStart: string;
  periodEnd: string;
} {
  const today = dateInTimeZone(now, timeZone);
  const month = new Date(`${today.slice(0, 7)}-01T12:00:00.000Z`);
  month.setUTCMonth(month.getUTCMonth() - 1);
  const periodStart = month.toISOString().slice(0, 10);
  month.setUTCMonth(month.getUTCMonth() + 1);
  month.setUTCDate(0);
  return { periodStart, periodEnd: month.toISOString().slice(0, 10) };
}

function observedDate(year: number, month: number, day: number): Date {
  const actual = new Date(Date.UTC(year, month - 1, day));
  const weekday = actual.getUTCDay();
  if (weekday === 6) actual.setUTCDate(actual.getUTCDate() - 1);
  else if (weekday === 0) actual.setUTCDate(actual.getUTCDate() + 1);
  return actual;
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, occurrence: number): Date {
  const date = new Date(Date.UTC(year, month - 1, 1));
  while (date.getUTCDay() !== weekday) date.setUTCDate(date.getUTCDate() + 1);
  date.setUTCDate(date.getUTCDate() + (occurrence - 1) * 7);
  return date;
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const date = new Date(Date.UTC(year, month, 0));
  while (date.getUTCDay() !== weekday) date.setUTCDate(date.getUTCDate() - 1);
  return date;
}

function easterSundayUtc(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function usMarketHolidays(year: number): Set<string> {
  const holidays = new Set<string>();
  holidays.add(toDateKey(observedDate(year, 1, 1)));
  holidays.add(toDateKey(nthWeekdayOfMonth(year, 1, 1, 3))); // MLK
  holidays.add(toDateKey(nthWeekdayOfMonth(year, 2, 1, 3))); // Presidents
  holidays.add(toDateKey(lastWeekdayOfMonth(year, 5, 1))); // Memorial
  holidays.add(toDateKey(observedDate(year, 6, 19))); // Juneteenth
  holidays.add(toDateKey(observedDate(year, 7, 4))); // Independence
  holidays.add(toDateKey(nthWeekdayOfMonth(year, 9, 1, 1))); // Labor
  holidays.add(toDateKey(nthWeekdayOfMonth(year, 11, 4, 4))); // Thanksgiving
  holidays.add(toDateKey(observedDate(year, 12, 25))); // Christmas
  const goodFriday = easterSundayUtc(year);
  goodFriday.setUTCDate(goodFriday.getUTCDate() - 2);
  holidays.add(toDateKey(goodFriday));
  return holidays;
}

export function isUsTradingDay(marketDate: string): boolean {
  const parsed = parseStrictMarketDate(marketDate);
  if (!parsed) return false;
  const weekday = parsed.getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  return !usMarketHolidays(parsed.getUTCFullYear()).has(toDateKey(parsed));
}

// ---- Parsing ----

export function parsePositiveInteger(
  value: string | null | undefined,
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

export function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((v) => (typeof v === "string" ? v.trim() : "")).filter((v) => v.length > 0);
}

export function uniqueUppercaseTickers(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim().toUpperCase()).filter((v) => v.length > 0))];
}

export function normalizeTickerSymbol(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const ticker = value.trim().toUpperCase();
  return /^[A-Z0-9.-]{1,16}$/.test(ticker) ? ticker : undefined;
}

export function normalizeKillSwitchSignalType(value: string | undefined): KillSwitchSignalType {
  switch (value?.trim().toLowerCase()) {
    case "price_move_pct":
    case "price_move":
      return "price_move_pct";
    case "thesis_state":
    case "thesis_drift":
      return "thesis_state";
    case "earnings_event":
    case "earnings":
      return "earnings_event";
    case "sec_filing":
    case "filing":
      return "sec_filing";
    case "guidance_revision":
    case "guidance":
      return "guidance_revision";
    case "management_change":
      return "management_change";
    case "macro_regime":
    case "macro":
      return "macro_regime";
    case "analyst_rerating":
    case "analyst":
      return "analyst_rerating";
    case "news_sentiment":
    case "sentiment":
      return "news_sentiment";
    default:
      return "custom";
  }
}

export function stringMetadata(value: unknown): Record<string, string> | undefined {
  if (!isPlainRecord(value)) return undefined;
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => typeof v === "string").map(([k, v]) => [k, String(v)]),
  );
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roundTo(value: number, decimals = 4): number {
  const m = 10 ** decimals;
  return Math.round(value * m) / m;
}

// ---- Batching ----

// Bounded page size for user loops. Edge Functions have a 150 s wall clock.
export function pageLimit(value: unknown, fallback: number, max = 500): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.min(max, Math.floor(value)));
  }
  if (typeof value === "string" && /^\d+$/.test(value)) return Math.max(1, Math.min(max, Number(value)));
  return fallback;
}

export function cursorValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

// A full page means more may follow; the cursor is the last user id handled.
export function nextCursor(ids: string[], limit: number): string | null {
  return ids.length >= limit && ids.length > 0 ? ids[ids.length - 1] : null;
}

export function groupTargets(members: AudienceMember[]): Map<string, PushTarget[]> {
  return new Map(members.map((m) => [m.userId, m.targets]));
}

// ---- Notifications ----

function notificationTypeLabel(type: NotificationType): string {
  switch (type) {
    case "earnings_preview":
      return "Earnings preview";
    case "earnings_war_room":
      return "Earnings War Room";
    case "contrarian_alert":
      return "Contrarian alert";
    case "kill_switch":
      return "Kill-switch alert";
    case "freshness_decay":
      return "Freshness decay";
    case "morning_exception_briefing":
      return "Morning Exception Briefing";
    case "cross_name_propagation":
      return "Cross-name alert";
    case "weekly_digest":
      return "Weekly digest";
    case "market_pulse_ready":
      return "Market Pulse";
    case "filing_change":
      return "Filing change";
    case "pulse_email":
      return "Morning Pulse email";
  }
}

export function notificationCategory(type: NotificationType): AlertLedgerCategory {
  switch (type) {
    case "contrarian_alert":
    case "kill_switch":
    case "freshness_decay":
    case "cross_name_propagation":
      return "thesis_drift";
    case "earnings_preview":
    case "earnings_war_room":
    case "filing_change":
      return "earnings";
    default:
      return "macro";
  }
}

export function notificationRoute(type: NotificationType): AlertRouteTarget {
  if (type === "earnings_war_room") return "research";
  if (
    type === "weekly_digest" || type === "market_pulse_ready" || type === "pulse_email" ||
    type === "morning_exception_briefing"
  ) return "today";
  if (type === "freshness_decay" || type === "cross_name_propagation") return "names";
  return "research";
}

export function notificationTitle(type: NotificationType, ticker?: string): string {
  return ticker ? `${notificationTypeLabel(type)}: ${ticker}` : notificationTypeLabel(type);
}

function asAlertRouteTarget(value: string | undefined): AlertRouteTarget | undefined {
  return value === "today" || value === "names" || value === "research" || value === "inbox" ||
      value === "you"
    ? value
    : undefined;
}

// Builds alert_ledger.context from the push data map, exactly like the old server.
export function alertLedgerContextFromData(
  data: Record<string, string> | undefined,
): Record<string, unknown> {
  if (!data) return {};
  const leadRoute = asAlertRouteTarget(data.lead_route);
  const briefingMode = data.briefing_mode === "no_change" || data.briefing_mode === "exceptions_present"
    ? data.briefing_mode
    : undefined;
  const relatedTickers = data.tickers?.split(",").map((t) => t.trim().toUpperCase()).filter((t) =>
    t.length > 0
  );
  const n = (v: string | undefined) => (v ? Number(v) : undefined);
  const out: Record<string, unknown> = {};
  const put = (key: string, value: unknown) => {
    if (value !== undefined && value !== "" && !(typeof value === "number" && Number.isNaN(value))) {
      out[key] = value;
    }
  };
  if (data.ticker) put("ticker", data.ticker.trim().toUpperCase());
  if (data.report_id) put("report_id", data.report_id);
  if (data.war_room_id) put("war_room_id", data.war_room_id);
  if (data.war_room_phase) put("war_room_phase", data.war_room_phase);
  if (data.earnings_event_id) put("earnings_event_id", data.earnings_event_id);
  if (data.event_date) put("event_date", data.event_date);
  if (data.earnings_timing_state) put("earnings_timing_state", data.earnings_timing_state);
  if (data.earnings_source_state) put("earnings_source_state", data.earnings_source_state);
  if (data.earnings_evidence_state) put("earnings_evidence_state", data.earnings_evidence_state);
  if (data.earnings_conflict) out.earnings_conflict = data.earnings_conflict === "true";
  if (data.current_cadence_min) out.current_cadence_min = Number(data.current_cadence_min);
  if (data.rule_id) put("rule_id", data.rule_id);
  if (data.evaluation_id) put("evaluation_id", data.evaluation_id);
  if (data.signal_type) put("signal_type", data.signal_type);
  if (data.trigger_key) put("trigger_key", data.trigger_key);
  if (data.report_date && data.deep_link_target === "today") put("pulse_date", data.report_date);
  if (data.report_date) put("report_date", data.report_date);
  if (data.digest_date) put("digest_date", data.digest_date);
  if (relatedTickers && relatedTickers.length > 0) out.related_tickers = relatedTickers;
  if (data.freshness_state) put("freshness_state", data.freshness_state);
  if (data.freshness_score) out.freshness_score = n(data.freshness_score);
  if (data.material_events_count) out.material_events_count = n(data.material_events_count);
  if (data.unreviewed_events_count) out.unreviewed_events_count = n(data.unreviewed_events_count);
  if (data.last_deep_dive_at) put("last_deep_dive_at", data.last_deep_dive_at);
  if (data.kill_switch_triggered_at) put("kill_switch_triggered_at", data.kill_switch_triggered_at);
  if (briefingMode) out.briefing_mode = briefingMode;
  if (data.exceptions_count) out.exceptions_count = n(data.exceptions_count);
  if (data.watchlist_count) out.watchlist_count = n(data.watchlist_count);
  if (leadRoute) out.lead_route = leadRoute;
  if (data.lead_ticker) put("lead_ticker", data.lead_ticker.trim().toUpperCase());
  if (data.lead_report_id) put("lead_report_id", data.lead_report_id);
  if (data.lead_pulse_date) put("lead_pulse_date", data.lead_pulse_date);
  if (data.lead_digest_date) put("lead_digest_date", data.lead_digest_date);
  if (data.relationship_id) put("relationship_id", data.relationship_id);
  if (data.source_ticker) put("source_ticker", data.source_ticker.trim().toUpperCase());
  if (data.affected_ticker) put("affected_ticker", data.affected_ticker.trim().toUpperCase());
  if (data.relationship_type) put("relationship_type", data.relationship_type);
  if (data.relationship_confidence) out.relationship_confidence = n(data.relationship_confidence);
  if (data.relationship_source_report_id) {
    put("relationship_source_report_id", data.relationship_source_report_id);
  }
  if (data.propagation_trigger_key) put("propagation_trigger_key", data.propagation_trigger_key);
  if (data.propagation_signal_type) put("propagation_signal_type", data.propagation_signal_type);
  if (data.propagation_event_id) put("propagation_event_id", data.propagation_event_id);
  if (data.propagation_reason) put("propagation_reason", data.propagation_reason);
  return out;
}
