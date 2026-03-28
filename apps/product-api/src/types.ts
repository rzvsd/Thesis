import type {
  AnalysisReport,
  AnalysisRequest,
  MarketPulseReport
} from "../../../packages/contracts/src";
import type {
  TickerExchange,
  TickerListingStatus,
  TickerSearchResult
} from "../../../packages/contracts/src";

export type JobType = "deep_dive" | "market_pulse";
export type JobStatus = "queued" | "running" | "complete" | "failed";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  verifiedAt?: string;
  deviceToken?: string;
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
  cycleStart?: string;
  cycleEnd?: string;
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
  fingerprint?: string;
  freshnessExpiresAt?: string;
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

export interface TickerRegistryRecord {
  symbol: string;
  companyName: string;
  exchange: TickerExchange;
  listingStatus: TickerListingStatus;
  isSupported: boolean;
  sourceFeed: string;
  sourceUpdatedAt: string;
  lastSyncedAt: string;
  rawPayload: Record<string, unknown>;
}

export interface TickerRegistryUpsertInput {
  symbol: string;
  companyName: string;
  exchange: TickerExchange;
  listingStatus: TickerListingStatus;
  isSupported: boolean;
  sourceFeed: string;
  sourceUpdatedAt: string;
  lastSyncedAt: string;
  rawPayload?: Record<string, unknown>;
}

export interface TickerDeltaChange {
  type: "add" | "delete" | "name_change" | "symbol_change";
  symbol: string;
  companyName?: string;
  newSymbol?: string;
  newCompanyName?: string;
  exchange?: TickerExchange;
  sourceFeed: string;
  sourceUpdatedAt: string;
  rawPayload?: Record<string, unknown>;
}

export type { TickerSearchResult };

export interface InternalClaimResponse {
  job: JobRecord;
  analysisRequest: AnalysisRequest;
}

export interface InternalCompleteRequest {
  report: AnalysisReport;
}

export interface InternalPulseCompleteRequest {
  report: MarketPulseReport;
}
