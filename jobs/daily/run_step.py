"""Run one named evaluator step: python jobs/daily/run_step.py <step-name>

Step names come from jobs/daily/daily_steps.py and jobs/weekly/weekly_steps.py. Only
those names are accepted, so no free text reaches a URL. Exit 0 on success or skip,
1 on failure, 2 on a configuration error.
"""

from __future__ import annotations

import sys
from typing import Mapping

import _paths  # noqa: F401
from api_client import ApiClient
from daily_steps import DAILY_STEPS
from joblog import log
from market_time import now_utc
from runner import PaginationError, Step, StepContext, default_state_dir, run_step
from script_main import EXIT_CONFIG, EXIT_FAILED, run
from weekly_steps import WEEKLY_STEPS

ALL_STEPS: Mapping[str, Step] = {**DAILY_STEPS, **WEEKLY_STEPS}


def main(argv: list[str] | None = None, client: ApiClient | None = None, ctx: StepContext | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if len(args) != 1 or args[0] not in ALL_STEPS:
        log("ERROR", "Unknown step", known=sorted(ALL_STEPS))
        return EXIT_CONFIG
    step = ALL_STEPS[args[0]]

    def body() -> int:
        api = client or ApiClient.from_env()
        context = ctx or StepContext(now=now_utc(), state_dir=default_state_dir())
        try:
            run_step(step, api, context)
        except PaginationError as error:
            log("ERROR", "Pagination stopped", step=step.name, error_message=str(error))
            return EXIT_FAILED
        return 0

    return run(step.name, body)


if __name__ == "__main__":
    sys.exit(main())
