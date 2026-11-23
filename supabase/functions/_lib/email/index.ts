// Email module entry. EMAIL_PROVIDER_MODE picks the driver: "supabase" (default) or "resend".
// Resend needs RESEND_API_KEY and EMAIL_FROM (a sender on a verified domain, DECISIONS D2/D6).
import { env } from "../../_shared/env.ts";
import { type FetchFn, GoTrueClient, gotrueFromEnv } from "../auth/gotrue.ts";
import { ResendEmailSender, SupabaseEmailSender } from "./drivers.ts";
import type { EmailSender } from "./types.ts";

export type { EmailMessage, EmailProvider, EmailResult, EmailSender } from "./types.ts";
export { ResendEmailSender, SupabaseEmailSender } from "./drivers.ts";

export function createEmailSender(
  opts: { mode?: string; gotrue?: GoTrueClient; fetch?: FetchFn } = {},
): EmailSender {
  const mode = (opts.mode ?? env("EMAIL_PROVIDER_MODE") ?? "supabase").trim().toLowerCase();
  const gotrue = opts.gotrue ?? gotrueFromEnv();
  if (mode === "resend") {
    return new ResendEmailSender(gotrue, {
      apiKey: env("RESEND_API_KEY"),
      from: env("EMAIL_FROM"),
      fetch: opts.fetch,
    });
  }
  return new SupabaseEmailSender(gotrue);
}

let shared: EmailSender | null = null;

export function emailFromEnv(): EmailSender {
  if (!shared) shared = createEmailSender();
  return shared;
}
