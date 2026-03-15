from __future__ import annotations

import hashlib
import json
import os
import re
import socket
import urllib.error
import urllib.request
import uuid
import warnings
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from dataclasses import dataclass
from datetime import date, datetime, timezone
from email.utils import parsedate_to_datetime
from html import unescape
from pathlib import Path
from typing import Any, Callable, Literal, TypedDict
from urllib.parse import urlparse


SERVICE_NAME = "news-ingest"
DEFAULT_PROVIDER = "approved-sources"
REQUEST_TIMEOUT_SECONDS = 5.0
DEFAULT_SOURCE_RATE_LIMIT_PER_MINUTE = 5


class CanonicalNewsArticle(TypedDict):
    article_id: str
    source: str
    url: str
    title: str
    published_at: str
    retrieved_at: str
    body_text: str
    tickers_mentioned: list[str]
    is_approved_source: bool


class NewsServiceResponse(TypedDict, total=False):
    ok: bool
    data: list[CanonicalNewsArticle]
    error_flag: bool
    error_code: Literal[
        "AUTH_ERROR",
        "RATE_LIMIT",
        "TIMEOUT",
        "PROVIDER_OUTAGE",
        "SCHEMA_MISMATCH",
        "INTERNAL_ERROR",
    ]
    error_message: str
    request_id: str
    provider: str
    retrieved_at: str


class SourceFetchError(RuntimeError):
    pass


class HtmlFallbackDependencyError(RuntimeError):
    pass


class RateLimitExceededError(RuntimeError):
    def __init__(self, provider: str, retry_after_seconds: int) -> None:
        super().__init__(f"rate limit exceeded for {provider}")
        self.provider = provider
        self.retry_after_seconds = retry_after_seconds


@dataclass(frozen=True)
class ApprovedSource:
    key: str
    name: str
    method: Literal["rss", "html"]
    url: str
    fixture_name: str


APPROVED_SOURCES: tuple[ApprovedSource, ...] = (
    ApprovedSource(
        key="reuters-business",
        name="Reuters",
        method="rss",
        url="https://feeds.reuters.com/reuters/businessNews",
        fixture_name="reuters.rss.xml",
    ),
    ApprovedSource(
        key="bloomberg-markets",
        name="Bloomberg",
        method="rss",
        url="https://feeds.bloomberg.com/markets/news.rss",
        fixture_name="bloomberg.rss.xml",
    ),
    ApprovedSource(
        key="wsj-markets",
        name="WSJ Markets",
        method="html",
        url="https://www.wsj.com/news/markets",
        fixture_name="wsj.html",
    ),
)


@dataclass(frozen=True)
class Settings:
    fixture_mode: bool
    redis_url: str
    rate_limit_window_seconds: int
    rate_limit_burst_allowance: int
    rate_limit_cooldown_seconds: int
    source_rate_limit_per_minute: int

    @staticmethod
    def from_env(env: dict[str, str]) -> "Settings":
        return Settings(
            fixture_mode=env.get("NEWS_INGEST_FIXTURE_MODE", "true").strip().lower() in {
                "1",
                "true",
                "yes",
                "on",
            },
            redis_url=env.get("REDIS_URL", "redis://localhost:6379/0"),
            rate_limit_window_seconds=int(env.get("RATE_LIMIT_WINDOW_SECONDS", "60")),
            rate_limit_burst_allowance=int(env.get("RATE_LIMIT_BURST_ALLOWANCE", "2")),
            rate_limit_cooldown_seconds=int(env.get("RATE_LIMIT_COOLDOWN_SECONDS", "60")),
            source_rate_limit_per_minute=int(env.get("NEWS_SOURCE_RATE_LIMIT_PER_MINUTE", "5")),
        )


class RedisClient:
    def __init__(self, redis_url: str) -> None:
        parsed = urlparse(redis_url)
        self.host = parsed.hostname or "localhost"
        self.port = parsed.port or 6379

    def _encode(self, *parts: str) -> bytes:
        payload = [f"*{len(parts)}\r\n".encode("utf8")]
        for part in parts:
            encoded = part.encode("utf8")
            payload.append(f"${len(encoded)}\r\n".encode("utf8"))
            payload.append(encoded + b"\r\n")
        return b"".join(payload)

    def _read_line(self, sock: socket.socket) -> bytes:
        data = bytearray()
        while not data.endswith(b"\r\n"):
            chunk = sock.recv(1)
            if not chunk:
                raise ConnectionError("redis connection closed")
            data.extend(chunk)
        return bytes(data[:-2])

    def _read_response(self, sock: socket.socket) -> Any:
        prefix = sock.recv(1)
        if prefix == b"+":
            return self._read_line(sock).decode("utf8")
        if prefix == b":":
            return int(self._read_line(sock))
        if prefix == b"$":
            size = int(self._read_line(sock))
            if size == -1:
                return None
            remaining = size + 2
            data = bytearray()
            while len(data) < remaining:
                data.extend(sock.recv(remaining - len(data)))
            return bytes(data[:-2]).decode("utf8")
        raise ConnectionError("unsupported redis response")

    def execute(self, *parts: str) -> Any:
        with socket.create_connection((self.host, self.port), timeout=1.0) as sock:
            sock.sendall(self._encode(*parts))
            return self._read_response(sock)

    def get(self, key: str) -> str | None:
        value = self.execute("GET", key)
        return None if value is None else str(value)

    def incr(self, key: str) -> int:
        return int(self.execute("INCR", key))

    def expire(self, key: str, seconds: int) -> None:
        self.execute("EXPIRE", key, str(seconds))

    def setex(self, key: str, seconds: int, value: str) -> None:
        self.execute("SETEX", key, str(seconds), value)


class RateLimiter:
    def __init__(self, settings: Settings, client: RedisClient | None = None) -> None:
        self.settings = settings
        self.client = client or RedisClient(settings.redis_url)

    def acquire(self, provider: str) -> None:
        bucket_key = f"m2:news:bucket:{provider}"
        cooldown_key = f"m2:news:cooldown:{provider}"
        limit = self.settings.source_rate_limit_per_minute or DEFAULT_SOURCE_RATE_LIMIT_PER_MINUTE

        try:
            if self.client.get(cooldown_key) is not None:
                raise RateLimitExceededError(provider, self.settings.rate_limit_cooldown_seconds)

            count = self.client.incr(bucket_key)
            if count == 1:
                self.client.expire(bucket_key, self.settings.rate_limit_window_seconds)

            if count > limit + self.settings.rate_limit_burst_allowance:
                self.client.setex(cooldown_key, self.settings.rate_limit_cooldown_seconds, "1")
                raise RateLimitExceededError(provider, self.settings.rate_limit_cooldown_seconds)
        except (ConnectionError, OSError):
            return


SETTINGS = Settings.from_env(os.environ)
RATE_LIMITER = RateLimiter(SETTINGS)


def log(level: str, message: str, **fields: Any) -> None:
    payload = {
        "level": level,
        "service": SERVICE_NAME,
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    payload.update(fields)
    print(json.dumps(payload, separators=(",", ":")))


def ingestion_method_for(source: ApprovedSource) -> str:
    if source.method == "rss":
        return "rss"
    return "html_fallback"


def load_newsplease() -> Any:
    warnings.filterwarnings(
        "ignore",
        message=r"nltk is not installed.*",
        category=UserWarning,
    )
    warnings.filterwarnings(
        "ignore",
        category=DeprecationWarning,
        module=r"newsplease\.pipeline\.extractor\.extractors\.date_extractor",
    )
    try:
        from newsplease import NewsPlease
    except ImportError as error:  # pragma: no cover - exercised via runtime bootstrapping
        raise HtmlFallbackDependencyError(
            "news-please is required for approved HTML fallback sources."
        ) from error

    return NewsPlease


def is_fixture_mode() -> bool:
    return SETTINGS.fixture_mode


def repo_root() -> Path:
    current = Path(__file__).resolve()
    for candidate in current.parents:
        if (candidate / "data" / "golden").exists() and (candidate / "packages" / "contracts" / "schemas").exists():
            return candidate
    raise RuntimeError("Unable to locate repo root for news-ingest.")


def fixture_root() -> Path:
    return repo_root() / "data" / "golden" / "news-ingest"


def schema_root() -> Path:
    return repo_root() / "packages" / "contracts" / "schemas"


def load_schema(name: str) -> dict[str, Any]:
    schema_path = schema_root() / name
    return json.loads(schema_path.read_text(encoding="utf8"))


def validate_iso_datetime(value: str, field_name: str) -> None:
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(f"{field_name} must be an ISO 8601 date-time.") from error


def validate_against_schema(value: Any, schema: dict[str, Any], field_name: str) -> None:
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

    if schema_type == "null":
        if value is not None:
            raise ValueError(f"{field_name} must be null.")
        return

    raise ValueError(f"{field_name} uses unsupported schema type: {schema_type!r}.")


def validate_article(article: CanonicalNewsArticle) -> None:
    validate_against_schema(
        article,
        load_schema("canonical-news-article.schema.json"),
        "CanonicalNewsArticle",
    )


def validate_response(response: NewsServiceResponse) -> None:
    validate_against_schema(
        response,
        load_schema("service-response.schema.json"),
        "ServiceResponse",
    )
    for index, article in enumerate(response.get("data", [])):
        validate_article(article)
        if not isinstance(article["body_text"], str):
            raise ValueError(f"ServiceResponse.data[{index}].body_text must stay a string.")


def normalize_text(raw_text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", raw_text)
    text = unescape(text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


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


def normalize_published_at(value: datetime | str | None, fallback_value: str) -> str:
    if value is None:
        return normalize_datetime(fallback_value)
    if isinstance(value, str):
        return normalize_datetime(value)
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def extract_html_article_with_newsplease(
    source: ApprovedSource,
    article_html: str,
    url: str,
    fallback_title: str,
    fallback_published_at: str,
    fallback_body_text: str,
    retrieved_at: str,
) -> CanonicalNewsArticle:
    news_please = load_newsplease()
    extracted = news_please.from_html(article_html, url=url)
    title = normalize_text(getattr(extracted, "title", "") or fallback_title)
    published_at = normalize_published_at(getattr(extracted, "date_publish", None), fallback_published_at)
    body_text = normalize_text(
        getattr(extracted, "maintext", "")
        or getattr(extracted, "description", "")
        or fallback_body_text
        or fallback_title
    )
    article: CanonicalNewsArticle = {
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
    validate_article(article)
    return article


def parse_rss_articles(
    raw_text: str,
    source: ApprovedSource,
    requested_date: str,
    retrieved_at: str,
) -> list[CanonicalNewsArticle]:
    root = ET.fromstring(raw_text)
    articles: list[CanonicalNewsArticle] = []
    for item in root.findall(".//item"):
        title = (item.findtext("title") or "").strip()
        url = (item.findtext("link") or "").strip()
        published_at_raw = (item.findtext("pubDate") or "").strip()
        description = item.findtext("description") or ""
        if not title or not url or not published_at_raw:
            continue
        published_at = normalize_datetime(published_at_raw)
        if not filter_by_requested_date(published_at, requested_date):
            continue
        body_text = normalize_text(description or title)
        article: CanonicalNewsArticle = {
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
        validate_article(article)
        articles.append(article)
    return articles


def parse_html_articles(
    raw_text: str,
    source: ApprovedSource,
    requested_date: str,
    retrieved_at: str,
) -> list[CanonicalNewsArticle]:
    soup = BeautifulSoup(raw_text, "html.parser")
    articles: list[CanonicalNewsArticle] = []
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
        if not filter_by_requested_date(published_at, requested_date):
            continue

        fallback_body_text = normalize_text(article_tag.get_text(" ", strip=True))
        article = extract_html_article_with_newsplease(
            source=source,
            article_html=str(article_tag),
            url=url,
            fallback_title=title,
            fallback_published_at=published_at_raw,
            fallback_body_text=fallback_body_text,
            retrieved_at=retrieved_at,
        )
        if not filter_by_requested_date(article["published_at"], requested_date):
            continue
        articles.append(article)
    return articles


def fetch_fixture_text(source: ApprovedSource, requested_date: str) -> str:
    fixture_path = fixture_root() / requested_date / source.fixture_name
    if not fixture_path.exists():
        raise SourceFetchError(f"Fixture missing for source {source.key}.")
    return fixture_path.read_text(encoding="utf8")


def fetch_remote_text(source: ApprovedSource) -> str:
    request = urllib.request.Request(
        source.url,
        headers={"User-Agent": "ThesisNewsIngest/0.1"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            return response.read().decode("utf8", errors="replace")
    except urllib.error.URLError as error:
        raise SourceFetchError(f"Failed to fetch {source.url}.") from error


def resolve_source_text(
    source: ApprovedSource,
    requested_date: str,
    source_loader: Callable[[ApprovedSource, str], str] | None = None,
) -> str:
    if source_loader is not None:
        return source_loader(source, requested_date)
    if is_fixture_mode():
        return fetch_fixture_text(source, requested_date)
    return fetch_remote_text(source)


def parse_source_payload(
    source: ApprovedSource,
    raw_text: str,
    requested_date: str,
    retrieved_at: str,
) -> list[CanonicalNewsArticle]:
    if source.method == "rss":
        return parse_rss_articles(raw_text, source, requested_date, retrieved_at)
    return parse_html_articles(raw_text, source, requested_date, retrieved_at)


def outage_response(
    request_id: str,
    retrieved_at: str,
    error_code: str,
    error_message: str,
    *,
    provider: str = DEFAULT_PROVIDER,
) -> NewsServiceResponse:
    response: NewsServiceResponse = {
        "ok": False,
        "data": [],
        "error_flag": True,
        "error_code": error_code,  # type: ignore[typeddict-item]
        "error_message": error_message,
        "request_id": request_id,
        "provider": provider,
        "retrieved_at": retrieved_at,
    }
    validate_response(response)
    return response


def success_response(
    articles: list[CanonicalNewsArticle],
    request_id: str,
    retrieved_at: str,
) -> NewsServiceResponse:
    response: NewsServiceResponse = {
        "ok": True,
        "data": articles,
        "error_flag": False,
        "request_id": request_id,
        "provider": DEFAULT_PROVIDER,
        "retrieved_at": retrieved_at,
    }
    validate_response(response)
    return response


def build_news_response(
    requested_date: str,
    request_id: str | None = None,
    *,
    source_loader: Callable[[ApprovedSource, str], str] | None = None,
    now: datetime | None = None,
) -> tuple[int, NewsServiceResponse]:
    response_time = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    retrieved_at = response_time.isoformat().replace("+00:00", "Z")
    request_id = request_id or uuid.uuid4().hex

    try:
        date.fromisoformat(requested_date)
    except ValueError:
        return 400, outage_response(
            request_id=request_id,
            retrieved_at=retrieved_at,
            error_code="INTERNAL_ERROR",
            error_message="date query parameter is required in YYYY-MM-DD format.",
        )

    articles: list[CanonicalNewsArticle] = []
    try:
        for source in APPROVED_SOURCES:
            ingestion_method = ingestion_method_for(source)
            RATE_LIMITER.acquire(source.key)
            log(
                "INFO",
                "Data retrieval started",
                request_id=request_id,
                provider=source.key,
                ingestion_method=ingestion_method,
                dataset="news",
            )
            raw_text = resolve_source_text(source, requested_date, source_loader=source_loader)
            parsed_articles = parse_source_payload(source, raw_text, requested_date, retrieved_at)
            articles.extend(parsed_articles)
            log(
                "INFO",
                "Data retrieval succeeded",
                request_id=request_id,
                provider=source.key,
                ingestion_method=ingestion_method,
                dataset="news",
                record_count=len(parsed_articles),
            )
    except SourceFetchError:
        log(
            "ERROR",
            "Source unreachable / parser failed",
            request_id=request_id,
            provider=source.key,
            source=source.name,
            ingestion_method=ingestion_method_for(source),
        )
        return 200, outage_response(
            request_id=request_id,
            retrieved_at=retrieved_at,
            error_code="PROVIDER_OUTAGE",
            error_message="Approved source unavailable; returning empty list.",
            provider=source.key,
        )
    except (ET.ParseError, ValueError):
        log(
            "ERROR",
            "Schema validation failed",
            request_id=request_id,
            provider=source.key,
            source=source.name,
            ingestion_method=ingestion_method_for(source),
        )
        return 200, outage_response(
            request_id=request_id,
            retrieved_at=retrieved_at,
            error_code="SCHEMA_MISMATCH",
            error_message="Approved source payload could not be normalized safely.",
            provider=source.key,
        )
    except HtmlFallbackDependencyError as error:
        log(
            "ERROR",
            "Source unreachable / parser failed",
            request_id=request_id,
            provider=source.key,
            source=source.name,
            ingestion_method=ingestion_method_for(source),
            error_message=str(error),
        )
        return 500, outage_response(
            request_id=request_id,
            retrieved_at=retrieved_at,
            error_code="INTERNAL_ERROR",
            error_message="HTML fallback dependency is missing for an approved source.",
            provider=source.key,
        )
    except RateLimitExceededError as error:
        log(
            "WARN",
            "Provider rate limit hit",
            request_id=request_id,
            provider=error.provider,
            ingestion_method=ingestion_method_for(source),
            retry_after_seconds=error.retry_after_seconds,
        )
        return 429, outage_response(
            request_id=request_id,
            retrieved_at=retrieved_at,
            error_code="RATE_LIMIT",
            error_message=f"Rate limit exceeded for {error.provider}.",
            provider=error.provider,
        )

    articles.sort(key=lambda article: article["published_at"], reverse=True)
    return 200, success_response(articles, request_id, retrieved_at)
