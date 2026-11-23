"""Job side of the news store (rebuild branch audit NG8): post headlines, read a window back.

POST /internal/news/ingest {items, sources} and GET /internal/news?since=...&until=...
(supabase/functions/_lib/evaluators/news.ts). Used by run_news.py and run_pulse.py.
"""

from __future__ import annotations

from typing import Any, Mapping
from urllib.parse import urlencode

from api_client import ApiClient, ApiError
from joblog import log
from retry import DeadlineExceeded, RetryableError

INGEST_ROUTE = "/internal/news/ingest"
LIST_ROUTE = "/internal/news"
CHUNK_SIZE = 500
LIST_LIMIT = 500
# The store is optional for a Pulse issue. Its two calls together get this much time and no more, so a store
# that hangs cannot use up the time the Pulse dispatch needs.
STORE_BUDGET_SECONDS = 45.0


def post_news(api: ApiClient, items: list[dict[str, Any]], sources: list[dict[str, Any]]) -> int:
    """Stores the items in chunks. The source results go with the first chunk. Returns the rows stored."""
    stored = 0
    chunks = [items[start : start + CHUNK_SIZE] for start in range(0, len(items), CHUNK_SIZE)] or [[]]
    for index, chunk in enumerate(chunks):
        body: dict[str, Any] = {"items": chunk}
        if index == 0 and sources:
            body["sources"] = sources
        answer = api.post(INGEST_ROUTE, body).body.get("stored")
        stored += answer if isinstance(answer, int) else 0
    return stored


def read_news(api: ApiClient, since: str, until: str) -> list[dict[str, Any]]:
    """Stored headlines published in [since, until], newest first."""
    query = urlencode({"since": since, "until": until, "limit": LIST_LIMIT})
    items = api.get(f"{LIST_ROUTE}?{query}").body.get("items")
    return [item for item in items if isinstance(item, dict)] if isinstance(items, list) else []


def with_stored_news(
    api: ApiClient, fresh: Mapping[str, Any], window_start: str, window_end: str
) -> dict[str, Any]:
    """The news envelope for a Pulse issue: what was just read plus what earlier fetches stored for the window.

    A feed shows only its newest items, and the fetch at Pulse time can fail. So the fresh headlines are stored
    first, then the whole window is read back. If the store cannot be reached the fresh envelope is used as is.
    If the fresh read was an outage but the store holds headlines for the window, those are used.

    The store calls run on their own short time budget (STORE_BUDGET_SECONDS). The caller's step budget starts
    again afterwards, whatever happened here.
    """
    envelope = dict(fresh)
    fresh_ok = envelope.get("ok") is True and isinstance(envelope.get("data"), list)
    fresh_items: list[dict[str, Any]] = list(envelope["data"]) if fresh_ok else []
    sources = envelope.get("sources") if isinstance(envelope.get("sources"), list) else []
    api.start_step(STORE_BUDGET_SECONDS)
    try:
        if fresh_ok or sources:
            post_news(api, fresh_items, sources)
        stored_items = read_news(api, window_start, window_end)
    except (ApiError, RetryableError, DeadlineExceeded) as error:
        log("WARN", "News store unavailable; using the fresh headlines only", error_type=type(error).__name__)
        return envelope
    finally:
        api.start_step()

    merged: dict[str, dict[str, Any]] = {}
    for item in [*fresh_items, *stored_items]:
        article_id = item.get("article_id")
        if isinstance(article_id, str) and article_id not in merged:
            merged[article_id] = item
    data = sorted(merged.values(), key=lambda item: str(item.get("published_at", "")), reverse=True)
    log("INFO", "News window read from the store", fresh=len(fresh_items), stored=len(stored_items),
        merged=len(data), fresh_ok=fresh_ok)
    if not fresh_ok and not data:
        return envelope  # an outage with nothing stored stays an outage
    result = {key: value for key, value in envelope.items() if key not in {"error_code", "error_message"}}
    result.update({"ok": True, "error_flag": False, "data": data})
    return result
