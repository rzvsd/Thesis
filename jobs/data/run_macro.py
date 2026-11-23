"""Macro stress: send the official daily macro payload for the previous US trading day.

POST /internal/macro-stress/dispatch {market_date, macro}. `macro` is the exact body the
old GET /v1/official/macro?scope=daily returned. The old scheduler ran this at 18:00
New York for that day; the morning run uses the previous trading day instead.
"""

from __future__ import annotations

import sys
from datetime import datetime
from typing import Any, Mapping

from api_client import ApiClient
from joblog import log
from market_time import previous_us_trading_day
from official import official_macro_response
from script_main import run
from source_common import fixture_mode

ROUTE = "/internal/macro-stress/dispatch"


def build_body(now: datetime | None = None, env: Mapping[str, str] | None = None) -> dict[str, Any]:
    market_date = previous_us_trading_day(now).isoformat()
    return {"market_date": market_date, "macro": official_macro_response(as_of=market_date, env=env)}


def main(client: ApiClient | None = None, now: datetime | None = None, env: Mapping[str, str] | None = None) -> int:
    api = client or ApiClient.from_env(env)
    body = build_body(now, env)
    observations = body["macro"]["data"].get("observations", [])
    log("INFO", "Macro payload built", market_date=body["market_date"], observations=len(observations),
        fixture_mode=fixture_mode(env))
    response = api.post(ROUTE, body)
    log("INFO", "Macro stress dispatch accepted", market_date=body["market_date"], status=response.body.get("status"))
    return 0


if __name__ == "__main__":
    sys.exit(run("macro", main))
