"""Earnings calendar rows, as the old POST /internal/calendar/earnings returned them.

Copied from apps/data-openbb/src/service.py (keep tested logic): the calendar fixture,
_coerce_calendar_date, _coerce_calendar_event_time, _calendar_row_candidates,
_normalize_earnings_calendar_rows and the live yfinance fetch.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Callable, Mapping

from retry import RateLimiter
from schema_check import SchemaValidationError, validate_schema
from source_common import (
    FIXTURE_ROOT,
    ProviderIntegrationError,
    add_days_to_iso_date,
    fixture_mode,
    iso_timestamp,
    load_json_fixture,
    normalize_iso_date,
    success_response,
)

CALENDAR_PROVIDER = "yfinance"
CALENDAR_FIXTURE_PATH = FIXTURE_ROOT / "calendar" / "earnings.json"
YFINANCE_LIMITER = RateLimiter(per_minute=60)


def load_calendar_fixture_payload() -> dict[str, Any]:
    fixture = load_json_fixture(
        CALENDAR_FIXTURE_PATH,
        default_factory=lambda: {
            "events": [
                {
                    "ticker": "AAPL",
                    "event_date": date.today().isoformat(),
                    "event_time": "after_market",
                    "provider": CALENDAR_PROVIDER,
                }
            ]
        },
    )
    events = fixture.get("events", [])
    if not isinstance(events, list):
        raise SchemaValidationError("calendar fixture events must be an array")
    payload = {"events": [event for event in events if isinstance(event, dict)]}
    validate_schema("service-response", {"ok": True, "data": payload, "error_flag": False})
    return payload


def coerce_calendar_date(value: Any) -> str | None:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if not isinstance(value, str):
        return None

    text = value.strip()
    if not text:
        return None

    for candidate in (text, text.replace("/", "-")):
        try:
            parsed = datetime.fromisoformat(candidate.replace("Z", "+00:00"))
        except ValueError:
            parsed = None
        if parsed is not None:
            return parsed.date().isoformat()

    for pattern in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%m/%d/%Y", "%m/%d/%Y %H:%M:%S", "%Y/%m/%d"):
        try:
            parsed = datetime.strptime(text, pattern)
        except ValueError:
            continue
        return parsed.date().isoformat()

    return None


def _time_bucket(hour: int, minute: int) -> str:
    if hour < 9 or (hour == 9 and minute < 30):
        return "before_market"
    if hour >= 16:
        return "after_market"
    return "during_market"


def coerce_calendar_event_time(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        text = value.strip().lower()
        if not text:
            return None
        if any(token in text for token in ("before market", "before open", "pre-market", "premarket", "bmo")):
            return "before_market"
        if any(token in text for token in ("after market", "after close", "post-market", "postmarket", "amc")):
            return "after_market"
        if any(token in text for token in ("during market", "intraday", "market hours")):
            return "during_market"
        parsed_date = coerce_calendar_date(text)
        if parsed_date is not None and "t" in text:
            try:
                parsed = datetime.fromisoformat(text.replace("z", "Z").replace("Z", "+00:00"))
            except ValueError:
                parsed = None
            if parsed is not None:
                return _time_bucket(parsed.hour, parsed.minute)
        return None
    if isinstance(value, datetime):
        return _time_bucket(value.hour, value.minute)
    return None


def calendar_row_candidates(raw_result: Any) -> list[dict[str, Any]]:
    if raw_result is None:
        return []

    if hasattr(raw_result, "reset_index") and hasattr(raw_result, "to_dict"):
        try:
            records = raw_result.reset_index().to_dict(orient="records")
        except Exception:
            records = []
        if isinstance(records, list):
            return [dict(item) for item in records if isinstance(item, Mapping)]

    if isinstance(raw_result, Mapping):
        for key in ("events", "data", "calendar", "records", "results"):
            value = raw_result.get(key)
            if isinstance(value, list):
                return [dict(item) for item in value if isinstance(item, Mapping)]
            if isinstance(value, Mapping):
                return [dict(value)]

        if raw_result and all(isinstance(value, Mapping) for value in raw_result.values()):
            rows: list[dict[str, Any]] = []
            for key, value in raw_result.items():
                row = dict(value)
                row.setdefault("ticker", key)
                rows.append(row)
            return rows

    if isinstance(raw_result, list):
        return [dict(item) for item in raw_result if isinstance(item, Mapping)]

    return []


_TICKER_KEYS = ("ticker", "symbol", "index", "Ticker", "Symbol")
_DATE_KEYS = ("event_date", "date", "earnings_date", "Earnings Date", "EarningsDate", "startdatetime", "startDate")
_TIME_KEYS = (
    "event_time",
    "time",
    "when",
    "timing",
    "earnings_call_time",
    "earnings_call",
    "call_time",
    "Earnings Call Time",
)


def normalize_earnings_calendar_rows(
    rows: list[dict[str, Any]], *, start_date: str, end_date: str
) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for row in rows:
        ticker_raw = next((row.get(key) for key in _TICKER_KEYS if isinstance(row.get(key), str) and row.get(key)), None)
        ticker = str(ticker_raw).strip().upper() if ticker_raw is not None else ""
        event_date_raw = next((row.get(key) for key in _DATE_KEYS if row.get(key) is not None), None)
        event_date = coerce_calendar_date(event_date_raw)
        if not ticker or not event_date:
            continue
        if event_date < start_date or event_date > end_date:
            continue

        time_raw = next((row.get(key) for key in _TIME_KEYS if row.get(key) is not None), None)
        event_time = coerce_calendar_event_time(time_raw)
        if event_time is None:
            event_time = coerce_calendar_event_time(event_date_raw)

        normalized.append(
            {
                "ticker": ticker,
                "event_type": "earnings",
                "event_date": event_date,
                **({"event_time": event_time} if event_time is not None else {}),
                "provider": CALENDAR_PROVIDER,
                "retrieved_at": iso_timestamp(),
            }
        )

    normalized.sort(key=lambda item: (item["event_date"], item["ticker"]))
    return normalized


def fetch_yfinance_rows(start_date: str, end_date: str) -> list[dict[str, Any]]:
    try:
        import yfinance as yf  # type: ignore
    except ImportError as error:
        raise ProviderIntegrationError(
            CALENDAR_PROVIDER,
            error_code="INTERNAL_ERROR",
            status_code=500,
            message="yfinance is not installed for live calendar mode.",
        ) from error

    YFINANCE_LIMITER.acquire()
    try:
        calendars = yf.Calendars(start_date, end_date)
        raw_result = calendars.get_earnings_calendar()
    except Exception as error:  # provider failures become one clear error
        raise ProviderIntegrationError(
            CALENDAR_PROVIDER,
            error_code="PROVIDER_OUTAGE",
            message=f"{CALENDAR_PROVIDER} request failed for Calendars.get_earnings_calendar.",
        ) from error
    return calendar_row_candidates(raw_result)


def calendar_earnings_response(
    *,
    start_date: str,
    end_date: str | None = None,
    env: Mapping[str, str] | None = None,
    fetch_rows: Callable[[str, str], list[dict[str, Any]]] = fetch_yfinance_rows,
) -> dict[str, Any]:
    """The body of the old POST /internal/calendar/earnings with {start_date, end_date}."""
    normalized_start = normalize_iso_date(start_date)
    if normalized_start is None:
        raise ValueError("start_date must be YYYY-MM-DD")
    normalized_end = normalize_iso_date(end_date) or add_days_to_iso_date(normalized_start, 14)
    if normalized_start > normalized_end:
        raise ValueError("start_date must be on or before end_date.")

    if fixture_mode(env):
        rows = [dict(event) for event in load_calendar_fixture_payload().get("events", [])]
    else:
        rows = fetch_rows(normalized_start, normalized_end)
    events = normalize_earnings_calendar_rows(rows, start_date=normalized_start, end_date=normalized_end)
    return success_response(data={"events": events}, provider=CALENDAR_PROVIDER, retrieved_at=iso_timestamp())
