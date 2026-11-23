// Ingest and read routes: canonical events, first-party context, name relationships.
// Copied from the /internal/* blocks of apps/product-api/src/server.ts. All writes are upserts (safe to retry).
import { logInfo } from "../../_shared/log.ts";
import { appendAudit } from "./audit.ts";
import type { EvaluatorDeps } from "./deps.ts";
import { type EvalMeta, type EvalResult, fail, ok, validation } from "./result.ts";
import {
  type CallArtifact,
  callArtifactCompletenessStates,
  callArtifactTypes,
  type CanonicalEvent,
  evidenceDisplayModes,
  evidenceRightsClasses,
  evidenceSourceRanks,
  firstPartyFetchStates,
  type FirstPartyContextItem,
  firstPartyPageTypes,
  type NameRelationshipDraft,
  type NameRelationshipRecord,
  nameRelationshipTypes,
} from "./types.ts";
import { isPlainRecord, normalizeTickerSymbol, parsePositiveInteger, sha256Hex } from "./util.ts";

// ---- Validators ----

export function isCanonicalEvent(value: unknown): value is CanonicalEvent {
  if (!isPlainRecord(value)) return false;
  const source = value.source;
  if (!isPlainRecord(source) || !isPlainRecord(source.source)) return false;
  return typeof value.id === "string" &&
    (value.family === "filing_posted" || value.family === "macro_release_published") &&
    (value.subject_type === "ticker" || value.subject_type === "macro_series") &&
    typeof value.subject_id === "string" &&
    typeof value.title === "string" &&
    typeof value.occurred_at === "string" &&
    (value.source_state === "official" || value.source_state === "partial" || value.source_state === "missing") &&
    typeof value.retrieved_at === "string" &&
    Array.isArray(value.missing_fields) &&
    isPlainRecord(value.metadata);
}

function includes(list: readonly string[], value: unknown): boolean {
  return typeof value === "string" && list.includes(value);
}

function isEvidenceRights(value: unknown): boolean {
  if (!isPlainRecord(value)) return false;
  return includes(evidenceRightsClasses, value.rights_class) &&
    includes(evidenceDisplayModes, value.display_mode) &&
    includes(evidenceSourceRanks, value.source_rank) &&
    typeof value.source_type === "string" &&
    typeof value.can_store_full_text === "boolean" &&
    typeof value.can_display_excerpt === "boolean" &&
    typeof value.can_display_link === "boolean" &&
    typeof value.policy_reason === "string" &&
    typeof value.reviewed_at === "string";
}

export function isFirstPartyContextItem(value: unknown): value is FirstPartyContextItem {
  if (!isPlainRecord(value)) return false;
  return typeof value.context_id === "string" &&
    typeof value.ticker === "string" &&
    typeof value.registry_entry_id === "string" &&
    typeof value.source_url === "string" &&
    typeof value.source_domain === "string" &&
    includes(firstPartyPageTypes, value.page_type) &&
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    typeof value.retrieved_at === "string" &&
    typeof value.content_hash === "string" &&
    includes(firstPartyFetchStates, value.fetch_state) &&
    isEvidenceRights(value.rights) &&
    Array.isArray(value.artifact_ids) &&
    isPlainRecord(value.metadata);
}

export function isCallArtifact(value: unknown): value is CallArtifact {
  if (!isPlainRecord(value)) return false;
  return typeof value.artifact_id === "string" &&
    typeof value.ticker === "string" &&
    includes(callArtifactTypes, value.artifact_type) &&
    typeof value.title === "string" &&
    typeof value.source_url === "string" &&
    typeof value.source_domain === "string" &&
    typeof value.retrieved_at === "string" &&
    includes(callArtifactCompletenessStates, value.completeness_state) &&
    isEvidenceRights(value.rights) &&
    isPlainRecord(value.metadata);
}

// ---- Canonical events ----

export async function ingestCanonicalEvents(deps: EvaluatorDeps, body: Record<string, unknown>): Promise<EvalResult> {
  const raw = Array.isArray(body.events) ? body.events : [];
  if (raw.length === 0) return validation("events must include at least one canonical event.");
  const invalid = raw.findIndex((e) => !isCanonicalEvent(e));
  if (invalid >= 0) return validation(`events[${invalid}] is not a valid canonical event.`);
  const events = raw as CanonicalEvent[];
  const result = await deps.store.upsertCanonicalEvents(events);
  return ok({ status: "accepted", upserted: result.upserted, event_count: events.length });
}

export async function listCanonicalEvents(deps: EvaluatorDeps, query: URLSearchParams): Promise<EvalResult> {
  const subjectTypeRaw = query.get("subject_type")?.trim();
  const subjectType = subjectTypeRaw === "ticker" || subjectTypeRaw === "macro_series" ? subjectTypeRaw : undefined;
  if (subjectTypeRaw && !subjectType) return validation("subject_type must be ticker or macro_series.");
  const familyRaw = query.get("family")?.trim();
  const family = familyRaw === "filing_posted" || familyRaw === "macro_release_published" ? familyRaw : undefined;
  if (familyRaw && !family) return validation("family must be filing_posted or macro_release_published.");
  const limit = parsePositiveInteger(query.get("limit")?.trim(), 50, 1, 250);
  if (limit === undefined) return validation("limit must be an integer between 1 and 250.");
  const events = await deps.store.listCanonicalEvents({
    subjectType,
    subjectId: query.get("subject_id")?.trim() || undefined,
    family,
    limit,
  });
  return ok({ data: events });
}

// ---- First-party context ----

export async function ingestFirstPartyContext(
  deps: EvaluatorDeps,
  body: Record<string, unknown>,
): Promise<EvalResult> {
  const items = Array.isArray(body.context_items) ? body.context_items : [];
  const artifacts = Array.isArray(body.call_artifacts) ? body.call_artifacts : [];
  if (items.length === 0 && artifacts.length === 0) {
    return validation("context_items or call_artifacts must include at least one item.");
  }
  const badItem = items.findIndex((i) => !isFirstPartyContextItem(i));
  if (badItem >= 0) return validation(`context_items[${badItem}] is not a valid first-party context item.`);
  const badArtifact = artifacts.findIndex((a) => !isCallArtifact(a));
  if (badArtifact >= 0) return validation(`call_artifacts[${badArtifact}] is not a valid call artifact.`);
  const contextResult = await deps.store.upsertFirstPartyContextItems(items as FirstPartyContextItem[]);
  const artifactResult = await deps.store.upsertCallArtifacts(artifacts as CallArtifact[]);
  return ok({
    status: "accepted",
    context_upserted: contextResult.upserted,
    artifact_upserted: artifactResult.upserted,
  });
}

export async function listFirstPartyContext(deps: EvaluatorDeps, query: URLSearchParams): Promise<EvalResult> {
  const limit = parsePositiveInteger(query.get("limit")?.trim(), 50, 1, 250);
  if (limit === undefined) return validation("limit must be an integer between 1 and 250.");
  const input = {
    ticker: query.get("ticker")?.trim() || undefined,
    eventId: query.get("event_id")?.trim() || undefined,
    limit,
  };
  const contextItems = await deps.store.listFirstPartyContextItems(input);
  const callArtifacts = await deps.store.listCallArtifacts(input);
  return ok({ data: { context_items: contextItems, call_artifacts: callArtifacts } });
}

// ---- Name relationships ----

async function stableRelationshipId(
  userId: string,
  source: string,
  target: string,
  type: string,
): Promise<string> {
  return `nr_${(await sha256Hex(`${userId}|${source}|${target}|${type}`)).slice(0, 24)}`;
}

export async function sanitizeNameRelationshipDrafts(input: {
  relationships: unknown;
  userId: string;
  reportId: string;
  reportTicker?: string;
  nowIso: string;
}): Promise<NameRelationshipRecord[]> {
  if (!Array.isArray(input.relationships)) return [];
  const reportTicker = normalizeTickerSymbol(input.reportTicker);
  const parsed: NameRelationshipRecord[] = [];
  const seen = new Set<string>();
  for (const raw of input.relationships) {
    if (!isPlainRecord(raw)) continue;
    const candidate = raw as unknown as NameRelationshipDraft;
    let sourceTicker = normalizeTickerSymbol(candidate.source_ticker);
    let targetTicker = normalizeTickerSymbol(candidate.target_ticker);
    if (!sourceTicker || !targetTicker || sourceTicker === targetTicker) continue;
    if (reportTicker && sourceTicker === reportTicker && targetTicker !== reportTicker) {
      [sourceTicker, targetTicker] = [targetTicker, sourceTicker];
    }
    if (reportTicker && targetTicker !== reportTicker) continue;
    if (!includes(nameRelationshipTypes, candidate.relationship_type)) continue;
    const confidence = typeof candidate.confidence === "number" && Number.isFinite(candidate.confidence)
      ? Math.max(0, Math.min(1, candidate.confidence))
      : undefined;
    const evidenceText = typeof candidate.evidence_text === "string" ? candidate.evidence_text.trim() : "";
    const rationale = typeof candidate.rationale === "string" ? candidate.rationale.trim() : "";
    if (confidence === undefined || evidenceText.length === 0 || rationale.length === 0) continue;
    const relationshipId = typeof candidate.relationship_id === "string" && candidate.relationship_id.trim().length > 0
      ? candidate.relationship_id.trim()
      : await stableRelationshipId(input.userId, sourceTicker, targetTicker, candidate.relationship_type);
    if (seen.has(relationshipId)) continue;
    seen.add(relationshipId);
    parsed.push({
      relationshipId,
      userId: input.userId,
      sourceTicker,
      targetTicker,
      relationshipType: candidate.relationship_type,
      confidence,
      state: "active",
      sourceReportId: input.reportId,
      promptVersion: typeof candidate.prompt_version === "string" && candidate.prompt_version.trim().length > 0
        ? candidate.prompt_version.trim()
        : "unknown",
      evidenceText,
      rationale,
      createdAt: input.nowIso,
      updatedAt: input.nowIso,
    });
  }
  return parsed;
}

export async function ingestNameRelationships(
  deps: EvaluatorDeps,
  body: Record<string, unknown>,
  meta: EvalMeta,
): Promise<EvalResult> {
  const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
  const reportId = typeof body.report_id === "string" ? body.report_id.trim() : "";
  if (!userId || !reportId || !Array.isArray(body.relationships)) {
    return validation("user_id, report_id, and relationships are required.");
  }
  const userFound = await deps.store.userExists(userId);
  const report = await deps.store.getReportMeta(reportId);
  if (!userFound || !report) {
    return fail(404, "not_found", "User or report not found for relationship ingestion.");
  }
  const sanitized = await sanitizeNameRelationshipDrafts({
    relationships: body.relationships,
    userId,
    reportId,
    reportTicker: report.ticker,
    nowIso: deps.now().toISOString(),
  });
  for (const r of sanitized) await deps.store.upsertNameRelationship(r);
  if (sanitized.length > 0) {
    logInfo("Name relationships upserted", { route: meta.route, report_id: reportId, count: sanitized.length });
    await appendAudit(deps.store, "name_relationships.upserted", {
      request_id: meta.requestId,
      route: meta.route,
      report_id: reportId,
      relationship_count: sanitized.length,
    }, userId);
  }
  return ok({ status: "ok", upserted: sanitized.length });
}
