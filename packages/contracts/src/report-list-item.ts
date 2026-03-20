import type { JobType } from "./job-status-response";

export interface ReportListItem {
  report_id: string;
  job_id: string;
  type: JobType;
  ticker?: string;
  schema_version: string;
  created_at: string;
}

export const reportListItemSchema = {
  $id: "ReportListItem",
  type: "object",
  additionalProperties: false,
  required: ["report_id", "job_id", "type", "schema_version", "created_at"],
  properties: {
    report_id: { type: "string" },
    job_id: { type: "string" },
    type: { type: "string", enum: ["deep_dive", "market_pulse"] },
    ticker: { type: "string" },
    schema_version: { type: "string" },
    created_at: { type: "string", format: "date-time" }
  }
} as const;
