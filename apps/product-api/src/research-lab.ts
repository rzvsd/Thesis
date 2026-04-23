import { randomUUID } from "node:crypto";

import type { AnalysisReport, MarketPulseReport } from "../../../packages/contracts/src";

export interface ResearchLabCheck {
  check_id: string;
  title: string;
  passed: boolean;
  detail: string;
}

export interface HistoricalReplayArtifact {
  artifact_id: string;
  as_of: string;
  generated_at: string;
  deep_dive: {
    report_id: string;
    ticker: string;
    structural_context_as_of?: string;
    enriched_sections: string[];
    checks: ResearchLabCheck[];
  };
  morning_exception_briefing: {
    report_id: string;
    pulse_date: string;
    structural_context_as_of?: string;
    macro_stress_as_of?: string;
    enriched_sections: string[];
    checks: ResearchLabCheck[];
  };
}

export interface ReplayEvaluationArtifact {
  artifact_id: string;
  replay_artifact_id: string;
  as_of: string;
  generated_at: string;
  score: number;
  max_score: number;
  verdict: "pass" | "fail";
  checks: ResearchLabCheck[];
}

export interface DebateExperimentArtifact {
  artifact_id: string;
  as_of: string;
  generated_at: string;
  mode: "internal_only";
  publish_blocked: true;
  publish_route: null;
  report_id: string;
  ticker: string;
  motions: string[];
  rounds: Array<{
    side: "thesis" | "challenge";
    text: string;
  }>;
  verdict: {
    outcome: "thesis_holds" | "challenge_wins" | "inconclusive";
    rationale: string;
  };
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isPeriodOnOrBeforeAsOf(period: string | undefined, asOf: string): boolean {
  if (!period) {
    return false;
  }
  if (/^\d{4}$/.test(period)) {
    return Number(period) <= Number(asOf.slice(0, 4));
  }
  if (/^\d{4}-Q[1-4]$/.test(period)) {
    const year = Number(period.slice(0, 4));
    const quarter = Number(period.slice(-1));
    const asOfYear = Number(asOf.slice(0, 4));
    const asOfQuarter = Math.floor((Number(asOf.slice(5, 7)) - 1) / 3) + 1;
    return year < asOfYear || (year === asOfYear && quarter <= asOfQuarter);
  }
  if (/^\d{4}-\d{2}$/.test(period)) {
    return period <= asOf.slice(0, 7);
  }
  return isIsoDate(period) && period <= asOf;
}

function structuralObservationChecks(
  periods: string[],
  asOf: string,
  title: string,
  checkId: string
): ResearchLabCheck {
  const invalidPeriods = periods.filter((period) => !isPeriodOnOrBeforeAsOf(period, asOf));
  return {
    check_id: checkId,
    title,
    passed: invalidPeriods.length === 0,
    detail:
      invalidPeriods.length === 0
        ? `All observed periods stayed on or before ${asOf}.`
        : `Observed future periods: ${invalidPeriods.join(", ")}.`
  };
}

function deepDiveEnrichedSections(report: AnalysisReport): string[] {
  return (report.due_diligence?.sections ?? [])
    .filter((section) =>
      section.narrative_paragraphs.some((paragraph) => paragraph.includes("Structural context:"))
    )
    .map((section) => section.section_id);
}

function pulseEnrichedSections(report: MarketPulseReport): string[] {
  const sections: string[] = [];
  if (report.sections.official_macro_pressure.body.includes("Coverage note:")) {
    sections.push("official_macro_pressure");
  }
  if (
    report.sections.official_macro_pressure.body.includes("GDP") ||
    report.sections.official_macro_pressure.body.includes("Debt")
  ) {
    if (!sections.includes("official_macro_pressure")) {
      sections.push("official_macro_pressure");
    }
  }
  if (
    report.sections.bounded_context.body.includes("Population") ||
    report.sections.bounded_context.body.includes("Infrastructure") ||
    report.sections.bounded_context.body.includes("Coverage note:")
  ) {
    sections.push("bounded_context");
  }
  return sections;
}

export function buildHistoricalReplayArtifact(input: {
  asOf: string;
  deepDive: AnalysisReport;
  marketPulse: MarketPulseReport;
}): HistoricalReplayArtifact {
  const deepDiveSections = deepDiveEnrichedSections(input.deepDive);
  const pulseSections = pulseEnrichedSections(input.marketPulse);

  const deepDiveChecks: ResearchLabCheck[] = [
    {
      check_id: "deep-dive-structural-as-of",
      title: "Deep Dive structural context is time-bounded",
      passed: input.deepDive.structural_context?.as_of === input.asOf,
      detail:
        input.deepDive.structural_context?.as_of === input.asOf
          ? `Deep Dive structural context is pinned to ${input.asOf}.`
          : `Expected ${input.asOf}, received ${input.deepDive.structural_context?.as_of ?? "missing"}.`
    },
    structuralObservationChecks(
      (input.deepDive.structural_context?.observations ?? []).map((entry) => entry.period),
      input.asOf,
      "Deep Dive observations avoid look-ahead leakage",
      "deep-dive-observation-periods"
    ),
    {
      check_id: "deep-dive-due-diligence-enriched",
      title: "Deep Dive due-diligence sections were structurally enriched",
      passed: deepDiveSections.length >= 3,
      detail:
        deepDiveSections.length >= 3
          ? `Enriched sections: ${deepDiveSections.join(", ")}.`
          : `Expected at least 3 enriched sections, found ${deepDiveSections.length}.`
    }
  ];

  const pulseChecks: ResearchLabCheck[] = [
    {
      check_id: "pulse-structural-as-of",
      title: "Morning briefing structural context is time-bounded",
      passed: input.marketPulse.structural_context?.as_of === input.asOf,
      detail:
        input.marketPulse.structural_context?.as_of === input.asOf
          ? `Morning briefing structural context is pinned to ${input.asOf}.`
          : `Expected ${input.asOf}, received ${input.marketPulse.structural_context?.as_of ?? "missing"}.`
    },
    structuralObservationChecks(
      (input.marketPulse.structural_context?.observations ?? []).map((entry) => entry.period),
      input.asOf,
      "Morning briefing observations avoid look-ahead leakage",
      "pulse-observation-periods"
    ),
    {
      check_id: "pulse-macro-as-of",
      title: "Macro Stress keeps the requested as_of date",
      passed: input.marketPulse.macro_stress.as_of === input.asOf,
      detail:
        input.marketPulse.macro_stress.as_of === input.asOf
          ? `Macro Stress stayed on ${input.asOf}.`
          : `Expected ${input.asOf}, received ${input.marketPulse.macro_stress.as_of}.`
    },
    {
      check_id: "pulse-briefing-enriched",
      title: "Morning briefing sections were structurally enriched",
      passed: pulseSections.length >= 2,
      detail:
        pulseSections.length >= 2
          ? `Enriched sections: ${pulseSections.join(", ")}.`
          : `Expected both briefing sections to be enriched, found ${pulseSections.join(", ") || "none"}.`
    }
  ];

  return {
    artifact_id: `replay-${randomUUID()}`,
    as_of: input.asOf,
    generated_at: new Date().toISOString(),
    deep_dive: {
      report_id: input.deepDive.report_id,
      ticker: input.deepDive.ticker ?? "UNKNOWN",
      structural_context_as_of: input.deepDive.structural_context?.as_of,
      enriched_sections: deepDiveSections,
      checks: deepDiveChecks
    },
    morning_exception_briefing: {
      report_id: input.marketPulse.report_id,
      pulse_date: input.marketPulse.generated_at.slice(0, 10),
      structural_context_as_of: input.marketPulse.structural_context?.as_of,
      macro_stress_as_of: input.marketPulse.macro_stress.as_of,
      enriched_sections: pulseSections,
      checks: pulseChecks
    }
  };
}

export function buildReplayEvaluationArtifact(
  artifact: HistoricalReplayArtifact
): ReplayEvaluationArtifact {
  const checks = [...artifact.deep_dive.checks, ...artifact.morning_exception_briefing.checks];
  const score = checks.filter((check) => check.passed).length;
  return {
    artifact_id: `eval-${randomUUID()}`,
    replay_artifact_id: artifact.artifact_id,
    as_of: artifact.as_of,
    generated_at: new Date().toISOString(),
    score,
    max_score: checks.length,
    verdict: score === checks.length ? "pass" : "fail",
    checks
  };
}

export function buildDebateExperimentArtifact(input: {
  asOf: string;
  report: AnalysisReport;
}): DebateExperimentArtifact {
  const thesisText =
    input.report.story_header?.thesis_summary ??
    input.report.investment_memo?.sections[0]?.narrative ??
    input.report.sections[0]?.body ??
    "The core thesis remains under review.";
  const challengeText =
    input.report.due_diligence?.sections.find((section) => section.section_id === "risks_and_challenges")
      ?.narrative_paragraphs[0] ??
    input.report.investment_memo?.sections.find((section) => section.section_id === "risks")?.narrative ??
    "The challenge case remains inconclusive because the risk stack is thin.";
  const signalValue = input.report.signal?.value ?? "neutral";
  const outcome =
    signalValue === "negative"
      ? "challenge_wins"
      : signalValue === "positive"
        ? "thesis_holds"
        : "inconclusive";

  return {
    artifact_id: `debate-${randomUUID()}`,
    as_of: input.asOf,
    generated_at: new Date().toISOString(),
    mode: "internal_only",
    publish_blocked: true,
    publish_route: null,
    report_id: input.report.report_id,
    ticker: input.report.ticker ?? "UNKNOWN",
    motions: [
      "Does the current structural context strengthen the original thesis?",
      "Would the current risk stack overturn the thesis if conditions worsen?"
    ],
    rounds: [
      {
        side: "thesis",
        text: thesisText
      },
      {
        side: "challenge",
        text: challengeText
      }
    ],
    verdict: {
      outcome,
      rationale:
        outcome === "thesis_holds"
          ? "The experiment kept the thesis side ahead, but the artifact is explicitly internal-only."
          : outcome === "challenge_wins"
            ? "The challenge side surfaced the dominant risk case, and publishing remains blocked."
            : "The debate stayed inconclusive, so the artifact remains internal-only and non-publishable."
    }
  };
}
