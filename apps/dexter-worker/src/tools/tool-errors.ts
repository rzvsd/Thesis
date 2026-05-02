import type {
  DexterToolConfidence,
  DexterToolName,
  DexterToolOmission,
  DexterToolResult,
  DexterToolVisibility
} from "./tool-contract";

export function buildToolOmission(input: {
  family: string;
  reason_code: DexterToolOmission["reason_code"];
  reason_text: string;
  blocking?: boolean;
}): DexterToolOmission {
  return {
    family: input.family,
    reason_code: input.reason_code,
    reason_text: input.reason_text,
    blocking: input.blocking ?? false
  };
}

export function buildToolFailure<T>(input: {
  toolName: DexterToolName;
  generatedAt: string;
  family?: string;
  reason_code: DexterToolOmission["reason_code"];
  reason_text: string;
  confidence?: DexterToolConfidence;
  visibility?: DexterToolVisibility;
  notes?: string[];
}): DexterToolResult<T> {
  return {
    tool_name: input.toolName,
    ok: false,
    generated_at: input.generatedAt,
    evidence: [],
    omissions: [
      buildToolOmission({
        family: input.family ?? input.toolName,
        reason_code: input.reason_code,
        reason_text: input.reason_text
      })
    ],
    confidence: input.confidence ?? "low",
    visibility: input.visibility ?? "internal_only",
    customer_safe: false,
    notes: input.notes ?? []
  };
}
