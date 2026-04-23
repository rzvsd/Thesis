import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type {
  EvidenceItem,
  MacroStressInput,
  MacroStressSnapshot,
  MarketPulseReport,
  ReportSection,
  StructuralContextObservation,
  StructuralContextOmission
} from "../../../packages/contracts/src";

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

const sectionOrder: Array<keyof MarketPulseReport["sections"]> = [
  "official_macro_pressure",
  "bounded_context",
  "market_moves",
  "canonical_events",
  "uncertainty_flags",
  "macro_releases",
  "rates_fx_commodities",
  "news_summary"
];

export function supportsMarketPulsePdfExport(): boolean {
  return chromiumCandidates.some((candidate) => existsSync(candidate));
}

export function buildMarketPulseReportHtml(report: MarketPulseReport): string {
  const title = "Thesis Morning Exception Briefing";
  const renderedSections = sectionOrder
    .map((key) => renderSectionCard(report.sections[key]))
    .filter((markup): markup is string => Boolean(markup))
    .join("\n");

  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "<meta charset=\"utf-8\" />",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    `<title>${title}</title>`,
    "<style>",
    pulseCss,
    "</style>",
    "</head>",
    "<body>",
    "<div class=\"page\">",
    renderHero(report),
    "<div class=\"content-grid\">",
    `<main class="report-column">${renderedSections}</main>`,
    `<aside class="rail-column">${renderMacroStressPanel(report.macro_stress)}${renderStructuralContextPanel(report)}${renderMethodPanel(report)}</aside>`,
    "</div>",
    "</div>",
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

function renderHero(report: MarketPulseReport): string {
  const structuralSummary = report.structural_context?.summary ?? "Structural context was not available for this cycle.";
  const officialCoverage = summarizeSectionStatuses(report, ["official_macro_pressure", "bounded_context"]);
  const sourceState = report.context?.source_state ?? "unknown";
  return [
    "<header class=\"hero\">",
    "<div class=\"hero__meta\">",
    "<div class=\"eyebrow\">Thesis Morning Exception Briefing</div>",
    `<div class="hero__cycle">Cycle end ${escapeHtml(report.cycle_end)} | Macro Stress as of ${escapeHtml(report.macro_stress.as_of)}</div>`,
    "</div>",
    "<div class=\"hero__body\">",
    "<div class=\"hero__copy\">",
    "<h1>Market Pulse</h1>",
    `<p class="hero__summary">${escapeHtml(report.macro_stress.summary)}</p>`,
    `<p class="hero__structural">${escapeHtml(structuralSummary)}</p>`,
    "</div>",
    "<div class=\"hero__signal\">",
    `<div class="hero__signal-label">${escapeHtml(report.macro_stress.state)}</div>`,
    `<div class="hero__signal-value">${escapeHtml(pressureHeadline(report.macro_stress))}</div>`,
    "</div>",
    "</div>",
    "<div class=\"hero__stats\">",
    renderStat("Confidence", `${Math.round(report.confidence.score * 100)}% ${report.confidence.label}`),
    renderStat("Coverage", officialCoverage),
    renderStat("Source State", sourceState),
    renderStat("Flags", report.flags.length > 0 ? String(report.flags.length) : "none"),
    "</div>",
    "</header>"
  ].join("\n");
}

function renderStat(label: string, value: string): string {
  return `<div class="stat"><div class="stat__label">${escapeHtml(label)}</div><div class="stat__value">${escapeHtml(value)}</div></div>`;
}

function renderSectionCard(section: ReportSection | undefined): string | undefined {
  if (!section) {
    return undefined;
  }
  return [
    `<section class="section-card">`,
    "<div class=\"section-card__header\">",
    `<div><div class="eyebrow eyebrow--muted">${escapeHtml(section.section_id.replaceAll("_", " "))}</div><h2>${escapeHtml(section.title)}</h2></div>`,
    `<span class="status-pill ${toneClassForStatus(section.status)}">${escapeHtml(section.status)}</span>`,
    "</div>",
    `<div class="section-card__body">${renderBody(section.body)}</div>`,
    section.evidence.length > 0 ? renderEvidence(section.evidence) : "",
    "</section>"
  ].join("\n");
}

function renderBody(body: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (paragraphs.length === 0) {
    return "<p>No body content was available for this section.</p>";
  }
  return paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n");
}

function renderEvidence(evidence: EvidenceItem[]): string {
  const items = evidence.slice(0, 8).map((entry) => {
    const source = `${entry.source_name}${entry.url ? ` (${entry.url})` : ""}`;
    return `<li><strong>${escapeHtml(source)}</strong><span>${escapeHtml(entry.excerpt)}</span></li>`;
  }).join("\n");
  return `<div class="evidence-block"><div class="eyebrow eyebrow--muted">Evidence</div><ul>${items}</ul></div>`;
}

function renderMacroStressPanel(macroStress: MacroStressSnapshot): string {
  const rows = macroStress.inputs.map((input) => {
    return [
      "<tr>",
      `<td>${escapeHtml(input.label)}</td>`,
      `<td>${escapeHtml(input.category)}</td>`,
      `<td><span class="pressure pressure--${escapeHtml(input.pressure)}">${escapeHtml(input.pressure)}</span></td>`,
      `<td>${escapeHtml(formatInputValue(input))}</td>`,
      `<td>${escapeHtml(input.period ?? "n/a")}</td>`,
      "</tr>"
    ].join("");
  }).join("\n");

  return [
    "<section class=\"rail-card\">",
    "<div class=\"section-card__header\">",
    "<div><div class=\"eyebrow eyebrow--muted\">Macro Stress</div><h2>Regime Board</h2></div>",
    `<span class="status-pill ${toneClassForState(macroStress.state)}">${escapeHtml(macroStress.state)}</span>`,
    "</div>",
    `<p class="rail-copy">${escapeHtml(macroStress.summary)}</p>`,
    "<table class=\"stress-table\">",
    "<thead><tr><th>Input</th><th>Category</th><th>Pressure</th><th>Value</th><th>Period</th></tr></thead>",
    `<tbody>${rows}</tbody>`,
    "</table>",
    macroStress.omissions.length > 0 ? renderMacroOmissions(macroStress.omissions) : "",
    "</section>"
  ].join("\n");
}

function renderStructuralContextPanel(report: MarketPulseReport): string {
  const pack = report.structural_context;
  if (!pack) {
    return [
      "<section class=\"rail-card\">",
      "<div class=\"section-card__header\">",
      "<div><div class=\"eyebrow eyebrow--muted\">Structural Context</div><h2>Backdrop</h2></div>",
      "<span class=\"status-pill neutral\">missing</span>",
      "</div>",
      "<p class=\"rail-copy\">Structural context was not available for this cycle.</p>",
      "</section>"
    ].join("\n");
  }

  const observations = pack.observations
    .slice(0, 6)
    .map((entry) => renderObservation(entry))
    .join("\n");
  const omissions = pack.omissions.length > 0 ? renderStructuralOmissions(pack.omissions) : "";

  return [
    "<section class=\"rail-card\">",
    "<div class=\"section-card__header\">",
    "<div><div class=\"eyebrow eyebrow--muted\">Structural Context</div><h2>Backdrop</h2></div>",
    `<span class="status-pill ${toneClassForStructuralCoverage(pack.coverage_state)}">${escapeHtml(pack.coverage_state)}</span>`,
    "</div>",
    `<p class="rail-copy">${escapeHtml(pack.summary)}</p>`,
    `<div class="observation-list">${observations}</div>`,
    omissions,
    "</section>"
  ].join("\n");
}

function renderObservation(entry: StructuralContextObservation): string {
  return [
    "<article class=\"observation\">",
    `<div class="observation__label">${escapeHtml(entry.label)}</div>`,
    `<p>${escapeHtml(entry.summary)}</p>`,
    `<div class="observation__meta">${escapeHtml(entry.geography)} | ${escapeHtml(entry.period)} | ${escapeHtml(entry.source_family)}</div>`,
    "</article>"
  ].join("\n");
}

function renderMethodPanel(report: MarketPulseReport): string {
  const sourceState = report.context?.source_state ?? "unknown";
  const rights = (report.context?.rights ?? [])
    .map((entry) => `${entry.source_type}: ${entry.policy_reason}`)
    .slice(0, 3);
  const limitingFactors = report.confidence.limiting_factors.slice(0, 5);
  return [
    "<section class=\"rail-card\">",
    "<div class=\"section-card__header\">",
    "<div><div class=\"eyebrow eyebrow--muted\">Method</div><h2>Coverage and Discipline</h2></div>",
    `<span class="status-pill ${toneClassForContextSourceState(sourceState)}">${escapeHtml(sourceState)}</span>`,
    "</div>",
    `<p class="rail-copy">Generated ${escapeHtml(report.generated_at)}. Thesis remains omission-aware and keeps the Morning Exception Briefing bounded to decision-relevant context.</p>`,
    "<div class=\"method-list\">",
    `<div><strong>Confidence</strong><p>${escapeHtml(`${Math.round(report.confidence.score * 100)}% ${report.confidence.label}`)}</p></div>`,
    `<div><strong>Limiting factors</strong>${renderSimpleList(limitingFactors)}</div>`,
    `<div><strong>Rights and provenance</strong>${renderSimpleList(rights)}</div>`,
    `<div><strong>Flags</strong>${renderSimpleList(report.flags.length > 0 ? report.flags : ["No material report flags."])}</div>`,
    "</div>",
    "</section>"
  ].join("\n");
}

function renderSimpleList(items: string[]): string {
  const lines = items.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("\n");
  return `<ul class="simple-list">${lines}</ul>`;
}

function renderMacroOmissions(omissions: MacroStressSnapshot["omissions"]): string {
  const items = omissions.map((entry) => `<li>${escapeHtml(`${entry.registry_id}: ${entry.reason_text}`)}</li>`).join("\n");
  return `<div class="omission-block"><div class="eyebrow eyebrow--muted">Macro Omissions</div><ul class="simple-list">${items}</ul></div>`;
}

function renderStructuralOmissions(omissions: StructuralContextOmission[]): string {
  const items = omissions.map((entry) => `<li>${escapeHtml(`${entry.source_family}: ${entry.reason_text}`)}</li>`).join("\n");
  return `<div class="omission-block"><div class="eyebrow eyebrow--muted">Coverage Notes</div><ul class="simple-list">${items}</ul></div>`;
}

function summarizeSectionStatuses(
  report: MarketPulseReport,
  keys: Array<keyof MarketPulseReport["sections"]>
): string {
  return keys
    .map((key) => report.sections[key])
    .filter((section): section is ReportSection => Boolean(section))
    .map((section) => `${section.title}: ${section.status}`)
    .join(" | ");
}

function pressureHeadline(macroStress: MacroStressSnapshot): string {
  const leaders = macroStress.inputs.filter((input) => input.pressure === "high");
  if (leaders.length === 0) {
    return "No high-pressure inputs are in force.";
  }
  return leaders.slice(0, 2).map((input) => input.label).join(" and ");
}

function formatInputValue(input: MacroStressInput): string {
  if (typeof input.value !== "number") {
    return input.unit ?? "n/a";
  }
  return `${trimNumber(input.value)} ${input.unit ?? ""}`.trim();
}

function trimNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function toneClassForStatus(status: ReportSection["status"]): string {
  switch (status) {
    case "complete":
      return "positive";
    case "data_incomplete":
      return "warning";
    case "data_unavailable":
      return "negative";
    default:
      return "neutral";
  }
}

function toneClassForState(state: MacroStressSnapshot["state"]): string {
  switch (state) {
    case "elevated":
      return "warning";
    case "stable":
      return "positive";
    default:
      return "neutral";
  }
}

function toneClassForStructuralCoverage(
  state: MarketPulseReport["structural_context"] extends infer T
    ? T extends { coverage_state: infer U }
      ? U
      : never
    : never
): string {
  switch (state) {
    case "full":
      return "positive";
    case "partial":
      return "warning";
    default:
      return "neutral";
  }
}

function toneClassForContextSourceState(state: string): string {
  if (state === "official") {
    return "positive";
  }
  if (state === "partial" || state === "bounded_context") {
    return "warning";
  }
  if (state === "missing") {
    return "negative";
  }
  return "neutral";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

const pulseCss = `
  @page {
    size: Letter;
    margin: 0.45in;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    background: #f6f2ea;
    color: #1a2128;
    font-family: Arial, "Helvetica Neue", sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  h1, h2, h3, strong {
    color: #1a2128;
  }

  h1, h2 {
    font-family: Georgia, "Times New Roman", serif;
    font-weight: 700;
    letter-spacing: 0;
    margin: 0;
  }

  h1 {
    font-size: 36px;
    line-height: 1.02;
  }

  h2 {
    font-size: 22px;
    line-height: 1.14;
  }

  p {
    margin: 0;
    font-size: 14px;
    line-height: 1.58;
    color: #33404b;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th, td {
    border-bottom: 1px solid #d8d0c2;
    padding: 10px 0;
    text-align: left;
    vertical-align: top;
    font-size: 12px;
  }

  th {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #5a6672;
  }

  .page {
    max-width: 1180px;
    margin: 0 auto;
    padding: 30px 24px 48px;
  }

  .hero {
    background: #1a2128;
    color: #f6f2ea;
    border-radius: 8px;
    padding: 28px 30px;
    margin-bottom: 22px;
    display: grid;
    gap: 22px;
    border: 1px solid #29333d;
  }

  .hero__meta,
  .hero__stats,
  .hero__body {
    display: grid;
    gap: 16px;
  }

  .hero__body {
    grid-template-columns: minmax(0, 1.4fr) minmax(220px, 0.6fr);
    align-items: start;
  }

  .hero__copy {
    display: grid;
    gap: 12px;
  }

  .hero__summary,
  .hero__structural,
  .hero__cycle {
    color: #ede6d8;
  }

  .hero__signal {
    border: 1px solid rgba(246, 242, 234, 0.2);
    border-radius: 8px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.04);
    min-height: 100%;
    display: grid;
    gap: 8px;
  }

  .hero__signal-label {
    font-size: 11px;
    line-height: 1.2;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #c8b48e;
    font-weight: 700;
  }

  .hero__signal-value {
    font-size: 20px;
    line-height: 1.2;
    font-family: Georgia, "Times New Roman", serif;
  }

  .hero__stats {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .stat {
    border-top: 1px solid rgba(246, 242, 234, 0.18);
    padding-top: 12px;
    min-height: 72px;
  }

  .stat__label,
  .eyebrow {
    font-size: 11px;
    line-height: 1.2;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 700;
  }

  .stat__label {
    color: #c8b48e;
    margin-bottom: 8px;
  }

  .stat__value {
    color: #f6f2ea;
    font-size: 14px;
    line-height: 1.45;
  }

  .eyebrow {
    color: #7e6337;
  }

  .eyebrow--muted {
    color: #6c7680;
    margin-bottom: 8px;
  }

  .content-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.34fr) minmax(300px, 0.78fr);
    gap: 18px;
    align-items: start;
  }

  .report-column,
  .rail-column {
    display: grid;
    gap: 16px;
  }

  .section-card,
  .rail-card {
    background: #fffdf8;
    border: 1px solid #d8d0c2;
    border-radius: 6px;
    padding: 20px 22px;
  }

  .section-card__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 14px;
  }

  .section-card__body {
    display: grid;
    gap: 12px;
  }

  .status-pill,
  .pressure {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    border: 1px solid #d8d0c2;
    padding: 6px 8px;
    font-size: 11px;
    line-height: 1.2;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 700;
    white-space: nowrap;
  }

  .positive {
    background: #edf6f0;
    color: #2f6a4f;
    border-color: #c9dfd1;
  }

  .warning {
    background: #fbf1de;
    color: #8b621e;
    border-color: #ead5a5;
  }

  .negative {
    background: #faebea;
    color: #934949;
    border-color: #e7c1bd;
  }

  .neutral {
    background: #f4f1ea;
    color: #5a6672;
  }

  .pressure--high {
    background: #faebea;
    color: #934949;
    border-color: #e7c1bd;
  }

  .pressure--medium {
    background: #fbf1de;
    color: #8b621e;
    border-color: #ead5a5;
  }

  .pressure--low {
    background: #edf6f0;
    color: #2f6a4f;
    border-color: #c9dfd1;
  }

  .stress-table {
    margin-top: 14px;
  }

  .evidence-block,
  .omission-block {
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid #e2dacc;
  }

  .evidence-block ul,
  .simple-list {
    margin: 8px 0 0;
    padding-left: 18px;
    display: grid;
    gap: 8px;
  }

  .evidence-block li,
  .simple-list li {
    color: #33404b;
    font-size: 13px;
    line-height: 1.5;
  }

  .evidence-block li span {
    display: block;
    color: #46525c;
  }

  .rail-copy {
    margin-top: 2px;
  }

  .observation-list,
  .method-list {
    display: grid;
    gap: 12px;
    margin-top: 14px;
  }

  .observation {
    border-top: 1px solid #e2dacc;
    padding-top: 12px;
  }

  .observation:first-child {
    border-top: 0;
    padding-top: 0;
  }

  .observation__label {
    font-size: 12px;
    line-height: 1.2;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 700;
    color: #6c7680;
    margin-bottom: 8px;
  }

  .observation__meta {
    margin-top: 8px;
    color: #6c7680;
    font-size: 12px;
    line-height: 1.4;
  }

  @media (max-width: 980px) {
    .hero__body,
    .hero__stats,
    .content-grid {
      grid-template-columns: 1fr;
    }
  }
`;
