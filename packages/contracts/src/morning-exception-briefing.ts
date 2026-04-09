export const morningExceptionBriefingModes = [
  "no_change",
  "exceptions_present"
] as const;

export type MorningExceptionBriefingMode = (typeof morningExceptionBriefingModes)[number];

export const morningExceptionBriefingRouteTargets = [
  "today",
  "names",
  "research",
  "inbox",
  "you"
] as const;

export type MorningExceptionBriefingRouteTarget =
  (typeof morningExceptionBriefingRouteTargets)[number];

export const morningExceptionBriefingExceptionKinds = [
  "kill_switch",
  "freshness",
  "thesis_state",
  "macro"
] as const;

export type MorningExceptionBriefingExceptionKind =
  (typeof morningExceptionBriefingExceptionKinds)[number];

export interface MorningExceptionBriefingException {
  ticker: string;
  kind: MorningExceptionBriefingExceptionKind;
  route: MorningExceptionBriefingRouteTarget;
  reason_code: string;
  reason_text: string;
  report_id?: string;
  pulse_date?: string;
  digest_date?: string;
  rule_id?: string;
}

export interface MorningExceptionBriefingPayload {
  report_date: string;
  mode: MorningExceptionBriefingMode;
  watchlist_count: number;
  exceptions_count: number;
  summary: string;
  lead?: MorningExceptionBriefingException;
  exceptions: MorningExceptionBriefingException[];
}

export const morningExceptionBriefingExceptionSchema = {
  $id: "MorningExceptionBriefingException",
  type: "object",
  additionalProperties: false,
  required: ["ticker", "kind", "route", "reason_code", "reason_text"],
  properties: {
    ticker: { type: "string", minLength: 1 },
    kind: { type: "string", enum: morningExceptionBriefingExceptionKinds },
    route: { type: "string", enum: morningExceptionBriefingRouteTargets },
    reason_code: { type: "string", minLength: 1 },
    reason_text: { type: "string", minLength: 1 },
    report_id: { type: "string", minLength: 1 },
    pulse_date: { type: "string", format: "date" },
    digest_date: { type: "string", format: "date" },
    rule_id: { type: "string", minLength: 1 }
  }
} as const;

export const morningExceptionBriefingPayloadSchema = {
  $id: "MorningExceptionBriefingPayload",
  type: "object",
  additionalProperties: false,
  required: ["report_date", "mode", "watchlist_count", "exceptions_count", "summary", "exceptions"],
  properties: {
    report_date: { type: "string", format: "date" },
    mode: { type: "string", enum: morningExceptionBriefingModes },
    watchlist_count: { type: "integer", minimum: 0 },
    exceptions_count: { type: "integer", minimum: 0 },
    summary: { type: "string", minLength: 1 },
    lead: { $ref: "MorningExceptionBriefingException" },
    exceptions: {
      type: "array",
      items: { $ref: "MorningExceptionBriefingException" }
    }
  }
} as const;
