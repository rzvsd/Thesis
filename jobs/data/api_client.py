"""Client for the api function's internal routes.

Reads THESIS_API_URL and THESIS_INTERNAL_TOKEN from the environment and sends the token
in the x-internal-token header. It logs the route path, the status code and counts only:
never the token, the base URL or a response body.
"""

from __future__ import annotations

import json
import os
import socket
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from joblog import log
from retry import RetryableError, RetryPolicy, RETRYABLE_STATUS, call_with_retry, parse_retry_after

# An Edge Function may run up to 150 seconds; leave a little room on top.
DEFAULT_REQUEST_TIMEOUT_SECONDS = 160.0
DEFAULT_STEP_TIMEOUT_SECONDS = 600.0
MAX_ERROR_TEXT = 300


class ConfigError(Exception):
    """A required setting is missing or malformed. The message never contains a secret."""


class ApiError(Exception):
    """A non-retryable error answer, or the last retryable one."""

    def __init__(self, route: str, status: int, error_code: str | None = None) -> None:
        detail = f" ({error_code})" if error_code else ""
        super().__init__(f"{route} answered HTTP {status}{detail}")
        self.route = route
        self.status = status
        self.error_code = error_code


@dataclass
class ApiResponse:
    status: int
    body: dict[str, Any]


Transport = Callable[[Request, float], tuple[int, Mapping[str, str], bytes]]


def _urllib_transport(request: Request, timeout: float) -> tuple[int, Mapping[str, str], bytes]:
    try:
        with urlopen(request, timeout=timeout) as response:  # noqa: S310 - https base URL checked in from_env
            return response.status, dict(response.headers.items()), response.read()
    except HTTPError as error:
        body = error.read() if hasattr(error, "read") else b""
        return error.code, dict(error.headers.items()) if error.headers else {}, body


def _validate_base_url(raw: str) -> str:
    base = raw.strip().rstrip("/")
    parts = urlsplit(base)
    if parts.scheme not in {"https", "http"} or not parts.netloc:
        raise ConfigError("THESIS_API_URL must be an absolute http(s) URL.")
    if parts.scheme == "http" and parts.hostname not in {"localhost", "127.0.0.1"}:
        raise ConfigError("THESIS_API_URL must use https (http is allowed only for localhost).")
    if parts.query or parts.fragment or parts.username or parts.password:
        raise ConfigError("THESIS_API_URL must not carry a query, fragment or credentials.")
    return base


@dataclass
class ApiClient:
    base_url: str
    token: str = field(repr=False)
    request_timeout: float = DEFAULT_REQUEST_TIMEOUT_SECONDS
    step_timeout: float = DEFAULT_STEP_TIMEOUT_SECONDS
    policy: RetryPolicy = field(default_factory=RetryPolicy)
    transport: Transport = _urllib_transport
    clock: Callable[[], float] = time.monotonic
    sleep: Callable[[float], None] = time.sleep
    _deadline: float | None = None

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None, **overrides: Any) -> "ApiClient":
        values = os.environ if env is None else env
        raw_url = str(values.get("THESIS_API_URL", "")).strip()
        token = str(values.get("THESIS_INTERNAL_TOKEN", "")).strip()
        missing = [name for name, value in (("THESIS_API_URL", raw_url), ("THESIS_INTERNAL_TOKEN", token)) if not value]
        if missing:
            raise ConfigError(f"Missing required setting(s): {', '.join(missing)}. Set them as GitHub Actions secrets.")
        step_timeout = float(values.get("STEP_TIMEOUT_SECONDS", "") or DEFAULT_STEP_TIMEOUT_SECONDS)
        return cls(base_url=_validate_base_url(raw_url), token=token, step_timeout=step_timeout, **overrides)

    def __repr__(self) -> str:  # never show the token or the base URL
        return "ApiClient(<configured>)"

    def start_step(self) -> None:
        """Start the time budget for one step. Retries stop when it runs out."""
        self._deadline = self.clock() + self.step_timeout

    def get(self, route: str) -> ApiResponse:
        return self._send("GET", route, None)

    def post(self, route: str, body: Mapping[str, Any]) -> ApiResponse:
        return self._send("POST", route, dict(body))

    def _send(self, method: str, route: str, body: dict[str, Any] | None) -> ApiResponse:
        if not route.startswith("/internal/"):
            raise ValueError("only /internal/ routes are allowed")
        if self._deadline is None:
            self.start_step()
        data = json.dumps(body, separators=(",", ":")).encode("utf-8") if body is not None else None

        def attempt() -> ApiResponse:
            remaining = (self._deadline or 0) - self.clock()
            timeout = max(1.0, min(self.request_timeout, remaining))
            request = Request(
                f"{self.base_url}{route}",
                data=data,
                method=method,
                headers={
                    "content-type": "application/json",
                    "accept": "application/json",
                    "x-internal-token": self.token,
                    "user-agent": "thesis-jobs",
                },
            )
            started = self.clock()
            try:
                status, headers, raw = self.transport(request, timeout)
            except (URLError, socket.timeout, TimeoutError, ConnectionError) as error:
                log("WARN", "Request failed", method=method, route=route, error_type=type(error).__name__)
                raise RetryableError(f"network error on {route}") from None
            elapsed_ms = int((self.clock() - started) * 1000)
            parsed = _parse_json(raw)
            log("INFO", "Request done", method=method, route=route, status=status, elapsed_ms=elapsed_ms)
            if status in RETRYABLE_STATUS:
                raise RetryableError(
                    f"{route} answered HTTP {status}", retry_after=_retry_after(headers), status=status
                )
            if status >= 400:
                raise ApiError(route, status, _error_code(parsed))
            return ApiResponse(status=status, body=parsed)

        def on_retry(attempt_no: int, delay: float, error: Exception) -> None:
            log("WARN", "Retrying", route=route, attempt=attempt_no, delay_seconds=round(delay, 2), reason=str(error))

        try:
            return call_with_retry(
                attempt, policy=self.policy, deadline=self._deadline, clock=self.clock, sleep=self.sleep, on_retry=on_retry
            )
        except RetryableError as error:
            raise ApiError(route, error.status) from None


def _parse_json(raw: bytes) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return {}
    return parsed if isinstance(parsed, dict) else {"data": parsed}


def _retry_after(headers: Mapping[str, str]) -> float | None:
    for key, value in headers.items():
        if key.lower() == "retry-after":
            return parse_retry_after(value)
    return None


def _error_code(body: Mapping[str, Any]) -> str | None:
    code = body.get("error")
    if isinstance(code, str) and code:
        return code[:64]
    return None

