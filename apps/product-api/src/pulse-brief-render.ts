import type { MarketPulseReport } from "../../../packages/contracts/src";
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
    "<article class=\"brief-shell\">",
    renderHeader(report, factPack, copy),
    "<main>",
    renderTape(report, factPack, copy),
    renderDeltas(factPack),
    renderInteresting(copy),
    renderYourNames(factPack, copy),
    renderCalendar(factPack),
    renderHeadlines(factPack),
    renderSignalVsNoise(copy),
    "</main>",
    renderSources(factPack),
    "</article>",
    "</body>",
    "</html>"
  ].filter(Boolean).join("\n");
}

function renderHeader(
  report: MarketPulseReport,
  factPack: PulseBriefFactPack,
  copy: PulseBriefCopy
): string {
  return [
    "<header class=\"brief-header\">",
    "<div class=\"brand-row\">",
    "<div><strong>THESIS</strong><span>Morning Brief</span></div>",
    `<time>${escapeHtml(formatDate(report.cycle_end || report.generated_at))}</time>`,
    "</div>",
    `<p class="mode-line">${escapeHtml(readableMode(factPack.mode))}</p>`,
    `<p class="morning-line">${escapeHtml(copy.morning_line)}</p>`,
    "</header>"
  ].join("\n");
}

function renderTape(report: MarketPulseReport, factPack: PulseBriefFactPack, copy: PulseBriefCopy): string {
  const moves = [...factPack.tape.indices, ...factPack.tape.cross_asset]
    .filter((move) => typeof move.changePct === "number" || typeof move.change === "number")
    .slice(0, 8);
  const moveCards = moves.map((move) => [
    "<div class=\"move-card\">",
    `<span>${escapeHtml(move.label)}</span>`,
    `<strong class="${toneClass(move)}">${escapeHtml(formatMove(move))}</strong>`,
    "</div>"
  ].join(""));

  return [
    "<section class=\"brief-section tape-section\">",
    "<h2>What Happened Yesterday</h2>",
    moveCards.length > 0
      ? `<div class="tape-grid">${moveCards.join("\n")}</div>`
      : "<p class=\"empty-note\">Market tape values were not available in the approved path.</p>",
    renderMarketSparklines(report),
    `<p>${escapeHtml(copy.yesterday_comment)}</p>`,
    "</section>"
  ].join("\n");
}

function renderMarketSparklines(report: MarketPulseReport): string {
  const cards = (report.morning_edition?.market_board ?? [])
    .filter((card) => (card.sparkline ?? []).length >= 2)
    .slice(0, 3);
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
  const width = 112;
  const height = 30;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / Math.max(1, values.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${trimNumber(x)},${trimNumber(y)}`;
  }).join(" ");
  const color = direction === "up" ? "#54d58a" : direction === "down" ? "#ff736d" : "#9aa4ad";
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-hidden="true"><polyline fill="none" stroke="${color}" stroke-width="2" points="${points}" /></svg>`;
}

function renderDeltas(factPack: PulseBriefFactPack): string {
  if (factPack.deltas.baseline) {
    return [
      "<section class=\"brief-section\">",
      "<h2>What Changed Since Yesterday</h2>",
      "<p class=\"baseline-note\">Baseline issue: there is no prior stored Pulse to compare against, so Thesis is not pretending to have a daily delta.</p>",
      renderUnchanged(factPack),
      "</section>"
    ].join("\n");
  }

  if (factPack.deltas.vs_yesterday.length === 0) {
    return [
      "<section class=\"brief-section\">",
      "<h2>What Changed Since Yesterday</h2>",
      "<p>No material change from yesterday. The tape was quiet, macro stayed in place, and no tracked input crossed the attention threshold.</p>",
      renderUnchanged(factPack),
      "</section>"
    ].join("\n");
  }

  const changed = factPack.deltas.vs_yesterday.slice(0, 5).map((item) =>
    `<li><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.detail)}</li>`
  );
  return [
    "<section class=\"brief-section\">",
    "<h2>What Changed Since Yesterday</h2>",
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

function renderInteresting(copy: PulseBriefCopy): string {
  return [
    "<section class=\"brief-section interesting-section\">",
    "<h2>The Interesting Bit</h2>",
    `<p>${escapeHtml(copy.interesting_bit)}</p>`,
    "</section>"
  ].join("\n");
}

function renderYourNames(factPack: PulseBriefFactPack, copy: PulseBriefCopy): string {
  const rows = factPack.user_names?.rows ?? [];
  if (rows.length === 0) {
    return "";
  }
  return [
    "<section class=\"brief-section\">",
    "<h2>Your Names</h2>",
    `<div class="names-list">${rows.map(renderNameRow).join("\n")}</div>`,
    copy.your_names_comment ? `<p>${escapeHtml(copy.your_names_comment)}</p>` : "",
    "</section>"
  ].filter(Boolean).join("\n");
}

function renderNameRow(row: PulseBriefUserNameRow): string {
  const change = typeof row.changePct === "number" ? formatPct(row.changePct) : "tracked";
  const priceLine = formatNamePriceLine(row);
  return [
    "<div class=\"name-row\">",
    `<strong>${escapeHtml(row.ticker)}</strong>`,
    `<span>${escapeHtml([row.companyName, priceLine].filter(Boolean).join(" | "))}</span>`,
    `<em class="${row.direction === "up" ? "positive" : row.direction === "down" ? "negative" : "flat"}">${escapeHtml(change)}</em>`,
    `<p>${escapeHtml(row.note)}</p>`,
    "</div>"
  ].join("");
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

function renderCalendar(factPack: PulseBriefFactPack): string {
  const items = factPack.calendar ?? [];
  if (items.length === 0) {
    return "";
  }
  return [
    "<section class=\"brief-section compact-list\">",
    "<h2>Things To Watch</h2>",
    ...items.slice(0, 5).map(renderCalendarItem),
    "</section>"
  ].join("\n");
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

function renderHeadlines(factPack: PulseBriefFactPack): string {
  const items = factPack.headlines ?? [];
  if (items.length === 0) {
    return "";
  }
  return [
    "<section class=\"brief-section compact-list\">",
    "<h2>Headlines Worth Knowing</h2>",
    ...items.slice(0, 5).map(renderHeadline),
    "</section>"
  ].join("\n");
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

function renderSignalVsNoise(copy: PulseBriefCopy): string {
  return [
    "<section class=\"brief-section signal-section\">",
    "<h2>Signal vs Noise</h2>",
    "<div class=\"signal-grid\">",
    `<p><strong>Signal:</strong> ${escapeHtml(copy.signal)}</p>`,
    `<p><strong>Noise:</strong> ${escapeHtml(copy.noise)}</p>`,
    "</div>",
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

function toneClass(move: PulseBriefMove): string {
  if (move.family === "volatility" || move.family === "rates" || move.family === "credit") {
    return move.direction === "down" ? "positive" : move.direction === "up" ? "caution" : "flat";
  }
  return move.direction === "up" ? "positive" : move.direction === "down" ? "negative" : "flat";
}

function readableMode(mode: PulseBriefFactPack["mode"]): string {
  if (mode === "quiet") {
    return "Quiet day";
  }
  if (mode === "event") {
    return "Event day";
  }
  return "Normal day";
}

function formatPct(value: number): string {
  return `${value > 0 ? "+" : ""}${trimNumber(value)}%`;
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
  @page {
    size: 5.8in 9.2in;
    margin: 0.24in;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    background: #0a0a09;
    color: #f5efe4;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  h1,
  h2,
  h3,
  p,
  ul {
    margin: 0;
  }

  a {
    color: inherit;
    text-decoration-color: #d7b985;
    text-underline-offset: 2px;
  }

  .brief-shell {
    width: min(100%, 520px);
    margin: 14px auto;
    background: #11110f;
    border: 1px solid #2b2721;
    box-shadow: 0 16px 58px rgba(0, 0, 0, 0.48);
  }

  .brief-header,
  .brief-section,
  .brief-footer {
    padding: 18px 20px;
  }

  .brief-header {
    border-bottom: 1px solid #d7b985;
  }

  .brand-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 14px;
  }

  .brand-row strong {
    display: block;
    color: #fff9ed;
    font: 800 17px/1 Georgia, "Times New Roman", serif;
    letter-spacing: 0.08em;
  }

  .brand-row span,
  .brand-row time,
  .mode-line,
  h2,
  h3,
  summary {
    color: #d7b985;
    font: 800 8.8px/1.2 Arial, "Helvetica Neue", sans-serif;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .morning-line {
    color: #fff9ed;
    max-width: 440px;
    font: 700 17px/1.22 Georgia, "Times New Roman", serif;
  }

  .mode-line {
    margin-bottom: 7px;
    color: #9aa4ad;
  }

  .brief-section {
    border-bottom: 1px solid #27241f;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .brief-section h2 {
    margin-bottom: 10px;
  }

  .brief-section h3 {
    margin-bottom: 7px;
    color: #9aa4ad;
  }

  p,
  li,
  .list-row,
  .headline-row,
  .name-row {
    color: #e6ded1;
    font-size: 10.6px;
    line-height: 1.45;
  }

  ul {
    padding-left: 15px;
  }

  li + li {
    margin-top: 5px;
  }

  .tape-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 7px;
    margin-bottom: 11px;
  }

  .spark-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 7px;
    margin: -2px 0 12px;
  }

  .spark-card {
    padding: 7px 8px;
    border: 1px solid #2d2a24;
    background: #141410;
  }

  .spark-card span {
    display: block;
    margin-bottom: 5px;
    color: #9aa4ad;
    font-size: 8.6px;
  }

  .spark-card svg {
    display: block;
    width: 100%;
    height: 24px;
  }

  .move-card {
    min-height: 42px;
    padding: 8px;
    border: 1px solid #2d2a24;
    background: #171713;
  }

  .move-card span,
  .name-row span,
  .headline-row span,
  .list-row span,
  .list-row em {
    display: block;
    color: #9aa4ad;
    font-size: 8.8px;
    font-style: normal;
  }

  .move-card strong,
  .name-row em {
    display: block;
    margin-top: 4px;
    font-size: 12px;
    font-style: normal;
  }

  .positive {
    color: #54d58a;
  }

  .negative {
    color: #ff736d;
  }

  .caution {
    color: #f0c777;
  }

  .flat,
  .muted,
  .baseline-note,
  .empty-note {
    color: #9aa4ad;
  }

  .delta-columns,
  .signal-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .interesting-section p {
    color: #fff9ed;
    font: 600 12px/1.42 Georgia, "Times New Roman", serif;
  }

  .names-list {
    display: grid;
    gap: 8px;
    margin-bottom: 10px;
  }

  .name-row {
    display: grid;
    grid-template-columns: 52px 1fr 58px;
    gap: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid #28251f;
  }

  .name-row p {
    grid-column: 1 / -1;
    color: #c8c0b4;
  }

  .list-row,
  .headline-row {
    padding: 8px 0;
    border-top: 1px solid #28251f;
  }

  .list-row {
    display: grid;
    grid-template-columns: 64px 1fr 54px;
    gap: 8px;
    align-items: center;
  }

  .headline-row a,
  .headline-row strong,
  .list-row strong {
    display: block;
    color: #fff9ed;
    font-size: 10.8px;
    line-height: 1.35;
  }

  .brief-footer {
    background: #0d0d0b;
  }

  summary {
    cursor: pointer;
  }

  details p {
    margin-top: 8px;
    color: #aaa196;
  }

  @media (max-width: 520px) {
    .brief-shell {
      margin: 0;
      border-left: 0;
      border-right: 0;
    }

    .tape-grid,
    .spark-row,
    .delta-columns,
    .signal-grid {
      grid-template-columns: 1fr;
    }
  }
`;
