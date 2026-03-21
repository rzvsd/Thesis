export type TickerExchange = "NASDAQ" | "NYSE";
export type TickerListingStatus = "active" | "delisted" | "suspended";

export interface TickerRegistryEntry {
  symbol: string;
  company_name: string;
  exchange: TickerExchange;
  listing_status: TickerListingStatus;
  is_supported: boolean;
  source_feed: string;
  source_updated_at: string;
  last_synced_at: string;
}

export const tickerRegistryEntrySchema = {
  $id: "TickerRegistryEntry",
  type: "object",
  additionalProperties: false,
  required: [
    "symbol",
    "company_name",
    "exchange",
    "listing_status",
    "is_supported",
    "source_feed",
    "source_updated_at",
    "last_synced_at"
  ],
  properties: {
    symbol: {
      type: "string",
      minLength: 1,
      maxLength: 12,
      pattern: "^[A-Za-z.\\-]+$"
    },
    company_name: {
      type: "string",
      minLength: 1,
      maxLength: 255
    },
    exchange: {
      type: "string",
      enum: ["NASDAQ", "NYSE"]
    },
    listing_status: {
      type: "string",
      enum: ["active", "delisted", "suspended"]
    },
    is_supported: {
      type: "boolean"
    },
    source_feed: {
      type: "string",
      minLength: 1,
      maxLength: 128
    },
    source_updated_at: {
      type: "string",
      format: "date-time"
    },
    last_synced_at: {
      type: "string",
      format: "date-time"
    }
  }
} as const;
