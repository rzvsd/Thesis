import type {
  EvidenceItem,
  MarketPulseReport,
  MarketTapeMove
} from "../../../packages/contracts/src";

export type PulseBriefMode = "quiet" | "normal" | "event";
export type PulseBriefBreadth = "higher" | "lower" | "mixed" | "quiet" | "thin";

export interface PulseBriefMove {
  id: string;
  label: string;
  value?: number;
  change?: number;
  changePct?: number;
  unit?: string;
  family: string;
  direction: "up" | "down" | "flat";
}

export interface PulseBriefDeltaItem {
  label: string;
  detail: string;
  importance: "high" | "medium" | "low";
}

export interface PulseBriefInterestingCandidate {
  code: string;
  facts: string[];
  importance: "high" | "medium" | "low";
}

export interface PulseBriefUserNameRow {
  ticker: string;
  companyName?: string;
  previousClose?: number;
  latestPrice?: number;
  changePct?: number;
  direction: "up" | "down" | "flat";
  note: string;
}

export interface PulseBriefCalendarItem {
  timeLabel?: string;
  title: string;
  impact: "high" | "medium" | "low";
}

export interface PulseBriefHeadline {
  headline: string;
  sourceName: string;
  sourceUrl?: string;
  publishedAt?: string;
  topic?: string;
}

export interface PulseBriefOmission {
  family: string;
  reason: string;
}

export interface PulseBriefFactPack {
  as_of: string;
  mode: PulseBriefMode;
  morning_verdict: {
    deterministic_label: string;
    reason_codes: string[];
  };
  tape: {
    indices: PulseBriefMove[];
    cross_asset: PulseBriefMove[];
    breadth: PulseBriefBreadth;
    notable_moves: PulseBriefMove[];
  };
  deltas: {
    vs_yesterday: PulseBriefDeltaItem[];
    vs_5d: PulseBriefDeltaItem[];
    unchanged: string[];
    baseline: boolean;
  };
  interesting_candidates: PulseBriefInterestingCandidate[];
  user_names?: {
    rows: PulseBriefUserNameRow[];
    portfolio_comment_facts: string[];
  };
  calendar?: PulseBriefCalendarItem[];
  headlines?: PulseBriefHeadline[];
  evidence: EvidenceItem[];
  omissions: PulseBriefOmission[];
  sources: string[];
}

export interface PulseBriefCopy {
  morning_line: string;
  yesterday_comment: string;
  interesting_bit: string;
  your_names_comment?: string;
  signal: string;
  noise: string;
}

export interface PulseBriefPlan {
  fact_pack: PulseBriefFactPack;
  copy: PulseBriefCopy;
}

const quietIndexMovePct = 0.35;
const notableIndexMovePct = 1.0;
const notableVixMovePct = 4.0;
const notableOilMovePct = 1.5;
const notableRateMove = 0.08;
const notableCreditMove = 0.1;

export function buildPulseBriefPlan(report: MarketPulseReport): PulseBriefPlan {
  const factPack = buildPulseBriefFactPack(report);
  return {
    fact_pack: factPack,
    copy: {
      ...buildDeterministicPulseBriefCopy(factPack),
      ...report.brief_editorial
    }
  };
}

export function buildPulseBriefFactPack(report: MarketPulseReport): PulseBriefFactPack {
  const indices = normalizeMoves(report.market_tape?.indices ?? []);
  const crossAsset = normalizeMoves(report.market_tape?.cross_asset ?? []);
  const breadth = classifyBreadth(indices);
  const notableMoves = [...indices, ...crossAsset].filter(isNotableMove).slice(0, 8);
  const calendar = normalizeCalendar(report);
  const headlines = normalizeHeadlines(report);
  const userRows = normalizeUserRows(report);
  const deltaItems = buildDeltaItems(report, breadth, notableMoves);
  const unchanged = buildUnchangedItems(report, deltaItems);
  const baseline = isBaselineIssue(report);
  const interesting = buildInterestingCandidates(report, breadth, notableMoves);
  const omissions = buildOmissions(report);
  const sources = collectSources(report);
  const mode = classifyMode({
    report,
    breadth,
    notableMoves,
    deltaItems,
    calendar,
    headlines,
    userRows
  });

  return {
    as_of: report.market_tape?.as_of ?? report.macro_stress.as_of ?? report.cycle_end.slice(0, 10),
    mode,
    morning_verdict: {
      deterministic_label: buildVerdictLabel(mode, breadth, report),
      reason_codes: buildReasonCodes(report, breadth, notableMoves, calendar, headlines, userRows)
    },
    tape: {
      indices,
      cross_asset: crossAsset,
      breadth,
      notable_moves: notableMoves
    },
    deltas: {
      vs_yesterday: baseline ? [] : deltaItems,
      vs_5d: [],
      unchanged,
      baseline
    },
    interesting_candidates: interesting,
    user_names: userRows.length > 0
      ? {
          rows: userRows,
          portfolio_comment_facts: buildPortfolioCommentFacts(userRows, breadth)
        }
      : undefined,
    calendar: calendar.length > 0 ? calendar : undefined,
    headlines: headlines.length > 0 ? headlines : undefined,
    evidence: collectEvidence(report),
    omissions,
    sources
  };
}

export function buildDeterministicPulseBriefCopy(factPack: PulseBriefFactPack): PulseBriefCopy {
  const morningLine = buildMorningLine(factPack);
  return {
    morning_line: morningLine,
    yesterday_comment: buildYesterdayComment(factPack),
    interesting_bit: buildInterestingBit(factPack),
    your_names_comment: factPack.user_names ? buildYourNamesComment(factPack) : undefined,
    signal: buildSignal(factPack),
    noise: buildNoise(factPack)
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
    direction: move.direction
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
    .map((item) => ({
      timeLabel: item.time_label,
      title: item.title,
      impact: item.impact
    }));
}

function normalizeHeadlines(report: MarketPulseReport): PulseBriefHeadline[] {
  const regular = (report.morning_edition?.headline_digest ?? []).map((item) => ({
    headline: item.headline,
    sourceName: item.source_name,
    sourceUrl: item.source_url,
    publishedAt: item.published_at,
    topic: item.topic
  }));
  const macro = (report.macro_news?.items ?? []).map((item) => ({
    headline: item.headline,
    sourceName: item.source_name,
    sourceUrl: item.source_url,
    publishedAt: item.published_at,
    topic: item.topic
  }));
  return dedupeBy(
    [...macro, ...regular],
    (item) => `${item.sourceName}:${item.headline}`
  ).slice(0, 5);
}

function normalizeUserRows(report: MarketPulseReport): PulseBriefUserNameRow[] {
  return (report.morning_edition?.portfolio_radar ?? [])
    .filter((row) => row.ticker.trim().length > 0)
    .slice(0, 8)
    .map((row) => ({
      ticker: row.ticker.trim().toUpperCase(),
      companyName: row.company_name,
      previousClose: row.previous_close,
      latestPrice: row.latest_price,
      changePct: row.change_pct,
      direction: row.direction,
      note: sanitizeUserRowNote(row.reason, row.direction, typeof row.change_pct === "number")
    }));
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
  hasMove: boolean
): string {
  const clean = reason?.replace(/\s+/g, " ").trim();
  if (
    !clean ||
    /UserResearchState|regex|text-match|text matched|omission|debug|runtime|dispatch|trading signal/i.test(clean)
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
  notableMoves: PulseBriefMove[]
): PulseBriefDeltaItem[] {
  const items: PulseBriefDeltaItem[] = [];
  const issueItems = report.editorial_issue?.what_changed ?? [];
  for (const item of issueItems.slice(0, 3)) {
    const body = cleanSentence(item.body);
    if (body && !/no material change/i.test(body) && isCustomerSafeDelta(body)) {
      items.push({
        label: item.title,
        detail: body,
        importance: item.importance
      });
    }
  }

  if (items.length === 0 && breadth !== "quiet" && breadth !== "thin") {
    items.push({
      label: "Tape direction",
      detail: `The reviewed tape is ${breadth}.`,
      importance: breadth === "mixed" ? "medium" : "high"
    });
  }

  for (const move of notableMoves.slice(0, 2)) {
    items.push({
      label: move.label,
      detail: `${move.label} moved ${formatMoveChange(move)}.`,
      importance: move.family === "volatility" || move.family === "rates" ? "high" : "medium"
    });
  }

  return dedupeBy(items, (item) => `${item.label}:${item.detail}`).slice(0, 5);
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
  notableMoves: PulseBriefMove[]
): PulseBriefInterestingCandidate[] {
  const candidates: PulseBriefInterestingCandidate[] = [];
  const ratesFriendly = notableMoves.some((move) =>
    move.family === "rates" && (move.change ?? 0) < 0
  );
  const vixCooled = notableMoves.some((move) =>
    move.family === "volatility" && (move.change ?? 0) < 0
  );
  const creditNotConfirming = (report.market_tape?.cross_asset ?? []).some((move) =>
    move.family === "credit" && move.direction !== "down"
  );
  const sectorLeader = report.market_tape?.sector_leadership?.leaders?.[0];

  if ((breadth === "higher" || breadth === "mixed") && ratesFriendly) {
    candidates.push({
      code: "risk_assets_with_friendlier_rates",
      facts: ["equities improved", "rates moved lower"],
      importance: "high"
    });
  }
  if (vixCooled && creditNotConfirming) {
    candidates.push({
      code: "vix_cools_credit_mixed",
      facts: ["volatility cooled", "credit did not fully confirm"],
      importance: "medium"
    });
  }
  if (breadth !== "quiet" && report.macro_stress.state !== "stable") {
    candidates.push({
      code: "tape_tolerates_macro_pressure",
      facts: [`tape was ${breadth}`, `macro state remained ${report.macro_stress.state}`],
      importance: "medium"
    });
  }
  if (sectorLeader) {
    candidates.push({
      code: "sector_leadership",
      facts: [`${normalizeMoveLabel(sectorLeader.label)} led the sector basket`],
      importance: "low"
    });
  }
  if (candidates.length === 0) {
    candidates.push({
      code: "no_clean_divergence",
      facts: ["no single cross-asset divergence cleared the brief threshold"],
      importance: "low"
    });
  }
  return candidates.slice(0, 3);
}

function buildOmissions(report: MarketPulseReport): PulseBriefOmission[] {
  const tape = (report.market_tape?.omissions ?? []).map((omission) => ({
    family: omission.instrument_id ?? omission.family,
    reason: omission.reason_text
  }));
  const macro = (report.macro_news?.omissions ?? []).map((omission) => ({
    family: omission.family,
    reason: omission.reason_text
  }));
  const morning = (report.morning_edition?.coverage_notes ?? []).map((note) => ({
    family: "morning_edition",
    reason: note
  }));
  return [...tape, ...macro, ...morning].slice(0, 6);
}

function collectEvidence(report: MarketPulseReport): EvidenceItem[] {
  const evidence = new Map<string, EvidenceItem>();
  for (const section of Object.values(report.sections)) {
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
  for (const section of Object.values(report.sections)) {
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
    (input.report.macro_news?.items ?? []).some((item) => item.severity === "shock");
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
  report: MarketPulseReport
): string {
  if (mode === "quiet") {
    return "no material change";
  }
  if (mode === "event") {
    return report.macro_news?.state === "shock" ? "event day: macro headline led" : "event day: attention threshold crossed";
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
  userRows: PulseBriefUserNameRow[]
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
    `market breadth is ${breadth}`
  ];
}

function buildMorningLine(factPack: PulseBriefFactPack): string {
  if (factPack.mode === "quiet") {
    return "Markets were quiet, macro stayed put, and nothing in the approved inputs demands a louder brief.";
  }
  if (factPack.mode === "event") {
    const shock = factPack.morning_verdict.reason_codes.includes("macro_news_shock");
    return shock
      ? "A confirmed attention event moved to the front, so today starts with risk context before tape color."
      : "A market or calendar threshold crossed, but the brief still separates movement from thesis change.";
  }
  if (factPack.tape.breadth === "higher") {
    return "Risk appetite improved, but the move still needs confirmation beyond one session.";
  }
  if (factPack.tape.breadth === "lower") {
    return "Risk appetite softened while the macro frame stayed in place.";
  }
  return "The tape was mixed, and the macro backdrop did not give the market a clean new answer.";
}

function buildYesterdayComment(factPack: PulseBriefFactPack): string {
  if (factPack.tape.breadth === "quiet") {
    return "The tape was quiet enough that the important message is restraint: no material market shift cleared the brief threshold.";
  }
  const leaders = factPack.tape.notable_moves.slice(0, 2).map((move) => `${move.label} ${formatMoveChange(move)}`);
  if (leaders.length > 0) {
    return `The board was ${factPack.tape.breadth}. ${leaders.join(" and ")} stood out, while the brief keeps that as context rather than a regime call.`;
  }
  return `The board was ${factPack.tape.breadth}. The move is useful context, but not enough by itself to reset conviction.`;
}

function buildInterestingBit(factPack: PulseBriefFactPack): string {
  const candidate = factPack.interesting_candidates[0];
  if (!candidate || candidate.code === "no_clean_divergence") {
    return "The useful part is what did not happen: the data did not force a new story, so the brief stays deliberately light.";
  }
  if (candidate.code === "risk_assets_with_friendlier_rates") {
    return "The interesting part is that equities improved while rates moved in a friendlier direction. That is cleaner than a green-index day fighting yields.";
  }
  if (candidate.code === "vix_cools_credit_mixed") {
    return "The interesting part is that volatility cooled while credit did not fully confirm the risk-on story. That makes the move better, not decisive.";
  }
  if (candidate.code === "tape_tolerates_macro_pressure") {
    return "The interesting part is not new macro relief. The market simply tolerated the same pressure better than before.";
  }
  return `${candidate.facts[0]}. That matters only if it keeps showing up in the next brief.`;
}

function buildYourNamesComment(factPack: PulseBriefFactPack): string | undefined {
  const rows = factPack.user_names?.rows ?? [];
  if (rows.length === 0) {
    return undefined;
  }
  const moved = rows.filter((row) => Math.abs(row.changePct ?? 0) >= 1).length;
  if (moved === 0) {
    return "Your tracked names did not create their own story today.";
  }
  return "Your tracked names mostly belong in market context unless an approved company event says otherwise.";
}

function buildSignal(factPack: PulseBriefFactPack): string {
  if (factPack.mode === "quiet") {
    return "No material daily signal cleared the threshold.";
  }
  if (factPack.tape.breadth === "higher") {
    return "Risk appetite broadened in the reviewed tape.";
  }
  if (factPack.tape.breadth === "lower") {
    return "Risk appetite weakened in the reviewed tape.";
  }
  return "The useful signal is selectivity, not a broad turn.";
}

function buildNoise(factPack: PulseBriefFactPack): string {
  if (factPack.mode === "quiet") {
    return "A quiet day does not need invented novelty.";
  }
  return "One session does not prove a regime shift.";
}

function formatMoveChange(move: PulseBriefMove): string {
  if (move.family === "rates" && typeof move.change === "number") {
    return `${move.change > 0 ? "+" : ""}${trimNumber(move.change)} pts`;
  }
  if (typeof move.changePct === "number") {
    return formatPct(move.changePct);
  }
  if (typeof move.change === "number") {
    const suffix = move.unit ? ` ${move.unit}` : "";
    return `${move.change > 0 ? "+" : ""}${trimNumber(move.change)}${suffix}`;
  }
  return "with no clean change value";
}

function formatPct(value: number): string {
  return `${value > 0 ? "+" : ""}${trimNumber(value)}%`;
}

function trimNumber(value: number): string {
  return value.toFixed(Math.abs(value) >= 10 ? 1 : 2).replace(/\.?0+$/, "");
}

function cleanSentence(value: string): string {
  return value.replace(/\s+/g, " ").trim().replace(/\.$/, ".");
}

function isCustomerSafeDelta(value: string): boolean {
  return !/UserResearchState|regex|text-match|text matched|implementation|runtime|debug|trading signal/i.test(value);
}

function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const itemKey = key(item);
    if (seen.has(itemKey)) {
      continue;
    }
    seen.add(itemKey);
    result.push(item);
  }
  return result;
}
