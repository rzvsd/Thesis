from __future__ import annotations

import csv
import json
import urllib.request
from io import StringIO
from pathlib import Path

import pandas as pd


SP500_CONSTITUENTS_URL = "https://datahub.io/core/s-and-p-500-companies/r/constituents.csv"
SP100_WIKIPEDIA_URL = "https://en.wikipedia.org/wiki/S%26P_100"
SEC_COMPANY_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
SEC_USER_AGENT = "ThesisFinance admin@yourdomain.com"

TOP20_TIER1 = {
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


def normalize_ticker(value: str) -> str:
    return str(value).strip().upper().replace(".", "-")


def fetch_bytes(url: str, *, user_agent: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": user_agent})
    with urllib.request.urlopen(request) as response:  # noqa: S310 - expected external data source.
        return response.read()


def load_sp500_rows() -> list[tuple[str, str, str]]:
    dataframe = pd.read_csv(SP500_CONSTITUENTS_URL)
    rows: list[tuple[str, str, str]] = []
    for _, row in dataframe.iterrows():
        rows.append(
            (
                normalize_ticker(row["Symbol"]),
                str(row["Security"]).strip(),
                str(int(row["CIK"])).zfill(10),
            )
        )
    return rows


def load_sp100_tickers() -> set[str]:
    html = fetch_bytes(SP100_WIKIPEDIA_URL, user_agent="Mozilla/5.0").decode("utf-8", "ignore")
    tables = pd.read_html(StringIO(html))
    for table in tables:
        if "Symbol" in [str(col).strip() for col in table.columns]:
            return {normalize_ticker(value) for value in table["Symbol"].astype(str).tolist()}
    raise RuntimeError("Unable to parse S&P 100 table from Wikipedia page.")


def load_sec_cik_map() -> dict[str, str]:
    payload = json.loads(fetch_bytes(SEC_COMPANY_TICKERS_URL, user_agent=SEC_USER_AGENT))
    cik_map: dict[str, str] = {}
    for item in payload.values():
        ticker = normalize_ticker(item.get("ticker", ""))
        if not ticker:
            continue
        cik_map[ticker] = str(int(item["cik_str"])).zfill(10)
    return cik_map


def main() -> int:
    repo_root = Path(__file__).resolve().parents[2]
    output_path = repo_root / "data" / "sp500_universe.csv"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    sp500_rows = load_sp500_rows()
    sp100_tickers = load_sp100_tickers()
    sec_cik_map = load_sec_cik_map()

    output_rows: list[dict[str, str | int]] = []
    missing_in_sec: list[str] = []
    for ticker, company_name, fallback_cik in sp500_rows:
        cik = sec_cik_map.get(ticker, fallback_cik)
        if ticker not in sec_cik_map:
            missing_in_sec.append(ticker)

        tier = 1 if ticker in TOP20_TIER1 else 2 if ticker in sp100_tickers else 3
        output_rows.append(
            {
                "ticker": ticker,
                "cik": cik,
                "company_name": company_name,
                "tier": tier,
            }
        )

    output_rows.sort(key=lambda row: (int(row["tier"]), str(row["ticker"])))
    with output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["ticker", "cik", "company_name", "tier"])
        writer.writeheader()
        writer.writerows(output_rows)

    print(f"Wrote {len(output_rows)} rows to {output_path}")
    if missing_in_sec:
        preview = ", ".join(sorted(missing_in_sec)[:20])
        print(f"Missing SEC ticker map entries: {len(missing_in_sec)} ({preview})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
