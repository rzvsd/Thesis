"""Time-window guard for the daily workflow (rebuild audit N6).

The workflow has two UTC crons, 10:30 and 11:30, so one of them lands at 06:30 New York
in summer and the other in winter. This prints run=true only when New York local time is
06:00-08:59, so only one of the two does work. A manual run with force=true skips the check.
It writes `run=true|false` to $GITHUB_OUTPUT when that is set. Standard library only.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime
from typing import Mapping

import _paths  # noqa: F401
from market_time import in_daily_window, new_york_now, now_utc


SUMMER_CRON = "30 10 * * 1-5"
WINTER_CRON = "30 11 * * 1-5"


def is_daylight_time(local: datetime) -> bool:
    offset = local.utcoffset()
    return offset is not None and offset.total_seconds() == -4 * 3600


def decide(env: Mapping[str, str], now: datetime | None = None) -> tuple[bool, str]:
    current = now or now_utc()
    manual = env.get("GITHUB_EVENT_NAME", "") == "workflow_dispatch"
    force = env.get("FORCE", "").strip().lower() == "true"
    if manual and force:
        return True, "manual run with force"
    local = new_york_now(current)
    if not in_daily_window(current):
        return False, f"outside 06:00-08:59 New York (local hour {local.hour:02d})"
    schedule = env.get("SCHEDULE", "").strip()
    expected = SUMMER_CRON if is_daylight_time(local) else WINTER_CRON
    if schedule and schedule != expected:
        return False, "the other season's cron does today's run"
    return True, "inside 06:00-08:59 New York"


def main(env: Mapping[str, str] | None = None, now: datetime | None = None) -> int:
    values = os.environ if env is None else env
    run, reason = decide(values, now)
    print(f"Time-window guard: {'run' if run else 'skip'} ({reason})")
    output = values.get("GITHUB_OUTPUT")
    if output:
        with open(output, "a", encoding="utf-8") as handle:
            handle.write(f"run={'true' if run else 'false'}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
