import { createClient, type RedisClientType } from "redis";

import type { QueueBackend } from "./config";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RateLimitPolicy {
  windowSeconds?: number;
  maxRequests?: number;
}

export interface RateLimiter {
  check(identity: string, route: string, policy?: RateLimitPolicy): Promise<RateLimitResult>;
  close(): Promise<void>;
}

class MemoryRateLimiter implements RateLimiter {
  private readonly windowSeconds: number;
  private readonly maxRequests: number;
  private readonly counters = new Map<string, { count: number; expiresAt: number }>();

  constructor(windowSeconds: number, maxRequests: number) {
    this.windowSeconds = windowSeconds;
    this.maxRequests = maxRequests;
  }

  async check(identity: string, route: string, policy?: RateLimitPolicy): Promise<RateLimitResult> {
    const now = Date.now();
    const windowSeconds =
      policy?.windowSeconds && policy.windowSeconds > 0
        ? Math.floor(policy.windowSeconds)
        : this.windowSeconds;
    const maxRequests =
      policy?.maxRequests && policy.maxRequests > 0
        ? Math.floor(policy.maxRequests)
        : this.maxRequests;
    const key = `${identity}:${route}:${windowSeconds}`;
    const existing = this.counters.get(key);

    if (!existing || existing.expiresAt <= now) {
      this.counters.set(key, {
        count: 1,
        expiresAt: now + windowSeconds * 1000
      });
      return {
        allowed: true,
        retryAfterSeconds: windowSeconds
      };
    }

    existing.count += 1;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.expiresAt - now) / 1000)
    );
    return {
      allowed: existing.count <= maxRequests,
      retryAfterSeconds
    };
  }

  async close(): Promise<void> {
    return Promise.resolve();
  }
}

class RedisRateLimiter implements RateLimiter {
  private readonly client: RedisClientType;
  private readonly windowSeconds: number;
  private readonly maxRequests: number;

  constructor(redisUrl: string, windowSeconds: number, maxRequests: number) {
    this.client = createClient({ url: redisUrl });
    this.windowSeconds = windowSeconds;
    this.maxRequests = maxRequests;
  }

  async connect(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  async check(identity: string, route: string, policy?: RateLimitPolicy): Promise<RateLimitResult> {
    await this.connect();
    const windowSeconds =
      policy?.windowSeconds && policy.windowSeconds > 0
        ? Math.floor(policy.windowSeconds)
        : this.windowSeconds;
    const maxRequests =
      policy?.maxRequests && policy.maxRequests > 0
        ? Math.floor(policy.maxRequests)
        : this.maxRequests;
    const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
    const key = `ratelimit:${windowSeconds}:${identity}:${route}:${bucket}`;
    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.expire(key, windowSeconds);
    }
    const ttl = await this.client.ttl(key);

    return {
      allowed: count <= maxRequests,
      retryAfterSeconds: ttl > 0 ? ttl : windowSeconds
    };
  }

  async close(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }
}

export async function createRateLimiter(options: {
  backend: QueueBackend;
  redisUrl?: string;
  windowSeconds: number;
  maxRequests: number;
}): Promise<RateLimiter> {
  if (options.backend === "memory") {
    return new MemoryRateLimiter(options.windowSeconds, options.maxRequests);
  }

  if (!options.redisUrl) {
    throw new Error("REDIS_URL is required for redis rate limiter backend");
  }

  const limiter = new RedisRateLimiter(
    options.redisUrl,
    options.windowSeconds,
    options.maxRequests
  );
  await limiter.connect();
  return limiter;
}
