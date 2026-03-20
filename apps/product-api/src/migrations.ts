import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { Pool } from "pg";

const m4MigrationPath = resolve(
  process.cwd(),
  "infra",
  "migrations",
  "m4_001_auth_jobs.up.sql"
);

export async function runM4Migrations(pool: Pool): Promise<void> {
  const sql = await readFile(m4MigrationPath, "utf-8");
  await pool.query(sql);
}
