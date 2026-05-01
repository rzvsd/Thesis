import { randomUUID } from "node:crypto";

import type {
  AnalysisReportEvidenceContext,
  AnalysisReportSourceState,
  CanonicalEvent,
  ConfidenceBlock,
  EvidenceItem,
  EvidenceRightsMetadata,
  FirstPartyContextItem,
  MacroStressInput,
  MacroStressOmission,
  MacroStressSnapshot,
  MarketPulseEditorialIssue,
  MarketPulseEditorialItem,
  MarketPulseCatalystItem,
  MarketPulseHeadlineItem,
  MarketPulseMacroNewsConfirmationState,
  MarketPulseMacroNewsItem,
  MarketPulseMacroNewsPack,
  MarketPulseMacroNewsSeverity,
  MarketPulseMacroNewsTopic,
  MarketPulseMarketBoardCard,
  MarketPulseMorningEdition,
  MarketPulsePortfolioRadarRow,
  MarketPulseSectorPulseItem,
  MarketPulseWatchItem,
  MarketTapePack,
  MarketPulseReport,
  ReportSection,
  StructuralContextPack,
  UserResearchNameState,
  UserResearchState
} from "../../../packages/contracts/src";
import { buildMacroStressSnapshot } from "./macro-stress";

interface ServiceEnvelope<TData> {
  ok?: boolean;
  data?: TData;
  error_flag?: boolean;
  error_message?: string;
}

interface OfficialMacroSource {
  source_name?: string;
  source_url?: string;
}

interface OfficialMacroRetrieval {
  source?: OfficialMacroSource;
  retrieved_at?: string;
}

interface OfficialMacroObservation {
  registry_id?: string;
  value?: number;
  unit?: string;
  period?: string;
  category?: string;
  retrieval?: OfficialMacroRetrieval;
  missing_fields?: unknown[];
}

interface OfficialMacroTruthData {
  observations?: OfficialMacroObservation[];
  canonical_events?: CanonicalEvent[];
}

interface OfficialCompanyTruthData {
  ticker?: string;
  canonical_events?: CanonicalEvent[];
}

interface FirstPartyContextData {
  context_items?: FirstPartyContextItem[];
}

export interface BuildMarketPulseOptions {
  cycleStart: string;
  cycleEnd: string;
  schemaVersion: string;
  tickers: string[];
  dataOpenbbBaseUrl: string;
  newsIngestBaseUrl: string;
  previousReport?: MarketPulseReport;
  calendarEvents?: MarketPulseCalendarEvent[];
  calendarFetchState?: "complete" | "data_unavailable";
  calendarUnavailableReason?: string;
  headlineItems?: MarketPulseHeadlineItem[];
  portfolioRadarRows?: MarketPulsePortfolioRadarRow[];
  marketBoardCards?: MarketPulseMarketBoardCard[];
  sectorPulseItems?: MarketPulseSectorPulseItem[];
  macroNewsItems?: MarketPulseMacroNewsItem[];
  macroNewsFetchState?: "complete" | "data_unavailable";
  macroNewsUnavailableReason?: string;
}

export interface MarketPulseCalendarEvent {
  ticker: string;
  event_type: "earnings";
  event_date: string;
  event_time?: "before_market" | "after_market" | "during_market";
  provider?: string;
  retrieved_at?: string;
  reason_text?: string;
}

const firstPartyContextSourceByTicker: Record<string, string> = {
  AAPL: "https://investor.apple.com/investor-relations/",
  MSFT: "https://www.microsoft.com/en-us/investor/default",
  TSLA: "https://ir.tesla.com/"
};

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
  let score = 0.86;
  for (const flag of flags) {
    if (flag.startsWith("data_unavailable:")) {
      score -= 0.19;
      continue;
    }
    if (flag.startsWith("data_incomplete:")) {
      score -= 0.08;
      continue;
    }
    if (flag.startsWith("omission:")) {
      score -= 0.04;
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
  url: string,
  init?: RequestInit
): Promise<{ ok: true; data: TData } | { ok: false; errorMessage: string }> {
  try {
    const response = await fetch(url, init);
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

function summarizeStructuralContext(
  structuralContext: StructuralContextPack | undefined,
  families: string[]
): string | undefined {
  if (!structuralContext) {
    return undefined;
  }

  const observations = structuralContext.observations.filter((entry) => families.includes(entry.family));
  const summaryParts = observations.slice(0, 2).map((entry) => `${entry.label}: ${entry.summary}`);
  const omission = structuralContext.omissions.find((entry) => entry.source_family === "imf");
  if (omission) {
    summaryParts.push(`Coverage note: ${omission.reason_text}`);
  }
  return summaryParts.length > 0 ? summaryParts.join(" ") : undefined;
}

function summarizeMarketTape(pack: MarketTapePack): string {
  const omissionNote = pack.omissions[0]?.reason_text;
  const parts = [pack.summary];
  if (pack.sector_leadership) {
    const leaders = pack.sector_leadership.leaders.slice(0, 3).map((entry) => entry.label).join(", ");
    const laggards = pack.sector_leadership.laggards.slice(0, 3).map((entry) => entry.label).join(", ");
    if (leaders && laggards) {
      parts.push(`Sector leaders: ${leaders}. Sector laggards: ${laggards}.`);
    }
  }
  if (omissionNote) {
    parts.push(`Coverage note: ${omissionNote}`);
  }
  return parts.join(" ");
}

function marketTapeEvidence(pack: MarketTapePack, generatedAt: string): EvidenceItem[] {
  const rows = [
    ...pack.indices,
    ...pack.cross_asset,
    ...(pack.sector_leadership?.leaders ?? []),
    ...(pack.sector_leadership?.laggards ?? [])
  ];
  return rows.slice(0, 10).map((entry) =>
    toEvidence(
      "financial_data",
      entry.retrieval?.source?.source_name ?? "market_tape",
      `${entry.label}: ${entry.daily_change_pct ?? entry.daily_change ?? "n/a"} ${entry.unit ?? ""}`.trim(),
      entry.retrieval?.retrieved_at ?? generatedAt,
      entry.retrieval?.source?.source_url
    )
  );
}

function marketTapeStatus(result: { ok: true; data: MarketTapePack } | { ok: false; errorMessage: string }): ReportSection["status"] {
  if (!result.ok) {
    return "data_unavailable";
  }
  if (result.data.coverage_state === "full") {
    return "complete";
  }
  return "data_incomplete";
}

function marketTapeNoMaterialChange(pack: MarketTapePack | undefined): boolean {
  if (!pack) {
    return false;
  }
  const coreIndices = pack.indices.filter((entry) => entry.family === "core_index");
  if (coreIndices.length === 0) {
    return false;
  }
  return coreIndices.every((entry) => Math.abs(entry.daily_change_pct ?? 0) < 0.35);
}

function sectionFromEditorialItems(
  id: string,
  title: string,
  items: MarketPulseEditorialItem[],
  status: ReportSection["status"]
): ReportSection {
  const body = items.length > 0
    ? items.map((item) => `${item.title}: ${item.body}`).join(" ")
    : "No material update for this issue.";
  return section(
    id,
    title,
    body,
    status,
    items.flatMap((item) => item.evidence).slice(0, 8)
  );
}

function sectionFromWatchItems(
  items: MarketPulseWatchItem[],
  status: ReportSection["status"]
): ReportSection {
  const body = items.length > 0
    ? items.map((item) => `${item.title}: ${item.body}`).join(" ")
    : "No dated watch items were available for the next cycle.";
  return section(
    "what_to_watch",
    "What To Watch",
    body,
    status,
    items.flatMap((item) => item.evidence).slice(0, 8)
  );
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

function displayMovePct(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/a";
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function shortTapeLabel(label: string): string {
  const normalized = label.toLowerCase();
  if (normalized.includes("s&p")) {
    return "S&P 500";
  }
  if (normalized.includes("nasdaq")) {
    return "Nasdaq Composite";
  }
  if (normalized.includes("dow")) {
    return "Dow";
  }
  if (normalized.includes("russell")) {
    return "Russell 2000";
  }
  if (normalized.includes("vix")) {
    return "VIX";
  }
  if (normalized.includes("treasury 10")) {
    return "10Y Treasury";
  }
  if (normalized.includes("treasury 2")) {
    return "2Y Treasury";
  }
  return label;
}

function tapeBreadth(pack: MarketTapePack | undefined): "higher" | "lower" | "mixed" | "thin" {
  const core = pack?.indices.filter((entry) => entry.family === "core_index") ?? [];
  if (core.length < 2) {
    return "thin";
  }
  const up = core.filter((entry) => entry.direction === "up").length;
  const down = core.filter((entry) => entry.direction === "down").length;
  if (up >= 3) {
    return "higher";
  }
  if (down >= 3) {
    return "lower";
  }
  return "mixed";
}

function strongestTapeMove(pack: MarketTapePack | undefined): MarketTapePack["indices"][number] | undefined {
  return [...(pack?.indices ?? [])]
    .filter((entry) => typeof entry.daily_change_pct === "number")
    .sort((left, right) => (right.daily_change_pct ?? 0) - (left.daily_change_pct ?? 0))[0];
}

function weakestTapeMove(pack: MarketTapePack | undefined): MarketTapePack["indices"][number] | undefined {
  return [...(pack?.indices ?? [])]
    .filter((entry) => typeof entry.daily_change_pct === "number")
    .sort((left, right) => (left.daily_change_pct ?? 0) - (right.daily_change_pct ?? 0))[0];
}

function findCrossAssetMove(pack: MarketTapePack | undefined, family: MarketTapePack["cross_asset"][number]["family"]): MarketTapePack["cross_asset"][number] | undefined {
  return pack?.cross_asset.find((entry) => entry.family === family);
}

function formatCalendarTiming(value: MarketPulseCalendarEvent["event_time"]): string {
  switch (value) {
    case "before_market":
      return "before the open";
    case "after_market":
      return "after the close";
    case "during_market":
      return "during the session";
    default:
      return "timing pending";
  }
}

function calendarEvidence(event: MarketPulseCalendarEvent, generatedAt: string): EvidenceItem {
  return toEvidence(
    "financial_data",
    "Earnings calendar",
    `${event.ticker} earnings scheduled for ${event.event_date}.`,
    event.retrieved_at ?? generatedAt
  );
}

function normalizeCalendarEvents(
  events: MarketPulseCalendarEvent[] | undefined,
  tickers: string[],
  cycleEnd: string
): MarketPulseCalendarEvent[] {
  const watched = new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean));
  const start = cycleEnd.slice(0, 10);
  const endDate = new Date(`${start}T12:00:00.000Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 7);
  const end = endDate.toISOString().slice(0, 10);
  return (events ?? [])
    .map((event) => ({
      ...event,
      ticker: event.ticker.trim().toUpperCase()
    }))
    .filter((event) =>
      watched.has(event.ticker) &&
      event.event_type === "earnings" &&
      event.event_date >= start &&
      event.event_date <= end
    )
    .sort((left, right) =>
      left.event_date.localeCompare(right.event_date) || left.ticker.localeCompare(right.ticker)
    );
}

function directionFromChange(value: number | undefined): "up" | "down" | "flat" {
  if (typeof value !== "number" || Math.abs(value) < 0.005) {
    return "flat";
  }
  return value > 0 ? "up" : "down";
}

function uniqueHeadlineItems(items: MarketPulseHeadlineItem[] | undefined): MarketPulseHeadlineItem[] {
  const seen = new Set<string>();
  const unique: MarketPulseHeadlineItem[] = [];
  for (const item of items ?? []) {
    const headline = item.headline.trim();
    const sourceName = item.source_name.trim();
    if (!headline || !sourceName) {
      continue;
    }
    const key = `${sourceName.toLowerCase()}::${headline.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push({
      ...item,
      headline,
      source_name: sourceName,
      evidence: item.evidence.slice(0, 3)
    });
  }
  return unique.slice(0, 6);
}

function classifyMacroNewsTopic(headline: string): MarketPulseMacroNewsTopic {
  const normalized = headline.toLowerCase();
  if (normalized.includes("attack") || normalized.includes("invasion") || normalized.includes("war")) {
    return "war_conflict";
  }
  if (normalized.includes("tariff") || normalized.includes("trade")) {
    return "trade";
  }
  if (normalized.includes("oil") || normalized.includes("energy")) {
    return "energy";
  }
  if (normalized.includes("supply") || normalized.includes("semiconductor")) {
    return "supply_chain";
  }
  if (normalized.includes("fed") || normalized.includes("ecb") || normalized.includes("central bank")) {
    return "central_bank";
  }
  return "geopolitical";
}

function classifyMacroNewsSeverity(headline: string): MarketPulseMacroNewsSeverity {
  const normalized = headline.toLowerCase();
  if (
    normalized.includes("attack") ||
    normalized.includes("invasion") ||
    normalized.includes("missile") ||
    normalized.includes("war") ||
    normalized.includes("emergency")
  ) {
    return "shock";
  }
  if (
    normalized.includes("sanction") ||
    normalized.includes("tariff") ||
    normalized.includes("shutdown") ||
    normalized.includes("crisis") ||
    normalized.includes("taiwan")
  ) {
    return "notable";
  }
  return "normal";
}

function macroNewsAffectedRegions(headline: string): string[] {
  const normalized = headline.toLowerCase();
  const regions: string[] = [];
  if (normalized.includes("taiwan")) {
    regions.push("Taiwan");
  }
  if (normalized.includes("china")) {
    regions.push("China");
  }
  if (normalized.includes("us ") || normalized.includes("u.s.") || normalized.includes("united states")) {
    regions.push("United States");
  }
  if (normalized.includes("europe") || normalized.includes("ecb")) {
    regions.push("Europe");
  }
  return regions.length > 0 ? regions : ["Global"];
}

function macroNewsAffectedAssets(headline: string, topic: MarketPulseMacroNewsTopic): string[] {
  const normalized = headline.toLowerCase();
  const assets = new Set<string>();
  if (topic === "war_conflict" || topic === "geopolitical") {
    assets.add("volatility");
    assets.add("risk appetite");
  }
  if (normalized.includes("taiwan") || normalized.includes("semiconductor") || normalized.includes("chip")) {
    assets.add("semiconductors");
    assets.add("supply chains");
  }
  if (normalized.includes("oil") || normalized.includes("energy")) {
    assets.add("energy");
  }
  if (normalized.includes("fed") || normalized.includes("rates") || normalized.includes("inflation")) {
    assets.add("rates");
  }
  return [...assets].slice(0, 5);
}

function defaultMacroNewsWhyItMatters(
  headline: string,
  severity: MarketPulseMacroNewsSeverity,
  topic: MarketPulseMacroNewsTopic
): string {
  if (severity === "shock") {
    return "A shock-level macro or geopolitical event can change the interpretation of market tape, volatility, rates, supply-chain exposure, and issuer-specific risk.";
  }
  if (topic === "central_bank" || topic === "macro_policy") {
    return "Policy-sensitive news can change the rate and inflation frame that Pulse uses to interpret the day.";
  }
  return `This headline is relevant to the macro backdrop and is treated as context, not a trading instruction: ${headline}`;
}

function normalizeMacroNewsInputs(
  items: MarketPulseMacroNewsItem[] | undefined
): MarketPulseMacroNewsItem[] {
  const seen = new Set<string>();
  const normalized: MarketPulseMacroNewsItem[] = [];
  for (const item of items ?? []) {
    const headline = item.headline.trim();
    const sourceName = item.source_name.trim();
    if (!headline || !sourceName) {
      continue;
    }
    const key = `${sourceName.toLowerCase()}::${headline.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push({
      ...item,
      headline,
      source_name: sourceName,
      corroboration_count: Math.max(1, item.corroboration_count),
      evidence: item.evidence.slice(0, 4)
    });
  }
  return normalized.slice(0, 8);
}

function macroNewsFromHeadlines(
  items: MarketPulseHeadlineItem[] | undefined,
  generatedAt: string
): MarketPulseMacroNewsItem[] {
  const candidates = uniqueHeadlineItems(items).filter((item) => {
    const topic = item.topic ?? "market";
    const headline = item.headline.toLowerCase();
    return (
      topic === "macro" ||
      topic === "policy" ||
      topic === "sector" ||
      headline.includes("china") ||
      headline.includes("taiwan") ||
      headline.includes("attack") ||
      headline.includes("war") ||
      headline.includes("fed") ||
      headline.includes("tariff") ||
      headline.includes("oil") ||
      headline.includes("inflation")
    );
  });

  const shockCandidateCount = candidates.filter((item) => classifyMacroNewsSeverity(item.headline) === "shock").length;

  return candidates.slice(0, 8).map((item) => {
    const topic = classifyMacroNewsTopic(item.headline);
    const severity = classifyMacroNewsSeverity(item.headline);
    const confirmationState: MarketPulseMacroNewsConfirmationState =
      severity === "shock" && shockCandidateCount >= 2 ? "corroborated" : "reported";
    const affectedAssets = macroNewsAffectedAssets(item.headline, topic);
    return {
      headline: item.headline,
      source_name: item.source_name,
      source_url: item.source_url,
      published_at: item.published_at,
      topic,
      severity,
      confirmation_state: confirmationState,
      corroboration_count: severity === "shock" ? Math.max(1, shockCandidateCount) : 1,
      affected_regions: macroNewsAffectedRegions(item.headline),
      affected_assets: affectedAssets.length > 0 ? affectedAssets : ["market context"],
      why_it_matters: defaultMacroNewsWhyItMatters(item.headline, severity, topic),
      evidence: item.evidence.length > 0
        ? item.evidence.slice(0, 4)
        : [
            toEvidence(
              "article",
              item.source_name,
              `Headline only: ${item.headline}`,
              item.published_at ?? generatedAt,
              item.source_url
            )
          ]
    };
  });
}

function macroNewsState(items: MarketPulseMacroNewsItem[]): MarketPulseMacroNewsPack["state"] {
  if (items.some((item) => item.severity === "shock")) {
    return "shock";
  }
  if (items.some((item) => item.severity === "notable")) {
    return "watch";
  }
  return "calm";
}

function buildMacroNewsPack(input: {
  asOf: string;
  generatedAt: string;
  headlineItems: MarketPulseHeadlineItem[] | undefined;
  macroNewsItems: MarketPulseMacroNewsItem[] | undefined;
  macroNewsFetchState: "complete" | "data_unavailable" | undefined;
  macroNewsUnavailableReason: string | undefined;
}): MarketPulseMacroNewsPack {
  const explicitItems = normalizeMacroNewsInputs(input.macroNewsItems);
  const headlineItems = macroNewsFromHeadlines(input.headlineItems, input.generatedAt);
  const items = normalizeMacroNewsInputs([...explicitItems, ...headlineItems]);
  const state = macroNewsState(items);
  const omissions: MarketPulseMacroNewsPack["omissions"] = [];
  const coverageNotes: string[] = [];

  if (input.macroNewsFetchState === "data_unavailable") {
    omissions.push({
      omission_id: "macro-news-source-unavailable",
      family: "macro_news",
      reason_code: "source_unavailable",
      reason_text:
        input.macroNewsUnavailableReason?.trim() ||
        "Approved macro/geopolitical headline inputs were unavailable for this issue.",
      blocking: false
    });
  }
  if (items.length === 0) {
    coverageNotes.push("No approved macro or geopolitical headline inputs were supplied for this issue.");
  }
  if (items.some((item) => item.severity === "shock" && item.confirmation_state === "reported")) {
    coverageNotes.push("Shock-level reported headlines require corroboration or official confirmation before being treated as confirmed facts.");
  }

  const lead =
    state === "shock"
      ? "A shock-level macro or geopolitical headline is present; Pulse treats it as the first risk context and labels confirmation state explicitly."
      : state === "watch"
        ? "Notable macro or geopolitical headlines are present and should be read as context around the tape."
        : "No notable approved macro or geopolitical headline changed the issue lead.";

  return {
    as_of: input.asOf,
    state,
    lead,
    items,
    omissions,
    coverage_notes: coverageNotes
  };
}

function sectionFromMacroNews(pack: MarketPulseMacroNewsPack): ReportSection | undefined {
  if (pack.items.length === 0 && pack.omissions.length === 0) {
    return undefined;
  }
  const body = pack.items.length > 0
    ? pack.items
        .slice(0, 4)
        .map((item) => `${item.confirmation_state}: ${item.headline}. ${item.why_it_matters}`)
        .join(" ")
    : pack.coverage_notes.join(" ");
  const status: ReportSection["status"] =
    pack.omissions.length > 0 && pack.items.length === 0 ? "data_incomplete" : "complete";
  return section(
    "macro_news",
    "Macro News",
    body || pack.lead,
    status,
    pack.items.flatMap((item) => item.evidence).slice(0, 8)
  );
}

function uniquePortfolioRows(rows: MarketPulsePortfolioRadarRow[] | undefined): MarketPulsePortfolioRadarRow[] {
  const seen = new Set<string>();
  const unique: MarketPulsePortfolioRadarRow[] = [];
  for (const row of rows ?? []) {
    const ticker = row.ticker.trim().toUpperCase();
    if (!ticker || seen.has(ticker)) {
      continue;
    }
    seen.add(ticker);
    unique.push({
      ...row,
      ticker,
      direction: row.direction ?? directionFromChange(row.change_pct),
      evidence: row.evidence.slice(0, 3)
    });
  }
  return unique.slice(0, 12);
}

function marketBoardFromTape(
  pack: MarketTapePack | undefined,
  generatedAt: string
): MarketPulseMarketBoardCard[] {
  if (!pack) {
    return [];
  }

  return [...pack.indices, ...pack.cross_asset]
    .filter((entry) => entry.family === "core_index" || entry.family === "volatility")
    .slice(0, 5)
    .map((entry) => ({
      label: shortTapeLabel(entry.label),
      value: entry.value,
      one_day_change: entry.daily_change,
      one_day_change_pct: entry.daily_change_pct,
      direction: entry.direction,
      evidence: [
        toEvidence(
          "financial_data",
          entry.retrieval?.source?.source_name ?? "market_tape",
          `${entry.label}: ${displayMovePct(entry.daily_change_pct)} for ${entry.period}.`,
          entry.retrieval?.retrieved_at ?? generatedAt,
          entry.retrieval?.source?.source_url
        )
      ]
    }));
}

function sectorPulseFromTape(
  pack: MarketTapePack | undefined,
  generatedAt: string
): MarketPulseSectorPulseItem[] {
  const leadership = pack?.sector_leadership;
  if (!leadership) {
    return [];
  }

  return [...leadership.leaders.slice(0, 3), ...leadership.laggards.slice(0, 3)].map((entry) => ({
    label: entry.label,
    change_pct: entry.daily_change_pct,
    direction: entry.direction,
    evidence: [
      toEvidence(
        "financial_data",
        entry.retrieval?.source?.source_name ?? "market_tape",
        `${entry.label}: ${displayMovePct(entry.daily_change_pct)} for ${entry.period}.`,
        entry.retrieval?.retrieved_at ?? generatedAt,
        entry.retrieval?.source?.source_url
      )
    ]
  }));
}

function buildCatalystItems(input: {
  calendarEvents: MarketPulseCalendarEvent[] | undefined;
  tickers: string[];
  cycleEnd: string;
  generatedAt: string;
  canonicalEvents: CanonicalEvent[];
}): MarketPulseCatalystItem[] {
  const calendarItems = normalizeCalendarEvents(input.calendarEvents, input.tickers, input.cycleEnd)
    .slice(0, 5)
    .map((event): MarketPulseCatalystItem => ({
      time_label: formatCalendarTiming(event.event_time),
      title: `${event.ticker} earnings`,
      category: "earnings",
      impact: "medium",
      evidence: [calendarEvidence(event, input.generatedAt)]
    }));

  const macroItems = input.canonicalEvents
    .filter((event) => event.family === "macro_release_published")
    .slice(0, Math.max(0, 5 - calendarItems.length))
    .map((event): MarketPulseCatalystItem => ({
      time_label: event.occurred_at.slice(11, 16),
      title: event.title,
      category: "macro",
      impact: "medium",
      evidence: [toCanonicalEventEvidence(event)]
    }));

  return [...calendarItems, ...macroItems].slice(0, 6);
}

function buildMorningEdition(input: {
  generatedAt: string;
  marketTape: MarketTapePack | undefined;
  flags: string[];
  headlineItems: MarketPulseHeadlineItem[] | undefined;
  portfolioRadarRows: MarketPulsePortfolioRadarRow[] | undefined;
  marketBoardCards: MarketPulseMarketBoardCard[] | undefined;
  sectorPulseItems: MarketPulseSectorPulseItem[] | undefined;
  calendarEvents: MarketPulseCalendarEvent[] | undefined;
  tickers: string[];
  cycleEnd: string;
  canonicalEvents: CanonicalEvent[];
  calendarFetchState: "complete" | "data_unavailable" | undefined;
  calendarUnavailableReason: string | undefined;
}): MarketPulseMorningEdition {
  const marketBoard = (input.marketBoardCards ?? []).length > 0
    ? (input.marketBoardCards ?? []).slice(0, 6)
    : marketBoardFromTape(input.marketTape, input.generatedAt);
  const sectorPulse = (input.sectorPulseItems ?? []).length > 0
    ? (input.sectorPulseItems ?? []).slice(0, 8)
    : sectorPulseFromTape(input.marketTape, input.generatedAt);
  const coverageNotes = input.flags
    .filter((flag) => flag.startsWith("data_unavailable:") || flag.startsWith("data_incomplete:"))
    .map(readableCoverageNote);

  if (input.calendarFetchState === "data_unavailable") {
    coverageNotes.push(
      input.calendarUnavailableReason?.trim() ||
        "Calendar visibility was limited for this issue."
    );
  }
  if ((input.headlineItems ?? []).length === 0) {
    coverageNotes.push("Approved headline digest was not supplied for this issue.");
  }
  if ((input.portfolioRadarRows ?? []).length === 0) {
    coverageNotes.push("Portfolio radar was omitted because watchlist price rows were not supplied.");
  }

  return {
    headline_digest: uniqueHeadlineItems(input.headlineItems),
    portfolio_radar: uniquePortfolioRows(input.portfolioRadarRows),
    market_board: marketBoard,
    today_catalysts: buildCatalystItems({
      calendarEvents: input.calendarEvents,
      tickers: input.tickers,
      cycleEnd: input.cycleEnd,
      generatedAt: input.generatedAt,
      canonicalEvents: input.canonicalEvents
    }),
    sector_pulse: sectorPulse,
    coverage_notes: [...new Set(coverageNotes)].slice(0, 8)
  };
}

function sectionFromMarketBoard(cards: MarketPulseMarketBoardCard[]): ReportSection | undefined {
  if (cards.length === 0) {
    return undefined;
  }
  return section(
    "market_board",
    "Market Board",
    cards
      .map((card) => `${card.label}: ${displayMovePct(card.one_day_change_pct)}`)
      .join(" "),
    "complete",
    cards.flatMap((card) => card.evidence).slice(0, 8)
  );
}

function sectionFromPortfolioRadar(rows: MarketPulsePortfolioRadarRow[]): ReportSection | undefined {
  if (rows.length === 0) {
    return undefined;
  }
  return section(
    "portfolio_radar",
    "Portfolio Radar",
    rows
      .map((row) => `${row.ticker}: ${displayMovePct(row.change_pct)}${row.reason ? ` - ${row.reason}` : ""}`)
      .join(" "),
    "complete",
    rows.flatMap((row) => row.evidence).slice(0, 8)
  );
}

function sectionFromCatalysts(items: MarketPulseCatalystItem[]): ReportSection | undefined {
  if (items.length === 0) {
    return undefined;
  }
  return section(
    "today_catalysts",
    "Today's Catalysts",
    items.map((item) => `${item.time_label ? `${item.time_label} - ` : ""}${item.title}`).join(" "),
    "complete",
    items.flatMap((item) => item.evidence).slice(0, 8)
  );
}

function sectionFromHeadlines(items: MarketPulseHeadlineItem[]): ReportSection | undefined {
  if (items.length === 0) {
    return undefined;
  }
  return section(
    "headline_digest",
    "Headlines Worth Knowing",
    items.map((item) => `${item.source_name}: ${item.headline}`).join(" "),
    "complete",
    items.flatMap((item) => item.evidence).slice(0, 8)
  );
}

function sectionFromSectorPulse(items: MarketPulseSectorPulseItem[]): ReportSection | undefined {
  if (items.length === 0) {
    return undefined;
  }
  return section(
    "sector_pulse",
    "Sector Pulse",
    items.map((item) => `${item.label}: ${displayMovePct(item.change_pct)}`).join(" "),
    "complete",
    items.flatMap((item) => item.evidence).slice(0, 8)
  );
}

function readableCoverageNote(flag: string): string {
  const [, sectionName = "coverage"] = flag.split(":");
  const label = sectionName.replaceAll("_", " ");
  if (flag.startsWith("data_unavailable:")) {
    return `${label} was unavailable for this run.`;
  }
  if (flag.startsWith("data_incomplete:")) {
    return `${label} coverage was incomplete for this run.`;
  }
  return flag.replaceAll("_", " ");
}

function buildEditorialIssue(input: {
  reportId: string;
  cycleEnd: string;
  generatedAt: string;
  tickers: string[];
  marketTape: MarketTapePack | undefined;
  previousReport: MarketPulseReport | undefined;
  macroStress: MacroStressSnapshot;
  sections: MarketPulseReport["sections"];
  flags: string[];
  calendarEvents: MarketPulseCalendarEvent[] | undefined;
  calendarFetchState: "complete" | "data_unavailable" | undefined;
  calendarUnavailableReason: string | undefined;
}): MarketPulseEditorialIssue {
  const previous = input.previousReport;
  const currentBreadth = tapeBreadth(input.marketTape);
  const priorBreadth = tapeBreadth(previous?.market_tape);
  const strongest = strongestTapeMove(input.marketTape);
  const weakest = weakestTapeMove(input.marketTape);
  const vix = findCrossAssetMove(input.marketTape, "volatility");
  const tenYear = findCrossAssetMove(input.marketTape, "rates");
  const calendarEvents = normalizeCalendarEvents(input.calendarEvents, input.tickers, input.cycleEnd);
  const tapeEvidence = input.sections.market_tape.evidence.slice(0, 4);
  const macroEvidence = input.sections.official_macro_pressure.evidence.slice(0, 4);
  const companyEvidence = input.sections.canonical_events.evidence.slice(0, 4);
  const coverageNotes = input.flags
    .filter((flag) => flag.startsWith("data_unavailable:") || flag.startsWith("data_incomplete:"))
    .map(readableCoverageNote);

  if (input.calendarFetchState === "data_unavailable") {
    coverageNotes.push(
      input.calendarUnavailableReason?.trim() ||
        "Earnings calendar access was unavailable, so dated issuer watch items are limited."
    );
  }

  const previousVix = findCrossAssetMove(previous?.market_tape, "volatility");
  const vixRegimeCrossed = Boolean(
    vix &&
      previousVix &&
      typeof vix.value === "number" &&
      typeof previousVix.value === "number" &&
      ((previousVix.value < 20 && vix.value >= 20) || (previousVix.value >= 20 && vix.value < 20))
  );
  const currentSectorLeader = input.marketTape?.sector_leadership?.leaders[0]?.instrument_id;
  const priorSectorLeader = previous?.market_tape?.sector_leadership?.leaders[0]?.instrument_id;
  const sectorLeadershipRotated = Boolean(
    previous &&
      currentSectorLeader &&
      priorSectorLeader &&
      currentSectorLeader !== priorSectorLeader
  );
  const tapeBreadthChanged = Boolean(previous && priorBreadth !== currentBreadth);
  const macroRegimeChanged = Boolean(previous && previous.macro_stress.state !== input.macroStress.state);
  const nothingMaterialChanged = Boolean(
    previous &&
      !tapeBreadthChanged &&
      !macroRegimeChanged &&
      !sectorLeadershipRotated &&
      !vixRegimeCrossed &&
      calendarEvents.length === 0
  );

  const baselineBody = !previous
    ? "This is the first editorial Pulse baseline in the available report history."
    : nothingMaterialChanged
      ? "No material change from yesterday's issue."
      : `The reviewed market tape moved from ${priorBreadth} to ${currentBreadth}, while Macro Stress is ${input.macroStress.state}.`;

  const whatChanged: MarketPulseEditorialItem[] = [
    {
      kind: "market_tape",
      title: previous ? "Tape comparison" : "Baseline established",
      body: baselineBody,
      freshness_state: previous
        ? nothingMaterialChanged || !tapeBreadthChanged
          ? "unchanged"
          : "updated"
        : "baseline",
      importance: previous && tapeBreadthChanged ? "high" : "medium",
      evidence: tapeEvidence
    }
  ];

  if (macroRegimeChanged) {
    whatChanged.push({
      kind: "macro",
      title: "Macro stress changed",
      body: `Macro Stress moved from ${previous?.macro_stress.state ?? "unknown"} to ${input.macroStress.state}.`,
      freshness_state: "updated",
      importance: "high",
      evidence: macroEvidence
    });
  }

  if (sectorLeadershipRotated) {
    whatChanged.push({
      kind: "market_tape",
      title: "Sector leadership changed",
      body: "The leading sector basket changed from the prior issue.",
      freshness_state: "updated",
      importance: "medium",
      evidence: tapeEvidence
    });
  }

  const whyItMatters: MarketPulseEditorialItem[] = [
    {
      kind: "market_tape",
      title: "Conviction read",
      body:
        nothingMaterialChanged
          ? "No fresh daily input changed enough to justify a larger read."
          : currentBreadth === "higher"
          ? "A broader positive tape can improve context, but Thesis still requires confirmation from volatility, rates, credit, and company evidence before treating one day as a thesis change."
          : currentBreadth === "lower"
            ? "A weaker tape matters because it can pressure timing and risk appetite even when company-specific evidence has not changed."
            : "A mixed tape matters because it argues for selectivity rather than a sweeping market conclusion.",
      freshness_state: nothingMaterialChanged ? "unchanged" : "updated",
      importance: "high",
      evidence: tapeEvidence
    },
    {
      kind: "macro",
      title: "Macro frame",
      body: `Macro regime: ${input.macroStress.state}. ${macroRegimeChanged ? "Changed from the prior issue." : "Unchanged."}`,
      freshness_state: previous?.macro_stress.state === input.macroStress.state ? "unchanged" : "updated",
      importance: "medium",
      evidence: macroEvidence
    }
  ];

  const watchItems: MarketPulseWatchItem[] = calendarEvents.slice(0, 5).map((event) => ({
    kind: "calendar",
    title: `${event.ticker} earnings`,
    body: `${event.ticker} has an earnings event on ${event.event_date} (${formatCalendarTiming(event.event_time)}). ${event.reason_text ?? "Watch for company-specific evidence that changes the briefing context."}`,
    watch_date: event.event_date,
    freshness_state: "new",
    importance: "medium",
    evidence: [calendarEvidence(event, input.generatedAt)]
  }));

  if (watchItems.length === 0) {
    watchItems.push({
      kind: "market_tape",
      title: nothingMaterialChanged ? "Next issue" : "Tape follow-through",
      body: nothingMaterialChanged
        ? "No material watch item changed today; the next issue should focus on new tape, headlines, or calendar events."
        : strongest
        ? `Watch whether ${shortTapeLabel(strongest.label)} leadership at ${displayMovePct(strongest.daily_change_pct)} is confirmed or faded in the next reviewed cycle.`
        : "Watch whether the next reviewed cycle gives enough market breadth to move beyond a bounded read.",
      freshness_state: nothingMaterialChanged ? "unchanged" : "updated",
      importance: "medium",
      evidence: tapeEvidence
    });
  }

  if (vix && !nothingMaterialChanged) {
    watchItems.push({
      kind: "market_tape",
      title: "Volatility confirmation",
      body: `VIX moved ${displayMovePct(vix.daily_change_pct)}; watch whether volatility confirms or contradicts the equity tape.`,
      freshness_state: "updated",
      importance: "medium",
      evidence: tapeEvidence
    });
  }

  const signalVsNoise: MarketPulseEditorialItem[] = [
    {
      kind: "market_tape",
      title: "Signal",
      body: nothingMaterialChanged
        ? "No new signal emerged."
        : strongest && weakest
        ? `${shortTapeLabel(strongest.label)} led at ${displayMovePct(strongest.daily_change_pct)}, while ${shortTapeLabel(weakest.label)} lagged at ${displayMovePct(weakest.daily_change_pct)}.`
        : "The available tape is useful as context, but it is not broad enough to make a stronger daily claim.",
      freshness_state: nothingMaterialChanged ? "unchanged" : "updated",
      importance: "high",
      evidence: tapeEvidence
    },
    {
      kind: "context",
      title: "Noise",
      body: nothingMaterialChanged
        ? "Unchanged index levels are not a story."
        : tenYear
        ? `One-day market movement does not prove a regime shift; the 10Y Treasury move of ${displayMovePct(tenYear.daily_change_pct)} is treated as context, not a standalone conclusion.`
        : "One-day movement does not prove a regime shift; missing cross-asset fields stay in coverage notes rather than confident prose.",
      freshness_state: "unchanged",
      importance: "medium",
      evidence: macroEvidence
    }
  ];

  const lead =
    nothingMaterialChanged
      ? "No material change from yesterday's issue. Markets, macro pressure, and tracked context did not move enough to justify a larger story."
      : previous
      ? `Good morning. Today's Pulse separates the actual daily change from the slower macro backdrop: the tape is ${currentBreadth}, Macro Stress is ${input.macroStress.state}, and the next watch items are kept evidence-led.`
      : "Good morning. Today's Pulse starts an editorial baseline: the tape is summarized, the macro frame is bounded, and future issues can now say what truly changed.";

  return {
    issue_id: `pulse-editorial-${input.reportId}`,
    headline: nothingMaterialChanged
      ? "QUIET DAY. NO MATERIAL CHANGE."
      : marketEditorialHeadline(currentBreadth, input.macroStress.state),
    dek: nothingMaterialChanged
      ? "No fresh tape, macro, or calendar delta changed the issue."
      : marketEditorialDek(currentBreadth, strongest, vix),
    lead,
    ...(previous ? { prior_cycle_end: previous.cycle_end } : {}),
    freshness_state: previous ? (nothingMaterialChanged ? "unchanged" : "updated") : "baseline",
    in_this_issue: [
      "The Tape",
      "What Changed",
      ...(calendarEvents.length > 0 ? ["Today's Calendar"] : []),
      "Signal vs Noise",
      "The Backdrop"
    ],
    what_changed: whatChanged,
    why_it_matters: whyItMatters,
    what_to_watch: watchItems.slice(0, 6),
    signal_vs_noise: signalVsNoise,
    coverage_notes: [...new Set(coverageNotes)].slice(0, 6),
    evidence: [...tapeEvidence, ...macroEvidence, ...companyEvidence].slice(0, 10)
  };
}

function marketEditorialHeadline(
  breadth: "higher" | "lower" | "mixed" | "thin",
  macroState: MacroStressSnapshot["state"]
): string {
  if (breadth === "higher") {
    return "TAPE FIRMS, BUT CONFIRMATION STILL MATTERS";
  }
  if (breadth === "lower") {
    return "TAPE SOFTENS AS RISK CONTEXT TIGHTENS";
  }
  if (macroState === "elevated") {
    return "SELECTIVE TAPE MEETS ELEVATED MACRO PRESSURE";
  }
  return "MARKET TAPE KEEPS CONVICTION SELECTIVE";
}

function marketEditorialDek(
  breadth: "higher" | "lower" | "mixed" | "thin",
  strongest: MarketTapePack["indices"][number] | undefined,
  vix: MarketTapePack["cross_asset"][number] | undefined
): string {
  const lead = breadth === "thin"
    ? "The available tape is narrow"
    : `The reviewed tape is ${breadth}`;
  const leader = strongest
    ? `${shortTapeLabel(strongest.label)} led at ${displayMovePct(strongest.daily_change_pct)}`
    : "leadership was not fully visible";
  const volatility = vix
    ? `VIX moved ${displayMovePct(vix.daily_change_pct)}`
    : "volatility coverage was limited";
  return `${lead}; ${leader}; ${volatility}.`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asUtcMillis(value: string | undefined): number | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function inCycleWindow(
  value: string | undefined,
  cycleStartMs: number,
  cycleEndMs: number
): boolean {
  const timestamp = asUtcMillis(value);
  if (timestamp === undefined) {
    return false;
  }
  return timestamp >= cycleStartMs && timestamp <= cycleEndMs;
}

function asCanonicalEvents(value: unknown): CanonicalEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry) => {
    if (!isObject(entry)) {
      return false;
    }
    return (
      typeof entry.id === "string" &&
      typeof entry.family === "string" &&
      typeof entry.subject_type === "string" &&
      typeof entry.subject_id === "string" &&
      typeof entry.title === "string" &&
      typeof entry.occurred_at === "string" &&
      typeof entry.retrieved_at === "string"
    );
  }) as CanonicalEvent[];
}

function asFirstPartyContextItems(value: unknown): FirstPartyContextItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry) => {
    if (!isObject(entry)) {
      return false;
    }
    return (
      typeof entry.context_id === "string" &&
      typeof entry.ticker === "string" &&
      typeof entry.title === "string" &&
      typeof entry.summary === "string" &&
      typeof entry.source_url === "string" &&
      typeof entry.source_domain === "string" &&
      typeof entry.retrieved_at === "string" &&
      isObject(entry.rights)
    );
  }) as FirstPartyContextItem[];
}

function uniqueByCanonicalEventId(events: CanonicalEvent[]): CanonicalEvent[] {
  const seen = new Set<string>();
  const unique: CanonicalEvent[] = [];
  for (const event of events) {
    if (seen.has(event.id)) {
      continue;
    }
    seen.add(event.id);
    unique.push(event);
  }
  return unique;
}

function uniqueByContextId(items: FirstPartyContextItem[]): FirstPartyContextItem[] {
  const seen = new Set<string>();
  const unique: FirstPartyContextItem[] = [];
  for (const item of items) {
    if (seen.has(item.context_id)) {
      continue;
    }
    seen.add(item.context_id);
    unique.push(item);
  }
  return unique;
}

function dedupeRights(rights: EvidenceRightsMetadata[]): EvidenceRightsMetadata[] {
  const seen = new Set<string>();
  const deduped: EvidenceRightsMetadata[] = [];
  for (const entry of rights) {
    const key = [
      entry.rights_class,
      entry.display_mode,
      entry.source_rank,
      entry.source_type,
      entry.policy_reason
    ].join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(entry);
  }
  return deduped;
}

function officialRights(generatedAt: string): EvidenceRightsMetadata {
  return {
    rights_class: "official_public",
    display_mode: "full_text_allowed",
    source_rank: "official",
    source_type: "official_macro",
    can_store_full_text: true,
    can_display_excerpt: true,
    can_display_link: true,
    policy_reason: "Official public economic releases and filings.",
    reviewed_at: generatedAt
  };
}

function contextSourceState(
  macroStatus: ReportSection["status"],
  contextStatus: ReportSection["status"],
  contextCount: number
): AnalysisReportSourceState {
  if (macroStatus === "complete" && contextCount > 0 && contextStatus === "complete") {
    return "bounded_context";
  }
  if (macroStatus === "complete" && contextCount === 0) {
    return "official";
  }
  if (contextCount > 0 || contextStatus === "data_incomplete") {
    return "partial";
  }
  return "missing";
}

function toContextOmissions(
  macroStressOmissions: MacroStressOmission[],
  flags: string[]
): AnalysisReportEvidenceContext["omissions"] {
  const omissions = macroStressOmissions.map((omission) => ({
    omission_code: `macro:${omission.registry_id}:${omission.reason_code}`,
    omission_text: omission.reason_text,
    affects_sections: ["macro_stress", "official_macro_pressure"]
  }));

  for (const flag of flags) {
    if (!flag.startsWith("data_")) {
      continue;
    }
    const sectionKey = flag.includes(":") ? flag.split(":")[1] : "uncertainty_flags";
    if (!sectionKey) {
      continue;
    }
    omissions.push({
      omission_code: flag,
      omission_text: flag.replaceAll("_", " "),
      affects_sections: [sectionKey]
    });
  }

  return omissions;
}

function toCanonicalEventEvidence(event: CanonicalEvent): EvidenceItem {
  const sourceName = event.source?.source?.source_name?.trim() || "official_source";
  const sourceUrl = event.source?.source?.source_url;
  const sourceType: EvidenceItem["source_type"] =
    event.family === "filing_posted" ? "filing" : "macro_data";
  return toEvidence(sourceType, sourceName, event.title, event.retrieved_at, sourceUrl);
}

function sectionStatusForMacro(
  macroAvailable: boolean,
  snapshot: MacroStressSnapshot
): ReportSection["status"] {
  if (!macroAvailable) {
    return "data_unavailable";
  }
  if (snapshot.state === "insufficient_data" || snapshot.omissions.length > 0) {
    return "data_incomplete";
  }
  return "complete";
}

function researchStateEvidence(state: UserResearchState, name?: UserResearchNameState): EvidenceItem[] {
  return [
    toEvidence(
      "article",
      "User Research State",
      name
        ? `${name.ticker} research state refreshed for ${state.as_of}.`
        : `User research state refreshed for ${state.as_of}.`,
      state.generated_at
    )
  ];
}

function portfolioRowsFromResearchState(state: UserResearchState): MarketPulsePortfolioRadarRow[] {
  return state.names.slice(0, 12).map((name): MarketPulsePortfolioRadarRow => ({
    ticker: name.ticker,
    company_name: name.company_name,
    direction: "flat",
    reason: name.what_changed,
    evidence: researchStateEvidence(state, name)
  }));
}

function sectionFromResearchNames(
  state: UserResearchState,
  sectionId: "portfolio_radar" | "what_changed" | "why_it_matters" | "what_to_watch"
): ReportSection | undefined {
  if (state.names.length === 0) {
    return undefined;
  }
  const names = state.names.slice(0, 5);
  const bodyBySection = {
    portfolio_radar: names
      .map((name) => `${name.ticker}: ${name.summary}`)
      .join(" "),
    what_changed: names
      .map((name) => `${name.ticker}: ${name.what_changed}`)
      .join(" "),
    why_it_matters: names
      .map((name) => `${name.ticker}: ${name.why_it_matters}`)
      .join(" "),
    what_to_watch: names
      .map((name) => `${name.ticker}: ${name.what_to_watch}`)
      .join(" ")
  } satisfies Record<typeof sectionId, string>;
  const titleBySection = {
    portfolio_radar: "Portfolio Radar",
    what_changed: "What Changed",
    why_it_matters: "Why It Matters",
    what_to_watch: "What To Watch"
  } satisfies Record<typeof sectionId, string>;
  return section(
    sectionId,
    titleBySection[sectionId],
    bodyBySection[sectionId],
    state.omissions.length > 0 ? "data_incomplete" : "complete",
    researchStateEvidence(state)
  );
}

export function withUserResearchState(
  report: MarketPulseReport,
  state?: UserResearchState
): MarketPulseReport {
  if (!state) {
    return report;
  }
  const portfolioRows = portfolioRowsFromResearchState(state);
  const morningEdition = report.morning_edition
    ? {
        ...report.morning_edition,
        portfolio_radar: portfolioRows
      }
    : report.morning_edition;
  const portfolioSection = sectionFromResearchNames(state, "portfolio_radar");
  const whatChangedSection = sectionFromResearchNames(state, "what_changed");
  const whyItMattersSection = sectionFromResearchNames(state, "why_it_matters");
  const whatToWatchSection = sectionFromResearchNames(state, "what_to_watch");
  return {
    ...report,
    user_research_state: state,
    ...(morningEdition ? { morning_edition: morningEdition } : {}),
    sections: {
      ...report.sections,
      ...(portfolioSection ? { portfolio_radar: portfolioSection } : {}),
      ...(whatChangedSection ? { what_changed: whatChangedSection } : {}),
      ...(whyItMattersSection ? { why_it_matters: whyItMattersSection } : {}),
      ...(whatToWatchSection ? { what_to_watch: whatToWatchSection } : {})
    }
  };
}

export async function buildMarketPulseReport(
  options: BuildMarketPulseOptions
): Promise<MarketPulseReport> {
  const flags: string[] = [];
  const addFlag = (value: string): void => {
    if (!flags.includes(value)) {
      flags.push(value);
    }
  };

  const cycleStartMs = Date.parse(options.cycleStart);
  const cycleEndMs = Date.parse(options.cycleEnd);
  const generatedAt = new Date().toISOString();
  const asOf = options.cycleEnd.slice(0, 10);
  if (options.calendarFetchState === "data_unavailable") {
    addFlag("data_incomplete:what_to_watch");
  }

  const marketTapeResult = await fetchEnvelope<MarketTapePack>(
    `${options.dataOpenbbBaseUrl}/v1/market/tape?scope=daily&as_of=${encodeURIComponent(asOf)}`
  );
  const macroResult = await fetchEnvelope<OfficialMacroTruthData>(
    `${options.dataOpenbbBaseUrl}/v1/official/macro?scope=daily&as_of=${encodeURIComponent(asOf)}`
  );
  const structuralContextResult = await fetchEnvelope<StructuralContextPack>(
    `${options.dataOpenbbBaseUrl}/v1/official/structural?country=US&subject_type=market_pulse&as_of=${encodeURIComponent(asOf)}`
  );
  const structuralContext = structuralContextResult.ok ? structuralContextResult.data : undefined;
  const marketTape = marketTapeResult.ok ? marketTapeResult.data : undefined;
  const macroObservations = macroResult.ok ? macroResult.data.observations ?? [] : [];
  const macroCanonicalEvents = macroResult.ok
    ? asCanonicalEvents(macroResult.data.canonical_events)
    : [];

  const tapeSectionStatus = marketTapeStatus(marketTapeResult);
  if (tapeSectionStatus === "data_unavailable") {
    addFlag("data_unavailable:market_tape");
  } else if (tapeSectionStatus === "data_incomplete") {
    addFlag("data_incomplete:market_tape");
  }

  const macroOmissions: MacroStressOmission[] = [];
  if (!macroResult.ok) {
    addFlag("data_unavailable:official_macro_pressure");
    macroOmissions.push({
      registry_id: "OFFICIAL_MACRO",
      reason_code: "source_unavailable",
      reason_text: `Official macro pull failed: ${macroResult.errorMessage}`
    });
  } else if (macroObservations.length === 0) {
    addFlag("data_incomplete:official_macro_pressure");
    macroOmissions.push({
      registry_id: "OFFICIAL_MACRO",
      reason_code: "missing_input",
      reason_text: "Official macro payload returned no observations."
    });
  }

  const companyResults = await Promise.all(
    options.tickers.map(async (ticker) => {
      const result = await fetchEnvelope<OfficialCompanyTruthData>(
        `${options.dataOpenbbBaseUrl}/v1/official/company?ticker=${encodeURIComponent(ticker)}`
      );
      return {
        ticker,
        result
      };
    })
  );

  const successfulCompanyTickers = companyResults
    .filter((entry) => entry.result.ok)
    .map((entry) => entry.ticker);
  const failedCompanyTickers = companyResults
    .filter((entry) => !entry.result.ok)
    .map((entry) => entry.ticker);

  if (successfulCompanyTickers.length === 0) {
    addFlag("data_unavailable:market_moves");
  } else if (failedCompanyTickers.length > 0) {
    addFlag("data_incomplete:market_moves");
  }

  const companyCanonicalEvents = companyResults.flatMap((entry) =>
    entry.result.ok ? asCanonicalEvents(entry.result.data.canonical_events) : []
  );

  const firstPartyTargets = options.tickers
    .map((ticker) => {
      const normalized = ticker.trim().toUpperCase();
      const url = firstPartyContextSourceByTicker[normalized];
      return url
        ? {
            ticker: normalized,
            url
          }
        : undefined;
    })
    .filter(
      (entry): entry is { ticker: string; url: string } =>
        Boolean(entry && entry.ticker && entry.url)
    );
  const unmappedContextTickers = options.tickers
    .map((ticker) => ticker.trim().toUpperCase())
    .filter((ticker) => !firstPartyContextSourceByTicker[ticker]);
  if (unmappedContextTickers.length > 0) {
    addFlag("data_incomplete:bounded_context");
  }

  const firstPartyResults = await Promise.all(
    firstPartyTargets.map(async (target) => {
      const result = await fetchEnvelope<FirstPartyContextData>(
        `${options.newsIngestBaseUrl}/v1/first-party/context`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            ticker: target.ticker,
            url: target.url
          })
        }
      );
      return {
        target,
        result
      };
    })
  );

  const firstPartySuccessCount = firstPartyResults.filter((entry) => entry.result.ok).length;
  const firstPartyFailureCount = firstPartyResults.length - firstPartySuccessCount;
  const firstPartyContextItems = uniqueByContextId(
    firstPartyResults.flatMap((entry) =>
      entry.result.ok ? asFirstPartyContextItems(entry.result.data.context_items) : []
    )
  );

  let boundedContextStatus: ReportSection["status"] = "complete";
  if (firstPartyTargets.length === 0) {
    boundedContextStatus = "data_incomplete";
  } else if (firstPartySuccessCount === 0 && firstPartyFailureCount > 0) {
    boundedContextStatus = "data_unavailable";
    addFlag("data_unavailable:bounded_context");
  } else if (firstPartyFailureCount > 0 || firstPartyContextItems.length === 0) {
    boundedContextStatus = "data_incomplete";
    addFlag("data_incomplete:bounded_context");
  }

  const filteredCanonicalEvents = uniqueByCanonicalEventId([
    ...macroCanonicalEvents,
    ...companyCanonicalEvents
  ])
    .filter((event) => inCycleWindow(event.occurred_at, cycleStartMs, cycleEndMs))
    .sort(
      (left, right) =>
        (asUtcMillis(right.occurred_at) ?? 0) - (asUtcMillis(left.occurred_at) ?? 0)
    );

  let canonicalEventsStatus: ReportSection["status"] = "complete";
  if (!macroResult.ok && successfulCompanyTickers.length === 0) {
    canonicalEventsStatus = "data_unavailable";
    addFlag("data_unavailable:canonical_events");
  } else if (filteredCanonicalEvents.length === 0 || failedCompanyTickers.length > 0) {
    canonicalEventsStatus = "data_incomplete";
    addFlag("data_incomplete:canonical_events");
  }

  const filteredContextItems = firstPartyContextItems
    .filter((item) =>
      inCycleWindow(item.published_at ?? item.retrieved_at, cycleStartMs, cycleEndMs)
    )
    .sort(
      (left, right) =>
        (asUtcMillis(right.published_at ?? right.retrieved_at) ?? 0) -
        (asUtcMillis(left.published_at ?? left.retrieved_at) ?? 0)
    );

  const macroStress = buildMacroStressSnapshot({
    asOf,
    generatedAt,
    observations: macroObservations,
    omissions: macroOmissions,
    noMaterialChangeHint: undefined
  });

  const macroStressStatus = sectionStatusForMacro(macroResult.ok, macroStress);
  if (macroStressStatus === "data_unavailable") {
    addFlag("data_unavailable:macro_stress");
  } else if (macroStressStatus === "data_incomplete") {
    addFlag("data_incomplete:macro_stress");
  }

  const noMaterialChange =
    macroStress.no_material_change &&
    marketTapeNoMaterialChange(marketTape) &&
    filteredCanonicalEvents.length === 0 &&
    filteredContextItems.length === 0;

  const tapeEvidence = marketTape ? marketTapeEvidence(marketTape, generatedAt) : [];
  const marketTapeBody = !marketTapeResult.ok
    ? "Market tape was unavailable for this cycle."
    : summarizeMarketTape(marketTapeResult.data);

  const macroEvidence = macroStress.inputs.slice(0, 8).map((input) =>
    toEvidence(
      "macro_data",
      input.source_name ?? "official_macro",
      input.reason,
      input.retrieved_at ?? generatedAt
    )
  );

  const officialMacroBody = !macroResult.ok
    ? "Official macro pressure is unavailable for this cycle."
    : macroStress.inputs.length === 0
      ? "Official macro pressure returned no usable inputs for this cycle."
      : macroStress.inputs
          .slice(0, 6)
          .map((input) => {
            const value = typeof input.value === "number" ? `${input.value}` : "missing";
            const unit = input.unit?.trim() ? ` ${input.unit}` : "";
            const period = input.period?.trim() ? ` (${input.period})` : "";
            return `${input.label}: ${value}${unit} [${input.pressure}]${period}.`;
          })
          .join(" ");
  const structuralMacroSummary = summarizeStructuralContext(structuralContext, [
    "gdp_level",
    "gdp_per_capita",
    "debt_context",
    "inflation_regime",
    "public_debt"
  ]);

  const canonicalEventsBody =
    canonicalEventsStatus === "data_unavailable"
      ? "Canonical event coverage was unavailable for this cycle."
      : filteredCanonicalEvents.length === 0
        ? "No material canonical events were published in this cycle."
        : filteredCanonicalEvents
            .slice(0, 6)
            .map(
              (event, index) =>
                `${index + 1}. ${event.subject_id} - ${event.title} (${event.family}).`
            )
            .join(" ");

  const canonicalEventsEvidence = filteredCanonicalEvents
    .slice(0, 8)
    .map((event) => toCanonicalEventEvidence(event));

  const boundedContextBody =
    boundedContextStatus === "data_unavailable"
      ? "Bounded first-party context retrieval was unavailable for this cycle."
      : filteredContextItems.length === 0
        ? "No bounded first-party context updates were available for this cycle."
        : filteredContextItems
            .slice(0, 6)
            .map((item, index) => `${index + 1}. ${item.ticker} - ${item.title}.`)
            .join(" ");
  const structuralBoundedSummary = summarizeStructuralContext(structuralContext, [
    "population",
    "infrastructure",
    "education",
    "energy_access",
    "sector_mix"
  ]);

  const boundedContextEvidence = filteredContextItems.slice(0, 8).map((item) =>
    toEvidence(
      "article",
      item.source_domain,
      item.excerpt?.trim() || item.summary,
      item.retrieved_at,
      item.source_url
    )
  );

  const uncertaintyStatus: ReportSection["status"] = flags.length > 0 ? "data_incomplete" : "complete";
  const uncertaintyBody =
    flags.length === 0
      ? "No critical uncertainty flags were raised in this cycle."
      : `Uncertainty flags for this cycle: ${flags.join(", ")}.`;

  const ratesAndEnergyInputs = macroStress.inputs.filter(
    (input) => input.category === "rates" || input.category === "energy"
  );
  const ratesFxBody = !macroResult.ok
    ? "Rates and energy pressure inputs were unavailable for this cycle."
    : ratesAndEnergyInputs.length === 0
      ? "Rates and energy pressure inputs were incomplete for this cycle."
      : ratesAndEnergyInputs
          .slice(0, 4)
          .map((input) => `${input.label}: ${input.reason}`)
          .join(" ");

  const marketMovesStatus: ReportSection["status"] =
    successfulCompanyTickers.length === 0
      ? "data_unavailable"
      : failedCompanyTickers.length > 0
        ? "data_incomplete"
        : "complete";
  const marketMovesBody =
    marketMovesStatus === "data_unavailable"
      ? "Official issuer filing snapshots were unavailable for this cycle."
      : [
          `Issuer filing coverage this cycle: ${successfulCompanyTickers.join(", ")}.`,
          failedCompanyTickers.length > 0
            ? `Unavailable issuer snapshots: ${failedCompanyTickers.join(", ")}.`
            : undefined
        ]
          .filter((line): line is string => Boolean(line))
          .join(" ");
  const marketMovesEvidence = companyCanonicalEvents.slice(0, 6).map((event) =>
    toCanonicalEventEvidence(event)
  );

  const newsSummaryStatus: ReportSection["status"] =
    boundedContextStatus === "data_unavailable"
      ? "data_unavailable"
      : filteredContextItems.length > 0
        ? "complete"
        : "data_incomplete";
  if (newsSummaryStatus === "data_unavailable") {
    addFlag("data_unavailable:news_summary");
  }
  const newsSummaryBody =
    filteredContextItems.length > 0
      ? filteredContextItems
          .slice(0, 5)
          .map((item, index) => `${index + 1}. ${item.title} (${item.source_domain})`)
          .join(" ")
      : "No bounded context headlines were available for this cycle.";

  const rights = dedupeRights([
    officialRights(generatedAt),
    ...filteredContextItems.map((item) => item.rights)
  ]);
  const context: AnalysisReportEvidenceContext = {
    source_state: contextSourceState(macroStressStatus, boundedContextStatus, filteredContextItems.length),
    generated_at: generatedAt,
    rights,
    omissions: toContextOmissions(macroStress.omissions, flags)
  };

  const reportId = randomUUID();
  const pulseMacroStress = {
    ...macroStress,
    no_material_change: noMaterialChange
  };
  const baseSections: MarketPulseReport["sections"] = {
    macro_stress: section(
      "macro_stress",
      "Macro Stress",
      macroStress.summary,
      macroStressStatus,
      macroEvidence
    ),
    market_tape: section(
      "market_tape",
      "Market Tape",
      marketTapeBody,
      tapeSectionStatus,
      tapeEvidence
    ),
    official_macro_pressure: section(
      "official_macro_pressure",
      "Official Macro Pressure",
      [officialMacroBody, structuralMacroSummary].filter((entry): entry is string => Boolean(entry)).join(" "),
      macroStressStatus,
      macroEvidence
    ),
    canonical_events: section(
      "canonical_events",
      "Canonical Events",
      canonicalEventsBody,
      canonicalEventsStatus,
      canonicalEventsEvidence
    ),
    bounded_context: section(
      "bounded_context",
      "Bounded Context",
      [boundedContextBody, structuralBoundedSummary]
        .filter((entry): entry is string => Boolean(entry))
        .join(" "),
      boundedContextStatus,
      boundedContextEvidence
    ),
    uncertainty_flags: section(
      "uncertainty_flags",
      "Uncertainty Flags",
      uncertaintyBody,
      uncertaintyStatus,
      []
    ),
    ...(noMaterialChange
      ? {
          no_material_change: section(
            "no_material_change",
            "No Material Change",
            "No material macro, filing, or bounded-context events were detected in this cycle.",
            "complete",
            []
          )
        }
      : {}),
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
      officialMacroBody,
      macroStressStatus,
      macroEvidence
    ),
    rates_fx_commodities: section(
      "rates_fx_commodities",
      "Rates, FX, and Commodities",
      ratesFxBody,
      macroStressStatus,
      ratesAndEnergyInputs.map((input: MacroStressInput) =>
        toEvidence(
          "macro_data",
          input.source_name ?? "official_macro",
          input.reason,
          input.retrieved_at ?? generatedAt
        )
      )
    ),
    news_summary: section(
      "news_summary",
      "News Summary",
      newsSummaryBody,
      newsSummaryStatus,
      boundedContextEvidence
    )
  };
  const macroNewsPack = buildMacroNewsPack({
    asOf,
    generatedAt,
    headlineItems: options.headlineItems,
    macroNewsItems: options.macroNewsItems,
    macroNewsFetchState: options.macroNewsFetchState,
    macroNewsUnavailableReason: options.macroNewsUnavailableReason
  });
  const editorialIssueBase = buildEditorialIssue({
    reportId,
    cycleEnd: options.cycleEnd,
    generatedAt,
    tickers: options.tickers,
    marketTape,
    previousReport: options.previousReport,
    macroStress: pulseMacroStress,
    sections: baseSections,
    flags,
    calendarEvents: options.calendarEvents,
    calendarFetchState: options.calendarFetchState,
    calendarUnavailableReason: options.calendarUnavailableReason
  });
  const editorialIssue: MarketPulseEditorialIssue =
    macroNewsPack.state === "shock"
      ? {
          ...editorialIssueBase,
          headline: "MACRO SHOCK MOVES TO THE FRONT OF THE ISSUE",
          dek: macroNewsPack.items[0]
            ? `${macroNewsPack.items[0].confirmation_state}: ${macroNewsPack.items[0].headline}`
            : macroNewsPack.lead,
          lead: `${macroNewsPack.lead} ${editorialIssueBase.lead}`,
          in_this_issue: [
            "The Tape",
            "Headlines Worth Knowing",
            ...editorialIssueBase.in_this_issue.filter((entry) => entry !== "The Tape")
          ]
        }
      : macroNewsPack.state === "watch"
        ? {
            ...editorialIssueBase,
            in_this_issue: [
              "The Tape",
              "Headlines Worth Knowing",
              ...editorialIssueBase.in_this_issue.filter((entry) => entry !== "The Tape")
            ]
          }
        : editorialIssueBase;
  const morningEdition = buildMorningEdition({
    generatedAt,
    marketTape,
    flags,
    headlineItems: options.headlineItems,
    portfolioRadarRows: options.portfolioRadarRows,
    marketBoardCards: options.marketBoardCards,
    sectorPulseItems: options.sectorPulseItems,
    calendarEvents: options.calendarEvents,
    tickers: options.tickers,
    cycleEnd: options.cycleEnd,
    canonicalEvents: filteredCanonicalEvents,
    calendarFetchState: options.calendarFetchState,
    calendarUnavailableReason: options.calendarUnavailableReason
  });
  const marketBoardSection = sectionFromMarketBoard(morningEdition.market_board);
  const portfolioRadarSection = sectionFromPortfolioRadar(morningEdition.portfolio_radar);
  const catalystSection = sectionFromCatalysts(morningEdition.today_catalysts);
  const headlineSection = sectionFromHeadlines(morningEdition.headline_digest);
  const sectorPulseSection = sectionFromSectorPulse(morningEdition.sector_pulse);
  const macroNewsSection = sectionFromMacroNews(macroNewsPack);
  const sections: MarketPulseReport["sections"] = {
    ...baseSections,
    ...(macroNewsSection ? { macro_news: macroNewsSection } : {}),
    ...(marketBoardSection ? { market_board: marketBoardSection } : {}),
    ...(portfolioRadarSection ? { portfolio_radar: portfolioRadarSection } : {}),
    ...(catalystSection ? { today_catalysts: catalystSection } : {}),
    ...(headlineSection ? { headline_digest: headlineSection } : {}),
    ...(sectorPulseSection ? { sector_pulse: sectorPulseSection } : {}),
    what_changed: sectionFromEditorialItems(
      "what_changed",
      "What Changed",
      editorialIssue.what_changed,
      "complete"
    ),
    why_it_matters: sectionFromEditorialItems(
      "why_it_matters",
      "Why It Matters",
      editorialIssue.why_it_matters,
      "complete"
    ),
    what_to_watch: sectionFromWatchItems(
      editorialIssue.what_to_watch,
      options.calendarFetchState === "data_unavailable" ? "data_incomplete" : "complete"
    ),
    signal_vs_noise: sectionFromEditorialItems(
      "signal_vs_noise",
      "Signal vs Noise",
      editorialIssue.signal_vs_noise,
      "complete"
    )
  };

  return {
    report_id: reportId,
    schema_version: options.schemaVersion,
    generated_at: generatedAt,
    cycle_start: options.cycleStart,
    cycle_end: options.cycleEnd,
    macro_stress: pulseMacroStress,
    market_tape: marketTape,
    editorial_issue: editorialIssue,
    macro_news: macroNewsPack,
    morning_edition: morningEdition,
    context,
    structural_context: structuralContext,
    sections,
    flags,
    confidence: buildConfidence(flags)
  };
}
