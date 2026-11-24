// Deep Dive 2.0 chapters 01, 02 and 05: Summary, Business, Owners & people.
// Each function returns a Chapter (story.ts) built only from Derived and fact values. Pure TS (no Deno APIs).

import { esc, fmt } from "./format.ts";
import { columns, hbars, lines, type Series } from "./charts.ts";
import { meter } from "./charts_more.ts";
import {
  baseCase,
  bigQuestion,
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
  notSeen,
  p,
  pa,
  type Para,
  payoutText,
  prev,
  pts,
  ratioRows,
  ref,
  shareText,
  span,
  tbl,
  tightestSentence,
  usd,
  usd0,
} from "./story.ts";

type Num = number | null;

const col = (a: Num[]) => a.map((v) => (isNum(v) ? v : null));
const money = (v: Num) => fmt(v, "usd");
const tableRows = (c: Ctx, cols: Array<(i: number) => string>) =>
  c.d.years.map((_, i) => [c.d.labels[i], ...cols.map((f) => f(i))]).reverse();

// ---------------------------------------------------------------- 01 Summary

function quality(om: Num): string | null {
  if (!isNum(om)) return null;
  return om >= 25
    ? "highly profitable"
    : om >= 12
    ? "solidly profitable"
    : om > 0
    ? "thinly profitable"
    : "loss-making";
}

function pace(g: Num): string | null {
  if (!isNum(g)) return null;
  return g >= 10 ? "fast growth" : g >= 4 ? "steady growth" : g >= 0 ? "slow growth" : "shrinking sales";
}

/** One sentence on cash against debt. */
export function netCashSentence(c: Ctx): string {
  const nc = last(c.d.netCash);
  if (!isNum(nc)) return "";
  return nc >= 0
    ? `It has ${m(nc)} more in ${cashName(c)} than it owes.`
    : `It owes ${m(-nc)} more than it has in ${cashName(c)}.`;
}

/** The price sentence: the stored filing-date close, else the no-price wording (SPEC rule 3). */
export function priceSentence(c: Ctx): string {
  const base = baseCase(c);
  const bear = c.d.dcf?.scenarios.find((s) => s.key === "bear");
  const bull = c.d.dcf?.scenarios.find((s) => s.key === "bull");
  if (c.price !== null && base) {
    const gap = (base.value / c.price - 1) * 100;
    return `At the ${usd(c.price)} close on ${c.priceDate}, the model's base value of ${
      usd0(base.value)
    } is ${
      Math.abs(gap) < 0.5
        ? "about the same as the price"
        : `${pa(gap, 0)} ${gap > 0 ? "above" : "below"} the price`
    }.`;
  }
  if (!base || !bear || !bull) {
    return "The model range needs three years of positive free cash flow, cash, debt and a share count, so no range is shown.";
  }
  return c.price === null
    ? `No closing price at the filing date is stored, so type a price at the top to compare it with the model range of ${
      usd0(bear.value)
    } to ${usd0(bull.value)}.`
    : "";
}

interface Change {
  dir: "up" | "dn" | "w";
  title: string;
  text: string;
}

function changes(c: Ctx): Change[] {
  const { d } = c;
  if (!d.prior) return [];
  const P = fyT(d.prior.fiscal_year);
  const out: Change[] = [];
  const dir = (v: number): Change["dir"] => (Math.abs(v) < 0.05 ? "w" : v > 0 ? "up" : "dn");
  const yoy = d.growth.revenueYoY;
  if (isNum(yoy)) {
    out.push({
      dir: dir(yoy),
      title: `Sales ${yoy >= 0 ? "up" : "down"} ${pa(yoy)} to ${m(last(d.revenue))}`,
      text: `From ${m(prev(d.revenue))} in ${P}.`,
    });
  }
  const gmc = d.marginChange1y.gross;
  const gm = last(d.grossMargin);
  if (isNum(gmc) && isNum(gm)) {
    const ex = extremes(d, d.grossMargin);
    const top = ex && ex.maxY === d.latest.fiscal_year && d.years.length > 2;
    out.push({
      dir: dir(gmc),
      title: `Gross margin ${p(gm)}, ${pts(gmc)} ${gmc >= 0 ? "higher" : "lower"}`,
      text: top
        ? `The highest in the ${d.years.length} years on record.`
        : `It was ${p(prev(d.grossMargin))} in ${P}.`,
    });
  }
  const omc = d.marginChange1y.op;
  const om = last(d.opMargin);
  if (isNum(omc) && isNum(om)) {
    out.push({
      dir: dir(omc),
      title: `Operating margin ${p(om)}, ${pts(omc)} ${omc >= 0 ? "higher" : "lower"}`,
      text: `It was ${p(prev(d.opMargin))} in ${P}.`,
    });
  }
  const fy = d.growth.fcfYoY;
  if (isNum(fy)) {
    out.push({
      dir: dir(fy),
      title: `Free cash flow ${fy >= 0 ? "up" : "down"} ${pa(fy, 0)} to ${m(last(d.fcf))}`,
      text: isNum(last(d.netIncome))
        ? `Net profit was ${m(last(d.netIncome))}.`
        : `From ${m(prev(d.fcf))} in ${P}.`,
    });
  }
  const sh = d.sharesChange1y;
  if (isNum(sh)) {
    const bb = isNum(d.latest.buybacks) ? d.latest.buybacks : null;
    out.push({
      dir: dir(sh),
      title: Math.abs(sh) < 0.05
        ? "Share count unchanged"
        : `Share count ${sh < 0 ? "down" : "up"} ${pa(sh)}`,
      text: sh < -0.05
        ? (bb !== null ? `Buybacks of ${m(bb)} in the year.` : "Fewer shares than a year earlier.")
        : sh > 0.05
        ? "New shares mean each one owns a smaller slice."
        : "About the same number of shares.",
    });
  }
  const nc = last(d.netCash), ncp = prev(d.netCash);
  if (isNum(nc) && isNum(ncp)) {
    const word = nc >= 0 ? "Net cash" : "Net debt";
    out.push({
      dir: (nc >= 0) === (ncp >= 0) ? dir(Math.abs(nc) - Math.abs(ncp)) : nc >= 0 ? "up" : "dn",
      title: `${word} ${m(Math.abs(nc))}`,
      text: `${ncp >= 0 ? "Net cash" : "Net debt"} was ${m(Math.abs(ncp))} a year earlier.`,
    });
  }
  return out.slice(0, 5);
}

function changesHtml(list: Change[]): string {
  const icon = { up: "↑", dn: "↓", w: "→" };
  const aria = { up: "up", dn: "down", w: "flat" };
  return `<div class="changes">${
    list.map((x) =>
      `<div class="chg"><div class="ic ${x.dir}" aria-label="${aria[x.dir]}">${icon[x.dir]}</div><div><b>${
        esc(x.title)
      }</b><p>${esc(x.text)}</p></div></div>`
    ).join("")
  }</div>`;
}

export function summary(c: Ctx): Chapter {
  const { d, short: S, L } = c;
  const om = last(d.opMargin), rev = last(d.revenue), g = d.growth.revenueCagrAll, yoy = d.growth.revenueYoY;
  const q = quality(om), gw = pace(g);
  const claim = q && gw
    ? `${S} is a ${q} business with ${gw}.`
    : q
    ? `${S} is a ${q} business.`
    : isNum(rev)
    ? `${S} had sales of ${m(rev)} in ${L}.`
    : `The filings give only a partial picture of ${S}.`;
  const salesLine = isNum(rev)
    ? `Sales were ${m(rev)} in ${L}${
      isNum(yoy) ? `, ${yoy >= 0 ? "up" : "down"} ${pa(yoy)} on the year` : ""
    }.`
    : "";
  const verdict: Para = {
    lead: claim,
    body: [
      isNum(om) ? `${salesLine.replace(/\.$/, "")}, and operating margin was ${p(om)}.` : salesLine,
      netCashSentence(c),
      priceSentence(c),
    ]
      .filter(Boolean).join(" "),
  };

  const story: Para[] = [];
  const sp = span(d.revenue);
  const scores = d.scorecard.filter((s) => isNum(s.score));
  const scoreText = scores.length
    ? `The scorecard sums this up (${ref("scores")}): ${
      listText(scores.map((s, i) =>
        `${i === 0 ? s.label.toLowerCase() + " scores" : s.label.toLowerCase()} ${
          fmt(s.score, "plain", { digits: 1 })
        }${i === 0 ? " of 10" : ""}`
      ))
    }. The bands are absolute for now: ranks against the company's index need the peer set, which arrives in phase 2.`
    : `The scorecard (${ref("scores")}) needs more years of data before it can score anything.`;
  if (sp && sp.j > sp.i && isNum(g)) {
    const nif = d.netIncome[sp.i], nil = d.netIncome[sp.j];
    let ni = "";
    if (isNum(nif) && isNum(nil) && nif > 0 && nil > 0) {
      const r = nil / nif;
      ni = `Net profit went from ${m(nif)} to ${m(nil)}${
        r >= 1.95 ? `, ${r.toFixed(1)} times as much` : ""
      }.`;
    } else if (isNum(nil) && nil <= 0) ni = `The latest year ended with a net loss of ${m(-nil)}.`;
    story.push({
      lead: `Sales ${g >= 0 ? "grew" : "shrank"} ${pa(g)} a year over ${
        d.years[sp.j] - d.years[sp.i]
      } years.`,
      body: `They went from ${m(d.revenue[sp.i])} in ${fyT(d.years[sp.i])} to ${m(d.revenue[sp.j])} in ${
        fyT(d.years[sp.j])
      }. ${ni} ${scoreText}`.replace(/\s+/g, " "),
    });
  } else {
    story.push({
      lead: isNum(rev) ? `${S} reported sales of ${m(rev)} in ${L}.` : `The filings on record are thin.`,
      body: `With fewer than two years of sales on record, growth cannot be measured yet. ${scoreText}`,
    });
  }

  const list = changes(c);
  const omc = d.marginChange1y.op;
  if (d.prior && list.length) {
    const signs = [yoy, omc, d.growth.fcfYoY].filter(isNum);
    const better = signs.length > 0 && signs.every((v) => v >= 0);
    const worse = signs.length > 0 && signs.every((v) => v < 0);
    const bits: string[] = [];
    if (isNum(yoy)) bits.push(`Sales ${moved(yoy)} ${pa(yoy)} to ${m(rev)}.`);
    if (isNum(omc) && isNum(om)) {
      bits.push(
        `Operating margin ${moved(omc, "rose", "fell", "held level")} ${
          Math.abs(omc) >= 0.05 ? `by ${pts(omc)} ` : ""
        }to ${p(om)}.`,
      );
    }
    const fy = d.growth.fcfYoY;
    if (isNum(fy)) bits.push(`Free cash flow ${moved(fy)} ${pa(fy, 0)} to ${m(last(d.fcf))}.`);
    const Lc = L.charAt(0).toUpperCase() + L.slice(1);
    story.push({
      lead: better
        ? `${Lc} was a better year than the one before.`
        : worse
        ? `${Lc} was a weaker year than the one before.`
        : `${Lc} was a mixed year.`,
      body: `The card next to the scorecard lists what changed (${ref("changes")}). ${bits.join(" ")}`,
    });
  }

  const bits: string[] = [];
  const e1 = last(d.eps), e0 = prev(d.eps);
  if (isNum(e0) && isNum(e1)) bits.push(`Earnings per share went from ${usd(e0)} to ${usd(e1)} in ${L}.`);
  if (isNum(d.sharesChange1y)) {
    bits.push(
      `The share count ${moved(d.sharesChange1y)} ${
        Math.abs(d.sharesChange1y) >= 0.05 ? pa(d.sharesChange1y) + " " : ""
      }in the year.`,
    );
  }
  const cr = d.cashReturn5;
  if (isNum(cr.fcf) && isNum(cr.buybacks) && isNum(cr.dividends)) {
    bits.push(
      `Over five years ${S} paid out ${m(cr.buybacks + cr.dividends)} in buybacks and dividends, against ${
        m(cr.fcf)
      } of free cash flow.`,
    );
  } else if (isNum(cr.fcf) && (isNum(cr.buybacks) || isNum(cr.dividends))) {
    bits.push(
      `Over five years ${S} paid out ${
        isNum(cr.buybacks) ? `${m(cr.buybacks)} in buybacks` : `${m(cr.dividends)} in dividends`
      }, against ${m(cr.fcf)} of free cash flow. ${
        isNum(cr.buybacks) ? "Dividends are" : "Buybacks are"
      } not disclosed for every year.`,
    );
  }
  story.push({
    lead: "That sets up the question the rest of the report keeps asking.",
    body: `${bits.join(" ")} So the big question is this. ${bigQuestion(c)}`.trim(),
  });

  const meters = d.scorecard.map((s) =>
    meter({ label: s.label, value: s.score, max: 10, tone: "s1", note: s.basis })
  )
    .join("");
  const priceRow = ratioRows([[
    "Price against the model range",
    `<span data-dd="gap">${esc(c.pt.gap)}</span>`,
  ]]);
  const cards: Card[] = [
    {
      id: "scores",
      title: "Scorecard",
      sub: "Not seen yet: ranks need the peer set (phase 2). Absolute 0 to 10 bands shown meanwhile.",
      html: `<div class="meters">${meters}</div>${priceRow}`,
      src: `Annual reports to ${L}`,
      table: tbl(
        "Scorecard inputs",
        ["Score", "Out of 10", "Basis"],
        d.scorecard.map((s) => [s.label, fmt(s.score, "plain", { digits: 1 }), s.basis]),
      ).replace('<details class="tbl stack">', '<details class="tbl stack wrapcells">'),
    },
    d.prior && list.length
      ? {
        id: "changes",
        title: `What changed since ${fyT(d.prior.fiscal_year)}`,
        sub: `${L.charAt(0).toUpperCase() + L.slice(1)} against ${
          fyT(d.prior.fiscal_year)
        }, from the annual reports`,
        html: changesHtml(list),
      }
      : notSeen(
        "changes",
        "What changed since the last filing",
        "Not seen: first filing on record. The comparison needs an earlier annual report in",
        "the SEC company facts",
        1,
      ),
  ];
  const base = baseCase(c);
  const upshot = `${
    base ? `The base case assumes free cash flow grows ${p(base.growth)} a year for five years. ` : ""
  }${tightestSentence(c)}`;
  return {
    id: "summary",
    chip: "Summary",
    phases: [1],
    src: "Thesis model on SEC filings",
    h2: "The story in one minute",
    verdict,
    story,
    cards,
    upshot,
  };
}

// ---------------------------------------------------------------- 02 Business

export function business(c: Ctx): Chapter {
  const { d, short: S, L } = c;
  const sp = span(d.revenue);
  const rev = last(d.revenue), yoy = d.growth.revenueYoY;
  const gm = last(d.grossMargin), om = last(d.opMargin);
  const gmx = extremes(d, d.grossMargin);
  const hasGm = d.grossMargin.some(isNum);
  const claim = isNum(gm)
    ? `${S} keeps about ${Math.round(gm)} cents of each sales dollar as gross profit.`
    : isNum(rev)
    ? `Sales were ${m(rev)} in ${L}${
      isNum(yoy) ? `, ${yoy >= 0 ? "up" : "down"} ${pa(yoy)} on the year` : ""
    }.`
    : `${S}'s sales are not disclosed in these filings.`;
  const gmc = d.marginChange1y.gross;
  const rest = isNum(gm)
    ? `${
      isNum(gmc)
        ? `That is ${pts(gmc)} ${gmc >= 0 ? "more" : "less"} than in ${fyT(d.prior?.fiscal_year ?? 0)}. `
        : ""
    }The split by product and segment arrives in phase 2.`
    : "The filings do not tag gross profit, so this chapter tracks sales and operating margin. The split by product and segment arrives in phase 2.";

  const story: Para[] = [];
  if (sp && sp.j > sp.i) {
    const r0 = d.revenue[sp.i] as number, r1 = d.revenue[sp.j] as number;
    const falls = fallYears(d, d.revenue);
    let compared = 0;
    for (let k = sp.i + 1; k <= sp.j; k++) {
      if (isNum(d.revenue[k - 1]) && isNum(d.revenue[k]) && d.years[k] - d.years[k - 1] === 1) compared++;
    }
    const fallText = falls.length === 0
      ? compared === sp.j - sp.i
        ? "Sales rose in every year on record."
        : `Sales rose in each of the ${compared} year-on-year changes on record.`
      : `Sales fell in ${listText(falls.map(String))}${
        falls.length > 1 ? `, ${falls.length} of the ${compared} year-on-year changes on record` : ""
      }.`;
    story.push({
      lead: `Sales ${r1 >= r0 ? "grew" : "shrank"} from ${m(r0)} to ${m(r1)} over ${
        d.years[sp.j] - d.years[sp.i]
      } years.`,
      body: `That is ${
        isNum(d.growth.revenueCagrAll) ? pa(d.growth.revenueCagrAll) : "an unknown rate"
      } a year on average (${ref("biz-sales")}). ${fallText}${
        isNum(yoy) ? ` In ${L} sales ${moved(yoy)} ${pa(yoy)}.` : ""
      }`,
    });
  } else {
    story.push({
      lead: isNum(rev)
        ? `${S} reported sales of ${m(rev)} in ${L}.`
        : "Sales are not disclosed in these filings.",
      body: `One year of sales is not enough to show a trend (${
        ref("biz-sales")
      }). Later filings add the history.`,
    });
  }
  if (hasGm && gmx && isNum(gm)) {
    story.push({
      lead: `Each sales dollar leaves about ${Math.round(gm)} cents of gross profit.`,
      body:
        `Gross profit is what is left after the direct cost of the goods and services sold. The gross margin ran from a low of ${
          p(gmx.min)
        } in ${fyT(gmx.minY)} to a high of ${p(gmx.max)} in ${fyT(gmx.maxY)} (${ref("biz-margin")}).${
          isNum(om)
            ? ` Operating margin, which also takes off running costs such as research, sales and admin costs, was ${
              p(om)
            } in ${L}${
              isNum(d.marginChange1y.op)
                ? `, ${pts(d.marginChange1y.op)} ${
                  d.marginChange1y.op >= 0 ? "higher" : "lower"
                } than a year earlier`
                : ""
            }.`
            : ""
        }`,
    });
  } else {
    const omx = extremes(d, d.opMargin);
    story.push({
      lead: "The filings do not tag gross profit, so the margin story starts at operating profit.",
      body: isNum(om) && omx
        ? `Operating margin, the share of sales left after running costs, was ${
          p(om)
        } in ${L}. It ranged from ${p(omx.min)} in ${fyT(omx.minY)} to ${p(omx.max)} in ${fyT(omx.maxY)} (${
          ref("biz-margin")
        }).`
        : `Operating profit is not tagged either, so the margin chart stays empty (${ref("biz-margin")}).`,
    });
  }
  story.push({
    lead: "The split by product is not in this report yet.",
    body:
      "Segment and product tables come from the XBRL notes in the annual report. They arrive in phase 2. Until then the two cards below say what they will show, and nothing in them is estimated.",
  });

  const salesTitle = sp && sp.j > sp.i
    ? (() => {
      const ch = chg(d.revenue[sp.i], d.revenue[sp.j]);
      const g = d.growth.revenueCagrAll;
      return isNum(ch) && isNum(g)
        ? `Sales ${g >= 0 ? "grew" : "shrank"} ${pa(g)} a year since ${fyT(d.years[sp.i])}`
        : "Sales by year";
    })()
    : "Sales by year";
  const marginTitle = isNum(gm) && gmx
    ? gmx.maxY === d.latest.fiscal_year && d.years.length > 2
      ? `Gross margin at its highest in ${d.years.length} years`
      : gmx.minY === d.latest.fiscal_year && d.years.length > 2
      ? `Gross margin at its lowest in ${d.years.length} years`
      : `Gross margin ${p(gm)} in ${L}`
    : isNum(om)
    ? `Operating margin ${p(om)} in ${L}`
    : "Margins";
  const mSeries: Series[] = [
    ...(hasGm ? [{ name: "Gross margin", values: col(d.grossMargin), tone: "s1" as const }] : []),
    { name: "Operating margin", values: col(d.opMargin), tone: "s4" },
  ];
  const cards: Card[] = [
    {
      id: "biz-sales",
      title: salesTitle,
      sub: "Sales, fiscal years",
      chart: true,
      html: columns({
        title: "Sales by fiscal year",
        labels: d.labels,
        series: [{ name: "Sales", values: col(d.revenue), tone: "s1" }],
        unit: "usd",
        highlightLast: true,
        labelLast: true,
      }),
      src: "Income statement",
      table: tbl("Sales by fiscal year", ["Year", "Sales"], tableRows(c, [(i) => money(d.revenue[i])])),
    },
    {
      id: "biz-margin",
      title: marginTitle,
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
        "Margins by fiscal year",
        ["Year", ...mSeries.map((s) => s.name)],
        tableRows(c, mSeries.map((s) => (i: number) => p(s.values[i]))),
      ),
    },
    notSeen(
      "biz-seg",
      "Sales by product or segment",
      "The five largest products or segments plus Other, as a share of sales. Comes from",
      "XBRL segment tables (free), phase 2.",
      2,
    ),
    notSeen(
      "biz-seg-margin",
      "Gross margin by type",
      "Products against services, where the annual report splits them. Comes from",
      "XBRL segment tables (free), phase 2.",
      2,
    ),
  ];
  const opCheck = d.checks.find((x) => x.key === "op_margin");
  return {
    id: "business",
    chip: "Business",
    phases: [1, 2],
    src: "SEC XBRL company facts; segment tables arrive in phase 2",
    h2: `How ${S} makes money`,
    verdict: { lead: claim, body: rest },
    story,
    cards,
    upshot: isNum(om) && opCheck && opCheck.current === null
      ? `The margin to watch is operating margin, ${
        p(om)
      } in ${L}. The test in the Risks chapter sets its line once an earlier year of operating margin is on record.`
      : isNum(om) && opCheck
      ? `The margin to watch is operating margin. The test in the Risks chapter trips below ${
        p(opCheck.threshold)
      }, against ${p(om)} in ${L}.`
      : "Margins cannot be tracked until the filings tag operating profit. The sales line is the measure to follow until then.",
  };
}

// ---------------------------------------------------------------- 05 Owners & people

export function owners(c: Ctx): Chapter {
  const { d, short: S, L } = c;
  const sp = span(d.shares);
  const all = d.sharesChangeAll, one = d.sharesChange1y;
  const F = sp ? fyT(d.years[sp.i]) : "";
  const anyBuybacks = d.buybacks.some(isNum);
  const verdict: Para = isNum(all)
    ? all < 0
      ? {
        lead: anyBuybacks
          ? `Buybacks cut the share count ${pa(all, 0)} since ${F}.`
          : `The share count fell ${pa(all, 0)} since ${F}.`,
        body:
          "Each share now owns a bigger slice of the profit. Owners, insider trades and the board arrive in phase 2.",
      }
      : {
        lead: `The share count rose ${pa(all, 0)} since ${F}.`,
        body:
          "New shares mean each existing share owns a smaller slice of the profit. Owners, insider trades and the board arrive in phase 2.",
      }
    : {
      lead: "The share count history is too short to show a trend.",
      body: "Owners, insider trades and the board arrive in phase 2.",
    };
  const story: Para[] = [];
  if (sp && sp.j > sp.i && isNum(all)) {
    story.push({
      lead: all < 0 ? "The share count has been falling." : "The share count has been rising.",
      body: `It went from ${shareText(d.shares[sp.i])} shares in ${F} to ${shareText(d.shares[sp.j])} in ${
        fyT(d.years[sp.j])
      }, as the Financials chapter charts.${
        isNum(one) ? ` In ${L} alone it ${moved(one)}${Math.abs(one) >= 0.05 ? " " + pa(one) : ""}.` : ""
      } ${
        all < 0
          ? "When a company repurchases its own shares, every remaining owner owns a larger part of the business without paying more."
          : "When a company issues shares, for staff pay or to raise money, every existing owner owns a smaller part."
      }`,
    });
  } else {
    story.push({
      lead: "One year of shares is not a trend.",
      body: `The share count was ${shareText(last(d.shares))} in ${L}. Later filings add the history.`,
    });
  }
  const cr = d.cashReturn5;
  const hasFive = isNum(cr.fcf);
  if (hasFive && (isNum(cr.buybacks) || isNum(cr.dividends))) {
    const parts = [
      isNum(cr.buybacks) ? `Buybacks were ${m(cr.buybacks)}` : "Buybacks are not disclosed for every year",
      isNum(cr.dividends) ? `dividends ${m(cr.dividends)}` : "dividends are not disclosed for every year",
    ];
    story.push({
      lead: isNum(cr.buybacks) && isNum(cr.dividends)
        ? `Over five years, ${S} returned ${m(cr.buybacks + cr.dividends)} to owners.`
        : "Over five years, only part of the cash returned is on record.",
      body: `${parts.join(isNum(cr.buybacks) && isNum(cr.dividends) ? " and " : "; ")}, against ${
        m(cr.fcf)
      } of free cash flow (${ref("own-five")}). ${isNum(cr.ratio) ? `That is ${payoutText(cr.ratio)}.` : ""}`
        .trim(),
    });
  } else {
    story.push({
      lead: "Cash returned to owners is not fully on record.",
      body: hasFive
        ? `Five full years of buybacks or dividends are needed for the sum (${
          ref("own-five")
        }). The yearly figures that are tagged are in the Financials chapter.`
        : "Five full years of free cash flow and of buybacks or dividends are needed for the sum. The yearly figures that are tagged are in the Financials chapter.",
    });
  }
  story.push({
    lead: "Who owns the shares is the next layer.",
    body: `Top owners come from 13F filings (${ref("own-holders")}), insider trades from Forms 3, 4 and 5 (${
      ref("own-insiders")
    }), and the board and pay from the proxy statement (${
      ref("own-board")
    }). They arrive in phase 2, so this chapter shows no owner names or percentages yet.`,
  });
  const shareCheck = d.checks.find((x) => x.key === "share_count");
  const cards: Card[] = [];
  if (hasFive) {
    cards.push({
      id: "own-five",
      title: "Five years of cash, made and returned",
      sub: `Sums over the five fiscal years to ${L}`,
      chart: true,
      html: hbars({
        title: "Five-year sums",
        rows: [
          { label: "Free cash flow", value: cr.fcf, tone: "s6" },
          { label: "Buybacks", value: cr.buybacks, tone: "s1" },
          { label: "Dividends", value: cr.dividends, tone: "s3" },
        ],
        unit: "usd",
      }),
      src: "Cash flow statement",
      table: tbl("Five-year sums", ["Item", "Sum"], [
        ["Free cash flow", money(cr.fcf)],
        ["Buybacks", money(cr.buybacks)],
        ["Dividends", money(cr.dividends)],
      ]),
    });
  }
  cards.push(
    notSeen(
      "own-holders",
      "Who owns the shares",
      "Index funds, active funds and other owners, and the largest owners with their change on the quarter. Comes from",
      "SEC 13F data sets (free), phase 2.",
      2,
    ),
    notSeen(
      "own-insiders",
      "Insider trades, last 12 months",
      "Shares bought and sold by directors and officers, by month. Comes from",
      "SEC Forms 3, 4 and 5 (free), phase 2.",
      2,
    ),
    notSeen(
      "own-board",
      "Board, pay and gatekeepers",
      "Directors, the pay of the top officers, the auditor and the vote results. Comes from",
      "the proxy statement (free), phase 2.",
      2,
    ),
  );
  return {
    id: "owners",
    chip: "Owners & people",
    phases: [1, 2],
    src: "SEC XBRL company facts; 13F, Forms 3/4/5 and proxy from phase 2",
    h2: "Owners and people",
    verdict,
    story,
    cards,
    upshot: shareCheck && isNum(one)
      ? `The share count test in the Risks chapter trips if shares rise ${
        p(shareCheck.threshold, 0)
      } or more in a year. In ${L} they changed ${p(one)}.`
      : "The share count test in the Risks chapter needs two years of share counts. Until then the change cannot be checked.",
  };
}

/** Buybacks and dividends by year (chapter 06, SPEC section 3). */
export function returnsCard(c: Ctx): Card {
  const { d, L } = c;
  const bb = d.latest.buybacks, dv = d.latest.dividends;
  const title = isNum(bb) && isNum(dv)
    ? `${m(bb + dv)} back to owners in ${L}`
    : isNum(bb)
    ? `${m(bb)} of buybacks in ${L}`
    : isNum(dv)
    ? `${m(dv)} of dividends in ${L}`
    : "Buybacks and dividends";
  return {
    id: "fin-returns",
    title,
    sub: "Buybacks and dividends, fiscal years",
    chart: true,
    html: columns({
      title: "Buybacks and dividends by fiscal year",
      labels: d.labels,
      series: [{ name: "Buybacks", values: col(d.buybacks), tone: "s1" }, {
        name: "Dividends",
        values: col(d.dividends),
        tone: "s3",
      }],
      unit: "usd",
      stacked: true,
    }),
    src: "Cash flow statement",
    table: tbl(
      "Buybacks and dividends",
      ["Year", "Buybacks", "Dividends"],
      tableRows(c, [(i) => money(d.buybacks[i]), (i) => money(d.dividends[i])]),
    ),
  };
}
