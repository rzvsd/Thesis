// /auth/register, /verify, /login, /refresh, /logout, /google, /google/link.
// Ported from apps/product-api/src/routes/auth-routes.ts. Supabase Auth owns passwords and sessions (D6);
// docs/rebuild/M1-auth-mapping.md maps each route to its GoTrue calls.
import { apiError, json } from "../../../_shared/http.ts";
import { logInfo } from "../../../_shared/log.ts";
import { maybeBootstrapAdmin } from "../../../_lib/auth/bootstrap.ts";
import { isEmailExists, isWeakPassword } from "../../../_lib/auth/gotrue.ts";
import {
  isValidEmail,
  looksLikeJwt,
  mapSession,
  normalizeEmail,
  parseCode,
  secondsUntilIso,
  TAG_TYPES,
} from "../../../_lib/auth/tokens.ts";
import { rules } from "../../../_lib/store/rate_limit.ts";
import type { RouteContext } from "../../router.ts";
import { audit, type AuthDeps, readBody, str } from "./deps.ts";

type Handler = (ctx: RouteContext) => Promise<Response>;

const unavailable = () => apiError(503, "service_unavailable", "Authentication service is unavailable.");

function locked(lockedUntil: string, nowMs: number): Response {
  return apiError(
    423,
    "account_locked",
    "Account temporarily locked due to repeated failed login attempts.",
    {
      locked_until: lockedUntil,
      retry_after_seconds: secondsUntilIso(lockedUntil, nowMs),
    },
  );
}

export function register(get: () => AuthDeps): Handler {
  return async ({ req, path }) => {
    const d = get();
    const limited = await d.rateLimit(req, rules().register, "/auth/register");
    if (limited) return limited;
    const body = await readBody(req);
    const email = normalizeEmail(body.email);
    const password = str(body.password) ?? "";
    if (!isValidEmail(email) || password.length < 8) {
      return apiError(422, "validation_failed", "A valid email and password (min 8 chars) are required.");
    }
    const exists = () => apiError(409, "email_exists", "An account with this email already exists.");
    if (await d.store.findUserByEmail(email)) return exists();

    const created = await d.gotrue.adminCreateUser({ email, password, email_confirm: false });
    if (!created.ok) {
      if (isEmailExists(created)) return exists();
      if (isWeakPassword(created)) {
        return apiError(422, "validation_failed", "A valid email and password (min 8 chars) are required.");
      }
      return unavailable();
    }
    const authId = created.data.id;
    let user;
    try {
      user = await d.store.insertUser({ id: authId, email, authUserId: authId });
    } catch (err) {
      await d.gotrue.adminDeleteUser(authId);
      throw err;
    }
    if (!user) {
      await d.gotrue.adminDeleteUser(authId);
      return exists();
    }
    await audit(d, "auth.registered", { route: path }, user.id);

    const cfg = d.config();
    const expiresAt = new Date(d.now().getTime() + cfg.emailOtpExpirySeconds * 1000).toISOString();
    const sent = await d.email.verifyEmail(email);
    logInfo("Verification email dispatched", {
      user_id: user.id,
      provider: sent.provider,
      delivered: sent.delivered,
    });
    return json({
      status: "verification_sent",
      email: user.email,
      verification_token: cfg.exposeCodes ? sent.code : undefined,
      verification_expires_at: expiresAt,
    }, 201);
  };
}

export function verify(get: () => AuthDeps): Handler {
  return async ({ req, path }) => {
    const d = get();
    const limited = await d.rateLimit(req, rules().login, "/auth/verify");
    if (limited) return limited;
    const body = await readBody(req);
    const token = str(body.token)?.trim();
    if (!token) return apiError(422, "validation_failed", "token is required");

    const invalid = () =>
      apiError(400, "invalid_verification_token", "The verification token is invalid or expired.");
    const code = parseCode(token);
    // Untagged codes are tried as signup confirmations only.
    if (!code || (code.tag !== null && code.tag !== "v1s" && code.tag !== "v1m")) return invalid();
    const res = await d.gotrue.verify(code.tag ? TAG_TYPES[code.tag] : "signup", code.hash);
    if (!res.ok || !res.data?.user?.id) return invalid();
    // Verifying signs the user in on Supabase's side; we do not hand out that session.
    if (res.data.access_token) d.defer(d.gotrue.logout(res.data.access_token, "local"));

    const user = await d.store.markUserVerified(res.data.user.id, d.now().toISOString());
    if (!user) return apiError(404, "user_not_found", "User not found for verification token.");
    await audit(d, "auth.verified", { route: path }, user.id);
    return json({ status: "verified" });
  };
}

export function login(get: () => AuthDeps): Handler {
  return async ({ req, path }) => {
    const d = get();
    const limited = await d.rateLimit(req, rules().login, "/auth/login");
    if (limited) return limited;
    const body = await readBody(req);
    const email = normalizeEmail(body.email);
    const password = str(body.password) ?? "";
    if (!isValidEmail(email) || password.length < 8) {
      return apiError(422, "validation_failed", "A valid email and password are required.");
    }
    const cfg = d.config();
    await maybeBootstrapAdmin(cfg.bootstrap, email, password, d);

    const authFailed = () => apiError(401, "auth_failed", "Invalid credentials.");
    const user = await d.store.findUserByEmail(email);
    if (!user || !user.verifiedAt) return authFailed();

    const now = d.now();
    if (user.lockedUntil && Date.parse(user.lockedUntil) > now.getTime()) {
      return locked(user.lockedUntil, now.getTime());
    }

    const grant = await d.gotrue.passwordGrant(email, password);
    if (!grant.ok) {
      // GoTrue answers 400 for bad credentials. Anything else is an outage, not a failed attempt.
      if (grant.status !== 400) return unavailable();
      const updated = await d.store.recordFailedLoginAttempt({
        userId: user.id,
        attemptedAt: now.toISOString(),
        windowSeconds: cfg.lockoutWindowSeconds,
        maxFailures: cfg.lockoutMaxFailures,
        lockoutDurationSeconds: cfg.lockoutDurationSeconds,
      });
      if (updated?.lockedUntil && Date.parse(updated.lockedUntil) > now.getTime()) {
        await audit(d, "auth.lockout_activated", { route: path, locked_until: updated.lockedUntil }, user.id);
        return locked(updated.lockedUntil, now.getTime());
      }
      return authFailed();
    }

    await d.store.clearFailedLoginAttempts(user.id);
    await audit(d, "auth.login_succeeded", { route: path }, user.id);
    return json(mapSession(grant.data, cfg.refreshTokenTtlSeconds, now));
  };
}

export function refresh(get: () => AuthDeps): Handler {
  return async ({ req, path }) => {
    const d = get();
    const limited = await d.rateLimit(req, rules().refresh, "/auth/refresh");
    if (limited) return limited;
    const body = await readBody(req);
    const refreshToken = str(body.refresh_token)?.trim();
    if (!refreshToken) return apiError(422, "validation_failed", "refresh_token is required.");
    // GoTrue rotates the token and revokes the family when a used token comes back.
    const res = await d.gotrue.refreshGrant(refreshToken);
    if (!res.ok) return apiError(401, "refresh_failed", "Refresh token is invalid or expired.");
    await audit(d, "auth.access_refreshed", { route: path }, res.data.user?.id);
    return json(mapSession(res.data, d.config().refreshTokenTtlSeconds, d.now()));
  };
}

export function logout(get: () => AuthDeps): Handler {
  return async ({ req, path, auth }) => {
    const d = get();
    const limited = await d.rateLimit(req, rules().login, "/auth/logout");
    if (limited) return limited;
    const body = await readBody(req);
    // The bearer wins over the body, as before. Either may be an access token or a refresh token.
    const token = auth.accessToken ?? str(body.refresh_token)?.trim();
    const unauthorized = () => apiError(401, "unauthorized", "A valid token is required to logout.");
    if (!token) return unauthorized();

    let accessToken = token;
    let userId: string | undefined;
    if (!looksLikeJwt(token)) {
      // A refresh token: exchange it for its session's access token, then end that session.
      const exchanged = await d.gotrue.refreshGrant(token);
      if (!exchanged.ok) return unauthorized();
      accessToken = exchanged.data.access_token;
      userId = exchanged.data.user?.id;
    }
    const res = await d.gotrue.logout(accessToken, "local");
    if (!res.ok) return res.status >= 500 ? unavailable() : unauthorized();
    await audit(d, "auth.logout_completed", { route: path }, userId);
    return json({ status: "logged_out" });
  };
}

// Google sign-in is off by default (OIDC_GOOGLE_ENABLED). Only the off path is ported.
// TODO(M1 follow-up): if the owner wants Google sign-in, use Supabase's Google provider
// (POST /token?grant_type=id_token) behind these paths. No Kotlin caller today (contract "drop?").
export function googleOff(get: () => AuthDeps, key: string): Handler {
  return async ({ req }) => {
    const limited = await get().rateLimit(req, rules().login, key);
    if (limited) return limited;
    return json({ status: "not_found" }, 404);
  };
}
