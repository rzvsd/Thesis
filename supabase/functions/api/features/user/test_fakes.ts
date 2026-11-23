// In-memory fakes for the M1 user, watchlist, holdings, devices and tickers handlers (tests only).
import type { Tier } from "../../../_lib/store/users.ts";
import type { HoldingInput, HoldingRecord } from "../../../_lib/store/holdings.ts";
import type { NotificationPreference } from "../../../_lib/store/profile.ts";
import type { DeviceUpsert } from "../../../_lib/store/devices.ts";
import type { TickerSearchResult } from "../../../_lib/store/tickers.ts";
import { noLimit } from "./http.ts";
import type { UserDeps } from "./index.ts";
import type { WatchlistDeps } from "../watchlist/index.ts";
import type { HoldingsDeps } from "../holdings/index.ts";
import type { DevicesDeps } from "../devices/index.ts";
import type { TickersDeps } from "../tickers/index.ts";

export interface FakeDevice {
  userId: string;
  installationId: string;
  deviceToken: string;
  platform: string;
  invalidatedAt?: string;
  reason?: string;
}

export class FakeStore {
  users = new Map<string, { id: string; email: string }>();
  tiers = new Map<string, Tier>();
  billingEnd = new Map<string, string>();
  usage = new Map<string, number>();
  registry: TickerSearchResult[] = [
    { symbol: "AAPL", company_name: "Apple Inc.", exchange: "NASDAQ" },
    { symbol: "MSFT", company_name: "Microsoft Corporation", exchange: "NASDAQ" },
    { symbol: "TSLA", company_name: "Tesla, Inc.", exchange: "NASDAQ" },
    { symbol: "META", company_name: "Meta Platforms, Inc.", exchange: "NASDAQ" },
    { symbol: "NVDA", company_name: "NVIDIA Corporation", exchange: "NASDAQ" },
    { symbol: "BRK.B", company_name: "Berkshire Hathaway Inc.", exchange: "NYSE" },
  ];
  covered: string[] = ["AAPL", "MSFT"];
  watchlists = new Map<string, Set<string>>();
  holdings = new Map<string, Map<string, HoldingRecord>>();
  prefs = new Map<string, NotificationPreference[]>();
  optOut = new Map<string, boolean>();
  devices: FakeDevice[] = [];
  legacyCleared: string[] = [];
  failDeviceUpsert = false;

  addUser(id: string, email = `${id}@example.com`, tier: Tier = "FREE"): void {
    this.users.set(id, { id, email });
    this.tiers.set(id, tier);
  }

  tier = (userId: string) => Promise.resolve(this.tiers.get(userId) ?? "FREE");

  watchlist = (userId: string) => Promise.resolve([...(this.watchlists.get(userId) ?? [])].sort());

  follow = (userId: string, ticker: string) => {
    const set = this.watchlists.get(userId) ?? new Set<string>();
    set.add(ticker);
    this.watchlists.set(userId, set);
    return this.watchlist(userId);
  };

  isSupported = (ticker: string) => Promise.resolve(this.registry.some((r) => r.symbol === ticker));

  activeDevices(userId: string): FakeDevice[] {
    return this.devices.filter((d) => d.userId === userId && !d.invalidatedAt);
  }

  userDeps(): UserDeps {
    return {
      limit: noLimit,
      profile: async (userId) => {
        const { buildUserProfile } = await import("../../../_lib/store/profile.ts");
        return buildUserProfile(userId, {
          findUser: (id) => Promise.resolve(this.users.get(id)),
          subscription: (id) =>
            Promise.resolve({
              tier: this.tiers.get(id) ?? "FREE",
              billingPeriodEnd: this.billingEnd.get(id),
            }),
          deepDiveUsage: (id) => Promise.resolve(this.usage.get(id) ?? 0),
        });
      },
      tier: this.tier,
      getPreferences: (userId) => Promise.resolve(this.prefs.get(userId) ?? []),
      upsertPreferences: (userId, updates) => {
        const rows = this.prefs.get(userId) ?? [];
        for (const u of updates) {
          let row = rows.find((r) => r.type === u.type);
          if (!row) {
            row = { type: u.type, enabled: true };
            rows.push(row);
          }
          if (typeof u.enabled === "boolean") row.enabled = u.enabled;
          if (u.quietUntil !== undefined || typeof u.enabled === "boolean") {
            row.quietUntil = u.quietUntil ?? undefined;
          }
        }
        this.prefs.set(userId, rows);
        return Promise.resolve(rows);
      },
      getEmailOptOut: (userId) => Promise.resolve(this.optOut.get(userId) === true),
      setEmailOptOut: (userId, optOut) => {
        this.optOut.set(userId, optOut);
        return Promise.resolve();
      },
    };
  }

  watchlistDeps(): WatchlistDeps {
    return {
      limit: noLimit,
      list: this.watchlist,
      add: this.follow,
      remove: (userId, ticker) => {
        this.watchlists.get(userId)?.delete(ticker);
        return this.watchlist(userId);
      },
      isSupported: this.isSupported,
      tier: this.tier,
    };
  }

  holdingsDeps(): HoldingsDeps {
    return {
      limit: noLimit,
      list: (userId) =>
        Promise.resolve(
          [...(this.holdings.get(userId)?.values() ?? [])].sort((a, b) => a.ticker.localeCompare(b.ticker)),
        ),
      upsert: (userId, input: HoldingInput) => {
        const map = this.holdings.get(userId) ?? new Map<string, HoldingRecord>();
        const record: HoldingRecord = { ...input, updatedAt: "2026-11-23T00:00:00.000Z" };
        map.set(input.ticker, record);
        this.holdings.set(userId, map);
        return Promise.resolve(record);
      },
      remove: (userId, ticker) => Promise.resolve(this.holdings.get(userId)?.delete(ticker) ?? false),
      isSupported: this.isSupported,
      supported: (tickers) =>
        Promise.resolve(new Set(tickers.filter((t) => this.registry.some((r) => r.symbol === t)))),
      watchlist: this.watchlist,
      follow: this.follow,
      tier: this.tier,
    };
  }

  devicesDeps(): DevicesDeps {
    return {
      limit: noLimit,
      userExists: (userId) => Promise.resolve(this.users.has(userId)),
      upsert: (input: DeviceUpsert) => {
        if (this.failDeviceUpsert) return Promise.resolve(false);
        for (const d of this.devices) {
          if (
            d.deviceToken === input.deviceToken && !d.invalidatedAt &&
            !(d.userId === input.userId && d.installationId === input.installationId)
          ) {
            d.invalidatedAt = input.updatedAt;
            d.reason = "token_rotated";
          }
        }
        const existing = this.devices.find((d) =>
          d.userId === input.userId && d.installationId === input.installationId
        );
        if (existing) {
          Object.assign(existing, { deviceToken: input.deviceToken, platform: input.platform });
          existing.invalidatedAt = undefined;
          existing.reason = undefined;
        } else {
          this.devices.push({ ...input });
        }
        return Promise.resolve(true);
      },
      unregisterInstallation: (userId, installationId, at) => {
        for (const d of this.activeDevices(userId)) {
          if (d.installationId === installationId) {
            Object.assign(d, { invalidatedAt: at, reason: "client_unregistered" });
          }
        }
        return Promise.resolve();
      },
      unregisterLegacy: (userId, at) => {
        for (const d of this.activeDevices(userId)) {
          Object.assign(d, { invalidatedAt: at, reason: "legacy_unset" });
        }
        this.legacyCleared.push(userId);
        return Promise.resolve();
      },
    };
  }

  tickersDeps(): TickersDeps {
    return {
      limit: noLimit,
      search: (query, limit) => {
        const q = query.trim().toUpperCase();
        const hits = this.registry.filter((r) =>
          r.symbol.includes(q) || r.company_name.toUpperCase().includes(q)
        );
        const rank = (s: string) => (s === q ? 0 : s.startsWith(q) ? 1 : 2);
        hits.sort((a, b) => rank(a.symbol) - rank(b.symbol) || a.symbol.localeCompare(b.symbol));
        return Promise.resolve(hits.slice(0, limit));
      },
      listCovered: () => Promise.resolve([...this.covered]),
      isCovered: (ticker) => Promise.resolve(this.covered.includes(ticker)),
    };
  }
}

// Runs a request through the given routes, the way app.ts does after the auth guard.
import { type Route, Router } from "../../router.ts";
import { ctx, jsonRequest } from "../../../_lib/store/testing.ts";

export async function call(
  routes: Route[],
  method: string,
  path: string,
  opts: { userId?: string; body?: unknown; rawBody?: string } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const router = new Router([{ name: "t", owner: "M1", routes }]);
  const pathname = new URL(`http://test${path}`).pathname;
  const found = router.match(method, pathname);
  if (found.kind !== "found") throw new Error(`no route for ${method} ${path}`);
  const req = opts.rawBody !== undefined
    ? new Request(`http://test${path}`, { method, body: opts.rawBody })
    : jsonRequest(method, path, opts.body);
  const res = await found.route.handler(ctx(req, { userId: opts.userId ?? null, params: found.params }));
  return { status: res.status, body: await res.json() };
}
