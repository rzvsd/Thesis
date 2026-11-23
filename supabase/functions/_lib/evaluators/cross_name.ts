// POST /internal/notifications/cross-name/evaluate. Copied from dispatchCrossNamePropagation in server.ts.
// Work is bounded by the fixtures in the body, so there is no cursor.
// Retry safe: the old check (same relationship and trigger key in the last 100 alerts) plus a stable alert id.
import { logError, logInfo } from "../../_shared/log.ts";
import { addTally, deliverAlert, emptyTally } from "./alerts.ts";
import { appendAudit } from "./audit.ts";
import type { EvaluatorDeps } from "./deps.ts";
import { type EvalMeta, type EvalResult, ok } from "./result.ts";
import type { AudienceMember, KillSwitchSignalType, NameRelationshipType } from "./types.ts";
import {
  dateInTimeZone,
  isPlainRecord,
  normalizeDateInput,
  normalizeKillSwitchSignalType,
  normalizeTickerSymbol,
  notificationRoute,
  notificationTitle,
  stableId,
} from "./util.ts";

const defaultConfidenceThreshold = 0.7;
const maxFixtures = 100;

interface Fixture {
  source_ticker: string;
  signal_type: KillSwitchSignalType;
  event_category: "thesis_drift" | "macro";
  event_id?: string;
  reason_text?: string;
}

function category(value: unknown, signalType: KillSwitchSignalType): "thesis_drift" | "macro" {
  return value === "macro" || signalType === "macro_regime" ? "macro" : "thesis_drift";
}

function asFixture(value: unknown): Fixture | undefined {
  if (!isPlainRecord(value)) return undefined;
  const source = normalizeTickerSymbol(value.source_ticker);
  if (!source) return undefined;
  const signalType = normalizeKillSwitchSignalType(
    typeof value.signal_type === "string" ? value.signal_type : undefined,
  );
  const text = (v: unknown) => (typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined);
  return {
    source_ticker: source,
    signal_type: signalType,
    event_category: category(value.event_category, signalType),
    event_id: text(value.event_id),
    reason_text: text(value.reason_text),
  };
}

export function normalizeConfidenceThreshold(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return defaultConfidenceThreshold;
  return Math.max(defaultConfidenceThreshold, Math.min(1, value));
}

export async function evaluateCrossName(
  deps: EvaluatorDeps,
  body: Record<string, unknown>,
  meta: EvalMeta,
): Promise<EvalResult> {
  const today = dateInTimeZone(deps.now(), deps.timeZone);
  const asOf = normalizeDateInput(body.as_of ?? today) ?? today;
  const signalSource = body.signal_source === "event" ? "event" : "daily";
  const triggerKey = typeof body.trigger_key === "string" && body.trigger_key.trim().length > 0
    ? body.trigger_key.trim()
    : `${signalSource}:${asOf}`;
  const threshold = normalizeConfidenceThreshold(body.confidence_threshold);
  const fixtures = (Array.isArray(body.fixtures) ? body.fixtures : []).slice(0, maxFixtures).map(asFixture)
    .filter((f): f is Fixture => Boolean(f));

  const watchlists = new Map<string, Set<string>>();
  const audience = new Map<string, AudienceMember | null>();
  let evaluated = 0;
  let matched = 0;
  let suppressed = 0;
  const tally = emptyTally();

  for (const fixture of fixtures) {
    const relationshipTypes: NameRelationshipType[] | undefined = fixture.event_category === "macro"
      ? ["sector"]
      : undefined;
    const relationships = await deps.store.listActiveNameRelationshipsBySource({
      sourceTicker: fixture.source_ticker,
      relationshipTypes,
      minConfidence: threshold,
    });
    for (const rel of relationships) {
      evaluated += 1;
      let watchlist = watchlists.get(rel.userId);
      if (!watchlist) {
        watchlist = new Set(
          (await deps.store.listWatchlistTickers(rel.userId)).map((t) => t.trim().toUpperCase()),
        );
        watchlists.set(rel.userId, watchlist);
      }
      if (!watchlist.has(rel.targetTicker)) {
        suppressed += 1;
        continue;
      }
      const recent = await deps.store.listAlertLedgerItemsByUser({ userId: rel.userId, limit: 100 });
      if (
        recent.some((a) =>
          a.notificationType === "cross_name_propagation" &&
          a.context.relationship_id === rel.relationshipId &&
          a.context.propagation_trigger_key === triggerKey
        )
      ) {
        suppressed += 1;
        continue;
      }
      if (!audience.has(rel.userId)) {
        const [member] = await deps.store.listAudience({
          notificationType: "cross_name_propagation",
          tier: "PRO",
          userIds: [rel.userId],
        });
        audience.set(rel.userId, member ?? null);
      }
      const member = audience.get(rel.userId);
      if (!member) {
        suppressed += 1;
        continue;
      }

      const route = notificationRoute("cross_name_propagation");
      const reasonText = fixture.reason_text ??
        `${rel.sourceTicker} has a ${fixture.signal_type} signal linked to ${rel.targetTicker}.`;
      const shared = {
        source_ticker: rel.sourceTicker,
        affected_ticker: rel.targetTicker,
        relationship_id: rel.relationshipId,
        relationship_type: rel.relationshipType,
        relationship_confidence: rel.confidence.toFixed(2),
        relationship_source_report_id: rel.sourceReportId,
        propagation_trigger_key: triggerKey,
        propagation_signal_type: fixture.signal_type,
        propagation_event_id: fixture.event_id ?? "",
        propagation_reason: reasonText,
        reason_code: "cross_name_signal",
        reason_text: reasonText,
        deep_link_target: route,
      };
      const result = await deliverAlert(deps, {
        alertId: await stableId(`cross_name:${rel.userId}:${rel.relationshipId}:${triggerKey}`),
        userId: rel.userId,
        targets: member.targets,
        notificationType: "cross_name_propagation",
        category: fixture.event_category === "macro" ? "macro" : "thesis_drift",
        route,
        title: notificationTitle("cross_name_propagation", rel.targetTicker),
        body: `${rel.sourceTicker} may affect your ${rel.targetTicker} thesis ` +
          `through a ${rel.relationshipType} relationship: ${rel.rationale}`,
        reasonCode: "cross_name_signal",
        reasonText,
        pushData: shared,
        ledgerData: { ticker: rel.targetTicker, ...shared, report_id: rel.sourceReportId },
      });
      if (result.duplicate) {
        suppressed += 1;
        continue;
      }
      matched += 1;
      addTally(tally, result.push);
      logInfo("Cross-name propagated alert emitted", {
        route: meta.route,
        source_ticker: rel.sourceTicker,
        affected_ticker: rel.targetTicker,
      });
    }
  }

  if (tally.failed > 0) {
    logError("Cross-name propagation notification delivery partially failed", { ...tally });
  }
  const counts = { evaluated, matched, suppressed, ...tally };
  await appendAudit(deps.store, "cross_name.propagation_evaluated", {
    request_id: meta.requestId,
    route: meta.route,
    as_of: asOf,
    signal_source: signalSource,
    trigger_key: triggerKey,
    confidence_threshold: threshold,
    ...counts,
  });
  return ok({
    status: "ok",
    as_of: asOf,
    signal_source: signalSource,
    trigger_key: triggerKey,
    confidence_threshold: threshold,
    ...counts,
  });
}
