// Device lookups for push. Owner: M4. Reads M1's app.user_devices and app.notification_preferences
// (read and row updates only; the tables stay M1's).
import { db } from "../../_shared/db.ts";
import { invalidateDeviceByInstallation } from "../store/devices.ts";
import type { PushTarget } from "./types.ts";

// Active devices of these users that have not turned this notification type off or snoozed it
// (quiet_until in the future). A missing preference row means "on". Same filter as the old store's
// listUsersWithDeviceTokenByNotificationType.
export async function listPushTargets(userIds: string[], notificationType: string): Promise<PushTarget[]> {
  if (userIds.length === 0) return [];
  const rows = await db()`
    select d.user_id, d.installation_id, d.device_token
    from user_devices d
    where d.user_id = any(${userIds}::text[])
      and d.invalidated_at is null
      and length(trim(d.device_token)) > 0
      and not exists (
        select 1 from notification_preferences p
        where p.user_id = d.user_id
          and p.notification_type = ${notificationType}
          and (p.enabled = false or (p.quiet_until is not null and p.quiet_until > now()))
      )
    order by d.user_id, d.updated_at desc`;
  return rows.map((r) => ({
    userId: String(r.user_id),
    installationId: String(r.installation_id),
    deviceToken: String(r.device_token),
  }));
}

export async function invalidatePushTargets(targets: PushTarget[], at: string): Promise<number> {
  let count = 0;
  for (const t of targets) {
    await invalidateDeviceByInstallation({
      userId: t.userId,
      installationId: t.installationId,
      invalidatedAt: at,
      reason: "fcm_invalid_registration",
    });
    count++;
  }
  return count;
}
