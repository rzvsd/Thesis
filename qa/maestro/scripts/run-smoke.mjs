import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "../../..");
const qaDir = path.join(rootDir, "qa", "maestro");
const envPath = path.join(qaDir, ".maestro.env");
const defaultFlowPath = path.join(qaDir, "flows", "ph3_m4_smoke.yaml");
const outputRoot = path.join(qaDir, "output");
const maestroCommand = resolveMaestroCommand();
const adbCommand = resolveAdbCommand();
const javaHome = resolveJavaHome();

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[maestro:smoke] ERROR: ${message}`);
  process.exit(1);
});

async function main() {
  const envFromFile = await loadEnvFile(envPath);
  const runtimeEnv = {
    ...envFromFile,
    ...process.env
  };
  const flowPath = resolveFlowPath(runtimeEnv);
  applyJavaEnv(runtimeEnv, javaHome);

  if (runtimeEnv.MAESTRO_DEVICE_SERIAL) {
    runtimeEnv.ANDROID_SERIAL = runtimeEnv.MAESTRO_DEVICE_SERIAL;
  }

  await ensureMaestroAvailable(runtimeEnv);
  await launchAppWithAdb(runtimeEnv);

  const runStamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = path.join(outputRoot, runStamp);
  await mkdir(runDir, { recursive: true });

  const logPath = path.join(runDir, "maestro.log");
  const summaryPath = path.join(runDir, "summary.json");
  const envSnapshotPath = path.join(runDir, "env.used");
  const logStream = createWriteStream(logPath, { flags: "a" });

  await writeFile(envSnapshotPath, formatEnvSnapshot(runtimeEnv), "utf8");

  console.log(`[maestro:smoke] Running flow: ${flowPath}`);
  console.log(`[maestro:smoke] Output folder: ${runDir}`);

  const startedAt = new Date().toISOString();
  const exitCode = await runStreaming(
    maestroCommand,
    ["test", flowPath],
    runtimeEnv,
    logStream
  );
  const endedAt = new Date().toISOString();

  const summary = {
    flow: flowPath,
    started_at: startedAt,
    ended_at: endedAt,
    exit_code: exitCode,
    device_serial: runtimeEnv.MAESTRO_DEVICE_SERIAL || "",
    app_id: runtimeEnv.MAESTRO_APP_ID || "com.thesis.mobile",
    api_base_url: runtimeEnv.MAESTRO_API_BASE_URL || "",
    log: logPath
  };

  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  logStream.end();

  if (exitCode !== 0) {
    console.error(`[maestro:smoke] FAILED. See logs at ${logPath}`);
    process.exit(exitCode);
  }

  console.log(`[maestro:smoke] PASS. Summary: ${summaryPath}`);
}

async function launchAppWithAdb(env) {
  const serial = env.MAESTRO_DEVICE_SERIAL?.trim();
  const appId = env.MAESTRO_APP_ID?.trim();
  if (!serial || !appId) {
    throw new Error("Missing MAESTRO_DEVICE_SERIAL or MAESTRO_APP_ID for adb app launch.");
  }

  await ensureDeviceAwake(serial, env);
  const activity = await resolveLaunchActivity(serial, appId);
  await runStreaming(adbCommand, ["-s", serial, "shell", "am", "force-stop", appId], env, null, { echo: false });
  const exitCode = await runStreaming(
    adbCommand,
    ["-s", serial, "shell", "am", "start", "-W", "-n", activity],
    env,
    null,
    { echo: false }
  );
  if (exitCode !== 0) {
    throw new Error(`adb could not start ${activity}.`);
  }
}

async function ensureDeviceAwake(serial, env) {
  // Wake and dismiss keyguard so smoke assertions do not start on a black/locked screen.
  await runStreaming(adbCommand, ["-s", serial, "shell", "input", "keyevent", "224"], env, null, { echo: false });
  await runStreaming(adbCommand, ["-s", serial, "shell", "wm", "dismiss-keyguard"], env, null, { echo: false });
  await runStreaming(adbCommand, ["-s", serial, "shell", "input", "keyevent", "82"], env, null, { echo: false });
}

async function resolveLaunchActivity(serial, appId) {
  // Emulators can intermittently return transient "broken pipe"/"no activity"
  // responses while package manager services settle after install/reset.
  // Retry a few times before failing hard.
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let output = "";
    const exitCode = await runStreaming(
      adbCommand,
      ["-s", serial, "shell", "cmd", "package", "resolve-activity", "--brief", "--user", "0", appId],
      process.env,
      {
        write: (chunk) => {
          output += chunk;
        },
        end() {}
      },
      { echo: false }
    );

    if (exitCode === 0) {
      const activity = output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .at(-1);

      if (activity && activity.includes("/")) {
        return activity;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Unable to resolve launch activity for ${appId}.`);
}

function resolveFlowPath(env) {
  const configured = env.MAESTRO_FLOW_PATH?.trim();
  if (!configured) {
    return defaultFlowPath;
  }

  const resolved = path.isAbsolute(configured) ? configured : path.resolve(rootDir, configured);
  if (!existsSync(resolved)) {
    throw new Error(`Configured MAESTRO_FLOW_PATH not found: ${resolved}`);
  }
  return resolved;
}

async function loadEnvFile(filePath) {
  let raw;
  try {
    raw = await readFile(filePath, "utf8");
  } catch {
    throw new Error(`Missing ${filePath}. Run 'pnpm qa:maestro:prepare' first.`);
  }

  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    env[key] = value;
  }
  return env;
}

async function ensureMaestroAvailable(env) {
  const code = await runStreaming(maestroCommand, ["--version"], env, null, { echo: false });
  if (code !== 0) {
    throw new Error("Maestro CLI is not runnable. Ensure Maestro and Java are installed, then retry.");
  }
}

function resolveMaestroCommand() {
  if (process.env.MAESTRO_PATH) {
    return process.env.MAESTRO_PATH;
  }
  if (process.platform === "win32") {
    const candidate = path.join(process.env.USERPROFILE || "", ".maestro", "bin", "maestro.bat");
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }
  return "maestro";
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

function resolveAdbCommand() {
  if (process.env.ADB_PATH) {
    return process.env.ADB_PATH;
  }
  if (process.platform === "win32") {
    const candidate = path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk", "platform-tools", "adb.exe");
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }
  return "adb";
}

function applyJavaEnv(env, resolvedJavaHome) {
  if (!resolvedJavaHome) {
    return;
  }
  env.JAVA_HOME = resolvedJavaHome;
  const javaBin = path.join(resolvedJavaHome, "bin");
  env.PATH = env.PATH ? `${javaBin}${path.delimiter}${env.PATH}` : javaBin;
}

function formatEnvSnapshot(env) {
  const safeKeys = [
    "MAESTRO_APP_ID",
    "MAESTRO_DEVICE_SERIAL",
    "MAESTRO_API_BASE_URL",
    "MAESTRO_TEST_EMAIL",
    "MAESTRO_REGISTER_EMAIL",
    "MAESTRO_DEEP_DIVE_TICKER",
    "MAESTRO_PULSE_DATE",
    "MAESTRO_SEEDED_REPORT_ID",
    "ANDROID_SERIAL"
  ];
  return `${safeKeys.map((key) => `${key}=${env[key] || ""}`).join("\n")}\n`;
}

async function runStreaming(command, args, env, logStream, options = {}) {
  const { echo = true } = options;
  const useCmdWrapper = process.platform === "win32" && command.toLowerCase().endsWith(".bat");
  const spawnCommand = useCmdWrapper ? "cmd" : command;
  const spawnArgs = useCmdWrapper ? ["/c", command, ...args] : args;
  return await new Promise((resolve, reject) => {
    const child = spawn(spawnCommand, spawnArgs, {
      cwd: rootDir,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });

    child.on("error", (error) => {
      if (error && error.code === "ENOENT") {
        reject(new Error(`Command not found: ${command}. Install Maestro CLI and retry.`));
        return;
      }
      reject(error);
    });

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      if (echo) {
        process.stdout.write(text);
      }
      if (logStream) {
        logStream.write(text);
      }
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      if (echo) {
        process.stderr.write(text);
      }
      if (logStream) {
        logStream.write(text);
      }
    });

    child.on("close", (code) => {
      resolve(code ?? 1);
    });
  });
}
