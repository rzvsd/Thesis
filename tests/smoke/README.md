# Smoke Tests

`m2_data_plane_smoke.py` is the committed helper for the M2 data-plane smoke checklist.

Usage:

```bash
python tests/smoke/m2_data_plane_smoke.py
```

Expected local defaults:

- `data-openbb` at `http://127.0.0.1:3003`
- `news-ingest` at `http://127.0.0.1:3004`

The helper validates the documented endpoint shapes and highlights the manual outage step that still needs an operator-triggered source block during smoke execution.
