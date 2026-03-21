import { randomUUID } from "node:crypto";

import type {
  ConfidenceBlock,
  EvidenceItem,
  MarketPulseReport,
  ReportSection
} from "../../../packages/contracts/src";

interface ServiceEnvelope<TData> {
  ok?: boolean;
  data?: TData;
  error_flag?: boolean;
  error_message?: string;
  provider?: string;
  retrieved_at?: string;
}

interface CanonicalFinanceData {
  ticker: string;
  provider: string;
  period: string;
  retrieved_at: string;
  data: Record<string, number>;
  missing_fields: string[];
}

interface CanonicalMacroData {
  indicator: string;
  value: number;
  unit: string;
  period: string;
  provider: string;
  retrieved_at: string;
}

interface CanonicalNewsArticle {
  article_id: string;
  source: string;
  url: string;
  title: string;
  published_at: string;
  retrieved_at: string;
  body_text: string;
  tickers_mentioned: string[];
  is_approved_source: boolean;
}

export interface BuildMarketPulseOptions {
  cycleStart: string;
  cycleEnd: string;
  schemaVersion: string;
  tickers: string[];
  dataOpenbbBaseUrl: string;
  newsIngestBaseUrl: string;
}

function section(
  id: string,
  title: string,
  body: string,
  status: ReportSection["status"],
  evidence: EvidenceItem[]
): ReportSection {
  return {
    section_id: id,
    title,
    body,
    status,
    evidence
  };
}

function scoreLabel(score: number): ConfidenceBlock["label"] {
  if (score >= 0.75) {
    return "high";
  }
  if (score >= 0.55) {
    return "medium";
  }
  if (score >= 0.35) {
    return "low";
  }
  return "insufficient_data";
}

function buildConfidence(flags: string[]): ConfidenceBlock {
  let score = 0.8;
  for (const flag of flags) {
    if (flag.startsWith("data_unavailable:")) {
      score -= 0.2;
      continue;
    }
    if (flag.startsWith("data_incomplete:")) {
      score -= 0.08;
    }
  }
  const normalized = Math.max(0.1, Number(score.toFixed(2)));
  return {
    score: normalized,
    label: scoreLabel(normalized),
    limiting_factors:
      flags.length > 0
        ? flags.map((flag) => flag.replaceAll("_", " "))
        : ["No significant limiting factors detected in this cycle."]
  };
}

async function fetchEnvelope<TData>(
  url: string
): Promise<{ ok: true; data: TData } | { ok: false; errorMessage: string }> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return {
        ok: false,
        errorMessage: `HTTP ${response.status}`
      };
    }

    const payload = (await response.json()) as ServiceEnvelope<TData>;
    const isSuccess = payload.ok === true && payload.error_flag !== true;
    if (!isSuccess || payload.data === undefined || payload.data === null) {
      return {
        ok: false,
        errorMessage: payload.error_message?.trim() || "provider returned no data"
      };
    }

    return {
      ok: true,
      data: payload.data
    };
  } catch (error) {
    return {
      ok: false,
      errorMessage: error instanceof Error ? error.message : "network error"
    };
  }
}

function toEvidence(
  sourceType: EvidenceItem["source_type"],
  sourceName: string,
  excerpt: string,
  retrievedAt: string,
  url?: string
): EvidenceItem {
  return {
    evidence_id: randomUUID(),
    source_type: sourceType,
    source_name: sourceName,
    excerpt,
    retrieved_at: retrievedAt,
    url
  };
}

function enumerateUtcDates(startIso: string, endIso: string): string[] {
  const dates: string[] = [];
  const start = new Date(startIso);
  const end = new Date(endIso);

  const cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
  );
  const terminal = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())
  );

  while (cursor.getTime() <= terminal.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function asUtcMillis(value: string): number {
  return Date.parse(value);
}

function uniqueByArticleId(items: CanonicalNewsArticle[]): CanonicalNewsArticle[] {
  const seen = new Set<string>();
  const unique: CanonicalNewsArticle[] = [];
  for (const item of items) {
    if (seen.has(item.article_id)) {
      continue;
    }
    seen.add(item.article_id);
    unique.push(item);
  }
  return unique;
}

function sortedUppercase(values: Iterable<string>): string[] {
  return [...values]
    .map((value) => value.trim().toUpperCase())
    .filter((value) => value.length > 0)
    .sort((left, right) => left.localeCompare(right));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildWatchlistOverlaySection(
  report: MarketPulseReport,
  watchlistTickers: string[]
): ReportSection | undefined {
  const normalizedWatchlist = sortedUppercase(watchlistTickers);
  if (normalizedWatchlist.length === 0) {
    return undefined;
  }

  const briefingText = [
    report.sections.market_moves.body,
    report.sections.macro_releases.body,
    report.sections.rates_fx_commodities.body,
    report.sections.news_summary.body,
    report.sections.uncertainty_flags.body
  ]
    .join(" ")
    .toUpperCase();

  const matches = normalizedWatchlist.filter((ticker) =>
    new RegExp(`\\b${escapeRegex(ticker)}\\b`).test(briefingText)
  );
  if (matches.length === 0) {
    return undefined;
  }

  const now = new Date().toISOString();
  return section(
    "watchlist_overlay",
    "Watchlist Overlay",
    `Watchlist tickers mentioned in this cycle: ${matches.join(", ")}.`,
    "complete",
    [
      toEvidence(
        "article",
        "Market Pulse Aggregation",
        `Exact ticker-symbol match found for: ${matches.join(", ")}`,
        now
      )
    ]
  );
}

export function withWatchlistOverlay(
  report: MarketPulseReport,
  watchlistTickers: string[]
): MarketPulseReport {
  const overlay = buildWatchlistOverlaySection(report, watchlistTickers);
  const sections = overlay
    ? {
        ...report.sections,
        watchlist_overlay: overlay
      }
    : {
        market_moves: report.sections.market_moves,
        macro_releases: report.sections.macro_releases,
        rates_fx_commodities: report.sections.rates_fx_commodities,
        news_summary: report.sections.news_summary,
        uncertainty_flags: report.sections.uncertainty_flags
      };

  return {
    ...report,
    sections
  };
}

export async function buildMarketPulseReport(
  options: BuildMarketPulseOptions
): Promise<MarketPulseReport> {
  const flags: string[] = [];

  const companyResults = await Promise.all(
    options.tickers.map(async (ticker) => {
      const result = await fetchEnvelope<CanonicalFinanceData>(
        `${options.dataOpenbbBaseUrl}/v1/finance/company?ticker=${encodeURIComponent(ticker)}`
      );
      return {
        ticker,
        result
      };
    })
  );

  const successfulCompanyData = companyResults.flatMap((entry) =>
    entry.result.ok ? [entry.result.data] : []
  );
  const failedCompanyTickers = companyResults
    .filter((entry) => !entry.result.ok)
    .map((entry) => entry.ticker);

  let marketMovesStatus: ReportSection["status"] = "complete";
  if (successfulCompanyData.length === 0) {
    marketMovesStatus = "data_unavailable";
    flags.push("data_unavailable:market_moves");
  } else if (failedCompanyTickers.length > 0) {
    marketMovesStatus = "data_incomplete";
    flags.push("data_incomplete:market_moves");
  }

  const marketMovesBody =
    successfulCompanyData.length === 0
      ? "Market move inputs from data-openbb were unavailable for this cycle."
      : [
          `Tracked tickers: ${successfulCompanyData.map((item) => item.ticker).join(", ")}.`,
          ...successfulCompanyData.map((item) => {
            const revenue = item.data.revenue ?? 0;
            const netIncome = item.data.net_income ?? 0;
            return `${item.ticker}: revenue ${revenue.toLocaleString()}, net income ${netIncome.toLocaleString()} (${item.period}).`;
          }),
          failedCompanyTickers.length > 0
            ? `Unavailable tickers this cycle: ${failedCompanyTickers.join(", ")}.`
            : undefined
        ]
          .filter((line): line is string => Boolean(line))
          .join(" ");

  const marketMovesEvidence = successfulCompanyData.map((item) =>
    toEvidence(
      "financial_data",
      `data-openbb:${item.provider}`,
      `${item.ticker} financial snapshot (${item.period})`,
      item.retrieved_at
    )
  );

  const macroEnvelope = await fetchEnvelope<CanonicalMacroData>(
    `${options.dataOpenbbBaseUrl}/v1/finance/macro?scope=daily`
  );

  const macroStatus: ReportSection["status"] = macroEnvelope.ok ? "complete" : "data_unavailable";
  if (!macroEnvelope.ok) {
    flags.push("data_unavailable:macro_releases");
    flags.push("data_unavailable:rates_fx_commodities");
  }

  const macroBody = macroEnvelope.ok
    ? `${macroEnvelope.data.indicator} latest value is ${macroEnvelope.data.value} ${macroEnvelope.data.unit} for period ${macroEnvelope.data.period}.`
    : "Macro release inputs from data-openbb were unavailable for this cycle.";

  const ratesBody = macroEnvelope.ok
    ? `Rates/FX/commodities snapshot anchored by ${macroEnvelope.data.indicator}: ${macroEnvelope.data.value} ${macroEnvelope.data.unit}.`
    : "Rates/FX/commodities inputs were unavailable for this cycle.";

  const macroEvidence = macroEnvelope.ok
    ? [
        toEvidence(
          "macro_data",
          `data-openbb:${macroEnvelope.data.provider}`,
          `${macroEnvelope.data.indicator} (${macroEnvelope.data.period})`,
          macroEnvelope.data.retrieved_at
        )
      ]
    : [];

  const newsDates = enumerateUtcDates(options.cycleStart, options.cycleEnd);
  const newsResponses = await Promise.all(
    newsDates.map((date) =>
      fetchEnvelope<CanonicalNewsArticle[]>(
        `${options.newsIngestBaseUrl}/v1/news?date=${encodeURIComponent(date)}`
      )
    )
  );

  const newsOutage = newsResponses.some((response) => !response.ok);
  let newsArticles: CanonicalNewsArticle[] = [];
  if (!newsOutage) {
    newsArticles = uniqueByArticleId(
      newsResponses.flatMap((response) => (response.ok ? response.data : []))
    );
  }

  const cycleStartMs = asUtcMillis(options.cycleStart);
  const cycleEndMs = asUtcMillis(options.cycleEnd);
  const inWindowNews = newsArticles.filter((article) => {
    const publishedMs = asUtcMillis(article.published_at);
    return publishedMs >= cycleStartMs && publishedMs <= cycleEndMs;
  });

  let newsStatus: ReportSection["status"] = "complete";
  if (newsOutage) {
    newsStatus = "data_unavailable";
    flags.push("data_unavailable:news_summary");
  } else if (inWindowNews.length === 0) {
    newsStatus = "data_incomplete";
    flags.push("data_incomplete:news_summary");
  }

  const newsBody = newsOutage
    ? "Approved-source news retrieval was unavailable for this cycle."
    : inWindowNews.length === 0
      ? "No material news was retrieved from approved sources for this period."
      : inWindowNews
          .slice(0, 5)
          .map((article, index) => `${index + 1}. ${article.title} (${article.source})`)
          .join(" ");

  const newsEvidence = inWindowNews.slice(0, 5).map((article) =>
    toEvidence(
      "article",
      article.source,
      article.title,
      article.retrieved_at,
      article.url
    )
  );

  const uncertaintyStatus: ReportSection["status"] = flags.length > 0 ? "data_incomplete" : "complete";
  const uncertaintyBody =
    flags.length === 0
      ? "No critical uncertainty flags were raised in this cycle."
      : `Uncertainty flags for this cycle: ${flags.join(", ")}.`;

  const generatedAt = new Date().toISOString();
  return {
    report_id: randomUUID(),
    schema_version: options.schemaVersion,
    generated_at: generatedAt,
    cycle_start: options.cycleStart,
    cycle_end: options.cycleEnd,
    sections: {
      market_moves: section(
        "market_moves",
        "Market Moves",
        marketMovesBody,
        marketMovesStatus,
        marketMovesEvidence
      ),
      macro_releases: section(
        "macro_releases",
        "Macro Releases",
        macroBody,
        macroStatus,
        macroEvidence
      ),
      rates_fx_commodities: section(
        "rates_fx_commodities",
        "Rates, FX, and Commodities",
        ratesBody,
        macroStatus,
        macroEvidence
      ),
      news_summary: section(
        "news_summary",
        "News Summary",
        newsBody,
        newsStatus,
        newsEvidence
      ),
      uncertainty_flags: section(
        "uncertainty_flags",
        "Uncertainty Flags",
        uncertaintyBody,
        uncertaintyStatus,
        []
      )
    },
    flags,
    confidence: buildConfidence(flags)
  };
}
