"""Pulse issue: fetch what the old product-api fetched for a Market Pulse build and send it in one call.

POST /internal/pulse/dispatch {cycle_start, cycle_end, inputs}. The cycle window comes from
jobs/daily/daily_steps.py (pulse_cycle_window, yesterday 06:30 New York to now). Each input is the exact body
the old server got from data-openbb or news-ingest for that build (as_of = the cycle_end date, like the old
report builder):

- market_tape: GET /v1/market/tape?scope=daily&as_of=...          (market_tape.py)
- macro: GET /v1/official/macro?scope=daily&as_of=...              (official.py)
- structural: GET /v1/official/structural?country=US&subject_type=market_pulse&as_of=...  (structural.py)
- companies[T]: GET /v1/official/company?ticker=T                  (official.py)
- first_party[T]: POST news-ingest /v1/first-party/context          (first_party.py)
- news: GET news-ingest /v1/news?date=...                           (news_ingest.py)
- calendar_events: data.events of POST /internal/calendar/earnings {as_of, as_of + 7 days}  (earnings_calendar.py)

A source that fails becomes an error envelope ({ok: false, error_message: "HTTP <status>"}), which is what the
old fetchEnvelope saw for a failed call, so the api takes the same "data_unavailable" path. A failed calendar is
left out (the api then marks the calendar unavailable, as before). The api builds and stores the issue inside the
request, so the answer arrives after the build. A job that comes back "failed" fails this step.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Mapping

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "daily"))

from api_client import ApiClient  # noqa: E402
from daily_steps import pulse_cycle_window  # noqa: E402
from earnings_calendar import calendar_earnings_response  # noqa: E402
from first_party import FIRST_PARTY_CONTEXT_SOURCE_BY_TICKER, first_party_context_response  # noqa: E402
from joblog import log  # noqa: E402
from market_tape import market_tape_response  # noqa: E402
from news_ingest import news_response  # noqa: E402
from official import official_company_response, official_macro_response  # noqa: E402
from script_main import EXIT_FAILED, EXIT_OK, run  # noqa: E402
from source_common import ProviderIntegrationError, add_days_to_iso_date, fixture_mode  # noqa: E402
from structural import structural_response  # noqa: E402

ROUTE = "/internal/pulse/dispatch"
DEFAULT_TICKERS = ("AAPL", "MSFT", "TSLA")
CALENDAR_WINDOW_DAYS = 7


def pulse_tickers(env: Mapping[str, str] | None = None) -> list[str]:
    """MARKET_PULSE_TICKERS, read the same way as the api (parseCsv of the old config)."""
    raw = (os.environ if env is None else env).get("MARKET_PULSE_TICKERS", "")
    parsed = [entry.strip().upper() for entry in raw.split(",") if entry.strip()]
    return parsed or list(DEFAULT_TICKERS)


def error_envelope(status: int, message: str | None = None) -> dict[str, Any]:
    # fetchEnvelope turned a non-2xx answer into "HTTP <status>"; the message is what the build records.
    return {"ok": False, "data": None, "error_flag": True, "error_message": message or f"HTTP {status}"}


def guarded(name: str, fetch: Callable[[], dict[str, Any]]) -> dict[str, Any]:
    """Runs one source. A failure becomes the envelope the old server would have seen."""
    try:
        return fetch()
    except ProviderIntegrationError as error:
        log("WARN", "Pulse input unavailable", source=name, error_code=error.error_code)
        return error_envelope(error.status_code)
    except Exception as error:  # one bad source must not stop the issue
        log("WARN", "Pulse input failed", source=name, error_type=type(error).__name__)
        return error_envelope(500)


def http_envelope(name: str, answer: tuple[int, dict[str, Any]]) -> dict[str, Any]:
    status, body = answer
    if status < 200 or status >= 300:
        log("WARN", "Pulse input unavailable", source=name, status=status)
        return error_envelope(status)
    return body


def build_inputs(as_of: str, tickers: list[str], env: Mapping[str, str] | None = None) -> dict[str, Any]:
    inputs: dict[str, Any] = {
        "market_tape": guarded("market_tape", lambda: market_tape_response(as_of=as_of, env=env)),
        "macro": guarded("macro", lambda: official_macro_response(as_of=as_of, env=env)),
        "structural": guarded("structural", lambda: structural_response(as_of=as_of, env=env)),
        "companies": {
            ticker: guarded(f"company:{ticker}", lambda ticker=ticker: official_company_response(ticker, env=env))
            for ticker in tickers
        },
        "first_party": {
            ticker: guarded(
                f"first_party:{ticker}",
                lambda ticker=ticker: http_envelope(
                    f"first_party:{ticker}",
                    first_party_context_response(ticker, FIRST_PARTY_CONTEXT_SOURCE_BY_TICKER[ticker], env=env),
                ),
            )
            for ticker in tickers
            if ticker in FIRST_PARTY_CONTEXT_SOURCE_BY_TICKER
        },
        "news": guarded("news", lambda: http_envelope("news", news_response(as_of, env=env))),
    }
    try:
        calendar = calendar_earnings_response(
            start_date=as_of, end_date=add_days_to_iso_date(as_of, CALENDAR_WINDOW_DAYS), env=env
        )
        inputs["calendar_events"] = calendar["data"]["events"]
    except Exception as error:  # the api marks the calendar unavailable when it is missing
        log("WARN", "Pulse calendar unavailable", error_type=type(error).__name__)
    return inputs


def build_body(now: datetime | None = None, env: Mapping[str, str] | None = None) -> dict[str, Any]:
    window = pulse_cycle_window(now or datetime.now(timezone.utc))
    as_of = window["cycle_end"][:10]
    return {**window, "inputs": build_inputs(as_of, pulse_tickers(env), env)}


def main(client: ApiClient | None = None, now: datetime | None = None, env: Mapping[str, str] | None = None) -> int:
    api = client or ApiClient.from_env(env)
    body = build_body(now, env)
    inputs = body["inputs"]
    failed_inputs = sorted(
        name for name, value in inputs.items() if isinstance(value, dict) and value.get("ok") is False
    )
    log("INFO", "Pulse inputs built", cycle_start=body["cycle_start"], cycle_end=body["cycle_end"],
        companies=len(inputs["companies"]), first_party=len(inputs["first_party"]),
        calendar_events=len(inputs.get("calendar_events", [])), failed_inputs=",".join(failed_inputs),
        fixture_mode=fixture_mode(env))
    response = api.post(ROUTE, body)
    job = response.body.get("job") if isinstance(response.body.get("job"), dict) else {}
    log("INFO", "Pulse dispatch answered", http_status=response.status,
        deduplicated=response.body.get("deduplicated"), job_id=job.get("job_id"), job_status=job.get("status"),
        report_id=job.get("report_id"))
    if job.get("status") == "failed":
        log("ERROR", "Pulse job failed", job_id=job.get("job_id"))
        return EXIT_FAILED
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(run("pulse", main))
