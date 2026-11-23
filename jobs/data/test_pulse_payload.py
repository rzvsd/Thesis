"""run_pulse payload building and the ported tape, structural, news and first-party sources. No network."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pytest

import first_party
import news_ingest
import run_pulse
from fake_api import make_client
from market_tape import live_market_tape, market_tape_response
from schema_check import validate_schema
from source_common import ProviderIntegrationError
from structural import live_structural_context, structural_response

FIXTURE_ENV: dict[str, str] = {}
LIVE_ENV = {"DATA_OPENBB_FIXTURE_MODE": "false"}
# Friday 06:30 New York (winter): the window is Thursday 06:30 to now.
FRIDAY_MORNING = datetime(2026, 11, 20, 11, 30, tzinfo=timezone.utc)


@pytest.fixture(autouse=True)
def fresh_news_limiters() -> None:
    # The per-source limiter allows 5 calls a minute in one run; each test is a new run.
    news_ingest._LIMITERS.clear()


def test_body_has_cycle_window_and_every_input() -> None:
    body = run_pulse.build_body(FRIDAY_MORNING, FIXTURE_ENV)
    assert body["cycle_start"] == "2026-11-19T11:30:00.000Z"
    assert body["cycle_end"] == "2026-11-20T11:30:00.000Z"
    inputs = body["inputs"]
    assert set(inputs) == {"market_tape", "macro", "structural", "companies", "first_party", "news", "calendar_events"}
    for name in ("market_tape", "macro", "structural"):
        assert inputs[name]["ok"] is True, name
        validate_schema("service-response", inputs[name])
    assert inputs["market_tape"]["data"]["as_of"] == "2026-11-20"
    assert inputs["structural"]["data"]["subject_type"] == "market_pulse"
    assert inputs["macro"]["data"]["observations"]
    assert sorted(inputs["companies"]) == ["AAPL", "MSFT", "TSLA"]
    assert all(envelope["ok"] for envelope in inputs["companies"].values())
    assert sorted(inputs["first_party"]) == ["AAPL", "MSFT", "TSLA"]
    assert inputs["first_party"]["AAPL"]["data"]["context_items"][0]["ticker"] == "AAPL"
    # Old fixture behaviour: news fixtures exist only for 2026-03-13, so other days are an outage envelope.
    assert inputs["news"]["ok"] is False
    assert inputs["news"]["error_code"] == "PROVIDER_OUTAGE"
    assert isinstance(inputs["calendar_events"], list)


def test_tickers_follow_market_pulse_tickers() -> None:
    body = run_pulse.build_body(FRIDAY_MORNING, {"MARKET_PULSE_TICKERS": "msft, nvda"})
    assert sorted(body["inputs"]["companies"]) == ["MSFT", "NVDA"]
    assert sorted(body["inputs"]["first_party"]) == ["MSFT"]


def test_calendar_window_is_as_of_plus_seven_days() -> None:
    inputs = run_pulse.build_inputs("2026-03-27", ["AAPL", "MSFT"], FIXTURE_ENV)
    assert [(e["ticker"], e["event_date"]) for e in inputs["calendar_events"]] == [
        ("AAPL", "2026-03-31"),
        ("MSFT", "2026-04-02"),
    ]


def test_failed_source_becomes_old_error_envelope() -> None:
    def boom() -> dict[str, Any]:
        raise ProviderIntegrationError("market_tape", error_code="PROVIDER_OUTAGE", message="down", status_code=503)

    assert run_pulse.guarded("market_tape", boom) == {
        "ok": False,
        "data": None,
        "error_flag": True,
        "error_message": "HTTP 503",
    }
    assert run_pulse.guarded("x", lambda: 1 / 0)["error_message"] == "HTTP 500"  # type: ignore[arg-type,return-value]
    assert run_pulse.http_envelope("news", (422, {"ok": False}))["error_message"] == "HTTP 422"


def test_market_tape_fixture_matches_old_default() -> None:
    tape = market_tape_response(as_of="2026-11-20", env=FIXTURE_ENV)["data"]
    validate_schema("market-tape", tape)
    assert tape["coverage_state"] == "full"
    assert [entry["instrument_id"] for entry in tape["indices"]] == ["SP500", "DJIA", "NASDAQCOM", "RUSSELL2000"]
    assert tape["summary"].startswith("US risk assets were broadly higher on the day.")
    assert tape["sector_leadership"]["leaders"][0]["instrument_id"] == "XLE"


def test_market_tape_live_reads_fred_pairs() -> None:
    def fred(url: str) -> str:
        if "DGS2" in url:
            raise OSError("down")
        return "#2026-11-18|100.0\n#2026-11-19|101.0\n#2026-11-20|.\n#2026-11-21|999\n"

    tape = live_market_tape(as_of="2026-11-20", fetch_text=fred)
    assert len(tape["indices"]) == 3  # Russell 2000 has no free series
    sp500 = tape["indices"][0]
    assert (sp500["value"], sp500["previous_value"], sp500["period"], sp500["direction"]) == (101.0, 100.0, "2026-11-19", "up")
    omission_ids = {entry["omission_id"] for entry in tape["omissions"]}
    assert {"russell2000-omitted", "dgs2-fetch-failed", "sector-basket-free-path-unavailable"} <= omission_ids
    assert tape["coverage_state"] == "partial"


def test_structural_fixture_and_live() -> None:
    fixture = structural_response(as_of="2026-11-20", env=FIXTURE_ENV)["data"]
    assert fixture["subject_id"] == "US" and fixture["coverage_state"] == "partial"
    assert len(fixture["observations"]) == 11

    def world_bank(url: str) -> list[Any]:
        if "SP.POP.TOTL" in url:
            return [{}, [{"date": "2027", "value": 1}, {"date": "2024", "value": None}]]
        return [{}, [{"date": "2025", "value": 12.5, "country": {"value": "United States"}}]]

    live = live_structural_context(country="US", subject_type="market_pulse", as_of="2026-11-20", fetch_json_list=world_bank)
    assert len(live["observations"]) == 10
    assert "world-bank-population-missing" in {entry["omission_id"] for entry in live["omissions"]}


def test_news_reads_rss_and_html_sources() -> None:
    def loader(source: news_ingest.ApprovedSource, requested_date: str) -> str:
        if source.method == "html":
            return "<html><body>No articles today.</body></html>"
        return news_ingest.fetch_fixture_text(source, "2026-03-13")

    status, body = news_ingest.news_response("2026-03-13", source_loader=loader)
    assert status == 200 and body["ok"] is True
    assert [article["source"] for article in body["data"]] == ["Bloomberg", "Reuters"]
    assert all(article["published_at"].startswith("2026-03-13") for article in body["data"])

    status, body = news_ingest.news_response("2026-13-40")
    assert status == 400 and body["error_code"] == "INTERNAL_ERROR"


def test_first_party_fixture_live_and_rejection() -> None:
    status, body = first_party.first_party_context_response("AAPL", "https://investor.apple.com/investor-relations/")
    assert status == 200 and body["ok"] is True
    assert body["data"]["context_items"][0]["metadata"]["fixture"] is True

    status, body = first_party.first_party_context_response("AAPL", "https://evil.example/x")
    assert status == 422 and body["error_code"] == "SOURCE_REJECTED"

    status, body = first_party.first_party_context_response("TSLA", "https://ir.tesla.com/", env=LIVE_ENV)
    assert status == 200 and body["data"]["context_items"][0]["metadata"]["live_metadata_only"] is True


def test_main_posts_once_and_fails_on_failed_job() -> None:
    client, transport = make_client(
        lambda method, path, body: (202, {"deduplicated": False, "job": {"job_id": "j1", "status": "complete"}})
    )
    assert run_pulse.main(client, FRIDAY_MORNING, FIXTURE_ENV) == 0
    assert [call["path"] for call in transport.calls] == ["/internal/pulse/dispatch"]
    assert set(transport.calls[0]["body"]) == {"cycle_start", "cycle_end", "inputs"}

    failed, _ = make_client(lambda method, path, body: (202, {"job": {"job_id": "j2", "status": "failed"}}))
    assert run_pulse.main(failed, FRIDAY_MORNING, FIXTURE_ENV) == 1

    dedup, _ = make_client(lambda method, path, body: (200, {"deduplicated": True, "job": {"status": "complete"}}))
    assert run_pulse.main(dedup, FRIDAY_MORNING, FIXTURE_ENV) == 0
