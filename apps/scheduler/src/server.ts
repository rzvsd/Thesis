import { createServer, type Server } from "node:http";

import { captureException, initSentry } from "./sentry";
import {
  computeCycleWindowForRun,
  computeNextScheduledRun,
  computeTestModeCycleWindow,
  getZonedDateTimeParts
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
  macroStressScheduleHour: number;
  macroStressScheduleMinute: number;
  historicalSyncHour: number;
  historicalSyncMinute: number;
  calendarSyncHour: number;
  calendarSyncMinute: number;
  earningsPreviewHour: number;
  earningsPreviewMinute: number;
  contrarianEvalHour: number;
  contrarianEvalMinute: number;
  weeklyDigestHour: number;
  weeklyDigestMinute: number;
  officialSourceTickers: string[];
  warRoomDispatchRoute?: string;
  testMode: boolean;
  testFireInSeconds: number;
}

interface SchedulerState {
  nextPulseFireAt?: string;
  nextMacroStressFireAt?: string;
  nextHistoricalSyncAt?: string;
  nextCalendarSyncAt?: string;
  nextEarningsPreviewAt?: string;
  nextContrarianEvalAt?: string;
  nextWeeklyDigestAt?: string;
  mode: "scheduled" | "test";
}

type HealthPayload = {
  status: "ok";
  mode: SchedulerState["mode"];
  timezone: string;
  schedule: string;
  macro_stress_schedule: string;
  sentiment_schedule: string;
  historical_sync_schedule: string;
  calendar_sync_schedule: string;
  earnings_preview_schedule: string;
  contrarian_eval_schedule: string;
  weekly_digest_schedule: string;
  next_fire_at?: string;
  next_pulse_fire_at?: string;
  next_macro_stress_fire_at?: string;
  next_sentiment_fire_at?: string;
  next_historical_sync_at?: string;
  next_calendar_sync_at?: string;
  next_earnings_preview_at?: string;
  next_contrarian_eval_at?: string;
  next_weekly_digest_at?: string;
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

function formatClock(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function loadConfig(env: NodeJS.ProcessEnv = process.env): SchedulerConfig {
  const schedule = parseScheduleClock(env.SCHEDULER_DELIVERY_TIME_LOCAL ?? "06:30");
  const macroStressSchedule = parseScheduleClock(
    env.SCHEDULER_MACRO_STRESS_TIME_LOCAL ??
      env.SCHEDULER_SENTIMENT_TIME_LOCAL ??
      "18:00"
  );
  const historicalSyncSchedule = parseScheduleClock(
    env.SCHEDULER_HISTORICAL_SYNC_TIME_LOCAL ?? "01:00"
  );
  const calendarSyncSchedule = parseScheduleClock(
    env.SCHEDULER_CALENDAR_SYNC_TIME_LOCAL ?? "22:00"
  );
  const earningsPreviewSchedule = parseScheduleClock(
    env.SCHEDULER_EARNINGS_PREVIEW_TIME_LOCAL ?? "06:30"
  );
  const contrarianEvalSchedule = parseScheduleClock(
    env.SCHEDULER_CONTRARIAN_EVAL_TIME_LOCAL ?? "18:00"
  );
  const weeklyDigestSchedule = parseScheduleClock(
    env.SCHEDULER_WEEKLY_DIGEST_TIME_LOCAL ?? "18:00"
  );
  const warRoomDispatchRoute = env.SCHEDULER_WAR_ROOM_DISPATCH_ROUTE?.trim() || undefined;
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
    macroStressScheduleHour: macroStressSchedule.hour,
    macroStressScheduleMinute: macroStressSchedule.minute,
    historicalSyncHour: historicalSyncSchedule.hour,
    historicalSyncMinute: historicalSyncSchedule.minute,
    calendarSyncHour: calendarSyncSchedule.hour,
    calendarSyncMinute: calendarSyncSchedule.minute,
    earningsPreviewHour: earningsPreviewSchedule.hour,
    earningsPreviewMinute: earningsPreviewSchedule.minute,
    contrarianEvalHour: contrarianEvalSchedule.hour,
    contrarianEvalMinute: contrarianEvalSchedule.minute,
    weeklyDigestHour: weeklyDigestSchedule.hour,
    weeklyDigestMinute: weeklyDigestSchedule.minute,
    officialSourceTickers: (env.SCHEDULER_OFFICIAL_SOURCE_TICKERS ?? "AAPL,MSFT,TSLA")
      .split(",")
      .map((ticker) => ticker.trim().toUpperCase())
      .filter((ticker) => /^[A-Z.-]{1,12}$/.test(ticker)),
    warRoomDispatchRoute,
    testMode,
    testFireInSeconds: Number.isFinite(testFireInSeconds) && testFireInSeconds > 0
      ? testFireInSeconds
      : 120
  };
}

function marketDateInTimeZone(date: Date, timeZone: string): string {
  const parts = getZonedDateTimeParts(date, timeZone);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

export function shouldDispatchMonthlyCoherence(date: Date, timeZone: string): boolean {
  return getZonedDateTimeParts(date, timeZone).day === 1;
}

async function dispatchPulseJob(
  config: SchedulerConfig,
  cycleWindow: { cycleStart: string; cycleEnd: string }
): Promise<void> {
  const payload = await dispatchProductApiJobWithFallback(
    config,
    config.warRoomDispatchRoute
      ? [config.warRoomDispatchRoute, "/internal/pulse/dispatch"]
      : ["/internal/pulse/dispatch"],
    {
      cycle_start: cycleWindow.cycleStart,
      cycle_end: cycleWindow.cycleEnd
    },
    "Pulse dispatch"
  );

  log("INFO", "Pulse dispatch accepted", {
    cycle_start: cycleWindow.cycleStart,
    cycle_end: cycleWindow.cycleEnd,
    deduplicated: payload.deduplicated
  });
}

async function dispatchMacroStressJob(
  config: SchedulerConfig,
  marketDate: string
): Promise<void> {
  const payload = await dispatchProductApiJobWithFallback(
    config,
    ["/internal/macro-stress/dispatch", "/internal/sentiment/dispatch"],
    {
      market_date: marketDate
    },
    "Macro Stress"
  );

  log("INFO", "Macro Stress dispatch accepted", {
    market_date: marketDate,
    status: payload.status
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

async function dispatchProductApiJob(
  config: SchedulerConfig,
  route: string,
  body: Record<string, unknown>,
  label: string
): Promise<Record<string, unknown>> {
  const response = await fetch(`${config.productApiInternalBaseUrl}${route}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-token": config.internalWorkerToken
    },
    body: JSON.stringify(body)
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      `${label} dispatch failed with status ${response.status}: ${JSON.stringify(payload)}`
    );
  }

  return payload;
}

async function dispatchProductApiJobWithFallback(
  config: SchedulerConfig,
  routes: string[],
  body: Record<string, unknown>,
  label: string
): Promise<Record<string, unknown>> {
  let lastError: Error | undefined;

  for (let index = 0; index < routes.length; index += 1) {
    const route = routes[index];
    const response = await fetch(`${config.productApiInternalBaseUrl}${route}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-token": config.internalWorkerToken
      },
      body: JSON.stringify(body)
    });

    const payload = (await response.json()) as Record<string, unknown>;
    if (response.ok) {
      return payload;
    }

    if (response.status === 404 && index < routes.length - 1) {
      continue;
    }

    lastError = new Error(
      `${label} dispatch failed with status ${response.status}: ${JSON.stringify(payload)}`
    );
    break;
  }

  throw lastError ?? new Error(`${label} dispatch failed: no routes were available.`);
}

async function dispatchCalendarSync(config: SchedulerConfig): Promise<void> {
  const payload = await dispatchProductApiJob(config, "/internal/calendar/sync", {}, "Calendar sync");
  log("INFO", "Calendar sync accepted", {
    status: payload.status,
    events_upserted: payload.events_upserted,
    source_rows: payload.source_rows,
    supported_rows: payload.supported_rows
  });
}

async function dispatchConvictionCoherence(config: SchedulerConfig): Promise<void> {
  const payload = await dispatchProductApiJob(
    config,
    "/internal/conviction/coherence/evaluate",
    {},
    "Conviction coherence"
  );
  log("INFO", "Conviction coherence accepted", {
    period_start: payload.period_start,
    period_end: payload.period_end,
    evaluated_users: payload.evaluated_users,
    generated: payload.generated,
    degraded: payload.degraded,
    failed: payload.failed
  });
}

async function dispatchEarningsPreview(
  config: SchedulerConfig,
  runAt: Date = new Date()
): Promise<void> {
  const warRoomPayload = await dispatchProductApiJob(
    config,
    "/internal/notifications/earnings-war-room",
    {
      phase: "auto"
    },
    "Earnings War Room"
  );
  log("INFO", "Earnings War Room accepted", {
    as_of: warRoomPayload.as_of,
    phase: warRoomPayload.phase,
    prepared: warRoomPayload.prepared,
    live_updated: warRoomPayload.live_updated,
    post_closed: warRoomPayload.post_closed,
    attempted: warRoomPayload.attempted,
    delivered: warRoomPayload.delivered,
    failed: warRoomPayload.failed
  });

  const killSwitchPayload = await dispatchProductApiJob(
    config,
    "/internal/notifications/kill-switch/evaluate",
    {
      signal_source: "daily"
    },
    "Kill-switch evaluation"
  );
  log("INFO", "Kill-switch evaluation accepted", {
    evaluated: killSwitchPayload.evaluated,
    matched: killSwitchPayload.matched,
    skipped: killSwitchPayload.skipped,
    attempted: killSwitchPayload.attempted,
    delivered: killSwitchPayload.delivered,
    failed: killSwitchPayload.failed
  });

  const crossNamePayload = await dispatchProductApiJob(
    config,
    "/internal/notifications/cross-name/evaluate",
    {
      signal_source: "daily"
    },
    "Cross-name propagation"
  );
  log("INFO", "Cross-name propagation accepted", {
    evaluated: crossNamePayload.evaluated,
    matched: crossNamePayload.matched,
    suppressed: crossNamePayload.suppressed,
    attempted: crossNamePayload.attempted,
    delivered: crossNamePayload.delivered,
    failed: crossNamePayload.failed
  });

  const monitorPayload = await dispatchProductApiJob(
    config,
    "/internal/monitor/recompute",
    {},
    "Monitor recompute"
  );
  log("INFO", "Monitor recompute accepted", {
    status: monitorPayload.status,
    users: monitorPayload.users,
    names: monitorPayload.names,
    unresolved: monitorPayload.unresolved,
    updated: monitorPayload.updated
  });

  const freshnessPayload = await dispatchProductApiJob(
    config,
    "/internal/notifications/freshness-decay",
    {},
    "Freshness decay"
  );
  log("INFO", "Freshness decay accepted", {
    evaluated: freshnessPayload.evaluated,
    fired: freshnessPayload.fired,
    attempted: freshnessPayload.attempted,
    delivered: freshnessPayload.delivered,
    failed: freshnessPayload.failed
  });

  if (shouldDispatchMonthlyCoherence(runAt, config.scheduleTimeZone)) {
    await dispatchConvictionCoherence(config);
  }

  const payload = await dispatchProductApiJob(
    config,
    "/internal/notifications/earnings-preview",
    {
      user_ids: Array.isArray(warRoomPayload.fallback_user_ids)
        ? warRoomPayload.fallback_user_ids
        : []
    },
    "Earnings preview"
  );
  log("INFO", "Earnings preview accepted", {
    attempted: payload.attempted,
    delivered: payload.delivered,
    failed: payload.failed,
    fallback_user_count: payload.fallback_user_count
  });
}

async function dispatchContrarianEvaluation(config: SchedulerConfig): Promise<void> {
  const payload = await dispatchProductApiJob(
    config,
    "/internal/notifications/contrarian/evaluate",
    {},
    "Contrarian evaluation"
  );
  log("INFO", "Contrarian evaluation accepted", {
    attempted: payload.attempted,
    delivered: payload.delivered,
    failed: payload.failed,
    fired: payload.fired
  });
}

async function dispatchWeeklyDigest(config: SchedulerConfig): Promise<void> {
  const payload = await dispatchProductApiJob(
    config,
    "/internal/notifications/weekly-digest",
    {},
    "Weekly digest"
  );
  log("INFO", "Weekly digest accepted", {
    status: payload.status,
    attempted: payload.attempted,
    delivered: payload.delivered,
    failed: payload.failed
  });
}

async function fetchJson(url: string, options?: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(url, options);
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

function extractCanonicalEvents(payload: Record<string, unknown>): Record<string, unknown>[] {
  const data = payload.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return [];
  }
  const events = (data as Record<string, unknown>).canonical_events;
  if (!Array.isArray(events)) {
    return [];
  }
  return events.filter((event): event is Record<string, unknown> => (
    typeof event === "object" && event !== null && !Array.isArray(event)
  ));
}

async function dispatchOfficialRefresh(config: SchedulerConfig): Promise<{
  companyEvents: number;
  macroEvents: number;
  ingested: number;
}> {
  const events: Record<string, unknown>[] = [];
  for (const ticker of config.officialSourceTickers) {
    const payload = await fetchJson(
      `${config.dataOpenbbInternalBaseUrl}/v1/official/company?ticker=${encodeURIComponent(ticker)}`,
      {
        headers: {
          "x-internal-token": config.internalWorkerToken
        }
      }
    );
    events.push(...extractCanonicalEvents(payload));
  }

  const companyEvents = events.length;
  const macroPayload = await fetchJson(`${config.dataOpenbbInternalBaseUrl}/v1/official/macro?scope=daily`, {
    headers: {
      "x-internal-token": config.internalWorkerToken
    }
  });
  const macroEvents = extractCanonicalEvents(macroPayload);
  events.push(...macroEvents);

  const ingestPayload = await dispatchProductApiJob(
    config,
    "/internal/canonical-events/ingest",
    { events },
    "Official canonical event ingest"
  );

  const ingested = typeof ingestPayload.upserted === "number" ? ingestPayload.upserted : 0;
  log("INFO", "Official source refresh accepted", {
    company_events: companyEvents,
    macro_events: macroEvents.length,
    ingested
  });
  return {
    companyEvents,
    macroEvents: macroEvents.length,
    ingested
  };
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
  let macroStressTimer: NodeJS.Timeout | undefined;
  let historicalSyncTimer: NodeJS.Timeout | undefined;
  let calendarSyncTimer: NodeJS.Timeout | undefined;
  let earningsPreviewTimer: NodeJS.Timeout | undefined;
  let contrarianEvalTimer: NodeJS.Timeout | undefined;
  let weeklyDigestTimer: NodeJS.Timeout | undefined;
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

  const scheduleMacroStressNext = (): void => {
    if (shuttingDown || config.testMode) {
      state.nextMacroStressFireAt = undefined;
      return;
    }

    if (macroStressTimer) {
      clearTimeout(macroStressTimer);
      macroStressTimer = undefined;
    }

    const now = new Date();
    const runAt = computeNextScheduledRun(
      now,
      config.scheduleTimeZone,
      config.macroStressScheduleHour,
      config.macroStressScheduleMinute
    );
    const delayMs = Math.max(0, runAt.getTime() - now.getTime());
    state.nextMacroStressFireAt = runAt.toISOString();

    macroStressTimer = setTimeout(async () => {
      if (shuttingDown) {
        return;
      }

      const marketDate = marketDateInTimeZone(runAt, config.scheduleTimeZone);
      log("INFO", "Macro Stress schedule fired", {
        mode: state.mode,
        market_date: marketDate,
        scheduled_for: runAt.toISOString()
      });

      try {
        await dispatchMacroStressJob(config, marketDate);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Macro Stress dispatch failed";
        log("ERROR", "Macro Stress dispatch failed", {
          error_message: message,
          market_date: marketDate
        });
        captureException(new Error(message), {
          service: serviceName,
          market_date: marketDate,
          target: "product-api"
        });
      }

      scheduleMacroStressNext();
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

  const scheduleCalendarSyncNext = (): void => {
    if (shuttingDown || (config.testMode && testFired)) {
      state.nextCalendarSyncAt = undefined;
      return;
    }

    if (calendarSyncTimer) {
      clearTimeout(calendarSyncTimer);
      calendarSyncTimer = undefined;
    }

    const now = new Date();
    const runAt = config.testMode
      ? new Date(now.getTime() + config.testFireInSeconds * 1000)
      : computeNextScheduledRun(
          now,
          config.scheduleTimeZone,
          config.calendarSyncHour,
          config.calendarSyncMinute
        );
    const delayMs = Math.max(0, runAt.getTime() - now.getTime());
    state.nextCalendarSyncAt = runAt.toISOString();

    calendarSyncTimer = setTimeout(async () => {
      if (shuttingDown) {
        return;
      }

      if (config.testMode) {
        testFired = true;
      }

      log("INFO", "Calendar sync schedule fired", {
        mode: state.mode,
        scheduled_for: runAt.toISOString()
      });

      try {
        await dispatchCalendarSync(config);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Calendar sync dispatch failed";
        log("ERROR", "Calendar sync dispatch failed", {
          error_message: message
        });
        captureException(new Error(message), {
          service: serviceName,
          scheduled_for: runAt.toISOString(),
          target: "product-api",
          route: "/internal/calendar/sync"
        });
      }

      scheduleCalendarSyncNext();
    }, delayMs);
  };

  const scheduleEarningsPreviewNext = (): void => {
    if (shuttingDown || (config.testMode && testFired)) {
      state.nextEarningsPreviewAt = undefined;
      return;
    }

    if (earningsPreviewTimer) {
      clearTimeout(earningsPreviewTimer);
      earningsPreviewTimer = undefined;
    }

    const now = new Date();
    const runAt = config.testMode
      ? new Date(now.getTime() + config.testFireInSeconds * 1000)
      : computeNextScheduledRun(
          now,
          config.scheduleTimeZone,
          config.earningsPreviewHour,
          config.earningsPreviewMinute
        );
    const delayMs = Math.max(0, runAt.getTime() - now.getTime());
    state.nextEarningsPreviewAt = runAt.toISOString();

    earningsPreviewTimer = setTimeout(async () => {
      if (shuttingDown) {
        return;
      }

      if (config.testMode) {
        testFired = true;
      }

      log("INFO", "Earnings preview schedule fired", {
        mode: state.mode,
        scheduled_for: runAt.toISOString()
      });

      try {
        await dispatchEarningsPreview(config, runAt);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Earnings preview dispatch failed";
        log("ERROR", "Earnings preview dispatch failed", {
          error_message: message
        });
        captureException(new Error(message), {
          service: serviceName,
          scheduled_for: runAt.toISOString(),
          target: "product-api",
          route: "/internal/notifications/earnings-preview"
        });
      }

      scheduleEarningsPreviewNext();
    }, delayMs);
  };

  const scheduleContrarianEvalNext = (): void => {
    if (shuttingDown || (config.testMode && testFired)) {
      state.nextContrarianEvalAt = undefined;
      return;
    }

    if (contrarianEvalTimer) {
      clearTimeout(contrarianEvalTimer);
      contrarianEvalTimer = undefined;
    }

    const now = new Date();
    const runAt = config.testMode
      ? new Date(now.getTime() + config.testFireInSeconds * 1000)
      : computeNextScheduledRun(
          now,
          config.scheduleTimeZone,
          config.contrarianEvalHour,
          config.contrarianEvalMinute
        );
    const delayMs = Math.max(0, runAt.getTime() - now.getTime());
    state.nextContrarianEvalAt = runAt.toISOString();

    contrarianEvalTimer = setTimeout(async () => {
      if (shuttingDown) {
        return;
      }

      if (config.testMode) {
        testFired = true;
      }

      log("INFO", "Contrarian evaluation schedule fired", {
        mode: state.mode,
        scheduled_for: runAt.toISOString()
      });

      try {
        await dispatchContrarianEvaluation(config);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Contrarian evaluation dispatch failed";
        log("ERROR", "Contrarian evaluation dispatch failed", {
          error_message: message
        });
        captureException(new Error(message), {
          service: serviceName,
          scheduled_for: runAt.toISOString(),
          target: "product-api",
          route: "/internal/notifications/contrarian/evaluate"
        });
      }

      scheduleContrarianEvalNext();
    }, delayMs);
  };

  const scheduleWeeklyDigestNext = (): void => {
    if (shuttingDown || (config.testMode && testFired)) {
      state.nextWeeklyDigestAt = undefined;
      return;
    }

    if (weeklyDigestTimer) {
      clearTimeout(weeklyDigestTimer);
      weeklyDigestTimer = undefined;
    }

    const now = new Date();
    const runAt = config.testMode
      ? new Date(now.getTime() + config.testFireInSeconds * 1000)
      : computeNextScheduledRun(
          now,
          config.scheduleTimeZone,
          config.weeklyDigestHour,
          config.weeklyDigestMinute
        );
    const delayMs = Math.max(0, runAt.getTime() - now.getTime());
    state.nextWeeklyDigestAt = runAt.toISOString();

    weeklyDigestTimer = setTimeout(async () => {
      if (shuttingDown) {
        return;
      }

      if (config.testMode) {
        testFired = true;
      }

      log("INFO", "Weekly digest schedule fired", {
        mode: state.mode,
        scheduled_for: runAt.toISOString()
      });

      try {
        await dispatchWeeklyDigest(config);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Weekly digest dispatch failed";
        log("ERROR", "Weekly digest dispatch failed", {
          error_message: message
        });
        captureException(new Error(message), {
          service: serviceName,
          scheduled_for: runAt.toISOString(),
          target: "product-api",
          route: "/internal/notifications/weekly-digest"
        });
      }

      scheduleWeeklyDigestNext();
    }, delayMs);
  };

  const server = createServer(async (request, response) => {
    if (request.url === "/health") {
      const payload: HealthPayload = {
        status: "ok",
        mode: state.mode,
        timezone: config.scheduleTimeZone,
        schedule: formatClock(config.scheduleHour, config.scheduleMinute),
        macro_stress_schedule: formatClock(
          config.macroStressScheduleHour,
          config.macroStressScheduleMinute
        ),
        sentiment_schedule: formatClock(
          config.macroStressScheduleHour,
          config.macroStressScheduleMinute
        ),
        historical_sync_schedule: formatClock(config.historicalSyncHour, config.historicalSyncMinute),
        calendar_sync_schedule: formatClock(config.calendarSyncHour, config.calendarSyncMinute),
        earnings_preview_schedule: formatClock(
          config.earningsPreviewHour,
          config.earningsPreviewMinute
        ),
        contrarian_eval_schedule: formatClock(
          config.contrarianEvalHour,
          config.contrarianEvalMinute
        ),
        weekly_digest_schedule: formatClock(
          config.weeklyDigestHour,
          config.weeklyDigestMinute
        ),
        next_fire_at: state.nextPulseFireAt,
        next_pulse_fire_at: state.nextPulseFireAt,
        next_macro_stress_fire_at: state.nextMacroStressFireAt,
        next_sentiment_fire_at: state.nextMacroStressFireAt,
        next_historical_sync_at: state.nextHistoricalSyncAt,
        next_calendar_sync_at: state.nextCalendarSyncAt,
        next_earnings_preview_at: state.nextEarningsPreviewAt,
        next_contrarian_eval_at: state.nextContrarianEvalAt,
        next_weekly_digest_at: state.nextWeeklyDigestAt
      };

      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(payload));
      return;
    }

    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method === "POST" && url.pathname === "/internal/official/refresh") {
      if (request.headers["x-internal-token"] !== config.internalWorkerToken) {
        response.writeHead(401, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "unauthorized" }));
        return;
      }

      try {
        const result = await dispatchOfficialRefresh(config);
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({
          status: "accepted",
          company_events: result.companyEvents,
          macro_events: result.macroEvents,
          ingested: result.ingested
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Official source refresh failed";
        log("ERROR", "Official source refresh failed", {
          error_message: message
        });
        captureException(new Error(message), {
          service: serviceName,
          target: "official-source-refresh"
        });
        response.writeHead(502, { "content-type": "application/json" });
        response.end(JSON.stringify({
          error: "official_refresh_failed",
          error_message: message
        }));
      }
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
      macro_stress_schedule_time_local: `${String(config.macroStressScheduleHour).padStart(2, "0")}:${String(
        config.macroStressScheduleMinute
      ).padStart(2, "0")}`,
      sentiment_schedule_time_local: `${String(config.macroStressScheduleHour).padStart(2, "0")}:${String(
        config.macroStressScheduleMinute
      ).padStart(2, "0")}`,
      historical_sync_time_local: `${String(config.historicalSyncHour).padStart(2, "0")}:${String(
        config.historicalSyncMinute
      ).padStart(2, "0")}`
    });
      schedulePulseNext();
      scheduleMacroStressNext();
      scheduleHistoricalSyncNext();
      scheduleCalendarSyncNext();
      scheduleEarningsPreviewNext();
      scheduleContrarianEvalNext();
      scheduleWeeklyDigestNext();
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
    if (macroStressTimer) {
      clearTimeout(macroStressTimer);
      macroStressTimer = undefined;
    }
    if (historicalSyncTimer) {
      clearTimeout(historicalSyncTimer);
      historicalSyncTimer = undefined;
    }
    if (calendarSyncTimer) {
      clearTimeout(calendarSyncTimer);
      calendarSyncTimer = undefined;
    }
    if (earningsPreviewTimer) {
      clearTimeout(earningsPreviewTimer);
      earningsPreviewTimer = undefined;
    }
    if (contrarianEvalTimer) {
      clearTimeout(contrarianEvalTimer);
      contrarianEvalTimer = undefined;
    }
    if (weeklyDigestTimer) {
      clearTimeout(weeklyDigestTimer);
      weeklyDigestTimer = undefined;
    }
  });

  return server.listen(config.port);
}

if (require.main === module) {
  startServer();
}
