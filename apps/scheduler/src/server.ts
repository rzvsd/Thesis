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
  dataOpenbbInternalBaseUrl: string;
  internalWorkerToken: string;
  scheduleTimeZone: string;
  scheduleHour: number;
  scheduleMinute: number;
  historicalSyncHour: number;
  historicalSyncMinute: number;
  testMode: boolean;
  testFireInSeconds: number;
}

interface SchedulerState {
  nextPulseFireAt?: string;
  nextHistoricalSyncAt?: string;
  mode: "scheduled" | "test";
}

type HealthPayload = {
  status: "ok";
  mode: SchedulerState["mode"];
  timezone: string;
  schedule: string;
  historical_sync_schedule: string;
  next_fire_at?: string;
  next_pulse_fire_at?: string;
  next_historical_sync_at?: string;
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
  const historicalSyncSchedule = parseScheduleClock(
    env.SCHEDULER_HISTORICAL_SYNC_TIME_LOCAL ?? "01:00"
  );
  const testMode =
    (env.SCHEDULER_TEST_MODE ?? "").trim().toLowerCase() === "true" ||
    (env.SCHEDULER_TEST_FIRE_IN_SECONDS ?? "").trim().length > 0;
  const testFireInSeconds = Number.parseInt(env.SCHEDULER_TEST_FIRE_IN_SECONDS ?? "120", 10);

  return {
    port: Number.parseInt(env.PORT ?? String(defaultPort), 10),
    productApiInternalBaseUrl:
      env.PRODUCT_API_INTERNAL_BASE_URL?.trim() || "http://product-api:3001",
    dataOpenbbInternalBaseUrl:
      env.DATA_OPENBB_INTERNAL_BASE_URL?.trim() || "http://data-openbb:3003",
    internalWorkerToken: env.INTERNAL_WORKER_TOKEN ?? "dev-internal-worker-token",
    scheduleTimeZone: env.SCHEDULER_TIMEZONE?.trim() || "America/New_York",
    scheduleHour: schedule.hour,
    scheduleMinute: schedule.minute,
    historicalSyncHour: historicalSyncSchedule.hour,
    historicalSyncMinute: historicalSyncSchedule.minute,
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

async function dispatchHistoricalSync(config: SchedulerConfig): Promise<void> {
  const response = await fetch(`${config.dataOpenbbInternalBaseUrl}/internal/historical/sync`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-token": config.internalWorkerToken
    },
    body: JSON.stringify({})
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      `Historical sync dispatch failed with status ${response.status}: ${JSON.stringify(payload)}`
    );
  }

  const syncData =
    typeof payload.data === "object" && payload.data !== null
      ? (payload.data as Record<string, unknown>)
      : undefined;

  log("INFO", "Historical sync accepted", {
    sec_rows_written: syncData?.sec_rows_written,
    transcript_rows_written: syncData?.transcript_rows_written,
    transcript_sync_status: syncData?.transcript_sync_status,
    transcript_snapshot_revision: syncData?.transcript_snapshot_revision
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
  let pulseTimer: NodeJS.Timeout | undefined;
  let historicalSyncTimer: NodeJS.Timeout | undefined;
  let testFired = false;
  let shuttingDown = false;

  const schedulePulseNext = (): void => {
    if (shuttingDown) {
      return;
    }
    if (pulseTimer) {
      clearTimeout(pulseTimer);
      pulseTimer = undefined;
    }

    if (config.testMode && testFired) {
      state.nextPulseFireAt = undefined;
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
    state.nextPulseFireAt = runAt.toISOString();

    pulseTimer = setTimeout(async () => {
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

      schedulePulseNext();
    }, delayMs);
  };

  const scheduleHistoricalSyncNext = (): void => {
    if (shuttingDown || config.testMode) {
      state.nextHistoricalSyncAt = undefined;
      return;
    }

    if (historicalSyncTimer) {
      clearTimeout(historicalSyncTimer);
      historicalSyncTimer = undefined;
    }

    const now = new Date();
    const runAt = computeNextScheduledRun(
      now,
      config.scheduleTimeZone,
      config.historicalSyncHour,
      config.historicalSyncMinute
    );
    const delayMs = Math.max(0, runAt.getTime() - now.getTime());
    state.nextHistoricalSyncAt = runAt.toISOString();

    historicalSyncTimer = setTimeout(async () => {
      if (shuttingDown) {
        return;
      }

      log("INFO", "Historical sync schedule fired", {
        mode: state.mode,
        scheduled_for: runAt.toISOString()
      });

      try {
        await dispatchHistoricalSync(config);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Historical sync dispatch failed";
        log("ERROR", "Historical sync dispatch failed", {
          error_message: message
        });
        captureException(new Error(message), {
          service: serviceName,
          scheduled_for: runAt.toISOString(),
          target: "data-openbb"
        });
      }

      scheduleHistoricalSyncNext();
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
        historical_sync_schedule: `${String(config.historicalSyncHour).padStart(2, "0")}:${String(
          config.historicalSyncMinute
        ).padStart(2, "0")}`,
        next_fire_at: state.nextPulseFireAt,
        next_pulse_fire_at: state.nextPulseFireAt,
        next_historical_sync_at: state.nextHistoricalSyncAt
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
      ).padStart(2, "0")}`,
      historical_sync_time_local: `${String(config.historicalSyncHour).padStart(2, "0")}:${String(
        config.historicalSyncMinute
      ).padStart(2, "0")}`
    });
    schedulePulseNext();
    scheduleHistoricalSyncNext();
  });

  server.on("error", (error) => {
    const message = error instanceof Error ? error.message : "Unknown startup error";
    log("ERROR", message);
  });

  server.on("close", () => {
    shuttingDown = true;
    if (pulseTimer) {
      clearTimeout(pulseTimer);
      pulseTimer = undefined;
    }
    if (historicalSyncTimer) {
      clearTimeout(historicalSyncTimer);
      historicalSyncTimer = undefined;
    }
  });

  return server.listen(config.port);
}

if (require.main === module) {
  startServer();
}
