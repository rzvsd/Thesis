export type JobType = "deep_dive" | "market_pulse";
export type JobStatus = "queued" | "running" | "complete" | "failed";

export interface JobStatusResponse {
  job_id: string;
  type: JobType;
  status: JobStatus;
  ticker?: string;
  report_id?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

export const jobStatusResponseSchema = {
  $id: "JobStatusResponse",
  type: "object",
  additionalProperties: false,
  required: ["job_id", "type", "status", "created_at"],
  properties: {
    job_id: { type: "string" },
    type: { type: "string", enum: ["deep_dive", "market_pulse"] },
    status: { type: "string", enum: ["queued", "running", "complete", "failed"] },
    ticker: { type: "string" },
    report_id: { type: "string" },
    created_at: { type: "string", format: "date-time" },
    started_at: { type: "string", format: "date-time" },
    completed_at: { type: "string", format: "date-time" },
    error_message: { type: "string" }
  }
} as const;
