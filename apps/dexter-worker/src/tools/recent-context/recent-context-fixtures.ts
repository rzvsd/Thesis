import type { RecentContextProvider } from "./recent-context-adapter";
import {
  isRecentContextCustomerSafe,
  recentContextVisibility,
  type RecentContextSourceFamily
} from "./recent-context-policy";
import type { RecentContextFinding, RecentContextToolData, RecentContextToolInput } from "./recent-context-tool";

interface FixtureSeed {
  source_family: RecentContextSourceFamily;
  title: string;
  url: string;
  topic: string;
  stance: "positive" | "negative" | "mixed" | "unclear";
  attention_score?: number;
}

const fixtureSeeds: Record<string, FixtureSeed[]> = {
  AAPL: [
    {
      source_family: "company_ir",
      title: "Apple investor relations calendar references upcoming earnings",
      url: "https://www.apple.com/investor-relations/",
      topic: "earnings",
      stance: "unclear"
    },
    {
      source_family: "reddit",
      title: "Community discussion focuses on AI device expectations",
      url: "https://www.reddit.com/",
      topic: "ai_device_attention",
      stance: "mixed",
      attention_score: 0.58
    }
  ],
  MSFT: [
    {
      source_family: "company_ir",
      title: "Microsoft investor relations highlights cloud and AI disclosures",
      url: "https://www.microsoft.com/en-us/investor",
      topic: "cloud_ai",
      stance: "positive"
    },
    {
      source_family: "hackernews",
      title: "Developer discussion questions AI infrastructure spending durability",
      url: "https://news.ycombinator.com/",
      topic: "ai_infrastructure",
      stance: "mixed",
      attention_score: 0.5
    }
  ],
  TSLA: [
    {
      source_family: "company_ir",
      title: "Tesla investor relations points readers to vehicle delivery materials",
      url: "https://ir.tesla.com/",
      topic: "deliveries",
      stance: "unclear"
    },
    {
      source_family: "x",
      title: "Social attention increased around delivery and margin debate",
      url: "https://x.com/",
      topic: "delivery_margin_attention",
      stance: "mixed",
      attention_score: 0.66
    }
  ],
  MACRO_INFLATION: [
    {
      source_family: "official",
      title: "Official inflation release remains a key macro checkpoint",
      url: "https://www.bls.gov/cpi/",
      topic: "inflation",
      stance: "unclear"
    }
  ],
  GEOPOLITICAL_RISK: [
    {
      source_family: "polymarket",
      title: "Prediction-market attention shifted around Taiwan risk",
      url: "https://polymarket.com/",
      topic: "taiwan_risk_attention",
      stance: "mixed",
      attention_score: 0.64
    }
  ]
};

export class FixtureRecentContextProvider implements RecentContextProvider {
  async search(input: RecentContextToolInput): Promise<RecentContextToolData> {
    const key = resolveFixtureKey(input);
    const seeds = fixtureSeeds[key] ?? fixtureSeeds.MACRO_INFLATION;
    const observedAt = new Date().toISOString();
    const findings = (seeds ?? []).slice(0, input.maxResults).map((seed): RecentContextFinding => ({
      source_family: seed.source_family,
      title: seed.title,
      url: seed.url,
      observed_at: observedAt,
      topic: seed.topic,
      attention_score: seed.attention_score,
      stance: seed.stance,
      summary: seed.source_family === "polymarket"
        ? "Attention signal only; not event confirmation."
        : undefined,
      customer_safe: isRecentContextCustomerSafe(seed.source_family),
      visibility: recentContextVisibility(seed.source_family)
    }));

    return {
      query: input.query,
      lookback_days: input.lookbackDays,
      findings,
      topic_summary: summarizeTopics(findings)
    };
  }
}

function resolveFixtureKey(input: RecentContextToolInput): string {
  const ticker = input.ticker?.trim().toUpperCase();
  if (ticker && fixtureSeeds[ticker]) {
    return ticker;
  }
  const query = input.query.toLowerCase();
  if (query.includes("taiwan") || query.includes("geopolitical")) {
    return "GEOPOLITICAL_RISK";
  }
  if (query.includes("inflation") || query.includes("cpi")) {
    return "MACRO_INFLATION";
  }
  return "MACRO_INFLATION";
}

function summarizeTopics(findings: RecentContextFinding[]): RecentContextToolData["topic_summary"] {
  const groups = new Map<string, RecentContextFinding[]>();
  findings.forEach((finding) => {
    groups.set(finding.topic, [...(groups.get(finding.topic) ?? []), finding]);
  });
  return [...groups.entries()].map(([topic, items]) => ({
    topic,
    finding_count: items.length,
    dominant_stance: dominantStance(items),
    customer_safe: items.every((item) => item.customer_safe)
  }));
}

function dominantStance(items: RecentContextFinding[]): "positive" | "negative" | "mixed" | "unclear" {
  const stances = new Set(items.map((item) => item.stance ?? "unclear"));
  if (stances.size === 1) {
    return [...stances][0] ?? "unclear";
  }
  return "mixed";
}
