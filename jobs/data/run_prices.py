"""Prices: fetch end-of-day closes for the tickers the evaluators need and send them.

1. GET /internal/data/price-tickers -> {tickers}
2. For each chunk of 50: build the old GET /v1/market/eod-prices data.prices list with the
   PRICE_PROVIDER adapter (default "none": every ticker unavailable), then
   POST /internal/data/prices/ingest {market_date, prices}.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime
from typing import Any, Mapping

from api_client import ApiClient
from eod_prices import MAX_TICKERS, TICKER_PATTERN, PriceAdapter, build_eod_prices_payload, resolve_price_adapter
from joblog import log
from market_time import previous_us_trading_day
from retry import RateLimiter
from script_main import run

TICKERS_ROUTE = "/internal/data/price-tickers"
INGEST_ROUTE = "/internal/data/prices/ingest"
CHUNK_SIZE = MAX_TICKERS  # 50, the old per-request limit


def clean_tickers(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    tickers: list[str] = []
    for item in raw:
        if not isinstance(item, str):
            continue
        ticker = item.strip().upper()
        if TICKER_PATTERN.match(ticker) and ticker not in tickers:
            tickers.append(ticker)
    return tickers


def chunks(items: list[str], size: int = CHUNK_SIZE) -> list[list[str]]:
    return [items[start : start + size] for start in range(0, len(items), size)]


def build_chunk_bodies(
    tickers: list[str], market_date: str, adapter: PriceAdapter, limiter: RateLimiter | None = None
) -> list[dict[str, Any]]:
    bodies: list[dict[str, Any]] = []
    for batch in chunks(tickers):
        if limiter is not None:
            limiter.acquire()
        payload, provider_error = build_eod_prices_payload(batch, adapter)
        if provider_error is not None:
            log("WARN", "EOD price provider failed; prices reported unavailable", provider=adapter.name)
        bodies.append({"market_date": market_date, "prices": payload["prices"]})
    return bodies


def main(client: ApiClient | None = None, now: datetime | None = None, env: Mapping[str, str] | None = None) -> int:
    values = os.environ if env is None else env
    api = client or ApiClient.from_env(env)
    market_date = previous_us_trading_day(now).isoformat()
    tickers = clean_tickers(api.get(TICKERS_ROUTE).body.get("tickers"))
    if not tickers:
        log("INFO", "No tickers need prices", market_date=market_date)
        return 0

    adapter = resolve_price_adapter(values.get("PRICE_PROVIDER"))
    limiter = RateLimiter(per_minute=int(values.get("PRICE_PROVIDER_RATE_LIMIT_PER_MINUTE", "") or 60))
    available = 0
    for body in build_chunk_bodies(tickers, market_date, adapter, limiter):
        api.post(INGEST_ROUTE, body)
        available += sum(1 for entry in body["prices"] if entry.get("available"))
    log("INFO", "Prices ingested", market_date=market_date, provider=adapter.name, tickers=len(tickers),
        available=available, unavailable=len(tickers) - available)
    return 0


if __name__ == "__main__":
    sys.exit(run("prices", main))
