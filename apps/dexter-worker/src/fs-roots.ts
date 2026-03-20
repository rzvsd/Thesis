import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

function findRepoRoot(start: string): string | undefined {
  let current = resolve(start);

  while (true) {
    const promptFile = resolve(current, "data", "golden", "dexter-worker", "prompts.json");
    const appPackage = resolve(current, "apps", "dexter-worker", "package.json");

    if (existsSync(promptFile) && existsSync(appPackage)) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return undefined;
    }

    current = parent;
  }
}

function resolveRepoRoot(): string {
  return (
    findRepoRoot(process.cwd()) ??
    findRepoRoot(__dirname) ??
    resolve(__dirname, "..", "..", "..")
  );
}

export const repoRoot = resolveRepoRoot();
export const appRoot = resolve(repoRoot, "apps", "dexter-worker");
export const goldenRoot = resolve(repoRoot, "data", "golden", "dexter-worker");
