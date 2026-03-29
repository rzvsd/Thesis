import { createHash, timingSafeEqual } from "node:crypto";

import type { SubscriptionTier } from "../../../packages/contracts/src";
import type { ProductApiConfig } from "./config";

export interface RevenueCatWebhookEvent {
  eventType: string;
  appUserId: string;
  billingPeriodEnd?: string;
}

export interface RevenueCatSubscriberSnapshot {
  tier: SubscriptionTier;
  billingPeriodEnd?: string;
  appUserId: string;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function parseIsoDate(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return new Date(parsed).toISOString();
}

function parseExpiration(event: Record<string, unknown>): string | undefined {
  const millisecondKeys = ["expiration_at_ms", "expires_at_ms", "period_ends_at_ms"];
  for (const key of millisecondKeys) {
    const raw = event[key];
    if (typeof raw === "number") {
      return parseIsoDate(raw);
    }
    if (typeof raw === "string" && raw.trim().length > 0) {
      const parsed = Number.parseInt(raw, 10);
      if (Number.isFinite(parsed)) {
        return parseIsoDate(parsed);
      }
    }
  }

  const isoKeys = [
    "expiration_at",
    "expires_at",
    "expires_date",
    "period_ends_at",
    "grace_period_expires_date"
  ];
  for (const key of isoKeys) {
    const iso = parseIsoDate(event[key]);
    if (iso) {
      return iso;
    }
  }

  return undefined;
}

function parseWebhookEnvelope(payload: unknown): Record<string, unknown> | undefined {
  const root = asRecord(payload);
  if (!root) {
    return undefined;
  }
  const nestedEvent = asRecord(root.event);
  return nestedEvent ?? root;
}

export function parseRevenueCatWebhookEvent(payload: unknown): RevenueCatWebhookEvent | undefined {
  const event = parseWebhookEnvelope(payload);
  if (!event) {
    return undefined;
  }

  const eventTypeRaw = event.type ?? event.event_type;
  if (typeof eventTypeRaw !== "string" || eventTypeRaw.trim().length === 0) {
    return undefined;
  }

  const appUserIdRaw = event.app_user_id ?? event.original_app_user_id ?? event.appUserId;
  if (typeof appUserIdRaw !== "string" || appUserIdRaw.trim().length === 0) {
    return undefined;
  }

  return {
    eventType: eventTypeRaw.trim().toUpperCase(),
    appUserId: appUserIdRaw.trim(),
    billingPeriodEnd: parseExpiration(event)
  };
}

function normalizeSecretHeader(header: string | undefined): string | undefined {
  if (!header) {
    return undefined;
  }
  const trimmed = header.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (trimmed.toLowerCase().startsWith("bearer ")) {
    return trimmed.slice(7).trim();
  }
  return trimmed;
}

export function verifyRevenueCatWebhookSecret(
  providedHeader: string | undefined,
  expectedSecret: string | undefined
): boolean {
  if (!expectedSecret) {
    return false;
  }
  const provided = normalizeSecretHeader(providedHeader);
  if (!provided) {
    return false;
  }

  const expectedBuffer = Buffer.from(expectedSecret, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

function pickEntitlement(
  subscriber: Record<string, unknown>,
  configuredEntitlementId: string | undefined
): Record<string, unknown> | undefined {
  const entitlements = asRecord(subscriber.entitlements);
  if (!entitlements) {
    return undefined;
  }

  if (configuredEntitlementId) {
    return asRecord(entitlements[configuredEntitlementId]);
  }

  const now = Date.now();
  for (const value of Object.values(entitlements)) {
    const entitlement = asRecord(value);
    if (!entitlement) {
      continue;
    }
    const expiresAt = parseIsoDate(entitlement.expires_date ?? entitlement.expires_at);
    if (!expiresAt || Date.parse(expiresAt) > now) {
      return entitlement;
    }
  }

  return undefined;
}

export async function fetchRevenueCatSubscriberSnapshot(
  config: ProductApiConfig,
  appUserId: string
): Promise<RevenueCatSubscriberSnapshot> {
  if (!config.revenuecatServerApiKey) {
    throw new Error("REVENUECAT_SERVER_API_KEY is required for sync-tier.");
  }
  if (!config.revenuecatEntitlementId) {
    throw new Error("REVENUECAT_ENTITLEMENT_ID is required for sync-tier.");
  }

  const encodedUserId = encodeURIComponent(appUserId.trim());
  const baseUrl = config.revenuecatApiBaseUrl.trim().replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/subscribers/${encodedUserId}`, {
    method: "GET",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${config.revenuecatServerApiKey}`
    }
  });

  if (!response.ok) {
    throw new Error(`RevenueCat subscriber lookup failed (${response.status})`);
  }

  const payload = await response.json();
  const root = asRecord(payload);
  const subscriber = root ? asRecord(root.subscriber) : undefined;
  if (!subscriber) {
    throw new Error("RevenueCat response missing subscriber.");
  }

  const entitlement = pickEntitlement(subscriber, config.revenuecatEntitlementId);
  if (!entitlement) {
    return {
      appUserId: appUserId.trim(),
      tier: "FREE"
    };
  }

  const expiration = parseIsoDate(entitlement.expires_date ?? entitlement.expires_at);
  const isActive = !expiration || Date.parse(expiration) > Date.now();
  return {
    appUserId: appUserId.trim(),
    tier: isActive ? "PRO" : "FREE",
    billingPeriodEnd: isActive ? expiration : undefined
  };
}

export function hashRevenueCatAppUserId(appUserId: string): string {
  return createHash("sha256").update(appUserId).digest("hex").slice(0, 16);
}
