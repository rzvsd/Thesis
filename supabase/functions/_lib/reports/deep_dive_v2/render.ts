// Deep Dive 2.0: page assembly. buildDeepDiveV2Html(report) returns the whole share page: head with the embedded
// fonts and page CSS, app bar, dark header with the price box, chip nav, the 13 chapters in SPEC order, footer,
// the JSON data block and the one constant client script (its hash is in the share page CSP).
// Pure TS (no Deno APIs). Every string from the report is escaped; charts are static SVG.

import type { AnalysisReport } from "../types.ts";
import { asOfDate, readReportFacts, type ReportFacts } from "./adapter.ts";
import { derive } from "./derive.ts";
import { CLIENT_JS, type ClientData, NA_TEXT, priceTexts } from "./client.ts";
import { PAGE_CSS } from "./css.ts";
import { FONT_CSS } from "./fonts.ts";
import { currencyCode, esc, fmt, withCurrency } from "./format.ts";
import { modelRange } from "./chapters_b.ts";
import { business, netCashSentence, owners, summary } from "./chapters_a.ts";
import { action, countries, links } from "./chapters_later.ts";
import { financials } from "./chapters_fin.ts";
import { forecasts, risks, value } from "./chapters_b.ts";
import { bottom, events, sources } from "./chapters_c.ts";
import {
  type Card,
  type Chapter,
  type Ctx,
  dateText,
  fyT,
  isNum,
  last,
  m,
  monthOf,
  p,
  pa,
  pair,
  phaseTag,
  prev,
  priceOffNote,
  shareText,
  shortName,
  tightest,
  usd,
} from "./story.ts";

export interface RenderOptions {
  downloadUrl: string;
}

export const NOT_ADVICE_TEXT =
  "Thesis is research, not financial advice. This report describes a company from its " +
  "public filings. It is general information, not a personal opinion on any security. Do your own research before " +
  "you invest.";

/**
 * Builds the render context: facts, derived values, the stored price and the client data. A report whose figures
 * are not in dollars gets no price at all (priceOff): its EPS and model values are in the reporting currency per
 * reported share, and comparing them with a price needs the exchange rate and the ADR ratio (SPEC section 3).
 */
export function buildContext(report: unknown): Ctx {
  const f = readReportFacts(report);
  const d = derive(f.annual, f.splits);
  const currency = currencyCode(f.currency);
  const priceOff = currency !== "USD";
  const price = f.price && !priceOff ? f.price.value : null;
  const sc = (k: "bear" | "base" | "bull") => d.dcf?.scenarios.find((s) => s.key === k)?.value ?? null;
  const data: ClientData = priceOff ? { price: null, eps: null, scenarios: null, dcf: null, currency } : {
    price,
    eps: last(d.eps),
    scenarios: d.dcf ? { bear: sc("bear"), base: sc("base"), bull: sc("bull") } : null,
    dcf: d.dcf ? d.dcf.inputs : null,
    currency,
  };
  return {
    f,
    d,
    short: shortName(f.name),
    L: d.years.length ? fyT(d.latest.fiscal_year) : "the latest fiscal year",
    price,
    priceDate: f.price && !priceOff ? dateText(f.price.date) : null,
    pt: priceTexts(data, price),
    data,
    currency,
    priceOff,
  };
}

/** The 13 chapters in SPEC order. */
export function buildChapters(c: Ctx): Chapter[] {
  return [
    summary(c),
    business(c),
    countries(c),
    links(c),
    owners(c),
    financials(c),
    value(c),
    action(c),
    forecasts(c),
    risks(c),
    events(c),
    bottom(c),
    sources(c),
  ];
}

const REF = /\[\[ref:([A-Za-z0-9_-]+)\]\]/g;

/** Escapes plain text and turns [[ref:id]] into a "Chart N" link when the card is titled and in this chapter. */
function richText(text: string, nums: Map<string, number>, problems: string[], where: string): string {
  return esc(text).replace(REF, (_, id: string) => {
    const n = nums.get(id);
    if (n === undefined) {
      problems.push(`${where}: no titled card ${id} in this chapter`);
      return "the chart";
    }
    return `<a class="figref" href="#${esc(id)}">Chart ${n}</a>`;
  });
}

function cardHtml(card: Card, num: number | undefined): string {
  const cls = ["card", card.span2 ? "span2" : "", card.notseen ? "notseen" : ""].filter(Boolean).join(" ");
  const head = card.title ? `<div class="fignum">Chart ${num}</div><h3>${esc(card.title)}</h3>` : "";
  const sub = card.sub ? `<div class="sub">${esc(card.sub)}</div>` : "";
  const body = card.chart ? `<div class="chart">${card.html}</div>` : card.html;
  const foot = card.src ? `<div class="foot"><span class="src">${esc(card.src)}</span></div>` : "";
  return `<div class="${cls}" id="${esc(card.id)}">${head}${sub}${body}${foot}${card.table ?? ""}</div>`;
}

function chapterHtml(ch: Chapter, index: number, nums: Map<string, number>, problems: string[]): string {
  const local = new Map([...nums].filter(([id]) => ch.cards.some((cd) => cd.id === id)));
  const rt = (t: string, where: string) => richText(t, local, problems, `${ch.id} ${where}`);
  const kicker = `<div class="sec-kicker"><span class="chap"><em>${String(index + 1).padStart(2, "0")}</em>${
    esc(ch.chip)
  }</span>${ch.phases.map(phaseTag).join("")}<span class="src">${esc(ch.src)}</span></div>`;
  const verdict = `<p class="verdict"><b>${rt(ch.verdict.lead, "verdict")}</b>${
    ch.verdict.body ? " " + rt(ch.verdict.body, "verdict") : ""
  }</p>`;
  const story = ch.story.length
    ? `<div class="story">${
      ch.story.map((s, i) => `<p><b class="o">${rt(s.lead, `p${i + 1}`)}</b> ${rt(s.body, `p${i + 1}`)}</p>`)
        .join("")
    }</div>`
    : "";
  const cards = `<div class="grid2">${ch.cards.map((cd) => cardHtml(cd, nums.get(cd.id))).join("")}</div>`;
  const upshot = ch.upshot ? `<p class="upshot"><b>The upshot</b>${rt(ch.upshot, "upshot")}</p>` : "";
  return `<section id="${esc(ch.id)}"><div class="sec-head">${kicker}<h2>${esc(ch.h2)}</h2>${verdict}</div>${
    ch.intro ?? ""
  }${story}${cards}${upshot}</section>`;
}

/** "From the 10-K for fiscal 2025" / "From the 10-Q for Q2 fiscal 2026". */
export function filingEyebrow(f: ReportFacts, c: Ctx): string {
  const lf = f.latestFiling;
  if (lf && lf.fiscalYear) {
    const q = lf.fiscalPeriod && lf.fiscalPeriod !== "FY" ? `${lf.fiscalPeriod} ` : "";
    return `From the ${lf.form} for ${q}fiscal ${lf.fiscalYear}`;
  }
  return c.d.years.length ? `From the annual reports to ${c.L}` : "From SEC filings";
}

function kpi(label: string, valueHtml: string, delta: string, cls: "up" | "dn" | "n"): string {
  return `<div class="kpi"><div class="l">${
    esc(label)
  }</div><div class="v">${valueHtml}</div><div class="d ${cls}">${esc(delta)}</div></div>`;
}

const dirCls = (
  v: number | null,
): "up" | "dn" | "n" => (!isNum(v) || Math.abs(v) < 0.05 ? "n" : v > 0 ? "up" : "dn");

/**
 * The tile note when a one-year change is missing. "No prior year" only when the row for the year before is not
 * on record; otherwise the year-earlier figure, or a note that one of the two years is not tagged.
 */
function noChange(c: Ctx, series: Array<number | null>, show: (v: number) => string): string {
  const { d } = c;
  if (!d.prior) return "No prior year";
  const before = prev(d, series);
  if (isNum(before)) return `${show(before)} a year earlier`;
  return isNum(last(series))
    ? `Not disclosed for ${fyT(d.prior.fiscal_year)}`
    : "Not disclosed for either year";
}

function kpis(c: Ctx): string {
  const { d, L } = c;
  const yoy = d.growth.revenueYoY, omc = d.marginChange1y.op, fy = d.growth.fcfYoY, sh = d.sharesChange1y;
  const nc = last(d.netCash), ncp = prev(d, d.netCash);
  return `<div class="kpis">${
    [
      kpi(
        `Sales, ${L}`,
        esc(m(last(d.revenue))),
        isNum(yoy) ? `${fmt(yoy, "pct", { sign: true })} on the year` : noChange(c, d.revenue, m),
        dirCls(yoy),
      ),
      kpi(
        "Operating margin",
        esc(p(last(d.opMargin))),
        isNum(omc) ? fmt(omc, "pp") : noChange(c, d.opMargin, (v) => p(v)),
        dirCls(omc),
      ),
      kpi(
        "Free cash flow",
        esc(m(last(d.fcf))),
        isNum(fy) ? `${fmt(fy, "pct", { sign: true, digits: 0 })} on the year` : noChange(c, d.fcf, m),
        dirCls(fy),
      ),
      kpi(
        isNum(nc) && nc < 0 ? "Net debt" : "Net cash",
        esc(isNum(nc) ? m(Math.abs(nc)) : m(null)),
        isNum(ncp)
          ? `${ncp >= 0 ? "net cash" : "net debt"} ${m(Math.abs(ncp))} a year earlier`
          : noChange(c, d.netCash, m),
        "n",
      ),
      kpi(
        "Shares, change in the year",
        esc(isNum(sh) ? fmt(sh, "pct", { sign: true }) : m(null)),
        isNum(sh)
          ? (sh < 0 ? "fewer shares" : sh > 0 ? "more shares" : "unchanged")
          : noChange(c, d.shares, (v) => `${shareText(v)} shares`),
        isNum(sh) ? (sh < 0 ? "up" : sh > 0 ? "dn" : "n") : "n",
      ),
      c.priceOff
        ? kpi("Price to earnings", esc(NA_TEXT), `needs a price in ${c.currency}`, "n")
        : kpi("Price to earnings", `<span data-dd="pe">${esc(c.pt.pe)}</span>`, "at your price", "n"),
    ].join("")
  }</div>`;
}

function heroThesis(c: Ctx): string {
  const { d, short: S } = c;
  const om = last(d.opMargin), g = d.growth.revenueCagrAll, sh = d.sharesChange1y;
  const bits: string[] = [];
  if (isNum(om)) {
    bits.push(
      om > 0
        ? `${S} keeps ${p(om)} of its sales as operating profit.`
        : `${S} runs at an operating loss of ${pa(om)} of sales.`,
    );
  }
  if (isNum(g) && d.years.length > 1) {
    bits.push(
      `Sales ${g >= 0 ? "grew" : "shrank"} ${pa(g)} a year since ${fyT(d.first.fiscal_year)}${
        isNum(sh)
          ? Math.abs(sh) < 0.05
            ? `, and the share count was unchanged in ${c.L}`
            : `, and the share count ${sh < 0 ? "fell" : "rose"} ${pa(sh)} in ${c.L}`
          : ""
      }.`,
    );
  }
  const nc = netCashSentence(c);
  if (bits.length < 2 && nc) bits.push(nc);
  return bits.join(" ") ||
    `${S}'s filings on record are thin, so most of this report shows what is not seen yet.`;
}

function evidenceCount(f: ReportFacts): number {
  let n = 0;
  for (const row of f.annual) {
    for (const [k, v] of Object.entries(row)) {
      if (k !== "fiscal_year" && typeof v === "number" && Number.isFinite(v)) n++;
    }
  }
  return n;
}

/** The price box for a report not in dollars: no input, the model range (no price line) and the honest note. */
function offBox(c: Ctx): string {
  return `<div class="pricebox noprice-state"><div class="row"><span class="noprice">Price comparisons are off for this report.</span></div>` +
    (c.d.dcf
      ? `<div class="rangewrap">${pair((w) => modelRange(c, w, true))}</div>`
      : `<div class="small-note">No model range: it needs three straight years of positive free cash flow, cash, debt and a share count.</div>`) +
    `<div class="small-note">${esc(priceOffNote(c))}</div></div>`;
}

function hero(c: Ctx): string {
  const { f } = c;
  const meta = [
    `<b>${esc(f.ticker || "n/a")}</b>`,
    f.exchange ? esc(f.exchange) : "",
    f.industry ? esc(f.industry) : "",
    monthOf(f.fiscalYearEnd) ? `Fiscal year ends in ${esc(monthOf(f.fiscalYearEnd))}` : "",
    // SPEC section 2 names the city; the fact pack does not carry it yet.
    "City not disclosed",
  ].filter(Boolean).join(" · ");
  const t = tightest(c.d);
  const pills = [
    t
      ? `<span class="pill"><span class="dot"></span>${t.passes === false ? "Tripped" : "Watch"}: ${
        esc(t.label.toLowerCase())
      }</span>`
      : "",
    `<span class="pill">Evidence: ${evidenceCount(f)} figures from ${f.annual.length} annual reports</span>`,
    f.mode === "legacy" ? `<span class="pill">Older report format: fewer charts</span>` : "",
  ].filter(Boolean).join("");
  const has = c.price !== null;
  const hid = (when: "price" | "noprice") => ((when === "price") === has ? "" : " hidden");
  const note = has
    ? `Opens at the ${
      usd(c.price)
    } close on ${c.priceDate}. Type another price and the range, the ratios and the growth the price assumes update. Nothing you type is stored.`
    : "No closing price at the filing date is stored, because that needs a licensed price feed (phase 3). Type the price you see at your broker and the range, the ratios and the growth the price assumes update. Nothing you type is stored.";
  const value = has ? (c.price as number).toFixed(2) : "";
  const head = `<header class="hero"><div class="wrap"><div><div class="eyebrow">Deep Dive · ${
    esc(filingEyebrow(f, c))
  }</div><h1>${
    esc(f.name)
  }</h1><div class="meta">${meta}</div></div><div class="stance">${pills}</div><p class="thesis">${
    esc(heroThesis(c))
  }</p>`;
  const tail = kpis(c) +
    `<div class="readmode" role="group" aria-label="Reading mode"><span>Read as</span><button type="button" data-dd-mode="story" aria-pressed="true">Full story</button><button type="button" data-dd-mode="charts" aria-pressed="false">Charts only</button></div>` +
    `</div></header>`;
  if (c.priceOff) return head + offBox(c) + tail;
  return head +
    `<div class="pricebox${
      has ? "" : " noprice-state"
    }"><div class="row"><label for="dd-price">Price</label><span class="priceinput priceinput-edit"><span>$</span><input id="dd-price" data-dd="price" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" placeholder="Price" value="${
      esc(value)
    }" aria-describedby="dd-price-note"></span><span class="updown ${c.pt.gapClass}" data-dd="gap" data-dd-when="price"${
      hid("price")
    }>${esc(c.pt.gap)}</span><span class="noprice" data-dd-when="noprice"${hid("noprice")}>${
      c.d.dcf
        ? "Type a price to compare it with the model range."
        : "Type a price to see the price to earnings."
    }</span></div>` +
    (c.d.dcf
      ? `<div class="rangewrap">${pair((w) => modelRange(c, w, true))}</div>`
      : `<div class="small-note">No model range: it needs three straight years of positive free cash flow, cash, debt and a share count.</div>`) +
    `<div class="small-note" id="dd-price-note">${esc(note)}</div></div>` +
    tail;
}

export interface RenderResult {
  html: string;
  chapters: Chapter[];
  /** Chart references that did not resolve (should be empty). */
  problems: string[];
}

/** Full render with diagnostics (used by tests and previews). Money is formatted in the report currency. */
export function renderDeepDiveV2(report: AnalysisReport, opts: RenderOptions): RenderResult {
  const c = buildContext(report);
  return withCurrency(c.currency, () => renderWith(c, opts));
}

function renderWith(c: Ctx, opts: RenderOptions): RenderResult {
  const { f } = c;
  const chapters = buildChapters(c);
  const nums = new Map<string, number>();
  let n = 0;
  for (const ch of chapters) for (const cd of ch.cards) if (cd.title) nums.set(cd.id, ++n);
  const problems: string[] = [];
  const main = chapters.map((ch, i) => chapterHtml(ch, i, nums, problems)).join("");
  const chips = chapters.map((ch) => `<a href="#${esc(ch.id)}">${esc(ch.chip)}</a>`).join("");
  const asOf = dateText(asOfDate(f));
  const data = JSON.stringify(c.data).replace(/</g, "\\u003c");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
    `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
    `<meta name="robots" content="noindex, nofollow" /><meta name="color-scheme" content="light dark" />` +
    `<title>${esc(f.name)} Deep Dive</title><style>${FONT_CSS}\n${PAGE_CSS}</style></head><body>` +
    `<div class="appbar"><div class="wrap"><span class="brand">Thesis</span><span class="tk">${
      esc(f.ticker)
    }</span>${
      f.sample
        ? `<span class="sample-pill"><span class="l">Sample report · approximate figures</span><span class="s">Sample data</span></span>`
        : ""
    }<span class="spacer"></span><button class="iconbtn" type="button" data-dd-theme aria-label="Switch light or dark"><span class="l">Theme: </span>Auto</button></div></div>` +
    hero(c) +
    `<nav class="chipnav" aria-label="Report sections"><div class="wrap">${chips}</div></nav>` +
    `<main><div class="wrap">${main}</div></main>` +
    `<footer><div class="wrap"><p><b>${
      f.sample ? "Sample report." : `As of ${esc(asOf || "the filing date")}.`
    }</b> Figures from SEC filings, frozen at the filing date. Nothing on this page is updated later.</p><p class="notice">${
      esc(NOT_ADVICE_TEXT)
    }</p><p><a href="${esc(opts.downloadUrl)}">Get the Thesis app</a></p></div></footer>` +
    `<script type="application/json" id="dd-data">${data}</script>` +
    `<script>${CLIENT_JS}</script></body></html>`;
  return { html, chapters, problems };
}

/** The Deep Dive 2.0 share page for a stored report (fact pack or legacy). */
export function buildDeepDiveV2Html(report: AnalysisReport, opts: RenderOptions): string {
  return renderDeepDiveV2(report, opts).html;
}
