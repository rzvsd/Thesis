from __future__ import annotations

from pathlib import Path

import _paths  # noqa: F401
import precompute_plan
from fake_api import make_client

A = "11111111-1111-4111-8111-111111111111"
B = "22222222-2222-4222-8222-222222222222"


def test_writes_job_ids_and_count(tmp_path: Path) -> None:
    body = {"status": "accepted", "queued": 2, "in_flight": 2,
            "jobs": [{"ticker": "MSFT", "job_id": A}, {"ticker": "NVDA", "job_id": B}, {"job_id": "bad id"}]}
    client, transport = make_client(lambda method, path, sent: (200, body))
    out, gh = tmp_path / "jobs.txt", tmp_path / "gh.txt"
    code = precompute_plan.main([str(out)], {"PER_RUN": "2", "GITHUB_OUTPUT": str(gh)}, client)
    assert code == 0
    assert transport.calls[0]["body"] == {"limit": 2}
    assert out.read_text().split() == [A, B]
    assert "count=2" in gh.read_text()


def test_per_run_zero_makes_no_call(tmp_path: Path) -> None:
    client, transport = make_client(lambda method, path, sent: (200, {}))
    out = tmp_path / "jobs.txt"
    assert precompute_plan.main([str(out)], {"PER_RUN": "0"}, client) == 0
    assert transport.calls == []
    assert out.read_text() == ""


def test_per_run_is_capped() -> None:
    assert precompute_plan.per_run({"PER_RUN": "99"}) == precompute_plan.MAX_PER_RUN
    assert precompute_plan.per_run({"PER_RUN": "x"}) == 1
    assert precompute_plan.per_run({}) == 1
