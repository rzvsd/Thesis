import assert from "node:assert/strict";
import test from "node:test";

import {
  assertTickerSyncSafety,
  parseDailyListPipe,
  parseTradingSystemAddsDeletes,
  toFullTickerEntries
} from "../src/ticker-registry-sync";
import type { ProductApiConfig } from "../src/config";
import type { TickerSyncRuntimeConfig } from "../src/ticker-registry-sync";

const SAMPLE_NASDAQ_LISTED = [
  "Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares",
  "AAPL|Apple Inc. Common Stock|Q|N|N|100|N|N",
  "QQQ|Invesco QQQ Trust, Series 1 ETF|Q|N|N|100|Y|N",
  "TESTY|Test Security|Q|Y|N|100|N|N",
  "File Creation Time: 032020261200"
].join("\n");

const SAMPLE_OTHER_LISTED = [
  "ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol",
  "IBM|International Business Machines Corporation Common Stock|N|IBM|N|100|N|IBM",
  "ETFZ|Some ETF Product|N|ETFZ|Y|100|N|ETFZ",
  "OTCY|Some OTC Name|V|OTCY|N|100|N|OTCY",
  "File Creation Time: 032020261201"
].join("\n");

const SAMPLE_TRADING_DELTA = [
  "Symbol|Company Name|NASDAQ Action|BX Action|PSX Action|Effective Date|Primary Listing Market",
  "NEWC|New Company Common Stock|Add|Add|Add|3/20/2026|Q",
  "DELC|Deleted Company Common Stock|Delete|Delete|Delete|3/20/2026|N",
  "NOPE|Unsupported Fund ETF|Add|Add|Add|3/20/2026|Q"
].join("\n");

const SAMPLE_DAILY_LIST = [
  "Daily List Date|Effective Date|Issue Event|Symbol|Company Name|New Symbol|New Company Name|Market Category|Listing Center",
  "03/20/2026 12:00:00|03/20/2026|Security Additions|ABCD|ABCD Corp Common Stock|||Q|Q",
  "03/20/2026 12:00:00|03/20/2026|Issue Deletions|DELC|Deleted Co Common Stock|||Q|N",
  "03/20/2026 12:00:00|03/20/2026|Name/Symbol Changes|OLDS|Old Co Common Stock|NEWS|New Co Common Stock|Q|Q",
  "03/20/2026 12:00:00|03/20/2026|Name/Symbol Changes|NAME|Old Name Common Stock||New Name Common Stock|Q|Q"
].join("\n");

function createConfig(overrides: Partial<ProductApiConfig> = {}): ProductApiConfig {
  return {
    port: 3001,
    jwtSecret: "dev-jwt-secret-change-me",
    accessTokenTtlSeconds: 900,
    refreshTokenTtlSeconds: 2_592_000,
    verificationTokenTtlSeconds: 86_400,
    bcryptCost: 12,
    queueBackend: "redis",
    queueKey: "jobs:deep_dive",
    redisUrl: "redis://127.0.0.1:6379/0",
    storeBackend: "postgres",
    databaseUrl: "postgres://postgres:postgres@127.0.0.1:5432/thesis",
    autoMigrate: true,
    artifactRoot: "C:/tmp/artifacts",
    emailProviderMode: "stub",
    exposeVerificationToken: false,
    internalWorkerToken: "dev-internal-worker-token",
    rateLimitWindowSeconds: 60,
    rateLimitMaxRequests: 120,
    tickerAutoSyncEnabled: true,
    tickerAutoSyncRunOnStartup: true,
    tickerDeltaSyncIntervalSeconds: 900,
    tickerFullSyncIntervalSeconds: 86_400,
    marketPulseDataOpenbbBaseUrl: "http://data-openbb:3003",
    marketPulseNewsIngestBaseUrl: "http://news-ingest:3004",
    marketPulseTickers: ["AAPL", "MSFT", "TSLA"],
    marketPulseSchemaVersion: "1.0.0",
    pushProviderMode: "stub",
    jobRecoveryEnabled: true,
    jobRecoveryRunOnStartup: true,
    jobRecoveryIntervalSeconds: 30,
    jobRecoveryBatchSize: 100,
    jobRecoveryQueuedStaleSeconds: 20,
    jobRecoveryRunningTimeoutSeconds: 180,
    jobRecoveryRequeueCooldownSeconds: 60,
    ...overrides
  };
}

function createRuntimeConfig(
  overrides: Partial<TickerSyncRuntimeConfig> = {}
): TickerSyncRuntimeConfig {
  return {
    mode: "full",
    fullNasdaqUrl: "https://example.com/nasdaqlisted.txt",
    fullOtherUrl: "https://example.com/otherlisted.txt",
    deltaSource: "trading_system_adds_deletes",
    deltaUrl: "https://example.com/delta.txt",
    ...overrides
  };
}

test("full ticker feed parser keeps supported NYSE/NASDAQ equities", () => {
  const entries = toFullTickerEntries(
    SAMPLE_NASDAQ_LISTED,
    SAMPLE_OTHER_LISTED,
    "2026-03-20T12:00:00.000Z"
  );
  const symbols = entries.map((entry) => entry.symbol).sort();
  assert.deepEqual(symbols, ["AAPL", "IBM"]);
});

test("trading-system delta parser returns add/delete changes", () => {
  const changes = parseTradingSystemAddsDeletes(
    SAMPLE_TRADING_DELTA,
    "2026-03-20T12:00:00.000Z"
  );
  assert.equal(changes.length, 2);
  assert.equal(changes[0]?.type, "add");
  assert.equal(changes[0]?.symbol, "NEWC");
  assert.equal(changes[1]?.type, "delete");
  assert.equal(changes[1]?.symbol, "DELC");
});

test("daily-list parser returns add/delete/name/symbol changes", () => {
  const changes = parseDailyListPipe(
    SAMPLE_DAILY_LIST,
    "2026-03-20T12:00:00.000Z"
  );
  assert.equal(changes.length, 4);
  assert.equal(changes[0]?.type, "add");
  assert.equal(changes[1]?.type, "delete");
  assert.equal(changes[2]?.type, "symbol_change");
  assert.equal(changes[2]?.newSymbol, "NEWS");
  assert.equal(changes[3]?.type, "name_change");
});

test("ticker sync safety rejects non-postgres store backend", () => {
  assert.throws(
    () =>
      assertTickerSyncSafety(
        createConfig({ storeBackend: "memory", databaseUrl: undefined }),
        createRuntimeConfig(),
        {}
      ),
    /requires STORE_BACKEND=postgres/i
  );
});

test("ticker sync safety blocks file inputs unless explicitly allowed", () => {
  assert.throws(
    () =>
      assertTickerSyncSafety(
        createConfig(),
        createRuntimeConfig({
          fullNasdaqFile: "tests/fixtures/tickers/full_nasdaqlisted_sample.txt",
          fullOtherFile: "tests/fixtures/tickers/full_otherlisted_sample.txt"
        }),
        {}
      ),
    /file inputs are blocked by default/i
  );
});

test("ticker sync safety allows file inputs when explicitly enabled", () => {
  assert.doesNotThrow(() =>
    assertTickerSyncSafety(
      createConfig(),
      createRuntimeConfig({
        fullNasdaqFile: "tests/fixtures/tickers/full_nasdaqlisted_sample.txt",
        fullOtherFile: "tests/fixtures/tickers/full_otherlisted_sample.txt"
      }),
      { TICKER_ALLOW_FILE_INPUTS: "true" }
    )
  );
});
