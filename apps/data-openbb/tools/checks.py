from __future__ import annotations

import ast
import sys
from pathlib import Path


APP_ROOT = Path(__file__).resolve().parents[1]
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))

from src.service import build_company_payload, build_macro_payload  # noqa: E402


PYTHON_DIRS = [
    APP_ROOT / "src",
    APP_ROOT / "tests",
    APP_ROOT / "tools",
]

FIXTURE_TICKERS = ["AAPL", "MSFT", "TSLA", "DUMMY"]


def syntax_check() -> None:
    for directory in PYTHON_DIRS:
        for file_path in sorted(directory.rglob("*.py")):
            ast.parse(file_path.read_text(encoding="utf-8"), filename=str(file_path))


def contract_check() -> None:
    for ticker in FIXTURE_TICKERS:
        build_company_payload(ticker)

    build_macro_payload()


def main() -> int:
    syntax_check()
    contract_check()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
