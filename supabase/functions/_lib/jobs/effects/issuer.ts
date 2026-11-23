// Issuer enrichment: fills report.issuer from the ticker registry and, when available, from the
// data-openbb structural context pack. The structural fetch is an optional dependency: data-openbb
// is gone in the new stack, so by default it returns undefined and only the registry merge runs.
import { logInfo } from "../../../_shared/log.ts";
import type { AnalysisReport } from "../types.ts";
import type { EffectsStore, FetchStructuralContext, IssuerMetadata, StructuralContextPack } from "./types.ts";

export const noStructuralContext: FetchStructuralContext = () => Promise.resolve(undefined);

export function mergeIssuerMetadata(report: AnalysisReport, issuer?: IssuerMetadata): AnalysisReport {
  const issuerName = issuer?.name?.trim();
  if (
    !issuerName &&
    !issuer?.exchange &&
    !issuer?.currency &&
    !issuer?.domicile_country &&
    !issuer?.region &&
    !issuer?.sector &&
    !issuer?.industry
  ) {
    return report;
  }

  const current = (report.issuer ?? undefined) as IssuerMetadata | undefined;
  const nextIssuer = {
    name: current?.name?.trim() || issuerName || "",
    exchange: current?.exchange?.trim() || issuer?.exchange?.trim() || undefined,
    currency: current?.currency?.trim() || issuer?.currency?.trim() || undefined,
    domicile_country: current?.domicile_country?.trim() || issuer?.domicile_country?.trim() || undefined,
    region: current?.region?.trim() || issuer?.region?.trim() || undefined,
    sector: current?.sector?.trim() || issuer?.sector?.trim() || undefined,
    industry: current?.industry?.trim() || issuer?.industry?.trim() || undefined,
  };
  if (!nextIssuer.name) {
    return report;
  }

  if (
    current?.name === nextIssuer.name &&
    current?.exchange === nextIssuer.exchange &&
    current?.currency === nextIssuer.currency &&
    current?.domicile_country === nextIssuer.domicile_country &&
    current?.region === nextIssuer.region &&
    current?.sector === nextIssuer.sector &&
    current?.industry === nextIssuer.industry
  ) {
    return report;
  }

  return { ...report, issuer: nextIssuer };
}

function appendUnique(values: string[], next: string): string[] {
  return values.includes(next) ? values : [...values, next];
}

interface DueDiligenceSection {
  section_id?: string;
  narrative_paragraphs: string[];
  key_points: string[];
  [key: string]: unknown;
}

export function mergeStructuralContextIntoDueDiligence(
  report: AnalysisReport,
  structuralContext: StructuralContextPack,
): AnalysisReport {
  const dueDiligence = report.due_diligence as
    | { sections: DueDiligenceSection[]; [key: string]: unknown }
    | undefined;
  if (!dueDiligence) {
    return { ...report, structural_context: report.structural_context ?? structuralContext };
  }

  const competitiveObservation = structuralContext.observations.find((entry) =>
    ["gdp_per_capita", "sector_mix", "education"].includes(entry.family)
  );
  const growthObservation = structuralContext.observations.find((entry) =>
    ["population", "infrastructure", "energy_access"].includes(entry.family)
  );
  const riskObservation = structuralContext.observations.find((entry) =>
    ["debt_context", "inequality", "inflation_regime", "public_debt"].includes(entry.family)
  );
  const imfOmission = structuralContext.omissions.find((entry) => entry.source_family === "imf");

  const nextSections = dueDiligence.sections.map((section) => {
    if (section.section_id === "competitive_positioning" && competitiveObservation) {
      return {
        ...section,
        narrative_paragraphs: appendUnique(
          section.narrative_paragraphs,
          `Structural context: ${competitiveObservation.summary}`,
        ),
        key_points: appendUnique(
          section.key_points,
          `${competitiveObservation.label} remains a relevant backdrop.`,
        ),
      };
    }

    if (section.section_id === "growth_opportunities_and_outlook" && growthObservation) {
      return {
        ...section,
        narrative_paragraphs: appendUnique(
          section.narrative_paragraphs,
          `Structural context: ${growthObservation.summary}`,
        ),
        key_points: appendUnique(
          section.key_points,
          `${growthObservation.label} helps frame the current opportunity set.`,
        ),
      };
    }

    if (section.section_id === "risks_and_challenges" && (riskObservation || imfOmission)) {
      const paragraph = riskObservation
        ? `Structural context: ${riskObservation.summary}`
        : `Coverage limitation: ${imfOmission?.reason_text}`;
      const keyPoint = riskObservation
        ? `${riskObservation.label} remains part of the macro risk frame.`
        : "IMF context remains intentionally non-blocking in this run.";
      return {
        ...section,
        narrative_paragraphs: appendUnique(section.narrative_paragraphs, paragraph),
        key_points: appendUnique(section.key_points, keyPoint),
      };
    }

    return section;
  });

  return {
    ...report,
    structural_context: report.structural_context ?? structuralContext,
    due_diligence: { ...dueDiligence, sections: nextSections },
  };
}

export async function enrichAnalysisReportIssuer(
  store: EffectsStore,
  report: AnalysisReport,
  options: { fetchStructuralContext?: FetchStructuralContext } = {},
): Promise<AnalysisReport> {
  if (!report.ticker) {
    return report;
  }

  const supportedTicker = await store.getSupportedTicker(report.ticker);
  if (!supportedTicker) {
    return report;
  }

  let nextReport = mergeIssuerMetadata(report, {
    name: supportedTicker.companyName,
    exchange: supportedTicker.exchange,
  });

  if (nextReport.structural_context?.subject_type === "issuer") {
    return mergeIssuerMetadata(nextReport, nextReport.structural_context.issuer_metadata);
  }

  const fetchStructuralContext = options.fetchStructuralContext ?? noStructuralContext;
  // The old fetch never threw (it logged and returned undefined); keep that contract for any injected fetcher.
  let structuralContext: StructuralContextPack | undefined;
  try {
    structuralContext = await fetchStructuralContext({
      ticker: report.ticker,
      subjectType: "issuer",
      asOf: report.generated_at.slice(0, 10),
    });
  } catch (error) {
    logInfo("Structural context fetch failed", {
      ticker: report.ticker,
      error_message: error instanceof Error ? error.message : String(error),
    });
    structuralContext = undefined;
  }
  if (!structuralContext) {
    return nextReport;
  }

  nextReport = mergeIssuerMetadata(nextReport, structuralContext.issuer_metadata);
  return mergeStructuralContextIntoDueDiligence(nextReport, structuralContext);
}
