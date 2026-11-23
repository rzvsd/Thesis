"""Create today's Deep Dive precompute jobs and list them for the runner step.

Calls POST /internal/deep-dive/precompute with {"limit": PER_RUN}. The api only creates the
jobs (audit N7: never one runner dispatch per ticker). The workflow then claims and runs each
job in process with the M2 runner. Writes the job ids, one per line, to the file given as the
first argument, and `count=<n>` to $GITHUB_OUTPUT. Exit codes as in script_main.
"""

from __future__ import annotations

import os
import re
import sys
from typing import Mapping

import _paths  # noqa: F401
from api_client import ApiClient
from joblog import log
from script_main import EXIT_CONFIG, run

ROUTE = "/internal/deep-dive/precompute"
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
MAX_PER_RUN = 5


def per_run(env: Mapping[str, str]) -> int:
    raw = env.get("PER_RUN", "").strip() or "1"
    try:
        value = int(raw)
    except ValueError:
        return 1
    return max(0, min(MAX_PER_RUN, value))


def job_ids(body: Mapping[str, object]) -> list[str]:
    jobs = body.get("jobs")
    ids: list[str] = []
    if isinstance(jobs, list):
        for job in jobs:
            value = job.get("job_id") if isinstance(job, dict) else None
            if isinstance(value, str) and UUID_RE.match(value) and value not in ids:
                ids.append(value)
    return ids


def main(argv: list[str] | None = None, env: Mapping[str, str] | None = None, client: ApiClient | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    values = os.environ if env is None else env
    if len(args) != 1:
        log("ERROR", "Usage: precompute_plan.py <out-file>")
        return EXIT_CONFIG
    out = args[0]

    def body() -> int:
        limit = per_run(values)
        ids: list[str] = []
        if limit > 0:
            api = client or ApiClient.from_env()
            response = api.post(ROUTE, {"limit": limit})
            ids = job_ids(response.body)[:limit]
            log("INFO", "Precompute jobs created", count=len(ids), in_flight=response.body.get("in_flight"))
        with open(out, "w", encoding="utf-8") as handle:
            handle.write("".join(f"{job_id}\n" for job_id in ids))
        output = values.get("GITHUB_OUTPUT")
        if output:
            with open(output, "a", encoding="utf-8") as handle:
                handle.write(f"count={len(ids)}\n")
        return 0

    return run("deep-dive-precompute", body)


if __name__ == "__main__":
    sys.exit(main())
