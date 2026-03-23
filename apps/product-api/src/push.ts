import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging, type FirebaseMessagingError } from "firebase-admin/messaging";

export interface PushTarget {
  userId: string;
  deviceToken: string;
}

export interface PushDispatchResult {
  attempted: number;
  delivered: number;
  failed: number;
  invalidTargets: string[];
  provider: "stub" | "fcm";
}

export interface PushNotifierConfig {
  provider: "stub" | "fcm";
  googleApplicationCredentials?: string;
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
    }
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
    const invalidTargets: string[] = [];

    try {
      const title = payload.title ?? "Morning Pulse Ready";
      const body =
        payload.body ??
        "Your Morning Pulse is ready. Here's what moved overnight.";

      const batchResult = await getMessaging().sendEachForMulticast({
        tokens: targets.map((target) => target.deviceToken),
        android: {
          priority: "high"
        },
        data: {
          route: "market_pulse",
          report_date: payload.reportDate,
          title,
          body
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
            invalidTargets.push(target.userId);
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
