import type { SubscriptionTier } from "./subscription-tier";

export const reportFeedbackCodes = [
  "useful",
  "confusing",
  "generic",
  "stale",
  "bug_report"
] as const;

export type ReportFeedbackCode = (typeof reportFeedbackCodes)[number];

export const subscriptionFeedbackCodes = [
  "cancel_price",
  "cancel_low_value",
  "cancel_too_noisy",
  "cancel_other"
] as const;

export type SubscriptionFeedbackCode = (typeof subscriptionFeedbackCodes)[number];

export const feedbackSeverityLevels = ["normal", "high", "blocker"] as const;

export type FeedbackSeverity = (typeof feedbackSeverityLevels)[number];

export const feedbackTriageStatuses = [
  "new",
  "reviewed",
  "routed",
  "resolved",
  "dismissed"
] as const;

export type FeedbackTriageStatus = (typeof feedbackTriageStatuses)[number];

export const feedbackRouteStatuses = ["pending", "routed", "not_applicable"] as const;

export type FeedbackRouteStatus = (typeof feedbackRouteStatuses)[number];

export interface ReportFeedbackSubmission {
  report_id: string;
  ticker?: string;
  code: ReportFeedbackCode;
  severity?: FeedbackSeverity;
  source_surface: string;
  message?: string;
}

export interface SubscriptionFeedbackSubmission {
  code: SubscriptionFeedbackCode;
  severity?: FeedbackSeverity;
  source_surface: string;
  message?: string;
}

export interface UserFeedbackQueueItem {
  id: string;
  user_id: string;
  feedback_type: "report" | "subscription";
  code: ReportFeedbackCode | SubscriptionFeedbackCode;
  severity: FeedbackSeverity;
  source_surface: string;
  user_tier: SubscriptionTier;
  report_id?: string;
  ticker?: string;
  message: string;
  triage_status: FeedbackTriageStatus;
  route_status: FeedbackRouteStatus;
  triage_owner?: string;
  triaged_at?: string;
  created_at: string;
  updated_at: string;
}

export const reportFeedbackSubmissionSchema = {
  $id: "ReportFeedbackSubmission",
  type: "object",
  additionalProperties: false,
  required: ["report_id", "code", "source_surface"],
  properties: {
    report_id: { type: "string", minLength: 1 },
    ticker: { type: "string" },
    code: { type: "string", enum: reportFeedbackCodes },
    severity: { type: "string", enum: feedbackSeverityLevels },
    source_surface: { type: "string", minLength: 1 },
    message: { type: "string" }
  }
} as const;

export const subscriptionFeedbackSubmissionSchema = {
  $id: "SubscriptionFeedbackSubmission",
  type: "object",
  additionalProperties: false,
  required: ["code", "source_surface"],
  properties: {
    code: { type: "string", enum: subscriptionFeedbackCodes },
    severity: { type: "string", enum: feedbackSeverityLevels },
    source_surface: { type: "string", minLength: 1 },
    message: { type: "string" }
  }
} as const;
