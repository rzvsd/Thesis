// Name relationships (supplier / competitor / partner / sector) between the report ticker and others.
import { createHash } from "node:crypto";
import { logInfo } from "../../../_shared/log.ts";
import type { AnalysisReport } from "../types.ts";
import { appendAudit, normalizeTickerSymbol, nowIso } from "./helpers.ts";
import {
  type EffectsDeps,
  type NameRelationshipDraft,
  type NameRelationshipRecord,
  type NameRelationshipType,
  nameRelationshipTypes,
} from "./types.ts";

export function isNameRelationshipType(value: unknown): value is NameRelationshipType {
  return (nameRelationshipTypes as readonly unknown[]).includes(value);
}

export function stableNameRelationshipId(input: {
  userId: string;
  sourceTicker: string;
  targetTicker: string;
  relationshipType: NameRelationshipType;
}): string {
  const hash = createHash("sha256")
    .update(`${input.userId}|${input.sourceTicker}|${input.targetTicker}|${input.relationshipType}`)
    .digest("hex")
    .slice(0, 24);
  return `nr_${hash}`;
}

export function sanitizeNameRelationshipDrafts(input: {
  relationships: NameRelationshipDraft[] | undefined;
  userId: string;
  reportId: string;
  reportTicker?: string;
  nowIso?: string;
}): NameRelationshipRecord[] {
  if (!Array.isArray(input.relationships)) {
    return [];
  }

  const reportTicker = normalizeTickerSymbol(input.reportTicker);
  const now = input.nowIso ?? new Date().toISOString();
  const parsed: NameRelationshipRecord[] = [];
  const seen = new Set<string>();

  for (const entry of input.relationships) {
    const candidate = (entry ?? {}) as NameRelationshipDraft;
    let sourceTicker = normalizeTickerSymbol(candidate.source_ticker);
    let targetTicker = normalizeTickerSymbol(candidate.target_ticker);
    if (!sourceTicker || !targetTicker || sourceTicker === targetTicker) {
      continue;
    }

    if (reportTicker && sourceTicker === reportTicker && targetTicker !== reportTicker) {
      [sourceTicker, targetTicker] = [targetTicker, sourceTicker];
    }
    if (reportTicker && targetTicker !== reportTicker) {
      continue;
    }

    const relationshipType = candidate.relationship_type;
    if (!isNameRelationshipType(relationshipType)) {
      continue;
    }
    const confidence = typeof candidate.confidence === "number" && Number.isFinite(candidate.confidence)
      ? Math.max(0, Math.min(1, candidate.confidence))
      : undefined;
    const evidenceText = typeof candidate.evidence_text === "string" ? candidate.evidence_text.trim() : "";
    const rationale = typeof candidate.rationale === "string" ? candidate.rationale.trim() : "";
    if (confidence === undefined || evidenceText.length === 0 || rationale.length === 0) {
      continue;
    }

    const relationshipId =
      typeof candidate.relationship_id === "string" && candidate.relationship_id.trim().length > 0
        ? candidate.relationship_id.trim()
        : stableNameRelationshipId({ userId: input.userId, sourceTicker, targetTicker, relationshipType });
    if (seen.has(relationshipId)) {
      continue;
    }
    seen.add(relationshipId);

    parsed.push({
      relationshipId,
      userId: input.userId,
      sourceTicker,
      targetTicker,
      relationshipType,
      confidence,
      state: "active",
      sourceReportId: input.reportId,
      promptVersion:
        typeof candidate.prompt_version === "string" && candidate.prompt_version.trim().length > 0
          ? candidate.prompt_version.trim()
          : "unknown",
      evidenceText,
      rationale,
      createdAt: now,
      updatedAt: now,
    });
  }

  return parsed;
}

export async function upsertNameRelationships(
  deps: Pick<EffectsDeps, "store" | "now">,
  input: {
    userId: string;
    reportId: string;
    reportTicker?: string;
    relationships: NameRelationshipDraft[] | undefined;
    requestId: string;
    route: string;
  },
): Promise<number> {
  const sanitized = sanitizeNameRelationshipDrafts({
    userId: input.userId,
    reportId: input.reportId,
    reportTicker: input.reportTicker,
    relationships: input.relationships,
    nowIso: nowIso(deps),
  });

  for (const relationship of sanitized) {
    await deps.store.upsertNameRelationship(relationship);
  }

  if (sanitized.length > 0) {
    logInfo("Name relationships upserted", {
      request_id: input.requestId,
      route: input.route,
      report_id: input.reportId,
      relationship_count: sanitized.length,
    });
    await appendAudit(deps.store, "name_relationships.upserted", {
      request_id: input.requestId,
      route: input.route,
      report_id: input.reportId,
      relationship_count: sanitized.length,
    }, input.userId);
  }

  return sanitized.length;
}

export async function createNameRelationshipsFromReport(
  deps: Pick<EffectsDeps, "store" | "now">,
  input: { report: AnalysisReport; userId?: string; requestId: string; route: string },
): Promise<void> {
  const { report, userId } = input;
  if (report.type !== "deep_dive" || !userId || !report.ticker) {
    return;
  }
  await upsertNameRelationships(deps, {
    userId,
    reportId: report.report_id,
    reportTicker: report.ticker,
    relationships: report.name_relationships,
    requestId: input.requestId,
    route: input.route,
  });
}
