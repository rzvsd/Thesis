"""Headlines for the Pulse and the news store, and the old first-party context route body.

Started as a copy of apps/news-ingest/src/news_ingest/service.py (GET /v1/news?date=...). Changed since:
- The Redis rate limiter is replaced by the in-process RateLimiter (retry.py).
- Fixture mode follows DATA_OPENBB_FIXTURE_MODE like the other job scripts. Fixtures are in fixtures/news.
- Each source is read on its own (rebuild branch audit NG1). The answer is ok when at least one source could be
  read, and "sources" says how each one did. Only when every source fails is the answer an outage.
- Headlines can be kept by a time window (window_start, window_end) and not only by UTC date (NG5). The Pulse
  passes the window from news_window(), which also reaches back over a weekend.
- Sources (NG2, NG3). The Reuters and Bloomberg feeds and the scraped WSJ page are gone. The main sources are
  official feeds whose text is free to reuse (Federal Reserve, SEC, ECB, EIA, BEA). Publisher feeds are
  "headline_link_only": the headline is cut to 120 characters, the feed's description is never read, and the app
  shows headline, source name and link. That is the "very short extract" limit of Romanian Law 8/1996 art. 94^1
  (EU Directive 2019/790 art. 15). Set NEWS_PUBLISHER_HEADLINES=false to leave publisher feeds out.
- No article text is sent to the api. body_text is the headline (the schema still needs the field).
- Fetching (NG9): 10 second timeout, one retry, a size cap, feeds with an entity declaration are refused, and the
  user agent comes from NEWS_USER_AGENT or SEC_USER_AGENT. No HTML parsing, so no extra packages.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
import uuid
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html import unescape
from typing import Any, Callable, Literal, Mapping

from company_match import tickers_in_headline
from joblog import log
from market_time import NEW_YORK
from retry import RETRYABLE_STATUS, RateLimiter, RetryableError, RetryPolicy, call_with_retry
from schema_check import SCHEMA_ROOT
from source_common import FIXTURE_ROOT, fixture_mode

DEFAULT_PROVIDER = "approved-sources"
FIRST_PARTY_PROVIDER = "first-party-context"
REQUEST_TIMEOUT_SECONDS = 10.0
MAX_FEED_BYTES = 2_000_000
DEFAULT_USER_AGENT = "ThesisNewsIngest/0.2"
DEFAULT_SOURCE_RATE_LIMIT_PER_MINUTE = 5
# Longest publisher headline kept: the "very short extract" limit of Law 8/1996 art. 94^1 (Romania).
HEADLINE_LINK_MAX_CHARS = 120
RIGHTS_OFFICIAL = "official_public"
RIGHTS_HEADLINE_LINK = "headline_link_only"
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


@dataclass(frozen=True)
class ApprovedSource:
    key: str
    name: str
    url: str
    fixture_name: str
    # official_public: a public body's own release, free to reuse. headline_link_only: a publisher's feed.
    rights: Literal["official_public", "headline_link_only"]
    # Items whose headline starts with one of these are left out (opinion pieces are not news).
    skip_prefixes: tuple[str, ...] = ()
    method: Literal["rss"] = "rss"


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


# Feed addresses were read from each body's own feed page on 2026-11-23. Fed, SEC, ECB and WSJ answered with
# RSS 2.0 that day. The EIA and BEA addresses are the ones their sites link to; they could not be fetched from the
# build machine, so the first live run shows whether they parse (each source fails on its own).
APPROVED_SOURCES: tuple[ApprovedSource, ...] = (
    ApprovedSource("fed-press", "Federal Reserve", "https://www.federalreserve.gov/feeds/press_all.xml",
                   "fed-press.rss.xml", RIGHTS_OFFICIAL),
    ApprovedSource("sec-press", "SEC", "https://www.sec.gov/news/pressreleases.rss", "sec-press.rss.xml",
                   RIGHTS_OFFICIAL),
    ApprovedSource("ecb-press", "ECB", "https://www.ecb.europa.eu/rss/press.html", "ecb-press.rss.xml",
                   RIGHTS_OFFICIAL),
    ApprovedSource("eia-today", "EIA", "https://www.eia.gov/rss/todayinenergy.xml", "eia-today.rss.xml",
                   RIGHTS_OFFICIAL),
    ApprovedSource("bea-news", "BEA", "https://apps.bea.gov/rss/rss.xml", "bea-news.rss.xml", RIGHTS_OFFICIAL),
    ApprovedSource("wsj-markets", "WSJ", "https://feeds.content.dowjones.io/public/rss/RSSMarketsMain",
                   "wsj-markets.rss.xml", RIGHTS_HEADLINE_LINK, ("Opinion |",)),
    ApprovedSource("wsj-world", "WSJ", "https://feeds.content.dowjones.io/public/rss/RSSWorldNews",
                   "wsj-world.rss.xml", RIGHTS_HEADLINE_LINK, ("Opinion |",)),
)


def publisher_headlines_enabled(env: Mapping[str, str] | None = None) -> bool:
    values = os.environ if env is None else env
    return str(values.get("NEWS_PUBLISHER_HEADLINES", "true")).strip().lower() not in {"false", "0", "no", "off"}


def active_sources(env: Mapping[str, str] | None = None) -> tuple[ApprovedSource, ...]:
    """Official feeds always. Publisher feeds unless NEWS_PUBLISHER_HEADLINES is false."""
    if publisher_headlines_enabled(env):
        return APPROVED_SOURCES
    return tuple(source for source in APPROVED_SOURCES if source.rights == RIGHTS_OFFICIAL)


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


# ---------------------------------------------------------------- headlines


def clip_headline(title: str, limit: int = HEADLINE_LINK_MAX_CHARS) -> str:
    """A headline of at most `limit` characters, cut at a word and ended with an ellipsis."""
    if len(title) <= limit:
        return title
    cut = title[: limit - 1]
    if " " in cut:
        cut = cut.rsplit(" ", 1)[0]
    return cut.rstrip(" ,;:-–—") + "…"


def clean_link(raw: str) -> str:
    """An http(s) link, or "" for anything else. Doubled slashes in the path go (the ECB feed writes host//press)."""
    parts = urllib.parse.urlsplit(raw.strip())
    if parts.scheme not in {"http", "https"} or not parts.netloc:
        return ""
    path = re.sub(r"/{2,}", "/", parts.path)
    return urllib.parse.urlunsplit((parts.scheme, parts.netloc, path, parts.query, ""))


def build_article(
    *,
    source_key: str,
    source_name: str,
    rights: str,
    url: str,
    title: str,
    published_at: str,
    retrieved_at: str,
    tickers: list[str] | None = None,
) -> dict[str, Any]:
    """One headline in the CanonicalNewsArticle shape. A publisher headline is cut to the legal length here."""
    if rights == RIGHTS_HEADLINE_LINK:
        title = clip_headline(title)
    article = {
        "article_id": article_id_for(url),
        "source": source_name,
        "source_key": source_key,
        "rights": rights,
        "url": url,
        "title": title,
        "published_at": published_at,
        "retrieved_at": retrieved_at,
        # No article text is kept. The schema needs the field, so it repeats the headline.
        "body_text": title,
        "tickers_mentioned": tickers if tickers is not None else tickers_in_headline(title),
        "is_approved_source": True,
    }
    validate_named(article, "canonical-news-article.schema.json", "CanonicalNewsArticle")
    return article


def _has_entity_declaration(raw: str | bytes) -> bool:
    return (b"<!ENTITY" in raw) if isinstance(raw, bytes) else ("<!ENTITY" in raw)


_DC_DATE = "{http://purl.org/dc/elements/1.1/}date"


def parse_rss_feed(
    raw: str | bytes, source: ApprovedSource, requested_date: str, retrieved_at: str, keep: Keep | None = None
) -> tuple[list[dict[str, Any]], str | None]:
    """Headlines of one RSS 2.0 feed that `keep` accepts, and the date of the newest item in the whole feed.

    Only title, link and date are read. The description is never read, so no publisher text beyond the headline
    can reach the api. An item with an unreadable date is skipped; a feed where no item has one is refused.
    """
    keep = keep or (lambda published_at: filter_by_requested_date(published_at, requested_date))
    if _has_entity_declaration(raw):
        raise ValueError("Feed declares XML entities.")
    root = ET.fromstring(raw)  # noqa: S314 - fixed feed addresses, entity declarations refused above
    items = root.findall(".//item")
    articles: list[dict[str, Any]] = []
    newest: datetime | None = None
    undated = 0
    for item in items:
        title = normalize_text(item.findtext("title") or "")
        url = clean_link(item.findtext("link") or "") or clean_link(item.findtext("guid") or "")
        published_raw = (item.findtext("pubDate") or item.findtext(_DC_DATE) or "").strip()
        if not title or not url:
            continue
        try:
            published_at = normalize_datetime(published_raw)
        except (ValueError, TypeError):
            undated += 1
            continue
        published = parse_utc(published_at)
        if newest is None or published > newest:
            newest = published
        if any(title.startswith(prefix) for prefix in source.skip_prefixes):
            continue
        if not keep(published_at):
            continue
        articles.append(build_article(source_key=source.key, source_name=source.name, rights=source.rights, url=url,
                                      title=title, published_at=published_at, retrieved_at=retrieved_at))
    if items and undated == len(items):
        raise ValueError("No item in the feed has a readable date.")
    newest_at = newest.isoformat().replace("+00:00", "Z") if newest else None
    return articles, newest_at


def parse_rss_articles(
    raw_text: str | bytes, source: ApprovedSource, requested_date: str, retrieved_at: str, keep: Keep | None = None
) -> list[dict[str, Any]]:
    return parse_rss_feed(raw_text, source, requested_date, retrieved_at, keep)[0]


def fetch_fixture_text(source: ApprovedSource, requested_date: str) -> str:
    fixture_path = NEWS_FIXTURE_ROOT / requested_date / source.fixture_name
    if not fixture_path.exists():
        raise SourceFetchError(f"Fixture missing for source {source.key}.")
    return fixture_path.read_text(encoding="utf8")


def user_agent(env: Mapping[str, str] | None = None) -> str:
    """NEWS_USER_AGENT, else SEC_USER_AGENT (the SEC asks for a named agent with a contact), else a plain name."""
    values = os.environ if env is None else env
    for name in ("NEWS_USER_AGENT", "SEC_USER_AGENT"):
        value = str(values.get(name, "")).strip()
        if value:
            return value
    return DEFAULT_USER_AGENT


FETCH_RETRY = RetryPolicy(max_attempts=2, base_delay_seconds=1.0, max_delay_seconds=5.0)


def fetch_remote_text(
    source: ApprovedSource,
    env: Mapping[str, str] | None = None,
    *,
    opener: Callable[..., Any] = urllib.request.urlopen,
    sleep: Callable[[float], None] | None = None,
) -> bytes:
    """The feed's bytes (the XML parser reads the encoding from the feed). One retry on a timeout, 429 or 5xx."""
    request = urllib.request.Request(
        source.url,
        headers={"User-Agent": user_agent(env), "Accept": "application/rss+xml, application/xml;q=0.9, */*;q=0.5"},
        method="GET",
    )

    def once() -> bytes:
        try:
            with opener(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:  # noqa: S310 - fixed feed address
                raw = response.read(MAX_FEED_BYTES + 1)
        except urllib.error.HTTPError as error:
            if error.code in RETRYABLE_STATUS:
                raise RetryableError(f"HTTP {error.code} from {source.key}.", status=error.code) from error
            raise SourceFetchError(f"HTTP {error.code} from {source.key}.") from error
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            raise RetryableError(f"Failed to fetch {source.key}.") from error
        if len(raw) > MAX_FEED_BYTES:
            raise SourceFetchError(f"Feed {source.key} is larger than {MAX_FEED_BYTES} bytes.")
        return raw

    try:
        if sleep is None:
            return call_with_retry(once, policy=FETCH_RETRY)
        return call_with_retry(once, policy=FETCH_RETRY, sleep=sleep)
    except RetryableError as error:
        raise SourceFetchError(str(error)) from error


SourceLoader = Callable[[ApprovedSource, str], "str | bytes"]
# An extra source that is not an RSS feed (company filings). Gets the keep test and retrieved_at, returns
# (articles, status) and never raises.
ExtraReader = Callable[[Keep, str], "tuple[list[dict[str, Any]], dict[str, Any]]"]


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


def failed_status(source_key: str, error_code: str) -> dict[str, Any]:
    return {"source": source_key, "ok": False, "article_count": 0, "error_code": error_code}


def read_source(
    source: ApprovedSource,
    load: Callable[[ApprovedSource], "str | bytes"],
    requested_date: str,
    retrieved_at: str,
    keep: Keep,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Reads one source. A failure is returned as that source's status, never raised (audit NG1)."""
    try:
        _acquire(source.key)
        parsed, newest_at = parse_rss_feed(load(source), source, requested_date, retrieved_at, keep)
    except SourceFetchError:
        log("WARN", "Source unreachable", provider=source.key)
        return [], failed_status(source.key, "PROVIDER_OUTAGE")
    except (ET.ParseError, ValueError):
        log("WARN", "Feed could not be read safely", provider=source.key)
        return [], failed_status(source.key, "SCHEMA_MISMATCH")
    except Exception as error:  # one bad source must not cost the others
        log("WARN", "News source failed", provider=source.key, error_type=type(error).__name__)
        return [], failed_status(source.key, "INTERNAL_ERROR")
    log("INFO", "News source read", provider=source.key, rights=source.rights, record_count=len(parsed),
        newest_item_at=newest_at or "")
    status: dict[str, Any] = {"source": source.key, "ok": True, "article_count": len(parsed)}
    if newest_at:
        # The newest item in the feed, kept or not. An old date here means the feed went stale, not a quiet day.
        status["newest_item_at"] = newest_at
    return parsed, status


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
    extra_readers: tuple[ExtraReader, ...] = (),
) -> tuple[int, dict[str, Any]]:
    """Port of build_news_response. Returns (status, body) like the old route.

    With window_start and window_end (ISO date-times) headlines are kept by that span. Without them they are kept
    by requested_date in UTC, as the old route did. requested_date still picks the fixture folder in fixture mode.
    extra_readers add sources that are not feeds; they are listed in "sources" like any other. When every feed
    is down the answer is still ok if an extra reader brought headlines, and an outage if it brought none.
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

    def load(source: ApprovedSource) -> str | bytes:
        if source_loader is not None:
            return source_loader(source, requested_date)
        if fixture_mode(env):
            return fetch_fixture_text(source, requested_date)
        return fetch_remote_text(source, env)

    articles: list[dict[str, Any]] = []
    statuses: list[dict[str, Any]] = []
    for source in active_sources(env):
        parsed, status = read_source(source, load, requested_date, retrieved_at, keep)
        articles.extend(parsed)
        statuses.append(status)
    feeds_down = all(not status["ok"] for status in statuses)
    for reader in extra_readers:
        parsed, status = reader(keep, retrieved_at)
        articles.extend(parsed)
        statuses.append(status)

    failed = [status for status in statuses if not status["ok"]]
    if len(failed) == len(statuses) or (feeds_down and not articles):
        # No feed could be read and nothing else brought a headline, so this is an outage and not a quiet day.
        # The first failure names it.
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
