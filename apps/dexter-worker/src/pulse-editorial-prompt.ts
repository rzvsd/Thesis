import type { MarketPulseReport } from "../../../packages/contracts/src";

export function buildPulseEditorialPrompt(report: MarketPulseReport): string {
  const breadth = marketBreadth(report);
  const facts = {
    as_of: report.cycle_end.slice(0, 10),
    issue_mode: classifyIssueMode(report),
    breadth,
    macro_state: report.macro_stress.state,
    tape: {
      indices: report.market_tape?.indices ?? [],
      cross_asset: report.market_tape?.cross_asset ?? [],
      sector_leadership: report.market_tape?.sector_leadership
    },
    tracked_names: report.morning_edition?.portfolio_radar ?? [],
    calendar: report.morning_edition?.today_catalysts ?? [],
    headlines: [
      ...(report.macro_news?.items ?? []),
      ...(report.morning_edition?.headline_digest ?? [])
    ],
    narrative_tension: buildDebateSummary(report)
  };

  return [
    "You are Dexter inside Thesis. Write strict JSON only for a premium Pulse Morning Brief.",
    "Voice: sharp analyst friend at coffee. Clear, observant, a little human, never theatrical.",
    "Use only the supplied facts. Do not mutate numbers, tickers, prices, sources, events, or provenance.",
    "No buy/sell/hold language. No price targets. No extra tickers. No extra sources. No article-body summaries.",
    "Do not use the word because. Prefer 'came alongside', 'while', or 'with'.",
    "Required JSON keys: the_read, what_changed_summary, why_it_matters, your_names_comment, smart_comment, morning_story, tape_color, names_narrative, one_thing, mood.",
    "Mood must be one of: confident, cautious, curious, calm.",
    "Budgets: total words under 500; morning_story 120-260 words; one_thing 18-40 words; tape_color under 15 words; names_narrative 30-70 words if names exist.",
    "The morning_story should be 3-4 short paragraphs connecting tape, macro, names, and the one memorable observation.",
    JSON.stringify(facts)
  ].join("\n");
}

function buildDebateSummary(report: MarketPulseReport): { supportive: string[]; challenging: string[]; unresolved: string[] } {
  const supportive: string[] = [];
  const challenging: string[] = [];
  const unresolved: string[] = [];
  const breadth = marketBreadth(report);
  const vix = report.market_tape?.cross_asset.find((move) => move.family === "volatility");
  const credit = report.market_tape?.cross_asset.find((move) => move.family === "credit");

  if (breadth === "higher") {
    supportive.push("core index breadth was higher");
  }
  if (vix?.direction === "down") {
    supportive.push("volatility cooled");
  }
  if (breadth === "lower") {
    challenging.push("core index breadth was lower");
  }
  if (credit && credit.direction !== "down") {
    challenging.push("credit did not fully confirm the risk-on read");
  }
  if (report.macro_stress.state !== "stable") {
    challenging.push(`macro state remained ${report.macro_stress.state}`);
  }
  if ((report.morning_edition?.portfolio_radar ?? []).length === 0) {
    unresolved.push("tracked-name price context was absent");
  }
  if ((report.market_tape?.omissions ?? []).length > 0) {
    unresolved.push("some market tape families had omission truth");
  }
  if (supportive.length === 0) {
    supportive.push("no positive read-through cleared a high-confidence threshold");
  }
  if (challenging.length === 0) {
    challenging.push("no major challenge cleared a high-confidence threshold");
  }
  if (unresolved.length === 0) {
    unresolved.push("no major unresolved input dominated the brief");
  }

  return { supportive, challenging, unresolved };
}

function marketBreadth(report: MarketPulseReport): "higher" | "lower" | "mixed" | "thin" {
  const core = report.market_tape?.indices.filter((entry) => entry.family === "core_index") ?? [];
  if (core.length < 2) {
    return "thin";
  }
  const up = core.filter((entry) => entry.direction === "up").length;
  const down = core.filter((entry) => entry.direction === "down").length;
  if (up >= 3) {
    return "higher";
  }
  if (down >= 3) {
    return "lower";
  }
  return "mixed";
}

function classifyIssueMode(report: MarketPulseReport): "quiet" | "normal" | "event" {
  if (report.macro_news?.state === "shock") {
    return "event";
  }
  const majorNameMove = (report.morning_edition?.portfolio_radar ?? [])
    .some((row) => Math.abs(row.change_pct ?? 0) >= 3);
  if (majorNameMove) {
    return "event";
  }
  const core = report.market_tape?.indices ?? [];
  const quiet = core.length > 0 && core.every((move) => Math.abs(move.daily_change_pct ?? 0) < 0.35);
  return quiet ? "quiet" : "normal";
}
