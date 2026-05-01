import type {
  MacroStressSnapshot,
  MarketPulseEditorialIssue,
  MarketPulseEditorialItem,
  MarketPulseReport,
  MarketPulseWatchItem,
  MarketTapePack
} from "../../../../packages/contracts/src";
import {
  calendarEvidence,
  displayMovePct,
  findCrossAssetMove,
  formatCalendarTiming,
  type MarketPulseCalendarEvent,
  normalizeCalendarEvents,
  readableCoverageNote,
  shortTapeLabel,
  strongestTapeMove,
  tapeBreadth,
  weakestTapeMove
} from "./common";
export function buildEditorialIssue(input: {
  reportId: string;
  cycleEnd: string;
  generatedAt: string;
  tickers: string[];
  marketTape: MarketTapePack | undefined;
  previousReport: MarketPulseReport | undefined;
  macroStress: MacroStressSnapshot;
  sections: MarketPulseReport["sections"];
  flags: string[];
  calendarEvents: MarketPulseCalendarEvent[] | undefined;
  calendarFetchState: "complete" | "data_unavailable" | undefined;
  calendarUnavailableReason: string | undefined;
}): MarketPulseEditorialIssue {
  const previous = input.previousReport;
  const currentBreadth = tapeBreadth(input.marketTape);
  const priorBreadth = tapeBreadth(previous?.market_tape);
  const strongest = strongestTapeMove(input.marketTape);
  const weakest = weakestTapeMove(input.marketTape);
  const vix = findCrossAssetMove(input.marketTape, "volatility");
  const tenYear = findCrossAssetMove(input.marketTape, "rates");
  const calendarEvents = normalizeCalendarEvents(input.calendarEvents, input.tickers, input.cycleEnd);
  const tapeEvidence = input.sections.market_tape.evidence.slice(0, 4);
  const macroEvidence = input.sections.official_macro_pressure.evidence.slice(0, 4);
  const companyEvidence = input.sections.canonical_events.evidence.slice(0, 4);
  const coverageNotes = input.flags
    .filter((flag) => flag.startsWith("data_unavailable:") || flag.startsWith("data_incomplete:"))
    .map(readableCoverageNote);

  if (input.calendarFetchState === "data_unavailable") {
    coverageNotes.push(
      input.calendarUnavailableReason?.trim() ||
        "Earnings calendar access was unavailable, so dated issuer watch items are limited."
    );
  }

  const previousVix = findCrossAssetMove(previous?.market_tape, "volatility");
  const vixRegimeCrossed = Boolean(
    vix &&
      previousVix &&
      typeof vix.value === "number" &&
      typeof previousVix.value === "number" &&
      ((previousVix.value < 20 && vix.value >= 20) || (previousVix.value >= 20 && vix.value < 20))
  );
  const currentSectorLeader = input.marketTape?.sector_leadership?.leaders[0]?.instrument_id;
  const priorSectorLeader = previous?.market_tape?.sector_leadership?.leaders[0]?.instrument_id;
  const sectorLeadershipRotated = Boolean(
    previous &&
      currentSectorLeader &&
      priorSectorLeader &&
      currentSectorLeader !== priorSectorLeader
  );
  const tapeBreadthChanged = Boolean(previous && priorBreadth !== currentBreadth);
  const macroRegimeChanged = Boolean(previous && previous.macro_stress.state !== input.macroStress.state);
  const nothingMaterialChanged = Boolean(
    previous &&
      !tapeBreadthChanged &&
      !macroRegimeChanged &&
      !sectorLeadershipRotated &&
      !vixRegimeCrossed &&
      calendarEvents.length === 0
  );

  const baselineBody = !previous
    ? "This is the first editorial Pulse baseline in the available report history."
    : nothingMaterialChanged
      ? "No material change from yesterday's issue."
      : `The reviewed market tape moved from ${priorBreadth} to ${currentBreadth}, while Macro Stress is ${input.macroStress.state}.`;

  const whatChanged: MarketPulseEditorialItem[] = [
    {
      kind: "market_tape",
      title: previous ? "Tape comparison" : "Baseline established",
      body: baselineBody,
      freshness_state: previous
        ? nothingMaterialChanged || !tapeBreadthChanged
          ? "unchanged"
          : "updated"
        : "baseline",
      importance: previous && tapeBreadthChanged ? "high" : "medium",
      evidence: tapeEvidence
    }
  ];

  if (macroRegimeChanged) {
    whatChanged.push({
      kind: "macro",
      title: "Macro stress changed",
      body: `Macro Stress moved from ${previous?.macro_stress.state ?? "unknown"} to ${input.macroStress.state}.`,
      freshness_state: "updated",
      importance: "high",
      evidence: macroEvidence
    });
  }

  if (sectorLeadershipRotated) {
    whatChanged.push({
      kind: "market_tape",
      title: "Sector leadership changed",
      body: "The leading sector basket changed from the prior issue.",
      freshness_state: "updated",
      importance: "medium",
      evidence: tapeEvidence
    });
  }

  const whyItMatters: MarketPulseEditorialItem[] = [
    {
      kind: "market_tape",
      title: "Conviction read",
      body:
        nothingMaterialChanged
          ? "No fresh daily input changed enough to justify a larger read."
          : currentBreadth === "higher"
          ? "A broader positive tape can improve context, but Thesis still requires confirmation from volatility, rates, credit, and company evidence before treating one day as a thesis change."
          : currentBreadth === "lower"
            ? "A weaker tape matters because it can pressure timing and risk appetite even when company-specific evidence has not changed."
            : "A mixed tape matters because it argues for selectivity rather than a sweeping market conclusion.",
      freshness_state: nothingMaterialChanged ? "unchanged" : "updated",
      importance: "high",
      evidence: tapeEvidence
    },
    {
      kind: "macro",
      title: "Macro frame",
      body: `Macro regime: ${input.macroStress.state}. ${macroRegimeChanged ? "Changed from the prior issue." : "Unchanged."}`,
      freshness_state: previous?.macro_stress.state === input.macroStress.state ? "unchanged" : "updated",
      importance: "medium",
      evidence: macroEvidence
    }
  ];

  const watchItems: MarketPulseWatchItem[] = calendarEvents.slice(0, 5).map((event) => ({
    kind: "calendar",
    title: `${event.ticker} earnings`,
    body: `${event.ticker} has an earnings event on ${event.event_date} (${formatCalendarTiming(event.event_time)}). ${event.reason_text ?? "Watch for company-specific evidence that changes the briefing context."}`,
    watch_date: event.event_date,
    freshness_state: "new",
    importance: "medium",
    evidence: [calendarEvidence(event, input.generatedAt)]
  }));

  if (watchItems.length === 0) {
    watchItems.push({
      kind: "market_tape",
      title: nothingMaterialChanged ? "Next issue" : "Tape follow-through",
      body: nothingMaterialChanged
        ? "No material watch item changed today; the next issue should focus on new tape, headlines, or calendar events."
        : strongest
        ? `Watch whether ${shortTapeLabel(strongest.label)} leadership at ${displayMovePct(strongest.daily_change_pct)} is confirmed or faded in the next reviewed cycle.`
        : "Watch whether the next reviewed cycle gives enough market breadth to move beyond a bounded read.",
      freshness_state: nothingMaterialChanged ? "unchanged" : "updated",
      importance: "medium",
      evidence: tapeEvidence
    });
  }

  if (vix && !nothingMaterialChanged) {
    watchItems.push({
      kind: "market_tape",
      title: "Volatility confirmation",
      body: `VIX moved ${displayMovePct(vix.daily_change_pct)}; watch whether volatility confirms or contradicts the equity tape.`,
      freshness_state: "updated",
      importance: "medium",
      evidence: tapeEvidence
    });
  }

  const signalVsNoise: MarketPulseEditorialItem[] = [
    {
      kind: "market_tape",
      title: "Signal",
      body: nothingMaterialChanged
        ? "No new signal emerged."
        : strongest && weakest
        ? `${shortTapeLabel(strongest.label)} led at ${displayMovePct(strongest.daily_change_pct)}, while ${shortTapeLabel(weakest.label)} lagged at ${displayMovePct(weakest.daily_change_pct)}.`
        : "The available tape is useful as context, but it is not broad enough to make a stronger daily claim.",
      freshness_state: nothingMaterialChanged ? "unchanged" : "updated",
      importance: "high",
      evidence: tapeEvidence
    },
    {
      kind: "context",
      title: "Noise",
      body: nothingMaterialChanged
        ? "Unchanged index levels are not a story."
        : tenYear
        ? `One-day market movement does not prove a regime shift; the 10Y Treasury move of ${displayMovePct(tenYear.daily_change_pct)} is treated as context, not a standalone conclusion.`
        : "One-day movement does not prove a regime shift; missing cross-asset fields stay in coverage notes rather than confident prose.",
      freshness_state: "unchanged",
      importance: "medium",
      evidence: macroEvidence
    }
  ];

  const lead =
    nothingMaterialChanged
      ? "No material change from yesterday's issue. Markets, macro pressure, and tracked context did not move enough to justify a larger story."
      : previous
      ? `Good morning. Today's Pulse separates the actual daily change from the slower macro backdrop: the tape is ${currentBreadth}, Macro Stress is ${input.macroStress.state}, and the next watch items are kept evidence-led.`
      : "Good morning. Today's Pulse starts an editorial baseline: the tape is summarized, the macro frame is bounded, and future issues can now say what truly changed.";

  return {
    issue_id: `pulse-editorial-${input.reportId}`,
    headline: nothingMaterialChanged
      ? "QUIET DAY. NO MATERIAL CHANGE."
      : marketEditorialHeadline(currentBreadth, input.macroStress.state),
    dek: nothingMaterialChanged
      ? "No fresh tape, macro, or calendar delta changed the issue."
      : marketEditorialDek(currentBreadth, strongest, vix),
    lead,
    ...(previous ? { prior_cycle_end: previous.cycle_end } : {}),
    freshness_state: previous ? (nothingMaterialChanged ? "unchanged" : "updated") : "baseline",
    in_this_issue: [
      "The Tape",
      "What Changed",
      ...(calendarEvents.length > 0 ? ["Today's Calendar"] : []),
      "Signal vs Noise",
      "The Backdrop"
    ],
    what_changed: whatChanged,
    why_it_matters: whyItMatters,
    what_to_watch: watchItems.slice(0, 6),
    signal_vs_noise: signalVsNoise,
    coverage_notes: [...new Set(coverageNotes)].slice(0, 6),
    evidence: [...tapeEvidence, ...macroEvidence, ...companyEvidence].slice(0, 10)
  };
}
function marketEditorialHeadline(
  breadth: "higher" | "lower" | "mixed" | "thin",
  macroState: MacroStressSnapshot["state"]
): string {
  if (breadth === "higher") {
    return "TAPE FIRMS, BUT CONFIRMATION STILL MATTERS";
  }
  if (breadth === "lower") {
    return "TAPE SOFTENS AS RISK CONTEXT TIGHTENS";
  }
  if (macroState === "elevated") {
    return "SELECTIVE TAPE MEETS ELEVATED MACRO PRESSURE";
  }
  return "MARKET TAPE KEEPS CONVICTION SELECTIVE";
}

function marketEditorialDek(
  breadth: "higher" | "lower" | "mixed" | "thin",
  strongest: MarketTapePack["indices"][number] | undefined,
  vix: MarketTapePack["cross_asset"][number] | undefined
): string {
  const lead = breadth === "thin"
    ? "The available tape is narrow"
    : `The reviewed tape is ${breadth}`;
  const leader = strongest
    ? `${shortTapeLabel(strongest.label)} led at ${displayMovePct(strongest.daily_change_pct)}`
    : "leadership was not fully visible";
  const volatility = vix
    ? `VIX moved ${displayMovePct(vix.daily_change_pct)}`
    : "volatility coverage was limited";
  return `${lead}; ${leader}; ${volatility}.`;
}


