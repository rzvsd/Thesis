// Shared test setup for the auth and account handlers: fake GoTrue, memory store, both email drivers.
import type { AuthConfig } from "../../../_lib/auth/config.ts";
import { FakeGoTrue, MemoryAuthStore } from "../../../_lib/auth/testing.ts";
import { ResendEmailSender, SupabaseEmailSender } from "../../../_lib/email/index.ts";
import { ctx } from "../../../_lib/store/testing.ts";
import type { Route } from "../../router.ts";
import { accountRoutes } from "../account/index.ts";
import type { AuthDeps } from "./deps.ts";
import { authRoutes } from "./index.ts";

export interface SentMail {
  to: string;
  subject: string;
  text: string;
}

export const DEFAULT_CONFIG: AuthConfig = {
  lockoutMaxFailures: 10,
  lockoutWindowSeconds: 900,
  lockoutDurationSeconds: 900,
  refreshTokenTtlSeconds: 30 * 24 * 3600,
  emailOtpExpirySeconds: 3600,
  exposeCodes: false,
  bootstrap: null,
  registrationOpen: true,
  inviteEmails: [],
};

export function setup(opts: {
  mode?: "supabase" | "resend";
  config?: Partial<AuthConfig>;
  rateLimit?: AuthDeps["rateLimit"];
  emailAllowed?: AuthDeps["emailAllowed"];
} = {}) {
  const fake = new FakeGoTrue();
  const gotrue = fake.client();
  const store = new MemoryAuthStore();
  const mail: SentMail[] = [];
  const resendFetch = (_input: string, init?: RequestInit) => {
    const b = JSON.parse(String(init?.body));
    mail.push({ to: b.to[0], subject: b.subject, text: b.text });
    return Promise.resolve(new Response("{}", { status: 200 }));
  };
  const email = opts.mode === "resend"
    ? new ResendEmailSender(gotrue, {
      apiKey: "re_test",
      from: "Thesis <t@example.test>",
      fetch: resendFetch,
    })
    : new SupabaseEmailSender(gotrue);
  const deferred: Promise<unknown>[] = [];
  const filesDeleted: string[] = [];
  let nowMs = Date.parse("2026-11-23T10:00:00Z");
  const deps: AuthDeps = {
    gotrue,
    email,
    store,
    config: () => ({ ...DEFAULT_CONFIG, ...opts.config }),
    rateLimit: opts.rateLimit ?? (() => Promise.resolve(null)),
    emailAllowed: opts.emailAllowed ?? (() => Promise.resolve(true)),
    defer: (p) => void deferred.push(p),
    now: () => new Date(nowMs),
    deleteUserFiles: (id) => {
      filesDeleted.push(id);
      return Promise.resolve();
    },
  };
  const routes: Route[] = [...authRoutes(deps), ...accountRoutes(deps)];

  async function call(
    method: string,
    path: string,
    body?: unknown,
    o: { bearer?: string; userId?: string; form?: Record<string, string> } = {},
  ): Promise<{ status: number; json: Record<string, unknown>; text: string; res: Response }> {
    const route = routes.find((r) => r.method === method && r.path === path);
    if (!route) throw new Error(`no route ${method} ${path}`);
    const headers = new Headers();
    let reqBody: string | undefined;
    if (o.form) {
      headers.set("content-type", "application/x-www-form-urlencoded");
      reqBody = new URLSearchParams(o.form).toString();
    } else if (body !== undefined) {
      headers.set("content-type", "application/json");
      reqBody = JSON.stringify(body);
    }
    if (o.bearer) headers.set("authorization", `Bearer ${o.bearer}`);
    const req = new Request(`http://test${path}`, { method, headers, body: reqBody });
    const c = ctx(req, { userId: o.userId });
    c.auth.accessToken = o.bearer ?? (o.userId ? c.auth.accessToken : null);
    const res = await route.handler(c);
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text);
    } catch {
      json = {};
    }
    await Promise.all(deferred.splice(0));
    return { status: res.status, json, text, res };
  }

  // The code the user would read in the last email to `email` (both drivers).
  function lastCode(address: string): string {
    if (opts.mode === "resend") {
      const m = [...mail].reverse().find((x) => x.to === address);
      if (!m) throw new Error("no mail");
      return m.text.split("\n\n")[1].trim();
    }
    const e = [...fake.outbox].reverse().find((x) => x.email === address);
    if (!e) throw new Error("no supabase mail");
    const tag = e.kind === "signup" ? "v1s" : e.kind === "recovery" ? "v1r" : "v1d";
    return `${tag}.${e.tokenHash}`;
  }

  return {
    fake,
    store,
    mail,
    deps,
    call,
    lastCode,
    filesDeleted,
    advance: (seconds: number) => void (nowMs += seconds * 1000),
  };
}

export async function registeredVerifiedUser(
  t: ReturnType<typeof setup>,
  email: string,
  password = "VeryStrongPass1!",
): Promise<string> {
  const reg = await t.call("POST", "/auth/register", { email, password });
  if (reg.status !== 201) throw new Error(`register ${reg.status}`);
  const v = await t.call("POST", "/auth/verify", { token: t.lastCode(email) });
  if (v.status !== 200) throw new Error(`verify ${v.status}`);
  return (await t.store.findUserByEmail(email))!.id;
}
