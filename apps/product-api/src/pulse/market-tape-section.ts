import { randomUUID } from "node:crypto";

import type { EvidenceItem, MarketTapePack, ReportSection } from "../../../../packages/contracts/src";

export function summarizeMarketTape(pack: MarketTapePack): string {
  const omissionNote = pack.omissions[0]?.reason_text;
  const parts = [pack.summary];
  if (pack.sector_leadership) {
    const leaders = pack.sector_leadership.leaders.slice(0, 3).map((entry) => entry.label).join(", ");
    const laggards = pack.sector_leadership.laggards.slice(0, 3).map((entry) => entry.label).join(", ");
    if (leaders && laggards) {
      parts.push(`Sector leaders: ${leaders}. Sector laggards: ${laggards}.`);
    }
  }
  if (omissionNote) {
    parts.push(`Coverage note: ${omissionNote}`);
  }
  return parts.join(" ");
}

export function marketTapeEvidence(pack: MarketTapePack, generatedAt: string): EvidenceItem[] {
  const rows = [
    ...pack.indices,
    ...pack.cross_asset,
    ...(pack.sector_leadership?.leaders ?? []),
    ...(pack.sector_leadership?.laggards ?? [])
  ];
  return rows.slice(0, 10).map((entry) => ({
    evidence_id: randomUUID(),
    source_type: "financial_data",
    source_name: entry.retrieval?.source?.source_name ?? "market_tape",
    excerpt: `${entry.label}: ${entry.daily_change_pct ?? entry.daily_change ?? "n/a"} ${entry.unit ?? ""}`.trim(),
    retrieved_at: entry.retrieval?.retrieved_at ?? generatedAt,
    ...(entry.retrieval?.source?.source_url ? { url: entry.retrieval.source.source_url } : {})
  }));
}

export function marketTapeStatus(
  result: { ok: true; data: MarketTapePack } | { ok: false; errorMessage: string }
): ReportSection["status"] {
  if (!result.ok) {
    return "data_unavailable";
  }
  if (result.data.coverage_state === "full") {
    return "complete";
  }
  return "data_incomplete";
}

export function marketTapeNoMaterialChange(pack: MarketTapePack | undefined): boolean {
  if (!pack) {
    return false;
  }
  const coreIndices = pack.indices.filter((entry) => entry.family === "core_index");
  if (coreIndices.length === 0) {
    return false;
  }
  return coreIndices.every((entry) => Math.abs(entry.daily_change_pct ?? 0) < 0.35);
}
