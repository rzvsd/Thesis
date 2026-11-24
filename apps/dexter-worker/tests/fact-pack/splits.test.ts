import assert from "node:assert/strict";
import test from "node:test";

import { buildFactPack } from "../../src/fact-pack/build";
import { mapAnnualFacts, type CompanyFactsJson, type XbrlFact } from "../../src/fact-pack/companyfacts";
import { cleanRatio } from "../../src/fact-pack/splits";
import { CIK, FAST, SEC, TICKERS, acmeFacts, acmeRoutes, acmeSubmissions, fakeSec } from "./sec-samples";

// Synthetic company facts: calendar fiscal years, each 10-K filed on 20 Feb of the next year and carrying its
// own year plus the two before as comparatives.
const filedFor = (fy: number) => `${fy + 1}-02-20`;
const accnFor = (fy: number) => `K${fy}`;

function fact(year: number, val: number, filingFy: number, form = "10-K"): XbrlFact {
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
    val,
    accn: accnFor(filingFy),
    fy: filingFy,
    fp: "FY",
    form,
    filed: filedFor(filingFy)
  };
}

/** One fact per (year, filing) for the years a filing carries. `value(year, filingFy)` gives the value. */
function series(years: number[], value: (year: number, filingFy: number) => number | undefined, form = "10-K") {
  const out: XbrlFact[] = [];
  for (const filingFy of years) {
    for (const year of [filingFy - 2, filingFy - 1, filingFy]) {
      if (!years.includes(year)) continue;
      const v = value(year, filingFy);
      if (v !== undefined) out.push(fact(year, v, filingFy, form));
    }
  }
  return out;
}

function cover(years: number[], shares: (fy: number) => number): XbrlFact[] {
  return years.map((fy) => ({
    end: `${fy + 1}-02-01`,
    val: shares(fy),
    accn: accnFor(fy),
    fy,
    fp: "FY",
    form: "10-K",
    filed: filedFor(fy)
  }));
}

const YEARS = [2021, 2022, 2023, 2024];

/**
 * Flat business (sales 1000, profit 100 every year) with `perShare(year, filingFy)` shares: the per-share and
 * share-count facts follow it, so a split shows wherever the share basis changes.
 */
function company(
  sharesFor: (year: number, filingFy: number) => number,
  extra: Record<string, { units: Record<string, XbrlFact[]> }> = {},
  coverShares?: (fy: number) => number
): CompanyFactsJson {
  return {
    cik: 1,
    entityName: "Flat Co",
    facts: {
      dei: {
        EntityCommonStockSharesOutstanding: {
          units: { shares: cover(YEARS, coverShares ?? ((fy) => sharesFor(fy, fy))) }
        }
      },
      "us-gaap": {
        Revenues: { units: { USD: series(YEARS, () => 1000) } },
        NetIncomeLoss: { units: { USD: series(YEARS, () => 100) } },
        EarningsPerShareDiluted: {
          units: { "USD/shares": series(YEARS, (year, filingFy) => 100 / sharesFor(year, filingFy)) }
        },
        WeightedAverageNumberOfDilutedSharesOutstanding: {
          units: { shares: series(YEARS, (year, filingFy) => sharesFor(year, filingFy)) }
        },
        ...extra
      }
    }
  };
}

test("clean split ratios: 2% for the worker, forward and reverse, nothing near 1", () => {
  assert.equal(cleanRatio(1.99, 0.02), 2);
  assert.equal(cleanRatio(0.1005, 0.02), 0.1);
  assert.equal(cleanRatio(1.5, 0.02), 1.5);
  assert.equal(cleanRatio(1.3, 0.02), null);
  assert.equal(cleanRatio(1.02, 0.02), null);
  assert.equal(cleanRatio(-2, 0.02), null);
});

test("a 2-for-1 split restated in the next 10-K: continuous EPS and shares on the latest basis", () => {
  // The split took effect during 2023: the FY2023 10-K and later show every year on the new basis.
  const mapping = mapAnnualFacts(company((_year, filingFy) => (filingFy >= 2023 ? 200 : 100)));
  assert.deepEqual(mapping.annual.map((row) => row.fiscal_year), YEARS);
  assert.deepEqual(mapping.annual.map((row) => row.eps_diluted), [0.5, 0.5, 0.5, 0.5]);
  assert.deepEqual(mapping.annual.map((row) => row.shares_diluted), [200, 200, 200, 200]);
  assert.deepEqual(mapping.annual.map((row) => row.shares_outstanding), [200, 200, 200, 200]);
  assert.deepEqual(mapping.splits, [
    {
      ratio: 2,
      effective_fiscal_year: 2023,
      evidence: "restatement",
      concept: "us-gaap:WeightedAverageNumberOfDilutedSharesOutstanding",
      accession: "K2023",
      filed: "2024-02-20"
    }
  ]);
  assert.deepEqual(
    mapping.annual.map((row) => row.as_reported),
    [
      { eps_diluted: 1, shares_diluted: 100, shares_outstanding: 100 },
      { eps_diluted: 1, shares_diluted: 100, shares_outstanding: 100 },
      undefined,
      undefined
    ]
  );
  // Money values and restatements are untouched by the split.
  assert.deepEqual(mapping.annual.map((row) => row.net_income), [100, 100, 100, 100]);
  assert.ok(!mapping.restatements.some((change) => change.field === "eps_diluted"));
});

test("two splits compose to the latest basis and are never applied twice", () => {
  // 2-for-1 during 2022, 3-for-1 during 2024.
  const basis = (filingFy: number) => (filingFy >= 2024 ? 600 : filingFy >= 2022 ? 200 : 100);
  const mapping = mapAnnualFacts(company((_year, filingFy) => basis(filingFy)));
  assert.deepEqual(
    mapping.splits.map((split) => [split.ratio, split.effective_fiscal_year]),
    [
      [2, 2022],
      [3, 2024]
    ]
  );
  assert.deepEqual(mapping.annual.map((row) => row.shares_diluted), [600, 600, 600, 600]);
  assert.deepEqual(mapping.annual.map((row) => row.eps_diluted), [0.1667, 0.1667, 0.1667, 100 / 600]);
  assert.deepEqual(mapping.annual[0]?.as_reported, { eps_diluted: 1, shares_diluted: 100, shares_outstanding: 100 });
  assert.deepEqual(mapping.annual[2]?.as_reported, {
    eps_diluted: 0.5,
    shares_diluted: 200,
    shares_outstanding: 200
  });
});

test("the split ratio tag alone: a 4-for-1 split, and a 1-for-10 reverse split read from the reported step", () => {
  const tag = (val: number, fy: number) => ({
    units: { pure: [{ end: `${fy}-06-30`, val, accn: accnFor(fy), fy, fp: "FY", form: "10-K", filed: filedFor(fy) }] }
  });
  // No restated comparatives: every filing keeps its own basis for earlier years.
  const forward = mapAnnualFacts(
    company((year) => (year >= 2023 ? 400 : 100), { StockholdersEquityNoteStockSplitConversionRatio1: tag(4, 2023) })
  );
  assert.deepEqual(
    forward.splits.map((split) => [split.ratio, split.effective_fiscal_year, split.evidence]),
    [[4, 2023, "tag"]]
  );
  assert.deepEqual(forward.annual.map((row) => row.shares_diluted), [400, 400, 400, 400]);
  assert.deepEqual(forward.annual.map((row) => row.eps_diluted), [0.25, 0.25, 0.25, 0.25]);

  const reverse = mapAnnualFacts(
    company((year) => (year >= 2022 ? 100 : 1000), { StockholdersEquityNoteStockSplitConversionRatio1: tag(10, 2022) })
  );
  assert.deepEqual(reverse.splits.map((split) => [split.ratio, split.effective_fiscal_year]), [[0.1, 2022]]);
  assert.deepEqual(reverse.annual.map((row) => row.shares_diluted), [100, 100, 100, 100]);
  assert.deepEqual(reverse.annual.map((row) => row.eps_diluted), [1, 1, 1, 1]);
  assert.deepEqual(reverse.annual[0]?.as_reported, { eps_diluted: 0.1, shares_diluted: 1000, shares_outstanding: 1000 });
});

test("a genuine 30% share issue is no split and stays in the share count", () => {
  const mapping = mapAnnualFacts(company((year) => (year >= 2023 ? 130 : 100)));
  assert.deepEqual(mapping.splits, []);
  assert.deepEqual(mapping.annual.map((row) => row.shares_diluted), [100, 100, 130, 130]);
  assert.ok(mapping.annual.every((row) => row.as_reported === undefined));
});

test("a restated value the year's own reports never stepped on adjusts nothing", () => {
  // Acme's FY2024 10-K shows FY2022 EPS at a quarter, but EPS and share counts as reported stay level.
  const mapping = mapAnnualFacts(acmeFacts());
  assert.deepEqual(mapping.splits, []);
  assert.ok(mapping.annual.every((row) => row.as_reported === undefined));
});

test("buildFactPack: splits are listed with a source only when there is one", async () => {
  const plain = await buildFactPack("acme", { clientOptions: { ...FAST, fetchImpl: fakeSec(acmeRoutes()).fetch } });
  assert.ok(plain);
  assert.equal("splits" in plain, false);

  const facts = company((_year, filingFy) => (filingFy >= 2023 ? 200 : 100));
  const sec = fakeSec({ [SEC.tickers]: TICKERS, [SEC.facts(CIK)]: facts, [SEC.submissions(CIK)]: acmeSubmissions() });
  const pack = await buildFactPack("acme", { clientOptions: { ...FAST, fetchImpl: sec.fetch } });
  assert.ok(pack);
  assert.deepEqual(pack.splits?.map((split) => [split.ratio, split.effective_fiscal_year]), [[2, 2023]]);
  assert.ok(pack.sources.some((source) => /^2-for-1 stock split from FY2023/.test(source.name)));
});

/** Flat company over `years`, profit 100: each 10-K carries its own year and two before at `basis(year, filingFy)`
 *  shares (cover page at its own year's basis); `drop` removes facts, `extra` adds filings or concepts. */
function wide(
  years: number[],
  basis: (year: number, filingFy: number) => number,
  options: { drop?: (concept: string, fact: XbrlFact) => boolean; extra?: Record<string, XbrlFact[]> } = {}
): CompanyFactsJson {
  const shares: XbrlFact[] = [];
  const eps: XbrlFact[] = [];
  const keep = (concept: string) => (f: XbrlFact) => !options.drop?.(concept, f);
  for (const filingFy of years) {
    for (const year of [filingFy - 2, filingFy - 1, filingFy]) {
      if (!years.includes(year)) continue;
      shares.push(fact(year, basis(year, filingFy), filingFy));
      eps.push(fact(year, Math.round((100 / basis(year, filingFy)) * 100) / 100, filingFy));
    }
  }
  const extra = options.extra ?? {};
  return {
    cik: 1,
    entityName: "Flat Co",
    facts: {
      dei: {
        EntityCommonStockSharesOutstanding: {
          units: { shares: [...cover(years, (fy) => basis(fy, fy)), ...(extra.cover ?? [])] }
        }
      },
      "us-gaap": {
        Revenues: { units: { USD: series(years, () => 1000) } },
        NetIncomeLoss: { units: { USD: [...series(years, () => 100), ...(extra.netIncome ?? [])] } },
        EarningsPerShareDiluted: {
          units: { "USD/shares": [...eps, ...(extra.eps ?? [])].filter(keep("eps")) }
        },
        WeightedAverageNumberOfDilutedSharesOutstanding: {
          units: { shares: [...shares, ...(extra.shares ?? [])].filter(keep("shares")) }
        },
        ...(extra.tag ? { StockholdersEquityNoteStockSplitConversionRatio1: { units: { pure: extra.tag } } } : {})
      }
    }
  };
}

const span = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, k) => from + k);
const rowsOf = (mapping: ReturnType<typeof mapAnnualFacts>) =>
  mapping.annual.map((row) => [row.fiscal_year, row.eps_diluted, row.shares_diluted, row.shares_outstanding]);

test("each value keeps its own basis: EPS from a restated comparative, the cover count from the year's report", () => {
  // The FY2022 10-K tagged no EPS or weighted shares at all, so FY2022 takes them from the FY2023 10-K, which is
  // after the 2-for-1 split; its cover page count is still on the old basis.
  const years = span(2018, 2024);
  const mapping = mapAnnualFacts(
    wide(years, (_year, filingFy) => (filingFy >= 2023 ? 200 : 100), { drop: (_c, f) => f.accn === "K2022" })
  );
  assert.deepEqual(
    mapping.splits.map((split) => [split.ratio, split.effective_fiscal_year]),
    [[2, 2023]]
  );
  assert.ok(rowsOf(mapping).every(([, eps, diluted, outstanding]) => eps === 0.5 && diluted === 200 && outstanding === 200));
  assert.deepEqual(mapping.annual.find((row) => row.fiscal_year === 2022)?.as_reported, { shares_outstanding: 100 });
});

test("an amendment filed on the new basis: its EPS stays, the original cover count is adjusted", () => {
  // The FY2022 10-K (filed 2023-02-20) is on the old basis; a 10-K/A filed 2023-05-01, after an April split,
  // restates it on the new basis.
  const years = span(2018, 2024);
  const amended = (year: number, val: number) => ({ ...fact(year, val, 2022, "10-K/A"), accn: "K2022A", filed: "2023-05-01" });
  const mapping = mapAnnualFacts(
    wide(years, (_year, filingFy) => (filingFy >= 2023 ? 200 : 100), {
      extra: {
        shares: [2020, 2021, 2022].map((year) => amended(year, 200)),
        eps: [2020, 2021, 2022].map((year) => amended(year, 0.5)),
        netIncome: [2020, 2021, 2022].map((year) => amended(year, 100))
      }
    })
  );
  assert.deepEqual(
    mapping.splits.map((split) => [split.ratio, split.effective_fiscal_year]),
    [[2, 2023]]
  );
  assert.ok(rowsOf(mapping).every(([, eps, diluted, outstanding]) => eps === 0.5 && diluted === 200 && outstanding === 200));
  assert.deepEqual(mapping.annual.find((row) => row.fiscal_year === 2022)?.as_reported, { shares_outstanding: 100 });
});

test("a split ratio tag is dated by its own context: an old split mentioned later is no split now", () => {
  // A genuine 50% issue in FY2020, and the FY2020 10-K tags a 2-for-1 split of 2014.
  const years = span(2016, 2024);
  const old = { end: "2014-06-30", val: 2, accn: "K2020", fy: 2020, fp: "FY", form: "10-K", filed: "2021-02-20" };
  const mapping = mapAnnualFacts(wide(years, (year) => (year >= 2020 ? 150 : 100), { extra: { tag: [old] } }));
  assert.deepEqual(mapping.splits, []);
  assert.deepEqual(
    mapping.annual.map((row) => row.shares_diluted),
    years.map((year) => (year >= 2020 ? 150 : 100))
  );
  // A tag dated in the year of the issue that the step does not bear out is no split either.
  const sameYear = { ...old, end: "2020-06-30" };
  assert.deepEqual(mapAnnualFacts(wide(years, (year) => (year >= 2020 ? 150 : 100), { extra: { tag: [sameYear] } })).splits, []);
});

test("two splits of one ratio, known only from the tag, are both applied", () => {
  const years = span(2016, 2024);
  const tag = (fy: number) => ({ end: `${fy}-06-30`, val: 2, accn: `K${fy}`, fy, fp: "FY", form: "10-K", filed: filedFor(fy) });
  // No restated comparatives: 100 before 2019, 200 for 2019-2022, 400 from 2023; later reports tag again.
  const basis = (year: number) => (year >= 2023 ? 400 : year >= 2019 ? 200 : 100);
  const mapping = mapAnnualFacts(wide(years, basis, { extra: { tag: [2019, 2020, 2023, 2024].map(tag) } }));
  assert.deepEqual(
    mapping.splits.map((split) => [split.ratio, split.effective_fiscal_year, split.evidence]),
    [
      [2, 2019, "tag"],
      [2, 2023, "tag"]
    ]
  );
  assert.ok(mapping.annual.every((row) => row.shares_diluted === 400 && row.eps_diluted === 0.25));
});

// ---------------------------------------------------------------- reporting currency change

function switcher(restatedComparative: boolean): CompanyFactsJson {
  const usd = [2021, 2022, 2023].flatMap((filingFy) =>
    [filingFy - 1, filingFy].filter((y) => y >= 2021).map((y) => fact(y, 1000 + y, filingFy))
  );
  const eur = [fact(2024, 900, 2024, "20-F")];
  if (restatedComparative) eur.push(fact(2023, 880, 2024, "20-F"));
  return {
    cik: 1,
    entityName: "Switch Co",
    facts: {
      "us-gaap": {
        Revenues: { units: { USD: usd, EUR: eur } },
        NetIncomeLoss: { units: { USD: usd.map((f) => ({ ...f, val: 100 })), EUR: eur.map((f) => ({ ...f, val: 90 })) } }
      }
    }
  };
}

test("a filer that switched currency is read in the latest year's currency; older years in the old one are left out", () => {
  const mapping = mapAnnualFacts(switcher(false));
  assert.equal(mapping.currency, "EUR");
  assert.deepEqual(mapping.annual.map((row) => [row.fiscal_year, row.revenue]), [[2024, 900]]);
  assert.deepEqual(mapping.droppedCurrencies, ["USD"]);

  // A 2024 report that restated 2023 in euros keeps 2023, in euros only.
  const restated = mapAnnualFacts(switcher(true));
  assert.deepEqual(
    restated.annual.map((row) => [row.fiscal_year, row.revenue, row.net_income]),
    [
      [2023, 880, 90],
      [2024, 900, 90]
    ]
  );
  assert.deepEqual(restated.droppedCurrencies, ["USD"]);

  // One currency throughout: nothing dropped.
  assert.deepEqual(mapAnnualFacts(acmeFacts()).droppedCurrencies, []);
});

test("buildFactPack: a currency switch ends the pack at the latest report and says older years are left out", async () => {
  const sec = fakeSec({ [SEC.tickers]: TICKERS, [SEC.facts(CIK)]: switcher(false), [SEC.submissions(CIK)]: acmeSubmissions() });
  const pack = await buildFactPack("acme", { clientOptions: { ...FAST, fetchImpl: sec.fetch } });
  assert.ok(pack);
  assert.equal(pack.currency, "EUR");
  assert.equal(pack.annual[pack.annual.length - 1]?.fiscal_year, 2024);
  assert.ok(pack.missing.includes("history_before_currency_change"));

  const plain = await buildFactPack("acme", { clientOptions: { ...FAST, fetchImpl: fakeSec(acmeRoutes()).fetch } });
  assert.ok(plain && !plain.missing.includes("history_before_currency_change"));
});

test("a home-currency filer that also tags a USD translation of the current year stays in its home currency", () => {
  const years = span(2019, 2025);
  const home = (val: (year: number) => number) =>
    years.flatMap((filingFy) => [filingFy - 2, filingFy - 1, filingFy].map((y) => fact(y, val(y), filingFy, "20-F")));
  const translated = (val: number) => years.map((fy) => fact(fy, val, fy, "20-F"));
  const json: CompanyFactsJson = {
    cik: 1,
    entityName: "Home Co",
    facts: {
      "us-gaap": {
        Revenues: { units: { EUR: home((y) => 900 + y - 2000), USD: translated(999) } },
        NetIncomeLoss: { units: { EUR: home(() => 90), USD: translated(99) } },
        Assets: { units: { EUR: years.map((fy) => ({ ...fact(fy, 4500, fy, "20-F"), start: undefined })) } }
      }
    }
  };
  const mapping = mapAnnualFacts(json);
  assert.equal(mapping.currency, "EUR");
  assert.deepEqual(mapping.droppedCurrencies, []);
  assert.deepEqual(
    mapping.annual.map((row) => [row.fiscal_year, row.revenue, row.total_assets]),
    span(2017, 2025).map((y) => [y, 900 + y - 2000, y >= 2019 ? 4500 : undefined])
  );
});
