import type { EvidenceItem } from "../../../../packages/contracts/src";

export type DexterToolName =
  | "financial_analysis"
  | "claim_math_validator"
  | "evidence_debate"
  | "recent_context";

export type DexterToolVisibility =
  | "internal_only"
  | "customer_metadata"
  | "customer_summary_allowed";

export type DexterToolConfidence = "high" | "medium" | "low";

export interface DexterToolOmission {
  family: string;
  reason_code:
    | "disabled"
    | "timeout"
    | "source_unavailable"
    | "insufficient_input"
    | "policy_blocked"
    | "schema_mismatch"
    | "unsupported_market"
    | "internal_error";
  reason_text: string;
  blocking: boolean;
}

export interface DexterToolResult<T> {
  tool_name: DexterToolName;
  ok: boolean;
  generated_at: string;
  data?: T;
  evidence: EvidenceItem[];
  omissions: DexterToolOmission[];
  confidence: DexterToolConfidence;
  visibility: DexterToolVisibility;
  customer_safe: boolean;
  notes: string[];
}

export interface DexterToolRuntimeConfig {
  toolsEnabled: boolean;
  financialAnalysisToolEnabled: boolean;
  evidenceDebateToolEnabled: boolean;
  recentContextToolEnabled: boolean;
  recentContextCustomerVisible: boolean;
  toolTimeoutMs: number;
  toolMaxResults: number;
  recentContextBaseUrl?: string;
  recentContextApiKeyPresent: boolean;
}
