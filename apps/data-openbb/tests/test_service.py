from __future__ import annotations

import json
import os
import socket
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from src.server import MAX_JSON_BODY_BYTES, start_server, stop_server
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
        self.structural_context = {
            "subject_type": "issuer",
            "subject_id": "AAPL",
            "as_of": "2026-04-22",
            "coverage_state": "partial",
            "summary": "Fixture structural context.",
            "observations": [],
            "omissions": [],
            "retrievals": [],
        }
        self.market_tape = {
            "as_of": "2026-04-22",
            "coverage_state": "partial",
            "summary": "US risk assets were mixed on the day.",
            "indices": [],
            "cross_asset": [],
            "retrievals": [],
            "omissions": [],
        }

    def fetch_company_records(self, ticker: str) -> tuple[dict[str, object], dict[str, object], dict[str, object]]:  # noqa: ARG002
        return self.company_records

    def fetch_macro_records(self) -> tuple[list[dict[str, object]], dict[str, object]]:
        return self.macro_records

    def fetch_earnings_calendar_rows(self, start_date: str, end_date: str) -> list[dict[str, object]]:  # noqa: ARG002
        return self.calendar_records

    def fetch_official_structural_context(
        self,
        *,
        ticker: str | None = None,  # noqa: ARG002
        country: str | None = None,  # noqa: ARG002
        subject_type: str | None = None,  # noqa: ARG002
    ) -> dict[str, object]:
        return self.structural_context

    def fetch_market_tape(self, *, as_of: str | None = None) -> dict[str, object]:  # noqa: ARG002
        return self.market_tape


class DataOpenbbConfigTests(unittest.TestCase):
    def test_production_rejects_dev_token_fixture_mode_and_default_db_password(self) -> None:
        with self.assertRaises(ValueError) as error:
            Settings.from_env(
                {
                    "NODE_ENV": "production",
                    "INTERNAL_WORKER_TOKEN": "dev-internal-worker-token",
                    "DATA_OPENBB_FIXTURE_MODE": "true",
                    "DATABASE_URL": "postgres://postgres:postgres@postgres:5432/thesis",
                }
            )

        message = str(error.exception)
        self.assertIn(
            "INTERNAL_WORKER_TOKEN must not use the local development default",
            message,
        )
        self.assertIn("DATA_OPENBB_FIXTURE_MODE must be false", message)
        self.assertIn("DATABASE_URL must not use the default postgres password", message)

    def test_production_allows_fixture_mode_only_for_explicit_proof_jobs(self) -> None:
        settings = Settings.from_env(
            {
                "NODE_ENV": "production",
                "INTERNAL_WORKER_TOKEN": "production-internal-worker-token",
                "DATA_OPENBB_FIXTURE_MODE": "true",
                "THESIS_ALLOW_PRODUCTION_FIXTURES": "true",
                "DATABASE_URL": "postgres://postgres:strong-password@postgres:5432/thesis",
            }
        )

        self.assertTrue(settings.fixture_mode)
        self.assertTrue(settings.allow_production_fixtures)


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

    def post_declared_json_length(
        self,
        path: str,
        *,
        declared_length: int,
        headers: dict[str, str] | None = None,
    ) -> int:
        request_headers = {
            "Host": f"127.0.0.1:{self.server.server_address[1]}",
            "Content-Type": "application/json",
            "Content-Length": str(declared_length),
            "Connection": "close",
            **(headers or {}),
        }
        header_lines = "\r\n".join(f"{key}: {value}" for key, value in request_headers.items())
        raw_request = f"POST {path} HTTP/1.1\r\n{header_lines}\r\n\r\n".encode("utf-8")
        with socket.create_connection(("127.0.0.1", self.server.server_address[1]), timeout=5) as sock:
            sock.sendall(raw_request)
            chunks = []
            while True:
                chunk = sock.recv(4096)
                if not chunk:
                    break
                chunks.append(chunk)
            status_line = b"".join(chunks).decode("iso-8859-1").splitlines()[0]
        return int(status_line.split(" ", 2)[1])

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

    def test_official_macro_truth_honors_as_of(self) -> None:
        status, payload = self.request_json("/v1/official/macro?scope=daily&as_of=2025-02-14")

        self.assertEqual(status, 200)
        macro_data = payload["data"]
        self.assertIsInstance(macro_data, dict)
        periods = {observation["period"] for observation in macro_data["observations"]}
        self.assertIn("2025-02-14", periods)
        self.assertIn("2025-Q1", periods)

    def test_official_structural_context_returns_world_bank_backdrop(self) -> None:
        status, payload = self.request_json("/v1/official/structural?ticker=AAPL")

        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        self.assertFalse(payload["error_flag"])
        self.assertEqual(payload["provider"], "official_structural_context")
        structural_data = payload["data"]
        self.assertIsInstance(structural_data, dict)
        self.assertEqual(structural_data["subject_type"], "issuer")
        self.assertEqual(structural_data["subject_id"], "AAPL")
        self.assertEqual(structural_data["issuer_metadata"]["domicile_country"], "US")
        self.assertGreaterEqual(len(structural_data["observations"]), 5)
        self.assertGreaterEqual(len(structural_data["retrievals"]), 1)
        families = {entry["family"] for entry in structural_data["observations"]}
        self.assertIn("gdp_per_capita", families)
        self.assertIn("population", families)

    def test_official_structural_context_honors_as_of(self) -> None:
        status, payload = self.request_json("/v1/official/structural?ticker=AAPL&as_of=2024-12-31")

        self.assertEqual(status, 200)
        structural_data = payload["data"]
        self.assertIsInstance(structural_data, dict)
        self.assertEqual(structural_data["as_of"], "2024-12-31")
        self.assertTrue(
            all(observation["period"] <= "2024" for observation in structural_data["observations"])
        )

    def test_market_tape_returns_contract_valid_payload(self) -> None:
        status, payload = self.request_json("/v1/market/tape?scope=daily")

        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        self.assertFalse(payload["error_flag"])
        self.assertEqual(payload["provider"], "market_tape")
        market_tape = payload["data"]
        self.assertIsInstance(market_tape, dict)
        self.assertIn(market_tape["coverage_state"], {"full", "partial", "limited"})
        self.assertGreaterEqual(len(market_tape["indices"]), 4)
        self.assertGreaterEqual(len(market_tape["cross_asset"]), 4)

    def test_market_tape_honors_as_of(self) -> None:
        status, payload = self.request_json("/v1/market/tape?scope=daily&as_of=2025-02-14")

        self.assertEqual(status, 200)
        market_tape = payload["data"]
        self.assertIsInstance(market_tape, dict)
        self.assertEqual(market_tape["as_of"], "2025-02-14")

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

    def test_internal_calendar_earnings_rejects_oversized_json_body(self) -> None:
        status = self.post_declared_json_length(
            "/internal/calendar/earnings",
            declared_length=MAX_JSON_BODY_BYTES + 1,
            headers={"x-internal-token": "dev-internal-worker-token"},
        )

        self.assertEqual(status, 413)

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

    def test_internal_historical_sync_rejects_oversized_json_body(self) -> None:
        status = self.post_declared_json_length(
            "/internal/historical/sync",
            declared_length=MAX_JSON_BODY_BYTES + 1,
            headers={"x-internal-token": "dev-internal-worker-token"},
        )

        self.assertEqual(status, 413)

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

    def test_live_market_tape_uses_live_client_payload(self) -> None:
        settings = Settings(fixture_mode=False)
        fake_live = FakeLiveClient()
        fake_live.market_tape = {
            "as_of": "2026-04-22",
            "coverage_state": "partial",
            "summary": "US risk assets were mixed on the day.",
            "indices": [
                {
                    "instrument_id": "SP500",
                    "label": "S&P 500",
                    "family": "core_index",
                    "period": "2026-04-22",
                    "value": 5287.76,
                    "previous_value": 5158.2,
                    "daily_change": 129.56,
                    "daily_change_pct": 2.5118,
                    "unit": "index",
                    "direction": "up",
                    "retrieval": {
                        "source": {
                            "source_id": "FRED_SP500",
                            "source_family": "fred",
                            "source_name": "FRED S&P 500",
                            "source_url": "https://fred.stlouisfed.org/series/SP500",
                            "agency": "Federal Reserve Bank of St. Louis",
                            "agency_series_id": "SP500",
                        },
                        "retrieved_at": "2026-04-22T00:00:00.000Z",
                        "retrieval_status": "fresh",
                        "source_period": "2026-04-22",
                    },
                    "missing_fields": [],
                }
            ],
            "cross_asset": [],
            "retrievals": [],
            "omissions": [],
        }
        service = DataOpenBBService(
            settings=settings,
            rate_limiter=NoopRateLimiter(),
            live_client=fake_live,
        )

        status, payload = service.get_market_tape("daily", "2026-04-22", request_id="req-market-tape")

        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        market_tape = payload["data"]
        self.assertEqual(market_tape["as_of"], "2026-04-22")
        self.assertEqual(market_tape["indices"][0]["instrument_id"], "SP500")

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


class DataOpenbbFilingSectionTests(unittest.TestCase):
    def test_fixture_filing_sections_endpoint_returns_reviewed_excerpts(self) -> None:
        settings = Settings(fixture_mode=True)
        service = DataOpenBBService(settings=settings, rate_limiter=NoopRateLimiter())
        server = start_server(0, data_service=service)
        try:
            with urlopen(f"http://127.0.0.1:{server.server_address[1]}/v1/official/filing-sections?ticker=msft") as response:
                payload = json.loads(response.read().decode("utf-8"))
        finally:
            stop_server(server)

        self.assertTrue(payload["ok"])
        filings = payload["data"]["filings"]
        self.assertEqual(len(filings), 2)
        latest_sections = {section["family"]: section for section in filings[0]["sections"]}
        self.assertFalse(latest_sections["mda"]["omitted"])
        self.assertIn("Management's Discussion", latest_sections["mda"]["excerpt"])
        self.assertTrue(latest_sections["segments"]["omitted"])

    def test_live_filing_sections_fetch_latest_two_periodic_filings(self) -> None:
        from src.service import OpenBBLiveClient

        submissions = {
            "filings": {
                "recent": {
                    "form": ["8-K", "10-Q", "10-K", "10-Q"],
                    "accessionNumber": ["0001-26-000001", "0001-26-000002", "0001-25-000003", "0001-25-000004"],
                    "primaryDocument": ["a.htm", "q.htm", "k.htm", "q0.htm"],
                    "filingDate": ["2026-02-01", "2026-01-28", "2025-07-30", "2025-04-30"],
                    "reportDate": ["", "2025-12-31", "2025-06-30", "2025-03-31"],
                }
            }
        }
        fetched_urls: list[str] = []

        def fake_fetch_text(url: str, *, headers: object) -> str:  # noqa: ARG001
            fetched_urls.append(url)
            return "<h2>Item 1A. Risk Factors</h2><p>Supply chain risk.</p>"

        client = OpenBBLiveClient()
        with patch.object(client, "_fetch_json", return_value=submissions), patch.object(
            client, "_fetch_text", side_effect=fake_fetch_text
        ):
            payload = client.fetch_filing_sections("MSFT")

        self.assertEqual([filing["form"] for filing in payload["filings"]], ["10-Q", "10-K"])
        self.assertEqual(
            fetched_urls[0],
            "https://www.sec.gov/Archives/edgar/data/789019/000126000002/q.htm",
        )
        risk = {section["family"]: section for section in payload["filings"][0]["sections"]}["risk_factors"]
        self.assertFalse(risk["omitted"])
