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

test("buildMarketPulseReportHtml renders Thesis pulse briefing structure", () => {
  const html = buildMarketPulseReportHtml(createReport());

  assert.match(html, /Thesis Morning Exception Briefing/);
  assert.match(html, /Market Pulse/);
  assert.match(html, /Official Macro Pressure/);
  assert.match(html, /Regime Board/);
  assert.match(html, /GDP level/);
  assert.match(html, /IMF forecast inputs are optional in M6/);
  assert.match(html, /No significant limiting factors detected in this cycle/);
});
