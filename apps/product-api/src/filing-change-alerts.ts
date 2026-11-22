import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import type { AnalysisReport } from "../../../packages/contracts/src";
import type { ArtifactStore } from "./artifact-store";
import type { ProductApiConfig } from "./config";
import type { EmailNotifier } from "./email";
import { logError, logInfo } from "./logging";
import type { PushNotifier, PushTarget } from "./push";
import type { ProductStore } from "./store";
import type { ReportRecord } from "./types";

// Filing-change alert: a completed Deep Dive on a newer 10-Q/10-K than the prior Deep Dive
// tells every follower of the ticker what changed. One alert per user + ticker + filing.

const MAX_CHANGES = 3;

interface FilingAlertRuntime {
  config: ProductApiConfig;
  store: ProductStore;
  artifactStore: ArtifactStore;
  pushNotifier: PushNotifier;
  emailNotifier: EmailNotifier;
}

/** Call before the new report is stored: returns the Deep Dive it replaces, if any. */
export async function findPriorDeepDive(
  store: ProductStore,
  report: AnalysisReport
): Promise<ReportRecord | undefined> {
  if (report.type !== "deep_dive" || !report.ticker) {
    return undefined;
  }
  return store.findLatestComparableDeepDiveReport({
    ticker: report.ticker.trim().toUpperCase(),
    schemaMajor: Number.parseInt(report.schema_version, 10),
    sinceIso: new Date(0).toISOString()
  });
}

// Fingerprint format (server.ts deepDiveFingerprint): TICKER|SCHEMA_VERSION|LATEST_PERIOD.
function fingerprintPeriod(fingerprint: string | undefined): string | undefined {
  const period = fingerprint?.split("|")[2];
  return period && period !== "LATEST_UNKNOWN" ? period : undefined;
}

export function emailUnsubscribeToken(secret: string, userId: string): string {
  const signature = createHmac("sha256", secret).update(`email-unsubscribe:${userId}`).digest("base64url");
  return `${Buffer.from(userId).toString("base64url")}.${signature}`;
}

export function verifyEmailUnsubscribeToken(secret: string, token: string): string | undefined {
  const [encodedUserId, signature] = token.split(".");
  if (!encodedUserId || !signature) {
    return undefined;
  }
  const userId = Buffer.from(encodedUserId, "base64url").toString("utf-8");
  const expected = Buffer.from(emailUnsubscribeToken(secret, userId).split(".")[1] ?? "");
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? userId : undefined;
}

interface FilingChange {
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

function describeFilingChange(
  report: AnalysisReport,
  priorReport: AnalysisReport | undefined,
  ticker: string,
  period: string
): FilingChange {
  const filingIntelligence = report.filing_intelligence;
  const filing = filingIntelligence?.latest_filing;
  const form = filing && filing.form !== "unknown" ? filing.form : "quarterly or annual report";

  // Filing intelligence already compares this filing with the prior filings; add the memo-level
  // change (signal) versus the prior Deep Dive.
  const changes = [...(filingIntelligence?.top_changes ?? [])]
    .map((change) => change.trim())
    .filter((change) => change.length > 0)
    .slice(0, MAX_CHANGES);
  if (changes.length === 0 && filingIntelligence?.memo.what_changed.trim()) {
    changes.push(filingIntelligence.memo.what_changed.trim());
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
    changes
  };
}

function alertIdFor(userId: string, change: FilingChange): string {
  const digest = createHash("sha256").update(`${userId}|${change.ticker}|${change.filingKey}`).digest("hex");
  return `filing_${digest.slice(0, 32)}`;
}

function emailText(change: FilingChange, unsubscribeUrl: string | undefined): string {
  const lines = [`${change.title} (${change.period}).`, ""];
  if (change.changes.length > 0) {
    lines.push("What changed:", ...change.changes.map((item) => `- ${item}`), "");
  }
  lines.push(
    "Open Thesis to read the full Deep Dive.",
    "",
    `You get this email because you follow ${change.ticker} in Thesis.`,
    unsubscribeUrl
      ? `Stop all Thesis notification emails: ${unsubscribeUrl}`
      : "Turn these emails off in the Thesis app under notification settings."
  );
  return lines.join("\n");
}

/**
 * Sends filing-change alerts after a Deep Dive is stored. Never throws: delivery problems are
 * logged and must not fail report completion.
 */
export async function dispatchFilingChangeAlerts(
  runtime: FilingAlertRuntime,
  input: { report: AnalysisReport; prior: ReportRecord | undefined }
): Promise<void> {
  const { report, prior } = input;
  const ticker = report.ticker?.trim().toUpperCase();
  const period = report.historical_context?.latest_period?.trim().toUpperCase();
  const priorPeriod = fingerprintPeriod(prior?.fingerprint);
  // Alert only when this Deep Dive covers a newer filing than the prior one.
  if (report.type !== "deep_dive" || !ticker || !prior || !period || !priorPeriod || period <= priorPeriod) {
    return;
  }

  try {
    const followers = (await runtime.store.listUsersWithWatchlist())
      .filter((entry) => entry.tickers.some((followed) => followed.trim().toUpperCase() === ticker))
      .map((entry) => entry.userId);
    if (followers.length === 0) {
      return;
    }

    const priorReport = (await runtime.artifactStore.readReport(prior.artifactKey).catch(() => undefined)) as
      | AnalysisReport
      | undefined;
    const change = describeFilingChange(report, priorReport, ticker, period);
    const detailBody = change.changes.map((item) => `- ${item}`).join("\n");

    // Both lists already respect the filing_change preference (enabled, quiet_until); email also
    // respects the per-user email opt-out and requires a verified address.
    const pushByUser = new Map<string, PushTarget[]>();
    for (const target of await runtime.store.listUsersWithDeviceTokenByNotificationType({
      notificationType: "filing_change",
      userIds: followers
    })) {
      pushByUser.set(target.userId, [...(pushByUser.get(target.userId) ?? []), target]);
    }
    const emailByUser = new Map(
      (await runtime.store.listUsersWithEmailByNotificationType({
        notificationType: "filing_change",
        userIds: followers
      })).map((target) => [target.userId, target])
    );

    let written = 0;
    let failed = 0;
    for (const userId of followers) {
      const preference = (await runtime.store.getNotificationPreferences(userId))
        .find((row) => row.type === "filing_change");
      if (preference && !preference.enabled) {
        continue;
      }
      const alertId = alertIdFor(userId, change);
      if (await runtime.store.getAlertLedgerItem({ id: alertId, userId })) {
        continue;
      }

      let userFailed = 0;
      const pushTargets = pushByUser.get(userId) ?? [];
      if (pushTargets.length > 0) {
        const pushResult = await runtime.pushNotifier.sendNotification(pushTargets, {
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
            reason_code: "new_filing"
          }
        });
        userFailed += pushResult.failed;
        for (const invalidTarget of pushResult.invalidTargets) {
          await runtime.store.invalidateUserDeviceByInstallation({
            userId: invalidTarget.userId,
            installationId: invalidTarget.installationId,
            invalidatedAt: new Date().toISOString(),
            reason: "fcm_invalid_registration"
          });
        }
      }

      const emailTarget = emailByUser.get(userId);
      if (emailTarget) {
        const unsubscribeUrl = runtime.config.publicApiBaseUrl
          ? `${runtime.config.publicApiBaseUrl}/v1/email/unsubscribe?token=${
            emailUnsubscribeToken(runtime.config.jwtSecret, userId)
          }`
          : undefined;
        const emailResult = await runtime.emailNotifier.sendNotification([emailTarget], {
          subject: `${change.title}: ${change.body}`,
          text: emailText(change, unsubscribeUrl),
          ...(unsubscribeUrl
            ? {
              headers: {
                "List-Unsubscribe": `<${unsubscribeUrl}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
              }
            }
            : {})
        });
        userFailed += emailResult.failed;
      }

      const now = new Date().toISOString();
      await runtime.store.createAlertLedgerItem({
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
          ...(change.accession ? { filing_accession: change.accession } : {})
        },
        createdAt: now,
        updatedAt: now
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
      delivery_failures: failed
    });
  } catch (error) {
    logError("Filing change alert dispatch failed", {
      ticker,
      report_id: report.report_id,
      error_message: error instanceof Error ? error.message : "unknown"
    });
  }
}
