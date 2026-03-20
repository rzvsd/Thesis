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

# Make the shared redis-client package importable.
_PACKAGES_ROOT = str(Path(__file__).resolve().parents[3] / "packages" / "redis-client")
if _PACKAGES_ROOT not in sys.path:
    sys.path.insert(0, _PACKAGES_ROOT)

from client import RedisClient  # noqa: E402

try:
    from .validation import SchemaValidationError, validate_schema
except ImportError:  # pragma: no cover - supports direct src imports in sibling tests
    from validation import SchemaValidationError, validate_schema


SERVICE_NAME = "data-openbb"
DEFAULT_PORT = int(os.environ.get("PORT", "3003"))
FINANCE_DATASET = "company_finance"
MACRO_DATASET = "macro_daily"
COMPANY_PROVIDER = "FMP"
MACRO_PROVIDER = "FMP"
COMPANY_RATE_LIMIT_KEY = "FMP_FINANCE"
MACRO_RATE_LIMIT_KEY = "FMP_MACRO"
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
            polygon_rate_limit_per_minute=read_int("POLYGON_RATE_LIMIT_PER_MINUTE", 5),
            alpha_vantage_rate_limit_per_minute=read_int("ALPHA_VANTAGE_RATE_LIMIT_PER_MINUTE", 5),
        )

    def limit_for(self, provider: str) -> int:
        normalized = provider.upper()
        limits = {
            "FMP": self.fmp_finance_rate_limit_per_minute,
            "FMP_FINANCE": self.fmp_finance_rate_limit_per_minute,
            "FMP_MACRO": self.fmp_macro_rate_limit_per_minute,
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
