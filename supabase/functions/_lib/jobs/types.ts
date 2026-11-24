// Shared types for the Deep Dive pipeline (M2). Shapes follow docs/rebuild/contract.md.

export type JobType = "deep_dive" | "market_pulse";
export type JobStatus = "queued" | "running" | "complete" | "failed";

// One row of app.jobs, in camelCase.
export interface JobRecord {
  id: string;
  type: JobType;
  status: JobStatus;
  userId?: string;
  ticker?: string;
  reportId?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  attempts: number;
  dispatchedAt?: string;
  runUrl?: string;
  checkedAt?: string;
  // Set when this job waits on another customer's open run for the same ticker instead of starting its own.
  followsJobId?: string;
}

// The bare body of POST /jobs and GET /jobs/:id.
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

// One row of app.reports, in camelCase.
export interface ReportRecord {
  id: string;
  jobId: string;
  type: JobType;
  ticker?: string;
  schemaVersion: string;
  artifactKey: string;
  fingerprint?: string;
  freshnessExpiresAt?: string;
  createdAt: string;
  isCurrent: boolean;
  llmUsage?: Record<string, unknown>;
}

export interface ReportSection {
  section_id?: string;
  title: string;
  body?: string;
  [key: string]: unknown;
}

// The Deep Dive report. The full shape lives in packages/contracts/src/analysis-report.ts.
// Only the fields the API reads are typed here; everything else passes through untouched.
export interface AnalysisReport {
  report_id: string;
  job_id: string;
  schema_version: string;
  type: JobType;
  ticker?: string;
  generated_at: string;
  sections: ReportSection[];
  issuer?: { name?: string; exchange?: string; [key: string]: unknown };
  signal?: { value?: string; reasons?: string[]; [key: string]: unknown };
  confidence?: { label?: string; score?: number; [key: string]: unknown };
  valuation?: { fair_value_mid?: number; [key: string]: unknown };
  // deno-lint-ignore no-explicit-any
  trust_metadata?: any;
  historical_context?: { latest_period?: string; [key: string]: unknown };
  // deno-lint-ignore no-explicit-any
  kill_switch_conditions?: any[];
  // deno-lint-ignore no-explicit-any
  name_relationships?: any[];
  // deno-lint-ignore no-explicit-any
  structural_context?: any;
  [key: string]: unknown;
}

// What POST /internal/jobs/:id/claim returns to the runner.
export interface AnalysisRequest {
  request_id: string;
  type: JobType;
  ticker?: string;
  user_id?: string;
  job_id: string;
  requested_at: string;
}
