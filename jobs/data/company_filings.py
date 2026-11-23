"""Company news from SEC filings (rebuild branch audit NG7).

Every listed company must file an 8-K when something material happens, so EDGAR is a company-news source that
covers every name and is free to reuse. For each ticker this reads https://data.sec.gov/submissions/CIK<cik>.json
(the same file official.py reads) and turns each recent 8-K, 10-Q and 10-K into one headline in our own words:

    "Apple Inc. filed an 8-K: results of operations"

The link goes to the filing on sec.gov. No filing text is copied. Tickers come from the coverage universe
(fixtures/sp500_universe.csv); a ticker without a CIK there is skipped and counted.

Fixture mode reads fixtures/filings/<TICKER>.json (the same shape as the SEC file) and never calls the SEC.
"""

from __future__ import annotations

import json
import os
from typing import Any, Callable, Mapping
from urllib.error import URLError

from joblog import log
from news_ingest import RIGHTS_OFFICIAL, ExtraReader, Keep, build_article, failed_status, parse_utc, user_agent
from official import _sec_fetch_json, load_coverage_ciks, normalize_ticker
from source_common import FIXTURE_ROOT, fixture_mode

SOURCE_KEY = "sec-edgar-filings"
SOURCE_NAME = "SEC EDGAR"
FILINGS_FIXTURE_ROOT = FIXTURE_ROOT / "filings"
# Newest filings read per company. A busy issuer files a few dozen forms a week, most of them Form 4.
MAX_ROWS_PER_COMPANY = 200

# What each 8-K item number means, in plain words (SEC Form 8-K, sections 1 to 9).
ITEM_LABELS: Mapping[str, str] = {
    "1.01": "a material agreement",
    "1.02": "the end of a material agreement",
    "1.03": "bankruptcy or receivership",
    "1.05": "a material cybersecurity incident",
    "2.01": "a completed acquisition or sale of assets",
    "2.02": "results of operations",
    "2.03": "a new financial obligation",
    "2.04": "an event that speeds up a financial obligation",
    "2.05": "exit or disposal costs",
    "2.06": "a material impairment",
    "3.01": "a delisting notice or listing-rule failure",
    "3.02": "unregistered sales of equity",
    "3.03": "a change to shareholder rights",
    "4.01": "a change of auditor",
    "4.02": "earlier financial statements that can no longer be relied on",
    "5.01": "a change in control",
    "5.02": "a director or officer change",
    "5.03": "a change to its articles or bylaws",
    "5.07": "shareholder vote results",
    "7.01": "a Regulation FD disclosure",
    "8.01": "other events",
}
# Items that say nothing on their own (9.01 is "financial statements and exhibits").
_FILLER_ITEMS = frozenset({"9.01"})
PERIODIC_FORMS: Mapping[str, str] = {
    "10-Q": "filed its quarterly report (10-Q)",
    "10-K": "filed its annual report (10-K)",
}

FetchJson = Callable[..., dict[str, Any]]


def filing_headline(company_name: str, form: str, items: str) -> str | None:
    """Our own one-line description of a filing, or None for a form that is not company news."""
    if form in PERIODIC_FORMS:
        return f"{company_name} {PERIODIC_FORMS[form]}"
    if form not in {"8-K", "8-K/A"}:
        return None
    verb = "amended an 8-K" if form == "8-K/A" else "filed an 8-K"
    codes = [code.strip() for code in items.split(",") if code.strip() and code.strip() not in _FILLER_ITEMS]
    labels = [ITEM_LABELS[code] for code in codes if code in ITEM_LABELS]
    if not labels:
        return f"{company_name} {verb}"
    shown = labels[0] if len(labels) == 1 else f"{labels[0]} and {labels[1]}"
    more = " and more" if len(labels) > 2 else ""
    return f"{company_name} {verb}: {shown}{more}"


def filing_url(cik: str, accession: str, primary_document: str) -> str:
    folder = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession.replace('-', '')}"
    return f"{folder}/{primary_document}" if primary_document else f"{folder}/{accession}-index.htm"


def _column(recent: Mapping[str, Any], name: str, index: int) -> str:
    values = recent.get(name)
    if isinstance(values, list) and index < len(values) and values[index] is not None:
        return str(values[index]).strip()
    return ""


def articles_from_submissions(
    ticker: str, cik: str, submissions: Mapping[str, Any], keep: Keep, retrieved_at: str
) -> list[dict[str, Any]]:
    """Headlines for the filings in one SEC submissions file that `keep` accepts."""
    company_name = str(submissions.get("name") or ticker).strip() or ticker
    filings = submissions.get("filings")
    recent = filings.get("recent") if isinstance(filings, dict) else None
    if not isinstance(recent, dict):
        return []
    forms = recent.get("form")
    articles: list[dict[str, Any]] = []
    for index in range(min(len(forms) if isinstance(forms, list) else 0, MAX_ROWS_PER_COMPANY)):
        headline = filing_headline(company_name, _column(recent, "form", index), _column(recent, "items", index))
        accession = _column(recent, "accessionNumber", index)
        accepted = _column(recent, "acceptanceDateTime", index)
        if headline is None or not accession or not accepted:
            continue
        try:
            published_at = parse_utc(accepted).isoformat().replace("+00:00", "Z")
        except ValueError:
            continue
        if not keep(published_at):
            continue
        articles.append(build_article(
            source_key=SOURCE_KEY, source_name=SOURCE_NAME, rights=RIGHTS_OFFICIAL,
            url=filing_url(cik, accession, _column(recent, "primaryDocument", index)),
            title=headline, published_at=published_at, retrieved_at=retrieved_at, tickers=[ticker],
        ))
    return articles


def _load_fixture(ticker: str) -> dict[str, Any] | None:
    path = FILINGS_FIXTURE_ROOT / f"{ticker}.json"
    if not path.exists():
        return None
    payload = json.loads(path.read_text(encoding="utf8"))
    return payload if isinstance(payload, dict) else None


def company_filing_articles(
    tickers: list[str],
    keep: Keep,
    retrieved_at: str,
    *,
    env: Mapping[str, str] | None = None,
    ciks: Mapping[str, str] | None = None,
    fetch_json: FetchJson = _sec_fetch_json,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Filing headlines for `tickers` and this source's status. Never raises.

    One company failing does not cost the others. The source counts as failed only when companies were asked
    for and none could be read.
    """
    known = dict(ciks) if ciks is not None else load_coverage_ciks(_cik_env(env))
    wanted = []
    for raw in tickers:
        ticker = normalize_ticker(raw)
        if ticker and ticker not in wanted:
            wanted.append(ticker)
    with_cik = [ticker for ticker in wanted if known.get(ticker)]
    headers = {"user-agent": user_agent(env), "accept": "application/json"}
    use_fixtures = fixture_mode(env)

    articles: list[dict[str, Any]] = []
    read = 0
    failed = 0
    for ticker in with_cik:
        cik = known[ticker]
        try:
            if use_fixtures:
                submissions = _load_fixture(ticker)
                if submissions is None:
                    continue
            else:
                submissions = fetch_json(f"https://data.sec.gov/submissions/CIK{cik}.json", headers=headers)
            articles.extend(articles_from_submissions(ticker, cik, submissions, keep, retrieved_at))
            read += 1
        except (OSError, URLError, TimeoutError, ValueError) as error:
            failed += 1
            log("WARN", "Company filings unavailable", ticker=ticker, error_type=type(error).__name__)
        except Exception as error:  # one bad company must not cost the others
            failed += 1
            log("WARN", "Company filings failed", ticker=ticker, error_type=type(error).__name__)
    log("INFO", "Company filings read", companies=len(with_cik), read=read, failed=failed,
        without_cik=len(wanted) - len(with_cik), record_count=len(articles))
    if failed and not read:
        return [], failed_status(SOURCE_KEY, "PROVIDER_OUTAGE")
    return articles, {"source": SOURCE_KEY, "ok": True, "article_count": len(articles)}


def _cik_env(env: Mapping[str, str] | None) -> Mapping[str, str]:
    """The environment for the CIK lookup without COVERAGE_TICKERS, which narrows the weekly refresh only."""
    values = dict(os.environ if env is None else env)
    values.pop("COVERAGE_TICKERS", None)
    return values


def filings_reader(tickers: list[str], env: Mapping[str, str] | None = None, **kwargs: Any) -> ExtraReader:
    """company_filing_articles as an extra source for news_ingest.news_response."""

    def reader(keep: Keep, retrieved_at: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        return company_filing_articles(tickers, keep, retrieved_at, env=env, **kwargs)

    return reader
