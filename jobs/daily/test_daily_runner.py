from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pytest

import _paths  # noqa: F401
import guard
import run_step
from daily_steps import DAILY_STEPS, pulse_cycle_window
from fake_api import make_client
from runner import PaginationError, StepContext, post_paginated, run_step as run_one, summarize
from weekly_steps import WEEKLY_STEPS


def utc(*args: int) -> datetime:
    return datetime(*args, tzinfo=timezone.utc)


def ctx_for(tmp_path: Path, now: datetime | None = None) -> StepContext:
    return StepContext(now=now or utc(2026, 11, 23, 11, 30), state_dir=tmp_path)


# ------------------------------------------------------------------ pagination


def test_pagination_follows_cursor_until_done() -> None:
    pages = iter([{"evaluated": 2, "next_cursor": "c1"}, {"evaluated": 3, "next_cursor": "c2"}, {"evaluated": 1}])
    client, transport = make_client(lambda method, path, body: (200, next(pages)))
    result = post_paginated(client, "/internal/monitor/recompute", {"as_of": "2026-11-23"})
    assert len(result) == 3
    assert [call["body"] for call in transport.calls] == [
        {"as_of": "2026-11-23"},
        {"as_of": "2026-11-23", "cursor": "c1"},
        {"as_of": "2026-11-23", "cursor": "c2"},
    ]
    assert summarize(result)["evaluated"] == 6


def test_pagination_cap_stops_endless_routes() -> None:
    counter = {"n": 0}

    def handler(method: str, path: str, body: Any) -> tuple[int, dict[str, Any]]:
        counter["n"] += 1
        return 200, {"next_cursor": f"c{counter['n']}"}

    client, transport = make_client(handler)
    with pytest.raises(PaginationError):
        post_paginated(client, "/internal/x", {}, max_pages=5)
    assert len(transport.calls) == 5


def test_pagination_repeated_cursor_stops() -> None:
    client, transport = make_client(lambda method, path, body: (200, {"next_cursor": "same"}))
    with pytest.raises(PaginationError):
        post_paginated(client, "/internal/x", {}, max_pages=10)
    assert len(transport.calls) == 2


def test_empty_or_null_cursor_ends() -> None:
    client, transport = make_client(lambda method, path, body: (200, {"next_cursor": None}))
    assert len(post_paginated(client, "/internal/x", {})) == 1


def test_summarize_ignores_non_counts() -> None:
    summary = summarize([{"status": "ok", "attempted": 2, "user_ids": ["u1"], "flag": True, "failed": False}])
    assert summary == {"pages": 1, "status": "ok", "attempted": 2}


# ------------------------------------------------------------------ daily steps


def test_daily_order_and_bodies_match_old_scheduler() -> None:
    enabled = [name for name, step in DAILY_STEPS.items() if step.enabled]
    assert enabled == [
        "earnings-war-room",
        "kill-switch",
        "cross-name",
        "monitor-recompute",
        "freshness-decay",
        "earnings-preview",
        "contrarian",
        "research-state-refresh",
    ]
    assert not DAILY_STEPS["pulse-dispatch"].enabled
    assert not DAILY_STEPS["deep-dive-precompute"].enabled


def test_war_room_fallback_users_feed_earnings_preview(tmp_path: Path) -> None:
    pages = iter([{"phase": "auto", "fallback_user_ids": ["u1", "u2"], "next_cursor": "p2"},
                  {"fallback_user_ids": ["u2", "u3"]}])
    client, _ = make_client(lambda method, path, body: (200, next(pages)))
    ctx = ctx_for(tmp_path)
    run_one(DAILY_STEPS["earnings-war-room"], client, ctx)

    client2, transport2 = make_client(lambda method, path, body: (200, {"attempted": 0}))
    run_one(DAILY_STEPS["earnings-preview"], client2, ctx)
    assert transport2.calls[0]["body"] == {"user_ids": ["u1", "u2", "u3"]}


def test_earnings_preview_without_war_room_state_sends_empty(tmp_path: Path) -> None:
    client, transport = make_client(lambda method, path, body: (200, {}))
    run_one(DAILY_STEPS["earnings-preview"], client, ctx_for(tmp_path))
    assert transport.calls[0]["body"] == {"user_ids": []}


def test_signal_source_bodies(tmp_path: Path) -> None:
    client, transport = make_client(lambda method, path, body: (200, {}))
    for name in ("kill-switch", "cross-name"):
        run_one(DAILY_STEPS[name], client, ctx_for(tmp_path))
    assert [call["body"] for call in transport.calls] == [{"signal_source": "daily"}] * 2


def test_disabled_step_makes_no_call(tmp_path: Path) -> None:
    client, transport = make_client(lambda method, path, body: (200, {}))
    assert run_one(DAILY_STEPS["pulse-dispatch"], client, ctx_for(tmp_path)) == {"skipped": True}
    assert transport.calls == []


def test_pulse_cycle_window_across_dst_change() -> None:
    # Monday 2026-11-02 06:30 EST; the day before (Sunday) 06:30 was already EST (DST ended Nov 1 02:00).
    window = pulse_cycle_window(utc(2026, 11, 2, 11, 30))
    assert window == {"cycle_start": "2026-11-01T11:30:00.000Z", "cycle_end": "2026-11-02T11:30:00.000Z"}
    # Summer: 06:30 EDT is 10:30 UTC.
    assert pulse_cycle_window(utc(2026, 7, 15, 10, 30))["cycle_start"] == "2026-07-14T10:30:00.000Z"


# ------------------------------------------------------------------ weekly steps


def test_coherence_runs_only_in_first_week(tmp_path: Path) -> None:
    client, transport = make_client(lambda method, path, body: (200, {"status": "ok"}))
    second_week = ctx_for(tmp_path, utc(2026, 11, 8, 23, 0))
    assert run_one(WEEKLY_STEPS["conviction-coherence"], client, second_week) == {"skipped": True}
    first_week = ctx_for(tmp_path, utc(2026, 11, 1, 23, 0))
    run_one(WEEKLY_STEPS["conviction-coherence"], client, first_week)
    assert [call["path"] for call in transport.calls] == ["/internal/conviction/coherence/evaluate"]


def test_coherence_force_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORCE_COHERENCE", "true")
    client, transport = make_client(lambda method, path, body: (200, {}))
    run_one(WEEKLY_STEPS["conviction-coherence"], client, ctx_for(tmp_path, utc(2026, 11, 15, 23, 0)))
    assert len(transport.calls) == 1


# ------------------------------------------------------------------ CLI exit codes


def test_cli_unknown_step_exits_2() -> None:
    assert run_step.main(["no-such-step"]) == 2
    assert run_step.main([]) == 2


def test_cli_failure_exits_1(tmp_path: Path) -> None:
    client, _ = make_client(lambda method, path, body: (500, {}))
    assert run_step.main(["contrarian"], client=client, ctx=ctx_for(tmp_path)) == 1


def test_cli_pagination_cap_exits_1(tmp_path: Path) -> None:
    counter = {"n": 0}

    def handler(method: str, path: str, body: Any) -> tuple[int, dict[str, Any]]:
        counter["n"] += 1
        return 200, {"next_cursor": str(counter["n"])}

    client, transport = make_client(handler)
    assert run_step.main(["monitor-recompute"], client=client, ctx=ctx_for(tmp_path)) == 1
    assert len(transport.calls) == 50


def test_cli_missing_secrets_exits_2(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("THESIS_API_URL", raising=False)
    monkeypatch.delenv("THESIS_INTERNAL_TOKEN", raising=False)
    assert run_step.main(["contrarian"]) == 2


def test_cli_success(tmp_path: Path) -> None:
    client, _ = make_client(lambda method, path, body: (200, {"status": "ok"}))
    assert run_step.main(["weekly-digest"], client=client, ctx=ctx_for(tmp_path)) == 0


# ------------------------------------------------------------------ time-window guard


@pytest.mark.parametrize(
    "now,expected",
    [
        (utc(2026, 7, 15, 10, 30), True),  # summer cron 10:30 UTC = 06:30 EDT
        (utc(2026, 7, 15, 11, 30), True),  # summer second cron = 07:30 EDT, still inside
        (utc(2026, 1, 14, 10, 30), False),  # winter first cron = 05:30 EST
        (utc(2026, 1, 14, 11, 30), True),  # winter second cron = 06:30 EST
        (utc(2026, 3, 9, 10, 30), True),  # day after DST starts (Mar 8): EDT
        (utc(2026, 11, 2, 10, 30), False),  # day after DST ends (Nov 1): EST
        (utc(2026, 11, 2, 11, 30), True),
    ],
)
def test_guard_scheduled_runs(now: datetime, expected: bool) -> None:
    assert guard.decide({"GITHUB_EVENT_NAME": "schedule"}, now)[0] is expected


def test_guard_manual_force_skips_check() -> None:
    night = utc(2026, 1, 14, 3, 0)
    assert guard.decide({"GITHUB_EVENT_NAME": "workflow_dispatch", "FORCE": "true"}, night)[0] is True
    assert guard.decide({"GITHUB_EVENT_NAME": "workflow_dispatch", "FORCE": "false"}, night)[0] is False
    # force has no effect on a scheduled run
    assert guard.decide({"GITHUB_EVENT_NAME": "schedule", "FORCE": "true"}, night)[0] is False


def test_guard_writes_github_output(tmp_path: Path) -> None:
    output = tmp_path / "out.txt"
    guard.main({"GITHUB_EVENT_NAME": "schedule", "GITHUB_OUTPUT": str(output)}, utc(2026, 1, 14, 10, 30))
    guard.main({"GITHUB_EVENT_NAME": "schedule", "GITHUB_OUTPUT": str(output)}, utc(2026, 1, 14, 11, 30))
    assert output.read_text() == "run=false\nrun=true\n"
