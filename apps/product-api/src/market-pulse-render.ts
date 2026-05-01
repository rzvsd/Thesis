import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type {
  EvidenceItem,
  MarketPulseReport,
  MarketTapeMove
} from "../../../packages/contracts/src";
import { buildPulseIssuePlan, type PulseIssueModuleKey, type PulseIssuePlan } from "./pulse-issue-plan";

export interface MarketPulsePdfExportResult {
  buffer: Buffer;
  html: string;
}

const chromiumCandidates = [
  process.env.THESIS_PDF_CHROME_PATH,
  process.env.CHROME_BIN,
  process.env.CHROMIUM_BIN,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0);

export function supportsMarketPulsePdfExport(): boolean {
  return chromiumCandidates.some((candidate) => existsSync(candidate));
}

export function buildMarketPulseReportHtml(report: MarketPulseReport): string {
  const plan = buildPulseIssuePlan(report);
  const sections = plan.modules
    .filter((module) => module.visible)
    .map((module) => renderIssueModule(report, plan, module.key))
    .filter((markup): markup is string => Boolean(markup))
    .join("\n");

  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "<meta charset=\"utf-8\" />",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    "<title>Thesis Pulse</title>",
    "<style>",
    compactCss(pulseCss),
    "</style>",
    "</head>",
    "<body>",
    "<article class=\"issue-shell\">",
    renderMasthead(report, plan),
    renderIssueIndex(plan),
    `<main class="issue-body">${sections}</main>`,
    renderFooter(report, plan),
    "</article>",
    "</body>",
    "</html>"
  ].join("\n");
}

export function buildMarketPulsePdfExport(report: MarketPulseReport): MarketPulsePdfExportResult {
  const browserPath = resolveChromiumExecutablePath();
  if (!browserPath) {
    throw new Error("Market Pulse PDF export requires a Chromium-compatible browser executable.");
  }

  const html = buildMarketPulseReportHtml(report);
  const tempDir = mkdtempSync(join(tmpdir(), "thesis-market-pulse-"));
  const htmlPath = join(tempDir, "market-pulse.html");
  const pdfPath = join(tempDir, "market-pulse.pdf");

  try {
    writeFileSync(htmlPath, html, "utf8");
    execFileSync(
      browserPath,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        "--virtual-time-budget=12000",
        `--print-to-pdf=${pdfPath}`,
        htmlPath
      ],
      {
        windowsHide: true,
        stdio: "ignore"
      }
    );
    return {
      buffer: readFileSync(pdfPath),
      html
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

export function writeMarketPulseArtifacts(
  report: MarketPulseReport,
  output: {
    htmlPath?: string;
    pdfPath?: string;
  }
): void {
  if (!output.htmlPath && !output.pdfPath) {
    throw new Error("At least one output path is required.");
  }

  const html = buildMarketPulseReportHtml(report);
  if (output.htmlPath) {
    mkdirSync(dirname(output.htmlPath), { recursive: true });
    writeFileSync(output.htmlPath, html, "utf8");
  }
  if (output.pdfPath) {
    const rendered = buildMarketPulsePdfExport(report);
    mkdirSync(dirname(output.pdfPath), { recursive: true });
    writeFileSync(output.pdfPath, rendered.buffer);
  }
}

function resolveChromiumExecutablePath(): string | undefined {
  return chromiumCandidates.find((candidate) => existsSync(candidate));
}

function renderIssueModule(
  report: MarketPulseReport,
  plan: PulseIssuePlan,
  key: PulseIssueModuleKey
): string | undefined {
  switch (key) {
    case "tape":
      return renderTape(report);
    case "what_changed":
      return renderWhatChanged(report, plan);
    case "your_names":
      return renderYourNames(report);
    case "calendar":
      return renderCalendar(report);
    case "headlines":
      return renderHeadlines(report);
    case "signal_vs_noise":
      return renderSignalVsNoise(report, plan);
    case "backdrop":
      return renderBackdrop(plan);
    default:
      return undefined;
  }
}

function renderMasthead(report: MarketPulseReport, plan: PulseIssuePlan): string {
  return [
    "<header class=\"masthead\">",
    "<div class=\"issue-meta\">",
    `<span>VOL. VII - NO. ${escapeHtml(issueNumber(report.cycle_end || report.generated_at))}</span>`,
    `<span>${escapeHtml(formatIssueDate(report.cycle_end || report.generated_at))}</span>`,
    "</div>",
    "<div class=\"brand-lockup\">",
    "<span class=\"brand-lockup__thesis\">THESIS</span>",
    "<span class=\"brand-lockup__pulse\">pulse</span>",
    "</div>",
    "<div class=\"masthead__dek\">THE DAILY FINANCIAL BRIEFING</div>",
    renderTickerStrip(report),
    plan.quiet_day ? "<p class=\"quiet-banner\">Quiet day. No material change from the previous issue.</p>" : "",
    "</header>"
  ].join("\n");
}

function renderIssueIndex(plan: PulseIssuePlan): string {
  const contents = plan.in_this_issue.length > 0 ? plan.in_this_issue : ["The Tape", "Signal vs Noise"];
  return [
    "<section class=\"issue-index\" data-section-visible=\"true\">",
    "<div>",
    "<span class=\"eyebrow\">In This Issue</span>",
    `<p>${escapeHtml(plan.opening_note)}</p>`,
    "</div>",
    "<ol>",
    ...contents.slice(0, 6).map((entry) => `<li>${escapeHtml(entry)}</li>`),
    "</ol>",
    "</section>"
  ].join("\n");
}

function renderTape(report: MarketPulseReport): string {
  const headline = report.editorial_issue?.headline ?? marketTapeHeadline(report);
  const lede = compactText(report.editorial_issue?.lead ?? buildTapeNarrative(report), 80, 4);
  const sectorLine = renderSectorLine(report);

  return [
    "<section class=\"story-section tape-section\" data-section-visible=\"true\">",
    "<div class=\"section-kicker\"><span>The Tape</span><em>Daily board</em></div>",
    `<h1>${escapeHtml(headline.toUpperCase())}</h1>`,
    `<p class="lede">${escapeHtml(lede)}</p>`,
    report.market_tape ? renderTapeChart(report.market_tape.indices, report.market_tape.cross_asset) : "",
    sectorLine,
    "</section>"
  ].join("\n");
}

function renderWhatChanged(report: MarketPulseReport, plan: PulseIssuePlan): string {
  const items = report.editorial_issue?.what_changed ?? [];
  const bodies = items
    .filter((item) => item.kind !== "company_event")
    .map((item) => sanitizeWhatChangedBody(item.body))
    .filter((body) =>
      body.length > 0 &&
      !/no material change/i.test(body)
    )
    .slice(0, 2);
  const body = plan.quiet_day
    ? "No material change from yesterday's issue."
    : compactText(
        bodies.join(" ") ||
          sanitizeWhatChangedBody(report.sections.what_changed?.body ?? "") ||
          "The main change is in the reviewed tape.",
        50,
        2
      );

  return [
    "<section class=\"story-section compact-section\" data-section-visible=\"true\">",
    "<div class=\"section-kicker\"><span>What Changed</span><em>Verified</em></div>",
    "<h2>What Changed</h2>",
    `<p>${escapeHtml(body)}</p>`,
    "</section>"
  ].join("\n");
}

function renderYourNames(report: MarketPulseReport): string | undefined {
  const rows = report.morning_edition?.portfolio_radar ?? [];
  if (rows.length === 0) {
    return undefined;
  }
  const summary = compactText(
    report.editorial_issue?.why_it_matters[0]?.body ??
      "Tracked names are shown only when a watchlist or manual holding is available.",
    30,
    2
  );
  const tableRows = rows.slice(0, 8).map((row) => {
    const tone = row.direction === "up" ? "up" : row.direction === "down" ? "down" : "flat";
    return [
      "<tr>",
      `<td><strong>${escapeHtml(row.ticker)}</strong>${row.company_name ? `<small>${escapeHtml(row.company_name)}</small>` : ""}</td>`,
      `<td>${escapeHtml(formatPrice(row.previous_close))}</td>`,
      `<td>${escapeHtml(formatPrice(row.latest_price))}</td>`,
      `<td><em class="${tone}">${escapeHtml(formatPct(row.change_pct))}</em></td>`,
      row.reason ? `<td>${escapeHtml(row.reason)}</td>` : "<td></td>",
      "</tr>"
    ].join("");
  });

  return [
    "<section class=\"story-section names-section\" data-section-visible=\"true\">",
    "<div class=\"section-kicker\"><span>Your Names</span><em>Watchlist</em></div>",
    "<h2>Your Names</h2>",
    `<p>${escapeHtml(summary)}</p>`,
    "<table class=\"names-table\">",
    "<thead><tr><th>Symbol</th><th>Yesterday</th><th>Today</th><th>Move</th><th>Note</th></tr></thead>",
    `<tbody>${tableRows.join("\n")}</tbody>`,
    "</table>",
    "</section>"
  ].join("\n");
}

function renderCalendar(report: MarketPulseReport): string | undefined {
  const items = report.morning_edition?.today_catalysts ?? [];
  if (items.length === 0) {
    return undefined;
  }
  return [
    "<section class=\"story-section compact-section\" data-section-visible=\"true\">",
    "<div class=\"section-kicker\"><span>Today's Calendar</span><em>Next watch</em></div>",
    "<h2>Today's Calendar</h2>",
    "<div class=\"calendar-list\">",
    ...items.slice(0, 6).map((item) => [
      "<article>",
      `<time>${escapeHtml(item.time_label ?? "Watch")}</time>`,
      `<strong>${escapeHtml(item.title)}</strong>`,
      `<em>${escapeHtml(readableImpact(item.impact))}</em>`,
      "</article>"
    ].join("")),
    "</div>",
    "</section>"
  ].join("\n");
}

function renderHeadlines(report: MarketPulseReport): string | undefined {
  const morningHeadlines = report.morning_edition?.headline_digest ?? [];
  const macroHeadlines = (report.macro_news?.items ?? []).map((item) => ({
    headline: item.headline,
    source_name: item.source_name,
    source_url: item.source_url,
    published_at: item.published_at,
    summary: item.why_it_matters
  }));
  const headlines = [
    ...morningHeadlines.map((item) => ({
      headline: item.headline,
      source_name: item.source_name,
      source_url: item.source_url,
      published_at: item.published_at,
      summary: undefined as string | undefined
    })),
    ...macroHeadlines
  ].slice(0, 5);

  if (headlines.length === 0) {
    return undefined;
  }

  return [
    "<section class=\"story-section headlines-section\" data-section-visible=\"true\">",
    "<div class=\"section-kicker\"><span>Headlines Worth Knowing</span><em>Approved sources</em></div>",
    "<h2>Headlines Worth Knowing</h2>",
    "<div class=\"headline-list\">",
    ...headlines.map((item) => [
      "<article>",
      item.source_url
        ? `<a href="${escapeHtml(item.source_url)}">${escapeHtml(item.headline)}</a>`
        : `<strong>${escapeHtml(item.headline)}</strong>`,
      `<span>${escapeHtml(item.source_name)}${item.published_at ? ` - ${escapeHtml(formatIssueDate(item.published_at))}` : ""}</span>`,
      item.summary ? `<p>${escapeHtml(compactText(item.summary, 18, 1))}</p>` : "",
      "</article>"
    ].join("\n")),
    "</div>",
    "</section>"
  ].join("\n");
}

function renderSignalVsNoise(report: MarketPulseReport, plan: PulseIssuePlan): string {
  const split = splitSignalNoise(report);
  const signal = plan.quiet_day
    ? "No new signal emerged."
    : split.signal;
  const noise = plan.quiet_day
    ? "Unchanged index levels are not a story."
    : split.noise;
  return [
    "<section class=\"story-section signal-section\" data-section-visible=\"true\">",
    "<div class=\"section-kicker\"><span>Signal vs Noise</span><em>Bounded</em></div>",
    "<h2>Signal vs Noise</h2>",
    "<div class=\"signal-grid\">",
    `<p><strong>Signal.</strong> ${escapeHtml(limitWords(signal, 28))}</p>`,
    `<p><strong>Noise.</strong> ${escapeHtml(limitWords(noise, 28))}</p>`,
    "</div>",
    "</section>"
  ].join("\n");
}

function renderBackdrop(plan: PulseIssuePlan): string {
  return [
    "<section class=\"story-section backdrop-section\" data-section-visible=\"true\">",
    "<div class=\"section-kicker\"><span>The Backdrop</span><em>Macro</em></div>",
    `<p>${escapeHtml(compactText(plan.backdrop_one_liner, 18, 1))}</p>`,
    "</section>"
  ].join("\n");
}

function renderFooter(report: MarketPulseReport, plan: PulseIssuePlan): string {
  const sources = plan.source_footnotes.length > 0
    ? plan.source_footnotes
    : fallbackSources(report);
  const sourceItems = sources.slice(0, 8).map((item) => {
    const source = item.url
      ? `<a href="${escapeHtml(item.url)}">${escapeHtml(item.source_name)}</a>`
      : escapeHtml(item.source_name);
    return `<li>${source}<span>${escapeHtml(formatShortDate(item.retrieved_at))}</span></li>`;
  });
  const coverage = plan.coverage_notes.slice(0, 5).map((note) => `<li>${escapeHtml(note)}</li>`);

  return [
    "<footer class=\"issue-footer\">",
    "<details>",
    "<summary>Sources and method</summary>",
    "<p>Thesis Pulse is a research briefing. It is not investment advice, an execution instruction, or a trading signal.</p>",
    sourceItems.length > 0 ? `<ul class="source-list">${sourceItems.join("\n")}</ul>` : "",
    coverage.length > 0 ? `<ul class="coverage-list">${coverage.join("\n")}</ul>` : "",
    `<p>Generated ${escapeHtml(report.generated_at)} from reviewed source families.</p>`,
    "</details>",
    "</footer>"
  ].join("\n");
}

function renderTickerStrip(report: MarketPulseReport): string {
  const entries = [
    ...(report.market_tape?.indices ?? []),
    ...(report.market_tape?.cross_asset ?? [])
  ].slice(0, 4);
  const fallback = report.macro_stress.inputs.slice(0, 3).map((input) => ({
    label: input.label,
    value: input.value,
    daily_change_pct: undefined,
    direction: input.pressure === "low" ? "down" : input.pressure === "high" ? "up" : "flat"
  }));
  const items = entries.length > 0 ? entries : fallback;

  return [
    "<div class=\"ticker-strip\">",
    ...items.map((entry) => {
      const tone = entry.direction === "up" ? "up" : entry.direction === "down" ? "down" : "flat";
      const change = typeof entry.daily_change_pct === "number"
        ? formatPct(entry.daily_change_pct)
        : "official";
      return [
        "<div class=\"ticker-item\">",
        `<strong>${escapeHtml(shortMarketLabel(entry.label))}</strong>`,
        `<span>${escapeHtml(formatBoardValue(entry.value))}</span>`,
        `<em class="${tone}">${escapeHtml(change)}</em>`,
        "</div>"
      ].join("");
    }),
    "</div>"
  ].join("\n");
}

function renderTapeChart(indices: MarketTapeMove[], crossAsset: MarketTapeMove[]): string {
  const entries = [...indices, ...crossAsset].slice(0, 7);
  if (entries.length === 0) {
    return "";
  }
  const maxAbs = Math.max(
    ...entries.map((entry) => Math.abs(entry.daily_change_pct ?? 0)),
    0.1
  );
  const bars = entries.map((entry) => {
    const change = entry.daily_change_pct ?? 0;
    const height = 14 + Math.round((Math.abs(change) / maxAbs) * 62);
    const tone = change > 0 ? "bar--up" : change < 0 ? "bar--down" : "bar--flat";
    return [
      "<div class=\"chart-bar\">",
      `<span>${escapeHtml(formatPct(change))}</span>`,
      `<b class="${tone}" style="height:${height}px"></b>`,
      `<small>${escapeHtml(shortMarketLabel(entry.label))}</small>`,
      "</div>"
    ].join("");
  });

  return [
    "<figure class=\"tape-chart\">",
    "<figcaption>One-day market tape</figcaption>",
    `<div class="chart-bars">${bars.join("\n")}</div>`,
    "</figure>"
  ].join("\n");
}

function renderSectorLine(report: MarketPulseReport): string {
  const leadership = report.market_tape?.sector_leadership;
  if (leadership && (leadership.leaders.length > 0 || leadership.laggards.length > 0)) {
    const leaders = leadership.leaders.slice(0, 3).map((entry) => `${shortMarketLabel(entry.label)} ${formatPct(entry.daily_change_pct)}`);
    const laggards = leadership.laggards.slice(0, 3).map((entry) => `${shortMarketLabel(entry.label)} ${formatPct(entry.daily_change_pct)}`);
    return `<p class="tape-note"><strong>Leadership.</strong> ${escapeHtml(leaders.join(", ") || "n/a")} <strong>Laggards.</strong> ${escapeHtml(laggards.join(", ") || "n/a")}</p>`;
  }
  const sectors = report.morning_edition?.sector_pulse ?? [];
  if (sectors.length === 0) {
    return "";
  }
  return [
    "<div class=\"sector-strip\">",
    ...sectors.slice(0, 6).map((item) => {
      const tone = item.direction === "up" ? "up" : item.direction === "down" ? "down" : "flat";
      return `<span>${escapeHtml(item.label)} <em class="${tone}">${escapeHtml(formatPct(item.change_pct))}</em></span>`;
    }),
    "</div>"
  ].join("\n");
}

function buildTapeNarrative(report: MarketPulseReport): string {
  const tape = report.market_tape;
  if (!tape) {
    return "The market tape was unavailable for this issue. Pulse keeps the read narrow and avoids filling the gap with stale macro context.";
  }
  const breadth = summarizeIndexBreadth(tape.indices);
  const strongest = strongestMove(tape.indices);
  const weakest = weakestMove(tape.indices);
  const crossAsset = crossAssetSummary(tape.cross_asset);
  const sector = tape.sector_leadership?.notable
    ? "Sector dispersion was notable."
    : "Sector leadership did not force a separate story.";

  return [
    breadth === "higher"
      ? "Core indices moved broadly higher."
      : breadth === "lower"
        ? "Core indices moved broadly lower."
        : breadth === "mixed"
          ? "The core tape was mixed."
          : "The available tape was thin.",
    strongest ? `${shortMarketLabel(strongest.label)} led at ${formatPct(strongest.daily_change_pct)}.` : "",
    weakest ? `${shortMarketLabel(weakest.label)} lagged at ${formatPct(weakest.daily_change_pct)}.` : "",
    crossAsset ? `${crossAsset}.` : "Cross-asset confirmation was limited.",
    sector
  ].filter(Boolean).join(" ");
}

function splitSignalNoise(report: MarketPulseReport): { signal: string; noise: string } {
  const items = report.editorial_issue?.signal_vs_noise ?? [];
  const titledSignal = items.find((item) => /signal/i.test(item.title))?.body;
  const titledNoise = items.find((item) => /noise/i.test(item.title))?.body;
  if (titledSignal && titledNoise) {
    return {
      signal: titledSignal,
      noise: titledNoise
    };
  }
  const bodies = items.map((item) => item.body);
  const sectionBody = report.sections.signal_vs_noise?.body;
  const text = [...bodies, sectionBody].filter((item): item is string => Boolean(item)).join(" ");
  const signalMatch = text.match(/signal[:.\s]+(.+?)(?:noise[:.\s]+|$)/i);
  const noiseMatch = text.match(/noise[:.\s]+(.+)$/i);

  return {
    signal: signalMatch?.[1]?.trim() || "The reviewed tape is the only fresh daily input.",
    noise: noiseMatch?.[1]?.trim() || "One session does not prove a regime shift."
  };
}

function sanitizeWhatChangedBody(value: string): string {
  return value
    .replace(/Official filing or macro events entered the cycle and remain separate from market-tape movement\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fallbackSources(report: MarketPulseReport): EvidenceItem[] {
  const evidence: EvidenceItem[] = [];
  for (const section of Object.values(report.sections)) {
    evidence.push(...(section?.evidence ?? []));
  }
  return evidence;
}

function summarizeIndexBreadth(indexMoves: MarketTapeMove[]): "higher" | "lower" | "mixed" | "thin" {
  if (indexMoves.length < 2) {
    return "thin";
  }
  const up = indexMoves.filter((entry) => entry.direction === "up").length;
  const down = indexMoves.filter((entry) => entry.direction === "down").length;
  if (up >= 3) {
    return "higher";
  }
  if (down >= 3) {
    return "lower";
  }
  return "mixed";
}

function strongestMove(moves: MarketTapeMove[]): MarketTapeMove | undefined {
  return moves
    .filter((entry) => typeof entry.daily_change_pct === "number")
    .sort((a, b) => (b.daily_change_pct ?? 0) - (a.daily_change_pct ?? 0))[0];
}

function weakestMove(moves: MarketTapeMove[]): MarketTapeMove | undefined {
  return moves
    .filter((entry) => typeof entry.daily_change_pct === "number")
    .sort((a, b) => (a.daily_change_pct ?? 0) - (b.daily_change_pct ?? 0))[0];
}

function crossAssetSummary(moves: MarketTapeMove[]): string {
  return moves
    .slice(0, 4)
    .map((entry) => `${shortMarketLabel(entry.label)} ${formatPct(entry.daily_change_pct)}`)
    .join(", ");
}

function marketTapeHeadline(report: MarketPulseReport): string {
  const breadth = summarizeIndexBreadth(report.market_tape?.indices ?? []);
  if (breadth === "higher") {
    return "TAPE FIRMS AS RISK APPETITE BROADENS";
  }
  if (breadth === "lower") {
    return "TAPE SOFTENS AS PRESSURE BUILDS";
  }
  if (report.macro_news?.state === "shock") {
    return "MACRO SHOCK MOVES TO THE FRONT";
  }
  return "MIXED TAPE KEEPS THE MORNING SELECTIVE";
}

function compactText(value: string, maxWords: number, maxSentences: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  const sentences = normalized.match(/[^.!?]+[.!?]+/g) ?? [normalized];
  const sentenceLimited = sentences.slice(0, maxSentences).join(" ").trim();
  const words = sentenceLimited.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return sentenceLimited;
  }
  return `${words.slice(0, maxWords).join(" ")}.`;
}

function limitWords(value: string, maxWords: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return normalized;
  }
  return `${words.slice(0, maxWords).join(" ")}.`;
}

function issueNumber(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "1";
  }
  const start = Date.UTC(parsed.getUTCFullYear(), 0, 0);
  const diff = parsed.getTime() - start;
  return String(Math.max(1, Math.floor(diff / 86400000)));
}

function formatIssueDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.toUpperCase();
  }
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "2-digit"
  }).format(parsed).toUpperCase();
}

function formatShortDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit"
  }).format(parsed);
}

function formatPct(value: number | undefined): string {
  if (typeof value !== "number") {
    return "n/a";
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatPrice(value: number | undefined): string {
  if (typeof value !== "number") {
    return "n/a";
  }
  return value >= 1000 ? value.toFixed(2) : `$${value.toFixed(2)}`;
}

function formatBoardValue(value: number | undefined): string {
  if (typeof value !== "number") {
    return "n/a";
  }
  return value >= 1000 ? value.toFixed(2) : trimNumber(value);
}

function readableImpact(value: string): string {
  if (value === "high") {
    return "Impact";
  }
  if (value === "medium") {
    return "Watch";
  }
  return "Context";
}

function shortMarketLabel(label: string): string {
  const normalized = label.toLowerCase();
  if (normalized.includes("s&p")) {
    return "SPX";
  }
  if (normalized.includes("nasdaq")) {
    return "NDX";
  }
  if (normalized.includes("dow")) {
    return "DJIA";
  }
  if (normalized.includes("russell")) {
    return "RUT";
  }
  if (normalized.includes("vix")) {
    return "VIX";
  }
  if (normalized.includes("treasury 10")) {
    return "US 10Y";
  }
  if (normalized.includes("treasury 2")) {
    return "US 2Y";
  }
  if (normalized.includes("wti")) {
    return "WTI";
  }
  return label.length > 12 ? label.slice(0, 12).toUpperCase() : label.toUpperCase();
}

function trimNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(2).replace(/\.?0+$/, "");
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

const pulseCss = `
  @page {
    size: 5.8in 9.2in;
    margin: 0.18in;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    background: #050505;
    color: #f5efe3;
    font-family: Georgia, "Times New Roman", serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  h1,
  h2,
  h3,
  p,
  ol,
  ul,
  figure {
    margin: 0;
  }

  h1,
  h2,
  strong {
    color: #fff8ec;
  }

  h1 {
    font-size: 22px;
    line-height: 1.02;
    letter-spacing: 0;
    text-transform: uppercase;
    text-shadow: 2px 0 0 #173961, 4px 0 0 #8c241e;
  }

  h2 {
    font-size: 12px;
    line-height: 1.12;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    text-shadow: 1px 0 0 #173961, 2px 0 0 #8c241e;
  }

  h1,
  h2,
  .section-kicker,
  .eyebrow {
    break-after: avoid;
    page-break-after: avoid;
  }

  p,
  li,
  td,
  th {
    font-size: 9.6px;
    line-height: 1.36;
  }

  a {
    color: inherit;
    text-decoration-color: #d7b985;
    text-underline-offset: 2px;
  }

  .issue-shell {
    width: min(100%, 500px);
    margin: 12px auto;
    background: #101010;
    border: 1px solid #2a241d;
    box-shadow: 0 18px 70px rgba(0, 0, 0, 0.58);
    overflow: hidden;
  }

  .masthead {
    padding: 26px 18px 0;
    border-bottom: 2px solid #d7b985;
  }

  .issue-meta,
  .section-kicker,
  .eyebrow,
  .masthead__dek {
    color: #f0c777;
    font: 800 8.6px/1.2 Arial, "Helvetica Neue", sans-serif;
    letter-spacing: 0.15em;
    text-transform: uppercase;
  }

  .issue-meta,
  .section-kicker {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }

  .issue-meta {
    padding-bottom: 9px;
    border-bottom: 1px solid #2b2925;
  }

  .brand-lockup {
    display: flex;
    justify-content: center;
    align-items: baseline;
    gap: 8px;
    padding-top: 11px;
  }

  .brand-lockup__thesis {
    font-size: 34px;
    font-weight: 800;
    line-height: 1;
    text-shadow: 2px 0 0 #173961, 4px 0 0 #8c241e;
  }

  .brand-lockup__pulse {
    color: #dcb878;
    font-size: 28px;
    font-style: italic;
    line-height: 1;
  }

  .masthead__dek {
    margin: 5px 0 13px;
    color: #c7d1da;
    text-align: center;
  }

  .ticker-strip {
    display: flex;
    gap: 10px;
    padding: 12px 0 8px;
    border-top: 1px solid #2d2b27;
    overflow: hidden;
  }

  .ticker-item {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    font: 800 10.5px/1.15 Arial, "Helvetica Neue", sans-serif;
    white-space: nowrap;
  }

  .ticker-item span {
    color: #cfd7df;
    font-weight: 500;
  }

  .ticker-item em,
  .names-table em,
  .sector-strip em {
    border-radius: 4px;
    padding: 2px 4px;
    font-style: normal;
    font-size: 8.5px;
  }

  .up {
    background: #073d2b;
    color: #31db8b;
  }

  .down {
    background: #4a1110;
    color: #ff6a61;
  }

  .flat {
    background: #24211c;
    color: #d7b985;
  }

  .quiet-banner {
    padding: 8px 0 10px;
    color: #d7b985;
    border-top: 1px solid #2d2b27;
    font: 800 9px/1.25 Arial, "Helvetica Neue", sans-serif;
    text-transform: uppercase;
  }

  .issue-index,
  .story-section,
  .issue-footer {
    padding: 14px 18px;
    border-bottom: 1px solid #28231c;
  }

  .issue-index,
  .story-section,
  .issue-footer,
  .tape-chart,
  .names-table,
  .calendar-list article,
  .headline-list article {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .issue-index {
    display: grid;
    grid-template-columns: 1.25fr 0.9fr;
    gap: 16px;
  }

  .issue-index p {
    margin-top: 5px;
    color: #f1eadc;
  }

  .issue-index ol {
    display: grid;
    gap: 4px;
    padding-left: 16px;
    font: 800 9px/1.24 Arial, "Helvetica Neue", sans-serif;
  }

  .section-kicker {
    margin-bottom: 9px;
    padding-bottom: 7px;
    border-bottom: 1px solid #2b2925;
  }

  .section-kicker em {
    color: #b7c0c8;
    font-style: normal;
  }

  .lede {
    margin-top: 12px;
    font-size: 10.9px;
    line-height: 1.38;
  }

  .tape-chart {
    margin-top: 13px;
    padding: 10px 9px 8px;
    background: #171717;
    border: 1px solid #2c2a27;
    border-radius: 6px;
  }

  .tape-chart figcaption {
    margin-bottom: 8px;
    color: #f0c777;
    text-align: center;
    font: 800 8px/1.2 Arial, "Helvetica Neue", sans-serif;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .chart-bars {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    align-items: end;
    gap: 7px;
    min-height: 96px;
  }

  .chart-bar {
    display: grid;
    align-items: end;
    gap: 4px;
    min-width: 0;
    text-align: center;
  }

  .chart-bar span,
  .chart-bar small {
    color: #b8c2ca;
    font: 700 7.5px/1.1 Arial, "Helvetica Neue", sans-serif;
    white-space: nowrap;
  }

  .chart-bar b {
    display: block;
    width: 100%;
    min-height: 10px;
    border-radius: 2px 2px 0 0;
  }

  .bar--up {
    background: #d7b985;
  }

  .bar--down {
    background: #7e332b;
  }

  .bar--flat {
    background: #44413b;
  }

  .tape-note,
  .compact-section p,
  .backdrop-section p,
  .signal-grid p {
    margin-top: 8px;
  }

  .sector-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    margin-top: 9px;
    font: 800 8.5px/1.2 Arial, "Helvetica Neue", sans-serif;
  }

  .sector-strip span {
    padding: 5px 7px;
    border: 1px solid #2c2a27;
    border-radius: 5px;
  }

  .names-table {
    width: 100%;
    margin-top: 9px;
    border-collapse: collapse;
    font-family: Arial, "Helvetica Neue", sans-serif;
  }

  .names-table th,
  .names-table td {
    padding: 7px 5px;
    border-bottom: 1px solid #26231f;
    text-align: right;
  }

  .names-table th:first-child,
  .names-table td:first-child {
    text-align: left;
  }

  .names-table small {
    display: block;
    margin-top: 2px;
    color: #aeb7bf;
    font-size: 8px;
  }

  .calendar-list,
  .headline-list,
  .signal-grid {
    display: grid;
    gap: 7px;
    margin-top: 9px;
  }

  .calendar-list article,
  .headline-list article {
    display: grid;
    grid-template-columns: 72px 1fr auto;
    gap: 8px;
    align-items: center;
    padding: 7px 0;
    border-bottom: 1px solid #25231f;
  }

  .calendar-list time,
  .calendar-list em,
  .headline-list span {
    color: #b7c0c8;
    font: 800 8.2px/1.2 Arial, "Helvetica Neue", sans-serif;
    font-style: normal;
  }

  .headline-list article {
    grid-template-columns: 1fr;
    gap: 3px;
  }

  .headline-list a,
  .headline-list strong {
    font-size: 10px;
    line-height: 1.25;
  }

  .issue-footer {
    border-bottom: 0;
    color: #bfc7cd;
    font-family: Arial, "Helvetica Neue", sans-serif;
  }

  .issue-footer summary {
    cursor: default;
    color: #f0c777;
    font: 800 9px/1.2 Arial, "Helvetica Neue", sans-serif;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .issue-footer details[open] {
    display: grid;
    gap: 8px;
  }

  .source-list,
  .coverage-list {
    display: grid;
    gap: 4px;
    margin: 8px 0 0;
    padding-left: 15px;
  }

  .source-list li {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  @media (max-width: 540px) {
    .issue-shell {
      margin: 0;
      border-left: 0;
      border-right: 0;
    }

    .issue-index {
      grid-template-columns: 1fr;
    }

    .chart-bars {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
`;
