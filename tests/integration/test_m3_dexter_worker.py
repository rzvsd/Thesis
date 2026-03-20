from __future__ import annotations

import json
import os
import socket
import subprocess
import time
import unittest
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


class M3DexterWorkerIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.port = _free_port()
        env = os.environ.copy()
        env["PORT"] = str(cls.port)
        env["DEXTER_FIXTURE_MODE"] = "true"
        cls.process = subprocess.Popen(
            ["node", str(ROOT / "apps" / "dexter-worker" / "dist" / "apps" / "dexter-worker" / "src" / "server.js")],
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

        raise RuntimeError("dexter-worker failed to start for integration tests")

    @classmethod
    def tearDownClass(cls) -> None:
        if cls.process.poll() is None:
            cls.process.terminate()
            try:
                cls.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                cls.process.kill()
                cls.process.wait(timeout=5)

    def post_json(self, path: str, payload: dict[str, object]) -> tuple[int, dict[str, object]]:
        request = urllib.request.Request(
            f"{self.base_url}{path}",
            data=json.dumps(payload).encode("utf-8"),
            headers={"content-type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=10) as response:
            return response.status, json.loads(response.read().decode("utf-8"))

    def test_fixture_analysis_request_returns_honest_report(self) -> None:
        status, payload = self.post_json(
            "/v1/analyze",
            {
                "request_id": "req-msft",
                "type": "deep_dive",
                "ticker": "MSFT",
                "job_id": "job-msft",
                "requested_at": "2026-03-15T12:00:00.000Z",
            },
        )
        self.assertEqual(status, 200)
        self.assertEqual(payload["type"], "deep_dive")
        self.assertEqual(payload["ticker"], "MSFT")
        self.assertGreaterEqual(len(payload["sections"]), 5)
        self.assertTrue(all(section["body"].strip() for section in payload["sections"]))

    def test_no_signal_path_returns_reason(self) -> None:
        status, payload = self.post_json(
            "/v1/analyze",
            {
                "request_id": "req-nosig",
                "type": "deep_dive",
                "ticker": "NOSIG",
                "job_id": "job-nosig",
                "requested_at": "2026-03-15T12:00:00.000Z",
            },
        )
        self.assertEqual(status, 200)
        self.assertEqual(payload["signal"]["value"], "no_signal")
        self.assertGreaterEqual(len(payload["signal"]["reasons"]), 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
