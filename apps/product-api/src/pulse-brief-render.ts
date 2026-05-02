import type { MarketPulseReport, MarketTapeMove } from "../../../packages/contracts/src";
import {
  buildPulseBriefPlan,
  type PulseBriefCalendarItem,
  type PulseBriefCopy,
  type PulseBriefFactPack,
  type PulseBriefHeadline,
  type PulseBriefMove,
  type PulseBriefUserNameRow
} from "./pulse-brief-plan";

export function buildPulseBriefHtml(report: MarketPulseReport): string {
  const plan = buildPulseBriefPlan(report);
  const factPack = plan.fact_pack;
  const copy = plan.copy;

  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "<meta charset=\"utf-8\" />",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    "<title>Thesis Morning Brief</title>",
    "<style>",
    compactCss(briefCss),
    "</style>",
    "</head>",
    "<body>",
    "<div class=\"reading-progress\" aria-hidden=\"true\"></div>",
    `<article class="brief-shell mode-${factPack.mode} mood-${copy.mood}">`,
    renderHeader(report, factPack, copy),
    factPack.mode === "quiet"
      ? renderQuietIssue(report, factPack, copy)
      : renderFullIssue(report, factPack, copy),
    renderSources(factPack),
    "</article>",
    "</body>",
    "</html>"
  ].filter(Boolean).join("\n");
}

function renderQuietIssue(
  report: MarketPulseReport,
  factPack: PulseBriefFactPack,
  copy: PulseBriefCopy
): string {
  return [
    "<main>",
    renderLead(copy, true),
    renderTape(report, factPack, copy, true),
    "<section class=\"brief-section quiet-close\">",
    "<h2>Nothing Moved The Needle</h2>",
    `<p>${escapeHtml(copy.what_changed_summary)}</p>`,
    "</section>",
    "</main>"
  ].join("\n");
}

function renderFullIssue(
  report: MarketPulseReport,
  factPack: PulseBriefFactPack,
  copy: PulseBriefCopy
): string {
  return [
    "<main>",
    renderLead(copy, false),
    renderTape(report, factPack, copy, false),
    renderInterestingBit(copy),
    renderDeltas(factPack, copy),
    renderYourNames(factPack, copy),
    renderCalendarAndHeadlines(factPack, copy),
    renderSmartComment(copy),
    "</main>"
  ].join("\n");
}

function renderHeader(
  report: MarketPulseReport,
  factPack: PulseBriefFactPack,
  copy: PulseBriefCopy
): string {
  return [
    "<header class=\"brief-header\">",
    "<div class=\"brand-row\">",
    "<div>",
    "<strong>THESIS</strong>",
    "<span>Morning Brief</span>",
    "</div>",
    `<time>${escapeHtml(formatDate(report.cycle_end || report.generated_at))}</time>`,
    "</div>",
    `<p class="morning-line">${escapeHtml(copy.the_read)}</p>`,
    `<p class="mode-line">${escapeHtml(modeLabel(factPack))}</p>`,
    "</header>"
  ].join("\n");
}

function renderLead(copy: PulseBriefCopy, compact: boolean): string {
  const paragraphs = splitParagraphs(copy.morning_story);
  return [
    `<section class="brief-section lead-section${compact ? " compact-lead" : ""}">`,
    "<h2>The Read</h2>",
    paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n"),
    "</section>"
  ].join("\n");
}

function renderTape(
  report: MarketPulseReport,
  factPack: PulseBriefFactPack,
  copy: PulseBriefCopy,
  compact: boolean
): string {
  const moves = [...factPack.tape.indices, ...factPack.tape.cross_asset]
    .filter((move) => typeof move.changePct === "number" || typeof move.change === "number")
    .sort((left, right) => moveDisplayRank(left) - moveDisplayRank(right))
    .slice(0, compact ? 6 : 8);

  return [
    "<section class=\"brief-section tape-section\">",
    `<h2>${escapeHtml(tapeHeading(factPack, copy))}</h2>`,
    moves.length > 0
      ? `<div class="tape-grid">${moves.map(renderMoveCard).join("\n")}</div>`
      : "<p class=\"empty-note\">Market tape values were not available in the approved path.</p>",
    `<p class="section-kicker">${escapeHtml(copy.tape_narrative)}</p>`,
    compact ? "" : renderSectorHeatmap(report),
    compact ? "" : renderMarketSparklines(report),
    `<p class="tape-color">${escapeHtml(copy.tape_color)}</p>`,
    "</section>"
  ].filter(Boolean).join("\n");
}

function renderMoveCard(move: PulseBriefMove): string {
  return [
    "<div class=\"move-card\">",
    `<span>${escapeHtml(move.label)}</span>`,
    `<strong class="${toneClass(move)}">${escapeHtml(formatMove(move))}</strong>`,
    "</div>"
  ].join("");
}

function renderSectorHeatmap(report: MarketPulseReport): string {
  const leadership = report.market_tape?.sector_leadership;
  const sectors = dedupeMoves([
    ...(leadership?.leaders ?? []),
    ...(leadership?.laggards ?? [])
  ]).slice(0, 10);
  if (sectors.length === 0) {
    return "";
  }
  return [
    "<div class=\"sector-strip\" aria-label=\"Sector leadership\">",
    ...sectors.map((sector) => {
      const change = sector.daily_change_pct ?? 0;
      const intensity = Math.min(1, Math.abs(change) / 2.5);
      const color = change >= 0
        ? `rgba(84, 213, 138, ${0.16 + intensity * 0.38})`
        : `rgba(255, 115, 109, ${0.14 + intensity * 0.38})`;
      return `<span style="background:${color}"><b>${escapeHtml(shortSectorLabel(sector.label))}</b><em>${escapeHtml(formatPct(change))}</em></span>`;
    }),
    "</div>"
  ].join("");
}

function renderMarketSparklines(report: MarketPulseReport): string {
  const cards = (report.morning_edition?.market_board ?? [])
    .filter((card) => (card.sparkline ?? []).length >= 2)
    .slice(0, 5);
  if (cards.length === 0) {
    return "";
  }
  return [
    "<div class=\"spark-row\" aria-label=\"Five-day context\">",
    ...cards.map((card) => [
      "<div class=\"spark-card\">",
      `<span>${escapeHtml(card.label)}</span>`,
      renderSparkline(card.sparkline ?? [], card.direction),
      "</div>"
    ].join("")),
    "</div>"
  ].join("\n");
}

function renderSparkline(values: number[], direction: "up" | "down" | "flat"): string {
  const width = 128;
  const height = 36;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / Math.max(1, values.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${trimNumber(x)},${trimNumber(y)}`;
  });
  const color = direction === "up" ? "#54d58a" : direction === "down" ? "#ff736d" : "#9aa4ad";
  const highIndex = values.indexOf(max);
  const lowIndex = values.indexOf(min);
  const dot = (index: number, value: number, className: string) => {
    const x = (index / Math.max(1, values.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `<circle class="${className}" cx="${trimNumber(x)}" cy="${trimNumber(y)}" r="2.4" />`;
  };
  return [
    `<svg viewBox="0 0 ${width} ${height}" role="img" aria-hidden="true">`,
    `<polyline fill="none" stroke="${color}" stroke-width="2" points="${points.join(" ")}" />`,
    dot(lowIndex, min, "spark-low"),
    dot(highIndex, max, "spark-high"),
    "</svg>"
  ].join("");
}

function renderInterestingBit(copy: PulseBriefCopy): string {
  return [
    "<section class=\"brief-section one-thing-section\">",
    "<h2>The One Thing</h2>",
    `<p>${escapeHtml(copy.one_thing)}</p>`,
    "</section>"
  ].join("\n");
}

function renderDeltas(factPack: PulseBriefFactPack, copy: PulseBriefCopy): string {
  const heading = deltaHeading(factPack);
  if (factPack.deltas.baseline || factPack.deltas.vs_yesterday.length === 0) {
    return [
      "<section class=\"brief-section delta-section\">",
      `<h2>${escapeHtml(heading)}</h2>`,
      `<p>${escapeHtml(copy.what_changed_summary)}</p>`,
      renderUnchanged(factPack),
      "</section>"
    ].join("\n");
  }

  const changed = factPack.deltas.vs_yesterday.slice(0, 5).map((item) =>
    `<li><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.detail)}</li>`
  );
  return [
    "<section class=\"brief-section delta-section\">",
    `<h2>${escapeHtml(heading)}</h2>`,
    `<p>${escapeHtml(copy.what_changed_summary)}</p>`,
    "<div class=\"delta-columns\">",
    `<div><h3>Changed</h3><ul>${changed.join("\n")}</ul></div>`,
    `<div><h3>Unchanged</h3>${renderUnchanged(factPack)}</div>`,
    "</div>",
    "</section>"
  ].join("\n");
}

function renderUnchanged(factPack: PulseBriefFactPack): string {
  if (factPack.deltas.unchanged.length === 0) {
    return "<p class=\"muted\">No unchanged items were material enough to show.</p>";
  }
  return `<ul>${factPack.deltas.unchanged.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n")}</ul>`;
}

function renderYourNames(factPack: PulseBriefFactPack, copy: PulseBriefCopy): string {
  const rows = factPack.user_names?.rows ?? [];
  if (rows.length === 0) {
    return "";
  }
  return [
    "<section class=\"brief-section names-section\">",
    "<h2>Your Names</h2>",
    copy.names_narrative ? `<p class="section-kicker">${escapeHtml(copy.names_narrative)}</p>` : "",
    `<div class="names-list">${rows.map(renderNameCard).join("\n")}</div>`,
    "</section>"
  ].filter(Boolean).join("\n");
}

function renderNameCard(row: PulseBriefUserNameRow): string {
  const change = typeof row.changePct === "number" ? formatPct(row.changePct) : "tracked";
  const tone = row.direction === "up" ? "positive" : row.direction === "down" ? "negative" : "flat";
  return [
    "<div class=\"name-card\">",
    "<div class=\"name-card-head\">",
    `<span class="direction-dot ${tone}"></span>`,
    `<strong>${escapeHtml(row.ticker)}</strong>`,
    `<em class="${tone}">${escapeHtml(change)}</em>`,
    "</div>",
    `<p class="company-line">${escapeHtml([row.companyName, formatNamePriceLine(row)].filter(Boolean).join(" | "))}</p>`,
    `<p>${escapeHtml(row.context?.context_line ?? row.note)}</p>`,
    "</div>"
  ].join("");
}

function renderCalendarAndHeadlines(factPack: PulseBriefFactPack, copy: PulseBriefCopy): string {
  const calendar = factPack.calendar ?? [];
  const headlines = factPack.headlines ?? [];
  if (calendar.length === 0 && headlines.length === 0) {
    return "";
  }
  return [
    "<section class=\"brief-section calendar-headlines\">",
    calendar.length > 0
      ? `<div><h2>Things To Watch</h2>${copy.calendar_narrative ? `<p class="section-kicker">${escapeHtml(copy.calendar_narrative)}</p>` : ""}${calendar.slice(0, 5).map(renderCalendarItem).join("\n")}</div>`
      : "",
    headlines.length > 0
      ? `<div><h2>Headlines Worth Knowing</h2>${copy.headlines_narrative ? `<p class="section-kicker">${escapeHtml(copy.headlines_narrative)}</p>` : ""}${headlines.slice(0, 5).map(renderHeadline).join("\n")}</div>`
      : "",
    "</section>"
  ].filter(Boolean).join("\n");
}

function renderCalendarItem(item: PulseBriefCalendarItem): string {
  return [
    "<div class=\"list-row\">",
    `<span>${escapeHtml(item.timeLabel ?? "Watch")}</span>`,
    `<strong>${escapeHtml(item.title)}</strong>`,
    `<em>${escapeHtml(item.impact)}</em>`,
    "</div>"
  ].join("");
}

function renderHeadline(item: PulseBriefHeadline): string {
  const source = `${item.sourceName}${item.publishedAt ? ` - ${formatDate(item.publishedAt)}` : ""}`;
  return [
    "<div class=\"headline-row\">",
    item.sourceUrl
      ? `<a href="${escapeHtml(item.sourceUrl)}">${escapeHtml(item.headline)}</a>`
      : `<strong>${escapeHtml(item.headline)}</strong>`,
    `<span>${escapeHtml(source)}</span>`,
    "</div>"
  ].join("");
}

function renderSmartComment(copy: PulseBriefCopy): string {
  return [
    "<section class=\"brief-section honest-read\">",
    "<h2>The Honest Read</h2>",
    `<p>${escapeHtml(copy.smart_comment)}</p>`,
    "</section>"
  ].join("\n");
}

function renderSources(factPack: PulseBriefFactPack): string {
  const sourceText = factPack.sources.length > 0
    ? factPack.sources.join(", ")
    : "No approved sources were attached to this brief.";
  const omissions = factPack.omissions.length > 0
    ? `<p>Coverage note: ${escapeHtml(factPack.omissions.map((item) => item.family).join(", "))} had limited approved coverage.</p>`
    : "";

  return [
    "<footer class=\"brief-footer\">",
    "<details>",
    "<summary>Sources and Method</summary>",
    `<p>Sources: ${escapeHtml(sourceText)}.</p>`,
    "<p>Method: Thesis uses official and approved free data where available, compares against stored context when present, and omits unsupported inputs.</p>",
    omissions,
    "</details>",
    "</footer>"
  ].join("\n");
}

function modeLabel(factPack: PulseBriefFactPack): string {
  if (factPack.mode === "quiet") {
    return "Quiet day - 30 second read";
  }
  if (factPack.mode === "event") {
    return "Event day - deeper read";
  }
  return "Normal day - market story";
}

function tapeHeading(factPack: PulseBriefFactPack, copy: PulseBriefCopy): string {
  if (factPack.tape.breadth === "quiet") {
    return "Quiet Tape";
  }
  return copy.tape_color;
}

function deltaHeading(factPack: PulseBriefFactPack): string {
  if (factPack.deltas.baseline) {
    return "Baseline Issue";
  }
  const count = factPack.deltas.vs_yesterday.length;
  if (count === 0) {
    return "Nothing Moved The Needle";
  }
  return count === 1 ? "One Thing Changed" : `${count} Things Changed`;
}

function formatMove(move: PulseBriefMove): string {
  if (move.family === "rates" && typeof move.change === "number") {
    return `${move.change > 0 ? "+" : ""}${trimNumber(move.change)} pts`;
  }
  if (typeof move.changePct === "number") {
    return formatPct(move.changePct);
  }
  if (typeof move.change === "number") {
    return `${move.change > 0 ? "+" : ""}${trimNumber(move.change)}`;
  }
  return "n/a";
}

function formatNamePriceLine(row: PulseBriefUserNameRow): string | undefined {
  if (typeof row.latestPrice !== "number" || !Number.isFinite(row.latestPrice)) {
    return undefined;
  }
  if (typeof row.previousClose === "number" && Number.isFinite(row.previousClose)) {
    return `${formatPrice(row.previousClose)} to ${formatPrice(row.latestPrice)}`;
  }
  return `Latest close ${formatPrice(row.latestPrice)}`;
}

function toneClass(move: PulseBriefMove): string {
  if (move.family === "volatility" || move.family === "rates" || move.family === "credit") {
    return move.direction === "down" ? "positive" : move.direction === "up" ? "caution" : "flat";
  }
  return move.direction === "up" ? "positive" : move.direction === "down" ? "negative" : "flat";
}

function moveDisplayRank(move: PulseBriefMove): number {
  const label = move.label.toLowerCase();
  if (label.includes("s&p 500")) return 10;
  if (label.includes("nasdaq")) return 20;
  if (label.includes("dow")) return 30;
  if (label.includes("russell")) return 40;
  if (label.includes("vix")) return 50;
  if (label.includes("10y")) return 60;
  if (label.includes("2y")) return 70;
  if (label.includes("wti") || label.includes("oil")) return 80;
  return 100;
}

function dedupeMoves(moves: MarketTapeMove[]): MarketTapeMove[] {
  const seen = new Set<string>();
  const result: MarketTapeMove[] = [];
  for (const move of moves) {
    if (seen.has(move.instrument_id)) {
      continue;
    }
    seen.add(move.instrument_id);
    result.push(move);
  }
  return result;
}

function shortSectorLabel(label: string): string {
  return label
    .replace(/^FRED\s+/i, "")
    .replace(/\bSelect Sector SPDR\b/i, "")
    .replace(/\bETF\b/i, "")
    .trim()
    .slice(0, 14) || label.slice(0, 8);
}

function splitParagraphs(value: string): string[] {
  return value
    .split(/\n{2,}/)
    .map((entry) => entry.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 4);
}

function formatPct(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function trimNumber(value: number): string {
  return value.toFixed(Math.abs(value) >= 10 ? 1 : 2).replace(/\.?0+$/, "");
}

function formatPrice(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(date);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function compactCss(value: string): string {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,>])\s*/g, "$1")
    .trim();
}

const briefCss = `
  @page { size: 5.8in 9.2in; margin: 0.24in; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #0a0a09;
    color: #f5efe4;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1, h2, h3, p, ul { margin: 0; }
  a { color: inherit; text-decoration-color: #d7b985; text-underline-offset: 2px; }
  .reading-progress {
    position: sticky;
    top: 0;
    z-index: 4;
    height: 3px;
    background: linear-gradient(90deg, #d7b985 0%, #d7b985 44%, rgba(215,185,133,0.16) 44%);
  }
  .brief-shell {
    width: min(100%, 540px);
    margin: 14px auto;
    background: #11110f;
    border: 1px solid #2b2721;
    box-shadow: 0 16px 58px rgba(0, 0, 0, 0.48);
  }
  .brief-header, .brief-section, .brief-footer { padding: 18px 21px; }
  .brief-header { border-bottom: 1px solid #d7b985; padding-bottom: 16px; }
  .brand-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 16px; }
  .brand-row strong { display: block; color: #fff9ed; font: 800 18px/1 Georgia, "Times New Roman", serif; letter-spacing: 0.08em; }
  .brand-row span, .brand-row time, h2, h3, summary {
    color: #d7b985;
    font: 800 9.4px/1.2 Arial, "Helvetica Neue", sans-serif;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .morning-line { color: #fff9ed; font: 700 14px/1.42 Georgia, "Times New Roman", serif; max-width: 440px; }
  .mode-line { margin-top: 9px; color: #9aa4ad; font-size: 9.2px; letter-spacing: 0.06em; text-transform: uppercase; }
  .brief-section { border-bottom: 1px solid #27241f; break-inside: avoid; page-break-inside: avoid; }
  .brief-section h2 { margin-bottom: 10px; }
  .brief-section h3 { margin-bottom: 7px; color: #9aa4ad; }
  p, li, .list-row, .headline-row, .name-card { color: #e6ded1; font-size: 11px; line-height: 1.5; }
  ul { padding-left: 15px; }
  li + li { margin-top: 5px; }
  .lead-section p { color: #fff9ed; font: 500 12.5px/1.55 Georgia, "Times New Roman", serif; }
  .lead-section p + p { margin-top: 11px; }
  .compact-lead p { font-size: 12px; }
  .tape-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; margin-bottom: 12px; }
  .move-card { min-height: 43px; padding: 8px; border: 1px solid #2d2a24; background: #171713; }
  .move-card span, .company-line, .headline-row span, .list-row span, .list-row em, .spark-card span {
    display: block; color: #9aa4ad; font-size: 8.8px; font-style: normal;
  }
  .move-card strong { display: block; margin-top: 5px; font-size: 12px; font-style: normal; }
  .tape-color { margin-top: 10px; color: #fff9ed; font: 600 11.4px/1.45 Georgia, "Times New Roman", serif; }
  .sector-strip { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; margin: 2px 0 12px; }
  .sector-strip span { min-height: 33px; padding: 6px; border: 1px solid rgba(255,255,255,0.06); }
  .sector-strip b, .sector-strip em { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sector-strip b { font-size: 8.4px; color: #fff9ed; }
  .sector-strip em { margin-top: 3px; font-size: 8.2px; color: #e6ded1; font-style: normal; }
  .spark-row { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 7px; margin: 0 0 12px; }
  .spark-card { padding: 7px 8px; border: 1px solid #2d2a24; background: #141410; }
  .spark-card svg { display: block; width: 100%; height: 36px; margin-top: 5px; }
  .spark-high { fill: #d7b985; }
  .spark-low { fill: #777f86; }
  .one-thing-section { border-left: 3px solid #d7b985; background: #15130f; }
  .one-thing-section p { color: #fff9ed; font: italic 12px/1.55 Georgia, "Times New Roman", serif; }
  .delta-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .section-kicker { margin-bottom: 12px; color: #d8d0c3; }
  .names-list { display: grid; gap: 9px; }
  .name-card { padding: 10px; border: 1px solid #2d2a24; background: #151512; }
  .name-card-head { display: grid; grid-template-columns: 12px 1fr auto; align-items: center; gap: 7px; margin-bottom: 4px; }
  .name-card-head strong { color: #fff9ed; font-size: 13px; }
  .name-card-head em { font-size: 11px; font-style: normal; font-weight: 800; }
  .direction-dot { width: 7px; height: 7px; border-radius: 999px; display: inline-block; background: #9aa4ad; }
  .positive { color: #54d58a; }
  .negative { color: #ff736d; }
  .caution { color: #f0c777; }
  .flat, .muted, .empty-note { color: #9aa4ad; }
  .direction-dot.positive { background: #54d58a; }
  .direction-dot.negative { background: #ff736d; }
  .direction-dot.flat { background: #9aa4ad; }
  .calendar-headlines { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; align-items: start; }
  .list-row, .headline-row { padding: 8px 0; border-top: 1px solid #28251f; }
  .list-row { display: grid; grid-template-columns: 58px 1fr 44px; gap: 8px; align-items: center; }
  .headline-row a, .headline-row strong, .list-row strong { display: block; color: #fff9ed; font-size: 10.8px; line-height: 1.35; }
  .honest-read p { color: #d8d0c3; font-size: 10.2px; line-height: 1.5; }
  .quiet-close p { color: #fff9ed; font: 600 12px/1.5 Georgia, "Times New Roman", serif; }
  .brief-footer { background: #0d0d0b; }
  summary { cursor: pointer; }
  details p { margin-top: 8px; color: #aaa196; font-size: 9.8px; }
  @media print {
    .brief-section, .name-card, .headline-row, .list-row { break-inside: avoid; page-break-inside: avoid; }
    .names-section { break-before: page; page-break-before: always; }
    .mode-quiet .names-section { break-before: auto; page-break-before: auto; }
  }
  @media (max-width: 520px) {
    .brief-shell { margin: 0; border-left: 0; border-right: 0; }
    .tape-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .spark-row, .sector-strip, .delta-columns, .calendar-headlines { grid-template-columns: 1fr; }
  }
`;
