"""Calendar sync: send the earnings calendar for today through 14 days ahead (New York dates).

POST /internal/calendar/sync {start_date, end_date, events}. `events` is the data.events
array the old POST /internal/calendar/earnings returned.
"""

from __future__ import annotations

import sys
from datetime import datetime
from typing import Any, Callable, Mapping

from api_client import ApiClient
from earnings_calendar import calendar_earnings_response, fetch_yfinance_rows
from joblog import log
from market_time import new_york_today
from script_main import run
from source_common import add_days_to_iso_date, fixture_mode

ROUTE = "/internal/calendar/sync"
WINDOW_DAYS = 14


def build_body(
    now: datetime | None = None,
    env: Mapping[str, str] | None = None,
    fetch_rows: Callable[[str, str], list[dict[str, Any]]] = fetch_yfinance_rows,
) -> dict[str, Any]:
    start_date = new_york_today(now).isoformat()
    end_date = add_days_to_iso_date(start_date, WINDOW_DAYS)
    response = calendar_earnings_response(start_date=start_date, end_date=end_date, env=env, fetch_rows=fetch_rows)
    return {"start_date": start_date, "end_date": end_date, "events": response["data"]["events"]}


def main(client: ApiClient | None = None, now: datetime | None = None, env: Mapping[str, str] | None = None) -> int:
    api = client or ApiClient.from_env(env)
    body = build_body(now, env)
    log("INFO", "Calendar payload built", start_date=body["start_date"], end_date=body["end_date"],
        events=len(body["events"]), fixture_mode=fixture_mode(env))
    response = api.post(ROUTE, body)
    log("INFO", "Calendar sync accepted", status=response.body.get("status"),
        events_upserted=response.body.get("events_upserted"))
    return 0


if __name__ == "__main__":
    sys.exit(run("calendar", main))
