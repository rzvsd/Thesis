// DB-gated test for setEmailOptOut. Runs only with THESIS_TEST_DB_URL; rows are removed after.
import { assertEquals } from "jsr:@std/assert@1.0.13";
import { db } from "./common.ts";
import { setEmailOptOut } from "./email_prefs_unsub.ts";

Deno.test({
  name: "setEmailOptOut inserts then updates the user's preference row",
  ignore: !Deno.env.get("THESIS_TEST_DB_URL"),
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const user = `m1-unsub-${crypto.randomUUID()}`;
    await db()`insert into users (id, email, created_at) values (${user}, ${`${user}@example.test`}, now())`;
    try {
      await setEmailOptOut({ userId: user, optOut: true, updatedAt: "2026-04-01T10:00:00.000Z" });
      let rows =
        await db()`select email_opt_out, updated_at from user_email_preferences where user_id = ${user}`;
      assertEquals(rows[0].email_opt_out, true);
      await setEmailOptOut({ userId: user, optOut: false, updatedAt: "2026-04-02T10:00:00.000Z" });
      rows = await db()`select email_opt_out, updated_at from user_email_preferences where user_id = ${user}`;
      assertEquals(rows.length, 1);
      assertEquals(rows[0].email_opt_out, false);
      assertEquals((rows[0].updated_at as Date).toISOString(), "2026-04-02T10:00:00.000Z");
    } finally {
      await db()`delete from user_email_preferences where user_id = ${user}`;
      await db()`delete from users where id = ${user}`;
    }
  },
});
