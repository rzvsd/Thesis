from __future__ import annotations

import json
import os
import unittest
from unittest.mock import patch
from urllib.request import urlopen

from src.server import start_server, stop_server
from src.service import (
    FINANCE_FIELDS,
    DataOpenBBService,
    RateLimitExceededError,
    RateLimiter,
    Settings,
)


class NoopRateLimiter:
    def acquire(self, provider: str, *, rate_limit_key: str | None = None) -> None:  # noqa: ARG002
        return


class FakeLiveClient:
    def __init__(
        self,
        *,
        company_records: tuple[dict[str, object], dict[str, object], dict[str, object]] | None = None,
        macro_records: tuple[list[dict[str, object]], dict[str, object]] | None = None,
    ) -> None:
        self.company_records = company_records or ({}, {}, {})
        self.macro_records = macro_records or ([], {})

    def fetch_company_records(self, ticker: str) -> tuple[dict[str, object], dict[str, object], dict[str, object]]:  # noqa: ARG002
        return self.company_records

    def fetch_macro_records(self) -> tuple[list[dict[str, object]], dict[str, object]]:
        return self.macro_records


class DataOpenbbEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        settings = Settings(fixture_mode=True)
        service = DataOpenBBService(settings=settings, rate_limiter=NoopRateLimiter())
        cls.server = start_server(0, data_service=service)
        cls.base_url = f"http://127.0.0.1:{cls.server.server_address[1]}"

    @classmethod
    def tearDownClass(cls) -> None:
        stop_server(cls.server)

    def request_json(self, path: str) -> tuple[int, dict[str, object]]:
        with urlopen(f"{self.base_url}{path}") as response:
            payload = json.loads(response.read().decode("utf-8"))
            return response.status, payload

    def test_health_returns_expected_payload(self) -> None:
        status, payload = self.request_json("/health")

        self.assertEqual(status, 200)
        self.assertEqual(payload, {"status": "ok"})

    def test_company_finance_returns_service_response_envelope(self) -> None:
        status, payload = self.request_json("/v1/finance/company?ticker=AAPL")

        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        self.assertFalse(payload["error_flag"])
        self.assertEqual(payload["provider"], "FMP")
        self.assertIn("request_id", payload)
        finance_data = payload["data"]
        self.assertIsInstance(finance_data, dict)
        self.assertEqual(finance_data["ticker"], "AAPL")
        self.assertEqual(finance_data["provider"], "FMP")
        self.assertEqual(finance_data["missing_fields"], [])
        self.assertNotIn(0, finance_data["data"].values())

    def test_macro_daily_returns_canonical_macro_data(self) -> None:
        status, payload = self.request_json("/v1/finance/macro?scope=daily")

        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        self.assertFalse(payload["error_flag"])
        self.assertEqual(payload["provider"], "FMP")
        macro_data = payload["data"]
        self.assertIsInstance(macro_data, dict)
        self.assertEqual(macro_data["indicator"], "us10y_treasury_yield")
        self.assertEqual(macro_data["unit"], "percent")
        self.assertEqual(macro_data["provider"], "FMP")
        self.assertEqual(macro_data["missing_fields"], [])

    def test_missing_fields_are_declared_without_zero_substitution(self) -> None:
        status, payload = self.request_json("/v1/finance/company?ticker=DUMMY")

        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        finance_data = payload["data"]
        self.assertIsInstance(finance_data, dict)
        self.assertEqual(finance_data["provider"], "FMP")
        self.assertEqual(sorted(finance_data["missing_fields"]), sorted(FINANCE_FIELDS))
        self.assertEqual(finance_data["data"], {})


class DataOpenbbLiveModeTests(unittest.TestCase):
    def test_live_company_finance_normalizes_openbb_records(self) -> None:
        settings = Settings(fixture_mode=False)
        service = DataOpenBBService(
            settings=settings,
            rate_limiter=NoopRateLimiter(),
            live_client=FakeLiveClient(
                company_records=(
                    {
                        "revenue": 100.0,
                        "gross_profit": 42.0,
                        "total_operating_income": 25.0,
                        "consolidated_net_income": 18.0,
                        "diluted_earnings_per_share": 3.5,
                        "fiscal_year": 2025,
                        "fiscal_period": "Q4",
                    },
                    {
                        "total_debt": 60.0,
                        "cash_and_cash_equivalents": 15.0,
                    },
                    {
                        "free_cash_flow": 12.0,
                    },
                )
            ),
        )

        status, payload = service.get_company_finance("AAPL", request_id="req-live-company")

        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        finance_data = payload["data"]
        self.assertEqual(finance_data["period"], "2025-Q4")
        self.assertEqual(finance_data["data"]["gross_margin"], 42.0)
        self.assertEqual(finance_data["data"]["free_cash_flow"], 12.0)
        self.assertEqual(finance_data["missing_fields"], [])

    def test_live_company_finance_keeps_missing_fields_for_no_data(self) -> None:
        settings = Settings(fixture_mode=False)
        service = DataOpenBBService(
            settings=settings,
            rate_limiter=NoopRateLimiter(),
            live_client=FakeLiveClient(company_records=({}, {}, {})),
        )

        status, payload = service.get_company_finance("DUMMY", request_id="req-live-empty")

        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        finance_data = payload["data"]
        self.assertEqual(finance_data["data"], {})
        self.assertEqual(sorted(finance_data["missing_fields"]), sorted(FINANCE_FIELDS))

    def test_live_macro_normalizes_fmp_treasury_rates(self) -> None:
        settings = Settings(fixture_mode=False)
        service = DataOpenBBService(
            settings=settings,
            rate_limiter=NoopRateLimiter(),
            live_client=FakeLiveClient(
                macro_records=(
                    [
                        {"date": "2026-03-12", "year_10": 4.12},
                        {"date": "2026-03-13", "year_10": 4.18},
                    ],
                    {"year_10": {"units": "Percent"}},
                )
            ),
        )

        status, payload = service.get_macro("daily", request_id="req-live-macro")

        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        macro_data = payload["data"]
        self.assertEqual(macro_data["indicator"], "us10y_treasury_yield")
        self.assertEqual(macro_data["value"], 4.18)
        self.assertEqual(macro_data["period"], "2026-03-13")
        self.assertEqual(macro_data["unit"], "percent")

    def test_live_company_requires_fmp_key_without_override_client(self) -> None:
        settings = Settings(fixture_mode=False)
        service = DataOpenBBService(settings=settings, rate_limiter=NoopRateLimiter())

        with patch.dict(os.environ, {"FMP_API_KEY": ""}, clear=False):
            status, payload = service.get_company_finance("AAPL", request_id="req-auth-company")

        self.assertEqual(status, 503)
        self.assertFalse(payload["ok"])
        self.assertEqual(payload["error_code"], "AUTH_ERROR")
        self.assertEqual(payload["provider"], "FMP")

    def test_live_macro_requires_fmp_key_without_override_client(self) -> None:
        settings = Settings(fixture_mode=False)
        service = DataOpenBBService(settings=settings, rate_limiter=NoopRateLimiter())

        with patch.dict(os.environ, {"FMP_API_KEY": ""}, clear=False):
            status, payload = service.get_macro("daily", request_id="req-auth-macro")

        self.assertEqual(status, 503)
        self.assertFalse(payload["ok"])
        self.assertEqual(payload["error_code"], "AUTH_ERROR")
        self.assertEqual(payload["provider"], "FMP")

    def test_rate_limiter_keeps_fmp_finance_and_macro_buckets_separate(self) -> None:
        class FakeRedisClient:
            def __init__(self) -> None:
                self.values: dict[str, int | str] = {}

            def get(self, key: str) -> str | None:
                value = self.values.get(key)
                return None if value is None else str(value)

            def incr(self, key: str) -> int:
                count = int(self.values.get(key, 0)) + 1
                self.values[key] = count
                return count

            def expire(self, key: str, seconds: int) -> None:  # noqa: ARG002
                return

            def setex(self, key: str, seconds: int, value: str) -> None:  # noqa: ARG002
                self.values[key] = value

        settings = Settings.from_env(
            {
                "FMP_FINANCE_RATE_LIMIT_PER_MINUTE": "1",
                "FMP_MACRO_RATE_LIMIT_PER_MINUTE": "1",
                "RATE_LIMIT_BURST_ALLOWANCE": "0",
                "RATE_LIMIT_COOLDOWN_SECONDS": "60",
            }
        )
        limiter = RateLimiter(settings=settings, client=FakeRedisClient())

        limiter.acquire("FMP", rate_limit_key="FMP_FINANCE")
        limiter.acquire("FMP", rate_limit_key="FMP_MACRO")

        with self.assertRaises(RateLimitExceededError):
            limiter.acquire("FMP", rate_limit_key="FMP_FINANCE")

    def test_rate_limiter_blocks_after_limit_plus_burst(self) -> None:
        class FakeRedisClient:
            def __init__(self) -> None:
                self.values: dict[str, int | str] = {}

            def get(self, key: str) -> str | None:
                value = self.values.get(key)
                return None if value is None else str(value)

            def incr(self, key: str) -> int:
                count = int(self.values.get(key, 0)) + 1
                self.values[key] = count
                return count

            def expire(self, key: str, seconds: int) -> None:  # noqa: ARG002
                return

            def setex(self, key: str, seconds: int, value: str) -> None:  # noqa: ARG002
                self.values[key] = value

        settings = Settings.from_env(
            {
                "FMP_FINANCE_RATE_LIMIT_PER_MINUTE": "1",
                "RATE_LIMIT_BURST_ALLOWANCE": "1",
                "RATE_LIMIT_COOLDOWN_SECONDS": "60",
            }
        )
        limiter = RateLimiter(settings=settings, client=FakeRedisClient())
        limiter.acquire("FMP", rate_limit_key="FMP_FINANCE")
        limiter.acquire("FMP", rate_limit_key="FMP_FINANCE")

        with self.assertRaises(RateLimitExceededError):
            limiter.acquire("FMP", rate_limit_key="FMP_FINANCE")


if __name__ == "__main__":
    unittest.main()
