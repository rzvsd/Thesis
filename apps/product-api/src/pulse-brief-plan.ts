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

export interface PulseBriefNameContext {
  tape_relation: "led" | "lagged" | "matched" | "unknown";
  sector_relation?: "led" | "lagged" | "matched" | "unknown";
  pending_event?: string;
  macro_read?: string;
  context_line: string;
}

export interface PulseBriefUserNameRow {
  ticker: string;
  companyName?: string;
  previousClose?: number;
  latestPrice?: number;
  changePct?: number;
  direction: "up" | "down" | "flat";
  note: string;
  context?: PulseBriefNameContext;
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
  narrative_facts: string[];
  one_thing: PulseBriefInterestingCandidate;
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
  the_read: string;
  what_changed_summary: string;
  why_it_matters: string;
  your_names_comment?: string;
  smart_comment: string;
  morning_story: string;
  tape_color: string;
  tape_narrative: string;
  calendar_narrative?: string;
  headlines_narrative?: string;
  names_narrative?: string;
  one_thing: string;
  mood: "confident" | "cautious" | "curious" | "calm";
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
  const deterministicCopy = buildDeterministicPulseBriefCopy(factPack);
  const editorial = report.brief_editorial;
  return {
    fact_pack: factPack,
    copy: {
      the_read:
        editorial?.the_read ??
        joinCopy([editorial?.morning_line, editorial?.yesterday_comment]) ??
        deterministicCopy.the_read,
      what_changed_summary:
        editorial?.what_changed_summary ?? deterministicCopy.what_changed_summary,
      why_it_matters:
        editorial?.why_it_matters ?? editorial?.interesting_bit ?? deterministicCopy.why_it_matters,
      your_names_comment:
        editorial?.your_names_comment ?? deterministicCopy.your_names_comment,
      smart_comment:
        editorial?.smart_comment ??
        joinCopy([editorial?.signal, editorial?.noise]) ??
        deterministicCopy.smart_comment,
      morning_story:
        editorial?.morning_story ?? editorial?.the_read ?? deterministicCopy.morning_story,
      tape_color: editorial?.tape_color ?? deterministicCopy.tape_color,
      tape_narrative: editorial?.tape_narrative ?? deterministicCopy.tape_narrative,
      calendar_narrative:
        editorial?.calendar_narrative ?? deterministicCopy.calendar_narrative,
      headlines_narrative:
        editorial?.headlines_narrative ?? deterministicCopy.headlines_narrative,
      names_narrative:
        editorial?.names_narrative ??
        editorial?.your_names_comment ??
        deterministicCopy.names_narrative,
      one_thing: editorial?.one_thing ?? editorial?.interesting_bit ?? deterministicCopy.one_thing,
      mood: editorial?.mood ?? deterministicCopy.mood
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
    narrative_facts: narrativeFacts,
    one_thing: oneThing,
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
  return {
    the_read: buildTheRead(factPack),
    what_changed_summary: buildWhatChangedSummary(factPack),
    why_it_matters: buildWhyItMatters(factPack),
    your_names_comment: factPack.user_names ? buildYourNamesComment(factPack) : undefined,
    smart_comment: buildSmartComment(factPack),
    morning_story: buildMorningStory(factPack),
    tape_color: buildTapeColor(factPack),
    tape_narrative: buildTapeNarrative(factPack),
    calendar_narrative: factPack.calendar?.length ? buildCalendarNarrative(factPack) : undefined,
    headlines_narrative: factPack.headlines?.length ? buildHeadlinesNarrative(factPack) : undefined,
    names_narrative: factPack.user_names ? buildNamesNarrative(factPack) : undefined,
    one_thing: buildOneThingLine(factPack),
    mood: classifyMood(factPack)
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

function normalizeUserRows(
  report: MarketPulseReport,
  breadth: PulseBriefBreadth
): PulseBriefUserNameRow[] {
  return (report.morning_edition?.portfolio_radar ?? [])
    .filter((row) => row.ticker.trim().length > 0)
    .slice(0, 8)
    .map((row) => {
      const normalized: PulseBriefUserNameRow = {
        ticker: row.ticker.trim().toUpperCase(),
        companyName: row.company_name,
        previousClose: row.previous_close,
        latestPrice: row.latest_price,
        changePct: row.change_pct,
        direction: row.direction,
        note: sanitizeUserRowNote(row.reason, row.direction, typeof row.change_pct === "number")
      };
      return {
        ...normalized,
        context: buildNameContext(report, normalized, breadth)
      };
    });
}

function buildNameContext(
  report: MarketPulseReport,
  row: PulseBriefUserNameRow,
  breadth: PulseBriefBreadth
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
    context_line: contextLine
  };
}

function classifyNameTapeRelation(
  row: PulseBriefUserNameRow,
  breadth: PulseBriefBreadth
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
  const item = report.morning_edition?.today_catalysts.find((entry) =>
    tickerPattern.test(entry.title)
  );
  return item ? `${item.time_label ?? "Watch"}: ${item.title}` : undefined;
}

function buildNameContextLine(
  row: PulseBriefUserNameRow,
  tapeRelation: PulseBriefNameContext["tape_relation"],
  pendingEvent: string | undefined,
  macroRead: string | undefined,
  magnitude: number
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
    const body = normalizeDeltaDetail(cleanSentence(item.body));
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

function normalizeDeltaDetail(detail: string): string {
  let clean = detail.replace(/\bMacro Stress\b/g, "macro regime");
  clean = clean.replace(
    /\bmoved from (higher|lower|mixed|quiet|thin) to \1\b/gi,
    (_match, state: string) => `remained ${state.toLowerCase()}`
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

function selectOneThing(candidates: PulseBriefInterestingCandidate[]): PulseBriefInterestingCandidate {
  return [...candidates].sort((left, right) =>
    importanceRank(right.importance) - importanceRank(left.importance)
  )[0] ?? {
    code: "no_clean_divergence",
    facts: ["no single cross-asset divergence cleared the brief threshold"],
    importance: "low"
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
  oneThing: PulseBriefInterestingCandidate
): string[] {
  const facts: string[] = [];
  const vix = notableMoves.find((move) => move.family === "volatility");
  const rate = notableMoves.find((move) => move.family === "rates");
  const credit = (report.market_tape?.cross_asset ?? []).find((move) => move.family === "credit");
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
    facts.push(`Credit ${credit.direction === "down" ? "helped confirm" : "did not fully confirm"} the risk read.`);
  }
  if (leader && laggard) {
    facts.push(`${normalizeMoveLabel(leader.label)} led while ${normalizeMoveLabel(laggard.label)} lagged the sector basket.`);
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

function buildTheRead(factPack: PulseBriefFactPack): string {
  if (factPack.mode === "quiet") {
    return "Quiet session. Indices were flat, volatility stayed contained, and macro did not force a new read. This is the kind of morning where the useful product is restraint.";
  }
  if (factPack.mode === "event") {
    const shock = factPack.morning_verdict.reason_codes.includes("macro_news_shock");
    return shock
      ? "An event moved to the front. Start with the confirmed risk context, then read the tape, macro, and tracked names through that lens. This is the morning where pretending the market is only a price grid would be professionally silly."
      : "Something crossed the attention threshold. The brief treats the move seriously, but still separates market movement from thesis change. The point is to know what deserves attention without letting one loud print hijack the whole thesis.";
  }
  if (factPack.tape.breadth === "higher") {
    return "Risk appetite improved, but conviction did not reset. Yesterday's tape was broadly better: equities rose, volatility cooled, and the cross-asset backdrop was easier to digest. That is healthier than price alone, and yes, the market gets a cookie for not making the move messy. It still does not get a crown.";
  }
  if (factPack.tape.breadth === "lower") {
    return "Risk appetite softened while the macro frame stayed in place. The important point is not just that indices fell; it is whether volatility, rates, credit, or tracked-name evidence confirmed a broader deterioration. Markets are allowed to have a bad day. Thesis is not required to faint on cue.";
  }
  return "The tape was mixed, and the macro backdrop did not give the market a clean new answer. That makes today more about separating useful context from noise than forcing a strong directional read. Mixed sessions are where lazy commentary goes to multiply; the useful job is to keep the maybes in their lane.";
}

function buildWhatChangedSummary(factPack: PulseBriefFactPack): string {
  if (factPack.deltas.baseline) {
    return [
      "Baseline issue. Today starts the comparison set, so the read begins with current tape, macro, headlines, and tracked-name evidence rather than pretending there is a yesterday-to-today insight hiding under the table.",
      "The useful habit begins here: store the first clean read, then make future issues earn their drama against it.",
      "If tomorrow changes, Thesis can say what changed. If tomorrow does not, the brief can say that too, with the confidence of a product that does not need to invent weather indoors.",
      "That baseline discipline is not glamorous, but it is what makes the next issue sharper. Without a clean starting point, every later comparison turns into interpretive fog with a nice font. This section is the anchor: here is the tape, here is the macro frame, here are the names, here are the gaps, and here is what will be measured against tomorrow. The first issue earns trust by resisting the urge to behave like it has a memory it has not built yet."
    ].join(" ");
  }
  if (factPack.deltas.vs_yesterday.length === 0) {
    return [
      "Nothing moved the needle. Same macro, same tape direction, same tracked-name picture as yesterday.",
      "That may sound boring, which is exactly why it is useful. A daily brief should not put on a costume every morning just to prove it woke up.",
      "The right read is continuity: no fresh confirmation, no fresh contradiction, no new company-specific evidence demanding a rewrite. The market can whisper; Thesis does not have to shout back.",
      "This is where a morning product earns its keep. It should tell the reader that yesterday still describes today, then stop politely before building a decorative argument around a flat line. Quiet continuity is not empty. It protects the user from false novelty, keeps attention available for the next real catalyst, and makes the brief feel honest enough to trust on louder days. No new delta means no new costume. Revolutionary stuff, apparently."
    ].join(" ");
  }
  const details = factPack.deltas.vs_yesterday
    .slice(0, 4)
    .map((item) => item.detail.replace(/\.$/, ""))
    .join(". ");
  return [
    `${details}.`,
    "That is the change set, not a permission slip to narrate a new era.",
    "The distinction matters. A daily move can improve the texture of the morning, but a thesis should move only when the evidence stack moves with it. So the brief gives the tape credit where it earned it, keeps macro pressure visible where it still matters, and refuses to turn every green or red line into a personality test for the market.",
    "The useful reader question is simple: did the day add evidence, or did it merely add motion? Motion is still worth recording. It can change tone, pressure, breadth, or attention. But evidence changes the read. This section keeps those two ideas separate, which is less dramatic than declaring a new market personality and far more useful before coffee. The market can be excitable. The brief does not need to join the group chat."
  ].join(" ");
}

function buildWhyItMatters(factPack: PulseBriefFactPack): string {
  if (factPack.tape.breadth === "quiet") {
    return "Nothing happened worth dressing up. That is the read, and it matters when attention is the scarce asset. Quiet days are where bad products manufacture novelty and good ones protect the reader. The useful output is not a grand theory. It is a clean refusal to make one up.";
  }
  const vixMove = factPack.tape.cross_asset.find((move) => move.family === "volatility");
  if (factPack.tape.breadth === "higher" && vixMove?.direction === "down") {
    return "The useful part is not that stocks went up. It is that the move came with lower volatility, which gives the session better texture than price alone. A rally fighting higher stress is a noisy guest. A rally with calmer volatility is at least wearing shoes indoors. Still, conviction needs repeated confirmation or company-specific evidence.";
  }
  const candidate = factPack.interesting_candidates[0];
  if (candidate?.code === "risk_assets_with_friendlier_rates") {
    return "The useful part is the read-through between equities and rates. A green tape is easier to respect when yields are not pushing harder against it. That still supports context rather than a standalone thesis change. The market gets a cleaner sentence today, not an entire chapter rewrite.";
  }
  if (candidate?.code === "vix_cools_credit_mixed") {
    return "Volatility cooled, but credit did not fully confirm a clean risk-on story. That makes the session better than yesterday's setup, not yet convincing enough to change the macro read. It is a better-looking puzzle piece, not the finished picture. Anyone calling that a full regime reset is doing arts and crafts.";
  }
  if (candidate?.code === "tape_tolerates_macro_pressure") {
    return "Macro did not suddenly become easier. The better read is that the market tolerated the same pressure more calmly, which improves context without proving that the pressure has gone away. That is subtle, and subtle is useful. It keeps the brief from confusing market tolerance with actual macro relief.";
  }
  return "The useful part is what did not happen: the data did not force a new story. That keeps the brief focused on confirmed movement rather than turning every daily print into a thesis change. The market offered context, not revelation. A serious brief should know the difference and spare everyone the confetti.";
}

function buildYourNamesComment(factPack: PulseBriefFactPack): string | undefined {
  const rows = factPack.user_names?.rows ?? [];
  if (rows.length === 0) {
    return undefined;
  }
  const moved = rows.filter((row) => Math.abs(row.changePct ?? 0) >= 1).length;
  if (moved === 0) {
    return [
      "Your names did not create their own story today. They remain useful context, but not company-specific evidence.",
      "That is not a flaw in the brief; it is the point of having a watchlist that is tied to evidence rather than vibes in a trench coat.",
      "When a tracked name moves without a filing, first-party update, or verified catalyst, Thesis treats the price action as market context first. The company read waits for company evidence. Very annoying for drama, very helpful for sanity."
    ].join(" ");
  }
  return [
    "Your names mostly moved with the broader tape. That makes yesterday useful context, but not company-specific evidence.",
    "The distinction is where the product earns its keep. AAPL or MSFT moving with the market is information, but it is not automatically a company story. The brief checks whether a tracked name led, lagged, or simply rode the same wave as the index.",
    "If there is no filing, first-party update, or approved catalyst, the read stays humble: market movement first, thesis change later."
  ].join(" ");
}

function buildSmartComment(factPack: PulseBriefFactPack): string {
  if (factPack.mode === "quiet") {
    return [
      "Nothing happened worth dressing up. A quiet brief earns trust when it protects attention instead of manufacturing novelty.",
      "The temptation is to inflate a flat tape into a Very Important Morning. Resist it. If the market did not hand us a useful change, the smarter move is to say so, save the reader five minutes, and keep the evidence stack clean for the day that actually deserves the oxygen.",
      "That restraint is not a lack of analysis. It is analysis with enough self-respect to stop talking. A quiet day still has value: it confirms what did not break, what did not accelerate, and what did not deserve a thesis rewrite. The honest read is therefore short, slightly boring, and extremely useful. The market offered a shrug. Thesis should not translate that shrug into an opera."
    ].join(" ");
  }
  if (factPack.tape.breadth === "higher") {
    return [
      "Yesterday gave users a cleaner tape, not a stronger thesis. The difference matters.",
      "A better session can improve context, but conviction should come from repeated confirmation, official events, or company-specific evidence rather than one green market day.",
      "This is the part where a terminal can show the numbers and still miss the point. The point is not that prices moved. The point is whether the move came with enough confirming texture to change what a serious person should remember tomorrow.",
      "If volatility cooled, breadth improved, and tracked names behaved sensibly, the morning gets easier to read. It still does not become a coronation. A good brief should be able to say the tape improved while keeping the thesis on a shorter leash. Green screens are pleasant. They are not evidence by themselves. Delightful, yes. Legally permitted to be interesting, yes. Automatically profound, absolutely not."
    ].join(" ");
  }
  if (factPack.tape.breadth === "lower") {
    return [
      "A weaker tape deserves attention, but not theater.",
      "The right question is whether the move is confirmed by volatility, rates, credit, macro releases, or company evidence. Without that confirmation, the brief should treat the move as context rather than a thesis break.",
      "Red on the screen is not analysis. It is an invitation to check whether anything durable actually changed. Sometimes the answer is yes. Sometimes the market just wanted to be dramatic before breakfast.",
      "The honest read should keep pressure visible without letting pressure become panic. If rates, credit, volatility, and company evidence all confirm the weakness, then the brief can get louder. If they do not, it should stay precise. A down day can matter. It can also be one session with a bad mood and better lighting. Thesis checks the difference before turning concern into performance art."
    ].join(" ");
  }
  return [
    "The market did not give a clean answer. That is useful in its own way: mixed tapes reward patience, clean sourcing, and attention to what actually changed.",
    "The brief should make the ambiguity readable without pretending it disappeared.",
    "A mixed tape is not a failed story. It is a warning label against overconfidence. The smart read is to track the few parts that moved, name the parts that did not, and avoid turning uncertainty into fake precision with a nice font.",
    "That is the value of the honest read: it lets the brief be useful even when the market refuses to be tidy. Some mornings have a clean thesis. Others have fragments, cross-currents, and one or two details worth remembering. Today belongs to the second category. The correct tone is alert, selective, and faintly allergic to grand conclusions. If the market offers partial evidence, Thesis should give the reader partial confidence, not a full sermon. Very glamorous. Also correct."
  ].join(" ");
}

function buildMorningStory(factPack: PulseBriefFactPack): string {
  if (factPack.mode === "quiet") {
    return "Quiet session. Indices were flat, volatility stayed contained, and macro did not force a new read.\n\nNothing moved the needle across the reviewed tape, tracked names, or approved headline set. That is not a missing story; it is the story.\n\nThe morning read is thirty seconds: same backdrop, same evidence, no reason to dress it up.";
  }

  return [
    buildTheRead(factPack),
    "The morning read is not trying to be a tiny newspaper with a dramatic hat. It is trying to answer the only question that matters before coffee gets cold: what changed, what did not, and which part deserves a place in memory.",
    factPack.narrative_facts.slice(0, 3).join(" "),
    "That gives the issue a throughline: tape first, macro second, tracked names only where the evidence earns it. The market can be loud. Thesis gets to be selective.",
    "The point is not to make the morning sound important. The point is to decide whether it is important, then write accordingly. When the tape improves, the brief should explain the texture. When macro stays elevated, it should leave that pressure visible. When tracked names move without company evidence, it should name the movement and withhold the drama. This is the whole product promise in miniature: fewer fake conclusions, more useful judgment."
  ].filter((sentence) => sentence.trim().length > 0).join(" ");
}

function buildTapeNarrative(factPack: PulseBriefFactPack): string {
  const moves = [...factPack.tape.indices, ...factPack.tape.cross_asset].slice(0, 6);
  const moveText = moves.length > 0
    ? moves.map((move) => `${move.label} ${formatMoveChange(move)}`).join(", ")
    : "approved tape coverage was thin";
  if (factPack.tape.breadth === "quiet") {
    return [
      `The tape was quiet: ${moveText}.`,
      "That is not a secret message from the market. It is mostly a lack of useful movement, which is allowed to be the answer.",
      "Quiet tape days are where commentary tends to develop a little too much confidence for its own good. Thesis keeps it plain: no broad move, no stress confirmation, no need to manufacture a heroic explanation.",
      "The value is in the absence of confirmation. If indices, volatility, rates, credit, oil, and the dollar do not clear a threshold, the tape is telling the reader to conserve attention. That is a valid market read, not an editorial failure. A worse product would pretend the stillness has a secret plot. Thesis simply says the board was quiet, the cross-asset read stayed contained, and the morning does not need a cape."
    ].join(" ");
  }
  if (factPack.tape.breadth === "higher") {
    return [
      `The tape leaned higher: ${moveText}.`,
      "The useful detail is not just direction. It is whether the move had cleaner texture across volatility, rates, oil, dollar, and credit. A green index day with stress rising is a suspicious little parade. A green index day with calmer stress is more respectable.",
      "Respectable still does not mean decisive. This section gives the move credit for what it showed, then stops before turning one session into a personality transplant for the market.",
      "The reader should leave knowing whether the move was broad, narrow, confirmed, contradicted, or simply pleasant to look at. That is the difference between market context and terminal decoration. A price grid can tell the user what moved. The brief should explain how clean the move looked, what confirmed it, what refused to confirm it, and why the answer still has to stay smaller than the excitement."
    ].join(" ");
  }
  if (factPack.tape.breadth === "lower") {
    return [
      `The tape leaned lower: ${moveText}.`,
      "That deserves attention, but the discipline is the same in reverse. A red tape only becomes thesis-relevant when cross-asset stress, macro releases, or company evidence confirm that something more durable is happening.",
      "Otherwise it is a weaker session, not a constitutional crisis. The brief is here to separate pressure from panic, which is apparently a rare service before 9 a.m.",
      "The useful read checks whether volatility rose, rates tightened, credit widened, oil added pressure, or the dollar moved in a way that changed the macro texture. If those pieces line up, the downside deserves a louder treatment. If they do not, the section keeps the weakness in proportion. Red numbers can be useful evidence. They can also be the market clearing its throat like it has an announcement, then forgetting the announcement."
    ].join(" ");
  }
  return [
    `The tape was mixed: ${moveText}.`,
    "Mixed tape is less satisfying than a clean green or red board, but it is often more honest.",
    "The reader should leave with the shape of the market, not a forced verdict. Some parts moved, some parts refused to confirm, and the right answer is to keep the contradiction visible instead of sanding it down into a fake narrative.",
    "This is where the brief earns the right to be trusted later. If the S&P rises while the rest of the tape is thin, say that. If volatility cools but breadth refuses to broaden, say that too. Mixed does not mean meaningless. It means the morning has texture, tension, and limits. The market handed over a partial sentence. Thesis should not forge the rest of the paragraph and pretend the signature matches. The honest version is still useful: direction where it exists, caution where confirmation refused to show up."
  ].join(" ");
}

function buildTapeColor(factPack: PulseBriefFactPack): string {
  const leader = [...factPack.tape.indices].sort((left, right) =>
    Math.abs(right.changePct ?? 0) - Math.abs(left.changePct ?? 0)
  )[0];
  const vix = factPack.tape.cross_asset.find((move) => move.family === "volatility");
  if (factPack.tape.breadth === "quiet") {
    return "Quiet tape, nothing to dress up";
  }
  if (leader && vix?.direction === "down") {
    return `${leader.label} led, VIX cooled`;
  }
  if (leader) {
    return `${leader.label} set the tape`;
  }
  return factPack.tape.breadth === "mixed" ? "Mixed tape, selective read" : `Tape was ${factPack.tape.breadth}`;
}

function buildOneThingLine(factPack: PulseBriefFactPack): string {
  const candidate = factPack.one_thing;
  if (candidate.code === "risk_assets_with_friendlier_rates") {
    return "Equities improved without rates pushing harder against them. That is the cleaner detail. It does not mean the market discovered a new regime in the couch cushions, but it does make the session easier to respect. A green tape fighting rates is messy. A green tape with rates behaving is less messy. That is not a thesis upgrade by itself; it is a better backdrop for interpreting the next piece of evidence. The useful observation is the alignment, not the index color.";
  }
  if (candidate.code === "vix_cools_credit_mixed") {
    return "Volatility cooled, but credit did not fully confirm the risk-on story. That tension is the interesting bit. Equity investors were calmer, but the broader risk stack did not wave both hands and yell confirmation. The market improved, sure, but it did not hand over a notarized document. That makes the day cleaner than yesterday, not yet convincing enough to rewrite the macro read. The smart read is to respect the cooling in stress while refusing to pretend every asset class sang the same song.";
  }
  if (candidate.code === "tape_tolerates_macro_pressure") {
    return "Macro did not get easier; the market simply tolerated it better for a session. That is the difference worth remembering. Sometimes the market changes its mood before the data changes its mind, and that can be useful context without being proof. The brief should not confuse tolerance with relief. It should say the market handled the same pressure with fewer theatrics, then wait for confirmation. Boring? Maybe. Better than pretending one calm session repealed macro gravity. The memorable point is the gap between backdrop and behavior: same pressure, cleaner reaction. That can matter for tone, but it does not deserve to become a thesis upgrade. The market looked more comfortable. It did not produce a doctor's note saying the macro problem left town. Keep that distinction close; it is where useful skepticism lives. The point is subtle, which is rude of it, but subtle is often where the morning actually gets smarter.";
  }
  if (candidate.code === "sector_leadership") {
    return `${candidate.facts[0]}. Leadership mattered more than the index print. The headline index can look tidy while the real story sits underneath, quietly deciding who did the work and who just came along for the ride. That is why this brief checks leadership instead of only admiring the top-line number. A market carried by a narrow cluster deserves a different read from one where participation broadens. Same color on the board, very different texture. Tiny detail, large usefulness.`;
  }
  return "No clean divergence cleared the bar, so restraint is the useful signal. That may not sound glamorous, but glamour is not the assignment. The assignment is to find the one thing worth remembering and leave the rest in the drawer. Today the data did not produce a sharp cross-asset contradiction or a confirmed tracked-name catalyst. That makes the honest observation simple: no hidden fireworks, no need to pretend the ash is confetti.";
}

function buildNamesNarrative(factPack: PulseBriefFactPack): string {
  const rows = factPack.user_names?.rows ?? [];
  const leaders = rows.filter((row) => row.context?.tape_relation === "led");
  const laggards = rows.filter((row) => row.context?.tape_relation === "lagged");
  if (leaders[0]) {
    return `${leaders[0].ticker} stood out versus the tape, but no approved company-specific catalyst changed the read. That is exactly where portfolio commentary usually gets sloppy. A name can lead the board and still be moving on market context, liquidity, factor pressure, or plain old crowd enthusiasm. Thesis treats the price move as a question, not an answer. If a filing, first-party update, or confirmed event appears, the name gets its own story. Until then, the smart read is: notable move, evidence still pending, do not confuse motion with explanation. This is especially important for tracked names, where users naturally want every wiggle to mean something personal. Sometimes it does. Often it does not. The brief keeps the name visible, gives the price action credit, and refuses to invent a company narrative from market exhaust fumes. The result is less dramatic and still far more useful. Annoyingly disciplined, which is the whole point.`;
  }
  if (laggards[0]) {
    return `${laggards[0].ticker} lagged the tape, but the move stays contextual without first-party or SEC evidence. That matters more than it sounds. A lagging tracked name can be an early warning, or it can be a completely ordinary wobble wearing a dramatic coat. The brief checks the company evidence before letting the price action write the script. Today the user-name read is therefore disciplined: watch the divergence, name it clearly, and do not turn it into a thesis story without better proof. That discipline protects the user from the most common portfolio mistake: treating relative weakness as a confirmed company problem before the evidence has bothered to arrive. Price gets noticed. Evidence gets the microphone.`;
  }
  return "Your names mostly moved with the broader tape. That makes the session useful context, not company-specific evidence. This is the adult supervision part of the brief. If the market rises and AAPL rises, the lazy sentence is that AAPL had a great day. The better sentence is that AAPL participated in a stronger tape while no confirmed company-specific catalyst changed the read. That distinction saves the user from treating every portfolio move as a thesis event. Helpful. Slightly less exciting. Infinitely cleaner. It also makes future alerts sharper. When a tracked name finally moves against the tape, around an earnings date, or after a first-party filing, Thesis can treat that as a real attention event. Today, the names belong inside the market story, not above it wearing a crown.";
}

function buildCalendarNarrative(factPack: PulseBriefFactPack): string {
  const items = factPack.calendar ?? [];
  const first = items[0];
  if (!first) {
    return "";
  }
  return [
    `The watch list starts with ${first.title}${first.timeLabel ? ` at ${first.timeLabel}` : ""}.`,
    "Calendar items are not predictions; they are attention appointments. The useful question is not whether the item will be dramatic, but whether it can confirm or challenge the current read.",
    "For macro items, Thesis watches whether rates, inflation, labor, growth, or energy pressure changes. For company items, it looks for first-party evidence that can move a tracked-name thesis. Everything else is just a scheduled opportunity for people to sound confident before the facts arrive, a venerable market tradition.",
    "The calendar is useful only when it stays humble. It should not pretend to know the outcome of an earnings release, a Fed speech, or a macro print. It should tell the user what could change the read and what evidence would matter afterward. If the event confirms the current tape, the brief can say so tomorrow. If it contradicts the tape, even better, the morning gets interesting. Until then, the item is a checkpoint, not a prophecy wearing business casual."
  ].join(" ");
}

function buildHeadlinesNarrative(factPack: PulseBriefFactPack): string {
  const headlines = factPack.headlines ?? [];
  const first = headlines[0];
  if (!first) {
    return "";
  }
  return [
    `The headline set starts with "${first.headline}".`,
    "That does not make the headline a conclusion. Thesis treats approved headlines as metadata and context unless the source itself is official or first-party evidence.",
    "The useful read is the cluster: what topics keep showing up, whether they connect to tape movement, and whether they add anything the market has not already expressed. Headlines can sharpen the morning, but they do not get to smuggle in unsupported causality. They sit in the brief, they point to source context, and they behave themselves.",
    "That restraint matters most on loud news days. A headline can explain why attention shifted, but it does not automatically explain every tick in the tape or every move in a tracked name. Thesis keeps the headline visible, preserves the source trail, and avoids rewriting article bodies into fake certainty. If official or first-party evidence later confirms the implication, the brief can promote it. Until then, the headline is a signpost, not a verdict with a press badge."
  ].join(" ");
}

function classifyMood(factPack: PulseBriefFactPack): PulseBriefCopy["mood"] {
  if (factPack.mode === "quiet") {
    return "calm";
  }
  if (factPack.mode === "event" || factPack.tape.breadth === "lower") {
    return "cautious";
  }
  if (factPack.tape.breadth === "higher") {
    return "confident";
  }
  return "curious";
}

function joinCopy(values: Array<string | undefined>): string | undefined {
  const text = values
    .map((value) => value?.replace(/\s+/g, " ").trim())
    .filter((value): value is string => Boolean(value))
    .join(" ");
  return text.length > 0 ? text : undefined;
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
