from __future__ import annotations

import json
import os
import socket
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "tests" / "fixtures" / "tickers"


def _request(
    base_url: str,
    path: str,
    *,
    method: str = "GET",
    payload: dict[str, object] | None = None,
    headers: dict[str, str] | None = None,
) -> tuple[int, dict[str, object]]:
    request = urllib.request.Request(
        f"{base_url}{path}",
        data=json.dumps(payload).encode("utf-8") if payload is not None else None,
        headers={"content-type": "application/json", **(headers or {})},
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read().decode("utf-8"))


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _run_ticker_sync(extra_args: list[str], *, env: dict[str, str]) -> None:
    command_parts = [
        "corepack",
        "pnpm",
        "--filter",
        "@thesis/product-api",
        "sync:tickers",
        *extra_args,
    ]
    subprocess.run(
        subprocess.list2cmdline(command_parts),
        cwd=ROOT,
        env=env,
        check=True,
        shell=True,
    )


def _run_product_api_build(env: dict[str, str]) -> None:
    command_parts = [
        "corepack",
        "pnpm",
        "--filter",
        "@thesis/product-api",
        "build",
    ]
    subprocess.run(
        subprocess.list2cmdline(command_parts),
        cwd=ROOT,
        env=env,
        check=True,
        shell=True,
    )


def _wait_for_health(base_url: str, timeout_seconds: float = 30.0) -> None:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            status, _ = _request(base_url, "/health")
            if status == 200:
                return
        except Exception:
            pass
        time.sleep(0.2)
    raise RuntimeError("product-api did not become healthy in time")


def _login(base_url: str) -> str:
    email = f"m5-smoke-{int(time.time() * 1000)}@example.com"
    status, register_payload = _request(
        base_url,
        "/auth/register",
        method="POST",
        payload={"email": email, "password": "VeryStrongPass1!"},
    )
    assert status == 201
    verification_token = register_payload.get("verification_token")
    assert isinstance(verification_token, str)

    status, _ = _request(
        base_url,
        "/auth/verify",
        method="POST",
        payload={"token": verification_token},
    )
    assert status == 200

    status, login_payload = _request(
        base_url,
        "/auth/login",
        method="POST",
        payload={"email": email, "password": "VeryStrongPass1!"},
    )
    assert status == 200
    access_token = login_payload.get("access_token")
    assert isinstance(access_token, str)
    return access_token


def main() -> int:
    sync_env = os.environ.copy()
    sync_env.setdefault("STORE_BACKEND", "postgres")
    sync_env.setdefault(
        "DATABASE_URL",
        os.environ.get("DATABASE_URL", "postgres://postgres:postgres@127.0.0.1:5432/thesis"),
    )
    sync_env.setdefault("AUTO_MIGRATE", "true")
    sync_env.setdefault("QUEUE_BACKEND", "memory")
    sync_env.setdefault("JWT_SECRET", "dev-jwt-secret-change-me")
    sync_env.setdefault("INTERNAL_WORKER_TOKEN", "dev-internal-worker-token")
    sync_env.setdefault("AUTH_EXPOSE_VERIFICATION_TOKEN", "true")
    sync_env.setdefault("TICKER_ALLOW_FILE_INPUTS", "true")
    sync_env.setdefault("RATE_LIMIT_WINDOW_SECONDS", "60")
    sync_env.setdefault("RATE_LIMIT_MAX_REQUESTS", "120")

    _run_product_api_build(sync_env)

    port = _free_port()
    sync_env["PORT"] = str(port)
    base_url = f"http://127.0.0.1:{port}"
    headers: dict[str, str] = {}

    process = subprocess.Popen(
        ["node", str(ROOT / "apps" / "product-api" / "dist" / "apps" / "product-api" / "src" / "server.js")],
        cwd=ROOT,
        env=sync_env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    try:
        _wait_for_health(base_url)
        access_token = _login(base_url)
        headers["authorization"] = f"Bearer {access_token}"

        _run_ticker_sync(
            [
                "--mode=full",
                f"--fullNasdaqFile={FIXTURES / 'full_nasdaqlisted_sample.txt'}",
                f"--fullOtherFile={FIXTURES / 'full_otherlisted_sample.txt'}",
            ],
            env=sync_env,
        )

        status, payload = _request(base_url, "/tickers/search?q=AAPL", headers=headers)
        assert status == 200
        assert payload["data"][0]["symbol"] == "AAPL"

        _run_ticker_sync(
            [
                "--mode=delta",
                "--deltaSource=daily_list_pipe",
                f"--deltaFilePath={FIXTURES / 'daily_delta_sample.txt'}",
            ],
            env=sync_env,
        )

        status, payload = _request(base_url, "/tickers/search?q=AAPX", headers=headers)
        assert status == 200
        assert payload["data"][0]["symbol"] == "AAPX"

        status, _ = _request(base_url, "/tickers/search?q=AAPL", headers=headers)
        assert status == 404

        status, _ = _request(base_url, "/tickers/search?q=MSFT", headers=headers)
        assert status == 404

        status, payload = _request(base_url, "/tickers/search?q=NEWT", headers=headers)
        assert status == 200
        assert payload["data"][0]["symbol"] == "NEWT"

        print("M5 ticker registry delta smoke helper: PASS")
        return 0
    finally:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)


if __name__ == "__main__":
    raise SystemExit(main())
