// Push and email ports. Sending is M4's job; until M4 plugs in real senders,
// the defaults deliver nothing and report every target as skipped.
import type { NotificationType, PushTarget } from "./types.ts";

export interface PushPayload {
  notificationType: NotificationType;
  route: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushResult {
  attempted: number;
  delivered: number;
  failed: number;
  skipped: number;
  // Device tokens the provider rejected. The caller marks them invalid.
  invalidTargets: PushTarget[];
}

export interface PushSender {
  readonly mode: string;
  send(targets: PushTarget[], payload: PushPayload): Promise<PushResult>;
}

export const disabledPushSender: PushSender = {
  mode: "disabled",
  send: (targets) =>
    Promise.resolve({ attempted: 0, delivered: 0, failed: 0, skipped: targets.length, invalidTargets: [] }),
};

export interface EmailTarget {
  userId: string;
  email: string;
}

export interface EmailPayload {
  subject: string;
  text: string;
}

export interface EmailResult {
  attempted: number;
  delivered: number;
  failed: number;
  skipped: number;
}

export interface EmailSender {
  readonly mode: string;
  send(targets: EmailTarget[], payload: EmailPayload): Promise<EmailResult>;
}

export const disabledEmailSender: EmailSender = {
  mode: "disabled",
  send: (targets) => Promise.resolve({ attempted: 0, delivered: 0, failed: 0, skipped: targets.length }),
};
