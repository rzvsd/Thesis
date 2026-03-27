from __future__ import annotations

import csv
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DATA_OPENBB_ROOT = ROOT / "apps" / "data-openbb"
if str(DATA_OPENBB_ROOT) not in sys.path:
    sys.path.insert(0, str(DATA_OPENBB_ROOT))

from src.historical_loader import map_companyfacts_to_snapshots, normalize_transcript_record  # noqa: E402


def report(step: str, passed: bool, detail: str) -> bool:
    status = "PASS" if passed else "FAIL"
    print(f"{step}: {status} - {detail}")
    return passed


def main() -> int:
    ok = True
    migrations = [
        ROOT / "infra" / "migrations" / "ph2m0_004_financial_snapshots.up.sql",
        ROOT / "infra" / "migrations" / "ph2m0_004_financial_snapshots.down.sql",
        ROOT / "infra" / "migrations" / "ph2m0_005_transcripts.up.sql",
        ROOT / "infra" / "migrations" / "ph2m0_005_transcripts.down.sql",
        ROOT / "infra" / "migrations" / "ph2m0_006_ticker_coverage.up.sql",
        ROOT / "infra" / "migrations" / "ph2m0_006_ticker_coverage.down.sql",
    ]
    ok &= report("Step 1", all(path.exists() for path in migrations), "ph2m0 migration files exist")

    universe_path = ROOT / "data" / "sp500_universe.csv"
    with universe_path.open("r", encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    ok &= report("Step 2", len(rows) >= 500, "sp500 universe file has at least 500 rows")

    mapping_path = ROOT / "data" / "xbrl_concept_map.json"
    mapping_payload = json.loads(mapping_path.read_text(encoding="utf-8"))
    ok &= report("Step 3", "canonical_fields" in mapping_payload, "xbrl concept map has canonical fields")

    fixture_path = DATA_OPENBB_ROOT / "tests" / "fixtures" / "historical" / "aapl_companyfacts_sample.json"
    fixture_payload = json.loads(fixture_path.read_text(encoding="utf-8"))
    snapshots = map_companyfacts_to_snapshots(
        ticker="AAPL",
        companyfacts_payload=fixture_payload,
        mapping_payload=mapping_payload,
        retrieved_at="2026-03-26T00:00:00Z",
    )
    q4_snapshot = next((item for item in snapshots if item["period"] == "2024-Q4"), None)
    ok &= report("Step 4", q4_snapshot is not None, "mapper returns 2024-Q4 snapshot")
    ok &= report(
        "Step 5",
        bool(q4_snapshot and q4_snapshot["data"].get("revenue") == 118000.0),
        "latest-filed revenue value selected for amended filing",
    )

    transcript = normalize_transcript_record(
        {
            "symbol": "AAPL",
            "year": 2024,
            "quarter": "Q3",
            "date": "2024-07-29",
            "content": "Prepared remarks and question answer session for Q3.",
        },
        min_year=2019,
        retrieved_at="2026-03-26T00:00:00Z",
    )
    ok &= report("Step 6", bool(transcript and transcript["period"] == "2024-Q3"), "transcript normalization path works")

    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
