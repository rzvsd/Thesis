import type { DexterToolVisibility } from "../tool-contract";
import { classifySourceVisibility } from "../tool-policy";

export type RecentContextSourceFamily =
  | "reddit"
  | "x"
  | "youtube"
  | "hackernews"
  | "polymarket"
  | "web"
  | "official"
  | "company_ir"
  | "sec";

export function recentContextVisibility(
  sourceFamily: RecentContextSourceFamily
): DexterToolVisibility {
  return classifySourceVisibility(sourceFamily);
}

export function isRecentContextCustomerSafe(
  sourceFamily: RecentContextSourceFamily
): boolean {
  return recentContextVisibility(sourceFamily) !== "internal_only";
}

export function isFactualConfirmationAllowed(
  sourceFamily: RecentContextSourceFamily
): boolean {
  return sourceFamily === "official" || sourceFamily === "company_ir" || sourceFamily === "sec";
}
