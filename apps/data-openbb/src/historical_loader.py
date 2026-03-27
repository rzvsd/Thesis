from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import tempfile
import urllib.request
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


def _fintech_repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _load_fintech_dotenv() -> None:
    """Populate os.environ from fintech/.env (does not override existing vars)."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    path = _fintech_repo_root() / ".env"
    if path.is_file():
        load_dotenv(path, override=False)


ALLOWED_SEC_FORMS = {"10-Q", "10-K", "10-Q/A", "10-K/A"}
SUPPORTED_PERIOD_TYPES = {"quarterly", "annual"}
INTERNAL_ONLY_FIELDS = {"pretax_income"}
REQUIRED_CONCEPT_FIELDS = {"revenue", "operating_income", "net_income", "total_assets", "total_liabilities"}
CIK_MEMBER_PATTERN = re.compile(r"CIK(?P<cik>\d{10})\.json$", re.IGNORECASE)
TOP_20_TIER_1 = {
    "AAPL",
    "MSFT",
    "NVDA",
    "AMZN",
    "GOOGL",
    "META",
    "BRK-B",
    "LLY",
    "AVGO",
    "JPM",
    "XOM",
    "UNH",
    "V",
    "MA",
    "COST",
    "PG",
    "JNJ",
    "HD",
    "WMT",
    "NFLX",
}


@dataclass(frozen=True)
class UniverseTicker:
    ticker: str
    cik: str
    company_name: str
    tier: int


@dataclass(frozen=True)
class HistoricalLoadConfig:
    database_url: str
    sec_user_agent: str
    sec_companyfacts_zip_url: str
    sec_company_tickers_url: str
    hf_dataset_id: str
    hf_revision: str
    transcript_min_year: int
    expected_hf_rows: int
    universe_csv_path: Path
    xbrl_mapping_path: Path
    validation_output_path: Path

    @classmethod
    def from_env(cls, env: dict[str, str] | None = None) -> "HistoricalLoadConfig":
        values = env or dict(os.environ)
        repo_root = _fintech_repo_root()
        return cls(
            database_url=values.get("DATABASE_URL", "").strip(),
            sec_user_agent=values.get("SEC_USER_AGENT", "").strip(),
            sec_companyfacts_zip_url=values.get(
                "M0_SEC_COMPANYFACTS_ZIP_URL",
                "https://www.sec.gov/Archives/edgar/daily-index/xbrl/companyfacts.zip",
            ).strip(),
            sec_company_tickers_url=values.get(
                "M0_SEC_COMPANY_TICKERS_URL",
                "https://www.sec.gov/files/company_tickers.json",
            ).strip(),
            hf_dataset_id=values.get("M0_HF_DATASET_ID", "kurry/sp500_earnings_transcripts").strip(),
            hf_revision=values.get("M0_HF_REVISION", "f3ded372da8d18dc6ad98955c4558e34b5fe6d45").strip(),
            transcript_min_year=int(values.get("M0_TRANSCRIPT_MIN_YEAR", "2019")),
            expected_hf_rows=int(values.get("M0_EXPECTED_HF_ROWS", "33362")),
            universe_csv_path=repo_root / "data" / "sp500_universe.csv",
            xbrl_mapping_path=repo_root / "data" / "xbrl_concept_map.json",
            validation_output_path=repo_root / "data" / "artifacts" / "m0_validation_report.json",
        )


def iso_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def log(level: str, message: str, **fields: Any) -> None:
    payload: dict[str, Any] = {
        "level": level,
        "service": "data-openbb-m0-loader",
        "message": message,
        "timestamp": iso_timestamp(),
    }
    payload.update({key: value for key, value in fields.items() if value is not None})
    print(json.dumps(payload, separators=(",", ":")), flush=True)


def normalize_ticker(value: str) -> str:
    return str(value).strip().upper().replace(".", "-")


def deterministic_id(*parts: str) -> str:
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()


def load_universe(path: Path) -> list[UniverseTicker]:
    if not path.exists():
        raise FileNotFoundError(f"Universe file not found: {path}")

    tickers: list[UniverseTicker] = []
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        required_columns = {"ticker", "cik", "company_name", "tier"}
        if not required_columns.issubset(set(reader.fieldnames or [])):
            raise ValueError(f"Universe file must include columns: {sorted(required_columns)}")

        for row in reader:
            ticker = normalize_ticker(row["ticker"])
            cik = str(row["cik"]).strip().zfill(10)
            company_name = str(row["company_name"]).strip()
            tier = int(row["tier"])
            if tier not in (1, 2, 3):
                raise ValueError(f"Invalid tier value for {ticker}: {tier}")
            tickers.append(UniverseTicker(ticker=ticker, cik=cik, company_name=company_name, tier=tier))

    return tickers


def load_xbrl_concept_map(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if "canonical_fields" not in payload:
        raise ValueError("xbrl concept map missing canonical_fields")
    return payload


def _http_get(url: str, *, user_agent: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": user_agent})
    with urllib.request.urlopen(req) as response:  # noqa: S310 - SEC/HF endpoints are expected network inputs.
        return response.read()


def download_sec_companyfacts_archive(config: HistoricalLoadConfig, destination: Path | None = None) -> Path:
    if not config.sec_user_agent:
        raise ValueError("SEC_USER_AGENT is required for SEC downloads.")

    out_path = destination or (Path(tempfile.gettempdir()) / "thesis-companyfacts.zip")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    log("INFO", "SEC archive download started", url=config.sec_companyfacts_zip_url)
    data = _http_get(config.sec_companyfacts_zip_url, user_agent=config.sec_user_agent)
    out_path.write_bytes(data)
    log("INFO", "SEC archive download completed", bytes=len(data), path=str(out_path))
    return out_path


def index_companyfacts_members(zip_path: Path) -> dict[str, str]:
    cik_to_member: dict[str, str] = {}
    with zipfile.ZipFile(zip_path, "r") as archive:
        for member in archive.namelist():
            match = CIK_MEMBER_PATTERN.search(member)
            if match:
                cik_to_member[match.group("cik")] = member
    if not cik_to_member:
        raise ValueError(f"No CIK JSON members found in SEC archive: {zip_path}")
    return cik_to_member


def read_companyfacts_by_cik(zip_path: Path, member_index: dict[str, str], cik: str) -> dict[str, Any]:
    member = member_index.get(cik)
    if member is None:
        raise KeyError(f"CIK {cik} not found in SEC archive")

    with zipfile.ZipFile(zip_path, "r") as archive:
        with archive.open(member) as handle:
            return json.loads(handle.read().decode("utf-8"))


def _normalize_filing_date(value: Any) -> str | None:
    if not value:
        return None
    text = str(value).strip()
    if not text:
        return None
    return text[:10]


def _period_from_fact_entry(entry: dict[str, Any]) -> tuple[str, str, int, int | None] | None:
    form = str(entry.get("form", "")).strip().upper()
    if form not in ALLOWED_SEC_FORMS:
        return None

    fiscal_year = entry.get("fy")
    fiscal_period = str(entry.get("fp", "")).strip().upper()
    try:
        year = int(fiscal_year)
    except (TypeError, ValueError):
        return None

    if fiscal_period in {"Q1", "Q2", "Q3", "Q4"}:
        fiscal_quarter = int(fiscal_period[-1])
        return (f"{year}-Q{fiscal_quarter}", "quarterly", year, fiscal_quarter)

    if fiscal_period == "FY":
        return (f"{year}-FY", "annual", year, None)

    return None


def _parse_iso_date(value: Any) -> datetime | None:
    if not value:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return datetime.strptime(text[:10], "%Y-%m-%d")
    except ValueError:
        return None


def _duration_days(entry: dict[str, Any]) -> int | None:
    start = _parse_iso_date(entry.get("start"))
    end = _parse_iso_date(entry.get("end"))
    if start is None or end is None or end < start:
        return None
    return (end - start).days + 1


def _duration_score(period_type: str, duration_days: int | None) -> tuple[int, int]:
    if duration_days is None:
        return (2, 9999)
    if period_type == "quarterly":
        if 60 <= duration_days <= 110:
            return (0, abs(duration_days - 91))
        return (1, abs(duration_days - 91))
    if period_type == "annual":
        if 300 <= duration_days <= 380:
            return (0, abs(duration_days - 365))
        return (1, abs(duration_days - 365))
    return (2, 9999)


def _is_better_period_entry(
    *,
    period_type: str,
    candidate_value: float,
    candidate_filed: str | None,
    candidate_duration: int | None,
    existing_value: float,
    existing_filed: str | None,
    existing_duration: int | None,
) -> bool:
    candidate_score = _duration_score(period_type, candidate_duration)
    existing_score = _duration_score(period_type, existing_duration)
    if candidate_score < existing_score:
        return True
    if candidate_score > existing_score:
        return False
    if (candidate_filed or "") > (existing_filed or ""):
        return True
    if (candidate_filed or "") < (existing_filed or ""):
        return False
    return candidate_value != existing_value


def _unit_allowed(field: str, unit: str, unit_hints: dict[str, list[str]]) -> bool:
    allowed_units = unit_hints.get(field) or unit_hints.get("default") or []
    if not allowed_units:
        return True
    return unit in allowed_units


def _select_concept_values(
    facts: dict[str, Any],
    *,
    field: str,
    concepts: list[str],
    unit_hints: dict[str, list[str]],
) -> tuple[dict[tuple[str, str, int, int | None], tuple[float, str | None]], str | None]:
    merged_period_values: dict[tuple[str, str, int, int | None], tuple[float, str | None]] = {}
    matched_concept: str | None = None

    for concept in concepts:
        concept_payload = facts.get(concept)
        if not isinstance(concept_payload, dict):
            continue
        units = concept_payload.get("units")
        if not isinstance(units, dict):
            continue

        period_values: dict[tuple[str, str, int, int | None], tuple[float, str | None, int | None]] = {}
        for unit, entries in units.items():
            if not _unit_allowed(field, unit, unit_hints):
                continue
            if not isinstance(entries, list):
                continue
            for entry in entries:
                if not isinstance(entry, dict):
                    continue
                period = _period_from_fact_entry(entry)
                if period is None:
                    continue
                raw_value = entry.get("val")
                try:
                    value = float(raw_value)
                except (TypeError, ValueError):
                    continue
                filed = _normalize_filing_date(entry.get("filed"))
                duration = _duration_days(entry)
                existing = period_values.get(period)
                if existing is None:
                    period_values[period] = (value, filed, duration)
                    continue

                if _is_better_period_entry(
                    period_type=period[1],
                    candidate_value=value,
                    candidate_filed=filed,
                    candidate_duration=duration,
                    existing_value=existing[0],
                    existing_filed=existing[1],
                    existing_duration=existing[2],
                ):
                    period_values[period] = (value, filed, duration)

        if not period_values:
            continue

        matched_concept = matched_concept or concept
        for period, value in period_values.items():
            # Ordered concept arrays are priority fallbacks: earlier concepts win
            # for a period, while later concepts can still fill gaps for periods the
            # higher-priority concept does not cover.
            if period not in merged_period_values:
                merged_period_values[period] = (value[0], value[1])

    return merged_period_values, matched_concept


def map_companyfacts_to_snapshots(
    *,
    ticker: str,
    companyfacts_payload: dict[str, Any],
    mapping_payload: dict[str, Any],
    retrieved_at: str,
) -> list[dict[str, Any]]:
    facts = ((companyfacts_payload.get("facts") or {}).get("us-gaap") or {})
    if not isinstance(facts, dict):
        return []

    canonical_fields: dict[str, list[str]] = mapping_payload["canonical_fields"]
    unit_hints: dict[str, list[str]] = mapping_payload.get("unit_hints", {})
    field_values: dict[str, dict[tuple[str, str, int, int | None], tuple[float, str | None]]] = {}

    all_periods: set[tuple[str, str, int, int | None]] = set()
    for field, concepts in canonical_fields.items():
        if not isinstance(concepts, list):
            continue
        values, concept = _select_concept_values(
            facts,
            field=field,
            concepts=[str(item) for item in concepts],
            unit_hints=unit_hints,
        )
        if values:
            field_values[field] = values
            all_periods.update(values.keys())
        if concept is None and field in REQUIRED_CONCEPT_FIELDS:
            log("WARN", "Mapping ambiguity", ticker=ticker, concept=field, resolution="no_concept_match")

    snapshots: list[dict[str, Any]] = []
    ordered_output_fields = [field for field in canonical_fields.keys() if field not in INTERNAL_ONLY_FIELDS]

    for period, period_type, fiscal_year, fiscal_quarter in sorted(all_periods, key=lambda item: (item[2], item[3] or 5)):
        if period_type not in SUPPORTED_PERIOD_TYPES:
            continue

        data: dict[str, float] = {}
        missing_fields: list[str] = []
        filing_candidates: list[str] = []

        for field in ordered_output_fields:
            entry = field_values.get(field, {}).get((period, period_type, fiscal_year, fiscal_quarter))
            if entry is None:
                missing_fields.append(field)
                continue
            value, filed_date = entry
            data[field] = value
            if filed_date:
                filing_candidates.append(filed_date)

        operating_cash_flow = data.get("operating_cash_flow")
        capital_expenditure = data.get("capital_expenditure")
        if operating_cash_flow is not None and capital_expenditure is not None and "free_cash_flow" not in data:
            data["free_cash_flow"] = operating_cash_flow - abs(capital_expenditure)

        tax_expense = data.get("income_tax_expense")
        pretax_income_entry = field_values.get("pretax_income", {}).get((period, period_type, fiscal_year, fiscal_quarter))
        if tax_expense is not None and pretax_income_entry is not None and pretax_income_entry[0] not in (0.0, 0):
            data["effective_tax_rate"] = tax_expense / pretax_income_entry[0]

        filing_date = max(filing_candidates) if filing_candidates else None
        snapshot_id = deterministic_id(ticker, period, period_type)
        snapshots.append(
            {
                "snapshot_id": snapshot_id,
                "ticker": ticker,
                "period": period,
                "period_type": period_type,
                "fiscal_year": fiscal_year,
                "fiscal_quarter": fiscal_quarter,
                "provider": "sec_edgar",
                "filing_date": filing_date,
                "retrieved_at": retrieved_at,
                "data": data,
                "segments": None,
                "missing_fields": missing_fields,
            }
        )

    return snapshots


def _normalize_quarter(value: Any) -> int | None:
    if isinstance(value, int):
        return value if value in {1, 2, 3, 4} else None
    text = str(value).strip().upper()
    if text in {"1", "2", "3", "4"}:
        return int(text)
    if text in {"Q1", "Q2", "Q3", "Q4"}:
        return int(text[-1])
    return None


def normalize_transcript_record(record: dict[str, Any], *, min_year: int, retrieved_at: str) -> dict[str, Any] | None:
    ticker = normalize_ticker(record.get("symbol", ""))
    if not ticker:
        return None

    try:
        fiscal_year = int(record.get("year"))
    except (TypeError, ValueError):
        return None
    if fiscal_year < min_year:
        return None

    fiscal_quarter = _normalize_quarter(record.get("quarter"))
    if fiscal_quarter is None:
        return None

    body_text = str(record.get("content", "") or "").strip()
    word_count = len(body_text.split())
    call_date = _normalize_filing_date(record.get("date"))
    period = f"{fiscal_year}-Q{fiscal_quarter}"

    return {
        "transcript_id": deterministic_id(ticker, period),
        "ticker": ticker,
        "period": period,
        "fiscal_year": fiscal_year,
        "fiscal_quarter": fiscal_quarter,
        "call_date": call_date,
        "provider": "huggingface_kurry",
        "retrieved_at": retrieved_at,
        "body_text": body_text,
        "word_count": word_count,
        "is_complete": word_count >= 25,
    }


def _require_dependency(module_name: str) -> Any:
    try:
        return __import__(module_name)
    except ImportError as error:  # pragma: no cover - environment-specific dependency surface
        raise RuntimeError(f"Missing dependency '{module_name}'. Install app requirements first.") from error


def ingest_hf_transcripts(
    conn: Any,
    config: HistoricalLoadConfig,
    *,
    tickers_filter: set[str],
    chunk_size: int = 500,
) -> tuple[int, int]:
    _require_dependency("huggingface_hub")
    _require_dependency("pyarrow")
    from huggingface_hub import snapshot_download  # type: ignore
    import pyarrow.parquet as pq  # type: ignore

    snapshot_path = Path(
        snapshot_download(
            repo_id=config.hf_dataset_id,
            repo_type="dataset",
            revision=config.hf_revision,
            allow_patterns=["parquet_files/*.parquet", "README.md", "LICENSE*"],
        )
    )
    parquet_files = sorted((snapshot_path / "parquet_files").glob("*.parquet"))
    if not parquet_files:
        raise RuntimeError(f"No parquet files found in HF snapshot: {snapshot_path}")

    retrieved_at = iso_timestamp()
    total_source_rows = 0
    written_rows = 0
    chunk: list[dict[str, Any]] = []

    for parquet_file in parquet_files:
        parquet = pq.ParquetFile(parquet_file)
        for batch in parquet.iter_batches(batch_size=1000):
            payload = batch.to_pydict()
            batch_size = len(next(iter(payload.values()))) if payload else 0
            total_source_rows += batch_size
            for index in range(batch_size):
                raw_record = {key: payload[key][index] for key in payload}
                normalized = normalize_transcript_record(
                    raw_record,
                    min_year=config.transcript_min_year,
                    retrieved_at=retrieved_at,
                )
                if normalized is None:
                    continue
                if normalized["ticker"] not in tickers_filter:
                    continue
                chunk.append(normalized)
                if len(chunk) >= chunk_size:
                    written_rows += upsert_transcripts(conn, chunk)
                    chunk.clear()

    if config.expected_hf_rows > 0:
        allowed_drift = max(200, int(config.expected_hf_rows * 0.03))
        if abs(total_source_rows - config.expected_hf_rows) > allowed_drift:
            raise RuntimeError(
                f"HF row count drift: expected around {config.expected_hf_rows}, got {total_source_rows}."
            )

    if chunk:
        written_rows += upsert_transcripts(conn, chunk)

    return written_rows, total_source_rows


def _jsonb(value: Any) -> Any:
    from psycopg.types.json import Jsonb  # type: ignore

    return Jsonb(value)


def upsert_financial_snapshots(conn: Any, rows: Iterable[dict[str, Any]]) -> int:
    payload = list(rows)
    if not payload:
        return 0

    sql = """
        insert into financial_snapshots (
          snapshot_id, ticker, period, period_type, fiscal_year, fiscal_quarter,
          provider, filing_date, retrieved_at, data, segments, analyst_estimates,
          guidance, missing_fields
        ) values (
          %s, %s, %s, %s, %s, %s,
          %s, %s, %s, %s, %s, null,
          null, %s
        )
        on conflict (snapshot_id) do update
          set provider = excluded.provider,
              filing_date = excluded.filing_date,
              retrieved_at = excluded.retrieved_at,
              data = excluded.data,
              segments = excluded.segments,
              missing_fields = excluded.missing_fields,
              updated_at = now()
    """
    values = [
        (
            row["snapshot_id"],
            row["ticker"],
            row["period"],
            row["period_type"],
            row["fiscal_year"],
            row["fiscal_quarter"],
            row["provider"],
            row["filing_date"],
            row["retrieved_at"],
            _jsonb(row["data"]),
            _jsonb(row["segments"]) if row["segments"] is not None else None,
            _jsonb(row["missing_fields"]),
        )
        for row in payload
    ]

    with conn.cursor() as cursor:
        cursor.executemany(sql, values)
    return len(payload)


def upsert_transcripts(conn: Any, rows: Iterable[dict[str, Any]]) -> int:
    payload = list(rows)
    if not payload:
        return 0

    sql = """
        insert into transcripts (
          transcript_id, ticker, period, fiscal_year, fiscal_quarter,
          call_date, provider, retrieved_at, body_text, word_count, is_complete
        ) values (
          %s, %s, %s, %s, %s,
          %s, %s, %s, %s, %s, %s
        )
        on conflict (transcript_id) do update
          set call_date = excluded.call_date,
              provider = excluded.provider,
              retrieved_at = excluded.retrieved_at,
              body_text = excluded.body_text,
              word_count = excluded.word_count,
              is_complete = excluded.is_complete
    """
    values = [
        (
            row["transcript_id"],
            row["ticker"],
            row["period"],
            row["fiscal_year"],
            row["fiscal_quarter"],
            row["call_date"],
            row["provider"],
            row["retrieved_at"],
            row["body_text"],
            row["word_count"],
            row["is_complete"],
        )
        for row in payload
    ]

    with conn.cursor() as cursor:
        cursor.executemany(sql, values)
    return len(payload)


def upsert_ticker_coverage(
    conn: Any,
    *,
    tickers: list[UniverseTicker],
    status_by_ticker: dict[str, str],
) -> int:
    upsert_sql = """
        insert into ticker_coverage (
          ticker, snapshot_count, transcript_count, latest_period, earliest_period,
          has_guidance, has_estimates, last_synced_at, last_sync_status, backfill_tier
        ) values (
          %s, %s, %s, %s, %s,
          %s, %s, %s, %s, %s
        )
        on conflict (ticker) do update
          set snapshot_count = excluded.snapshot_count,
              transcript_count = excluded.transcript_count,
              latest_period = excluded.latest_period,
              earliest_period = excluded.earliest_period,
              has_guidance = excluded.has_guidance,
              has_estimates = excluded.has_estimates,
              last_synced_at = excluded.last_synced_at,
              last_sync_status = excluded.last_sync_status,
              backfill_tier = excluded.backfill_tier,
              updated_at = now()
    """

    synced_at = datetime.now(timezone.utc)
    values: list[tuple[Any, ...]] = []
    with conn.cursor() as cursor:
        for ticker in tickers:
            cursor.execute(
                "select count(*), min(period), max(period) from financial_snapshots where ticker = %s",
                (ticker.ticker,),
            )
            snapshot_count, earliest_period, latest_period = cursor.fetchone()
            cursor.execute("select count(*) from transcripts where ticker = %s", (ticker.ticker,))
            transcript_count = cursor.fetchone()[0]
            cursor.execute(
                """
                select
                  coalesce(bool_or(guidance is not null), false),
                  coalesce(bool_or(analyst_estimates is not null), false)
                from financial_snapshots
                where ticker = %s
                """,
                (ticker.ticker,),
            )
            has_guidance, has_estimates = cursor.fetchone()
            values.append(
                (
                    ticker.ticker,
                    int(snapshot_count or 0),
                    int(transcript_count or 0),
                    latest_period,
                    earliest_period,
                    bool(has_guidance),
                    bool(has_estimates),
                    synced_at,
                    status_by_ticker.get(ticker.ticker, "success"),
                    ticker.tier,
                )
            )
        cursor.executemany(upsert_sql, values)
    return len(values)


def _group_universe_by_tier(universe: list[UniverseTicker], max_tickers: int | None) -> dict[int, list[UniverseTicker]]:
    grouped = {1: [], 2: [], 3: []}
    for item in sorted(universe, key=lambda row: (row.tier, row.ticker)):
        grouped[item.tier].append(item)
    if max_tickers is None:
        return grouped
    return {tier: entries[:max_tickers] for tier, entries in grouped.items()}


def run_loader(args: argparse.Namespace) -> int:
    config = HistoricalLoadConfig.from_env()
    universe = load_universe(config.universe_csv_path)
    grouped_universe = _group_universe_by_tier(universe, args.max_tickers_per_tier)
    mapping_payload = load_xbrl_concept_map(config.xbrl_mapping_path)

    selected_tiers = [tier for tier in (1, 2, 3) if tier in args.tiers]
    selected_tickers = {entry.ticker for tier in selected_tiers for entry in grouped_universe[tier]}
    if not selected_tickers:
        raise RuntimeError("No tickers selected for run.")

    sec_archive_path = Path(args.sec_archive_path) if args.sec_archive_path else download_sec_companyfacts_archive(config)
    sec_member_index = index_companyfacts_members(sec_archive_path)

    psycopg = _require_dependency("psycopg")
    if not config.database_url:
        raise RuntimeError("DATABASE_URL must be configured for M0 loader runs.")

    financial_total = 0
    transcript_total = 0
    with psycopg.connect(config.database_url) as conn:
        conn.autocommit = False
        for tier in selected_tiers:
            tier_rows = grouped_universe[tier]
            if not tier_rows:
                continue
            log("INFO", "Bulk load started", tier=tier, universe_size=len(tier_rows))
            status_by_ticker: dict[str, str] = {}
            tier_financial_rows = 0

            for ticker_row in tier_rows:
                try:
                    companyfacts_payload = read_companyfacts_by_cik(
                        sec_archive_path,
                        sec_member_index,
                        ticker_row.cik,
                    )
                    snapshots = map_companyfacts_to_snapshots(
                        ticker=ticker_row.ticker,
                        companyfacts_payload=companyfacts_payload,
                        mapping_payload=mapping_payload,
                        retrieved_at=iso_timestamp(),
                    )
                    written = upsert_financial_snapshots(conn, snapshots)
                    tier_financial_rows += written
                    status_by_ticker[ticker_row.ticker] = "success"
                    log(
                        "INFO",
                        "SEC ticker parsed",
                        tier=tier,
                        ticker=ticker_row.ticker,
                        cik=ticker_row.cik,
                        snapshots_written=written,
                    )
                except Exception as error:  # pragma: no cover - exercised in live runs
                    status_by_ticker[ticker_row.ticker] = "partial"
                    log(
                        "ERROR",
                        "Load failed",
                        tier=tier,
                        ticker=ticker_row.ticker,
                        cik=ticker_row.cik,
                        error=str(error),
                    )

            written_transcripts, hf_source_rows = ingest_hf_transcripts(
                conn,
                config,
                tickers_filter={entry.ticker for entry in tier_rows},
            )
            coverage_rows = upsert_ticker_coverage(
                conn,
                tickers=tier_rows,
                status_by_ticker=status_by_ticker,
            )
            conn.commit()

            financial_total += tier_financial_rows
            transcript_total += written_transcripts
            log(
                "INFO",
                "Tier load complete",
                tier=tier,
                snapshot_rows=tier_financial_rows,
                transcript_rows=written_transcripts,
                hf_source_rows=hf_source_rows,
                coverage_rows=coverage_rows,
            )

        validation_output_path = (
            Path(args.validation_output_path)
            if args.validation_output_path
            else config.validation_output_path
        )
        write_validation_report(
            conn,
            output_path=validation_output_path,
            tiers=selected_tiers,
            selected_tickers=selected_tickers,
        )
        conn.commit()

    log("INFO", "M0 load completed", snapshot_rows=financial_total, transcript_rows=transcript_total)
    return 0


def write_validation_report(
    conn: Any,
    *,
    output_path: Path,
    tiers: list[int],
    selected_tickers: set[str],
) -> None:
    ticker_list = sorted(selected_tickers)
    with conn.cursor() as cursor:
        cursor.execute("select count(*) from financial_snapshots")
        financial_rows = int(cursor.fetchone()[0])
        cursor.execute("select count(*) from transcripts")
        transcript_rows = int(cursor.fetchone()[0])
        cursor.execute("select count(*) from ticker_coverage")
        coverage_rows = int(cursor.fetchone()[0])

        cursor.execute(
            """
            select ticker, count(*) as c
            from financial_snapshots
            where ticker = any(%s)
            group by ticker
            """,
            (ticker_list,),
        )
        snapshot_counts = {ticker: int(count) for ticker, count in cursor.fetchall()}

        cursor.execute(
            """
            select ticker, count(*) as c
            from transcripts
            where ticker = any(%s)
            group by ticker
            """,
            (ticker_list,),
        )
        transcript_counts = {ticker: int(count) for ticker, count in cursor.fetchall()}

    under_snapshot_threshold = sorted(ticker for ticker in ticker_list if snapshot_counts.get(ticker, 0) < 20)
    under_transcript_threshold = sorted(ticker for ticker in ticker_list if transcript_counts.get(ticker, 0) < 15)

    report = {
        "generated_at": iso_timestamp(),
        "tiers": tiers,
        "selected_ticker_count": len(ticker_list),
        "financial_rows_total": financial_rows,
        "transcript_rows_total": transcript_rows,
        "ticker_coverage_rows_total": coverage_rows,
        "tickers_under_snapshot_threshold": under_snapshot_threshold,
        "tickers_under_transcript_threshold": under_transcript_threshold,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(report, indent=2)
    output_path.write_text(serialized, encoding="utf-8")
    archived_output_path = output_path.parent / (
        f"m0_validation_report_{report['generated_at'].replace(':', '-').replace('.', '-')}.json"
    )
    archived_output_path.write_text(serialized, encoding="utf-8")
    log("INFO", "Validation artifact written", path=str(output_path), archived_path=str(archived_output_path))


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Phase 2 M0 historical bulk loader")
    parser.add_argument(
        "--tiers",
        nargs="+",
        type=int,
        default=[1, 2, 3],
        choices=[1, 2, 3],
        help="Tier(s) to run in order. Defaults to 1 2 3.",
    )
    parser.add_argument(
        "--max-tickers-per-tier",
        type=int,
        default=None,
        help="Optional per-tier ticker cap for smoke runs.",
    )
    parser.add_argument(
        "--sec-archive-path",
        type=str,
        default="",
        help="Optional local SEC companyfacts.zip path.",
    )
    parser.add_argument(
        "--validation-output-path",
        type=str,
        default="",
        help="Optional validation artifact path. Defaults to data/artifacts/m0_validation_report.json.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    _load_fintech_dotenv()
    args = parse_args(argv)
    return run_loader(args)


if __name__ == "__main__":
    raise SystemExit(main())
