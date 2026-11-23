from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pytest

import run_calendar
import run_macro
import run_official_refresh
import run_prices
from earnings_calendar import normalize_earnings_calendar_rows
from eod_prices import EodPrice
from fake_api import make_client
from official import official_company_response, official_macro_response
from schema_check import validate_schema

FIXTURE_ENV: dict[str, str] = {}
LIVE_ENV = {"DATA_OPENBB_FIXTURE_MODE": "false"}
MONDAY_MORNING = datetime(2026, 11, 23, 11, 30, tzinfo=timezone.utc)


# ------------------------------------------------------------------ macro


def test_macro_body_uses_previous_trading_day_and_old_envelope() -> None:
    body = run_macro.build_body(MONDAY_MORNING, FIXTURE_ENV)
    assert body["market_date"] == "2026-11-20"
    macro = body["macro"]
    assert macro["ok"] is True and macro["error_flag"] is False
    assert macro["provider"] == "official_public_macro"
    validate_schema("service-response", macro)
    observations = macro["data"]["observations"]
    assert {item["registry_id"] for item in observations} >= {"TREASURY_DAILY_10Y", "BEA_REAL_GDP"}
    periods = {item["registry_id"]: item["period"] for item in observations}
    assert periods["TREASURY_DAILY_10Y"] == "2026-11-20"
    assert periods["BEA_REAL_GDP"] == "2026-Q4"


def test_macro_live_mode_is_deterministic_default() -> None:
    macro = official_macro_response(as_of="2026-11-20", env=LIVE_ENV)
    assert len(macro["data"]["observations"]) == 6
    assert len(macro["data"]["canonical_events"]) == 6


def test_macro_main_posts_dispatch() -> None:
    client, transport = make_client(lambda method, path, body: (200, {"status": "created"}))
    assert run_macro.main(client, MONDAY_MORNING, FIXTURE_ENV) == 0
    assert [call["path"] for call in transport.calls] == ["/internal/macro-stress/dispatch"]
    assert set(transport.calls[0]["body"]) == {"market_date", "macro"}


# ------------------------------------------------------------------ calendar


def test_calendar_window_is_today_plus_14_in_new_york() -> None:
    late_evening = datetime(2026, 11, 24, 3, 0, tzinfo=timezone.utc)  # still Nov 23 in New York
    body = run_calendar.build_body(late_evening, FIXTURE_ENV)
    assert body["start_date"] == "2026-11-23"
    assert body["end_date"] == "2026-12-07"
    assert isinstance(body["events"], list)


def test_calendar_live_rows_are_normalized_and_filtered() -> None:
    def fake_rows(start: str, end: str) -> list[dict[str, Any]]:
        return [
            {"symbol": "msft", "Earnings Date": "2026-11-25T21:05:00", "when": None},
            {"ticker": "AAPL", "event_date": "2026-11-24", "time": "BMO"},
            {"ticker": "OLD", "event_date": "2026-10-01"},
            {"ticker": "", "event_date": "2026-11-24"},
        ]

    body = run_calendar.build_body(MONDAY_MORNING, LIVE_ENV, fetch_rows=fake_rows)
    events = body["events"]
    assert [event["ticker"] for event in events] == ["AAPL", "MSFT"]
    assert events[0]["event_time"] == "before_market"
    assert events[1]["event_time"] == "after_market"
    assert all(event["event_type"] == "earnings" and event["provider"] == "yfinance" for event in events)


def test_calendar_normalizer_keeps_rows_without_time() -> None:
    rows = normalize_earnings_calendar_rows(
        [{"ticker": "TSLA", "event_date": "2026-11-30"}], start_date="2026-11-23", end_date="2026-12-07"
    )
    assert rows[0]["ticker"] == "TSLA" and "event_time" not in rows[0]


def test_calendar_main_posts_sync() -> None:
    client, transport = make_client(lambda method, path, body: (200, {"status": "ok", "events_upserted": 0}))
    assert run_calendar.main(client, MONDAY_MORNING, FIXTURE_ENV) == 0
    call = transport.calls[0]
    assert call["path"] == "/internal/calendar/sync"
    assert set(call["body"]) == {"start_date", "end_date", "events"}


# ------------------------------------------------------------------ prices


def test_prices_default_provider_marks_all_unavailable_and_chunks_by_50() -> None:
    tickers = [f"T{index:03d}" for index in range(120)]

    def handler(method: str, path: str, body: Any) -> tuple[int, dict[str, Any]]:
        if path == "/internal/data/price-tickers":
            return 200, {"tickers": tickers + ["bad ticker!", "T000"]}
        return 200, {"status": "ok"}

    client, transport = make_client(handler)
    assert run_prices.main(client, MONDAY_MORNING, {}) == 0
    posts = [call for call in transport.calls if call["method"] == "POST"]
    assert [len(call["body"]["prices"]) for call in posts] == [50, 50, 20]
    assert all(call["path"] == "/internal/data/prices/ingest" for call in posts)
    assert all(call["body"]["market_date"] == "2026-11-20" for call in posts)
    entry = posts[0]["body"]["prices"][0]
    assert entry == {"ticker": "T000", "available": False, "reason": "price_provider_not_configured"}


def test_prices_with_a_provider_adapter() -> None:
    class FakeAdapter:
        name = "fake"

        def fetch_eod(self, tickers: list[str]) -> dict[str, EodPrice]:
            return {"AAPL": EodPrice(close=190.5, as_of="2026-11-20", previous_close=189.0)}

    bodies = run_prices.build_chunk_bodies(["AAPL", "MSFT"], "2026-11-20", FakeAdapter())
    assert bodies[0]["prices"] == [
        {"ticker": "AAPL", "available": True, "close": 190.5, "as_of": "2026-11-20", "previous_close": 189.0},
        {"ticker": "MSFT", "available": False, "reason": "price_not_found"},
    ]


def test_prices_no_tickers_posts_nothing() -> None:
    client, transport = make_client(lambda method, path, body: (200, {"tickers": []}))
    assert run_prices.main(client, MONDAY_MORNING, {}) == 0
    assert [call["method"] for call in transport.calls] == ["GET"]


def test_prices_unknown_provider_fails() -> None:
    client, _ = make_client(lambda method, path, body: (200, {"tickers": ["AAPL"]}))
    with pytest.raises(ValueError):
        run_prices.main(client, MONDAY_MORNING, {"PRICE_PROVIDER": "nope"})


# ------------------------------------------------------------------ official refresh


def test_official_refresh_fixture_events() -> None:
    body, company_events, macro_events = run_official_refresh.build_body(FIXTURE_ENV)
    assert company_events == 3 and macro_events == 2  # golden fixture has two macro events
    assert len(body["events"]) == 5
    for event in body["events"]:
        validate_schema("canonical-event", event)
    assert {event["subject_id"] for event in body["events"][:3]} == {"AAPL", "MSFT", "TSLA"}


def test_official_tickers_env_is_filtered() -> None:
    env = {"SCHEDULER_OFFICIAL_SOURCE_TICKERS": "nvda, brk.b ,bad ticker,123"}
    assert run_official_refresh.official_source_tickers(env) == ["NVDA", "BRK.B"]


def test_official_company_unknown_fixture_ticker_uses_seed_record() -> None:
    response = official_company_response("NVDA", env=FIXTURE_ENV)
    event = response["data"]["canonical_events"][0]
    assert event["id"] == "official-company-nvda-seed"
    assert event["metadata"]["cik"] == "0001045810"


def test_official_company_live_with_fake_sec() -> None:
    def fake_fetch(url: str, *, headers: dict[str, str]) -> dict[str, Any]:
        assert headers["user-agent"]
        if "submissions" in url:
            return {
                "name": "Apple Inc.",
                "filings": {
                    "recent": {
                        "form": ["10-Q", "8-K"],
                        "filingDate": ["2026-10-31", "2026-10-30"],
                        "accessionNumber": ["0000320193-26-000100", "0000320193-26-000099"],
                    }
                },
            }
        return {"entityName": "Apple Inc.", "cik": 320193, "facts": {"us-gaap": {}, "dei": {}}}

    response = official_company_response("AAPL", env=LIVE_ENV, fetch_json=fake_fetch)
    data = response["data"]
    assert data["facts"]["taxonomy_count"] == 2
    event = data["canonical_events"][0]
    assert event["id"] == "official-company-aapl-0000320193-26-000100"
    assert event["occurred_at"] == "2026-10-31T00:00:00.000Z"


def test_official_refresh_main_posts_ingest() -> None:
    client, transport = make_client(lambda method, path, body: (200, {"upserted": 5}))
    assert run_official_refresh.main(client, FIXTURE_ENV) == 0
    assert transport.calls[0]["path"] == "/internal/canonical-events/ingest"
    assert len(transport.calls[0]["body"]["events"]) == 5
