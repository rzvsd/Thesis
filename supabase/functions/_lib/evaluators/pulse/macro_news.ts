// Copied from apps/product-api/src/pulse/macro-news.ts. Changed since (rebuild branch audit NG4 and NG6):
// - Keywords match whole words. The old code matched pieces of words, so "Warner", "award", "warns" and "software"
//   were war, "FedEx" was the Fed and "turmoil" was oil.
// - A shock headline is "corroborated" only when another source reports the same event, not when any two shock
//   headlines exist.
// - The macro filter reads every headline before any cap, so a Fed decision is not lost behind six newer items.
import type {
  MarketPulseHeadlineItem,
  MarketPulseMacroNewsConfirmationState,
  MarketPulseMacroNewsItem,
  MarketPulseMacroNewsPack,
  MarketPulseMacroNewsSeverity,
  MarketPulseMacroNewsTopic,
  ReportSection,
} from "./contracts.ts";
import { section, toEvidence } from "./common.ts";
// Trimmed and de-duplicated by source and headline, in the order given. No cap.
export function dedupeHeadlineItems(items: MarketPulseHeadlineItem[] | undefined): MarketPulseHeadlineItem[] {
  const seen = new Set<string>();
  const unique: MarketPulseHeadlineItem[] = [];
  for (const item of items ?? []) {
    const headline = item.headline.trim();
    const sourceName = item.source_name.trim();
    if (!headline || !sourceName) {
      continue;
    }
    const key = `${sourceName.toLowerCase()}::${headline.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push({
      ...item,
      headline,
      source_name: sourceName,
      evidence: item.evidence.slice(0, 3),
    });
  }
  return unique;
}

// The first six, for the headline digest.
export function uniqueHeadlineItems(items: MarketPulseHeadlineItem[] | undefined): MarketPulseHeadlineItem[] {
  return dedupeHeadlineItems(items).slice(0, 6);
}

// ---- Keyword matching. Every pattern matches whole words only. ----

// Armed conflict. "war" alone is not enough: business headlines use it for price wars, trade wars, bidding wars,
// a war chest or a war of words, and "War Room" is a feature of this app.
const WAR_RE =
  /(?<!\b(?:price|trade|tariff|bidding|turf|culture|talent|chip|streaming|currency|console|browser|format)\s)\b(?:wars?|warfare|wartime)\b(?!\s+(?:chest|room|of\s+words|on\s+(?:inflation|drugs|poverty|cancer|talent|cash)))/i;
// "attack" as violence, not a heart attack, panic attack or attack ad.
const ATTACK_RE = /(?<!\b(?:heart|panic|asthma|shark)\s)\b(?:attacks?|attacked)\b(?!\s+ads?\b)/i;
const INVASION_RE = /\b(?:invasions?|invades?|invaded|invading)\b/i;
const MISSILE_RE = /\b(?:missiles?|air\s?strikes?)\b/i;
// "emergency" as a state or policy step, not an emergency landing, room, fund or a drug's emergency use.
const EMERGENCY_RE =
  /\b(?:state\s+of\s+emergency|national\s+emergency|emergency\s+(?:rate|meeting|session|powers|measures|decree|law))\b/i;
const SANCTION_RE = /\b(?:sanctions?|sanctioned)\b/i;
const TARIFF_RE = /\btariffs?\b/i;
// "trade" as policy. Alone it is usually the verb ("stocks trade higher") or "traders".
const TRADE_POLICY_RE =
  /\b(?:trade\s+(?:war|wars|deal|deals|talks|policy|deficit|surplus|tensions?|pact|agreement|restrictions?|barriers?|truce|dispute)|export\s+(?:controls?|bans?|curbs?)|import\s+(?:duty|duties|bans?))\b/i;
const SHUTDOWN_RE = /\bshutdowns?\b/i;
const CRISIS_RE = /\bcris[ie]s\b/i;
const TAIWAN_RE = /\b(?:taiwan|taiwanese|taipei)\b/i;
const CHINA_RE = /\b(?:china|chinese|beijing)\b/i;
// Case-sensitive: "US" and "U.S.", not the word "us".
const US_RE = /\bUS\b|\bU\.S\.|\bUnited\s+States\b|\bAmerican?\b|\bWashington\b/;
const EUROPE_RE = /\b(?:europe|european|eurozone|euro\s+zone|ecb|brussels)\b/i;
const OIL_ENERGY_RE = /\b(?:oil|crude|opec|energy|natural\s+gas|lng)\b/i;
const SUPPLY_CHAIN_RE = /\b(?:supply\s+chains?|semiconductors?|shortages?)\b/i;
const CHIP_RE = /\b(?:semiconductors?|chips?|chipmakers?)\b/i;
// Case-sensitive "Fed" so "fed up" and "FedEx" do not count.
const FED_RE = /\bFed\b|\bFED\b|\bFOMC\b/;
const CENTRAL_BANK_RE =
  /\b(?:federal\s+reserve|ecb|european\s+central\s+bank|central\s+banks?|bank\s+of\s+(?:japan|england|canada)|boj|boe|rate\s+(?:cut|cuts|hike|hikes|decision))\b/i;
const RATES_RE = /\b(?:rates?|inflation|yields?|treasur(?:y|ies))\b/i;
const INFLATION_RE = /\b(?:inflation|cpi|pce)\b/i;

function isConflict(headline: string): boolean {
  return WAR_RE.test(headline) || ATTACK_RE.test(headline) || INVASION_RE.test(headline) ||
    MISSILE_RE.test(headline);
}

function isCentralBank(headline: string): boolean {
  return FED_RE.test(headline) || CENTRAL_BANK_RE.test(headline);
}

export function classifyMacroNewsTopic(headline: string): MarketPulseMacroNewsTopic {
  if (isConflict(headline)) {
    return "war_conflict";
  }
  if (TARIFF_RE.test(headline) || TRADE_POLICY_RE.test(headline)) {
    return "trade";
  }
  if (OIL_ENERGY_RE.test(headline)) {
    return "energy";
  }
  if (SUPPLY_CHAIN_RE.test(headline)) {
    return "supply_chain";
  }
  if (isCentralBank(headline)) {
    return "central_bank";
  }
  return "geopolitical";
}

export function classifyMacroNewsSeverity(headline: string): MarketPulseMacroNewsSeverity {
  if (isConflict(headline) || EMERGENCY_RE.test(headline)) {
    return "shock";
  }
  if (
    SANCTION_RE.test(headline) ||
    TARIFF_RE.test(headline) ||
    SHUTDOWN_RE.test(headline) ||
    CRISIS_RE.test(headline) ||
    TAIWAN_RE.test(headline)
  ) {
    return "notable";
  }
  return "normal";
}

// A headline is macro news when it carries one of these subjects. Topic tags from the source also count.
export function isMacroHeadline(headline: string): boolean {
  return CHINA_RE.test(headline) || TAIWAN_RE.test(headline) || isConflict(headline) ||
    EMERGENCY_RE.test(headline) || isCentralBank(headline) || TARIFF_RE.test(headline) ||
    TRADE_POLICY_RE.test(headline) || SANCTION_RE.test(headline) || OIL_ENERGY_RE.test(headline) ||
    INFLATION_RE.test(headline);
}

function macroNewsAffectedRegions(headline: string): string[] {
  const regions: string[] = [];
  if (TAIWAN_RE.test(headline)) {
    regions.push("Taiwan");
  }
  if (CHINA_RE.test(headline)) {
    regions.push("China");
  }
  if (US_RE.test(headline)) {
    regions.push("United States");
  }
  if (EUROPE_RE.test(headline)) {
    regions.push("Europe");
  }
  return regions.length > 0 ? regions : ["Global"];
}

function macroNewsAffectedAssets(headline: string, topic: MarketPulseMacroNewsTopic): string[] {
  const assets = new Set<string>();
  if (topic === "war_conflict" || topic === "geopolitical") {
    assets.add("volatility");
    assets.add("risk appetite");
  }
  if (TAIWAN_RE.test(headline) || CHIP_RE.test(headline)) {
    assets.add("semiconductors");
    assets.add("supply chains");
  }
  if (OIL_ENERGY_RE.test(headline)) {
    assets.add("energy");
  }
  if (isCentralBank(headline) || RATES_RE.test(headline)) {
    assets.add("rates");
  }
  return [...assets].slice(0, 5);
}

// ---- Same-event check for corroboration ----

const EVENT_STOPWORDS = new Set([
  "about",
  "after",
  "again",
  "against",
  "amid",
  "among",
  "analysts",
  "before",
  "being",
  "between",
  "could",
  "from",
  "have",
  "into",
  "more",
  "most",
  "near",
  "over",
  "report",
  "reports",
  "reported",
  "said",
  "says",
  "source",
  "sources",
  "than",
  "that",
  "their",
  "there",
  "these",
  "this",
  "those",
  "under",
  "what",
  "when",
  "which",
  "while",
  "will",
  "with",
  "would",
  "stocks",
  "shares",
  "market",
  "markets",
  "investors",
  "today",
]);

// The words that name what happened: four letters or more, lower case, without filler.
export function eventTokens(headline: string): Set<string> {
  const tokens = new Set<string>();
  for (const raw of headline.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 4 || EVENT_STOPWORDS.has(raw)) continue;
    // Fold simple plurals and past tense so "attacks" and "attacked" meet "attack".
    const folded = raw.replace(/(?:ed|s)$/, "");
    tokens.add(folded.length >= 4 ? folded : raw);
  }
  return tokens;
}

function sharedCount(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const token of a) if (b.has(token)) count += 1;
  return count;
}

// How many different sources report the same event as `item`, itself included. Two headlines are the same event
// when they share at least three event words; sharing only "attack" or "war" is not enough.
export function corroboratingSources(item: MarketPulseHeadlineItem, all: MarketPulseHeadlineItem[]): number {
  const mine = eventTokens(item.headline);
  const sources = new Set<string>([item.source_name.trim().toLowerCase()]);
  for (const other of all) {
    const source = other.source_name.trim().toLowerCase();
    if (sources.has(source)) continue;
    if (sharedCount(mine, eventTokens(other.headline)) >= 3) sources.add(source);
  }
  return sources.size;
}

function defaultMacroNewsWhyItMatters(
  headline: string,
  severity: MarketPulseMacroNewsSeverity,
  topic: MarketPulseMacroNewsTopic,
): string {
  if (severity === "shock") {
    return "A shock-level macro or geopolitical event can change the interpretation of market tape, volatility, rates, supply-chain exposure, and issuer-specific risk.";
  }
  if (topic === "central_bank" || topic === "macro_policy") {
    return "Policy-sensitive news can change the rate and inflation frame that Pulse uses to interpret the day.";
  }
  return `This headline is relevant to the macro backdrop and is treated as context, not a trading instruction: ${headline}`;
}

function normalizeMacroNewsInputs(
  items: MarketPulseMacroNewsItem[] | undefined,
): MarketPulseMacroNewsItem[] {
  const seen = new Set<string>();
  const normalized: MarketPulseMacroNewsItem[] = [];
  for (const item of items ?? []) {
    const headline = item.headline.trim();
    const sourceName = item.source_name.trim();
    if (!headline || !sourceName) {
      continue;
    }
    const key = `${sourceName.toLowerCase()}::${headline.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push({
      ...item,
      headline,
      source_name: sourceName,
      corroboration_count: Math.max(1, item.corroboration_count),
      evidence: item.evidence.slice(0, 4),
    });
  }
  return normalized.slice(0, 8);
}

// Maps approved news-ingest articles to headline metadata only (no article body), keeping http(s) links only.
export function headlineItemsFromApprovedNews(articles: unknown): MarketPulseHeadlineItem[] {
  if (!Array.isArray(articles)) {
    return [];
  }
  const items: MarketPulseHeadlineItem[] = [];
  for (const article of articles) {
    if (!article || typeof article !== "object") {
      continue;
    }
    const record = article as Record<string, unknown>;
    const headline = typeof record.title === "string" ? record.title.trim() : "";
    const sourceName = typeof record.source === "string" ? record.source.trim() : "";
    if (record.is_approved_source !== true || !headline || !sourceName) {
      continue;
    }
    const url = typeof record.url === "string" && /^https?:\/\//i.test(record.url.trim())
      ? record.url.trim()
      : undefined;
    const publishedAt = typeof record.published_at === "string" && record.published_at.trim()
      ? record.published_at.trim()
      : undefined;
    const retrievedAt = typeof record.retrieved_at === "string" && record.retrieved_at.trim()
      ? record.retrieved_at.trim()
      : publishedAt ?? new Date().toISOString();
    items.push({
      headline,
      source_name: sourceName,
      ...(url ? { source_url: url } : {}),
      ...(publishedAt ? { published_at: publishedAt } : {}),
      evidence: [toEvidence("article", sourceName, `Headline only: ${headline}`, retrievedAt, url)],
    });
  }
  return items;
}

function macroNewsFromHeadlines(
  items: MarketPulseHeadlineItem[] | undefined,
  generatedAt: string,
): MarketPulseMacroNewsItem[] {
  // Filter first, cap after: every headline is read, so an older macro item is not lost behind newer ones.
  const all = dedupeHeadlineItems(items);
  const candidates = all.filter((item) => {
    const topic = item.topic ?? "market";
    return topic === "macro" || topic === "policy" || isMacroHeadline(item.headline);
  });
  // Shock items lead, so the cap below can never drop one. Order is otherwise as given (newest first).
  const ordered = [
    ...candidates.filter((item) => classifyMacroNewsSeverity(item.headline) === "shock"),
    ...candidates.filter((item) => classifyMacroNewsSeverity(item.headline) !== "shock"),
  ];

  return ordered.slice(0, 8).map((item) => {
    const topic = classifyMacroNewsTopic(item.headline);
    const severity = classifyMacroNewsSeverity(item.headline);
    // Corroborated means a second source reports this same event, not that another shock headline exists.
    const sourceCount = severity === "shock" ? corroboratingSources(item, all) : 1;
    const confirmationState: MarketPulseMacroNewsConfirmationState = sourceCount >= 2
      ? "corroborated"
      : "reported";
    const affectedAssets = macroNewsAffectedAssets(item.headline, topic);
    return {
      headline: item.headline,
      source_name: item.source_name,
      source_url: item.source_url,
      published_at: item.published_at,
      topic,
      severity,
      confirmation_state: confirmationState,
      corroboration_count: sourceCount,
      affected_regions: macroNewsAffectedRegions(item.headline),
      affected_assets: affectedAssets.length > 0 ? affectedAssets : ["market context"],
      why_it_matters: defaultMacroNewsWhyItMatters(item.headline, severity, topic),
      evidence: item.evidence.length > 0 ? item.evidence.slice(0, 4) : [
        toEvidence(
          "article",
          item.source_name,
          `Headline only: ${item.headline}`,
          item.published_at ?? generatedAt,
          item.source_url,
        ),
      ],
    };
  });
}

function macroNewsState(items: MarketPulseMacroNewsItem[]): MarketPulseMacroNewsPack["state"] {
  if (items.some((item) => item.severity === "shock")) {
    return "shock";
  }
  if (items.some((item) => item.severity === "notable")) {
    return "watch";
  }
  return "calm";
}

export function buildMacroNewsPack(input: {
  asOf: string;
  generatedAt: string;
  headlineItems: MarketPulseHeadlineItem[] | undefined;
  macroNewsItems: MarketPulseMacroNewsItem[] | undefined;
  macroNewsFetchState: "complete" | "data_unavailable" | undefined;
  macroNewsUnavailableReason: string | undefined;
}): MarketPulseMacroNewsPack {
  const explicitItems = normalizeMacroNewsInputs(input.macroNewsItems);
  const headlineItems = macroNewsFromHeadlines(input.headlineItems, input.generatedAt);
  const items = normalizeMacroNewsInputs([...explicitItems, ...headlineItems]);
  const state = macroNewsState(items);
  const omissions: MarketPulseMacroNewsPack["omissions"] = [];
  const coverageNotes: string[] = [];

  if (input.macroNewsFetchState === "data_unavailable") {
    omissions.push({
      omission_id: "macro-news-source-unavailable",
      family: "macro_news",
      reason_code: "source_unavailable",
      reason_text: input.macroNewsUnavailableReason?.trim() ||
        "Approved macro/geopolitical headline inputs were unavailable for this issue.",
      blocking: false,
    });
  }
  if (items.length === 0) {
    coverageNotes.push("No approved macro or geopolitical headline inputs were supplied for this issue.");
  }
  if (items.some((item) => item.severity === "shock" && item.confirmation_state === "reported")) {
    coverageNotes.push(
      "Shock-level reported headlines require corroboration or official confirmation before being treated as confirmed facts.",
    );
  }

  const lead = state === "shock"
    ? "A shock-level macro or geopolitical headline is present; Pulse treats it as the first risk context and labels confirmation state explicitly."
    : state === "watch"
    ? "Notable macro or geopolitical headlines are present and should be read as context around the tape."
    : "No notable approved macro or geopolitical headline changed the issue lead.";

  return {
    as_of: input.asOf,
    state,
    lead,
    items,
    omissions,
    coverage_notes: coverageNotes,
  };
}

export function sectionFromMacroNews(pack: MarketPulseMacroNewsPack): ReportSection | undefined {
  if (pack.items.length === 0 && pack.omissions.length === 0) {
    return undefined;
  }
  const body = pack.items.length > 0
    ? pack.items
      .slice(0, 4)
      .map((item) => `${item.confirmation_state}: ${item.headline}. ${item.why_it_matters}`)
      .join(" ")
    : pack.coverage_notes.join(" ");
  const status: ReportSection["status"] = pack.omissions.length > 0 && pack.items.length === 0
    ? "data_incomplete"
    : "complete";
  return section(
    "macro_news",
    "Macro News",
    body || pack.lead,
    status,
    pack.items.flatMap((item) => item.evidence).slice(0, 8),
  );
}
