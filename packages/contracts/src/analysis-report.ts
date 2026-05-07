import type { EvidenceItem } from "./evidence-item";
import type { FilingIntelligenceBlock } from "./filing-intelligence";
import type { FinancialIndicatorsBlock } from "./financial-indicators";
import type { KillSwitchConditionDraft } from "./kill-switch-rule";
import type { NameRelationshipDraft } from "./name-relationship";
import type { ReportSection } from "./report-section";
import type { StructuralContextPack } from "./structural-context";
import { evidenceItemSchema } from "./evidence-item";
import { filingIntelligenceBlockSchema } from "./filing-intelligence";
import { financialIndicatorsBlockSchema } from "./financial-indicators";
import { killSwitchConditionDraftSchema } from "./kill-switch-rule";
import { nameRelationshipDraftSchema } from "./name-relationship";
import { reportSectionSchema } from "./report-section";
import { structuralContextPackSchema } from "./structural-context";

export type ConfidenceLabel = "high" | "medium" | "low" | "insufficient_data";
export type SignalValue = "positive" | "neutral" | "negative" | "no_signal";

export interface ConfidenceBlock {
  score: number;
  label: ConfidenceLabel;
  limiting_factors: string[];
}

export interface ReportSignal {
  value: SignalValue;
  reasons: string[];
  evidence: EvidenceItem[];
}

export interface HistoricalContextBlock {
  latest_period?: string;
  prior_quarter_period?: string;
  year_ago_period?: string;
  transcript_period?: string;
  financial_snapshot_count: number;
  transcript_count: number;
  transcript_available: boolean;
  missing_reasons: string[];
}

export interface ValuationAssumptions {
  methodology: "deterministic_dcf";
  projection_years: number;
  terminal_growth_rate: number;
  wacc: number;
  beta?: number;
  effective_tax_rate?: number;
  shares_outstanding?: number;
}

export interface ValuationBlock {
  fair_value_mid?: number;
  fair_value_low?: number;
  fair_value_high?: number;
  spot_price?: number;
  implied_upside_pct?: number;
  assumptions: ValuationAssumptions;
  degraded_reason?: string;
}

export type TrustFreshnessState = "fresh" | "degraded" | "stale";
export type TrustContradictionState = "none" | "present";
export type TrustValuationState = "available" | "degraded" | "omitted";
export type TrustThesisDriftStatus = "available" | "unavailable";

export interface TrustQuoteProvenance {
  quote: string;
  source_name: string;
  source_type: EvidenceItem["source_type"];
  source_period?: string;
  transcript_id?: string;
  source_url?: string;
  retrieved_at?: string;
}

export interface TrustContradiction {
  id: string;
  description: string;
  severity: "low" | "medium" | "high";
}

export interface TrustThesisDriftSummary {
  status: TrustThesisDriftStatus;
  summary: string;
  reasons: string[];
  comparable_report_id?: string;
  comparable_generated_at?: string;
  comparable_schema_version?: string;
}

export interface TrustMetadata {
  generated_at: string;
  freshness_state: TrustFreshnessState;
  evidence_count: number;
  contradiction_state: TrustContradictionState;
  contradictions: TrustContradiction[];
  valuation_state: TrustValuationState;
  missing_data_notes: string[];
  quote_provenance: TrustQuoteProvenance[];
  thesis_drift: TrustThesisDriftSummary;
}

export type StoryStanceLabel = "positive" | "neutral" | "negative" | "watch";
export type DeepDiveChangeDirection = "up" | "down" | "mixed" | "watch";
export type DeepDiveImpactLevel = "high" | "medium" | "low";

export interface StoryHeaderBlock {
  headline: string;
  thesis_summary: string;
  why_now: string;
  reader_takeaway: string;
  stance_label: StoryStanceLabel;
}

export interface TopChangeItem {
  title: string;
  direction: DeepDiveChangeDirection;
  impact_level: DeepDiveImpactLevel;
  why_it_changed: string;
  why_it_matters: string;
}

export interface ChangeSummaryBlock {
  previous_view: string;
  current_view: string;
  top_changes: TopChangeItem[];
}

export interface MetricDeltaPanelItem {
  label: string;
  current_value?: number;
  reference_value?: number;
  delta_pct?: number;
  basis: "qoq" | "yoy" | "absolute";
  direction: "up" | "down" | "flat" | "unavailable";
  note?: string;
}

export interface TimelinePanelPoint {
  label: string;
  value: string;
  emphasis?: "current" | "reference" | "milestone";
}

export interface EvidenceLadderRung {
  label: string;
  count: number;
  tone: "strong" | "moderate" | "light";
}

export interface ValuationBridgePoint {
  label: string;
  value: number;
  tone: "spot" | "low" | "mid" | "high";
}

interface DeepDiveVisualPanelBase {
  type:
    | "metric_delta"
    | "timeline"
    | "range_band"
    | "trust_scorecard"
    | "evidence_ladder"
    | "valuation_bridge"
    | "scenario_compare";
  title: string;
  eyebrow?: string;
  summary?: string;
}

export interface MetricDeltaVisualPanel extends DeepDiveVisualPanelBase {
  type: "metric_delta";
  metrics: MetricDeltaPanelItem[];
}

export interface TimelineVisualPanel extends DeepDiveVisualPanelBase {
  type: "timeline";
  points: TimelinePanelPoint[];
}

export interface RangeBandVisualPanel extends DeepDiveVisualPanelBase {
  type: "range_band";
  low_value?: number;
  mid_value?: number;
  high_value?: number;
  reference_value?: number;
  value_label?: string;
  reference_label?: string;
}

export interface TrustScorecardVisualPanel extends DeepDiveVisualPanelBase {
  type: "trust_scorecard";
  freshness_state?: TrustFreshnessState;
  contradiction_state?: TrustContradictionState;
  valuation_state?: TrustValuationState;
  evidence_count?: number;
}

export interface EvidenceLadderVisualPanel extends DeepDiveVisualPanelBase {
  type: "evidence_ladder";
  rungs: EvidenceLadderRung[];
}

export interface ValuationBridgeVisualPanel extends DeepDiveVisualPanelBase {
  type: "valuation_bridge";
  points: ValuationBridgePoint[];
}

export interface ScenarioCompareVisualPanel extends DeepDiveVisualPanelBase {
  type: "scenario_compare";
  base_label: string;
  scenario_label: string;
  base_value?: number;
  scenario_value?: number;
  delta_text?: string;
}

export type DeepDiveVisualPanel =
  | MetricDeltaVisualPanel
  | TimelineVisualPanel
  | RangeBandVisualPanel
  | TrustScorecardVisualPanel
  | EvidenceLadderVisualPanel
  | ValuationBridgeVisualPanel
  | ScenarioCompareVisualPanel;

export interface DeepDiveExplainers {
  signal: string;
  confidence: string;
  freshness: string;
  valuation: string;
  omissions: string;
}

export interface CoverageTruthBlock {
  summary: string;
  covered: string[];
  missing: string[];
}

export type InvestmentMemoSectionId =
  | "investment_thesis"
  | "what_changed"
  | "business_quality"
  | "valuation"
  | "risks";

export interface InvestmentMemoSection {
  section_id: InvestmentMemoSectionId;
  title: string;
  narrative: string;
  key_points: string[];
}

export type MemoClaimSupportType = "metric" | "evidence" | "omission";

export interface MemoClaimSupportRef {
  support_type: MemoClaimSupportType;
  ref_id: string;
  summary: string;
}

export interface InvestmentMemoClaim {
  claim_id: string;
  section_id: InvestmentMemoSectionId;
  statement: string;
  materiality: "material" | "context";
  supports: MemoClaimSupportRef[];
}

export interface InvestmentMemoBlock {
  prompt_version: string;
  generation_mode: "deterministic_fixture" | "live_prompt" | "fallback";
  company_angle: string;
  decision_question: string;
  sections: InvestmentMemoSection[];
  material_claims: InvestmentMemoClaim[];
  unsupported_claims: string[];
  sparse_data_honesty_note: string;
}

export type DueDiligenceSectionId =
  | "financial_analysis"
  | "competitive_positioning"
  | "management_and_governance"
  | "risks_and_challenges"
  | "growth_opportunities_and_outlook"
  | "valuation_and_thesis_stance";

export type DueDiligenceCoverageState = "full" | "partial" | "limited";

export interface DueDiligenceSection {
  section_id: DueDiligenceSectionId;
  title: string;
  summary: string;
  narrative_paragraphs: string[];
  key_points: string[];
  evidence_refs: string[];
  omissions: string[];
  coverage_state: DueDiligenceCoverageState;
}

export interface DueDiligenceBlock {
  prompt_version: string;
  generation_mode: "deterministic_fixture" | "live_prompt" | "fallback";
  sections: DueDiligenceSection[];
}

export interface IssuerBlock {
  name: string;
  exchange?: string;
  currency?: string;
  domicile_country?: string;
  region?: string;
  sector?: string;
  industry?: string;
}

export type FinancialMetricUnit = "currency" | "pct" | "ratio" | "count";
export type FinancialMetricDirection =
  | "improving"
  | "deteriorating"
  | "flat"
  | "unavailable";
export type FinancialMetricStatus = "available" | "omitted";

export interface FinancialHistoryRow {
  period: string;
  period_type: "annual" | "quarterly";
  fiscal_year: number;
  fiscal_quarter?: number;
  revenue?: number;
  gross_margin?: number;
  operating_margin?: number;
  net_income?: number;
  free_cash_flow?: number;
  debt_total?: number;
  cash_and_equivalents?: number;
  shares_outstanding?: number;
}

export interface FinancialDerivedMetric {
  key: string;
  label: string;
  value?: number;
  unit: FinancialMetricUnit;
  status: FinancialMetricStatus;
  direction: FinancialMetricDirection;
  note?: string;
}

export interface FinancialOmission {
  code: string;
  label: string;
  reason: string;
  impacts: string[];
}

export interface FinancialAnalysisBlock {
  annual_history: FinancialHistoryRow[];
  quarterly_history: FinancialHistoryRow[];
  trend_metrics: FinancialDerivedMetric[];
  quality_metrics: FinancialDerivedMetric[];
  omissions: FinancialOmission[];
}

export type ValueDisciplineSignalFamily =
  | "profitability"
  | "leverage_liquidity"
  | "operating_efficiency"
  | "earnings_quality"
  | "capital_discipline";

export type ValueDisciplineSignalStatus = "pass" | "fail" | "unavailable";

export interface ValueDisciplineSignal {
  key: string;
  label: string;
  family: ValueDisciplineSignalFamily;
  status: ValueDisciplineSignalStatus;
  reason: string;
  value?: number;
}

export type ValueDisciplineContextLabel =
  | "quality_mega_cap"
  | "value_cyclical"
  | "distressed"
  | "financial"
  | "sparse_data"
  | "general";

export interface ValueTrapWarning {
  triggered: boolean;
  summary: string;
  reason_codes: string[];
}

export interface ValueDisciplineBlock {
  score: number;
  max_score: number;
  available_signals: number;
  completeness: "complete" | "partial" | "insufficient_data";
  context_label: ValueDisciplineContextLabel;
  interpretation: string;
  missing_signals: string[];
  does_not_prove: string;
  signals: ValueDisciplineSignal[];
  value_trap_warning: ValueTrapWarning;
}

export interface AnalysisReport {
  report_id: string;
  job_id: string;
  schema_version: string;
  type: "deep_dive" | "market_pulse";
  ticker?: string;
  issuer?: IssuerBlock;
  generated_at: string;
  confidence: ConfidenceBlock;
  signal?: ReportSignal;
  historical_context?: HistoricalContextBlock;
  valuation?: ValuationBlock;
  trust_metadata?: TrustMetadata;
  kill_switch_conditions?: KillSwitchConditionDraft[];
  name_relationships?: NameRelationshipDraft[];
  story_header?: StoryHeaderBlock;
  change_summary?: ChangeSummaryBlock;
  visual_panels?: DeepDiveVisualPanel[];
  explainers?: DeepDiveExplainers;
  watch_items?: string[];
  coverage_truth?: CoverageTruthBlock;
  investment_memo?: InvestmentMemoBlock;
  due_diligence?: DueDiligenceBlock;
  filing_intelligence?: FilingIntelligenceBlock;
  financial_indicators?: FinancialIndicatorsBlock;
  structural_context?: StructuralContextPack;
  financial_analysis?: FinancialAnalysisBlock;
  value_discipline?: ValueDisciplineBlock;
  sections: ReportSection[];
  flags: string[];
  data_sources: string[];
}

export const confidenceBlockSchema = {
  $id: "ConfidenceBlock",
  type: "object",
  additionalProperties: false,
  required: ["score", "label", "limiting_factors"],
  properties: {
    score: { type: "number" },
    label: {
      type: "string",
      enum: ["high", "medium", "low", "insufficient_data"]
    },
    limiting_factors: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;

export const reportSignalSchema = {
  $id: "ReportSignal",
  type: "object",
  additionalProperties: false,
  required: ["value", "reasons", "evidence"],
  properties: {
    value: {
      type: "string",
      enum: ["positive", "neutral", "negative", "no_signal"]
    },
    reasons: {
      type: "array",
      items: { type: "string" }
    },
    evidence: {
      type: "array",
      items: evidenceItemSchema
    }
  }
} as const;

export const dueDiligenceSectionSchema = {
  $id: "DueDiligenceSection",
  type: "object",
  additionalProperties: false,
  anyOf: [
    {
      properties: {
        evidence_refs: {
          type: "array",
          minItems: 1,
          items: { type: "string" }
        }
      }
    },
    {
      properties: {
        omissions: {
          type: "array",
          minItems: 1,
          items: { type: "string" }
        }
      }
    }
  ],
  required: [
    "section_id",
    "title",
    "summary",
    "narrative_paragraphs",
    "key_points",
    "evidence_refs",
    "omissions",
    "coverage_state"
  ],
  properties: {
    section_id: {
      type: "string",
      enum: [
        "financial_analysis",
        "competitive_positioning",
        "management_and_governance",
        "risks_and_challenges",
        "growth_opportunities_and_outlook",
        "valuation_and_thesis_stance"
      ]
    },
    title: { type: "string" },
    summary: { type: "string" },
    narrative_paragraphs: {
      type: "array",
      minItems: 1,
      items: { type: "string" }
    },
    key_points: {
      type: "array",
      items: { type: "string" }
    },
    evidence_refs: {
      type: "array",
      items: { type: "string" }
    },
    omissions: {
      type: "array",
      items: { type: "string" }
    },
    coverage_state: {
      type: "string",
      enum: ["full", "partial", "limited"]
    }
  }
} as const;

export const dueDiligenceBlockSchema = {
  $id: "DueDiligenceBlock",
  type: "object",
  additionalProperties: false,
  required: ["prompt_version", "generation_mode", "sections"],
  properties: {
    prompt_version: { type: "string" },
    generation_mode: {
      type: "string",
      enum: ["deterministic_fixture", "live_prompt", "fallback"]
    },
    sections: {
      type: "array",
      minItems: 1,
      items: dueDiligenceSectionSchema
    }
  }
} as const;

export const analysisReportSchema = {
  $id: "AnalysisReport",
  type: "object",
  additionalProperties: false,
  required: [
    "report_id",
    "job_id",
    "schema_version",
    "type",
    "generated_at",
    "confidence",
    "sections",
    "flags",
    "data_sources"
  ],
  properties: {
    report_id: { type: "string" },
    job_id: { type: "string" },
    schema_version: { type: "string" },
    type: { type: "string", enum: ["deep_dive", "market_pulse"] },
    ticker: { type: "string" },
    issuer: {
      type: "object",
      additionalProperties: false,
      required: ["name"],
      properties: {
        name: { type: "string" },
        exchange: { type: "string" },
        currency: { type: "string" },
        domicile_country: { type: "string" },
        region: { type: "string" },
        sector: { type: "string" },
        industry: { type: "string" }
      }
    },
    generated_at: { type: "string" },
    confidence: confidenceBlockSchema,
    signal: reportSignalSchema,
    historical_context: {
      type: "object",
      additionalProperties: false,
      required: [
        "financial_snapshot_count",
        "transcript_count",
        "transcript_available",
        "missing_reasons"
      ],
      properties: {
        latest_period: { type: "string" },
        prior_quarter_period: { type: "string" },
        year_ago_period: { type: "string" },
        transcript_period: { type: "string" },
        financial_snapshot_count: { type: "number" },
        transcript_count: { type: "number" },
        transcript_available: { type: "boolean" },
        missing_reasons: {
          type: "array",
          items: { type: "string" }
        }
      }
    },
    valuation: {
      type: "object",
      additionalProperties: false,
      required: ["assumptions"],
      properties: {
        fair_value_mid: { type: "number" },
        fair_value_low: { type: "number" },
        fair_value_high: { type: "number" },
        spot_price: { type: "number" },
        implied_upside_pct: { type: "number" },
        degraded_reason: { type: "string" },
        assumptions: {
          type: "object",
          additionalProperties: false,
          required: [
            "methodology",
            "projection_years",
            "terminal_growth_rate",
            "wacc"
          ],
          properties: {
            methodology: {
              type: "string",
              enum: ["deterministic_dcf"]
            },
            projection_years: { type: "number" },
            terminal_growth_rate: { type: "number" },
            wacc: { type: "number" },
            beta: { type: "number" },
            effective_tax_rate: { type: "number" },
            shares_outstanding: { type: "number" }
          }
        }
      }
    },
    trust_metadata: {
      type: "object",
      additionalProperties: false,
      required: [
        "generated_at",
        "freshness_state",
        "evidence_count",
        "contradiction_state",
        "contradictions",
        "valuation_state",
        "missing_data_notes",
        "quote_provenance",
        "thesis_drift"
      ],
      properties: {
        generated_at: { type: "string" },
        freshness_state: {
          type: "string",
          enum: ["fresh", "degraded", "stale"]
        },
        evidence_count: { type: "number" },
        contradiction_state: {
          type: "string",
          enum: ["none", "present"]
        },
        contradictions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "description", "severity"],
            properties: {
              id: { type: "string" },
              description: { type: "string" },
              severity: {
                type: "string",
                enum: ["low", "medium", "high"]
              }
            }
          }
        },
        valuation_state: {
          type: "string",
          enum: ["available", "degraded", "omitted"]
        },
        missing_data_notes: {
          type: "array",
          items: { type: "string" }
        },
        quote_provenance: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["quote", "source_name", "source_type"],
            properties: {
              quote: { type: "string" },
              source_name: { type: "string" },
              source_type: {
                type: "string",
                enum: ["filing", "article", "financial_data", "macro_data"]
              },
              source_period: { type: "string" },
              transcript_id: { type: "string" },
              source_url: { type: "string" },
              retrieved_at: { type: "string" }
            }
          }
        },
        thesis_drift: {
          type: "object",
          additionalProperties: false,
          required: ["status", "summary", "reasons"],
          properties: {
            status: {
              type: "string",
              enum: ["available", "unavailable"]
            },
            summary: { type: "string" },
            reasons: {
              type: "array",
              items: { type: "string" }
            },
            comparable_report_id: { type: "string" },
            comparable_generated_at: { type: "string" },
            comparable_schema_version: { type: "string" }
          }
        }
      }
    },
    kill_switch_conditions: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: killSwitchConditionDraftSchema
    },
    name_relationships: {
      type: "array",
      items: nameRelationshipDraftSchema
    },
    story_header: {
      type: "object",
      additionalProperties: false,
      required: [
        "headline",
        "thesis_summary",
        "why_now",
        "reader_takeaway",
        "stance_label"
      ],
      properties: {
        headline: { type: "string" },
        thesis_summary: { type: "string" },
        why_now: { type: "string" },
        reader_takeaway: { type: "string" },
        stance_label: {
          type: "string",
          enum: ["positive", "neutral", "negative", "watch"]
        }
      }
    },
    change_summary: {
      type: "object",
      additionalProperties: false,
      required: ["previous_view", "current_view", "top_changes"],
      properties: {
        previous_view: { type: "string" },
        current_view: { type: "string" },
        top_changes: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "title",
              "direction",
              "impact_level",
              "why_it_changed",
              "why_it_matters"
            ],
            properties: {
              title: { type: "string" },
              direction: {
                type: "string",
                enum: ["up", "down", "mixed", "watch"]
              },
              impact_level: {
                type: "string",
                enum: ["high", "medium", "low"]
              },
              why_it_changed: { type: "string" },
              why_it_matters: { type: "string" }
            }
          }
        }
      }
    },
    visual_panels: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "title"],
        properties: {
          type: {
            type: "string",
            enum: [
              "metric_delta",
              "timeline",
              "range_band",
              "trust_scorecard",
              "evidence_ladder",
              "valuation_bridge",
              "scenario_compare"
            ]
          },
          title: { type: "string" },
          eyebrow: { type: "string" },
          summary: { type: "string" },
          metrics: { type: "array" },
          points: { type: "array" },
          rungs: { type: "array" },
          low_value: { type: "number" },
          mid_value: { type: "number" },
          high_value: { type: "number" },
          reference_value: { type: "number" },
          value_label: { type: "string" },
          reference_label: { type: "string" },
          freshness_state: {
            type: "string",
            enum: ["fresh", "degraded", "stale"]
          },
          contradiction_state: {
            type: "string",
            enum: ["none", "present"]
          },
          valuation_state: {
            type: "string",
            enum: ["available", "degraded", "omitted"]
          },
          evidence_count: { type: "number" },
          base_label: { type: "string" },
          scenario_label: { type: "string" },
          base_value: { type: "number" },
          scenario_value: { type: "number" },
          delta_text: { type: "string" }
        }
      }
    },
    explainers: {
      type: "object",
      additionalProperties: false,
      required: ["signal", "confidence", "freshness", "valuation", "omissions"],
      properties: {
        signal: { type: "string" },
        confidence: { type: "string" },
        freshness: { type: "string" },
        valuation: { type: "string" },
        omissions: { type: "string" }
      }
    },
    watch_items: {
      type: "array",
      items: { type: "string" }
    },
    coverage_truth: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "covered", "missing"],
      properties: {
        summary: { type: "string" },
        covered: {
          type: "array",
          items: { type: "string" }
        },
        missing: {
          type: "array",
          items: { type: "string" }
        }
      }
    },
    investment_memo: {
      type: "object",
      additionalProperties: false,
      required: [
        "prompt_version",
        "generation_mode",
        "company_angle",
        "decision_question",
        "sections",
        "material_claims",
        "unsupported_claims",
        "sparse_data_honesty_note"
      ],
      properties: {
        prompt_version: { type: "string" },
        generation_mode: {
          type: "string",
          enum: ["deterministic_fixture", "live_prompt", "fallback"]
        },
        company_angle: { type: "string" },
        decision_question: { type: "string" },
        sections: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["section_id", "title", "narrative", "key_points"],
            properties: {
              section_id: {
                type: "string",
                enum: [
                  "investment_thesis",
                  "what_changed",
                  "business_quality",
                  "valuation",
                  "risks"
                ]
              },
              title: { type: "string" },
              narrative: { type: "string" },
              key_points: {
                type: "array",
                items: { type: "string" }
              }
            }
          }
        },
        material_claims: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["claim_id", "section_id", "statement", "materiality", "supports"],
            properties: {
              claim_id: { type: "string" },
              section_id: {
                type: "string",
                enum: [
                  "investment_thesis",
                  "what_changed",
                  "business_quality",
                  "valuation",
                  "risks"
                ]
              },
              statement: { type: "string" },
              materiality: {
                type: "string",
                enum: ["material", "context"]
              },
              supports: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["support_type", "ref_id", "summary"],
                  properties: {
                    support_type: {
                      type: "string",
                      enum: ["metric", "evidence", "omission"]
                    },
                    ref_id: { type: "string" },
                    summary: { type: "string" }
                  }
                }
              }
            }
          }
        },
        unsupported_claims: {
          type: "array",
          items: { type: "string" }
        },
        sparse_data_honesty_note: { type: "string" }
      }
    },
    due_diligence: dueDiligenceBlockSchema,
    filing_intelligence: filingIntelligenceBlockSchema,
    financial_indicators: financialIndicatorsBlockSchema,
    structural_context: structuralContextPackSchema,
    financial_analysis: {
      type: "object",
      additionalProperties: false,
      required: [
        "annual_history",
        "quarterly_history",
        "trend_metrics",
        "quality_metrics",
        "omissions"
      ],
      properties: {
        annual_history: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["period", "period_type", "fiscal_year"],
            properties: {
              period: { type: "string" },
              period_type: {
                type: "string",
                enum: ["annual", "quarterly"]
              },
              fiscal_year: { type: "number" },
              fiscal_quarter: { type: "number" },
              revenue: { type: "number" },
              gross_margin: { type: "number" },
              operating_margin: { type: "number" },
              net_income: { type: "number" },
              free_cash_flow: { type: "number" },
              debt_total: { type: "number" },
              cash_and_equivalents: { type: "number" },
              shares_outstanding: { type: "number" }
            }
          }
        },
        quarterly_history: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["period", "period_type", "fiscal_year"],
            properties: {
              period: { type: "string" },
              period_type: {
                type: "string",
                enum: ["annual", "quarterly"]
              },
              fiscal_year: { type: "number" },
              fiscal_quarter: { type: "number" },
              revenue: { type: "number" },
              gross_margin: { type: "number" },
              operating_margin: { type: "number" },
              net_income: { type: "number" },
              free_cash_flow: { type: "number" },
              debt_total: { type: "number" },
              cash_and_equivalents: { type: "number" },
              shares_outstanding: { type: "number" }
            }
          }
        },
        trend_metrics: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["key", "label", "unit", "status", "direction"],
            properties: {
              key: { type: "string" },
              label: { type: "string" },
              value: { type: "number" },
              unit: {
                type: "string",
                enum: ["currency", "pct", "ratio", "count"]
              },
              status: {
                type: "string",
                enum: ["available", "omitted"]
              },
              direction: {
                type: "string",
                enum: ["improving", "deteriorating", "flat", "unavailable"]
              },
              note: { type: "string" }
            }
          }
        },
        quality_metrics: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["key", "label", "unit", "status", "direction"],
            properties: {
              key: { type: "string" },
              label: { type: "string" },
              value: { type: "number" },
              unit: {
                type: "string",
                enum: ["currency", "pct", "ratio", "count"]
              },
              status: {
                type: "string",
                enum: ["available", "omitted"]
              },
              direction: {
                type: "string",
                enum: ["improving", "deteriorating", "flat", "unavailable"]
              },
              note: { type: "string" }
            }
          }
        },
        omissions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["code", "label", "reason", "impacts"],
            properties: {
              code: { type: "string" },
              label: { type: "string" },
              reason: { type: "string" },
              impacts: {
                type: "array",
                items: { type: "string" }
              }
            }
          }
        }
      }
    },
    value_discipline: {
      type: "object",
      additionalProperties: false,
      required: [
        "score",
        "max_score",
        "available_signals",
        "completeness",
        "context_label",
        "interpretation",
        "missing_signals",
        "does_not_prove",
        "signals",
        "value_trap_warning"
      ],
      properties: {
        score: { type: "number" },
        max_score: { type: "number" },
        available_signals: { type: "number" },
        completeness: {
          type: "string",
          enum: ["complete", "partial", "insufficient_data"]
        },
        context_label: {
          type: "string",
          enum: [
            "quality_mega_cap",
            "value_cyclical",
            "distressed",
            "financial",
            "sparse_data",
            "general"
          ]
        },
        interpretation: { type: "string" },
        missing_signals: {
          type: "array",
          items: { type: "string" }
        },
        does_not_prove: { type: "string" },
        signals: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["key", "label", "family", "status", "reason"],
            properties: {
              key: { type: "string" },
              label: { type: "string" },
              family: {
                type: "string",
                enum: [
                  "profitability",
                  "leverage_liquidity",
                  "operating_efficiency",
                  "earnings_quality",
                  "capital_discipline"
                ]
              },
              status: {
                type: "string",
                enum: ["pass", "fail", "unavailable"]
              },
              reason: { type: "string" },
              value: { type: "number" }
            }
          }
        },
        value_trap_warning: {
          type: "object",
          additionalProperties: false,
          required: ["triggered", "summary", "reason_codes"],
          properties: {
            triggered: { type: "boolean" },
            summary: { type: "string" },
            reason_codes: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      }
    },
    sections: {
      type: "array",
      items: reportSectionSchema
    },
    flags: {
      type: "array",
      items: { type: "string" }
    },
    data_sources: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;
