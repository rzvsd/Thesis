import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { Pool } from "pg";

const migrationFilenames = [
  "m4_001_auth_jobs.up.sql",
  "m5_002_ticker_registry.up.sql",
  "m6_003_market_pulse.up.sql",
  "ph2m0_004_financial_snapshots.up.sql",
  "ph2m0_005_transcripts.up.sql",
  "ph2m0_006_ticker_coverage.up.sql"
];

async function readMigrationFile(filename: string): Promise<string> {
  const candidatePaths = [
    resolve(process.cwd(), "infra", "migrations", filename),
    resolve(__dirname, "../../../..", "infra", "migrations", filename),
    resolve(__dirname, "../../../../../../", "infra", "migrations", filename)
  ];

  for (const path of candidatePaths) {
    try {
      return await readFile(path, "utf-8");
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Migration file not found: ${filename}`);
}

export async function runMigrations(pool: Pool): Promise<void> {
  for (const filename of migrationFilenames) {
    const sql = await readMigrationFile(filename);
    await pool.query(sql);
  }
}
