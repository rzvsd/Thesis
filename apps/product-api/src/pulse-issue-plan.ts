import type { EvidenceItem, MarketPulseReport } from "../../../packages/contracts/src";

export type PulseIssueModuleKey =
  | "tape"
  | "what_changed"
  | "your_names"
  | "calendar"
  | "headlines"
  | "signal_vs_noise"
  | "backdrop"
  | "sources"
  // Legacy keys remain in the type only so older helper functions compile while
  // the new renderer ignores them.
  | "lead_story"
  | "market_overview"
  | "portfolio_radar"
  | "today_catalysts"
  | "macro_news"
  | "why_it_matters"
  | "macro_regime"
  | "company_event_notes"
  | "coverage_notes";

export interface PulseIssueModule {
  key: PulseIssueModuleKey;
  title: string;
  visible: boolean;
  reason: string;
}

export interface PulseDelta {
  tape_breadth_changed: boolean;
  macro_regime_changed: boolean;
  sector_leadership_rotated: boolean;
  vix_regime_crossed: boolean;
  new_headlines_count: number;
  new_calendar_events_count: number;
  portfolio_movers: string[];
  nothing_material_changed: boolean;
}

export interface PulseIssuePlan {
  opening_note: string;
  in_this_issue: string[];
  modules: PulseIssueModule[];
  delta: PulseDelta;
  quiet_day: boolean;
  backdrop_one_liner: string;
  coverage_notes: string[];
  source_footnotes: EvidenceItem[];
}

export function buildPulseIssuePlan(report: MarketPulseReport): PulseIssuePlan {
  const delta = computePulseDelta(report);
  const coverageNotes = collectCoverageNotes(report);
  const modules: PulseIssueModule[] = [
    module("tape", "The Tape", true, "Market tape is the daily front-page story."),
    module(
      "what_changed",
      "What Changed",
      true,
      delta.nothing_material_changed
        ? "Show the quiet-day one-liner instead of manufacturing novelty."
        : "Show explicit deltas versus the previous issue."
    ),
    module(
      "your_names",
      "Your Names",
      (report.morning_edition?.portfolio_radar.length ?? 0) > 0,
      "Only show portfolio/watchlist rows when typed rows exist."
    ),
    module(
      "calendar",
      "Today's Calendar",
      (report.morning_edition?.today_catalysts.length ?? 0) > 0,
      "Only show dated catalysts when real rows exist."
    ),
    module(
      "headlines",
      "Headlines Worth Knowing",
      (report.morning_edition?.headline_digest.length ?? 0) > 0 ||
        (report.macro_news?.items.length ?? 0) > 0,
      "Only show approved fresh headline metadata."
    ),
    module("signal_vs_noise", "Signal vs Noise", true, "Always present, two sentences only."),
    module("backdrop", "The Backdrop", true, "Macro appears once, compressed.")
  ];

  return {
    opening_note: buildOpeningNote(report, delta),
    in_this_issue: modules
      .filter((entry) => entry.visible && entry.key !== "backdrop")
      .map((entry) => entry.title)
      .slice(0, 6),
    modules,
    delta,
    quiet_day: delta.nothing_material_changed,
    backdrop_one_liner: buildBackdropOneLiner(report, delta),
    coverage_notes: coverageNotes,
    source_footnotes: collectSourceFootnotes(report)
  };
}

function module(
  key: PulseIssueModuleKey,
  title: string,
  visible: boolean,
  reason: string
): PulseIssueModule {
  return { key, title, visible, reason };
}

function computePulseDelta(report: MarketPulseReport): PulseDelta {
  const issue = report.editorial_issue;
  const materialEditorialItems = [
    ...(issue?.what_changed ?? []),
    ...(issue?.signal_vs_noise ?? [])
  ].filter((item) => {
    const body = item.body.toLowerCase();
    return (
      item.freshness_state !== "unchanged" &&
      item.freshness_state !== "baseline" &&
      !body.includes("no material change") &&
      !body.includes("nothing material changed")
    );
  });

  const portfolioMovers = (report.morning_edition?.portfolio_radar ?? [])
    .filter((row) => Math.abs(row.change_pct ?? 0) >= 2)
    .map((row) => row.ticker)
    .slice(0, 8);
  const headlineCount =
    (report.morning_edition?.headline_digest.length ?? 0) +
    (report.macro_news?.items.length ?? 0);
  const calendarCount = report.morning_edition?.today_catalysts.length ?? 0;
  const macroRegimeChanged = issue?.what_changed.some((item) =>
    item.kind === "macro" &&
    item.freshness_state === "updated" &&
    !/unchanged|no material/i.test(item.body)
  ) ?? false;
  const sectorLeadershipRotated = issue?.what_changed.some((item) =>
    /sector|leadership|rotation/i.test(`${item.title} ${item.body}`) &&
    item.freshness_state === "updated"
  ) ?? false;
  const tapeBreadthChanged = issue?.what_changed.some((item) =>
    item.kind === "market_tape" &&
    item.freshness_state === "updated" &&
    /from .* to /i.test(item.body)
  ) ?? false;
  const vixRegimeCrossed = report.market_tape?.cross_asset.some((item) =>
    item.family === "volatility" &&
    typeof item.value === "number" &&
    typeof item.previous_value === "number" &&
    ((item.previous_value < 20 && item.value >= 20) || (item.previous_value >= 20 && item.value < 20))
  ) ?? false;

  const nothingMaterialChanged =
    materialEditorialItems.length === 0 &&
    portfolioMovers.length === 0 &&
    headlineCount === 0 &&
    calendarCount === 0 &&
    !macroRegimeChanged &&
    !sectorLeadershipRotated &&
    !tapeBreadthChanged &&
    !vixRegimeCrossed;

  return {
    tape_breadth_changed: tapeBreadthChanged,
    macro_regime_changed: macroRegimeChanged,
    sector_leadership_rotated: sectorLeadershipRotated,
    vix_regime_crossed: vixRegimeCrossed,
    new_headlines_count: headlineCount,
    new_calendar_events_count: calendarCount,
    portfolio_movers: portfolioMovers,
    nothing_material_changed: nothingMaterialChanged
  };
}

function buildOpeningNote(report: MarketPulseReport, delta: PulseDelta): string {
  if (delta.nothing_material_changed) {
    return "Quiet day. No material change from the previous issue.";
  }
  const issueLead = report.editorial_issue?.lead?.trim();
  if (issueLead) {
    return limitWords(issueLead, 45);
  }
  return report.market_tape?.summary ?? "The market tape is available, but the daily story remains bounded.";
}

function buildBackdropOneLiner(report: MarketPulseReport, delta: PulseDelta): string {
  const highInputs = report.macro_stress.inputs
    .filter((input) => input.pressure === "high")
    .map((input) => input.label)
    .slice(0, 2);
  const pressure = highInputs.length > 0 ? ` (${highInputs.join(", ")})` : "";
  if (!delta.macro_regime_changed) {
    return `Macro regime: ${titleCase(report.macro_stress.state)}. Unchanged${pressure}.`;
  }
  return `Macro regime changed: ${titleCase(report.macro_stress.state)}${pressure}.`;
}

function collectCoverageNotes(report: MarketPulseReport): string[] {
  const notes = [
    ...(report.editorial_issue?.coverage_notes ?? []),
    ...(report.morning_edition?.coverage_notes ?? []),
    ...(report.market_tape?.omissions.map((entry) => entry.reason_text) ?? []),
    ...(report.macro_news?.coverage_notes ?? []),
    ...(report.macro_news?.omissions.map((entry) => entry.reason_text) ?? []),
    ...report.flags
      .filter((flag) => flag.startsWith("data_unavailable:") || flag.startsWith("data_incomplete:"))
      .map(readableCoverageNote)
  ]
    .map((entry) => stripInternalLabels(entry.trim()))
    .filter((entry) => entry.length > 0);
  return [...new Set(notes)].slice(0, 5);
}

function collectSourceFootnotes(report: MarketPulseReport): EvidenceItem[] {
  const evidence: EvidenceItem[] = [];
  const push = (items: EvidenceItem[] | undefined): void => {
    for (const item of items ?? []) {
      evidence.push(item);
    }
  };

  push(report.sections.market_tape?.evidence);
  push(report.sections.what_changed?.evidence);
  push(report.sections.signal_vs_noise?.evidence);
  push(report.sections.official_macro_pressure?.evidence);
  push(report.sections.headline_digest?.evidence);
  push(report.sections.today_catalysts?.evidence);
  push(report.sections.portfolio_radar?.evidence);
  push(report.editorial_issue?.evidence);

  const seen = new Set<string>();
  const unique: EvidenceItem[] = [];
  for (const item of evidence) {
    const key = [item.source_name, item.url ?? "", item.retrieved_at].join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(item);
  }
  return unique.slice(0, 10);
}

function readableCoverageNote(flag: string): string {
  const [, sectionName = "coverage"] = flag.split(":");
  const label = titleCase(sectionName.replaceAll("_", " "));
  if (flag.startsWith("data_unavailable:")) {
    return `${label} was unavailable for this issue.`;
  }
  if (flag.startsWith("data_incomplete:")) {
    return `${label} had limited coverage for this issue.`;
  }
  return flag.replaceAll("_", " ");
}

function stripInternalLabels(value: string): string {
  return value
    .replaceAll("data_incomplete", "limited coverage")
    .replaceAll("data_unavailable", "unavailable coverage")
    .replaceAll("bounded_context", "approved context")
    .replaceAll("elevated partial", "limited elevated coverage")
    .replace(/\s+/g, " ");
}

function limitWords(value: string, maxWords: number): string {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return value;
  }
  return `${words.slice(0, maxWords).join(" ")}.`;
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (entry) => entry.toUpperCase());
}
