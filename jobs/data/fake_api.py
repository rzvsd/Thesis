"""Test helper: an in-memory transport for ApiClient. No network."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Callable
from urllib.request import Request

from api_client import ApiClient
from retry import RetryPolicy

Handler = Callable[[str, str, dict[str, Any] | None], tuple[int, Any]]


@dataclass
class FakeTransport:
    handler: Handler
    calls: list[dict[str, Any]] = field(default_factory=list)

    def __call__(self, request: Request, timeout: float) -> tuple[int, dict[str, str], bytes]:
        url = request.full_url
        path = "/" + url.split("://", 1)[1].split("/", 1)[1]
        base_marker = "/functions/v1/api"
        if path.startswith(base_marker):
            path = path[len(base_marker):]
        body = json.loads(request.data.decode("utf-8")) if request.data else None
        self.calls.append(
            {"method": request.get_method(), "path": path, "body": body, "headers": dict(request.header_items())}
        )
        status, payload = self.handler(request.get_method(), path, body)
        headers: dict[str, str] = {}
        if isinstance(payload, tuple):
            payload, headers = payload
        return status, headers, json.dumps(payload).encode("utf-8")


def make_client(handler: Handler, **kwargs: Any) -> tuple[ApiClient, FakeTransport]:
    transport = FakeTransport(handler)
    sleeps: list[float] = []
    client = ApiClient(
        base_url="https://example.invalid/functions/v1/api",
        token="test-token-value",
        transport=transport,
        sleep=sleeps.append,
        policy=kwargs.pop("policy", RetryPolicy(max_attempts=4, base_delay_seconds=0.01, jitter=0)),
        **kwargs,
    )
    return client, transport
