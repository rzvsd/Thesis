import type {
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
    qoq_yoy_changes: [
      buildEvidence("MSFT", "FY2025 Q2 10-Q", "filing", "Revenue increased 15% year over year.", "qoq-1"),
      buildEvidence("MSFT", "FY2025 Q2 earnings call", "article", "Management highlighted Azure demand resilience.", "qoq-2")
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
    management_commentary_risk_factors: [
      buildEvidence("MSFT", "FY2025 Q2 earnings call", "article", "Leadership reiterated AI capex discipline.", "risk-1"),
      buildEvidence("MSFT", "10-Q risk factors", "filing", "Cybersecurity and competition remain key risks.", "risk-2")
    ]
  };
}

function buildCompleteScenario(ticker: string): FixtureScenario {
  const evidence = msftEvidence();
  const qoqEvidence = evidence.qoq_yoy_changes ?? [];
  const revenueEvidence = evidence.revenue_margin_analysis ?? [];
  const debtEvidence = evidence.debt_liquidity ?? [];
  const eventsEvidence = evidence.acquisitions_major_events ?? [];
  const riskEvidence = evidence.management_commentary_risk_factors ?? [];

  return {
    promptVersion: "fixture-m3-v1",
    model: "fixture-dexter-m3",
    sources: ["dexter-native:financial_search", "dexter-native:read_filings", "dexter-native:web_search"],
    sectionScenarios: {
      qoq_yoy_changes: {
        status: "complete",
        summary:
          `${ticker} delivered balanced quarter-over-quarter and year-over-year growth, with cloud demand carrying the headline acceleration.`,
        evidence: qoqEvidence
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
      management_commentary_risk_factors: {
        status: "complete",
        summary:
          `Management commentary stayed constructive while still acknowledging execution and competitive risk factors for ${ticker}.`,
        evidence: riskEvidence
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
  const riskSection = base.sectionScenarios.management_commentary_risk_factors;

  return {
    ...base,
    sectionScenarios: {
      ...base.sectionScenarios,
      acquisitions_major_events: {
        status: "data_unavailable",
        summary: buildStatusBody(
          "Acquisitions and Major Events",
          "data_unavailable",
          "Approved source retrieval returned no reliable event record for the requested period."
        ),
        evidence: []
      },
      management_commentary_risk_factors: {
        status: "data_incomplete",
        summary: buildStatusBody(
          "Management Commentary and Risk Factors",
          "data_incomplete",
          "Only partial management commentary was available, so risk interpretation is intentionally constrained."
        ),
        evidence: riskSection ? riskSection.evidence.slice(0, 1) : []
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
  const riskSection = base.sectionScenarios.management_commentary_risk_factors;

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
      management_commentary_risk_factors: {
        ...(riskSection ?? {
          status: "data_incomplete",
          summary: buildStatusBody(
            "Management Commentary and Risk Factors",
            "data_incomplete",
            "Only partial management commentary was available."
          ),
          evidence: []
        }),
        evidence: riskSection ? riskSection.evidence.slice(0, 1) : []
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
    case "MSFT":
    default:
      return buildCompleteScenario(normalized);
  }
}
