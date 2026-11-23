// RevenueCat logic. Owner: M4. Ported from apps/product-api/src/revenuecat.ts and the event rules in
// routes/revenuecat-routes.ts. Logic kept; Node crypto replaced by WebCrypto and the shared timing-safe compare.
// Nothing here charges money: the webhook only records what RevenueCat says, and sync-tier only reads.
import { timingSafeEqual } from "../../_shared/auth.ts";
import type { Tier } from "../store/users.ts";

export interface RevenueCatWebhookEvent {
  eventType: string;
  appUserId: string;
  billingPeriodEnd?: string;
}

export interface RevenueCatSubscriberSnapshot {
  tier: Tier;
  billingPeriodEnd?: string;
  appUserId: string;
}

export interface SubscriptionRecord {
  userId: string;
  tier: Tier;
  billingPeriodEnd?: string;
  revenuecatAppUserId?: string;
}

export interface RevenueCatConfig {
  serverApiKey?: string;
  entitlementId?: string;
  apiBaseUrl: string;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function parseIsoDate(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
}

function parseExpiration(event: Record<string, unknown>): string | undefined {
  for (const key of ["expiration_at_ms", "expires_at_ms", "period_ends_at_ms"]) {
    const raw = event[key];
    if (typeof raw === "number") return parseIsoDate(raw);
    if (typeof raw === "string" && raw.trim().length > 0) {
      const parsed = Number.parseInt(raw, 10);
      if (Number.isFinite(parsed)) return parseIsoDate(parsed);
    }
  }
  for (
    const key of [
      "expiration_at",
      "expires_at",
      "expires_date",
      "period_ends_at",
      "grace_period_expires_date",
    ]
  ) {
    const iso = parseIsoDate(event[key]);
    if (iso) return iso;
  }
  return undefined;
}

export function parseRevenueCatWebhookEvent(payload: unknown): RevenueCatWebhookEvent | undefined {
  const root = asRecord(payload);
  if (!root) return undefined;
  const event = asRecord(root.event) ?? root;
  const eventTypeRaw = event.type ?? event.event_type;
  if (typeof eventTypeRaw !== "string" || eventTypeRaw.trim().length === 0) return undefined;
  const appUserIdRaw = event.app_user_id ?? event.original_app_user_id ?? event.appUserId;
  if (typeof appUserIdRaw !== "string" || appUserIdRaw.trim().length === 0) return undefined;
  return {
    eventType: eventTypeRaw.trim().toUpperCase(),
    appUserId: appUserIdRaw.trim(),
    billingPeriodEnd: parseExpiration(event),
  };
}

// RevenueCat sends the secret we set in its dashboard as the Authorization header, with or without "Bearer ".
export function verifyRevenueCatWebhookSecret(
  providedHeader: string | null | undefined,
  expectedSecret: string | undefined,
): boolean {
  if (!expectedSecret) return false;
  let provided = providedHeader?.trim();
  if (!provided) return false;
  if (provided.toLowerCase().startsWith("bearer ")) provided = provided.slice(7).trim();
  if (!provided) return false;
  return timingSafeEqual(provided, expectedSecret);
}

const GRANT_EVENTS = [
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
  "PRODUCT_CHANGE",
  "SUBSCRIPTION_EXTENDED",
];
const EXPIRE_EVENTS = ["EXPIRATION", "BILLING_ISSUE", "SUBSCRIPTION_PAUSED"];

// CANCELLATION keeps Pro until the period ends (auto-renew off). Unknown events change nothing.
export function applyWebhookEventToSubscription(
  current: Pick<SubscriptionRecord, "tier" | "billingPeriodEnd">,
  eventType: string,
  billingPeriodEnd: string | undefined,
): Pick<SubscriptionRecord, "tier" | "billingPeriodEnd"> {
  if (GRANT_EVENTS.includes(eventType)) return { tier: "PRO", billingPeriodEnd };
  if (eventType === "CANCELLATION") {
    return { tier: "PRO", billingPeriodEnd: billingPeriodEnd ?? current.billingPeriodEnd };
  }
  if (EXPIRE_EVENTS.includes(eventType)) return { tier: "FREE", billingPeriodEnd: undefined };
  return { tier: current.tier, billingPeriodEnd: current.billingPeriodEnd };
}

function pickEntitlement(
  subscriber: Record<string, unknown>,
  entitlementId: string | undefined,
  nowMs: number,
): Record<string, unknown> | undefined {
  const entitlements = asRecord(subscriber.entitlements);
  if (!entitlements) return undefined;
  if (entitlementId) return asRecord(entitlements[entitlementId]);
  for (const value of Object.values(entitlements)) {
    const entitlement = asRecord(value);
    if (!entitlement) continue;
    const expiresAt = parseIsoDate(entitlement.expires_date ?? entitlement.expires_at);
    if (!expiresAt || Date.parse(expiresAt) > nowMs) return entitlement;
  }
  return undefined;
}

// GET /subscribers/:id on the RevenueCat REST API (read only).
export async function fetchRevenueCatSubscriberSnapshot(
  config: RevenueCatConfig,
  appUserId: string,
  fetchFn: FetchLike = fetch,
  nowMs: number = Date.now(),
): Promise<RevenueCatSubscriberSnapshot> {
  if (!config.serverApiKey) throw new Error("REVENUECAT_SERVER_API_KEY is required for sync-tier.");
  if (!config.entitlementId) throw new Error("REVENUECAT_ENTITLEMENT_ID is required for sync-tier.");
  const baseUrl = config.apiBaseUrl.trim().replace(/\/$/, "");
  const res = await fetchFn(`${baseUrl}/subscribers/${encodeURIComponent(appUserId.trim())}`, {
    method: "GET",
    headers: { accept: "application/json", authorization: `Bearer ${config.serverApiKey}` },
  });
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`RevenueCat subscriber lookup failed (${res.status})`);
  }
  const root = asRecord(await res.json());
  const subscriber = root ? asRecord(root.subscriber) : undefined;
  if (!subscriber) throw new Error("RevenueCat response missing subscriber.");
  const entitlement = pickEntitlement(subscriber, config.entitlementId, nowMs);
  if (!entitlement) return { appUserId: appUserId.trim(), tier: "FREE" };
  const expiration = parseIsoDate(entitlement.expires_date ?? entitlement.expires_at);
  const isActive = !expiration || Date.parse(expiration) > nowMs;
  return {
    appUserId: appUserId.trim(),
    tier: isActive ? "PRO" : "FREE",
    billingPeriodEnd: isActive ? expiration : undefined,
  };
}

// First 16 hex chars of SHA-256, so logs and audit rows never hold the raw RevenueCat id.
export async function hashRevenueCatAppUserId(appUserId: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(appUserId));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}
