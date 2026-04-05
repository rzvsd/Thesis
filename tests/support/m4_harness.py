from __future__ import annotations

import json
import os
import socket
import subprocess
import threading
import time
import http.client
import urllib.parse
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


@dataclass
class HttpResponse:
    status: int
    payload: Any
    raw_body: str


class JsonClient:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        parsed = urllib.parse.urlparse(self.base_url)
        if parsed.scheme not in ("http", "https"):
            raise ValueError(f"Unsupported base URL scheme: {parsed.scheme}")
        self._scheme = parsed.scheme
        self._host = parsed.hostname or "127.0.0.1"
        self._port = parsed.port or (443 if self._scheme == "https" else 80)
        self._base_path = parsed.path.rstrip("/")
        self._local = threading.local()

    def _new_connection(self, timeout: int) -> http.client.HTTPConnection:
        if self._scheme == "https":
            return http.client.HTTPSConnection(self._host, self._port, timeout=timeout)
        return http.client.HTTPConnection(self._host, self._port, timeout=timeout)

    def _thread_connection(self, timeout: int) -> http.client.HTTPConnection:
        connection = getattr(self._local, "connection", None)
        if connection is None:
            connection = self._new_connection(timeout)
            self._local.connection = connection
        else:
            connection.timeout = timeout
        return connection

    def _reset_thread_connection(self) -> None:
        connection = getattr(self._local, "connection", None)
        if connection is None:
            return
        try:
            connection.close()
        finally:
            self._local.connection = None

    def request_json(
        self,
        path: str,
        *,
        method: str = "GET",
        payload: Any | None = None,
        headers: dict[str, str] | None = None,
        timeout: int = 20
    ) -> HttpResponse:
        target_path = path if path.startswith("/") else f"/{path}"
        if self._base_path:
            target_path = f"{self._base_path}{target_path}"
        body: str | None = None
        request_headers = {"content-type": "application/json"}
        if headers:
            request_headers.update(headers)
        if payload is not None:
            body = json.dumps(payload)

        for attempt in range(2):
            connection = self._thread_connection(timeout)
            try:
                connection.request(method, target_path, body=body, headers=request_headers)
                response = connection.getresponse()
                raw = response.read().decode("utf-8")
                parsed = _try_json(raw)
                return HttpResponse(status=response.status, payload=parsed, raw_body=raw)
            except (OSError, http.client.HTTPException, TimeoutError):
                self._reset_thread_connection()
                if attempt == 0:
                    continue
                raise

        raise AssertionError("unreachable")


def _try_json(raw: str) -> Any:
    stripped = raw.strip()
    if not stripped:
        return {}
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        return {"raw": raw}


class StubHttpServer:
    def __init__(self, handler_factory: Callable[[], type[BaseHTTPRequestHandler]]):
        self._server = ThreadingHTTPServer(("127.0.0.1", free_port()), handler_factory())
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)

    @property
    def base_url(self) -> str:
        host, port = self._server.server_address
        return f"http://{host}:{port}"

    def start(self) -> None:
        self._thread.start()

    def close(self) -> None:
        self._server.shutdown()
        self._server.server_close()
        self._thread.join(timeout=5)


def _response(handler: BaseHTTPRequestHandler, status: int, payload: Any) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("content-type", "application/json")
    handler.send_header("content-length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def create_openbb_stub_server() -> StubHttpServer:
    class OpenbbHandler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802
            parsed = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(parsed.query)
            now_iso = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
            if parsed.path == "/v1/finance/company":
                ticker = (params.get("ticker") or ["AAPL"])[0].strip().upper() or "AAPL"
                _response(self, 200, {
                    "ok": True,
                    "data": {
                        "ticker": ticker,
                        "provider": "stub-openbb",
                        "period": "2025-Q4",
                        "retrieved_at": now_iso,
                        "data": {
                            "revenue": 1000000,
                            "net_income": 250000
                        },
                        "missing_fields": []
                    }
                })
                return

            if parsed.path == "/v1/finance/macro":
                _response(self, 200, {
                    "ok": True,
                    "data": {
                        "indicator": "US10Y",
                        "value": 4.12,
                        "unit": "%",
                        "period": "daily",
                        "provider": "stub-openbb",
                        "retrieved_at": now_iso
                    }
                })
                return

            _response(self, 404, {"ok": False, "error_flag": True, "error_message": "not_found"})

        def log_message(self, format: str, *args: object) -> None:  # noqa: A003
            return

    return StubHttpServer(lambda: OpenbbHandler)


def create_news_stub_server() -> StubHttpServer:
    class NewsHandler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802
            parsed = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(parsed.query)
            if parsed.path == "/v1/news":
                date = (params.get("date") or ["2026-04-05"])[0]
                published_at = f"{date}T12:00:00.000Z"
                _response(self, 200, {
                    "ok": True,
                    "data": [
                        {
                            "article_id": f"stub-{date}",
                            "source": "stub-news",
                            "url": "https://example.com/stub-news",
                            "title": "Stub market headline",
                            "published_at": published_at,
                            "retrieved_at": published_at,
                            "body_text": "Stub approved-source article body.",
                            "tickers_mentioned": ["AAPL", "MSFT"],
                            "is_approved_source": True
                        }
                    ]
                })
                return

            _response(self, 404, {"ok": False, "error_flag": True, "error_message": "not_found"})

        def log_message(self, format: str, *args: object) -> None:  # noqa: A003
            return

    return StubHttpServer(lambda: NewsHandler)


class ProductApiProcess:
    def __init__(self, extra_env: dict[str, str] | None = None):
        self.port = free_port()
        self.base_url = f"http://127.0.0.1:{self.port}"
        self.process: subprocess.Popen[str] | None = None
        self._extra_env = extra_env or {}

    def start(self) -> None:
        env = os.environ.copy()
        env.update({
            "PORT": str(self.port),
            "STORE_BACKEND": "memory",
            "QUEUE_BACKEND": "memory",
            "AUTH_EXPOSE_VERIFICATION_TOKEN": "true",
            "JWT_SECRET": "m4-suite-jwt-secret-1234567890",
            "INTERNAL_WORKER_TOKEN": "m4-suite-internal-token-1234567890",
            "RATE_LIMIT_MAX_REQUESTS": "500000",
            "RATE_LIMIT_WINDOW_SECONDS": "60",
            "PUSH_PROVIDER_MODE": "stub",
            "ARTIFACT_STORE_MODE": "filesystem",
            "NODE_ENV": "test"
        })
        env.update(self._extra_env)
        self.process = subprocess.Popen(
            ["node", str(ROOT / "apps" / "product-api" / "dist" / "apps" / "product-api" / "src" / "server.js")],
            cwd=str(ROOT),
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            text=True
        )
        self._wait_for_health()

    def close(self) -> None:
        if self.process is None:
            return
        if self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=5)
        self.process = None

    def _wait_for_health(self) -> None:
        client = JsonClient(self.base_url)
        deadline = time.time() + 20
        while time.time() < deadline:
            try:
                response = client.request_json("/health", timeout=2)
                if response.status == 200 and isinstance(response.payload, dict):
                    if response.payload.get("status") == "ok":
                        return
            except Exception:
                pass
            time.sleep(0.2)
        raise RuntimeError("product-api failed to start")


def sample_deep_dive_report(job_id: str, report_id: str, ticker: str = "AAPL") -> dict[str, Any]:
    return {
        "report_id": report_id,
        "job_id": job_id,
        "schema_version": "2.0",
        "type": "deep_dive",
        "ticker": ticker,
        "generated_at": "2026-04-05T10:00:00.000Z",
        "confidence": {
            "score": 0.68,
            "label": "medium",
            "limiting_factors": []
        },
        "signal": {
            "value": "neutral",
            "reasons": ["Evidence threshold met."],
            "evidence": [
                {
                    "evidence_id": "ev-1",
                    "source_type": "article",
                    "source_name": "fixture-news",
                    "excerpt": "Revenue remained stable.",
                    "retrieved_at": "2026-04-05T10:00:00.000Z",
                    "url": "https://example.com/news"
                }
            ]
        },
        "historical_context": {
            "latest_period": "2025-Q4",
            "prior_quarter_period": "2025-Q3",
            "year_ago_period": "2024-Q4",
            "transcript_period": "2025-Q4",
            "financial_snapshot_count": 4,
            "transcript_count": 1,
            "transcript_available": True,
            "missing_reasons": []
        },
        "sections": [
            {
                "section_id": "thesis_statement",
                "title": "Thesis Statement",
                "body": "Sample thesis.",
                "status": "complete",
                "evidence": []
            },
            {
                "section_id": "executive_summary",
                "title": "Executive Summary",
                "body": "Sample summary.",
                "status": "complete",
                "evidence": []
            }
        ],
        "flags": [],
        "data_sources": ["fixture-news"]
    }


def unique_email(prefix: str = "m4") -> str:
    return f"{prefix}.{int(time.time() * 1000)}.{uuid4().hex[:8]}@example.com"


def ensure_status(response: HttpResponse, expected: int, message: str) -> None:
    if response.status != expected:
        raise AssertionError(f"{message}: expected {expected}, got {response.status}, body={response.raw_body}")


def register_verify_login(client: JsonClient, *, email: str, password: str) -> str:
    register = client.request_json(
        "/auth/register",
        method="POST",
        payload={"email": email, "password": password}
    )
    ensure_status(register, 201, "register failed")
    if not isinstance(register.payload, dict):
        raise AssertionError("register payload malformed")
    verification_token = register.payload.get("verification_token")
    if not isinstance(verification_token, str) or not verification_token:
        raise AssertionError("verification_token missing")

    verify = client.request_json(
        "/auth/verify",
        method="POST",
        payload={"token": verification_token}
    )
    ensure_status(verify, 200, "verify failed")

    login = client.request_json(
        "/auth/login",
        method="POST",
        payload={"email": email, "password": password}
    )
    ensure_status(login, 200, "login failed")
    if not isinstance(login.payload, dict):
        raise AssertionError("login payload malformed")
    access_token = login.payload.get("access_token")
    if not isinstance(access_token, str) or not access_token:
        raise AssertionError("access_token missing")
    return access_token


def fetch_user_profile(client: JsonClient, access_token: str) -> dict[str, Any]:
    profile = client.request_json(
        "/v1/user/profile",
        headers={"authorization": f"Bearer {access_token}"}
    )
    ensure_status(profile, 200, "profile fetch failed")
    if not isinstance(profile.payload, dict):
        raise AssertionError("profile payload malformed")
    data = profile.payload.get("data")
    if not isinstance(data, dict):
        raise AssertionError("profile data missing")
    return data


def promote_user_to_pro_via_webhook(
    client: JsonClient,
    user_id: str,
    webhook_secret: str
) -> None:
    webhook = client.request_json(
        "/v1/webhooks/revenuecat",
        method="POST",
        headers={"authorization": f"Bearer {webhook_secret}"},
        payload={
            "event": {
                "type": "INITIAL_PURCHASE",
                "app_user_id": user_id,
                "expires_at": "2026-12-31T00:00:00.000Z"
            }
        }
    )
    ensure_status(webhook, 200, "revenuecat webhook failed")


def wait_for_pulse_latest(
    client: JsonClient,
    access_token: str,
    *,
    timeout_seconds: int = 30
) -> dict[str, Any]:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        latest = client.request_json(
            "/pulse/latest",
            headers={"authorization": f"Bearer {access_token}"},
            timeout=5
        )
        if latest.status == 200 and isinstance(latest.payload, dict):
            return latest.payload
        time.sleep(1)
    raise AssertionError("timed out waiting for /pulse/latest report")
