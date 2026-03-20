import { createClient, type RedisClientType } from "redis";

import type { QueueBackend } from "./config";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(identity: string, route: string): Promise<RateLimitResult>;
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

  async check(identity: string, route: string): Promise<RateLimitResult> {
    const now = Date.now();
    const key = `${identity}:${route}`;
    const existing = this.counters.get(key);

    if (!existing || existing.expiresAt <= now) {
      this.counters.set(key, {
        count: 1,
        expiresAt: now + this.windowSeconds * 1000
      });
      return {
        allowed: true,
        retryAfterSeconds: this.windowSeconds
      };
    }

    existing.count += 1;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.expiresAt - now) / 1000)
    );
    return {
      allowed: existing.count <= this.maxRequests,
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

  async check(identity: string, route: string): Promise<RateLimitResult> {
    await this.connect();
    const bucket = Math.floor(Date.now() / (this.windowSeconds * 1000));
    const key = `ratelimit:${identity}:${route}:${bucket}`;
    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.expire(key, this.windowSeconds);
    }
    const ttl = await this.client.ttl(key);

    return {
      allowed: count <= this.maxRequests,
      retryAfterSeconds: ttl > 0 ? ttl : this.windowSeconds
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
