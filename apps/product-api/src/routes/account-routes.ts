import type { IncomingMessage, ServerResponse } from "node:http";

import type { ProductApiConfig } from "../config";
import type { EmailNotifier } from "../email";
import { createId, createOpaqueToken, hashOpaqueToken, hashPassword } from "../security";
import type { AccountActionPurpose, ProductStore } from "../store";

interface AccountRuntime {
  config: ProductApiConfig;
  store: ProductStore;
  emailNotifier: EmailNotifier;
}

interface AuthContext {
  userId: string;
  sessionId: string;
}

export interface AccountRouteExecutionContext<TRuntime extends AccountRuntime> {
  method: string;
  pathname: string;
  request: IncomingMessage;
  response: ServerResponse;
  runtime: TRuntime;
  meta: { requestId: string };
}

export interface AccountRouteDependencies<TRuntime extends AccountRuntime> {
  appendAudit: (
    runtime: TRuntime,
    eventType: string,
    details: Record<string, unknown>,
    userId?: string
  ) => Promise<void>;
  authenticateAccessToken: (
    runtime: TRuntime,
    request: IncomingMessage
  ) => Promise<AuthContext | undefined>;
  isValidEmail: (value: string) => boolean;
  normalizeEmail: (value: string) => string;
  readJsonBody: <TBody>(request: IncomingMessage) => Promise<TBody>;
  sendJson: (response: ServerResponse, statusCode: number, payload: unknown) => void;
}

const ACCOUNT_ACTION_TOKEN_TTL_SECONDS = 60 * 60;
const ACCOUNT_ACTION_TOKEN_BYTES = 16;
const MAX_FORM_BODY_BYTES = 4096;

const STORE_SUBSCRIPTION_NOTICE =
  "Deleting your account does not cancel a Google Play subscription. " +
  "To stop billing, open the Google Play Store app, tap your profile icon, " +
  "then Payments & subscriptions > Subscriptions > Thesis > Cancel subscription.";

const RESET_REQUESTED_MESSAGE =
  "If an account exists for this email, we sent a reset code. It expires in 1 hour.";

export async function handleAccountRoutes<TRuntime extends AccountRuntime>(
  context: AccountRouteExecutionContext<TRuntime>,
  deps: AccountRouteDependencies<TRuntime>
): Promise<boolean> {
  const { method, pathname, request, response, runtime, meta } = context;

  if (method === "POST" && pathname === "/auth/password-reset/request") {
    const body = await deps.readJsonBody<{ email?: string }>(request);
    const email = deps.normalizeEmail(body.email ?? "");
    if (!deps.isValidEmail(email)) {
      deps.sendJson(response, 422, {
        error: "validation_failed",
        error_message: "A valid email is required."
      });
      return true;
    }

    const rawToken = await issueAccountActionToken(runtime, email, "password_reset");
    // Same response whether or not the account exists.
    deps.sendJson(response, 202, {
      status: "reset_requested",
      message: RESET_REQUESTED_MESSAGE,
      reset_token: runtime.config.exposeVerificationToken ? rawToken : undefined
    });
    return true;
  }

  if (method === "POST" && pathname === "/auth/password-reset/confirm") {
    const body = await deps.readJsonBody<{ token?: string; new_password?: string }>(request);
    const token = body.token?.trim();
    const newPassword = body.new_password ?? "";
    if (!token || newPassword.length < 8) {
      deps.sendJson(response, 422, {
        error: "validation_failed",
        error_message: "token and new_password (min 8 chars) are required."
      });
      return true;
    }

    const nowIso = new Date().toISOString();
    const consumed = await runtime.store.consumeAccountActionToken(
      "password_reset",
      hashOpaqueToken(token),
      nowIso
    );
    if (!consumed) {
      deps.sendJson(response, 400, {
        error: "invalid_reset_token",
        error_message: "The reset code is invalid or expired."
      });
      return true;
    }

    const passwordHash = await hashPassword(newPassword, runtime.config.bcryptCost);
    const user = await runtime.store.updateUserPasswordHash(consumed.userId, passwordHash);
    if (!user) {
      deps.sendJson(response, 400, {
        error: "invalid_reset_token",
        error_message: "The reset code is invalid or expired."
      });
      return true;
    }
    // The code was delivered to the account email, so it also proves email ownership.
    if (!user.verifiedAt) {
      await runtime.store.markUserVerified(user.id, nowIso);
    }
    await runtime.store.clearFailedLoginAttempts(user.id);
    const revokedSessions = await runtime.store.revokeAllUserSessions(
      user.id,
      nowIso,
      "password_reset"
    );

    await deps.appendAudit(
      runtime,
      "auth.password_reset_completed",
      {
        request_id: meta.requestId,
        route: pathname,
        revoked_sessions: revokedSessions
      },
      user.id
    );

    deps.sendJson(response, 200, { status: "password_reset" });
    return true;
  }

  if (method === "DELETE" && pathname === "/v1/account") {
    const auth = await deps.authenticateAccessToken(runtime, request);
    if (!auth) {
      deps.sendJson(response, 401, {
        error: "unauthorized",
        error_message: "Authentication required."
      });
      return true;
    }

    const result = await deleteAccount(runtime, deps, auth.userId, "app", meta.requestId);
    deps.sendJson(response, 200, {
      status: "deleted",
      store_subscription_notice: result.hadPaidTier ? STORE_SUBSCRIPTION_NOTICE : undefined
    });
    return true;
  }

  if (method === "GET" && pathname === "/auth/delete-account") {
    sendHtml(
      response,
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
<p class="note">${STORE_SUBSCRIPTION_NOTICE}</p>`
    );
    return true;
  }

  if (method === "POST" && pathname === "/auth/delete-account") {
    const form = await readFormBody(request);
    const email = deps.normalizeEmail(form.get("email") ?? "");
    if (!deps.isValidEmail(email)) {
      sendHtml(
        response,
        422,
        "Delete your Thesis account",
        `<p>Please enter a valid email.</p><p><a href="/auth/delete-account">Back</a></p>`
      );
      return true;
    }

    await issueAccountActionToken(runtime, email, "account_deletion");
    sendHtml(
      response,
      200,
      "Confirm account deletion",
      `<p>If an account exists for this email, we sent a confirmation code. It expires in 1 hour.</p>
<form method="post" action="/auth/delete-account/confirm">
<label>Confirmation code <input type="text" name="token" required autocomplete="one-time-code"></label>
<button type="submit">Permanently delete my account</button>
</form>`
    );
    return true;
  }

  if (method === "POST" && pathname === "/auth/delete-account/confirm") {
    const form = await readFormBody(request);
    const token = form.get("token")?.trim();
    const consumed = token
      ? await runtime.store.consumeAccountActionToken(
        "account_deletion",
        hashOpaqueToken(token),
        new Date().toISOString()
      )
      : undefined;
    if (!consumed) {
      sendHtml(
        response,
        400,
        "Code not valid",
        `<p>The confirmation code is invalid or expired.</p>
<p><a href="/auth/delete-account">Request a new code</a></p>`
      );
      return true;
    }

    await deleteAccount(runtime, deps, consumed.userId, "web", meta.requestId);
    sendHtml(
      response,
      200,
      "Account deleted",
      `<p>Your Thesis account and its personal data have been deleted.</p>
<p class="note">${STORE_SUBSCRIPTION_NOTICE}</p>`
    );
    return true;
  }

  return false;
}

async function issueAccountActionToken(
  runtime: AccountRuntime,
  email: string,
  purpose: AccountActionPurpose
): Promise<string | undefined> {
  const user = await runtime.store.findUserByEmail(email);
  if (!user) {
    return undefined;
  }

  const rawToken = createOpaqueToken(ACCOUNT_ACTION_TOKEN_BYTES);
  const now = new Date();
  await runtime.store.createAccountActionToken({
    id: createId(),
    userId: user.id,
    purpose,
    tokenHash: hashOpaqueToken(rawToken),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ACCOUNT_ACTION_TOKEN_TTL_SECONDS * 1000).toISOString()
  });

  const payload =
    purpose === "password_reset"
      ? {
        subject: "Your Thesis password reset code",
        text:
          `Your password reset code is:\n\n${rawToken}\n\n` +
          "Enter it in the Thesis app to choose a new password. It expires in 1 hour. " +
          "If you did not ask for this, ignore this email."
      }
      : {
        subject: "Confirm deletion of your Thesis account",
        text:
          `Your account deletion code is:\n\n${rawToken}\n\n` +
          "Enter it on the account deletion page to permanently delete your account. " +
          "It expires in 1 hour. If you did not ask for this, ignore this email."
      };
  // Not awaited, so the response time does not reveal whether the account exists.
  void runtime.emailNotifier.sendNotification([{ userId: user.id, email: user.email }], payload);
  return rawToken;
}

async function deleteAccount<TRuntime extends AccountRuntime>(
  runtime: TRuntime,
  deps: AccountRouteDependencies<TRuntime>,
  userId: string,
  via: "app" | "web",
  requestId: string
): Promise<{ hadPaidTier: boolean }> {
  const subscription = await runtime.store.getUserSubscription(userId);
  const hadPaidTier = subscription.tier !== "FREE";
  // Sessions are deleted with the user row, so every issued token stops working.
  await runtime.store.deleteUserAccount(userId);
  // Logged without a user link: the user row no longer exists.
  await deps.appendAudit(runtime, "account.deleted", {
    request_id: requestId,
    deleted_user_id: userId,
    via,
    had_paid_tier: hadPaidTier
  });
  return { hadPaidTier };
}

function readFormBody(request: IncomingMessage): Promise<URLSearchParams> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      body += chunk;
      if (body.length > MAX_FORM_BODY_BYTES) {
        request.destroy();
        reject(new Error("Form body too large"));
      }
    });
    request.on("end", () => resolve(new URLSearchParams(body)));
    request.on("error", reject);
  });
}

function sendHtml(response: ServerResponse, statusCode: number, title: string, body: string): void {
  response.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "content-security-policy":
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'"
  });
  response.end(`<!doctype html>
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
</html>`);
}
