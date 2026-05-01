import type {
  EvidenceItem,
  MarketPulseEditorialGeneration,
  MarketPulseEditorialItem,
  MarketPulseReport,
  MarketPulseWatchItem,
  ReportSection,
  UserResearchNameState
} from "../../../packages/contracts/src";
import { createOpenRouterChatCompletion } from "./openrouter-client";
import { buildPulseIssuePlan } from "./pulse-issue-plan";

export interface PulseLlmEditorialConfig {
  enabled: boolean;
  apiKey?: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  maxTokens: number;
  promptVersion: string;
}

export interface PulseLlmEditorialOptions {
  config: PulseLlmEditorialConfig;
  fetchImpl?: typeof fetch;
  now?: () => string;
}

interface PulseLlmEditorialDraft {
  headline: string;
  lede: string;
  what_changed: string;
  signal: string;
  noise: string;
  backdrop: string;
  your_names_summary?: string;
}

const bannedAdvicePattern =
  /\b(buy|sell|hold|short|long|price target|entry|exit|stop loss|take profit|trade now|add shares|trim shares|overweight|underweight|outperform|underperform)\b/i;

const allowedMacroTokens = new Set([
  "AI",
  "API",
  "CPI",
  "DXY",
  "ETF",
  "FOMC",
  "FX",
  "GDP",
  "HY",
  "PMI",
  "SEC",
  "USD",
  "VIX",
  "WTI"
]);

function plainText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function parseJsonObject(value: string): unknown {
  const trimmed = value.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(unfenced) as unknown;
}

function wordCount(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

function sentenceCount(value: string): number {
  return (value.match(/[.!?]+/g) ?? []).length || 1;
}

function evidenceIds(report: MarketPulseReport): string[] {
  const ids = new Set<string>();
  const sections = Object.values(report.sections) as ReportSection[];
  for (const section of sections) {
    for (const evidence of section.evidence ?? []) {
      ids.add(evidence.evidence_id);
    }
  }
  for (const evidence of report.editorial_issue?.evidence ?? []) {
    ids.add(evidence.evidence_id);
  }
  return [...ids].slice(0, 40);
}

function allowedTickers(report: MarketPulseReport): Set<string> {
  const values = new Set<string>();
  for (const ticker of report.user_research_state?.watchlist_tickers ?? []) {
    values.add(ticker.trim().toUpperCase());
  }
  for (const name of report.user_research_state?.names ?? []) {
    values.add(name.ticker.trim().toUpperCase());
  }
  for (const holding of report.user_research_state?.holdings ?? []) {
    values.add(holding.ticker.trim().toUpperCase());
  }
  return values;
}

function assertNoUnknownTickers(text: string, report: MarketPulseReport): string | undefined {
  const tickers = allowedTickers(report);
  if (tickers.size === 0) {
    return undefined;
  }
  const matches = [...text.matchAll(/(?:\$|\()([A-Z]{2,5})(?:\))?/g)].map((match) => match[1]);
  for (const match of matches) {
    if (!match) {
      continue;
    }
    if (!tickers.has(match) && !allowedMacroTokens.has(match)) {
      return `unsupported ticker or acronym ${match}`;
    }
  }
  return undefined;
}

function validateField(
  key: keyof PulseLlmEditorialDraft,
  text: string | undefined,
  report: MarketPulseReport,
  maxWords: number,
  maxSentences?: number
): string {
  const value = (text ?? "").trim();
  if (value.length < 5) {
    throw new Error(`LLM editorial output field ${key} is too short`);
  }
  if (wordCount(value) > maxWords) {
    throw new Error(`LLM editorial output field ${key} exceeds word budget`);
  }
  if (maxSentences && sentenceCount(value) > maxSentences) {
    throw new Error(`LLM editorial output field ${key} exceeds sentence budget`);
  }
  if (bannedAdvicePattern.test(value)) {
    throw new Error(`LLM editorial output field ${key} contains trading advice language`);
  }
  const unsupportedTicker = assertNoUnknownTickers(value, report);
  if (unsupportedTicker) {
    throw new Error(`LLM editorial output field ${key} contains ${unsupportedTicker}`);
  }
  return value;
}

function validateDraft(value: unknown, report: MarketPulseReport): PulseLlmEditorialDraft {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("LLM editorial output must be a JSON object");
  }
  const record = value as Record<string, unknown>;
  const draft: PulseLlmEditorialDraft = {
    headline: validateField("headline", plainText(record.headline, 90), report, 12),
    lede: validateField("lede", plainText(record.lede, 520), report, 80, 3),
    what_changed: validateField("what_changed", plainText(record.what_changed, 320), report, 50, 2),
    signal: validateField("signal", plainText(record.signal, 140), report, 15, 1),
    noise: validateField("noise", plainText(record.noise, 140), report, 15, 1),
    backdrop: validateField("backdrop", plainText(record.backdrop, 320), report, 60, 3),
    your_names_summary: plainText(record.your_names_summary, 220) || undefined
  };

  if (draft.your_names_summary) {
    validateField("your_names_summary", draft.your_names_summary, report, 30, 2);
  }
  if (wordCount(Object.values(draft).filter(Boolean).join(" ")) > 300) {
    throw new Error("LLM editorial output exceeds total word budget");
  }

  return draft;
}

function buildNameStateInput(names: UserResearchNameState[]): Array<Record<string, unknown>> {
  return names.slice(0, 12).map((name) => ({
    ticker: name.ticker,
    company_name: name.company_name,
    daily_delta: name.daily_delta.state,
    delta_title: name.daily_delta.title,
    summary: name.summary,
    what_changed: name.what_changed,
    why_it_matters: name.why_it_matters,
    what_to_watch: name.what_to_watch,
    omissions: name.omissions.map((omission) => `${omission.family}:${omission.code}`)
  }));
}

function buildEvidencePack(report: MarketPulseReport): Record<string, unknown> {
  const plan = buildPulseIssuePlan(report);
  return {
    report_id: report.report_id,
    cycle_end: report.cycle_end,
    flags: report.flags,
    delta: plan.delta,
    quiet_day: plan.quiet_day,
    deterministic_editorial: report.editorial_issue
      ? {
          headline: report.editorial_issue.headline,
          lede: report.editorial_issue.lead,
          what_changed: report.editorial_issue.what_changed.map((item) => item.body).slice(0, 3),
          signal_vs_noise: report.editorial_issue.signal_vs_noise.map((item) => item.body).slice(0, 2),
          backdrop: plan.backdrop_one_liner
        }
      : undefined,
    market_tape: report.market_tape
      ? {
          coverage_state: report.market_tape.coverage_state,
          summary: report.market_tape.summary,
          indices: report.market_tape.indices.map((item) => ({
            label: item.label,
            daily_change_pct: item.daily_change_pct,
            direction: item.direction
          })),
          sector_leadership: report.market_tape.sector_leadership
            ? {
                leaders: report.market_tape.sector_leadership.leaders.map((item) => ({
                  label: item.label,
                  daily_change_pct: item.daily_change_pct
                })),
                laggards: report.market_tape.sector_leadership.laggards.map((item) => ({
                  label: item.label,
                  daily_change_pct: item.daily_change_pct
                })),
                notable: report.market_tape.sector_leadership.notable
              }
            : undefined,
          cross_asset: report.market_tape.cross_asset.map((item) => ({
            family: item.family,
            label: item.label,
            daily_change_pct: item.daily_change_pct,
            direction: item.direction
          })),
          omissions: report.market_tape.omissions.map((item) => item.family)
        }
      : undefined,
    macro_stress: {
      state: report.macro_stress.state,
      summary: report.macro_stress.summary,
      inputs: report.macro_stress.inputs.map((input) => ({
        category: input.category,
        label: input.label,
        pressure: input.pressure,
        reason: input.reason
      }))
    },
    macro_news: report.macro_news
      ? {
          state: report.macro_news.state,
          lead: report.macro_news.lead,
          items: report.macro_news.items.map((item) => ({
            headline: item.headline,
            source_name: item.source_name,
            topic: item.topic,
            severity: item.severity,
            confirmation_state: item.confirmation_state,
            why_it_matters: item.why_it_matters
          }))
        }
      : undefined,
    headlines: report.morning_edition?.headline_digest.map((item) => ({
      headline: item.headline,
      source_name: item.source_name,
      published_at: item.published_at
    })),
    calendar: report.morning_edition?.today_catalysts.map((item) => ({
      time_label: item.time_label,
      title: item.title,
      category: item.category,
      impact: item.impact
    })),
    portfolio: buildNameStateInput(report.user_research_state?.names ?? []),
    portfolio_radar: report.morning_edition?.portfolio_radar.map((row) => ({
      ticker: row.ticker,
      company_name: row.company_name,
      change_pct: row.change_pct,
      reason: row.reason
    })),
    coverage_notes: [
      ...(report.editorial_issue?.coverage_notes ?? []),
      ...(report.morning_edition?.coverage_notes ?? []),
      ...(report.user_research_state?.omissions.map((item) => `${item.family}:${item.code}`) ?? [])
    ].slice(0, 12),
    evidence_ids: evidenceIds(report)
  };
}

function systemPrompt(): string {
  return [
    "You are Thesis Pulse's morning editor.",
    "RULES:",
    "1. You receive a JSON fact pack. Every number, ticker, date, and source in your output MUST come from this pack. Invent nothing.",
    "2. Write like the Financial Times, not like a blog. Short sentences. Active voice. No superlatives. No exclamation marks.",
    "3. Total output: under 300 words across all fields combined.",
    "4. If a section has no new data compared to yesterday, say so in 10 words or fewer rather than rephrasing the same information.",
    "5. Never use: buy, sell, hold, price target, entry, exit, stop loss, take profit, overweight, underweight, outperform, underperform.",
    "6. The reader has 3 minutes. Respect that.",
    "Return strict JSON only with keys: headline, lede, what_changed, signal, noise, backdrop, your_names_summary."
  ].join(" ");
}

function userPrompt(report: MarketPulseReport): string {
  return JSON.stringify({
    task: "Rewrite the Pulse issue as a compact newspaper-style morning briefing. Do not mutate data-bearing fields.",
    expected_json_shape: {
      headline: "12 words max, newspaper style, ALL CAPS",
      lede: "3 sentences max, 80 words max",
      what_changed: "2 sentences max, 50 words max, or No material change.",
      signal: "1 sentence, 15 words max",
      noise: "1 sentence, 15 words max",
      backdrop: "1 sentence if unchanged, 3 sentences if changed",
      your_names_summary: "optional, 1-2 sentences about portfolio exposure if names supplied"
    },
    evidence_pack: buildEvidencePack(report)
  });
}

function fallbackEvidence(report: MarketPulseReport): EvidenceItem[] {
  return report.editorial_issue?.evidence ?? report.sections.market_tape?.evidence ?? [];
}

function editorialItem(
  existing: MarketPulseEditorialItem | undefined,
  fallback: {
    kind: MarketPulseEditorialItem["kind"];
    title: string;
    body: string;
    evidence: EvidenceItem[];
  }
): MarketPulseEditorialItem {
  return {
    kind: existing?.kind ?? fallback.kind,
    title: existing?.title ?? fallback.title,
    body: fallback.body,
    freshness_state: existing?.freshness_state ?? "updated",
    importance: existing?.importance ?? "medium",
    evidence: existing?.evidence ?? fallback.evidence
  };
}

function watchItem(
  existing: MarketPulseWatchItem | undefined,
  fallback: {
    kind: MarketPulseWatchItem["kind"];
    title: string;
    body: string;
    evidence: EvidenceItem[];
  }
): MarketPulseWatchItem {
  return {
    kind: existing?.kind ?? fallback.kind,
    title: existing?.title ?? fallback.title,
    body: fallback.body,
    watch_date: existing?.watch_date,
    freshness_state: existing?.freshness_state ?? "updated",
    importance: existing?.importance ?? "medium",
    evidence: existing?.evidence ?? fallback.evidence
  };
}

function sectionWithBody(
  section: ReportSection | undefined,
  sectionId: string,
  title: string,
  body: string,
  evidence: EvidenceItem[]
): ReportSection {
  return {
    section_id: section?.section_id ?? sectionId,
    title: section?.title ?? title,
    body,
    status: section?.status ?? "complete",
    evidence: section?.evidence ?? evidence
  };
}

function normalizeHeadline(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 12)
    .join(" ")
    .toUpperCase();
}

function firstSentence(value: string): string {
  const match = value.match(/[^.!?]+[.!?]+/);
  return (match?.[0] ?? value).trim();
}

function applyQuietDayEditorial(report: MarketPulseReport): MarketPulseReport {
  if (!report.editorial_issue) {
    return report;
  }
  return applyDraft(
    report,
    {
      headline: "QUIET DAY. NO MATERIAL CHANGE.",
      lede: "No material change from yesterday's issue. Markets, macro pressure, and tracked context did not move enough to justify a larger story.",
      what_changed: "No material change.",
      signal: "No new signal emerged.",
      noise: "Unchanged index levels are not a story.",
      backdrop: buildPulseIssuePlan(report).backdrop_one_liner
    },
    undefined,
    undefined
  );
}

function applyDraft(
  report: MarketPulseReport,
  draft: PulseLlmEditorialDraft,
  config: PulseLlmEditorialConfig | undefined,
  generatedAt: string | undefined
): MarketPulseReport {
  if (!report.editorial_issue) {
    return report;
  }

  const evidence = fallbackEvidence(report);
  const whatChanged = editorialItem(report.editorial_issue.what_changed[0], {
    kind: "market_tape",
    title: "What changed",
    body: draft.what_changed,
    evidence
  });
  const signal = editorialItem(report.editorial_issue.signal_vs_noise[0], {
    kind: "context",
    title: "Signal",
    body: draft.signal,
    evidence
  });
  const noise = editorialItem(report.editorial_issue.signal_vs_noise[1], {
    kind: "context",
    title: "Noise",
    body: draft.noise,
    evidence
  });
  const watch = report.editorial_issue.what_to_watch.length > 0
    ? report.editorial_issue.what_to_watch
    : [
        watchItem(undefined, {
          kind: "calendar",
          title: "Next watch",
          body: "Watch the next scheduled catalyst in the calendar.",
          evidence
        })
      ];

  const editorialIssue = {
    ...report.editorial_issue,
    headline: normalizeHeadline(draft.headline),
    dek: firstSentence(draft.lede),
    lead: draft.lede,
    in_this_issue: [
      "The Tape",
      "What Changed",
      ...(report.morning_edition?.portfolio_radar.length ? ["Your Names"] : []),
      ...(report.morning_edition?.today_catalysts.length ? ["Today's Calendar"] : []),
      ...(report.morning_edition?.headline_digest.length || report.macro_news?.items.length ? ["Headlines Worth Knowing"] : []),
      "Signal vs Noise",
      "The Backdrop"
    ],
    what_changed: [whatChanged],
    why_it_matters: [
      editorialItem(report.editorial_issue.why_it_matters[0], {
        kind: "context",
        title: "Issue context",
        body: draft.your_names_summary ?? draft.lede,
        evidence
      })
    ],
    what_to_watch: watch,
    signal_vs_noise: [signal, noise]
  };

  const editorialGeneration: MarketPulseEditorialGeneration | undefined = config && generatedAt
    ? {
        mode: "llm",
        status: "generated",
        provider: "openrouter",
        model: config.model,
        prompt_version: config.promptVersion,
        generated_at: generatedAt,
        source_report_id: report.report_id,
        coverage_notes: [
          "LLM editorial pass rewrote narrative only; deterministic Pulse data remains authoritative."
        ]
      }
    : report.editorial_generation;

  return {
    ...report,
    editorial_issue: editorialIssue,
    editorial_generation: editorialGeneration,
    sections: {
      ...report.sections,
      what_changed: sectionWithBody(
        report.sections.what_changed,
        "what_changed",
        "What Changed",
        draft.what_changed,
        evidence
      ),
      signal_vs_noise: sectionWithBody(
        report.sections.signal_vs_noise,
        "signal_vs_noise",
        "Signal vs Noise",
        `Signal: ${draft.signal} Noise: ${draft.noise}`,
        evidence
      )
    }
  };
}

export async function applyPulseLlmEditorial(
  report: MarketPulseReport,
  options: PulseLlmEditorialOptions
): Promise<MarketPulseReport> {
  if (!report.editorial_issue) {
    return report;
  }
  const plan = buildPulseIssuePlan(report);
  if (plan.quiet_day) {
    return applyQuietDayEditorial(report);
  }

  const config = options.config;
  if (!config.enabled || !config.apiKey) {
    return report;
  }

  try {
    const content = await createOpenRouterChatCompletion({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt() },
        { role: "user", content: userPrompt(report) }
      ],
      timeoutMs: config.timeoutMs,
      maxTokens: Math.min(config.maxTokens, 600),
      temperature: 0.15,
      fetchImpl: options.fetchImpl
    });
    const draft = validateDraft(parseJsonObject(content), report);
    return applyDraft(report, draft, config, options.now?.() ?? new Date().toISOString());
  } catch {
    return report;
  }
}
