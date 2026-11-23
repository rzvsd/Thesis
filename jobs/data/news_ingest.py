"""Approved headlines and first-party context: the bodies of the old news-ingest routes
GET /v1/news?date=... and POST /v1/first-party/context {ticker, url}.

Copied from apps/news-ingest/src/news_ingest/service.py (keep tested logic). Changes:
- The Redis rate limiter is replaced by the in-process RateLimiter (retry.py).
- Fixture mode follows DATA_OPENBB_FIXTURE_MODE like the other job scripts (the old switch was
  NEWS_INGEST_FIXTURE_MODE). Fixtures are copied into jobs/data/fixtures/news and fixtures/first-party.
- BeautifulSoup and news-please are imported only when an HTML source is parsed
  (pip install -r jobs/data/requirements-news.txt). Without them only the HTML source fails.
- Each source is read on its own (rebuild branch audit NG1). The answer is ok when at least one source could be
  read, and "sources" says how each one did. Only when every source fails is the answer an outage.
- Headlines can be kept by a time window (window_start, window_end) and not only by UTC date (NG5). The Pulse
  passes the window from news_window(), which also reaches back over a weekend.
"""

from __future__ import annotations

import hashlib
import json
import re
import urllib.error
import urllib.parse
import urllib.request
import uuid
import warnings
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html import unescape
from typing import Any, Callable, Literal, Mapping

from joblog import log
from market_time import NEW_YORK
from retry import RateLimiter
from schema_check import SCHEMA_ROOT
from source_common import FIXTURE_ROOT, fixture_mode

DEFAULT_PROVIDER = "approved-sources"
FIRST_PARTY_PROVIDER = "first-party-context"
REQUEST_TIMEOUT_SECONDS = 5.0
DEFAULT_SOURCE_RATE_LIMIT_PER_MINUTE = 5
PH6_SOURCE_REVIEWED_AT = "2026-04-17T00:00:00Z"
NEWS_FIXTURE_ROOT = FIXTURE_ROOT / "news"
FIRST_PARTY_FIXTURE_ROOT = FIXTURE_ROOT / "first-party"

# One limiter per source key, like the old per-provider Redis buckets.
_LIMITERS: dict[str, RateLimiter] = {}


def _acquire(source_key: str) -> None:
    limiter = _LIMITERS.setdefault(source_key, RateLimiter(per_minute=DEFAULT_SOURCE_RATE_LIMIT_PER_MINUTE))
    limiter.acquire()


class SourceFetchError(RuntimeError):
    pass


class HtmlFallbackDependencyError(RuntimeError):
    pass


@dataclass(frozen=True)
class ApprovedSource:
    key: str
    name: str
    method: Literal["rss", "html"]
    url: str
    fixture_name: str


@dataclass(frozen=True)
class FirstPartySource:
    registry_entry_id: str
    ticker: str
    issuer_name: str
    domain: str
    allowed_paths: tuple[str, ...]
    page_types: tuple[str, ...]
    fixture_name: str
    default_display_mode: str
    policy_reason: str

    @property
    def default_rights(self) -> dict[str, Any]:
        return build_first_party_rights(display_mode=self.default_display_mode, policy_reason=self.policy_reason)


APPROVED_SOURCES: tuple[ApprovedSource, ...] = (
    ApprovedSource("reuters-business", "Reuters", "rss", "https://feeds.reuters.com/reuters/businessNews", "reuters.rss.xml"),
    ApprovedSource("bloomberg-markets", "Bloomberg", "rss", "https://feeds.bloomberg.com/markets/news.rss", "bloomberg.rss.xml"),
    ApprovedSource("wsj-markets", "WSJ Markets", "html", "https://www.wsj.com/news/markets", "wsj.html"),
)

_INVESTOR = "Approved seed first-party investor path; store bounded excerpts and links only."
_ASSET = "Approved seed asset host; store metadata and links, not full asset text."
FIRST_PARTY_SOURCE_REGISTRY: tuple[FirstPartySource, ...] = (
    FirstPartySource("ph6m2-aapl-investor", "AAPL", "Apple Inc.", "investor.apple.com", ("/investor-relations/", "/"),
                     ("investor_relations", "earnings_release", "sec_filing_reference"), "AAPL.json", "excerpt_only",
                     "Approved seed first-party investor page; store bounded excerpts and links only."),
    FirstPartySource("ph6m2-aapl-newsroom", "AAPL", "Apple Inc.", "www.apple.com", ("/newsroom/",),
                     ("newsroom", "press_release"), "AAPL.json", "excerpt_only",
                     "Approved seed first-party newsroom path; store bounded excerpts and links only."),
    FirstPartySource("ph6m2-msft-investor", "MSFT", "Microsoft Corporation", "www.microsoft.com",
                     ("/en-us/investor/", "/en-us/Investor/"), ("investor_relations", "earnings_release", "webcast"),
                     "MSFT.json", "excerpt_only", _INVESTOR),
    FirstPartySource("ph6m2-msft-news", "MSFT", "Microsoft Corporation", "news.microsoft.com", ("/",),
                     ("press_release", "newsroom"), "MSFT.json", "excerpt_only",
                     "Approved seed first-party news path; store bounded excerpts and links only."),
    FirstPartySource("ph6m2-tsla-ir", "TSLA", "Tesla, Inc.", "ir.tesla.com", ("/", "/press-release/"),
                     ("investor_relations", "earnings_release", "webcast"), "TSLA.json", "excerpt_only", _INVESTOR),
    FirstPartySource("ph6m2-tsla-assets", "TSLA", "Tesla, Inc.", "assets-ir.tesla.com", ("/",),
                     ("presentation", "supplemental_material"), "TSLA.json", "link_only", _ASSET),
    FirstPartySource("ph6m2-tsla-digitalassets", "TSLA", "Tesla, Inc.", "digitalassets.tesla.com", ("/",),
                     ("presentation", "supplemental_material"), "TSLA.json", "link_only", _ASSET),
    FirstPartySource("ph6m2-tsla-main", "TSLA", "Tesla, Inc.", "www.tesla.com", ("/",),
                     ("investor_relations", "presentation", "webcast"), "TSLA.json", "link_only",
                     "Approved seed Tesla first-party domain; store metadata and links, not full text."),
)


# ---------------------------------------------------------------- schema checks (news-ingest's own validator)


def load_schema(name: str) -> dict[str, Any]:
    return json.loads((SCHEMA_ROOT / name).read_text(encoding="utf8"))


def schema_name_for_ref(ref: str) -> str:
    mapping = {
        "EvidenceRightsMetadata": "evidence-rights-metadata.schema.json",
        "FirstPartySourceRegistryEntry": "first-party-source-registry-entry.schema.json",
        "FirstPartyContextItem": "first-party-context-item.schema.json",
        "CallArtifact": "call-artifact.schema.json",
    }
    if ref not in mapping:
        raise ValueError(f"Unsupported schema reference: {ref}.")
    return mapping[ref]


def validate_iso_datetime(value: str, field_name: str) -> None:
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(f"{field_name} must be an ISO 8601 date-time.") from error


def validate_against_schema(value: Any, schema: dict[str, Any], field_name: str) -> None:
    if "$ref" in schema:
        validate_against_schema(value, load_schema(schema_name_for_ref(str(schema["$ref"]))), field_name)
        return
    if "oneOf" in schema:
        errors: list[str] = []
        for option in schema["oneOf"]:
            try:
                validate_against_schema(value, option, field_name)
                return
            except ValueError as error:
                errors.append(str(error))
        raise ValueError("; ".join(errors))

    schema_type = schema.get("type")
    if schema_type == "object":
        if not isinstance(value, dict):
            raise ValueError(f"{field_name} must be an object.")
        required = set(schema.get("required", []))
        properties = schema.get("properties", {})
        extras = sorted(set(value) - set(properties))
        if schema.get("additionalProperties") is False and extras:
            raise ValueError(f"{field_name} has unexpected keys: {', '.join(extras)}.")
        missing = sorted(required - set(value))
        if missing:
            raise ValueError(f"{field_name} is missing required keys: {', '.join(missing)}.")
        for key, subschema in properties.items():
            if key in value:
                validate_against_schema(value[key], subschema, f"{field_name}.{key}")
        return
    if schema_type == "array":
        if not isinstance(value, list):
            raise ValueError(f"{field_name} must be an array.")
        item_schema = schema.get("items")
        if item_schema:
            for index, item in enumerate(value):
                validate_against_schema(item, item_schema, f"{field_name}[{index}]")
        return
    if schema_type == "string":
        if not isinstance(value, str):
            raise ValueError(f"{field_name} must be a string.")
        enum_values = schema.get("enum")
        if enum_values and value not in enum_values:
            raise ValueError(f"{field_name} must be one of: {', '.join(enum_values)}.")
        if schema.get("format") == "date-time":
            validate_iso_datetime(value, field_name)
        return
    if schema_type == "boolean":
        if not isinstance(value, bool):
            raise ValueError(f"{field_name} must be a boolean.")
        return
    if schema_type == "integer":
        if isinstance(value, bool) or not isinstance(value, int):
            raise ValueError(f"{field_name} must be an integer.")
        return
    if schema_type == "null":
        if value is not None:
            raise ValueError(f"{field_name} must be null.")
        return
    raise ValueError(f"{field_name} uses unsupported schema type: {schema_type!r}.")


def validate_named(value: Any, schema_file: str, name: str) -> None:
    validate_against_schema(value, load_schema(schema_file), name)


def validate_response(response: dict[str, Any]) -> None:
    validate_named(response, "service-response.schema.json", "ServiceResponse")
    for index, article in enumerate(response.get("data", [])):
        validate_named(article, "canonical-news-article.schema.json", "CanonicalNewsArticle")
        if not isinstance(article["body_text"], str):
            raise ValueError(f"ServiceResponse.data[{index}].body_text must stay a string.")


# ---------------------------------------------------------------- shared text helpers


def normalize_text(raw_text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", raw_text)
    text = unescape(text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def build_first_party_rights(display_mode: str, policy_reason: str) -> dict[str, Any]:
    return {
        "rights_class": "first_party_public",
        "display_mode": display_mode,
        "source_rank": "first_party",
        "source_type": "first_party_corporate",
        "can_store_full_text": display_mode == "full_text_allowed",
        "can_display_excerpt": display_mode in {"full_text_allowed", "excerpt_only"},
        "can_display_link": True,
        "policy_reason": policy_reason,
        "reviewed_at": PH6_SOURCE_REVIEWED_AT,
    }


def normalize_datetime(value: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError("Published timestamp is required.")
    if re.match(r"^\d{4}-\d{2}-\d{2}T", cleaned):
        parsed = datetime.fromisoformat(cleaned.replace("Z", "+00:00"))
    else:
        parsed = parsedate_to_datetime(cleaned)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def article_id_for(url: str) -> str:
    return hashlib.sha256(url.encode("utf8")).hexdigest()


def extract_tickers(*parts: str) -> list[str]:
    found: list[str] = []
    for part in parts:
        for ticker in re.findall(r"\$([A-Z]{1,5})\b", part):
            if ticker not in found:
                found.append(ticker)
    return found


def filter_by_requested_date(published_at: str, requested_date: str) -> bool:
    return published_at.startswith(requested_date)


def parse_utc(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def within_window(published_at: str, window_start: datetime, window_end: datetime) -> bool:
    try:
        published = parse_utc(published_at)
    except ValueError:
        return False
    return window_start <= published <= window_end


def news_window(cycle_start: str, cycle_end: str) -> tuple[str, str]:
    """The span of headlines one Pulse issue should see.

    It is the Pulse cycle, except that a start on a Saturday or Sunday (New York time) moves back to Friday at
    the same wall-clock time. No issue runs on the weekend, so Monday's issue must also cover Friday's session,
    the after-close hours and the weekend. Market holidays are not handled: the issue after one starts a day late.
    """
    start_local = parse_utc(cycle_start).astimezone(NEW_YORK)
    while start_local.weekday() >= 5:
        # Subtract on the wall clock so a clock change over the weekend keeps the same local time.
        start_local = (start_local.replace(tzinfo=None) - timedelta(days=1)).replace(tzinfo=NEW_YORK)
    start = start_local.astimezone(timezone.utc)
    end = parse_utc(cycle_end)
    return (
        start.isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        end.isoformat(timespec="milliseconds").replace("+00:00", "Z"),
    )


# Says whether a published_at value belongs in the answer.
Keep = Callable[[str], bool]


def normalize_published_at(value: datetime | str | None, fallback_value: str) -> str:
    if value is None:
        return normalize_datetime(fallback_value)
    if isinstance(value, str):
        return normalize_datetime(value)
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


# ---------------------------------------------------------------- approved headlines (GET /v1/news)


def ingestion_method_for(source: ApprovedSource) -> str:
    return "rss" if source.method == "rss" else "html_fallback"


def load_newsplease() -> Any:
    warnings.filterwarnings("ignore", message=r"nltk is not installed.*", category=UserWarning)
    warnings.filterwarnings(
        "ignore", category=DeprecationWarning, module=r"newsplease\.pipeline\.extractor\.extractors\.date_extractor"
    )
    try:
        from newsplease import NewsPlease  # type: ignore[import-not-found]
    except ImportError as error:
        raise HtmlFallbackDependencyError("news-please is required for approved HTML fallback sources.") from error
    return NewsPlease


def load_beautifulsoup() -> Any:
    try:
        from bs4 import BeautifulSoup  # type: ignore[import-not-found]
    except ImportError as error:
        raise HtmlFallbackDependencyError("beautifulsoup4 is required for approved HTML fallback sources.") from error
    return BeautifulSoup


def _article(source: ApprovedSource, url: str, title: str, published_at: str, retrieved_at: str, body_text: str) -> dict[str, Any]:
    article = {
        "article_id": article_id_for(url),
        "source": source.name,
        "url": url,
        "title": title,
        "published_at": published_at,
        "retrieved_at": retrieved_at,
        "body_text": body_text,
        "tickers_mentioned": extract_tickers(title, body_text),
        "is_approved_source": True,
    }
    validate_named(article, "canonical-news-article.schema.json", "CanonicalNewsArticle")
    return article


def extract_html_article_with_newsplease(
    source: ApprovedSource,
    article_html: str,
    url: str,
    fallback_title: str,
    fallback_published_at: str,
    fallback_body_text: str,
    retrieved_at: str,
) -> dict[str, Any]:
    news_please = load_newsplease()
    extracted = news_please.from_html(article_html, url=url)
    title = normalize_text(getattr(extracted, "title", "") or fallback_title)
    published_at = normalize_published_at(getattr(extracted, "date_publish", None), fallback_published_at)
    body_text = normalize_text(
        getattr(extracted, "maintext", "") or getattr(extracted, "description", "") or fallback_body_text or fallback_title
    )
    return _article(source, url, title, published_at, retrieved_at, body_text)


def parse_rss_articles(
    raw_text: str, source: ApprovedSource, requested_date: str, retrieved_at: str, keep: Keep | None = None
) -> list[dict[str, Any]]:
    keep = keep or (lambda published_at: filter_by_requested_date(published_at, requested_date))
    root = ET.fromstring(raw_text)  # noqa: S314 - approved feeds or local fixtures
    articles: list[dict[str, Any]] = []
    for item in root.findall(".//item"):
        title = (item.findtext("title") or "").strip()
        url = (item.findtext("link") or "").strip()
        published_at_raw = (item.findtext("pubDate") or "").strip()
        description = item.findtext("description") or ""
        if not title or not url or not published_at_raw:
            continue
        published_at = normalize_datetime(published_at_raw)
        if not keep(published_at):
            continue
        articles.append(_article(source, url, title, published_at, retrieved_at, normalize_text(description or title)))
    return articles


def parse_html_articles(
    raw_text: str, source: ApprovedSource, requested_date: str, retrieved_at: str, keep: Keep | None = None
) -> list[dict[str, Any]]:
    keep = keep or (lambda published_at: filter_by_requested_date(published_at, requested_date))
    soup = load_beautifulsoup()(raw_text, "html.parser")
    articles: list[dict[str, Any]] = []
    for article_tag in soup.find_all("article"):
        anchor = article_tag.find("a", href=True)
        time_tag = article_tag.find("time")
        if anchor is None or time_tag is None:
            continue
        url = anchor["href"].strip()
        title = normalize_text(anchor.get_text(" ", strip=True))
        published_at_raw = str(time_tag.get("datetime") or "").strip()
        if not url or not title or not published_at_raw:
            continue
        published_at = normalize_datetime(published_at_raw)
        if not keep(published_at):
            continue
        article = extract_html_article_with_newsplease(
            source=source,
            article_html=str(article_tag),
            url=url,
            fallback_title=title,
            fallback_published_at=published_at_raw,
            fallback_body_text=normalize_text(article_tag.get_text(" ", strip=True)),
            retrieved_at=retrieved_at,
        )
        if not keep(article["published_at"]):
            continue
        articles.append(article)
    return articles


def fetch_fixture_text(source: ApprovedSource, requested_date: str) -> str:
    fixture_path = NEWS_FIXTURE_ROOT / requested_date / source.fixture_name
    if not fixture_path.exists():
        raise SourceFetchError(f"Fixture missing for source {source.key}.")
    return fixture_path.read_text(encoding="utf8")


def fetch_remote_text(source: ApprovedSource) -> str:
    request = urllib.request.Request(source.url, headers={"User-Agent": "ThesisNewsIngest/0.1"}, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:  # noqa: S310 - approved URL
            return response.read().decode("utf8", errors="replace")
    except (urllib.error.URLError, TimeoutError) as error:
        raise SourceFetchError(f"Failed to fetch {source.url}.") from error


SourceLoader = Callable[[ApprovedSource, str], str]


def outage_response(request_id: str, retrieved_at: str, error_code: str, error_message: str, *, provider: str = DEFAULT_PROVIDER) -> dict[str, Any]:
    response = {
        "ok": False,
        "data": [],
        "error_flag": True,
        "error_code": error_code,
        "error_message": error_message,
        "request_id": request_id,
        "provider": provider,
        "retrieved_at": retrieved_at,
    }
    validate_response(response)
    return response


def read_source(
    source: ApprovedSource, load: Callable[[ApprovedSource], str], requested_date: str, retrieved_at: str, keep: Keep
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Reads one source. A failure is returned as that source's status, never raised (audit NG1)."""
    try:
        _acquire(source.key)
        raw_text = load(source)
        if source.method == "rss":
            parsed = parse_rss_articles(raw_text, source, requested_date, retrieved_at, keep)
        else:
            parsed = parse_html_articles(raw_text, source, requested_date, retrieved_at, keep)
    except SourceFetchError:
        log("WARN", "Source unreachable / parser failed", provider=source.key)
        return [], {"source": source.key, "ok": False, "article_count": 0, "error_code": "PROVIDER_OUTAGE"}
    except HtmlFallbackDependencyError:
        log("WARN", "HTML fallback dependency missing", provider=source.key)
        return [], {"source": source.key, "ok": False, "article_count": 0, "error_code": "INTERNAL_ERROR"}
    except (ET.ParseError, ValueError):
        log("WARN", "Schema validation failed", provider=source.key)
        return [], {"source": source.key, "ok": False, "article_count": 0, "error_code": "SCHEMA_MISMATCH"}
    except Exception as error:  # one bad source must not cost the others
        log("WARN", "News source failed", provider=source.key, error_type=type(error).__name__)
        return [], {"source": source.key, "ok": False, "article_count": 0, "error_code": "INTERNAL_ERROR"}
    log("INFO", "News source read", provider=source.key, ingestion_method=ingestion_method_for(source),
        record_count=len(parsed))
    return parsed, {"source": source.key, "ok": True, "article_count": len(parsed)}


_OUTAGE_MESSAGES = {
    "PROVIDER_OUTAGE": "Approved source unavailable; returning empty list.",
    "SCHEMA_MISMATCH": "Approved source payload could not be normalized safely.",
    "INTERNAL_ERROR": "Approved sources could not be read.",
}


def news_response(
    requested_date: str,
    *,
    window_start: str | None = None,
    window_end: str | None = None,
    env: Mapping[str, str] | None = None,
    source_loader: SourceLoader | None = None,
    now: datetime | None = None,
) -> tuple[int, dict[str, Any]]:
    """Port of build_news_response. Returns (status, body) like the old route.

    With window_start and window_end (ISO date-times) headlines are kept by that span. Without them they are kept
    by requested_date in UTC, as the old route did. requested_date still picks the fixture folder in fixture mode.
    """
    retrieved_at = (now or datetime.now(timezone.utc)).astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    request_id = uuid.uuid4().hex
    try:
        date.fromisoformat(requested_date)
    except ValueError:
        return 400, outage_response(request_id, retrieved_at, "INTERNAL_ERROR",
                                    "date query parameter is required in YYYY-MM-DD format.")

    keep: Keep = lambda published_at: filter_by_requested_date(published_at, requested_date)  # noqa: E731
    if window_start is not None or window_end is not None:
        try:
            start, end = parse_utc(window_start or ""), parse_utc(window_end or "")
        except ValueError:
            return 400, outage_response(request_id, retrieved_at, "INTERNAL_ERROR",
                                        "window_start and window_end must both be ISO 8601 date-times.")
        if start > end:
            return 400, outage_response(request_id, retrieved_at, "INTERNAL_ERROR",
                                        "window_start must not be after window_end.")
        keep = lambda published_at: within_window(published_at, start, end)  # noqa: E731

    def load(source: ApprovedSource) -> str:
        if source_loader is not None:
            return source_loader(source, requested_date)
        if fixture_mode(env):
            return fetch_fixture_text(source, requested_date)
        return fetch_remote_text(source)

    articles: list[dict[str, Any]] = []
    statuses: list[dict[str, Any]] = []
    for source in APPROVED_SOURCES:
        parsed, status = read_source(source, load, requested_date, retrieved_at, keep)
        articles.extend(parsed)
        statuses.append(status)

    failed = [status for status in statuses if not status["ok"]]
    if len(failed) == len(statuses):
        # Nothing could be read, so this is an outage and not a quiet day. The first failure names it.
        first = failed[0]
        response = outage_response(request_id, retrieved_at, first["error_code"],
                                   _OUTAGE_MESSAGES[first["error_code"]], provider=first["source"])
        response["sources"] = statuses
        validate_response(response)
        return 200, response

    # The same story can sit in two feeds or twice in one; keep the first copy of each link.
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for article in sorted(articles, key=lambda article: article["published_at"], reverse=True):
        if article["article_id"] in seen:
            continue
        seen.add(article["article_id"])
        unique.append(article)
    response = {
        "ok": True,
        "data": unique,
        "error_flag": False,
        "request_id": request_id,
        "provider": DEFAULT_PROVIDER,
        "retrieved_at": retrieved_at,
        "sources": statuses,
    }
    validate_response(response)
    return 200, response
