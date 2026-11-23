// Step 2 of the runner: run the existing Dexter pipeline (apps/dexter-worker, built to dist/) for the
// claimed job, then call complete or fail. Usage: node jobs/deep-dive/main.mts <claim.json>
// The Redis queue consumer of the old worker is not used.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import process from "node:process";
import {
  type AnalysisRequest,
  jsonLogger,
  reportFailure,
  runClaimed,
} from "./runner.mts";

const require = createRequire(import.meta.url);
const dist = "../../apps/dexter-worker/dist/apps/dexter-worker/src";

const request = JSON.parse(
  readFileSync(process.argv[2], "utf-8"),
) as AnalysisRequest;
const api = {
  baseUrl: process.env.THESIS_API_URL ?? "",
  token: process.env.THESIS_INTERNAL_TOKEN ?? "",
};

let outcome: "complete" | "failed";
try {
  const { loadConfig, validateLiveModeConfig } = require(`${dist}/config.js`);
  const { runAnalysisPipeline } = require(`${dist}/pipeline.js`);
  const { trackDeepDiveLlmUsage } = require(`${dist}/llm-usage.js`);
  const config = loadConfig({
    ...process.env,
    PRODUCT_API_INTERNAL_BASE_URL: api.baseUrl,
    INTERNAL_WORKER_TOKEN: api.token,
  });
  const errors: string[] = validateLiveModeConfig(config);
  if (errors.length > 0) {
    throw new Error(`Invalid runner configuration: ${errors.join("; ")}`);
  }

  outcome = await runClaimed(api, request, async (req) => {
    const { result, usage } = await trackDeepDiveLlmUsage(
      config,
      { job_id: req.job_id, ticker: req.ticker },
      () => runAnalysisPipeline(req, config),
    );
    return { report: result, usage };
  });
} catch (err) {
  jsonLogger.error("Runner setup failed", { job_id: request.job_id });
  await reportFailure(
    api,
    request.job_id,
    err instanceof Error ? err.message : String(err),
  );
  outcome = "failed";
}
// A failed Deep Dive is a normal outcome, not a broken run: exit 0 either way so Actions does not retry.
jsonLogger.info("Runner finished", { job_id: request.job_id, outcome });
