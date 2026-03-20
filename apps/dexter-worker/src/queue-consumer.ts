import { createClient } from "redis";

import type { AnalysisRequest, AnalysisReport } from "../../../packages/contracts/src";

import { type DexterConfig, validateQueueModeConfig } from "./config";
import { logError, logInfo, logWarn } from "./logging";
import { runAnalysisPipeline } from "./pipeline";

interface ClaimResponse {
  analysis_request: AnalysisRequest;
}

interface QueueConsumerHandle {
  stop: () => Promise<void>;
}

async function callInternalApi(
  config: DexterConfig,
  path: string,
  body?: unknown
): Promise<Response> {
  return fetch(`${config.productApiInternalBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-token": config.internalWorkerToken
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

async function claimJob(
  config: DexterConfig,
  jobId: string
): Promise<ClaimResponse | undefined> {
  const response = await callInternalApi(config, `/internal/jobs/${jobId}/claim`);
  if (!response.ok) {
    const payload = await response.text();
    logWarn("Job claim rejected", {
      job_id: jobId,
      status_code: response.status,
      response_body: payload
    });
    return undefined;
  }

  return (await response.json()) as ClaimResponse;
}

async function markJobComplete(
  config: DexterConfig,
  jobId: string,
  report: AnalysisReport
): Promise<void> {
  const response = await callInternalApi(config, `/internal/jobs/${jobId}/complete`, {
    report
  });
  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Completion callback failed (${response.status}): ${payload}`);
  }
}

async function markJobFailed(
  config: DexterConfig,
  jobId: string,
  errorMessage: string
): Promise<void> {
  const response = await callInternalApi(config, `/internal/jobs/${jobId}/fail`, {
    error_message: errorMessage
  });
  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Failure callback failed (${response.status}): ${payload}`);
  }
}

async function runLoop(
  config: DexterConfig,
  client: ReturnType<typeof createClient>,
  stopSignal: { requested: boolean }
): Promise<void> {
  while (!stopSignal.requested) {
    try {
      const result = await client.brPop(config.queueKey, config.queueBlockTimeoutSeconds);
      if (!result) {
        continue;
      }

      const jobId = result.element;
      logInfo("Queue job received", {
        job_id: jobId,
        queue_key: config.queueKey
      });

      const claim = await claimJob(config, jobId);
      if (!claim) {
        continue;
      }

      try {
        const report = await runAnalysisPipeline(claim.analysis_request, config);
        await markJobComplete(config, jobId, report);
        logInfo("Queue job completed", {
          job_id: jobId,
          ticker: claim.analysis_request.ticker
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError("Queue job failed", {
          job_id: jobId,
          error_message: message
        });
        try {
          await markJobFailed(config, jobId, message);
        } catch (callbackError) {
          const callbackMessage = callbackError instanceof Error
            ? callbackError.message
            : String(callbackError);
          logError("Queue failure callback failed", {
            job_id: jobId,
            error_message: callbackMessage
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logWarn("Queue loop warning", {
        error_message: message
      });
    }
  }
}

export async function startQueueConsumer(
  config: DexterConfig
): Promise<QueueConsumerHandle | undefined> {
  if (!config.queueMode) {
    return undefined;
  }

  const queueConfigErrors = validateQueueModeConfig(config);
  if (queueConfigErrors.length > 0) {
    throw new Error(queueConfigErrors.join("; "));
  }

  const client = createClient({
    url: config.redisUrl
  });
  await client.connect();

  const stopSignal = { requested: false };
  void runLoop(config, client, stopSignal);

  logInfo("Queue consumer started", {
    queue_key: config.queueKey
  });

  return {
    stop: async () => {
      stopSignal.requested = true;
      if (client.isOpen) {
        await client.quit();
      }
    }
  };
}
