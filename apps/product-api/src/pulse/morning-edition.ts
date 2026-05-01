import type {
  CanonicalEvent,
  MarketPulseCatalystItem,
  MarketPulseHeadlineItem,
  MarketPulseMarketBoardCard,
  MarketPulseMorningEdition,
  MarketPulsePortfolioRadarRow,
  MarketPulseSectorPulseItem,
  MarketTapePack,
  ReportSection
} from "../../../../packages/contracts/src";
import {
  calendarEvidence,
  directionFromChange,
  displayMovePct,
  formatCalendarTiming,
  type MarketPulseCalendarEvent,
  normalizeCalendarEvents,
  readableCoverageNote,
  section,
  shortTapeLabel,
  toCanonicalEventEvidence,
  toEvidence
} from "./common";
import { uniqueHeadlineItems } from "./macro-news";
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

export function buildMorningEdition(input: {
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

export function sectionFromMarketBoard(cards: MarketPulseMarketBoardCard[]): ReportSection | undefined {
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

export function sectionFromPortfolioRadar(rows: MarketPulsePortfolioRadarRow[]): ReportSection | undefined {
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

export function sectionFromCatalysts(items: MarketPulseCatalystItem[]): ReportSection | undefined {
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

export function sectionFromHeadlines(items: MarketPulseHeadlineItem[]): ReportSection | undefined {
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

export function sectionFromSectorPulse(items: MarketPulseSectorPulseItem[]): ReportSection | undefined {
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


