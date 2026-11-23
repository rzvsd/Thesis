"""Shared bits of the old data-openbb service: fixture mode, response envelope, date helpers.

Copied from apps/data-openbb/src/service.py (keep tested logic). Fixture mode is the
default, exactly like DATA_OPENBB_FIXTURE_MODE there: live data only when it is set
to 0, false or no.
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Mapping

from schema_check import validate_schema

JOBS_DATA_ROOT = Path(__file__).resolve().parent
FIXTURE_ROOT = JOBS_DATA_ROOT / "fixtures"


class ProviderIntegrationError(RuntimeError):
    def __init__(self, provider: str, *, error_code: str, message: str, status_code: int = 503) -> None:
        super().__init__(message)
        self.provider = provider
        self.error_code = error_code
        self.status_code = status_code


def fixture_mode(env: Mapping[str, str] | None = None) -> bool:
    values = os.environ if env is None else env
    raw = str(values.get("DATA_OPENBB_FIXTURE_MODE", "true")).strip().lower()
    return raw not in {"0", "false", "no"}


def iso_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def normalize_iso_date(value: str | None) -> str | None:
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text or len(text) != 10:
        return None
    try:
        parsed = datetime.strptime(text, "%Y-%m-%d")
    except ValueError:
        return None
    return parsed.date().isoformat()


def add_days_to_iso_date(value: str, days: int) -> str:
    parsed = datetime.strptime(value, "%Y-%m-%d")
    return (parsed + timedelta(days=days)).date().isoformat()


def load_json_fixture(path: Path, default_factory: Any) -> dict[str, Any]:
    if not path.exists():
        return default_factory()
    return json.loads(path.read_text(encoding="utf-8"))


def success_response(*, data: dict[str, Any], provider: str, retrieved_at: str) -> dict[str, Any]:
    """The envelope the old data-openbb routes answered with on success."""
    response = {
        "ok": True,
        "data": data,
        "error_flag": False,
        "request_id": str(uuid.uuid4()),
        "provider": provider,
        "retrieved_at": retrieved_at,
    }
    validate_schema("service-response", response)
    return response
