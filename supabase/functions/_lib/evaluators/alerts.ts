// Push + inbox row for one alert. Replaces the repeated "sendNotification, invalidate bad tokens,
// recordAlertLedgerItem" blocks of the old server.
//
// Inbox rule: the alert_ledger row is written whatever push does. With the disabled sender nothing is
// attempted and nothing fails, so delivery_state is "sent", exactly what the old code wrote when push
// succeeded. Retries: callers pass a stable alert id; if that row exists the alert is skipped (no push, no row).
import type { EvaluatorDeps } from "./deps.ts";
import { recordConvictionJournalEntryFromAlert } from "./journal.ts";
import type { PushResult } from "./push_port.ts";
import type {
  AlertLedgerCategory,
  AlertLedgerRecord,
  AlertRouteTarget,
  NotificationType,
  PushTarget,
} from "./types.ts";
import { alertLedgerContextFromData, notificationCategory } from "./util.ts";

export interface PushTally {
  attempted: number;
  delivered: number;
  failed: number;
}

export function emptyTally(): PushTally {
  return { attempted: 0, delivered: 0, failed: 0 };
}

export function addTally(
  tally: PushTally,
  result: { attempted: number; delivered: number; failed: number },
): void {
  tally.attempted += result.attempted;
  tally.delivered += result.delivered;
  tally.failed += result.failed;
}

export async function sendPush(
  deps: EvaluatorDeps,
  targets: PushTarget[],
  payload: {
    notificationType: NotificationType;
    route: string;
    title: string;
    body: string;
    data: Record<string, string>;
  },
): Promise<PushResult> {
  if (targets.length === 0) return { attempted: 0, delivered: 0, failed: 0, skipped: 0, invalidTargets: [] };
  const result = await deps.push.send(targets, payload);
  for (const t of result.invalidTargets) {
    await deps.store.invalidateDevice({
      userId: t.userId,
      installationId: t.installationId,
      at: deps.now().toISOString(),
      reason: "fcm_invalid_registration",
    });
  }
  return result;
}

export interface LedgerInput {
  id: string;
  userId: string;
  notificationType: NotificationType;
  category?: AlertLedgerCategory;
  route: AlertRouteTarget;
  title: string;
  body: string;
  reasonCode: string;
  reasonText: string;
  deliveryState: AlertLedgerRecord["deliveryState"];
  data?: Record<string, string>;
}

// Writes the inbox row and, for Pro users, the conviction journal entry. Returns undefined when the
// row already existed (retry).
export async function recordAlertLedgerItem(
  deps: EvaluatorDeps,
  input: LedgerInput,
): Promise<AlertLedgerRecord | undefined> {
  const now = deps.now().toISOString();
  const alert: AlertLedgerRecord = {
    id: input.id,
    userId: input.userId,
    notificationType: input.notificationType,
    category: input.category ?? notificationCategory(input.notificationType),
    route: input.route,
    title: input.title,
    body: input.body,
    reasonCode: input.reasonCode,
    reasonText: input.reasonText,
    deliveryState: input.deliveryState,
    context: alertLedgerContextFromData(input.data),
    createdAt: now,
    updatedAt: now,
  };
  const inserted = await deps.store.insertAlertLedgerItem(alert);
  if (!inserted) return undefined;
  await recordConvictionJournalEntryFromAlert(deps, alert);
  return alert;
}

export interface DeliverInput {
  alertId: string;
  userId: string;
  targets: PushTarget[];
  notificationType: NotificationType;
  category?: AlertLedgerCategory;
  route: AlertRouteTarget;
  title: string;
  body: string;
  reasonCode: string;
  reasonText: string;
  // Push data (alert_id is added here).
  pushData: Record<string, string>;
  // Data that becomes the ledger context.
  ledgerData: Record<string, string>;
}

export interface DeliverResult {
  duplicate: boolean;
  push: PushResult;
  alert?: AlertLedgerRecord;
}

const noPush: PushResult = { attempted: 0, delivered: 0, failed: 0, skipped: 0, invalidTargets: [] };

export async function deliverAlert(deps: EvaluatorDeps, input: DeliverInput): Promise<DeliverResult> {
  if (await deps.store.alertExists(input.alertId)) return { duplicate: true, push: noPush };
  const push = await sendPush(deps, input.targets, {
    notificationType: input.notificationType,
    route: input.route,
    title: input.title,
    body: input.body,
    data: { alert_id: input.alertId, ...input.pushData },
  });
  const alert = await recordAlertLedgerItem(deps, {
    id: input.alertId,
    userId: input.userId,
    notificationType: input.notificationType,
    category: input.category,
    route: input.route,
    title: input.title,
    body: input.body,
    reasonCode: input.reasonCode,
    reasonText: input.reasonText,
    deliveryState: push.failed > 0 ? "partial_failure" : "sent",
    data: input.ledgerData,
  });
  return { duplicate: alert === undefined, push, alert };
}
