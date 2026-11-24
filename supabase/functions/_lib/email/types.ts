// Email module interface (DECISIONS D6). Two drivers: "supabase" (Supabase's own auth emails) and "resend".
// Rule N10: never log addresses, codes or bodies.

export type EmailProvider = "supabase" | "resend";

export interface EmailResult {
  delivered: boolean;
  provider: EmailProvider;
  reason?: string;
  // HTTP status of the failed call, when there was one. Logged with reason to tell a bad key from an outage.
  status?: number;
  // The code the user must type, when this server knows it (resend driver). Never logged.
  code?: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  headers?: Record<string, string>;
}

export interface EmailSender {
  readonly provider: EmailProvider;
  // Where the account deletion code comes from:
  //   "app"      - our own token in app.account_action_tokens, sent with send()   (resend driver)
  //   "supabase" - a Supabase magic link OTP (tag v1d), sent by Supabase          (supabase driver)
  readonly deletionCodeSource: "app" | "supabase";
  verifyEmail(to: string): Promise<EmailResult>;
  passwordReset(to: string): Promise<EmailResult>;
  // appCode is required when deletionCodeSource is "app".
  accountDeletionCode(to: string, appCode?: string): Promise<EmailResult>;
  // Generic mail for later milestones (digests, notices). The supabase driver cannot send it.
  send(message: EmailMessage): Promise<EmailResult>;
}
