"""News fetch: read every source and store the headlines (rebuild branch audit NG8).

Runs a few times a day (.github/workflows/rebuild-news.yml), so the store has the day's headlines even when a
feed only shows its newest items or the fetch at Pulse time fails.

1. GET /internal/data/price-tickers -> the tickers people follow. MARKET_PULSE_TICKERS are added.
2. Read every feed (news_ingest.py) and the SEC filings of those tickers (company_filings.py) for the last
   NEWS_LOOKBACK_DAYS days (default 3).
3. POST /internal/news/ingest {items, sources}.

Fixture mode stores nothing: fixtures are test data. The step fails when no source could be read.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping

from api_client import ApiClient
from company_filings import filings_reader
from joblog import log
from news_ingest import news_response
from news_store import post_news
from run_prices import TICKERS_ROUTE, clean_tickers
from run_pulse import pulse_tickers
from script_main import EXIT_FAILED, EXIT_OK, run
from source_common import fixture_mode

DEFAULT_LOOKBACK_DAYS = 3
# A source that answers but has published nothing for this long has probably moved or stopped.
STALE_AFTER_DAYS = 10


def lookback_days(env: Mapping[str, str] | None = None) -> int:
    raw = str((os.environ if env is None else env).get("NEWS_LOOKBACK_DAYS", "")).strip()
    return int(raw) if raw.isdigit() and 1 <= int(raw) <= 14 else DEFAULT_LOOKBACK_DAYS


def followed_tickers(api: ApiClient, env: Mapping[str, str] | None = None) -> list[str]:
    tickers = clean_tickers(api.get(TICKERS_ROUTE).body.get("tickers"))
    for ticker in pulse_tickers(env):
        if ticker not in tickers:
            tickers.append(ticker)
    return tickers


def stale_sources(sources: list[dict[str, Any]], now: datetime) -> list[str]:
    stale: list[str] = []
    for status in sources:
        newest = status.get("newest_item_at")
        if status.get("ok") is not True or not isinstance(newest, str):
            continue
        newest_at = datetime.fromisoformat(newest.replace("Z", "+00:00"))
        if now - newest_at > timedelta(days=STALE_AFTER_DAYS):
            stale.append(str(status.get("source")))
    return stale


def main(client: ApiClient | None = None, now: datetime | None = None, env: Mapping[str, str] | None = None,
         **news_kwargs: Any) -> int:
    if fixture_mode(env):
        log("INFO", "Fixture mode: no news is fetched or stored")
        return EXIT_OK
    api = client or ApiClient.from_env(env)
    moment = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    start = moment - timedelta(days=lookback_days(env))
    tickers = followed_tickers(api, env)
    _, body = news_response(
        moment.date().isoformat(),
        window_start=start.isoformat().replace("+00:00", "Z"),
        window_end=moment.isoformat().replace("+00:00", "Z"),
        env=env,
        now=moment,
        extra_readers=(filings_reader(tickers, env),),
        **news_kwargs,
    )
    sources = body.get("sources") if isinstance(body.get("sources"), list) else []
    failed = sorted(str(status.get("source")) for status in sources if status.get("ok") is not True)
    stale = stale_sources(sources, moment)
    items = body["data"] if body.get("ok") is True else []
    # Reading the sources took its own time. Storing gets a full budget, so a slow source cannot cost the
    # headlines that were read.
    api.start_step()
    stored = post_news(api, items, sources)
    log("INFO" if not failed and not stale else "WARN", "News stored", items=len(items), stored=stored,
        tickers=len(tickers), sources=len(sources), failed_sources=",".join(failed), stale_sources=",".join(stale))
    if body.get("ok") is not True:
        log("ERROR", "No news source could be read")
        return EXIT_FAILED
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(run("news", main))
