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


@dataclass
class NewsState:
    outage: bool = False


class OpenbbHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)

        if parsed.path == "/v1/finance/company":
            ticker = (query.get("ticker") or ["AAPL"])[0]
            self._send_json(
                200,
                {
                    "ok": True,
                    "data": {
                        "ticker": ticker,
                        "provider": "FMP",
                        "period": "2025-Q4",
                        "retrieved_at": "2026-03-21T08:00:00.000Z",
                        "data": {
                            "revenue": 1_000_000,
                            "net_income": 250_000,
                        },
                        "missing_fields": [],
                    },
                    "error_flag": False,
                },
            )
            return

        if parsed.path == "/v1/finance/macro":
            self._send_json(
                200,
                {
                    "ok": True,
                    "data": {
                        "indicator": "us10y_treasury_yield",
                        "value": 4.21,
                        "unit": "percent",
                        "period": "2026-03-21",
                        "provider": "FMP",
                        "retrieved_at": "2026-03-21T08:00:00.000Z",
                        "missing_fields": [],
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

    def do_GET(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)
        if parsed.path != "/v1/news":
            self._send_json(404, {"status": "not_found"})
            return

        if self.state.outage:
            self._send_json(
                200,
                {
                    "ok": False,
                    "data": [],
                    "error_flag": True,
                    "error_message": "news outage",
                },
            )
            return

        date = (query.get("date") or ["2026-03-21"])[0]
        self._send_json(
            200,
            {
                "ok": True,
                "data": [
                    {
                        "article_id": f"article-{date}",
                        "source": "Reuters",
                        "url": f"https://example.com/{date}",
                        "title": f"Market wrap for {date}",
                        "published_at": f"{date}T12:00:00.000Z",
                        "retrieved_at": f"{date}T12:05:00.000Z",
                        "body_text": "AAPL and MSFT moved on macro headlines.",
                        "tickers_mentioned": ["AAPL", "MSFT"],
                        "is_approved_source": True,
                    }
                ],
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
        self.assertEqual(sections["market_moves"]["status"], "complete")
        self.assertEqual(sections["macro_releases"]["status"], "complete")
        self.assertEqual(sections["news_summary"]["status"], "complete")
        self.assertIn("watchlist_overlay", sections)
        self.assertIn("AAPL", sections["watchlist_overlay"]["body"])

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
        self.assertEqual(degraded_report["sections"]["news_summary"]["status"], "data_unavailable")
        self.assertIn("data_unavailable:news_summary", degraded_report["flags"])

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
