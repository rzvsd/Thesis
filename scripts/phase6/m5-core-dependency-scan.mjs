import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

const TARGET_PATHS = [
  "apps/dexter-worker/src",
  "apps/product-api/src/server.ts",
  "apps/product-api/src/report-validation.ts",
  "packages/contracts/src/analysis-report.ts",
  "packages/contracts/src/scenario-request.ts",
  "apps/mobile/android/app/src/main/java/com/thesis/mobile/model/Models.kt",
  "apps/mobile/android/app/src/main/java/com/thesis/mobile/model/ReportViewMapper.kt",
  "apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/DeepDiveScreen.kt"
];

const IGNORED_DIRECTORIES = new Set([
  "build",
  "dist",
  "node_modules",
  "__pycache__"
]);

const SUPPORTED_EXTENSIONS = new Set([
  ".kt",
  ".mjs",
  ".py",
  ".ts",
  ".tsx"
]);

const DEPRECATED_PATTERNS = [
  {
    id: "openbb-library",
    regex: /\b(?:from\s+openbb|import\s+openbb|openbb_platform|openbb\.|OPENBB_API_KEY|OPENBB_TOKEN)\b/gi
  },
  {
    id: "fmp",
    regex: /\b(?:FMP|Financial Modeling Prep|financialmodelingprep)\b/gi
  },
  {
    id: "polygon",
    regex: /\bPOLYGON(?:_API_KEY|_RATE_LIMIT|_BASE_URL)?\b|\bpolygon\.io\b/gi
  },
  {
    id: "alpha-vantage",
    regex: /\bALPHA_VANTAGE(?:_API_KEY|_RATE_LIMIT|_BASE_URL)?\b|\bAlpha Vantage\b/gi
  },
  {
    id: "twelve-data",
    regex: /\bTWELVE_DATA(?:_API_KEY|_RATE_LIMIT|_BASE_URL)?\b|\bTwelve Data\b/gi
  },
  {
    id: "yfinance",
    regex: /\b(?:yfinance|Yahoo Finance|YFINANCE|YAHOO_FINANCE)\b/gi
  },
  {
    id: "hf-transcript-corpus",
    regex: /\b(?:M0_HF_DATASET_ID|sp500_earnings_transcripts|kurry\/sp500_earnings_transcripts)\b/gi
  }
];

function toRepoPath(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function fromRepoPath(repoPath) {
  return path.join(ROOT, ...repoPath.split("/"));
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

function isSupportedFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

async function collectFiles(entryPath) {
  const fileStat = await stat(entryPath);
  if (fileStat.isFile()) {
    return isSupportedFile(entryPath) ? [entryPath] : [];
  }

  const entries = await readdir(entryPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(entryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && isSupportedFile(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

async function scan() {
  const files = [];
  for (const target of TARGET_PATHS) {
    const resolved = fromRepoPath(target);
    try {
      files.push(...(await collectFiles(resolved)));
    } catch {
      // Missing optional path is tolerated.
    }
  }

  const uniqueFiles = [...new Set(files)].sort((a, b) => toRepoPath(a).localeCompare(toRepoPath(b)));
  const findings = [];

  for (const file of uniqueFiles) {
    const content = await readFile(file, "utf8");
    const lines = content.split(/\r?\n/);

    for (const pattern of DEPRECATED_PATTERNS) {
      pattern.regex.lastIndex = 0;
      let match = pattern.regex.exec(content);
      while (match) {
        const line = lineNumberAt(content, match.index);
        findings.push({
          id: pattern.id,
          file: toRepoPath(file),
          line,
          match: match[0],
          text: sanitizeLine(lines[line - 1] ?? "")
        });
        match = pattern.regex.exec(content);
      }
    }
  }

  findings.sort((left, right) => {
    const fileCompare = left.file.localeCompare(right.file);
    if (fileCompare !== 0) {
      return fileCompare;
    }
    const lineCompare = left.line - right.line;
    if (lineCompare !== 0) {
      return lineCompare;
    }
    return left.id.localeCompare(right.id);
  });

  return findings;
}

async function main() {
  const findings = await scan();
  if (findings.length === 0) {
    console.log("Phase 6 M5 core dependency scan: pass (0 deprecated provider findings).");
    return;
  }

  console.error(`Phase 6 M5 core dependency scan: fail (${findings.length} finding(s)).`);
  for (const finding of findings) {
    console.error(`- [${finding.id}] ${finding.file}:${finding.line} ${finding.match} :: ${finding.text}`);
  }
  process.exit(1);
}

main().catch((error) => {
  console.error("Phase 6 M5 core dependency scan failed unexpectedly.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
