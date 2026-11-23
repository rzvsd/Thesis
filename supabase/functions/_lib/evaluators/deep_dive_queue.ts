// DeepDiveQueue backed by M2's job queue. The war-room post phase queues a Deep Dive refresh for the user,
// as the old server did with queue.publish. The start goes through M2's dispatchJob, so it counts against the
// global daily cap (DEEP_DIVE_DAILY_CAP) like any user request.
import { logInfo } from "../../_shared/log.ts";
import { dispatchJob, type SweepDeps } from "../jobs/sweeper.ts";
import type { DeepDiveQueue, QueuedJob } from "./report_port.ts";

export function jobsDeepDiveQueue(deps: () => SweepDeps): DeepDiveQueue {
  return {
    enabled: true,
    async queueRefresh(input): Promise<QueuedJob | undefined> {
      const d = deps();
      const created = await d.store.createJob({
        id: crypto.randomUUID(),
        type: "deep_dive",
        userId: input.userId,
        ticker: input.ticker,
        createdAt: input.createdAt,
      });
      // The user already has an open Deep Dive for this ticker: that one is the refresh.
      if (!created) {
        const open = await d.store.findOpenJob(input.userId, input.ticker);
        return open ? { id: open.id, reportId: open.reportId } : undefined;
      }
      const result = await dispatchJob(d, created, null);
      if (result === "started" || result === "lost_race") return { id: created.id };
      await d.store.markJobFailed(created.id, new Date().toISOString(), "Deep Dive refresh could not start.");
      logInfo("War room refresh not started", { job_id: created.id, reason: result });
      return undefined;
    },
  };
}
