from __future__ import annotations

import json
import sys
import urllib.request

DATA_OPENBB_BASE = "http://127.0.0.1:3003"
NEWS_INGEST_BASE = "http://127.0.0.1:3004"


def fetch_json(url: str) -> tuple[int, dict[str, object]]:
    with urllib.request.urlopen(url) as response:
        return response.status, json.loads(response.read().decode("utf-8"))


def report(step: str, passed: bool, detail: str) -> None:
    status = "PASS" if passed else "FAIL"
    print(f"{step}: {status} - {detail}")


def main() -> int:
    try:
        status, payload = fetch_json(f"{DATA_OPENBB_BASE}/v1/finance/company?ticker=AAPL")
        finance = payload.get("data", {})
        report("Step 2/3", status == 200 and bool(payload.get("ok")) and finance.get("ticker") == "AAPL", "finance envelope and payload")

        report("Step 4", isinstance(finance.get("missing_fields"), list), "missing_fields present")
        report("Step 5", isinstance(finance.get("retrieved_at"), str), "retrieved_at present")

        status, payload = fetch_json(f"{DATA_OPENBB_BASE}/v1/finance/company?ticker=DUMMY")
        finance = payload.get("data", {})
        report("Step 6/7", status == 200 and isinstance(finance.get("missing_fields"), list), "dummy ticker returns declared missing fields")
        report("Step 8/9", True if finance.get("data") == {} else False, "dummy ticker data has no placeholder substitution")

        status, payload = fetch_json(f"{DATA_OPENBB_BASE}/v1/finance/macro?scope=daily")
        macro = payload.get("data", {})
        report(
            "Step 10/11",
            status == 200
            and bool(payload.get("ok"))
            and isinstance(macro.get("indicator"), str)
            and macro.get("provider") == "FMP",
            "macro envelope, payload, and provider",
        )

        status, payload = fetch_json(f"{NEWS_INGEST_BASE}/v1/news?date=2026-03-13")
        articles = payload.get("data", [])
        report("Step 12/13", status == 200 and bool(payload.get("ok")) and isinstance(articles, list), "news envelope and payload")
        report("Step 14", bool(articles) and all(article.get("is_approved_source") for article in articles), "approved-source flag present")

        print("Step 15/16: MANUAL - block a news source or force an outage, then rerun GET /v1/news and confirm empty list + error flag.")
        return 0
    except Exception as error:  # pragma: no cover - manual smoke helper
        print(f"Smoke runner failed: {error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
