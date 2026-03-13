export type HealthStatus = "ok";

export interface HealthPayload {
  status: HealthStatus;
}

export type ReportType = "deep_dive" | "market_pulse";
