#!/usr/bin/env node
// Checks the /health endpoint of every Thesis service in a running environment,
// reports live vs fixture mode per service, and writes a dated evidence file.
//
// Usage (on the production host, or through an SSH tunnel):
//   node scripts/deploy/launch-proof-health.mjs
//   PROOF_BASE_URL=http://127.0.0.1 node scripts/deploy/launch-proof-health.mjs --out "Project Note/Launch-Proof/evidence"
//
// Per-service URL overrides: PROOF_PRODUCT_API_URL, PROOF_DEXTER_WORKER_URL,
// PROOF_DATA_OPENBB_URL, PROOF_NEWS_INGEST_URL, PROOF_SCHEDULER_URL.
// Exit code 0 only when every service is healthy and in live mode.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const baseUrl = (process.env.PROOF_BASE_URL || "http://127.0.0.1").replace(/\/+$/, "");
const outFlag = process.argv.indexOf("--out");
const outRoot = outFlag > -1 ? process.argv[outFlag + 1] : join("Project Note", "Launch-Proof", "evidence");

// mode(payload) returns "live", "fixture" or "unknown" plus a short detail.
const services = [
  {
    name: "product-api",
    port: 3001,
    mode: (p) => {
      if (!p.modes) return ["unknown", "health has no modes field (build predates launch-proof)"];
      const live = p.modes.push === "fcm" && p.modes.email === "resend";
      return [live ? "live" : "fixture", `push=${p.modes.push} email=${p.modes.email} artifact_store=${p.modes.artifact_store}`];
    }
  },
  { name: "dexter-worker", port: 3002, mode: fixtureFlag },
  { name: "data-openbb", port: 3003, mode: fixtureFlag },
  { name: "news-ingest", port: 3004, mode: fixtureFlag },
  {
    name: "scheduler",
    port: 3005,
    mode: (p) => [p.mode === "scheduled" ? "live" : p.mode === "test" ? "fixture" : "unknown", `mode=${p.mode}`]
  }
];

function fixtureFlag(p) {
  if (typeof p.fixture_mode !== "boolean") {
    return ["unknown", "health has no fixture_mode field (build predates launch-proof)"];
  }
  return [p.fixture_mode ? "fixture" : "live", `fixture_mode=${p.fixture_mode}`];
}

async function check(service) {
  const envKey = `PROOF_${service.name.toUpperCase().replace(/-/g, "_")}_URL`;
  const url = `${(process.env[envKey] || `${baseUrl}:${service.port}`).replace(/\/+$/, "")}/health`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const payload = await response.json();
    const healthy = response.status === 200 && payload.status === "ok";
    const [mode, detail] = healthy ? service.mode(payload) : ["unknown", "not healthy"];
    return { service: service.name, url, http_status: response.status, healthy, mode, detail, payload };
  } catch (error) {
    return { service: service.name, url, healthy: false, mode: "unknown", detail: String(error?.message ?? error) };
  }
}

const checkedAt = new Date().toISOString();
const results = await Promise.all(services.map(check));
const pass = results.every((r) => r.healthy && r.mode === "live");

for (const r of results) {
  console.log(`${r.healthy ? "OK  " : "DOWN"} ${r.service.padEnd(14)} ${r.mode.padEnd(8)} ${r.detail}`);
}
console.log(`verdict: ${pass ? "PASS (all healthy, all live)" : "FAIL"}`);

const day = checkedAt.slice(0, 10);
const dir = join(outRoot, day);
mkdirSync(dir, { recursive: true });
const file = join(dir, `health-${checkedAt.slice(11, 19).replace(/:/g, "")}Z.json`);
writeFileSync(file, `${JSON.stringify({ checked_at: checkedAt, base_url: baseUrl, verdict: pass ? "PASS" : "FAIL", results }, null, 2)}\n`);
console.log(`evidence: ${file}`);

process.exit(pass ? 0 : 1);
