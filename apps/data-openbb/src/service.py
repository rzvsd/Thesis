from __future__ import annotations

import json
import os
import sys
import time
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Mapping
from urllib.error import URLError
from urllib.request import Request, urlopen

# Make the shared redis-client package importable.
_PACKAGES_ROOT = str(Path(__file__).resolve().parents[3] / "packages" / "redis-client")
if _PACKAGES_ROOT not in sys.path:
    sys.path.insert(0, _PACKAGES_ROOT)

from client import RedisClient  # noqa: E402

try:
    from .validation import SchemaValidationError, validate_schema
    from .historical_sync import run_historical_delta_sync
except ImportError:  # pragma: no cover - supports direct src imports in sibling tests
    from validation import SchemaValidationError, validate_schema
    from historical_sync import run_historical_delta_sync


SERVICE_NAME = "data-openbb"
DEFAULT_PORT = int(os.environ.get("PORT", "3003"))
FINANCE_DATASET = "company_finance"
MACRO_DATASET = "macro_daily"
CALENDAR_DATASET = "earnings_calendar"
COMPANY_PROVIDER = "FMP"
MACRO_PROVIDER = "FMP"
CALENDAR_PROVIDER = "yfinance"
OFFICIAL_COMPANY_PROVIDER = "sec_edgar"
OFFICIAL_MACRO_PROVIDER = "official_public_macro"
OFFICIAL_STRUCTURAL_PROVIDER = "official_structural_context"
COMPANY_RATE_LIMIT_KEY = "FMP_FINANCE"
MACRO_RATE_LIMIT_KEY = "FMP_MACRO"
CALENDAR_RATE_LIMIT_KEY = "YFINANCE_CALENDAR"
MACRO_INDICATOR = "us10y_treasury_yield"
MACRO_TENOR_FIELD = "year_10"
FINANCE_FIELDS = [
    "revenue",
    "gross_margin",
    "operating_income",
    "net_income",
    "eps",
    "debt_total",
    "cash_and_equivalents",
    "free_cash_flow",
]
FIXTURE_ROOT = Path(__file__).resolve().parents[3] / "data" / "golden" / "data-openbb"
COMPANY_FIXTURE_ROOT = FIXTURE_ROOT / "company"
MACRO_FIXTURE_ROOT = FIXTURE_ROOT / "macro"
CALENDAR_FIXTURE_ROOT = FIXTURE_ROOT / "calendar"
OFFICIAL_FIXTURE_ROOT = FIXTURE_ROOT / "official"
OFFICIAL_COMPANY_FIXTURE_ROOT = OFFICIAL_FIXTURE_ROOT / "company"
OFFICIAL_MACRO_FIXTURE_ROOT = OFFICIAL_FIXTURE_ROOT / "macro"
OFFICIAL_STRUCTURAL_FIXTURE_ROOT = OFFICIAL_FIXTURE_ROOT / "structural"
OFFICIAL_COMPANY_TICKERS = {
    "AAPL": "0000320193",
    "MSFT": "0000789019",
    "TSLA": "0001318605",
}
STRUCTURAL_CONTEXT_TICKER_METADATA = {
    "AAPL": {
        "name": "Apple Inc.",
        "exchange": "NASDAQ",
        "currency": "USD",
        "domicile_country": "US",
        "region": "North America",
        "sector": "Technology",
        "industry": "Consumer Electronics",
    },
    "MSFT": {
        "name": "Microsoft Corporation",
        "exchange": "NASDAQ",
        "currency": "USD",
        "domicile_country": "US",
        "region": "North America",
        "sector": "Technology",
        "industry": "Software",
    },
    "TSLA": {
        "name": "Tesla, Inc.",
        "exchange": "NASDAQ",
        "currency": "USD",
        "domicile_country": "US",
        "region": "North America",
        "sector": "Consumer Discretionary",
        "industry": "Automobiles",
    },
    "NVDA": {
        "name": "NVIDIA Corporation",
        "exchange": "NASDAQ",
        "currency": "USD",
        "domicile_country": "US",
        "region": "North America",
        "sector": "Technology",
        "industry": "Semiconductors",
    },
    "AMZN": {
        "name": "Amazon.com, Inc.",
        "exchange": "NASDAQ",
        "currency": "USD",
        "domicile_country": "US",
        "region": "North America",
        "sector": "Consumer Discretionary",
        "industry": "Broadline Retail",
    },
    "META": {
        "name": "Meta Platforms, Inc.",
        "exchange": "NASDAQ",
        "currency": "USD",
        "domicile_country": "US",
        "region": "North America",
        "sector": "Communication Services",
        "industry": "Interactive Media and Services",
    },
    "GOOGL": {
        "name": "Alphabet Inc.",
        "exchange": "NASDAQ",
        "currency": "USD",
        "domicile_country": "US",
        "region": "North America",
        "sector": "Communication Services",
        "industry": "Interactive Media and Services",
    },
}
STRUCTURAL_CONTEXT_COUNTRY_METADATA = {
    "US": {
        "country_name": "United States",
        "country_code": "USA",
        "region": "North America",
    }
}
WORLD_BANK_STRUCTURAL_REGISTRY = [
    {
        "family": "gdp_level",
        "label": "GDP level",
        "indicator": "NY.GDP.MKTP.CD",
        "unit": "usd",
    },
    {
        "family": "gdp_per_capita",
        "label": "GDP per capita",
        "indicator": "NY.GDP.PCAP.CD",
        "unit": "usd",
    },
    {
        "family": "population",
        "label": "Population",
        "indicator": "SP.POP.TOTL",
        "unit": "people",
    },
    {
        "family": "trade_openness",
        "label": "Trade openness",
        "indicator": "NE.TRD.GNFS.ZS",
        "unit": "pct_gdp",
    },
    {
        "family": "debt_context",
        "label": "Government debt context",
        "indicator": "GC.DOD.TOTL.GD.ZS",
        "unit": "pct_gdp",
    },
    {
        "family": "inequality",
        "label": "Gini inequality",
        "indicator": "SI.POV.GINI",
        "unit": "index",
    },
    {
        "family": "logistics",
        "label": "Logistics performance",
        "indicator": "LP.LPI.OVRL.XQ",
        "unit": "score",
    },
    {
        "family": "infrastructure",
        "label": "Secure internet servers",
        "indicator": "IT.NET.SECR.P6",
        "unit": "per_million",
    },
    {
        "family": "education",
        "label": "Tertiary enrollment",
        "indicator": "SE.TER.ENRR",
        "unit": "pct",
    },
    {
        "family": "energy_access",
        "label": "Energy access",
        "indicator": "EG.ELC.ACCS.ZS",
        "unit": "pct",
    },
    {
        "family": "sector_mix",
        "label": "Services share of GDP",
        "indicator": "NV.SRV.TOTL.ZS",
        "unit": "pct_gdp",
    },
]
IMF_STRUCTURAL_REGISTRY = [
    {
        "family": "gdp_growth_outlook",
        "label": "GDP growth outlook",
    },
    {
        "family": "inflation_regime",
        "label": "Inflation outlook",
    },
    {
        "family": "fiscal_balance",
        "label": "Fiscal balance",
    },
    {
        "family": "public_debt",
        "label": "Public debt",
    },
    {
        "family": "fx_reserves",
        "label": "FX reserves",
    },
    {
        "family": "current_account",
        "label": "Current-account context",
    },
]
OFFICIAL_MACRO_REGISTRY = [
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


@dataclass(frozen=True)
class ResponsePayload:
    status_code: int
    body: dict[str, Any]


@dataclass(frozen=True)
class Settings:
    port: int = DEFAULT_PORT
    fixture_mode: bool = True
    redis_url: str = "redis://localhost:6379/0"
    rate_limit_window_seconds: int = 60
    rate_limit_burst_allowance: int = 2
    rate_limit_cooldown_seconds: int = 60
    fmp_finance_rate_limit_per_minute: int = 10
    fmp_macro_rate_limit_per_minute: int = 5
    yfinance_rate_limit_per_minute: int = 60
    polygon_rate_limit_per_minute: int = 5
    alpha_vantage_rate_limit_per_minute: int = 5

    @classmethod
    def from_env(cls, values: Mapping[str, str]) -> "Settings":
        def read_int(name: str, default: int) -> int:
            raw_value = values.get(name)
            if raw_value is None or str(raw_value).strip() == "":
                return default
            return int(str(raw_value))

        fixture_raw = str(values.get("DATA_OPENBB_FIXTURE_MODE", "true")).strip().lower()
        fixture_mode = fixture_raw not in {"0", "false", "no"}

        return cls(
            port=read_int("PORT", DEFAULT_PORT),
            fixture_mode=fixture_mode,
            redis_url=str(values.get("REDIS_URL", "redis://localhost:6379/0")),
            rate_limit_window_seconds=read_int("RATE_LIMIT_WINDOW_SECONDS", 60),
            rate_limit_burst_allowance=read_int("RATE_LIMIT_BURST_ALLOWANCE", 2),
            rate_limit_cooldown_seconds=read_int("RATE_LIMIT_COOLDOWN_SECONDS", 60),
            fmp_finance_rate_limit_per_minute=read_int(
                "FMP_FINANCE_RATE_LIMIT_PER_MINUTE",
                read_int("FMP_RATE_LIMIT_PER_MINUTE", 10),
            ),
            fmp_macro_rate_limit_per_minute=read_int("FMP_MACRO_RATE_LIMIT_PER_MINUTE", 5),
            yfinance_rate_limit_per_minute=read_int("YFINANCE_RATE_LIMIT_PER_MINUTE", 60),
            polygon_rate_limit_per_minute=read_int("POLYGON_RATE_LIMIT_PER_MINUTE", 5),
            alpha_vantage_rate_limit_per_minute=read_int("ALPHA_VANTAGE_RATE_LIMIT_PER_MINUTE", 5),
        )

    def limit_for(self, provider: str) -> int:
        normalized = provider.upper()
        limits = {
            "FMP": self.fmp_finance_rate_limit_per_minute,
            "FMP_FINANCE": self.fmp_finance_rate_limit_per_minute,
            "FMP_MACRO": self.fmp_macro_rate_limit_per_minute,
            "YFINANCE": self.yfinance_rate_limit_per_minute,
            "YFINANCE_CALENDAR": self.yfinance_rate_limit_per_minute,
            "POLYGON": self.polygon_rate_limit_per_minute,
            "ALPHA_VANTAGE": self.alpha_vantage_rate_limit_per_minute,
        }
        return limits.get(normalized, self.fmp_finance_rate_limit_per_minute)


# RedisClient is imported from packages/redis-client (see top of file).


class RateLimitExceededError(RuntimeError):
    def __init__(self, provider: str, retry_after_seconds: int, *, limit_key: str | None = None) -> None:
        super().__init__(f"{provider} rate limit exceeded")
        self.provider = provider
        self.limit_key = limit_key or provider
        self.retry_after_seconds = retry_after_seconds


class RateLimiter:
    def __init__(self, settings: Settings, client: Any | None = None) -> None:
        self.settings = settings
        self.client = client or RedisClient(settings.redis_url)

    def acquire(self, provider: str, *, rate_limit_key: str | None = None) -> None:
        normalized_provider = provider.upper()
        normalized_key = (rate_limit_key or provider).upper()
        cooldown_key = f"m2:data-openbb:cooldown:{normalized_key.lower()}"
        counter_key = f"m2:data-openbb:window:{normalized_key.lower()}"

        try:
            if self.client.get(cooldown_key) is not None:
                raise RateLimitExceededError(
                    normalized_provider,
                    self.settings.rate_limit_cooldown_seconds,
                    limit_key=normalized_key,
                )

            current = int(self.client.incr(counter_key))
            if current == 1:
                self.client.expire(counter_key, self.settings.rate_limit_window_seconds)

            if current <= self.settings.limit_for(normalized_key) + self.settings.rate_limit_burst_allowance:
                return

            self.client.setex(
                cooldown_key,
                self.settings.rate_limit_cooldown_seconds,
                str(self.settings.rate_limit_cooldown_seconds),
            )
            raise RateLimitExceededError(
                normalized_provider,
                self.settings.rate_limit_cooldown_seconds,
                limit_key=normalized_key,
            )
        except (ConnectionError, OSError):
            return


class ProviderIntegrationError(RuntimeError):
    def __init__(
        self,
        provider: str,
        *,
        error_code: str,
        message: str,
        status_code: int = 503,
    ) -> None:
        super().__init__(message)
        self.provider = provider
        self.error_code = error_code
        self.status_code = status_code


def iso_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def today_period() -> str:
    return date.today().isoformat()


def _resolved_as_of_date(value: str | None) -> str:
    return _normalize_iso_date(value) or today_period()


def _quarter_period_for_iso_date(value: str) -> str:
    parsed = datetime.strptime(value, "%Y-%m-%d")
    quarter = ((parsed.month - 1) // 3) + 1
    return f"{parsed.year}-Q{quarter}"


def _structural_period_within_as_of(period: str, as_of: str) -> bool:
    if len(period) == 4 and period.isdigit():
        return int(period) <= int(as_of[:4])
    normalized = _normalize_iso_date(period)
    return normalized is not None and normalized <= as_of


def log(level: str, message: str, **fields: Any) -> None:
    payload: dict[str, Any] = {
        "level": level,
        "service": SERVICE_NAME,
        "message": message,
        "timestamp": iso_timestamp(),
    }

    for key, value in fields.items():
        if value is not None:
            payload[key] = value

    print(json.dumps(payload, separators=(",", ":")), flush=True)


def get_request_id(header_value: str | None) -> str:
    stripped = (header_value or "").strip()
    return stripped or str(uuid.uuid4())


def health_payload() -> dict[str, str]:
    return {"status": "ok"}


def _load_json_fixture(path: Path, default_factory: Any) -> dict[str, Any]:
    if not path.exists():
        return default_factory()
    return json.loads(path.read_text(encoding="utf-8"))


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _as_float(value: Any) -> float | None:
    if not _is_number(value):
        return None
    return float(value)


def _coalesce_number(*values: Any) -> float | None:
    for value in values:
        number = _as_float(value)
        if number is not None:
            return number
    return None


def _format_period(value: Any) -> str | None:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _canonical_finance_period(*records: Mapping[str, Any]) -> str:
    for record in records:
        fiscal_year = record.get("fiscal_year")
        fiscal_period = record.get("fiscal_period")
        if fiscal_year is not None and isinstance(fiscal_period, str) and fiscal_period.strip():
            return f"{fiscal_year}-{fiscal_period.strip().upper()}"

        period_ending = _format_period(record.get("period_ending"))
        if period_ending is not None:
            return period_ending

    return "live-unavailable"


def _normalize_company_records(
    ticker: str,
    *,
    income_record: Mapping[str, Any],
    balance_record: Mapping[str, Any],
    cash_record: Mapping[str, Any],
) -> dict[str, Any]:
    revenue = _coalesce_number(income_record.get("revenue"))
    gross_profit = _coalesce_number(income_record.get("gross_profit"))
    gross_margin = None
    if gross_profit is not None and revenue not in (None, 0):
        gross_margin = round((gross_profit / revenue) * 100, 4)

    debt_total = _coalesce_number(
        balance_record.get("total_debt"),
        (
            _coalesce_number(balance_record.get("short_term_debt"), 0)
            + _coalesce_number(balance_record.get("long_term_debt"), 0)
        )
        if (
            _coalesce_number(balance_record.get("short_term_debt")) is not None
            or _coalesce_number(balance_record.get("long_term_debt")) is not None
        )
        else None,
    )

    values = {
        "revenue": revenue,
        "gross_margin": gross_margin,
        "operating_income": _coalesce_number(income_record.get("total_operating_income")),
        "net_income": _coalesce_number(
            income_record.get("consolidated_net_income"),
            income_record.get("bottom_line_net_income"),
            cash_record.get("net_income"),
        ),
        "eps": _coalesce_number(
            income_record.get("diluted_earnings_per_share"),
            income_record.get("basic_earnings_per_share"),
        ),
        "debt_total": debt_total,
        "cash_and_equivalents": _coalesce_number(
            balance_record.get("cash_and_cash_equivalents"),
            balance_record.get("cash_and_short_term_investments"),
        ),
        "free_cash_flow": _coalesce_number(cash_record.get("free_cash_flow")),
    }

    normalized_data = {
        key: value
        for key, value in values.items()
        if value is not None
    }
    missing_fields = [field for field in FINANCE_FIELDS if field not in normalized_data]

    payload = {
        "ticker": ticker,
        "period": _canonical_finance_period(income_record, balance_record, cash_record),
        "provider": COMPANY_PROVIDER,
        "retrieved_at": iso_timestamp(),
        "data": normalized_data,
        "missing_fields": missing_fields,
    }
    validate_schema("canonical-finance-data", payload)
    return payload


def _normalize_macro_records(
    records: list[Mapping[str, Any]],
    metadata: Mapping[str, Any],
) -> dict[str, Any]:
    latest_value: float | None = None
    latest_period: str | None = None

    for record in reversed(records):
        latest_value = _coalesce_number(record.get(MACRO_TENOR_FIELD))
        latest_period = _format_period(record.get("date"))
        if latest_value is not None and latest_period is not None:
            break

    if latest_value is None or latest_period is None:
        raise ProviderIntegrationError(
            MACRO_PROVIDER,
            error_code="PROVIDER_OUTAGE",
            message="FMP returned no usable macro observations for live mode.",
        )

    unit_value = str(((metadata.get(MACRO_TENOR_FIELD) or {}).get("units") or "percent")).strip().lower()
    unit = "percent" if "percent" in unit_value else unit_value or "value"

    payload = {
        "indicator": MACRO_INDICATOR,
        "value": latest_value,
        "unit": unit,
        "period": latest_period,
        "provider": MACRO_PROVIDER,
        "retrieved_at": iso_timestamp(),
        "category": "rates",
        "missing_fields": [],
    }
    validate_schema("canonical-macro-data", payload)
    return payload


def _load_calendar_fixture_payload() -> dict[str, Any]:
    fixture = _load_json_fixture(
        CALENDAR_FIXTURE_ROOT / "earnings.json",
        default_factory=lambda: {
            "events": [
                {
                    "ticker": "AAPL",
                    "event_date": today_period(),
                    "event_time": "after_market",
                    "provider": CALENDAR_PROVIDER,
                }
            ]
        },
    )
    events = fixture.get("events", [])
    if not isinstance(events, list):
        raise SchemaValidationError("calendar fixture events must be an array")
    normalized_events = [
        event
        for event in events
        if isinstance(event, dict)
    ]
    payload = {
        "events": normalized_events,
    }
    validate_schema("service-response", {
        "ok": True,
        "data": payload,
        "error_flag": False,
    })
    return payload


def _coerce_calendar_date(value: Any) -> str | None:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if not isinstance(value, str):
        return None

    text = value.strip()
    if not text:
        return None

    candidates = [text, text.replace("/", "-")]
    for candidate in candidates:
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


def _normalize_iso_date(value: str | None) -> str | None:
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


def _add_days_to_iso_date(value: str, days: int) -> str:
    parsed = datetime.strptime(value, "%Y-%m-%d")
    return (parsed + timedelta(days=days)).date().isoformat()


def _coerce_calendar_event_time(value: Any) -> str | None:
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
        parsed_date = _coerce_calendar_date(text)
        if parsed_date is not None and "t" in text:
            try:
                parsed = datetime.fromisoformat(text.replace("z", "Z").replace("Z", "+00:00"))
            except ValueError:
                parsed = None
            if parsed is not None:
                hour = parsed.hour
                minute = parsed.minute
                if hour < 9 or (hour == 9 and minute < 30):
                    return "before_market"
                if hour >= 16:
                    return "after_market"
                return "during_market"
        return None
    if isinstance(value, datetime):
        hour = value.hour
        minute = value.minute
        if hour < 9 or (hour == 9 and minute < 30):
            return "before_market"
        if hour >= 16:
            return "after_market"
        return "during_market"
    return None


def _calendar_row_candidates(raw_result: Any) -> list[dict[str, Any]]:
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


def _normalize_earnings_calendar_rows(
    rows: list[dict[str, Any]],
    *,
    start_date: str,
    end_date: str,
) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for row in rows:
        ticker_raw = next(
            (
                row.get(key)
                for key in ("ticker", "symbol", "index", "Ticker", "Symbol")
                if isinstance(row.get(key), str) and row.get(key)
            ),
            None,
        )
        ticker = str(ticker_raw).strip().upper() if ticker_raw is not None else ""

        event_date_raw = next(
            (
                row.get(key)
                for key in (
                    "event_date",
                    "date",
                    "earnings_date",
                    "Earnings Date",
                    "EarningsDate",
                    "startdatetime",
                    "startDate",
                )
                if row.get(key) is not None
            ),
            None,
        )
        event_date = _coerce_calendar_date(event_date_raw)
        if not ticker or not event_date:
            continue
        if event_date < start_date or event_date > end_date:
            continue

        time_raw = next(
            (
                row.get(key)
                for key in (
                    "event_time",
                    "time",
                    "when",
                    "timing",
                    "earnings_call_time",
                    "earnings_call",
                    "call_time",
                    "Earnings Call Time",
                )
                if row.get(key) is not None
            ),
            None,
        )
        event_time = _coerce_calendar_event_time(time_raw)
        if event_time is None:
            event_time = _coerce_calendar_event_time(event_date_raw)

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


def _official_source_reference(
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


def _official_retrieval_metadata(
    *,
    source: dict[str, Any],
    retrieved_at: str,
    retrieval_status: str = "fresh",
    source_period: str | None = None,
    source_revision: str | None = None,
) -> dict[str, Any]:
    metadata = {
        "source": source,
        "retrieved_at": retrieved_at,
        "retrieval_status": retrieval_status,
    }
    if source_period:
        metadata["source_period"] = source_period
    if source_revision:
        metadata["source_revision"] = source_revision
    validate_schema("official-retrieval-metadata", metadata)
    return metadata


def _missing_field(field: str, reason: str, message: str, *, source_id: str | None = None) -> dict[str, Any]:
    missing = {
        "field": field,
        "reason": reason,
        "message": message,
    }
    if source_id:
        missing["source_id"] = source_id
    validate_schema("official-missing-field-state", missing)
    return missing


def _iso_datetime_from_date(value: str | None) -> str:
    normalized = _normalize_iso_date(value)
    if normalized:
        return f"{normalized}T00:00:00.000Z"
    return iso_timestamp()


def _build_canonical_event(
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


def _official_company_default_fixture(ticker: str) -> dict[str, Any]:
    cik = OFFICIAL_COMPANY_TICKERS.get(ticker)
    retrieved_at = iso_timestamp()
    sec_source = _official_source_reference(
        source_id=f"SEC_COMPANY_{ticker}",
        source_family="sec_edgar",
        source_name=f"SEC EDGAR company truth for {ticker}",
        source_url=f"https://data.sec.gov/submissions/CIK{cik}.json" if cik else "https://data.sec.gov/submissions/",
        agency="SEC",
        agency_series_id=f"CIK{cik}" if cik else None,
    )
    retrieval = _official_retrieval_metadata(
        source=sec_source,
        retrieved_at=retrieved_at,
        retrieval_status="partial" if cik is None else "fresh",
    )
    missing_fields = []
    if cik is None:
        missing_fields.append(
            _missing_field(
                "cik",
                "outside_seed_scope",
                f"{ticker} is outside the M1 official company seed scope.",
                source_id=sec_source["source_id"],
            )
        )
    event = _build_canonical_event(
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


def _official_macro_default_fixture(*, as_of: str | None = None) -> dict[str, Any]:
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
        source = _official_source_reference(
            source_id=registry_id,
            source_family=str(item["source_family"]),
            source_name=str(item["source_name"]),
            source_url=str(item["source_url"]),
            agency=str(item["agency"]),
            agency_series_id=str(item["agency_series_id"]),
        )
        retrieval = _official_retrieval_metadata(
            source=source,
            retrieved_at=retrieved_at,
            retrieval_status="fresh",
            source_period=period,
        )
        value = values_by_key.get(registry_id)
        missing_fields = []
        if value is None:
            missing_fields.append(
                _missing_field(
                    "value",
                    "source_unavailable",
                    f"{registry_id} has no fixture value.",
                    source_id=registry_id,
                )
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
            _build_canonical_event(
                event_id=f"official-macro-{registry_id.lower()}-{period.lower()}",
                family="macro_release_published",
                subject_type="macro_series",
                subject_id=registry_id,
                title=f"{item['source_name']} official observation published",
                occurred_at=_iso_datetime_from_date(period if len(period) == 10 else None),
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


def _fixture_official_company_payload(ticker: str) -> dict[str, Any]:
    fixture = _load_json_fixture(
        OFFICIAL_COMPANY_FIXTURE_ROOT / f"{ticker}.json",
        default_factory=lambda: _official_company_default_fixture(ticker),
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


def _fixture_official_macro_payload(*, as_of: str | None = None) -> dict[str, Any]:
    fixture = _load_json_fixture(
        OFFICIAL_MACRO_FIXTURE_ROOT / "daily.json",
        default_factory=lambda: _official_macro_default_fixture(as_of=as_of),
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
            event["occurred_at"] = _iso_datetime_from_date(replay_as_of)
            validate_schema("canonical-event", event)
    return fixture


def _structural_subject_metadata(
    *,
    ticker: str | None = None,
    country: str | None = None,
    subject_type: str | None = None,
) -> tuple[str, str, dict[str, Any] | None, dict[str, str]]:
    normalized_ticker = (ticker or "").strip().upper() or None
    issuer_metadata = STRUCTURAL_CONTEXT_TICKER_METADATA.get(normalized_ticker or "")
    normalized_country = (
        (country or "").strip().upper()
        or (issuer_metadata.get("domicile_country") if issuer_metadata else "US")
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


def _structural_observation(
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
    source = _official_source_reference(
        source_id=source_id,
        source_family=source_family,
        source_name=source_name,
        source_url=source_url,
        agency=agency,
        agency_series_id=agency_series_id,
    )
    retrieval = _official_retrieval_metadata(
        source=source,
        retrieved_at=retrieved_at,
        retrieval_status=retrieval_status,
        source_period=period,
    )
    observation = {
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


def _structural_omission(
    *,
    omission_id: str,
    family: str,
    source_family: str,
    reason_code: str,
    reason_text: str,
    blocking: bool,
) -> dict[str, Any]:
    return {
        "omission_id": omission_id,
        "family": family,
        "source_family": source_family,
        "reason_code": reason_code,
        "reason_text": reason_text,
        "blocking": blocking,
    }


def _official_structural_default_fixture(
    *,
    ticker: str | None = None,
    country: str | None = None,
    subject_type: str | None = None,
    as_of: str | None = None,
) -> dict[str, Any]:
    replay_as_of = _resolved_as_of_date(as_of)
    retrieved_at = iso_timestamp()
    resolved_subject_type, subject_id, issuer_metadata, country_metadata = _structural_subject_metadata(
        ticker=ticker,
        country=country,
        subject_type=subject_type,
    )
    geography = str(country_metadata["country_name"])
    country_code = str(country_metadata["country_code"])

    fixture_values = {
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

    observations: list[dict[str, Any]] = []
    retrievals: list[dict[str, Any]] = []
    for item in WORLD_BANK_STRUCTURAL_REGISTRY:
        family = str(item["family"])
        value, period = fixture_values.get(family, (None, replay_as_of[:4]))
        if len(period) == 4 and period.isdigit() and int(period) > int(replay_as_of[:4]):
            period = replay_as_of[:4]
        label = str(item["label"])
        summary = {
            "gdp_level": f"{geography} remains a very large output base, which supports demand resilience for scaled businesses.",
            "gdp_per_capita": f"{geography} remains a high-income market, which supports premium pricing and services monetization.",
            "population": f"{geography} still offers a large domestic demand base for scaled consumer and enterprise franchises.",
            "trade_openness": f"Trade intensity stays relevant for supply-chain exposure and imported-input sensitivity.",
            "debt_context": f"Public debt remains elevated enough to keep macro policy sensitivity in view.",
            "inequality": f"Inequality remains a structural watch item because it can change the breadth of demand recovery.",
            "logistics": f"Logistics quality remains supportive for national distribution and supply-chain reliability.",
            "infrastructure": f"Digital infrastructure remains supportive for platform distribution and enterprise adoption.",
            "education": f"Human-capital depth remains supportive for skilled-labor availability and product adoption.",
            "energy_access": f"Energy access is not a current bottleneck for nationwide operations.",
            "sector_mix": f"The services mix remains supportive for higher-margin digital and recurring-revenue models.",
        }.get(family, f"{geography} structural context remains relevant for {label}.")
        observation = _structural_observation(
            family=family,
            label=label,
            summary=summary,
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
        _structural_omission(
            omission_id="imf-gdp-growth-outlook-unavailable",
            family="gdp_growth_outlook",
            source_family="imf",
            reason_code="source_unavailable",
            reason_text="IMF forecast inputs are optional in M6 and were not available in this run.",
            blocking=False,
        ),
        _structural_omission(
            omission_id="imf-inflation-regime-unavailable",
            family="inflation_regime",
            source_family="imf",
            reason_code="source_unavailable",
            reason_text="IMF inflation-regime inputs were not available in this run.",
            blocking=False,
        ),
        _structural_omission(
            omission_id="imf-fiscal-balance-unavailable",
            family="fiscal_balance",
            source_family="imf",
            reason_code="source_unavailable",
            reason_text="IMF fiscal-balance inputs were not available in this run.",
            blocking=False,
        ),
        _structural_omission(
            omission_id="imf-public-debt-unavailable",
            family="public_debt",
            source_family="imf",
            reason_code="source_unavailable",
            reason_text="IMF public-debt inputs were not available in this run.",
            blocking=False,
        ),
        _structural_omission(
            omission_id="imf-fx-reserves-unavailable",
            family="fx_reserves",
            source_family="imf",
            reason_code="source_unavailable",
            reason_text="IMF reserves inputs were not available in this run.",
            blocking=False,
        ),
        _structural_omission(
            omission_id="imf-current-account-unavailable",
            family="current_account",
            source_family="imf",
            reason_code="source_unavailable",
            reason_text="IMF current-account inputs were not available in this run.",
            blocking=False,
        ),
    ]
    if normalized_country := (country or "").strip().upper():
        if normalized_country not in STRUCTURAL_CONTEXT_COUNTRY_METADATA:
            omissions.append(
                _structural_omission(
                    omission_id="world-bank-country-seed-scope",
                    family="registry",
                    source_family="world_bank",
                    reason_code="outside_seed_scope",
                    reason_text=f"{normalized_country} is outside the M6 reviewed country seed scope.",
                    blocking=False,
                )
            )
    summary = (
        f"{geography} structural context remains broadly supportive for scaled issuers, "
        "while public-debt and inflation-related sensitivity keep the backdrop disciplined."
    )
    payload = {
        "subject_type": resolved_subject_type,
        "subject_id": subject_id,
        "as_of": replay_as_of,
        "coverage_state": "partial",
        "summary": summary,
        "issuer_metadata": issuer_metadata or None,
        "observations": observations,
        "omissions": omissions,
        "retrievals": retrievals,
    }
    if payload["issuer_metadata"] is None:
        payload.pop("issuer_metadata")
    validate_schema("structural-context", payload)
    return payload


def _fixture_official_structural_payload(
    *,
    ticker: str | None = None,
    country: str | None = None,
    subject_type: str | None = None,
    as_of: str | None = None,
) -> dict[str, Any]:
    fixture_name = (ticker or country or "US").strip().upper()
    fixture = _load_json_fixture(
        OFFICIAL_STRUCTURAL_FIXTURE_ROOT / f"{fixture_name}.json",
        default_factory=lambda: _official_structural_default_fixture(
            ticker=ticker,
            country=country,
            subject_type=subject_type,
            as_of=as_of,
        ),
    )
    replay_as_of = _resolved_as_of_date(as_of)
    fixture["as_of"] = replay_as_of
    validate_schema("structural-context", fixture)
    return fixture


def _fixture_company_payload(ticker: str) -> dict[str, Any]:
    fixture = _load_json_fixture(
        COMPANY_FIXTURE_ROOT / f"{ticker}.json",
        default_factory=lambda: {
            "ticker": ticker,
            "period": "fixture-unavailable",
            "provider": COMPANY_PROVIDER,
            "data": {},
        },
    )
    raw_data = fixture.get("data", {})

    if not isinstance(raw_data, dict):
        raise SchemaValidationError("company fixture data must be an object")

    normalized_data = {
        key: value
        for key, value in raw_data.items()
        if value is not None
    }
    missing_fields = [field for field in FINANCE_FIELDS if field not in normalized_data]
    payload = {
        "ticker": ticker,
        "period": str(fixture.get("period", "fixture-unavailable")),
        "provider": str(fixture.get("provider", COMPANY_PROVIDER)),
        "retrieved_at": iso_timestamp(),
        "data": normalized_data,
        "missing_fields": missing_fields,
    }
    validate_schema("canonical-finance-data", payload)
    return payload


def _fixture_macro_payload() -> dict[str, Any]:
    fixture = _load_json_fixture(
        MACRO_FIXTURE_ROOT / "daily.json",
        default_factory=lambda: {
            "indicator": MACRO_INDICATOR,
            "value": 4.0,
            "unit": "percent",
            "provider": MACRO_PROVIDER,
            "category": "rates",
        },
    )
    payload = {
        "indicator": str(fixture["indicator"]),
        "value": fixture["value"],
        "unit": str(fixture["unit"]),
        "period": today_period(),
        "provider": str(fixture.get("provider", MACRO_PROVIDER)),
        "retrieved_at": iso_timestamp(),
        "missing_fields": [],
    }

    category = fixture.get("category")
    if category is not None:
        payload["category"] = str(category)

    validate_schema("canonical-macro-data", payload)
    return payload


def _is_empty_data_error(error: Exception) -> bool:
    message = str(error).lower()
    return error.__class__.__name__ == "EmptyDataError" or any(
        text in message
        for text in (
            "no data found",
            "returned empty",
            "results not found",
        )
    )


def _is_timeout_error(error: Exception) -> bool:
    message = str(error).lower()
    return "timed out" in message or "timeout" in message


class OpenBBLiveClient:
    def __init__(self) -> None:
        self._obb: Any | None = None

    def _require_key(self, env_name: str, provider: str) -> None:
        if str(os.environ.get(env_name, "")).strip():
            return
        raise ProviderIntegrationError(
            provider,
            error_code="AUTH_ERROR",
            message=f"{provider} credentials are required when DATA_OPENBB_FIXTURE_MODE=false.",
        )

    def _load_obb(self, provider: str) -> Any:
        if self._obb is not None:
            return self._obb

        try:
            import openbb  # type: ignore
        except ImportError as error:
            raise ProviderIntegrationError(
                provider,
                error_code="INTERNAL_ERROR",
                status_code=500,
                message="Pinned OpenBB dependency is not installed for live mode.",
            ) from error

        self._obb = openbb.obb
        return self._obb

    def _normalize_records(self, obbject: Any) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        raw_results = getattr(obbject, "results", None) or []
        records: list[dict[str, Any]] = []
        for item in raw_results:
            if hasattr(item, "model_dump"):
                records.append(item.model_dump(mode="python"))
            elif isinstance(item, Mapping):
                records.append(dict(item))

        extra = getattr(obbject, "extra", {}) or {}
        metadata = extra.get("results_metadata", {})
        return records, metadata if isinstance(metadata, dict) else {}

    def _classify_error(self, provider: str, route: str, error: Exception) -> ProviderIntegrationError:
        if _is_timeout_error(error):
            return ProviderIntegrationError(
                provider,
                error_code="TIMEOUT",
                message=f"{provider} timed out while executing {route}.",
            )

        error_name = error.__class__.__name__
        error_message = str(error).lower()
        if error_name == "UnauthorizedError" or "unauthorized" in error_message:
            return ProviderIntegrationError(
                provider,
                error_code="AUTH_ERROR",
                message=f"{provider} rejected credentials for {route}.",
            )

        return ProviderIntegrationError(
            provider,
            error_code="PROVIDER_OUTAGE",
            message=f"{provider} request failed for {route}.",
        )

    def _fetch_records(
        self,
        provider: str,
        route: str,
        query: Any,
        *,
        allow_empty: bool,
    ) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        try:
            obbject = query()
        except Exception as error:  # pragma: no cover - exercised in service tests via fake clients
            if allow_empty and _is_empty_data_error(error):
                return [], {}
            raise self._classify_error(provider, route, error) from error

        records, metadata = self._normalize_records(obbject)
        if records or allow_empty:
            return records, metadata
        raise ProviderIntegrationError(
            provider,
            error_code="PROVIDER_OUTAGE",
            message=f"{provider} returned no usable rows for {route}.",
        )

    def fetch_company_records(self, ticker: str) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
        self._require_key("FMP_API_KEY", COMPANY_PROVIDER)
        obb = self._load_obb(COMPANY_PROVIDER)

        income_records, _ = self._fetch_records(
            COMPANY_PROVIDER,
            "equity.fundamental.income",
            lambda: obb.equity.fundamental.income(
                symbol=ticker,
                provider="fmp",
                period="annual",
                limit=1,
            ),
            allow_empty=True,
        )
        balance_records, _ = self._fetch_records(
            COMPANY_PROVIDER,
            "equity.fundamental.balance",
            lambda: obb.equity.fundamental.balance(
                symbol=ticker,
                provider="fmp",
                period="annual",
                limit=1,
            ),
            allow_empty=True,
        )
        cash_records, _ = self._fetch_records(
            COMPANY_PROVIDER,
            "equity.fundamental.cash",
            lambda: obb.equity.fundamental.cash(
                symbol=ticker,
                provider="fmp",
                period="annual",
                limit=1,
            ),
            allow_empty=True,
        )

        return (
            income_records[0] if income_records else {},
            balance_records[0] if balance_records else {},
            cash_records[0] if cash_records else {},
        )

    def fetch_macro_records(self) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        self._require_key("FMP_API_KEY", MACRO_PROVIDER)
        obb = self._load_obb(MACRO_PROVIDER)

        start_date = (date.today() - timedelta(days=30)).isoformat()
        end_date = date.today().isoformat()
        return self._fetch_records(
            MACRO_PROVIDER,
            "fixedincome.government.treasury_rates",
            lambda: obb.fixedincome.government.treasury_rates(
                provider="fmp",
                start_date=start_date,
                end_date=end_date,
            ),
            allow_empty=False,
        )

    def fetch_earnings_calendar_rows(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        try:
            import yfinance as yf  # type: ignore
        except ImportError as error:
            raise ProviderIntegrationError(
                CALENDAR_PROVIDER,
                error_code="INTERNAL_ERROR",
                status_code=500,
                message="yfinance is not installed for live calendar mode.",
            ) from error

        try:
            calendars = yf.Calendars(start_date, end_date)
            raw_result = calendars.get_earnings_calendar()
        except Exception as error:  # pragma: no cover - exercised in service tests via fake client
            raise self._classify_error(CALENDAR_PROVIDER, "Calendars.get_earnings_calendar", error) from error

        return _calendar_row_candidates(raw_result)

    def fetch_official_company_truth(self, ticker: str) -> dict[str, Any]:
        cik = OFFICIAL_COMPANY_TICKERS.get(ticker)
        if not cik:
            return _official_company_default_fixture(ticker)

        headers = {
            "user-agent": os.environ.get(
                "SEC_USER_AGENT",
                "Thesis Phase6 official-source smoke contact@example.com",
            ),
            "accept": "application/json",
        }
        retrieved_at = iso_timestamp()
        submissions_url = f"https://data.sec.gov/submissions/CIK{cik}.json"
        facts_url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
        try:
            submissions = self._fetch_json(submissions_url, headers=headers)
            facts = self._fetch_json(facts_url, headers=headers)
        except (OSError, URLError, TimeoutError) as error:
            raise ProviderIntegrationError(
                OFFICIAL_COMPANY_PROVIDER,
                error_code="PROVIDER_OUTAGE",
                message="SEC EDGAR official company truth is unavailable.",
            ) from error

        company_name = str(submissions.get("name") or ticker)
        recent = submissions.get("filings", {}).get("recent", {}) if isinstance(submissions.get("filings"), dict) else {}
        forms = recent.get("form", []) if isinstance(recent, dict) else []
        filing_dates = recent.get("filingDate", []) if isinstance(recent, dict) else []
        accession_numbers = recent.get("accessionNumber", []) if isinstance(recent, dict) else []
        filings: list[dict[str, Any]] = []
        for index, form in enumerate(forms if isinstance(forms, list) else []):
            if not isinstance(form, str):
                continue
            filing_date = filing_dates[index] if isinstance(filing_dates, list) and index < len(filing_dates) else None
            accession = (
                accession_numbers[index]
                if isinstance(accession_numbers, list) and index < len(accession_numbers)
                else None
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

        source = _official_source_reference(
            source_id=f"SEC_COMPANY_{ticker}",
            source_family="sec_edgar",
            source_name=f"SEC EDGAR company truth for {ticker}",
            source_url=submissions_url,
            agency="SEC",
            agency_series_id=f"CIK{cik}",
        )
        retrieval = _official_retrieval_metadata(
            source=source,
            retrieved_at=retrieved_at,
            retrieval_status="fresh" if filings else "partial",
        )
        missing_fields = []
        if not filings:
            missing_fields.append(
                _missing_field(
                    "filings",
                    "not_reported",
                    "SEC submissions did not include recent filing rows.",
                    source_id=source["source_id"],
                )
            )
        event = _build_canonical_event(
            event_id=f"official-company-{ticker.lower()}-{filings[0]['accession_number'] if filings else 'latest'}",
            family="filing_posted",
            subject_type="ticker",
            subject_id=ticker,
            title=f"{ticker} latest SEC filing",
            occurred_at=_iso_datetime_from_date(filings[0].get("filing_date") if filings else None),
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
                "taxonomy_count": len(facts.get("facts", {})) if isinstance(facts.get("facts"), dict) else 0,
            },
            "canonical_events": [event],
        }

    def fetch_official_macro_truth(self, *, as_of: str | None = None) -> dict[str, Any]:
        # M1 keeps live official macro retrieval deterministic by contract shape; later
        # milestones may add per-agency parsers without changing the public payload.
        return _official_macro_default_fixture(as_of=as_of)

    def fetch_official_structural_context(
        self,
        *,
        ticker: str | None = None,
        country: str | None = None,
        subject_type: str | None = None,
        as_of: str | None = None,
    ) -> dict[str, Any]:
        replay_as_of = _resolved_as_of_date(as_of)
        retrieved_at = iso_timestamp()
        resolved_subject_type, subject_id, issuer_metadata, country_metadata = _structural_subject_metadata(
            ticker=ticker,
            country=country,
            subject_type=subject_type,
        )
        geography = str(country_metadata["country_name"])
        country_code = str(country_metadata["country_code"])
        headers = {"accept": "application/json"}

        observations: list[dict[str, Any]] = []
        retrievals: list[dict[str, Any]] = []
        omissions: list[dict[str, Any]] = []

        for item in WORLD_BANK_STRUCTURAL_REGISTRY:
            try:
                payload = self._fetch_json_list(
                    f"https://api.worldbank.org/v2/country/{country_code}/indicator/{item['indicator']}?format=json&per_page=6",
                    headers=headers,
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
                    if not _structural_period_within_as_of(row_period, replay_as_of):
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
                    _structural_omission(
                        omission_id=f"world-bank-{item['family']}-missing",
                        family=str(item["family"]),
                        source_family="world_bank",
                        reason_code="not_reported",
                        reason_text=f"World Bank returned no value for {item['label']} in this run.",
                        blocking=False,
                    )
                )
                continue

            observation = _structural_observation(
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
                _structural_omission(
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

        payload = {
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
        if payload["issuer_metadata"] is None:
            payload.pop("issuer_metadata")
        validate_schema("structural-context", payload)
        return payload

    def _fetch_json(self, url: str, *, headers: Mapping[str, str]) -> dict[str, Any]:
        request = Request(url, headers=dict(headers))
        with urlopen(request, timeout=15) as response:
            payload = json.loads(response.read().decode("utf-8"))
            if not isinstance(payload, dict):
                raise OSError("official source returned a non-object JSON payload")
            return payload

    def _fetch_json_list(self, url: str, *, headers: Mapping[str, str]) -> list[Any]:
        request = Request(url, headers=dict(headers))
        with urlopen(request, timeout=15) as response:
            payload = json.loads(response.read().decode("utf-8"))
            if not isinstance(payload, list):
                raise OSError("official source returned a non-array JSON payload")
            return payload


class DataOpenBBService:
    def __init__(
        self,
        settings: Settings | None = None,
        rate_limiter: Any | None = None,
        live_client: OpenBBLiveClient | None = None,
    ) -> None:
        self.settings = settings or Settings.from_env(os.environ)
        self.rate_limiter = rate_limiter or RateLimiter(settings=self.settings)
        self._live_client = live_client

    def live_client(self) -> OpenBBLiveClient:
        if self._live_client is None:
            self._live_client = OpenBBLiveClient()
        return self._live_client

    def get_company_finance(self, ticker: str | None, request_id: str) -> tuple[int, dict[str, Any]]:
        return self._with_rate_limit(
            provider=COMPANY_PROVIDER,
            rate_limit_key=COMPANY_RATE_LIMIT_KEY,
            request_id=request_id,
            func=lambda: self._company_finance_response(ticker, request_id),
        )

    def get_macro(self, scope: str | None, request_id: str) -> tuple[int, dict[str, Any]]:
        return self._with_rate_limit(
            provider=MACRO_PROVIDER,
            rate_limit_key=MACRO_RATE_LIMIT_KEY,
            request_id=request_id,
            func=lambda: self._macro_response(scope, request_id),
        )

    def get_official_company_truth(self, ticker: str | None, request_id: str) -> tuple[int, dict[str, Any]]:
        return self._official_company_truth_response(ticker, request_id)

    def get_official_macro_truth(
        self, scope: str | None, as_of: str | None, request_id: str
    ) -> tuple[int, dict[str, Any]]:
        return self._official_macro_truth_response(scope, as_of, request_id)

    def get_official_structural_context(
        self,
        ticker: str | None,
        country: str | None,
        subject_type: str | None,
        as_of: str | None,
        request_id: str,
    ) -> tuple[int, dict[str, Any]]:
        return self._official_structural_context_response(
            ticker=ticker,
            country=country,
            subject_type=subject_type,
            as_of=as_of,
            request_id=request_id,
        )

    def get_calendar_earnings(
        self,
        start_date: str | None,
        end_date: str | None,
        request_id: str,
    ) -> tuple[int, dict[str, Any]]:
        return self._with_rate_limit(
            provider=CALENDAR_PROVIDER,
            rate_limit_key=CALENDAR_RATE_LIMIT_KEY,
            request_id=request_id,
            func=lambda: self._calendar_earnings_response(start_date, end_date, request_id),
        )

    def run_historical_sync(
        self,
        *,
        request_id: str,
        include_transcripts: bool | None = None,
    ) -> tuple[int, dict[str, Any]]:
        started_at = time.perf_counter()
        log(
            "INFO",
            "Historical delta sync requested",
            request_id=request_id,
            include_transcripts=include_transcripts,
        )

        try:
            summary = run_historical_delta_sync(include_transcripts=include_transcripts)
        except Exception as error:
            log(
                "ERROR",
                "Historical delta sync failed",
                request_id=request_id,
                error_message=str(error),
            )
            response = error_response(
                status_code=500,
                request_id=request_id,
                message="historical delta sync failed",
                error_code="INTERNAL_ERROR",
                error=error,
            )
            return response.status_code, response.body

        latency_ms = int((time.perf_counter() - started_at) * 1000)
        log(
            "INFO",
            "Historical delta sync succeeded",
            request_id=request_id,
            latency_ms=latency_ms,
            sec_rows_written=summary.get("sec_rows_written"),
            transcript_rows_written=summary.get("transcript_rows_written"),
            transcript_sync_status=summary.get("transcript_sync_status"),
            transcript_snapshot_revision=summary.get("transcript_snapshot_revision"),
        )

        return 200, success_response(
            request_id=request_id,
            data=summary,
            provider="sec_edgar",
            retrieved_at=iso_timestamp(),
        )

    def _with_rate_limit(
        self,
        *,
        provider: str,
        rate_limit_key: str | None = None,
        request_id: str,
        func: Any,
    ) -> tuple[int, dict[str, Any]]:
        try:
            self.rate_limiter.acquire(provider, rate_limit_key=rate_limit_key)
        except RateLimitExceededError as error:
            log(
                "WARN",
                "Provider rate limit hit",
                request_id=request_id,
                provider=error.provider,
                retry_after_seconds=error.retry_after_seconds,
            )
            response = error_response(
                status_code=429,
                request_id=request_id,
                message="provider rate limit exceeded",
                error_code="RATE_LIMIT",
                provider=error.provider,
            )
            return response.status_code, response.body

        return func()

    def _company_finance_response(self, ticker: str | None, request_id: str) -> tuple[int, dict[str, Any]]:
        normalized_ticker = (ticker or "").strip().upper()

        if not normalized_ticker:
            response = error_response(
                status_code=400,
                request_id=request_id,
                message="ticker query parameter is required",
                provider=COMPANY_PROVIDER,
            )
            return response.status_code, response.body

        started_at = time.perf_counter()
        log(
            "INFO",
            "Data retrieval started",
            request_id=request_id,
            provider=COMPANY_PROVIDER,
            ticker=normalized_ticker,
            dataset=FINANCE_DATASET,
        )

        try:
            payload = build_company_payload(normalized_ticker, service=self)
        except ProviderIntegrationError as error:
            log(
                "ERROR",
                "Source unreachable / parser failed",
                request_id=request_id,
                provider=error.provider,
                ticker=normalized_ticker,
                dataset=FINANCE_DATASET,
                error_message=str(error),
            )
            response = error_response(
                status_code=error.status_code,
                request_id=request_id,
                message=str(error),
                error_code=error.error_code,
                provider=error.provider,
            )
            return response.status_code, response.body

        missing_fields = payload["missing_fields"]
        if missing_fields:
            log(
                "WARN",
                "Missing fields detected",
                request_id=request_id,
                provider=payload["provider"],
                ticker=normalized_ticker,
                missing_fields=missing_fields,
            )

        latency_ms = int((time.perf_counter() - started_at) * 1000)
        log(
            "INFO",
            "Data retrieval succeeded",
            request_id=request_id,
            provider=payload["provider"],
            ticker=normalized_ticker,
            dataset=FINANCE_DATASET,
            record_count=1,
            latency_ms=latency_ms,
        )

        response = success_response(
            request_id=request_id,
            data=payload,
            provider=payload["provider"],
            retrieved_at=payload["retrieved_at"],
        )
        return 200, response

    def _macro_response(self, scope: str | None, request_id: str) -> tuple[int, dict[str, Any]]:
        normalized_scope = (scope or "").strip().lower()

        if normalized_scope != "daily":
            response = error_response(
                status_code=400,
                request_id=request_id,
                message="scope query parameter must be 'daily'",
                provider=MACRO_PROVIDER,
            )
            return response.status_code, response.body

        started_at = time.perf_counter()
        log(
            "INFO",
            "Data retrieval started",
            request_id=request_id,
            provider=MACRO_PROVIDER,
            dataset=MACRO_DATASET,
        )

        try:
            payload = build_macro_payload(service=self)
        except ProviderIntegrationError as error:
            log(
                "ERROR",
                "Source unreachable / parser failed",
                request_id=request_id,
                provider=error.provider,
                dataset=MACRO_DATASET,
                error_message=str(error),
            )
            response = error_response(
                status_code=error.status_code,
                request_id=request_id,
                message=str(error),
                error_code=error.error_code,
                provider=error.provider,
            )
            return response.status_code, response.body

        latency_ms = int((time.perf_counter() - started_at) * 1000)
        log(
            "INFO",
            "Data retrieval succeeded",
            request_id=request_id,
            provider=payload["provider"],
            dataset=MACRO_DATASET,
            record_count=1,
            latency_ms=latency_ms,
        )

        response = success_response(
            request_id=request_id,
            data=payload,
            provider=payload["provider"],
            retrieved_at=payload["retrieved_at"],
        )
        return 200, response

    def _official_company_truth_response(self, ticker: str | None, request_id: str) -> tuple[int, dict[str, Any]]:
        normalized_ticker = (ticker or "").strip().upper()

        if not normalized_ticker:
            response = error_response(
                status_code=400,
                request_id=request_id,
                message="ticker query parameter is required",
                provider=OFFICIAL_COMPANY_PROVIDER,
            )
            return response.status_code, response.body

        started_at = time.perf_counter()
        log(
            "INFO",
            "Official company truth retrieval started",
            request_id=request_id,
            provider=OFFICIAL_COMPANY_PROVIDER,
            ticker=normalized_ticker,
            dataset="official_company_truth",
        )

        try:
            payload = build_official_company_payload(normalized_ticker, service=self)
        except ProviderIntegrationError as error:
            log(
                "ERROR",
                "Official company truth retrieval failed",
                request_id=request_id,
                provider=error.provider,
                ticker=normalized_ticker,
                error_message=str(error),
            )
            response = error_response(
                status_code=error.status_code,
                request_id=request_id,
                message=str(error),
                error_code=error.error_code,
                provider=error.provider,
            )
            return response.status_code, response.body

        latency_ms = int((time.perf_counter() - started_at) * 1000)
        log(
            "INFO",
            "Official company truth retrieval succeeded",
            request_id=request_id,
            provider=OFFICIAL_COMPANY_PROVIDER,
            ticker=normalized_ticker,
            dataset="official_company_truth",
            event_count=len(payload.get("canonical_events", [])),
            latency_ms=latency_ms,
        )

        response = success_response(
            request_id=request_id,
            data=payload,
            provider=OFFICIAL_COMPANY_PROVIDER,
            retrieved_at=str(payload["retrieved_at"]),
        )
        return 200, response

    def _official_macro_truth_response(
        self, scope: str | None, as_of: str | None, request_id: str
    ) -> tuple[int, dict[str, Any]]:
        normalized_scope = (scope or "").strip().lower()
        normalized_as_of = _normalize_iso_date(as_of)

        if normalized_scope != "daily":
            response = error_response(
                status_code=400,
                request_id=request_id,
                message="scope query parameter must be 'daily'",
                provider=OFFICIAL_MACRO_PROVIDER,
            )
            return response.status_code, response.body

        started_at = time.perf_counter()
        log(
            "INFO",
            "Official macro truth retrieval started",
            request_id=request_id,
            provider=OFFICIAL_MACRO_PROVIDER,
            dataset="official_macro_truth",
        )

        try:
            payload = build_official_macro_payload(as_of=normalized_as_of, service=self)
        except ProviderIntegrationError as error:
            log(
                "ERROR",
                "Official macro truth retrieval failed",
                request_id=request_id,
                provider=error.provider,
                error_message=str(error),
            )
            response = error_response(
                status_code=error.status_code,
                request_id=request_id,
                message=str(error),
                error_code=error.error_code,
                provider=error.provider,
            )
            return response.status_code, response.body

        latency_ms = int((time.perf_counter() - started_at) * 1000)
        log(
            "INFO",
            "Official macro truth retrieval succeeded",
            request_id=request_id,
            provider=OFFICIAL_MACRO_PROVIDER,
            dataset="official_macro_truth",
            as_of=normalized_as_of or None,
            event_count=len(payload.get("canonical_events", [])),
            latency_ms=latency_ms,
        )

        response = success_response(
            request_id=request_id,
            data=payload,
            provider=OFFICIAL_MACRO_PROVIDER,
            retrieved_at=str(payload["retrieved_at"]),
        )
        return 200, response

    def _official_structural_context_response(
        self,
        *,
        ticker: str | None,
        country: str | None,
        subject_type: str | None,
        as_of: str | None,
        request_id: str,
    ) -> tuple[int, dict[str, Any]]:
        normalized_ticker = (ticker or "").strip().upper()
        normalized_country = (country or "").strip().upper()
        normalized_subject_type = (subject_type or "").strip().lower() or None
        normalized_as_of = _normalize_iso_date(as_of)

        if not normalized_ticker and not normalized_country:
            response = error_response(
                status_code=400,
                request_id=request_id,
                message="ticker or country query parameter is required",
                provider=OFFICIAL_STRUCTURAL_PROVIDER,
            )
            return response.status_code, response.body

        started_at = time.perf_counter()
        log(
            "INFO",
            "Official structural context retrieval started",
            request_id=request_id,
            provider=OFFICIAL_STRUCTURAL_PROVIDER,
            ticker=normalized_ticker or None,
            country=normalized_country or None,
            dataset="official_structural_context",
        )

        try:
            payload = build_official_structural_payload(
                ticker=normalized_ticker or None,
                country=normalized_country or None,
                subject_type=normalized_subject_type,
                as_of=normalized_as_of,
                service=self,
            )
        except ProviderIntegrationError as error:
            log(
                "ERROR",
                "Official structural context retrieval failed",
                request_id=request_id,
                provider=error.provider,
                ticker=normalized_ticker or None,
                country=normalized_country or None,
                error_message=str(error),
            )
            response = error_response(
                status_code=error.status_code,
                request_id=request_id,
                message=str(error),
                error_code=error.error_code,
                provider=error.provider,
            )
            return response.status_code, response.body

        latency_ms = int((time.perf_counter() - started_at) * 1000)
        log(
            "INFO",
            "Official structural context retrieval succeeded",
            request_id=request_id,
            provider=OFFICIAL_STRUCTURAL_PROVIDER,
            ticker=normalized_ticker or None,
            country=normalized_country or None,
            dataset="official_structural_context",
            as_of=normalized_as_of or None,
            observation_count=len(payload.get("observations", [])),
            omission_count=len(payload.get("omissions", [])),
            latency_ms=latency_ms,
        )

        response = success_response(
            request_id=request_id,
            data=payload,
            provider=OFFICIAL_STRUCTURAL_PROVIDER,
            retrieved_at=iso_timestamp(),
        )
        return 200, response

    def _calendar_earnings_response(
        self,
        start_date: str | None,
        end_date: str | None,
        request_id: str,
    ) -> tuple[int, dict[str, Any]]:
        normalized_start = _normalize_iso_date(start_date) or today_period()
        normalized_end = _normalize_iso_date(end_date) or _add_days_to_iso_date(normalized_start, 14)

        if normalized_start > normalized_end:
            response = error_response(
                status_code=422,
                request_id=request_id,
                message="start_date must be on or before end_date.",
                provider=CALENDAR_PROVIDER,
            )
            return response.status_code, response.body

        started_at = time.perf_counter()
        log(
            "INFO",
            "Data retrieval started",
            request_id=request_id,
            provider=CALENDAR_PROVIDER,
            dataset=CALENDAR_DATASET,
        )

        try:
            payload = build_calendar_payload(
                start_date=normalized_start,
                end_date=normalized_end,
                service=self,
            )
        except ProviderIntegrationError as error:
            log(
                "ERROR",
                "Source unreachable / parser failed",
                request_id=request_id,
                provider=error.provider,
                dataset=CALENDAR_DATASET,
                error_message=str(error),
            )
            response = error_response(
                status_code=error.status_code,
                request_id=request_id,
                message=str(error),
                error_code=error.error_code,
                provider=error.provider,
            )
            return response.status_code, response.body

        latency_ms = int((time.perf_counter() - started_at) * 1000)
        log(
            "INFO",
            "Data retrieval succeeded",
            request_id=request_id,
            provider=CALENDAR_PROVIDER,
            dataset=CALENDAR_DATASET,
            record_count=len(payload["events"]),
            latency_ms=latency_ms,
        )

        response = success_response(
            request_id=request_id,
            data=payload,
            provider=CALENDAR_PROVIDER,
            retrieved_at=iso_timestamp(),
        )
        return 200, response


_default_service: DataOpenBBService | None = None


def default_service() -> DataOpenBBService:
    global _default_service

    if _default_service is None:
        _default_service = DataOpenBBService()

    return _default_service


def build_company_response(ticker: str | None, request_id: str) -> ResponsePayload:
    status_code, body = default_service().get_company_finance(ticker, request_id)
    return ResponsePayload(status_code=status_code, body=body)


def build_macro_response(scope: str | None, request_id: str) -> ResponsePayload:
    status_code, body = default_service().get_macro(scope, request_id)
    return ResponsePayload(status_code=status_code, body=body)


def build_official_company_response(ticker: str | None, request_id: str) -> ResponsePayload:
    status_code, body = default_service().get_official_company_truth(ticker, request_id)
    return ResponsePayload(status_code=status_code, body=body)


def build_official_macro_response(scope: str | None, as_of: str | None, request_id: str) -> ResponsePayload:
    status_code, body = default_service().get_official_macro_truth(scope, as_of, request_id)
    return ResponsePayload(status_code=status_code, body=body)


def build_official_structural_response(
    ticker: str | None,
    country: str | None,
    subject_type: str | None,
    as_of: str | None,
    request_id: str,
) -> ResponsePayload:
    status_code, body = default_service().get_official_structural_context(
        ticker,
        country,
        subject_type,
        as_of,
        request_id,
    )
    return ResponsePayload(status_code=status_code, body=body)


def not_found_response(request_id: str) -> ResponsePayload:
    response = error_response(
        status_code=404,
        request_id=request_id,
        message="route not found",
    )
    return response


def method_not_allowed_response(request_id: str) -> ResponsePayload:
    response = error_response(
        status_code=405,
        request_id=request_id,
        message="method not allowed",
    )
    return response


def internal_error_response(request_id: str, error: Exception) -> ResponsePayload:
    return error_response(
        status_code=500,
        request_id=request_id,
        message="internal service error",
        error_code="INTERNAL_ERROR",
        error=error,
    )


def schema_error_response(request_id: str, error: SchemaValidationError) -> ResponsePayload:
    log(
        "ERROR",
        "Schema validation failed",
        request_id=request_id,
        contract="service-response",
        validation_errors=[str(error)],
    )
    return error_response(
        status_code=500,
        request_id=request_id,
        message="schema validation failed",
        error_code="SCHEMA_MISMATCH",
    )


def success_response(
    *,
    request_id: str,
    data: dict[str, Any],
    provider: str,
    retrieved_at: str,
) -> dict[str, Any]:
    response = {
        "ok": True,
        "data": data,
        "error_flag": False,
        "request_id": request_id,
        "provider": provider,
        "retrieved_at": retrieved_at,
    }
    validate_schema("service-response", response)
    return response


def error_response(
    *,
    status_code: int,
    request_id: str,
    message: str,
    error_code: str | None = None,
    error: Exception | None = None,
    provider: str | None = None,
) -> ResponsePayload:
    if error is not None:
        log(
            "ERROR",
            "Source unreachable / parser failed",
            request_id=request_id,
            source=SERVICE_NAME,
            error_message=str(error),
        )

    body: dict[str, Any] = {
        "ok": False,
        "data": None,
        "error_flag": True,
        "error_message": message,
        "request_id": request_id,
        "retrieved_at": iso_timestamp(),
    }

    if error_code is not None:
        body["error_code"] = error_code

    if provider is not None:
        body["provider"] = provider

    validate_schema("service-response", body)
    return ResponsePayload(status_code=status_code, body=body)


def build_company_payload(ticker: str, *, service: DataOpenBBService | None = None) -> dict[str, Any]:
    active_service = service or default_service()
    if active_service.settings.fixture_mode:
        return _fixture_company_payload(ticker)

    income_record, balance_record, cash_record = active_service.live_client().fetch_company_records(ticker)
    return _normalize_company_records(
        ticker,
        income_record=income_record,
        balance_record=balance_record,
        cash_record=cash_record,
    )


def build_macro_payload(*, service: DataOpenBBService | None = None) -> dict[str, Any]:
    active_service = service or default_service()
    if active_service.settings.fixture_mode:
        return _fixture_macro_payload()

    records, metadata = active_service.live_client().fetch_macro_records()
    return _normalize_macro_records(records, metadata)


def build_official_company_payload(ticker: str, *, service: DataOpenBBService | None = None) -> dict[str, Any]:
    active_service = service or default_service()
    if active_service.settings.fixture_mode:
        return _fixture_official_company_payload(ticker)

    return active_service.live_client().fetch_official_company_truth(ticker)


def build_official_macro_payload(
    *, as_of: str | None = None, service: DataOpenBBService | None = None
) -> dict[str, Any]:
    active_service = service or default_service()
    if active_service.settings.fixture_mode:
        return _fixture_official_macro_payload(as_of=as_of)

    return active_service.live_client().fetch_official_macro_truth(as_of=as_of)


def build_official_structural_payload(
    *,
    ticker: str | None = None,
    country: str | None = None,
    subject_type: str | None = None,
    as_of: str | None = None,
    service: DataOpenBBService | None = None,
) -> dict[str, Any]:
    active_service = service or default_service()
    if active_service.settings.fixture_mode:
        return _fixture_official_structural_payload(
            ticker=ticker,
            country=country,
            subject_type=subject_type,
            as_of=as_of,
        )

    return active_service.live_client().fetch_official_structural_context(
        ticker=ticker,
        country=country,
        subject_type=subject_type,
        as_of=as_of,
    )


def build_calendar_payload(
    *,
    start_date: str,
    end_date: str,
    service: DataOpenBBService | None = None,
) -> dict[str, Any]:
    active_service = service or default_service()
    if active_service.settings.fixture_mode:
        fixture_payload = _load_calendar_fixture_payload()
        events = _normalize_earnings_calendar_rows(
            [dict(event) for event in fixture_payload.get("events", []) if isinstance(event, dict)],
            start_date=start_date,
            end_date=end_date,
        )
        return {
            "events": events,
        }

    rows = active_service.live_client().fetch_earnings_calendar_rows(start_date, end_date)
    events = _normalize_earnings_calendar_rows(rows, start_date=start_date, end_date=end_date)
    return {
        "events": events,
    }
