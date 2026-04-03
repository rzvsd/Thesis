import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workerRoot = resolve(scriptDir, "..");
const packPath = resolve(workerRoot, "eval", "m1-quality-pack.json");
const artifactPath = resolve(workerRoot, "eval", "artifacts", "m1-quality-pack-result.json");

process.env.DEXTER_FIXTURE_MODE = "true";

const [{ loadConfig }, { runAnalysisPipeline }] = await Promise.all([
  import("../dist/apps/dexter-worker/src/config.js"),
  import("../dist/apps/dexter-worker/src/pipeline.js")
]);

function hasManagementQuote(report) {
  const whatChanged = (report.sections ?? []).find((section) => section.section_id === "what_changed");
  if (!whatChanged?.body) {
    return false;
  }
  return whatChanged.body.includes("Management quote:");
}

function hasGenericSynthesis(report) {
  const thesis = (report.sections ?? []).find((section) => section.section_id === "thesis_statement")?.body ?? "";
  const normalized = thesis.trim().toLowerCase();
  if (normalized.length < 80) {
    return true;
  }
  return [
    "generic summary",
    "placeholder",
    "lorem ipsum",
    "no specific evidence"
  ].some((token) => normalized.includes(token));
}

function checkValuationHonesty(report) {
  const trust = report.trust_metadata;
  const valuation = report.valuation;
  if (!trust) {
    return false;
  }

  if (trust.valuation_state === "available") {
    return Boolean(
      valuation &&
        typeof valuation.fair_value_mid === "number" &&
        valuation.assumptions &&
        valuation.assumptions.methodology === "deterministic_dcf"
    );
  }

  if (trust.valuation_state === "degraded" || trust.valuation_state === "omitted") {
    return (trust.missing_data_notes ?? []).some((note) =>
      typeof note === "string" && note.toLowerCase().includes("valuation"));
  }

  return false;
}

function checkMissingDataHonesty(report) {
  const trust = report.trust_metadata;
  if (!trust) {
    return false;
  }
  const hasDegradedSections = (report.sections ?? []).some((section) => section.status !== "complete");
  if (!hasDegradedSections) {
    return true;
  }
  return Array.isArray(trust.missing_data_notes) && trust.missing_data_notes.length > 0;
}

function checkContradictionHonesty(report) {
  const trust = report.trust_metadata;
  if (!trust) {
    return false;
  }
  if (trust.contradiction_state === "present") {
    return Array.isArray(trust.contradictions) && trust.contradictions.length > 0;
  }
  if (trust.contradiction_state === "none") {
    return Array.isArray(trust.contradictions);
  }
  return false;
}

function checkQuoteProvenance(report) {
  const trust = report.trust_metadata;
  if (!trust) {
    return false;
  }
  if (!hasManagementQuote(report)) {
    return true;
  }
  const provenance = trust.quote_provenance ?? [];
  return provenance.length > 0 && provenance.every((entry) =>
    typeof entry.quote === "string" &&
    entry.quote.trim().length > 0 &&
    typeof entry.source_name === "string" &&
    entry.source_name.trim().length > 0
  );
}

const packRaw = await readFile(packPath, "utf8");
const pack = JSON.parse(packRaw);
const tickers = Array.isArray(pack.tickers) ? pack.tickers.filter((entry) => typeof entry === "string") : [];
if (tickers.length < 20) {
  throw new Error("M1 evaluation pack must contain at least 20 representative tickers.");
}

const config = loadConfig({
  ...process.env,
  DEXTER_FIXTURE_MODE: "true"
});

const cases = [];
for (const ticker of tickers) {
  const request = {
    request_id: `m1-eval-${ticker.toLowerCase()}`,
    type: "deep_dive",
    ticker,
    job_id: `m1-eval-job-${ticker.toLowerCase()}`,
    requested_at: "2026-04-01T09:00:00.000Z",
    options: {}
  };
  const report = await runAnalysisPipeline(request, config);
  const checks = {
    generic_synthesis: !hasGenericSynthesis(report),
    quote_provenance: checkQuoteProvenance(report),
    valuation_honesty: checkValuationHonesty(report),
    missing_data_honesty: checkMissingDataHonesty(report),
    contradiction_honesty: checkContradictionHonesty(report)
  };
  const passed = Object.values(checks).every(Boolean);
  cases.push({
    ticker,
    report_id: report.report_id,
    trust_metadata: report.trust_metadata,
    checks,
    passed
  });
}

const totals = {
  total_cases: cases.length,
  passed_cases: cases.filter((entry) => entry.passed).length,
  failed_cases: cases.filter((entry) => !entry.passed).length
};

const blockingCheckSummary = {
  generic_synthesis: cases.every((entry) => entry.checks.generic_synthesis),
  quote_provenance: cases.every((entry) => entry.checks.quote_provenance),
  valuation_honesty: cases.every((entry) => entry.checks.valuation_honesty),
  missing_data_honesty: cases.every((entry) => entry.checks.missing_data_honesty),
  contradiction_honesty: cases.every((entry) => entry.checks.contradiction_honesty)
};

const result = {
  generated_at: new Date().toISOString(),
  pack_version: pack.version ?? "unknown",
  thresholds: {
    minimum_cases: 20,
    require_all_blocking_checks: true
  },
  totals,
  blocking_checks: blockingCheckSummary,
  passed: cases.length >= 20 && Object.values(blockingCheckSummary).every(Boolean),
  cases
};

await mkdir(dirname(artifactPath), { recursive: true });
await writeFile(artifactPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

if (!result.passed) {
  console.error(`M1 evaluation pack failed. See artifact: ${artifactPath}`);
  process.exit(1);
}

console.log(`M1 evaluation pack passed. Artifact written to: ${artifactPath}`);

