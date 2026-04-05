# Load Tests

M4 canonical load runner:

- `python tests/load/run_m4_load.py`
- wired through `pnpm test:load`

Mandatory scenarios in this suite:

- Deep Dive enqueue + retrieval path under sustained load
- Latest Pulse retrieval path under sustained load
- Weekly digest notification fan-out for 1,000 synthetic recipients

Threshold gates enforced by the script:

- API error rate < 1% on the mandatory sustained scenarios
- Deep Dive enqueue p95 < 750ms at 25 VUs for 5 minutes
- Pulse latest p95 < 300ms at 50 VUs for 5 minutes
- Notification fan-out of 1,000 recipients < 5 minutes with < 1% failures
