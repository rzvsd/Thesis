from __future__ import annotations

import json
import os
from dataclasses import replace
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

try:
    from .historical_loader import (
        HistoricalLoadConfig,
        download_sec_companyfacts_archive,
        index_companyfacts_members,
        ingest_hf_transcripts,
        load_universe,
        load_xbrl_concept_map,
        map_companyfacts_to_snapshots,
        read_companyfacts_by_cik,
        upsert_financial_snapshots,
        upsert_ticker_coverage,
    )
except ImportError:  # pragma: no cover - supports direct src imports in sibling tests
    from historical_loader import (
        HistoricalLoadConfig,
        download_sec_companyfacts_archive,
        index_companyfacts_members,
        ingest_hf_transcripts,
        load_universe,
        load_xbrl_concept_map,
        map_companyfacts_to_snapshots,
        read_companyfacts_by_cik,
        upsert_financial_snapshots,
        upsert_ticker_coverage,
    )


def _sync_log(level: str, message: str, **fields: Any) -> None:
    payload: dict[str, Any] = {
        "level": level,
        "service": "data-openbb-m1-sync",
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    payload.update({key: value for key, value in fields.items() if value is not None})
    print(json.dumps(payload, separators=(",", ":")), flush=True)


def should_include_transcripts(
    *,
    now_utc: datetime,
    timezone_name: str,
    transcript_weekday: int,
) -> bool:
    local_now = now_utc.astimezone(ZoneInfo(timezone_name))
    return local_now.weekday() == transcript_weekday


def _load_sync_config() -> tuple[HistoricalLoadConfig, str | None, str, int]:
    config = HistoricalLoadConfig.from_env()
    dataset_id = str(os.environ.get("M1_HF_DATASET_ID", "")).strip()
    if dataset_id:
        config = replace(config, hf_dataset_id=dataset_id)

    revision = str(os.environ.get("M1_HF_REVISION", "main")).strip() or None
    timezone_name = str(os.environ.get("M1_TRANSCRIPT_SYNC_TIMEZONE", "America/New_York")).strip() or "America/New_York"
    transcript_weekday = int(str(os.environ.get("M1_TRANSCRIPT_SYNC_WEEKDAY", "6")).strip())
    if transcript_weekday < 0 or transcript_weekday > 6:
        raise ValueError("M1_TRANSCRIPT_SYNC_WEEKDAY must be in range 0..6 (Monday=0, Sunday=6)")

    return config, revision, timezone_name, transcript_weekday


def run_historical_delta_sync(*, include_transcripts: bool | None = None) -> dict[str, Any]:
    config, revision_override, timezone_name, transcript_weekday = _load_sync_config()
    if not config.database_url:
        raise RuntimeError("DATABASE_URL must be configured for historical delta sync.")

    now_utc = datetime.now(timezone.utc)
    run_transcripts = include_transcripts
    if run_transcripts is None:
        run_transcripts = should_include_transcripts(
            now_utc=now_utc,
            timezone_name=timezone_name,
            transcript_weekday=transcript_weekday,
        )

    universe = load_universe(config.universe_csv_path)
    mapping_payload = load_xbrl_concept_map(config.xbrl_mapping_path)
    archive_path = download_sec_companyfacts_archive(config)
    member_index = index_companyfacts_members(archive_path)

    try:
        import psycopg  # type: ignore
    except ImportError as error:  # pragma: no cover - environment-specific dependency surface
        raise RuntimeError("Missing dependency 'psycopg'. Install app requirements first.") from error

    sec_rows_written = 0
    sec_ticker_failures = 0
    transcript_rows_written = 0
    transcript_source_rows = 0
    transcript_sync_status = "skipped"
    transcript_snapshot_revision: str | None = None
    status_by_ticker: dict[str, str] = {}

    _sync_log(
        "INFO",
        "Historical delta sync started",
        universe_size=len(universe),
        include_transcripts=run_transcripts,
        transcript_weekday=transcript_weekday,
        transcript_timezone=timezone_name,
        transcript_revision_mode=revision_override or "default",
    )

    with psycopg.connect(config.database_url) as conn:
        conn.autocommit = False
        for ticker in universe:
            try:
                payload = read_companyfacts_by_cik(archive_path, member_index, ticker.cik)
                snapshots = map_companyfacts_to_snapshots(
                    ticker=ticker.ticker,
                    companyfacts_payload=payload,
                    mapping_payload=mapping_payload,
                    retrieved_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                )
                sec_rows_written += upsert_financial_snapshots(conn, snapshots)
                status_by_ticker[ticker.ticker] = "success"
            except Exception as error:  # pragma: no cover - exercised in live runs
                sec_ticker_failures += 1
                status_by_ticker[ticker.ticker] = "partial"
                _sync_log(
                    "ERROR",
                    "SEC ticker delta failed",
                    ticker=ticker.ticker,
                    cik=ticker.cik,
                    error_message=str(error),
                )

        if run_transcripts:
            try:
                transcript_rows_written, transcript_source_rows, transcript_snapshot_revision = ingest_hf_transcripts(
                    conn,
                    config,
                    tickers_filter={row.ticker for row in universe},
                    revision_override=revision_override,
                )
                transcript_sync_status = "success"
            except Exception as error:  # pragma: no cover - exercised in live runs
                transcript_sync_status = "failed"
                for ticker, status in list(status_by_ticker.items()):
                    if status == "success":
                        status_by_ticker[ticker] = "partial"
                _sync_log(
                    "ERROR",
                    "Transcript sync failed",
                    error_message=str(error),
                )

        coverage_rows = upsert_ticker_coverage(
            conn,
            tickers=universe,
            status_by_ticker=status_by_ticker,
        )
        conn.commit()

    summary = {
        "sec_rows_written": sec_rows_written,
        "sec_ticker_failures": sec_ticker_failures,
        "coverage_rows": coverage_rows,
        "include_transcripts": run_transcripts,
        "transcript_rows_written": transcript_rows_written,
        "transcript_source_rows": transcript_source_rows,
        "transcript_sync_status": transcript_sync_status,
        "transcript_snapshot_revision": transcript_snapshot_revision,
    }
    _sync_log("INFO", "Historical delta sync completed", **summary)
    return summary
