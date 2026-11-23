// Copied from apps/product-api/src/pulse/macro-news.ts (keep tested logic). Only imports changed.
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
export function uniqueHeadlineItems(items: MarketPulseHeadlineItem[] | undefined): MarketPulseHeadlineItem[] {
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
  return unique.slice(0, 6);
}
function classifyMacroNewsTopic(headline: string): MarketPulseMacroNewsTopic {
  const normalized = headline.toLowerCase();
  if (normalized.includes("attack") || normalized.includes("invasion") || normalized.includes("war")) {
    return "war_conflict";
  }
  if (normalized.includes("tariff") || normalized.includes("trade")) {
    return "trade";
  }
  if (normalized.includes("oil") || normalized.includes("energy")) {
    return "energy";
  }
  if (normalized.includes("supply") || normalized.includes("semiconductor")) {
    return "supply_chain";
  }
  if (normalized.includes("fed") || normalized.includes("ecb") || normalized.includes("central bank")) {
    return "central_bank";
  }
  return "geopolitical";
}

function classifyMacroNewsSeverity(headline: string): MarketPulseMacroNewsSeverity {
  const normalized = headline.toLowerCase();
  if (
    normalized.includes("attack") ||
    normalized.includes("invasion") ||
    normalized.includes("missile") ||
    normalized.includes("war") ||
    normalized.includes("emergency")
  ) {
    return "shock";
  }
  if (
    normalized.includes("sanction") ||
    normalized.includes("tariff") ||
    normalized.includes("shutdown") ||
    normalized.includes("crisis") ||
    normalized.includes("taiwan")
  ) {
    return "notable";
  }
  return "normal";
}

function macroNewsAffectedRegions(headline: string): string[] {
  const normalized = headline.toLowerCase();
  const regions: string[] = [];
  if (normalized.includes("taiwan")) {
    regions.push("Taiwan");
  }
  if (normalized.includes("china")) {
    regions.push("China");
  }
  if (normalized.includes("us ") || normalized.includes("u.s.") || normalized.includes("united states")) {
    regions.push("United States");
  }
  if (normalized.includes("europe") || normalized.includes("ecb")) {
    regions.push("Europe");
  }
  return regions.length > 0 ? regions : ["Global"];
}

function macroNewsAffectedAssets(headline: string, topic: MarketPulseMacroNewsTopic): string[] {
  const normalized = headline.toLowerCase();
  const assets = new Set<string>();
  if (topic === "war_conflict" || topic === "geopolitical") {
    assets.add("volatility");
    assets.add("risk appetite");
  }
  if (normalized.includes("taiwan") || normalized.includes("semiconductor") || normalized.includes("chip")) {
    assets.add("semiconductors");
    assets.add("supply chains");
  }
  if (normalized.includes("oil") || normalized.includes("energy")) {
    assets.add("energy");
  }
  if (normalized.includes("fed") || normalized.includes("rates") || normalized.includes("inflation")) {
    assets.add("rates");
  }
  return [...assets].slice(0, 5);
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
  const candidates = uniqueHeadlineItems(items).filter((item) => {
    const topic = item.topic ?? "market";
    const headline = item.headline.toLowerCase();
    return (
      topic === "macro" ||
      topic === "policy" ||
      headline.includes("china") ||
      headline.includes("taiwan") ||
      headline.includes("attack") ||
      headline.includes("war") ||
      headline.includes("fed") ||
      headline.includes("tariff") ||
      headline.includes("oil") ||
      headline.includes("inflation")
    );
  });

  const shockCandidateCount =
    candidates.filter((item) => classifyMacroNewsSeverity(item.headline) === "shock").length;

  return candidates.slice(0, 8).map((item) => {
    const topic = classifyMacroNewsTopic(item.headline);
    const severity = classifyMacroNewsSeverity(item.headline);
    const confirmationState: MarketPulseMacroNewsConfirmationState =
      severity === "shock" && shockCandidateCount >= 2 ? "corroborated" : "reported";
    const affectedAssets = macroNewsAffectedAssets(item.headline, topic);
    return {
      headline: item.headline,
      source_name: item.source_name,
      source_url: item.source_url,
      published_at: item.published_at,
      topic,
      severity,
      confirmation_state: confirmationState,
      corroboration_count: severity === "shock" ? Math.max(1, shockCandidateCount) : 1,
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
