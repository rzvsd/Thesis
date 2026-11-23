// Deep Dive runner logic (M2). Runs on Node 22 in GitHub Actions; tested with Deno.
// It talks to the API's internal routes only (H5). It holds the internal token and LLM keys, never a
// database password (D5). Swapping the runner host (D1) reuses this file as is.

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface ApiConfig {
  baseUrl: string; // e.g. https://<ref>.supabase.co/functions/v1/api
  token: string; // THESIS_INTERNAL_TOKEN, sent as x-internal-token
  fetchFn?: typeof fetch;
}

export interface AnalysisRequest {
  request_id: string;
  type: string;
  ticker?: string;
  user_id?: string;
  job_id: string;
  requested_at: string;
}

export interface Logger {
  info(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

export const jsonLogger: Logger = {
  info: (message, fields = {}) =>
    console.log(JSON.stringify({ level: "info", message, ...fields })),
  error: (message, fields = {}) =>
    console.error(JSON.stringify({ level: "error", message, ...fields })),
};

function post(api: ApiConfig, path: string, body: unknown): Promise<Response> {
  const fetchFn = api.fetchFn ?? fetch;
  return fetchFn(`${api.baseUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-token": api.token,
    },
    body: JSON.stringify(body ?? {}),
  });
}

// Retries network errors and 5xx a few times. 4xx answers are final.
async function postWithRetry(
  api: ApiConfig,
  path: string,
  body: unknown,
  tries = 3,
): Promise<Response> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await post(api, path, body);
      if (res.status < 500 || i === tries - 1) return res;
      await res.body?.cancel();
    } catch (err) {
      last = err;
      if (i === tries - 1) throw err;
    }
    await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
  }
  throw last ?? new Error("request failed");
}

export type ClaimResult =
  | { ok: true; request: AnalysisRequest }
  | { ok: false; reason: "not_claimable" | "error"; status?: number };

export async function claim(
  api: ApiConfig,
  jobId: string,
  runUrl?: string,
): Promise<ClaimResult> {
  if (!UUID_RE.test(jobId)) return { ok: false, reason: "error" };
  const res = await postWithRetry(
    api,
    `/internal/jobs/${jobId}/claim`,
    runUrl ? { run_url: runUrl } : {},
  );
  if (res.status === 409) {
    await res.body?.cancel();
    return { ok: false, reason: "not_claimable", status: 409 };
  }
  if (!res.ok) {
    await res.body?.cancel();
    return { ok: false, reason: "error", status: res.status };
  }
  const body = await res.json() as { analysis_request?: AnalysisRequest };
  if (!body.analysis_request || body.analysis_request.job_id !== jobId) {
    return { ok: false, reason: "error" };
  }
  return { ok: true, request: body.analysis_request };
}

export interface PipelineResult {
  report: unknown;
  usage?: unknown;
}

export type Pipeline = (request: AnalysisRequest) => Promise<PipelineResult>;

// Runs the pipeline for a claimed job, then reports complete or fail. Returns the final outcome.
export async function runClaimed(
  api: ApiConfig,
  request: AnalysisRequest,
  pipeline: Pipeline,
  log: Logger = jsonLogger,
): Promise<"complete" | "failed"> {
  const jobId = request.job_id;
  let result: PipelineResult;
  try {
    result = await pipeline(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("Pipeline failed", { job_id: jobId });
    await reportFailure(api, jobId, message, log);
    return "failed";
  }
  const res = await postWithRetry(api, `/internal/jobs/${jobId}/complete`, {
    report: result.report,
    llm_usage: result.usage,
  });
  if (res.ok) {
    await res.body?.cancel();
    log.info("Job complete", { job_id: jobId });
    return "complete";
  }
  const text = (await res.text()).slice(0, 500);
  log.error("Completion rejected", { job_id: jobId, status: res.status });
  await reportFailure(
    api,
    jobId,
    `Completion callback failed (${res.status}): ${text}`,
    log,
  );
  return "failed";
}

export async function reportFailure(
  api: ApiConfig,
  jobId: string,
  message: string,
  log: Logger = jsonLogger,
) {
  try {
    const res = await postWithRetry(api, `/internal/jobs/${jobId}/fail`, {
      error_message: message.slice(0, 2000),
    });
    await res.body?.cancel();
    if (!res.ok) {
      log.error("Fail callback rejected", {
        job_id: jobId,
        status: res.status,
      });
    }
  } catch {
    log.error("Fail callback failed", { job_id: jobId });
  }
}
