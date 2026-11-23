// Push types. Owner: M4. The shapes match the ports M2 (FilingAlertNotifier.sendPush) and
// M3 (_lib/evaluators/push_port.ts PushSender) already call, so the real sender plugs into both.

export interface PushTarget {
  userId: string;
  installationId: string;
  deviceToken: string;
}

export interface PushPayload {
  notificationType: string;
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
  // Tokens FCM says are dead. The caller marks them invalid in app.user_devices.
  invalidTargets: PushTarget[];
}

export type PushMode = "disabled" | "stub" | "fcm";

export interface PushSender {
  readonly mode: PushMode;
  send(targets: PushTarget[], payload: PushPayload): Promise<PushResult>;
}
