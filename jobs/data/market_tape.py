"""Daily market tape: the body of the old data-openbb GET /v1/market/tape?scope=daily&as_of=...

Copied from apps/data-openbb/src/service.py (keep tested logic): MARKET_TAPE_SERIES, _market_tape_move,
_market_tape_omission, _summarize_market_tape, _market_tape_default_fixture and
OpenBBLiveClient.fetch_market_tape / _fetch_fred_series_pair. The old fixture file
(data/golden/data-openbb/market-tape/daily.json) never existed, so fixture mode always used the default fixture.
"""

from __future__ import annotations

import re
from typing import Any, Callable, Mapping
from urllib.error import URLError
from urllib.request import Request, urlopen

from joblog import log
from official import official_retrieval_metadata, official_source_reference
from schema_check import validate_schema
from source_common import (
    fixture_mode,
    iso_timestamp,
    normalize_iso_date,
    success_response,
)
from market_time import new_york_today

MARKET_TAPE_PROVIDER = "market_tape"

MARKET_TAPE_SERIES: list[dict[str, Any]] = [
    {"instrument_id": "SP500", "label": "S&P 500", "family": "core_index", "series_id": "SP500", "unit": "index"},
    {
        "instrument_id": "DJIA",
        "label": "Dow Jones Industrial Average",
        "family": "core_index",
        "series_id": "DJIA",
        "unit": "index",
    },
    {
        "instrument_id": "NASDAQCOM",
        "label": "Nasdaq Composite",
        "family": "core_index",
        "series_id": "NASDAQCOM",
        "unit": "index",
    },
    {"instrument_id": "RUSSELL2000", "label": "Russell 2000", "family": "core_index", "series_id": None, "unit": "index"},
    {"instrument_id": "VIXCLS", "label": "VIX", "family": "volatility", "series_id": "VIXCLS", "unit": "index"},
    {"instrument_id": "DGS10", "label": "Treasury 10Y", "family": "rates", "series_id": "DGS10", "unit": "percent"},
    {"instrument_id": "DGS2", "label": "Treasury 2Y", "family": "rates", "series_id": "DGS2", "unit": "percent"},
    {
        "instrument_id": "DCOILWTICO",
        "label": "WTI",
        "family": "commodity",
        "series_id": "DCOILWTICO",
        "unit": "usd_per_barrel",
    },
    {
        "instrument_id": "DTWEXBGS",
        "label": "Nominal Broad Dollar Index",
        "family": "currency",
        "series_id": "DTWEXBGS",
        "unit": "index",
    },
    {
        "instrument_id": "BAMLH0A0HYM2",
        "label": "US High Yield OAS",
        "family": "credit",
        "series_id": "BAMLH0A0HYM2",
        "unit": "percent",
    },
]
MARKET_TAPE_HTML_ROW_PATTERN = re.compile(r"#(?P<date>\d{4}-\d{2}-\d{2})\|(?P<value>[^\r\n<]+)")

FetchText = Callable[[str], str]


def resolved_as_of_date(value: str | None) -> str:
    # The old service used the server's "today"; the job runs in New York time.
    return normalize_iso_date(value) or new_york_today().isoformat()


def _market_tape_retrieval(*, instrument_id: str, label: str, series_id: str, retrieved_at: str, period: str) -> dict[str, Any]:
    return official_retrieval_metadata(
        source=official_source_reference(
            source_id=f"FRED_{instrument_id}",
            source_family="fred",
            source_name=f"FRED {label}",
            source_url=f"https://fred.stlouisfed.org/series/{series_id}",
            agency="Federal Reserve Bank of St. Louis",
            agency_series_id=series_id,
        ),
        retrieved_at=retrieved_at,
        retrieval_status="fresh",
        source_period=period,
    )


def market_tape_move(
    *,
    instrument_id: str,
    label: str,
    family: str,
    period: str,
    retrieved_at: str,
    series_id: str,
    value: float,
    previous_value: float,
    unit: str,
) -> dict[str, Any]:
    daily_change = round(value - previous_value, 4)
    daily_change_pct = 0.0 if previous_value == 0 else round((daily_change / previous_value) * 100, 4)
    if abs(daily_change) < 0.0001:
        direction = "flat"
    else:
        direction = "up" if daily_change > 0 else "down"
    return {
        "instrument_id": instrument_id,
        "label": label,
        "family": family,
        "period": period,
        "value": round(value, 4),
        "previous_value": round(previous_value, 4),
        "daily_change": daily_change,
        "daily_change_pct": daily_change_pct,
        "unit": unit,
        "direction": direction,
        "retrieval": _market_tape_retrieval(
            instrument_id=instrument_id,
            label=label,
            series_id=series_id,
            retrieved_at=retrieved_at,
            period=period,
        ),
        "missing_fields": [],
    }


def market_tape_omission(
    *,
    omission_id: str,
    family: str,
    reason_code: str,
    reason_text: str,
    blocking: bool,
    instrument_id: str | None = None,
) -> dict[str, Any]:
    payload = {
        "omission_id": omission_id,
        "family": family,
        "reason_code": reason_code,
        "reason_text": reason_text,
        "blocking": blocking,
    }
    if instrument_id:
        payload["instrument_id"] = instrument_id
    return payload


def summarize_market_tape(
    *,
    indices: list[dict[str, Any]],
    cross_asset: list[dict[str, Any]],
    sector_leadership: dict[str, Any] | None,
    omissions: list[dict[str, Any]],
) -> str:
    core_indices = [entry for entry in indices if str(entry.get("family")) == "core_index"]
    up_count = sum(1 for entry in core_indices if str(entry.get("direction")) == "up")
    down_count = sum(1 for entry in core_indices if str(entry.get("direction")) == "down")
    if core_indices and max(up_count, down_count) >= 3:
        broad_read = "broadly higher" if up_count > down_count else "broadly lower"
    elif core_indices:
        broad_read = "mixed"
    else:
        broad_read = "incomplete"

    quiet_day = all(abs(float(entry.get("daily_change_pct") or 0.0)) < 0.35 for entry in core_indices)
    if core_indices and quiet_day and not sector_leadership and len(cross_asset) == 0:
        return "There was no material tape shift across the available market-tape inputs."

    first_sentence = (
        f"US risk assets were {broad_read} on the day."
        if broad_read != "incomplete"
        else "Tape coverage was incomplete in this cycle."
    )

    leadership_sentence = "Sector leadership was unavailable in the approved free path for this run."
    if sector_leadership:
        leaders = ", ".join(entry["label"] for entry in sector_leadership.get("leaders", [])[:3])
        laggards = ", ".join(entry["label"] for entry in sector_leadership.get("laggards", [])[:3])
        leadership_sentence = f"Sector leaders were {leaders}; laggards were {laggards}."

    cross_asset_parts: list[str] = []
    for entry in cross_asset[:4]:
        label = str(entry.get("label") or entry.get("instrument_id") or "Cross asset")
        direction = str(entry.get("direction") or "flat")
        move = float(entry.get("daily_change") or 0.0)
        cross_asset_parts.append(f"{label} {direction} by {abs(move):.2f}")
    cross_asset_sentence = (
        f"Cross-asset context: {'; '.join(cross_asset_parts)}."
        if cross_asset_parts
        else "Cross-asset context was limited in this cycle."
    )

    omission_sentence = ""
    if omissions:
        omission_sentence = f"Coverage note: {omissions[0]['reason_text']}"

    return " ".join(
        sentence
        for sentence in [first_sentence, leadership_sentence, cross_asset_sentence, omission_sentence]
        if sentence
    )


# (instrument_id, label, family, series_id, value, previous_value, unit) of the old default fixture.
_FIXTURE_INDICES = [
    ("SP500", "S&P 500", "core_index", "SP500", 5484.77, 5375.86, "index"),
    ("DJIA", "Dow Jones Industrial Average", "core_index", "DJIA", 40143.89, 39606.57, "index"),
    ("NASDAQCOM", "Nasdaq Composite", "core_index", "NASDAQCOM", 17122.44, 16708.05, "index"),
    ("RUSSELL2000", "Russell 2000", "core_index", "RUSSELL2000", 2024.15, 1987.66, "index"),
]
_FIXTURE_CROSS_ASSET = [
    ("VIXCLS", "VIX", "volatility", "VIXCLS", 17.43, 18.21, "index"),
    ("DGS10", "Treasury 10Y", "rates", "DGS10", 4.29, 4.40, "percent"),
    ("DGS2", "Treasury 2Y", "rates", "DGS2", 4.74, 4.83, "percent"),
    ("DCOILWTICO", "WTI", "commodity", "DCOILWTICO", 79.42, 81.12, "usd_per_barrel"),
    ("DTWEXBGS", "Nominal Broad Dollar Index", "currency", "DTWEXBGS", 124.28, 123.74, "index"),
    ("BAMLH0A0HYM2", "US High Yield OAS", "credit", "BAMLH0A0HYM2", 3.64, 3.57, "percent"),
]
_FIXTURE_LEADERS = [
    ("XLE", "XLE", "sector", "XLE", 91.37, 88.63, "usd"),
    ("XLK", "XLK", "sector", "XLK", 214.55, 209.94, "usd"),
    ("XLY", "XLY", "sector", "XLY", 183.41, 180.82, "usd"),
]
_FIXTURE_LAGGARDS = [
    ("XLU", "XLU", "sector", "XLU", 66.12, 66.55, "usd"),
    ("XLP", "XLP", "sector", "XLP", 79.02, 79.44, "usd"),
    ("XLV", "XLV", "sector", "XLV", 145.73, 146.52, "usd"),
]


def market_tape_default_fixture(*, as_of: str | None = None) -> dict[str, Any]:
    replay_as_of = resolved_as_of_date(as_of)
    retrieved_at = iso_timestamp()

    def moves(rows: list[tuple[str, str, str, str, float, float, str]]) -> list[dict[str, Any]]:
        return [
            market_tape_move(
                instrument_id=instrument_id,
                label=label,
                family=family,
                period=replay_as_of,
                retrieved_at=retrieved_at,
                series_id=series_id,
                value=value,
                previous_value=previous_value,
                unit=unit,
            )
            for instrument_id, label, family, series_id, value, previous_value, unit in rows
        ]

    indices = moves(_FIXTURE_INDICES)
    cross_asset = moves(_FIXTURE_CROSS_ASSET)
    leaders = moves(_FIXTURE_LEADERS)
    laggards = moves(_FIXTURE_LAGGARDS)
    sector_leadership = {
        "basket_id": "spdr_sector_etfs",
        "leaders": leaders,
        "laggards": laggards,
        "spread_pct": round(float(leaders[0]["daily_change_pct"]) - float(laggards[-1]["daily_change_pct"]), 4),
        "notable": True,
        "note": "Leadership derived from the reviewed sector ETF basket.",
    }
    payload = {
        "as_of": replay_as_of,
        "coverage_state": "full",
        "summary": summarize_market_tape(
            indices=indices,
            cross_asset=cross_asset,
            sector_leadership=sector_leadership,
            omissions=[],
        ),
        "indices": indices,
        "sector_leadership": sector_leadership,
        "cross_asset": cross_asset,
        "retrievals": [entry["retrieval"] for entry in indices + cross_asset + leaders + laggards],
        "omissions": [],
    }
    validate_schema("market-tape", payload)
    return payload


def _fred_text(url: str) -> str:
    request = Request(
        url,
        headers={"user-agent": "Thesis Phase7 market-tape fetch", "accept": "text/html,text/plain"},
    )
    with urlopen(request, timeout=20) as response:  # noqa: S310 - fixed https FRED URL
        return response.read().decode("utf-8", errors="ignore")


def fetch_fred_series_pair(
    series_id: str, as_of: str, fetch_text: FetchText = _fred_text
) -> tuple[float | None, float | None, str | None]:
    body = fetch_text(f"https://fred.stlouisfed.org/data/{series_id}.txt")
    matches = []
    for match in MARKET_TAPE_HTML_ROW_PATTERN.finditer(body):
        date_value = match.group("date")
        raw_value = match.group("value").strip()
        if raw_value in {".", ""}:
            continue
        try:
            value = float(raw_value)
        except ValueError:
            continue
        if date_value <= as_of:
            matches.append((date_value, value))

    if len(matches) < 2:
        return None, None, None

    matches.sort(key=lambda entry: entry[0])
    period, current = matches[-1]
    _, previous = matches[-2]
    return current, previous, period


def live_market_tape(*, as_of: str | None = None, fetch_text: FetchText = _fred_text) -> dict[str, Any]:
    replay_as_of = resolved_as_of_date(as_of)
    retrieved_at = iso_timestamp()
    indices: list[dict[str, Any]] = []
    cross_asset: list[dict[str, Any]] = []
    omissions: list[dict[str, Any]] = []

    for item in MARKET_TAPE_SERIES:
        instrument_id = str(item["instrument_id"])
        label = str(item["label"])
        family = str(item["family"])
        series_id = item.get("series_id")
        if not isinstance(series_id, str) or not series_id.strip():
            omissions.append(
                market_tape_omission(
                    omission_id=f"{instrument_id.lower()}-omitted",
                    family=family,
                    instrument_id=instrument_id,
                    reason_code="source_unavailable",
                    reason_text=f"{label} is not available in the approved free live path for this run.",
                    blocking=family == "core_index",
                )
            )
            continue

        try:
            current, previous, period = fetch_fred_series_pair(series_id, replay_as_of, fetch_text)
        except (OSError, URLError, TimeoutError) as error:
            omissions.append(
                market_tape_omission(
                    omission_id=f"{instrument_id.lower()}-fetch-failed",
                    family=family,
                    instrument_id=instrument_id,
                    reason_code="source_unavailable",
                    reason_text=f"FRED retrieval failed for {label}.",
                    blocking=family == "core_index",
                )
            )
            log("WARN", "Market tape series retrieval failed", instrument_id=instrument_id,
                error_type=type(error).__name__)
            continue
        if current is None or previous is None or period is None:
            omissions.append(
                market_tape_omission(
                    omission_id=f"{instrument_id.lower()}-missing",
                    family=family,
                    instrument_id=instrument_id,
                    reason_code="not_reported",
                    reason_text=f"FRED returned no usable {label} pair for {replay_as_of}.",
                    blocking=family == "core_index",
                )
            )
            continue

        move = market_tape_move(
            instrument_id=instrument_id,
            label=label,
            family=family,
            period=period,
            retrieved_at=retrieved_at,
            series_id=series_id,
            value=current,
            previous_value=previous,
            unit=str(item["unit"]),
        )
        if family == "core_index":
            indices.append(move)
        else:
            cross_asset.append(move)

    omissions.append(
        market_tape_omission(
            omission_id="sector-basket-free-path-unavailable",
            family="sector",
            reason_code="source_unavailable",
            reason_text="Sector ETF leadership is not available in the approved free live path for this run.",
            blocking=False,
        )
    )

    coverage_state = "limited"
    if len(indices) >= 3 and len(cross_asset) >= 2:
        coverage_state = "partial"
    if len(indices) >= 4 and len(cross_asset) >= 4 and all(omission["family"] != "sector" for omission in omissions):
        coverage_state = "full"

    payload = {
        "as_of": replay_as_of,
        "coverage_state": coverage_state,
        "summary": summarize_market_tape(
            indices=indices,
            cross_asset=cross_asset,
            sector_leadership=None,
            omissions=omissions,
        ),
        "indices": indices,
        "cross_asset": cross_asset,
        "retrievals": [entry["retrieval"] for entry in indices + cross_asset],
        "omissions": omissions,
    }
    validate_schema("market-tape", payload)
    return payload


def market_tape_response(
    *, as_of: str | None = None, env: Mapping[str, str] | None = None, fetch_text: FetchText = _fred_text
) -> dict[str, Any]:
    """The body of the old GET /v1/market/tape?scope=daily&as_of=..."""
    normalized_as_of = normalize_iso_date(as_of)
    if fixture_mode(env):
        payload = market_tape_default_fixture(as_of=normalized_as_of)
    else:
        payload = live_market_tape(as_of=normalized_as_of, fetch_text=fetch_text)
    return success_response(data=payload, provider=MARKET_TAPE_PROVIDER, retrieved_at=iso_timestamp())

