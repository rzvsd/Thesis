import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig, type ProductApiConfig } from "../src/config";
import { runJobRecoveryPass } from "../src/job-recovery-scheduler";
import type { JobQueue } from "../src/queue";
import { InMemoryStore } from "../src/store";

class RecordingQueue implements JobQueue {
  readonly published: string[] = [];

  async publish(jobId: string): Promise<void> {
    this.published.push(jobId);
  }

  async close(): Promise<void> {
    return Promise.resolve();
  }
}

function createConfig(overrides: Partial<ProductApiConfig> = {}): ProductApiConfig {
  const base = loadConfig({
    STORE_BACKEND: "memory",
    QUEUE_BACKEND: "redis",
    JWT_SECRET: "dev-jwt-secret-change-me",
    INTERNAL_WORKER_TOKEN: "dev-internal-worker-token"
  });
  return {
    ...base,
    jobRecoveryEnabled: true,
    jobRecoveryRunOnStartup: false,
    jobRecoveryIntervalSeconds: 30,
    jobRecoveryBatchSize: 100,
    jobRecoveryQueuedStaleSeconds: 20,
    jobRecoveryRunningTimeoutSeconds: 120,
    jobRecoveryRequeueCooldownSeconds: 60,
    ...overrides
  };
}

test("job recovery requeues stale queued deep-dive jobs only", async () => {
  const store = new InMemoryStore();
  const queue = new RecordingQueue();
  const config = createConfig();
  const now = Date.now();

  await store.createJob({
    id: "job-stale-deep",
    type: "deep_dive",
    userId: "user-1",
    ticker: "AAPL",
    createdAt: new Date(now - 60_000).toISOString()
  });
  await store.createJob({
    id: "job-fresh-deep",
    type: "deep_dive",
    userId: "user-2",
    ticker: "MSFT",
    createdAt: new Date(now - 2_000).toISOString()
  });
  await store.createJob({
    id: "job-stale-pulse",
    type: "market_pulse",
    createdAt: new Date(now - 60_000).toISOString(),
    cycleStart: new Date(now - 80_000).toISOString(),
    cycleEnd: new Date(now - 20_000).toISOString()
  });

  const summary = await runJobRecoveryPass(store, queue, config, {
    lastRequeueAtMs: new Map<string, number>()
  });

  assert.equal(summary.queuedCandidates, 1);
  assert.equal(summary.requeued, 1);
  assert.deepEqual(queue.published, ["job-stale-deep"]);
});

test("job recovery respects requeue cooldown for already-requeued jobs", async () => {
  const store = new InMemoryStore();
  const queue = new RecordingQueue();
  const config = createConfig({
    jobRecoveryRequeueCooldownSeconds: 300
  });
  const now = Date.now();
  const state = {
    lastRequeueAtMs: new Map<string, number>()
  };

  await store.createJob({
    id: "job-stale-cooldown",
    type: "deep_dive",
    userId: "user-3",
    ticker: "TSLA",
    createdAt: new Date(now - 60_000).toISOString()
  });

  const first = await runJobRecoveryPass(store, queue, config, state);
  const second = await runJobRecoveryPass(store, queue, config, state);

  assert.equal(first.requeued, 1);
  assert.equal(second.requeued, 0);
  assert.equal(second.cooldownSkipped, 1);
  assert.deepEqual(queue.published, ["job-stale-cooldown"]);
});

test("job recovery marks stale running deep-dive jobs as failed", async () => {
  const store = new InMemoryStore();
  const queue = new RecordingQueue();
  const config = createConfig({
    jobRecoveryRunningTimeoutSeconds: 30
  });
  const now = Date.now();
  const startedAt = new Date(now - 60_000).toISOString();

  await store.createJob({
    id: "job-running-stale",
    type: "deep_dive",
    userId: "user-4",
    ticker: "AAPL",
    createdAt: new Date(now - 70_000).toISOString()
  });
  await store.markJobRunning("job-running-stale", startedAt);

  const summary = await runJobRecoveryPass(store, queue, config, {
    lastRequeueAtMs: new Map<string, number>()
  });
  const updated = await store.getJob("job-running-stale");

  assert.equal(summary.timedOutCandidates, 1);
  assert.equal(summary.markedFailed, 1);
  assert.equal(updated?.status, "failed");
  assert.match(updated?.errorMessage ?? "", /recovery watchdog/i);
});
