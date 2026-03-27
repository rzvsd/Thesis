from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DATA_OPENBB_ROOT = ROOT / "apps" / "data-openbb"


def main() -> int:
    forwarded_args = sys.argv[1:]
    if forwarded_args[:1] == ["--"]:
        forwarded_args = forwarded_args[1:]
    command = [sys.executable, "-B", "-m", "src.historical_loader", *forwarded_args]
    completed = subprocess.run(command, cwd=DATA_OPENBB_ROOT)
    return completed.returncode


if __name__ == "__main__":
    raise SystemExit(main())
