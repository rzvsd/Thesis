// Device tokens (app.user_devices, M1). SQL from PostgresStore in apps/product-api
// (upsertUserDevice, invalidateUserDeviceByInstallation, invalidateUserDevicesByUser, updateUserDeviceToken).
import { db, newId } from "./common.ts";
import { findUserById } from "./users.ts";

export interface DeviceUpsert {
  userId: string;
  installationId: string;
  deviceToken: string;
  platform: string;
  updatedAt: string;
}

// Returns true when a row was written; false when the input is empty or the user is missing.
export async function upsertUserDevice(input: DeviceUpsert): Promise<boolean> {
  const installation = input.installationId.trim();
  const token = input.deviceToken.trim();
  if (installation.length === 0 || token.length === 0) return false;
  if (!(await findUserById(input.userId))) return false;

  const sql = db();
  // The same token on another user or installation is rotated out first (one active row per token).
  await sql`
    update user_devices
       set invalidated_at = ${input.updatedAt},
           invalidation_reason = 'token_rotated',
           updated_at = ${input.updatedAt}
     where device_token = ${token}
       and invalidated_at is null
       and not (user_id = ${input.userId} and installation_id = ${installation})`;
  const rows = await sql`
    insert into user_devices (
      id, user_id, installation_id, device_token, platform,
      last_seen_at, created_at, updated_at, invalidated_at, invalidation_reason
    )
    values (${newId()}, ${input.userId}, ${installation}, ${token},
            ${input.platform.trim().toLowerCase() || "android"},
            ${input.updatedAt}, ${input.updatedAt}, ${input.updatedAt}, null, null)
    on conflict (user_id, installation_id) do update set
      device_token = excluded.device_token,
      platform = excluded.platform,
      last_seen_at = excluded.last_seen_at,
      updated_at = excluded.updated_at,
      invalidated_at = null,
      invalidation_reason = null
    returning id`;
  return rows.length > 0;
}

export async function invalidateDeviceByInstallation(input: {
  userId: string;
  installationId: string;
  invalidatedAt: string;
  reason: string;
}): Promise<boolean> {
  const rows = await db()`
    update user_devices
       set invalidated_at = ${input.invalidatedAt},
           invalidation_reason = ${input.reason},
           updated_at = ${input.invalidatedAt}
     where user_id = ${input.userId}
       and installation_id = ${input.installationId.trim()}
       and invalidated_at is null
    returning id`;
  return rows.length > 0;
}

export async function invalidateDevicesByUser(input: {
  userId: string;
  invalidatedAt: string;
  reason: string;
}): Promise<number> {
  const rows = await db()`
    update user_devices
       set invalidated_at = ${input.invalidatedAt},
           invalidation_reason = ${input.reason},
           updated_at = ${input.invalidatedAt}
     where user_id = ${input.userId}
       and invalidated_at is null
    returning id`;
  return rows.length;
}

// Legacy unregister (no installation id): drop every active device and the old users.device_token column.
export async function clearLegacyDeviceToken(userId: string, invalidatedAt: string): Promise<void> {
  await invalidateDevicesByUser({ userId, invalidatedAt, reason: "legacy_unset" });
  await db()`update users set device_token = null where id = ${userId}`;
}
