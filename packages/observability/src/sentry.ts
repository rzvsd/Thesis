import * as Sentry from "@sentry/node";

export interface ObservabilityConfig {
  enabled?: boolean;
  dsn?: string;
  environment?: string;
  release?: string;
}

let runtime: Required<Pick<ObservabilityConfig, "enabled">> & ObservabilityConfig = {
  enabled: false
};

export function initSentry(config: ObservabilityConfig = {}): ObservabilityConfig {
  const dsn = config.dsn?.trim();
  const enabled = Boolean(config.enabled && dsn);

  runtime = {
    ...config,
    dsn,
    enabled
  };

  if (!enabled) {
    return runtime;
  }

  Sentry.init({
    dsn,
    environment:
      config.environment?.trim() ||
      process.env.NODE_ENV ||
      "development",
    release: config.release,
    tracesSampleRate: 0
  });

  return runtime;
}

export function captureException(
  error: Error,
  context: Record<string, unknown> = {}
): void {
  if (!runtime.enabled) {
    return;
  }

  const eventId = Sentry.captureException(error, {
    extra: context
  });

  console.error(
    JSON.stringify({
      level: "ERROR",
      service: "observability",
      message: "Sentry capture",
      timestamp: new Date().toISOString(),
      error_message: error.message,
      sentry_event_id: eventId,
      ...context
    })
  );
}

export async function flushSentry(timeoutMs = 2000): Promise<boolean> {
  if (!runtime.enabled) {
    return true;
  }

  return Sentry.flush(timeoutMs);
}
