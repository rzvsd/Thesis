"""Provider-agnostic end-of-day (EOD) price interface.

Every Thesis price consumer (Pulse followed-name rows, contrarian alerts,
kill-switch price rules, Deep Dive valuation ratios and DCF spot) reads prices
through GET /v1/market/eod-prices on this service. No other path may fetch prices.

PRICE_PROVIDER selects the adapter. The default is "none": every ticker comes
back unavailable, so consumers keep their hide-when-missing behavior.

The licensed provider is pending an owner decision
(Decisions/ph7/ph7_ADR-001-licensed-eod-price-provider.md). To add one:

1. Write an adapter class with a ``name`` and a ``fetch_eod(tickers)`` method
   that returns ``{ticker: EodPrice}`` for the tickers it found. Leave out
   tickers it has no close for. Raise on transport or auth failure.
2. Read the vendor key from PRICE_PROVIDER_API_KEY. Never commit keys.
3. Register the class in ``ADAPTERS`` under the PRICE_PROVIDER value.

Template::

    class ExampleVendorAdapter:
        name = "example_vendor"

        def __init__(self) -> None:
            self.api_key = os.environ["PRICE_PROVIDER_API_KEY"]

        def fetch_eod(self, tickers: list[str]) -> dict[str, EodPrice]:
            rows = ...  # one batched call to the vendor's EOD endpoint
            return {
                row["symbol"]: EodPrice(
                    close=row["close"],
                    previous_close=row.get("prev_close"),
                    as_of=row["date"],
                    currency=row.get("currency"),
                )
                for row in rows
            }
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Any, Callable, Protocol

DEFAULT_PRICE_PROVIDER = "none"
MAX_TICKERS = 50
TICKER_PATTERN = re.compile(r"^[A-Z][A-Z0-9.-]{0,9}$")


@dataclass(frozen=True)
class EodPrice:
    close: float
    as_of: str  # trading date (YYYY-MM-DD) of the close
    previous_close: float | None = None
    currency: str | None = None


class PriceAdapter(Protocol):
    name: str

    def fetch_eod(self, tickers: list[str]) -> dict[str, EodPrice]: ...


class NoPriceAdapter:
    name = "none"

    def fetch_eod(self, tickers: list[str]) -> dict[str, EodPrice]:  # noqa: ARG002
        return {}


ADAPTERS: dict[str, Callable[[], PriceAdapter]] = {
    "none": NoPriceAdapter,
}


def resolve_price_adapter(provider: str | None = None) -> PriceAdapter:
    name = (
        (provider if provider is not None else os.environ.get("PRICE_PROVIDER", ""))
        .strip()
        .lower()
    )
    factory = ADAPTERS.get(name or DEFAULT_PRICE_PROVIDER)
    if factory is None:
        raise ValueError(f"unknown PRICE_PROVIDER: {name}")
    return factory()


def parse_tickers(raw: str | None) -> list[str]:
    tickers: list[str] = []
    for part in (raw or "").split(","):
        ticker = part.strip().upper()
        if not ticker:
            continue
        if not TICKER_PATTERN.match(ticker):
            raise ValueError(f"invalid ticker: {ticker}")
        if ticker not in tickers:
            tickers.append(ticker)
    if not tickers:
        raise ValueError("tickers query parameter is required")
    if len(tickers) > MAX_TICKERS:
        raise ValueError(f"at most {MAX_TICKERS} tickers are allowed per request")
    return tickers


def build_eod_prices_payload(
    tickers: list[str], adapter: PriceAdapter
) -> tuple[dict[str, Any], str | None]:
    """Return the payload and, when the provider call failed, the error message."""
    error_message: str | None = None
    if adapter.name == DEFAULT_PRICE_PROVIDER:
        missing_reason = "price_provider_not_configured"
        found: dict[str, EodPrice] = {}
    else:
        missing_reason = "price_not_found"
        try:
            found = adapter.fetch_eod(tickers)
        except Exception as error:  # provider failure must degrade to "unavailable"
            missing_reason = "price_provider_error"
            error_message = str(error)
            found = {}

    prices: list[dict[str, Any]] = []
    for ticker in tickers:
        price = found.get(ticker)
        if price is None:
            prices.append(
                {"ticker": ticker, "available": False, "reason": missing_reason}
            )
            continue
        entry: dict[str, Any] = {
            "ticker": ticker,
            "available": True,
            "close": price.close,
            "as_of": price.as_of,
        }
        if price.previous_close is not None:
            entry["previous_close"] = price.previous_close
        if price.currency is not None:
            entry["currency"] = price.currency
        prices.append(entry)

    return {
        "provider": adapter.name,
        "price_type": "end_of_day",
        "prices": prices,
    }, error_message
