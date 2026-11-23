// Test fixtures for the Market Pulse PDF. Shapes follow packages/contracts/src/market-pulse-report.ts and
// apps/product-api/tests/market-pulse-render.test.ts.
import type { Loose, MarketPulseReport, UserResearchState } from "../../reports/types.ts";

const retrievedAt = "2026-04-23T11:39:14.198Z";

function fredSource(id: string, name: string): Loose {
  return {
    source: {
      source_id: `FRED_${id}`,
      source_family: "fred",
      source_name: name,
      source_url: `https://fred.stlouisfed.org/series/${id}`,
      agency: "Federal Reserve Bank of St. Louis",
      agency_series_id: id,
    },
    retrieved_at: retrievedAt,
    retrieval_status: "fresh",
    source_period: "2026-04-23",
  };
}

function move(
  id: string,
  label: string,
  family: string,
  value: number,
  change: number,
  changePct: number,
  unit = "index",
): Loose {
  return {
    instrument_id: id,
    label,
    family,
    period: "2026-04-23",
    value,
    previous_value: value - change,
    daily_change: change,
    daily_change_pct: changePct,
    unit,
    direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
    retrieval: fredSource(id, `FRED ${label}`),
    missing_fields: [],
  };
}

function section(id: string, title: string, body: string): Loose {
  return {
    section_id: id,
    title,
    body,
    status: "complete",
    evidence: [{
      evidence_id: `ev-${id}`,
      source_type: "official_macro",
      source_name: "FRED",
      excerpt: body.slice(0, 80),
      retrieved_at: retrievedAt,
    }],
  };
}

function sectors(): Loose {
  return {
    basket_id: "spdr-sectors",
    leaders: [
      move("XLK", "Technology Select Sector SPDR ETF", "sector", 212.4, 4.1, 1.97),
      move("XLC", "Communication Services Select Sector SPDR ETF", "sector", 84.2, 1.2, 1.45),
      move("XLY", "Consumer Discretionary Select Sector SPDR ETF", "sector", 181.3, 2.0, 1.12),
    ],
    laggards: [
      move("XLU", "Utilities Select Sector SPDR ETF", "sector", 68.1, -0.6, -0.87),
      move("XLE", "Energy Select Sector SPDR ETF", "sector", 91.7, -1.4, -1.51),
    ],
    spread_pct: 3.48,
    notable: true,
  };
}

// A normal/event-mode issue with a full tape, names, calendar and headlines.
export function createPulseReport(): MarketPulseReport {
  const indices = [
    move("SP500", "S&P 500", "core_index", 5375.86, 88.1, 1.67),
    move("NASDAQCOM", "Nasdaq Composite", "core_index", 16820.4, 312.6, 1.89),
    move("DJIA", "Dow Jones Industrial Average", "core_index", 39120.5, 402.3, 1.04),
    move("RU2000", "Russell 2000", "core_index", 2051.2, 18.4, 0.91),
  ];
  const crossAsset = [
    move("VIXCLS", "VIX", "volatility", 17.43, -0.78, -4.28),
    move("DGS10", "10-Year Treasury yield", "rates", 4.41, -0.09, -2.0, "percent"),
    move("DGS2", "2-Year Treasury yield", "rates", 4.83, -0.04, -0.82, "percent"),
    move("DCOILWTICO", "WTI crude oil", "commodity", 81.2, 1.4, 1.75, "usd"),
    move("BAMLH0A0HYM2", "High yield OAS", "credit", 3.12, 0.02, 0.64, "percent"),
  ];
  return {
    report_id: "pulse-report-1",
    schema_version: "1.0.0",
    generated_at: retrievedAt,
    cycle_start: "2026-04-22T11:39:14.107Z",
    cycle_end: "2026-04-23T11:39:14.107Z",
    macro_stress: {
      snapshot_id: "macro-1",
      as_of: "2026-04-23",
      generated_at: retrievedAt,
      state: "elevated",
      summary: "Macro pressure is elevated: Treasury 2Y (high), CPI-U All Items (high).",
      no_material_change: false,
      inputs: [],
      omissions: [],
    },
    market_tape: {
      as_of: "2026-04-23",
      coverage_state: "full",
      summary: "US risk assets were broadly higher on the day.",
      indices,
      cross_asset: crossAsset,
      sector_leadership: sectors(),
      retrievals: [fredSource("SP500", "FRED S&P 500"), fredSource("VIXCLS", "FRED VIX")],
      omissions: [{
        omission_id: "dxy-missing",
        family: "currency",
        instrument_id: "DTWEXBGS",
        reason_code: "source_unavailable",
        reason_text: "Dollar index was not available in the approved free path for this run.",
        blocking: false,
      }],
    },
    editorial_issue: {
      issue_id: "pulse-editorial-pulse-report-1",
      headline: "RISK APPETITE IMPROVES",
      dek: "Equities rose while volatility cooled.",
      lead: "Good morning. Today's Pulse separates the actual daily change from the slower macro backdrop.",
      prior_cycle_end: "2026-04-22T11:39:14.107Z",
      freshness_state: "updated",
      in_this_issue: ["Market Tape", "What Changed"],
      what_changed: [{
        kind: "market_tape",
        title: "Tape comparison",
        body: "The reviewed market tape moved from mixed to higher, while Macro Stress is elevated.",
        freshness_state: "updated",
        importance: "high",
        evidence: [],
      }],
      why_it_matters: [],
      what_to_watch: [],
      signal_vs_noise: [],
      coverage_notes: [],
      evidence: [],
    },
    macro_news: {
      as_of: "2026-04-23",
      state: "elevated",
      lead: "Rates and earnings dominate the macro wire.",
      items: [{
        headline: "Treasury yields slip as traders weigh softer labour data",
        source_name: "Approved Macro Wire",
        source_url: "https://example.com/yields-slip",
        published_at: "2026-04-23T09:30:00.000Z",
        topic: "rates",
        severity: "elevated",
        confirmation_state: "single_source",
        corroboration_count: 1,
        affected_regions: ["United States"],
        affected_assets: ["rates"],
        why_it_matters: "Lower yields ease pressure on long-duration equities.",
        evidence: [],
      }],
      omissions: [],
      coverage_notes: [],
    },
    morning_edition: {
      headline_digest: [
        {
          headline: "Stocks advance as investors weigh rates and earnings",
          source_name: "Approved Markets Desk",
          source_url: "https://example.com/markets/stocks-advance",
          published_at: "2026-04-23T10:00:00.000Z",
          topic: "market",
          evidence: [],
        },
        {
          headline: "Chipmakers lead the Nasdaq higher (with a twist): “supply” improves",
          source_name: "Approved Tech Desk",
          source_url: "javascript:alert(1)",
          published_at: "2026-04-23T08:15:00.000Z",
          topic: "technology",
          evidence: [],
        },
      ],
      portfolio_radar: [
        {
          ticker: "AAPL",
          company_name: "Apple Inc.",
          previous_close: 171.5,
          latest_price: 174.2,
          change: 2.7,
          change_pct: 1.57,
          direction: "up",
          evidence: [],
        },
        {
          ticker: "MSFT",
          company_name: "Microsoft",
          previous_close: 422.1,
          latest_price: 420.55,
          change: -1.55,
          change_pct: -0.37,
          direction: "down",
          evidence: [],
        },
        {
          ticker: "nvda",
          company_name: "NVIDIA Corporation",
          previous_close: 880.0,
          latest_price: 915.2,
          change: 35.2,
          change_pct: 4.0,
          direction: "up",
          evidence: [],
        },
      ],
      market_board: [
        {
          label: "S&P 500",
          value: 5375.86,
          one_day_change_pct: 1.67,
          direction: "up",
          sparkline: [5280, 5304, 5290, 5287.76, 5375.86],
          evidence: [],
        },
        {
          label: "Nasdaq",
          value: 16820.4,
          one_day_change_pct: 1.89,
          direction: "up",
          sparkline: [16420, 16480, 16530, 16507.8, 16820.4],
          evidence: [],
        },
        {
          label: "VIX",
          value: 17.43,
          one_day_change_pct: -4.28,
          direction: "down",
          sparkline: [19.1, 18.6, 18.9, 18.21, 17.43],
          evidence: [],
        },
      ],
      today_catalysts: [
        {
          time_label: "8:30 AM ET",
          title: "Initial jobless claims",
          category: "macro",
          impact: "medium",
          evidence: [],
        },
        {
          time_label: "After close",
          title: "AAPL earnings",
          category: "earnings",
          impact: "high",
          evidence: [],
        },
      ],
      sector_pulse: [],
      coverage_notes: [],
    },
    sections: {
      macro_stress: section("macro_stress", "Macro Stress", "Macro pressure is elevated."),
      market_tape: section("market_tape", "Market Tape", "US risk assets were broadly higher on the day."),
      // The rest of the sections a stored issue must have (isMarketPulseReport).
      market_moves: section("market_moves", "Market Moves", "Indices closed higher."),
      macro_releases: section("macro_releases", "Macro Releases", "No major releases."),
      rates_fx_commodities: section("rates_fx_commodities", "Rates, FX, Commodities", "Yields eased."),
      news_summary: section("news_summary", "News", "Mega-cap earnings led the tape."),
      uncertainty_flags: section("uncertainty_flags", "Uncertainty", "None flagged."),
    },
  };
}

// A quiet issue: flat indices, no headlines, no calendar, no deltas, first issue (baseline).
export function createQuietPulseReport(): MarketPulseReport {
  const report = createPulseReport();
  return {
    ...report,
    macro_stress: { ...report.macro_stress, state: "stable", summary: "Macro pressure is stable." },
    market_tape: {
      ...report.market_tape,
      indices: [
        move("SP500", "S&P 500", "core_index", 5290.1, 2.34, 0.04),
        move("NASDAQCOM", "Nasdaq Composite", "core_index", 16510.2, -8.1, -0.05),
        move("DJIA", "Dow Jones Industrial Average", "core_index", 38720.4, 12.2, 0.03),
      ],
      cross_asset: [move("VIXCLS", "VIX", "volatility", 15.2, 0.1, 0.66)],
      sector_leadership: undefined,
      omissions: [],
    },
    editorial_issue: undefined,
    macro_news: undefined,
    morning_edition: {
      ...report.morning_edition,
      headline_digest: [],
      portfolio_radar: [],
      today_catalysts: [],
      market_board: [],
    },
  };
}

export function createResearchState(): UserResearchState {
  const name = (ticker: string, company: string, summary: string): Loose => ({
    ticker,
    company_name: company,
    in_watchlist: true,
    monitor_state: "intact",
    freshness_state: "current",
    daily_delta: { state: "unchanged", title: "No change", body: "No new evidence.", evidence_refs: [] },
    summary,
    what_changed: `${ticker} had no new filing since the last issue.`,
    why_it_matters: `${ticker} thesis rests on services margin and buyback pace.`,
    what_to_watch: `${ticker} next earnings call and guidance.`,
    evidence_refs: [],
    omissions: [],
  });
  return {
    state_id: "urs-1",
    user_id: "user-1",
    as_of: "2026-04-23",
    generated_at: retrievedAt,
    watchlist_tickers: ["AAPL", "MSFT", "TSLA"],
    holdings: [{ ticker: "AAPL", quantity: 10, updated_at: retrievedAt }],
    names: [
      name("AAPL", "Apple Inc.", "Thesis intact; services growth carries the read."),
      name("MSFT", "Microsoft", "Cloud demand remains the core of the thesis."),
      name("TSLA", "Tesla, Inc.", "Margins remain the open question."),
    ],
    omissions: [],
    evidence_refs: [],
  };
}
