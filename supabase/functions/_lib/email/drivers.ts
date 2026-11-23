// The two email drivers.
import type { FetchFn, GoTrueClient } from "../auth/gotrue.ts";
import { tagCode } from "../auth/tokens.ts";
import { accountDeletionText, passwordResetText, verifyEmailText } from "./templates.ts";
import type { EmailMessage, EmailResult, EmailSender } from "./types.ts";

// Supabase driver: Supabase sends its own auth emails from the dashboard templates.
// The code in those emails is {{ .TokenHash }} with our tag printed in front by the template.
export class SupabaseEmailSender implements EmailSender {
  readonly provider = "supabase" as const;
  readonly deletionCodeSource = "supabase" as const;

  constructor(private readonly gotrue: GoTrueClient) {}

  async verifyEmail(to: string): Promise<EmailResult> {
    // "Confirm signup" template, tag v1s.
    return this.result(await this.gotrue.resend("signup", to));
  }

  async passwordReset(to: string): Promise<EmailResult> {
    // "Reset Password" template, tag v1r.
    return this.result(await this.gotrue.recover(to));
  }

  async accountDeletionCode(to: string): Promise<EmailResult> {
    // "Magic Link" template, tag v1d. create_user false.
    return this.result(await this.gotrue.otp(to));
  }

  send(_message: EmailMessage): Promise<EmailResult> {
    return Promise.resolve({ delivered: false, provider: "supabase", reason: "unsupported" });
  }

  private result(r: { ok: boolean; code?: string }): EmailResult {
    return r.ok
      ? { delivered: true, provider: "supabase" }
      : { delivered: false, provider: "supabase", reason: r.code ?? "failed" };
  }
}

export interface ResendOptions {
  apiKey?: string;
  from?: string;
  baseUrl?: string;
  fetch?: FetchFn;
  timeoutMs?: number;
}

// Resend driver: we get the token hash from GoTrue (admin generate_link) and send our own text.
export class ResendEmailSender implements EmailSender {
  readonly provider = "resend" as const;
  readonly deletionCodeSource = "app" as const;
  private readonly fetchFn: FetchFn;
  private readonly baseUrl: string;

  constructor(private readonly gotrue: GoTrueClient, private readonly opts: ResendOptions) {
    this.fetchFn = opts.fetch ?? ((input, init) => fetch(input, init));
    this.baseUrl = (opts.baseUrl ?? "https://api.resend.com").replace(/\/+$/, "");
  }

  async verifyEmail(to: string): Promise<EmailResult> {
    let link = await this.gotrue.adminGenerateLink("signup", to);
    let code: string;
    if (link.ok) {
      code = tagCode("v1s", link.data.hashedToken);
    } else {
      // Fallback: a magic link token also confirms the email when verified.
      link = await this.gotrue.adminGenerateLink("magiclink", to);
      if (!link.ok) return { delivered: false, provider: "resend", reason: link.code };
      code = tagCode("v1m", link.data.hashedToken);
    }
    return this.withCode(code, await this.send({ to, ...verifyEmailText(code) }));
  }

  async passwordReset(to: string): Promise<EmailResult> {
    const link = await this.gotrue.adminGenerateLink("recovery", to);
    if (!link.ok) return { delivered: false, provider: "resend", reason: link.code };
    const code = tagCode("v1r", link.data.hashedToken);
    return this.withCode(code, await this.send({ to, ...passwordResetText(code) }));
  }

  async accountDeletionCode(to: string, appCode?: string): Promise<EmailResult> {
    if (!appCode) return { delivered: false, provider: "resend", reason: "missing_code" };
    return this.withCode(appCode, await this.send({ to, ...accountDeletionText(appCode) }));
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    if (!this.opts.apiKey || !this.opts.from) {
      return { delivered: false, provider: "resend", reason: "not_configured" };
    }
    try {
      const res = await this.fetchFn(`${this.baseUrl}/emails`, {
        method: "POST",
        headers: { authorization: `Bearer ${this.opts.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: this.opts.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
          ...(message.headers ? { headers: message.headers } : {}),
        }),
        signal: AbortSignal.timeout(this.opts.timeoutMs ?? 12_000),
      });
      await res.body?.cancel();
      return res.ok
        ? { delivered: true, provider: "resend" }
        : { delivered: false, provider: "resend", reason: `http_${res.status}` };
    } catch {
      return { delivered: false, provider: "resend", reason: "network_error" };
    }
  }

  private withCode(code: string, r: EmailResult): EmailResult {
    return { ...r, code };
  }
}
