// The data a Pulse build needs, sent by the daily job (jobs/data/run_pulse.py) in the request body.
// It replaces apps/product-api/src/pulse/fetchers.ts (fetchEnvelope) and the calendar and news fetches of
// processMarketPulseJob. Each input is the body the old server got back from data-openbb or news-ingest.
// envelopeFrom applies the same checks fetchEnvelope applied to that body. A missing input counts as a
// failed fetch, so the build takes the same "data_unavailable" path as before.
import { parseCalendarEvents } from "../macro.ts";
import type { MarketPulseCalendarEvent } from "./common.ts";
import { headlineItemsFromApprovedNews } from "./macro_news.ts";
import type { MarketPulseHeadlineItem } from "./contracts.ts";

// Inputs read by buildMarketPulseReport. Each value is a service envelope { ok, data, error_flag?, error_message? }.
export interface PulseSourceInputs {
  // GET data-openbb /v1/market/tape?scope=daily&as_of=<cycle_end date>
  market_tape?: unknown;
  // GET data-openbb /v1/official/macro?scope=daily&as_of=<cycle_end date>
  macro?: unknown;
  // GET data-openbb /v1/official/structural?country=US&subject_type=market_pulse&as_of=<cycle_end date>
  structural?: unknown;
  // GET data-openbb /v1/official/company?ticker=<T>, keyed by ticker.
  companies?: Record<string, unknown>;
  // POST news-ingest /v1/first-party/context { ticker, url }, keyed by ticker.
  first_party?: Record<string, unknown>;
}

// Everything the route accepts in body.inputs.
export interface PulseInputs extends PulseSourceInputs {
  // GET news-ingest /v1/news?date=<cycle_end date> (envelope; data is the article list).
  news?: unknown;
  // data.events of POST data-openbb /internal/calendar/earnings { start_date: <cycle_end date>, end_date: +7 days }.
  calendar_events?: unknown;
}

export type EnvelopeResult<TData> = { ok: true; data: TData } | { ok: false; errorMessage: string };

export const missingInputMessage = "input not provided";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Same success test as the old fetchEnvelope: ok === true, error_flag !== true and data present.
export function envelopeFrom<TData>(payload: unknown): EnvelopeResult<TData> {
  if (payload === undefined || payload === null) {
    return { ok: false, errorMessage: missingInputMessage };
  }
  if (!isRecord(payload)) {
    return { ok: false, errorMessage: "provider returned no data" };
  }
  const isSuccess = payload.ok === true && payload.error_flag !== true;
  if (!isSuccess || payload.data === undefined || payload.data === null) {
    const message = typeof payload.error_message === "string" ? payload.error_message.trim() : "";
    return { ok: false, errorMessage: message || "provider returned no data" };
  }
  return { ok: true, data: payload.data as TData };
}

function keyedEnvelopes(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    const ticker = key.trim().toUpperCase();
    if (ticker) out[ticker] = entry;
  }
  return out;
}

// Reads body.inputs. Anything that is not an object is treated as "not provided".
export function parsePulseInputs(value: unknown): PulseInputs {
  if (!isRecord(value)) return {};
  return {
    market_tape: value.market_tape ?? undefined,
    macro: value.macro ?? undefined,
    structural: value.structural ?? undefined,
    companies: keyedEnvelopes(value.companies),
    first_party: keyedEnvelopes(value.first_party),
    news: value.news ?? undefined,
    calendar_events: value.calendar_events ?? undefined,
  };
}

export interface CalendarInput {
  events: MarketPulseCalendarEvent[];
  fetchState: "complete" | "data_unavailable";
  unavailableReason?: string;
}

// The old code threw when the calendar call failed and then marked the calendar "data_unavailable".
// A missing or non-array calendar_events input takes that path.
export function calendarFromInputs(inputs: PulseInputs, nowIso: string): CalendarInput {
  if (!Array.isArray(inputs.calendar_events)) {
    return {
      events: [],
      fetchState: "data_unavailable",
      unavailableReason: `Earnings calendar access was unavailable: ${missingInputMessage}`,
    };
  }
  // Same rows the old fetchCalendarEventsFromDataOpenbb returned (event_type was always "earnings").
  const events = parseCalendarEvents(inputs.calendar_events, nowIso).map((
    event,
  ): MarketPulseCalendarEvent => ({
    ...event,
    event_type: "earnings",
  }));
  return { events, fetchState: "complete" };
}

export interface NewsInput {
  headlineItems: MarketPulseHeadlineItem[];
  fetchState: "complete" | "data_unavailable";
  unavailableReason?: string;
}

// Same as the old approved-headline block of processMarketPulseJob.
export function newsFromInputs(inputs: PulseInputs): NewsInput {
  const approvedNews = envelopeFrom<unknown>(inputs.news);
  if (!approvedNews.ok) {
    return {
      headlineItems: [],
      fetchState: "data_unavailable",
      unavailableReason: `Approved headline access was unavailable: ${approvedNews.errorMessage}`,
    };
  }
  return { headlineItems: headlineItemsFromApprovedNews(approvedNews.data), fetchState: "complete" };
}
