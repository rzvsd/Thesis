import { createClient, type RedisClientType } from "redis";

import type { QueueBackend } from "./config";

export interface JobQueue {
  publish(jobId: string): Promise<void>;
  close(): Promise<void>;
}

class MemoryJobQueue implements JobQueue {
  private readonly jobs: string[] = [];

  async publish(jobId: string): Promise<void> {
    this.jobs.push(jobId);
  }

  async close(): Promise<void> {
    return Promise.resolve();
  }
}

class RedisJobQueue implements JobQueue {
  private readonly client: RedisClientType;
  private readonly queueKey: string;

  constructor(redisUrl: string, queueKey: string) {
    this.client = createClient({ url: redisUrl });
    this.queueKey = queueKey;
  }

  async connect(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  async publish(jobId: string): Promise<void> {
    await this.connect();
    await this.client.lPush(this.queueKey, jobId);
  }

  async close(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }
}

export async function createJobQueue(options: {
  backend: QueueBackend;
  queueKey: string;
  redisUrl?: string;
}): Promise<JobQueue> {
  if (options.backend === "memory") {
    return new MemoryJobQueue();
  }

  if (!options.redisUrl) {
    throw new Error("REDIS_URL is required for redis queue backend");
  }

  const queue = new RedisJobQueue(options.redisUrl, options.queueKey);
  await queue.connect();
  return queue;
}
