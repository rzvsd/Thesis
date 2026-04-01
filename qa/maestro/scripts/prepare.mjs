import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "../../..");
const qaDir = path.join(rootDir, "qa", "maestro");
const envPath = path.join(qaDir, ".maestro.env");
const androidDir = path.join(rootDir, "apps", "mobile", "android");

const appId = process.env.MAESTRO_APP_ID || "com.thesis.mobile";
const apiBaseUrl = normalizeBaseUrl(process.env.MAESTRO_API_BASE_URL || "http://127.0.0.1:3001");
const deepDiveTicker = (process.env.MAESTRO_DEEP_DIVE_TICKER || "AAPL").trim().toUpperCase();
const internalToken = process.env.MAESTRO_INTERNAL_TOKEN || process.env.INTERNAL_WORKER_TOKEN || "dev-internal-worker-token";
const testPassword = process.env.MAESTRO_TEST_PASSWORD || "VeryStrongPass1!";
const testEmail = process.env.MAESTRO_TEST_EMAIL || autoEmail();
const registerEmail = process.env.MAESTRO_REGISTER_EMAIL || autoEmail();
const adbCommand = resolveAdbCommand();
const javaHome = resolveJavaHome();
const requireDeepDiveSeed = process.env.MAESTRO_REQUIRE_DEEP_DIVE_SEED === "true";

const state = {
  apiBaseUrl,
  appId,
  deepDiveTicker,
  internalToken,
  testEmail,
  registerEmail,
  testPassword,
  deviceSerial: process.env.MAESTRO_DEVICE_SERIAL || "",
  seededReportId: "",
  deepDiveAvailable: false,
  pulseDate: todayUtcDate()
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[maestro:prepare] ERROR: ${message}`);
  process.exit(1);
});

async function main() {
  await mkdir(qaDir, { recursive: true });

  log("Checking Product API health.");
  await ensureHealth(state.apiBaseUrl);

  log("Checking connected Android device.");
  state.deviceSerial = await selectDevice(adbCommand, state.deviceSerial);
  log(`Using device: ${state.deviceSerial}`);

  if (isLoopbackHost(state.apiBaseUrl)) {
    await ensureAdbReverse(adbCommand, state.deviceSerial, state.apiBaseUrl);
  }

  log("Creating/validating test user.");
  const registerResult = await registerUser(state.apiBaseUrl, state.testEmail, state.testPassword);
  if (registerResult.verification_token) {
    await verifyUser(state.apiBaseUrl, registerResult.verification_token);
  }
  const loginResult = await loginUser(state.apiBaseUrl, state.testEmail, state.testPassword);
  const accessToken = requiredString(loginResult.access_token, "access_token missing from /auth/login.");

  log(`Seeding Deep Dive report for ${state.deepDiveTicker}.`);
  try {
    state.seededReportId = await seedDeepDiveReport(state.apiBaseUrl, accessToken, state.deepDiveTicker);
    state.deepDiveAvailable = true;
  } catch (error) {
    if (requireDeepDiveSeed) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[maestro:prepare] WARN: Deep Dive seed skipped (${message})`);
    state.seededReportId = "";
    state.deepDiveAvailable = false;
  }

  log("Triggering market pulse dispatch attempt.");
  await triggerPulseDispatch(state.apiBaseUrl, state.internalToken, state.pulseDate, accessToken);

  log("Installing Android debug app.");
  await installAndroidDebug(state.apiBaseUrl);

  log("Resetting app state on device.");
  await run(adbCommand, ["-s", state.deviceSerial, "shell", "pm", "clear", state.appId], { capture: false });

  await writeEnvFile(envPath, state);
  log(`Wrote runtime env file: ${envPath}`);

  console.log("");
  console.log("[maestro:prepare] Ready.");
  console.log("[maestro:prepare] Next step: pnpm qa:maestro:smoke");
}

function autoEmail() {
  return `m7.maestro.${Date.now()}.${Math.floor(Math.random() * 100000)}@example.com`;
}

function todayUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeBaseUrl(value) {
  return value.trim().replace(/\/+$/, "");
}

function resolveJavaHome() {
  if (process.env.JAVA_HOME) {
    return process.env.JAVA_HOME;
  }
  const candidates = [
    "C:\\Program Files\\Android\\Android Studio\\jbr",
    "C:\\Program Files\\Android\\Android Studio\\jre"
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return "";
}

function withJavaEnv(baseEnv, resolvedJavaHome) {
  if (!resolvedJavaHome) {
    return baseEnv;
  }
  const env = { ...baseEnv };
  env.JAVA_HOME = resolvedJavaHome;
  const javaBin = path.join(resolvedJavaHome, "bin");
  env.PATH = env.PATH ? `${javaBin}${path.delimiter}${env.PATH}` : javaBin;
  return env;
}

function resolveAdbCommand() {
  if (process.env.ADB_PATH) {
    return process.env.ADB_PATH;
  }
  const localAppData = process.env.LOCALAPPDATA || "";
  const windowsCandidate = path.join(localAppData, "Android", "Sdk", "platform-tools", "adb.exe");
  if (windowsCandidate && existsSync(windowsCandidate)) {
    return windowsCandidate;
  }
  return "adb";
}

function isLoopbackHost(baseUrl) {
  const url = new URL(baseUrl);
  return url.hostname === "127.0.0.1" || url.hostname === "localhost";
}

function resolvedPort(baseUrl) {
  const url = new URL(baseUrl);
  if (url.port) {
    return Number(url.port);
  }
  return url.protocol === "https:" ? 443 : 80;
}

function isEmulator(serial) {
  return serial.startsWith("emulator-");
}

async function ensureHealth(baseUrl) {
  const response = await apiRequest(baseUrl, "GET", "/health");
  if (response.status !== 200) {
    throw new Error(`Health check failed with HTTP ${response.status}.`);
  }
}

async function registerUser(baseUrl, email, password) {
  const response = await apiRequest(baseUrl, "POST", "/auth/register", {
    body: { email, password }
  });
  if (response.status >= 400) {
    throw new Error(`Register failed: HTTP ${response.status} ${response.rawBody}`.trim());
  }
  return response.json;
}

async function verifyUser(baseUrl, token) {
  const response = await apiRequest(baseUrl, "POST", "/auth/verify", {
    body: { token }
  });
  if (response.status >= 400) {
    throw new Error(`Verify failed: HTTP ${response.status} ${response.rawBody}`.trim());
  }
}

async function loginUser(baseUrl, email, password) {
  const response = await apiRequest(baseUrl, "POST", "/auth/login", {
    body: { email, password }
  });
  if (response.status >= 400) {
    throw new Error(`Login failed: HTTP ${response.status} ${response.rawBody}`.trim());
  }
  return response.json;
}

async function seedDeepDiveReport(baseUrl, accessToken, ticker) {
  const create = await apiRequest(baseUrl, "POST", "/jobs", {
    accessToken,
    body: { ticker }
  });
  if (create.status >= 400) {
    throw new Error(`Create job failed: HTTP ${create.status} ${create.rawBody}`.trim());
  }
  const jobId = requiredString(create.json.job_id, "Missing job_id from /jobs response.");
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await sleep(2000);
    const status = await apiRequest(baseUrl, "GET", `/jobs/${jobId}`, { accessToken });
    if (status.status >= 400) {
      throw new Error(`Job status failed: HTTP ${status.status} ${status.rawBody}`.trim());
    }
    const stateValue = status.json.status;
    if (stateValue === "complete") {
      return requiredString(status.json.report_id, "Job completed without report_id.");
    }
    if (stateValue === "failed") {
      throw new Error(`Seed Deep Dive failed: ${status.json.error_message || "unknown failure"}`);
    }
  }
  throw new Error("Timed out waiting for seeded Deep Dive report.");
}

async function triggerPulseDispatch(baseUrl, token, day, accessToken) {
  const payload = {
    cycle_start: `${day}T00:00:00.000Z`,
    cycle_end: `${day}T23:59:00.000Z`
  };
  const dispatch = await apiRequest(baseUrl, "POST", "/internal/pulse/dispatch", {
    headers: { "x-internal-token": token },
    body: payload
  });
  if (dispatch.status >= 400) {
    throw new Error(`Pulse dispatch failed: HTTP ${dispatch.status} ${dispatch.rawBody}`.trim());
  }

  for (let attempt = 0; attempt < 30; attempt += 1) {
    await sleep(2000);
    const pulse = await apiRequest(baseUrl, "GET", `/pulse/${day}`, { accessToken });
    if (pulse.status === 200) {
      return;
    }
    if (pulse.status === 404) {
      continue;
    }
    throw new Error(`Pulse retrieval failed: HTTP ${pulse.status} ${pulse.rawBody}`.trim());
  }
  throw new Error(`Timed out waiting for pulse report for ${day}.`);
}

async function ensureAdbReverse(adb, serial, baseUrl) {
  const port = resolvedPort(baseUrl);
  log(`Applying adb reverse tcp:${port} -> tcp:${port}.`);
  await run(adb, ["-s", serial, "reverse", `tcp:${port}`, `tcp:${port}`], { capture: false });
}

async function installAndroidDebug(baseUrl) {
  const gradleProp = `-PAPI_BASE_URL=${baseUrl}`;
  const gradleEnv = withJavaEnv(process.env, javaHome);
  if (process.platform === "win32") {
    await run("cmd", ["/c", "gradlew.bat", "installDebug", gradleProp], {
      cwd: androidDir,
      env: gradleEnv,
      capture: false
    });
    return;
  }
  await run("./gradlew", ["installDebug", gradleProp], {
    cwd: androidDir,
    env: gradleEnv,
    capture: false
  });
}

async function selectDevice(adb, preferredSerial) {
  const output = await run(adb, ["devices"], { capture: true });
  const devices = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.endsWith("\tdevice"))
    .map((line) => line.split("\t")[0]);

  if (!devices.length) {
    throw new Error("No connected Android device found. Connect a device/emulator and retry.");
  }

  if (preferredSerial) {
    if (!devices.includes(preferredSerial)) {
      throw new Error(`Requested MAESTRO_DEVICE_SERIAL '${preferredSerial}' not found in adb devices output.`);
    }
    return preferredSerial;
  }

  return devices[0];
}

async function writeEnvFile(filePath, values) {
  const lines = [
    `MAESTRO_APP_ID=${values.appId}`,
    `MAESTRO_DEVICE_SERIAL=${values.deviceSerial}`,
    `MAESTRO_API_BASE_URL=${values.apiBaseUrl}`,
    `MAESTRO_TEST_EMAIL=${values.testEmail}`,
    `MAESTRO_REGISTER_EMAIL=${values.registerEmail}`,
    `MAESTRO_TEST_PASSWORD=${values.testPassword}`,
    `MAESTRO_DEEP_DIVE_TICKER=${values.deepDiveTicker}`,
    `MAESTRO_PULSE_DATE=${values.pulseDate}`,
    `MAESTRO_SEEDED_REPORT_ID=${values.seededReportId}`,
    `MAESTRO_DEEP_DIVE_AVAILABLE=${values.deepDiveAvailable ? "true" : "false"}`
  ];
  await writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
}

async function apiRequest(baseUrl, method, pathName, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const headers = {
    "content-type": "application/json",
    ...(options.headers || {})
  };
  if (options.accessToken) {
    headers.authorization = `Bearer ${options.accessToken}`;
  }
  const response = await fetch(`${baseUrl}${pathName}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));

  const rawBody = await response.text();
  let json = {};
  if (rawBody.trim()) {
    try {
      json = JSON.parse(rawBody);
    } catch {
      json = {};
    }
  }

  return {
    status: response.status,
    json,
    rawBody
  };
}

async function run(command, args, options = {}) {
  const { cwd = rootDir, env = process.env, capture = false } = options;
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
      windowsHide: true
    });

    let output = "";

    if (capture) {
      child.stdout.on("data", (chunk) => {
        output += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        output += chunk.toString();
      });
    }

    child.on("error", (error) => {
      if (error && error.code === "ENOENT") {
        reject(new Error(`Command not found: ${command}. Install required tooling or set ADB_PATH.`));
        return;
      }
      reject(error);
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve(output.trim());
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}.`));
    });
  });
}

function requiredString(value, message) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(message) {
  console.log(`[maestro:prepare] ${message}`);
}
