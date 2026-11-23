"""Structural country context: the body of the old data-openbb
GET /v1/official/structural?country=US&subject_type=market_pulse&as_of=...

Copied from apps/data-openbb/src/service.py (keep tested logic): the World Bank and IMF registries,
_structural_subject_metadata, _structural_observation, _structural_omission, _official_structural_default_fixture
and OpenBBLiveClient.fetch_official_structural_context. No structural fixture file existed, so fixture mode
always used the default fixture.
"""

from __future__ import annotations

import json
from typing import Any, Callable, Mapping
from urllib.error import URLError
from urllib.request import Request, urlopen

from market_tape import resolved_as_of_date
from official import official_retrieval_metadata, official_source_reference
from schema_check import validate_schema
from source_common import (
    ProviderIntegrationError,
    fixture_mode,
    iso_timestamp,
    normalize_iso_date,
    success_response,
)

OFFICIAL_STRUCTURAL_PROVIDER = "official_structural_context"


def _issuer(name: str, sector: str, industry: str) -> dict[str, str]:
    return {
        "name": name,
        "exchange": "NASDAQ",
        "currency": "USD",
        "domicile_country": "US",
        "region": "North America",
        "sector": sector,
        "industry": industry,
    }


STRUCTURAL_CONTEXT_TICKER_METADATA: dict[str, dict[str, str]] = {
    "AAPL": _issuer("Apple Inc.", "Technology", "Consumer Electronics"),
    "MSFT": _issuer("Microsoft Corporation", "Technology", "Software"),
    "TSLA": _issuer("Tesla, Inc.", "Consumer Discretionary", "Automobiles"),
    "NVDA": _issuer("NVIDIA Corporation", "Technology", "Semiconductors"),
    "AMZN": _issuer("Amazon.com, Inc.", "Consumer Discretionary", "Broadline Retail"),
    "META": _issuer("Meta Platforms, Inc.", "Communication Services", "Interactive Media and Services"),
    "GOOGL": _issuer("Alphabet Inc.", "Communication Services", "Interactive Media and Services"),
}
STRUCTURAL_CONTEXT_COUNTRY_METADATA: dict[str, dict[str, str]] = {
    "US": {"country_name": "United States", "country_code": "USA", "region": "North America"},
}
WORLD_BANK_STRUCTURAL_REGISTRY: list[dict[str, str]] = [
    {"family": "gdp_level", "label": "GDP level", "indicator": "NY.GDP.MKTP.CD", "unit": "usd"},
    {"family": "gdp_per_capita", "label": "GDP per capita", "indicator": "NY.GDP.PCAP.CD", "unit": "usd"},
    {"family": "population", "label": "Population", "indicator": "SP.POP.TOTL", "unit": "people"},
    {"family": "trade_openness", "label": "Trade openness", "indicator": "NE.TRD.GNFS.ZS", "unit": "pct_gdp"},
    {"family": "debt_context", "label": "Government debt context", "indicator": "GC.DOD.TOTL.GD.ZS", "unit": "pct_gdp"},
    {"family": "inequality", "label": "Gini inequality", "indicator": "SI.POV.GINI", "unit": "index"},
    {"family": "logistics", "label": "Logistics performance", "indicator": "LP.LPI.OVRL.XQ", "unit": "score"},
    {"family": "infrastructure", "label": "Secure internet servers", "indicator": "IT.NET.SECR.P6", "unit": "per_million"},
    {"family": "education", "label": "Tertiary enrollment", "indicator": "SE.TER.ENRR", "unit": "pct"},
    {"family": "energy_access", "label": "Energy access", "indicator": "EG.ELC.ACCS.ZS", "unit": "pct"},
    {"family": "sector_mix", "label": "Services share of GDP", "indicator": "NV.SRV.TOTL.ZS", "unit": "pct_gdp"},
]
IMF_STRUCTURAL_REGISTRY: list[dict[str, str]] = [
    {"family": "gdp_growth_outlook", "label": "GDP growth outlook"},
    {"family": "inflation_regime", "label": "Inflation outlook"},
    {"family": "fiscal_balance", "label": "Fiscal balance"},
    {"family": "public_debt", "label": "Public debt"},
    {"family": "fx_reserves", "label": "FX reserves"},
    {"family": "current_account", "label": "Current-account context"},
]

FetchJsonList = Callable[[str], list[Any]]


def structural_period_within_as_of(period: str, as_of: str) -> bool:
    if len(period) == 4 and period.isdigit():
        return int(period) <= int(as_of[:4])
    normalized = normalize_iso_date(period)
    return normalized is not None and normalized <= as_of


def structural_subject_metadata(
    *, ticker: str | None = None, country: str | None = None, subject_type: str | None = None
) -> tuple[str, str, dict[str, Any] | None, dict[str, str]]:
    normalized_ticker = (ticker or "").strip().upper() or None
    issuer_metadata = STRUCTURAL_CONTEXT_TICKER_METADATA.get(normalized_ticker or "")
    normalized_country = (country or "").strip().upper() or (
        issuer_metadata.get("domicile_country") if issuer_metadata else "US"
    )
    country_metadata = STRUCTURAL_CONTEXT_COUNTRY_METADATA.get(normalized_country) or {
        "country_name": normalized_country,
        "country_code": normalized_country,
        "region": issuer_metadata.get("region") if issuer_metadata else "",
    }
    resolved_subject_type = (
        "market_pulse"
        if subject_type == "market_pulse" or (not normalized_ticker and subject_type == "market_pulse")
        else "issuer"
    )
    subject_id = normalized_ticker or normalized_country
    return resolved_subject_type, subject_id, issuer_metadata, country_metadata


def structural_observation(
    *,
    family: str,
    label: str,
    summary: str,
    geography: str,
    period: str,
    source_family: str,
    source_id: str,
    source_name: str,
    source_url: str,
    agency: str,
    agency_series_id: str | None,
    retrieved_at: str,
    value: float | None = None,
    unit: str | None = None,
    retrieval_status: str = "fresh",
) -> dict[str, Any]:
    source = official_source_reference(
        source_id=source_id,
        source_family=source_family,
        source_name=source_name,
        source_url=source_url,
        agency=agency,
        agency_series_id=agency_series_id,
    )
    retrieval = official_retrieval_metadata(
        source=source, retrieved_at=retrieved_at, retrieval_status=retrieval_status, source_period=period
    )
    observation: dict[str, Any] = {
        "observation_id": source_id.lower(),
        "family": family,
        "label": label,
        "summary": summary,
        "geography": geography,
        "period": period,
        "source_family": source_family,
        "retrieval": retrieval,
        "missing_fields": [],
    }
    if value is not None:
        observation["value"] = float(value)
    if unit:
        observation["unit"] = unit
    return observation


def structural_omission(
    *, omission_id: str, family: str, source_family: str, reason_code: str, reason_text: str, blocking: bool
) -> dict[str, Any]:
    return {
        "omission_id": omission_id,
        "family": family,
        "source_family": source_family,
        "reason_code": reason_code,
        "reason_text": reason_text,
        "blocking": blocking,
    }


_FIXTURE_VALUES: dict[str, tuple[float, str]] = {
    "gdp_level": (29500000000000, "2025"),
    "gdp_per_capita": (82500, "2025"),
    "population": (341000000, "2025"),
    "trade_openness": (25.4, "2025"),
    "debt_context": (121.0, "2025"),
    "inequality": (41.3, "2024"),
    "logistics": (3.9, "2023"),
    "infrastructure": (18000, "2024"),
    "education": (88.4, "2024"),
    "energy_access": (100.0, "2024"),
    "sector_mix": (77.6, "2025"),
}


def _fixture_summary(family: str, geography: str, label: str) -> str:
    return {
        "gdp_level": f"{geography} remains a very large output base, which supports demand resilience for scaled businesses.",
        "gdp_per_capita": f"{geography} remains a high-income market, which supports premium pricing and services monetization.",
        "population": f"{geography} still offers a large domestic demand base for scaled consumer and enterprise franchises.",
        "trade_openness": "Trade intensity stays relevant for supply-chain exposure and imported-input sensitivity.",
        "debt_context": "Public debt remains elevated enough to keep macro policy sensitivity in view.",
        "inequality": "Inequality remains a structural watch item because it can change the breadth of demand recovery.",
        "logistics": "Logistics quality remains supportive for national distribution and supply-chain reliability.",
        "infrastructure": "Digital infrastructure remains supportive for platform distribution and enterprise adoption.",
        "education": "Human-capital depth remains supportive for skilled-labor availability and product adoption.",
        "energy_access": "Energy access is not a current bottleneck for nationwide operations.",
        "sector_mix": "The services mix remains supportive for higher-margin digital and recurring-revenue models.",
    }.get(family, f"{geography} structural context remains relevant for {label}.")


_FIXTURE_IMF_OMISSIONS = [
    ("imf-gdp-growth-outlook-unavailable", "gdp_growth_outlook",
     "IMF forecast inputs are optional in M6 and were not available in this run."),
    ("imf-inflation-regime-unavailable", "inflation_regime", "IMF inflation-regime inputs were not available in this run."),
    ("imf-fiscal-balance-unavailable", "fiscal_balance", "IMF fiscal-balance inputs were not available in this run."),
    ("imf-public-debt-unavailable", "public_debt", "IMF public-debt inputs were not available in this run."),
    ("imf-fx-reserves-unavailable", "fx_reserves", "IMF reserves inputs were not available in this run."),
    ("imf-current-account-unavailable", "current_account", "IMF current-account inputs were not available in this run."),
]


def structural_default_fixture(
    *, ticker: str | None = None, country: str | None = None, subject_type: str | None = None, as_of: str | None = None
) -> dict[str, Any]:
    replay_as_of = resolved_as_of_date(as_of)
    retrieved_at = iso_timestamp()
    resolved_subject_type, subject_id, issuer_metadata, country_metadata = structural_subject_metadata(
        ticker=ticker, country=country, subject_type=subject_type
    )
    geography = str(country_metadata["country_name"])
    country_code = str(country_metadata["country_code"])

    observations: list[dict[str, Any]] = []
    retrievals: list[dict[str, Any]] = []
    for item in WORLD_BANK_STRUCTURAL_REGISTRY:
        family = str(item["family"])
        value, period = _FIXTURE_VALUES.get(family, (None, replay_as_of[:4]))
        if len(period) == 4 and period.isdigit() and int(period) > int(replay_as_of[:4]):
            period = replay_as_of[:4]
        label = str(item["label"])
        observation = structural_observation(
            family=family,
            label=label,
            summary=_fixture_summary(family, geography, label),
            geography=geography,
            period=period,
            source_family="world_bank",
            source_id=f"WB_{item['indicator']}",
            source_name=f"World Bank {item['label']}",
            source_url=f"https://api.worldbank.org/v2/country/{country_code}/indicator/{item['indicator']}",
            agency="World Bank",
            agency_series_id=str(item["indicator"]),
            retrieved_at=retrieved_at,
            value=value,
            unit=str(item["unit"]),
        )
        observations.append(observation)
        retrievals.append(observation["retrieval"])

    omissions = [
        structural_omission(
            omission_id=omission_id,
            family=family,
            source_family="imf",
            reason_code="source_unavailable",
            reason_text=reason_text,
            blocking=False,
        )
        for omission_id, family, reason_text in _FIXTURE_IMF_OMISSIONS
    ]
    normalized_country = (country or "").strip().upper()
    if normalized_country and normalized_country not in STRUCTURAL_CONTEXT_COUNTRY_METADATA:
        omissions.append(
            structural_omission(
                omission_id="world-bank-country-seed-scope",
                family="registry",
                source_family="world_bank",
                reason_code="outside_seed_scope",
                reason_text=f"{normalized_country} is outside the M6 reviewed country seed scope.",
                blocking=False,
            )
        )
    payload: dict[str, Any] = {
        "subject_type": resolved_subject_type,
        "subject_id": subject_id,
        "as_of": replay_as_of,
        "coverage_state": "partial",
        "summary": (
            f"{geography} structural context remains broadly supportive for scaled issuers, "
            "while public-debt and inflation-related sensitivity keep the backdrop disciplined."
        ),
        "issuer_metadata": issuer_metadata or None,
        "observations": observations,
        "omissions": omissions,
        "retrievals": retrievals,
    }
    if payload["issuer_metadata"] is None:
        payload.pop("issuer_metadata")
    validate_schema("structural-context", payload)
    return payload


def _world_bank_json_list(url: str) -> list[Any]:
    request = Request(url, headers={"accept": "application/json"})
    with urlopen(request, timeout=15) as response:  # noqa: S310 - fixed https World Bank URL
        payload = json.loads(response.read().decode("utf-8"))
        if not isinstance(payload, list):
            raise OSError("official source returned a non-array JSON payload")
        return payload


def live_structural_context(
    *,
    ticker: str | None = None,
    country: str | None = None,
    subject_type: str | None = None,
    as_of: str | None = None,
    fetch_json_list: FetchJsonList = _world_bank_json_list,
) -> dict[str, Any]:
    replay_as_of = resolved_as_of_date(as_of)
    retrieved_at = iso_timestamp()
    resolved_subject_type, subject_id, issuer_metadata, country_metadata = structural_subject_metadata(
        ticker=ticker, country=country, subject_type=subject_type
    )
    geography = str(country_metadata["country_name"])
    country_code = str(country_metadata["country_code"])

    observations: list[dict[str, Any]] = []
    retrievals: list[dict[str, Any]] = []
    omissions: list[dict[str, Any]] = []

    for item in WORLD_BANK_STRUCTURAL_REGISTRY:
        try:
            payload = fetch_json_list(
                f"https://api.worldbank.org/v2/country/{country_code}/indicator/{item['indicator']}?format=json&per_page=6"
            )
        except (OSError, URLError, TimeoutError) as error:
            raise ProviderIntegrationError(
                OFFICIAL_STRUCTURAL_PROVIDER,
                error_code="PROVIDER_OUTAGE",
                message="World Bank structural context is unavailable.",
            ) from error

        value: float | None = None
        period = replay_as_of
        if isinstance(payload, list) and len(payload) > 1 and isinstance(payload[1], list):
            for row in payload[1]:
                if not isinstance(row, dict):
                    continue
                row_period = str(row.get("date") or "")
                if not structural_period_within_as_of(row_period, replay_as_of):
                    continue
                row_value = row.get("value")
                if isinstance(row_value, (int, float)):
                    value = float(row_value)
                    period = row_period or replay_as_of
                    if isinstance(row.get("country"), dict):
                        geography = str(row["country"].get("value") or geography)
                    break
        if value is None:
            omissions.append(
                structural_omission(
                    omission_id=f"world-bank-{item['family']}-missing",
                    family=str(item["family"]),
                    source_family="world_bank",
                    reason_code="not_reported",
                    reason_text=f"World Bank returned no value for {item['label']} in this run.",
                    blocking=False,
                )
            )
            continue

        observation = structural_observation(
            family=str(item["family"]),
            label=str(item["label"]),
            summary=f"{geography} structural context remains relevant for {item['label'].lower()}.",
            geography=geography,
            period=period,
            source_family="world_bank",
            source_id=f"WB_{item['indicator']}",
            source_name=f"World Bank {item['label']}",
            source_url=f"https://api.worldbank.org/v2/country/{country_code}/indicator/{item['indicator']}",
            agency="World Bank",
            agency_series_id=str(item["indicator"]),
            retrieved_at=retrieved_at,
            value=value,
            unit=str(item["unit"]),
        )
        observations.append(observation)
        retrievals.append(observation["retrieval"])

    for item in IMF_STRUCTURAL_REGISTRY:
        omissions.append(
            structural_omission(
                omission_id=f"imf-{item['family']}-unavailable",
                family=str(item["family"]),
                source_family="imf",
                reason_code="source_unavailable",
                reason_text=f"IMF {item['label'].lower()} is optional in M6 and unavailable in the live path.",
                blocking=False,
            )
        )

    if not observations:
        raise ProviderIntegrationError(
            OFFICIAL_STRUCTURAL_PROVIDER,
            error_code="PROVIDER_OUTAGE",
            message="World Bank structural context returned no observations.",
        )

    result: dict[str, Any] = {
        "subject_type": resolved_subject_type,
        "subject_id": subject_id,
        "as_of": replay_as_of,
        "coverage_state": "partial" if omissions else "full",
        "summary": f"{geography} structural context remains relevant for demand durability, policy sensitivity, and operating backdrop.",
        "issuer_metadata": issuer_metadata or None,
        "observations": observations,
        "omissions": omissions,
        "retrievals": retrievals,
    }
    if result["issuer_metadata"] is None:
        result.pop("issuer_metadata")
    validate_schema("structural-context", result)
    return result


def structural_response(
    *,
    country: str = "US",
    subject_type: str = "market_pulse",
    as_of: str | None = None,
    env: Mapping[str, str] | None = None,
    fetch_json_list: FetchJsonList = _world_bank_json_list,
) -> dict[str, Any]:
    """The body of the old GET /v1/official/structural?country=US&subject_type=market_pulse&as_of=..."""
    normalized_as_of = normalize_iso_date(as_of)
    if fixture_mode(env):
        payload = structural_default_fixture(country=country, subject_type=subject_type, as_of=normalized_as_of)
    else:
        payload = live_structural_context(
            country=country, subject_type=subject_type, as_of=normalized_as_of, fetch_json_list=fetch_json_list
        )
    return success_response(data=payload, provider=OFFICIAL_STRUCTURAL_PROVIDER, retrieved_at=iso_timestamp())
