// Issuer enrichment for a Deep Dive read (GET /reports/:id and /r/:token). Copied from apps/product-api/src/server.ts
// (enrichAnalysisReportIssuer, mergeIssuerMetadata, fetchStructuralContext, mergeStructuralContextIntoDueDiligence).
// The old server asked data-openbb for structural context. That service is not part of the rebuild, so the fetch
// runs only when MARKET_PULSE_DATA_OPENBB_BASE_URL is set; otherwise it returns undefined, the old degrade path.
import { env } from "../../_shared/env.ts";
import { logError } from "../../_shared/log.ts";
import type { AnalysisReport, Loose, StructuralContextPack } from "./types.ts";

export interface SupportedTicker {
  companyName: string;
  exchange: string;
}

export interface IssuerDeps {
  getSupportedTicker: (symbol: string) => Promise<SupportedTicker | undefined>;
  fetchStructuralContext: (input: {
    ticker?: string;
    country?: string;
    subjectType?: "issuer" | "market_pulse";
    asOf?: string;
  }) => Promise<StructuralContextPack | undefined>;
}

export async function enrichAnalysisReportIssuer(
  deps: IssuerDeps,
  report: AnalysisReport,
): Promise<AnalysisReport> {
  if (!report.ticker) {
    return report;
  }

  const supportedTicker = await deps.getSupportedTicker(report.ticker);
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

  const structuralContext = await deps.fetchStructuralContext({
    ticker: report.ticker,
    subjectType: "issuer",
    asOf: report.generated_at.slice(0, 10),
  });
  if (!structuralContext) {
    return nextReport;
  }

  nextReport = mergeIssuerMetadata(nextReport, structuralContext.issuer_metadata);
  return mergeStructuralContextIntoDueDiligence(nextReport, structuralContext);
}

export function mergeIssuerMetadata(
  report: AnalysisReport,
  issuer?: {
    name?: string;
    exchange?: string;
    currency?: string;
    domicile_country?: string;
    region?: string;
    sector?: string;
    industry?: string;
  },
): AnalysisReport {
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

  const nextIssuer = {
    name: report.issuer?.name?.trim() || issuerName || "",
    exchange: report.issuer?.exchange?.trim() || issuer?.exchange?.trim() || undefined,
    currency: report.issuer?.currency?.trim() || issuer?.currency?.trim() || undefined,
    domicile_country: report.issuer?.domicile_country?.trim() || issuer?.domicile_country?.trim() ||
      undefined,
    region: report.issuer?.region?.trim() || issuer?.region?.trim() || undefined,
    sector: report.issuer?.sector?.trim() || issuer?.sector?.trim() || undefined,
    industry: report.issuer?.industry?.trim() || issuer?.industry?.trim() || undefined,
  };
  if (!nextIssuer.name) {
    return report;
  }

  if (
    report.issuer?.name === nextIssuer.name &&
    report.issuer?.exchange === nextIssuer.exchange &&
    report.issuer?.currency === nextIssuer.currency &&
    report.issuer?.domicile_country === nextIssuer.domicile_country &&
    report.issuer?.region === nextIssuer.region &&
    report.issuer?.sector === nextIssuer.sector &&
    report.issuer?.industry === nextIssuer.industry
  ) {
    return report;
  }

  return {
    ...report,
    issuer: nextIssuer,
  };
}

export async function fetchStructuralContext(
  input: {
    ticker?: string;
    country?: string;
    subjectType?: "issuer" | "market_pulse";
    asOf?: string;
  },
): Promise<StructuralContextPack | undefined> {
  const baseUrl = env("MARKET_PULSE_DATA_OPENBB_BASE_URL");
  if (!baseUrl) {
    return undefined;
  }
  const params = new URLSearchParams();
  if (input.ticker) {
    params.set("ticker", input.ticker);
  }
  if (input.country) {
    params.set("country", input.country);
  }
  if (input.subjectType) {
    params.set("subject_type", input.subjectType);
  }
  if (input.asOf) {
    params.set("as_of", input.asOf);
  }

  try {
    const response = await fetch(`${baseUrl}/v1/official/structural?${params.toString()}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      logError("Structural context fetch degraded", { status_code: response.status });
      return undefined;
    }
    const payload = (await response.json()) as { ok?: boolean; data?: StructuralContextPack };
    if (!payload.ok || !payload.data) {
      logError("Structural context payload missing data");
      return undefined;
    }
    return payload.data;
  } catch {
    logError("Structural context fetch failed");
    return undefined;
  }
}

function appendUniqueParagraph(paragraphs: string[], nextParagraph: string): string[] {
  if (paragraphs.includes(nextParagraph)) {
    return paragraphs;
  }
  return [...paragraphs, nextParagraph];
}

function appendUniqueKeyPoint(points: string[], nextPoint: string): string[] {
  if (points.includes(nextPoint)) {
    return points;
  }
  return [...points, nextPoint];
}

export function mergeStructuralContextIntoDueDiligence(
  report: AnalysisReport,
  structuralContext: StructuralContextPack,
): AnalysisReport {
  if (!report.due_diligence) {
    return {
      ...report,
      structural_context: report.structural_context ?? structuralContext,
    };
  }

  const competitiveObservation = structuralContext.observations.find((entry: Loose) =>
    ["gdp_per_capita", "sector_mix", "education"].includes(entry.family)
  );
  const growthObservation = structuralContext.observations.find((entry: Loose) =>
    ["population", "infrastructure", "energy_access"].includes(entry.family)
  );
  const riskObservation = structuralContext.observations.find((entry: Loose) =>
    ["debt_context", "inequality", "inflation_regime", "public_debt"].includes(entry.family)
  );
  const imfOmission = structuralContext.omissions.find((entry: Loose) => entry.source_family === "imf");

  const nextSections = report.due_diligence.sections.map((section: Loose) => {
    if (section.section_id === "competitive_positioning" && competitiveObservation) {
      const paragraph = `Structural context: ${competitiveObservation.summary}`;
      return {
        ...section,
        narrative_paragraphs: appendUniqueParagraph(section.narrative_paragraphs, paragraph),
        key_points: appendUniqueKeyPoint(
          section.key_points,
          `${competitiveObservation.label} remains a relevant backdrop.`,
        ),
      };
    }

    if (section.section_id === "growth_opportunities_and_outlook" && growthObservation) {
      const paragraph = `Structural context: ${growthObservation.summary}`;
      return {
        ...section,
        narrative_paragraphs: appendUniqueParagraph(section.narrative_paragraphs, paragraph),
        key_points: appendUniqueKeyPoint(
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
        narrative_paragraphs: appendUniqueParagraph(section.narrative_paragraphs, paragraph),
        key_points: appendUniqueKeyPoint(section.key_points, keyPoint),
      };
    }

    return section;
  });

  return {
    ...report,
    structural_context: report.structural_context ?? structuralContext,
    due_diligence: {
      ...report.due_diligence,
      sections: nextSections,
    },
  };
}
