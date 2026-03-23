# M7 Maestro Smoke (Android)

This folder contains a focused Maestro setup for M7 smoke acceptance.

Scope rules:
- Maestro only
- No Appium
- No large test framework
- Keep flows tied to M7 smoke-critical paths

## Folder layout

`flows/`  
Maestro YAML flows for M7 smoke checks.

`scripts/`  
Lightweight Node scripts to prepare test data and run Maestro.

`output/`  
Run artifacts (logs, summary files). This folder is gitignored.

## Quick run

From repo root:

```bash
pnpm qa:maestro:prepare
pnpm qa:maestro:smoke
```

## What `prepare` does

1. Verifies Product API health.
2. Creates and verifies a fresh test user.
3. Logs in and pre-seeds one Deep Dive report for history-open validation.
4. Triggers a pulse dispatch attempt for the current day.
5. Builds/installs Android debug app with a configurable `API_BASE_URL`.
6. Writes runtime vars to `qa/maestro/.maestro.env`.

## What `smoke` does

1. Loads vars from `qa/maestro/.maestro.env`.
2. Runs `qa/maestro/flows/m7_smoke.yaml` with Maestro.
3. Saves run log and summary under `qa/maestro/output/<timestamp>/`.

## Optional env overrides

You can export these before running:

- `MAESTRO_API_BASE_URL` (default: `http://127.0.0.1:3001`)
- `MAESTRO_DEVICE_SERIAL` (default: first connected Android device)
- `MAESTRO_TEST_EMAIL` (default: auto-generated)
- `MAESTRO_REGISTER_EMAIL` (default: auto-generated fresh email used by register/verify flow)
- `MAESTRO_TEST_PASSWORD` (default: `VeryStrongPass1!`)
- `MAESTRO_DEEP_DIVE_TICKER` (default: `AAPL`)
- `MAESTRO_INTERNAL_TOKEN` (default: `dev-internal-worker-token`)
- `MAESTRO_APP_ID` (default: `com.thesis.mobile`)

## Notes

- For physical phones and `http://127.0.0.1:3001`, `prepare` will apply `adb reverse` automatically.
- FCM push receive/tap-through still needs real Firebase app credentials (`google-services.json`) and a manual confirmation pass for final sign-off.
