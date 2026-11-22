import type { IncomingMessage, ServerResponse } from "node:http";

import type {
  AuthGoogleRequest,
  AuthLoginRequest,
  AuthRefreshRequest,
  AuthRegisterRequest,
  AuthTokensResponse
} from "../../../../packages/contracts/src";
import type { ProductApiConfig } from "../config";
import type { EmailNotifier } from "../email";
import {
  GoogleOidcVerificationError,
  type VerifiedGoogleIdToken
} from "../google-oidc";
import type { ProductStore } from "../store";

interface AuthRuntime {
  config: ProductApiConfig;
  store: ProductStore;
  emailNotifier: EmailNotifier;
}

interface RequestMeta {
  requestId: string;
}

interface AuthContext {
  userId: string;
  sessionId: string;
}

interface AuthTokenClaims {
  typ?: string;
  sid: string;
  sub: string;
}

export interface AuthRouteExecutionContext<TRuntime extends AuthRuntime> {
  method: string;
  pathname: string;
  request: IncomingMessage;
  response: ServerResponse;
  runtime: TRuntime;
  meta: RequestMeta;
}

export interface AuthRouteDependencies<TRuntime extends AuthRuntime> {
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
  authenticateAnyToken: (
    runtime: TRuntime,
    token: string
  ) => Promise<AuthContext | undefined>;
  createId: () => string;
  createOpaqueToken: (sizeBytes: number) => string;
  hashOpaqueToken: (token: string) => string;
  hashPassword: (password: string, cost: number) => Promise<string>;
  isValidEmail: (value: string) => boolean;
  issueTokens: (
    runtime: TRuntime,
    userId: string,
    sessionId: string,
    refreshTokenExpiresAt: string
  ) => Promise<AuthTokensResponse>;
  logInfo: (message: string, payload?: Record<string, unknown>) => void;
  maybeBootstrapAdminForLogin: (
    runtime: TRuntime,
    email: string,
    password: string
  ) => Promise<void>;
  normalizeEmail: (value: string) => string;
  parseBearerToken: (request: IncomingMessage) => string | undefined;
  readJsonBody: <TBody>(request: IncomingMessage) => Promise<TBody>;
  secondsUntilIso: (isoTimestamp: string, referenceTimeMs: number) => number;
  sendJson: (response: ServerResponse, statusCode: number, payload: unknown) => void;
  verifyAuthToken: (
    token: string,
    secret: string
  ) => AuthTokenClaims | undefined | null;
  verifyGoogleIdToken: (
    config: ProductApiConfig,
    idToken: string
  ) => Promise<VerifiedGoogleIdToken>;
  verifyPassword: (password: string, hash: string) => Promise<boolean>;
}

export async function handleAuthRoutes<TRuntime extends AuthRuntime>(
  context: AuthRouteExecutionContext<TRuntime>,
  deps: AuthRouteDependencies<TRuntime>
): Promise<boolean> {
  const { method, pathname, request, response, runtime, meta } = context;

  if (method === "POST" && pathname === "/auth/register") {
    const body = await deps.readJsonBody<AuthRegisterRequest>(request);
    const email = deps.normalizeEmail(body.email ?? "");
    const password = body.password ?? "";

    if (!deps.isValidEmail(email) || password.length < 8) {
      deps.sendJson(response, 422, {
        error: "validation_failed",
        error_message: "A valid email and password (min 8 chars) are required."
      });
      return true;
    }

    const passwordHash = await deps.hashPassword(password, runtime.config.bcryptCost);
    const user = await runtime.store.createUser({
      email,
      passwordHash
    });

    if (!user) {
      deps.sendJson(response, 409, {
        error: "email_exists",
        error_message: "An account with this email already exists."
      });
      return true;
    }

    const rawVerificationToken = deps.createOpaqueToken(32);
    const now = new Date();
    const verificationExpiresAt = new Date(
      now.getTime() + runtime.config.verificationTokenTtlSeconds * 1000
    ).toISOString();

    await runtime.store.createVerificationToken({
      id: deps.createId(),
      userId: user.id,
      tokenHash: deps.hashOpaqueToken(rawVerificationToken),
      createdAt: now.toISOString(),
      expiresAt: verificationExpiresAt
    });

    await deps.appendAudit(
      runtime,
      "auth.registered",
      {
        request_id: meta.requestId,
        route: pathname
      },
      user.id
    );

    const emailResult = await runtime.emailNotifier.sendNotification(
      [{ userId: user.id, email: user.email }],
      {
        subject: "Verify your Thesis account",
        text:
          `Your Thesis verification code is:

${rawVerificationToken}

` +
          "Enter it in the Thesis app to verify your account. " +
          "If you did not create an account, ignore this email."
      }
    );
    deps.logInfo("Verification email dispatched", {
      request_id: meta.requestId,
      user_id: user.id,
      provider: emailResult.provider,
      delivered: emailResult.delivered
    });

    deps.sendJson(response, 201, {
      status: "verification_sent",
      email: user.email,
      verification_token: runtime.config.exposeVerificationToken
        ? rawVerificationToken
        : undefined,
      verification_expires_at: verificationExpiresAt
    });
    return true;
  }

  if (method === "POST" && pathname === "/auth/verify") {
    const body = await deps.readJsonBody<{ token?: string }>(request);
    const token = body.token?.trim();
    if (!token) {
      deps.sendJson(response, 422, {
        error: "validation_failed",
        error_message: "token is required"
      });
      return true;
    }

    const consumedToken = await runtime.store.consumeVerificationToken(
      deps.hashOpaqueToken(token),
      new Date().toISOString()
    );
    if (!consumedToken) {
      deps.sendJson(response, 400, {
        error: "invalid_verification_token",
        error_message: "The verification token is invalid or expired."
      });
      return true;
    }

    const user = await runtime.store.markUserVerified(
      consumedToken.userId,
      new Date().toISOString()
    );
    if (!user) {
      deps.sendJson(response, 404, {
        error: "user_not_found",
        error_message: "User not found for verification token."
      });
      return true;
    }

    await deps.appendAudit(
      runtime,
      "auth.verified",
      {
        request_id: meta.requestId,
        route: pathname
      },
      user.id
    );

    deps.sendJson(response, 200, {
      status: "verified"
    });
    return true;
  }

  if (method === "POST" && pathname === "/auth/login") {
    const body = await deps.readJsonBody<AuthLoginRequest>(request);
    const email = deps.normalizeEmail(body.email ?? "");
    const password = body.password ?? "";
    if (!deps.isValidEmail(email) || password.length < 8) {
      deps.sendJson(response, 422, {
        error: "validation_failed",
        error_message: "A valid email and password are required."
      });
      return true;
    }

    await deps.maybeBootstrapAdminForLogin(runtime, email, password);
    const user = await runtime.store.findUserByEmail(email);
    if (!user || !user.verifiedAt) {
      deps.sendJson(response, 401, {
        error: "auth_failed",
        error_message: "Invalid credentials."
      });
      return true;
    }

    const now = new Date();
    const nowIso = now.toISOString();
    if (user.lockedUntil && Date.parse(user.lockedUntil) > now.getTime()) {
      deps.sendJson(response, 423, {
        error: "account_locked",
        error_message: "Account temporarily locked due to repeated failed login attempts.",
        locked_until: user.lockedUntil,
        retry_after_seconds: deps.secondsUntilIso(user.lockedUntil, now.getTime())
      });
      return true;
    }

    const passwordMatches = await deps.verifyPassword(password, user.passwordHash);
    if (!passwordMatches) {
      const updatedUser = await runtime.store.recordFailedLoginAttempt({
        userId: user.id,
        attemptedAt: nowIso,
        windowSeconds: runtime.config.authLockoutWindowSeconds,
        maxFailures: runtime.config.authLockoutMaxFailures,
        lockoutDurationSeconds: runtime.config.authLockoutDurationSeconds
      });

      if (
        updatedUser?.lockedUntil &&
        Date.parse(updatedUser.lockedUntil) > now.getTime()
      ) {
        await deps.appendAudit(
          runtime,
          "auth.lockout_activated",
          {
            request_id: meta.requestId,
            route: pathname,
            locked_until: updatedUser.lockedUntil
          },
          user.id
        );
        deps.sendJson(response, 423, {
          error: "account_locked",
          error_message: "Account temporarily locked due to repeated failed login attempts.",
          locked_until: updatedUser.lockedUntil,
          retry_after_seconds: deps.secondsUntilIso(updatedUser.lockedUntil, now.getTime())
        });
        return true;
      }

      deps.sendJson(response, 401, {
        error: "auth_failed",
        error_message: "Invalid credentials."
      });
      return true;
    }

    await runtime.store.clearFailedLoginAttempts(user.id);
    const refreshTokenExpiresAt = new Date(
      now.getTime() + runtime.config.refreshTokenTtlSeconds * 1000
    ).toISOString();
    const session = await runtime.store.createSession({
      id: deps.createId(),
      userId: user.id,
      createdAt: nowIso,
      expiresAt: refreshTokenExpiresAt
    });

    const tokens = await deps.issueTokens(
      runtime,
      user.id,
      session.id,
      refreshTokenExpiresAt
    );

    await deps.appendAudit(
      runtime,
      "auth.login_succeeded",
      {
        request_id: meta.requestId,
        route: pathname
      },
      user.id
    );

    deps.sendJson(response, 200, tokens);
    return true;
  }

  if (method === "POST" && pathname === "/auth/google") {
    if (!runtime.config.oidcGoogleEnabled) {
      deps.sendJson(response, 404, { status: "not_found" });
      return true;
    }

    const body = await deps.readJsonBody<AuthGoogleRequest>(request);
    const idToken = body.id_token?.trim();
    if (!idToken) {
      deps.sendJson(response, 422, {
        error: "validation_failed",
        error_message: "id_token is required."
      });
      return true;
    }

    let verifiedGoogleToken: VerifiedGoogleIdToken;
    try {
      verifiedGoogleToken = await deps.verifyGoogleIdToken(runtime.config, idToken);
    } catch (error) {
      if (error instanceof GoogleOidcVerificationError) {
        deps.sendJson(response, 401, {
          error: "google_token_invalid",
          error_code: error.code,
          error_message: error.message
        });
        return true;
      }
      throw error;
    }

    const nowIso = new Date().toISOString();
    let user = await runtime.store.findUserByGoogleSubject(verifiedGoogleToken.subject);
    let loginMode: "linked_subject" | "signup_new" | "auto_link_existing" = "linked_subject";

    if (!user) {
      user = await runtime.store.findUserByEmail(verifiedGoogleToken.email);
      if (user) {
        if (runtime.config.oidcGoogleLinkPolicy === "BLOCK_UNLINKED") {
          await deps.appendAudit(
            runtime,
            "auth.google_link_required_blocked",
            {
              request_id: meta.requestId,
              route: pathname,
              email: verifiedGoogleToken.email
            },
            user.id
          );
          deps.sendJson(response, 409, {
            error: "google_link_required",
            error_message:
              "A password account already exists for this email. Sign in with password and link Google explicitly."
          });
          return true;
        }

        const autoLinkResult = await runtime.store.attachGoogleIdentity({
          userId: user.id,
          googleSubject: verifiedGoogleToken.subject,
          email: verifiedGoogleToken.email,
          linkedAt: nowIso
        });
        if (autoLinkResult === "subject_in_use") {
          deps.sendJson(response, 409, {
            error: "google_subject_in_use",
            error_message: "This Google account is already linked to another user."
          });
          return true;
        }
        if (autoLinkResult === "user_already_linked") {
          deps.sendJson(response, 409, {
            error: "google_already_linked",
            error_message: "This user is already linked to a different Google account."
          });
          return true;
        }

        loginMode = "auto_link_existing";
      } else {
        const passwordHash = await deps.hashPassword(
          deps.createOpaqueToken(32),
          runtime.config.bcryptCost
        );
        user = await runtime.store.createUser({
          email: verifiedGoogleToken.email,
          passwordHash
        });
        if (!user) {
          user = await runtime.store.findUserByEmail(verifiedGoogleToken.email);
        }
        if (!user) {
          deps.sendJson(response, 503, {
            error: "service_unavailable",
            error_message: "Google sign-in could not create or resolve a user."
          });
          return true;
        }

        const linkResult = await runtime.store.attachGoogleIdentity({
          userId: user.id,
          googleSubject: verifiedGoogleToken.subject,
          email: verifiedGoogleToken.email,
          linkedAt: nowIso
        });
        if (linkResult !== "linked" && linkResult !== "already_linked_to_user") {
          deps.sendJson(response, 409, {
            error: "google_link_conflict",
            error_message: "Google identity could not be linked to this user."
          });
          return true;
        }

        loginMode = "signup_new";
      }
    }

    if (!user.verifiedAt) {
      const verified = await runtime.store.markUserVerified(user.id, nowIso);
      if (verified) {
        user = verified;
      }
    }

    await runtime.store.clearFailedLoginAttempts(user.id);
    const refreshTokenExpiresAt = new Date(
      Date.now() + runtime.config.refreshTokenTtlSeconds * 1000
    ).toISOString();
    const session = await runtime.store.createSession({
      id: deps.createId(),
      userId: user.id,
      createdAt: nowIso,
      expiresAt: refreshTokenExpiresAt
    });
    const tokens = await deps.issueTokens(
      runtime,
      user.id,
      session.id,
      refreshTokenExpiresAt
    );

    await deps.appendAudit(
      runtime,
      "auth.google_login_succeeded",
      {
        request_id: meta.requestId,
        route: pathname,
        login_mode: loginMode
      },
      user.id
    );

    deps.sendJson(response, 200, tokens);
    return true;
  }

  if (method === "POST" && pathname === "/auth/google/link") {
    if (!runtime.config.oidcGoogleEnabled) {
      deps.sendJson(response, 404, { status: "not_found" });
      return true;
    }

    const auth = await deps.authenticateAccessToken(runtime, request);
    if (!auth) {
      deps.sendJson(response, 401, {
        error: "unauthorized",
        error_message: "A valid access token is required to link Google."
      });
      return true;
    }

    const body = await deps.readJsonBody<AuthGoogleRequest>(request);
    const idToken = body.id_token?.trim();
    if (!idToken) {
      deps.sendJson(response, 422, {
        error: "validation_failed",
        error_message: "id_token is required."
      });
      return true;
    }

    let verifiedGoogleToken: VerifiedGoogleIdToken;
    try {
      verifiedGoogleToken = await deps.verifyGoogleIdToken(runtime.config, idToken);
    } catch (error) {
      if (error instanceof GoogleOidcVerificationError) {
        deps.sendJson(response, 401, {
          error: "google_token_invalid",
          error_code: error.code,
          error_message: error.message
        });
        return true;
      }
      throw error;
    }

    const user = await runtime.store.findUserById(auth.userId);
    if (!user) {
      deps.sendJson(response, 404, {
        error: "user_not_found",
        error_message: "Authenticated user no longer exists."
      });
      return true;
    }

    if (deps.normalizeEmail(user.email) !== deps.normalizeEmail(verifiedGoogleToken.email)) {
      deps.sendJson(response, 409, {
        error: "google_email_mismatch",
        error_message:
          "Google account email must match the authenticated account email for explicit linking."
      });
      return true;
    }

    const linkResult = await runtime.store.attachGoogleIdentity({
      userId: user.id,
      googleSubject: verifiedGoogleToken.subject,
      email: verifiedGoogleToken.email,
      linkedAt: new Date().toISOString()
    });

    if (linkResult === "subject_in_use") {
      deps.sendJson(response, 409, {
        error: "google_subject_in_use",
        error_message: "This Google account is already linked to another user."
      });
      return true;
    }

    if (linkResult === "user_already_linked") {
      deps.sendJson(response, 409, {
        error: "google_already_linked",
        error_message: "This user is already linked to a different Google account."
      });
      return true;
    }

    await deps.appendAudit(
      runtime,
      "auth.google_linked",
      {
        request_id: meta.requestId,
        route: pathname,
        status: linkResult
      },
      user.id
    );

    deps.sendJson(response, 200, {
      status: "linked"
    });
    return true;
  }

  if (method === "POST" && pathname === "/auth/refresh") {
    const body = await deps.readJsonBody<AuthRefreshRequest>(request);
    const refreshToken = body.refresh_token?.trim();
    if (!refreshToken) {
      deps.sendJson(response, 422, {
        error: "validation_failed",
        error_message: "refresh_token is required."
      });
      return true;
    }

    const claims = deps.verifyAuthToken(refreshToken, runtime.config.jwtSecret);
    if (!claims || claims.typ !== "refresh") {
      deps.sendJson(response, 401, {
        error: "refresh_failed",
        error_message: "Refresh token is invalid or expired."
      });
      return true;
    }

    const session = await runtime.store.getSessionById(claims.sid);
    if (!session || session.userId !== claims.sub) {
      deps.sendJson(response, 401, {
        error: "refresh_failed",
        error_message: "Refresh session is invalid."
      });
      return true;
    }

    const now = new Date();
    const nowIso = now.toISOString();
    if (session.revokedAt) {
      if (session.revokedReason === "rotated") {
        const revokedCount = await runtime.store.revokeSessionFamily({
          familyId: session.familyId,
          revokedAt: nowIso,
          reason: "reuse_detected"
        });
        await deps.appendAudit(
          runtime,
          "auth.refresh_reuse_detected",
          {
            request_id: meta.requestId,
            route: pathname,
            session_id: session.id,
            family_id: session.familyId,
            revoked_sessions: revokedCount
          },
          session.userId
        );
      }

      deps.sendJson(response, 401, {
        error: "refresh_failed",
        error_message: "Refresh session is invalid."
      });
      return true;
    }

    if (Date.parse(session.expiresAt) <= now.getTime()) {
      await runtime.store.revokeSession(session.id, nowIso, {
        reason: "expired"
      });
      deps.sendJson(response, 401, {
        error: "refresh_failed",
        error_message: "Refresh session expired."
      });
      return true;
    }

    const rotatedRefreshExpiresAt = new Date(
      now.getTime() + runtime.config.refreshTokenTtlSeconds * 1000
    ).toISOString();
    const nextSession = await runtime.store.createSession({
      id: deps.createId(),
      userId: session.userId,
      createdAt: nowIso,
      expiresAt: rotatedRefreshExpiresAt,
      familyId: session.familyId,
      parentSessionId: session.id
    });
    await runtime.store.revokeSession(session.id, nowIso, {
      reason: "rotated",
      replacedBySessionId: nextSession.id
    });

    const tokens = await deps.issueTokens(
      runtime,
      nextSession.userId,
      nextSession.id,
      rotatedRefreshExpiresAt
    );

    await deps.appendAudit(
      runtime,
      "auth.access_refreshed",
      {
        request_id: meta.requestId,
        route: pathname,
        rotated_from_session_id: session.id,
        rotated_to_session_id: nextSession.id
      },
      nextSession.userId
    );

    deps.sendJson(response, 200, tokens);
    return true;
  }

  if (method === "POST" && pathname === "/auth/logout") {
    const bearerToken = deps.parseBearerToken(request);
    const body = await deps.readJsonBody<{ refresh_token?: string }>(request);
    const token = bearerToken ?? body.refresh_token;
    if (!token) {
      deps.sendJson(response, 401, {
        error: "unauthorized",
        error_message: "A valid token is required to logout."
      });
      return true;
    }

    const auth = await deps.authenticateAnyToken(runtime, token);
    if (!auth) {
      deps.sendJson(response, 401, {
        error: "unauthorized",
        error_message: "A valid token is required to logout."
      });
      return true;
    }

    await runtime.store.revokeSession(auth.sessionId, new Date().toISOString(), {
      reason: "logout"
    });
    await deps.appendAudit(
      runtime,
      "auth.logout_completed",
      {
        request_id: meta.requestId,
        route: pathname
      },
      auth.userId
    );

    deps.sendJson(response, 200, {
      status: "logged_out"
    });
    return true;
  }

  return false;
}
