from __future__ import annotations

import json
import math
import os
import statistics
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Callable
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
SUPPORT_DIR = ROOT / "tests" / "support"
if str(SUPPORT_DIR) not in sys.path:
    sys.path.insert(0, str(SUPPORT_DIR))

from m4_harness import (  # noqa: E402
    JsonClient,
    ProductApiProcess,
    create_news_stub_server,
    create_openbb_stub_server,
    ensure_status,
    fetch_user_profile,
    promote_user_to_pro_via_webhook,
    register_verify_login,
    sample_deep_dive_report,
    unique_email,
    wait_for_pulse_latest,
)


PASSWORD = "VeryStrongPass1!"
INTERNAL_TOKEN = "m4-suite-internal-token-1234567890"
WEBHOOK_SECRET = "m4-load-webhook-secret"
LOAD_DEEP_DIVE_VUS = 25
LOAD_PULSE_VUS = 50
LOAD_DURATION_SECONDS = 300
LOAD_NOTIFICATION_RECIPIENTS = 1000
LOAD_THRESHOLD_ERROR_RATE_PCT = 1.0
LOAD_THRESHOLD_DEEP_DIVE_P95_MS = 750.0
LOAD_THRESHOLD_PULSE_P95_MS = 300.0
LOAD_THRESHOLD_FANOUT_SECONDS = 300.0
LOAD_THRESHOLD_FANOUT_FAILURE_RATE_PCT = 1.0


@dataclass
class ScenarioMetrics:
    name: str
    attempts: int
    failures: int
    latencies_ms: list[float]

    @property
    def error_rate_pct(self) -> float:
        if self.attempts == 0:
            return 100.0
        return (self.failures / self.attempts) * 100.0

    @property
    def p95_ms(self) -> float:
        if not self.latencies_ms:
            return math.inf
        ordered = sorted(self.latencies_ms)
        index = int(math.ceil(0.95 * len(ordered))) - 1
        index = max(0, min(index, len(ordered) - 1))
        return float(ordered[index])

    @property
    def avg_ms(self) -> float:
        if not self.latencies_ms:
            return math.inf
        return float(statistics.fmean(self.latencies_ms))


def run_concurrent_scenario(
    *,
    name: str,
    workers: int,
    duration_seconds: int,
    operation: Callable[[], tuple[bool, float]]
) -> ScenarioMetrics:
    attempts = 0
    failures = 0
    latencies: list[float] = []
    lock = threading.Lock()
    deadline = time.perf_counter() + duration_seconds

    def worker() -> None:
        nonlocal attempts, failures
        while time.perf_counter() < deadline:
            try:
                ok, latency_ms = operation()
            except Exception:
                ok, latency_ms = (False, float(duration_seconds * 1000))
            with lock:
                attempts += 1
                latencies.append(latency_ms)
                if not ok:
                    failures += 1

    threads = [threading.Thread(target=worker, daemon=True) for _ in range(workers)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    return ScenarioMetrics(name=name, attempts=attempts, failures=failures, latencies_ms=latencies)


def register_device_targets(
    client: JsonClient,
    auth_header: dict[str, str],
    recipient_count: int
) -> None:
    def register_one(index: int) -> None:
        response = client.request_json(
            "/notifications/device-token",
            method="POST",
            headers=auth_header,
            payload={
                "device_token": f"m4-load-device-token-{index:04d}-abcdefghijklmnopqrstuvwxyz",
                "installation_id": f"m4-load-install-{index:04d}",
                "platform": "android"
            },
            timeout=15
        )
        ensure_status(response, 200, f"device registration failed for recipient {index}")

    with ThreadPoolExecutor(max_workers=25) as pool:
        futures = [pool.submit(register_one, i) for i in range(recipient_count)]
        for future in as_completed(futures):
            future.result()


def main() -> None:
    openbb_stub = create_openbb_stub_server()
    news_stub = create_news_stub_server()
    runtime = ProductApiProcess(
        extra_env={
            "MARKET_PULSE_DATA_OPENBB_BASE_URL": openbb_stub.base_url,
            "MARKET_PULSE_NEWS_INGEST_BASE_URL": news_stub.base_url,
            "REVENUECAT_WEBHOOK_SECRET": WEBHOOK_SECRET
        }
    )

    openbb_stub.start()
    news_stub.start()
    runtime.start()
    client = JsonClient(runtime.base_url)

    output_dir = ROOT / "artifacts" / "m4" / "load" / time.strftime("%Y-%m-%dT%H-%M-%S", time.gmtime())
    output_dir.mkdir(parents=True, exist_ok=True)
    summary_path = output_dir / "summary.json"

    started_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    suite_started = time.perf_counter()

    try:
        email = unique_email("m4.load")
        access_token = register_verify_login(client, email=email, password=PASSWORD)
        auth_header = {"authorization": f"Bearer {access_token}"}

        profile = fetch_user_profile(client, access_token)
        user_id = profile.get("user_id")
        if not isinstance(user_id, str) or not user_id:
            raise AssertionError("missing user_id from profile")

        promote_user_to_pro_via_webhook(client, user_id, WEBHOOK_SECRET)
        profile_after_upgrade = fetch_user_profile(client, access_token)
        if profile_after_upgrade.get("tier") != "PRO":
            raise AssertionError("load user was not upgraded to PRO")

        register_device_targets(client, auth_header, LOAD_NOTIFICATION_RECIPIENTS)

        pulse_dispatch = client.request_json(
            "/internal/pulse/dispatch",
            method="POST",
            headers={"x-internal-token": INTERNAL_TOKEN},
            payload={
                "cycle_start": "2026-04-05T00:00:00.000Z",
                "cycle_end": "2026-04-05T23:59:00.000Z"
            }
        )
        if pulse_dispatch.status not in (200, 202):
            raise AssertionError(f"pulse dispatch failed before load run: {pulse_dispatch.raw_body}")
        wait_for_pulse_latest(client, access_token, timeout_seconds=50)

        def deep_dive_operation() -> tuple[bool, float]:
            create_started = time.perf_counter()
            create_response = client.request_json(
                "/jobs",
                method="POST",
                headers=auth_header,
                payload={"ticker": "AAPL"},
                timeout=20
            )
            enqueue_latency_ms = (time.perf_counter() - create_started) * 1000.0
            if create_response.status != 202 or not isinstance(create_response.payload, dict):
                return False, enqueue_latency_ms
            job_id = create_response.payload.get("job_id")
            if not isinstance(job_id, str):
                return False, enqueue_latency_ms

            claim = client.request_json(
                f"/internal/jobs/{job_id}/claim",
                method="POST",
                headers={"x-internal-token": INTERNAL_TOKEN},
                timeout=20
            )
            if claim.status != 200:
                return False, enqueue_latency_ms

            report_id = f"m4-load-report-{uuid4().hex}"
            report_payload = sample_deep_dive_report(job_id, report_id)
            if isinstance(report_payload.get("historical_context"), dict):
                report_payload["historical_context"]["latest_period"] = f"LOAD-{uuid4().hex[:12]}"
            complete = client.request_json(
                f"/internal/jobs/{job_id}/complete",
                method="POST",
                headers={"x-internal-token": INTERNAL_TOKEN},
                payload={"report": report_payload},
                timeout=20
            )
            if complete.status != 200:
                return False, enqueue_latency_ms

            report = client.request_json(
                f"/reports/{report_id}",
                headers=auth_header,
                timeout=20
            )
            if report.status != 200:
                return False, enqueue_latency_ms

            return True, enqueue_latency_ms

        deep_dive_metrics = run_concurrent_scenario(
            name="deep_dive_enqueue_and_retrieval",
            workers=LOAD_DEEP_DIVE_VUS,
            duration_seconds=LOAD_DURATION_SECONDS,
            operation=deep_dive_operation
        )

        def pulse_operation() -> tuple[bool, float]:
            started = time.perf_counter()
            latest = client.request_json(
                "/pulse/latest",
                headers=auth_header,
                timeout=10
            )
            latency_ms = (time.perf_counter() - started) * 1000.0
            if latest.status != 200 or not isinstance(latest.payload, dict):
                return False, latency_ms
            if "report_id" not in latest.payload:
                return False, latency_ms
            return True, latency_ms

        pulse_metrics = run_concurrent_scenario(
            name="pulse_latest_retrieval",
            workers=LOAD_PULSE_VUS,
            duration_seconds=LOAD_DURATION_SECONDS,
            operation=pulse_operation
        )

        fanout_started = time.perf_counter()
        fanout_response = client.request_json(
            "/internal/notifications/weekly-digest",
            method="POST",
            headers={"x-internal-token": INTERNAL_TOKEN},
            payload={"digest_date": "2026-04-05"},
            timeout=360
        )
        fanout_elapsed_seconds = time.perf_counter() - fanout_started
        ensure_status(fanout_response, 200, "notification fan-out request failed")
        if not isinstance(fanout_response.payload, dict):
            raise AssertionError("fan-out payload malformed")
        fanout_attempted = int(fanout_response.payload.get("attempted", 0))
        fanout_failed = int(fanout_response.payload.get("failed", fanout_attempted))
        fanout_failure_rate_pct = (fanout_failed / fanout_attempted * 100.0) if fanout_attempted else 100.0

        thresholds = {
            "deep_dive_error_rate_under_1pct": deep_dive_metrics.error_rate_pct < LOAD_THRESHOLD_ERROR_RATE_PCT,
            "deep_dive_enqueue_p95_under_750ms": deep_dive_metrics.p95_ms < LOAD_THRESHOLD_DEEP_DIVE_P95_MS,
            "pulse_error_rate_under_1pct": pulse_metrics.error_rate_pct < LOAD_THRESHOLD_ERROR_RATE_PCT,
            "pulse_latest_p95_under_300ms": pulse_metrics.p95_ms < LOAD_THRESHOLD_PULSE_P95_MS,
            "fanout_duration_under_5min": fanout_elapsed_seconds < LOAD_THRESHOLD_FANOUT_SECONDS,
            "fanout_failure_rate_under_1pct": fanout_failure_rate_pct < LOAD_THRESHOLD_FANOUT_FAILURE_RATE_PCT,
            "fanout_attempted_1000_recipients": fanout_attempted == LOAD_NOTIFICATION_RECIPIENTS
        }

        summary = {
            "suite": "m4-load",
            "started_at": started_at,
            "ended_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "elapsed_seconds": round(time.perf_counter() - suite_started, 3),
            "config": {
                "deep_dive_vus": LOAD_DEEP_DIVE_VUS,
                "pulse_vus": LOAD_PULSE_VUS,
                "duration_seconds_per_scenario": LOAD_DURATION_SECONDS,
                "notification_recipients": LOAD_NOTIFICATION_RECIPIENTS
            },
            "scenarios": {
                "deep_dive_enqueue_and_retrieval": {
                    "attempts": deep_dive_metrics.attempts,
                    "failures": deep_dive_metrics.failures,
                    "error_rate_pct": round(deep_dive_metrics.error_rate_pct, 4),
                    "latency_p95_ms": round(deep_dive_metrics.p95_ms, 3),
                    "latency_avg_ms": round(deep_dive_metrics.avg_ms, 3)
                },
                "pulse_latest_retrieval": {
                    "attempts": pulse_metrics.attempts,
                    "failures": pulse_metrics.failures,
                    "error_rate_pct": round(pulse_metrics.error_rate_pct, 4),
                    "latency_p95_ms": round(pulse_metrics.p95_ms, 3),
                    "latency_avg_ms": round(pulse_metrics.avg_ms, 3)
                },
                "notification_fanout": {
                    "attempted": fanout_attempted,
                    "failed": fanout_failed,
                    "failure_rate_pct": round(fanout_failure_rate_pct, 4),
                    "duration_seconds": round(fanout_elapsed_seconds, 3)
                }
            },
            "thresholds": thresholds,
            "result": "pass" if all(thresholds.values()) else "fail"
        }

        summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(summary, indent=2))
        if summary["result"] != "pass":
            raise SystemExit(1)
    finally:
        runtime.close()
        openbb_stub.close()
        news_stub.close()


if __name__ == "__main__":
    main()
