// The only place that starts a Deep Dive runner (DECISIONS.md D1).
// Today the runner is the GitHub Actions workflow rebuild-deep-dive.yml, started with workflow_dispatch and
// the job id as its only input. Swapping the runner later means changing this file and the entry script in
// jobs/deep-dive/ only. Settings (names only, values live in Supabase secrets):
//   GITHUB_DISPATCH_TOKEN   fine-grained token, this repo only, Actions read and write
//   DEEP_DIVE_REPO          owner/name, default rzvsd/thesis
//   DEEP_DIVE_WORKFLOW      workflow file, default rebuild-deep-dive.yml
//   DEEP_DIVE_REF           branch whose workflow runs, default rebuild
import { env } from "../../_shared/env.ts";

export type RunState = "active" | "finished" | "unknown";

export interface Runner {
  // Starts one run for the job. Throws when the runner could not be started.
  dispatch(jobId: string): Promise<void>;
  // Says whether the run at runUrl is still going. "unknown" when it cannot tell.
  runState(runUrl: string): Promise<RunState>;
}

type Fetch = typeof fetch;

const API = "https://api.github.com";

function headers(token: string): HeadersInit {
  return {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "thesis-api",
    "content-type": "application/json",
  };
}

// Run URLs look like https://github.com/<owner>/<repo>/actions/runs/<id>. Only runs of our repo count.
export function runIdFromUrl(runUrl: string, repo: string): string | undefined {
  const m = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/actions\/runs\/(\d+)(?:\/|$)/.exec(runUrl);
  if (!m || m[1].toLowerCase() !== repo.toLowerCase()) return undefined;
  return m[2];
}

export function githubActionsRunner(
  options: { token?: string; repo?: string; workflow?: string; ref?: string; fetchFn?: Fetch } = {},
): Runner {
  const fetchFn = options.fetchFn ?? fetch;
  const repo = options.repo ?? env("DEEP_DIVE_REPO") ?? "rzvsd/thesis";
  const workflow = options.workflow ?? env("DEEP_DIVE_WORKFLOW") ?? "rebuild-deep-dive.yml";
  const ref = options.ref ?? env("DEEP_DIVE_REF") ?? "rebuild";
  const token = () => options.token ?? env("GITHUB_DISPATCH_TOKEN");

  return {
    async dispatch(jobId) {
      const t = token();
      if (!t) throw new Error("Runner is not configured");
      const res = await fetchFn(`${API}/repos/${repo}/actions/workflows/${workflow}/dispatches`, {
        method: "POST",
        headers: headers(t),
        body: JSON.stringify({ ref, inputs: { job_id: jobId } }),
      });
      await res.body?.cancel();
      if (res.status !== 204 && res.status !== 200) {
        throw new Error(`Runner dispatch failed (${res.status})`);
      }
    },

    async runState(runUrl) {
      const t = token();
      const runId = runIdFromUrl(runUrl, repo);
      if (!t || !runId) return "unknown";
      try {
        const res = await fetchFn(`${API}/repos/${repo}/actions/runs/${runId}`, { headers: headers(t) });
        if (!res.ok) {
          await res.body?.cancel();
          return "unknown";
        }
        const body = await res.json() as { status?: string };
        return body.status === "completed" ? "finished" : "active";
      } catch {
        return "unknown";
      }
    },
  };
}
