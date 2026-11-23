// Deterministic Pulse brief (DECISIONS D4): the stored issue plus the user's research state.
// Copied from apps/product-api/src/pulse/report-builder.ts (withUserResearchState and its helpers) and
// pulse/common.ts (section, toEvidence). This is the old server's fallback when the worker brief is off or fails.
// No worker or LLM call. M3 later stores a personal brief per user; until then this is what /pulse/* serves.
import type {
  EvidenceItem,
  Loose,
  MarketPulseReport,
  ReportSection,
  UserResearchState,
} from "../reports/types.ts";

type UserResearchNameState = Loose;
type MarketPulsePortfolioRadarRow = Loose;

export function section(
  id: string,
  title: string,
  body: string,
  status: ReportSection["status"],
  evidence: EvidenceItem[],
): ReportSection {
  return {
    section_id: id,
    title,
    body,
    status,
    evidence,
  };
}

export function toEvidence(
  sourceType: EvidenceItem["source_type"],
  sourceName: string,
  excerpt: string,
  retrievedAt: string,
  url?: string,
): EvidenceItem {
  return {
    evidence_id: crypto.randomUUID(),
    source_type: sourceType,
    source_name: sourceName,
    excerpt,
    retrieved_at: retrievedAt,
    url,
  };
}

function researchStateEvidence(state: UserResearchState, name?: UserResearchNameState): EvidenceItem[] {
  return [
    toEvidence(
      "article",
      "User Research State",
      name
        ? `${name.ticker} research state refreshed for ${state.as_of}.`
        : `User research state refreshed for ${state.as_of}.`,
      state.generated_at,
    ),
  ];
}

function portfolioRowsFromResearchState(state: UserResearchState): MarketPulsePortfolioRadarRow[] {
  return state.names.slice(0, 12).map((name: UserResearchNameState): MarketPulsePortfolioRadarRow => ({
    ticker: name.ticker,
    company_name: name.company_name,
    direction: "flat",
    reason: name.what_changed,
    evidence: researchStateEvidence(state, name),
  }));
}

function sectionFromResearchNames(
  state: UserResearchState,
  sectionId: "portfolio_radar" | "what_changed" | "why_it_matters" | "what_to_watch",
): ReportSection | undefined {
  if (state.names.length === 0) {
    return undefined;
  }
  const names = state.names.slice(0, 5);
  const bodyBySection = {
    portfolio_radar: names
      .map((name: UserResearchNameState) => `${name.ticker}: ${name.summary}`)
      .join(" "),
    what_changed: names
      .map((name: UserResearchNameState) => `${name.ticker}: ${name.what_changed}`)
      .join(" "),
    why_it_matters: names
      .map((name: UserResearchNameState) => `${name.ticker}: ${name.why_it_matters}`)
      .join(" "),
    what_to_watch: names
      .map((name: UserResearchNameState) => `${name.ticker}: ${name.what_to_watch}`)
      .join(" "),
  } satisfies Record<typeof sectionId, string>;
  const titleBySection = {
    portfolio_radar: "Portfolio Radar",
    what_changed: "What Changed",
    why_it_matters: "Why It Matters",
    what_to_watch: "What To Watch",
  } satisfies Record<typeof sectionId, string>;
  return section(
    sectionId,
    titleBySection[sectionId],
    bodyBySection[sectionId],
    state.omissions.length > 0 ? "data_incomplete" : "complete",
    researchStateEvidence(state),
  );
}

export function withUserResearchState(
  report: MarketPulseReport,
  state?: UserResearchState,
): MarketPulseReport {
  if (!state) {
    return report;
  }
  const portfolioRows = portfolioRowsFromResearchState(state);
  const morningEdition = report.morning_edition
    ? {
      ...report.morning_edition,
      portfolio_radar: portfolioRows,
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
      ...(whatToWatchSection ? { what_to_watch: whatToWatchSection } : {}),
    },
  };
}
