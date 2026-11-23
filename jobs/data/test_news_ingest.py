"""Headline reading: sources, rights, one source failing, the time window and the weekend reach-back. No network."""

from __future__ import annotations

import io
import urllib.error
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
        f"<description>Summary text of {title} that must never be kept.</description></item>"
        for title, link, published in items
    )
    return f'<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>{body}</channel></rss>'


DOWN = news_ingest.SourceFetchError("down")


def loader_for(by_key: dict[str, str | bytes | Exception]):
    """A loader that answers the named sources and reports every other source as unreachable."""

    def loader(source: news_ingest.ApprovedSource, requested_date: str) -> str | bytes:
        answer = by_key.get(source.key, DOWN)
        if isinstance(answer, Exception):
            raise answer
        return answer

    return loader


FED_ITEM = ("Fed holds rates", "https://example.test/r1", "Fri, 13 Mar 2026 08:15:00 GMT")
SEC_ITEM = ("Oil climbs", "https://example.test/b1", "Fri, 13 Mar 2026 09:00:00 GMT")
SOURCE_KEYS = [source.key for source in news_ingest.APPROVED_SOURCES]


def test_sources_are_official_feeds_plus_headline_only_publishers() -> None:
    by_rights = {source.key: source.rights for source in news_ingest.APPROVED_SOURCES}
    assert by_rights == {
        "fed-press": "official_public",
        "sec-press": "official_public",
        "ecb-press": "official_public",
        "eia-today": "official_public",
        "bea-news": "official_public",
        "wsj-markets": "headline_link_only",
        "wsj-world": "headline_link_only",
    }
    assert all(source.url.startswith("https://") for source in news_ingest.APPROVED_SOURCES)
    # The owner can leave publisher feeds out with one setting.
    official_only = news_ingest.active_sources({"NEWS_PUBLISHER_HEADLINES": "false"})
    assert [source.key for source in official_only] == SOURCE_KEYS[:5]
    assert len(news_ingest.active_sources({})) == 7


def test_fixture_day_reads_every_source_and_keeps_headlines_only() -> None:
    status, body = news_ingest.news_response("2026-03-13")
    assert status == 200 and body["ok"] is True
    assert [entry["source"] for entry in body["sources"]] == SOURCE_KEYS
    assert all(entry["ok"] for entry in body["sources"])
    by_source = {article["source_key"]: article for article in body["data"]}
    assert sorted(by_source) == ["ecb-press", "eia-today", "fed-press", "sec-press", "wsj-markets", "wsj-world"]
    # The ECB feed writes a leading space and a doubled slash; an ISO-8859-1 feed and CDATA dates are read.
    assert by_source["ecb-press"]["title"] == "Monetary policy decisions"
    assert by_source["ecb-press"]["url"].startswith("https://www.ecb.europa.eu/press/pr/")
    assert by_source["eia-today"]["published_at"] == "2026-03-13T13:00:00Z"
    assert by_source["fed-press"]["title"] == "Federal Reserve issues FOMC statement"
    # BEA's only item is from the day before: read fine, nothing kept, and the feed's newest date is reported.
    bea = body["sources"][4]
    assert (bea["article_count"], bea["newest_item_at"]) == (0, "2026-03-12T12:30:00Z")
    for article in body["data"]:
        # No summary text anywhere: the body repeats the headline.
        assert article["body_text"] == article["title"]
        assert "must never be kept" not in str(article)


def test_publisher_headline_is_cut_to_120_characters_and_opinion_is_left_out() -> None:
    _, body = news_ingest.news_response("2026-03-13")
    wsj = [article for article in body["data"] if article["rights"] == "headline_link_only"]
    assert [article["source"] for article in wsj] == ["WSJ", "WSJ"]
    assert all(len(article["title"]) <= 120 for article in wsj)
    long_one = next(article for article in wsj if article["source_key"] == "wsj-markets")
    assert long_one["title"].endswith("\u2026") and long_one["title"].startswith("Example Markets Headline: Apple's")
    assert long_one["tickers_mentioned"] == ["AAPL"]
    assert not any(article["title"].startswith("Opinion") for article in body["data"])
    # An official headline is not cut.
    official = "The Federal Reserve Board " + "announces a long list of things " * 6
    assert news_ingest.build_article(
        source_key="fed-press", source_name="Federal Reserve", rights="official_public",
        url="https://example.test/long", title=official.strip(), published_at="2026-03-13T08:00:00Z",
        retrieved_at="2026-03-13T09:00:00Z",
    )["title"] == official.strip()


def test_clip_headline_and_clean_link() -> None:
    assert news_ingest.clip_headline("Short") == "Short"
    clipped = news_ingest.clip_headline("word " * 40)
    assert len(clipped) <= 120 and clipped.endswith("word\u2026")
    assert len(news_ingest.clip_headline("x" * 300)) == 120
    assert news_ingest.clean_link("https://www.ecb.europa.eu//press/a.html") == "https://www.ecb.europa.eu/press/a.html"
    assert news_ingest.clean_link("javascript:alert(1)") == ""
    assert news_ingest.clean_link("/relative/path") == ""


def test_feed_with_entity_declaration_or_no_dates_is_refused_for_that_source_only() -> None:
    bomb = '<?xml version="1.0"?><!DOCTYPE r [<!ENTITY a "aaaa">]><rss><channel><item><title>&a;</title></item></channel></rss>'
    undated = rss(("No date here", "https://example.test/n1", "sometime last week"))
    loader = loader_for({"fed-press": bomb, "sec-press": undated, "ecb-press": rss(FED_ITEM)})
    _, body = news_ingest.news_response("2026-03-13", source_loader=loader)
    assert body["ok"] is True and [article["title"] for article in body["data"]] == ["Fed holds rates"]
    assert [entry.get("error_code") for entry in body["sources"][:3]] == ["SCHEMA_MISMATCH", "SCHEMA_MISMATCH", None]
    # One unreadable date among good items only drops that item.
    mixed = rss(("No date here", "https://example.test/n1", "sometime"), FED_ITEM)
    _, body = news_ingest.news_response("2026-03-13", source_loader=loader_for({"fed-press": mixed}))
    assert [article["title"] for article in body["data"]] == ["Fed holds rates"]


class _Answer:
    def __init__(self, payload: bytes) -> None:
        self.payload = payload

    def __enter__(self) -> "_Answer":
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def read(self, size: int = -1) -> bytes:
        return self.payload if size < 0 else self.payload[:size]


def test_fetch_retries_once_names_its_agent_and_caps_the_size() -> None:
    source = news_ingest.APPROVED_SOURCES[0]
    seen: list[tuple[str, float]] = []

    def flaky(request, timeout):  # type: ignore[no-untyped-def]
        seen.append((request.get_header("User-agent"), timeout))
        if len(seen) == 1:
            raise urllib.error.HTTPError(source.url, 503, "busy", {}, io.BytesIO(b""))  # type: ignore[arg-type]
        return _Answer(b"<rss/>")

    env = {"SEC_USER_AGENT": "Thesis test admin@example.test"}
    assert news_ingest.fetch_remote_text(source, env, opener=flaky, sleep=lambda _: None) == b"<rss/>"
    assert seen == [("Thesis test admin@example.test", 10.0)] * 2

    def missing(request, timeout):  # type: ignore[no-untyped-def]
        raise urllib.error.HTTPError(source.url, 404, "gone", {}, io.BytesIO(b""))  # type: ignore[arg-type]

    with pytest.raises(news_ingest.SourceFetchError):
        news_ingest.fetch_remote_text(source, {}, opener=missing, sleep=lambda _: None)

    def always_down(request, timeout):  # type: ignore[no-untyped-def]
        raise TimeoutError("slow")

    with pytest.raises(news_ingest.SourceFetchError):
        news_ingest.fetch_remote_text(source, {}, opener=always_down, sleep=lambda _: None)

    def huge(request, timeout):  # type: ignore[no-untyped-def]
        return _Answer(b"x" * (news_ingest.MAX_FEED_BYTES + 10))

    with pytest.raises(news_ingest.SourceFetchError):
        news_ingest.fetch_remote_text(source, {}, opener=huge, sleep=lambda _: None)
    assert news_ingest.user_agent({"NEWS_USER_AGENT": "A", "SEC_USER_AGENT": "B"}) == "A"
    assert news_ingest.user_agent({}) == "ThesisNewsIngest/0.2"


def test_one_failed_source_keeps_the_others() -> None:
    loader = loader_for({"sec-press": rss(SEC_ITEM), "ecb-press": RuntimeError("surprise")})
    status, body = news_ingest.news_response("2026-03-13", source_loader=loader)
    assert status == 200 and body["ok"] is True and body["error_flag"] is False
    assert [article["title"] for article in body["data"]] == ["Oil climbs"]
    assert body["sources"][:3] == [
        {"source": "fed-press", "ok": False, "article_count": 0, "error_code": "PROVIDER_OUTAGE"},
        {"source": "sec-press", "ok": True, "article_count": 1, "newest_item_at": "2026-03-13T09:00:00Z"},
        {"source": "ecb-press", "ok": False, "article_count": 0, "error_code": "INTERNAL_ERROR"},
    ]


def test_broken_feed_is_one_source_and_an_empty_feed_is_a_quiet_day() -> None:
    loader = loader_for({
        "fed-press": "<rss><channel><item>",  # not well-formed
        "sec-press": "<rss version=\"2.0\"><channel><title>t</title></channel></rss>",
    })
    status, body = news_ingest.news_response("2026-03-13", source_loader=loader)
    assert status == 200 and body["ok"] is True and body["data"] == []
    assert body["sources"][0]["error_code"] == "SCHEMA_MISMATCH"
    assert body["sources"][1] == {"source": "sec-press", "ok": True, "article_count": 0}


def test_every_source_failing_is_an_outage_not_a_quiet_day() -> None:
    status, body = news_ingest.news_response("2026-03-13", source_loader=loader_for({}))
    assert status == 200 and body["ok"] is False and body["error_flag"] is True
    assert body["error_code"] == "PROVIDER_OUTAGE" and body["provider"] == "fed-press"
    assert len(body["sources"]) == 7 and not any(entry["ok"] for entry in body["sources"])


def test_an_extra_reader_counts_as_a_source() -> None:
    def reader(keep, retrieved_at):  # type: ignore[no-untyped-def]
        article = news_ingest.build_article(
            source_key="sec-edgar-filings", source_name="SEC EDGAR", rights="official_public",
            url="https://example.test/f1", title="Example Co filed an 8-K", published_at="2026-03-13T10:00:00Z",
            retrieved_at=retrieved_at, tickers=["EXM"],
        )
        return [article], {"source": "sec-edgar-filings", "ok": True, "article_count": 1}

    # Every feed is down, the extra reader works: the answer is ok.
    _, body = news_ingest.news_response("2026-03-13", source_loader=loader_for({}), extra_readers=(reader,))
    assert body["ok"] is True and [article["tickers_mentioned"] for article in body["data"]] == [["EXM"]]
    assert body["sources"][-1] == {"source": "sec-edgar-filings", "ok": True, "article_count": 1}

    # Every feed is down and the extra reader has nothing: that is an outage, not a quiet day.
    def empty(keep, retrieved_at):  # type: ignore[no-untyped-def]
        return [], {"source": "sec-edgar-filings", "ok": True, "article_count": 0}

    _, body = news_ingest.news_response("2026-03-13", source_loader=loader_for({}), extra_readers=(empty,))
    assert body["ok"] is False and body["error_code"] == "PROVIDER_OUTAGE" and len(body["sources"]) == 8


def test_same_link_from_two_feeds_is_kept_once() -> None:
    loader = loader_for({"fed-press": rss(FED_ITEM, FED_ITEM), "sec-press": rss(FED_ITEM, SEC_ITEM)})
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
    loader = loader_for({"fed-press": feed})

    _, by_date = news_ingest.news_response("2026-03-13", source_loader=loader)
    assert [article["title"] for article in by_date["data"]] == ["After the run", "This morning"]

    _, by_window = news_ingest.news_response(
        "2026-03-13", window_start="2026-03-12T10:30:00.000Z", window_end="2026-03-13T10:30:00.000Z",
        source_loader=loader,
    )
    assert [article["title"] for article in by_window["data"]] == [
        "This morning", "After the close", "Yesterday afternoon",
    ]
    # The newest item in the feed is reported even though the window left it out.
    assert by_window["sources"][0]["newest_item_at"] == "2026-03-13T12:00:00Z"


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
