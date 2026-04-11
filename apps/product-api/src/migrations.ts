import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { Pool } from "pg";

const migrationFilenames = [
  "m4_001_auth_jobs.up.sql",
  "m5_002_ticker_registry.up.sql",
  "m6_003_market_pulse.up.sql",
  "ph2m0_004_financial_snapshots.up.sql",
  "ph2m0_005_transcripts.up.sql",
  "ph2m0_006_ticker_coverage.up.sql",
  "ph2m2_007_report_reuse.up.sql",
  "ph2m3_008_fear_greed_daily.up.sql",
  "ph2m4_009_subscriptions.up.sql",
  "ph2m5_010_calendar_events.up.sql",
  "ph2m5_011_contrarian_anchors.up.sql",
  "ph2m5_012_notification_preferences.up.sql",
  "ph2m7_013_report_notes.up.sql",
  "ph3m2_014_thesis_monitor_snapshots.up.sql",
  "ph3m3_015_user_feedback_queue.up.sql",
  "ph3m4_016_user_devices.up.sql",
  "ph4m2_017_alert_ledger.up.sql",
  "ph4m2_018_notification_preference_quieting.up.sql",
  "ph5m1_019_kill_switch_rules.up.sql",
  "ph5m2_020_freshness_decay.up.sql",
  "ph5m3_021_morning_exception_briefing.up.sql",
  "ph5m4_022_earnings_war_room.up.sql",
  "ph5m5_023_name_relationships.up.sql",
  "ph5m6_024_conviction_intelligence.up.sql",
  "ph5m7_025_scenario_stress.up.sql"
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
