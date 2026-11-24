// The pipeline's fact-pack step: build the pack within a time box, then send its rows to the API.
// Runs in fixture mode too (SEC data is free). Never throws; a failure or a timeout means no fact_pack.
import { logWarn } from "../logging";
import { buildFactPack, type BuildFactPackDeps } from "./build";
import { postFinancialsIngest } from "./ingest";
import type { FetchLike } from "./sec-client";
import type { FactPack } from "./types";

export const FACT_PACK_TIME_BOX_MS = 25_000;

export interface FactPackStepConfig {
  factPackEnabled: boolean;
  secUserAgent?: string;
  financialsIngestUrl?: string;
  financialsIngestToken?: string;
}

export interface FactPackStepDeps {
  /** fetch for SEC requests (tests pass a fake). */
  secFetch?: FetchLike;
  /** fetch for the ingest call (tests pass a fake). */
  ingestFetch?: FetchLike;
  timeBoxMs?: number;
  /** Extra SEC client options (tests turn the throttle and backoff off). */
  build?: Omit<BuildFactPackDeps, "jobId">;
}

export async function runFactPackStep(
  input: { ticker: string; jobId?: string },
  config: FactPackStepConfig,
  deps: FactPackStepDeps = {}
): Promise<FactPack | null> {
  if (!config.factPackEnabled || !input.ticker.trim()) return null;
  const controller = new AbortController();
  const timeBoxMs = deps.timeBoxMs ?? FACT_PACK_TIME_BOX_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      logWarn("Fact pack timed out", { job_id: input.jobId, ticker: input.ticker, time_box_ms: timeBoxMs });
      resolve(null);
    }, timeBoxMs);
  });
  const build = buildFactPack(input.ticker, {
    ...deps.build,
    jobId: input.jobId,
    clientOptions: {
      userAgent: config.secUserAgent,
      ...(deps.secFetch ? { fetchImpl: deps.secFetch } : {}),
      ...deps.build?.clientOptions,
      signal: controller.signal
    }
  });
  const pack = await Promise.race([build, timeout]);
  clearTimeout(timer);
  if (!pack) return null;

  if (config.financialsIngestUrl && config.financialsIngestToken) {
    await postFinancialsIngest(
      pack,
      {
        baseUrl: config.financialsIngestUrl,
        token: config.financialsIngestToken,
        ...(deps.ingestFetch ? { fetchImpl: deps.ingestFetch } : {})
      },
      input.jobId
    );
  }
  return pack;
}
