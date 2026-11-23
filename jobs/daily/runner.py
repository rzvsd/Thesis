"""Call one internal evaluator route and follow `next_cursor` pages.

Pagination convention: when an answer carries a non-empty string `next_cursor`, the runner
sends the same body again with `cursor` set to it, until no cursor comes back. A cap on
the number of pages and a repeated-cursor check stop a route that never finishes.
"""

from __future__ import annotations

import json
import os
import tempfile
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

import _paths  # noqa: F401  (adds jobs/data to sys.path)
from api_client import ApiClient
from joblog import log

DEFAULT_MAX_PAGES = 50
SUMMARY_KEYS = (
    "status",
    "evaluated",
    "evaluated_users",
    "matched",
    "skipped",
    "suppressed",
    "fired",
    "generated",
    "degraded",
    "prepared",
    "live_updated",
    "post_closed",
    "users",
    "names",
    "unresolved",
    "updated",
    "attempted",
    "delivered",
    "failed",
    "queued",
    "in_flight",
)


class PaginationError(Exception):
    pass


@dataclass
class StepContext:
    now: datetime
    state_dir: Path
    force: bool = False

    def state_path(self, name: str) -> Path:
        return self.state_dir / f"thesis-jobs-{name}.json"

    def save_state(self, name: str, value: Any) -> None:
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.state_path(name).write_text(json.dumps(value), encoding="utf-8")

    def load_state(self, name: str, default: Any) -> Any:
        try:
            return json.loads(self.state_path(name).read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return default


def default_state_dir() -> Path:
    return Path(os.environ.get("JOBS_STATE_DIR") or os.environ.get("RUNNER_TEMP") or tempfile.gettempdir())


@dataclass(frozen=True)
class Step:
    name: str
    route: str
    body: Callable[[StepContext], dict[str, Any]] = lambda _ctx: {}
    after: Callable[[list[dict[str, Any]], StepContext], None] | None = None
    should_run: Callable[[StepContext], tuple[bool, str]] | None = None
    enabled: bool = True
    disabled_reason: str = ""
    max_pages: int = DEFAULT_MAX_PAGES
    notes: tuple[str, ...] = field(default=())


def post_paginated(
    client: ApiClient, route: str, body: dict[str, Any], max_pages: int = DEFAULT_MAX_PAGES
) -> list[dict[str, Any]]:
    if max_pages < 1:
        raise ValueError("max_pages must be at least 1")
    pages: list[dict[str, Any]] = []
    seen: set[str] = set()
    cursor: str | None = None
    for _ in range(max_pages):
        payload = dict(body)
        if cursor is not None:
            payload["cursor"] = cursor
        response = client.post(route, payload)
        pages.append(response.body)
        next_cursor = response.body.get("next_cursor")
        if not isinstance(next_cursor, str) or not next_cursor:
            return pages
        if next_cursor in seen:
            raise PaginationError(f"{route} returned the same cursor twice")
        seen.add(next_cursor)
        cursor = next_cursor
    raise PaginationError(f"{route} still had more pages after {max_pages} calls")


def summarize(pages: list[dict[str, Any]]) -> dict[str, Any]:
    """Counts only: numbers are summed over pages, the last status string is kept."""
    summary: dict[str, Any] = {"pages": len(pages)}
    for page in pages:
        for key in SUMMARY_KEYS:
            value = page.get(key)
            if isinstance(value, bool):
                continue
            if isinstance(value, (int, float)):
                summary[key] = summary.get(key, 0) + value
            elif key == "status" and isinstance(value, str):
                summary[key] = value[:40]
    return summary


def run_step(step: Step, client: ApiClient, ctx: StepContext) -> dict[str, Any]:
    if not step.enabled:
        log("INFO", "Step disabled", step=step.name, reason=step.disabled_reason)
        return {"skipped": True}
    if step.should_run is not None:
        go, reason = step.should_run(ctx)
        if not go:
            log("INFO", "Step skipped", step=step.name, reason=reason)
            return {"skipped": True}
    client.start_step()
    pages = post_paginated(client, step.route, step.body(ctx), step.max_pages)
    if step.after is not None:
        step.after(pages, ctx)
    summary = summarize(pages)
    log("INFO", "Step done", step=step.name, route=step.route, **summary)
    return summary
