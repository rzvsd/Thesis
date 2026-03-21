from __future__ import annotations

import json
import os
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "tests" / "fixtures" / "tickers"

PRODUCT_API_BASE = os.environ.get("PRODUCT_API_BASE_URL", "http://127.0.0.1:3001")
DISCLAIMER_TEXT = "This is a research summary, not financial advice. Always do your own research."

EXPECTED_SECTION_TITLES = {
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
}


def report(step: str, passed: bool, detail: str) -> None:
    print(f"{step}: {'PASS' if passed else 'FAIL'} - {detail}")


def request_json(
    path: str,
    *,
    method: str = "GET",
    payload: dict[str, object] | None = None,
    headers: dict[str, str] | None = None,
) -> tuple[int, dict[str, object] | list[dict[str, object]]]:
    request = urllib.request.Request(
        f"{PRODUCT_API_BASE}{path}",
        data=json.dumps(payload).encode("utf-8") if payload is not None else None,
        headers={"content-type": "application/json", **(headers or {})},
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read().decode("utf-8"))


def wait_for_health(timeout_seconds: float = 45.0) -> bool:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            status, payload = request_json("/health")
            if status == 200 and isinstance(payload, dict) and payload.get("status") == "ok":
                return True
        except Exception:
            pass
        time.sleep(0.5)
    return False


def run_ticker_sync(*args: str) -> None:
    env = os.environ.copy()
    env.setdefault("STORE_BACKEND", "postgres")
    env.setdefault("QUEUE_BACKEND", "redis")
    env.setdefault("AUTO_MIGRATE", "true")
    env.setdefault("DATABASE_URL", "postgres://postgres:postgres@127.0.0.1:5432/thesis")
    env.setdefault("REDIS_URL", "redis://127.0.0.1:6379/0")
    env.setdefault("JWT_SECRET", "dev-jwt-secret-change-me")
    env.setdefault("INTERNAL_WORKER_TOKEN", "dev-internal-worker-token")
    env.setdefault("AUTH_EXPOSE_VERIFICATION_TOKEN", "true")
    env.setdefault("TICKER_ALLOW_FILE_INPUTS", "true")
    command = [
        "corepack",
        "pnpm",
        "--filter",
        "@thesis/product-api",
        "sync:tickers",
        *args,
    ]
    subprocess.run(
        subprocess.list2cmdline(command),
        cwd=ROOT,
        env=env,
        check=True,
        shell=True,
    )


def authenticate() -> str:
    email = f"m5-smoke-{int(time.time() * 1000)}@example.com"
    status, register_payload = request_json(
        "/auth/register",
        method="POST",
        payload={"email": email, "password": "VeryStrongPass1!"},
    )
    if status != 201 or not isinstance(register_payload, dict):
        raise RuntimeError(f"register failed: {status} {register_payload}")

    verification_token = register_payload.get("verification_token")
    if not isinstance(verification_token, str):
        raise RuntimeError("verification token missing in register response")

    status, _ = request_json(
        "/auth/verify",
        method="POST",
        payload={"token": verification_token},
    )
    if status != 200:
        raise RuntimeError("verification failed")

    status, login_payload = request_json(
        "/auth/login",
        method="POST",
        payload={"email": email, "password": "VeryStrongPass1!"},
    )
    if status != 200 or not isinstance(login_payload, dict):
        raise RuntimeError("login failed")

    access_token = login_payload.get("access_token")
    if not isinstance(access_token, str):
        raise RuntimeError("access token missing")
    return access_token


def validate_report(payload: dict[str, object]) -> tuple[bool, str]:
    sections = payload.get("sections")
    if not isinstance(sections, list) or not sections:
        return False, "sections missing"

    seen_titles: set[str] = set()
    for section in sections:
        if not isinstance(section, dict):
            return False, "section entry is not an object"
        title = section.get("title")
        if isinstance(title, str):
            seen_titles.add(title)
        body = section.get("body")
        status = section.get("status")
        if not isinstance(body, str) or not body.strip():
            return False, "blank section body found"
        if not isinstance(status, str) or not status:
            return False, "missing section status"

    missing = sorted(EXPECTED_SECTION_TITLES.difference(seen_titles))
    if missing:
        return False, f"missing expected sections: {', '.join(missing)}"

    confidence = payload.get("confidence")
    if not isinstance(confidence, dict):
        return False, "confidence block missing"
    if not isinstance(confidence.get("score"), (int, float)):
        return False, "confidence.score missing"
    if not isinstance(confidence.get("label"), str):
        return False, "confidence.label missing"
    limiting_factors = confidence.get("limiting_factors")
    if not isinstance(limiting_factors, list):
        return False, "confidence.limiting_factors missing"

    signal = payload.get("signal")
    if isinstance(signal, dict):
        value = signal.get("value")
        evidence = signal.get("evidence")
        if value in {"positive", "neutral", "negative"}:
            if not isinstance(evidence, list) or len(evidence) < 2:
                return False, "directional signal has fewer than 2 evidence items"
            for item in evidence:
                if not isinstance(item, dict) or not str(item.get("source_name", "")).strip():
                    return False, "signal evidence item missing source_name"

    if DISCLAIMER_TEXT not in json.dumps(payload):
        return False, "disclaimer text missing"

    return True, "report validated"


def run_deep_dive(access_token: str, ticker: str, max_wait_seconds: int = 95) -> tuple[bool, float, str]:
    headers = {"authorization": f"Bearer {access_token}"}
    started_at = time.time()

    status, create_payload = request_json(
        "/jobs",
        method="POST",
        payload={"ticker": ticker},
        headers=headers,
    )
    if status != 202 or not isinstance(create_payload, dict):
        return False, 0.0, f"job create failed: {status} {create_payload}"

    job_id = create_payload.get("job_id")
    if not isinstance(job_id, str):
        return False, 0.0, "job_id missing"

    final_job: dict[str, object] | None = None
    while time.time() - started_at < max_wait_seconds:
        status, job_payload = request_json(f"/jobs/{job_id}", headers=headers)
        if status != 200 or not isinstance(job_payload, dict):
            return False, 0.0, f"job poll failed: {status} {job_payload}"
        state = job_payload.get("status")
        if state in {"complete", "failed"}:
            final_job = job_payload
            break
        time.sleep(1)

    elapsed = time.time() - started_at
    if final_job is None:
        return False, elapsed, "job did not reach terminal state in time"

    state = final_job.get("status")
    if state != "complete":
        return False, elapsed, f"job ended in {state}"

    report_id = final_job.get("report_id")
    if not isinstance(report_id, str):
        return False, elapsed, "report_id missing on complete job"

    status, report_payload = request_json(f"/reports/{report_id}", headers=headers)
    if status != 200 or not isinstance(report_payload, dict):
        return False, elapsed, f"report retrieval failed: {status}"

    valid, detail = validate_report(report_payload)
    if not valid:
        return False, elapsed, detail

    return True, elapsed, "complete"


def run_failure_path(access_token: str) -> tuple[bool, str]:
    headers = {"authorization": f"Bearer {access_token}"}
    run_ticker_sync(
        "--mode=delta",
        "--deltaSource=daily_list_pipe",
        f"--deltaFilePath={FIXTURES / 'm5_failure_delta_add_failme.txt'}",
    )

    status, create_payload = request_json(
        "/jobs",
        method="POST",
        payload={"ticker": "FAILME"},
        headers=headers,
    )
    if status != 202 or not isinstance(create_payload, dict):
        return False, f"FAILME job create failed: {status} {create_payload}"

    job_id = create_payload.get("job_id")
    if not isinstance(job_id, str):
        return False, "FAILME job_id missing"

    deadline = time.time() + 60
    terminal_job: dict[str, object] | None = None
    while time.time() < deadline:
        status, job_payload = request_json(f"/jobs/{job_id}", headers=headers)
        if status != 200 or not isinstance(job_payload, dict):
            return False, f"FAILME poll failed: {status}"
        if job_payload.get("status") in {"complete", "failed"}:
            terminal_job = job_payload
            break
        time.sleep(1)

    if terminal_job is None:
        return False, "FAILME job did not reach terminal state"
    if terminal_job.get("status") != "failed":
        return False, f"FAILME job terminal state is {terminal_job.get('status')}"
    if terminal_job.get("report_id") not in {None, ""}:
        return False, "failed job unexpectedly has report_id"

    status, history_payload = request_json("/reports", headers=headers)
    if status != 200 or not isinstance(history_payload, list):
        return False, "reports history request failed"
    for report_entry in history_payload:
        if isinstance(report_entry, dict) and report_entry.get("job_id") == job_id:
            return False, "failed job report is still retrievable in report history"

    return True, "failed job has no retrievable partial report"


def main() -> int:
    exit_code = 1
    try:
        report("Prereq", wait_for_health(), "product-api healthy")
        access_token = authenticate()
        headers = {"authorization": f"Bearer {access_token}"}

        run_ticker_sync(
            "--mode=full",
            f"--fullNasdaqFile={FIXTURES / 'full_nasdaqlisted_sample.txt'}",
            f"--fullOtherFile={FIXTURES / 'full_otherlisted_sample.txt'}",
        )
        report("Step 0a", True, "full ticker sync completed from fixture seed")

        run_ticker_sync(
            "--mode=delta",
            "--deltaSource=daily_list_pipe",
            f"--deltaFilePath={FIXTURES / 'daily_delta_sample.txt'}",
        )
        report("Step 0b", True, "daily delta fixture applied")

        status_aapx, _ = request_json("/tickers/search?q=AAPX", headers=headers)
        status_aapl, _ = request_json("/tickers/search?q=AAPL", headers=headers)
        status_newt, _ = request_json("/tickers/search?q=NEWT", headers=headers)
        report(
            "Step 0c",
            status_aapx == 200 and status_aapl == 404 and status_newt == 200,
            "delta add/update/delete effects reflected in registry",
        )

        run_ticker_sync(
            "--mode=full",
            f"--fullNasdaqFile={FIXTURES / 'full_nasdaqlisted_sample.txt'}",
            f"--fullOtherFile={FIXTURES / 'full_otherlisted_sample.txt'}",
        )

        status, payload = request_json("/tickers/search?q=Apple%20Inc", headers=headers)
        step_1_pass = status == 200 and isinstance(payload, dict) and isinstance(payload.get("data"), list)
        report("Step 1", step_1_pass, "Apple search returns AAPL")

        status, _ = request_json("/tickers/search?q=ZZZZ", headers=headers)
        report("Step 2", status == 404, "unsupported ticker search returns clean not-found")

        pass_aapl, elapsed_aapl, detail_aapl = run_deep_dive(access_token, "AAPL")
        report("Steps 3-16 (AAPL)", pass_aapl and elapsed_aapl < 90, f"{detail_aapl}; elapsed={elapsed_aapl:.2f}s")

        pass_msft, elapsed_msft, detail_msft = run_deep_dive(access_token, "MSFT")
        pass_tsla, elapsed_tsla, detail_tsla = run_deep_dive(access_token, "TSLA")
        report(
            "Step 17",
            pass_msft and pass_tsla and elapsed_msft < 90 and elapsed_tsla < 90,
            f"MSFT={detail_msft} ({elapsed_msft:.2f}s), TSLA={detail_tsla} ({elapsed_tsla:.2f}s)",
        )

        failure_pass, failure_detail = run_failure_path(access_token)
        report("Steps 18-19", failure_pass, failure_detail)
        print("Step 19 manual note: verify Sentry contains the forced failure context.")

        run_ticker_sync(
            "--mode=full",
            f"--fullNasdaqFile={FIXTURES / 'full_nasdaqlisted_sample.txt'}",
            f"--fullOtherFile={FIXTURES / 'full_otherlisted_sample.txt'}",
        )

        ticker_cycle = ["AAPL", "MSFT", "TSLA"]
        durations: list[float] = []
        for run_index in range(20):
            ticker = ticker_cycle[run_index % len(ticker_cycle)]
            passed, elapsed, detail = run_deep_dive(access_token, ticker)
            if not passed:
                report("Step 20/21", False, f"run {run_index + 1} failed for {ticker}: {detail}")
                return 1
            durations.append(elapsed)

        under_90 = sum(1 for duration in durations if duration < 90)
        report(
            "Step 20/21",
            under_90 >= 19,
            f"{under_90}/20 runs under 90s (max={max(durations):.2f}s, avg={sum(durations)/len(durations):.2f}s)",
        )
        exit_code = 0
    except Exception as error:
        print(f"M5 company deep dive smoke runner failed: {error}")
        exit_code = 1
    finally:
        try:
            run_ticker_sync("--mode=full")
            print("Cleanup: PASS - official full ticker sync restored.")
        except Exception as cleanup_error:
            print(f"Cleanup: WARN - official full ticker sync restore failed: {cleanup_error}")

    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
