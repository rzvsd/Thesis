# Maestro Smoke (Android)

This folder contains focused Maestro smoke automation for Phase 2 mobile milestones.

Scope rules:
- Maestro only
- No Appium
- No heavy framework scaffolding
- Keep flows tied to milestone acceptance paths

## Folder layout

`flows/`  
Maestro YAML flows for milestone smoke paths (`m7_*`, `m8_*`, etc.).

`scripts/`  
Lightweight Node scripts that prepare runtime data and execute smoke runs.

`output/`  
Run artifacts (`maestro.log`, `summary.json`, env snapshot). This folder is gitignored.

## Quick run

From repo root:

```bash
pnpm qa:maestro:prepare
pnpm qa:maestro:smoke
```

## What `prepare` does

1. Verifies Product API health.
2. Detects a connected Android device.
3. Applies `adb reverse` when the API URL is loopback.
4. Creates and verifies a fresh test user.
5. Attempts to seed one Deep Dive report for regression checks.
6. Triggers a Pulse dispatch attempt for the current day.
7. Builds/installs Android debug app with configurable `API_BASE_URL`.
8. Resets app state and writes runtime vars to `qa/maestro/.maestro.env`.

Important:
- Deep Dive seeding is best-effort by default. If live Deep Dive keys are missing, prepare logs a warning and continues so M8 sentiment/digest smoke can still run.
- Set `MAESTRO_REQUIRE_DEEP_DIVE_SEED=true` only when you want prepare to hard-fail if Deep Dive seed is unavailable.

## What `smoke` does

1. Loads vars from `qa/maestro/.maestro.env`.
2. Runs the configured flow (default `qa/maestro/flows/ph3_m4_smoke.yaml`).
3. Stores run logs and summary under `qa/maestro/output/<timestamp>/`.

## Key flows

- `m7_smoke.yaml` - M7 report/UI smoke
- `m8_smoke.yaml` - M8 Fear & Greed dashboard + weekly digest + tab/regression smoke
- `m8_weekly_digest_deeplink.yaml` - focused weekly digest deep-link verification
- `ph3_m4_smoke.yaml` - Phase 3 M4 release-candidate smoke path (Today -> Research -> Portfolio -> Weekly Digest -> History)

## Optional env overrides

- `MAESTRO_API_BASE_URL` (default: `http://127.0.0.1:3001`)
- `MAESTRO_DEVICE_SERIAL` (default: first connected Android device)
- `MAESTRO_TEST_EMAIL` (default: auto-generated)
- `MAESTRO_REGISTER_EMAIL` (default: auto-generated)
- `MAESTRO_TEST_PASSWORD` (default: `VeryStrongPass1!`)
- `MAESTRO_DEEP_DIVE_TICKER` (default: `AAPL`)
- `MAESTRO_INTERNAL_TOKEN` (default: `dev-internal-worker-token`)
- `MAESTRO_APP_ID` (default: `com.thesis.mobile`)
- `MAESTRO_FLOW_PATH` (optional override for smoke flow path)
- `MAESTRO_REQUIRE_DEEP_DIVE_SEED` (`true` to enforce hard Deep Dive seed requirement)

## Notes

- For physical phones and `http://127.0.0.1:3001`, `prepare` applies `adb reverse` automatically.
- Real push receipt/tap-through still requires valid Firebase app config (`google-services.json`) and manual/automated device confirmation.
