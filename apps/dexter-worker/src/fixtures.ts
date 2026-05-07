import type {
  CanonicalFinancialSnapshot,
  CanonicalTranscript,
  ConfidenceBlock,
  EvidenceItem,
  ReportSectionStatus,
  SignalValue
} from "../../../packages/contracts/src";

import { buildStatusBody } from "./sections";

export interface SectionScenario {
  status: ReportSectionStatus;
  summary: string;
  evidence: EvidenceItem[];
  shouldTimeout?: boolean;
}

export interface FixtureScenario {
  promptVersion: string;
  model: string;
  sources: string[];
  sectionScenarios: Record<string, SectionScenario>;
  confidence: ConfidenceBlock;
  signalValue: SignalValue;
  signalReasons: string[];
  flags: string[];
}

export interface FixtureHistoricalContext {
  financials: CanonicalFinancialSnapshot[];
  transcripts: CanonicalTranscript[];
  spotPrice?: number;
}

function buildEvidence(
  ticker: string,
  sourceName: string,
  sourceType: EvidenceItem["source_type"],
  excerpt: string,
  suffix: string
): EvidenceItem {
  return {
    evidence_id: `${ticker.toLowerCase()}-${suffix}`,
    source_type: sourceType,
    source_name: sourceName,
    excerpt,
    retrieved_at: "2026-03-15T08:00:00.000Z",
    url: `https://example.com/${ticker.toLowerCase()}/${suffix}`
  };
}

function msftEvidence(): Record<string, EvidenceItem[]> {
  return {
    quarter_over_quarter_changes: [
      buildEvidence("MSFT", "FY2025 Q2 10-Q", "filing", "Revenue increased quarter over quarter.", "qoq-1"),
      buildEvidence("MSFT", "FY2025 Q2 earnings call", "article", "Cloud demand improved sequentially.", "qoq-2")
    ],
    year_over_year_changes: [
      buildEvidence("MSFT", "FY2025 Q2 10-Q", "filing", "Revenue increased 15% year over year.", "yoy-1"),
      buildEvidence("MSFT", "FY2025 Q2 earnings call", "article", "Management highlighted Azure demand resilience.", "yoy-2")
    ],
    revenue_margin_analysis: [
      buildEvidence("MSFT", "FY2025 Q2 10-Q", "financial_data", "Gross margin expanded by 120 basis points.", "margin-1"),
      buildEvidence("MSFT", "FY2025 Q2 10-Q", "financial_data", "Operating income outpaced revenue growth.", "margin-2")
    ],
    debt_liquidity: [
      buildEvidence("MSFT", "FY2025 Q2 balance sheet", "financial_data", "Cash and short-term investments exceed total debt.", "debt-1"),
      buildEvidence("MSFT", "FY2025 Q2 cash flow", "financial_data", "Free cash flow remained positive.", "debt-2")
    ],
    acquisitions_major_events: [
      buildEvidence("MSFT", "Company filings", "filing", "No transformative acquisition closed in the quarter.", "events-1")
    ],
    management_commentary: [
      buildEvidence("MSFT", "FY2025 Q2 earnings call", "article", "Leadership reiterated AI capex discipline.", "commentary-1"),
      buildEvidence("MSFT", "10-Q risk factors", "filing", "Cybersecurity and competition remain key risks.", "commentary-2"),
      buildEvidence("MSFT", "10-Q risk factors", "filing", "Regulatory and macro volatility remain material uncertainties.", "commentary-3")
    ]
  };
}

function buildCompleteScenario(ticker: string): FixtureScenario {
  const evidence = msftEvidence();
  const qoqEvidence = evidence.quarter_over_quarter_changes ?? [];
  const yoyEvidence = evidence.year_over_year_changes ?? [];
  const revenueEvidence = evidence.revenue_margin_analysis ?? [];
  const debtEvidence = evidence.debt_liquidity ?? [];
  const eventsEvidence = evidence.acquisitions_major_events ?? [];
  const commentaryEvidence = evidence.management_commentary ?? [];

  return {
    promptVersion: "fixture-m3-v1",
    model: "fixture-dexter-m3",
    sources: ["dexter-native:financial_search", "dexter-native:read_filings", "dexter-native:web_search"],
    sectionScenarios: {
      quarter_over_quarter_changes: {
        status: "complete",
        summary:
          `${ticker} delivered sequential growth with cloud demand carrying the headline acceleration.`,
        evidence: qoqEvidence
      },
      year_over_year_changes: {
        status: "complete",
        summary:
          `${ticker} delivered year-over-year growth with cloud demand carrying the headline acceleration.`,
        evidence: yoyEvidence
      },
      revenue_margin_analysis: {
        status: "complete",
        summary:
          `${ticker} expanded margins alongside revenue, suggesting operating leverage rather than one-off accounting noise.`,
        evidence: revenueEvidence
      },
      debt_liquidity: {
        status: "complete",
        summary:
          `${ticker} remains liquid and conservatively financed, with cash coverage that limits near-term balance-sheet stress.`,
        evidence: debtEvidence
      },
      acquisitions_major_events: {
        status: "complete",
        summary:
          `Major event flow was manageable and did not materially distort the core operating picture for ${ticker}.`,
        evidence: eventsEvidence
      },
      management_commentary: {
        status: "complete",
        summary:
          `Management commentary stayed constructive while still acknowledging execution and risk priorities for ${ticker}.`,
        evidence: commentaryEvidence
      }
    },
    confidence: {
      score: 0.83,
      label: "high",
      limiting_factors: ["Market conditions can still compress multiples despite strong execution."]
    },
    signalValue: "positive",
    signalReasons: [
      "Revenue quality improved while margins expanded.",
      "Liquidity and balance-sheet posture remain strong."
    ],
    flags: ["fixture_mode"]
  };
}

function buildLimitedScenario(ticker: string): FixtureScenario {
  const base = buildCompleteScenario(ticker);
  const yoySection = base.sectionScenarios.year_over_year_changes;
  const commentarySection = base.sectionScenarios.management_commentary;

  return {
    ...base,
    sectionScenarios: {
      ...base.sectionScenarios,
      year_over_year_changes: {
        status: "data_incomplete",
        summary: buildStatusBody(
          "Year-over-Year Changes",
          "data_incomplete",
          "Only partial annual comparison data was available, so the section stays intentionally constrained."
        ),
        evidence: yoySection ? yoySection.evidence.slice(0, 1) : []
      },
      acquisitions_major_events: {
        status: "data_unavailable",
        summary: buildStatusBody(
          "Acquisitions and Major Events",
          "data_unavailable",
          "Approved source retrieval returned no reliable event record for the requested period."
        ),
        evidence: []
      },
      management_commentary: {
        status: "data_incomplete",
        summary: buildStatusBody(
          "Management Commentary",
          "data_incomplete",
          "Only partial management commentary and risk evidence was available, so the section stays intentionally constrained."
        ),
        evidence: commentarySection ? commentarySection.evidence.slice(0, 1) : []
      }
    },
    confidence: {
      score: 0.42,
      label: "insufficient_data",
      limiting_factors: [
        "Management commentary was only partially available.",
        "Approved event coverage was unavailable for one section."
      ]
    },
    signalValue: "no_signal",
    signalReasons: ["Minimum evidence threshold not met across the degraded sections."],
    flags: ["fixture_mode", "signal_insufficient_data", "section_data_unavailable"]
  };
}

function buildNoSignalScenario(ticker: string): FixtureScenario {
  const base = buildCompleteScenario(ticker);
  const eventsSection = base.sectionScenarios.acquisitions_major_events;
  const commentarySection = base.sectionScenarios.management_commentary;

  return {
    ...base,
    sectionScenarios: {
      ...base.sectionScenarios,
      acquisitions_major_events: {
        ...(eventsSection ?? {
          status: "data_unavailable",
          summary: buildStatusBody(
            "Acquisitions and Major Events",
            "data_unavailable",
            "No reliable event evidence was available."
          ),
          evidence: []
        }),
        evidence: []
      },
      management_commentary: {
        ...(commentarySection ?? {
          status: "data_incomplete",
          summary: buildStatusBody(
            "Management Commentary",
            "data_incomplete",
            "Only partial management commentary and risk evidence was available."
          ),
          evidence: []
        }),
        evidence: commentarySection ? commentarySection.evidence.slice(0, 1) : []
      }
    },
    confidence: {
      score: 0.39,
      label: "insufficient_data",
      limiting_factors: ["Evidence did not meet the scoring threshold even though most sections completed."]
    },
    signalValue: "no_signal",
    signalReasons: ["Evidence was directionally interesting but below the minimum scoring threshold."],
    flags: ["fixture_mode", "signal_insufficient_data"]
  };
}

function buildTimeoutScenario(ticker: string): FixtureScenario {
  const base = buildCompleteScenario(ticker);

  return {
    ...base,
    sectionScenarios: {
      ...base.sectionScenarios,
      revenue_margin_analysis: {
        status: "failed",
        summary: buildStatusBody(
          "Revenue and Margin Analysis",
          "failed",
          "The executor timed out twice, so this section is explicitly marked failed."
        ),
        evidence: [],
        shouldTimeout: true
      }
    },
    confidence: {
      score: 0.58,
      label: "medium",
      limiting_factors: ["Revenue and margin section failed after retry and is excluded from scoring."]
    },
    signalValue: "neutral",
    signalReasons: ["The remaining completed sections did not support a stronger directional signal."],
    flags: ["fixture_mode", "section_failed"]
  };
}

function buildFixtureHistoricalContext(ticker: string): FixtureHistoricalContext {
  const normalizedTicker = ticker.trim().toUpperCase();
  const retrievedAt = "2026-03-20T08:00:00.000Z";

  if (normalizedTicker === "LIMITED" || normalizedTicker === "ZZZZ") {
    return {
      financials: [
        {
          snapshot_id: `${normalizedTicker}-2025-q4`,
          ticker: normalizedTicker,
          period: "2025-Q4",
          period_type: "quarterly",
          fiscal_year: 2025,
          fiscal_quarter: 4,
          provider: "fixture_historical",
          retrieved_at: retrievedAt,
          data: {
            revenue: 20_400_000_000,
            net_income: 1_200_000_000
          },
          missing_fields: ["eps", "operating_margin", "free_cash_flow", "shares_outstanding"]
        }
      ],
      transcripts: []
    };
  }

  return {
    financials: [
      {
        snapshot_id: `${normalizedTicker}-2025-q4`,
        ticker: normalizedTicker,
        period: "2025-Q4",
        period_type: "quarterly",
        fiscal_year: 2025,
        fiscal_quarter: 4,
        provider: "fixture_historical",
        retrieved_at: retrievedAt,
        data: {
          revenue: 69_632_000_000,
          gross_profit: 48_742_000_000,
          gross_margin: 70,
          operating_income: 30_707_000_000,
          net_income: 24_667_000_000,
          eps: 3.3,
          eps_diluted: 3.28,
          ebitda: 33_900_000_000,
          operating_margin: 44.1,
          debt_total: 58_000_000_000,
          cash_and_equivalents: 92_000_000_000,
          total_assets: 512_000_000_000,
          total_liabilities: 236_000_000_000,
          shareholders_equity: 276_000_000_000,
          free_cash_flow: 22_400_000_000,
          operating_cash_flow: 25_400_000_000,
          capital_expenditure: -3_000_000_000,
          shares_outstanding: 7_420_000_000
        },
        segments: [
          {
            segment_name: "Cloud",
            revenue: 29_100_000_000,
            operating_income: 12_400_000_000
          },
          {
            segment_name: "Productivity",
            revenue: 19_700_000_000,
            operating_income: 9_100_000_000
          }
        ],
        missing_fields: []
      },
      {
        snapshot_id: `${normalizedTicker}-2025-q3`,
        ticker: normalizedTicker,
        period: "2025-Q3",
        period_type: "quarterly",
        fiscal_year: 2025,
        fiscal_quarter: 3,
        provider: "fixture_historical",
        retrieved_at: retrievedAt,
        data: {
          revenue: 64_700_000_000,
          gross_profit: 44_996_000_000,
          gross_margin: 69.5,
          operating_income: 27_303_000_000,
          net_income: 22_800_000_000,
          eps: 3.05,
          eps_diluted: 3.04,
          ebitda: 30_500_000_000,
          operating_margin: 42.2,
          debt_total: 59_000_000_000,
          cash_and_equivalents: 90_000_000_000,
          total_assets: 500_000_000_000,
          total_liabilities: 232_000_000_000,
          shareholders_equity: 268_000_000_000,
          free_cash_flow: 20_900_000_000,
          operating_cash_flow: 23_800_000_000,
          capital_expenditure: -2_900_000_000,
          shares_outstanding: 7_425_000_000
        },
        missing_fields: []
      },
      {
        snapshot_id: `${normalizedTicker}-2024-q4`,
        ticker: normalizedTicker,
        period: "2024-Q4",
        period_type: "quarterly",
        fiscal_year: 2024,
        fiscal_quarter: 4,
        provider: "fixture_historical",
        retrieved_at: retrievedAt,
        data: {
          revenue: 62_000_000_000,
          gross_profit: 42_160_000_000,
          gross_margin: 68,
          operating_income: 25_110_000_000,
          net_income: 21_350_000_000,
          eps: 2.91,
          eps_diluted: 2.9,
          ebitda: 28_600_000_000,
          operating_margin: 40.5,
          debt_total: 61_000_000_000,
          cash_and_equivalents: 84_000_000_000,
          total_assets: 470_000_000_000,
          total_liabilities: 225_000_000_000,
          shareholders_equity: 245_000_000_000,
          free_cash_flow: 19_400_000_000,
          operating_cash_flow: 22_100_000_000,
          capital_expenditure: -2_700_000_000,
          shares_outstanding: 7_450_000_000
        },
        missing_fields: []
      },
      {
        snapshot_id: `${normalizedTicker}-2025-fy`,
        ticker: normalizedTicker,
        period: "2025-FY",
        period_type: "annual",
        fiscal_year: 2025,
        provider: "fixture_historical",
        retrieved_at: retrievedAt,
        data: {
          revenue: 265_000_000_000,
          gross_profit: 185_500_000_000,
          gross_margin: 70,
          operating_income: 116_600_000_000,
          operating_margin: 44,
          net_income: 95_400_000_000,
          eps: 12.86,
          eps_diluted: 12.8,
          ebitda: 128_000_000_000,
          debt_total: 58_000_000_000,
          cash_and_equivalents: 92_000_000_000,
          total_assets: 512_000_000_000,
          total_liabilities: 236_000_000_000,
          shareholders_equity: 276_000_000_000,
          free_cash_flow: 84_100_000_000,
          operating_cash_flow: 96_000_000_000,
          capital_expenditure: -11_900_000_000,
          shares_outstanding: 7_420_000_000,
          effective_tax_rate: 0.18
        },
        missing_fields: []
      },
      {
        snapshot_id: `${normalizedTicker}-2024-fy`,
        ticker: normalizedTicker,
        period: "2024-FY",
        period_type: "annual",
        fiscal_year: 2024,
        provider: "fixture_historical",
        retrieved_at: retrievedAt,
        data: {
          revenue: 245_000_000_000,
          gross_profit: 166_600_000_000,
          gross_margin: 68,
          operating_income: 100_450_000_000,
          operating_margin: 41,
          net_income: 84_200_000_000,
          eps: 11.3,
          eps_diluted: 11.25,
          ebitda: 111_000_000_000,
          debt_total: 61_000_000_000,
          cash_and_equivalents: 84_000_000_000,
          total_assets: 470_000_000_000,
          total_liabilities: 225_000_000_000,
          shareholders_equity: 245_000_000_000,
          free_cash_flow: 78_800_000_000,
          operating_cash_flow: 89_000_000_000,
          capital_expenditure: -10_200_000_000,
          shares_outstanding: 7_450_000_000,
          effective_tax_rate: 0.19
        },
        missing_fields: []
      },
      {
        snapshot_id: `${normalizedTicker}-2023-fy`,
        ticker: normalizedTicker,
        period: "2023-FY",
        period_type: "annual",
        fiscal_year: 2023,
        provider: "fixture_historical",
        retrieved_at: retrievedAt,
        data: {
          revenue: 220_000_000_000,
          gross_profit: 143_000_000_000,
          gross_margin: 65,
          operating_income: 83_600_000_000,
          operating_margin: 38,
          net_income: 72_000_000_000,
          eps: 9.62,
          eps_diluted: 9.58,
          ebitda: 94_000_000_000,
          debt_total: 64_000_000_000,
          cash_and_equivalents: 78_000_000_000,
          total_assets: 430_000_000_000,
          total_liabilities: 215_000_000_000,
          shareholders_equity: 215_000_000_000,
          free_cash_flow: 72_600_000_000,
          operating_cash_flow: 81_000_000_000,
          capital_expenditure: -8_400_000_000,
          shares_outstanding: 7_480_000_000,
          effective_tax_rate: 0.2
        },
        missing_fields: []
      },
      {
        snapshot_id: `${normalizedTicker}-2022-fy`,
        ticker: normalizedTicker,
        period: "2022-FY",
        period_type: "annual",
        fiscal_year: 2022,
        provider: "fixture_historical",
        retrieved_at: retrievedAt,
        data: {
          revenue: 198_000_000_000,
          gross_profit: 126_720_000_000,
          gross_margin: 64,
          operating_income: 71_280_000_000,
          operating_margin: 36,
          net_income: 61_400_000_000,
          eps: 8.18,
          eps_diluted: 8.14,
          ebitda: 80_000_000_000,
          debt_total: 66_000_000_000,
          cash_and_equivalents: 72_000_000_000,
          total_assets: 395_000_000_000,
          total_liabilities: 205_000_000_000,
          shareholders_equity: 190_000_000_000,
          free_cash_flow: 65_000_000_000,
          operating_cash_flow: 73_000_000_000,
          capital_expenditure: -8_000_000_000,
          shares_outstanding: 7_510_000_000,
          effective_tax_rate: 0.2
        },
        missing_fields: []
      },
      {
        snapshot_id: `${normalizedTicker}-2020-fy`,
        ticker: normalizedTicker,
        period: "2020-FY",
        period_type: "annual",
        fiscal_year: 2020,
        provider: "fixture_historical",
        retrieved_at: retrievedAt,
        data: {
          revenue: 143_000_000_000,
          gross_profit: 94_380_000_000,
          gross_margin: 66,
          operating_income: 53_000_000_000,
          operating_margin: 37.1,
          net_income: 44_300_000_000,
          eps: 5.82,
          eps_diluted: 5.76,
          ebitda: 62_000_000_000,
          debt_total: 70_000_000_000,
          cash_and_equivalents: 55_000_000_000,
          total_assets: 301_000_000_000,
          total_liabilities: 183_000_000_000,
          shareholders_equity: 118_000_000_000,
          free_cash_flow: 45_200_000_000,
          operating_cash_flow: 60_600_000_000,
          capital_expenditure: -15_400_000_000,
          shares_outstanding: 7_610_000_000,
          effective_tax_rate: 0.17
        },
        missing_fields: []
      }
    ],
    transcripts: [
      {
        transcript_id: `${normalizedTicker}-2025-q4`,
        ticker: normalizedTicker,
        period: "2025-Q4",
        fiscal_year: 2025,
        fiscal_quarter: 4,
        call_date: "2026-01-24",
        provider: "fixture_transcript",
        retrieved_at: retrievedAt,
        body_text:
          "Management highlighted durable cloud demand and disciplined AI infrastructure spend while maintaining margin focus.",
        word_count: 15,
        is_complete: true
      }
    ],
    spotPrice: 428.52
  };
}

function buildGraphScenario(ticker: string): FixtureScenario {
  const base = buildCompleteScenario(ticker);
  const commentarySection = base.sectionScenarios.management_commentary;
  const eventsSection = base.sectionScenarios.acquisitions_major_events;

  return {
    ...base,
    sectionScenarios: {
      ...base.sectionScenarios,
      acquisitions_major_events: {
        ...(eventsSection ?? {
          status: "complete",
          summary: "",
          evidence: []
        }),
        summary:
          `NVDA supplies accelerator hardware that supports ${ticker}'s AI platform, making supplier availability a thesis input.`,
        evidence: eventsSection?.evidence ?? []
      },
      management_commentary: {
        ...(commentarySection ?? {
          status: "complete",
          summary: "",
          evidence: []
        }),
        summary:
          `QQQ sector conditions influence ${ticker}'s valuation risk because macro pressure can compress growth multiples.`,
        evidence: commentarySection?.evidence ?? []
      }
    }
  };
}

export function getFixtureScenario(ticker: string): FixtureScenario {
  const normalized = ticker.trim().toUpperCase();

  switch (normalized) {
    case "LIMITED":
    case "ZZZZ":
      return buildLimitedScenario(normalized);
    case "NOSIG":
      return buildNoSignalScenario(normalized);
    case "TIMEOUT":
      return buildTimeoutScenario(normalized);
    case "GRAPH":
      return buildGraphScenario(normalized);
    case "MSFT":
    default:
      return buildCompleteScenario(normalized);
  }
}

export function getFixtureHistoricalContext(ticker: string): FixtureHistoricalContext {
  return buildFixtureHistoricalContext(ticker);
}
