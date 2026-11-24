// Deep Dive 2.0 chapters 07 to 10: Price & value, Price action, Forecasts, Risks. Pure TS (no Deno APIs).
// The value model is dcf.ts; the price parts read only price_at_filing and the reader's typed price (client.ts).

import { esc } from "./format.ts";
import { lines, NODATA, type Series } from "./charts.ts";
import { heat, range } from "./charts_more.ts";
import type { Scenario } from "./dcf.ts";
import { NA_TEXT } from "./client.ts";
import {
  type Card,
  cashName,
  type Chapter,
  checkCounts,
  checkLine,
  checkNow,
  checkStatus,
  countOfFour,
  type Ctx,
  fyT,
  isNum,
  last,
  listText,
  m,
  notSeen,
  p,
  pair,
  type Para,
  ratioRows,
  ref,
  shareText,
  STATUS_TEXT,
  tbl,
  tightestSentence,
  usd,
  usd0,
  word,
} from "./story.ts";

type Num = number | null;
const col = (a: Num[]) => a.map((v) => (isNum(v) ? v : null));

function scen(c: Ctx, key: Scenario["key"]): Scenario | null {
  return c.d.dcf?.scenarios.find((s) => s.key === key) ?? null;
}

/** The discount-rate row of the sensitivity grid at the base long-run rate: [low, high]. */
function modelBand(c: Ctx): [number, number] | null {
  const dcf = c.d.dcf;
  if (!dcf) return null;
  const j = dcf.sensitivity.terminals.indexOf(dcf.terminal);
  const vals = dcf.sensitivity.values.map((r) => r[j]).filter(isNum);
  return vals.length ? [Math.min(...vals), Math.max(...vals)] : null;
}

/** Football field for the model, with the movable price line. `hero` draws the one-row header version. */
export function modelRange(c: Ctx, width: number, hero = false): string {
  const bear = scen(c, "bear"), base = scen(c, "base"), bull = scen(c, "bull");
  if (!bear || !base || !bull) return NODATA;
  const band = modelBand(c);
  const dcf = c.d.dcf;
  const rows = hero
    ? [{
      label: "Bear to bull model range",
      low: bear.value,
      high: bull.value,
      mid: base.value,
      tone: "s1" as const,
    }]
    : [
      ...(band && dcf
        ? [{
          label: `Discount ${p(dcf.sensitivity.waccs[0])} to ${
            p(dcf.sensitivity.waccs[dcf.sensitivity.waccs.length - 1])
          }`,
          low: band[0],
          high: band[1],
          mid: base.value,
          tone: "s1" as const,
        }]
        : []),
      {
        label: "Bear to bull cases",
        low: bear.value,
        high: bull.value,
        mid: base.value,
        tone: "s2" as const,
      },
    ];
  const svg = range({
    title: hero ? "Model range and your price" : "Value range from the cash-flow model",
    rows,
    marker: c.price !== null ? { value: c.price, label: "Your price" } : null,
    unit: "usd_ps",
    width,
  });
  // The chart kit hides an empty marker with an inline style; the client shows it by clearing the display attribute.
  return svg.replace(' style="display:none"', ' display="none"');
}

// ---------------------------------------------------------------- 07 Price & value

export function value(c: Ctx): Chapter {
  const { d, L } = c;
  const dcf = d.dcf;
  const bear = scen(c, "bear"), base = scen(c, "base"), bull = scen(c, "bull");
  const eps = last(d.eps);
  const story: Para[] = [];
  let verdict: Para;
  // The growth the stored price assumes, or null when the price is outside what the model reaches.
  const implied = c.price !== null && c.pt.implied !== NA_TEXT ? c.pt.implied : null;
  const outside =
    "The price is outside what the model reaches with growth between −20% and 40% a year for five years.";
  if (dcf && bear && base && bull) {
    verdict = {
      lead: `The model puts the base value at ${usd0(base.value)} a share, in a range of ${
        usd0(bear.value)
      } to ${usd0(bull.value)}.`,
      body: c.price !== null
        ? implied
          ? `At the ${
            usd(c.price)
          } close on ${c.priceDate}, the price assumes free cash flow grows ${implied} for five years, then slows to ${
            p(dcf.terminal)
          } by year ten.`
          : `At the ${usd(c.price)} close on ${c.priceDate}: ${outside.charAt(0).toLowerCase()}${
            outside.slice(1)
          }`
        : "No closing price at the filing date is stored yet. Type a price at the top and the range, the ratios and the growth the price assumes update.",
    };
    const nc = dcf.netCash;
    story.push({
      lead: "The model starts from the cash the business makes.",
      body: `It takes free cash flow over the last three years, an average of ${
        m(dcf.baseFcf)
      }, and grows it ${p(base.growth)} a year for five years. Growth then slows in a straight line to ${
        p(dcf.terminal)
      } by year ten. Each year's cash is discounted at ${
        p(dcf.wacc)
      } a year, the yearly return an owner asks for, and net ${nc >= 0 ? "cash" : "debt"} of ${
        m(Math.abs(nc))
      } is ${nc >= 0 ? "added" : "taken off"}. Spread over ${shareText(dcf.shares)} shares, that gives ${
        usd(base.value)
      } a share (${ref("val-range")}).`,
    });
    const w = dcf.sensitivity.waccs,
      v = dcf.sensitivity.values,
      j = dcf.sensitivity.terminals.indexOf(dcf.terminal);
    const i0 = w.indexOf(dcf.wacc);
    const hi = i0 >= 0 && i0 + 1 < w.length ? v[i0 + 1][j] : null, lo = i0 > 0 ? v[i0 - 1][j] : null;
    story.push({
      lead: "The range is wide because small changes in the inputs add up.",
      body: `With growth 4 points lower, the bear case gives ${
        usd0(bear.value)
      }. With growth 4 points higher, the bull case gives ${
        usd0(bull.value)
      }. The discount rate matters as much, and the Forecasts chapter maps it.${
        isNum(hi) && isNum(lo)
          ? ` Half a point higher, at ${p(w[i0 + 1])}, moves the base value to ${
            usd0(hi)
          }. Half a point lower, at ${p(w[i0 - 1])}, moves it to ${usd0(lo)}.`
          : ""
      }`,
    });
  } else {
    verdict = {
      lead: "The value model cannot run on these filings yet.",
      body:
        "It needs at least three years of positive free cash flow, plus cash, debt and a share count for the latest year.",
    };
    story.push({
      lead: "Without positive cash flow, a cash-flow model has nothing to grow.",
      body: `The model values a company by the cash it makes. ${
        isNum(last(d.fcf))
          ? `Free cash flow was ${m(last(d.fcf))} in ${L}.`
          : "Free cash flow is not disclosed for the latest year."
      } The range chart (${ref("val-range")}) stays empty until the inputs are on record.`,
    });
  }
  if (c.price !== null) {
    story.push({
      lead: implied
        ? `At the ${usd(c.price)} close on ${c.priceDate}, the price asks for ${implied} of growth.`
        : `At the ${usd(c.price)} close on ${c.priceDate}, the model cannot match the price.`,
      body: `${
        implied
          ? "That is the growth for years 1 to 5, then a straight line to the long-run rate, that makes the model value equal the price"
          : outside.replace(/\.$/, "")
      } (${ref("val-ratios")}).${
        isNum(d.growth.fcfCagr5)
          ? ` Over the last five years free cash flow grew ${p(d.growth.fcfCagr5)} a year.`
          : ""
      }${isNum(eps) && eps > 0 ? ` The price is ${c.pt.pe} ${L} earnings per share of ${usd(eps)}.` : ""}`,
    });
  } else {
    story.push({
      lead: "There is no price in this report yet.",
      body:
        `The price box opens at the closing price on the filing date, and that needs a licensed price feed. None is in place yet, so type the price you see at your broker into the box at the top. The ratios card (${
          ref("val-ratios")
        }) then shows the price to earnings, the gap to the base value and the growth the price assumes. Nothing you type is stored.`,
    });
  }

  const ratios = ratioRows([
    [`Price to earnings, ${L} EPS of ${usd(eps)}`, `<span data-dd="pe">${esc(c.pt.pe)}</span>`],
    ["Gap to the base value", `<span data-dd="gap" class="${c.pt.gapClass}">${esc(c.pt.gap)}</span>`],
    ["Growth the price assumes, years 1 to 5", `<span data-dd="implied">${esc(c.pt.implied)}</span>`],
    ["Base value per share", esc(base ? usd(base.value) : "n/a")],
    ["Free cash flow, 3-year average", esc(dcf ? m(dcf.baseFcf) : "n/a")],
  ]);
  const cards: Card[] = [
    {
      id: "val-range",
      title: base ? "Value range from the cash-flow model" : "Value range",
      sub:
        "$ per share. The short tick is the base value; the tall line is your price once you type one. Rows for price history and peers arrive in phase 3.",
      span2: true,
      chart: true,
      html: pair((w) => modelRange(c, w)),
      src: "Thesis cash-flow model on SEC free cash flow",
      table: dcf && bear && bull && base
        ? tbl("Value range", ["Method", "Low", "Base", "High"], [
          ...(modelBand(c)
            ? [[
              "Cash-flow model, discount rate range",
              usd0(modelBand(c)![0]),
              usd0(base.value),
              usd0(modelBand(c)![1]),
            ]]
            : []),
          ["Bear to bull cases", usd0(bear.value), usd0(base.value), usd0(bull.value)],
        ])
        : undefined,
    },
    {
      id: "val-ratios",
      title: "What the price implies",
      sub: "Recomputed from the price box at the top",
      html: `${ratios}<p class="note" data-dd-when="noprice"${
        c.price !== null ? " hidden" : ""
      }>Not seen: type a price to compare.</p>`,
    },
    notSeen(
      "val-pe",
      "Price to earnings over time",
      "The yearly average price to earnings. Needs",
      "a licensed price history, phase 3.",
      3,
    ),
    notSeen(
      "val-peers",
      "Growth and margin against peers",
      "Sales growth and operating margin for the seven closest companies by sales in the same industry code. Comes from",
      "the same SEC data for each peer, phase 2.",
      2,
    ),
  ];
  let upshot: string;
  if (base && bear && dcf && c.price !== null) {
    upshot = `${
      implied
        ? `At ${usd(c.price)}, free cash flow needs to grow ${implied} for five years before slowing.`
        : outside
    } In the bear case, growth of ${p(bear.growth)} a year, the model value is ${usd0(bear.value)}.`;
  } else if (base && bear && dcf) {
    upshot = `The base value of ${usd0(base.value)} rests on ${
      p(base.growth)
    } a year growth for five years and a ${p(dcf.wacc)} discount rate. In the bear case, ${
      p(bear.growth)
    } a year, it is ${usd0(bear.value)}.`;
  } else {
    upshot =
      "The model returns once three straight years of positive free cash flow are on record. That is the line to watch in the Financials chapter.";
  }
  return {
    id: "value",
    chip: "Price & value",
    phases: [1, 3],
    src: "Thesis valuation model; price history needs a licensed feed",
    h2: "Is the price right?",
    verdict,
    story,
    cards,
    upshot,
  };
}

// ---------------------------------------------------------------- 09 Forecasts

/** Sales on a scenario's path: latest sales grown at the model's yearly FCF growth (FCF margin held). */
function salesPath(c: Ctx, s: Scenario): number[] | null {
  const rev = last(c.d.revenue);
  const dcf = c.d.dcf;
  if (!isNum(rev) || rev <= 0 || !dcf || !(dcf.baseFcf > 0)) return null;
  return s.fcfPath.map((f) => rev * (f / dcf.baseFcf));
}

/** The sensitivity grid card (SPEC: "Fair value if the inputs move", chapter 09). */
function heatCard(c: Ctx): Card {
  const { d } = c;
  const dcf = d.dcf;
  const base = scen(c, "base");
  const heatSvg = dcf
    ? pair((width) =>
      heat({
        title: "Base value per share by discount rate and long-run growth",
        rowLabel: "Discount rate",
        colLabel: "Long-run growth",
        rows: dcf.sensitivity.waccs.map((x) => p(x)),
        cols: dcf.sensitivity.terminals.map((x) => p(x)),
        values: dcf.sensitivity.values,
        unit: "usd_ps",
        mid: c.price ?? base?.value,
        width,
      })
    )
    : NODATA;
  return {
    id: "fc-heat",
    title: "Fair value if the inputs move",
    sub: base
      ? `$ per share at ${p(base.growth)} growth. Blue above ${
        c.price !== null ? "the filing-date price" : "the base value"
      }, clay below.`
      : "$ per share",
    span2: true,
    chart: true,
    html: heatSvg,
    src: "Across: long-run growth. Down: discount rate.",
    table: dcf
      ? tbl("Base value by discount rate and long-run growth", [
        "Discount rate",
        ...dcf.sensitivity.terminals.map((x) => `Growth ${p(x)}`),
      ], dcf.sensitivity.waccs.map((x, i) => [p(x), ...dcf.sensitivity.values[i].map((y) => usd0(y))]))
      : undefined,
  };
}

export function forecasts(c: Ctx): Chapter {
  const { d, L } = c;
  const dcf = d.dcf;
  const bear = scen(c, "bear"), base = scen(c, "base"), bull = scen(c, "bull");
  const ly = d.latest.fiscal_year;
  const rev = last(d.revenue);
  if (!dcf || !bear || !base || !bull) {
    return {
      id: "forecasts",
      chip: "Forecasts",
      phases: [1, 2, 4],
      src: "Thesis scenarios, company guidance from phase 2",
      h2: "What could happen next",
      verdict: {
        lead: "No model cases: the filings do not support the cash-flow model yet.",
        body:
          "The cases need three years of positive free cash flow, cash, debt and a share count. These would be this report's model numbers, not a forecast from management.",
      },
      story: [{
        lead: "The history is all there is for now.",
        body: `Sales are charted as reported (${ref("fc-fan")}).${
          isNum(d.growth.revenueCagrAll)
            ? ` Over the years on record they ${d.growth.revenueCagrAll >= 0 ? "grew" : "shrank"} ${
              p(Math.abs(d.growth.revenueCagrAll))
            } a year.`
            : ""
        } The three model cases appear once the inputs are on record.`,
      }, {
        lead: "The value grid waits for the same inputs.",
        body:
          `How the value moves with the discount rate and the long-run growth rate needs a model to move (${
            ref("fc-heat")
          }). Management's own outlook arrives with phase 2 and phase 4 data.`,
      }],
      cards: [
        {
          id: "fc-fan",
          title: "Sales as reported",
          sub: "Model cases need positive free cash flow",
          span2: true,
          chart: true,
          html: pair((w) =>
            lines({
              title: "Sales as reported",
              labels: d.labels,
              series: [{ name: "Reported", values: col(d.revenue), tone: "s1" }],
              unit: "usd",
              width: w,
              labelLast: true,
            })
          ),
          src: "Income statement",
        },
        heatCard(c),
        notSeen(
          "fc-guidance",
          "What management said",
          "Guidance from results releases and earnings calls. Comes from",
          "8-K exhibits and call transcripts, phase 2 and phase 4.",
          4,
        ),
      ],
      upshot: "The cases return once three straight years of positive free cash flow are on record.",
    };
  }
  const future = Array.from({ length: dcf.years }, (_, k) => `FY${ly + k + 1}`);
  const labels = [...d.labels, ...future];
  const n = d.labels.length;
  const hist = [...col(d.revenue), ...future.map(() => null)];
  const path = (s: Scenario): Array<number | null> => {
    const sp = salesPath(c, s);
    return [
      ...d.labels.map((_, i) => (i === n - 1 && isNum(rev) ? rev : null)),
      ...(sp ?? future.map(() => null)),
    ];
  };
  const fanSeries: Series[] = [
    { name: "Reported", values: hist, tone: "s1" },
    { name: "Bear case", values: path(bear), tone: "s5" },
    { name: "Base case", values: path(base), tone: "s4" },
    { name: "Bull case", values: path(bull), tone: "s3" },
  ];
  const fcfSeries: Series[] = [bear, base, bull].map((s, k) => ({
    name: s.label,
    values: s.fcfPath,
    tone: (["s5", "s4", "s3"] as const)[k],
  }));
  const sp5 = salesPath(c, base);
  const src = isNum(d.growth.fcfCagr5)
    ? "the last five years of free cash flow growth"
    : isNum(d.growth.revenueCagr5)
    ? "the last five years of sales growth, since five years of free cash flow are not on record"
    : "sales growth over the years on record";
  const cases = ratioRows(
    [bear, base, bull].map((s) => [`${s.label}: ${p(s.growth)} a year for five years`, esc(usd(s.value))]),
  );
  const story: Para[] = [
    {
      lead: "The base case asks the past to repeat.",
      body: `Its ${p(base.growth)} a year comes from ${src}, kept between ${p(-5, 0)} and ${p(15, 0)}.${
        sp5 && isNum(rev)
          ? ` On that path sales would go from ${m(rev)} in ${L} to ${m(sp5[4])} in ${fyT(ly + 5)} (${
            ref("fc-fan")
          }).`
          : ""
      }${
        isNum(d.growth.revenueCagrAll)
          ? ` Over the years on record sales ${d.growth.revenueCagrAll >= 0 ? "grew" : "shrank"} ${
            p(Math.abs(d.growth.revenueCagrAll))
          } a year.`
          : ""
      }`,
    },
    {
      lead: "The three cases differ only in growth.",
      body: `The bear case grows free cash flow ${p(bear.growth)} a year and the bull case ${
        p(bull.growth)
      }, 4 points either side of the base (${ref("fc-cases")}). By ${
        fyT(ly + dcf.years)
      } that puts yearly free cash flow at ${
        listText([
          m(bear.fcfPath[dcf.years - 1]),
          m(base.fcfPath[dcf.years - 1]),
          m(bull.fcfPath[dcf.years - 1]),
        ])
      } (${ref("fc-fcf")}). Value per share is ${usd0(bear.value)} in the bear case, ${
        usd0(base.value)
      } in the base case and ${
        usd0(bull.value)
      } in the bull case. The discount rate and the long-run rate matter as much as growth (${
        ref("fc-heat")
      }).`,
    },
    {
      lead: "Management's own outlook is not in this report yet.",
      body:
        "Guidance from results releases and earnings calls arrives in phase 2 and phase 4. Until then the model cases are the only forward view, and they are mechanical: they extend the history, they do not predict it.",
    },
  ];
  const cards: Card[] = [
    {
      id: "fc-fan",
      title: "Sales: history and three model cases",
      sub:
        `Solid history to the latest year, then the model's cases. Sales grow at the same rate as free cash flow in each case, starting from ${L} sales.`,
      span2: true,
      chart: true,
      html: pair((w) =>
        lines({
          title: "Sales history and model cases",
          labels,
          series: fanSeries,
          unit: "usd",
          width: w,
          labelLast: true,
        })
      ),
      src: `Model growth: bear ${p(bear.growth)}, base ${p(base.growth)}, bull ${
        p(bull.growth)
      } a year for five years`,
      table: tbl(
        "Sales path in the three cases",
        ["Year", "Bear", "Base", "Bull"],
        future.map((
          y,
          k,
        ) => [
          y,
          m(salesPath(c, bear)?.[k] ?? null),
          m(sp5?.[k] ?? null),
          m(salesPath(c, bull)?.[k] ?? null),
        ]),
      ),
    },
    {
      id: "fc-fcf",
      title: `Base case: free cash flow reaches ${m(base.fcfPath[dcf.years - 1])} by ${fyT(ly + dcf.years)}`,
      sub: `Free cash flow in the three cases, starting from the 3-year average of ${
        m(dcf.baseFcf)
      }. A model, not a forecast from management.`,
      chart: true,
      html: lines({
        title: "Free cash flow in the three cases",
        labels: future,
        series: fcfSeries,
        unit: "usd",
        labelLast: true,
        zero: false,
      }),
      src: "Thesis cash-flow model",
      table: tbl(
        "Free cash flow path",
        ["Year", "Bear", "Base", "Bull"],
        future.map((y, k) => [y, m(bear.fcfPath[k]), m(base.fcfPath[k]), m(bull.fcfPath[k])]),
      ),
    },
    {
      id: "fc-cases",
      title: "The three cases",
      sub: `Growth for years 1 to 5, then a straight line to ${p(dcf.terminal)} by year 10. Value per share.`,
      html: cases,
      src: `Discount rate ${p(dcf.wacc)}`,
    },
    heatCard(c),
    notSeen(
      "fc-guidance",
      "What management said",
      "Guidance from results releases and earnings calls. Comes from",
      "8-K exhibits and call transcripts, phase 2 and phase 4.",
      4,
    ),
  ];
  return {
    id: "forecasts",
    chip: "Forecasts",
    phases: [1, 2, 4],
    src: "Thesis scenarios; company guidance from phase 2",
    h2: "What could happen next",
    verdict: {
      lead: `Base case: free cash flow grows ${p(base.growth)} a year for five years, then slows to ${
        p(dcf.terminal)
      } by year ten.`,
      body:
        "These are this report's model numbers, not a forecast from management or analysts. The model keeps the free cash flow margin steady, so sales grow at the same pace.",
    },
    story,
    cards,
    upshot: `The base value of ${usd0(base.value)} rests on ${p(base.growth)} a year growth and a ${
      p(dcf.wacc)
    } discount rate. If growth instead runs at the bear case's ${p(bear.growth)}, the model value is ${
      usd0(bear.value)
    }.`,
  };
}

// ---------------------------------------------------------------- 10 Risks

const STATUS_MARK = { ok: "●", watch: "▲", bad: "■", none: "○" };

export function checksHtml(c: Ctx): string {
  return `<div class="kill">${
    c.d.checks.map((k) => {
      const st = checkStatus(k);
      return `<div class="k"><span>${esc(k.label)}</span><span class="status ${st}">${STATUS_MARK[st]} ${
        STATUS_TEXT[st]
      }</span><small>${
        esc(
          k.current === null
            ? k.why
            : `In ${c.L}: ${checkNow(k)} against a line of ${checkLine(k)}. ${k.why}`,
        )
      }</small></div>`;
    }).join("")
  }</div>`;
}

export function risks(c: Ctx): Chapter {
  const { d, short: S, L } = c;
  const cn = checkCounts(d);
  const nc = last(d.netCash), fcf = last(d.fcf), debt = last(d.debt), cash = last(d.cash);
  const lead = cn.bad
    ? `${countOfFour(cn.bad, ["is tripped", "are tripped"])}.`
    : cn.none
    ? `${countOfFour(cn.pass)}, and ${word(cn.none)} cannot be checked yet.`
    : `All four tests pass on ${L} numbers.`;
  let bs = "";
  if (isNum(nc) && nc >= 0) {
    bs = `${S} has ${m(nc)} more in ${cashName(c)} than it owes.`;
  } else if (isNum(nc) && isNum(fcf) && fcf > 0) {
    bs = `Net debt of ${m(-nc)} equals ${(-nc / fcf).toFixed(1)} years of ${L} free cash flow.`;
  } else if (isNum(nc)) bs = `Net debt is ${m(-nc)}, and free cash flow is not positive to pay it down.`;
  const story: Para[] = [];
  story.push({
    lead: isNum(nc) && nc >= 0
      ? "Debt is not where this story would break."
      : isNum(nc)
      ? "Debt is a real part of this story."
      : "The balance sheet is only partly on record.",
    body: `${
      isNum(debt) && isNum(cash)
        ? `${S} owed ${m(debt)} at the end of ${L}, against ${m(cash)} of ${cashName(c)}.`
        : "Cash or debt is not tagged for the latest year."
    }${
      isNum(fcf) && isNum(debt) && fcf > 0
        ? fcf >= debt
          ? ` One year of free cash flow, ${m(fcf)}, would cover all of the debt.`
          : ` One year of free cash flow, ${m(fcf)}, would cover ${
            (fcf / debt * 100).toFixed(0)
          }% of the debt.`
        : ""
    } When each debt falls due is in the debt notes, which arrive in phase 2 (${ref("risk-debt")}).`,
  });
  const short = (k: { label: string }) =>
    k.label.toLowerCase().replace(/^(sales growth|operating margin|free cash flow|share count).*$/, "$1");
  const parts = d.checks.map((k) =>
    k.current === null
      ? `the ${short(k)} test cannot be checked`
      : `${short(k)} reads ${checkNow(k)}${k.key === "fcf_conversion" ? " of net profit" : ""} against ${
        checkLine(k)
      }`
  );
  story.push({
    lead: "Four fixed tests say when the story is breaking.",
    body: `They are the report's kill switches, and every report gets the same four (${
      ref("risk-tests")
    }). In ${L} ${listText(parts)}.`,
  });
  const cards: Card[] = [
    {
      id: "risk-tests",
      title: "Kill switches",
      sub: "The same four tests for every company. Lines are stored with the report.",
      html: checksHtml(c),
      src: `Annual reports to ${L}`,
    },
    notSeen(
      "risk-debt",
      "Debt coming due",
      "Debt repayments by fiscal year. Comes from",
      "XBRL debt maturity tags (free), phase 2.",
      2,
    ),
    notSeen(
      "risk-factors",
      "Risk factor changes since last year",
      "New, stronger and unchanged risk wording, paragraph by paragraph. Comes from",
      "the annual report text, phase 4.",
      4,
    ),
  ];
  return {
    id: "risks",
    chip: "Risks",
    phases: [1, 4],
    src: "Kill switches on SEC figures; debt notes and risk factors from later phases",
    h2: "What could break the thesis",
    verdict: { lead, body: bs || "Cash and debt are not both tagged for the latest year." },
    story,
    cards,
    upshot: tightestSentence(c, true),
  };
}
