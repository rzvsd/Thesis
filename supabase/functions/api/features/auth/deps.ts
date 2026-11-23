// Dependencies of the auth and account handlers. Tests pass fakes (fake GoTrue fetch, memory store).
import { logError } from "../../../_shared/log.ts";
import { type AuthConfig, authConfig } from "../../../_lib/auth/config.ts";
import { type GoTrueClient, gotrueFromEnv } from "../../../_lib/auth/gotrue.ts";
import { emailFromEnv, type EmailSender } from "../../../_lib/email/index.ts";
import { type AuthStore, pgAuthStore } from "../../../_lib/store/auth.ts";
import { checkRateLimit, type LimitRule } from "../../../_lib/store/rate_limit.ts";

export interface AuthDeps {
  gotrue: GoTrueClient;
  email: EmailSender;
  store: AuthStore;
  config: () => AuthConfig;
  rateLimit: (req: Request, rule: LimitRule, keyPart: string) => Promise<Response | null>;
  // Runs work after the response (EdgeRuntime.waitUntil), like the old un-awaited email sends.
  defer: (work: Promise<unknown>) => void;
  now: () => Date;
  // Deletes the user's stored files (Storage). TODO(M4): list the user's report/export objects and remove them.
  deleteUserFiles: (userId: string) => Promise<void>;
}

export function edgeDefer(work: Promise<unknown>): void {
  const guarded = work.catch((err) => {
    logError("Deferred work failed", { error: err instanceof Error ? err.name : "unknown" });
  });
  const rt = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(guarded);
}

let cached: AuthDeps | null = null;

export function defaultAuthDeps(): AuthDeps {
  if (!cached) {
    cached = {
      gotrue: gotrueFromEnv(),
      email: emailFromEnv(),
      store: pgAuthStore,
      config: authConfig,
      rateLimit: (req, rule, key) => checkRateLimit(req, rule, key),
      defer: edgeDefer,
      now: () => new Date(),
      deleteUserFiles: () => Promise.resolve(),
    };
  }
  return cached;
}

// Lets a route factory take optional deps and still build the real ones lazily, on first request.
export function lazyDeps(deps?: AuthDeps): () => AuthDeps {
  return () => deps ?? defaultAuthDeps();
}

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const text = await req.text();
    if (!text.trim()) return {};
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export async function audit(
  d: AuthDeps,
  eventType: string,
  payload: Record<string, unknown>,
  userId?: string,
): Promise<void> {
  try {
    await d.store.appendAudit(eventType, payload, userId);
  } catch {
    logError("Audit write failed", { event_type: eventType, user_id: userId ?? null });
  }
}
