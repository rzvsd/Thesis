from __future__ import annotations

import json
import os
import socket
import subprocess
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _sample_report(job_id: str) -> dict[str, object]:
    return {
        "report_id": "report-m4-int-1",
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


class M4ProductApiIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.port = _free_port()
        env = os.environ.copy()
        env["PORT"] = str(cls.port)
        env["STORE_BACKEND"] = "memory"
        env["QUEUE_BACKEND"] = "memory"
        env["AUTH_EXPOSE_VERIFICATION_TOKEN"] = "true"
        env["JWT_SECRET"] = "dev-jwt-secret-change-me"
        env["INTERNAL_WORKER_TOKEN"] = "dev-internal-worker-token"

        cls.process = subprocess.Popen(
            ["node", str(ROOT / "apps" / "product-api" / "dist" / "apps" / "product-api" / "src" / "server.js")],
            cwd=str(ROOT),
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        cls.base_url = f"http://127.0.0.1:{cls.port}"

        deadline = time.time() + 20
        while time.time() < deadline:
            try:
                with urllib.request.urlopen(f"{cls.base_url}/health", timeout=2) as response:
                    if response.status == 200:
                        return
            except Exception:
                time.sleep(0.25)
        raise RuntimeError("product-api failed to start for integration tests")

    @classmethod
    def tearDownClass(cls) -> None:
        if cls.process.poll() is None:
            cls.process.terminate()
            try:
                cls.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                cls.process.kill()
                cls.process.wait(timeout=5)

    def request_json(
        self,
        path: str,
        method: str = "GET",
        payload: dict[str, object] | None = None,
        headers: dict[str, str] | None = None,
    ) -> tuple[int, dict[str, object] | list[dict[str, object]]]:
        request = urllib.request.Request(
            f"{self.base_url}{path}",
            data=json.dumps(payload).encode("utf-8") if payload is not None else None,
            headers={"content-type": "application/json", **(headers or {})},
            method=method,
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                return response.status, json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read().decode("utf-8"))

    def test_auth_and_job_lifecycle(self) -> None:
        register_status, register_payload = self.request_json(
            "/auth/register",
            method="POST",
            payload={"email": "m4-int@example.com", "password": "VeryStrongPass1!"},
        )
        self.assertEqual(register_status, 201)
        self.assertIn("verification_token", register_payload)

        verify_status, _ = self.request_json(
            "/auth/verify",
            method="POST",
            payload={"token": register_payload["verification_token"]},
        )
        self.assertEqual(verify_status, 200)

        login_status, login_payload = self.request_json(
            "/auth/login",
            method="POST",
            payload={"email": "m4-int@example.com", "password": "VeryStrongPass1!"},
        )
        self.assertEqual(login_status, 200)
        access_token = login_payload["access_token"]

        unauth_status, _ = self.request_json("/jobs", method="POST", payload={"ticker": "AAPL"})
        self.assertEqual(unauth_status, 401)

        create_status, create_payload = self.request_json(
            "/jobs",
            method="POST",
            payload={"ticker": "AAPL"},
            headers={"authorization": f"Bearer {access_token}"},
        )
        self.assertEqual(create_status, 202)
        job_id = create_payload["job_id"]

        claim_status, claim_payload = self.request_json(
            f"/internal/jobs/{job_id}/claim",
            method="POST",
            headers={"x-internal-token": "dev-internal-worker-token"},
        )
        self.assertEqual(claim_status, 200)
        self.assertEqual(claim_payload["analysis_request"]["job_id"], job_id)

        complete_status, _ = self.request_json(
            f"/internal/jobs/{job_id}/complete",
            method="POST",
            payload={"report": _sample_report(job_id)},
            headers={"x-internal-token": "dev-internal-worker-token"},
        )
        self.assertEqual(complete_status, 200)

        job_status, job_payload = self.request_json(
            f"/jobs/{job_id}",
            headers={"authorization": f"Bearer {access_token}"},
        )
        self.assertEqual(job_status, 200)
        self.assertEqual(job_payload["status"], "complete")

        history_status, history_payload = self.request_json(
            "/reports",
            headers={"authorization": f"Bearer {access_token}"},
        )
        self.assertEqual(history_status, 200)
        self.assertEqual(len(history_payload), 1)

        report_id = history_payload[0]["report_id"]
        report_status, report_payload = self.request_json(
            f"/reports/{report_id}",
            headers={"authorization": f"Bearer {access_token}"},
        )
        self.assertEqual(report_status, 200)
        self.assertEqual(report_payload["report_id"], report_id)


if __name__ == "__main__":
    unittest.main(verbosity=2)
