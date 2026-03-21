import { readFile } from "node:fs/promises";

import { loadConfig, type ProductApiConfig } from "./config";
import { logError, logInfo, logWarn } from "./logging";
import { createProductStore } from "./store-factory";
import type { ProductStore } from "./store";
import type {
  TickerDeltaChange,
  TickerRegistryUpsertInput
} from "./types";
import type { TickerExchange } from "../../../packages/contracts/src";

export type TickerDeltaSource = "trading_system_adds_deletes" | "daily_list_pipe";
export type TickerSyncMode = "full" | "delta" | "full_then_delta";

const DEFAULT_FULL_NASDAQ_URL = "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt";
const DEFAULT_FULL_OTHER_URL = "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt";
const DEFAULT_DELTA_URL =
  "https://www.nasdaqtrader.com/dynamic/SymDir/TradingSystemAddsDeletes.txt";
const ALLOW_FILE_INPUTS_ENV = "TICKER_ALLOW_FILE_INPUTS";

export interface TickerSyncRuntimeConfig {
  mode: TickerSyncMode;
  fullNasdaqUrl: string;
  fullOtherUrl: string;
  fullNasdaqFile?: string;
  fullOtherFile?: string;
  deltaSource: TickerDeltaSource;
  deltaUrl: string;
  deltaFilePath?: string;
}

interface HeaderMapRow {
  [header: string]: string;
}

function parseMode(rawMode: string | undefined): TickerSyncMode {
  if (rawMode === "full" || rawMode === "delta" || rawMode === "full_then_delta") {
    return rawMode;
  }
  return "full_then_delta";
}

function parseDeltaSource(rawSource: string | undefined): TickerDeltaSource {
  if (rawSource === "daily_list_pipe") {
    return "daily_list_pipe";
  }
  return "trading_system_adds_deletes";
}

function parseCliArgs(argv: string[]): Record<string, string> {
  const output: Record<string, string> = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      continue;
    }
    const [key, value] = arg.slice(2).split("=", 2);
    if (!key || !value) {
      continue;
    }
    output[key] = value;
  }
  return output;
}

function isTruthy(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function loadTickerSyncRuntimeConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): TickerSyncRuntimeConfig {
  return {
    mode: parseMode(env.TICKER_SYNC_MODE),
    fullNasdaqUrl: env.TICKER_FULL_NASDAQ_URL ?? DEFAULT_FULL_NASDAQ_URL,
    fullOtherUrl: env.TICKER_FULL_OTHER_URL ?? DEFAULT_FULL_OTHER_URL,
    fullNasdaqFile: env.TICKER_FULL_NASDAQ_FILE,
    fullOtherFile: env.TICKER_FULL_OTHER_FILE,
    deltaSource: parseDeltaSource(env.TICKER_DAILY_DELTA_SOURCE),
    deltaUrl: env.TICKER_DAILY_DELTA_URL ?? DEFAULT_DELTA_URL,
    deltaFilePath: env.TICKER_DAILY_DELTA_FILE
  };
}

function loadTickerSyncRuntimeConfigFromCli(
  env: NodeJS.ProcessEnv = process.env,
  argv: string[] = process.argv.slice(2)
): TickerSyncRuntimeConfig {
  const cli = parseCliArgs(argv);
  const envConfig = loadTickerSyncRuntimeConfigFromEnv(env);

  return {
    mode: parseMode(cli.mode ?? envConfig.mode),
    fullNasdaqUrl: cli.fullNasdaqUrl ?? envConfig.fullNasdaqUrl,
    fullOtherUrl: cli.fullOtherUrl ?? envConfig.fullOtherUrl,
    fullNasdaqFile: cli.fullNasdaqFile ?? envConfig.fullNasdaqFile,
    fullOtherFile: cli.fullOtherFile ?? envConfig.fullOtherFile,
    deltaSource: parseDeltaSource(cli.deltaSource ?? envConfig.deltaSource),
    deltaUrl: cli.deltaUrl ?? envConfig.deltaUrl,
    deltaFilePath: cli.deltaFilePath ?? envConfig.deltaFilePath
  };
}

function usesFileInputs(config: TickerSyncRuntimeConfig): boolean {
  return Boolean(config.fullNasdaqFile || config.fullOtherFile || config.deltaFilePath);
}

function assertTickerSyncSafety(
  appConfig: ProductApiConfig,
  runtimeConfig: TickerSyncRuntimeConfig,
  env: NodeJS.ProcessEnv = process.env
): void {
  if (appConfig.storeBackend !== "postgres") {
    throw new Error(
      "Ticker sync requires STORE_BACKEND=postgres and a live DATABASE_URL. " +
      `Current store backend: ${appConfig.storeBackend}.`
    );
  }

  if (Boolean(runtimeConfig.fullNasdaqFile) !== Boolean(runtimeConfig.fullOtherFile)) {
    throw new Error(
      "Ticker sync file mode requires both --fullNasdaqFile and --fullOtherFile together."
    );
  }

  if (usesFileInputs(runtimeConfig) && !isTruthy(env[ALLOW_FILE_INPUTS_ENV])) {
    throw new Error(
      "Ticker sync file inputs are blocked by default. " +
      `Set ${ALLOW_FILE_INPUTS_ENV}=true only for controlled smoke/test runs.`
    );
  }
}

function parsePipeHeaderRows(content: string): HeaderMapRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    return [];
  }

  const headerLine = lines[0];
  if (!headerLine) {
    return [];
  }
  const headers = headerLine.split("|").map((value) => value.trim());
  if (headers.length === 0) {
    return [];
  }

  const rows: HeaderMapRow[] = [];
  for (const line of lines.slice(1)) {
    if (line.startsWith("File Creation Time") || line.startsWith("Notes for Day")) {
      continue;
    }

    const values = line.split("|");
    if (values.every((value) => value.trim().length === 0)) {
      continue;
    }

    const row: HeaderMapRow = {};
    for (let index = 0; index < headers.length; index += 1) {
      const header = headers[index];
      if (!header) {
        continue;
      }
      row[header] = values[index]?.trim() ?? "";
    }
    rows.push(row);
  }
  return rows;
}

const unsupportedNamePatterns = [
  /\bETF\b/i,
  /\bETN\b/i,
  /\bFUND\b/i,
  /\bTRUST\b/i,
  /\bWARRANTS?\b/i,
  /\bRIGHTS?\b/i,
  /\bUNITS?\b/i,
  /\bPREFERRED\b/i,
  /\bNOTES?\b/i,
  /\bBONDS?\b/i,
  /\bDEBENTURES?\b/i
];

function isSupportedEquitySecurityName(name: string): boolean {
  const normalized = name.trim();
  if (!normalized) {
    return false;
  }

  for (const pattern of unsupportedNamePatterns) {
    if (pattern.test(normalized)) {
      return false;
    }
  }
  return true;
}

function toExchangeFromCode(code: string): TickerExchange | undefined {
  const normalized = code.trim().toUpperCase();
  if (normalized === "N" || normalized === "NYSE") {
    return "NYSE";
  }
  if (["Q", "G", "S", "NASDAQ"].includes(normalized)) {
    return "NASDAQ";
  }
  return undefined;
}

function toFullTickerEntries(
  nasdaqContent: string,
  otherContent: string,
  syncedAt: string
): TickerRegistryUpsertInput[] {
  const results = new Map<string, TickerRegistryUpsertInput>();

  for (const row of parsePipeHeaderRows(nasdaqContent)) {
    const symbol = (row.Symbol ?? "").trim().toUpperCase();
    const companyName = (row["Security Name"] ?? "").trim();
    const testIssue = (row["Test Issue"] ?? "").trim().toUpperCase();
    const etf = (row.ETF ?? "").trim().toUpperCase();
    if (!symbol || !companyName) {
      continue;
    }
    if (testIssue === "Y" || etf === "Y") {
      continue;
    }
    if (!isSupportedEquitySecurityName(companyName)) {
      continue;
    }

    results.set(symbol, {
      symbol,
      companyName,
      exchange: "NASDAQ",
      listingStatus: "active",
      isSupported: true,
      sourceFeed: "nasdaqlisted",
      sourceUpdatedAt: syncedAt,
      lastSyncedAt: syncedAt,
      rawPayload: row
    });
  }

  for (const row of parsePipeHeaderRows(otherContent)) {
    const symbol = (row["ACT Symbol"] ?? "").trim().toUpperCase();
    const companyName = (row["Security Name"] ?? "").trim();
    const exchangeCode = (row.Exchange ?? "").trim();
    const testIssue = (row["Test Issue"] ?? "").trim().toUpperCase();
    const etf = (row.ETF ?? "").trim().toUpperCase();
    if (!symbol || !companyName) {
      continue;
    }
    if (testIssue === "Y" || etf === "Y") {
      continue;
    }
    const exchange = toExchangeFromCode(exchangeCode);
    if (exchange !== "NYSE") {
      continue;
    }
    if (!isSupportedEquitySecurityName(companyName)) {
      continue;
    }

    results.set(symbol, {
      symbol,
      companyName,
      exchange,
      listingStatus: "active",
      isSupported: true,
      sourceFeed: "otherlisted",
      sourceUpdatedAt: syncedAt,
      lastSyncedAt: syncedAt,
      rawPayload: row
    });
  }

  return [...results.values()];
}

function parseTradingSystemAddsDeletes(
  content: string,
  sourceUpdatedAt: string
): TickerDeltaChange[] {
  const changes: TickerDeltaChange[] = [];
  for (const row of parsePipeHeaderRows(content)) {
    const symbol = (row.Symbol ?? "").trim().toUpperCase();
    const companyName = (row["Company Name"] ?? "").trim();
    const action = (row["NASDAQ Action"] ?? "").trim().toUpperCase();
    const listingMarket = (row["Primary Listing Market"] ?? "").trim().toUpperCase();
    const exchange = toExchangeFromCode(listingMarket);
    if (!symbol || !exchange) {
      continue;
    }

    if (!isSupportedEquitySecurityName(companyName)) {
      continue;
    }

    if (action === "ADD") {
      changes.push({
        type: "add",
        symbol,
        companyName,
        exchange,
        sourceFeed: "trading_system_adds_deletes",
        sourceUpdatedAt,
        rawPayload: row
      });
    } else if (action === "DELETE") {
      changes.push({
        type: "delete",
        symbol,
        sourceFeed: "trading_system_adds_deletes",
        sourceUpdatedAt,
        rawPayload: row
      });
    }
  }
  return changes;
}

function parseDailyListPipe(content: string, sourceUpdatedAt: string): TickerDeltaChange[] {
  const changes: TickerDeltaChange[] = [];
  for (const row of parsePipeHeaderRows(content)) {
    const symbol = (row.Symbol ?? "").trim().toUpperCase();
    const companyName = (row["Company Name"] ?? "").trim();
    const newSymbol = (row["New Symbol"] ?? "").trim().toUpperCase();
    const newCompanyName = (row["New Company Name"] ?? "").trim();
    const issueEvent = (row["Issue Event"] ?? "").trim().toUpperCase();
    const exchangeCode = (row["Listing Center"] ?? row["Primary Listing Market"] ?? "").trim();
    const exchange = toExchangeFromCode(exchangeCode);

    if (!symbol || !issueEvent) {
      continue;
    }

    if (
      issueEvent.includes("SECURITY ADDITIONS") ||
      issueEvent.includes("ANTICIPATED SECURITY ADDITIONS")
    ) {
      if (!exchange || !isSupportedEquitySecurityName(companyName)) {
        continue;
      }
      changes.push({
        type: "add",
        symbol,
        companyName,
        exchange,
        sourceFeed: "daily_list_pipe",
        sourceUpdatedAt,
        rawPayload: row
      });
      continue;
    }

    if (issueEvent.includes("ISSUE DELETIONS")) {
      changes.push({
        type: "delete",
        symbol,
        sourceFeed: "daily_list_pipe",
        sourceUpdatedAt,
        rawPayload: row
      });
      continue;
    }

    if (issueEvent.includes("NAME/SYMBOL CHANGES")) {
      const normalizedExchange = exchange;
      if (newSymbol && newSymbol !== symbol) {
        changes.push({
          type: "symbol_change",
          symbol,
          companyName,
          newSymbol,
          newCompanyName: newCompanyName || companyName,
          exchange: normalizedExchange,
          sourceFeed: "daily_list_pipe",
          sourceUpdatedAt,
          rawPayload: row
        });
      } else {
        changes.push({
          type: "name_change",
          symbol,
          companyName,
          newCompanyName: newCompanyName || companyName,
          sourceFeed: "daily_list_pipe",
          sourceUpdatedAt,
          rawPayload: row
        });
      }
    }
  }
  return changes;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Ticker sync fetch failed: ${url} (${response.status})`);
  }
  return response.text();
}

async function runFullRefresh(
  store: ProductStore,
  config: TickerSyncRuntimeConfig,
  syncedAt: string
): Promise<{ upserted: number; deactivated: number }> {
  const [nasdaqContent, otherContent] = await Promise.all([
    config.fullNasdaqFile
      ? readFile(config.fullNasdaqFile, "utf-8")
      : fetchText(config.fullNasdaqUrl),
    config.fullOtherFile
      ? readFile(config.fullOtherFile, "utf-8")
      : fetchText(config.fullOtherUrl)
  ]);
  const entries = toFullTickerEntries(nasdaqContent, otherContent, syncedAt);
  if (entries.length === 0) {
    throw new Error("Ticker full refresh produced zero supported entries.");
  }
  const result = await store.replaceTickerRegistry({
    entries,
    sourceFeed: "nasdaq_symbol_directory",
    syncedAt
  });
  return result;
}

async function runDelta(
  store: ProductStore,
  config: TickerSyncRuntimeConfig,
  syncedAt: string
): Promise<{ added: number; deleted: number; updated: number; renamed: number }> {
  let deltaContent: string;
  if (config.deltaFilePath) {
    deltaContent = await readFile(config.deltaFilePath, "utf-8");
  } else {
    deltaContent = await fetchText(config.deltaUrl);
  }

  const changes = config.deltaSource === "daily_list_pipe"
    ? parseDailyListPipe(deltaContent, syncedAt)
    : parseTradingSystemAddsDeletes(deltaContent, syncedAt);
  if (changes.length === 0) {
    logWarn("Ticker delta sync received no applicable changes", {
      mode: config.deltaSource
    });
  }

  return store.applyTickerDelta({
    changes,
    syncedAt
  });
}

export async function runTickerRegistrySync(
  store: ProductStore,
  config: TickerSyncRuntimeConfig
): Promise<void> {
  const syncedAt = new Date().toISOString();
  logInfo("Ticker registry sync started", {
    mode: config.mode,
    delta_source: config.deltaSource
  });

  if (config.mode === "full" || config.mode === "full_then_delta") {
    const fullResult = await runFullRefresh(store, config, syncedAt);
    logInfo("Ticker full refresh completed", fullResult);
  }

  if (config.mode === "delta" || config.mode === "full_then_delta") {
    const deltaResult = await runDelta(store, config, syncedAt);
    logInfo("Ticker delta sync completed", deltaResult);
  }
}

async function main(): Promise<void> {
  const appConfig = loadConfig();
  const syncConfig = loadTickerSyncRuntimeConfigFromCli();
  assertTickerSyncSafety(appConfig, syncConfig);

  const store = await createProductStore(appConfig);
  try {
    await runTickerRegistrySync(store, syncConfig);
  } finally {
    await store.close();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown ticker sync failure";
    logError("Ticker sync failed", {
      error_message: message
    });
    process.exitCode = 1;
  });
}

export {
  assertTickerSyncSafety,
  parseDailyListPipe,
  parseTradingSystemAddsDeletes,
  toFullTickerEntries
};
