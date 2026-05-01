import type { ConfidenceBlock } from "./analysis-report";
import type { AnalysisReportEvidenceContext } from "./analysis-report-context";
import type { MacroStressSnapshot } from "./macro-stress";
import type { MarketPulseEditorialGeneration } from "./market-pulse-editorial-generation";
import type { MarketPulseEditorialIssue } from "./market-pulse-editorial";
import type { MarketPulseMacroNewsPack } from "./market-pulse-macro-news";
import type { MarketPulseMorningEdition } from "./market-pulse-morning-edition";
import type { MarketTapePack } from "./market-tape";
import type { ReportSection } from "./report-section";
import type { StructuralContextPack } from "./structural-context";
import type { UserResearchState } from "./user-research-state";
import { confidenceBlockSchema } from "./analysis-report";
import { analysisReportEvidenceContextSchema } from "./analysis-report-context";
import { macroStressSnapshotSchema } from "./macro-stress";
import { marketPulseEditorialGenerationSchema } from "./market-pulse-editorial-generation";
import { marketPulseEditorialIssueSchema } from "./market-pulse-editorial";
import { marketPulseMacroNewsPackSchema } from "./market-pulse-macro-news";
import { marketPulseMorningEditionSchema } from "./market-pulse-morning-edition";
import { marketTapePackSchema } from "./market-tape";
import { reportSectionSchema } from "./report-section";
import { structuralContextPackSchema } from "./structural-context";
import { userResearchStateSchema } from "./user-research-state";

export interface MarketPulseSections {
  macro_stress: ReportSection;
  market_tape: ReportSection;
  official_macro_pressure: ReportSection;
  canonical_events: ReportSection;
  bounded_context: ReportSection;
  uncertainty_flags: ReportSection;
  what_changed?: ReportSection;
  why_it_matters?: ReportSection;
  what_to_watch?: ReportSection;
  signal_vs_noise?: ReportSection;
  macro_news?: ReportSection;
  market_board?: ReportSection;
  portfolio_radar?: ReportSection;
  today_catalysts?: ReportSection;
  headline_digest?: ReportSection;
  sector_pulse?: ReportSection;
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
  market_tape?: MarketTapePack;
  editorial_issue?: MarketPulseEditorialIssue;
  editorial_generation?: MarketPulseEditorialGeneration;
  macro_news?: MarketPulseMacroNewsPack;
  morning_edition?: MarketPulseMorningEdition;
  context?: AnalysisReportEvidenceContext;
  structural_context?: StructuralContextPack;
  user_research_state?: UserResearchState;
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
    market_tape: marketTapePackSchema,
    editorial_issue: marketPulseEditorialIssueSchema,
    editorial_generation: marketPulseEditorialGenerationSchema,
    macro_news: marketPulseMacroNewsPackSchema,
    morning_edition: marketPulseMorningEditionSchema,
    context: analysisReportEvidenceContextSchema,
    structural_context: structuralContextPackSchema,
    user_research_state: userResearchStateSchema,
    sections: {
      type: "object",
      additionalProperties: false,
      required: [
        "macro_stress",
        "market_tape",
        "official_macro_pressure",
        "canonical_events",
        "bounded_context",
        "uncertainty_flags"
      ],
      properties: {
        macro_stress: reportSectionSchema,
        market_tape: reportSectionSchema,
        official_macro_pressure: reportSectionSchema,
        canonical_events: reportSectionSchema,
        bounded_context: reportSectionSchema,
        what_changed: reportSectionSchema,
        why_it_matters: reportSectionSchema,
        what_to_watch: reportSectionSchema,
        signal_vs_noise: reportSectionSchema,
        macro_news: reportSectionSchema,
        market_board: reportSectionSchema,
        portfolio_radar: reportSectionSchema,
        today_catalysts: reportSectionSchema,
        headline_digest: reportSectionSchema,
        sector_pulse: reportSectionSchema,
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
