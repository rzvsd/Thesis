"""Headline reading: one source failing, the time window and the weekend reach-back. No network."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

import news_ingest
import run_pulse


@pytest.fixture(autouse=True)
def fresh_news_limiters() -> None:
    news_ingest._LIMITERS.clear()


def rss(*items: tuple[str, str, str]) -> str:
    body = "".join(
        f"<item><title>{title}</title><link>{link}</link><pubDate>{published}</pubDate>"
        f"<description>{title}</description></item>"
        for title, link, published in items
    )
    return f'<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>{body}</channel></rss>'


def loader_for(by_key: dict[str, str | Exception]):
    def loader(source: news_ingest.ApprovedSource, requested_date: str) -> str:
        answer = by_key[source.key]
        if isinstance(answer, Exception):
            raise answer
        return answer

    return loader


REUTERS_ITEM = ("Fed holds rates", "https://example.test/r1", "Fri, 13 Mar 2026 08:15:00 GMT")
BLOOMBERG_ITEM = ("Oil climbs", "https://example.test/b1", "Fri, 13 Mar 2026 09:00:00 GMT")


def test_one_failed_source_keeps_the_others() -> None:
    loader = loader_for({
        "reuters-business": news_ingest.SourceFetchError("down"),
        "bloomberg-markets": rss(BLOOMBERG_ITEM),
        "wsj-markets": news_ingest.HtmlFallbackDependencyError("no parser"),
    })
    status, body = news_ingest.news_response("2026-03-13", source_loader=loader)
    assert status == 200 and body["ok"] is True and body["error_flag"] is False
    assert [article["title"] for article in body["data"]] == ["Oil climbs"]
    assert body["sources"] == [
        {"source": "reuters-business", "ok": False, "article_count": 0, "error_code": "PROVIDER_OUTAGE"},
        {"source": "bloomberg-markets", "ok": True, "article_count": 1},
        {"source": "wsj-markets", "ok": False, "article_count": 0, "error_code": "INTERNAL_ERROR"},
    ]


def test_broken_feed_and_unexpected_error_are_one_source_each() -> None:
    loader = loader_for({
        "reuters-business": "<rss><channel><item>",  # not well-formed
        "bloomberg-markets": RuntimeError("surprise"),
        "wsj-markets": "<html><body><p>No articles today.</p></body></html>",
    })
    status, body = news_ingest.news_response("2026-03-13", source_loader=loader)
    assert status == 200 and body["ok"] is True and body["data"] == []
    assert [entry["error_code"] for entry in body["sources"] if not entry["ok"]] == ["SCHEMA_MISMATCH", "INTERNAL_ERROR"]


def test_every_source_failing_is_an_outage_not_a_quiet_day() -> None:
    down = news_ingest.SourceFetchError("down")
    loader = loader_for({"reuters-business": down, "bloomberg-markets": down, "wsj-markets": down})
    status, body = news_ingest.news_response("2026-03-13", source_loader=loader)
    assert status == 200 and body["ok"] is False and body["error_flag"] is True
    assert body["error_code"] == "PROVIDER_OUTAGE" and body["provider"] == "reuters-business"
    assert len(body["sources"]) == 3 and not any(entry["ok"] for entry in body["sources"])


def test_same_link_from_two_feeds_is_kept_once() -> None:
    loader = loader_for({
        "reuters-business": rss(REUTERS_ITEM, REUTERS_ITEM),
        "bloomberg-markets": rss(REUTERS_ITEM, BLOOMBERG_ITEM),
        "wsj-markets": news_ingest.SourceFetchError("down"),
    })
    _, body = news_ingest.news_response("2026-03-13", source_loader=loader)
    assert [article["url"] for article in body["data"]] == ["https://example.test/b1", "https://example.test/r1"]


def test_window_keeps_yesterdays_session_that_the_utc_date_dropped() -> None:
    feed = rss(
        ("Before the window", "https://example.test/old", "Wed, 11 Mar 2026 20:00:00 GMT"),
        ("Yesterday afternoon", "https://example.test/pm", "Thu, 12 Mar 2026 19:30:00 GMT"),
        ("After the close", "https://example.test/ah", "Thu, 12 Mar 2026 21:10:00 GMT"),
        ("This morning", "https://example.test/am", "Fri, 13 Mar 2026 09:00:00 GMT"),
        ("After the run", "https://example.test/late", "Fri, 13 Mar 2026 12:00:00 GMT"),
    )
    down = news_ingest.SourceFetchError("down")
    loader = loader_for({"reuters-business": feed, "bloomberg-markets": down, "wsj-markets": down})

    _, by_date = news_ingest.news_response("2026-03-13", source_loader=loader)
    assert [article["title"] for article in by_date["data"]] == ["After the run", "This morning"]

    _, by_window = news_ingest.news_response(
        "2026-03-13", window_start="2026-03-12T10:30:00.000Z", window_end="2026-03-13T10:30:00.000Z",
        source_loader=loader,
    )
    assert [article["title"] for article in by_window["data"]] == [
        "This morning", "After the close", "Yesterday afternoon",
    ]


def test_bad_window_is_refused() -> None:
    status, body = news_ingest.news_response("2026-03-13", window_start="2026-03-12T10:30:00Z", window_end="soon")
    assert status == 400 and body["ok"] is False
    status, _ = news_ingest.news_response(
        "2026-03-13", window_start="2026-03-13T10:30:00Z", window_end="2026-03-12T10:30:00Z"
    )
    assert status == 400


def test_news_window_reaches_back_over_the_weekend() -> None:
    # Tuesday to Friday: the Pulse cycle as it is.
    assert news_ingest.news_window("2026-03-12T10:30:00.000Z", "2026-03-13T10:31:00.000Z") == (
        "2026-03-12T10:30:00.000Z", "2026-03-13T10:31:00.000Z",
    )
    # Monday 2026-03-16: the cycle starts Sunday 06:30 New York; headlines start Friday 06:30 New York.
    assert news_ingest.news_window("2026-03-15T10:30:00.000Z", "2026-03-16T10:31:00.000Z") == (
        "2026-03-13T10:30:00.000Z", "2026-03-16T10:31:00.000Z",
    )
    # Clocks go back on Sunday 2026-11-01: Friday 06:30 New York is 10:30 UTC, Sunday 06:30 is 11:30 UTC.
    assert news_ingest.news_window("2026-11-01T11:30:00.000Z", "2026-11-02T11:31:00.000Z")[0] == "2026-10-30T10:30:00.000Z"


def test_pulse_passes_the_window_to_the_news_source(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: dict[str, object] = {}

    def fake_news(as_of: str, **kwargs: object) -> tuple[int, dict[str, object]]:
        seen.update({"as_of": as_of, **kwargs})
        return 200, {"ok": True, "data": [], "error_flag": False}

    monkeypatch.setattr(run_pulse, "news_response", fake_news)
    monday = datetime(2026, 3, 16, 10, 31, tzinfo=timezone.utc)
    body = run_pulse.build_body(monday, {"DATA_OPENBB_FIXTURE_MODE": "true"})
    assert body["cycle_start"] == "2026-03-15T10:30:00.000Z"
    assert seen["as_of"] == "2026-03-16"
    assert seen["window_start"] == "2026-03-13T10:30:00.000Z"
    assert seen["window_end"] == body["cycle_end"]
