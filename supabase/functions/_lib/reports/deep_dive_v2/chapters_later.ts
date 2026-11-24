// Deep Dive 2.0 chapters whose data arrives in later phases: 03 Countries, 04 Customers & suppliers (phase 2) and
// 08 Price action (phase 3). They keep their place, verdict, story and upshot, and show "Not seen yet" cards that name
// the data and the phase that adds it. No numbers are estimated. Pure TS (no Deno APIs).

import { esc } from "./format.ts";
import { type Card, type Chapter, type Ctx, isNum, last, m, notSeen, ref } from "./story.ts";

// ---------------------------------------------------------------- 03 Countries, 04 Customers & suppliers

export function countries(c: Ctx): Chapter {
  const { d, short: S, L } = c;
  const rev = last(d.revenue);
  return {
    id: "countries",
    chip: "Countries",
    phases: [2],
    src: "SEC XBRL geography, World Bank outlooks and GLEIF, from phase 2",
    h2: "Where the money comes from, and where things are made",
    verdict: {
      lead: `Not seen yet: where ${S}'s sales come from and where it makes things.`,
      body:
        "Region tables, country outlooks and the list of legal entities arrive in phase 2. Nothing in this chapter is estimated in the meantime.",
    },
    story: [{
      lead: "This chapter will answer two questions.",
      body:
        `Where do sales come from, and where are the products made? The answers come from the region note in the annual report, World Bank growth outlooks for each country, and the GLEIF register of legal entities. ${
          c.f.currency ? `The filings report in ${c.f.currency}.` : ""
        }${
          isNum(rev)
            ? ` Total sales were ${m(rev)} in ${L}, and the cards below will split that total by region (${
              ref("geo-regions")
            }).`
            : ""
        }`,
    }, {
      lead: "The legal map comes from a public register.",
      body:
        `Every legal entity with a Legal Entity Identifier is in the GLEIF register, with its country and its parent. Counting ${S}'s entities by country shows where the company is set up, which is not always where its sales come from (${
          ref("geo-entities")
        }).`,
    }],
    cards: [
      notSeen(
        "geo-regions",
        "Sales by region",
        "Each region's sales and its growth a year over four years. Comes from",
        "the XBRL geography note, phase 2.",
        2,
      ),
      notSeen(
        "geo-lines",
        "Regions over five years",
        "Sales by region for each of the last five fiscal years. Comes from",
        "the XBRL geography note, phase 2.",
        2,
      ),
      notSeen(
        "geo-table",
        "Country exposure",
        "Each region's share of sales next to its economic outlook and currency. Comes from",
        "World Bank forecasts (CC BY 4.0), phase 2.",
        2,
      ),
      notSeen(
        "geo-made",
        "Where it is made",
        "Countries the annual report names for making the products, and legal entities by country. Comes from",
        "the annual report text and GLEIF, phase 2.",
        2,
      ),
      notSeen(
        "geo-entities",
        "Legal entities by country",
        "The number of the company's legal entities in each country, largest first. Comes from",
        "the GLEIF register (CC0), phase 2.",
        2,
      ),
    ],
    upshot: `Until the region tables arrive, total sales are the only view: ${
      isNum(rev) ? `${m(rev)} in ${L}` : "not disclosed"
    }. A fall in one large region would show there first, without a name attached.`,
  };
}

export function links(c: Ctx): Chapter {
  const { short: S } = c;
  const rel = c.f.relationships;
  const cards: Card[] = [
    notSeen(
      "lk-network",
      `${S}'s network`,
      "Suppliers, makers, resellers and rivals, with line thickness for how much each depends on the company. Comes from",
      "other companies' annual report customer notes, phase 2 and phase 4.",
      2,
    ),
    notSeen(
      "lk-deps",
      `Who depends on ${S}`,
      "The share of each supplier's revenue that comes from this company. Comes from",
      "suppliers' major customer notes, phase 2.",
      2,
    ),
    notSeen(
      "lk-channels",
      "How it reaches customers",
      "Direct and indirect sales as a share of the total. Comes from",
      "the annual report revenue note, phase 2.",
      2,
    ),
  ];
  if (rel.length) {
    cards.unshift({
      id: "lk-names",
      title: `Names linked to ${S}`,
      sub: "From an earlier version of this report. Names only, no figures.",
      html: `<div class="chips">${
        rel.map((r) => `<span class="chip"><b>${esc(r.name)}</b>${r.kind ? ` · ${esc(r.kind)}` : ""}</span>`)
          .join("")
      }</div>`,
    });
  }
  return {
    id: "links",
    chip: "Customers & suppliers",
    phases: [2, 4],
    src: "Its own filings, and other companies' filings that name it, from phase 2",
    h2: "Customers, suppliers and rivals",
    verdict: {
      lead: `Not seen yet: who depends on ${S}, and whom it depends on.`,
      body:
        "Customer, supplier and channel figures come from the annual reports of both sides. They arrive in phase 2, with the network map in phase 4.",
    },
    story: [{
      lead: "Dependence runs both ways, and the filings show it.",
      body:
        `A company must name any customer above 10% of its sales. Suppliers name their large customers in the same way, so a supplier that lives on ${S}'s orders says so in its own annual report. ${
          rel.length
            ? `An earlier version of this report linked ${
              rel.length === 1 ? "one name" : `${rel.length} names`
            } to ${S} (${ref("lk-names")}), shown without figures until the sourced tables arrive.`
            : `The cards below show what these tables will contain (${ref("lk-deps")}).`
        }`,
    }, {
      lead: "The channel split is the second thing to read.",
      body:
        `Sales made directly and sales made through resellers carry different margins. The annual report revenue note splits them where the company reports it (${
          ref("lk-channels")
        }).`,
    }],
    cards,
    upshot:
      "The first figure to arrive will be any customer above 10% of sales. If one exists, the annual report must name it, and that single name becomes the line to watch.",
  };
}

// ---------------------------------------------------------------- 08 Price action

export function action(_c: Ctx): Chapter {
  const nd = "Not disclosed: no licensed price data for this date. Needs";
  const feed = "a licensed end-of-day price feed, phase 3.";
  return {
    id: "action",
    chip: "Price action",
    phases: [3],
    src: "Licensed daily prices; pattern rules computed by Thesis",
    h2: "The month to the filing date",
    verdict: {
      lead: "Not seen yet: the price chapter needs licensed daily prices.",
      body:
        "It will show the trading month that ends on the filing date, with the patterns drawn on the chart. No free price source allows display, so it arrives in phase 3.",
    },
    story: [{
      lead: "This chapter describes the chart, and it is not a trading signal.",
      body:
        `When prices arrive it shows the 21 trading days up to the filing date, the 20-day average and seven pattern checks that follow Al Brooks's price action rules: trend, breakout, breakout test, measured move, climax run, wedge and failed breakout (${
          ref("pa-candles")
        }). Each check is computed from the daily bars by fixed rules, with no language model.`,
    }, {
      lead: "The numbers come with base rates.",
      body:
        `A summary of the month, its range, its change and its volume against the 20-day average, sits next to the chart (${
          ref("pa-stats")
        }). Each pattern comes with the base rate the rules give for it, stated as a rate and not as a call (${
          ref("pa-rules")
        }).`,
    }],
    cards: [
      notSeen("pa-candles", "Daily candles, the month to the filing date", nd, feed, 3),
      notSeen("pa-volume", "Shares traded per day", nd, feed, 3),
      notSeen("pa-stats", "The month in numbers", nd, feed, 3),
      notSeen("pa-scan", "What the pattern scan found", nd, feed, 3),
      notSeen("pa-levels", "Prices the chart marked", nd, feed, 3),
      notSeen(
        "pa-rules",
        "Rules of thumb",
        "How often each pattern has followed through, from fixed base rates. Needs",
        "the price feed and the Al Brooks base-rate constants, phase 3.",
        3,
      ),
    ],
    upshot:
      "Until licensed prices arrive, this report says nothing about the share price trend. The value chapter still works with any price typed into the box at the top.",
  };
}
