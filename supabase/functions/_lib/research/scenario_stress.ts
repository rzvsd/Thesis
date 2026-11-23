// Scenario stress cards. Logic copied from apps/product-api/src/server.ts (AGENTS rule 3):
// template profiles, the deterministic per-ticker score, runScenarioStressEvaluation and the views.
import { createHash } from "node:crypto";
import type { ResearchStore } from "./store.ts";
import type {
  KillSwitchDirection,
  KillSwitchSignalType,
  ScenarioStressImpactRecord,
  ScenarioStressRuleSuggestionRecord,
  ScenarioStressRunRecord,
  ScenarioStressTemplateId,
  ScenarioStressTemplateRecord,
  ThesisMonitorSnapshotRecord,
} from "./types.ts";
import { clampNumber, createId, roundTo } from "./util.ts";

interface ScenarioStressTemplateProfile {
  scenarioId: ScenarioStressTemplateId;
  signalType: KillSwitchSignalType;
  direction: KillSwitchDirection;
  baseSensitivity: number;
  stressLeaders: string[];
  rationaleLead: string;
  conditionFragment: string;
}

const scenarioStressTemplateProfiles: Record<ScenarioStressTemplateId, ScenarioStressTemplateProfile> = {
  rates_higher_for_longer: {
    scenarioId: "rates_higher_for_longer",
    signalType: "macro_regime",
    direction: "above",
    baseSensitivity: 0.27,
    stressLeaders: ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META", "GOOG"],
    rationaleLead: "Long-duration valuation assumptions become fragile when rates remain elevated.",
    conditionFragment: "rate regime pressure persists and valuation support weakens",
  },
  recession_in_6m: {
    scenarioId: "recession_in_6m",
    signalType: "thesis_state",
    direction: "below",
    baseSensitivity: 0.31,
    stressLeaders: ["DIS", "NKE", "TGT", "HD", "LOW", "F", "GM", "AMZN"],
    rationaleLead: "Demand compression can invalidate growth and margin assumptions faster than expected.",
    conditionFragment: "demand softness persists and thesis confidence drops",
  },
  usd_up_10: {
    scenarioId: "usd_up_10",
    signalType: "macro_regime",
    direction: "above",
    baseSensitivity: 0.24,
    stressLeaders: ["AAPL", "MSFT", "NVDA", "KO", "PG", "MCD", "GOOG"],
    rationaleLead: "FX translation pressure can erode internationally exposed assumptions.",
    conditionFragment: "FX headwinds continue and international thesis assumptions deteriorate",
  },
  ai_hype_burst: {
    scenarioId: "ai_hype_burst",
    signalType: "news_sentiment",
    direction: "below",
    baseSensitivity: 0.34,
    stressLeaders: ["NVDA", "AMD", "MSFT", "GOOG", "META", "AAPL", "TSLA"],
    rationaleLead: "AI narrative resets can pressure both growth expectations and multiple support.",
    conditionFragment: "AI sentiment deteriorates and execution evidence turns mixed",
  },
  oil_120_spike: {
    scenarioId: "oil_120_spike",
    signalType: "macro_regime",
    direction: "above",
    baseSensitivity: 0.22,
    stressLeaders: ["DAL", "UAL", "AAL", "AMZN", "WMT", "TSLA", "F", "GM"],
    rationaleLead: "Energy cost shocks can quickly pressure margin and demand resilience assumptions.",
    conditionFragment: "energy-cost pressure persists and margin assumptions weaken",
  },
};

function deterministicUnit(seed: string): number {
  const digest = createHash("sha256").update(seed).digest("hex");
  const value = Number.parseInt(digest.slice(0, 12), 16);
  return value / 0xffffffffffff;
}

export function scenarioStressImpactLevelFromScore(
  score: number,
): "none" | "watch" | "elevated" | "high" | "critical" {
  if (score >= 0.86) return "critical";
  if (score >= 0.7) return "high";
  if (score >= 0.52) return "elevated";
  if (score >= 0.32) return "watch";
  return "none";
}

function scenarioStressThesisBreakLikelihoodFromScore(
  score: number,
): "low" | "moderate" | "high" | "very_high" {
  if (score >= 0.86) return "very_high";
  if (score >= 0.7) return "high";
  if (score >= 0.48) return "moderate";
  return "low";
}

export function scenarioStressScoreForTicker(input: {
  scenarioId: ScenarioStressTemplateId;
  ticker: string;
  asOf: string;
  snapshot?: ThesisMonitorSnapshotRecord;
}): number {
  const profile = scenarioStressTemplateProfiles[input.scenarioId];
  const ticker = input.ticker.trim().toUpperCase();
  const snapshot = input.snapshot;
  const monitorBias = snapshot
    ? snapshot.state === "unresolved"
      ? 0.22
      : snapshot.state === "weakened"
      ? 0.18
      : snapshot.state === "intact"
      ? -0.04
      : -0.07
    : 0.03;
  const freshnessBias = snapshot
    ? snapshot.freshnessState === "triggered"
      ? 0.24
      : snapshot.freshnessState === "stale"
      ? 0.12
      : snapshot.freshnessState === "aging"
      ? 0.06
      : -0.02
    : 0.02;
  const monitorScore = snapshot ? clampNumber(snapshot.score, 0, 1) : 0.5;
  const freshnessScore = snapshot ? clampNumber(snapshot.freshnessScore, 0, 1) : 0.5;
  const scoreBias = (1 - monitorScore) * 0.11;
  const freshnessScoreBias = (1 - freshnessScore) * 0.09;
  const leaderBias = profile.stressLeaders.includes(ticker) ? 0.16 : 0.04;
  const jitter = (deterministicUnit(`${input.scenarioId}:${ticker}:${input.asOf}`) - 0.5) * 0.08;
  const score = profile.baseSensitivity + leaderBias + monitorBias + freshnessBias + scoreBias +
    freshnessScoreBias + jitter;
  return roundTo(clampNumber(score, 0, 1), 4);
}

export async function runScenarioStressEvaluation(store: ResearchStore, input: {
  userId: string;
  scenarioId: ScenarioStressTemplateId;
  asOf: string;
  nowIso: string;
}): Promise<{
  run: ScenarioStressRunRecord;
  impacts: ScenarioStressImpactRecord[];
  suggestions: ScenarioStressRuleSuggestionRecord[];
}> {
  const profile = scenarioStressTemplateProfiles[input.scenarioId];
  const watchlist = (await store.listWatchlistTickersByUser(input.userId))
    .map((ticker) => ticker.trim().toUpperCase())
    .filter((ticker) => ticker.length > 0)
    .sort((left, right) => left.localeCompare(right));
  const snapshotsByTicker = new Map<string, ThesisMonitorSnapshotRecord>();
  for (const snapshot of await store.listThesisMonitorSnapshotsByUser(input.userId)) {
    snapshotsByTicker.set(snapshot.ticker.trim().toUpperCase(), snapshot);
  }

  const impacts: ScenarioStressImpactRecord[] = [];
  const suggestions: ScenarioStressRuleSuggestionRecord[] = [];

  for (const ticker of watchlist) {
    const snapshot = snapshotsByTicker.get(ticker);
    const stressScore = scenarioStressScoreForTicker({
      scenarioId: input.scenarioId,
      ticker,
      asOf: input.asOf,
      snapshot,
    });
    const impactLevel = scenarioStressImpactLevelFromScore(stressScore);
    if (impactLevel === "none") continue;
    const thesisBreakLikelihood = scenarioStressThesisBreakLikelihoodFromScore(stressScore);
    const monitorStateText = snapshot
      ? `${snapshot.state} / ${snapshot.freshnessState}`
      : "no monitor snapshot";
    const rationale =
      `${profile.rationaleLead} ${ticker} currently reads ${monitorStateText}, giving a stress score of ${
        roundTo(stressScore, 2)
      }.`;
    const evidenceRefs = snapshot
      ? [
        `monitor_state:${snapshot.state}`,
        `freshness_state:${snapshot.freshnessState}`,
        `monitor_score:${roundTo(clampNumber(snapshot.score, 0, 1), 2)}`,
        `freshness_score:${roundTo(clampNumber(snapshot.freshnessScore, 0, 1), 2)}`,
      ]
      : ["monitor_state:unavailable", "freshness_state:unavailable"];
    impacts.push({
      id: createId(),
      scenarioRunId: "",
      userId: input.userId,
      ticker,
      impactLevel,
      thesisBreakLikelihood,
      stressScore,
      rationale,
      evidenceRefs,
      createdAt: input.nowIso,
    });

    if (impactLevel === "elevated" || impactLevel === "high" || impactLevel === "critical") {
      suggestions.push({
        id: createId(),
        scenarioRunId: "",
        userId: input.userId,
        ticker,
        signalType: profile.signalType,
        direction: profile.direction,
        conditionText: `${ticker}: Add a scenario guardrail for ${profile.conditionFragment}.`,
        rationale:
          `${profile.rationaleLead} Suggested as review-only until the user confirms the condition wording.`,
        confidence: roundTo(clampNumber(stressScore * 0.88 + 0.08, 0, 1), 4),
        createdAt: input.nowIso,
      });
    }
  }

  const runId = createId();
  const impactsWithRun = impacts.map((impact) => ({ ...impact, scenarioRunId: runId }));
  const suggestionsWithRun = suggestions.map((suggestion) => ({ ...suggestion, scenarioRunId: runId }));
  const criticalCount = impactsWithRun.filter((impact) => impact.impactLevel === "critical").length;
  const highOrCriticalCount = impactsWithRun.filter(
    (impact) => impact.impactLevel === "high" || impact.impactLevel === "critical",
  ).length;
  const summary = impactsWithRun.length === 0
    ? `No critical scenario stress detected across ${watchlist.length} followed name(s).`
    : `${impactsWithRun.length} of ${watchlist.length} followed name(s) show stress under this scenario (${highOrCriticalCount} high/critical).`;

  const run = await store.createScenarioStressRun({
    id: runId,
    scenarioId: input.scenarioId,
    userId: input.userId,
    status: "completed",
    runMode: "manual",
    asOf: input.asOf,
    totalNames: watchlist.length,
    impactedNames: impactsWithRun.length,
    criticalNames: criticalCount,
    summary,
    createdAt: input.nowIso,
    completedAt: input.nowIso,
  });
  const createdImpacts = await store.createScenarioStressImpacts(impactsWithRun);
  const createdSuggestions = await store.createScenarioStressRuleSuggestions(suggestionsWithRun);
  return { run, impacts: createdImpacts, suggestions: createdSuggestions };
}

function routeTarget(input: {
  scenarioId: ScenarioStressTemplateId;
  scenarioRunId: string;
  ticker?: string;
  ruleId?: string;
}) {
  return {
    open_tab: "research" as const,
    scenario_id: input.scenarioId,
    scenario_run_id: input.scenarioRunId,
    ...(input.ticker ? { ticker: input.ticker } : {}),
    ...(input.ruleId ? { rule_id: input.ruleId } : {}),
  };
}

export function toScenarioStressTemplateView(record: ScenarioStressTemplateRecord) {
  return {
    scenario_id: record.templateId,
    title: record.title,
    summary: record.summary,
    hypothesis: record.hypothesis,
    active: record.isActive,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

export function buildScenarioStressRunResponse(input: {
  run: ScenarioStressRunRecord;
  impacts: ScenarioStressImpactRecord[];
  suggestions: ScenarioStressRuleSuggestionRecord[];
}) {
  const run = input.run;
  return {
    data: {
      run: {
        scenario_run_id: run.id,
        scenario_id: run.scenarioId,
        user_id: run.userId,
        status: run.status,
        run_mode: run.runMode,
        as_of: run.asOf,
        total_names: run.totalNames,
        impacted_names: run.impactedNames,
        critical_names: run.criticalNames,
        summary: run.summary,
        route: routeTarget({ scenarioId: run.scenarioId, scenarioRunId: run.id }),
        created_at: run.createdAt,
        completed_at: run.completedAt,
      },
      impacts: input.impacts.map((record) => ({
        scenario_impact_id: record.id,
        scenario_run_id: record.scenarioRunId,
        user_id: record.userId,
        ticker: record.ticker,
        impact_level: record.impactLevel,
        thesis_break_likelihood: record.thesisBreakLikelihood,
        stress_score: record.stressScore,
        rationale: record.rationale,
        evidence_refs: [...record.evidenceRefs],
        route: routeTarget({ scenarioId: run.scenarioId, scenarioRunId: run.id, ticker: record.ticker }),
        created_at: record.createdAt,
      })),
      rule_suggestions: input.suggestions.map((record) => ({
        scenario_rule_suggestion_id: record.id,
        scenario_run_id: record.scenarioRunId,
        user_id: record.userId,
        ticker: record.ticker,
        signal_type: record.signalType,
        direction: record.direction,
        condition_text: record.conditionText,
        rationale: record.rationale,
        confidence: record.confidence,
        route: routeTarget({
          scenarioId: run.scenarioId,
          scenarioRunId: run.id,
          ticker: record.ticker,
          ruleId: record.id,
        }),
        created_at: record.createdAt,
      })),
    },
  };
}
