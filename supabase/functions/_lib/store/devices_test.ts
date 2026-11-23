import { assertEquals } from "jsr:@std/assert@1.0.13";
import { db } from "./common.ts";
import { clearLegacyDeviceToken, invalidateDeviceByInstallation, upsertUserDevice } from "./devices.ts";
import { cleanup, dbTest, insertUser } from "./profile_testdb.ts";

async function active(userId: string) {
  return await db()`
    select installation_id, device_token, platform from user_devices
     where user_id = ${userId} and invalidated_at is null order by installation_id`;
}

// Ported from m4-push-devices.test.ts: two active devices, then an installation-level unregister.
dbTest("devices: multiple installations, unregister one, token rotation, legacy clear", async () => {
  const u1 = await insertUser();
  const u2 = await insertUser();
  const now = new Date().toISOString();
  const tokenA = `token-a-${crypto.randomUUID()}`;
  const tokenB = `token-b-${crypto.randomUUID()}`;
  try {
    const up = (userId: string, installationId: string, deviceToken: string, platform = "Android") =>
      upsertUserDevice({ userId, installationId, deviceToken, platform, updatedAt: now });
    assertEquals(await up(u1, "install-a", tokenA), true);
    assertEquals(await up(u1, "install-b", tokenB), true);
    assertEquals((await active(u1)).map((r) => r.installation_id), ["install-a", "install-b"]);
    assertEquals((await active(u1))[0].platform, "android");

    assertEquals(
      await invalidateDeviceByInstallation({
        userId: u1,
        installationId: "install-b",
        invalidatedAt: now,
        reason: "client_unregistered",
      }),
      true,
    );
    assertEquals((await active(u1)).map((r) => r.installation_id), ["install-a"]);

    // Registering B again reactivates the row.
    assertEquals(await up(u1, "install-b", tokenB), true);
    assertEquals((await active(u1)).length, 2);

    // The same token on another user rotates the old row out (partial unique index on active tokens).
    assertEquals(await up(u2, "install-c", tokenA), true);
    assertEquals((await active(u1)).map((r) => r.installation_id), ["install-b"]);
    const rotated = await db()`
      select invalidation_reason from user_devices where user_id = ${u1} and installation_id = 'install-a'`;
    assertEquals(rotated[0].invalidation_reason, "token_rotated");

    await db()`update users set device_token = 'legacy-token' where id = ${u1}`;
    await clearLegacyDeviceToken(u1, now);
    assertEquals((await active(u1)).length, 0);
    const userRow = await db()`select device_token from users where id = ${u1}`;
    assertEquals(userRow[0].device_token, null);

    // Missing user or empty token: nothing written.
    assertEquals(await up("m1-test-missing-user", "install-x", tokenB), false);
    assertEquals(await up(u1, "install-x", "  "), false);
  } finally {
    await cleanup([u1, u2], []);
  }
});
