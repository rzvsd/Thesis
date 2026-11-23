// Filing-change alert: a completed Deep Dive on a newer 10-Q/10-K than the prior Deep Dive
// tells every follower of the ticker what changed. One alert per user + ticker + filing.
// Ported from apps/product-api/src/filing-change-alerts.ts. Delivery goes through FilingAlertNotifier.
import { createHash } from "node:crypto";
import { logError, logInfo } from "../../../_shared/log.ts";
import type { AnalysisReport, ReportRecord } from "../types.ts";
import { nowIso } from "./helpers.ts";
import type { EffectsDeps, EffectsStore, FilingAlertNotifier, PushTarget } from "./types.ts";

const MAX_CHANGES = 3;

// Push and email are owned by later milestones. Until then nothing is delivered, and the ledger
// records partial_failure, the same as the old notifiers did with no provider credentials.
export const noopNotifier: FilingAlertNotifier = {
  sendPush: (targets) => Promise.resolve({ failed: targets.length, invalidTargets: [] }),
  sendEmail: (targets) => Promise.resolve({ failed: targets.length }),
};

/** Call before the new report is stored: returns the Deep Dive it replaces, if any. */
export function findPriorDeepDive(
  store: EffectsStore,
  report: AnalysisReport,
): Promise<ReportRecord | undefined> {
  if (report.type !== "deep_dive" || !report.ticker) {
    return Promise.resolve(undefined);
  }
  return store.findLatestComparableDeepDiveReport({
    ticker: report.ticker.trim().toUpperCase(),
    schemaMajor: Number.parseInt(report.schema_version, 10),
    sinceIso: new Date(0).toISOString(),
  });
}

// Fingerprint format (deepDiveFingerprint): TICKER|SCHEMA_VERSION|LATEST_PERIOD.
export function fingerprintPeriod(fingerprint: string | undefined): string | undefined {
  const period = fingerprint?.split("|")[2];
  return period && period !== "LATEST_UNKNOWN" ? period : undefined;
}

export interface FilingChange {
  ticker: string;
  reportId: string;
  form: string;
  period: string;
  filingKey: string;
  accession?: string;
  title: string;
  body: string;
  changes: string[];
}

interface FilingIntelligenceLike {
  latest_filing?: { form?: string; accession_number?: string };
  top_changes?: string[];
  memo?: { what_changed?: string };
}

export function describeFilingChange(
  report: AnalysisReport,
  priorReport: AnalysisReport | undefined,
  ticker: string,
  period: string,
): FilingChange {
  const filingIntelligence = report.filing_intelligence as FilingIntelligenceLike | undefined;
  const filing = filingIntelligence?.latest_filing;
  const form = filing && filing.form && filing.form !== "unknown"
    ? filing.form
    : "quarterly or annual report";

  // Filing intelligence already compares this filing with the prior filings; add the memo-level
  // change (signal) versus the prior Deep Dive.
  const changes = [...(filingIntelligence?.top_changes ?? [])]
    .filter((change): change is string => typeof change === "string")
    .map((change) => change.trim())
    .filter((change) => change.length > 0)
    .slice(0, MAX_CHANGES);
  const whatChanged = filingIntelligence?.memo?.what_changed?.trim();
  if (changes.length === 0 && whatChanged) {
    changes.push(whatChanged);
  }
  const priorSignal = priorReport?.signal?.value;
  const currentSignal = report.signal?.value;
  if (priorSignal && currentSignal && priorSignal !== currentSignal) {
    changes.push(`Signal moved from ${priorSignal} to ${currentSignal} since the last Deep Dive.`);
  }

  const count = changes.length;
  return {
    ticker,
    reportId: report.report_id,
    form,
    period,
    filingKey: filing?.accession_number ?? `${form}:${period}`,
    accession: filing?.accession_number,
    title: `${ticker} filed its ${form}`,
    body: count > 0
      ? `${count} ${count === 1 ? "thing" : "things"} changed since the last Deep Dive (${period}).`
      : `The Deep Dive is updated for ${period}.`,
    changes,
  };
}

export function filingAlertId(userId: string, change: FilingChange): string {
  const digest = createHash("sha256").update(`${userId}|${change.ticker}|${change.filingKey}`).digest("hex");
  return `filing_${digest.slice(0, 32)}`;
}

// Pro gets the full "what changed" list; Free gets the headline (same rule as detail_body in the app).
export function filingAlertEmailText(
  change: FilingChange,
  unsubscribeUrl: string | undefined,
  isPro: boolean,
): string {
  const lines = [`${change.title} (${change.period}).`, ""];
  if (change.changes.length > 0 && isPro) {
    lines.push("What changed:", ...change.changes.map((item) => `- ${item}`), "");
  } else if (change.changes.length > 0) {
    lines.push(change.body, "Upgrade to Thesis Pro in the app to see what changed.", "");
  }
  lines.push(
    "Open Thesis to read the full Deep Dive.",
    "",
    `You get this email because you follow ${change.ticker} in Thesis.`,
    unsubscribeUrl
      ? `Stop all Thesis notification emails: ${unsubscribeUrl}`
      : "Turn these emails off in the Thesis app under notification settings.",
  );
  return lines.join("\n");
}

/**
 * Sends filing-change alerts after a Deep Dive is stored. Never throws: delivery problems are
 * logged and must not fail report completion.
 */
export async function dispatchFilingChangeAlerts(
  deps: Pick<EffectsDeps, "store" | "notifier" | "readReport" | "now">,
  input: { report: AnalysisReport; prior: ReportRecord | undefined },
): Promise<void> {
  const { report, prior } = input;
  const { store, notifier } = deps;
  const ticker = report.ticker?.trim().toUpperCase();
  const period = report.historical_context?.latest_period?.trim().toUpperCase();
  const priorPeriod = fingerprintPeriod(prior?.fingerprint);
  // Alert only when this Deep Dive covers a newer filing than the prior one.
  if (report.type !== "deep_dive" || !ticker || !prior || !period || !priorPeriod || period <= priorPeriod) {
    return;
  }

  try {
    const followers = (await store.listUsersWithWatchlist())
      .filter((entry) => entry.tickers.some((followed) => followed.trim().toUpperCase() === ticker))
      .map((entry) => entry.userId);
    if (followers.length === 0) {
      return;
    }

    let priorReport: AnalysisReport | undefined;
    try {
      priorReport = await deps.readReport(prior.artifactKey);
    } catch {
      priorReport = undefined;
    }
    const change = describeFilingChange(report, priorReport, ticker, period);
    const detailBody = change.changes.map((item) => `- ${item}`).join("\n");

    // Both lists already respect the filing_change preference (enabled, quiet_until); email also
    // respects the per-user email opt-out and requires a verified address.
    const pushByUser = new Map<string, PushTarget[]>();
    for (
      const target of await store.listUsersWithDeviceTokenByNotificationType({
        notificationType: "filing_change",
        userIds: followers,
      })
    ) {
      pushByUser.set(target.userId, [...(pushByUser.get(target.userId) ?? []), target]);
    }
    const emailByUser = new Map(
      (await store.listUsersWithEmailByNotificationType({
        notificationType: "filing_change",
        userIds: followers,
      }))
        .map((target) => [target.userId, target]),
    );

    let written = 0;
    let failed = 0;
    for (const userId of followers) {
      const preference = (await store.getNotificationPreferences(userId))
        .find((row) => row.type === "filing_change");
      if (preference && !preference.enabled) {
        continue;
      }
      const alertId = filingAlertId(userId, change);
      if (await store.getAlertLedgerItem({ id: alertId, userId })) {
        continue;
      }

      let userFailed = 0;
      const pushTargets = pushByUser.get(userId) ?? [];
      if (pushTargets.length > 0) {
        const pushResult = await notifier.sendPush(pushTargets, {
          notificationType: "filing_change",
          route: "research",
          title: change.title,
          body: change.body,
          data: {
            alert_id: alertId,
            ticker,
            report_id: change.reportId,
            filing_form: change.form,
            filing_period: change.period,
            deep_link: `thesis://report/${change.reportId}`,
            deep_link_fallback: `thesis://name/${ticker}`,
            reason_code: "new_filing",
          },
        });
        userFailed += pushResult.failed;
        for (const invalidTarget of pushResult.invalidTargets) {
          await store.invalidateUserDeviceByInstallation({
            userId: invalidTarget.userId,
            installationId: invalidTarget.installationId,
            invalidatedAt: nowIso(deps),
            reason: "fcm_invalid_registration",
          });
        }
      }

      const emailTarget = emailByUser.get(userId);
      if (emailTarget) {
        const unsubscribeUrl = notifier.emailUnsubscribeUrl?.(userId);
        const emailResult = await notifier.sendEmail([emailTarget], {
          subject: `${change.title}: ${change.body}`,
          text: filingAlertEmailText(
            change,
            unsubscribeUrl,
            (await store.getUserSubscriptionTier(userId)) === "PRO",
          ),
          ...(unsubscribeUrl
            ? {
              headers: {
                "List-Unsubscribe": `<${unsubscribeUrl}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              },
            }
            : {}),
        });
        userFailed += emailResult.failed;
      }

      const now = nowIso(deps);
      await store.createAlertLedgerItem({
        id: alertId,
        userId,
        notificationType: "filing_change",
        category: "earnings",
        route: "research",
        // title + body: headline-only version. detailBody: full "what changed" (paid value).
        title: change.title,
        body: change.body,
        ...(detailBody ? { detailBody } : {}),
        reasonCode: "new_filing",
        reasonText: `${ticker} filed a new ${change.form} for ${change.period}.`,
        deliveryState: userFailed > 0 ? "partial_failure" : "sent",
        context: {
          ticker,
          report_id: change.reportId,
          filing_form: change.form,
          filing_period: change.period,
          ...(change.accession ? { filing_accession: change.accession } : {}),
        },
        createdAt: now,
        updatedAt: now,
      });
      written += 1;
      failed += userFailed;
    }

    logInfo("Filing change alerts dispatched", {
      ticker,
      report_id: change.reportId,
      filing_period: change.period,
      followers: followers.length,
      alerts_written: written,
      delivery_failures: failed,
    });
  } catch (error) {
    logError("Filing change alert dispatch failed", {
      ticker,
      report_id: report.report_id,
      error_message: error instanceof Error ? error.message : "unknown",
    });
  }
}
