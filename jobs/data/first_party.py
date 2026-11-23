"""First-party context: the body of the old news-ingest POST /v1/first-party/context {ticker, url}.

Copied from apps/news-ingest/src/news_ingest/service.py (keep tested logic): resolve_first_party_source,
the fixture loaders, first_party_context_from_fixture, the live metadata-only path and the response envelopes.
Fixture mode follows DATA_OPENBB_FIXTURE_MODE. Fixtures are in jobs/data/fixtures/first-party.
"""

from __future__ import annotations

import hashlib
import json
import urllib.parse
import uuid
from datetime import datetime, timezone
from typing import Any, Mapping

from joblog import log
from news_ingest import (
    FIRST_PARTY_FIXTURE_ROOT,
    FIRST_PARTY_PROVIDER,
    FIRST_PARTY_SOURCE_REGISTRY,
    PH6_SOURCE_REVIEWED_AT,
    FirstPartySource,
    SourceFetchError,
    validate_named,
    normalize_text,
)
from source_common import fixture_mode

# The page each pulse ticker was read from (firstPartyContextSourceByTicker in the old report builder).
FIRST_PARTY_CONTEXT_SOURCE_BY_TICKER = {
    "AAPL": "https://investor.apple.com/investor-relations/",
    "MSFT": "https://www.microsoft.com/en-us/investor/default",
    "TSLA": "https://ir.tesla.com/",
}


def registry_entry_payload(source: FirstPartySource) -> dict[str, Any]:
    entry = {
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
    validate_named(entry, "first-party-source-registry-entry.schema.json", "FirstPartySourceRegistryEntry")
    return entry


def first_party_registry_payload() -> list[dict[str, Any]]:
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
    fixture_path = FIRST_PARTY_FIXTURE_ROOT / f"{ticker.strip().upper()}.json"
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
    source: FirstPartySource, context_id: str, event_id: str | None, retrieved_at: str, raw_context: dict[str, Any]
) -> list[dict[str, Any]]:
    raw_artifacts = raw_context.get("artifacts", [])
    artifacts: list[dict[str, Any]] = []
    if not isinstance(raw_artifacts, list):
        return artifacts
    for raw_artifact in raw_artifacts:
        if not isinstance(raw_artifact, dict):
            continue
        artifact_type = str(raw_artifact.get("artifact_type", "supplemental_material"))
        source_url = str(raw_artifact.get("source_url") or raw_context.get("source_url") or "")
        title = str(raw_artifact.get("title") or raw_context.get("title") or "First-party artifact")
        artifact = {
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
        validate_named(artifact, "call-artifact.schema.json", "CallArtifact")
        artifacts.append(artifact)
    return artifacts


def first_party_context_from_fixture(
    source: FirstPartySource, url: str, event_id: str | None, retrieved_at: str
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    raw_context = fixture_context_for(source, url)
    context_id = str(raw_context.get("context_id") or context_id_for(source.ticker, url, event_id))
    artifacts = first_party_artifacts_from_fixture(source, context_id, event_id, retrieved_at, raw_context)
    summary = safe_excerpt(str(raw_context.get("summary") or raw_context.get("title") or "First-party context"))
    excerpt = safe_excerpt(str(raw_context.get("excerpt") or summary))
    item = {
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
        "artifact_ids": [artifact["artifact_id"] for artifact in artifacts],
        "metadata": {"seed_registry_entry_id": source.registry_entry_id, "fixture": True, "full_text_stored": False},
    }
    validate_named(item, "first-party-context-item.schema.json", "FirstPartyContextItem")
    return item, artifacts


def live_first_party_context(source: FirstPartySource, url: str, event_id: str | None, retrieved_at: str) -> dict[str, Any]:
    # Live mode is intentionally metadata-first until parser-specific rights are reviewed.
    summary = f"Approved first-party source fetched as metadata-only context: {url}"
    item = {
        "context_id": context_id_for(source.ticker, url, event_id),
        "ticker": source.ticker,
        **({"event_id": event_id} if event_id else {}),
        "registry_entry_id": source.registry_entry_id,
        "source_url": url,
        "source_domain": source.domain,
        "page_type": source.page_types[0],
        "title": f"{source.issuer_name} first-party source",
        "summary": summary,
        "excerpt": summary,
        "retrieved_at": retrieved_at,
        "content_hash": hashlib.sha256(url.encode("utf8")).hexdigest(),
        "fetch_state": "fetched",
        "rights": source.default_rights,
        "artifact_ids": [],
        "metadata": {"live_metadata_only": True, "full_text_stored": False},
    }
    validate_named(item, "first-party-context-item.schema.json", "FirstPartyContextItem")
    return item


def first_party_rejection_response(
    request_id: str, retrieved_at: str, error_code: str, error_message: str, *, ticker: str, url: str
) -> dict[str, Any]:
    return {
        "ok": False,
        "data": {
            "context_items": [],
            "call_artifacts": [],
            "registry": first_party_registry_payload(),
            "rejected": {"ticker": ticker.strip().upper(), "url": url},
        },
        "error_flag": True,
        "error_code": error_code,
        "error_message": error_message,
        "request_id": request_id,
        "provider": FIRST_PARTY_PROVIDER,
        "retrieved_at": retrieved_at,
    }


def first_party_context_response(
    ticker: str,
    source_url: str,
    *,
    event_id: str | None = None,
    env: Mapping[str, str] | None = None,
    now: datetime | None = None,
) -> tuple[int, dict[str, Any]]:
    """Port of build_first_party_context_response. Returns (status, body) like the old route."""
    retrieved_at = (now or datetime.now(timezone.utc)).astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    request_id = uuid.uuid4().hex
    normalized_ticker = ticker.strip().upper()
    normalized_url = source_url.strip()

    def reject(status: int, code: str, message: str) -> tuple[int, dict[str, Any]]:
        return status, first_party_rejection_response(
            request_id, retrieved_at, code, message, ticker=normalized_ticker, url=normalized_url
        )

    if not normalized_ticker or not normalized_url:
        return reject(400, "SOURCE_REJECTED", "ticker and url are required.")
    source = resolve_first_party_source(normalized_ticker, normalized_url)
    if source is None:
        log("WARN", "First-party source rejected", ticker=normalized_ticker, reason="unapproved_domain_or_path")
        return reject(422, "SOURCE_REJECTED", "First-party source is not in the approved Phase 6 source registry.")
    if source.default_rights.get("display_mode") == "internal_only_not_user_visible":
        return reject(422, "SOURCE_REJECTED", "First-party source has no user-visible rights posture.")

    try:
        if fixture_mode(env):
            context_item, artifacts = first_party_context_from_fixture(source, normalized_url, event_id, retrieved_at)
        else:
            context_item, artifacts = live_first_party_context(source, normalized_url, event_id, retrieved_at), []
    except SourceFetchError:
        log("WARN", "First-party source unavailable", provider=source.registry_entry_id, ticker=source.ticker)
        return reject(200, "SOURCE_UNAVAILABLE", "Approved first-party source fixture or live metadata was unavailable.")
    except ValueError:
        log("WARN", "First-party schema validation failed", provider=source.registry_entry_id, ticker=source.ticker)
        return reject(200, "SCHEMA_MISMATCH", "Approved first-party source could not be normalized safely.")

    return 200, {
        "ok": True,
        "data": {"context_items": [context_item], "call_artifacts": artifacts, "registry": first_party_registry_payload()},
        "error_flag": False,
        "request_id": request_id,
        "provider": FIRST_PARTY_PROVIDER,
        "retrieved_at": retrieved_at,
    }
