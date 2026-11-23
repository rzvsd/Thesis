// POST /internal/notifications/kill-switch/evaluate. Copied from server.ts.
// Retry safe: a rule is evaluated once per (rule, signal_source, trigger_key); the alert id is stable too.
// Batched by user: { limit?, cursor? } -> { ..., next_cursor }.
import { logError } from "../../_shared/log.ts";
import { addTally, deliverAlert, emptyTally } from "./alerts.ts";
import { appendAudit } from "./audit.ts";
import type { EvaluatorDeps } from "./deps.ts";
import { latestPrices } from "./prices.ts";
import { type EvalMeta, type EvalResult, ok } from "./result.ts";
import type {
  KillSwitchRuleRecord,
  KillSwitchSignalSource,
  KillSwitchSignalType,
  ThesisMonitorSnapshotRecord,
} from "./types.ts";
import {
  createId,
  cursorValue,
  dateInTimeZone,
  groupTargets,
  isPlainRecord,
  nextCursor,
  normalizeDateInput,
  normalizeKillSwitchSignalType,
  notificationRoute,
  notificationTitle,
  pageLimit,
  stableId,
} from "./util.ts";

const defaultThresholdPct = 5;
export const killSwitchPageSize = 200;

interface Fixture {
  ticker: string;
  signal_type: KillSwitchSignalType;
  value?: number;
  reason_text?: string;
}

function asFixture(value: unknown): Fixture | undefined {
  if (!isPlainRecord(value)) return undefined;
  const ticker = typeof value.ticker === "string" ? value.ticker.trim().toUpperCase() : "";
  if (!ticker) return undefined;
  return {
    ticker,
    signal_type: normalizeKillSwitchSignalType(typeof value.signal_type === "string" ? value.signal_type : undefined),
    value: typeof value.value === "number" && Number.isFinite(value.value) ? value.value : undefined,
    reason_text: typeof value.reason_text === "string" && value.reason_text.trim() ? value.reason_text.trim() : undefined,
  };
}

export function evaluatePriceMoveRule(rule: KillSwitchRuleRecord, currentPrice: number | undefined): {
  outcome: "matched" | "not_matched" | "skipped";
  reasonCode: string;
  reasonText: string;
  observedValue?: number;
} {
  const anchor = rule.anchorPrice;
  if (anchor === undefined || !Number.isFinite(anchor) || anchor <= 0 || !Number.isFinite(currentPrice)) {
    return {
      outcome: "skipped",
      reasonCode: "price_unavailable",
      reasonText: "Price move could not be evaluated because anchor or current price is unavailable.",
    };
  }
  const movePct = (((currentPrice as number) - anchor) / anchor) * 100;
  const threshold = Math.max(0.1, rule.thresholdValue ?? defaultThresholdPct);
  const direction = rule.direction ?? "against_signal";
  let matched: boolean;
  if (direction === "any") matched = Math.abs(movePct) >= threshold;
  else if (direction === "above") matched = movePct >= threshold;
  else if (direction === "below") matched = movePct <= -threshold;
  else if (rule.signalValue === "negative") matched = movePct >= threshold;
  else if (rule.signalValue === "positive") matched = movePct <= -threshold;
  else matched = Math.abs(movePct) >= threshold;
  if (matched) {
    return {
      outcome: "matched",
      reasonCode: "kill_switch_price_move",
      reasonText: `Price moved ${Math.abs(movePct).toFixed(1)}% and crossed kill-switch threshold ${
        threshold.toFixed(1)
      }%.`,
      observedValue: Number(movePct.toFixed(4)),
    };
  }
  return {
    outcome: "not_matched",
    reasonCode: "kill_switch_no_match",
    reasonText: `Price move ${Math.abs(movePct).toFixed(1)}% did not cross threshold ${threshold.toFixed(1)}%.`,
    observedValue: Number(movePct.toFixed(4)),
  };
}

export async function evaluateKillSwitch(
  deps: EvaluatorDeps,
  body: Record<string, unknown>,
  meta: EvalMeta,
): Promise<EvalResult> {
  const today = dateInTimeZone(deps.now(), deps.timeZone);
  const asOf = normalizeDateInput(body.as_of ?? today) ?? today;
  const signalSource: KillSwitchSignalSource = body.signal_source === "event" ? "event" : "daily";
  const triggerKey = typeof body.trigger_key === "string" && body.trigger_key.trim().length > 0
    ? body.trigger_key.trim()
    : `${signalSource}:${asOf}`;
  const asOfEndIso = new Date(`${asOf}T23:59:59.999Z`).toISOString();
  const limit = pageLimit(body.limit, killSwitchPageSize);

  const fixtureMap = new Map<string, Fixture>();
  for (const f of (Array.isArray(body.fixtures) ? body.fixtures : []).map(asFixture)) {
    if (f) fixtureMap.set(`${f.ticker}:${f.signal_type}`, f);
  }

  const audience = await deps.store.listAudience({
    notificationType: "kill_switch",
    page: { afterUserId: cursorValue(body.cursor), limit },
  });
  const targetsByUser = groupTargets(audience);
  const userIds = audience.map((m) => m.userId);
  const rules = userIds.length > 0
    ? await deps.store.listActiveKillSwitchRules({ asOfIso: asOfEndIso, userIds })
    : [];

  const priceTickers = [...new Set(rules.filter((r) => r.signalType === "price_move_pct").map((r) => r.ticker))];
  const prices = await latestPrices(deps, priceTickers, asOf);

  const snapshots = new Map<string, ThesisMonitorSnapshotRecord>();
  for (const userId of new Set(rules.filter((r) => r.signalType === "thesis_state").map((r) => r.userId))) {
    for (const s of await deps.store.listThesisMonitorSnapshotsByUser(userId)) {
      snapshots.set(`${s.userId}:${s.ticker}`, s);
    }
  }

  let evaluated = 0;
  let matched = 0;
  let skipped = 0;
  const tally = emptyTally();
  for (const rule of rules) {
    if (await deps.store.getKillSwitchEvaluation({ ruleId: rule.id, signalSource, triggerKey })) {
      skipped += 1;
      continue;
    }
    const fixture = fixtureMap.get(`${rule.ticker}:${rule.signalType}`);
    const evaluationId = createId();
    let outcome: "matched" | "not_matched" | "skipped" = "not_matched";
    let reasonCode = "kill_switch_no_match";
    let reasonText = "No material signal crossed this kill-switch condition.";
    let observedValue: number | undefined;

    if (rule.signalType === "price_move_pct") {
      ({ outcome, reasonCode, reasonText, observedValue } = evaluatePriceMoveRule(rule, prices.get(rule.ticker)));
    } else if (rule.signalType === "thesis_state") {
      const snapshot = snapshots.get(`${rule.userId}:${rule.ticker}`);
      if (!snapshot) {
        outcome = "skipped";
        reasonCode = "snapshot_unavailable";
        reasonText = "Thesis monitor snapshot is unavailable for this rule.";
      } else if (snapshot.state === "weakened" || snapshot.state === "unresolved") {
        outcome = "matched";
        reasonCode = "kill_switch_thesis_state";
        reasonText = `Monitor state is ${snapshot.state}: ${snapshot.reason}`;
        observedValue = snapshot.score;
      } else {
        reasonText = `Monitor state is ${snapshot.state}; threshold state not reached.`;
        observedValue = snapshot.score;
      }
    } else if (fixture) {
      outcome = "matched";
      reasonCode = "kill_switch_fixture_match";
      reasonText = fixture.reason_text ?? `Matched fixture signal for ${fixture.ticker} (${fixture.signal_type}).`;
      observedValue = fixture.value;
    }

    let alertId: string | undefined;
    if (outcome === "matched") {
      matched += 1;
      alertId = await stableId(`kill_switch:${rule.id}:${signalSource}:${triggerKey}`);
      const route = notificationRoute("kill_switch");
      const delivered = await deliverAlert(deps, {
        alertId,
        userId: rule.userId,
        targets: targetsByUser.get(rule.userId) ?? [],
        notificationType: "kill_switch",
        route,
        title: notificationTitle("kill_switch", rule.ticker),
        body: `Kill-switch triggered for ${rule.ticker}: ${rule.conditionText}`,
        reasonCode,
        reasonText,
        pushData: {
          ticker: rule.ticker,
          report_id: rule.reportId ?? "",
          rule_id: rule.id,
          signal_type: rule.signalType,
          trigger_key: triggerKey,
          reason_code: reasonCode,
          reason_text: reasonText,
          deep_link_target: route,
        },
        ledgerData: {
          ticker: rule.ticker,
          report_id: rule.reportId ?? "",
          rule_id: rule.id,
          evaluation_id: evaluationId,
          signal_type: rule.signalType,
          trigger_key: triggerKey,
          deep_link_target: route,
        },
      });
      addTally(tally, delivered.push);
    } else if (outcome === "skipped") {
      skipped += 1;
    }

    const at = deps.now().toISOString();
    await deps.store.createKillSwitchEvaluation({
      id: evaluationId,
      ruleId: rule.id,
      userId: rule.userId,
      ticker: rule.ticker,
      signalSource,
      triggerKey,
      outcome,
      reasonCode,
      reasonText,
      observedValue,
      alertId,
      createdAt: at,
      updatedAt: at,
    });
    evaluated += 1;
  }

  if (tally.failed > 0) logError("Kill-switch notification delivery partially failed", { ...tally, matched });
  const counts = { evaluated, matched, skipped, ...tally };
  await appendAudit(deps.store, "kill_switch.rules_evaluated", {
    request_id: meta.requestId,
    route: meta.route,
    as_of: asOf,
    signal_source: signalSource,
    trigger_key: triggerKey,
    ...counts,
  });
  return ok({
    status: "ok",
    as_of: asOf,
    signal_source: signalSource,
    trigger_key: triggerKey,
    ...counts,
    next_cursor: nextCursor(userIds, limit),
  });
}
