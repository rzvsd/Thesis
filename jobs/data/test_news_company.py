"""Company names in headlines and company news from SEC filings (audit NG7). No network."""

from __future__ import annotations

from typing import Any

import company_filings
import company_match
import news_ingest

KEEP_ALL = lambda published_at: True  # noqa: E731
NOW = "2026-03-13T12:00:00Z"
CIKS = {"AAPL": "0000320193", "MSFT": "0000789019"}


def submissions(name: str, rows: list[tuple[str, str, str, str]]) -> dict[str, Any]:
    """rows: (form, items, accepted, accession)."""
    return {
        "name": name,
        "filings": {"recent": {
            "form": [row[0] for row in rows],
            "items": [row[1] for row in rows],
            "acceptanceDateTime": [row[2] for row in rows],
            "accessionNumber": [row[3] for row in rows],
            "primaryDocument": [f"doc{index}.htm" for index, _ in enumerate(rows)],
        }},
    }


def test_headline_names_companies_by_name_tag_and_alias() -> None:
    tickers = company_match.tickers_in_headline
    assert tickers("Apple's suppliers say demand held up") == ["AAPL"]
    assert tickers("Microsoft and Nvidia lead the Nasdaq higher") == ["MSFT", "NVDA"]
    assert tickers("Lowe’s beats; Home Depot slips") == ["LOW", "HD"]
    assert tickers("Why $TSLA fell (NASDAQ: AMZN) today") == ["TSLA", "AMZN"]
    assert tickers("Google and Disney strike a streaming deal") == ["GOOGL", "DIS"]
    assert tickers("Bank of America raises its JPMorgan target") == ["BAC", "JPM"]
    # The same company twice is one ticker, and the list stops at five.
    assert tickers("Apple, Apple and Apple Inc.") == ["AAPL"]
    assert len(tickers("Apple Microsoft Nvidia Amazon Netflix Boeing Intel Pfizer")) == 5


def test_everyday_words_and_word_pieces_are_not_companies() -> None:
    tickers = company_match.tickers_in_headline
    # Left out on purpose: also everyday words, places or indexes.
    assert tickers("Target date funds grow as the Dow and Nasdaq slip") == []
    assert tickers("Visa rules change for travellers; Block party planned in Dover") == []
    # Whole words and the same capitals only.
    assert tickers("Pineapple prices rise; apple growers worry") == []
    assert tickers("Intelligence agencies and Uberization") == []
    assert tickers("FedEx warns on holiday shipping volumes") == ["FDX"]
    assert tickers("AT&T and AT&Tower are different") == ["T"]


def test_clean_company_name_drops_legal_endings() -> None:
    clean = company_match.clean_company_name
    assert clean("Apple Inc.") == "Apple"
    assert clean("Alphabet Inc. (Class A)") == "Alphabet"
    assert clean("Walt Disney Company (The)") == "Walt Disney"
    assert clean("Tesla, Inc.") == "Tesla"
    assert clean("Arthur J. Gallagher & Co.") == "Arthur J. Gallagher"
    assert clean("UnitedHealth Group") == "UnitedHealth"
    # Two share classes carry one name: the first ticker in the file wins.
    table = company_match.name_table([("GOOGL", "Alphabet Inc. (Class A)"), ("GOOG", "Alphabet Inc. (Class C)")])
    assert table == {"Alphabet": "GOOGL", "Google": "GOOGL"}
    # An alias is only added when its ticker is in the universe.
    assert "Disney" not in company_match.name_table([("AAPL", "Apple Inc.")])


def test_filing_headline_is_in_our_own_words() -> None:
    headline = company_filings.filing_headline
    assert headline("Apple Inc.", "8-K", "2.02,9.01") == "Apple Inc. filed an 8-K: results of operations"
    assert headline("Apple Inc.", "8-K", "5.02,7.01") == (
        "Apple Inc. filed an 8-K: a director or officer change and a Regulation FD disclosure"
    )
    assert headline("Apple Inc.", "8-K", "1.01,2.03,8.01,9.01") == (
        "Apple Inc. filed an 8-K: a material agreement and a new financial obligation and more"
    )
    assert headline("Apple Inc.", "8-K/A", "") == "Apple Inc. amended an 8-K"
    assert headline("Apple Inc.", "8-K", "9.01,99.99") == "Apple Inc. filed an 8-K"
    assert headline("Apple Inc.", "10-Q", "") == "Apple Inc. filed its quarterly report (10-Q)"
    assert headline("Apple Inc.", "10-K", "") == "Apple Inc. filed its annual report (10-K)"
    # Insider forms and the rest are not company news.
    assert headline("Apple Inc.", "4", "") is None
    assert headline("Apple Inc.", "SC 13G", "") is None


def test_fixture_filings_become_linked_headlines_inside_the_window() -> None:
    keep = lambda published_at: published_at.startswith("2026-03-1")  # noqa: E731
    articles, status = company_filings.company_filing_articles(["aapl", "MSFT", "ZZZZ"], keep, NOW, env={})
    assert status == {"source": "sec-edgar-filings", "ok": True, "article_count": 2}
    assert [(a["title"], a["published_at"]) for a in articles] == [
        ("Apple Inc. filed an 8-K: a director or officer change", "2026-03-13T10:02:11Z"),
        ("Apple Inc. filed an 8-K: results of operations and a Regulation FD disclosure and more",
         "2026-03-12T20:31:05Z"),
    ]
    first = articles[0]
    assert first["url"] == "https://www.sec.gov/Archives/edgar/data/320193/000032019326000031/aapl-20260313.htm"
    assert (first["source"], first["rights"], first["tickers_mentioned"]) == ("SEC EDGAR", "official_public", ["AAPL"])
    assert first["article_id"] == news_ingest.article_id_for(first["url"])


def test_live_filings_one_company_failing_does_not_cost_the_others() -> None:
    asked: list[tuple[str, str]] = []

    def fetch(url: str, *, headers: dict[str, str]) -> dict[str, Any]:
        asked.append((url, headers["user-agent"]))
        if "0000789019" in url:
            raise OSError("down")
        return submissions("Apple Inc.", [
            ("8-K", "2.02", "2026-03-13T10:00:00.000Z", "0000320193-26-000001"),
            ("8-K", "2.02", "not a date", "0000320193-26-000002"),
            ("10-Q", "", "2026-03-13T11:00:00.000Z", ""),
        ])

    env = {"DATA_OPENBB_FIXTURE_MODE": "false", "SEC_USER_AGENT": "Thesis test admin@example.test"}
    articles, status = company_filings.company_filing_articles(
        ["AAPL", "MSFT", "NOCIK"], KEEP_ALL, NOW, env=env, ciks=CIKS, fetch_json=fetch
    )
    assert [url for url, _ in asked] == [
        "https://data.sec.gov/submissions/CIK0000320193.json",
        "https://data.sec.gov/submissions/CIK0000789019.json",
    ]
    assert {agent for _, agent in asked} == {"Thesis test admin@example.test"}
    assert status == {"source": "sec-edgar-filings", "ok": True, "article_count": 1}
    assert articles[0]["url"].endswith("/000032019326000001/doc0.htm")

    # Every company failing is this source's outage.
    def down(url: str, *, headers: dict[str, str]) -> dict[str, Any]:
        raise OSError("down")

    articles, status = company_filings.company_filing_articles(["AAPL"], KEEP_ALL, NOW, env=env, ciks=CIKS, fetch_json=down)
    assert articles == [] and status == {
        "source": "sec-edgar-filings", "ok": False, "article_count": 0, "error_code": "PROVIDER_OUTAGE",
    }
    # No tickers to ask about is a quiet answer, not a failure.
    assert company_filings.company_filing_articles([], KEEP_ALL, NOW, env=env, ciks=CIKS, fetch_json=down)[1]["ok"] is True


def test_slow_filings_stop_at_the_time_budget_and_keep_what_was_read() -> None:
    clock = {"now": 0.0}
    asked: list[str] = []

    def slow(url: str, *, headers: dict[str, str]) -> dict[str, Any]:
        asked.append(url)
        clock["now"] += 40.0
        return submissions("Some Company", [("8-K", "2.02", "2026-03-13T10:00:00.000Z", f"0000000000-26-00000{len(asked)}")])

    ciks = {"AAPL": "0000320193", "MSFT": "0000789019", "NVDA": "0001045810", "AMZN": "0001018724"}
    env = {"DATA_OPENBB_FIXTURE_MODE": "false"}
    articles, status = company_filings.company_filing_articles(
        list(ciks), KEEP_ALL, NOW, env=env, ciks=ciks, fetch_json=slow, budget_seconds=60.0, clock=lambda: clock["now"],
    )
    # 0 s and 40 s are inside the budget; at 80 s the last two companies are skipped.
    assert len(asked) == 2
    assert status == {"source": "sec-edgar-filings", "ok": True, "article_count": 2}
    assert len(articles) == 2


def test_filing_url_without_a_primary_document_points_at_the_index() -> None:
    assert company_filings.filing_url("0000320193", "0000320193-26-000031", "") == (
        "https://www.sec.gov/Archives/edgar/data/320193/000032019326000031/0000320193-26-000031-index.htm"
    )
