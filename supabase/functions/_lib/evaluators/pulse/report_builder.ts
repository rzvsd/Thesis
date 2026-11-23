// Market Pulse issue build. Copied from apps/product-api/src/pulse/report-builder.ts (keep tested logic).
// Plumbing change: the old code fetched tape, macro, structural, company and first-party data from the
// data-openbb and news-ingest servers. Those servers are gone, so the daily job fetches the same payloads
// and sends them in the request; options.inputs holds them. A missing or failed input takes the same
// "data_unavailable" path a failed fetch took before.
import type {
  AnalysisReportEvidenceContext,
  MacroStressInput,
  MacroStressOmission,
  MarketPulseEditorialIssue,
  MarketPulseHeadlineItem,
  MarketPulseMacroNewsItem,
  MarketPulseMarketBoardCard,
  MarketPulsePortfolioRadarRow,
  MarketPulseReport,
  MarketPulseSectorPulseItem,
  MarketTapePack,
  ReportSection,
  StructuralContextPack,
} from "./contracts.ts";
import { buildMacroStressSnapshot } from "../../research/macro_stress.ts";
import { type MarketPulseCalendarEvent, section, toCanonicalEventEvidence, toEvidence } from "./common.ts";
import { envelopeFrom, type PulseSourceInputs } from "./inputs.ts";
import {
  marketTapeEvidence,
  marketTapeNoMaterialChange,
  marketTapeStatus,
  summarizeMarketTape,
} from "./market_tape_section.ts";
import { buildMacroNewsPack, sectionFromMacroNews } from "./macro_news.ts";
import {
  buildMorningEdition,
  sectionFromCatalysts,
  sectionFromHeadlines,
  sectionFromMarketBoard,
  sectionFromPortfolioRadar,
  sectionFromSectorPulse,
} from "./morning_edition.ts";
import { buildEditorialIssue } from "./editorial_issue.ts";
import {
  asCanonicalEvents,
  asFirstPartyContextItems,
  asUtcMillis,
  buildConfidence,
  contextSourceState,
  dedupeRights,
  type FirstPartyContextData,
  firstPartyContextSourceByTicker,
  inCycleWindow,
  type OfficialCompanyTruthData,
  type OfficialMacroTruthData,
  officialRights,
  sectionFromEditorialItems,
  sectionFromWatchItems,
  sectionStatusForMacro,
  summarizeStructuralContext,
  toContextOmissions,
  uniqueByCanonicalEventId,
  uniqueByContextId,
} from "./report_helpers.ts";

export interface BuildMarketPulseOptions {
  cycleStart: string;
  cycleEnd: string;
  schemaVersion: string;
  tickers: string[];
  // Payloads the daily job fetched (was: dataOpenbbBaseUrl and newsIngestBaseUrl).
  inputs: PulseSourceInputs;
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

export type { MarketPulseCalendarEvent } from "./common.ts";

export function buildMarketPulseReport(
  options: BuildMarketPulseOptions,
): MarketPulseReport {
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

  // Was: GET data-openbb /v1/market/tape, /v1/official/macro and /v1/official/structural for asOf.
  const marketTapeResult = envelopeFrom<MarketTapePack>(options.inputs.market_tape);
  const macroResult = envelopeFrom<OfficialMacroTruthData>(options.inputs.macro);
  const structuralContextResult = envelopeFrom<StructuralContextPack>(options.inputs.structural);
  const structuralContext = structuralContextResult.ok ? structuralContextResult.data : undefined;
  const marketTape = marketTapeResult.ok ? marketTapeResult.data : undefined;
  const macroObservations = macroResult.ok ? macroResult.data.observations ?? [] : [];
  const macroCanonicalEvents = macroResult.ok ? asCanonicalEvents(macroResult.data.canonical_events) : [];

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
      reason_text: `Official macro pull failed: ${macroResult.errorMessage}`,
    });
  } else if (macroObservations.length === 0) {
    addFlag("data_incomplete:official_macro_pressure");
    macroOmissions.push({
      registry_id: "OFFICIAL_MACRO",
      reason_code: "missing_input",
      reason_text: "Official macro payload returned no observations.",
    });
  }

  // Was: GET data-openbb /v1/official/company?ticker= for each ticker.
  const companyResults = options.tickers.map((ticker) => {
    const result = envelopeFrom<OfficialCompanyTruthData>(options.inputs.companies?.[ticker]);
    return {
      ticker,
      result,
    };
  });

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
          url,
        }
        : undefined;
    })
    .filter(
      (entry): entry is { ticker: string; url: string } => Boolean(entry && entry.ticker && entry.url),
    );
  const unmappedContextTickers = options.tickers
    .map((ticker) => ticker.trim().toUpperCase())
    .filter((ticker) => !firstPartyContextSourceByTicker[ticker]);
  if (unmappedContextTickers.length > 0) {
    addFlag("data_incomplete:bounded_context");
  }

  // Was: POST news-ingest /v1/first-party/context { ticker, url } for each mapped ticker.
  const firstPartyResults = firstPartyTargets.map((target) => {
    const result = envelopeFrom<FirstPartyContextData>(options.inputs.first_party?.[target.ticker]);
    return {
      target,
      result,
    };
  });

  const firstPartySuccessCount = firstPartyResults.filter((entry) => entry.result.ok).length;
  const firstPartyFailureCount = firstPartyResults.length - firstPartySuccessCount;
  const firstPartyContextItems = uniqueByContextId(
    firstPartyResults.flatMap((entry) =>
      entry.result.ok ? asFirstPartyContextItems(entry.result.data.context_items) : []
    ),
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
    ...companyCanonicalEvents,
  ])
    .filter((event) => inCycleWindow(event.occurred_at, cycleStartMs, cycleEndMs))
    .sort(
      (left, right) => (asUtcMillis(right.occurred_at) ?? 0) - (asUtcMillis(left.occurred_at) ?? 0),
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
    .filter((item) => inCycleWindow(item.published_at ?? item.retrieved_at, cycleStartMs, cycleEndMs))
    .sort(
      (left, right) =>
        (asUtcMillis(right.published_at ?? right.retrieved_at) ?? 0) -
        (asUtcMillis(left.published_at ?? left.retrieved_at) ?? 0),
    );

  const macroStress = buildMacroStressSnapshot({
    asOf,
    generatedAt,
    observations: macroObservations,
    omissions: macroOmissions,
    noMaterialChangeHint: undefined,
  });

  const macroStressStatus = sectionStatusForMacro(macroResult.ok, macroStress);
  if (macroStressStatus === "data_unavailable") {
    addFlag("data_unavailable:macro_stress");
  } else if (macroStressStatus === "data_incomplete") {
    addFlag("data_incomplete:macro_stress");
  }

  const noMaterialChange = macroStress.no_material_change &&
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
      input.retrieved_at ?? generatedAt,
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
    "public_debt",
  ]);

  const canonicalEventsBody = canonicalEventsStatus === "data_unavailable"
    ? "Canonical event coverage was unavailable for this cycle."
    : filteredCanonicalEvents.length === 0
    ? "No material canonical events were published in this cycle."
    : filteredCanonicalEvents
      .slice(0, 6)
      .map(
        (event, index) => `${index + 1}. ${event.subject_id} - ${event.title} (${event.family}).`,
      )
      .join(" ");

  const canonicalEventsEvidence = filteredCanonicalEvents
    .slice(0, 8)
    .map((event) => toCanonicalEventEvidence(event));

  const boundedContextBody = boundedContextStatus === "data_unavailable"
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
    "sector_mix",
  ]);

  const boundedContextEvidence = filteredContextItems.slice(0, 8).map((item) =>
    toEvidence(
      "article",
      item.source_domain,
      item.excerpt?.trim() || item.summary,
      item.retrieved_at,
      item.source_url,
    )
  );

  const uncertaintyStatus: ReportSection["status"] = flags.length > 0 ? "data_incomplete" : "complete";
  const uncertaintyBody = flags.length === 0
    ? "No critical uncertainty flags were raised in this cycle."
    : `Uncertainty flags for this cycle: ${flags.join(", ")}.`;

  const ratesAndEnergyInputs = macroStress.inputs.filter(
    (input) => input.category === "rates" || input.category === "energy",
  );
  const ratesFxBody = !macroResult.ok
    ? "Rates and energy pressure inputs were unavailable for this cycle."
    : ratesAndEnergyInputs.length === 0
    ? "Rates and energy pressure inputs were incomplete for this cycle."
    : ratesAndEnergyInputs
      .slice(0, 4)
      .map((input) => `${input.label}: ${input.reason}`)
      .join(" ");

  const marketMovesStatus: ReportSection["status"] = successfulCompanyTickers.length === 0
    ? "data_unavailable"
    : failedCompanyTickers.length > 0
    ? "data_incomplete"
    : "complete";
  const marketMovesBody = marketMovesStatus === "data_unavailable"
    ? "Official issuer filing snapshots were unavailable for this cycle."
    : [
      `Issuer filing coverage this cycle: ${successfulCompanyTickers.join(", ")}.`,
      failedCompanyTickers.length > 0
        ? `Unavailable issuer snapshots: ${failedCompanyTickers.join(", ")}.`
        : undefined,
    ]
      .filter((line): line is string => Boolean(line))
      .join(" ");
  const marketMovesEvidence = companyCanonicalEvents.slice(0, 6).map((event) =>
    toCanonicalEventEvidence(event)
  );

  const newsSummaryStatus: ReportSection["status"] = boundedContextStatus === "data_unavailable"
    ? "data_unavailable"
    : filteredContextItems.length > 0
    ? "complete"
    : "data_incomplete";
  if (newsSummaryStatus === "data_unavailable") {
    addFlag("data_unavailable:news_summary");
  }
  const newsSummaryBody = filteredContextItems.length > 0
    ? filteredContextItems
      .slice(0, 5)
      .map((item, index) => `${index + 1}. ${item.title} (${item.source_domain})`)
      .join(" ")
    : "No bounded context headlines were available for this cycle.";

  const rights = dedupeRights([
    officialRights(generatedAt),
    ...filteredContextItems.map((item) => item.rights),
  ]);
  const context: AnalysisReportEvidenceContext = {
    source_state: contextSourceState(macroStressStatus, boundedContextStatus, filteredContextItems.length),
    generated_at: generatedAt,
    rights,
    omissions: toContextOmissions(macroStress.omissions, flags),
  };

  const reportId = crypto.randomUUID();
  const pulseMacroStress = {
    ...macroStress,
    no_material_change: noMaterialChange,
  };
  const baseSections: MarketPulseReport["sections"] = {
    macro_stress: section(
      "macro_stress",
      "Macro Stress",
      macroStress.summary,
      macroStressStatus,
      macroEvidence,
    ),
    market_tape: section(
      "market_tape",
      "Market Tape",
      marketTapeBody,
      tapeSectionStatus,
      tapeEvidence,
    ),
    official_macro_pressure: section(
      "official_macro_pressure",
      "Official Macro Pressure",
      [officialMacroBody, structuralMacroSummary].filter((entry): entry is string => Boolean(entry)).join(
        " ",
      ),
      macroStressStatus,
      macroEvidence,
    ),
    canonical_events: section(
      "canonical_events",
      "Canonical Events",
      canonicalEventsBody,
      canonicalEventsStatus,
      canonicalEventsEvidence,
    ),
    bounded_context: section(
      "bounded_context",
      "Bounded Context",
      [boundedContextBody, structuralBoundedSummary]
        .filter((entry): entry is string => Boolean(entry))
        .join(" "),
      boundedContextStatus,
      boundedContextEvidence,
    ),
    uncertainty_flags: section(
      "uncertainty_flags",
      "Uncertainty Flags",
      uncertaintyBody,
      uncertaintyStatus,
      [],
    ),
    ...(noMaterialChange
      ? {
        no_material_change: section(
          "no_material_change",
          "No Material Change",
          "No material macro, filing, or bounded-context events were detected in this cycle.",
          "complete",
          [],
        ),
      }
      : {}),
    market_moves: section(
      "market_moves",
      "Market Moves",
      marketMovesBody,
      marketMovesStatus,
      marketMovesEvidence,
    ),
    macro_releases: section(
      "macro_releases",
      "Macro Releases",
      officialMacroBody,
      macroStressStatus,
      macroEvidence,
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
          input.retrieved_at ?? generatedAt,
        )
      ),
    ),
    news_summary: section(
      "news_summary",
      "News Summary",
      newsSummaryBody,
      newsSummaryStatus,
      boundedContextEvidence,
    ),
  };
  const macroNewsPack = buildMacroNewsPack({
    asOf,
    generatedAt,
    headlineItems: options.headlineItems,
    macroNewsItems: options.macroNewsItems,
    macroNewsFetchState: options.macroNewsFetchState,
    macroNewsUnavailableReason: options.macroNewsUnavailableReason,
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
    calendarUnavailableReason: options.calendarUnavailableReason,
  });
  const editorialIssue: MarketPulseEditorialIssue = macroNewsPack.state === "shock"
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
        ...editorialIssueBase.in_this_issue.filter((entry) => entry !== "The Tape"),
      ],
    }
    : macroNewsPack.state === "watch"
    ? {
      ...editorialIssueBase,
      in_this_issue: [
        "The Tape",
        "Headlines Worth Knowing",
        ...editorialIssueBase.in_this_issue.filter((entry) => entry !== "The Tape"),
      ],
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
    calendarUnavailableReason: options.calendarUnavailableReason,
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
      "complete",
    ),
    why_it_matters: sectionFromEditorialItems(
      "why_it_matters",
      "Why It Matters",
      editorialIssue.why_it_matters,
      "complete",
    ),
    what_to_watch: sectionFromWatchItems(
      editorialIssue.what_to_watch,
      options.calendarFetchState === "data_unavailable" ? "data_incomplete" : "complete",
    ),
    signal_vs_noise: sectionFromEditorialItems(
      "signal_vs_noise",
      "Signal vs Noise",
      editorialIssue.signal_vs_noise,
      "complete",
    ),
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
    confidence: buildConfidence(flags),
  };
}
