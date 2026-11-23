// In-memory fakes for the reports and web tests (H8: Request in, Response out, no database).
import { memoryArtifactReader } from "../../../_lib/reports/artifacts.ts";
import type { ReportRecord } from "../../../_lib/reports/types.ts";
import type { ReportNoteRecord, ReportShareRecord } from "../../../_lib/store/reports.ts";
import type { ReportsDeps } from "./handlers.ts";

export interface FakeState {
  reports: ReportRecord[];
  // userId -> report ids from their completed jobs
  access: Record<string, string[]>;
  artifacts: Record<string, unknown>;
  notes: ReportNoteRecord[];
  shares: ReportShareRecord[];
  tickers: Record<string, { companyName: string; exchange: string }>;
  audits: Array<{ eventType: string; payload: Record<string, unknown>; userId?: string }>;
}

export function emptyState(): FakeState {
  return { reports: [], access: {}, artifacts: {}, notes: [], shares: [], tickers: {}, audits: [] };
}

export function fakeReportsDeps(s: FakeState): ReportsDeps {
  return {
    getReportById: (id) => Promise.resolve(s.reports.find((r) => r.id === id)),
    hasReportAccessForUser: (userId, reportId) =>
      Promise.resolve((s.access[userId] ?? []).includes(reportId)),
    listReportsByUser: (userId) =>
      Promise.resolve(
        s.reports.filter((r) => (s.access[userId] ?? []).includes(r.id))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      ),
    getReportNote: (reportId, userId) =>
      Promise.resolve(s.notes.find((n) => n.reportId === reportId && n.userId === userId)),
    upsertReportNote: (input) => {
      s.notes = s.notes.filter((n) => !(n.reportId === input.reportId && n.userId === input.userId));
      s.notes.push({ ...input });
      return Promise.resolve({ ...input });
    },
    getReportShareToken: ({ userId, reportId }) =>
      Promise.resolve(s.shares.find((x) => x.userId === userId && x.reportId === reportId)?.token),
    createReportShare: (input) => {
      s.shares.push({ ...input });
      return Promise.resolve();
    },
    getReportShareByToken: (token) => Promise.resolve(s.shares.find((x) => x.token === token)),
    readArtifact: memoryArtifactReader(s.artifacts),
    issuer: {
      getSupportedTicker: (symbol) => Promise.resolve(s.tickers[symbol.trim().toUpperCase()]),
      fetchStructuralContext: () => Promise.resolve(undefined),
    },
    audit: (eventType, payload, userId) => {
      s.audits.push({ eventType, payload, userId });
      return Promise.resolve();
    },
    rateLimit: () => Promise.resolve(null),
  };
}

// From apps/product-api/tests/m7-report-features.test.ts.
export function sampleDeepDiveReport(jobId: string, reportId: string): Record<string, unknown> {
  return {
    report_id: reportId,
    job_id: jobId,
    schema_version: "2.0",
    type: "deep_dive",
    ticker: "AAPL",
    generated_at: "2026-03-30T09:30:00.000Z",
    confidence: { score: 0.72, label: "medium", limiting_factors: ["limited_news_coverage"] },
    signal: { value: "positive", reasons: ["Cash flow momentum remains healthy."], evidence: [] },
    valuation: {
      fair_value_mid: 210.0,
      fair_value_low: 178.5,
      fair_value_high: 241.5,
      spot_price: 190.0,
      implied_upside_pct: 10.53,
      assumptions: {
        methodology: "deterministic_dcf",
        projection_years: 5,
        terminal_growth_rate: 0.025,
        wacc: 0.095,
        beta: 1.18,
      },
    },
    sections: [
      {
        section_id: "thesis_statement",
        title: "Thesis Statement",
        body: "AAPL maintains resilient cash generation with moderate upside.",
        status: "complete",
        evidence: [],
      },
    ],
    flags: [],
    data_sources: ["fixture-financials"],
  };
}

// A state where OWNER completed a Deep Dive job for report REPORT_ID.
export const OWNER = "user-owner";
export const OTHER = "user-other";
export const REPORT_ID = "m7-report-001";

export function seededState(): FakeState {
  const s = emptyState();
  const key = `deep_dive/2026-03-30/${REPORT_ID}.json`;
  s.reports.push({
    id: REPORT_ID,
    jobId: "job-1",
    type: "deep_dive",
    ticker: "AAPL",
    schemaVersion: "2.0",
    artifactKey: key,
    createdAt: "2026-03-30T09:31:00.000Z",
    isCurrent: true,
  });
  s.artifacts[key] = sampleDeepDiveReport("job-1", REPORT_ID);
  s.access[OWNER] = [REPORT_ID];
  s.tickers.AAPL = { companyName: "Apple Inc.", exchange: "NASDAQ" };
  return s;
}
