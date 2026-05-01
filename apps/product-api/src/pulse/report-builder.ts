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
  MarketPulseHeadlineItem,
  MarketPulseMacroNewsItem,
  MarketPulseMarketBoardCard,
  MarketPulsePortfolioRadarRow,
  MarketPulseSectorPulseItem,
  MarketPulseWatchItem,
  MarketTapePack,
  MarketPulseReport,
  ReportSection,
  StructuralContextPack,
  UserResearchNameState,
  UserResearchState
} from "../../../../packages/contracts/src";
import { buildMacroStressSnapshot } from "../macro-stress";
import {
  type MarketPulseCalendarEvent,
  section,
  toCanonicalEventEvidence,
  toEvidence
} from "./common";
import { fetchEnvelope } from "./fetchers";
import {
  marketTapeEvidence,
  marketTapeNoMaterialChange,
  marketTapeStatus,
  summarizeMarketTape
} from "./market-tape-section";
import {
  buildMacroNewsPack,
  sectionFromMacroNews
} from "./macro-news";
import {
  buildMorningEdition,
  sectionFromCatalysts,
  sectionFromHeadlines,
  sectionFromMarketBoard,
  sectionFromPortfolioRadar,
  sectionFromSectorPulse
} from "./morning-edition";
import { buildEditorialIssue } from "./editorial-issue";

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

export type { MarketPulseCalendarEvent } from "./common";

const firstPartyContextSourceByTicker: Record<string, string> = {
  AAPL: "https://investor.apple.com/investor-relations/",
  MSFT: "https://www.microsoft.com/en-us/investor/default",
  TSLA: "https://ir.tesla.com/"
};

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

