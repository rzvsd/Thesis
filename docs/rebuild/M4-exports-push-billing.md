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
