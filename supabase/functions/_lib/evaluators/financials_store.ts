// Stores for POST /internal/financials/ingest: Postgres (app.financial_snapshots, app.ticker_coverage) and an
// in-memory one for tests. Both apply the same rules:
// - snapshots upsert on (ticker, period, period_type); a new row gets snapshot_id "sec-<ticker>-<period>", an
//   existing row keeps its id (it may come from another provider);
// - coverage: snapshot_count = rows for the ticker, earliest_period = the smallest period, latest_period = the
//   body's latest_period (null keeps the stored one), last_sync_status 'success', backfill_tier 1,
//   transcript_count and the has_* flags unchanged.
import type { Sql } from "../../_shared/db.ts";
import type { FinancialsIngestResult, FinancialSnapshotRow, FinancialsStore } from "./financials.ts";

export function postgresFinancialsStore(sql: Sql): FinancialsStore {
  return {
    async ingestFinancials({ ticker, rows, latestPeriod, nowIso }): Promise<FinancialsIngestResult> {
      return await sql.begin(async (tx) => {
        let upserted = 0;
        if (rows.length > 0) {
          const result = await tx.unsafe(
            `insert into financial_snapshots (snapshot_id, ticker, period, period_type, fiscal_year, fiscal_quarter,
               provider, filing_date, retrieved_at, data, missing_fields, created_at, updated_at)
             select x.snapshot_id, x.ticker, x.period, x.period_type, x.fiscal_year, null, x.provider, x.filing_date,
                    x.retrieved_at::timestamptz, x.data, x.missing_fields, x.retrieved_at::timestamptz,
                    x.retrieved_at::timestamptz
               from jsonb_to_recordset($1::jsonb)
                 as x(snapshot_id text, ticker text, period text, period_type text, fiscal_year integer,
                      provider text, filing_date text, retrieved_at text, data jsonb, missing_fields jsonb)
             on conflict (ticker, period, period_type) do update set
               fiscal_year = excluded.fiscal_year,
               fiscal_quarter = null,
               provider = excluded.provider,
               filing_date = excluded.filing_date,
               retrieved_at = excluded.retrieved_at,
               data = excluded.data,
               missing_fields = excluded.missing_fields,
               updated_at = excluded.updated_at
             returning snapshot_id`,
            [
              JSON.stringify(rows.map((row) => ({
                snapshot_id: row.snapshotId,
                ticker: row.ticker,
                period: row.period,
                period_type: row.periodType,
                fiscal_year: row.fiscalYear,
                provider: row.provider,
                filing_date: row.filingDate ?? null,
                retrieved_at: row.retrievedAt,
                data: row.data,
                missing_fields: row.missingFields,
              }))),
            ],
          );
          upserted = result.length;
        }
        const [stats] = await tx.unsafe(
          `select count(*)::int as snapshot_count, min(period) as earliest_period
             from financial_snapshots where ticker = $1`,
          [ticker],
        );
        const [coverage] = await tx.unsafe(
          `insert into ticker_coverage (ticker, snapshot_count, transcript_count, latest_period, earliest_period,
             last_synced_at, last_sync_status, backfill_tier, created_at, updated_at)
           values ($1, $2, 0, $3, $4, $5::timestamptz, 'success', 1, $5::timestamptz, $5::timestamptz)
           on conflict (ticker) do update set
             snapshot_count = excluded.snapshot_count,
             latest_period = coalesce(excluded.latest_period, ticker_coverage.latest_period),
             earliest_period = excluded.earliest_period,
             last_synced_at = excluded.last_synced_at,
             last_sync_status = 'success',
             backfill_tier = 1,
             updated_at = excluded.updated_at
           returning snapshot_count, latest_period, earliest_period`,
          [ticker, Number(stats?.snapshot_count ?? 0), latestPeriod, stats?.earliest_period ?? null, nowIso],
        );
        return {
          upserted,
          snapshotCount: Number(coverage?.snapshot_count ?? 0),
          latestPeriod: coverage?.latest_period == null ? null : String(coverage.latest_period),
          earliestPeriod: coverage?.earliest_period == null ? null : String(coverage.earliest_period),
        };
      });
    },
  };
}

export interface MemoryCoverageRow {
  ticker: string;
  snapshotCount: number;
  transcriptCount: number;
  latestPeriod: string | null;
  earliestPeriod: string | null;
  lastSyncedAt: string;
  lastSyncStatus: "success" | "partial" | "failed";
  backfillTier: number;
}

export class MemoryFinancialsStore implements FinancialsStore {
  // Key: ticker|period|period_type.
  readonly snapshots = new Map<string, FinancialSnapshotRow>();
  readonly coverage = new Map<string, MemoryCoverageRow>();

  ingestFinancials(
    { ticker, rows, latestPeriod, nowIso }: Parameters<FinancialsStore["ingestFinancials"]>[0],
  ): Promise<FinancialsIngestResult> {
    for (const row of rows) {
      const key = `${row.ticker}|${row.period}|${row.periodType}`;
      const existing = this.snapshots.get(key);
      this.snapshots.set(key, { ...row, snapshotId: existing?.snapshotId ?? row.snapshotId });
    }
    const periods = [...this.snapshots.values()].filter((row) => row.ticker === ticker).map((row) =>
      row.period
    )
      .sort();
    const prior = this.coverage.get(ticker);
    const next: MemoryCoverageRow = {
      ticker,
      snapshotCount: periods.length,
      transcriptCount: prior?.transcriptCount ?? 0,
      latestPeriod: latestPeriod ?? prior?.latestPeriod ?? null,
      earliestPeriod: periods[0] ?? null,
      lastSyncedAt: nowIso,
      lastSyncStatus: "success",
      backfillTier: 1,
    };
    this.coverage.set(ticker, next);
    return Promise.resolve({
      upserted: rows.length,
      snapshotCount: next.snapshotCount,
      latestPeriod: next.latestPeriod,
      earliestPeriod: next.earliestPeriod,
    });
  }
}
