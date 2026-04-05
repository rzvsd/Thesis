import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging, type FirebaseMessagingError } from "firebase-admin/messaging";
import type { NotificationType } from "../../../packages/contracts/src";

export interface PushTarget {
  userId: string;
  installationId: string;
  deviceToken: string;
}

export interface PushDispatchResult {
  attempted: number;
  delivered: number;
  failed: number;
  invalidTargets: PushTarget[];
  provider: "stub" | "fcm";
}

export interface PushNotifierConfig {
  provider: "stub" | "fcm";
  googleApplicationCredentials?: string;
}

export interface NotificationPushPayload {
  notificationType: NotificationType;
  route: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

function isInvalidFcmToken(errorCode: string | undefined): boolean {
  return (
    errorCode === "messaging/invalid-registration-token" ||
    errorCode === "messaging/registration-token-not-registered"
  );
}

export class PushNotifier {
  private readonly config: PushNotifierConfig;

  constructor(config: PushNotifierConfig) {
    this.config = config;
  }

  async sendMarketPulseReady(
    targets: PushTarget[],
    payload: {
      reportDate: string;
      title?: string;
      body?: string;
      headline?: string;
    }
  ): Promise<PushDispatchResult> {
    return this.sendNotification(targets, {
      notificationType: "market_pulse_ready",
      route: "market_pulse",
      title: payload.title ?? "Morning Pulse Ready",
      body:
        payload.body ??
        "Your Morning Pulse is ready. Here's what moved overnight.",
      data: {
        report_date: payload.reportDate,
        ...(payload.headline ? { headline: payload.headline } : {})
      }
    });
  }

  async sendNotification(
    targets: PushTarget[],
    payload: NotificationPushPayload
  ): Promise<PushDispatchResult> {
    if (targets.length === 0) {
      return {
        attempted: 0,
        delivered: 0,
        failed: 0,
        invalidTargets: [],
        provider: this.config.provider
      };
    }

    if (this.config.provider === "stub") {
      return {
        attempted: targets.length,
        delivered: targets.length,
        failed: 0,
        invalidTargets: [],
        provider: "stub"
      };
    }

    if (!this.config.googleApplicationCredentials) {
      return {
        attempted: targets.length,
        delivered: 0,
        failed: targets.length,
        invalidTargets: [],
        provider: "fcm"
      };
    }

    process.env.GOOGLE_APPLICATION_CREDENTIALS = this.config.googleApplicationCredentials;

    if (getApps().length === 0) {
      initializeApp({
        credential: applicationDefault()
      });
    }

    let delivered = 0;
    let failed = 0;
    const invalidTargets: PushTarget[] = [];

    try {
      const batchResult = await getMessaging().sendEachForMulticast({
        tokens: targets.map((target) => target.deviceToken),
        android: {
          priority: "high"
        },
        data: {
          route: payload.route,
          title: payload.title,
          body: payload.body,
          notification_type: payload.notificationType,
          ...(payload.data ?? {})
        }
      });

      delivered = batchResult.successCount;
      failed = batchResult.failureCount;

      batchResult.responses.forEach((result, index) => {
        if (result.success) {
          return;
        }

        const errorCode = (result.error as FirebaseMessagingError | undefined)?.code;
        if (isInvalidFcmToken(errorCode)) {
          const target = targets[index];
          if (target) {
            invalidTargets.push(target);
          }
        }
      });
    } catch {
      failed = targets.length;
      delivered = 0;
      invalidTargets.length = 0;
    }

    return {
      attempted: targets.length,
      delivered,
      failed,
      invalidTargets,
      provider: "fcm"
    };
  }
}
