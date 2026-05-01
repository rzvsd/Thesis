import type { IncomingMessage, ServerResponse } from "node:http";

import type { NotificationType, SubscriptionTier } from "../../../../packages/contracts/src";
import { notificationTypes } from "../../../../packages/contracts/src";
import type { ProductStore } from "../store";

const notificationTypeList = [...notificationTypes];

interface NotificationRuntime {
  store: ProductStore;
}

interface RequestMeta {
  requestId: string;
}

interface AuthContext {
  userId: string;
  sessionId: string;
}

export interface NotificationRouteExecutionContext<TRuntime extends NotificationRuntime> {
  method: string;
  pathname: string;
  request: IncomingMessage;
  response: ServerResponse;
  runtime: TRuntime;
  meta: RequestMeta;
  auth: AuthContext;
}

export interface NotificationRouteDependencies<TRuntime extends NotificationRuntime> {
  appendAudit: (
    runtime: TRuntime,
    eventType: string,
    payload: Record<string, unknown>,
    userId?: string
  ) => Promise<void>;
  readJsonBody: <TBody>(request: IncomingMessage) => Promise<TBody>;
  sendJson: (response: ServerResponse, statusCode: number, payload: unknown) => void;
}

function isNotificationType(value: string): value is NotificationType {
  return notificationTypeList.includes(value as NotificationType);
}

function toNotificationPreferenceView(
  userId: string,
  tier: SubscriptionTier,
  rows: Array<{ type: NotificationType; enabled: boolean; quietUntil?: string }>
): {
  user_id: string;
  tier: SubscriptionTier;
  preferences: Array<{ type: NotificationType; enabled: boolean; quiet_until?: string }>;
} {
  const byType = new Map<NotificationType, { enabled: boolean; quietUntil?: string }>();
  for (const row of rows) {
    byType.set(row.type, { enabled: row.enabled, quietUntil: row.quietUntil });
  }

  return {
    user_id: userId,
    tier,
    preferences: notificationTypeList.map((type) => {
      const row = byType.get(type);
      return {
        type,
        enabled: row?.enabled ?? true,
        ...(row?.quietUntil ? { quiet_until: row.quietUntil } : {})
      };
    })
  };
}

function normalizeNotificationQuietUntil(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return new Date(parsed).toISOString();
}

export async function handleNotificationRoutes<TRuntime extends NotificationRuntime>(
  context: NotificationRouteExecutionContext<TRuntime>,
  deps: NotificationRouteDependencies<TRuntime>
): Promise<boolean> {
  const { method, pathname, request, response, runtime, meta, auth } = context;

  if (method === "POST" && pathname === "/notifications/device-token") {
    const body = await deps.readJsonBody<{
      device_token?: string | null;
      installation_id?: string | null;
      platform?: string | null;
    }>(request);
    const rawToken = body.device_token;
    const rawInstallationId = body.installation_id;
    const rawPlatform = body.platform;
    const normalizedToken =
      typeof rawToken === "string" && rawToken.trim().length > 0
        ? rawToken.trim()
        : undefined;
    const normalizedInstallationId =
      typeof rawInstallationId === "string" && rawInstallationId.trim().length > 0
        ? rawInstallationId.trim()
        : undefined;
    const normalizedPlatform =
      typeof rawPlatform === "string" && rawPlatform.trim().length > 0
        ? rawPlatform.trim().toLowerCase()
        : "android";

    if (normalizedToken && normalizedToken.length < 16) {
      deps.sendJson(response, 422, {
        error: "validation_failed",
        error_message: "device_token must be at least 16 characters."
      });
      return true;
    }

    if (normalizedInstallationId && normalizedInstallationId.length < 8) {
      deps.sendJson(response, 422, {
        error: "validation_failed",
        error_message: "installation_id must be at least 8 characters."
      });
      return true;
    }

    if (normalizedPlatform.length > 32) {
      deps.sendJson(response, 422, {
        error: "validation_failed",
        error_message: "platform must be 32 characters or fewer."
      });
      return true;
    }

    const effectiveInstallationId = normalizedInstallationId ?? `legacy:${auth.userId}`;
    const nowIso = new Date().toISOString();

    const user = await runtime.store.findUserById(auth.userId);
    if (!user) {
      deps.sendJson(response, 404, {
        error: "user_not_found",
        error_message: "User not found."
      });
      return true;
    }

    if (!normalizedToken) {
      if (normalizedInstallationId) {
        await runtime.store.invalidateUserDeviceByInstallation({
          userId: auth.userId,
          installationId: effectiveInstallationId,
          invalidatedAt: nowIso,
          reason: "client_unregistered"
        });
      } else {
        await runtime.store.invalidateUserDevicesByUser({
          userId: auth.userId,
          invalidatedAt: nowIso,
          reason: "legacy_unset"
        });
        await runtime.store.updateUserDeviceToken(auth.userId, undefined);
      }

      await deps.appendAudit(
        runtime,
        "notification.device_token_updated",
        {
          request_id: meta.requestId,
          route: pathname,
          has_token: false,
          installation_id: effectiveInstallationId,
          platform: normalizedPlatform
        },
        auth.userId
      );

      deps.sendJson(response, 200, {
        status: "ok",
        has_device_token: false,
        installation_id: effectiveInstallationId
      });
      return true;
    }

    const device = await runtime.store.upsertUserDevice({
      userId: auth.userId,
      installationId: effectiveInstallationId,
      deviceToken: normalizedToken,
      platform: normalizedPlatform,
      updatedAt: nowIso
    });
    if (!device) {
      deps.sendJson(response, 500, {
        error: "device_registration_failed",
        error_message: "Unable to register device token."
      });
      return true;
    }

    await deps.appendAudit(
      runtime,
      "notification.device_token_updated",
      {
        request_id: meta.requestId,
        route: pathname,
        has_token: true,
        installation_id: effectiveInstallationId,
        platform: normalizedPlatform
      },
      auth.userId
    );

    deps.sendJson(response, 200, {
      status: "ok",
      has_device_token: true,
      installation_id: effectiveInstallationId
    });
    return true;
  }

  if (method === "GET" && pathname === "/v1/user/notification-preferences") {
    const subscription = await runtime.store.getUserSubscription(auth.userId);
    const preferences = await runtime.store.getNotificationPreferences(auth.userId);
    const view = toNotificationPreferenceView(auth.userId, subscription.tier, preferences);

    await deps.appendAudit(
      runtime,
      "notification.preferences_retrieved",
      {
        request_id: meta.requestId,
        route: pathname,
        preference_count: view.preferences.length
      },
      auth.userId
    );

    deps.sendJson(response, 200, {
      data: view
    });
    return true;
  }

  if (method === "PUT" && pathname === "/v1/user/notification-preferences") {
    const body = await deps.readJsonBody<{
      preferences?: Array<{ type?: string; enabled?: unknown; quiet_until?: unknown }>;
    }>(request);
    const updatesRaw = Array.isArray(body.preferences) ? body.preferences : [];
    if (updatesRaw.length === 0) {
      deps.sendJson(response, 422, {
        error: "validation_failed",
        error_message: "preferences must include at least one notification type update."
      });
      return true;
    }

    const updates: Array<{
      type: NotificationType;
      enabled?: boolean;
      quietUntil?: string | null;
    }> = [];
    for (const row of updatesRaw) {
      const typeRaw = typeof row.type === "string" ? row.type.trim() : "";
      if (!typeRaw || !isNotificationType(typeRaw)) {
        deps.sendJson(response, 422, {
          error: "validation_failed",
          error_message: `Unsupported notification type: ${typeRaw || "(empty)"}`
        });
        return true;
      }
      const enabled = typeof row.enabled === "boolean" ? row.enabled : undefined;
      const quietUntil =
        row.quiet_until === null
          ? null
          : typeof row.quiet_until === "string"
            ? normalizeNotificationQuietUntil(row.quiet_until)
            : undefined;
      if (enabled === undefined && row.quiet_until === undefined) {
        deps.sendJson(response, 422, {
          error: "validation_failed",
          error_message: `preferences for type ${typeRaw} must include enabled or quiet_until.`
        });
        return true;
      }
      if (row.enabled !== undefined && enabled === undefined) {
        deps.sendJson(response, 422, {
          error: "validation_failed",
          error_message: `enabled must be boolean for type ${typeRaw}.`
        });
        return true;
      }
      if (row.quiet_until !== undefined && row.quiet_until !== null && quietUntil === undefined) {
        deps.sendJson(response, 422, {
          error: "validation_failed",
          error_message: `quiet_until must be a valid ISO timestamp or null for type ${typeRaw}.`
        });
        return true;
      }
      updates.push({
        type: typeRaw,
        enabled,
        quietUntil
      });
    }

    const updatedRows = await runtime.store.upsertNotificationPreferences({
      userId: auth.userId,
      preferences: updates,
      updatedAt: new Date().toISOString()
    });
    const subscription = await runtime.store.getUserSubscription(auth.userId);
    const view = toNotificationPreferenceView(auth.userId, subscription.tier, updatedRows);

    await deps.appendAudit(
      runtime,
      "notification.preferences_updated",
      {
        request_id: meta.requestId,
        route: pathname,
        updated_types: updates.map((entry) => entry.type)
      },
      auth.userId
    );

    deps.sendJson(response, 200, {
      data: view
    });
    return true;
  }

  return false;
}
