import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const BASELINE_PATH = "Project Note/Phase6/Milestones/M0/evidence/phase6-deprecated-dependency-baseline.json";
const INVENTORY_PATH = "Project Note/Phase6/Milestones/M0/evidence/2026-04-17_m0-deprecated-dependency-inventory.md";
const SELF_TEST_PATH = "apps/product-api/src/__phase6_guard_forbidden_import_test__.ts";

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".gradle",
  ".idea",
  ".next",
  "build",
  "dist",
  "node_modules",
  "tmp"
]);

const PROTECTED_ROOTS = [
  "apps/product-api/src",
  "apps/scheduler/src",
  "apps/dexter-worker/src",
  "apps/data-openbb",
  "apps/news-ingest",
  "apps/mobile/android/app/src/main",
  "packages/contracts/src",
  "infra"
];

const PROTECTED_FILES = [
  ".env.example",
  "docker-compose.yml",
  "package.json",
  "apps/data-openbb/package.json",
  "apps/data-openbb/requirements.txt",
  "apps/dexter-worker/package.json",
  "apps/news-ingest/package.json",
  "apps/news-ingest/requirements.txt",
  "apps/product-api/package.json",
  "apps/scheduler/package.json",
  "packages/fear-greed-engine/package.json"
];

const SUPPORTED_EXTENSIONS = new Set([
  ".env",
  ".gradle",
  ".json",
  ".kts",
  ".kt",
  ".md",
  ".mjs",
  ".py",
  ".ps1",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml"
]);

const DEPRECATED_PATTERNS = [
  {
    id: "openbb-library",
    label: "OpenBB library/provider truth",
    regex: /\b(?:from\s+openbb|import\s+openbb|openbb_platform|openbb\.|OPENBB_API_KEY|OPENBB_TOKEN)\b/gi
  },
  {
    id: "fmp",
    label: "FMP / Financial Modeling Prep",
    regex: /\b(?:FMP|Financial Modeling Prep|financialmodelingprep)\b/gi
  },
  {
    id: "polygon",
    label: "Polygon market-data provider",
    regex: /\bPOLYGON(?:_API_KEY|_RATE_LIMIT|_BASE_URL)?\b|\bpolygon\.io\b/gi
  },
  {
    id: "alpha-vantage",
    label: "Alpha Vantage market-data provider",
    regex: /\bALPHA_VANTAGE(?:_API_KEY|_RATE_LIMIT|_BASE_URL)?\b|\bAlpha Vantage\b/gi
  },
  {
    id: "twelve-data",
    label: "Twelve Data market-data provider",
    regex: /\bTWELVE_DATA(?:_API_KEY|_RATE_LIMIT|_BASE_URL)?\b|\bTwelve Data\b/gi
  },
  {
    id: "yfinance",
    label: "yfinance / Yahoo wrapper",
    regex: /\b(?:yfinance|Yahoo Finance|YFINANCE|YAHOO_FINANCE)\b/gi
  },
  {
    id: "hf-transcript-corpus",
    label: "rights-ambiguous transcript corpus",
    regex: /\b(?:M0_HF_DATASET_ID|sp500_earnings_transcripts|kurry\/sp500_earnings_transcripts)\b/gi
  },
  {
    id: "fear-greed",
    label: "legacy Fear & Greed surface/contract",
    regex: /\b(?:fear[-_ ]?greed|Fear & Greed|FearGreed)\b/gi
  }
];

function toRepoPath(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function fromRepoPath(repoPath) {
  return path.join(ROOT, ...repoPath.split("/"));
}

function isSupportedFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext) || path.basename(filePath).startsWith(".env");
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }
      files.push(...(await collectFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && isSupportedFile(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

async function protectedFiles() {
  const files = new Set();

  for (const root of PROTECTED_ROOTS) {
    const fullRoot = fromRepoPath(root);
    try {
      const rootStat = await stat(fullRoot);
      if (rootStat.isDirectory()) {
        for (const file of await collectFiles(fullRoot)) {
          files.add(file);
        }
      }
    } catch {
      // Missing protected roots are tolerated so the guard stays portable across partial checkouts.
    }
  }

  for (const file of PROTECTED_FILES) {
    const fullPath = fromRepoPath(file);
    try {
      const fileStat = await stat(fullPath);
      if (fileStat.isFile() && isSupportedFile(fullPath)) {
        files.add(fullPath);
      }
    } catch {
      // Missing optional files are not findings.
    }
  }

  return [...files].sort((a, b) => toRepoPath(a).localeCompare(toRepoPath(b)));
}

function lineNumberAt(content, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (content.charCodeAt(i) === 10) {
      line += 1;
    }
  }
  return line;
}

function sanitizeLine(line) {
  return line.trim().replace(/\s+/g, " ").slice(0, 220);
}

function findingKey(finding) {
  return `${finding.id}|${finding.file}|${finding.line}|${finding.match}`;
}

async function scanProtectedPaths() {
  const files = await protectedFiles();
  const findings = [];

  for (const filePath of files) {
    const content = await readFile(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    for (const pattern of DEPRECATED_PATTERNS) {
      pattern.regex.lastIndex = 0;
      let match = pattern.regex.exec(content);
      while (match) {
        const line = lineNumberAt(content, match.index);
        findings.push({
          id: pattern.id,
          label: pattern.label,
          file: toRepoPath(filePath),
          line,
          match: match[0],
          text: sanitizeLine(lines[line - 1] ?? "")
        });
        match = pattern.regex.exec(content);
      }
    }
  }

  findings.sort((a, b) => findingKey(a).localeCompare(findingKey(b)));
  return findings;
}

function groupById(findings) {
  const groups = new Map();
  for (const finding of findings) {
    const current = groups.get(finding.id) ?? [];
    current.push(finding);
    groups.set(finding.id, current);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

async function readBaseline() {
  try {
    const parsed = JSON.parse(await readFile(fromRepoPath(BASELINE_PATH), "utf8"));
    return new Set(parsed.findings.map(findingKey));
  } catch {
    return null;
  }
}

async function writeBaseline(findings) {
  const payload = {
    generated_at: new Date().toISOString(),
    purpose: "Phase 6 M0 baseline of known deprecated-provider references in protected paths. New protected-path findings fail the guard.",
    protected_roots: PROTECTED_ROOTS,
    protected_files: PROTECTED_FILES,
    findings
  };

  await mkdir(path.dirname(fromRepoPath(BASELINE_PATH)), { recursive: true });
  await writeFile(fromRepoPath(BASELINE_PATH), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function writeInventory(findings) {
  const grouped = groupById(findings);
  const lines = [
    "# Phase 6 M0 Deprecated Dependency Inventory",
    "",
    "**Date:** 2026-04-17",
    "**Milestone:** Phase 6 M0 - Dependency Audit & Cutover Plan",
    "**Result:** Baseline inventory captured for protected active paths.",
    "",
    "This inventory records deprecated-provider or legacy quote-heavy references that still exist before Phase 6 migration work begins. M0 does not remove all of them; it makes them explicit and adds a guard so new protected-path references cannot sneak in.",
    "",
    "## Guard Scope",
    "",
    "- Protected active paths are scanned and compared against `phase6-deprecated-dependency-baseline.json`.",
    "- Archived Phase1-Phase5 docs and historical evidence are intentionally outside the blocking guard.",
    "- A new protected-path finding fails `pnpm phase6:m0:guard` until it is removed or deliberately added to the M0 baseline with owner review.",
    "",
    "## Summary",
    "",
    `Total protected-path findings: ${findings.length}`,
    ""
  ];

  for (const [id, items] of grouped) {
    lines.push(`### ${id}`);
    lines.push("");
    lines.push(`Count: ${items.length}`);
    lines.push("");
    lines.push("| File | Line | Match | Context |");
    lines.push("|---|---:|---|---|");
    for (const item of items) {
      lines.push(`| \`${item.file}\` | ${item.line} | \`${item.match.replaceAll("|", "\\|")}\` | ${item.text.replaceAll("|", "\\|")} |`);
    }
    lines.push("");
  }

  lines.push("## Secret Cleanup Classification");
  lines.push("");
  lines.push("| Secret/env | Current M0 state | Owner | Expected exit |");
  lines.push("|---|---|---|---|");
  lines.push("| `FMP_API_KEY` | deprecated / inventoried | Platform Architect + Data Platform | Removed from core smoke path by M1/M5 |");
  lines.push("| `POLYGON_API_KEY` | deprecated / inventoried | Platform Architect + Data Platform | Removed from core smoke path by M1/M5 |");
  lines.push("| `ALPHA_VANTAGE_API_KEY` | deprecated / inventoried | Platform Architect + Data Platform | Removed from core smoke path by M1/M5 |");
  lines.push("| `FMP_*_RATE_LIMIT*` | deprecated / inventoried | Platform Architect + Data Platform | Removed or archived when provider path exits |");
  lines.push("| `POLYGON_*_RATE_LIMIT*` | deprecated / inventoried | Platform Architect + Data Platform | Removed or archived when provider path exits |");
  lines.push("| `M0_HF_DATASET_ID` | rights-ambiguous transcript corpus / deprecated | Platform Architect + Product | Replaced by first-party call artifacts and rights-clean transcript policy |");
  lines.push("");
  lines.push("## Rollback Note");
  lines.push("");
  lines.push("Rollback for M0 means removing the CI/package guard command and reverting the generated baseline/inventory files. It does not require data rollback because M0 changes policy and evidence only.");
  lines.push("");

  await writeFile(fromRepoPath(INVENTORY_PATH), `${lines.join("\n")}\n`, "utf8");
}

async function assertGuard() {
  const findings = await scanProtectedPaths();
  const baseline = await readBaseline();
  if (!baseline) {
    console.error(`Phase 6 M0 guard: baseline missing at ${BASELINE_PATH}.`);
    process.exit(1);
  }

  const newFindings = findings.filter((finding) => !baseline.has(findingKey(finding)));
  if (newFindings.length === 0) {
    console.log(`Phase 6 M0 guard: pass (${findings.length} known baseline finding(s), 0 new protected-path finding(s)).`);
    return;
  }

  console.error(`Phase 6 M0 guard: fail (${newFindings.length} new protected-path deprecated dependency finding(s)).`);
  for (const finding of newFindings) {
    console.error(`- [${finding.id}] ${finding.file}:${finding.line} ${finding.match} :: ${finding.text}`);
  }
  process.exit(1);
}

async function runSelfTest() {
  const testFile = fromRepoPath(SELF_TEST_PATH);
  await mkdir(path.dirname(testFile), { recursive: true });
  await writeFile(testFile, 'import yfinance from "yfinance";\nexport const phase6GuardForbiddenImport = yfinance;\n', "utf8");

  try {
    const findings = await scanProtectedPaths();
    const baseline = await readBaseline();
    if (!baseline) {
      throw new Error(`baseline missing at ${BASELINE_PATH}`);
    }
    const newFindings = findings.filter((finding) => !baseline.has(findingKey(finding)));
    const expected = newFindings.some((finding) => finding.file === SELF_TEST_PATH && finding.id === "yfinance");
    if (!expected) {
      console.error("Phase 6 M0 guard self-test: fail (temporary forbidden import was not detected).");
      process.exitCode = 1;
      return;
    }
    console.log("Phase 6 M0 guard self-test: pass (temporary forbidden import detected and removed).");
  } finally {
    await rm(testFile, { force: true });
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const findings = await scanProtectedPaths();

  if (args.has("--write-baseline")) {
    await writeBaseline(findings);
    await writeInventory(findings);
    console.log(`Phase 6 M0 baseline written with ${findings.length} finding(s).`);
    console.log(`Inventory written to ${INVENTORY_PATH}.`);
    return;
  }

  if (args.has("--inventory")) {
    console.log(`Phase 6 M0 inventory: ${findings.length} protected-path finding(s).`);
    for (const [id, items] of groupById(findings)) {
      console.log(`- ${id}: ${items.length}`);
    }
    return;
  }

  if (args.has("--self-test")) {
    await runSelfTest();
    return;
  }

  await assertGuard();
}

main().catch((error) => {
  console.error("Phase 6 M0 dependency guard failed unexpectedly.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

