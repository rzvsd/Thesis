// Test doubles: a fake GoTrue behind an injectable fetch, and an in-memory AuthStore.
// The fake follows GoTrue's behaviour that the handlers depend on: admin create, verify by token hash
// (signup uses the confirmation token; recovery and magiclink share the recovery token), password grant,
// refresh rotation with reuse detection (reuse interval 0), logout local/global, generate_link, and
// the email-sending endpoints (/resend, /recover, /otp), whose "sent" emails land in `outbox`.
import type { AccountActionPurpose, AuthStore } from "../store/auth.ts";
import type { Tier, UserRow } from "../store/users.ts";
import { GoTrueClient } from "./gotrue.ts";

interface FakeUser {
  id: string;
  email: string;
  password: string;
  confirmed: boolean;
  confirmationToken?: string;
  recoveryToken?: string;
  appMetadata: Record<string, unknown>;
}

interface FakeSession {
  id: string;
  userId: string;
  revoked: boolean;
}

export interface OutboxEntry {
  kind: "signup" | "recovery" | "magiclink";
  email: string;
  tokenHash: string;
}

function hex(n: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
}

export class FakeGoTrue {
  users = new Map<string, FakeUser>();
  sessions = new Map<string, FakeSession>();
  refreshTokens = new Map<string, { sessionId: string; used: boolean }>();
  accessTokens = new Map<string, string>(); // token -> session id
  outbox: OutboxEntry[] = [];
  calls: string[] = [];
  failNext: Record<string, number> = {}; // "METHOD /path" -> status to fail once with

  client(): GoTrueClient {
    return new GoTrueClient({
      url: "https://fake.supabase.test",
      anonKey: "anon",
      serviceKey: "service",
      fetch: (input, init) => this.fetch(input, init),
    });
  }

  byEmail(email: string): FakeUser | undefined {
    for (const u of this.users.values()) if (u.email === email) return u;
    return undefined;
  }

  accessValid(token: string): boolean {
    const sid = this.accessTokens.get(token);
    const s = sid ? this.sessions.get(sid) : undefined;
    return !!s && !s.revoked && this.users.has(s.userId);
  }

  private session(userId: string): Record<string, unknown> {
    const s: FakeSession = { id: crypto.randomUUID(), userId, revoked: false };
    this.sessions.set(s.id, s);
    return this.tokensFor(s);
  }

  private tokensFor(s: FakeSession): Record<string, unknown> {
    const access = `h.${hex(8)}.s`;
    const refresh = hex(6);
    this.accessTokens.set(access, s.id);
    this.refreshTokens.set(refresh, { sessionId: s.id, used: false });
    const u = this.users.get(s.userId)!;
    return {
      access_token: access,
      refresh_token: refresh,
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: u.id, email: u.email },
    };
  }

  private bearerSession(init?: RequestInit): FakeSession | undefined {
    const h = new Headers(init?.headers);
    const token = (h.get("authorization") ?? "").replace(/^Bearer /, "");
    const sid = this.accessTokens.get(token);
    const s = sid ? this.sessions.get(sid) : undefined;
    return s && !s.revoked && this.users.has(s.userId) ? s : undefined;
  }

  fetch(input: string, init?: RequestInit): Promise<Response> {
    return Promise.resolve(this.handle(input, init));
  }

  private handle(input: string, init?: RequestInit): Response {
    const url = new URL(input);
    const method = init?.method ?? "GET";
    const path = url.pathname.replace(/^\/auth\/v1/, "");
    const key = `${method} ${path}`;
    this.calls.push(`${key}${url.search}`);
    const forced = this.failNext[key];
    if (forced) {
      delete this.failNext[key];
      return err(forced, "forced_failure", "forced");
    }
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const apikey = new Headers(init?.headers).get("apikey");
    const isAdmin = path.startsWith("/admin");
    if (isAdmin && apikey !== "service") return err(401, "no_authorization", "service key required");

    if (method === "POST" && path === "/admin/users") {
      if (this.byEmail(body.email)) {
        return err(422, "email_exists", "A user with this email address has already been registered");
      }
      if (String(body.password ?? "").length < 6) {
        return err(422, "weak_password", "Password should be at least 6 characters.");
      }
      const u: FakeUser = {
        id: crypto.randomUUID(),
        email: body.email,
        password: body.password,
        confirmed: body.email_confirm === true,
        appMetadata: body.app_metadata ?? {},
      };
      this.users.set(u.id, u);
      return ok({ id: u.id, email: u.email });
    }
    const adminUser = /^\/admin\/users\/([^/]+)$/.exec(path);
    if (adminUser) {
      const u = this.users.get(decodeURIComponent(adminUser[1]));
      if (!u) return err(404, "user_not_found", "User not found");
      if (method === "PUT") {
        if (body.password !== undefined) u.password = body.password;
        if (body.email_confirm === true) u.confirmed = true;
        if (body.app_metadata) u.appMetadata = { ...u.appMetadata, ...body.app_metadata };
        return ok({ id: u.id, email: u.email });
      }
      if (method === "DELETE") {
        this.users.delete(u.id);
        for (const s of this.sessions.values()) if (s.userId === u.id) s.revoked = true;
        return ok({});
      }
    }
    if (method === "POST" && path === "/admin/generate_link") {
      const u = this.byEmail(body.email);
      if (!u) return err(404, "user_not_found", "User not found");
      const hash = hex(28);
      if (body.type === "signup") {
        if (u.confirmed) return err(422, "email_exists", "already registered");
        u.confirmationToken = hash;
      } else {
        u.recoveryToken = hash;
      }
      return ok({ id: u.id, email: u.email, hashed_token: hash, verification_type: body.type });
    }
    if (method === "POST" && path === "/resend") {
      const u = this.byEmail(body.email);
      if (u && !u.confirmed) {
        u.confirmationToken = hex(28);
        this.outbox.push({ kind: "signup", email: u.email, tokenHash: u.confirmationToken });
      }
      return ok({});
    }
    if (method === "POST" && (path === "/recover" || path === "/otp")) {
      const u = this.byEmail(body.email);
      if (!u) return path === "/otp" ? err(422, "otp_disabled", "Signups not allowed for otp") : ok({});
      u.recoveryToken = hex(28);
      this.outbox.push({
        kind: path === "/recover" ? "recovery" : "magiclink",
        email: u.email,
        tokenHash: u.recoveryToken,
      });
      return ok({});
    }
    if (method === "POST" && path === "/verify") {
      const field = body.type === "signup" ? "confirmationToken" : "recoveryToken";
      for (const u of this.users.values()) {
        if (u[field] && u[field] === body.token_hash) {
          u[field] = undefined;
          u.confirmed = true;
          return ok(this.session(u.id));
        }
      }
      return err(403, "otp_expired", "Token has expired or is invalid");
    }
    if (method === "POST" && path === "/token") {
      const grant = url.searchParams.get("grant_type");
      if (grant === "password") {
        const u = this.byEmail(body.email);
        if (!u || u.password !== body.password) {
          return err(400, "invalid_credentials", "Invalid login credentials");
        }
        if (!u.confirmed) return err(400, "email_not_confirmed", "Email not confirmed");
        return ok(this.session(u.id));
      }
      if (grant === "refresh_token") {
        const rt = this.refreshTokens.get(body.refresh_token);
        const s = rt ? this.sessions.get(rt.sessionId) : undefined;
        if (!rt || !s || s.revoked || !this.users.has(s.userId)) {
          return err(400, "refresh_token_not_found", "Invalid Refresh Token");
        }
        if (rt.used) {
          s.revoked = true; // reuse detected: the whole session (token family) goes
          return err(400, "refresh_token_already_used", "Invalid Refresh Token: Already Used");
        }
        rt.used = true;
        return ok(this.tokensFor(s));
      }
    }
    if (method === "POST" && path === "/logout") {
      const s = this.bearerSession(init);
      if (!s) return err(403, "session_not_found", "Session not found");
      const scope = url.searchParams.get("scope") ?? "global";
      for (const other of this.sessions.values()) {
        if (other.id === s.id || (scope === "global" && other.userId === s.userId)) other.revoked = true;
      }
      return new Response(null, { status: 204 });
    }
    if (method === "GET" && path === "/user") {
      const s = this.bearerSession(init);
      if (!s) return err(403, "session_not_found", "Session not found");
      const u = this.users.get(s.userId)!;
      return ok({ id: u.id, email: u.email });
    }
    return err(404, "not_found", "no route");
  }
}

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

function err(status: number, code: string, msg: string): Response {
  return new Response(JSON.stringify({ code: status, error_code: code, msg }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// In-memory AuthStore with the same lockout rules as the SQL in _lib/store/auth.ts.
export class MemoryAuthStore implements AuthStore {
  users = new Map<string, UserRow>();
  tiers = new Map<string, Tier>();
  tokens: Array<
    {
      userId: string;
      purpose: AccountActionPurpose;
      tokenHash: string;
      expiresAt: string;
      consumedAt?: string;
    }
  > = [];
  audit: Array<{ eventType: string; payload: Record<string, unknown>; userId?: string }> = [];
  deletedUserIds: string[] = [];
  strippedUserIds: string[] = [];

  findUserByEmail(email: string) {
    const e = email.trim().toLowerCase();
    return Promise.resolve([...this.users.values()].find((u) => u.email === e));
  }
  findUserById(id: string) {
    return Promise.resolve(this.users.get(id));
  }
  insertUser(input: { id: string; email: string; authUserId: string; verifiedAt?: string }) {
    if (this.users.has(input.id) || [...this.users.values()].some((u) => u.email === input.email)) {
      return Promise.resolve(undefined);
    }
    const row: UserRow = {
      id: input.id,
      email: input.email.toLowerCase(),
      createdAt: new Date().toISOString(),
      verifiedAt: input.verifiedAt,
      failedLoginAttempts: 0,
      authUserId: input.authUserId,
    };
    this.users.set(row.id, row);
    return Promise.resolve({ ...row });
  }
  markUserVerified(userId: string, verifiedAt: string) {
    const u = this.users.get(userId);
    if (u) u.verifiedAt = verifiedAt;
    return Promise.resolve(u ? { ...u } : undefined);
  }
  recordFailedLoginAttempt(input: {
    userId: string;
    attemptedAt: string;
    windowSeconds: number;
    maxFailures: number;
    lockoutDurationSeconds: number;
  }) {
    const u = this.users.get(input.userId);
    if (!u) return Promise.resolve(undefined);
    const at = Date.parse(input.attemptedAt);
    const fresh = !u.failedLoginWindowStartedAt ||
      Date.parse(u.failedLoginWindowStartedAt) <= at - input.windowSeconds * 1000;
    u.failedLoginAttempts = fresh ? 1 : u.failedLoginAttempts + 1;
    if (fresh) u.failedLoginWindowStartedAt = input.attemptedAt;
    u.lockedUntil = u.failedLoginAttempts >= input.maxFailures
      ? new Date(at + input.lockoutDurationSeconds * 1000).toISOString()
      : undefined;
    return Promise.resolve({ ...u });
  }
  clearFailedLoginAttempts(userId: string) {
    const u = this.users.get(userId);
    if (u) {
      u.failedLoginAttempts = 0;
      u.failedLoginWindowStartedAt = undefined;
      u.lockedUntil = undefined;
    }
    return Promise.resolve(u ? { ...u } : undefined);
  }
  createAccountActionToken(input: {
    userId: string;
    purpose: AccountActionPurpose;
    tokenHash: string;
    createdAt: string;
    expiresAt: string;
  }) {
    for (const t of this.tokens) {
      if (t.userId === input.userId && t.purpose === input.purpose && !t.consumedAt) {
        t.consumedAt = input.createdAt;
      }
    }
    this.tokens.push({ ...input });
    return Promise.resolve();
  }
  consumeAccountActionToken(purpose: AccountActionPurpose, tokenHash: string, consumedAt: string) {
    const t = this.tokens.find((x) =>
      x.purpose === purpose && x.tokenHash === tokenHash && !x.consumedAt &&
      Date.parse(x.expiresAt) > Date.now()
    );
    if (!t) return Promise.resolve(undefined);
    t.consumedAt = consumedAt;
    return Promise.resolve({ userId: t.userId });
  }
  getUserTier(userId: string) {
    return Promise.resolve(this.tiers.get(userId) ?? "FREE");
  }
  setProTier(userId: string) {
    this.tiers.set(userId, "PRO");
    return Promise.resolve();
  }
  stripAuditEmails(userId: string) {
    this.strippedUserIds.push(userId);
    return Promise.resolve();
  }
  deleteUserRows(userId: string) {
    this.deletedUserIds.push(userId);
    const had = this.users.delete(userId);
    this.tiers.delete(userId);
    this.tokens = this.tokens.filter((t) => t.userId !== userId);
    return Promise.resolve(had);
  }
  appendAudit(eventType: string, payload: Record<string, unknown>, userId?: string) {
    this.audit.push({ eventType, payload, userId });
    return Promise.resolve();
  }
}
