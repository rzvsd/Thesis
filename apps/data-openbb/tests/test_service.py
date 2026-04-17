from __future__ import annotations

import json
import os
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

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
        calendar_records: list[dict[str, object]] | None = None,
    ) -> None:
        self.company_records = company_records or ({}, {}, {})
        self.macro_records = macro_records or ([], {})
        self.calendar_records = calendar_records or []

    def fetch_company_records(self, ticker: str) -> tuple[dict[str, object], dict[str, object], dict[str, object]]:  # noqa: ARG002
        return self.company_records

    def fetch_macro_records(self) -> tuple[list[dict[str, object]], dict[str, object]]:
        return self.macro_records

    def fetch_earnings_calendar_rows(self, start_date: str, end_date: str) -> list[dict[str, object]]:  # noqa: ARG002
        return self.calendar_records


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

    def post_json(
        self,
        path: str,
        *,
        body: dict[str, object] | None = None,
        headers: dict[str, str] | None = None,
    ) -> tuple[int, dict[str, object]]:
        payload = json.dumps(body or {}).encode("utf-8")
        request = Request(
            f"{self.base_url}{path}",
            method="POST",
            data=payload,
            headers={
                "content-type": "application/json",
                **(headers or {}),
            },
        )
        with urlopen(request) as response:
            parsed = json.loads(response.read().decode("utf-8"))
            return response.status, parsed

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

    def test_official_company_truth_returns_sec_payload_and_events(self) -> None:
        for ticker in ("AAPL", "MSFT", "TSLA"):
            with self.subTest(ticker=ticker):
                status, payload = self.request_json(f"/v1/official/company?ticker={ticker}")

                self.assertEqual(status, 200)
                self.assertTrue(payload["ok"])
                self.assertFalse(payload["error_flag"])
                self.assertEqual(payload["provider"], "sec_edgar")
                official_data = payload["data"]
                self.assertIsInstance(official_data, dict)
                self.assertEqual(official_data["ticker"], ticker)
                self.assertEqual(official_data["retrieval"]["source"]["source_family"], "sec_edgar")
                self.assertEqual(official_data["missing_fields"], [])
                self.assertGreaterEqual(len(official_data["canonical_events"]), 1)
                self.assertEqual(official_data["canonical_events"][0]["family"], "filing_posted")

    def test_official_macro_truth_returns_seed_registry_without_provider_keys(self) -> None:
        status, payload = self.request_json("/v1/official/macro?scope=daily")

        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        self.assertFalse(payload["error_flag"])
        self.assertEqual(payload["provider"], "official_public_macro")
        macro_data = payload["data"]
        self.assertIsInstance(macro_data, dict)
        observations = macro_data["observations"]
        self.assertIsInstance(observations, list)
        registry_ids = {observation["registry_id"] for observation in observations}
        self.assertIn("TREASURY_DAILY_10Y", registry_ids)
        self.assertIn("BLS_UNEMPLOYMENT_RATE", registry_ids)
        self.assertGreaterEqual(len(macro_data["canonical_events"]), 1)
        self.assertEqual(macro_data["canonical_events"][0]["family"], "macro_release_published")

    def test_missing_fields_are_declared_without_zero_substitution(self) -> None:
        status, payload = self.request_json("/v1/finance/company?ticker=DUMMY")

        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        finance_data = payload["data"]
        self.assertIsInstance(finance_data, dict)
        self.assertEqual(finance_data["provider"], "FMP")
        self.assertEqual(sorted(finance_data["missing_fields"]), sorted(FINANCE_FIELDS))
        self.assertEqual(finance_data["data"], {})

    def test_internal_historical_sync_requires_internal_token(self) -> None:
        with self.assertRaises(HTTPError) as context:
            self.post_json("/internal/historical/sync", body={"include_transcripts": False})
        self.assertEqual(context.exception.code, 401)

    def test_internal_calendar_earnings_requires_internal_token(self) -> None:
        with self.assertRaises(HTTPError) as context:
            self.post_json("/internal/calendar/earnings", body={"start_date": "2026-03-21"})
        self.assertEqual(context.exception.code, 401)

    def test_internal_calendar_earnings_returns_service_response_envelope(self) -> None:
        status, payload = self.post_json(
            "/internal/calendar/earnings",
            body={"start_date": "2026-03-21", "end_date": "2026-04-04"},
            headers={"x-internal-token": "dev-internal-worker-token"},
        )

        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        self.assertFalse(payload["error_flag"])
        self.assertEqual(payload["provider"], "yfinance")
        calendar_data = payload["data"]
        self.assertIsInstance(calendar_data, dict)
        self.assertIn("events", calendar_data)
        self.assertIsInstance(calendar_data["events"], list)
        self.assertGreaterEqual(len(calendar_data["events"]), 1)
        first_event = calendar_data["events"][0]
        self.assertEqual(first_event["provider"], "yfinance")
        self.assertRegex(first_event["event_date"], r"^\d{4}-\d{2}-\d{2}$")

    @patch("src.service.run_historical_delta_sync")
    def test_internal_historical_sync_runs_with_internal_token(self, mocked_sync: object) -> None:
        mocked_sync.return_value = {
            "sec_rows_written": 10,
            "sec_ticker_failures": 0,
            "coverage_rows": 3,
            "include_transcripts": False,
            "transcript_rows_written": 0,
            "transcript_source_rows": 0,
            "transcript_sync_status": "skipped",
            "transcript_snapshot_revision": None,
        }

        status, payload = self.post_json(
            "/internal/historical/sync",
            body={"include_transcripts": False},
            headers={"x-internal-token": "dev-internal-worker-token"},
        )

        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        data = payload["data"]
        self.assertIsInstance(data, dict)
        self.assertEqual(data["include_transcripts"], False)


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

    def test_live_calendar_normalizes_yfinance_rows(self) -> None:
        settings = Settings(fixture_mode=False)
        service = DataOpenBBService(
            settings=settings,
            rate_limiter=NoopRateLimiter(),
            live_client=FakeLiveClient(
                calendar_records=[
                    {
                        "ticker": "AAPL",
                        "event_date": "2026-04-02T08:00:00-04:00",
                        "event_time": "before market open",
                    },
                    {
                        "symbol": "MSFT",
                        "date": "2026-04-03",
                        "when": "after market close",
                    },
                ],
            ),
        )

        status, payload = service.get_calendar_earnings("2026-04-01", "2026-04-10", request_id="req-live-calendar")

        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        calendar_data = payload["data"]
        self.assertIsInstance(calendar_data, dict)
        events = calendar_data["events"]
        self.assertEqual([event["ticker"] for event in events], ["AAPL", "MSFT"])
        self.assertEqual(events[0]["event_time"], "before_market")
        self.assertEqual(events[1]["event_time"], "after_market")

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
