import assert from "node:assert/strict";
import test from "node:test";

import type { MarketPulseReport } from "../../../packages/contracts/src";
import { buildMarketPulseReportHtml } from "../src/market-pulse-render";

function createReport(): MarketPulseReport {
  return {
    report_id: "pulse-report-1",
    schema_version: "1.0.0",
    generated_at: "2026-04-23T11:39:14.198Z",
    cycle_start: "2026-04-22T11:39:14.107Z",
    cycle_end: "2026-04-23T11:39:14.107Z",
    macro_stress: {
      snapshot_id: "macro-1",
      as_of: "2026-04-23",
      generated_at: "2026-04-23T11:39:14.198Z",
      state: "elevated",
      summary: "Macro pressure is elevated: Treasury 2Y (high), CPI-U All Items (high).",
      no_material_change: false,
      inputs: [
        {
          registry_id: "TREASURY_DAILY_2Y",
          label: "Treasury 2Y",
          category: "rates",
          pressure: "high",
          source_state: "official",
          value: 4.83,
          unit: "percent",
          period: "2026-04-23",
          reason: "Treasury 2Y is 4.83 percent (2026-04-23).",
          source_name: "Daily Treasury Rates - 2 Yr",
          retrieved_at: "2026-04-17T00:00:00.000Z"
        },
        {
          registry_id: "BLS_CPI_U_ALL_ITEMS",
          label: "CPI-U All Items",
          category: "inflation",
          pressure: "high",
          source_state: "official",
          value: 312.23,
          unit: "index",
          period: "2026-04-23",
          reason: "CPI-U All Items is 312.23 index (2026-04-23).",
          source_name: "CPI-U All Items",
          retrieved_at: "2026-04-17T00:00:00.000Z"
        }
      ],
      omissions: []
    },
    market_tape: {
      as_of: "2026-04-23",
      coverage_state: "partial",
      summary: "US risk assets were broadly higher on the day.",
      indices: [
        {
          instrument_id: "SP500",
          label: "S&P 500",
          family: "core_index",
          period: "2026-04-23",
          value: 5375.86,
          previous_value: 5287.76,
          daily_change: 88.1,
          daily_change_pct: 1.67,
          unit: "index",
          direction: "up",
          retrieval: {
            source: {
              source_id: "FRED_SP500",
              source_family: "fred",
              source_name: "FRED S&P 500",
              source_url: "https://fred.stlouisfed.org/series/SP500",
              agency: "Federal Reserve Bank of St. Louis",
              agency_series_id: "SP500"
            },
            retrieved_at: "2026-04-23T11:39:14.198Z",
            retrieval_status: "fresh",
            source_period: "2026-04-23"
          },
          missing_fields: []
        }
      ],
      cross_asset: [
        {
          instrument_id: "VIXCLS",
          label: "VIX",
          family: "volatility",
          period: "2026-04-23",
          value: 17.43,
          previous_value: 18.21,
          daily_change: -0.78,
          daily_change_pct: -4.28,
          unit: "index",
          direction: "down",
          retrieval: {
            source: {
              source_id: "FRED_VIXCLS",
              source_family: "fred",
              source_name: "FRED VIX",
              source_url: "https://fred.stlouisfed.org/series/VIXCLS",
              agency: "Federal Reserve Bank of St. Louis",
              agency_series_id: "VIXCLS"
            },
            retrieved_at: "2026-04-23T11:39:14.198Z",
            retrieval_status: "fresh",
            source_period: "2026-04-23"
          },
          missing_fields: []
        }
      ],
      retrievals: [
        {
          source: {
            source_id: "FRED_SP500",
            source_family: "fred",
            source_name: "FRED S&P 500",
            source_url: "https://fred.stlouisfed.org/series/SP500",
            agency: "Federal Reserve Bank of St. Louis",
            agency_series_id: "SP500"
          },
          retrieved_at: "2026-04-23T11:39:14.198Z",
          retrieval_status: "fresh",
          source_period: "2026-04-23"
        }
      ],
      omissions: [
        {
          omission_id: "sector-basket-free-path-unavailable",
          family: "sector",
          reason_code: "source_unavailable",
          reason_text: "Sector ETF leadership is not available in the approved free live path for this run.",
          blocking: false
        }
      ]
    },
    editorial_issue: {
      issue_id: "pulse-editorial-pulse-report-1",
      headline: "MACRO SHOCK MOVES TO THE FRONT OF THE ISSUE",
      dek: "corroborated: Reports say China has attacked Taiwan",
      lead:
        "A shock-level macro or geopolitical headline is present; Pulse treats it as the first risk context and labels confirmation state explicitly. Good morning. Today's Pulse separates the actual daily change from the slower macro backdrop.",
      prior_cycle_end: "2026-04-22T11:39:14.107Z",
      freshness_state: "updated",
      in_this_issue: [
        "Lead Story / Market Tape",
        "Macro News",
        "What Changed",
        "Why It Matters",
        "What To Watch",
        "Signal vs Noise",
        "Macro Regime"
      ],
      what_changed: [
        {
          kind: "market_tape",
          title: "Tape comparison",
          body: "The reviewed market tape moved from mixed to higher, while Macro Stress is elevated.",
          freshness_state: "updated",
          importance: "high",
          evidence: []
        }
      ],
      why_it_matters: [
        {
          kind: "market_tape",
          title: "Conviction read",
          body:
            "A broader positive tape can improve context, but Thesis still requires confirmation before treating one day as a thesis change.",
          freshness_state: "updated",
          importance: "high",
          evidence: []
        }
      ],
      what_to_watch: [
        {
          kind: "calendar",
          title: "AAPL earnings",
          body:
            "AAPL has an earnings event on 2026-04-29 after the close. Watch for company-specific evidence that changes the briefing context.",
          watch_date: "2026-04-29",
          freshness_state: "new",
          importance: "medium",
          evidence: []
        }
      ],
      signal_vs_noise: [
        {
          kind: "context",
          title: "Noise",
          body: "One-day market movement does not prove a regime shift.",
          freshness_state: "unchanged",
          importance: "medium",
          evidence: []
        }
      ],
      coverage_notes: ["market tape coverage was incomplete for this run."],
      evidence: []
    },
    macro_news: {
      as_of: "2026-04-23",
      state: "shock",
      lead:
        "A shock-level macro or geopolitical headline is present; Pulse treats it as the first risk context and labels confirmation state explicitly.",
      items: [
        {
          headline: "Reports say China has attacked Taiwan",
          source_name: "Approved Macro Wire",
          source_url: "https://example.com/china-taiwan",
          published_at: "2026-04-23T10:00:00.000Z",
          topic: "war_conflict",
          severity: "shock",
          confirmation_state: "corroborated",
          corroboration_count: 2,
          affected_regions: ["Taiwan", "China", "United States"],
          affected_assets: ["semiconductors", "volatility", "risk appetite"],
          why_it_matters:
            "A shock-level macro or geopolitical event can change the interpretation of market tape, volatility, rates, supply-chain exposure, and issuer-specific risk.",
          evidence: []
        }
      ],
      omissions: [],
      coverage_notes: []
    },
    morning_edition: {
      headline_digest: [
        {
          headline: "Stocks advance as investors weigh rates and earnings",
          source_name: "Approved Markets Desk",
          source_url: "https://example.com/markets/stocks-advance",
          published_at: "2026-04-23T10:00:00.000Z",
          topic: "market",
          evidence: []
        }
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
          evidence: []
        },
        {
          ticker: "MSFT",
          company_name: "Microsoft",
          previous_close: 422.1,
          latest_price: 420.55,
          change: -1.55,
          change_pct: -0.37,
          direction: "down",
          evidence: []
        }
      ],
      market_board: [
        {
          label: "S&P 500",
          value: 5245.67,
          one_day_change: 35.55,
          one_day_change_pct: 0.68,
          five_day_change_pct: 1.14,
          direction: "up",
          sparkline: [5180, 5204, 5218, 5210, 5245.67],
          evidence: []
        },
        {
          label: "Nasdaq",
          value: 16420.3,
          one_day_change: 169.5,
          one_day_change_pct: 1.04,
          five_day_change_pct: 1.88,
          direction: "up",
          sparkline: [16020, 16180, 16230, 16195, 16420.3],
          evidence: []
        }
      ],
      today_catalysts: [
        {
          time_label: "After close",
          title: "AAPL earnings",
          category: "earnings",
          impact: "medium",
          evidence: []
        }
      ],
      sector_pulse: [
        {
          label: "Technology",
          change_pct: 1.2,
          direction: "up",
          evidence: []
        },
        {
          label: "Financials",
          change_pct: -1.1,
          direction: "down",
          evidence: []
        }
      ],
      coverage_notes: []
    },
    context: {
      source_state: "official",
      generated_at: "2026-04-23T11:39:14.198Z",
      rights: [
        {
          rights_class: "official_public",
          display_mode: "full_text_allowed",
          source_rank: "official",
          source_type: "official_macro",
          can_store_full_text: true,
          can_display_excerpt: true,
          can_display_link: true,
          policy_reason: "Official public economic releases and filings.",
          reviewed_at: "2026-04-23T11:39:14.198Z"
        }
      ],
      omissions: []
    },
    structural_context: {
      subject_type: "market_pulse",
      subject_id: "US",
      as_of: "2026-04-23",
      coverage_state: "partial",
      summary:
        "United States structural context remains broadly supportive for scaled issuers, while public-debt and inflation-related sensitivity keep the backdrop disciplined.",
      observations: [
        {
          observation_id: "wb-gdp",
          family: "gdp_level",
          label: "GDP level",
          summary:
            "United States remains a very large output base, which supports demand resilience for scaled businesses.",
          geography: "United States",
          period: "2025",
          source_family: "world_bank",
          retrieval: {
            source: {
              source_id: "WB_NY.GDP.MKTP.CD",
              source_family: "world_bank",
              source_name: "World Bank GDP level",
              source_url: "https://api.worldbank.org/v2/country/USA/indicator/NY.GDP.MKTP.CD",
              agency: "World Bank",
              agency_series_id: "NY.GDP.MKTP.CD"
            },
            retrieved_at: "2026-04-23T11:39:14.310891Z",
            retrieval_status: "fresh",
            source_period: "2025"
          },
          missing_fields: []
        }
      ],
      omissions: [
        {
          omission_id: "imf-1",
          source_family: "imf",
          family: "gdp_growth_outlook",
          reason_code: "provider_unavailable",
          reason_text: "IMF forecast inputs are optional in M6 and were not available in this run.",
          blocking: false
        }
      ],
      retrievals: [
        {
          source: {
            source_id: "WB_NY.GDP.MKTP.CD",
            source_family: "world_bank",
            source_name: "World Bank GDP level",
            source_url: "https://api.worldbank.org/v2/country/USA/indicator/NY.GDP.MKTP.CD",
            agency: "World Bank",
            agency_series_id: "NY.GDP.MKTP.CD"
          },
          retrieved_at: "2026-04-23T11:39:14.310891Z",
          retrieval_status: "fresh",
          source_period: "2025"
        }
      ]
    },
    sections: {
      macro_stress: {
        section_id: "macro_stress",
        title: "Macro Stress",
        body: "Macro pressure is elevated.",
        status: "complete",
        evidence: []
      },
      market_tape: {
        section_id: "market_tape",
        title: "Market Tape",
        body: "US risk assets were broadly higher on the day. Coverage note: Sector ETF leadership is not available in the approved free live path for this run.",
        status: "data_incomplete",
        evidence: []
      },
      what_changed: {
        section_id: "what_changed",
        title: "What Changed",
        body: "Tape comparison: The reviewed market tape moved from mixed to higher.",
        status: "complete",
        evidence: []
      },
      why_it_matters: {
        section_id: "why_it_matters",
        title: "Why It Matters",
        body: "Conviction read: A broader positive tape can improve context.",
        status: "complete",
        evidence: []
      },
      what_to_watch: {
        section_id: "what_to_watch",
        title: "What To Watch",
        body: "AAPL earnings: AAPL has an earnings event on 2026-04-29 after the close.",
        status: "complete",
        evidence: []
      },
      signal_vs_noise: {
        section_id: "signal_vs_noise",
        title: "Signal vs Noise",
        body: "Noise: One-day market movement does not prove a regime shift.",
        status: "complete",
        evidence: []
      },
      macro_news: {
        section_id: "macro_news",
        title: "Macro News",
        body:
          "corroborated: Reports say China has attacked Taiwan. A shock-level macro or geopolitical event can change the interpretation of market tape.",
        status: "complete",
        evidence: []
      },
      market_board: {
        section_id: "market_board",
        title: "Market Board",
        body: "S&P 500: +0.68%. Nasdaq: +1.04%.",
        status: "complete",
        evidence: []
      },
      portfolio_radar: {
        section_id: "portfolio_radar",
        title: "Portfolio Radar",
        body: "AAPL: +1.57%. MSFT: -0.37%.",
        status: "complete",
        evidence: []
      },
      today_catalysts: {
        section_id: "today_catalysts",
        title: "Today's Catalysts",
        body: "After close - AAPL earnings.",
        status: "complete",
        evidence: []
      },
      headline_digest: {
        section_id: "headline_digest",
        title: "Headlines Worth Knowing",
        body: "Approved Markets Desk: Stocks advance as investors weigh rates and earnings.",
        status: "complete",
        evidence: []
      },
      sector_pulse: {
        section_id: "sector_pulse",
        title: "Sector Pulse",
        body: "Technology: +1.2%. Financials: -1.1%.",
        status: "complete",
        evidence: []
      },
      official_macro_pressure: {
        section_id: "official_macro_pressure",
        title: "Official Macro Pressure",
        body:
          "Treasury 2Y is elevated. GDP level: United States remains a very large output base. Coverage note: IMF forecast inputs are optional in M6 and were not available in this run.",
        status: "complete",
        evidence: [
          {
            evidence_id: "ev-1",
            source_type: "macro_data",
            source_name: "Daily Treasury Rates - 2 Yr",
            excerpt: "Treasury 2Y is 4.83 percent (2026-04-23).",
            retrieved_at: "2026-04-17T00:00:00.000Z",
            url: "https://home.treasury.gov/"
          }
        ]
      },
      canonical_events: {
        section_id: "canonical_events",
        title: "Canonical Events",
        body: "No canonical events were available for this cycle.",
        status: "data_incomplete",
        evidence: []
      },
      bounded_context: {
        section_id: "bounded_context",
        title: "Bounded Context",
        body:
          "Population: United States still offers a large domestic demand base for scaled consumer and enterprise franchises.",
        status: "complete",
        evidence: []
      },
      uncertainty_flags: {
        section_id: "uncertainty_flags",
        title: "Uncertainty Flags",
        body: "No material uncertainty flags were active in this cycle.",
        status: "complete",
        evidence: []
      },
      market_moves: {
        section_id: "market_moves",
        title: "Market Moves",
        body: "Issuer filing coverage this cycle: AAPL, MSFT.",
        status: "complete",
        evidence: []
      },
      macro_releases: {
        section_id: "macro_releases",
        title: "Macro Releases",
        body: "Treasury 2Y and CPI-U All Items were the notable releases.",
        status: "complete",
        evidence: []
      },
      rates_fx_commodities: {
        section_id: "rates_fx_commodities",
        title: "Rates, FX, and Commodities",
        body: "Rates stayed firm while energy remained contained.",
        status: "complete",
        evidence: []
      },
      news_summary: {
        section_id: "news_summary",
        title: "News Summary",
        body: "No bounded context headlines were available for this cycle.",
        status: "data_incomplete",
        evidence: []
      }
    },
    flags: [],
    confidence: {
      score: 0.86,
      label: "high",
      limiting_factors: ["No significant limiting factors detected in this cycle."]
    }
  };
}

test("buildMarketPulseReportHtml renders the Morning Brief reset", () => {
  const html = buildMarketPulseReportHtml(createReport());

  assert.match(html, /THESIS/);
  assert.match(html, /Morning Brief/);
  assert.match(html, /The Read/);
  assert.match(html, /The One Thing/);
  assert.match(html, /Things Changed|One Thing Changed|Baseline Issue/);
  assert.match(html, /Your Names/);
  assert.match(html, /Things To Watch/);
  assert.match(html, /Headlines Worth Knowing/);
  assert.match(html, /The Honest Read/);
  assert.match(html, /Stocks advance as investors weigh rates and earnings/);
  assert.match(html, /AAPL/);
  assert.match(html, /Apple Inc\./);
  assert.match(html, /\$171\.50 to \$174\.20/);
  assert.match(html, /Reports say China has attacked Taiwan/);
  assert.match(html, /Sources and Method/);
  assert.match(html, /mode-event/);
  assert.match(html, /reading-progress/);
  assert.match(html, /sector-strip|spark-row/);
  assert.match(html, /page-break-before:always/);
  assert.match(html, /break-inside:avoid/);
  assert.match(html, /page-break-inside:avoid/);
  assert.doesNotMatch(html, /VOL\. VII/);
  assert.doesNotMatch(html, /THE DAILY FINANCIAL BRIEFING/);
  assert.doesNotMatch(html, /In This Issue/);
  assert.doesNotMatch(html, /The Tape/);
  assert.doesNotMatch(html, /Estimated read:/);
  assert.doesNotMatch(html, /Market Overview/);
  assert.doesNotMatch(html, /Lead Story/);
  assert.doesNotMatch(html, /The Interesting Bit/);
  assert.doesNotMatch(html, /Why It Matters/);
  assert.doesNotMatch(html, /Smart Comment/);
  assert.doesNotMatch(html, /Macro News/);
  assert.doesNotMatch(html, /The Macro Regime/);
  assert.doesNotMatch(html, /DISINFLATIONARY SLOWDOWN/);
  assert.doesNotMatch(html, /Approved Context/);
  assert.doesNotMatch(html, /Notable Corporate Moves/);
  assert.doesNotMatch(html, /Company \/ Event Notes/);
  assert.doesNotMatch(html, /Global Matrix/);
  assert.doesNotMatch(html, /Coverage Notes/);
  assert.doesNotMatch(html, /The point for Thesis is not the index move alone/);
  assert.doesNotMatch(html, /The customer-facing conclusion/);
  assert.doesNotMatch(html, /data_incomplete/);
  assert.doesNotMatch(html, /bounded_context/);
  assert.ok(html.length < 15000, `expected compact HTML, got ${html.length} chars`);
  assert.ok(html.split("\n").length < 500, "expected fewer than 500 lines");
});

test("buildMarketPulseReportHtml hides optional modules when typed data is absent", () => {
  const report = createReport();
  report.morning_edition = {
    headline_digest: [],
    portfolio_radar: [],
    market_board: [],
    today_catalysts: [],
    sector_pulse: [],
    coverage_notes: []
  };
  report.macro_news = {
    as_of: "2026-04-23",
    state: "calm",
    lead: "No approved macro-news shock input was present.",
    items: [],
    omissions: [],
    coverage_notes: []
  };
  const html = buildMarketPulseReportHtml(report);

  assert.doesNotMatch(html, /Your Names/);
  assert.doesNotMatch(html, /Things To Watch/);
  assert.doesNotMatch(html, /Headlines Worth Knowing/);
  assert.doesNotMatch(html, /portfolio radar was omitted/i);
  assert.match(html, /The Honest Read/);
  assert.match(html, /Sources and Method/);
});

test("buildMarketPulseReportHtml adapts quiet days into a short issue", () => {
  const report = createReport();
  report.macro_news = undefined;
  report.editorial_issue = {
    ...report.editorial_issue!,
    freshness_state: "updated",
    prior_cycle_end: "2026-04-22T11:39:14.107Z",
    what_changed: [],
    what_to_watch: []
  };
  report.morning_edition = {
    headline_digest: [],
    portfolio_radar: [],
    market_board: [],
    today_catalysts: [],
    sector_pulse: [],
    coverage_notes: []
  };
  report.market_tape = {
    ...report.market_tape!,
    indices: ["SP500", "DJIA", "NASDAQCOM"].map((id, index) => ({
      ...report.market_tape!.indices[0]!,
      instrument_id: id,
      label: index === 0 ? "S&P 500" : index === 1 ? "Dow Jones Industrial Average" : "Nasdaq Composite",
      daily_change_pct: 0.08,
      daily_change: 2,
      direction: "flat" as const
    })),
    cross_asset: []
  };

  const html = buildMarketPulseReportHtml(report);

  assert.match(html, /mode-quiet/);
  assert.match(html, /Quiet day - 30 second read/);
  assert.match(html, /Nothing Moved The Needle/);
  assert.doesNotMatch(html, /Your Names/);
  assert.doesNotMatch(html, /Headlines Worth Knowing/);
});
