from __future__ import annotations

import json
import os
import socket
import subprocess
import threading
import time
import unittest
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _today_iso_date() -> str:
    return time.strftime("%Y-%m-%d", time.gmtime())


def _today_iso_month() -> str:
    return _today_iso_date()[:7]


def _iso_datetime_seconds_ago(seconds_ago: int) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(time.time() - seconds_ago))


@dataclass
class NewsState:
    outage: bool = False


class OpenbbHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)
        today = _today_iso_date()
        month = _today_iso_month()
        filing_occurred_at = _iso_datetime_seconds_ago(3_600)
        filing_retrieved_at = _iso_datetime_seconds_ago(3_300)
        macro_retrieved_at = _iso_datetime_seconds_ago(7_200)
        macro_event_occurred_at = _iso_datetime_seconds_ago(5_400)
        macro_event_retrieved_at = _iso_datetime_seconds_ago(5_100)

        if parsed.path == "/v1/official/company":
            ticker = (query.get("ticker") or ["AAPL"])[0]
            self._send_json(
                200,
                {
                    "ok": True,
                    "data": {
                        "ticker": ticker,
                        "retrieval": {
                            "source": {
                                "source_name": "SEC EDGAR",
                                "source_url": f"https://www.sec.gov/{ticker}",
                            },
                            "retrieved_at": "2026-03-21T08:00:00.000Z",
                        },
                        "missing_fields": [],
                        "canonical_events": [
                            {
                                "id": f"filing-{ticker}-{today}",
                                "family": "filing_posted",
                                "subject_type": "ticker",
                                "subject_id": ticker,
                                "title": f"{ticker} filed a new 8-K",
                                "occurred_at": filing_occurred_at,
                                "source_state": "official",
                                "source": {
                                    "source": {
                                        "source_id": f"sec-{ticker}",
                                        "source_family": "sec_edgar",
                                        "source_name": "SEC EDGAR",
                                        "source_url": f"https://www.sec.gov/{ticker}",
                                        "agency": "SEC",
                                        "agency_series_id": ticker,
                                    },
                                    "retrieved_at": filing_retrieved_at,
                                    "retrieval_status": "fresh",
                                    "source_period": f"{month}-current",
                                },
                                "retrieved_at": filing_retrieved_at,
                                "missing_fields": [],
                                "metadata": {
                                    "form_type": "8-K",
                                },
                            }
                        ],
                    },
                    "error_flag": False,
                },
            )
            return

        if parsed.path == "/v1/official/macro":
            self._send_json(
                200,
                {
                    "ok": True,
                    "data": {
                        "observations": [
                            {
                                "registry_id": "TREASURY_DAILY_10Y",
                                "value": 4.21,
                                "unit": "percent",
                                "period": today,
                                "category": "rates",
                                "retrieval": {
                                    "source": {
                                        "source_name": "U.S. Treasury",
                                        "source_url": "https://home.treasury.gov/",
                                    },
                                    "retrieved_at": macro_retrieved_at,
                                },
                                "missing_fields": [],
                            },
                            {
                                "registry_id": "TREASURY_DAILY_2Y",
                                "value": 4.08,
                                "unit": "percent",
                                "period": today,
                                "category": "rates",
                                "retrieval": {
                                    "source": {
                                        "source_name": "U.S. Treasury",
                                        "source_url": "https://home.treasury.gov/",
                                    },
                                    "retrieved_at": macro_retrieved_at,
                                },
                                "missing_fields": [],
                            },
                            {
                                "registry_id": "BLS_CPI_U_ALL_ITEMS",
                                "value": 308.6,
                                "unit": "index",
                                "period": month,
                                "category": "inflation",
                                "retrieval": {
                                    "source": {
                                        "source_name": "BLS",
                                        "source_url": "https://www.bls.gov/",
                                    },
                                    "retrieved_at": macro_retrieved_at,
                                },
                                "missing_fields": [],
                            },
                            {
                                "registry_id": "BLS_UNEMPLOYMENT_RATE",
                                "value": 3.9,
                                "unit": "percent",
                                "period": month,
                                "category": "labor",
                                "retrieval": {
                                    "source": {
                                        "source_name": "BLS",
                                        "source_url": "https://www.bls.gov/",
                                    },
                                    "retrieved_at": macro_retrieved_at,
                                },
                                "missing_fields": [],
                            },
                        ],
                        "canonical_events": [
                            {
                                "id": f"macro-cpi-{today}",
                                "family": "macro_release_published",
                                "subject_type": "macro_series",
                                "subject_id": "BLS_CPI_U_ALL_ITEMS",
                                "title": "CPI update published",
                                "occurred_at": macro_event_occurred_at,
                                "source_state": "official",
                                "source": {
                                    "source": {
                                        "source_id": "bls-cpi",
                                        "source_family": "bls",
                                        "source_name": "BLS CPI",
                                        "source_url": "https://www.bls.gov/cpi/",
                                        "agency": "BLS",
                                        "agency_series_id": "CUUR0000SA0",
                                    },
                                    "retrieved_at": macro_event_retrieved_at,
                                    "retrieval_status": "fresh",
                                    "source_period": month,
                                },
                                "retrieved_at": macro_event_retrieved_at,
                                "missing_fields": [],
                                "metadata": {
                                    "scope": "daily",
                                },
                            }
                        ],
                    },
                    "error_flag": False,
                },
            )
            return

        self._send_json(404, {"status": "not_found"})

    def log_message(self, _format: str, *_args: object) -> None:
        return

    def _send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class NewsHandler(BaseHTTPRequestHandler):
    state = NewsState()

    def do_POST(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        today = _today_iso_date()
        published_at = _iso_datetime_seconds_ago(2_700)
        retrieved_at = _iso_datetime_seconds_ago(2_400)
        if parsed.path != "/v1/first-party/context":
            self._send_json(404, {"status": "not_found"})
            return

        if self.state.outage:
            self._send_json(
                200,
                {
                    "ok": False,
                    "data": {"context_items": []},
                    "error_flag": True,
                    "error_message": "context outage",
                },
            )
            return

        self._send_json(
            200,
            {
                "ok": True,
                "data": {
                    "context_items": [
                        {
                            "context_id": f"ctx-aapl-{today}",
                            "ticker": "AAPL",
                            "registry_entry_id": "aapl-ir",
                            "source_url": "https://investor.apple.com/investor-relations/",
                            "source_domain": "investor.apple.com",
                            "page_type": "investor_relations",
                            "title": "Apple investor update",
                            "summary": "Apple published a first-party investor update.",
                            "excerpt": "Apple investor update confirms release cadence.",
                            "retrieved_at": retrieved_at,
                            "published_at": published_at,
                            "content_hash": "ctx-aapl",
                            "fetch_state": "fetched",
                            "rights": {
                                "rights_class": "first_party_public",
                                "display_mode": "excerpt_only",
                                "source_rank": "first_party",
                                "source_type": "investor_relations",
                                "can_store_full_text": False,
                                "can_display_excerpt": True,
                                "can_display_link": True,
                                "policy_reason": "Approved first-party source.",
                                "reviewed_at": "2026-03-01T00:00:00.000Z",
                            },
                            "artifact_ids": [],
                            "metadata": {
                                "fixture": True,
                            },
                        }
                    ]
                },
                "error_flag": False,
            },
        )

    def log_message(self, _format: str, *_args: object) -> None:
        return

    def _send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def _wait_for_health(url: str, timeout_seconds: int = 20) -> None:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                if response.status == 200:
                    return
        except Exception:
            time.sleep(0.25)
    raise RuntimeError(f"Service failed health check: {url}")


class M6MarketPulseIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.openbb_port = _free_port()
        cls.news_port = _free_port()
        cls.product_port = _free_port()
        cls.scheduler_port = _free_port()

        cls.openbb_server = ThreadingHTTPServer(("127.0.0.1", cls.openbb_port), OpenbbHandler)
        cls.news_server = ThreadingHTTPServer(("127.0.0.1", cls.news_port), NewsHandler)
        cls.openbb_thread = threading.Thread(target=cls.openbb_server.serve_forever, daemon=True)
        cls.news_thread = threading.Thread(target=cls.news_server.serve_forever, daemon=True)
        cls.openbb_thread.start()
        cls.news_thread.start()

        NewsHandler.state = NewsState(outage=False)

        product_env = os.environ.copy()
        product_env["PORT"] = str(cls.product_port)
        product_env["STORE_BACKEND"] = "memory"
        product_env["QUEUE_BACKEND"] = "memory"
        product_env["AUTH_EXPOSE_VERIFICATION_TOKEN"] = "true"
        product_env["JWT_SECRET"] = "dev-jwt-secret-change-me"
        product_env["INTERNAL_WORKER_TOKEN"] = "dev-internal-worker-token"
        product_env["MARKET_PULSE_DATA_OPENBB_BASE_URL"] = f"http://127.0.0.1:{cls.openbb_port}"
        product_env["MARKET_PULSE_NEWS_INGEST_BASE_URL"] = f"http://127.0.0.1:{cls.news_port}"
        product_env["MARKET_PULSE_TICKERS"] = "AAPL,MSFT"
        product_env["MARKET_PULSE_SCHEMA_VERSION"] = "1.0.0"
        product_env["PUSH_PROVIDER_MODE"] = "stub"
        product_env["TICKER_AUTO_SYNC_ENABLED"] = "false"

        cls.product_process = subprocess.Popen(
            [
                "node",
                str(
                    ROOT
                    / "apps"
                    / "product-api"
                    / "dist"
                    / "apps"
                    / "product-api"
                    / "src"
                    / "server.js"
                ),
            ],
            cwd=str(ROOT),
            env=product_env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        cls.product_base = f"http://127.0.0.1:{cls.product_port}"
        _wait_for_health(f"{cls.product_base}/health")

        scheduler_env = os.environ.copy()
        scheduler_env["PORT"] = str(cls.scheduler_port)
        scheduler_env["PRODUCT_API_INTERNAL_BASE_URL"] = cls.product_base
        scheduler_env["INTERNAL_WORKER_TOKEN"] = "dev-internal-worker-token"
        scheduler_env["SCHEDULER_TIMEZONE"] = "America/New_York"
        scheduler_env["SCHEDULER_DELIVERY_TIME_LOCAL"] = "06:30"
        scheduler_env["SCHEDULER_TEST_MODE"] = "true"
        scheduler_env["SCHEDULER_TEST_FIRE_IN_SECONDS"] = "2"

        cls.scheduler_process = subprocess.Popen(
            [
                "node",
                str(ROOT / "apps" / "scheduler" / "dist" / "src" / "server.js"),
            ],
            cwd=str(ROOT),
            env=scheduler_env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        cls.scheduler_base = f"http://127.0.0.1:{cls.scheduler_port}"
        _wait_for_health(f"{cls.scheduler_base}/health")

    @classmethod
    def tearDownClass(cls) -> None:
        for process in [cls.scheduler_process, cls.product_process]:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)

        cls.openbb_server.shutdown()
        cls.news_server.shutdown()
        cls.openbb_server.server_close()
        cls.news_server.server_close()

    def request_json(
        self,
        path: str,
        *,
        method: str = "GET",
        payload: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> tuple[int, dict[str, Any]]:
        request = urllib.request.Request(
            f"{self.product_base}{path}",
            data=json.dumps(payload).encode("utf-8") if payload is not None else None,
            headers={"content-type": "application/json", **(headers or {})},
            method=method,
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                body = json.loads(response.read().decode("utf-8"))
                assert isinstance(body, dict)
                return response.status, body
        except urllib.error.HTTPError as error:
            body = json.loads(error.read().decode("utf-8"))
            assert isinstance(body, dict)
            return error.code, body

    def wait_for_report(
        self,
        path: str,
        access_token: str,
        timeout_seconds: int = 20,
    ) -> dict[str, Any]:
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            status, payload = self.request_json(
                path,
                headers={"authorization": f"Bearer {access_token}"},
            )
            if status == 200:
                return payload
            time.sleep(0.2)
        raise RuntimeError(f"Timed out waiting for report at {path}")

    def create_verified_session(self) -> tuple[str, str]:
        register_status, register_payload = self.request_json(
            "/auth/register",
            method="POST",
            payload={"email": "m6-int@example.com", "password": "VeryStrongPass1!"},
        )
        self.assertEqual(register_status, 201)
        verification_token = register_payload["verification_token"]

        verify_status, _ = self.request_json(
            "/auth/verify",
            method="POST",
            payload={"token": verification_token},
        )
        self.assertEqual(verify_status, 200)

        login_status, login_payload = self.request_json(
            "/auth/login",
            method="POST",
            payload={"email": "m6-int@example.com", "password": "VeryStrongPass1!"},
        )
        self.assertEqual(login_status, 200)
        return str(login_payload["access_token"]), "dev-internal-worker-token"

    def test_scheduler_to_pulse_pipeline_and_degradation(self) -> None:
        start = time.time()
        access_token, internal_token = self.create_verified_session()
        auth_headers = {"authorization": f"Bearer {access_token}"}
        internal_headers = {"x-internal-token": internal_token}
        degraded_cycle_day = "2099-01-01"
        failed_cycle_day = "2099-01-02"

        token_status, _ = self.request_json(
            "/notifications/device-token",
            method="POST",
            headers=auth_headers,
            payload={"device_token": "fcm_token_1234567890123456"},
        )
        self.assertEqual(token_status, 200)

        watchlist_status, _ = self.request_json(
            "/watchlist",
            method="POST",
            headers=auth_headers,
            payload={"ticker": "AAPL"},
        )
        self.assertEqual(watchlist_status, 200)

        latest_report = self.wait_for_report("/pulse/latest", access_token, timeout_seconds=25)
        self.assertLessEqual(time.time() - start, 120)
        self.assertIn("sections", latest_report)
        sections = latest_report["sections"]
        assert isinstance(sections, dict)
        self.assertEqual(sections["macro_stress"]["status"], "complete")
        self.assertEqual(sections["official_macro_pressure"]["status"], "complete")
        self.assertEqual(sections["canonical_events"]["status"], "complete")
        self.assertEqual(sections["bounded_context"]["status"], "complete")
        self.assertEqual(sections["market_moves"]["status"], "complete")
        self.assertEqual(sections["macro_releases"]["status"], "complete")
        self.assertEqual(sections["news_summary"]["status"], "complete")
        self.assertIn("market_tape", sections)
        self.assertIn("what_changed", sections)
        self.assertIn("why_it_matters", sections)
        self.assertIn("what_to_watch", sections)
        self.assertIn("signal_vs_noise", sections)
        self.assertNotIn("watchlist_overlay", sections)

        NewsHandler.state.outage = True
        dispatch_status, _ = self.request_json(
            "/internal/pulse/dispatch",
            method="POST",
            headers=internal_headers,
            payload={
                "cycle_start": f"{degraded_cycle_day}T00:00:00.000Z",
                "cycle_end": f"{degraded_cycle_day}T23:59:00.000Z",
            },
        )
        self.assertEqual(dispatch_status, 202)

        degraded_report = self.wait_for_report(f"/pulse/{degraded_cycle_day}", access_token)
        self.assertEqual(degraded_report["sections"]["bounded_context"]["status"], "data_unavailable")
        self.assertEqual(degraded_report["sections"]["news_summary"]["status"], "data_unavailable")
        self.assertIn("data_unavailable:bounded_context", degraded_report["flags"])

        NewsHandler.state.outage = False
        fail_status, _ = self.request_json(
            "/internal/pulse/dispatch",
            method="POST",
            headers=internal_headers,
            payload={
                "cycle_start": f"{failed_cycle_day}T00:00:00.000Z",
                "cycle_end": f"{failed_cycle_day}T23:59:00.000Z",
                "force_fail": True,
            },
        )
        self.assertEqual(fail_status, 202)
        time.sleep(0.8)

        missing_status, _ = self.request_json(
            f"/pulse/{failed_cycle_day}",
            headers=auth_headers,
        )
        self.assertEqual(missing_status, 404)

        latest_status, latest_payload = self.request_json(
            "/pulse/latest",
            headers=auth_headers,
        )
        self.assertEqual(latest_status, 200)
        self.assertEqual(str(latest_payload["cycle_end"])[:10], degraded_cycle_day)


if __name__ == "__main__":
    unittest.main(verbosity=2)
