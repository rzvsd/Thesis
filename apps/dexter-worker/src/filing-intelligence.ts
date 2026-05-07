import type {
  CanonicalFinancialSnapshot,
  CanonicalTranscript,
  EvidenceItem,
  FilingIntelligenceBlock,
  FilingIntelligenceComparisonBasis,
  FilingIntelligenceDirection,
  FilingIntelligenceLanguageDelta,
  FilingIntelligenceMemo,
  FilingIntelligenceMetricDelta,
  FilingIntelligenceOmission
} from "../../../packages/contracts/src";

import type { DexterConfig } from "./config";
import { runLiveDexterQuery } from "./live-dexter";

const promptVersion = "ph7-m11-filing-intelligence-v1";

type SnapshotDataKey =
  | "revenue"
  | "gross_margin"
  | "operating_margin"
  | "free_cash_flow"
  | "capital_expenditure"
  | "cash_and_equivalents"
  | "debt_total"
  | "shares_outstanding";

interface FilingMetricDefinition {
  key: SnapshotDataKey;
  label: string;
  unit: FilingIntelligenceMetricDelta["unit"];
  positiveDirection: "higher" | "lower" | "mixed";
  plainName: string;
}

interface BuildFilingIntelligenceInput {
  ticker: string;
  generatedAt: string;
  latest?: CanonicalFinancialSnapshot;
  priorQuarter?: CanonicalFinancialSnapshot;
  yearAgo?: CanonicalFinancialSnapshot;
  financials: CanonicalFinancialSnapshot[];
  latestTranscript?: CanonicalTranscript;
  fixtureMode: boolean;
}

const metricDefinitions: FilingMetricDefinition[] = [
  {
    key: "revenue",
    label: "Revenue",
    unit: "currency",
    positiveDirection: "higher",
    plainName: "sales"
  },
  {
    key: "gross_margin",
    label: "Gross margin",
    unit: "pct",
    positiveDirection: "higher",
    plainName: "gross profit retained from each dollar of sales"
  },
  {
    key: "operating_margin",
    label: "Operating margin",
    unit: "pct",
    positiveDirection: "higher",
    plainName: "operating profit retained after running the business"
  },
  {
    key: "free_cash_flow",
    label: "Free cash flow",
    unit: "currency",
    positiveDirection: "higher",
    plainName: "cash left after operating needs and capital spending"
  },
  {
    key: "capital_expenditure",
    label: "Capital expenditure",
    unit: "currency",
    positiveDirection: "mixed",
    plainName: "investment spending"
  },
  {
    key: "cash_and_equivalents",
    label: "Cash and equivalents",
    unit: "currency",
    positiveDirection: "higher",
    plainName: "liquidity cushion"
  },
  {
    key: "debt_total",
    label: "Total debt",
    unit: "currency",
    positiveDirection: "lower",
    plainName: "balance-sheet leverage"
  },
  {
    key: "shares_outstanding",
    label: "Shares outstanding",
    unit: "count",
    positiveDirection: "lower",
    plainName: "share count and dilution"
  }
];

const bannedNarrativePattern =
  /\b(buy|sell|hold|short|long|price target|entry|exit|stop loss|take profit|trade now|add shares|trim shares|overweight|underweight|outperform|underperform|position size|allocation)\b/i;

function metricValue(snapshot: CanonicalFinancialSnapshot | undefined, key: SnapshotDataKey): number | undefined {
  const value = snapshot?.data[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function safePercentChange(current: number | undefined, reference: number | undefined): number | undefined {
  if (
    current === undefined ||
    reference === undefined ||
    !Number.isFinite(current) ||
    !Number.isFinite(reference) ||
    reference === 0
  ) {
    return undefined;
  }
  return ((current - reference) / Math.abs(reference)) * 100;
}

function classifyDirection(
  definition: FilingMetricDefinition,
  delta: number | undefined
): FilingIntelligenceDirection {
  if (delta === undefined) {
    return "unavailable";
  }
  const tolerance = definition.unit === "pct" ? 0.05 : 0;
  if (Math.abs(delta) <= tolerance) {
    return "unchanged";
  }
  if (definition.positiveDirection === "mixed") {
    return "mixed";
  }
  if (definition.positiveDirection === "higher") {
    return delta > 0 ? "improved" : "weakened";
  }
  return delta < 0 ? "improved" : "weakened";
}

function filingForm(snapshot: CanonicalFinancialSnapshot | undefined): FilingIntelligenceBlock["latest_filing"] {
  if (!snapshot) {
    return undefined;
  }
  return {
    form: snapshot.period_type === "annual" ? "10-K" : "10-Q",
    period: snapshot.period,
    fiscal_year: snapshot.fiscal_year,
    fiscal_quarter: snapshot.fiscal_quarter,
    filing_date: snapshot.filing_date
  };
}

function evidenceForSnapshot(
  snapshot: CanonicalFinancialSnapshot,
  retrievedAt: string,
  suffix: string
): EvidenceItem {
  return {
    evidence_id: `sec-xbrl-${snapshot.ticker.toLowerCase()}-${suffix}-${snapshot.period.toLowerCase()}`,
    source_type: "filing",
    source_name: `SEC companyfacts/XBRL ${snapshot.period_type} snapshot`,
    excerpt:
      `${snapshot.ticker} ${snapshot.period} ${snapshot.period_type} SEC-backed financial snapshot; ` +
      `available metrics include ${Object.keys(snapshot.data).slice(0, 8).join(", ")}.`,
    retrieved_at: snapshot.retrieved_at || retrievedAt
  };
}

function evidenceForTranscript(
  transcript: CanonicalTranscript,
  retrievedAt: string
): EvidenceItem {
  return {
    evidence_id: `management-commentary-${transcript.ticker.toLowerCase()}-${transcript.period.toLowerCase()}`,
    source_type: "article",
    source_name: "Reviewed management commentary",
    excerpt: transcript.body_text.slice(0, 400),
    retrieved_at: transcript.retrieved_at || retrievedAt
  };
}

function buildMetricDelta(args: {
  definition: FilingMetricDefinition;
  latest: CanonicalFinancialSnapshot;
  reference?: CanonicalFinancialSnapshot;
  basis: FilingIntelligenceComparisonBasis;
  currentEvidenceId: string;
  referenceEvidenceId?: string;
}): FilingIntelligenceMetricDelta {
  const currentValue = metricValue(args.latest, args.definition.key);
  const referenceValue = metricValue(args.reference, args.definition.key);
  const delta =
    currentValue !== undefined && referenceValue !== undefined
      ? currentValue - referenceValue
      : undefined;
  const deltaPct =
    args.definition.unit === "pct"
      ? delta
      : safePercentChange(currentValue, referenceValue);
  const direction = classifyDirection(args.definition, delta);
  const basisLabel =
    args.basis === "qoq"
      ? "the prior quarter"
      : args.basis === "yoy"
        ? "the same quarter last year"
        : "the prior annual filing";
  const evidenceRefs = [args.currentEvidenceId, args.referenceEvidenceId].filter(
    (entry): entry is string => typeof entry === "string" && entry.length > 0
  );

  return {
    metric: args.definition.key,
    label: args.definition.label,
    basis: args.basis,
    current_period: args.latest.period,
    reference_period: args.reference?.period,
    current_value: currentValue,
    reference_value: referenceValue,
    delta,
    delta_pct: deltaPct,
    unit: args.definition.unit,
    direction,
    plain_english:
      direction === "unavailable"
        ? `${args.definition.label} cannot be compared because one side of the ${basisLabel} comparison is missing.`
        : `${args.definition.label} ${delta && delta > 0 ? "increased" : delta && delta < 0 ? "declined" : "was broadly unchanged"} versus ${basisLabel}. In plain English, this is the ${args.definition.plainName} line moving, not a market-price opinion.`,
    why_it_matters:
      args.definition.key === "revenue"
        ? "Revenue tells us whether the company is expanding the top of the income statement before margins do any work."
        : args.definition.key === "free_cash_flow"
          ? "Free cash flow shows whether reported profit is turning into money the business can actually use."
          : args.definition.key === "debt_total"
            ? "Debt changes tell us whether growth is being supported by a stronger or heavier balance sheet."
            : args.definition.key === "shares_outstanding"
              ? "Share count matters because dilution or buybacks change how much of the business each share represents."
              : `${args.definition.label} matters because it helps separate headline growth from the economics underneath it.`,
    evidence_refs: evidenceRefs
  };
}

function annualPair(financials: CanonicalFinancialSnapshot[]): {
  latestAnnual?: CanonicalFinancialSnapshot;
  priorAnnual?: CanonicalFinancialSnapshot;
} {
  const annuals = financials
    .filter((snapshot) => snapshot.period_type === "annual")
    .sort((left, right) => right.fiscal_year - left.fiscal_year);
  return {
    latestAnnual: annuals[0],
    priorAnnual: annuals[1]
  };
}

function buildSegmentDeltas(args: {
  latest: CanonicalFinancialSnapshot;
  reference?: CanonicalFinancialSnapshot;
  evidenceRefs: string[];
}): FilingIntelligenceMetricDelta[] {
  const referenceSegments = new Map(
    (args.reference?.segments ?? []).map((segment) => [segment.segment_name.toLowerCase(), segment])
  );

  return (args.latest.segments ?? [])
    .map((segment) => {
      const reference = referenceSegments.get(segment.segment_name.toLowerCase());
      const currentValue = typeof segment.revenue === "number" ? segment.revenue : undefined;
      const referenceValue = typeof reference?.revenue === "number" ? reference.revenue : undefined;
      const delta =
        currentValue !== undefined && referenceValue !== undefined
          ? currentValue - referenceValue
          : undefined;
      return {
        metric: `segment_revenue:${segment.segment_name}`,
        label: `${segment.segment_name} revenue`,
        basis: "qoq" as const,
        current_period: args.latest.period,
        reference_period: args.reference?.period,
        current_value: currentValue,
        reference_value: referenceValue,
        delta,
        delta_pct: safePercentChange(currentValue, referenceValue),
        unit: "currency" as const,
        direction: classifyDirection(
          {
            key: "revenue",
            label: "Segment revenue",
            unit: "currency",
            positiveDirection: "higher",
            plainName: "segment sales"
          },
          delta
        ),
        plain_english:
          `${segment.segment_name} is separated because a company can look stable overall while the mix underneath changes.`,
        why_it_matters:
          "Segment mix tells the reader which parts of the company are carrying the filing, instead of treating one revenue total as the whole story.",
        evidence_refs: args.evidenceRefs
      };
    })
    .slice(0, 6);
}

function sentenceList(items: string[]): string {
  if (items.length === 0) {
    return "No reviewed item crossed a clean comparison threshold.";
  }
  return items.join(" ");
}

function buildDeterministicMemo(args: {
  ticker: string;
  latest?: CanonicalFinancialSnapshot;
  metricDeltas: FilingIntelligenceMetricDelta[];
  segmentDeltas: FilingIntelligenceMetricDelta[];
  languageDeltas: FilingIntelligenceLanguageDelta[];
  omissions: FilingIntelligenceOmission[];
}): FilingIntelligenceMemo {
  const improved = args.metricDeltas.filter((delta) => delta.direction === "improved");
  const weakened = args.metricDeltas.filter((delta) => delta.direction === "weakened");
  const available = args.metricDeltas.filter((delta) => delta.direction !== "unavailable");
  const topImproved = improved.slice(0, 3).map((delta) => `${delta.label} improved on a ${delta.basis.toUpperCase()} basis.`);
  const topWeakened = weakened.slice(0, 3).map((delta) => `${delta.label} weakened on a ${delta.basis.toUpperCase()} basis.`);
  const firstSegmentDelta = args.segmentDeltas[0];
  const firstLanguageDelta = args.languageDeltas[0];
  const firstWeakenedDelta = weakened[0];
  const segmentLine = args.segmentDeltas.length > 0
    ? `The segment layer is useful because ${firstSegmentDelta?.label ?? "segment revenue"} gives a cleaner clue about business mix than the company total alone.`
    : "The segment layer is not complete enough to claim which business line carried the filing.";
  const textGap = args.omissions.some((omission) => omission.reason_code === "missing_filing_text");

  return {
    the_filing_read:
      `${args.ticker} is being read through its latest SEC-backed financial snapshot, with the memo focused on what changed rather than on generic company description. ` +
      `${available.length > 0 ? sentenceList([...topImproved, ...topWeakened].slice(0, 4)) : "The filing comparison is limited because too many core values are missing."} ` +
      `${segmentLine} ${textGap ? "Full filing-language extraction is still marked as an omission, so tone is treated cautiously rather than dressed up as certainty." : "The language layer is available enough to compare what management emphasized."}`,
    what_changed:
      `${available.length > 0 ? "The cleanest changes are the metrics that moved across both the quarter and year-ago comparisons." : "The main change is actually a coverage fact: the available data does not yet support a strong comparative read."} ` +
      `${sentenceList([...topImproved, ...topWeakened].slice(0, 5))} The memo keeps those changes separate from market-price movement, because a better filing and a better stock day are not the same thing.`,
    the_good:
      improved.length > 0
        ? `${improved.slice(0, 3).map((delta) => delta.plain_english).join(" ")} That is the constructive side: the filing has at least one measurable line moving in the right direction.`
        : "The good news is mostly discipline: the memo does not force a positive claim when the reviewed filing data is thin or unavailable.",
    the_bad:
      weakened.length > 0
        ? `${weakened.slice(0, 3).map((delta) => delta.plain_english).join(" ")} That is the pressure point because deterioration in core filing lines usually needs confirmation or reversal in the next period.`
        : "The bad side is less about an obvious deterioration and more about missing confirmation. Without complete filing text and all comparison periods, the memo cannot overstate quality.",
    the_interesting:
      `${segmentLine} The interesting filing question is whether the same story appears in more than one place: revenue, margins, cash flow, balance sheet, and management language. When those agree, the memo can speak more firmly; when they do not, the right answer is curiosity, not theater.`,
    management_tone:
      firstLanguageDelta
        ? `${firstLanguageDelta.plain_english} This is treated as management context, not proof by itself. The numbers still own the memo.`
        : "Management tone is intentionally limited because reviewed filing sections were not available as clean text. That omission matters: tone should explain the numbers, not replace them.",
    risk_watch:
      firstWeakenedDelta
        ? `Watch whether ${firstWeakenedDelta.label.toLowerCase()} keeps moving against the thesis in the next filing. One weak line can be noise; repetition across quarters is the real risk.`
        : "Watch for confirmation in the next filing: repeated margin strength, cash conversion, segment mix, and any risk-factor language that becomes more specific.",
    plain_english_takeaway:
      "Plain English: this memo reads the filing like a business update, not like a quote screen. The first question is what changed inside the company; the second is whether that change is large enough and well-supported enough to matter.",
    what_to_watch_next:
      "Next filing, the useful checks are simple: did revenue keep converting into profit, did cash flow follow earnings, did debt or share count move the wrong way, and did management language become more cautious or more specific?"
  };
}

function topChangeText(delta: FilingIntelligenceMetricDelta): string {
  const basis = delta.basis.toUpperCase();
  if (delta.direction === "unavailable") {
    return `${delta.label} could not be compared on a ${basis} basis.`;
  }
  return `${delta.label} ${delta.direction === "improved" ? "improved" : delta.direction === "weakened" ? "weakened" : "changed"} on a ${basis} basis.`;
}

function parseJsonObject(answer: string): Record<string, unknown> | undefined {
  const trimmed = answer.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

function validateMemoCandidate(candidate: Record<string, unknown>, ticker: string): FilingIntelligenceMemo | undefined {
  const fields: Array<keyof FilingIntelligenceMemo> = [
    "the_filing_read",
    "what_changed",
    "the_good",
    "the_bad",
    "the_interesting",
    "management_tone",
    "risk_watch",
    "plain_english_takeaway",
    "what_to_watch_next"
  ];
  const memo: Partial<FilingIntelligenceMemo> = {};
  const allowedTicker = ticker.toUpperCase();

  for (const field of fields) {
    const value = candidate[field];
    if (typeof value !== "string" || value.trim().length < 20) {
      return undefined;
    }
    if (bannedNarrativePattern.test(value)) {
      return undefined;
    }
    const tickerMatches = value.match(/\b[A-Z]{2,5}\b/g) ?? [];
    if (tickerMatches.some((match) => !["SEC", "XBRL", "CEO", "CFO", "QOQ", "YOY", "MD", "AI", "US", "USD", allowedTicker].includes(match))) {
      return undefined;
    }
    memo[field] = value.trim();
  }

  return memo as FilingIntelligenceMemo;
}

async function maybeRewriteMemoWithLlm(args: {
  block: FilingIntelligenceBlock;
  ticker: string;
  config: DexterConfig;
}): Promise<FilingIntelligenceBlock> {
  if (args.config.fixtureMode) {
    return args.block;
  }

  const factPack = {
    ticker: args.ticker,
    latest_filing: args.block.latest_filing,
    top_changes: args.block.top_changes,
    metric_deltas: args.block.metric_deltas.slice(0, 12).map((delta) => ({
      label: delta.label,
      basis: delta.basis,
      direction: delta.direction,
      plain_english: delta.plain_english,
      why_it_matters: delta.why_it_matters
    })),
    segment_deltas: args.block.segment_deltas.slice(0, 4).map((delta) => ({
      label: delta.label,
      direction: delta.direction,
      plain_english: delta.plain_english
    })),
    language_deltas: args.block.language_deltas.map((delta) => ({
      section: delta.section,
      change_type: delta.change_type,
      plain_english: delta.plain_english
    })),
    omissions: args.block.omissions.map((omission) => ({
      family: omission.family,
      reason_code: omission.reason_code,
      blocking: omission.blocking
    }))
  };

  const prompt = [
    "You are Dexter writing a Thesis Deep Dive filing intelligence memo.",
    "Use only this JSON fact pack. Do not add numbers, tickers, sources, causality, or facts not present.",
    "Write for smart non-experts. Clear, explanatory, slightly sharp when useful. No trading advice.",
    "Return strict JSON with these string fields only: the_filing_read, what_changed, the_good, the_bad, the_interesting, management_tone, risk_watch, plain_english_takeaway, what_to_watch_next.",
    "Each major field should be roughly 120-210 words when evidence supports it. Shorter is allowed when omissions limit the read.",
    "Avoid buy/sell/hold, price targets, allocation, position sizing, and unsupported because-claims.",
    JSON.stringify(factPack, null, 2)
  ].join("\n\n");

  try {
    const result = await runLiveDexterQuery(prompt, args.config, args.config.retrySectionTimeoutMs, 1);
    const parsed = parseJsonObject(result.answer);
    const memo = parsed ? validateMemoCandidate(parsed, args.ticker) : undefined;
    if (!memo) {
      return {
        ...args.block,
        omissions: [
          ...args.block.omissions,
          {
            family: "filing_memo_llm",
            reason_code: "llm_unavailable",
            reason: "LLM filing memo was rejected by safety or schema validation; deterministic memo kept.",
            blocking: false
          }
        ]
      };
    }
    return {
      ...args.block,
      generation_mode: "live_prompt",
      memo
    };
  } catch {
    return {
      ...args.block,
      omissions: [
        ...args.block.omissions,
        {
          family: "filing_memo_llm",
          reason_code: "llm_unavailable",
          reason: "LLM filing memo was unavailable; deterministic filing memo kept.",
          blocking: false
        }
      ]
    };
  }
}

export async function buildFilingIntelligence(
  input: BuildFilingIntelligenceInput,
  config: DexterConfig
): Promise<FilingIntelligenceBlock> {
  const omissions: FilingIntelligenceOmission[] = [];
  const evidence: EvidenceItem[] = [];
  const latest = input.latest;

  if (!latest) {
    omissions.push({
      family: "latest_filing",
      reason_code: "missing_latest_filing",
      reason: "No latest SEC/XBRL snapshot was available for filing-intelligence assembly.",
      blocking: true
    });
  }
  if (!input.priorQuarter) {
    omissions.push({
      family: "quarter_comparison",
      reason_code: "missing_prior_quarter",
      reason: "Prior-quarter SEC/XBRL snapshot was missing, so QoQ comparison is partial.",
      blocking: false
    });
  }
  if (!input.yearAgo) {
    omissions.push({
      family: "year_ago_comparison",
      reason_code: "missing_year_ago",
      reason: "Same-quarter prior-year SEC/XBRL snapshot was missing, so YoY comparison is partial.",
      blocking: false
    });
  }

  const { latestAnnual, priorAnnual } = annualPair(input.financials);
  if (!latestAnnual || !priorAnnual) {
    omissions.push({
      family: "annual_comparison",
      reason_code: "missing_annual_history",
      reason: "Latest and prior annual SEC/XBRL snapshots were not both available.",
      blocking: false
    });
  }
  if (!latest?.segments?.length) {
    omissions.push({
      family: "segments",
      reason_code: "missing_segment_data",
      reason: "Segment data was not available in the latest SEC/XBRL snapshot.",
      blocking: false
    });
  }
  omissions.push({
    family: "filing_language",
    reason_code: "missing_filing_text",
    reason:
      "Full SEC filing-section text extraction is not yet available in this run; management language is bounded to reviewed commentary when present.",
    blocking: false
  });

  const latestEvidence = latest ? evidenceForSnapshot(latest, input.generatedAt, "latest") : undefined;
  const priorEvidence = input.priorQuarter
    ? evidenceForSnapshot(input.priorQuarter, input.generatedAt, "prior-quarter")
    : undefined;
  const yearAgoEvidence = input.yearAgo
    ? evidenceForSnapshot(input.yearAgo, input.generatedAt, "year-ago")
    : undefined;
  const latestAnnualEvidence = latestAnnual
    ? evidenceForSnapshot(latestAnnual, input.generatedAt, "latest-annual")
    : undefined;
  const priorAnnualEvidence = priorAnnual
    ? evidenceForSnapshot(priorAnnual, input.generatedAt, "prior-annual")
    : undefined;
  for (const item of [
    latestEvidence,
    priorEvidence,
    yearAgoEvidence,
    latestAnnualEvidence,
    priorAnnualEvidence
  ]) {
    if (item) {
      evidence.push(item);
    }
  }

  const metricDeltas: FilingIntelligenceMetricDelta[] = [];
  if (latest && latestEvidence) {
    for (const definition of metricDefinitions) {
      metricDeltas.push(
        buildMetricDelta({
          definition,
          latest,
          reference: input.priorQuarter,
          basis: "qoq",
          currentEvidenceId: latestEvidence.evidence_id,
          referenceEvidenceId: priorEvidence?.evidence_id
        })
      );
      metricDeltas.push(
        buildMetricDelta({
          definition,
          latest,
          reference: input.yearAgo,
          basis: "yoy",
          currentEvidenceId: latestEvidence.evidence_id,
          referenceEvidenceId: yearAgoEvidence?.evidence_id
        })
      );
    }
  }
  if (latestAnnual && latestAnnualEvidence) {
    for (const definition of metricDefinitions) {
      metricDeltas.push(
        buildMetricDelta({
          definition,
          latest: latestAnnual,
          reference: priorAnnual,
          basis: "annual",
          currentEvidenceId: latestAnnualEvidence.evidence_id,
          referenceEvidenceId: priorAnnualEvidence?.evidence_id
        })
      );
    }
  }

  const segmentDeltas = latest
    ? buildSegmentDeltas({
      latest,
      reference: input.priorQuarter,
      evidenceRefs: [latestEvidence?.evidence_id, priorEvidence?.evidence_id].filter(
        (entry): entry is string => typeof entry === "string"
      )
    })
    : [];

  const transcriptEvidence = input.latestTranscript
    ? evidenceForTranscript(input.latestTranscript, input.generatedAt)
    : undefined;
  if (transcriptEvidence) {
    evidence.push(transcriptEvidence);
  }
  const languageDeltas: FilingIntelligenceLanguageDelta[] = transcriptEvidence && input.latestTranscript
    ? [
      {
        section: "management_commentary",
        current_excerpt: input.latestTranscript.body_text.slice(0, 260),
        change_type: "new",
        plain_english:
          "Management commentary is available as context, but M11 treats it as something to test against filing numbers rather than as standalone proof.",
        evidence_refs: [transcriptEvidence.evidence_id]
      }
    ]
    : [
      {
        section: "management_commentary",
        change_type: "unavailable",
        plain_english:
          "No reviewed management-language excerpt was available, so tone is not inferred.",
        evidence_refs: []
      }
    ];

  const memo = buildDeterministicMemo({
    ticker: input.ticker,
    latest,
    metricDeltas,
    segmentDeltas,
    languageDeltas,
    omissions
  });
  const topMetricChanges = metricDeltas
    .filter((delta) => delta.direction === "improved" || delta.direction === "weakened")
    .slice(0, 6);
  const block: FilingIntelligenceBlock = {
    prompt_version: promptVersion,
    generation_mode: input.fixtureMode ? "deterministic_fixture" : "fallback",
    latest_filing: filingForm(latest),
    comparison_filings: [filingForm(input.priorQuarter), filingForm(input.yearAgo), filingForm(latestAnnual), filingForm(priorAnnual)]
      .filter((entry): entry is NonNullable<FilingIntelligenceBlock["latest_filing"]> => Boolean(entry)),
    metric_deltas: metricDeltas,
    language_deltas: languageDeltas,
    segment_deltas: segmentDeltas,
    memo,
    top_changes: topMetricChanges.map(topChangeText),
    good: topMetricChanges
      .filter((delta) => delta.direction === "improved")
      .slice(0, 3)
      .map(topChangeText),
    bad: topMetricChanges
      .filter((delta) => delta.direction === "weakened")
      .slice(0, 3)
      .map(topChangeText),
    interesting: [
      segmentDeltas[0]?.plain_english,
      languageDeltas[0]?.plain_english,
      "The memo checks whether numbers, segment mix, and management language agree before increasing conviction."
    ].filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0),
    omissions,
    evidence
  };

  return maybeRewriteMemoWithLlm({
    block,
    ticker: input.ticker,
    config
  });
}
