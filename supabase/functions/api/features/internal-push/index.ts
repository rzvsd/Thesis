// Feature "internal-push". Owner: M4 (docs/rebuild/OWNERSHIP.md).
// Push for callers outside the api function (scripts, the PDF or data jobs) and the "test push" exit check.
// Code inside the api function (M2 filing alerts, M3 evaluators) calls _lib/push directly, not these routes.
//
//   POST /internal/push/send  { user_ids: string[] (1..500), notification: { type, route, title, body, data? } }
//   POST /internal/push/test  { user_id, title?, body? }
// Both answer 200 { data: { mode, attempted, delivered, failed, skipped, invalidated } }.
// Dead tokens are marked invalid in app.user_devices. Logs carry counts and user ids only (N10).
import type { FeatureModule, Route, RouteContext } from "../../router.ts";
import { json } from "../../../_shared/http.ts";
import { logInfo } from "../../../_shared/log.ts";
import { isNotificationType } from "../../../_lib/store/profile.ts";
import {
  type PushPayload,
  type PushSender,
  pushSenderFromEnv,
  type PushTarget,
} from "../../../_lib/push/index.ts";
import { invalidatePushTargets, listPushTargets } from "../../../_lib/push/targets.ts";
import { readJsonBody, validationFailed } from "../user/http.ts";

export const MAX_USERS_PER_CALL = 500;

export interface InternalPushDeps {
  sender(): PushSender;
  listTargets(userIds: string[], notificationType: string): Promise<PushTarget[]>;
  invalidate(targets: PushTarget[], at: string): Promise<number>;
  now(): string;
}

export const pgInternalPushDeps: InternalPushDeps = {
  sender: pushSenderFromEnv,
  listTargets: listPushTargets,
  invalidate: invalidatePushTargets,
  now: () => new Date().toISOString(),
};

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t.length > 0 && t.length <= max ? t : undefined;
}

function stringMap(value: unknown): Record<string, string> | undefined | null {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") return null;
    out[k] = String(v);
  }
  return out;
}

async function deliver(deps: InternalPushDeps, userIds: string[], payload: PushPayload): Promise<Response> {
  const sender = deps.sender();
  const targets = await deps.listTargets(userIds, payload.notificationType);
  const result = await sender.send(targets, payload);
  const invalidated = result.invalidTargets.length > 0
    ? await deps.invalidate(result.invalidTargets, deps.now())
    : 0;
  logInfo("push.sent", {
    mode: sender.mode,
    notification_type: payload.notificationType,
    users: userIds.length,
    attempted: result.attempted,
    delivered: result.delivered,
    failed: result.failed,
    skipped: result.skipped,
    invalidated,
  });
  return json({
    data: {
      mode: sender.mode,
      users: userIds.length,
      targets: targets.length,
      attempted: result.attempted,
      delivered: result.delivered,
      failed: result.failed,
      skipped: result.skipped,
      invalidated,
    },
  });
}

export function internalPushRoutes(deps: InternalPushDeps = pgInternalPushDeps): Route[] {
  const send = async ({ req }: RouteContext): Promise<Response> => {
    const read = await readJsonBody(req);
    if (!read.ok) return read.response;
    const rawIds = read.body.user_ids;
    if (!Array.isArray(rawIds) || rawIds.length === 0 || rawIds.length > MAX_USERS_PER_CALL) {
      return validationFailed(`user_ids must be an array of 1 to ${MAX_USERS_PER_CALL} ids.`);
    }
    const userIds = [...new Set(rawIds.map((id) => text(id, 128)))];
    if (userIds.some((id) => id === undefined)) {
      return validationFailed("user_ids must be non-empty strings.");
    }
    const n = (read.body.notification ?? {}) as Record<string, unknown>;
    const type = text(n.type, 64);
    if (!type || !isNotificationType(type)) return validationFailed("notification.type is not a known type.");
    const route = text(n.route, 64);
    const title = text(n.title, 200);
    const body = text(n.body, 1000);
    if (!route || !title || !body) return validationFailed("notification needs route, title and body.");
    const data = stringMap(n.data);
    if (data === null) return validationFailed("notification.data must be a flat object of strings.");
    return deliver(deps, userIds as string[], { notificationType: type, route, title, body, data });
  };

  const test = async ({ req }: RouteContext): Promise<Response> => {
    const read = await readJsonBody(req);
    if (!read.ok) return read.response;
    const userId = text(read.body.user_id, 128);
    if (!userId) return validationFailed("user_id is required.");
    return deliver(deps, [userId], {
      notificationType: "market_pulse_ready",
      route: "market_pulse",
      title: text(read.body.title, 200) ?? "Thesis test notification",
      body: text(read.body.body, 1000) ?? "Push works. You can ignore this message.",
      data: { headline: "Thesis test notification" },
    });
  };

  return [
    { method: "POST", path: "/internal/push/send", auth: "internal", handler: send },
    { method: "POST", path: "/internal/push/test", auth: "internal", handler: test },
  ];
}

export const feature: FeatureModule = {
  name: "internal-push",
  owner: "M4",
  routes: internalPushRoutes(),
};
