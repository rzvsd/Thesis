import type { TickerExchange } from "./ticker-registry-entry";

export interface TickerSearchResult {
  symbol: string;
  company_name: string;
  exchange: TickerExchange;
}

export const tickerSearchResultSchema = {
  $id: "TickerSearchResult",
  type: "object",
  additionalProperties: false,
  required: ["symbol", "company_name", "exchange"],
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
    }
  }
} as const;
