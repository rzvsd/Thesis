"""The news store calls: run_news.py, and the Pulse job reading its window back (audit NG8). No network."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pytest

import news_ingest
import news_store
import run_news
import run_pulse
from fake_api import make_client

LIVE_ENV = {"DATA_OPENBB_FIXTURE_MODE": "false", "MARKET_PULSE_TICKERS": "AAPL"}
NOW = datetime(2026, 3, 13, 12, 0, tzinfo=timezone.utc)


@pytest.fixture(autouse=True)
def fresh_news_limiters() -> None:
    news_ingest._LIMITERS.clear()


def article(link: str, title: str, published_at: str) -> dict[str, Any]:
    return news_ingest.build_article(
        source_key="fed-press", source_name="Federal Reserve", rights="official_public", url=link, title=title,
        published_at=published_at, retrieved_at="2026-03-13T12:00:00Z",
    )


def feed_loader(source: news_ingest.ApprovedSource, requested_date: str) -> str:
    if source.key != "fed-press":
        raise news_ingest.SourceFetchError("down")
    return (
        '<rss version="2.0"><channel>'
        "<item><title>Fed holds rates</title><link>https://example.test/a</link>"
        "<pubDate>Fri, 13 Mar 2026 08:15:00 GMT</pubDate></item>"
        "<item><title>Too old</title><link>https://example.test/old</link>"
        "<pubDate>Sun, 01 Mar 2026 08:15:00 GMT</pubDate></item>"
        "</channel></rss>"
    )


def no_filings(url: str, *, headers: dict[str, str]) -> dict[str, Any]:
    return {"name": "Apple Inc.", "filings": {"recent": {"form": []}}}


def test_run_news_reads_followed_tickers_and_stores_items_and_source_results(monkeypatch: pytest.MonkeyPatch) -> None:
    asked: list[list[str]] = []

    def fake_reader(tickers: list[str], env: Any = None, **kwargs: Any) -> Any:
        asked.append(list(tickers))
        return lambda keep, retrieved_at: ([], {"source": "sec-edgar-filings", "ok": True, "article_count": 0})

    monkeypatch.setattr(run_news, "filings_reader", fake_reader)

    def handler(method: str, path: str, body: Any) -> tuple[int, Any]:
        if path == "/internal/data/price-tickers":
            return 200, {"tickers": ["MSFT", "bad ticker", "NVDA"]}
        return 200, {"status": "ok", "stored": len(body["items"])}

    client, transport = make_client(handler)
    assert run_news.main(client, NOW, LIVE_ENV, source_loader=feed_loader) == 0
    assert asked == [["MSFT", "NVDA", "AAPL"]]
    assert [call["path"] for call in transport.calls] == ["/internal/data/price-tickers", "/internal/news/ingest"]
    posted = transport.calls[1]["body"]
    # Three days back from now: the item of 1 March is outside.
    assert [item["title"] for item in posted["items"]] == ["Fed holds rates"]
    assert len(posted["sources"]) == 8
    assert posted["sources"][0] == {
        "source": "fed-press", "ok": True, "article_count": 1, "newest_item_at": "2026-03-13T08:15:00Z",
    }
    assert posted["sources"][1]["error_code"] == "PROVIDER_OUTAGE"


def test_run_news_fails_when_nothing_could_be_read_but_still_reports_the_sources(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(run_news, "filings_reader", lambda tickers, env=None, **kw: (
        lambda keep, retrieved_at: ([], {"source": "sec-edgar-filings", "ok": False, "article_count": 0,
                                         "error_code": "PROVIDER_OUTAGE"})
    ))

    def down(source: news_ingest.ApprovedSource, requested_date: str) -> str:
        raise news_ingest.SourceFetchError("down")

    client, transport = make_client(lambda method, path, body: (200, {"tickers": [], "stored": 0}))
    assert run_news.main(client, NOW, LIVE_ENV, source_loader=down) == 1
    posted = transport.calls[1]["body"]
    assert posted["items"] == [] and len(posted["sources"]) == 8


def test_run_news_does_nothing_in_fixture_mode() -> None:
    client, transport = make_client(lambda method, path, body: (500, {}))
    assert run_news.main(client, NOW, {}) == 0
    assert transport.calls == []


def test_stale_source_is_one_that_answers_with_only_old_items() -> None:
    sources = [
        {"source": "fresh", "ok": True, "article_count": 0, "newest_item_at": "2026-03-10T00:00:00Z"},
        {"source": "old", "ok": True, "article_count": 0, "newest_item_at": "2026-02-20T00:00:00Z"},
        {"source": "down", "ok": False, "article_count": 0, "error_code": "PROVIDER_OUTAGE"},
        {"source": "empty", "ok": True, "article_count": 0},
    ]
    assert run_news.stale_sources(sources, NOW) == ["old"]
    assert run_news.lookback_days({"NEWS_LOOKBACK_DAYS": "7"}) == 7
    assert run_news.lookback_days({"NEWS_LOOKBACK_DAYS": "99"}) == 3


def test_post_news_sends_chunks_and_the_sources_once() -> None:
    client, transport = make_client(lambda method, path, body: (200, {"stored": len(body["items"])}))
    items = [article(f"https://example.test/{index}", f"Item {index}", "2026-03-13T08:00:00Z") for index in range(501)]
    assert news_store.post_news(client, items, [{"source": "fed-press", "ok": True, "article_count": 501}]) == 501
    bodies = [call["body"] for call in transport.calls]
    assert [len(body["items"]) for body in bodies] == [500, 1]
    assert "sources" in bodies[0] and "sources" not in bodies[1]


def test_pulse_window_is_fresh_headlines_plus_what_the_store_holds() -> None:
    fresh_item = article("https://example.test/a", "Fed holds rates", "2026-03-13T08:15:00Z")
    earlier = article("https://example.test/b", "Seen at noon yesterday", "2026-03-12T16:00:00Z")
    fresh = {"ok": True, "data": [fresh_item], "error_flag": False, "provider": "approved-sources",
             "sources": [{"source": "fed-press", "ok": True, "article_count": 1}]}

    def handler(method: str, path: str, body: Any) -> tuple[int, Any]:
        if method == "POST":
            return 200, {"stored": len(body["items"])}
        return 200, {"items": [fresh_item, earlier]}

    client, transport = make_client(handler)
    merged = news_store.with_stored_news(client, fresh, "2026-03-12T10:30:00.000Z", "2026-03-13T10:31:00.000Z")
    assert merged["ok"] is True and [item["title"] for item in merged["data"]] == ["Fed holds rates", "Seen at noon yesterday"]
    assert transport.calls[0]["body"] == {"items": [fresh_item], "sources": fresh["sources"]}
    assert transport.calls[1]["path"] == (
        "/internal/news?since=2026-03-12T10%3A30%3A00.000Z&until=2026-03-13T10%3A31%3A00.000Z&limit=500"
    )
    news_ingest.validate_response(merged)


def test_pulse_uses_stored_headlines_when_the_fresh_read_was_an_outage() -> None:
    earlier = article("https://example.test/b", "Seen at noon yesterday", "2026-03-12T16:00:00Z")
    outage = {"ok": False, "data": [], "error_flag": True, "error_code": "PROVIDER_OUTAGE",
              "error_message": "Approved source unavailable; returning empty list.",
              "sources": [{"source": "fed-press", "ok": False, "article_count": 0, "error_code": "PROVIDER_OUTAGE"}]}

    client, transport = make_client(lambda method, path, body: (200, {"stored": 0, "items": [earlier]}))
    merged = news_store.with_stored_news(client, outage, "2026-03-12T10:30:00.000Z", "2026-03-13T10:31:00.000Z")
    assert merged["ok"] is True and merged["error_flag"] is False and "error_code" not in merged
    assert [item["title"] for item in merged["data"]] == ["Seen at noon yesterday"]
    # The failed source results are still stored, so the store knows the feed was down.
    assert transport.calls[0]["body"] == {"items": [], "sources": outage["sources"]}

    # Nothing stored either: the outage stays an outage.
    client, _ = make_client(lambda method, path, body: (200, {"stored": 0, "items": []}))
    assert news_store.with_stored_news(client, outage, "2026-03-12T10:30:00.000Z", "2026-03-13T10:31:00.000Z") == outage


def test_pulse_keeps_the_fresh_headlines_when_the_store_cannot_be_reached() -> None:
    fresh = {"ok": True, "data": [article("https://example.test/a", "Fed holds rates", "2026-03-13T08:15:00Z")],
             "error_flag": False, "sources": []}
    client, _ = make_client(lambda method, path, body: (404, {"error": "not_found"}))
    assert news_store.with_stored_news(client, fresh, "2026-03-12T10:30:00.000Z", "2026-03-13T10:31:00.000Z") == fresh


def test_pulse_main_goes_through_the_store_in_live_mode_only(monkeypatch: pytest.MonkeyPatch) -> None:
    fresh_item = article("https://example.test/a", "Fed holds rates", "2026-03-13T08:15:00Z")

    def fake_build_body(now: Any = None, env: Any = None) -> dict[str, Any]:
        return {"cycle_start": "2026-03-12T10:30:00.000Z", "cycle_end": "2026-03-13T10:31:00.000Z",
                "inputs": {"companies": {}, "first_party": {},
                           "news": {"ok": True, "data": [fresh_item], "error_flag": False, "sources": []}}}

    monkeypatch.setattr(run_pulse, "build_body", fake_build_body)
    earlier = article("https://example.test/b", "Seen earlier", "2026-03-12T16:00:00Z")

    def handler(method: str, path: str, body: Any) -> tuple[int, Any]:
        if path == "/internal/pulse/dispatch":
            return 202, {"job": {"job_id": "j1", "status": "complete"}}
        return 200, {"stored": 1, "items": [earlier]}

    client, transport = make_client(handler)
    assert run_pulse.main(client, None, LIVE_ENV) == 0
    paths = [call["path"].split("?")[0] for call in transport.calls]
    assert paths == ["/internal/news/ingest", "/internal/news", "/internal/pulse/dispatch"]
    sent = transport.calls[2]["body"]["inputs"]["news"]["data"]
    assert [item["title"] for item in sent] == ["Fed holds rates", "Seen earlier"]

    client, transport = make_client(handler)
    assert run_pulse.main(client, None, {}) == 0  # fixture mode
    assert [call["path"] for call in transport.calls] == ["/internal/pulse/dispatch"]
