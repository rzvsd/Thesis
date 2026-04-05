# End-to-End Tests

M4 canonical e2e runner:

- `python tests/e2e/test_m4_core_flows.py`
- wired through `pnpm test:e2e`

Current coverage in this suite:

- Auth register -> verify -> login
- Deep Dive enqueue -> internal claim/complete -> job/report retrieval
- Market Pulse dispatch -> latest retrieval -> date retrieval
- Multi-device token registration and weekly digest notification dispatch
