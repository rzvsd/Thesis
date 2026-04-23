import type { ConfidenceBlock } from "./analysis-report";
import type { AnalysisReportEvidenceContext } from "./analysis-report-context";
import type { MacroStressSnapshot } from "./macro-stress";
import type { ReportSection } from "./report-section";
import type { StructuralContextPack } from "./structural-context";
import { confidenceBlockSchema } from "./analysis-report";
import { analysisReportEvidenceContextSchema } from "./analysis-report-context";
import { macroStressSnapshotSchema } from "./macro-stress";
import { reportSectionSchema } from "./report-section";
import { structuralContextPackSchema } from "./structural-context";

export interface MarketPulseSections {
  macro_stress: ReportSection;
  official_macro_pressure: ReportSection;
  canonical_events: ReportSection;
  bounded_context: ReportSection;
  uncertainty_flags: ReportSection;
  no_material_change?: ReportSection;
  market_moves?: ReportSection;
  macro_releases?: ReportSection;
  rates_fx_commodities?: ReportSection;
  news_summary?: ReportSection;
  watchlist_overlay?: ReportSection;
}

export interface MarketPulseReport {
  report_id: string;
  schema_version: string;
  generated_at: string;
  cycle_start: string;
  cycle_end: string;
  macro_stress: MacroStressSnapshot;
  context?: AnalysisReportEvidenceContext;
  structural_context?: StructuralContextPack;
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
    "macro_stress",
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
    macro_stress: macroStressSnapshotSchema,
    context: analysisReportEvidenceContextSchema,
    structural_context: structuralContextPackSchema,
    sections: {
      type: "object",
      additionalProperties: false,
      required: [
        "macro_stress",
        "official_macro_pressure",
        "canonical_events",
        "bounded_context",
        "uncertainty_flags"
      ],
      properties: {
        macro_stress: reportSectionSchema,
        official_macro_pressure: reportSectionSchema,
        canonical_events: reportSectionSchema,
        bounded_context: reportSectionSchema,
        market_moves: reportSectionSchema,
        macro_releases: reportSectionSchema,
        rates_fx_commodities: reportSectionSchema,
        news_summary: reportSectionSchema,
        uncertainty_flags: reportSectionSchema,
        no_material_change: reportSectionSchema,
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
