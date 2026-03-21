import { createServer, type Server } from "node:http";

import { captureException, initSentry } from "./sentry";
import {
  computeCycleWindowForRun,
  computeNextScheduledRun,
  computeTestModeCycleWindow
} from "./scheduling";

const serviceName = "scheduler";
const defaultPort = Number(process.env.PORT ?? "3005");

interface SchedulerConfig {
  port: number;
  productApiInternalBaseUrl: string;
  internalWorkerToken: string;
  scheduleTimeZone: string;
  scheduleHour: number;
  scheduleMinute: number;
  testMode: boolean;
  testFireInSeconds: number;
}

interface SchedulerState {
  nextFireAt?: string;
  mode: "scheduled" | "test";
}

type HealthPayload = {
  status: "ok";
  mode: SchedulerState["mode"];
  timezone: string;
  schedule: string;
  next_fire_at?: string;
};

function log(
  level: "INFO" | "WARN" | "ERROR",
  message: string,
  fields: Record<string, unknown> = {}
): void {
  console.log(
    JSON.stringify({
      level,
      service: serviceName,
      message,
      timestamp: new Date().toISOString(),
      ...fields
    })
  );
}

function parseScheduleClock(
  value: string | undefined
): { hour: number; minute: number } {
  const fallback = { hour: 6, minute: 30 };
  if (!value) {
    return fallback;
  }

  const match = value.trim().match(/^([0-1]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) {
    return fallback;
  }

  const hour = Number.parseInt(match[1] ?? "6", 10);
  const minute = Number.parseInt(match[2] ?? "30", 10);
  return { hour, minute };
}

function loadConfig(env: NodeJS.ProcessEnv = process.env): SchedulerConfig {
  const schedule = parseScheduleClock(env.SCHEDULER_DELIVERY_TIME_LOCAL ?? "06:30");
  const testMode =
    (env.SCHEDULER_TEST_MODE ?? "").trim().toLowerCase() === "true" ||
    (env.SCHEDULER_TEST_FIRE_IN_SECONDS ?? "").trim().length > 0;
  const testFireInSeconds = Number.parseInt(env.SCHEDULER_TEST_FIRE_IN_SECONDS ?? "120", 10);

  return {
    port: Number.parseInt(env.PORT ?? String(defaultPort), 10),
    productApiInternalBaseUrl:
      env.PRODUCT_API_INTERNAL_BASE_URL?.trim() || "http://product-api:3001",
    internalWorkerToken: env.INTERNAL_WORKER_TOKEN ?? "dev-internal-worker-token",
    scheduleTimeZone: env.SCHEDULER_TIMEZONE?.trim() || "America/New_York",
    scheduleHour: schedule.hour,
    scheduleMinute: schedule.minute,
    testMode,
    testFireInSeconds: Number.isFinite(testFireInSeconds) && testFireInSeconds > 0
      ? testFireInSeconds
      : 120
  };
}

async function dispatchPulseJob(
  config: SchedulerConfig,
  cycleWindow: { cycleStart: string; cycleEnd: string }
): Promise<void> {
  const response = await fetch(`${config.productApiInternalBaseUrl}/internal/pulse/dispatch`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-token": config.internalWorkerToken
    },
    body: JSON.stringify({
      cycle_start: cycleWindow.cycleStart,
      cycle_end: cycleWindow.cycleEnd
    })
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      `Pulse dispatch failed with status ${response.status}: ${JSON.stringify(payload)}`
    );
  }

  log("INFO", "Pulse dispatch accepted", {
    cycle_start: cycleWindow.cycleStart,
    cycle_end: cycleWindow.cycleEnd,
    deduplicated: payload.deduplicated
  });
}

export function startServer(port: number = defaultPort): Server {
  const config = loadConfig({
    ...process.env,
    PORT: String(port)
  });

  initSentry({
    enabled: Boolean(process.env.SENTRY_DSN),
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development"
  });

  const state: SchedulerState = {
    mode: config.testMode ? "test" : "scheduled"
  };
  let fireTimer: NodeJS.Timeout | undefined;
  let testFired = false;
  let shuttingDown = false;

  const scheduleNext = (): void => {
    if (shuttingDown) {
      return;
    }
    if (fireTimer) {
      clearTimeout(fireTimer);
      fireTimer = undefined;
    }

    if (config.testMode && testFired) {
      state.nextFireAt = undefined;
      return;
    }

    const now = new Date();
    const runAt = config.testMode
      ? new Date(now.getTime() + config.testFireInSeconds * 1000)
      : computeNextScheduledRun(
        now,
        config.scheduleTimeZone,
        config.scheduleHour,
        config.scheduleMinute
      );

    const delayMs = Math.max(0, runAt.getTime() - now.getTime());
    state.nextFireAt = runAt.toISOString();

    fireTimer = setTimeout(async () => {
      if (shuttingDown) {
        return;
      }

      if (config.testMode) {
        testFired = true;
      }

      const cycleWindow = config.testMode
        ? computeTestModeCycleWindow(runAt)
        : computeCycleWindowForRun(
          runAt,
          config.scheduleTimeZone,
          config.scheduleHour,
          config.scheduleMinute
        );

      log("INFO", "Scheduler fired", {
        cycle_start: cycleWindow.cycleStart,
        cycle_end: cycleWindow.cycleEnd,
        mode: state.mode
      });

      try {
        await dispatchPulseJob(config, cycleWindow);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Pulse dispatch failed";
        log("ERROR", "Pulse dispatch failed", {
          error_message: message,
          cycle_start: cycleWindow.cycleStart,
          cycle_end: cycleWindow.cycleEnd
        });
        captureException(new Error(message), {
          service: serviceName,
          cycle_start: cycleWindow.cycleStart,
          cycle_end: cycleWindow.cycleEnd
        });
      }

      scheduleNext();
    }, delayMs);
  };

  const server = createServer((request, response) => {
    if (request.url === "/health") {
      const payload: HealthPayload = {
        status: "ok",
        mode: state.mode,
        timezone: config.scheduleTimeZone,
        schedule: `${String(config.scheduleHour).padStart(2, "0")}:${String(
          config.scheduleMinute
        ).padStart(2, "0")}`,
        next_fire_at: state.nextFireAt
      };

      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(payload));
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "not_found" }));
  });

  server.on("listening", () => {
    log("INFO", "Service started", {
      mode: state.mode,
      timezone: config.scheduleTimeZone,
      schedule_time_local: `${String(config.scheduleHour).padStart(2, "0")}:${String(
        config.scheduleMinute
      ).padStart(2, "0")}`
    });
    scheduleNext();
  });

  server.on("error", (error) => {
    const message = error instanceof Error ? error.message : "Unknown startup error";
    log("ERROR", message);
  });

  server.on("close", () => {
    shuttingDown = true;
    if (fireTimer) {
      clearTimeout(fireTimer);
      fireTimer = undefined;
    }
  });

  return server.listen(config.port);
}

if (require.main === module) {
  startServer();
}
