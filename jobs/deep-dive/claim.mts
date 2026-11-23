// Step 1 of the runner: claim the job before installing anything, so a duplicate or stale dispatch costs
// seconds, not minutes. Writes the claim to the file given as the first argument and sets the step output
// "claimed" to true or false. Usage: node jobs/deep-dive/claim.mts <out.json>
import { appendFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { claim, jsonLogger, UUID_RE } from "./runner.mts";

const jobId = process.env.JOB_ID ?? "";
const out = process.argv[2];
const setOutput = (value: boolean) => {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `claimed=${value}\n`);
  }
};

if (!UUID_RE.test(jobId) || !out) {
  jsonLogger.error("Bad job id or output path");
  process.exit(1);
}
const baseUrl = process.env.THESIS_API_URL ?? "";
const token = process.env.THESIS_INTERNAL_TOKEN ?? "";
if (!baseUrl || !token) {
  jsonLogger.error("Runner secrets are not set", { job_id: jobId });
  process.exit(1);
}

const result = await claim({ baseUrl, token }, jobId, process.env.RUN_URL);
if (!result.ok) {
  jsonLogger.info("Job not claimed", {
    job_id: jobId,
    reason: result.reason,
    status: result.status,
  });
  setOutput(false);
  process.exit(result.reason === "not_claimable" ? 0 : 1);
}
writeFileSync(out, JSON.stringify(result.request));
jsonLogger.info("Job claimed", { job_id: jobId });
setOutput(true);
