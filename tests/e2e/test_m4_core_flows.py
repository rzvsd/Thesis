from __future__ import annotations

import json
import sys
import time
from pathlib import Path
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
WEBHOOK_SECRET = "m4-e2e-webhook-secret"


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

    summary: dict[str, object] = {
        "suite": "m4-e2e-core-flows",
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "steps": []
    }
    output_dir = ROOT / "artifacts" / "m4" / "e2e" / time.strftime("%Y-%m-%dT%H-%M-%S", time.gmtime())
    output_dir.mkdir(parents=True, exist_ok=True)
    summary_path = output_dir / "summary.json"
    started = time.perf_counter()

    try:
        email = unique_email("m4.e2e")
        access_token = register_verify_login(client, email=email, password=PASSWORD)
        auth_header = {"authorization": f"Bearer {access_token}"}
        summary["steps"].append({"name": "auth_register_verify_login", "status": "pass", "email": email})

        profile = fetch_user_profile(client, access_token)
        user_id = profile.get("user_id")
        if not isinstance(user_id, str) or not user_id:
            raise AssertionError("user_id missing from profile")

        promote_user_to_pro_via_webhook(client, user_id, WEBHOOK_SECRET)
        profile_after_upgrade = fetch_user_profile(client, access_token)
        if profile_after_upgrade.get("tier") != "PRO":
            raise AssertionError("subscription tier is not PRO after webhook promotion")
        summary["steps"].append({"name": "subscription_upgrade_webhook", "status": "pass"})

        for installation_suffix in ("a", "b"):
            register_device = client.request_json(
                "/notifications/device-token",
                method="POST",
                headers=auth_header,
                payload={
                    "device_token": f"m4-e2e-device-token-{installation_suffix}-12345678901234567890",
                    "installation_id": f"m4-e2e-install-{installation_suffix}",
                    "platform": "android"
                }
            )
            ensure_status(register_device, 200, "device registration failed")
        summary["steps"].append({"name": "multi_device_registration", "status": "pass", "devices": 2})

        create_job = client.request_json(
            "/jobs",
            method="POST",
            headers=auth_header,
            payload={"ticker": "AAPL"}
        )
        ensure_status(create_job, 202, "deep-dive create job failed")
        if not isinstance(create_job.payload, dict):
            raise AssertionError("create job payload malformed")
        job_id = create_job.payload.get("job_id")
        if not isinstance(job_id, str):
            raise AssertionError("job_id missing")

        claim = client.request_json(
            f"/internal/jobs/{job_id}/claim",
            method="POST",
            headers={"x-internal-token": "m4-suite-internal-token-1234567890"}
        )
        ensure_status(claim, 200, "claim failed")

        report_id = f"m4-e2e-report-{uuid4().hex[:12]}"
        complete = client.request_json(
            f"/internal/jobs/{job_id}/complete",
            method="POST",
            headers={"x-internal-token": "m4-suite-internal-token-1234567890"},
            payload={"report": sample_deep_dive_report(job_id, report_id)}
        )
        ensure_status(complete, 200, "job completion failed")

        read_job = client.request_json(f"/jobs/{job_id}", headers=auth_header)
        ensure_status(read_job, 200, "job read failed")
        if not isinstance(read_job.payload, dict):
            raise AssertionError("job payload malformed")
        if read_job.payload.get("status") != "complete":
            raise AssertionError(f"job did not complete: {read_job.raw_body}")

        reports = client.request_json("/reports", headers=auth_header)
        ensure_status(reports, 200, "reports list failed")
        if not isinstance(reports.payload, list) or len(reports.payload) < 1:
            raise AssertionError("reports history is empty")

        report = client.request_json(f"/reports/{report_id}", headers=auth_header)
        ensure_status(report, 200, "report retrieval failed")
        summary["steps"].append({"name": "deep_dive_enqueue_complete_retrieve", "status": "pass"})

        dispatch = client.request_json(
            "/internal/pulse/dispatch",
            method="POST",
            headers={"x-internal-token": "m4-suite-internal-token-1234567890"},
            payload={
                "cycle_start": "2026-04-04T00:00:00.000Z",
                "cycle_end": "2026-04-04T23:59:00.000Z"
            }
        )
        if dispatch.status not in (200, 202):
            raise AssertionError(f"pulse dispatch failed: {dispatch.raw_body}")

        latest_pulse = wait_for_pulse_latest(client, access_token, timeout_seconds=40)
        cycle_end = latest_pulse.get("cycle_end")
        if not isinstance(cycle_end, str) or len(cycle_end) < 10:
            raise AssertionError("pulse latest payload missing cycle_end")
        cycle_date = cycle_end[:10]

        pulse_by_date = client.request_json(f"/pulse/{cycle_date}", headers=auth_header)
        ensure_status(pulse_by_date, 200, "pulse retrieval by date failed")
        summary["steps"].append({"name": "pulse_dispatch_and_latest_retrieve", "status": "pass", "cycle_date": cycle_date})

        digest = client.request_json(
            "/internal/notifications/weekly-digest",
            method="POST",
            headers={"x-internal-token": "m4-suite-internal-token-1234567890"},
            payload={"digest_date": "2026-04-05"}
        )
        ensure_status(digest, 200, "weekly digest dispatch failed")
        if not isinstance(digest.payload, dict):
            raise AssertionError("weekly digest payload malformed")
        if digest.payload.get("attempted") != 2:
            raise AssertionError(f"unexpected weekly digest attempted count: {digest.raw_body}")
        if digest.payload.get("failed") != 0:
            raise AssertionError(f"weekly digest failures detected: {digest.raw_body}")
        summary["steps"].append({"name": "notification_dispatch", "status": "pass", "attempted": 2})

        elapsed_ms = int((time.perf_counter() - started) * 1000)
        summary["elapsed_ms"] = elapsed_ms
        summary["result"] = "pass"
        summary["summary_path"] = str(summary_path)
        summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(summary, indent=2))
    finally:
        runtime.close()
        openbb_stub.close()
        news_stub.close()


if __name__ == "__main__":
    main()
