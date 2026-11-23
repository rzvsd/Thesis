from __future__ import annotations

import socket
from urllib.error import URLError

import pytest

from api_client import ApiClient, ApiError, ConfigError
from fake_api import make_client


def test_from_env_requires_both_secrets() -> None:
    with pytest.raises(ConfigError) as error:
        ApiClient.from_env({"THESIS_API_URL": "", "THESIS_INTERNAL_TOKEN": ""})
    assert "THESIS_API_URL" in str(error.value) and "THESIS_INTERNAL_TOKEN" in str(error.value)


def test_from_env_rejects_plain_http_and_credentials() -> None:
    with pytest.raises(ConfigError):
        ApiClient.from_env({"THESIS_API_URL": "http://api.example.com", "THESIS_INTERNAL_TOKEN": "x"})
    with pytest.raises(ConfigError):
        ApiClient.from_env({"THESIS_API_URL": "https://u:p@api.example.com", "THESIS_INTERNAL_TOKEN": "x"})
    client = ApiClient.from_env({"THESIS_API_URL": "https://api.example.com/", "THESIS_INTERNAL_TOKEN": "secret"})
    assert client.base_url == "https://api.example.com"
    assert "secret" not in repr(client)


def test_sends_internal_token_header_and_json() -> None:
    client, transport = make_client(lambda method, path, body: (200, {"status": "ok"}))
    response = client.post("/internal/monitor/recompute", {"a": 1})
    assert response.body == {"status": "ok"}
    call = transport.calls[0]
    assert call["path"] == "/internal/monitor/recompute"
    assert call["body"] == {"a": 1}
    headers = {key.lower(): value for key, value in call["headers"].items()}
    assert headers["x-internal-token"] == "test-token-value"


def test_only_internal_routes() -> None:
    client, _ = make_client(lambda method, path, body: (200, {}))
    with pytest.raises(ValueError):
        client.post("/v1/user/alerts", {})


def test_retries_429_and_5xx_then_succeeds() -> None:
    answers = iter([(429, ({"error": "rate_limited"}, {"Retry-After": "0"})), (503, {}), (200, {"ok": True})])
    client, transport = make_client(lambda method, path, body: next(answers))
    assert client.post("/internal/x", {}).body == {"ok": True}
    assert len(transport.calls) == 3


def test_does_not_retry_4xx() -> None:
    client, transport = make_client(lambda method, path, body: (422, {"error": "validation_failed"}))
    with pytest.raises(ApiError) as error:
        client.post("/internal/x", {})
    assert error.value.status == 422 and error.value.error_code == "validation_failed"
    assert len(transport.calls) == 1


def test_gives_up_after_max_attempts_with_last_status() -> None:
    client, transport = make_client(lambda method, path, body: (502, {}))
    with pytest.raises(ApiError) as error:
        client.post("/internal/x", {})
    assert error.value.status == 502
    assert len(transport.calls) == 4


def test_retries_network_errors() -> None:
    state = {"n": 0}

    def handler(method: str, path: str, body: object) -> tuple[int, dict]:
        state["n"] += 1
        if state["n"] == 1:
            raise URLError("connection refused")
        if state["n"] == 2:
            raise socket.timeout("timed out")
        return 200, {"done": True}

    client, _ = make_client(handler)
    assert client.post("/internal/x", {}).body == {"done": True}


def test_logs_never_show_token_or_base_url(capsys: pytest.CaptureFixture[str]) -> None:
    client, _ = make_client(lambda method, path, body: (500, {"error_message": "secret detail"}))
    with pytest.raises(ApiError):
        client.post("/internal/x", {})
    out = capsys.readouterr()
    logs = out.out + out.err
    assert "test-token-value" not in logs
    assert "example.invalid" not in logs
    assert "secret detail" not in logs
    assert '"status":500' in logs
