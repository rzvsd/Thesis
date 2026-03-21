from __future__ import annotations

import json
import urllib.error
import urllib.request

DEXTER_WORKER_BASE = "http://127.0.0.1:3002"
DISCLAIMER_TEXT = "This is a research summary, not financial advice. Always do your own research."

EXPECTED_SECTION_TITLES = [
    "Executive Summary",
    "Quarter-over-Quarter Changes",
    "Year-over-Year Changes",
    "Revenue and Margin Analysis",
    "Debt and Liquidity",
    "Acquisitions and Major Events",
    "Management Commentary",
    "Research Signal",
    "Confidence Score and Limiting Factors",
    "Evidence References",
]


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


def inspect_report_shape(payload: dict[str, object]) -> tuple[bool, list[str]]:
    issues: list[str] = []
    sections = payload.get("sections")
    if not isinstance(sections, list) or not sections:
        return False, ["sections missing or empty"]

    titles = [section.get("title") for section in sections if isinstance(section, dict)]
    missing_titles = [title for title in EXPECTED_SECTION_TITLES if title not in titles]
    if missing_titles:
        issues.append(f"missing section titles: {', '.join(missing_titles)}")

    if not all(isinstance(section, dict) and section.get("status") for section in sections):
        issues.append("one or more sections are missing a status field")

    if not all(isinstance(section, dict) and str(section.get("body", "")).strip() for section in sections):
        issues.append("one or more sections have blank bodies")

    signal = payload.get("signal", {})
    if not isinstance(signal, dict):
        return False, ["signal block missing or malformed"]

    signal_value = signal.get("value")
    evidence = signal.get("evidence", [])
    if not isinstance(evidence, list):
        issues.append("signal evidence block is missing or malformed")
    elif signal_value in {"positive", "neutral", "negative"} and len(evidence) < 2:
        issues.append(f"signal evidence count is {len(evidence)}; expected at least 2 for directional signal")

    body_blob = json.dumps(payload)
    if DISCLAIMER_TEXT not in body_blob:
        issues.append("canonical disclaimer text is missing")

    return len(issues) == 0, issues


def main() -> int:
    try:
        with urllib.request.urlopen(f"{DEXTER_WORKER_BASE}/health") as response:
            payload = json.loads(response.read().decode("utf-8"))
            report("Step 1", response.status == 200 and payload.get("status") == "ok", "dexter-worker healthy")

        status, payload = post_json("/v1/analyze", request_payload("MSFT"))
        report("Step 2/3", status == 200 and payload.get("ticker") == "MSFT", "MSFT report returned")
        ok, issues = inspect_report_shape(payload)
        report("Step 4/5", ok, "report includes PRD-aligned sections, statuses, evidence, and disclaimer" if ok else "; ".join(issues))

        status, payload = post_json("/v1/analyze", request_payload("LIMITED"))
        degraded_statuses = {section["status"] for section in payload.get("sections", []) if isinstance(section, dict)}
        report("Step 6/7", status == 200 and ("data_incomplete" in degraded_statuses or "data_unavailable" in degraded_statuses), "limited-data request degrades honestly")
        report("Step 8", payload.get("signal", {}).get("value") == "no_signal", "limited-data path downgrades to no_signal")

        status, payload = post_json("/v1/analyze", request_payload("TIMEOUT"))
        timeout_statuses = {section["section_id"]: section["status"] for section in payload.get("sections", []) if isinstance(section, dict)}
        report(
            "Step 9/10",
            timeout_statuses.get("revenue_margin_analysis") in {"data_unavailable", "data_incomplete"},
            f"timed-out section status: {timeout_statuses.get('revenue_margin_analysis')}",
        )

        print("Step 11: MANUAL - open LangSmith and confirm trace visibility for a live non-fixture run.")
        print("Step 12: MANUAL - confirm the completed report artifact and retrieval path in the product layer.")
        print("Step 13: MANUAL - if the product layer is wired to store failed jobs only, verify no partial report is retrievable.")
        return 0
    except urllib.error.HTTPError as error:
        print(f"Smoke runner HTTP failure: {error.code} {error.reason}")
        return 1
    except Exception as error:
        print(f"Smoke runner failed: {error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
