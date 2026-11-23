// /auth/password-reset/request and /confirm. Ported from apps/product-api/src/routes/account-routes.ts.
import { apiError, json } from "../../../_shared/http.ts";
import { logInfo } from "../../../_shared/log.ts";
import { MIN_NEW_PASSWORD_LENGTH } from "../../../_lib/auth/config.ts";
import { isWeakPassword } from "../../../_lib/auth/gotrue.ts";
import { isOtpCode, isValidEmail, normalizeEmail, parseCode } from "../../../_lib/auth/tokens.ts";
import { rules } from "../../../_lib/store/rate_limit.ts";
import type { RouteContext } from "../../router.ts";
import { audit, type AuthDeps, readBody, str } from "./deps.ts";

const RESET_REQUESTED_MESSAGE =
  "If an account exists for this email, we sent a reset code. It expires in 1 hour.";

export function resetRequest(get: () => AuthDeps) {
  return async ({ req }: RouteContext): Promise<Response> => {
    const d = get();
    const limited = await d.rateLimit(req, rules().login, "/auth/password-reset/request");
    if (limited) return limited;
    const body = await readBody(req);
    const email = normalizeEmail(body.email);
    if (!isValidEmail(email)) return apiError(422, "validation_failed", "A valid email is required.");

    let exposed: string | undefined;
    const user = await d.store.findUserByEmail(email);
    // Over the per-address cap: no email, same answer, so the cap reveals nothing either.
    if (user && await d.emailAllowed(email)) {
      const send = d.email.passwordReset(email).then((r) => {
        logInfo("Password reset email dispatched", {
          user_id: user.id,
          provider: r.provider,
          delivered: r.delivered,
        });
        return r;
      });
      if (d.config().exposeCodes) {
        exposed = (await send).code;
      } else {
        // Not awaited, so the response time does not reveal whether the account exists.
        d.defer(send);
      }
    }
    // Same response whether or not the account exists.
    return json({ status: "reset_requested", message: RESET_REQUESTED_MESSAGE, reset_token: exposed }, 202);
  };
}

export function resetConfirm(get: () => AuthDeps) {
  return async ({ req, path }: RouteContext): Promise<Response> => {
    const d = get();
    const limited = await d.rateLimit(req, rules().login, "/auth/password-reset/confirm");
    if (limited) return limited;
    const body = await readBody(req);
    const token = str(body.token)?.trim();
    const newPassword = str(body.new_password) ?? "";
    const weak = () =>
      apiError(
        422,
        "validation_failed",
        `token and new_password (min ${MIN_NEW_PASSWORD_LENGTH} chars) are required.`,
      );
    if (!token || newPassword.length < MIN_NEW_PASSWORD_LENGTH) return weak();
    const invalid = () => apiError(400, "invalid_reset_token", "The reset code is invalid or expired.");
    let verified;
    if (isOtpCode(token)) {
      // The 6-digit code from the email (audit V3) needs the address it went to.
      const email = normalizeEmail(body.email);
      if (!isValidEmail(email)) {
        return apiError(422, "validation_failed", "email is required with a 6-digit code");
      }
      verified = await d.gotrue.verifyOtp("recovery", email, token);
    } else {
      const code = parseCode(token);
      if (!code || (code.tag !== null && code.tag !== "v1r")) return invalid();
      verified = await d.gotrue.verify("recovery", code.hash);
    }
    if (!verified.ok || !verified.data?.user?.id) return invalid();
    const session = verified.data;
    const user = await d.store.findUserById(session.user!.id);
    if (!user) {
      await d.gotrue.logout(session.access_token, "global");
      return invalid();
    }

    const updated = await d.gotrue.adminUpdateUser(user.authUserId ?? user.id, { password: newPassword });
    if (!updated.ok) {
      await d.gotrue.logout(session.access_token, "local");
      if (isWeakPassword(updated)) return weak();
      return apiError(503, "service_unavailable", "Authentication service is unavailable.");
    }
    // Ends every session of the user, including the one the reset code just opened.
    const revoked = await d.gotrue.logout(session.access_token, "global");
    if (!revoked.ok) return apiError(503, "service_unavailable", "Authentication service is unavailable.");

    const nowIso = d.now().toISOString();
    // The code was delivered to the account email, so it also proves email ownership.
    if (!user.verifiedAt) await d.store.markUserVerified(user.id, nowIso);
    await d.store.clearFailedLoginAttempts(user.id);
    await audit(d, "auth.password_reset_completed", { route: path, revoked_sessions: "all" }, user.id);
    return json({ status: "password_reset" });
  };
}
