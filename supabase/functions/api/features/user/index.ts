// Feature "user": profile, notification preferences, email preferences. Owner: M1.
// Ported from apps/product-api/src/server.ts (/v1/user/profile) and routes/notification-routes.ts.
import type { FeatureModule, Route, RouteContext } from "../../router.ts";
import { apiError, json } from "../../../_shared/http.ts";
import { getUserTier, type Tier } from "../../../_lib/store/users.ts";
import {
  buildUserProfile,
  getEmailOptOut,
  getNotificationPreferences,
  isNotificationType,
  NOTIFICATION_TYPES,
  type NotificationPreference,
  type NotificationPreferenceUpdate,
  setEmailOptOut,
  upsertNotificationPreferences,
  type UserProfile,
} from "../../../_lib/store/profile.ts";
import { bucketOf, generalLimit, type Limiter, readJsonBody, validationFailed } from "./http.ts";

export interface UserDeps {
  limit: Limiter;
  profile(userId: string): Promise<UserProfile | undefined>;
  tier(userId: string): Promise<Tier>;
  getPreferences(userId: string): Promise<NotificationPreference[]>;
  upsertPreferences(
    userId: string,
    updates: NotificationPreferenceUpdate[],
    updatedAt: string,
  ): Promise<NotificationPreference[]>;
  getEmailOptOut(userId: string): Promise<boolean>;
  setEmailOptOut(userId: string, optOut: boolean, updatedAt: string): Promise<void>;
}

export const pgUserDeps: UserDeps = {
  limit: generalLimit,
  profile: (userId) => buildUserProfile(userId),
  tier: getUserTier,
  getPreferences: getNotificationPreferences,
  upsertPreferences: upsertNotificationPreferences,
  getEmailOptOut,
  setEmailOptOut,
};

// Every notification type, with enabled = true for types the user never set.
export function toPreferenceView(userId: string, tier: Tier, rows: NotificationPreference[]) {
  const byType = new Map(rows.map((row) => [row.type, row]));
  return {
    user_id: userId,
    tier,
    preferences: NOTIFICATION_TYPES.map((type) => {
      const row = byType.get(type);
      return {
        type,
        enabled: row?.enabled ?? true,
        ...(row?.quietUntil ? { quiet_until: row.quietUntil } : {}),
      };
    }),
  };
}

function normalizeQuietUntil(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

// Validates the PUT body exactly like the old server. Returns updates or a 422 message.
export function parsePreferenceUpdates(
  body: Record<string, unknown>,
): { updates: NotificationPreferenceUpdate[] } | { error: string } {
  const raw = Array.isArray(body.preferences) ? body.preferences : [];
  if (raw.length === 0) return { error: "preferences must include at least one notification type update." };
  const updates: NotificationPreferenceUpdate[] = [];
  for (const item of raw) {
    const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const typeRaw = typeof row.type === "string" ? row.type.trim() : "";
    if (!typeRaw || !isNotificationType(typeRaw)) {
      return { error: `Unsupported notification type: ${typeRaw || "(empty)"}` };
    }
    const enabled = typeof row.enabled === "boolean" ? row.enabled : undefined;
    const quietUntil = row.quiet_until === null
      ? null
      : typeof row.quiet_until === "string"
      ? normalizeQuietUntil(row.quiet_until)
      : undefined;
    if (enabled === undefined && row.quiet_until === undefined) {
      return { error: `preferences for type ${typeRaw} must include enabled or quiet_until.` };
    }
    if (row.enabled !== undefined && enabled === undefined) {
      return { error: `enabled must be boolean for type ${typeRaw}.` };
    }
    if (row.quiet_until !== undefined && row.quiet_until !== null && quietUntil === undefined) {
      return { error: `quiet_until must be a valid ISO timestamp or null for type ${typeRaw}.` };
    }
    updates.push({ type: typeRaw, enabled, quietUntil });
  }
  return { updates };
}

export function userRoutes(deps: UserDeps = pgUserDeps): Route[] {
  const getProfile = async ({ req, path, auth }: RouteContext) => {
    const limited = await deps.limit(req, bucketOf(path));
    if (limited) return limited;
    const profile = await deps.profile(auth.userId!);
    if (!profile) return apiError(404, "user_not_found", "User not found.");
    return json({ data: profile });
  };

  const emailPreferences = async ({ req, path, auth }: RouteContext) => {
    const limited = await deps.limit(req, bucketOf(path));
    if (limited) return limited;
    const userId = auth.userId!;
    if (req.method === "PUT") {
      const read = await readJsonBody(req);
      if (!read.ok) return read.response;
      const optOut = read.body.email_opt_out;
      if (typeof optOut !== "boolean") return validationFailed("email_opt_out must be boolean.");
      await deps.setEmailOptOut(userId, optOut, new Date().toISOString());
    }
    return json({ data: { email_opt_out: await deps.getEmailOptOut(userId) } });
  };

  const getPreferences = async ({ req, path, auth }: RouteContext) => {
    const limited = await deps.limit(req, bucketOf(path));
    if (limited) return limited;
    const userId = auth.userId!;
    const tier = await deps.tier(userId);
    const rows = await deps.getPreferences(userId);
    return json({ data: toPreferenceView(userId, tier, rows) });
  };

  const putPreferences = async ({ req, path, auth }: RouteContext) => {
    const limited = await deps.limit(req, bucketOf(path));
    if (limited) return limited;
    const userId = auth.userId!;
    const read = await readJsonBody(req);
    if (!read.ok) return read.response;
    const parsed = parsePreferenceUpdates(read.body);
    if ("error" in parsed) return validationFailed(parsed.error);
    const rows = await deps.upsertPreferences(userId, parsed.updates, new Date().toISOString());
    const tier = await deps.tier(userId);
    return json({ data: toPreferenceView(userId, tier, rows) });
  };

  return [
    { method: "GET", path: "/v1/user/profile", auth: "user", handler: getProfile },
    { method: "GET", path: "/v1/user/notification-preferences", auth: "user", handler: getPreferences },
    { method: "PUT", path: "/v1/user/notification-preferences", auth: "user", handler: putPreferences },
    { method: "GET", path: "/v1/user/email-preferences", auth: "user", handler: emailPreferences },
    { method: "PUT", path: "/v1/user/email-preferences", auth: "user", handler: emailPreferences },
  ];
}

export const feature: FeatureModule = {
  name: "user",
  owner: "M1",
  routes: userRoutes(),
};
