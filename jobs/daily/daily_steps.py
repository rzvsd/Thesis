"""The evaluator steps of the daily workflow, in the old scheduler order.

apps/scheduler/src/server.ts (dispatchEarningsPreview) ran, at 06:30 New York:
earnings war room, kill switch, cross-name, monitor recompute, freshness decay, then the
earnings preview with the war room's `fallback_user_ids`. Contrarian ran at 18:00 and
now runs in the same morning pass. Research-state refresh had no schedule; Pulse reads
the latest state, so it runs last. The monthly coherence moved to the weekly workflow.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import _paths  # noqa: F401
from market_time import new_york_now
from runner import Step, StepContext

PULSE_DELIVERY_HOUR = 6
PULSE_DELIVERY_MINUTE = 30
WAR_ROOM_STATE = "war-room"


def save_war_room_fallback(pages: list[dict[str, Any]], ctx: StepContext) -> None:
    user_ids: list[str] = []
    for page in pages:
        raw = page.get("fallback_user_ids")
        if not isinstance(raw, list):
            continue
        for value in raw:
            if isinstance(value, str) and value.strip() and value.strip() not in user_ids:
                user_ids.append(value.strip())
    ctx.save_state(WAR_ROOM_STATE, {"fallback_user_ids": user_ids})


def earnings_preview_body(ctx: StepContext) -> dict[str, Any]:
    """Old scheduler: user_ids = war room fallback_user_ids, else []."""
    state = ctx.load_state(WAR_ROOM_STATE, {})
    raw = state.get("fallback_user_ids") if isinstance(state, dict) else None
    user_ids = [value for value in raw if isinstance(value, str)] if isinstance(raw, list) else []
    return {"user_ids": user_ids}


def pulse_cycle_window(now: datetime) -> dict[str, str]:
    """Port of computeCycleWindowForRun: from yesterday 06:30 New York to the run time."""
    local = new_york_now(now)
    previous = (local - timedelta(days=1)).replace(
        hour=PULSE_DELIVERY_HOUR, minute=PULSE_DELIVERY_MINUTE, second=0, microsecond=0
    )
    # zoneinfo works on wall time, so a DST change between the two days gives the right offset.
    start = previous.astimezone(timezone.utc)
    end = now.astimezone(timezone.utc)
    return {
        "cycle_start": start.isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "cycle_end": end.isoformat(timespec="milliseconds").replace("+00:00", "Z"),
    }


DAILY_STEPS: dict[str, Step] = {
    step.name: step
    for step in (
        Step(
            name="earnings-war-room",
            route="/internal/notifications/earnings-war-room",
            body=lambda _ctx: {"phase": "auto"},
            after=save_war_room_fallback,
        ),
        Step(
            name="kill-switch",
            route="/internal/notifications/kill-switch/evaluate",
            body=lambda _ctx: {"signal_source": "daily"},
        ),
        Step(
            name="cross-name",
            route="/internal/notifications/cross-name/evaluate",
            body=lambda _ctx: {"signal_source": "daily"},
        ),
        Step(name="monitor-recompute", route="/internal/monitor/recompute"),
        Step(name="freshness-decay", route="/internal/notifications/freshness-decay"),
        Step(
            name="earnings-preview",
            route="/internal/notifications/earnings-preview",
            body=earnings_preview_body,
        ),
        Step(name="contrarian", route="/internal/notifications/contrarian/evaluate"),
        Step(name="research-state-refresh", route="/internal/research-state/refresh"),
        # TODO(M3 phase B): enable after M1 (_lib/pulse) and M2 (report storage) merge.
        Step(
            name="pulse-dispatch",
            route="/internal/pulse/dispatch",
            body=lambda ctx: pulse_cycle_window(ctx.now),
            enabled=False,
            disabled_reason="phase B: needs M1 pulse and M2 report storage",
        ),
        # TODO(M3 phase B): enable after M2's queue merges. One call; the api loops tickers with a cap (N7).
        Step(
            name="deep-dive-precompute",
            route="/internal/deep-dive/precompute",
            enabled=False,
            disabled_reason="phase B: needs the M2 job queue",
        ),
    )
}
