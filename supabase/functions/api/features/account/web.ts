// Web delete-account flow (store listing requirement). Markup copied from apps/product-api account-routes.ts.
// Forms post to absolute paths with urlencoded bodies. The deletion code goes out by email.
import { rules } from "../../../_lib/store/rate_limit.ts";
import {
  createOpaqueToken,
  hashOpaqueToken,
  isOtpCode,
  isValidEmail,
  normalizeEmail,
  parseCode,
} from "../../../_lib/auth/tokens.ts";
import { logInfo } from "../../../_shared/log.ts";
import type { RouteContext } from "../../router.ts";
import { escapeHtml, html } from "../web/html.ts";
import type { AuthDeps } from "../auth/deps.ts";
import { deleteAccount, STORE_SUBSCRIPTION_NOTICE } from "./delete.ts";

const ACCOUNT_ACTION_TOKEN_TTL_SECONDS = 60 * 60;
const ACCOUNT_ACTION_TOKEN_BYTES = 16;
const MAX_FORM_BODY_BYTES = 4096;

const CSP = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'";

export function page(status: number, title: string, body: string): Response {
  return html(
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
label { display: block; margin: 1rem 0; }
input { display: block; width: 100%; padding: 0.5rem; margin-top: 0.25rem; box-sizing: border-box; }
button { padding: 0.6rem 1rem; }
.note { color: #555; font-size: 0.9rem; }
</style>
</head>
<body>
<h1>${title}</h1>
${body}
</body>
</html>`,
    status,
    { "cache-control": "no-store" },
    CSP,
  );
}

async function readForm(req: Request): Promise<URLSearchParams> {
  try {
    const text = await req.text();
    return new URLSearchParams(text.length > MAX_FORM_BODY_BYTES ? "" : text);
  } catch {
    return new URLSearchParams();
  }
}

export function formPage(get: () => AuthDeps) {
  return async ({ req }: RouteContext): Promise<Response> => {
    const limited = await get().rateLimit(req, rules().login, "/auth/delete-account");
    if (limited) return limited;
    return page(
      200,
      "Delete your Thesis account",
      `<p>Enter the email of your Thesis account. We will email you a confirmation code.
Deleting your account permanently removes your profile, watchlists, notes, alerts,
devices and all other personal data. This cannot be undone.</p>
<p>You can also delete your account in the app: You &gt; Delete account.</p>
<form method="post" action="/auth/delete-account">
<label>Email <input type="email" name="email" required autocomplete="email"></label>
<button type="submit">Send confirmation code</button>
</form>
<p class="note">${STORE_SUBSCRIPTION_NOTICE}</p>`,
    );
  };
}

export function requestCode(get: () => AuthDeps) {
  return async ({ req }: RouteContext): Promise<Response> => {
    const d = get();
    const limited = await d.rateLimit(req, rules().login, "/auth/delete-account");
    if (limited) return limited;
    const form = await readForm(req);
    const email = normalizeEmail(form.get("email") ?? "");
    if (!isValidEmail(email)) {
      return page(
        422,
        "Delete your Thesis account",
        `<p>Please enter a valid email.</p><p><a href="/auth/delete-account">Back</a></p>`,
      );
    }
    const user = await d.store.findUserByEmail(email);
    if (user) {
      let send;
      if (d.email.deletionCodeSource === "app") {
        // Our own code: hashed, single use, 1 hour, a new one supersedes the old.
        const raw = createOpaqueToken(ACCOUNT_ACTION_TOKEN_BYTES);
        const now = d.now();
        await d.store.createAccountActionToken({
          userId: user.id,
          purpose: "account_deletion",
          tokenHash: await hashOpaqueToken(raw),
          createdAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + ACCOUNT_ACTION_TOKEN_TTL_SECONDS * 1000).toISOString(),
        });
        send = d.email.accountDeletionCode(email, raw);
      } else {
        // Supabase driver: a magic link OTP (the template prints the 6-digit code, or "v1d.{{ .TokenHash }}").
        // Supabase's verify also accepts a sign-up or reset code for the same address, so a deletion is only
        // honoured while this request's challenge is open (1 hour, a new request supersedes it).
        const now = d.now();
        await d.store.createAccountActionToken({
          userId: user.id,
          purpose: "account_deletion",
          tokenHash: await deletionChallengeHash(user.id),
          createdAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + ACCOUNT_ACTION_TOKEN_TTL_SECONDS * 1000).toISOString(),
        });
        send = d.email.accountDeletionCode(email);
      }
      // Not awaited, so the response time does not reveal whether the account exists.
      d.defer(send.then((r) => {
        logInfo("Account deletion email dispatched", {
          user_id: user.id,
          provider: r.provider,
          delivered: r.delivered,
        });
      }));
    }
    return page(
      200,
      "Confirm account deletion",
      `<p>If an account exists for this email, we sent a confirmation code. It expires in 1 hour.</p>
<form method="post" action="/auth/delete-account/confirm">
<input type="hidden" name="email" value="${escapeHtml(email)}">
<label>Confirmation code <input type="text" name="token" required autocomplete="one-time-code"></label>
<button type="submit">Permanently delete my account</button>
</form>`,
    );
  };
}

// The open deletion request of a user on the Supabase driver. Only ever compared on that driver, where typed
// codes never reach the hashed-token lookup, so nobody can submit this value as a code.
function deletionChallengeHash(userId: string): Promise<string> {
  return hashOpaqueToken(`supabase-deletion-challenge:${userId}`);
}

// Resolves a deletion code to a user id.
// Supabase driver: a 6-digit code (with the email from the form) or a "v1d." code, and only while a deletion
// request for that user is open. App driver (Resend): our own untagged code, stored hashed.
async function consumeDeletionCode(d: AuthDeps, token: string, email: string): Promise<string | undefined> {
  if (d.email.deletionCodeSource === "supabase") {
    let userId: string | undefined;
    if (isOtpCode(token)) {
      if (!isValidEmail(email)) return undefined;
      const res = await d.gotrue.verifyOtp("email", email, token);
      userId = res.ok ? res.data?.user?.id : undefined;
    } else {
      const code = parseCode(token);
      if (code?.tag !== "v1d") return undefined;
      const res = await d.gotrue.verify("magiclink", code.hash);
      userId = res.ok ? res.data?.user?.id : undefined;
    }
    if (!userId) return undefined;
    const user = await d.store.findUserById(userId);
    if (!user) return undefined;
    const open = await d.store.consumeAccountActionToken(
      "account_deletion",
      await deletionChallengeHash(user.id),
      d.now().toISOString(),
    );
    return open?.userId === user.id ? user.id : undefined;
  }
  const code = parseCode(token);
  if (code && code.tag !== null) return undefined;
  const consumed = await d.store.consumeAccountActionToken(
    "account_deletion",
    await hashOpaqueToken(token),
    d.now().toISOString(),
  );
  return consumed?.userId;
}

export function confirmDelete(get: () => AuthDeps) {
  return async ({ req }: RouteContext): Promise<Response> => {
    const d = get();
    const limited = await d.rateLimit(req, rules().login, "/auth/delete-account/confirm");
    if (limited) return limited;
    const form = await readForm(req);
    const token = form.get("token")?.trim();
    const email = normalizeEmail(form.get("email") ?? "");
    const userId = token ? await consumeDeletionCode(d, token, email) : undefined;
    if (!userId) {
      return page(
        400,
        "Code not valid",
        `<p>The confirmation code is invalid or expired.</p>
<p><a href="/auth/delete-account">Request a new code</a></p>`,
      );
    }
    await deleteAccount(d, userId, "web");
    return page(
      200,
      "Account deleted",
      `<p>Your Thesis account and its personal data have been deleted.</p>
<p class="note">${STORE_SUBSCRIPTION_NOTICE}</p>`,
    );
  };
}
