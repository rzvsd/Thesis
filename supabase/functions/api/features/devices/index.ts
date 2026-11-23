// Feature "devices": POST /notifications/device-token. Owner: M1.
// Ported from apps/product-api/src/routes/notification-routes.ts. A missing or empty device_token means
// unregister (Kotlin sends device_token: null, which drops the key). No installation_id = "legacy:<userId>".
import type { FeatureModule, Route, RouteContext } from "../../router.ts";
import { apiError, json } from "../../../_shared/http.ts";
import { findUserById } from "../../../_lib/store/users.ts";
import {
  clearLegacyDeviceToken,
  type DeviceUpsert,
  invalidateDeviceByInstallation,
  upsertUserDevice,
} from "../../../_lib/store/devices.ts";
import { bucketOf, generalLimit, type Limiter, readJsonBody, validationFailed } from "../user/http.ts";

export interface DevicesDeps {
  limit: Limiter;
  userExists(userId: string): Promise<boolean>;
  upsert(input: DeviceUpsert): Promise<boolean>;
  unregisterInstallation(userId: string, installationId: string, at: string): Promise<void>;
  unregisterLegacy(userId: string, at: string): Promise<void>;
}

export const pgDevicesDeps: DevicesDeps = {
  limit: generalLimit,
  userExists: async (userId) => (await findUserById(userId)) !== undefined,
  upsert: upsertUserDevice,
  unregisterInstallation: async (userId, installationId, at) => {
    await invalidateDeviceByInstallation({
      userId,
      installationId,
      invalidatedAt: at,
      reason: "client_unregistered",
    });
  },
  unregisterLegacy: clearLegacyDeviceToken,
};

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function devicesRoutes(deps: DevicesDeps = pgDevicesDeps): Route[] {
  const register = async ({ req, path, auth }: RouteContext) => {
    const limited = await deps.limit(req, bucketOf(path));
    if (limited) return limited;
    const userId = auth.userId!;
    const read = await readJsonBody(req);
    if (!read.ok) return read.response;
    const token = nonEmpty(read.body.device_token);
    const installationId = nonEmpty(read.body.installation_id);
    const platform = nonEmpty(read.body.platform)?.toLowerCase() ?? "android";

    if (token && token.length < 16) return validationFailed("device_token must be at least 16 characters.");
    if (installationId && installationId.length < 8) {
      return validationFailed("installation_id must be at least 8 characters.");
    }
    if (platform.length > 32) return validationFailed("platform must be 32 characters or fewer.");

    const effectiveInstallationId = installationId ?? `legacy:${userId}`;
    const now = new Date().toISOString();
    if (!(await deps.userExists(userId))) return apiError(404, "user_not_found", "User not found.");

    if (!token) {
      if (installationId) await deps.unregisterInstallation(userId, effectiveInstallationId, now);
      else await deps.unregisterLegacy(userId, now);
      return json({ status: "ok", has_device_token: false, installation_id: effectiveInstallationId });
    }

    const saved = await deps.upsert({
      userId,
      installationId: effectiveInstallationId,
      deviceToken: token,
      platform,
      updatedAt: now,
    });
    if (!saved) return apiError(500, "device_registration_failed", "Unable to register device token.");
    return json({ status: "ok", has_device_token: true, installation_id: effectiveInstallationId });
  };

  return [{ method: "POST", path: "/notifications/device-token", auth: "user", handler: register }];
}

export const feature: FeatureModule = {
  name: "devices",
  owner: "M1",
  routes: devicesRoutes(),
};
