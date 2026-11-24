// Deep Dive 2.0 chapter 06, Financials: the seven SPEC cards. Sales and net profit (its table holds every figure),
// the EPS bridge, margins, free cash flow against profit, buybacks and dividends, shares, cash against debt.
// Built only from Derived values. Pure TS (no Deno APIs).

import { fmt, moneyUnit } from "./format.ts";
import { columns, lines, NODATA, type Series } from "./charts.ts";
import { waterfall } from "./charts_more.ts";
import { returnsCard } from "./chapters_a.ts";
import {
  type Card,
  cashName,
  type Chapter,
  chg,
  type Ctx,
  extremes,
  fallYears,
  fyT,
  isNum,
  last,
  listText,
  m,
  moved,
  p,
  pa,
  pair,
  type Para,
  prev,
  ref,
  shareSeries,
  shareText,
  span,
  splitNote,
  tbl,
  usd,
} from "./story.ts";

type Num = number | null;
const col = (a: Num[]) => a.map((v) => (isNum(v) ? v : null));
const money = (v: Num) => fmt(v, "usd");

function rowsNewestFirst(c: Ctx, cols: Array<(i: number) => string>): string[][] {
  return c.d.years.map((_, i) => [c.d.labels[i], ...cols.map((f) => f(i))]).reverse();
}

/** The full numbers table, behind "Show table" on the sales and net profit card. */
function fullTable(c: Ctx): string {
  const { d } = c;
  const head = [
    "Year",
    "Sales",
    "Gross margin",
    "Operating margin",
    "Net profit",
    "EPS",
    "Free cash flow",
    "Shares",
    "Cash",
    "Debt",
  ];
  const rows = rowsNewestFirst(c, [
    (i) => money(d.revenue[i]),
    (i) => p(d.grossMargin[i]),
    (i) => p(d.opMargin[i]),
    (i) => money(d.netIncome[i]),
    (i) => fmt(d.eps[i], "usd_ps"),
    (i) => money(d.fcf[i]),
    (i) => shareSeries(d.shares).text(d.shares[i]),
    (i) => money(d.cash[i]),
    (i) => money(d.debt[i]),
  ]);
  return tbl(
    "All figures by fiscal year, newest first. n/a = not disclosed.",
    head,
    rows.map((r) => r.map((v) => (v === "Not disclosed" ? "n/a" : v))),
  );
}

function profitClause(nif: Num, nil: Num): string {
  if (!isNum(nil)) return "net profit not disclosed";
  if (nil <= 0) return "with a net loss in the latest year";
  if (!isNum(nif) || nif <= 0) return `net profit ${m(nil)} in the latest year`;
  const r = nil / nif;
  return r >= 2
    ? `net profit ${r >= 3 ? "more than tripled" : "more than doubled"}`
    : `net profit ${nil >= nif ? "up" : "down"} ${pa(chg(nif, nil), 0)}`;
}

export function financials(c: Ctx): Chapter {
  const { d, short: S, L } = c;
  const sp = span(d.revenue);
  const n = d.years.length;
  const F = sp ? fyT(d.years[sp.i]) : L;
  const r0 = sp ? d.revenue[sp.i] : null, r1 = sp ? d.revenue[sp.j] : null;
  const ni0 = sp ? d.netIncome[sp.i] : null, ni1 = last(d.netIncome);
  const salesCh = chg(r0, r1);
  const om0 = sp ? d.opMargin[sp.i] : null, om1 = last(d.opMargin);

  const verdict: Para = sp && sp.j > sp.i && isNum(salesCh)
    ? {
      lead: `Sales ${salesCh >= 0 ? "up" : "down"} ${pa(salesCh, 0)} since ${F}, ${profitClause(ni0, ni1)}.`,
      body: [
        isNum(om0) && isNum(om1) ? `Operating margin moved from ${p(om0)} to ${p(om1)}.` : "",
        isNum(d.sharesChangeAll) && Math.abs(d.sharesChangeAll) < 0.05
          ? "The share count was unchanged, so each share owns the same part of the profit."
          : isNum(d.sharesChangeAll)
          ? `The share count ${d.sharesChangeAll < 0 ? "fell" : "rose"} ${
            pa(d.sharesChangeAll, 0)
          }, so each share owns ${d.sharesChangeAll < 0 ? "more" : "less"} of the profit.`
          : "",
      ].filter(Boolean).join(" ") || `${n} fiscal years are on record.`,
    }
    : {
      lead: `${n === 1 ? "One fiscal year" : `${n} fiscal years`} on record.`,
      body: "The charts below fill in as later filings add years.",
    };

  const story: Para[] = [];
  // First: profit against sales.
  {
    const niC = d.growth.revenueCagrAll;
    const nip = isNum(ni0) && isNum(ni1) && ni0 > 0 && ni1 > 0 && sp
      ? (Math.pow(ni1 / ni0, 1 / Math.max(1, d.years[sp.j] - d.years[sp.i])) - 1) * 100
      : null;
    const falls = fallYears(d, d.revenue);
    const gmx = extremes(d, d.grossMargin);
    const nm = last(d.netMargin), nm0 = sp ? d.netMargin[sp.i] : null;
    // A loss is claimed only from a reported net profit at or below zero; a missing value is said to be missing.
    let lead = `First, net profit is not tagged for ${L}.`;
    if (isNum(ni1) && ni1 > 0) {
      lead = isNum(nip) && isNum(niC)
        ? `First, profit grew ${nip > niC ? "faster" : "slower"} than sales.`
        : "First, the business makes a profit.";
    } else if (isNum(ni1)) lead = "First, the business is not yet profitable.";
    const bits: string[] = [];
    if (sp && sp.j > sp.i) {
      bits.push(`Sales went from ${m(r0)} in ${F} to ${m(r1)} in ${fyT(d.years[sp.j])}.`);
    }
    if (isNum(ni0) && isNum(ni1)) {
      bits.push(`Net profit went from ${m(ni0)} to ${m(ni1)} (${ref("fin-revni")}).`);
    } else bits.push(`Net profit is in ${ref("fin-revni")} where it is tagged.`);
    if (falls.length && falls.length <= 4) bits.push(`Sales fell in ${listText(falls.map(String))}.`);
    if (gmx) {
      bits.push(
        `Gross margin ranged from ${p(gmx.min)} in ${fyT(gmx.minY)} to ${p(gmx.max)} in ${fyT(gmx.maxY)} (${
          ref("fin-margins")
        }).`,
      );
    } else if (isNum(om1)) bits.push(`Operating margin was ${p(om1)} in ${L} (${ref("fin-margins")}).`);
    const usdText = c.currency === "USD";
    if (isNum(nm) && nm > 0) {
      bits.push(
        usdText
          ? `Out of each dollar of sales, ${S} now keeps ${nm.toFixed(1)} cents as profit${
            isNum(nm0) && nm0 > 0 ? `, against ${nm0.toFixed(1)} cents in ${F}` : ""
          }.`
          : `${S} now keeps ${p(nm)} of its sales as profit${
            isNum(nm0) && nm0 > 0 ? `, against ${p(nm0)} in ${F}` : ""
          }.`,
      );
    } else if (isNum(nm)) {
      bits.push(
        usdText
          ? `Net margin was ${p(nm)}, so each dollar of sales cost more than it brought in.`
          : `Net margin was ${p(nm)}, so the costs were larger than the sales.`,
      );
    }
    story.push({ lead, body: bits.join(" ") });
  }
  // Second: per share.
  {
    const es = span(d.eps);
    const e0 = es ? d.eps[es.i] : null, e1 = last(d.eps), ep = prev(d, d.eps);
    const bits: string[] = [];
    const shAll = d.sharesChangeAll;
    const ss = span(d.shares);
    if (ss && ss.j > ss.i && isNum(shAll)) {
      bits.push(
        Math.abs(shAll) < 0.05
          ? `The share count was ${shareText(d.shares[ss.j])} at both ends (${ref("fin-shares")}).`
          : `The share count went from ${shareText(d.shares[ss.i])} to ${shareText(d.shares[ss.j])}, ${
            shAll < 0 ? "down" : "up"
          } ${pa(shAll, 0)} (${ref("fin-shares")}).`,
      );
    }
    if (es && es.j > es.i && isNum(e0) && isNum(e1)) {
      bits.push(`Earnings per share went from ${usd(e0)} in ${fyT(d.years[es.i])} to ${usd(e1)}.`);
    }
    if (d.buybacks.some(isNum) || d.dividends.some(isNum)) {
      bits.push(`The cash paid to owners each year is in ${ref("fin-returns")}.`);
    }
    const br = d.epsBridge;
    if (br) {
      const steps = br.steps.filter((s) => Math.abs(s.value) >= 0.005);
      const big = [...steps].sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0];
      bits.push(
        steps.length === 0
          ? `Last year earnings per share held at ${usd(br.to)}, and no part of the bridge moved them (${
            ref("fin-bridge")
          }).`
          : `Last year's change, from ${usd(br.from)} to ${usd(br.to)}, splits into ${steps.length} parts (${
            ref("fin-bridge")
          }): ${
            listText(steps.map((s) => `${s.label.toLowerCase()} ${fmt(s.value, "usd_ps", { sign: true })}`))
          }.${big ? ` The largest part was ${big.label.toLowerCase()}.` : ""}`,
      );
    } else if (isNum(ep) && isNum(e1)) {
      const pt0 = d.prior?.pretax_income;
      bits.push(
        `Last year it moved from ${usd(ep)} to ${usd(e1)}. ${
          isNum(pt0) && pt0 <= 0
            ? "The split needs a pretax profit in the earlier year to set the tax rate"
            : "The split of that change needs sales, operating and pretax profit, tax and shares for both years"
        } (${ref("fin-bridge")}).`,
      );
    } else if (n > 1 && !d.prior) {
      bits.push(
        `The split of the yearly change needs ${fyT(d.latest.fiscal_year - 1)}, which is not on record (${
          ref("fin-bridge")
        }).`,
      );
    } else {
      bits.push(`The split of the yearly change needs two full years of figures (${ref("fin-bridge")}).`);
    }
    story.push({
      lead: isNum(shAll) && shAll < 0
        ? "Second, each share now owns a bigger slice."
        : isNum(shAll) && shAll > 0
        ? "Second, each share owns a smaller slice than before."
        : "Second, earnings per share tell the owner's side.",
      body: bits.join(" "),
    });
  }
  // Third: cash.
  {
    const fa = d.fcfToNetIncomeAll;
    const bits: string[] = [];
    if (isNum(fa.fcf) && isNum(fa.netIncome)) {
      bits.push(
        `Over the years on record, free cash flow, the cash left after running and investing in the business, added up to ${
          m(fa.fcf)
        }, against ${m(fa.netIncome)} of reported profit (${ref("fin-fcf")}).`,
      );
    } else {bits.push(
        `Free cash flow, the cash left after running and investing in the business, is in ${
          ref("fin-fcf")
        } where it is tagged.`,
      );}
    if (isNum(d.growth.fcfYoY)) {
      bits.push(
        `In ${L} free cash flow ${moved(d.growth.fcfYoY)} ${pa(d.growth.fcfYoY, 0)} to ${m(last(d.fcf))}.`,
      );
    }
    const ncS = span(d.netCash);
    const nc = last(d.netCash);
    if (ncS && isNum(nc)) {
      const nc0 = d.netCash[ncS.i] as number;
      bits.push(
        `${nc >= 0 ? "Net cash" : "Net debt"}, cash minus debt, was ${m(Math.abs(nc))} at the end of ${L}${
          ncS.j > ncS.i
            ? `, against ${nc0 >= 0 ? "net cash" : "net debt"} of ${m(Math.abs(nc0))} in ${
              fyT(d.years[ncS.i])
            }`
            : ""
        } (${ref("fin-cash")}).`,
      );
    } else bits.push(`Cash and debt are in ${ref("fin-cash")} where both are tagged.`);
    const ratio = fa.ratio;
    story.push({
      lead: isNum(ratio)
        ? (ratio >= 1
          ? "Third, the profit is backed by cash."
          : "Third, less of the profit turned into cash.")
        : isNum(fa.fcf) && fa.fcf < 0
        ? "Third, the business uses more cash than it makes."
        : "Third, the cash story is only partly on record.",
      body: bits.join(" "),
    });
  }

  const revTitle = isNum(salesCh) && sp && sp.j > sp.i
    ? `Sales ${salesCh >= 0 ? "up" : "down"} ${pa(salesCh, 0)} since ${F}`
    : "Sales and net profit";
  const revniSeries: Series[] = [
    { name: "Sales", values: col(d.revenue), tone: "s1" },
    { name: "Net profit", values: col(d.netIncome), tone: "s2" },
  ];
  const mSeries: Series[] = [
    { name: "Gross", values: col(d.grossMargin), tone: "s1" },
    { name: "Operating", values: col(d.opMargin), tone: "s4" },
    { name: "Net", values: col(d.netMargin), tone: "s3" },
  ].filter((s) => s.values.some(isNum)) as Series[];
  const fcfSeries: Series[] = [
    { name: "Free cash flow", values: col(d.fcf), tone: "s6" },
    { name: "Net profit", values: col(d.netIncome), tone: "s2" },
  ];
  const cashLabel = cashName(c).replace(/^./, (x) => x.toUpperCase());
  const cashSeries: Series[] = [
    { name: cashLabel, values: col(d.cash), tone: "s4" },
    { name: "Debt", values: col(d.debt), tone: "s5" },
  ];
  const br = d.epsBridge;
  const nm = last(d.netMargin);
  const fa = d.fcfToNetIncomeAll;
  const nc = last(d.netCash), ncp = prev(d, d.netCash);
  const cards: Card[] = [
    {
      id: "fin-revni",
      title: revTitle,
      sub: "Sales and net profit, fiscal years",
      span2: true,
      chart: true,
      html: pair((w) =>
        columns({
          title: "Sales and net profit by fiscal year",
          labels: d.labels,
          series: revniSeries,
          unit: "usd",
          width: w,
          labelLast: true,
        })
      ),
      src: "Income statement. Show table lists every figure by year, EPS included.",
      table: fullTable(c),
    },
    {
      id: "fin-bridge",
      title: br
        ? `From ${usd(br.from)} to ${usd(br.to)}: what moved earnings per share`
        : "What moved earnings per share",
      sub: br
        ? `Earnings per share, ${fyT(d.prior?.fiscal_year ?? 0)} to ${L}, ${moneyUnit()}`
        : n > 1 && !d.prior
        ? `Needs ${fyT(d.latest.fiscal_year - 1)}, which is not on record`
        : "Needs two full years of figures",
      span2: true,
      chart: true,
      html: br
        ? pair((w) =>
          waterfall({
            title: "Earnings per share bridge",
            start: { label: fyT(d.prior?.fiscal_year ?? 0).replace("fiscal ", "FY"), value: br.from },
            steps: br.steps.map((s) => ({ label: s.label, value: s.value })),
            end: { label: L.replace("fiscal ", "FY"), value: br.to },
            unit: "usd_ps",
            width: w,
          })
        )
        : NODATA,
      src: "Income statement and share count. Tax and share steps use the prior year's rate and count.",
      table: br
        ? tbl("Earnings per share bridge", ["Step", `${moneyUnit()} per share`], [
          [`EPS ${fyT(d.prior?.fiscal_year ?? 0)}`, usd(br.from)],
          ...br.steps.map((s) => [s.label, fmt(s.value, "usd_ps", { sign: true })]),
          [`EPS ${L}`, usd(br.to)],
        ])
        : undefined,
    },
    {
      id: "fin-margins",
      title: isNum(nm)
        ? c.currency !== "USD"
          ? nm > 0 ? `Keeps ${p(nm)} of sales as profit` : `Net loss of ${pa(nm)} of sales`
          : nm > 0
          ? `Keeps ${nm.toFixed(1)} cents of each sales dollar as profit`
          : `Loses ${Math.abs(nm).toFixed(1)} cents on each sales dollar`
        : "Margins",
      sub: "% of sales",
      chart: true,
      html: lines({
        title: "Margins by fiscal year",
        labels: d.labels,
        series: mSeries,
        unit: "pct",
        labelLast: true,
      }),
      src: "Income statement",
      table: tbl(
        "Margins",
        ["Year", ...mSeries.map((s) => s.name)],
        rowsNewestFirst(c, mSeries.map((s) => (i: number) => p(s.values[i]))),
      ),
    },
    {
      id: "fin-fcf",
      title: isNum(fa.ratio)
        ? (fa.ratio >= 1 ? "Cash profit tracks reported profit" : "Cash profit runs below reported profit")
        : "Free cash flow and net profit",
      sub: "Free cash flow and net profit, fiscal years",
      chart: true,
      html: lines({
        title: "Free cash flow and net profit",
        labels: d.labels,
        series: fcfSeries,
        unit: "usd",
        labelLast: true,
      }),
      src: "Cash flow statement",
      table: tbl(
        "Free cash flow and net profit",
        ["Year", "Free cash flow", "Net profit"],
        rowsNewestFirst(c, [(i) => money(d.fcf[i]), (i) => money(d.netIncome[i])]),
      ),
    },
    returnsCard(c),
    {
      id: "fin-shares",
      title: isNum(d.sharesChangeAll) && Math.abs(d.sharesChangeAll) < 0.05
        ? `Share count unchanged since ${fyT(d.years[span(d.shares)?.i ?? 0])}`
        : isNum(d.sharesChangeAll)
        ? `Share count ${d.sharesChangeAll < 0 ? "down" : "up"} ${pa(d.sharesChangeAll, 0)} since ${
          fyT(d.years[span(d.shares)?.i ?? 0])
        }`
        : "Share count",
      sub: `Shares outstanding, ${shareSeries(d.shares).sub}${splitNote(d) ? `. ${splitNote(d)}` : ""}`,
      chart: true,
      html: lines({
        title: "Share count by fiscal year",
        labels: d.labels,
        series: [{ name: "Shares", values: shareSeries(d.shares).values, tone: "s2" }],
        unit: shareSeries(d.shares).unit,
        labelLast: true,
        zero: false,
      }),
      src: "Balance sheet and cover page",
      table: tbl(
        "Share count",
        ["Year", "Shares"],
        rowsNewestFirst(c, [(i) => shareSeries(d.shares).text(d.shares[i])]),
      ),
    },
    {
      id: "fin-cash",
      title: isNum(nc) && isNum(ncp)
        ? (nc >= 0) !== (ncp >= 0)
          ? `${nc >= 0 ? "Net cash" : "Net debt"} of ${m(Math.abs(nc))}, from ${
            ncp >= 0 ? "net cash" : "net debt"
          } of ${m(Math.abs(ncp))}`
          : `${nc >= 0 ? "Net cash" : "Net debt"} ${Math.abs(nc) < Math.abs(ncp) ? "shrank" : "grew"} to ${
            m(Math.abs(nc))
          }`
        : isNum(nc)
        ? `${nc >= 0 ? "Net cash" : "Net debt"} of ${m(Math.abs(nc))}`
        : "Cash against debt",
      sub: `${cashLabel} against total debt`,
      span2: true,
      chart: true,
      html: pair((w) =>
        columns({
          title: "Cash against debt by fiscal year",
          labels: d.labels,
          series: cashSeries,
          unit: "usd",
          width: w,
        })
      ),
      src: "Balance sheet",
      table: tbl(
        "Cash against debt",
        ["Year", "Cash", "Debt", "Net cash"],
        rowsNewestFirst(c, [(i) => money(d.cash[i]), (i) => money(d.debt[i]), (i) => money(d.netCash[i])]),
      ),
    },
  ];
  const conv = d.checks.find((x) => x.key === "fcf_conversion");
  const upBits: string[] = [];
  if (conv && isNum(conv.current)) {
    upBits.push(
      `Free cash flow was ${
        p(conv.current, 0)
      } of net profit over the last three years. The test in the Risks chapter trips under ${
        p(conv.threshold, 0)
      }.`,
    );
  } else {upBits.push(
      "The cash test in the Risks chapter needs three years of free cash flow and a positive net profit.",
    );}
  if (isNum(nc) && isNum(ncp)) {
    upBits.push(
      `${nc >= 0 ? "Net cash" : "Net debt"} moved from ${ncp >= 0 ? "net cash of" : "net debt of"} ${
        m(Math.abs(ncp))
      } to ${m(Math.abs(nc))} in ${L}, so the balance sheet is worth following too.`,
    );
  }
  return {
    id: "financials",
    chip: "Financials",
    phases: [1],
    src: `SEC XBRL company facts, ${n === 1 ? "one fiscal year" : `${n} fiscal years`}`,
    h2: n > 1 ? `${n === 11 ? "Eleven" : n} years of the numbers` : "The numbers",
    verdict,
    story,
    cards,
    upshot: upBits.join(" "),
  };
}
