# M4 Exports, push and billing

Read `AGENTS.md` first.

## Goal

PDF export, push notifications, subscriptions and email work in the new setup.

## In scope

- PDF rendering for Pulse and reports in an Actions job (Chromium), saved to Supabase Storage. The export endpoints return a signed URL or the file.
- Push through the FCM HTTP v1 API from a job or function (no `firebase-admin` server).
- RevenueCat webhook as an Edge Function that updates the user's tier.
- Email (verification, reset, Pulse email) through Resend, or through Supabase Auth email if ADR 3 chose it.

## Out of scope

Live billing on the Play store (owner task).

## Paths you may touch

`jobs/`, `supabase/functions/`, `supabase/migrations/` (new files), `.github/workflows/` (new files), `packages/`.

## ADRs it depends on

5 (Actions as runner), 8 (Supabase Storage).

## Steps

1. Move the PDF renderers into a job that reads the report from Postgres and uploads the file.
2. Decide render time: on report creation, or on first request with a short wait.
3. Port push sending to the HTTP API.
4. Port the RevenueCat webhook and check it with a sandbox event.

## Exit checks

- Pulse and report PDFs download in the app.
- A test push reaches the phone.
- A RevenueCat sandbox event changes the tier.

## Report

Storage used per PDF, render time, which email path was chosen.
