// The side effects of a completed Deep Dive, in the order of the old POST /internal/jobs/:id/complete
// handler. The POST /jobs reuse path runs the same steps without the monitor snapshot.
import { createContrarianAnchorFromReport } from "./contrarian.ts";
import { recordConvictionJournalEntryFromReport } from "./conviction.ts";
import { appendAudit, nowIso } from "./helpers.ts";
import { createKillSwitchRulesFromReport } from "./kill-switch.ts";
import { upsertSnapshotFromReport } from "./monitor.ts";
import { createNameRelationshipsFromReport } from "./name-relationships.ts";
import type { CompletionEffectsInput, EffectsDeps } from "./types.ts";

export async function applyCompletionEffects(
  deps: EffectsDeps,
  input: CompletionEffectsInput,
): Promise<void> {
  const { report, userId, requestId, route } = input;

  await createContrarianAnchorFromReport(deps, { report, userId, requestId, route });
  await createKillSwitchRulesFromReport(deps, { report, userId, requestId, route });
  await createNameRelationshipsFromReport(deps, { report, userId, requestId, route });

  if (input.includeMonitorSnapshot && report.type === "deep_dive" && userId && report.ticker) {
    const normalizedTicker = report.ticker.trim().toUpperCase();
    const watchlist = await deps.store.listWatchlistTickersByUser(userId);
    if (watchlist.includes(normalizedTicker)) {
      const snapshot = await upsertSnapshotFromReport(deps.store, {
        userId,
        ticker: normalizedTicker,
        report,
        asOfIso: nowIso(deps),
        materialEventsCount: 0,
        unreviewedEventsCount: 0,
        updatedAt: nowIso(deps),
      });
      await appendAudit(deps.store, "monitor.snapshot_upserted", {
        request_id: requestId,
        route,
        ticker: normalizedTicker,
        state: snapshot.state,
        score: snapshot.score,
      }, userId);
    }
  }

  await recordConvictionJournalEntryFromReport(deps, { report, userId });
}
