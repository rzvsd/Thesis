import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

const IGNORED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "artifacts",
  "tmp"
]);

const SUPPORTED_EXTENSIONS = new Set([
  ".js",
  ".cjs",
  ".mjs",
  ".ts",
  ".tsx",
  ".py"
]);

const IGNORED_FILE_SUFFIXES = new Set([
  "scripts/security/sast-baseline.mjs"
]);

const IGNORED_PATH_PREFIXES = [
  "Project Note/Archive/"
];

const RULES = [
  {
    id: "js-no-eval",
    description: "Avoid eval() in JavaScript/TypeScript code.",
    extensions: new Set([".js", ".cjs", ".mjs", ".ts", ".tsx"]),
    regex: /\beval\s*\(/g
  },
  {
    id: "js-no-new-function",
    description: "Avoid Function() constructor in JavaScript/TypeScript code.",
    extensions: new Set([".js", ".cjs", ".mjs", ".ts", ".tsx"]),
    regex: /\bnew\s+Function\s*\(/g
  },
  {
    id: "js-no-child-process-exec",
    description: "Avoid child_process exec/execSync in JavaScript/TypeScript code.",
    extensions: new Set([".js", ".cjs", ".mjs", ".ts", ".tsx"]),
    regex: /\bchild_process\.(exec|execSync)\s*\(/g
  },
  {
    id: "python-no-shell-true",
    description: "Avoid subprocess calls with shell=True in Python code.",
    extensions: new Set([".py"]),
    regex: /\bsubprocess\.[A-Za-z_]+\([^)]*shell\s*=\s*True/gs
  },
  {
    id: "python-no-os-system",
    description: "Avoid os.system() in Python code.",
    extensions: new Set([".py"]),
    regex: /\bos\.system\s*\(/g
  }
];

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

    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    const relativePath = relative(fullPath);
    if (IGNORED_FILE_SUFFIXES.has(relativePath)) {
      continue;
    }
    if (IGNORED_PATH_PREFIXES.some((prefix) => relativePath.startsWith(prefix))) {
      continue;
    }

    if (SUPPORTED_EXTENSIONS.has(extension)) {
      files.push(fullPath);
    }
  }

  return files;
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

function relative(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

async function main() {
  const files = await collectFiles(ROOT);
  const findings = [];

  for (const filePath of files) {
    const extension = path.extname(filePath).toLowerCase();
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      continue;
    }

    const content = await readFile(filePath, "utf8");
    for (const rule of RULES) {
      if (!rule.extensions.has(extension)) {
        continue;
      }

      rule.regex.lastIndex = 0;
      let match = rule.regex.exec(content);
      while (match) {
        findings.push({
          ruleId: rule.id,
          description: rule.description,
          file: relative(filePath),
          line: lineNumberAt(content, match.index)
        });
        match = rule.regex.exec(content);
      }
    }
  }

  if (findings.length === 0) {
    console.log("SAST baseline: pass (no high-confidence findings).");
    return;
  }

  console.error(`SAST baseline: fail (${findings.length} finding(s)).`);
  for (const finding of findings) {
    console.error(
      `- [${finding.ruleId}] ${finding.file}:${finding.line} ${finding.description}`
    );
  }
  process.exit(1);
}

main().catch((error) => {
  console.error("SAST baseline execution failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
