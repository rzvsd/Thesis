"""Make jobs/data and jobs/weekly importable from jobs/daily (there is no jobs package)."""

from __future__ import annotations

import sys
from pathlib import Path

JOBS_ROOT = Path(__file__).resolve().parents[1]

for folder in ("data", "daily", "weekly"):
    path = str(JOBS_ROOT / folder)
    if path not in sys.path:
        sys.path.insert(0, path)
