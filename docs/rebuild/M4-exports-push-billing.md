# M4 Exports, push and billing

Read `AGENTS.md`, `OWNERSHIP.md`, `DECISIONS.md` and `contract.md` first. Starts when M1 has merged.

## Goal

PDF export, push notifications and subscriptions work in the new setup. (Email moved to M1.)

## In scope

- **PDFs** (D4, H7): report PDFs from the pure TypeScript fallback inside `api` if it fits the 2 s CPU limit,
  otherwise rendered by `jobs/pdf/` (Chromium) when missing. Pulse PDFs rendered per user by the PDF job from the
  stored brief. Files go to a private Storage bucket; export routes return a short-lived signed URL or the file,
  as the contract says.
- **Push** through the FCM HTTP v1 API in `_lib/push/` (no `firebase-admin` server). Used by M3's alert steps
  through the `internal-push` route.
- **RevenueCat webhook** as feature `billing`: checks the shared secret, updates `subscriptions` and the user's tier.

## Out of scope

Live billing on the Play store (owner task). Email (M1).

## Paths, tables, routes

See `OWNERSHIP.md`, row M4. Migrations use the `20261127` prefix. Preview function: `api-m4`.

## Exit checks

- Pulse and report PDFs download in the app.
- A test push reaches the phone.
- A RevenueCat sandbox event changes the tier.
- Storage bucket is private; a signed URL expires.

## Report

Storage used per PDF, render time and where it ran, Actions minutes per PDF.

## Build notes (M4 thread, 2026-11-23)

### PDFs: no browser, no PDF job, nothing stored

- **Report PDF** (`GET /v1/reports/:id/export/pdf`): `_lib/exports/report_pdf/` is the old built-in writer
  (`report-pdf.ts`), split into small files. On the three M1 fixtures its output is **byte-identical** to the old
  `buildLegacyInstitutionalPdfExport`. A 10-page Deep Dive takes about 12 ms of CPU (limit 2 s).
  The old server used headless Chrome when present; Edge Functions have none, so the rebuild always uses the writer.
- **Pulse PDF** (`GET /pulse/latest/export/pdf`, `/pulse/:date/export/pdf`): the old server only had a Chrome path.
  `_lib/exports/pulse/` ports the brief plan (`pulse-brief-plan.ts`, logic unchanged) and draws the same sections
  as the old HTML with the same writer: about 4-5 ms and 29 KB for a full 4-page issue, per user, personalised with
  M1's `personalizePulseForUser`. Dropped from the HTML version: clickable headline links, the dark theme,
  two-column layouts.
- **Why no `jobs/pdf` and no `rebuild-pdf.yml`:** D4 allowed the TypeScript path "where it fits the CPU limit", and it
  fits by a factor of 100+. A Chrome job per user would cost Actions minutes that grow with subscribers (thousands of
  users means thousands of minutes) and the app expects the file in the same request. Rendering in `api` costs zero
  minutes and scales with requests.
- **Why nothing is stored:** a fresh render is cheaper than a Storage read plus write, and per-user Pulse PDFs would
  fill the 1 GB free Storage quickly (1,000 users x 30 KB x 30 days is about 0.9 GB a month). The routes return the
  file, as the contract says. So M4 adds no bucket and no migration. Report JSON stays in M2's private
  `report-artifacts` bucket.

### Push

- `_lib/push/`: FCM HTTP v1 with WebCrypto (RS256 JWT, token cached per isolate), data-only messages with Android
  priority HIGH, the same data keys the old firebase-admin sender used. 20 sends in parallel, one retry on 429/5xx.
  `UNREGISTERED` and invalid-token answers come back as `invalidTargets`.
- Mode from `PUSH_PROVIDER_MODE`: `disabled` (default), `stub`, `fcm` (needs `FCM_SERVICE_ACCOUNT_JSON`).
- The sender matches M3's `PushSender` port and M2's `FilingAlertNotifier.sendPush`, so wiring is one line in their
  deps files (`pushSenderFromEnv()`), which they own.
- New internal routes (feature `internal-push`, internal token): `POST /internal/push/send`
  (`{ user_ids (<=500), notification: { type, route, title, body, data? } }`) and `POST /internal/push/test`
  (`{ user_id }`). They skip users who turned that type off and mark dead tokens invalid.

### Billing

- `POST /v1/webhooks/revenuecat` and `POST /v1/user/sync-tier`, ported with the same codes and event rules.
  The webhook only records what RevenueCat sends; sync-tier only reads the RevenueCat REST API. Nothing creates
  a plan or takes money.
- Secrets (names only): `REVENUECAT_WEBHOOK_SECRET`, and for sync-tier `REVENUECAT_SERVER_API_KEY`,
  `REVENUECAT_ENTITLEMENT_ID` (optional `REVENUECAT_API_BASE_URL`). Without them: webhook 401, sync-tier 503
  `sync_unavailable`, as before.
