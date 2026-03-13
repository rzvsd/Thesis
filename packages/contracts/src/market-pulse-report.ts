import type { ConfidenceBlock } from "./analysis-report";
import type { ReportSection } from "./report-section";
import { confidenceBlockSchema } from "./analysis-report";
import { reportSectionSchema } from "./report-section";

export interface MarketPulseSections {
  market_moves: ReportSection;
  macro_releases: ReportSection;
  rates_fx_commodities: ReportSection;
  news_summary: ReportSection;
  uncertainty_flags: ReportSection;
  watchlist_overlay?: ReportSection;
}

export interface MarketPulseReport {
  report_id: string;
  schema_version: string;
  generated_at: string;
  cycle_start: string;
  cycle_end: string;
  sections: MarketPulseSections;
  flags: string[];
  confidence: ConfidenceBlock;
}

export const marketPulseReportSchema = {
  $id: "MarketPulseReport",
  type: "object",
  additionalProperties: false,
  required: [
    "report_id",
    "schema_version",
    "generated_at",
    "cycle_start",
    "cycle_end",
    "sections",
    "flags",
    "confidence"
  ],
  properties: {
    report_id: { type: "string" },
    schema_version: { type: "string" },
    generated_at: { type: "string" },
    cycle_start: { type: "string" },
    cycle_end: { type: "string" },
    sections: {
      type: "object",
      additionalProperties: false,
      required: [
        "market_moves",
        "macro_releases",
        "rates_fx_commodities",
        "news_summary",
        "uncertainty_flags"
      ],
      properties: {
        market_moves: reportSectionSchema,
        macro_releases: reportSectionSchema,
        rates_fx_commodities: reportSectionSchema,
        news_summary: reportSectionSchema,
        uncertainty_flags: reportSectionSchema,
        watchlist_overlay: reportSectionSchema
      }
    },
    flags: {
      type: "array",
      items: { type: "string" }
    },
    confidence: confidenceBlockSchema
  }
} as const;
