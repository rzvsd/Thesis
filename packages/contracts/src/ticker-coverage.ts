export type TickerCoverageSyncStatus = "success" | "partial" | "failed";
export type BackfillTier = 1 | 2 | 3;

export interface TickerCoverage {
  ticker: string;
  snapshot_count: number;
  transcript_count: number;
  latest_period: string | null;
  earliest_period: string | null;
  has_guidance: boolean;
  has_estimates: boolean;
  last_synced_at: string;
  last_sync_status: TickerCoverageSyncStatus;
  backfill_tier: BackfillTier;
}

export const tickerCoverageSchema = {
  $id: "TickerCoverage",
  type: "object",
  additionalProperties: false,
  required: [
    "ticker",
    "snapshot_count",
    "transcript_count",
    "latest_period",
    "earliest_period",
    "has_guidance",
    "has_estimates",
    "last_synced_at",
    "last_sync_status",
    "backfill_tier"
  ],
  properties: {
    ticker: { type: "string" },
    snapshot_count: { type: "number" },
    transcript_count: { type: "number" },
    latest_period: {
      oneOf: [{ type: "string" }, { type: "null" }]
    },
    earliest_period: {
      oneOf: [{ type: "string" }, { type: "null" }]
    },
    has_guidance: { type: "boolean" },
    has_estimates: { type: "boolean" },
    last_synced_at: { type: "string", format: "date-time" },
    last_sync_status: {
      type: "string",
      enum: ["success", "partial", "failed"]
    },
    backfill_tier: { type: "number", enum: [1, 2, 3] }
  }
} as const;
