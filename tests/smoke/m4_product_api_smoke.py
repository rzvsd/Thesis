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
INTERNAL_TOKEN = "dev-internal-worker-token"


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _request(
    base_url: str,
    path: str,
    *,
    method: str = "GET",
    payload: dict[str, object] | None = None,
    headers: dict[str, str] | None = None,
) -> tuple[int, dict[str, object] | list[dict[str, object]]]:
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


def _sample_report(job_id: str) -> dict[str, object]:
    return {
        "report_id": "report-m4-smoke-1",
        "job_id": job_id,
        "schema_version": "1.0.0",
        "type": "deep_dive",
        "ticker": "AAPL",
        "generated_at": "2026-03-20T12:00:00.000Z",
        "confidence": {
            "score": 0.62,
            "label": "medium",
            "limiting_factors": [],
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
                    "retrieved_at": "2026-03-20T12:00:00.000Z",
                    "url": "https://example.com/news",
                }
            ],
        },
        "sections": [
            {
                "section_id": "executive_summary",
                "title": "Executive Summary",
                "body": "Sample report",
                "status": "complete",
                "evidence": [],
            }
        ],
        "flags": [],
        "data_sources": ["fixture-news"],
    }


def main() -> int:
    port = _free_port()
    env = os.environ.copy()
    env["PORT"] = str(port)
    env["STORE_BACKEND"] = "memory"
    env["QUEUE_BACKEND"] = "memory"
    env["AUTH_EXPOSE_VERIFICATION_TOKEN"] = "true"
    env["JWT_SECRET"] = "dev-jwt-secret-change-me"
    env["INTERNAL_WORKER_TOKEN"] = INTERNAL_TOKEN
    env["RATE_LIMIT_MAX_REQUESTS"] = "120"
    env["RATE_LIMIT_WINDOW_SECONDS"] = "60"

    process = subprocess.Popen(
        ["node", str(ROOT / "apps" / "product-api" / "dist" / "apps" / "product-api" / "src" / "server.js")],
        cwd=str(ROOT),
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    try:
        base_url = f"http://127.0.0.1:{port}"
        deadline = time.time() + 20
        while time.time() < deadline:
            status, _ = _request(base_url, "/health")
            if status == 200:
                break
            time.sleep(0.25)
        else:
            raise RuntimeError("product-api did not become healthy")

        # Step 1-2 register
        status, payload = _request(
            base_url,
            "/auth/register",
            method="POST",
            payload={"email": "m4-smoke@example.com", "password": "VeryStrongPass1!"},
        )
        assert status == 201
        verification_token = payload["verification_token"]

        # Step 3 verify
        status, _ = _request(
            base_url,
            "/auth/verify",
            method="POST",
            payload={"token": verification_token},
        )
        assert status == 200

        # Step 4 login
        status, payload = _request(
            base_url,
            "/auth/login",
            method="POST",
            payload={"email": "m4-smoke@example.com", "password": "VeryStrongPass1!"},
        )
        assert status == 200
        access_token = payload["access_token"]
        refresh_token = payload["refresh_token"]

        # Step 6 unauthorized protected request
        status, _ = _request(base_url, "/jobs", method="POST", payload={"ticker": "AAPL"})
        assert status == 401

        # Step 7 refresh
        status, payload = _request(
            base_url,
            "/auth/refresh",
            method="POST",
            payload={"refresh_token": refresh_token},
        )
        assert status == 200
        access_token = payload["access_token"]

        # Step 8 logout
        status, _ = _request(
            base_url,
            "/auth/logout",
            method="POST",
            headers={"authorization": f"Bearer {access_token}"},
        )
        assert status == 200

        # Step 9 refresh token rejected after logout
        status, _ = _request(
            base_url,
            "/auth/refresh",
            method="POST",
            payload={"refresh_token": refresh_token},
        )
        assert status == 401

        # Step 10 login again
        status, payload = _request(
            base_url,
            "/auth/login",
            method="POST",
            payload={"email": "m4-smoke@example.com", "password": "VeryStrongPass1!"},
        )
        assert status == 200
        access_token = payload["access_token"]

        # Step 11-12 create job
        status, payload = _request(
            base_url,
            "/jobs",
            method="POST",
            payload={"ticker": "AAPL"},
            headers={"authorization": f"Bearer {access_token}"},
        )
        assert status == 202
        assert payload["status"] == "queued"
        job_id = payload["job_id"]

        # Step 13 worker claim
        status, _ = _request(
            base_url,
            f"/internal/jobs/{job_id}/claim",
            method="POST",
            headers={"x-internal-token": INTERNAL_TOKEN},
        )
        assert status == 200

        # Step 14-16 complete and retrieve
        status, payload = _request(
            base_url,
            f"/internal/jobs/{job_id}/complete",
            method="POST",
            payload={"report": _sample_report(job_id)},
            headers={"x-internal-token": INTERNAL_TOKEN},
        )
        assert status == 200
        report_id = payload["report_id"]

        status, payload = _request(
            base_url,
            f"/reports/{report_id}",
            headers={"authorization": f"Bearer {access_token}"},
        )
        assert status == 200
        assert payload["report_id"] == report_id

        # Step 17 history
        status, payload = _request(
            base_url,
            "/reports",
            headers={"authorization": f"Bearer {access_token}"},
        )
        assert status == 200
        assert len(payload) >= 1

        # Step 18-20 failure path
        status, payload = _request(
            base_url,
            "/jobs",
            method="POST",
            payload={"ticker": "AAPL"},
            headers={"authorization": f"Bearer {access_token}"},
        )
        assert status == 202
        failed_job_id = payload["job_id"]
        status, _ = _request(
            base_url,
            f"/internal/jobs/{failed_job_id}/fail",
            method="POST",
            payload={"error_message": "forced smoke failure"},
            headers={"x-internal-token": INTERNAL_TOKEN},
        )
        assert status == 200

        status, payload = _request(
            base_url,
            f"/jobs/{failed_job_id}",
            headers={"authorization": f"Bearer {access_token}"},
        )
        assert status == 200
        assert payload["status"] == "failed"

        # Step 21 unauthenticated request
        status, _ = _request(base_url, "/reports")
        assert status == 401

        print("M4 smoke helper: PASS")
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
