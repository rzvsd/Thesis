from __future__ import annotations

import json
import sys
import urllib.request

DEXTER_WORKER_BASE = "http://127.0.0.1:3002"


def post_json(path: str, payload: dict[str, object]) -> tuple[int, dict[str, object]]:
    request = urllib.request.Request(
        f"{DEXTER_WORKER_BASE}{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"content-type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request) as response:
        return response.status, json.loads(response.read().decode("utf-8"))


def report(step: str, passed: bool, detail: str) -> None:
    print(f"{step}: {'PASS' if passed else 'FAIL'} - {detail}")


def request_payload(ticker: str) -> dict[str, object]:
    return {
        "request_id": f"req-{ticker.lower()}",
        "type": "deep_dive",
        "ticker": ticker,
        "job_id": f"job-{ticker.lower()}",
        "requested_at": "2026-03-15T12:00:00.000Z",
    }


def main() -> int:
    try:
        with urllib.request.urlopen(f"{DEXTER_WORKER_BASE}/health") as response:
            payload = json.loads(response.read().decode("utf-8"))
            report("Step 1", response.status == 200 and payload.get("status") == "ok", "dexter-worker healthy")

        status, payload = post_json("/v1/analyze", request_payload("MSFT"))
        report("Step 2/3", status == 200 and payload.get("ticker") == "MSFT", "valid AnalysisRequest accepted")
        report("Step 4/5", isinstance(payload.get("sections"), list) and payload.get("schema_version") == "1.0.0", "schema-valid report shape returned")
        report("Step 6/7", bool(payload.get("sections")) and all("status" in section for section in payload["sections"]), "all sections present with status")
        report("Step 8", payload.get("signal", {}).get("value") == "positive", "scored run carries signal")

        status, payload = post_json("/v1/analyze", request_payload("LIMITED"))
        degraded_statuses = {section["status"] for section in payload.get("sections", [])}
        report("Step 10/11", status == 200 and ("data_incomplete" in degraded_statuses or "data_unavailable" in degraded_statuses), "limited-data request degrades honestly")

        status, payload = post_json("/v1/analyze", request_payload("NOSIG"))
        report("Step 12/13", status == 200 and payload.get("signal", {}).get("value") == "no_signal", "no_signal path returns reason instead of fabricated score")

        status, payload = post_json("/v1/analyze", request_payload("TIMEOUT"))
        timeout_statuses = {section["section_id"]: section["status"] for section in payload.get("sections", [])}
        report("Step 14/15", timeout_statuses.get("revenue_margin_analysis") == "failed", "timed-out section marked failed and report still returned")

        print("Step 9: MANUAL - open LangSmith and confirm trace visibility for a live non-fixture run.")
        print("Step 16: AUTOMATED - covered by the dexter-worker and integration test suites.")
        return 0
    except Exception as error:
        print(f"Smoke runner failed: {error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
