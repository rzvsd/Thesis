import type {
  AnalysisRequest,
  CanonicalFinancialSnapshot,
  CanonicalTranscript,
  HistoricalContextBlock
} from "../../../packages/contracts/src";

import type { DexterConfig } from "./config";
import { logWarn } from "./logging";

interface HistoricalEnvelope<T> {
  data?: T[];
  missing?: boolean;
}

export interface HistoricalContextResult {
  context: HistoricalContextBlock;
  latest?: CanonicalFinancialSnapshot;
  priorQuarter?: CanonicalFinancialSnapshot;
  yearAgo?: CanonicalFinancialSnapshot;
  latestTranscript?: CanonicalTranscript;
  financials: CanonicalFinancialSnapshot[];
  transcripts: CanonicalTranscript[];
}

async function fetchHistoricalEnvelope<T>(
  config: DexterConfig,
  endpoint: string,
  ticker: string
): Promise<HistoricalEnvelope<T> | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_500);
  try {
    const response = await fetch(
      `${config.productApiInternalBaseUrl}${endpoint}?ticker=${encodeURIComponent(ticker)}`,
      {
        method: "GET",
        headers: {
          "x-internal-token": config.internalWorkerToken
        },
        signal: controller.signal
      }
    );
    if (!response.ok) {
      return undefined;
    }

    return (await response.json()) as HistoricalEnvelope<T>;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

function sortQuarterlySnapshots(
  snapshots: CanonicalFinancialSnapshot[]
): CanonicalFinancialSnapshot[] {
  return snapshots
    .filter((snapshot) => snapshot.period_type === "quarterly")
    .sort((left, right) => {
      const yearDiff = right.fiscal_year - left.fiscal_year;
      if (yearDiff !== 0) {
        return yearDiff;
      }
      return (right.fiscal_quarter ?? 0) - (left.fiscal_quarter ?? 0);
    });
}

function pickPriorQuarter(
  latest: CanonicalFinancialSnapshot | undefined,
  snapshots: CanonicalFinancialSnapshot[]
): CanonicalFinancialSnapshot | undefined {
  if (!latest || latest.fiscal_quarter === undefined) {
    return undefined;
  }

  const targetQuarter = latest.fiscal_quarter === 1 ? 4 : latest.fiscal_quarter - 1;
  const targetYear = latest.fiscal_quarter === 1 ? latest.fiscal_year - 1 : latest.fiscal_year;
  return snapshots.find((snapshot) =>
    snapshot.fiscal_year === targetYear && snapshot.fiscal_quarter === targetQuarter);
}

function pickYearAgo(
  latest: CanonicalFinancialSnapshot | undefined,
  snapshots: CanonicalFinancialSnapshot[]
): CanonicalFinancialSnapshot | undefined {
  if (!latest || latest.fiscal_quarter === undefined) {
    return undefined;
  }

  return snapshots.find((snapshot) =>
    snapshot.fiscal_year === latest.fiscal_year - 1 &&
    snapshot.fiscal_quarter === latest.fiscal_quarter);
}

function latestTranscript(transcripts: CanonicalTranscript[]): CanonicalTranscript | undefined {
  return [...transcripts].sort((left, right) => {
    const yearDiff = right.fiscal_year - left.fiscal_year;
    if (yearDiff !== 0) {
      return yearDiff;
    }
    return right.fiscal_quarter - left.fiscal_quarter;
  })[0];
}

export async function loadHistoricalContext(
  request: AnalysisRequest,
  config: DexterConfig
): Promise<HistoricalContextResult> {
  const ticker = request.ticker?.trim().toUpperCase() ?? "";
  if (!ticker) {
    return {
      context: {
        financial_snapshot_count: 0,
        transcript_count: 0,
        transcript_available: false,
        missing_reasons: ["Ticker missing on analysis request."]
      },
      latest: undefined,
      priorQuarter: undefined,
      yearAgo: undefined,
      latestTranscript: undefined,
      financials: [],
      transcripts: []
    };
  }

  const [financialEnvelope, transcriptEnvelope] = await Promise.all([
    fetchHistoricalEnvelope<CanonicalFinancialSnapshot>(
      config,
      "/v1/historical/financials",
      ticker
    ),
    fetchHistoricalEnvelope<CanonicalTranscript>(
      config,
      "/v1/historical/transcripts",
      ticker
    )
  ]);

  const financials = Array.isArray(financialEnvelope?.data)
    ? financialEnvelope.data
    : [];
  const transcripts = Array.isArray(transcriptEnvelope?.data)
    ? transcriptEnvelope.data
    : [];
  const quarterly = sortQuarterlySnapshots(financials);
  const latest = quarterly[0];
  const priorQuarter = pickPriorQuarter(latest, quarterly);
  const yearAgo = pickYearAgo(latest, quarterly);
  const transcript = latestTranscript(transcripts);
  const missingReasons: string[] = [];

  if (financialEnvelope === undefined) {
    missingReasons.push("Historical financial endpoint unavailable.");
  } else if (financialEnvelope.missing || financials.length === 0) {
    missingReasons.push("Historical comparison unavailable.");
  }

  if (transcriptEnvelope === undefined) {
    missingReasons.push("Historical transcript endpoint unavailable.");
  } else if (transcriptEnvelope.missing || transcripts.length === 0) {
    missingReasons.push("Transcript data unavailable.");
  }

  if (priorQuarter === undefined) {
    missingReasons.push("Prior-quarter snapshot missing.");
  }
  if (yearAgo === undefined) {
    missingReasons.push("Year-ago snapshot missing.");
  }

  if (missingReasons.length > 0) {
    logWarn("Historical context degraded", {
      job_id: request.job_id,
      ticker,
      reasons: missingReasons
    });
  }

  return {
    context: {
      latest_period: latest?.period,
      prior_quarter_period: priorQuarter?.period,
      year_ago_period: yearAgo?.period,
      transcript_period: transcript?.period,
      financial_snapshot_count: financials.length,
      transcript_count: transcripts.length,
      transcript_available: transcript !== undefined,
      missing_reasons: missingReasons
    },
    latest,
    priorQuarter,
    yearAgo,
    latestTranscript: transcript,
    financials,
    transcripts
  };
}
