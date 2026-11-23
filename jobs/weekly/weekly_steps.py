"""The evaluator steps of the weekly workflow.

The weekly digest ran on its own timer in apps/scheduler/src/server.ts. The conviction
coherence ran monthly there (day 1 in New York, inside the daily pass). The weekly
workflow runs it on its first run of each month (New York day 1-7); the api evaluates
the previous calendar month by default. The official-source refresh is a data script:
jobs/data/run_official_refresh.py.
"""

from __future__ import annotations

import os

from market_time import is_first_week_of_month
from runner import Step, StepContext


def coherence_due(ctx: StepContext) -> tuple[bool, str]:
    if ctx.force or os.environ.get("FORCE_COHERENCE", "").strip().lower() == "true":
        return True, "forced"
    if is_first_week_of_month(ctx.now):
        return True, "first weekly run of the month"
    return False, "monthly: runs only on New York days 1-7"


WEEKLY_STEPS: dict[str, Step] = {
    step.name: step
    for step in (
        Step(name="weekly-digest", route="/internal/notifications/weekly-digest"),
        Step(
            name="conviction-coherence",
            route="/internal/conviction/coherence/evaluate",
            should_run=coherence_due,
        ),
    )
}
