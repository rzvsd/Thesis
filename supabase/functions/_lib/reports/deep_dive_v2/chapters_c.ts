// Deep Dive 2.0 chapters 11 to 13: Events, Bottom line, Sources. Pure TS (no Deno APIs).

import { esc, fmt } from "./format.ts";
import type { FilingRef } from "./fact_pack.ts";
import { asOfDate } from "./adapter.ts";
import { DCF_FADE, DCF_GROWTH_MAX, DCF_GROWTH_MIN, DCF_SPREAD } from "./dcf.ts";
import {
  bigQuestionInfo,
  type Card,
  type Chapter,
  checkCounts,
  checkLabel,
  checkLine,
  checkNow,
  type Ctx,
  dateText,
  fyT,
  isNum,
  last,
  listText,
  m,
  moved,
  p,
  pa,
  type Para,
  payoutText,
  prev,
  pts,
  ratioRows,
  ref,
  tightest,
  usd,
  word,
} from "./story.ts";
import type { Check } from "./derive.ts";

// ---------------------------------------------------------------- 11 Events

const ITEMS: Record<string, string> = {
  "1.01": "Material agreement",
  "1.02": "Agreement ended",
  "1.03": "Bankruptcy",
  "1.05": "Cybersecurity incident",
  "2.01": "Acquisition or sale completed",
  "2.02": "Results",
  "2.03": "New debt",
  "2.04": "Debt terms triggered",
  "2.05": "Restructuring or disposal costs",
  "2.06": "Impairment",
  "3.01": "Listing notice",
  "3.02": "Unregistered share sale",
  "3.03": "Change to shareholder rights",
  "4.01": "Auditor change",
  "4.02": "Earlier results no longer reliable",
  "5.01": "Change in control",
  "5.02": "Director or officer change",
  "5.03": "Bylaw or fiscal year change",
  "5.07": "Shareholder votes",
  "7.01": "Regulation FD disclosure",
  "8.01": "Other events",
  "9.01": "Exhibits",
};

const FORMS: Record<string, string> = {
  "10-K": "Annual report",
  "10-K/A": "Annual report, amended",
  "10-Q": "Quarterly report",
  "10-Q/A": "Quarterly report, amended",
  "20-F": "Annual report (foreign filer)",
  "40-F": "Annual report (Canadian filer)",
  "6-K": "Foreign filer report",
  "DEF 14A": "Proxy statement",
};

function itemCodes(f: FilingRef): string[] {
  const raw = typeof f.items === "string" ? f.items : "";
  return raw.split(/[,\s]+/).map((s) => s.trim()).filter((s) => /^\d\.\d\d$/.test(s));
}

function eventTitle(f: FilingRef): string {
  if (/^8-K/.test(f.form)) {
    const main = itemCodes(f).filter((x) => x !== "9.01");
    return main.length ? listText(main.map((x) => ITEMS[x] ?? `Item ${x}`)) : "Current report";
  }
  return FORMS[f.form] ?? `${f.form} filing`;
}

function eventNote(f: FilingRef): string {
  const codes = itemCodes(f);
  if (codes.length) return `Items ${codes.join(", ")}.`;
  return f.period_end ? `For the period to ${dateText(f.period_end)}.` : "";
}

export function events(c: Ctx): Chapter {
  const { f, short: S } = c;
  const asOfIso = asOfDate(f);
  const asOf = dateText(asOfIso);
  // Rule 2: only filings in the 12 months to the as-of date, newest first.
  const from = asOfIso && /^\d{4}-\d{2}-\d{2}/.test(asOfIso)
    ? `${Number(asOfIso.slice(0, 4)) - 1}${asOfIso.slice(4, 10)}`
    : null;
  const inYear = f.filings
    .filter((x) => !from || !asOfIso || (x.filing_date <= asOfIso.slice(0, 10) && x.filing_date > from))
    .sort((a, b) => b.filing_date.localeCompare(a.filing_date));
  const list = inYear.slice(0, 24);
  const eightK = list.filter((x) => /^8-K/.test(x.form));
  const results = eightK.filter((x) => itemCodes(x).includes("2.02")).length;
  const periodic = list.filter((x) => /^(10-K|10-Q|20-F|40-F)/.test(x.form)).length;
  const tl = list.length
    ? `<div class="tl">${
      list.map((x) => {
        const tag = /^8-K/.test(x.form) && itemCodes(x).length
          ? `${x.form} ${itemCodes(x).filter((y) => y !== "9.01").join(", ") || "9.01"}`
          : x.form;
        return `<div class="e"><div class="d">${
          esc(dateText(x.filing_date) || "Date not disclosed")
        }</div><div class="t">${esc(eventTitle(x))} <span class="tag">${esc(tag)}</span></div>${
          eventNote(x) ? `<div class="x">${esc(eventNote(x))}</div>` : ""
        }</div>`;
      }).join("")
    }</div>`
    : `<div class="nodata">Not disclosed</div>`;
  const legacy = f.mode === "legacy";
  const lf = f.latestFiling;
  const verdict: Para = legacy
    ? {
      lead: "Only the latest filing is on record for this report.",
      body: lf
        ? `It reads the ${lf.form}${
          lf.fiscalYear
            ? ` for ${lf.fiscalPeriod && lf.fiscalPeriod !== "FY" ? `${lf.fiscalPeriod} ` : ""}${
              fyT(lf.fiscalYear)
            }`
            : ""
        }. The full list of filings, with 8-K item codes, comes with the fact pack.`
        : "The full list of filings, with 8-K item codes, comes with the fact pack.",
    }
    : {
      lead: `${inYear.length === 1 ? "One filing" : `${inYear.length} filings`} in the 12 months to ${
        asOf || "the filing date"
      }${inYear.length > list.length ? `, the latest ${list.length} shown` : ""}.`,
      body: `${
        periodic === 1
          ? "One periodic report"
          : `${word(periodic).replace(/^./, (x) => x.toUpperCase())} periodic reports`
      } and ${
        eightK.length === 1 ? "one current report (8-K)" : `${word(eightK.length)} current reports (8-K)`
      }${
        results ? `, ${results === 1 ? "one of them" : `${word(results)} of them`} a results release` : ""
      }.`,
    };
  const counts: string[] = [];
  const byForm = new Map<string, number>();
  for (const x of list) byForm.set(x.form, (byForm.get(x.form) ?? 0) + 1);
  for (const [form, n] of byForm) counts.push(`${word(n)} ${form}${n > 1 ? "s" : ""}`);
  const special = [...new Set(eightK.flatMap(itemCodes).filter((x) => x !== "2.02" && x !== "9.01"))];
  const story: Para[] = [{
    lead: legacy ? "The timeline needs the filing list." : "The year in filings, newest first.",
    body: legacy
      ? `This report was made before the fact pack existed, so it stores only the filing it read (${
        ref("ev-list")
      }). A new report for ${S} lists every filing in the 12 months to its filing date.`
      : `${S} filed ${listText(counts)} (${ref("ev-list")}).${
        results ? ` Item 2.02 is the code for results releases.` : ""
      }${
        special.length
          ? ` Other 8-K items in the year: ${
            listText(special.map((x) => `${x} (${(ITEMS[x] ?? "other").toLowerCase()})`))
          }.`
          : " No 8-K in the year reported a deal, a new debt issue or a change of officers."
      } The list ends at the filing date, like the rest of the report.`,
  }];
  if (!legacy) {
    const tenQ = list.filter((x) => /^10-Q/.test(x.form)).map((x) => x.filing_date).sort();
    const tenK = list.filter((x) => /^(10-K|20-F|40-F)/.test(x.form)).map((x) => x.filing_date).sort();
    const other = eightK.filter((x) => !itemCodes(x).includes("2.02")).length;
    const bits: string[] = [];
    if (tenK.length && tenQ.length) {
      const k = tenK[tenK.length - 1], q = tenQ.filter((x) => x < k).pop();
      if (q) {
        const days = Math.round((Date.parse(k) - Date.parse(q)) / 86400000);
        if (Number.isFinite(days)) {
          bits.push(`The annual report came ${days} days after the last quarterly report before it.`);
        }
      }
    }
    bits.push(
      other === 0
        ? "Every 8-K in the year was a results release or its exhibits."
        : `${
          other === 1 ? "One 8-K" : `${word(other).replace(/^./, (x) => x.toUpperCase())} 8-Ks`
        } in the year ${other === 1 ? "was" : "were"} about something other than results.`,
    );
    story.push({ lead: "The rhythm of the year.", body: bits.join(" ") });
  } else {
    story.push({
      lead: "What a full list would add.",
      body:
        "Each 8-K carries item codes that say what it is about: results, a deal, new debt, a change of officers. A report made from the fact pack shows them in order.",
    });
  }
  return {
    id: "events",
    chip: "Events",
    phases: [2],
    src: "SEC EDGAR filing index and 8-K item codes",
    h2: "What happened, in order",
    verdict,
    story,
    cards: [{
      id: "ev-list",
      title: legacy ? "The filing this report reads" : "Filings in the year, newest first",
      sub: "Form and 8-K item codes from SEC EDGAR",
      html: tl,
      src: "SEC EDGAR",
    }],
    upshot:
      "The next periodic filing starts a new report. This one stays as it is, frozen at its filing date.",
  };
}

// ---------------------------------------------------------------- 12 Bottom line

/** "rose 6.4%" / "fell 12.0%" / "was flat". */
const mv = (v: number): string => `${moved(v)}${Math.abs(v) >= 0.05 ? ` ${pa(v)}` : ""}`;

/** The answer to the big question, from the same data the question was built from. */
function answer(c: Ctx, kind: ReturnType<typeof bigQuestionInfo>["kind"]): {
  yes: boolean | null;
  lead: string;
  detail: string;
} {
  const { d, short: S, L } = c;
  const g = d.growth;
  const r = g.revenueYoY;
  const unknown = {
    yes: null,
    lead: `Not yet known: ${L} cannot be compared with the year before.`,
    detail: "",
  };
  if (kind === "loss") {
    const ni = last(d.netIncome) as number, fcf = last(d.fcf), cash = last(d.cash);
    let detail = "";
    if (isNum(fcf) && fcf < 0 && isNum(cash) && cash > 0) {
      detail = `At the ${L} free cash flow of ${m(fcf)}, its ${m(cash)} of cash would last about ${
        (cash / -fcf).toFixed(1)
      } years.`;
    } else if (isNum(fcf) && fcf >= 0) {
      detail = `Free cash flow was ${m(fcf)}, so the cash is not running down.`;
    }
    return {
      yes: false,
      lead: ni < 0 ? `Not yet: ${S} lost ${m(-ni)} in ${L}.` : `Not yet: ${S} broke even in ${L}.`,
      detail,
    };
  }
  if (kind === "shrink") {
    if (!isNum(r)) return unknown;
    const omc = d.marginChange1y.op;
    const detail = isNum(omc)
      ? `Operating margin ${moved(omc, "rose", "fell", "held level")}${
        Math.abs(omc) >= 0.05 ? ` by ${pts(omc)}` : ""
      }.`
      : "";
    return r < 0
      ? { yes: false, lead: `Not in ${L}: sales fell ${pa(r)}.`, detail }
      : { yes: true, lead: `Yes in ${L}: sales grew ${pa(r)}.`, detail };
  }
  if (kind === "eps_vs_sales") {
    const e = g.epsYoY;
    if (!isNum(e) || !isNum(r)) return unknown;
    return e > r
      ? {
        yes: true,
        lead: `Yes in ${L}: earnings per share ${mv(e)}, faster than sales, which ${mv(r)}.`,
        detail: "",
      }
      : { yes: false, lead: `Not in ${L}: earnings per share ${mv(e)} while sales ${mv(r)}.`, detail: "" };
  }
  if (kind === "dilution") {
    const n = g.netIncomeYoY, sh = d.sharesChange1y;
    if (!isNum(n) || !isNum(sh)) return unknown;
    return n > sh
      ? {
        yes: true,
        lead: `Yes in ${L}: net profit ${mv(n)}, more than the ${p(sh)} rise in shares.`,
        detail: "",
      }
      : {
        yes: false,
        lead: `Not in ${L}: net profit ${mv(n)}, against a ${p(sh)} rise in shares.`,
        detail: "",
      };
  }
  if (kind === "pace") {
    const pace = g.revenueCagr5 ?? g.revenueCagrAll;
    const omc = d.marginChange1y.op;
    if (!isNum(r) || !isNum(pace)) return unknown;
    const marginText = isNum(omc)
      ? ` Operating margin ${moved(omc, "rose", "fell", "held level")}${
        Math.abs(omc) >= 0.05 ? ` by ${pts(omc)}` : ""
      }.`
      : "";
    if (r >= pace - 2 && (!isNum(omc) || omc > -3)) {
      return {
        yes: true,
        lead: `Yes in ${L}: sales ${mv(r)}, against a pace of ${p(pace)} a year.`,
        detail: marginText.trim(),
      };
    }
    return {
      yes: false,
      lead: r < pace - 2
        ? `Not in ${L}: sales ${mv(r)}, below the pace of ${p(pace)} a year.`
        : `Not in ${L}: sales kept pace, but operating margin fell ${pts(omc)}.`,
      detail: r < pace - 2 ? marginText.trim() : "",
    };
  }
  const n = g.netIncomeYoY;
  if (!isNum(r) || !isNum(n)) return unknown;
  return r > 0 && n > 0
    ? { yes: true, lead: `Yes in ${L}: sales ${mv(r)} and net profit ${mv(n)}.`, detail: "" }
    : { yes: false, lead: `Not in ${L}: sales ${mv(r)} and net profit ${mv(n)}.`, detail: "" };
}

/** "Of the four tests in the Risks chapter, three pass and one is tripped." */
function testsSentence(c: Ctx): string {
  const cn = checkCounts(c.d);
  if (cn.pass === 4) return `All four tests in the Risks chapter pass on ${c.L} numbers.`;
  if (cn.none === 4) {
    return "None of the four tests in the Risks chapter can be checked from these filings yet.";
  }
  const parts = [
    cn.pass ? `${word(cn.pass)} ${cn.pass === 1 ? "passes" : "pass"}` : "",
    cn.bad ? `${word(cn.bad)} ${cn.bad === 1 ? "is" : "are"} tripped` : "",
    cn.none ? `${word(cn.none)} cannot be checked from these filings` : "",
  ].filter(Boolean);
  return `Of the four tests in the Risks chapter, ${listText(parts)}.`;
}

/** "a lower tax rate", "higher sales". */
const withArticle = (label: string): string => (/(margin|rate)$/.test(label) ? `a ${label}` : label);

/** How a check reads when it has failed: "Sales growth falls below 4.7%". */
function failText(k: Check): string {
  return k.label.replace(/stays above/, "falls below").replace(
    /rises less than 1% a year/,
    "rises 1% or more a year",
  )
    .replace(/stays near its past level/, "falls well below its past level");
}

export function bottom(c: Ctx): Chapter {
  const { d, short: S, L } = c;
  const cn = checkCounts(d);
  const q = bigQuestionInfo(c);
  const a = answer(c, q.kind);
  const t = tightest(d);
  const story: Para[] = [];
  const bits: string[] = [];
  if (a.detail) bits.push(a.detail);
  const br = d.epsBridge;
  if (br) {
    const big = [...br.steps].sort((x, y) => Math.abs(y.value) - Math.abs(x.value))[0];
    bits.push(
      `Earnings per share went from ${usd(br.from)} to ${usd(br.to)}${
        big
          ? `, and the largest part of the change came from ${withArticle(big.label.toLowerCase())}, at ${
            fmt(big.value, "usd_ps", { sign: true })
          }`
          : ""
      }.`,
    );
  } else if (isNum(last(d.eps)) && isNum(prev(d, d.eps))) {
    bits.push(`Earnings per share went from ${usd(prev(d, d.eps))} to ${usd(last(d.eps))}.`);
  }
  if (isNum(d.growth.revenueYoY) && q.kind !== "eps_vs_sales" && q.kind !== "shrink" && q.kind !== "pace") {
    bits.push(`Sales ${d.growth.revenueYoY >= 0 ? "grew" : "shrank"} ${pa(d.growth.revenueYoY)} in ${L}.`);
  }
  if (isNum(d.sharesChange1y)) {
    bits.push(
      Math.abs(d.sharesChange1y) < 0.05
        ? "The share count was unchanged."
        : `The share count ${d.sharesChange1y < 0 ? "fell" : "rose"} ${pa(d.sharesChange1y)}.`,
    );
  }
  story.push({
    lead: a.yes === true
      ? "The first answer is yes, and the latest year shows how."
      : a.yes === false
      ? `The first answer is no, on ${L} numbers.`
      : "The first answer cannot be given yet.",
    body: bits.join(" ") || "The filings on record are too thin to say more.",
  });
  const cr = d.cashReturn5, nc = last(d.netCash), ncp = prev(d, d.netCash), fcf = last(d.fcf);
  const cost: string[] = [];
  if (isNum(fcf) && fcf <= 0) {
    cost.push(`Free cash flow was ${m(fcf)} in ${L}, so the business used cash rather than made it.`);
  } else if (isNum(cr.ratio) && isNum(cr.fcf)) {
    cost.push(
      `Over five years ${S} made ${m(cr.fcf)} of free cash flow and paid owners ${payoutText(cr.ratio)}.`,
    );
    if (cr.ratio > 1.02) cost.push("That cannot go on for ever without new cash coming in.");
  }
  if (isNum(nc) && isNum(ncp)) {
    cost.push(
      `${nc >= 0 ? "Net cash" : "Net debt"} ended ${L} at ${m(Math.abs(nc))}, against ${
        ncp >= 0 ? "net cash" : "net debt"
      } of ${m(Math.abs(ncp))} a year earlier.`,
    );
  }
  story.push({
    lead: "Second, the cost of keeping it going.",
    body: cost.join(" ") ||
      "Cash returns and the balance sheet are not fully on record, so the cost cannot be measured yet.",
  });
  story.push({
    lead: "If the story fails, it will show first in four places.",
    body: `Each test below has a fixed line and its ${L} reading (${ref("wrong")}). ${
      t
        ? t.passes === false
          ? `The test that ${checkLabel(t)} is already past its line: ${checkNow(t)} against ${checkLine(t)}.`
          : `The closest to its line is the test that ${checkLabel(t)}, at ${checkNow(t)} against ${
            checkLine(t)
          }.`
        : ""
    }`.trim(),
  });
  const wrong = `<div class="wrong">${
    d.checks.map((k, i) =>
      `<div><i>${i + 1}</i><span><b>${esc(failText(k))}.</b> ${
        esc(k.current === null ? k.why : `${k.why} In ${L} it reads ${checkNow(k)}.`)
      }</span></div>`
    ).join("")
  }</div>`;
  const tripped = d.checks.filter((k) => k.passes === false);
  const passing = d.checks.filter((k) => k.passes === true);
  const pick = [t, ...passing.filter((k) => k !== t)].filter((k): k is Check => !!k && k.passes === true)
    .slice(0, 2);
  let upshot: string;
  if (tripped.length) {
    upshot = `The answer changes only when the tripped ${
      tripped.length === 1 ? "test is back inside its line" : "tests are back inside their lines"
    }: ${listText(tripped.map(checkLabel))}. In ${L} ${tripped.length === 1 ? "it read" : "they read"} ${
      listText(tripped.map((k) => `${checkNow(k)} against ${checkLine(k)}`))
    }.`;
  } else if (pick.length) {
    upshot = `The ${pick.length === 1 ? "test" : "tests"} to watch next: ${
      listText(pick.map(checkLabel))
    }. In ${L} ${pick.length === 1 ? "that read" : "those read"} ${listText(pick.map((k) => checkNow(k)))}.`;
  } else upshot = "The answer can be checked once the filings tag the four tests' inputs.";
  return {
    id: "bottom",
    chip: "Bottom line",
    phases: [1],
    src: "Draws on every chapter above",
    h2: "The bottom line",
    verdict: {
      lead: a.lead,
      body: `${testsSentence(c)}${
        cn.pass + cn.bad ? ` They are repeated below with their ${L} readings.` : ""
      }`,
    },
    intro: `<div class="bigq"><span class="k">The big question</span><p>${esc(q.text)}</p></div>`,
    story,
    cards: [{
      id: "wrong",
      title: "What would prove this story wrong",
      sub: `The four kill switches, with the ${L} reading`,
      span2: true,
      html: wrong,
    }],
    upshot,
  };
}

// ---------------------------------------------------------------- 13 Sources

const MISSING_NAMES: Record<string, string> = {
  segments: "Sales by product or segment (phase 2)",
  regions: "Sales by region (phase 2)",
  customers: "Customers and suppliers (phase 2)",
  owners: "Owners and insider trades (phase 2)",
  filings: "Filing list with 8-K items (comes with the fact pack)",
  price_at_filing: "Closing price on the filing date (phase 3, needs a licensed feed)",
};

const FIELD_NAMES: Array<[string, string]> = [
  ["revenue", "sales"],
  ["gross_profit", "gross profit"],
  ["operating_income", "operating income"],
  ["pretax_income", "pretax income"],
  ["income_tax", "income tax"],
  ["net_income", "net income"],
  ["eps_diluted", "diluted EPS"],
  ["operating_cash_flow", "operating cash flow"],
  ["capex", "capital spending"],
  ["free_cash_flow", "free cash flow"],
  ["buybacks", "buybacks"],
  ["dividends", "dividends"],
  ["cash", "cash"],
  ["short_term_investments", "short-term investments"],
  ["debt_total", "debt"],
  ["shares_outstanding", "shares outstanding"],
  ["shares_diluted", "diluted shares"],
];

export function sources(c: Ctx): Chapter {
  const { f, d, L } = c;
  const latest = d.latest as unknown as Record<string, unknown>;
  const filled = FIELD_NAMES.filter(([k]) => isNum(latest[k]));
  const gaps = FIELD_NAMES.filter(([k]) => !isNum(latest[k])).map(([, n]) => n);
  const SEC = "Public domain (US government)";
  const rows: string[][] = [
    ...f.sources.map((s) => [s.name, s.url || "n/a", SEC, "Free", "Phase 1", "In this report"]),
    ...(f.mode === "legacy"
      ? [[
        "Financial history stored with this report",
        "n/a",
        SEC,
        "Free",
        "Phase 1",
        `${d.years.length} fiscal years`,
      ]]
      : []),
    [
      "SEC XBRL company facts",
      "https://data.sec.gov/api/xbrl/companyfacts/",
      SEC,
      "Free",
      "Phase 1",
      f.mode === "fact_pack" ? `${d.years.length} fiscal years` : "Not seen yet",
    ],
    [
      "SEC EDGAR filing index",
      "https://www.sec.gov/cgi-bin/browse-edgar",
      SEC,
      "Free",
      "Phase 1",
      f.mode === "fact_pack" ? `${f.filings.length} filings` : "Latest filing only",
    ],
    ["XBRL segment and region notes", "SEC filings", SEC, "Free", "Phase 2", "Not seen yet"],
    ["13F, Forms 3/4/5, proxy", "SEC filings", SEC, "Free", "Phase 2", "Not seen yet"],
    [
      "World Bank outlooks",
      "worldbank.org",
      "CC BY 4.0 (credit the World Bank)",
      "Free",
      "Phase 2",
      "Not seen yet",
    ],
    ["GLEIF legal entity register", "gleif.org", "CC0", "Free", "Phase 2", "Not seen yet"],
    [
      "Daily prices",
      "Licensed feed, not chosen",
      "Commercial licence, not chosen",
      "Paid",
      "Phase 3",
      c.price !== null ? "Price at filing" : "Not seen yet",
    ],
  ];
  const seen = new Set<string>();
  const srcRows = rows.filter((r) => (seen.has(r[0]) ? false : (seen.add(r[0]), true)));
  const head = ["Source", "Where", "Licence", "Cost", "Phase", "Coverage"];
  const srcTable = `<div class="tbl stack srcs"><table><thead><tr>${
    head.map((h) => `<th scope="col">${esc(h)}</th>`).join("")
  }</tr></thead><tbody>${
    srcRows.map((r) =>
      `<tr>${r.map((v, j) => `<td${j ? ` data-l="${esc(head[j])}"` : ""}>${esc(v)}</td>`).join("")}</tr>`
    ).join("")
  }</tbody></table></div>`;
  const missing = [...new Set(f.missing)].map((k) => MISSING_NAMES[k] ?? k.replace(/_/g, " "));
  const coverage = `<p class="note">${
    esc(`${filled.length} of ${FIELD_NAMES.length} annual fields are filled for ${L}.`)
  }${gaps.length ? ` ${esc(`Not disclosed for ${L}: ${listText(gaps)}.`)}` : ""}</p>${
    missing.length ? `<ul class="note">${missing.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""
  }${
    ratioRows([
      [
        "Filing date (as of)",
        esc(
          dateText(f.latestFiling?.filingDate ?? f.annual[f.annual.length - 1]?.filing_date) ||
            "Not disclosed",
        ),
      ],
      ["Data retrieved", esc(dateText(f.retrievedAt) || "Not disclosed")],
      ["Report generated", esc(dateText(f.generatedAt) || "Not disclosed")],
    ])
  }`;
  const concepts = new Map<string, string>();
  for (const row of [...f.annual].reverse()) {
    for (const [k, v] of Object.entries(row.concepts ?? {})) {
      if (!concepts.has(k) && typeof v === "string") concepts.set(k, v);
    }
  }
  const conceptHtml = concepts.size
    ? `<div class="tbl stack wrapcells"><table><thead><tr><th scope="col">Field</th><th scope="col">XBRL tag</th></tr></thead><tbody>${
      [...concepts].map(([k, v]) =>
        `<tr><td>${
          esc(FIELD_NAMES.find(([x]) => x === k)?.[1] ?? k.replace(/_/g, " "))
        }</td><td data-l="XBRL tag">${esc(v)}</td></tr>`
      ).join("")
    }</tbody></table></div>`
    : `<p class="note">${
      esc(
        f.mode === "legacy"
          ? "This report was made before tags were stored with each figure."
          : "The fact pack did not record the tags for these figures.",
      )
    }</p>`;
  const dcf = d.dcf;
  const method = `<p class="note">${
    esc(
      `Cash-flow model: base free cash flow is the average of the last three years and needs all three to be positive. Growth for years 1 to ${DCF_FADE} is the scenario rate, then it slows in a straight line to the long-run rate by year ${
        dcf?.years ?? 10
      }. Long-run growth ${p(dcf?.terminal ?? 2.5)}, discount rate ${
        p(dcf?.wacc ?? 9.5)
      }. Value is the discounted cash plus the discounted value after the last year, plus net cash, divided by the latest share count. Base growth is the 5-year free cash flow growth rate, else sales growth, kept between ${
        p(DCF_GROWTH_MIN, 0)
      } and ${p(DCF_GROWTH_MAX, 0)}. Bear and bull cases are ${DCF_SPREAD} points below and above.`,
    )
  }</p><p class="note">${
    esc(
      `Scorecard bands are absolute, not ranks: profitability from operating margin (0% scores 0, 35% scores 10), growth from sales growth a year over the years on record (${
        p(-5, 0)
      } scores 0, 15% scores 10), financial health from net cash against free cash flow (net debt of four years of free cash flow scores 0, net cash scores 10), cash returned from five years of buybacks and dividends against free cash flow (0% scores 0, 100% scores 10).`,
    )
  }</p>`;
  const cards: Card[] = [
    {
      id: "src-table",
      title: "Where the data comes from",
      sub: "Source, licence, cost, phase and what this report covers",
      span2: true,
      html: srcTable,
    },
    {
      id: "src-coverage",
      title: "What this report could not fill",
      sub: "Gaps are shown as Not disclosed or Not seen yet, never estimated",
      html: coverage,
    },
    {
      id: "src-tags",
      title: "Tags behind the numbers",
      sub: "XBRL concept for each field, latest year that reports it",
      html: conceptHtml,
    },
    {
      id: "src-method",
      title: "How the model and the scores work",
      sub: "The same rules for every company",
      html: method,
    },
  ];
  return {
    id: "sources",
    chip: "Sources",
    phases: [1],
    src: "Every number keeps its source and date",
    h2: "Sources and coverage",
    verdict: {
      lead:
        "Every number in this report comes from SEC filings or is calculated from them by the rules below.",
      body: "",
    },
    story: [],
    cards,
    upshot: null,
  };
}
