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
  fcmServerKey?: string;
}

interface FcmLegacyResult {
  error?: string;
}

interface FcmLegacyResponse {
  success?: number;
  failure?: number;
  results?: FcmLegacyResult[];
}

function isInvalidFcmToken(errorCode: string | undefined): boolean {
  return errorCode === "InvalidRegistration" || errorCode === "NotRegistered";
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

    if (!this.config.fcmServerKey) {
      return {
        attempted: targets.length,
        delivered: 0,
        failed: targets.length,
        invalidTargets: [],
        provider: "fcm"
      };
    }

    let delivered = 0;
    let failed = 0;
    const invalidTargets: string[] = [];

    for (const target of targets) {
      const response = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          authorization: `key=${this.config.fcmServerKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          to: target.deviceToken,
          notification: {
            title: payload.title ?? "Morning Pulse Ready",
            body:
              payload.body ??
              "Your Morning Pulse is ready. Here's what moved overnight."
          },
          data: {
            route: "market_pulse",
            report_date: payload.reportDate
          }
        })
      });

      if (!response.ok) {
        failed += 1;
        continue;
      }

      const parsed = (await response.json()) as FcmLegacyResponse;
      const successCount = parsed.success ?? 0;
      const failureCount = parsed.failure ?? 0;
      delivered += successCount;
      failed += failureCount;

      if (failureCount > 0) {
        const firstError = parsed.results?.[0]?.error;
        if (isInvalidFcmToken(firstError)) {
          invalidTargets.push(target.userId);
        }
      }
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
