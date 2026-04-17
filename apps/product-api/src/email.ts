export interface EmailTarget {
  userId: string;
  email: string;
}

export interface EmailDispatchResult {
  attempted: number;
  delivered: number;
  failed: number;
  provider: "stub" | "resend";
}

export interface EmailNotifierConfig {
  provider: "stub" | "resend";
  resendApiBaseUrl: string;
  resendApiKey?: string;
  fromAddress?: string;
  requestTimeoutMs?: number;
}

export interface NotificationEmailPayload {
  subject: string;
  text: string;
}

export class EmailNotifier {
  private readonly config: EmailNotifierConfig;

  constructor(config: EmailNotifierConfig) {
    this.config = config;
  }

  async sendNotification(
    targets: EmailTarget[],
    payload: NotificationEmailPayload
  ): Promise<EmailDispatchResult> {
    if (targets.length === 0) {
      return {
        attempted: 0,
        delivered: 0,
        failed: 0,
        provider: this.config.provider
      };
    }

    if (this.config.provider === "stub") {
      return {
        attempted: targets.length,
        delivered: targets.length,
        failed: 0,
        provider: "stub"
      };
    }

    if (!this.config.resendApiKey || !this.config.fromAddress) {
      return {
        attempted: targets.length,
        delivered: 0,
        failed: targets.length,
        provider: "resend"
      };
    }

    let delivered = 0;
    let failed = 0;
    for (const target of targets) {
      const dispatched = await this.sendWithResend(target, payload);
      if (dispatched) {
        delivered += 1;
      } else {
        failed += 1;
      }
    }

    return {
      attempted: targets.length,
      delivered,
      failed,
      provider: "resend"
    };
  }

  private async sendWithResend(
    target: EmailTarget,
    payload: NotificationEmailPayload
  ): Promise<boolean> {
    const abortController = new AbortController();
    const timeoutMs = this.config.requestTimeoutMs ?? 12_000;
    const timeout = setTimeout(() => abortController.abort(), timeoutMs);
    try {
      const response = await fetch(
        `${this.config.resendApiBaseUrl.replace(/\/+$/, "")}/emails`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${this.config.resendApiKey}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            from: this.config.fromAddress,
            to: [target.email],
            subject: payload.subject,
            text: payload.text
          }),
          signal: abortController.signal
        }
      );
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }
}
