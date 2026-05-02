import { createHash } from "node:crypto";

import type { EvidenceItem } from "../../../../packages/contracts/src";
import type { DexterToolName } from "./tool-contract";

export function evidenceFromToolFinding(input: {
  toolName: DexterToolName;
  sourceFamily: string;
  title: string;
  excerpt: string;
  url?: string;
  retrievedAt: string;
  customerSafe: boolean;
}): EvidenceItem {
  const sourceType: EvidenceItem["source_type"] =
    input.toolName === "recent_context"
      ? "article"
      : "financial_data";
  const excerpt = truncate(input.excerpt.replace(/\s+/g, " ").trim(), 400);
  const evidenceId = createHash("sha256")
    .update(`${input.toolName}:${input.sourceFamily}:${input.title}:${excerpt}`)
    .digest("hex")
    .slice(0, 16);

  return {
    evidence_id: `${input.toolName}-${evidenceId}`,
    source_type: sourceType,
    source_name: `${input.toolName}/${input.sourceFamily}`,
    excerpt,
    retrieved_at: input.retrievedAt,
    ...(input.url ? { url: input.url } : {})
  };
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}
