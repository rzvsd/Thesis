import type { OfficialRetrievalMetadata } from "./official-source";
import { officialMissingFieldStateSchema, officialRetrievalMetadataSchema } from "./official-source";

export const marketTapeCoverageStates = ["full", "partial", "limited"] as const;
export type MarketTapeCoverageState = (typeof marketTapeCoverageStates)[number];

export const marketTapeDirections = ["up", "down", "flat"] as const;
export type MarketTapeDirection = (typeof marketTapeDirections)[number];

export const marketTapeInstrumentFamilies = [
  "core_index",
  "volatility",
  "rates",
  "commodity",
  "currency",
  "credit",
  "sector"
] as const;
export type MarketTapeInstrumentFamily = (typeof marketTapeInstrumentFamilies)[number];

export interface MarketTapeMove {
  instrument_id: string;
  label: string;
  family: MarketTapeInstrumentFamily;
  period: string;
  value?: number;
  previous_value?: number;
  daily_change?: number;
  daily_change_pct?: number;
  unit?: string;
  direction: MarketTapeDirection;
  retrieval: OfficialRetrievalMetadata;
  missing_fields: Array<Record<string, unknown>>;
}

export interface MarketTapeSectorLeadership {
  basket_id: string;
  leaders: MarketTapeMove[];
  laggards: MarketTapeMove[];
  spread_pct?: number;
  notable: boolean;
  note?: string;
}

export interface MarketTapePack {
  as_of: string;
  coverage_state: MarketTapeCoverageState;
  summary: string;
  indices: MarketTapeMove[];
  sector_leadership?: MarketTapeSectorLeadership;
  cross_asset: MarketTapeMove[];
  retrievals: OfficialRetrievalMetadata[];
  omissions: Array<{
    omission_id: string;
    family: MarketTapeInstrumentFamily | "registry";
    instrument_id?: string;
    reason_code: string;
    reason_text: string;
    blocking: boolean;
  }>;
}

export const marketTapeMoveSchema = {
  $id: "MarketTapeMove",
  type: "object",
  additionalProperties: false,
  required: [
    "instrument_id",
    "label",
    "family",
    "period",
    "direction",
    "retrieval",
    "missing_fields"
  ],
  properties: {
    instrument_id: { type: "string" },
    label: { type: "string" },
    family: {
      type: "string",
      enum: marketTapeInstrumentFamilies
    },
    period: { type: "string" },
    value: { type: "number" },
    previous_value: { type: "number" },
    daily_change: { type: "number" },
    daily_change_pct: { type: "number" },
    unit: { type: "string" },
    direction: {
      type: "string",
      enum: marketTapeDirections
    },
    retrieval: officialRetrievalMetadataSchema,
    missing_fields: {
      type: "array",
      items: officialMissingFieldStateSchema
    }
  }
} as const;

export const marketTapeSectorLeadershipSchema = {
  $id: "MarketTapeSectorLeadership",
  type: "object",
  additionalProperties: false,
  required: ["basket_id", "leaders", "laggards", "notable"],
  properties: {
    basket_id: { type: "string" },
    leaders: {
      type: "array",
      items: marketTapeMoveSchema
    },
    laggards: {
      type: "array",
      items: marketTapeMoveSchema
    },
    spread_pct: { type: "number" },
    notable: { type: "boolean" },
    note: { type: "string" }
  }
} as const;

export const marketTapePackSchema = {
  $id: "MarketTapePack",
  type: "object",
  additionalProperties: false,
  required: [
    "as_of",
    "coverage_state",
    "summary",
    "indices",
    "cross_asset",
    "retrievals",
    "omissions"
  ],
  properties: {
    as_of: { type: "string" },
    coverage_state: {
      type: "string",
      enum: marketTapeCoverageStates
    },
    summary: { type: "string" },
    indices: {
      type: "array",
      items: marketTapeMoveSchema
    },
    sector_leadership: marketTapeSectorLeadershipSchema,
    cross_asset: {
      type: "array",
      items: marketTapeMoveSchema
    },
    retrievals: {
      type: "array",
      items: officialRetrievalMetadataSchema
    },
    omissions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["omission_id", "family", "reason_code", "reason_text", "blocking"],
        properties: {
          omission_id: { type: "string" },
          family: {
            type: "string",
            enum: [...marketTapeInstrumentFamilies, "registry"]
          },
          instrument_id: { type: "string" },
          reason_code: { type: "string" },
          reason_text: { type: "string" },
          blocking: { type: "boolean" }
        }
      }
    }
  }
} as const;
