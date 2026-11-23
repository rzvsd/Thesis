"""Weekly official-source refresh.

Port of dispatchOfficialRefresh in apps/scheduler/src/server.ts: fetch official company
truth for each ticker in SCHEDULER_OFFICIAL_SOURCE_TICKERS (default AAPL,MSFT,TSLA), then
the official daily macro, collect their canonical events and
POST /internal/canonical-events/ingest {events}.
"""

from __future__ import annotations

import os
import re
import sys
from typing import Any, Mapping

from api_client import ApiClient
from joblog import log
from official import extract_canonical_events, official_company_response, official_macro_response
from script_main import run
from source_common import fixture_mode

ROUTE = "/internal/canonical-events/ingest"
TICKER_PATTERN = re.compile(r"^[A-Z.-]{1,12}$")


def official_source_tickers(env: Mapping[str, str] | None = None) -> list[str]:
    values = os.environ if env is None else env
    raw = values.get("SCHEDULER_OFFICIAL_SOURCE_TICKERS") or "AAPL,MSFT,TSLA"
    tickers = [item.strip().upper() for item in raw.split(",")]
    return [ticker for ticker in tickers if TICKER_PATTERN.match(ticker)]


def build_body(env: Mapping[str, str] | None = None, **company_kwargs: Any) -> tuple[dict[str, Any], int, int]:
    events: list[dict[str, Any]] = []
    for ticker in official_source_tickers(env):
        events.extend(extract_canonical_events(official_company_response(ticker, env=env, **company_kwargs)))
    company_events = len(events)
    macro_events = extract_canonical_events(official_macro_response(env=env))
    events.extend(macro_events)
    return {"events": events}, company_events, len(macro_events)


def main(client: ApiClient | None = None, env: Mapping[str, str] | None = None) -> int:
    api = client or ApiClient.from_env(env)
    body, company_events, macro_events = build_body(env)
    response = api.post(ROUTE, body)
    upserted = response.body.get("upserted")
    log("INFO", "Official source refresh accepted", company_events=company_events, macro_events=macro_events,
        ingested=upserted if isinstance(upserted, int) else 0, fixture_mode=fixture_mode(env))
    return 0


if __name__ == "__main__":
    sys.exit(run("official-refresh", main))
