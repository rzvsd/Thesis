// Stock splits in SEC company facts, and the adjustment of per-share values and share counts to one basis.
//
// companyfacts.ts takes per-share values and share counts from each year's own annual report, so a split shows
// as a step: a 2-for-1 split halves EPS and doubles the share count from the first year reported after it. This
// module finds splits from evidence in the filings and rescales the earlier rows to the latest year's basis.
//
// Evidence:
// - restatement: later filings restate earlier periods on the new basis. For one period and concept, a value
//   filed after another whose ratio to it is within 2% of a clean split ratio (3-for-2, 2-for-1 ... 50-for-1, and
//   the reverse splits) means a split took effect between the two filing dates. EPS evidence counts only when
//   net income for the period did not move with it (an amendment that cut profit is not a split), and only for
//   EPS of at least 0.05 in size (cents rounding makes smaller ratios noise).
// - tag: us-gaap:StockholdersEquityNoteStockSplitConversionRatio1. Each fact is dated by its own context (the
//   split took effect on its date, or within its period) and by the filing that carries it, so a later report
//   that mentions an old split opens no window of its own, and two splits of one ratio stay two splits.
//
// The split's effective year is the first fiscal year whose own annual report is on the new basis: a report
// filed on or before the window opened is on the old basis, one filed after it closed on the new basis, and one
// in between goes with whichever basis its share count (or EPS) sits closer to. Each value then carries its
// own basis, from the filing it was taken from: eps_diluted and shares_diluted may come from a later filing
// (an amendment, or a restated comparative when the year's own report did not tag them) while
// shares_outstanding is the cover page of the year's own report. A value filed on or before the window opened
// is rescaled, a value filed after it closed is not, and a value filed inside it goes with the basis its
// neighbouring years' values point to. A split is applied only when the year's own reports step across the
// boundary in the split's direction (the adjusted step is closer to flat than the raw step), so a restated
// value that the year's own reports never stepped on changes nothing. Values already on the new basis are
// never rescaled, so nothing is adjusted twice.
import type { FactIndex, XbrlFact } from "./companyfacts";
import type { AnnualFacts, AsReported, StockSplit } from "./types";

export const SPLIT_TAG = "us-gaap:StockholdersEquityNoteStockSplitConversionRatio1";

/** New shares per old share. Forward ratios are 1.5 or more; reverse ratios are their inverses. */
const FORWARD = [1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30, 40, 50];
export const CLEAN_RATIOS = [...FORWARD, ...FORWARD.map((ratio) => 1 / ratio)];

const DAY_MS = 86_400_000;
const EPS_MIN = 0.05;
const NET_INCOME_TOLERANCE = 0.05;
const TAG_TOLERANCE = Math.log(1.15);

/** The clean split ratio within `tolerance` (relative) of `ratio`, else null. */
export function cleanRatio(ratio: number, tolerance: number): number | null {
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  for (const clean of CLEAN_RATIOS) {
    if (Math.abs(ratio / clean - 1) <= tolerance) return clean;
  }
  return null;
}

interface Concepts {
  shares: string[];
  eps: string[];
  netIncome: string[];
}

const CONCEPTS: Record<"us-gaap" | "ifrs-full", Concepts> = {
  "us-gaap": {
    shares: [
      "us-gaap:WeightedAverageNumberOfDilutedSharesOutstanding",
      "us-gaap:WeightedAverageNumberOfSharesOutstandingBasic"
    ],
    eps: [
      "us-gaap:EarningsPerShareDiluted",
      "us-gaap:EarningsPerShareBasic",
      "us-gaap:EarningsPerShareBasicAndDiluted"
    ],
    netIncome: ["us-gaap:NetIncomeLoss", "us-gaap:ProfitLoss"]
  },
  "ifrs-full": {
    shares: ["ifrs-full:WeightedAverageShares", "ifrs-full:AdjustedWeightedAverageShares"],
    eps: ["ifrs-full:DilutedEarningsLossPerShare", "ifrs-full:BasicEarningsLossPerShare"],
    netIncome: ["ifrs-full:ProfitLossAttributableToOwnersOfParent", "ifrs-full:ProfitLoss"]
  }
};

export type ShareField = "eps_diluted" | "shares_diluted" | "shares_outstanding";
const SHARE_FIELDS: ShareField[] = ["eps_diluted", "shares_diluted", "shares_outstanding"];

/** One annual row with the filing dates the split check needs. */
export interface SplitRow {
  row: AnnualFacts;
  /** Filing date of the annual report that first reported the year. */
  originalFiled: string;
  /** Filing date of the fact each per-share value or share count was taken from. */
  filed: Partial<Record<ShareField, string>>;
}

interface Evidence {
  /** Fixed ratio (restatement, or a tag below 1), or null when a tag value may be read either way. */
  ratio: number | null;
  /** Tag value when the direction is open. */
  tagValue?: number;
  /** The split took effect after a filing filed on `lo` and on or before a filing filed on `hi`. */
  lo: string;
  hi: string;
  evidence: StockSplit["evidence"];
  concept: string;
  accession?: string;
}

function isAnnualDuration(fact: XbrlFact): boolean {
  if (!fact.start) return false;
  const length = (Date.parse(fact.end) - Date.parse(fact.start)) / DAY_MS;
  return length >= 350 && length <= 380;
}

/** One value per filing for each period end of a concept, filings in filing order. */
function byPeriod(index: FactIndex, concept: string, unit: string): Map<string, XbrlFact[]> {
  const out = new Map<string, XbrlFact[]>();
  const facts = index
    .annualFacts(concept, unit)
    .filter(isAnnualDuration)
    .sort((a, b) => (a.filed < b.filed ? -1 : a.filed > b.filed ? 1 : 0));
  for (const fact of facts) {
    const list = out.get(fact.end) ?? [];
    if (!list.some((seen) => seen.accn === fact.accn)) list.push(fact);
    out.set(fact.end, list);
  }
  return out;
}

function restatementEvidence(index: FactIndex, concepts: Concepts, currency: string): Evidence[] {
  const out: Evidence[] = [];
  const netIncome = new Map<string, Map<string, number>>();
  for (const concept of concepts.netIncome) {
    for (const [end, facts] of byPeriod(index, concept, currency)) {
      const perFiling = netIncome.get(end) ?? new Map<string, number>();
      for (const fact of facts) if (!perFiling.has(fact.accn)) perFiling.set(fact.accn, fact.val);
      netIncome.set(end, perFiling);
    }
  }
  const scan = (concept: string, unit: string, kind: "shares" | "eps") => {
    for (const [end, facts] of byPeriod(index, concept, unit)) {
      for (let k = 1; k < facts.length; k += 1) {
        const before = facts[k - 1]!;
        const after = facts[k]!;
        if (before.filed >= after.filed) continue;
        if (kind === "eps") {
          if (Math.min(Math.abs(before.val), Math.abs(after.val)) < EPS_MIN) continue;
          const ni0 = netIncome.get(end)?.get(before.accn);
          const ni1 = netIncome.get(end)?.get(after.accn);
          if (ni0 !== undefined && ni1 !== undefined && (ni0 === 0 || Math.abs(ni1 / ni0 - 1) > NET_INCOME_TOLERANCE)) {
            continue;
          }
        }
        const ratio = cleanRatio(kind === "shares" ? after.val / before.val : before.val / after.val, 0.02);
        if (ratio === null) continue;
        out.push({
          ratio,
          lo: before.filed,
          hi: after.filed,
          evidence: "restatement",
          concept,
          accession: after.accn
        });
      }
    }
  };
  for (const concept of concepts.shares) scan(concept, "shares", "shares");
  for (const concept of concepts.eps) scan(concept, `${currency}/shares`, "eps");
  return out;
}

function tagEvidence(index: FactIndex, rows: SplitRow[]): Evidence[] {
  const units = index.concept(SPLIT_TAG)?.units ?? {};
  const reports = rows.map((entry) => entry.originalFiled).sort();
  const seen = new Set<string>();
  const out: Evidence[] = [];
  for (const facts of Object.values(units)) {
    if (!Array.isArray(facts)) continue;
    for (const fact of facts) {
      if (typeof fact?.val !== "number" || typeof fact.filed !== "string" || typeof fact.accn !== "string") continue;
      if (typeof fact.end !== "string" || !fact.end) continue;
      const value = cleanRatio(fact.val, 0.02);
      if (value === null) continue;
      // The split took effect on the fact's date, or within its period, and the filing that tags it reports on
      // the new basis when it was filed after that. Annual reports filed before the context began are on the
      // old basis; the first one filed after it ended (or the tagging filing, if sooner) is on the new basis.
      const from = typeof fact.start === "string" && fact.start && fact.start < fact.end ? fact.start : fact.end;
      const lo = reports.filter((filed) => filed < from).pop() ?? "";
      let hi = reports.find((filed) => filed >= fact.end);
      if (fact.filed > lo && fact.filed >= fact.end && (hi === undefined || fact.filed < hi)) hi = fact.filed;
      if (hi === undefined || hi <= lo) continue;
      const key = `${value}|${lo}|${hi}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        ratio: value < 1 ? value : null,
        tagValue: value,
        lo,
        hi,
        evidence: "tag",
        concept: SPLIT_TAG,
        accession: fact.accn
      });
    }
  }
  return out;
}

const same = (a: number, b: number) => Math.abs(a / b - 1) < 1e-9;
const overlaps = (a: Evidence, b: Evidence) =>
  (a.lo > b.lo ? a.lo : b.lo) < (a.hi < b.hi ? a.hi : b.hi);

const width = (item: Evidence) => Date.parse(item.hi) - Date.parse(item.lo || "1900-01-01");
const ratioOf = (item: Evidence) => item.ratio ?? item.tagValue!;

/** Evidence of one split from several periods or concepts becomes one candidate with the narrowest window. */
function cluster(list: Evidence[]): Evidence[] {
  const out: Evidence[] = [];
  for (const item of list) {
    const match = out.find((seen) => {
      if (!overlaps(seen, item)) return false;
      if (seen.ratio !== null && item.ratio !== null) return same(seen.ratio, item.ratio);
      const a = ratioOf(seen);
      const b = ratioOf(item);
      return same(a, b) || same(a, 1 / b);
    });
    if (!match) {
      out.push({ ...item });
      continue;
    }
    if (match.lo < item.lo) match.lo = item.lo;
    if (match.hi > item.hi) {
      match.hi = item.hi;
      match.accession = item.accession;
    }
    // A restatement fixes the direction and is the stronger evidence.
    if (match.evidence === "tag" && item.evidence === "restatement") {
      match.ratio = item.ratio;
      match.evidence = item.evidence;
      match.concept = item.concept;
    }
  }
  // A wide window whose ratio is the product of narrower splits inside it (a period skipped by the filings in
  // between) is not a split of its own.
  out.sort((a, b) => width(a) - width(b));
  const kept: Evidence[] = [];
  for (const item of out) {
    const inner = kept.filter((seen) => seen.lo >= item.lo && seen.hi <= item.hi && seen.ratio !== null);
    if (inner.length > 0) {
      const product = inner.reduce((total, seen) => total * seen.ratio!, 1);
      const r = ratioOf(item);
      if (Math.abs(product / r - 1) < 0.03 || (item.ratio === null && Math.abs(product * r - 1) < 0.03)) continue;
    }
    kept.push(item);
  }
  return kept.sort((a, b) => (a.hi < b.hi ? -1 : a.hi > b.hi ? 1 : 0));
}

interface Measure {
  kind: "diluted" | "outstanding" | "implied" | "eps";
  /** Share-like: it moves with the ratio (EPS is inverted). */
  value: number;
}

function measures(row: AnnualFacts): Measure[] {
  const out: Measure[] = [];
  const positive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
  if (positive(row.shares_diluted)) out.push({ kind: "diluted", value: row.shares_diluted });
  if (positive(row.shares_outstanding)) out.push({ kind: "outstanding", value: row.shares_outstanding });
  const eps = row.eps_diluted;
  const ni = row.net_income;
  if (typeof eps === "number" && typeof ni === "number" && eps !== 0 && ni / eps > 0) {
    out.push({ kind: "implied", value: ni / eps });
  }
  if (typeof eps === "number" && Math.abs(eps) >= EPS_MIN) out.push({ kind: "eps", value: 1 / Math.abs(eps) });
  return out;
}

/** Ratio of a share-like measure from `before` to `after`, on the first measure both rows have. */
function step(before: AnnualFacts, after: AnnualFacts): number | null {
  const a = measures(before);
  const b = measures(after);
  for (const ma of a) {
    const mb = b.find((m) => m.kind === ma.kind);
    if (mb) return mb.value / ma.value;
  }
  return null;
}

const distance = (x: number) => Math.abs(Math.log(x));

type Basis = "pre" | "post";

const basisOf = (filed: string, item: Evidence): Basis | "open" =>
  filed <= item.lo ? "pre" : filed >= item.hi ? "post" : "open";

/** The row without the per-share values and share counts that may sit on another basis than its own report: a
 *  value from the report itself stays, and one from another filing stays only when filed on the same side of
 *  the window as the report. */
function ownView(entry: SplitRow, row: AnnualFacts, item: Evidence, state: Basis | "open"): AnnualFacts {
  const out: AnnualFacts = { ...row };
  for (const field of SHARE_FIELDS) {
    const filed = entry.filed[field];
    if (filed === undefined || filed === entry.originalFiled) continue;
    if (state === "open" || basisOf(filed, item) !== state) delete out[field];
  }
  return out;
}


/** Index of the first row whose own annual report is on the new basis, or null when the rows do not straddle the
 *  split. */
function boundary(rows: SplitRow[], original: AnnualFacts[], item: Evidence, ratio: number): number | null {
  const state = rows.map((entry) => basisOf(entry.originalFiled, item));
  for (let k = 0; k < rows.length; k += 1) {
    if (state[k] !== "open") continue;
    // Once a row is on the new basis every later row is too.
    if (state.slice(0, k).includes("post")) {
      state[k] = "post";
      continue;
    }
    const pre = k > 0 ? state.lastIndexOf("pre", k - 1) : -1;
    const post = state.findIndex((value, j) => j > k && value === "post");
    // Each row is read through the values on its own report's basis only.
    const view = (j: number) => ownView(rows[j]!, original[j]!, item, state[j]!);
    const before = pre >= 0 ? step(view(pre), view(k)) : null;
    const after = post >= 0 ? step(view(k), view(post)) : null;
    // With nothing to compare, the row keeps its reported values.
    let isPost = true;
    if (before !== null) isPost = distance(before / ratio) < distance(before);
    else if (after !== null) isPost = distance(after) <= distance(after / ratio);
    state[k] = isPost ? "post" : "pre";
  }
  const first = state.findIndex((s) => s === "post");
  if (first <= 0) return null;
  // The old basis is a prefix: a row after the first new-basis row never goes back.
  if (state.slice(first).some((s) => s !== "post")) return null;
  return first;
}

/** A per-share value or share count as a share-like number (it moves with the split ratio), or null. */
function shareLike(row: AnnualFacts, field: ShareField): number | null {
  const v = row[field];
  if (typeof v !== "number" || !Number.isFinite(v) || v === 0) return null;
  if (field === "eps_diluted") return Math.abs(v) >= EPS_MIN ? 1 / Math.abs(v) : null;
  return v > 0 ? v : null;
}

/**
 * The basis of each per-share value and share count, from the filing it was taken from. A value filed inside
 * the window goes with its row's own report when it came from that report, else with the basis the same value
 * of the nearest year with a known basis points to.
 */
function fieldBases(
  rows: SplitRow[],
  original: AnnualFacts[],
  item: Evidence,
  ratio: number,
  first: number
): Array<Partial<Record<ShareField, Basis>>> {
  const own = (k: number): Basis => (k < first ? "pre" : "post");
  const known = rows.map((entry, k) => {
    const out: Partial<Record<ShareField, Basis | "open">> = {};
    for (const field of SHARE_FIELDS) {
      const filed = entry.filed[field];
      if (filed === undefined || typeof original[k]![field] !== "number") continue;
      out[field] = filed === entry.originalFiled ? own(k) : basisOf(filed, item);
    }
    return out;
  });
  return known.map((fields, k) => {
    const out: Partial<Record<ShareField, Basis>> = {};
    for (const field of SHARE_FIELDS) {
      const basis = fields[field];
      if (basis === undefined) continue;
      if (basis !== "open") {
        out[field] = basis;
        continue;
      }
      out[field] = own(k);
      const value = shareLike(original[k]!, field);
      if (value === null) continue;
      for (const j of [k - 1, k + 1, k - 2, k + 2]) {
        const other = known[j]?.[field];
        const near = j >= 0 && j < rows.length ? shareLike(original[j]!, field) : null;
        if (other === undefined || other === "open" || near === null) continue;
        // The neighbour on the old basis, then which basis this value sits closer to.
        const r = value / (other === "post" ? near / ratio : near);
        out[field] = distance(r / ratio) < distance(r) ? "post" : "pre";
        break;
      }
    }
    return out;
  });
}

/** A row with every per-share value and share count moved to the basis of `target` (multiply by `ratio`). */
function onBasis(
  row: AnnualFacts,
  bases: Partial<Record<ShareField, Basis>>,
  target: Basis,
  ratio: number
): AnnualFacts {
  const out: AnnualFacts = { ...row };
  for (const field of SHARE_FIELDS) {
    const basis = bases[field];
    const v = out[field];
    if (basis === undefined || basis === target || typeof v !== "number") continue;
    const f = target === "post" ? ratio : 1 / ratio;
    out[field] = field === "eps_diluted" ? v / f : v * f;
  }
  return out;
}

const round = (value: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

/**
 * Finds stock splits within `rows` (oldest first) and rescales eps_diluted, shares_diluted and
 * shares_outstanding of the rows before each split to the latest row's basis, keeping the reported values in
 * as_reported. Mutates the rows; returns the splits applied, oldest first.
 */
export function adjustForSplits(
  index: FactIndex,
  rows: SplitRow[],
  taxonomy: "us-gaap" | "ifrs-full",
  currency: string
): StockSplit[] {
  if (rows.length < 2) return [];
  const evidence = [...restatementEvidence(index, CONCEPTS[taxonomy], currency), ...tagEvidence(index, rows)];
  if (evidence.length === 0) return [];
  const rank = (item: Evidence) => (item.evidence === "restatement" ? 0 : 1);
  evidence.sort((a, b) => (a.hi < b.hi ? -1 : a.hi > b.hi ? 1 : rank(a) - rank(b)));
  const original = rows.map((entry) => ({ ...entry.row }));
  const factor = rows.map(() => ({ eps_diluted: 1, shares_diluted: 1, shares_outstanding: 1 }));
  const splits: StockSplit[] = [];

  for (const item of cluster(evidence)) {
    let ratio = item.ratio;
    if (ratio === null) {
      // A tag of 10 may be a 10-for-1 split or a 1-for-10 reverse split: the as-reported step decides.
      const value = item.tagValue!;
      let last = -1;
      rows.forEach((entry, k) => {
        if (entry.originalFiled <= item.lo) last = k;
      });
      const next = rows.findIndex((entry) => entry.originalFiled >= item.hi);
      const s = last >= 0 && next > last ? step(original[last]!, original[next]!) : null;
      ratio = s !== null && distance(s * value) < distance(s / value) ? 1 / value : value;
    }
    const first = boundary(rows, original, item, ratio);
    if (first === null) continue;
    const bases = fieldBases(rows, original, item, ratio, first);
    // The year's own reports must step by the split: the adjusted step is closer to flat than the raw one. Each
    // year is read on the basis of its own report, whatever filing a value was taken from.
    const s = step(
      onBasis(original[first - 1]!, bases[first - 1]!, "pre", ratio),
      onBasis(original[first]!, bases[first]!, "post", ratio)
    );
    if (s !== null && !(distance(s / ratio) < distance(s))) continue;
    // A tag with no restated figures behind it must explain the step on its own: what is left after the split
    // stays within 15% of flat, so a share issue in the year a filing tags a split is not read as the split.
    if (item.evidence === "tag" && s !== null && distance(s / ratio) > TAG_TOLERANCE) continue;
    bases.forEach((fields, k) => {
      for (const field of SHARE_FIELDS) if (fields[field] === "pre") factor[k]![field] *= ratio;
    });
    splits.push({
      ratio,
      effective_fiscal_year: rows[first]!.row.fiscal_year,
      evidence: item.evidence,
      concept: item.concept,
      ...(item.accession ? { accession: item.accession } : {}),
      filed: item.hi
    });
  }

  rows.forEach((entry, k) => {
    const f = factor[k]!;
    const row = entry.row;
    const reported: AsReported = {};
    if (typeof row.eps_diluted === "number" && !same(f.eps_diluted, 1)) {
      reported.eps_diluted = row.eps_diluted;
      row.eps_diluted = round(row.eps_diluted / f.eps_diluted, 4);
    }
    if (typeof row.shares_diluted === "number" && !same(f.shares_diluted, 1)) {
      reported.shares_diluted = row.shares_diluted;
      row.shares_diluted = Math.round(row.shares_diluted * f.shares_diluted);
    }
    if (typeof row.shares_outstanding === "number" && !same(f.shares_outstanding, 1)) {
      reported.shares_outstanding = row.shares_outstanding;
      row.shares_outstanding = Math.round(row.shares_outstanding * f.shares_outstanding);
    }
    if (Object.keys(reported).length > 0) row.as_reported = reported;
  });
  return splits.sort((a, b) => a.effective_fiscal_year - b.effective_fiscal_year);
}
