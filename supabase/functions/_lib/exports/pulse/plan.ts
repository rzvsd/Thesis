// Pulse brief plan: fact pack from the stored MarketPulseReport, plus copy.
// Ported from apps/product-api/src/pulse-brief-plan.ts (M4). Logic kept as is; only plumbing changed.
import type { EvidenceItem, Loose, MarketPulseReport } from "../../reports/types.ts";
import type {
  MarketTapeMove,
  PulseBriefBreadth,
  PulseBriefCalendarItem,
  PulseBriefDeltaItem,
  PulseBriefFactPack,
  PulseBriefHeadline,
  PulseBriefInterestingCandidate,
  PulseBriefMode,
  PulseBriefMove,
  PulseBriefNameContext,
  PulseBriefOmission,
  PulseBriefPlan,
  PulseBriefUserNameRow,
} from "./plan_types.ts";
import { buildDeterministicPulseBriefCopy } from "./plan_copy.ts";
import {
  cleanSentence,
  dedupeBy,
  escapeRegExp,
  formatMoveChange,
  isCustomerSafeDelta,
  joinCopy,
} from "./plan_util.ts";

export * from "./plan_types.ts";
export { buildDeterministicPulseBriefCopy } from "./plan_copy.ts";

const quietIndexMovePct = 0.35;
const notableIndexMovePct = 1.0;
const notableVixMovePct = 4.0;
const notableOilMovePct = 1.5;
const notableRateMove = 0.08;
const notableCreditMove = 0.1;

export function buildPulseBriefPlan(report: MarketPulseReport): PulseBriefPlan {
  const factPack = buildPulseBriefFactPack(report);
  const deterministicCopy = buildDeterministicPulseBriefCopy(factPack);
  const editorial = report.brief_editorial;
  return {
    fact_pack: factPack,
    copy: {
      the_read: editorial?.the_read ??
        joinCopy([editorial?.morning_line, editorial?.yesterday_comment]) ??
        deterministicCopy.the_read,
      what_changed_summary: editorial?.what_changed_summary ?? deterministicCopy.what_changed_summary,
      why_it_matters: editorial?.why_it_matters ?? editorial?.interesting_bit ??
        deterministicCopy.why_it_matters,
      your_names_comment: editorial?.your_names_comment ?? deterministicCopy.your_names_comment,
      smart_comment: editorial?.smart_comment ??
        joinCopy([editorial?.signal, editorial?.noise]) ??
        deterministicCopy.smart_comment,
      morning_story: editorial?.morning_story ?? editorial?.the_read ?? deterministicCopy.morning_story,
      tape_color: editorial?.tape_color ?? deterministicCopy.tape_color,
      tape_narrative: editorial?.tape_narrative ?? deterministicCopy.tape_narrative,
      calendar_narrative: editorial?.calendar_narrative ?? deterministicCopy.calendar_narrative,
      headlines_narrative: editorial?.headlines_narrative ?? deterministicCopy.headlines_narrative,
      names_narrative: editorial?.names_narrative ??
        editorial?.your_names_comment ??
        deterministicCopy.names_narrative,
      one_thing: editorial?.one_thing ?? editorial?.interesting_bit ?? deterministicCopy.one_thing,
      mood: editorial?.mood ?? deterministicCopy.mood,
    },
  };
}

export function buildPulseBriefFactPack(report: MarketPulseReport): PulseBriefFactPack {
  const indices = normalizeMoves(report.market_tape?.indices ?? []);
  const crossAsset = normalizeMoves(report.market_tape?.cross_asset ?? []);
  const breadth = classifyBreadth(indices);
  const notableMoves = [...indices, ...crossAsset].filter(isNotableMove).slice(0, 8);
  const calendar = normalizeCalendar(report);
  const headlines = normalizeHeadlines(report);
  const deltaItems = buildDeltaItems(report, breadth, notableMoves);
  const unchanged = buildUnchangedItems(report, deltaItems);
  const baseline = isBaselineIssue(report);
  const interesting = buildInterestingCandidates(report, breadth, notableMoves);
  const oneThing = selectOneThing(interesting);
  const userRows = normalizeUserRows(report, breadth);
  const narrativeFacts = buildNarrativeFacts(report, breadth, notableMoves, userRows, oneThing);
  const omissions = buildOmissions(report);
  const sources = collectSources(report);
  const mode = classifyMode({
    report,
    breadth,
    notableMoves,
    deltaItems,
    calendar,
    headlines,
    userRows,
  });

  return {
    as_of: report.market_tape?.as_of ?? report.macro_stress.as_of ?? report.cycle_end.slice(0, 10),
    mode,
    morning_verdict: {
      deterministic_label: buildVerdictLabel(mode, breadth, report),
      reason_codes: buildReasonCodes(report, breadth, notableMoves, calendar, headlines, userRows),
    },
    tape: {
      indices,
      cross_asset: crossAsset,
      breadth,
      notable_moves: notableMoves,
    },
    deltas: {
      vs_yesterday: baseline ? [] : deltaItems,
      vs_5d: [],
      unchanged,
      baseline,
    },
    interesting_candidates: interesting,
    narrative_facts: narrativeFacts,
    one_thing: oneThing,
    user_names: userRows.length > 0
      ? {
        rows: userRows,
        portfolio_comment_facts: buildPortfolioCommentFacts(userRows, breadth),
      }
      : undefined,
    calendar: calendar.length > 0 ? calendar : undefined,
    headlines: headlines.length > 0 ? headlines : undefined,
    evidence: collectEvidence(report),
    omissions,
    sources,
  };
}

function normalizeMoves(moves: MarketTapeMove[]): PulseBriefMove[] {
  return moves.map((move) => ({
    id: move.instrument_id,
    label: normalizeMoveLabel(move.label),
    value: move.value,
    change: move.daily_change,
    changePct: move.daily_change_pct,
    unit: move.unit,
    family: move.family,
    direction: move.direction,
  }));
}

function normalizeMoveLabel(label: string): string {
  const clean = label.replace(/^FRED\s+/i, "").trim();
  if (/S&P 500/i.test(clean)) {
    return "S&P 500";
  }
  if (/Nasdaq/i.test(clean)) {
    return "Nasdaq";
  }
  if (/Dow/i.test(clean)) {
    return "Dow";
  }
  if (/Russell/i.test(clean)) {
    return "Russell 2000";
  }
  if (/10/i.test(clean) && /Treasury|yield/i.test(clean)) {
    return "10Y yield";
  }
  if (/2/i.test(clean) && /Treasury|yield/i.test(clean)) {
    return "2Y yield";
  }
  return clean;
}

function classifyBreadth(indices: PulseBriefMove[]): PulseBriefBreadth {
  if (indices.length < 2) {
    return "thin";
  }
  const quiet = indices.every((move) => Math.abs(move.changePct ?? 0) < quietIndexMovePct);
  if (quiet) {
    return "quiet";
  }
  const higher = indices.filter((move) => (move.changePct ?? 0) > 0).length;
  const lower = indices.filter((move) => (move.changePct ?? 0) < 0).length;
  if (higher >= Math.min(3, indices.length)) {
    return "higher";
  }
  if (lower >= Math.min(3, indices.length)) {
    return "lower";
  }
  return "mixed";
}

function isNotableMove(move: PulseBriefMove): boolean {
  const changePct = Math.abs(move.changePct ?? 0);
  const change = Math.abs(move.change ?? 0);
  if (move.family === "core_index") {
    return changePct >= notableIndexMovePct;
  }
  if (move.family === "volatility") {
    return changePct >= notableVixMovePct || change >= 1.5;
  }
  if (move.family === "rates") {
    return change >= notableRateMove;
  }
  if (move.family === "commodity") {
    return changePct >= notableOilMovePct;
  }
  if (move.family === "credit") {
    return change >= notableCreditMove || changePct >= 1;
  }
  return changePct >= 1;
}

function normalizeCalendar(report: MarketPulseReport): PulseBriefCalendarItem[] {
  return (report.morning_edition?.today_catalysts ?? [])
    .slice(0, 5)
    .map((item: Loose) => ({
      timeLabel: item.time_label,
      title: item.title,
      impact: item.impact,
    }));
}

function normalizeHeadlines(report: MarketPulseReport): PulseBriefHeadline[] {
  const regular = (report.morning_edition?.headline_digest ?? []).map((item: Loose) => ({
    headline: item.headline,
    sourceName: item.source_name,
    sourceUrl: item.source_url,
    publishedAt: item.published_at,
    topic: item.topic,
  }));
  const macro = (report.macro_news?.items ?? []).map((item: Loose) => ({
    headline: item.headline,
    sourceName: item.source_name,
    sourceUrl: item.source_url,
    publishedAt: item.published_at,
    topic: item.topic,
  }));
  return dedupeBy(
    [...macro, ...regular],
    (item) => `${item.sourceName}:${item.headline}`,
  ).slice(0, 5);
}

function normalizeUserRows(
  report: MarketPulseReport,
  breadth: PulseBriefBreadth,
): PulseBriefUserNameRow[] {
  return (report.morning_edition?.portfolio_radar ?? [])
    .filter((row: Loose) => row.ticker.trim().length > 0)
    .slice(0, 8)
    .map((row: Loose) => {
      const normalized: PulseBriefUserNameRow = {
        ticker: row.ticker.trim().toUpperCase(),
        companyName: row.company_name,
        previousClose: row.previous_close,
        latestPrice: row.latest_price,
        changePct: row.change_pct,
        direction: row.direction,
        note: sanitizeUserRowNote(row.reason, row.direction, typeof row.change_pct === "number"),
      };
      return {
        ...normalized,
        context: buildNameContext(report, normalized, breadth),
      };
    });
}

function buildNameContext(
  report: MarketPulseReport,
  row: PulseBriefUserNameRow,
  breadth: PulseBriefBreadth,
): PulseBriefNameContext {
  const magnitude = Math.abs(row.changePct ?? 0);
  const tapeRelation = classifyNameTapeRelation(row, breadth);
  const pendingEvent = findPendingNameEvent(report, row.ticker);
  const macroRead = report.macro_stress.state === "elevated"
    ? `macro remains ${report.macro_stress.state}`
    : undefined;
  const contextLine = buildNameContextLine(row, tapeRelation, pendingEvent, macroRead, magnitude);
  return {
    tape_relation: tapeRelation,
    sector_relation: "unknown",
    ...(pendingEvent ? { pending_event: pendingEvent } : {}),
    ...(macroRead ? { macro_read: macroRead } : {}),
    context_line: contextLine,
  };
}

function classifyNameTapeRelation(
  row: PulseBriefUserNameRow,
  breadth: PulseBriefBreadth,
): PulseBriefNameContext["tape_relation"] {
  if (typeof row.changePct !== "number") {
    return "unknown";
  }
  if (Math.abs(row.changePct) < 0.5) {
    return "matched";
  }
  if (breadth === "higher") {
    return row.direction === "up" ? "matched" : "lagged";
  }
  if (breadth === "lower") {
    return row.direction === "down" ? "matched" : "led";
  }
  if (row.direction === "up" && row.changePct >= 1.5) {
    return "led";
  }
  if (row.direction === "down" && row.changePct <= -1.5) {
    return "lagged";
  }
  return "matched";
}

function findPendingNameEvent(report: MarketPulseReport, ticker: string): string | undefined {
  const tickerPattern = new RegExp(`\\b${escapeRegExp(ticker)}\\b`, "i");
  const item = report.morning_edition?.today_catalysts.find((entry: Loose) =>
    tickerPattern.test(entry.title)
  );
  return item ? `${item.time_label ?? "Watch"}: ${item.title}` : undefined;
}

function buildNameContextLine(
  row: PulseBriefUserNameRow,
  tapeRelation: PulseBriefNameContext["tape_relation"],
  pendingEvent: string | undefined,
  macroRead: string | undefined,
  magnitude: number,
): string {
  const company = row.companyName ?? row.ticker;
  if (pendingEvent) {
    return `${company} has a near-term calendar item, so tape movement should be checked against company evidence.`;
  }
  if (magnitude < 0.5) {
    return `${company} was quiet; no company-specific evidence changed the morning read.`;
  }
  if (tapeRelation === "led") {
    return `${company} outpaced the tape, but no approved company-specific catalyst stood out.`;
  }
  if (tapeRelation === "lagged") {
    return `${company} lagged the tape; treat it as context unless first-party evidence confirms more.`;
  }
  if (macroRead) {
    return `${company} moved with the tape while ${macroRead}; this is context, not thesis change.`;
  }
  return `${company} moved with broader market context rather than a confirmed company-specific catalyst.`;
}

function defaultUserRowNote(direction: "up" | "down" | "flat"): string {
  if (direction === "up") {
    return "Moved with the tape. No new company-specific evidence.";
  }
  if (direction === "down") {
    return "Lagged the tape. No thesis-level change.";
  }
  return "No material price move. No thesis-level change.";
}

function sanitizeUserRowNote(
  reason: string | undefined,
  direction: "up" | "down" | "flat",
  hasMove: boolean,
): string {
  const clean = reason?.replace(/\s+/g, " ").trim();
  if (
    !clean ||
    /UserResearchState|regex|text-match|text matched|omission|debug|runtime|dispatch|trading signal/i.test(
      clean,
    )
  ) {
    if (!hasMove) {
      return "Tracked for context. No company-specific evidence changed.";
    }
    return defaultUserRowNote(direction);
  }
  return clean;
}

function buildDeltaItems(
  report: MarketPulseReport,
  breadth: PulseBriefBreadth,
  notableMoves: PulseBriefMove[],
): PulseBriefDeltaItem[] {
  const items: PulseBriefDeltaItem[] = [];
  const issueItems = report.editorial_issue?.what_changed ?? [];
  for (const item of issueItems.slice(0, 3)) {
    const body = normalizeDeltaDetail(cleanSentence(item.body));
    if (body && !/no material change/i.test(body) && isCustomerSafeDelta(body)) {
      items.push({
        label: item.title,
        detail: body,
        importance: item.importance,
      });
    }
  }

  if (items.length === 0 && breadth !== "quiet" && breadth !== "thin") {
    items.push({
      label: "Tape direction",
      detail: `The reviewed tape is ${breadth}.`,
      importance: breadth === "mixed" ? "medium" : "high",
    });
  }

  for (const move of notableMoves.slice(0, 2)) {
    items.push({
      label: move.label,
      detail: `${move.label} moved ${formatMoveChange(move)}.`,
      importance: move.family === "volatility" || move.family === "rates" ? "high" : "medium",
    });
  }

  return dedupeBy(items, (item) => `${item.label}:${item.detail}`).slice(0, 5);
}

function normalizeDeltaDetail(detail: string): string {
  let clean = detail.replace(/\bMacro Stress\b/g, "macro regime");
  clean = clean.replace(
    /\bmoved from (higher|lower|mixed|quiet|thin) to \1\b/gi,
    (_match, state: string) => `remained ${state.toLowerCase()}`,
  );
  return clean;
}

function buildUnchangedItems(report: MarketPulseReport, deltaItems: PulseBriefDeltaItem[]): string[] {
  const unchanged: string[] = [];
  const macroState = report.macro_stress.state;
  if (!deltaItems.some((item) => /macro/i.test(item.detail))) {
    unchanged.push(`Macro regime remains ${macroState}.`);
  }
  if ((report.morning_edition?.portfolio_radar ?? []).length === 0) {
    unchanged.push("No tracked-name price rows cleared the approved input path.");
  } else if (!deltaItems.some((item) => /portfolio|company|filing/i.test(item.detail))) {
    unchanged.push("No new high-confidence tracked-name catalyst was confirmed.");
  }
  if ((report.macro_news?.items ?? []).length === 0) {
    unchanged.push("No approved macro headline changed the issue mode.");
  }
  return unchanged.slice(0, 3);
}

function isBaselineIssue(report: MarketPulseReport): boolean {
  return report.editorial_issue?.freshness_state === "baseline" || !report.editorial_issue?.prior_cycle_end;
}

function buildInterestingCandidates(
  report: MarketPulseReport,
  breadth: PulseBriefBreadth,
  notableMoves: PulseBriefMove[],
): PulseBriefInterestingCandidate[] {
  const candidates: PulseBriefInterestingCandidate[] = [];
  const ratesFriendly = notableMoves.some((move) => move.family === "rates" && (move.change ?? 0) < 0);
  const vixCooled = notableMoves.some((move) => move.family === "volatility" && (move.change ?? 0) < 0);
  const creditNotConfirming = (report.market_tape?.cross_asset ?? []).some((move: Loose) =>
    move.family === "credit" && move.direction !== "down"
  );
  const sectorLeader = report.market_tape?.sector_leadership?.leaders?.[0];

  if ((breadth === "higher" || breadth === "mixed") && ratesFriendly) {
    candidates.push({
      code: "risk_assets_with_friendlier_rates",
      facts: ["equities improved", "rates moved lower"],
      importance: "high",
    });
  }
  if (vixCooled && creditNotConfirming) {
    candidates.push({
      code: "vix_cools_credit_mixed",
      facts: ["volatility cooled", "credit did not fully confirm"],
      importance: "medium",
    });
  }
  if (breadth !== "quiet" && report.macro_stress.state !== "stable") {
    candidates.push({
      code: "tape_tolerates_macro_pressure",
      facts: [`tape was ${breadth}`, `macro state remained ${report.macro_stress.state}`],
      importance: "medium",
    });
  }
  if (sectorLeader) {
    candidates.push({
      code: "sector_leadership",
      facts: [`${normalizeMoveLabel(sectorLeader.label)} led the sector basket`],
      importance: "low",
    });
  }
  if (candidates.length === 0) {
    candidates.push({
      code: "no_clean_divergence",
      facts: ["no single cross-asset divergence cleared the brief threshold"],
      importance: "low",
    });
  }
  return candidates.slice(0, 3);
}

function selectOneThing(candidates: PulseBriefInterestingCandidate[]): PulseBriefInterestingCandidate {
  return [...candidates].sort((left, right) =>
    importanceRank(right.importance) - importanceRank(left.importance)
  )[0] ?? {
    code: "no_clean_divergence",
    facts: ["no single cross-asset divergence cleared the brief threshold"],
    importance: "low",
  };
}

function importanceRank(value: PulseBriefInterestingCandidate["importance"]): number {
  return value === "high" ? 3 : value === "medium" ? 2 : 1;
}

function buildNarrativeFacts(
  report: MarketPulseReport,
  breadth: PulseBriefBreadth,
  notableMoves: PulseBriefMove[],
  rows: PulseBriefUserNameRow[],
  oneThing: PulseBriefInterestingCandidate,
): string[] {
  const facts: string[] = [];
  const vix = notableMoves.find((move) => move.family === "volatility");
  const rate = notableMoves.find((move) => move.family === "rates");
  const credit = (report.market_tape?.cross_asset ?? []).find((move: Loose) => move.family === "credit");
  const leader = report.market_tape?.sector_leadership?.leaders?.[0];
  const laggard = report.market_tape?.sector_leadership?.laggards?.[0];
  const ledRows = rows.filter((row) => row.context?.tape_relation === "led");
  const laggedRows = rows.filter((row) => row.context?.tape_relation === "lagged");

  if (breadth !== "thin") {
    facts.push(`Tape breadth was ${breadth}.`);
  }
  if (vix) {
    facts.push(`Volatility ${vix.direction === "down" ? "cooled" : "rose"} while the tape was ${breadth}.`);
  }
  if (rate) {
    facts.push(`${rate.label} moved ${formatMoveChange(rate)}, shaping the cross-asset read.`);
  }
  if (credit) {
    facts.push(
      `Credit ${credit.direction === "down" ? "helped confirm" : "did not fully confirm"} the risk read.`,
    );
  }
  if (leader && laggard) {
    facts.push(
      `${normalizeMoveLabel(leader.label)} led while ${
        normalizeMoveLabel(laggard.label)
      } lagged the sector basket.`,
    );
  }
  if (ledRows[0]) {
    facts.push(`${ledRows[0].ticker} led the tracked-name set versus the broader tape.`);
  }
  if (laggedRows[0]) {
    facts.push(`${laggedRows[0].ticker} lagged the tracked-name set versus the broader tape.`);
  }
  if (report.macro_stress.state !== "stable") {
    facts.push(`Macro stayed ${report.macro_stress.state} while markets processed the tape.`);
  }
  facts.push(`One thing candidate: ${oneThing.facts.join("; ")}.`);

  return dedupeBy(facts, (fact) => fact).slice(0, 8);
}

function buildOmissions(report: MarketPulseReport): PulseBriefOmission[] {
  const tape = (report.market_tape?.omissions ?? []).map((omission: Loose) => ({
    family: omission.instrument_id ?? omission.family,
    reason: omission.reason_text,
  }));
  const macro = (report.macro_news?.omissions ?? []).map((omission: Loose) => ({
    family: omission.family,
    reason: omission.reason_text,
  }));
  const morning = (report.morning_edition?.coverage_notes ?? []).map((note: Loose) => ({
    family: "morning_edition",
    reason: note,
  }));
  return [...tape, ...macro, ...morning].slice(0, 6);
}

function collectEvidence(report: MarketPulseReport): EvidenceItem[] {
  const evidence = new Map<string, EvidenceItem>();
  for (const section of Object.values(report.sections as Record<string, Loose>)) {
    for (const item of section?.evidence ?? []) {
      evidence.set(item.evidence_id, item);
    }
  }
  for (const item of report.editorial_issue?.evidence ?? []) {
    evidence.set(item.evidence_id, item);
  }
  for (const item of report.morning_edition?.headline_digest ?? []) {
    for (const evidenceItem of item.evidence ?? []) {
      evidence.set(evidenceItem.evidence_id, evidenceItem);
    }
  }
  return [...evidence.values()].slice(0, 12);
}

function collectSources(report: MarketPulseReport): string[] {
  const sources = new Set<string>();
  for (const retrieval of report.market_tape?.retrievals ?? []) {
    sources.add(retrieval.source.source_name);
  }
  for (const section of Object.values(report.sections as Record<string, Loose>)) {
    for (const evidence of section?.evidence ?? []) {
      sources.add(evidence.source_name);
    }
  }
  for (const item of report.morning_edition?.headline_digest ?? []) {
    sources.add(item.source_name);
  }
  for (const item of report.macro_news?.items ?? []) {
    sources.add(item.source_name);
  }
  return [...sources].filter(Boolean).slice(0, 8);
}

function classifyMode(input: {
  report: MarketPulseReport;
  breadth: PulseBriefBreadth;
  notableMoves: PulseBriefMove[];
  deltaItems: PulseBriefDeltaItem[];
  calendar: PulseBriefCalendarItem[];
  headlines: PulseBriefHeadline[];
  userRows: PulseBriefUserNameRow[];
}): PulseBriefMode {
  const eventHeadline = input.report.macro_news?.state === "shock" ||
    (input.report.macro_news?.items ?? []).some((item: Loose) => item.severity === "shock");
  const highImpactCalendar = input.calendar.some((item) => item.impact === "high");
  const majorUserMove = input.userRows.some((row) => Math.abs(row.changePct ?? 0) >= 3);
  const majorCrossAsset = input.notableMoves.some((move) =>
    move.family === "volatility" || move.family === "rates" || move.family === "credit"
  );
  if (eventHeadline || highImpactCalendar || majorUserMove || majorCrossAsset) {
    return "event";
  }
  if (
    input.breadth === "quiet" &&
    input.deltaItems.length === 0 &&
    input.headlines.length === 0 &&
    input.calendar.length === 0
  ) {
    return "quiet";
  }
  return "normal";
}

function buildVerdictLabel(
  mode: PulseBriefMode,
  breadth: PulseBriefBreadth,
  report: MarketPulseReport,
): string {
  if (mode === "quiet") {
    return "no material change";
  }
  if (mode === "event") {
    return report.macro_news?.state === "shock"
      ? "event day: macro headline led"
      : "event day: attention threshold crossed";
  }
  if (breadth === "higher") {
    return "risk appetite improved";
  }
  if (breadth === "lower") {
    return "risk appetite faded";
  }
  return "mixed tape, unchanged macro frame";
}

function buildReasonCodes(
  report: MarketPulseReport,
  breadth: PulseBriefBreadth,
  notableMoves: PulseBriefMove[],
  calendar: PulseBriefCalendarItem[],
  headlines: PulseBriefHeadline[],
  userRows: PulseBriefUserNameRow[],
): string[] {
  const codes = [breadth === "quiet" ? "tape_quiet" : `tape_${breadth}`];
  if (notableMoves.length > 0) {
    codes.push("notable_cross_asset_or_index_move");
  }
  if (report.macro_news?.state === "shock") {
    codes.push("macro_news_shock");
  }
  if (calendar.some((item) => item.impact === "high")) {
    codes.push("high_impact_calendar");
  }
  if (headlines.length > 0) {
    codes.push("approved_headline_metadata_present");
  }
  if (userRows.length > 0) {
    codes.push("user_names_present");
  }
  return codes;
}

function buildPortfolioCommentFacts(rows: PulseBriefUserNameRow[], breadth: PulseBriefBreadth): string[] {
  const up = rows.filter((row) => row.direction === "up").length;
  const down = rows.filter((row) => row.direction === "down").length;
  return [
    `${rows.length} tracked names have approved rows`,
    `${up} up and ${down} down`,
    `market breadth is ${breadth}`,
  ];
}
