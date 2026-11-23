"""Official company and macro truth, with their canonical events.

Copied from apps/data-openbb/src/service.py (keep tested logic):
_official_source_reference, _build_canonical_event, the macro registry and default
fixture, the fixture loaders, and OpenBBLiveClient.fetch_official_company_truth (SEC EDGAR).
Live official macro was already the deterministic default fixture in the old service.
"""

from __future__ import annotations

import csv
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Mapping
from urllib.error import URLError
from urllib.request import Request, urlopen

from retry import RateLimiter
from schema_check import validate_schema
from source_common import (
    FIXTURE_ROOT,
    ProviderIntegrationError,
    fixture_mode,
    iso_timestamp,
    load_json_fixture,
    normalize_iso_date,
    success_response,
)

OFFICIAL_COMPANY_PROVIDER = "sec_edgar"
OFFICIAL_MACRO_PROVIDER = "official_public_macro"
OFFICIAL_COMPANY_FIXTURE_ROOT = FIXTURE_ROOT / "official" / "company"
OFFICIAL_MACRO_FIXTURE_ROOT = FIXTURE_ROOT / "official" / "macro"
UNIVERSE_CSV = FIXTURE_ROOT / "sp500_universe.csv"

# SEC fair access allows at most 10 requests a second; pace below that by default.
SEC_LIMITER = RateLimiter(
    per_minute=300,
    min_interval_seconds=float(os.environ.get("SEC_MIN_REQUEST_INTERVAL_SECONDS", "0.15")),
)

OFFICIAL_MACRO_REGISTRY: list[dict[str, str]] = [
    {
        "registry_id": "TREASURY_DAILY_10Y",
        "source_family": "treasury",
        "agency": "U.S. Treasury",
        "source_name": "Daily Treasury Rates - 10 Yr",
        "source_url": "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_rates",
        "agency_series_id": "daily_treasury_rates:10 Yr",
        "unit": "percent",
        "category": "rates",
    },
    {
        "registry_id": "TREASURY_DAILY_2Y",
        "source_family": "treasury",
        "agency": "U.S. Treasury",
        "source_name": "Daily Treasury Rates - 2 Yr",
        "source_url": "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_rates",
        "agency_series_id": "daily_treasury_rates:2 Yr",
        "unit": "percent",
        "category": "rates",
    },
    {
        "registry_id": "BLS_CPI_U_ALL_ITEMS",
        "source_family": "bls",
        "agency": "BLS",
        "source_name": "CPI-U All Items",
        "source_url": "https://api.bls.gov/publicAPI/v2/timeseries/data/CUUR0000SA0",
        "agency_series_id": "CUUR0000SA0",
        "unit": "index",
        "category": "inflation",
    },
    {
        "registry_id": "BLS_UNEMPLOYMENT_RATE",
        "source_family": "bls",
        "agency": "BLS",
        "source_name": "Unemployment Rate",
        "source_url": "https://api.bls.gov/publicAPI/v2/timeseries/data/LNS14000000",
        "agency_series_id": "LNS14000000",
        "unit": "percent",
        "category": "labor",
    },
    {
        "registry_id": "BEA_REAL_GDP",
        "source_family": "bea",
        "agency": "BEA",
        "source_name": "Real Gross Domestic Product",
        "source_url": "https://apps.bea.gov/api/data/",
        "agency_series_id": "NIPA:REAL_GDP",
        "unit": "annualized_percent",
        "category": "growth",
    },
    {
        "registry_id": "EIA_WTI_SPOT",
        "source_family": "eia",
        "agency": "EIA",
        "source_name": "WTI Spot Price",
        "source_url": "https://api.eia.gov/v2/seriesid/PET.RWTC.D",
        "agency_series_id": "PET.RWTC.D",
        "unit": "usd_per_barrel",
        "category": "energy",
    },
]


# ---------------------------------------------------------------- coverage universe


def normalize_ticker(value: str) -> str:
    return str(value).strip().upper().replace(".", "-")


def load_coverage_ciks(env: Mapping[str, str] | None = None, path: Path = UNIVERSE_CSV) -> dict[str, str]:
    """Ticker -> 10-digit CIK from the S&P 500 universe, narrowed by COVERAGE_TICKERS."""
    values = os.environ if env is None else env
    override = str(values.get("COVERAGE_UNIVERSE_CSV", "")).strip()
    csv_path = Path(override) if override else path
    if not csv_path.exists():
        return {}
    only = {normalize_ticker(item) for item in str(values.get("COVERAGE_TICKERS", "")).split(",") if item.strip()}
    result: dict[str, str] = {}
    with csv_path.open("r", encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            ticker = normalize_ticker(row.get("ticker", ""))
            cik = str(row.get("cik", "")).strip().zfill(10)
            if ticker and (not only or ticker in only):
                result[ticker] = cik
    return result


# ---------------------------------------------------------------- builders (copied)


def _quarter_period_for_iso_date(value: str) -> str:
    parsed = datetime.strptime(value, "%Y-%m-%d")
    quarter = ((parsed.month - 1) // 3) + 1
    return f"{parsed.year}-Q{quarter}"


def _resolved_as_of_date(value: str | None) -> str:
    return normalize_iso_date(value) or datetime.now().date().isoformat()


def official_source_reference(
    *,
    source_id: str,
    source_family: str,
    source_name: str,
    source_url: str,
    agency: str,
    agency_series_id: str | None = None,
) -> dict[str, Any]:
    source = {
        "source_id": source_id,
        "source_family": source_family,
        "source_name": source_name,
        "source_url": source_url,
        "agency": agency,
    }
    if agency_series_id:
        source["agency_series_id"] = agency_series_id
    validate_schema("official-source-reference", source)
    return source


def official_retrieval_metadata(
    *,
    source: dict[str, Any],
    retrieved_at: str,
    retrieval_status: str = "fresh",
    source_period: str | None = None,
) -> dict[str, Any]:
    metadata: dict[str, Any] = {"source": source, "retrieved_at": retrieved_at, "retrieval_status": retrieval_status}
    if source_period:
        metadata["source_period"] = source_period
    validate_schema("official-retrieval-metadata", metadata)
    return metadata


def missing_field(field: str, reason: str, message: str, *, source_id: str | None = None) -> dict[str, Any]:
    missing = {"field": field, "reason": reason, "message": message}
    if source_id:
        missing["source_id"] = source_id
    validate_schema("official-missing-field-state", missing)
    return missing


def iso_datetime_from_date(value: str | None) -> str:
    normalized = normalize_iso_date(value)
    if normalized:
        return f"{normalized}T00:00:00.000Z"
    return iso_timestamp()


def build_canonical_event(
    *,
    event_id: str,
    family: str,
    subject_type: str,
    subject_id: str,
    title: str,
    occurred_at: str,
    source_state: str,
    source: dict[str, Any],
    retrieved_at: str,
    missing_fields: list[dict[str, Any]] | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    event = {
        "id": event_id,
        "family": family,
        "subject_type": subject_type,
        "subject_id": subject_id,
        "title": title,
        "occurred_at": occurred_at,
        "source_state": source_state,
        "source": source,
        "retrieved_at": retrieved_at,
        "missing_fields": missing_fields or [],
        "metadata": metadata or {},
    }
    validate_schema("canonical-event", event)
    return event


def official_company_default_fixture(ticker: str, ciks: Mapping[str, str]) -> dict[str, Any]:
    cik = ciks.get(ticker)
    retrieved_at = iso_timestamp()
    sec_source = official_source_reference(
        source_id=f"SEC_COMPANY_{ticker}",
        source_family="sec_edgar",
        source_name=f"SEC EDGAR company truth for {ticker}",
        source_url=f"https://data.sec.gov/submissions/CIK{cik}.json" if cik else "https://data.sec.gov/submissions/",
        agency="SEC",
        agency_series_id=f"CIK{cik}" if cik else None,
    )
    retrieval = official_retrieval_metadata(
        source=sec_source, retrieved_at=retrieved_at, retrieval_status="partial" if cik is None else "fresh"
    )
    missing_fields = []
    if cik is None:
        missing_fields.append(
            missing_field(
                "cik",
                "outside_seed_scope",
                f"{ticker} is outside the M1 official company seed scope.",
                source_id=sec_source["source_id"],
            )
        )
    event = build_canonical_event(
        event_id=f"official-company-{ticker.lower()}-seed",
        family="filing_posted",
        subject_type="ticker",
        subject_id=ticker,
        title=f"{ticker} official SEC seed record",
        occurred_at=retrieved_at,
        source_state="partial" if missing_fields else "official",
        source=retrieval,
        retrieved_at=retrieved_at,
        missing_fields=missing_fields,
        metadata={"ticker": ticker, "cik": cik, "fixture": True},
    )
    return {
        "ticker": ticker,
        "cik": cik or "",
        "company_name": ticker,
        "retrieved_at": retrieved_at,
        "retrieval": retrieval,
        "missing_fields": missing_fields,
        "filings": [],
        "facts": {},
        "canonical_events": [event],
    }


def official_macro_default_fixture(*, as_of: str | None = None) -> dict[str, Any]:
    replay_as_of = _resolved_as_of_date(as_of)
    retrieved_at = iso_timestamp()
    observations: list[dict[str, Any]] = []
    events: list[dict[str, Any]] = []
    values_by_key = {
        "TREASURY_DAILY_10Y": 4.18,
        "TREASURY_DAILY_2Y": 4.83,
        "BLS_CPI_U_ALL_ITEMS": 312.23,
        "BLS_UNEMPLOYMENT_RATE": 4.0,
        "BEA_REAL_GDP": 2.1,
        "EIA_WTI_SPOT": 79.42,
    }
    period_by_key = {"BEA_REAL_GDP": _quarter_period_for_iso_date(replay_as_of)}

    for item in OFFICIAL_MACRO_REGISTRY:
        registry_id = str(item["registry_id"])
        period = period_by_key.get(registry_id, replay_as_of)
        source = official_source_reference(
            source_id=registry_id,
            source_family=item["source_family"],
            source_name=item["source_name"],
            source_url=item["source_url"],
            agency=item["agency"],
            agency_series_id=item["agency_series_id"],
        )
        retrieval = official_retrieval_metadata(
            source=source, retrieved_at=retrieved_at, retrieval_status="fresh", source_period=period
        )
        value = values_by_key.get(registry_id)
        missing_fields = []
        if value is None:
            missing_fields.append(
                missing_field("value", "source_unavailable", f"{registry_id} has no fixture value.", source_id=registry_id)
            )
        observations.append(
            {
                "registry_id": registry_id,
                "value": value,
                "unit": item["unit"],
                "period": period,
                "category": item["category"],
                "retrieval": retrieval,
                "missing_fields": missing_fields,
            }
        )
        events.append(
            build_canonical_event(
                event_id=f"official-macro-{registry_id.lower()}-{period.lower()}",
                family="macro_release_published",
                subject_type="macro_series",
                subject_id=registry_id,
                title=f"{item['source_name']} official observation published",
                occurred_at=iso_datetime_from_date(period if len(period) == 10 else None),
                source_state="partial" if missing_fields else "official",
                source=retrieval,
                retrieved_at=retrieved_at,
                missing_fields=missing_fields,
                metadata={
                    "registry_id": registry_id,
                    "category": item["category"],
                    "unit": item["unit"],
                    "period": period,
                    "fixture": True,
                },
            )
        )

    return {
        "scope": "daily",
        "retrieved_at": retrieved_at,
        "observations": observations,
        "missing_fields": [],
        "canonical_events": events,
    }


def fixture_official_company_payload(ticker: str, ciks: Mapping[str, str]) -> dict[str, Any]:
    fixture = load_json_fixture(
        OFFICIAL_COMPANY_FIXTURE_ROOT / f"{ticker}.json",
        default_factory=lambda: official_company_default_fixture(ticker, ciks),
    )
    if "retrieved_at" not in fixture:
        fixture["retrieved_at"] = iso_timestamp()
    for missing in fixture.get("missing_fields", []):
        if isinstance(missing, dict):
            validate_schema("official-missing-field-state", missing)
    retrieval = fixture.get("retrieval")
    if isinstance(retrieval, dict):
        validate_schema("official-retrieval-metadata", retrieval)
    for event in fixture.get("canonical_events", []):
        if isinstance(event, dict):
            validate_schema("canonical-event", event)
    return fixture


def fixture_official_macro_payload(*, as_of: str | None = None) -> dict[str, Any]:
    fixture = load_json_fixture(
        OFFICIAL_MACRO_FIXTURE_ROOT / "daily.json",
        default_factory=lambda: official_macro_default_fixture(as_of=as_of),
    )
    replay_as_of = _resolved_as_of_date(as_of)
    if "retrieved_at" not in fixture:
        fixture["retrieved_at"] = iso_timestamp()
    for observation in fixture.get("observations", []):
        if isinstance(observation, dict):
            if isinstance(observation.get("period"), str):
                observation["period"] = (
                    _quarter_period_for_iso_date(replay_as_of)
                    if str(observation.get("registry_id")) == "BEA_REAL_GDP"
                    else replay_as_of
                )
            retrieval = observation.get("retrieval")
            if isinstance(retrieval, dict):
                retrieval["source_period"] = str(observation.get("period") or replay_as_of)
    for observation in fixture.get("observations", []):
        if not isinstance(observation, dict):
            continue
        retrieval = observation.get("retrieval")
        if isinstance(retrieval, dict):
            validate_schema("official-retrieval-metadata", retrieval)
        for missing in observation.get("missing_fields", []):
            if isinstance(missing, dict):
                validate_schema("official-missing-field-state", missing)
    for event in fixture.get("canonical_events", []):
        if isinstance(event, dict):
            metadata = event.get("metadata")
            if isinstance(metadata, dict):
                if str(metadata.get("registry_id")) == "BEA_REAL_GDP":
                    metadata["period"] = _quarter_period_for_iso_date(replay_as_of)
                else:
                    metadata["period"] = replay_as_of
            event["occurred_at"] = iso_datetime_from_date(replay_as_of)
            validate_schema("canonical-event", event)
    return fixture


# ---------------------------------------------------------------- live SEC (copied)


def _sec_fetch_json(url: str, *, headers: Mapping[str, str]) -> dict[str, Any]:
    SEC_LIMITER.acquire()
    request = Request(url, headers=dict(headers))
    with urlopen(request, timeout=15) as response:  # noqa: S310 - fixed SEC host
        payload = json.loads(response.read().decode("utf-8"))
        if not isinstance(payload, dict):
            raise OSError("official source returned a non-object JSON payload")
        return payload


FetchJson = Callable[..., dict[str, Any]]


def live_official_company_truth(
    ticker: str, ciks: Mapping[str, str], *, fetch_json: FetchJson = _sec_fetch_json
) -> dict[str, Any]:
    cik = ciks.get(ticker)
    if not cik:
        return official_company_default_fixture(ticker, ciks)

    headers = {
        "user-agent": os.environ.get("SEC_USER_AGENT", "Thesis Phase6 official-source smoke contact@example.com"),
        "accept": "application/json",
    }
    retrieved_at = iso_timestamp()
    submissions_url = f"https://data.sec.gov/submissions/CIK{cik}.json"
    facts_url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
    try:
        submissions = fetch_json(submissions_url, headers=headers)
        facts = fetch_json(facts_url, headers=headers)
    except (OSError, URLError, TimeoutError, ValueError) as error:
        raise ProviderIntegrationError(
            OFFICIAL_COMPANY_PROVIDER,
            error_code="PROVIDER_OUTAGE",
            message="SEC EDGAR official company truth is unavailable.",
        ) from error

    company_name = str(submissions.get("name") or ticker)
    filings_root = submissions.get("filings")
    recent = filings_root.get("recent", {}) if isinstance(filings_root, dict) else {}
    forms = recent.get("form", []) if isinstance(recent, dict) else []
    filing_dates = recent.get("filingDate", []) if isinstance(recent, dict) else []
    accession_numbers = recent.get("accessionNumber", []) if isinstance(recent, dict) else []
    filings: list[dict[str, Any]] = []
    for index, form in enumerate(forms if isinstance(forms, list) else []):
        if not isinstance(form, str):
            continue
        filing_date = filing_dates[index] if isinstance(filing_dates, list) and index < len(filing_dates) else None
        accession = (
            accession_numbers[index] if isinstance(accession_numbers, list) and index < len(accession_numbers) else None
        )
        filings.append(
            {
                "form": form,
                "filing_date": str(filing_date) if filing_date else "",
                "accession_number": str(accession) if accession else "",
            }
        )
        if len(filings) >= 5:
            break

    source = official_source_reference(
        source_id=f"SEC_COMPANY_{ticker}",
        source_family="sec_edgar",
        source_name=f"SEC EDGAR company truth for {ticker}",
        source_url=submissions_url,
        agency="SEC",
        agency_series_id=f"CIK{cik}",
    )
    retrieval = official_retrieval_metadata(
        source=source, retrieved_at=retrieved_at, retrieval_status="fresh" if filings else "partial"
    )
    missing_fields = []
    if not filings:
        missing_fields.append(
            missing_field(
                "filings",
                "not_reported",
                "SEC submissions did not include recent filing rows.",
                source_id=source["source_id"],
            )
        )
    event = build_canonical_event(
        event_id=f"official-company-{ticker.lower()}-{filings[0]['accession_number'] if filings else 'latest'}",
        family="filing_posted",
        subject_type="ticker",
        subject_id=ticker,
        title=f"{ticker} latest SEC filing",
        occurred_at=iso_datetime_from_date(filings[0].get("filing_date") if filings else None),
        source_state="official" if filings else "partial",
        source=retrieval,
        retrieved_at=retrieved_at,
        missing_fields=missing_fields,
        metadata={
            "ticker": ticker,
            "cik": cik,
            "company_name": company_name,
            "latest_form": filings[0].get("form") if filings else None,
            "accession_number": filings[0].get("accession_number") if filings else None,
        },
    )
    facts_root = facts.get("facts")
    return {
        "ticker": ticker,
        "cik": cik,
        "company_name": company_name,
        "retrieved_at": retrieved_at,
        "retrieval": retrieval,
        "missing_fields": missing_fields,
        "filings": filings,
        "facts": {
            "entity_name": facts.get("entityName"),
            "cik": facts.get("cik"),
            "taxonomy_count": len(facts_root) if isinstance(facts_root, dict) else 0,
        },
        "canonical_events": [event],
    }


# ---------------------------------------------------------------- old route bodies


def official_company_response(
    ticker: str, *, env: Mapping[str, str] | None = None, fetch_json: FetchJson = _sec_fetch_json
) -> dict[str, Any]:
    """The body of the old GET /v1/official/company?ticker=..."""
    normalized = ticker.strip().upper()
    ciks = load_coverage_ciks(env)
    if fixture_mode(env):
        payload = fixture_official_company_payload(normalized, ciks)
    else:
        payload = live_official_company_truth(normalized, ciks, fetch_json=fetch_json)
    return success_response(data=payload, provider=OFFICIAL_COMPANY_PROVIDER, retrieved_at=str(payload["retrieved_at"]))


def official_macro_response(*, as_of: str | None = None, env: Mapping[str, str] | None = None) -> dict[str, Any]:
    """The body of the old GET /v1/official/macro?scope=daily (&as_of=...)."""
    normalized_as_of = normalize_iso_date(as_of)
    if fixture_mode(env):
        payload = fixture_official_macro_payload(as_of=normalized_as_of)
    else:
        payload = official_macro_default_fixture(as_of=normalized_as_of)
    return success_response(data=payload, provider=OFFICIAL_MACRO_PROVIDER, retrieved_at=str(payload["retrieved_at"]))


def extract_canonical_events(payload: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Port of extractCanonicalEvents in apps/scheduler/src/server.ts."""
    data = payload.get("data")
    if not isinstance(data, dict):
        return []
    events = data.get("canonical_events")
    if not isinstance(events, list):
        return []
    return [event for event in events if isinstance(event, dict)]
