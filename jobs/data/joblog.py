"""One JSON line per log event. Never pass tokens, emails or full URLs here."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from typing import Any


def log(level: str, message: str, **fields: Any) -> None:
    payload: dict[str, Any] = {
        "level": level,
        "service": "thesis-jobs",
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    for key, value in fields.items():
        if value is not None:
            payload[key] = value
    stream = sys.stderr if level == "ERROR" else sys.stdout
    print(json.dumps(payload, separators=(",", ":"), default=str), file=stream, flush=True)
