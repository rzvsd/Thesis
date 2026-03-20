import type { AnalysisReport, AnalysisRequest } from "../../../packages/contracts/src";

export type JobType = "deep_dive" | "market_pulse";
export type JobStatus = "queued" | "running" | "complete" | "failed";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  verifiedAt?: string;
}

export interface VerificationTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  consumedAt?: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
}

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
}

export interface ReportRecord {
  id: string;
  jobId: string;
  type: JobType;
  ticker?: string;
  schemaVersion: string;
  artifactKey: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface AuditEventRecord {
  id: string;
  userId?: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface InternalClaimResponse {
  job: JobRecord;
  analysisRequest: AnalysisRequest;
}

export interface InternalCompleteRequest {
  report: AnalysisReport;
}
