from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.parse
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

# Make the shared redis-client package importable.
_PACKAGES_ROOT = str(Path(__file__).resolve().parents[4] / "packages" / "redis-client")
if _PACKAGES_ROOT not in sys.path:
    sys.path.insert(0, _PACKAGES_ROOT)

from client import RedisClient  # noqa: E402


SERVICE_NAME = "news-ingest"
DEFAULT_PROVIDER = "approved-sources"
FIRST_PARTY_PROVIDER = "first-party-context"
REQUEST_TIMEOUT_SECONDS = 5.0
DEFAULT_SOURCE_RATE_LIMIT_PER_MINUTE = 5
PH6_SOURCE_REVIEWED_AT = "2026-04-17T00:00:00Z"


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


class EvidenceRightsMetadata(TypedDict, total=False):
    rights_class: str
    display_mode: str
    source_rank: str
    source_type: str
    can_store_full_text: bool
    can_display_excerpt: bool
    can_display_link: bool
    policy_reason: str
    reviewed_at: str
    review_expires_at: str


class FirstPartySourceRegistryEntry(TypedDict, total=False):
    registry_entry_id: str
    ticker: str
    issuer_name: str
    domain: str
    allowed_paths: list[str]
    page_types: list[str]
    default_rights: EvidenceRightsMetadata
    owner: str
    reviewed_at: str
    active: bool


class FirstPartyContextItem(TypedDict, total=False):
    context_id: str
    ticker: str
    event_id: str
    registry_entry_id: str
    source_url: str
    source_domain: str
    page_type: str
    title: str
    summary: str
    excerpt: str
    retrieved_at: str
    published_at: str
    content_hash: str
    fetch_state: str
    rights: EvidenceRightsMetadata
    artifact_ids: list[str]
    metadata: dict[str, Any]


class CallArtifact(TypedDict, total=False):
    artifact_id: str
    ticker: str
    event_id: str
    context_id: str
    artifact_type: str
    title: str
    source_url: str
    source_domain: str
    published_at: str
    retrieved_at: str
    completeness_state: str
    rights: EvidenceRightsMetadata
    content_hash: str
    metadata: dict[str, Any]


class FirstPartyContextResponse(TypedDict, total=False):
    ok: bool
    data: dict[str, Any]
    error_flag: bool
    error_code: Literal[
        "SOURCE_REJECTED",
        "SOURCE_UNAVAILABLE",
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
    def default_rights(self) -> EvidenceRightsMetadata:
        return build_first_party_rights(
            display_mode=self.default_display_mode,
            policy_reason=self.policy_reason,
        )


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


FIRST_PARTY_SOURCE_REGISTRY: tuple[FirstPartySource, ...] = (
    FirstPartySource(
        registry_entry_id="ph6m2-aapl-investor",
        ticker="AAPL",
        issuer_name="Apple Inc.",
        domain="investor.apple.com",
        allowed_paths=("/investor-relations/", "/"),
        page_types=("investor_relations", "earnings_release", "sec_filing_reference"),
        fixture_name="AAPL.json",
        default_display_mode="excerpt_only",
        policy_reason="Approved seed first-party investor page; store bounded excerpts and links only.",
    ),
    FirstPartySource(
        registry_entry_id="ph6m2-aapl-newsroom",
        ticker="AAPL",
        issuer_name="Apple Inc.",
        domain="www.apple.com",
        allowed_paths=("/newsroom/",),
        page_types=("newsroom", "press_release"),
        fixture_name="AAPL.json",
        default_display_mode="excerpt_only",
        policy_reason="Approved seed first-party newsroom path; store bounded excerpts and links only.",
    ),
    FirstPartySource(
        registry_entry_id="ph6m2-msft-investor",
        ticker="MSFT",
        issuer_name="Microsoft Corporation",
        domain="www.microsoft.com",
        allowed_paths=("/en-us/investor/", "/en-us/Investor/"),
        page_types=("investor_relations", "earnings_release", "webcast"),
        fixture_name="MSFT.json",
        default_display_mode="excerpt_only",
        policy_reason="Approved seed first-party investor path; store bounded excerpts and links only.",
    ),
    FirstPartySource(
        registry_entry_id="ph6m2-msft-news",
        ticker="MSFT",
        issuer_name="Microsoft Corporation",
        domain="news.microsoft.com",
        allowed_paths=("/",),
        page_types=("press_release", "newsroom"),
        fixture_name="MSFT.json",
        default_display_mode="excerpt_only",
        policy_reason="Approved seed first-party news path; store bounded excerpts and links only.",
    ),
    FirstPartySource(
        registry_entry_id="ph6m2-tsla-ir",
        ticker="TSLA",
        issuer_name="Tesla, Inc.",
        domain="ir.tesla.com",
        allowed_paths=("/", "/press-release/"),
        page_types=("investor_relations", "earnings_release", "webcast"),
        fixture_name="TSLA.json",
        default_display_mode="excerpt_only",
        policy_reason="Approved seed first-party investor path; store bounded excerpts and links only.",
    ),
    FirstPartySource(
        registry_entry_id="ph6m2-tsla-assets",
        ticker="TSLA",
        issuer_name="Tesla, Inc.",
        domain="assets-ir.tesla.com",
        allowed_paths=("/",),
        page_types=("presentation", "supplemental_material"),
        fixture_name="TSLA.json",
        default_display_mode="link_only",
        policy_reason="Approved seed asset host; store metadata and links, not full asset text.",
    ),
    FirstPartySource(
        registry_entry_id="ph6m2-tsla-digitalassets",
        ticker="TSLA",
        issuer_name="Tesla, Inc.",
        domain="digitalassets.tesla.com",
        allowed_paths=("/",),
        page_types=("presentation", "supplemental_material"),
        fixture_name="TSLA.json",
        default_display_mode="link_only",
        policy_reason="Approved seed asset host; store metadata and links, not full asset text.",
    ),
    FirstPartySource(
        registry_entry_id="ph6m2-tsla-main",
        ticker="TSLA",
        issuer_name="Tesla, Inc.",
        domain="www.tesla.com",
        allowed_paths=("/",),
        page_types=("investor_relations", "presentation", "webcast"),
        fixture_name="TSLA.json",
        default_display_mode="link_only",
        policy_reason="Approved seed Tesla first-party domain; store metadata and links, not full text.",
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


# RedisClient is imported from packages/redis-client (see top of file).


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


# Lazy defaults — avoids module-level side effects.  Callers (including
# tests) can pass their own settings / rate_limiter to build_news_response.
_default_settings: Settings | None = None
_default_rate_limiter: RateLimiter | None = None


def _get_default_settings() -> Settings:
    global _default_settings
    if _default_settings is None:
        _default_settings = Settings.from_env(dict(os.environ))
    return _default_settings


def _get_default_rate_limiter() -> RateLimiter:
    global _default_rate_limiter
    if _default_rate_limiter is None:
        _default_rate_limiter = RateLimiter(_get_default_settings())
    return _default_rate_limiter


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


def is_fixture_mode(settings: Settings | None = None) -> bool:
    return (settings or _get_default_settings()).fixture_mode


def repo_root() -> Path:
    current = Path(__file__).resolve()
    for candidate in current.parents:
        if (candidate / "data" / "golden").exists() and (candidate / "packages" / "contracts" / "schemas").exists():
            return candidate
    raise RuntimeError("Unable to locate repo root for news-ingest.")


def fixture_root() -> Path:
    return repo_root() / "data" / "golden" / "news-ingest"


def first_party_fixture_root() -> Path:
    return fixture_root() / "first-party"


def schema_root() -> Path:
    return repo_root() / "packages" / "contracts" / "schemas"


def load_schema(name: str) -> dict[str, Any]:
    schema_path = schema_root() / name
    return json.loads(schema_path.read_text(encoding="utf8"))


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


def validate_first_party_context_item(item: FirstPartyContextItem) -> None:
    validate_against_schema(
        item,
        load_schema("first-party-context-item.schema.json"),
        "FirstPartyContextItem",
    )


def validate_call_artifact(artifact: CallArtifact) -> None:
    validate_against_schema(
        artifact,
        load_schema("call-artifact.schema.json"),
        "CallArtifact",
    )


def validate_source_registry_entry(entry: FirstPartySourceRegistryEntry) -> None:
    validate_against_schema(
        entry,
        load_schema("first-party-source-registry-entry.schema.json"),
        "FirstPartySourceRegistryEntry",
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


def build_first_party_rights(display_mode: str, policy_reason: str) -> EvidenceRightsMetadata:
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


def registry_entry_payload(source: FirstPartySource) -> FirstPartySourceRegistryEntry:
    entry: FirstPartySourceRegistryEntry = {
        "registry_entry_id": source.registry_entry_id,
        "ticker": source.ticker,
        "issuer_name": source.issuer_name,
        "domain": source.domain,
        "allowed_paths": list(source.allowed_paths),
        "page_types": list(source.page_types),
        "default_rights": source.default_rights,
        "owner": "Phase 6 Product/Legal seed approval",
        "reviewed_at": PH6_SOURCE_REVIEWED_AT,
        "active": True,
    }
    validate_source_registry_entry(entry)
    return entry


def first_party_registry_payload() -> list[FirstPartySourceRegistryEntry]:
    return [registry_entry_payload(source) for source in FIRST_PARTY_SOURCE_REGISTRY]


def normalize_domain(value: str) -> str:
    return value.strip().lower().removeprefix("http://").removeprefix("https://").split("/")[0]


def resolve_first_party_source(ticker: str, url: str) -> FirstPartySource | None:
    normalized_ticker = ticker.strip().upper()
    parsed = urllib.parse.urlparse(url)
    domain = normalize_domain(parsed.netloc)
    path = parsed.path or "/"
    for source in FIRST_PARTY_SOURCE_REGISTRY:
        if source.ticker != normalized_ticker or source.domain != domain:
            continue
        if any(path.startswith(allowed_path) for allowed_path in source.allowed_paths):
            return source
    return None


def context_id_for(ticker: str, url: str, event_id: str | None = None) -> str:
    raw = f"{ticker.strip().upper()}|{event_id or ''}|{url.strip()}"
    return hashlib.sha256(raw.encode("utf8")).hexdigest()


def artifact_id_for(ticker: str, url: str, artifact_type: str) -> str:
    raw = f"{ticker.strip().upper()}|{artifact_type}|{url.strip()}"
    return hashlib.sha256(raw.encode("utf8")).hexdigest()


def safe_excerpt(text: str, limit: int = 320) -> str:
    normalized = normalize_text(text)
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 1].rstrip() + "..."


def load_first_party_fixture(ticker: str) -> dict[str, Any]:
    fixture_path = first_party_fixture_root() / f"{ticker.strip().upper()}.json"
    if not fixture_path.exists():
        raise SourceFetchError(f"First-party fixture missing for {ticker}.")
    return json.loads(fixture_path.read_text(encoding="utf8"))


def fixture_context_for(source: FirstPartySource, url: str) -> dict[str, Any]:
    fixture = load_first_party_fixture(source.ticker)
    contexts = fixture.get("contexts", [])
    if not isinstance(contexts, list):
        raise ValueError(f"First-party fixture for {source.ticker} has invalid contexts.")
    for context in contexts:
        if isinstance(context, dict) and str(context.get("source_url", "")).strip() == url.strip():
            return context
    raise SourceFetchError(f"No first-party fixture context found for {source.ticker} {url}.")


def first_party_artifacts_from_fixture(
    source: FirstPartySource,
    context_id: str,
    event_id: str | None,
    retrieved_at: str,
    raw_context: dict[str, Any],
) -> list[CallArtifact]:
    raw_artifacts = raw_context.get("artifacts", [])
    artifacts: list[CallArtifact] = []
    if not isinstance(raw_artifacts, list):
        return artifacts
    for raw_artifact in raw_artifacts:
        if not isinstance(raw_artifact, dict):
            continue
        artifact_type = str(raw_artifact.get("artifact_type", "supplemental_material"))
        source_url = str(raw_artifact.get("source_url") or raw_context.get("source_url") or "")
        title = str(raw_artifact.get("title") or raw_context.get("title") or "First-party artifact")
        artifact: CallArtifact = {
            "artifact_id": str(raw_artifact.get("artifact_id") or artifact_id_for(source.ticker, source_url, artifact_type)),
            "ticker": source.ticker,
            **({"event_id": event_id} if event_id else {}),
            "context_id": context_id,
            "artifact_type": artifact_type,
            "title": title,
            "source_url": source_url,
            "source_domain": normalize_domain(urllib.parse.urlparse(source_url).netloc or source.domain),
            **({"published_at": str(raw_artifact["published_at"])} if raw_artifact.get("published_at") else {}),
            "retrieved_at": retrieved_at,
            "completeness_state": str(raw_artifact.get("completeness_state", "metadata_only")),
            "rights": source.default_rights,
            "content_hash": hashlib.sha256(source_url.encode("utf8")).hexdigest(),
            "metadata": {
                "seed_registry_entry_id": source.registry_entry_id,
                "storage_note": "metadata-and-link-first artifact capture",
            },
        }
        validate_call_artifact(artifact)
        artifacts.append(artifact)
    return artifacts


def first_party_context_from_fixture(
    source: FirstPartySource,
    url: str,
    event_id: str | None,
    retrieved_at: str,
) -> tuple[FirstPartyContextItem, list[CallArtifact]]:
    raw_context = fixture_context_for(source, url)
    context_id = str(raw_context.get("context_id") or context_id_for(source.ticker, url, event_id))
    artifacts = first_party_artifacts_from_fixture(source, context_id, event_id, retrieved_at, raw_context)
    artifact_ids = [artifact["artifact_id"] for artifact in artifacts]
    summary = safe_excerpt(str(raw_context.get("summary") or raw_context.get("title") or "First-party context"))
    excerpt = safe_excerpt(str(raw_context.get("excerpt") or summary))
    item: FirstPartyContextItem = {
        "context_id": context_id,
        "ticker": source.ticker,
        **({"event_id": event_id} if event_id else {}),
        "registry_entry_id": source.registry_entry_id,
        "source_url": url,
        "source_domain": source.domain,
        "page_type": str(raw_context.get("page_type") or source.page_types[0]),
        "title": str(raw_context.get("title") or source.issuer_name),
        "summary": summary,
        "excerpt": excerpt,
        "retrieved_at": retrieved_at,
        **({"published_at": str(raw_context["published_at"])} if raw_context.get("published_at") else {}),
        "content_hash": hashlib.sha256(json.dumps(raw_context, sort_keys=True).encode("utf8")).hexdigest(),
        "fetch_state": "fetched",
        "rights": source.default_rights,
        "artifact_ids": artifact_ids,
        "metadata": {
            "seed_registry_entry_id": source.registry_entry_id,
            "fixture": True,
            "full_text_stored": False,
        },
    }
    validate_first_party_context_item(item)
    return item, artifacts


def first_party_rejection_response(
    request_id: str,
    retrieved_at: str,
    error_code: str,
    error_message: str,
    *,
    ticker: str,
    url: str,
) -> FirstPartyContextResponse:
    return {
        "ok": False,
        "data": {
            "context_items": [],
            "call_artifacts": [],
            "registry": first_party_registry_payload(),
            "rejected": {
                "ticker": ticker.strip().upper(),
                "url": url,
            },
        },
        "error_flag": True,
        "error_code": error_code,  # type: ignore[typeddict-item]
        "error_message": error_message,
        "request_id": request_id,
        "provider": FIRST_PARTY_PROVIDER,
        "retrieved_at": retrieved_at,
    }


def first_party_success_response(
    item: FirstPartyContextItem,
    artifacts: list[CallArtifact],
    request_id: str,
    retrieved_at: str,
) -> FirstPartyContextResponse:
    return {
        "ok": True,
        "data": {
            "context_items": [item],
            "call_artifacts": artifacts,
            "registry": first_party_registry_payload(),
        },
        "error_flag": False,
        "request_id": request_id,
        "provider": FIRST_PARTY_PROVIDER,
        "retrieved_at": retrieved_at,
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
    *,
    settings: Settings | None = None,
) -> str:
    if source_loader is not None:
        return source_loader(source, requested_date)
    if is_fixture_mode(settings):
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
    settings: Settings | None = None,
    rate_limiter: RateLimiter | None = None,
) -> tuple[int, NewsServiceResponse]:
    active_settings = settings or _get_default_settings()
    active_limiter = rate_limiter or _get_default_rate_limiter()
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
            active_limiter.acquire(source.key)
            log(
                "INFO",
                "Data retrieval started",
                request_id=request_id,
                provider=source.key,
                ingestion_method=ingestion_method,
                dataset="news",
            )
            raw_text = resolve_source_text(source, requested_date, source_loader=source_loader, settings=active_settings)
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


def build_first_party_context_response(
    ticker: str,
    source_url: str,
    request_id: str | None = None,
    *,
    event_id: str | None = None,
    now: datetime | None = None,
    settings: Settings | None = None,
) -> tuple[int, FirstPartyContextResponse]:
    active_settings = settings or _get_default_settings()
    response_time = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    retrieved_at = response_time.isoformat().replace("+00:00", "Z")
    request_id = request_id or uuid.uuid4().hex
    normalized_ticker = ticker.strip().upper()
    normalized_url = source_url.strip()

    if not normalized_ticker or not normalized_url:
        return 400, first_party_rejection_response(
            request_id,
            retrieved_at,
            "SOURCE_REJECTED",
            "ticker and url are required.",
            ticker=ticker,
            url=source_url,
        )

    source = resolve_first_party_source(normalized_ticker, normalized_url)
    if source is None:
        log(
            "WARN",
            "First-party source rejected",
            request_id=request_id,
            ticker=normalized_ticker,
            url=normalized_url,
            reason="unapproved_domain_or_path",
        )
        return 422, first_party_rejection_response(
            request_id,
            retrieved_at,
            "SOURCE_REJECTED",
            "First-party source is not in the approved Phase 6 source registry.",
            ticker=normalized_ticker,
            url=normalized_url,
        )

    if source.default_rights.get("display_mode") == "internal_only_not_user_visible":
        return 422, first_party_rejection_response(
            request_id,
            retrieved_at,
            "SOURCE_REJECTED",
            "First-party source has no user-visible rights posture.",
            ticker=normalized_ticker,
            url=normalized_url,
        )

    log(
        "INFO",
        "First-party context retrieval started",
        request_id=request_id,
        provider=source.registry_entry_id,
        ticker=source.ticker,
        domain=source.domain,
        dataset="first_party_context",
    )

    try:
        if active_settings.fixture_mode:
            context_item, artifacts = first_party_context_from_fixture(
                source,
                normalized_url,
                event_id,
                retrieved_at,
            )
        else:
            # Live mode is intentionally metadata-first until parser-specific rights are reviewed.
            title = f"{source.issuer_name} first-party source"
            summary = f"Approved first-party source fetched as metadata-only context: {normalized_url}"
            context_id = context_id_for(source.ticker, normalized_url, event_id)
            context_item = {
                "context_id": context_id,
                "ticker": source.ticker,
                **({"event_id": event_id} if event_id else {}),
                "registry_entry_id": source.registry_entry_id,
                "source_url": normalized_url,
                "source_domain": source.domain,
                "page_type": source.page_types[0],
                "title": title,
                "summary": summary,
                "excerpt": summary,
                "retrieved_at": retrieved_at,
                "content_hash": hashlib.sha256(normalized_url.encode("utf8")).hexdigest(),
                "fetch_state": "fetched",
                "rights": source.default_rights,
                "artifact_ids": [],
                "metadata": {
                    "live_metadata_only": True,
                    "full_text_stored": False,
                },
            }
            artifacts = []
            validate_first_party_context_item(context_item)
    except SourceFetchError as error:
        log(
            "ERROR",
            "First-party source unavailable",
            request_id=request_id,
            provider=source.registry_entry_id,
            ticker=source.ticker,
            domain=source.domain,
            error_message=str(error),
        )
        return 200, first_party_rejection_response(
            request_id,
            retrieved_at,
            "SOURCE_UNAVAILABLE",
            "Approved first-party source fixture or live metadata was unavailable.",
            ticker=normalized_ticker,
            url=normalized_url,
        )
    except ValueError as error:
        log(
            "ERROR",
            "First-party schema validation failed",
            request_id=request_id,
            provider=source.registry_entry_id,
            ticker=source.ticker,
            domain=source.domain,
            error_message=str(error),
        )
        return 200, first_party_rejection_response(
            request_id,
            retrieved_at,
            "SCHEMA_MISMATCH",
            "Approved first-party source could not be normalized safely.",
            ticker=normalized_ticker,
            url=normalized_url,
        )

    log(
        "INFO",
        "First-party context retrieval succeeded",
        request_id=request_id,
        provider=source.registry_entry_id,
        ticker=source.ticker,
        domain=source.domain,
        dataset="first_party_context",
        context_count=1,
        artifact_count=len(artifacts),
        display_mode=context_item["rights"]["display_mode"],
    )
    return 200, first_party_success_response(context_item, artifacts, request_id, retrieved_at)
