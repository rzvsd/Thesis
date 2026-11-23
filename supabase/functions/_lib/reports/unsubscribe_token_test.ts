import { assertEquals } from "jsr:@std/assert@1.0.13";
import { signUnsubscribeToken, unsubscribeUrl, verifyUnsubscribeToken } from "./unsubscribe_token.ts";

// Made by the old server's emailUnsubscribeToken("dev-jwt-secret-change-me", "user-123") in Node.
const OLD_TOKEN = "dXNlci0xMjM.bvLsnj-t0v_wce5QgzCNgiL4CxUoHzdtfbiuaWlnVk4";
const SECRET = "dev-jwt-secret-change-me";

Deno.test("signUnsubscribeToken matches the old server's tokens byte for byte", async () => {
  assertEquals(await signUnsubscribeToken("user-123", SECRET), OLD_TOKEN);
});

Deno.test("verifyUnsubscribeToken accepts old tokens and rejects tampered ones", async () => {
  assertEquals(await verifyUnsubscribeToken(OLD_TOKEN, SECRET), "user-123");
  assertEquals(await verifyUnsubscribeToken(OLD_TOKEN, "another-secret-value"), undefined);
  assertEquals(await verifyUnsubscribeToken(OLD_TOKEN.slice(0, -2) + "xx", SECRET), undefined);
  assertEquals(await verifyUnsubscribeToken("no-dot", SECRET), undefined);
  assertEquals(await verifyUnsubscribeToken("", SECRET), undefined);
  assertEquals(await verifyUnsubscribeToken("!!!.abc", SECRET), undefined);
});

Deno.test("tokens use EMAIL_LINK_SECRET and links use PUBLIC_API_BASE_URL", async () => {
  Deno.env.delete("EMAIL_LINK_SECRET");
  assertEquals(await signUnsubscribeToken("user-123"), undefined);
  assertEquals(await verifyUnsubscribeToken(OLD_TOKEN), undefined);
  Deno.env.set("EMAIL_LINK_SECRET", SECRET);
  Deno.env.set("PUBLIC_API_BASE_URL", "https://thesis.example.workers.dev/");
  try {
    assertEquals(await verifyUnsubscribeToken(OLD_TOKEN), "user-123");
    assertEquals(
      await unsubscribeUrl("user-123"),
      `https://thesis.example.workers.dev/v1/email/unsubscribe?token=${OLD_TOKEN}`,
    );
    Deno.env.delete("PUBLIC_API_BASE_URL");
    assertEquals(await unsubscribeUrl("user-123"), undefined);
  } finally {
    Deno.env.delete("EMAIL_LINK_SECRET");
    Deno.env.delete("PUBLIC_API_BASE_URL");
  }
});
