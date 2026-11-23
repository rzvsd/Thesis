// Kill-switch rules: the 3-5 conditions a Deep Dive says would break the thesis.
import { logInfo } from "../../../_shared/log.ts";
import type { AnalysisReport } from "../types.ts";
import { appendAudit, asContrarianSignal, nowIso } from "./helpers.ts";
import type { EffectsDeps, KillSwitchConditionDraft, KillSwitchSignalType } from "./types.ts";

export function normalizeKillSwitchSignalType(value: string | undefined): KillSwitchSignalType {
  const normalized = value?.trim().toLowerCase();
  switch (normalized) {
    case "price_move_pct":
    case "price_move":
      return "price_move_pct";
    case "thesis_state":
    case "thesis_drift":
      return "thesis_state";
    case "earnings_event":
    case "earnings":
      return "earnings_event";
    case "sec_filing":
    case "filing":
      return "sec_filing";
    case "guidance_revision":
    case "guidance":
      return "guidance_revision";
    case "management_change":
      return "management_change";
    case "macro_regime":
    case "macro":
      return "macro_regime";
    case "analyst_rerating":
    case "analyst":
      return "analyst_rerating";
    case "news_sentiment":
    case "sentiment":
      return "news_sentiment";
    default:
      return "custom";
  }
}

export function sanitizeKillSwitchConditionDrafts(report: AnalysisReport): KillSwitchConditionDraft[] {
  const raw = report.kill_switch_conditions;
  if (!Array.isArray(raw)) {
    return [];
  }

  const parsed: KillSwitchConditionDraft[] = [];
  for (const [index, entry] of raw.entries()) {
    // deno-lint-ignore no-explicit-any
    const candidate: any = entry ?? {};
    const conditionText = typeof candidate.condition_text === "string" ? candidate.condition_text.trim() : "";
    const rationale = typeof candidate.rationale === "string" ? candidate.rationale.trim() : "";
    if (conditionText.length === 0 || rationale.length === 0) {
      continue;
    }
    const conditionId = typeof candidate.condition_id === "string" && candidate.condition_id.trim().length > 0
      ? candidate.condition_id.trim()
      : `ks_${index + 1}`;
    const thresholdValue = typeof candidate.threshold_value === "number" &&
        Number.isFinite(candidate.threshold_value)
      ? candidate.threshold_value
      : undefined;
    const thresholdUnit = candidate.threshold_unit === "pct" ||
        candidate.threshold_unit === "count" ||
        candidate.threshold_unit === "score" ||
        candidate.threshold_unit === "days"
      ? candidate.threshold_unit
      : undefined;
    const direction = candidate.direction === "against_signal" ||
        candidate.direction === "above" ||
        candidate.direction === "below" ||
        candidate.direction === "any"
      ? candidate.direction
      : undefined;

    parsed.push({
      condition_id: conditionId,
      condition_text: conditionText,
      signal_type: normalizeKillSwitchSignalType(
        typeof candidate.signal_type === "string" ? candidate.signal_type : undefined,
      ),
      rationale,
      ...(thresholdValue !== undefined ? { threshold_value: thresholdValue } : {}),
      ...(thresholdUnit ? { threshold_unit: thresholdUnit } : {}),
      ...(direction ? { direction } : {}),
      ...(typeof candidate.prompt_version === "string" && candidate.prompt_version.trim().length > 0
        ? { prompt_version: candidate.prompt_version.trim() }
        : {}),
    });
  }
  return parsed.slice(0, 5);
}

export async function createKillSwitchRulesFromReport(
  deps: Pick<EffectsDeps, "store" | "latestClose" | "now">,
  input: { report: AnalysisReport; userId?: string; requestId: string; route: string },
): Promise<void> {
  const { report, userId } = input;
  if (report.type !== "deep_dive" || !userId || !report.ticker) {
    return;
  }

  const sanitized = sanitizeKillSwitchConditionDrafts(report);
  if (sanitized.length < 3) {
    logInfo("Kill-switch rule extraction skipped due to insufficient conditions", {
      request_id: input.requestId,
      route: input.route,
      report_id: report.report_id,
      ticker: report.ticker,
      condition_count: sanitized.length,
    });
    await appendAudit(deps.store, "kill_switch.rules_skipped", {
      request_id: input.requestId,
      route: input.route,
      report_id: report.report_id,
      ticker: report.ticker,
      condition_count: sanitized.length,
      reason: "insufficient_conditions",
    }, userId);
    return;
  }

  const ticker = report.ticker.trim().toUpperCase();
  const hasPriceMoveRule = sanitized.some((rule) => rule.signal_type === "price_move_pct");
  const signalValue = asContrarianSignal(report.signal?.value);
  let anchorPrice: number | undefined;
  if (hasPriceMoveRule) {
    try {
      anchorPrice = await deps.latestClose(ticker);
      if (anchorPrice === undefined) {
        throw new Error(`EOD price unavailable for ${ticker}: missing`);
      }
    } catch (error) {
      anchorPrice = undefined;
      const message = error instanceof Error ? error.message : "anchor price lookup failed";
      logInfo("Kill-switch rules falling back without anchor price", {
        request_id: input.requestId,
        route: input.route,
        report_id: report.report_id,
        ticker,
        error_message: message,
      });
    }
  }

  const now = nowIso(deps);
  await deps.store.deactivateActiveKillSwitchRulesByUserTicker({ userId, ticker, deactivatedAt: now });
  for (const condition of sanitized) {
    await deps.store.createKillSwitchRule({
      id: crypto.randomUUID(),
      userId,
      ticker,
      reportId: report.report_id,
      signalValue,
      anchorPrice,
      conditionId: condition.condition_id,
      conditionText: condition.condition_text,
      signalType: condition.signal_type,
      rationale: condition.rationale,
      thresholdValue: condition.threshold_value,
      thresholdUnit: condition.threshold_unit,
      direction: condition.direction,
      promptVersion: condition.prompt_version ?? "unknown",
      state: "active",
      source: "dexter_prompt",
      createdAt: now,
      updatedAt: now,
    });
  }

  logInfo("Kill-switch rules created", {
    request_id: input.requestId,
    route: input.route,
    report_id: report.report_id,
    ticker,
    rule_count: sanitized.length,
  });
  await appendAudit(deps.store, "kill_switch.rules_created", {
    request_id: input.requestId,
    route: input.route,
    report_id: report.report_id,
    ticker,
    rule_count: sanitized.length,
  }, userId);
}
