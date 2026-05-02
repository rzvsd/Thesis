import type { DexterToolVisibility } from "./tool-contract";

const tradingAdviceTerms = [
  "buy",
  "sell",
  "hold",
  "short",
  "long",
  "price target",
  "entry",
  "exit",
  "stop loss",
  "take profit",
  "trade now",
  "add shares",
  "trim shares",
  "overweight",
  "underweight",
  "outperform",
  "underperform",
  "position size",
  "allocation"
];

const socialSources = new Set([
  "reddit",
  "x",
  "twitter",
  "youtube",
  "hackernews",
  "polymarket"
]);

const customerMetadataSources = new Set([
  "sec",
  "company_ir",
  "official",
  "fred",
  "treasury",
  "bea",
  "bls",
  "eia",
  "financial_data"
]);

export function containsTradingAdvice(text: string): boolean {
  const normalized = text.toLowerCase();
  return tradingAdviceTerms.some((term) =>
    new RegExp(`\\b${escapeRegExp(term).replace(/\\s+/g, "\\s+")}\\b`, "i").test(normalized)
  );
}

export function containsPriceTargetLanguage(text: string): boolean {
  return /\b(price\s+target|target\s+price|pt\s*[:=]|\$[0-9]+(?:\.[0-9]+)?\s+target)\b/i.test(text);
}

export function containsUnsupportedCausality(text: string): boolean {
  return /\b(because|caused by|due to|driven by|as a result of)\b/i.test(text);
}

export function classifySourceVisibility(sourceFamily: string): DexterToolVisibility {
  const normalized = sourceFamily.trim().toLowerCase();
  if (socialSources.has(normalized)) {
    return "internal_only";
  }
  if (customerMetadataSources.has(normalized)) {
    return "customer_metadata";
  }
  return "internal_only";
}

export function assertCustomerSafeText(text: string): void {
  if (containsTradingAdvice(text)) {
    throw new Error("customer text contains trading advice language");
  }
  if (containsPriceTargetLanguage(text)) {
    throw new Error("customer text contains price-target language");
  }
  if (containsUnsupportedCausality(text)) {
    throw new Error("customer text contains unsupported causality language");
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
