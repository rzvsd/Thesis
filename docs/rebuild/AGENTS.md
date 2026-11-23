# Serverless rebuild: rules for every agent

Read this file and the file of your milestone before you change code.
The full plan, with the ADR discussions, is the "Thesis serverless rebuild plan" doc.

## Goal

Run Thesis on free tiers with nothing always on:

- Supabase: Postgres, Auth, Storage, and the API as Edge Functions (TypeScript).
- GitHub Actions: Deep Dive runs, scheduled data jobs (Python and TypeScript), PDF rendering.
- Cloudflare: DNS for an optional `api.` domain.

## Milestones

| File | Milestone |
| --- | --- |
| `M0-foundations.md` | Supabase project, baseline schema, API contract, folders, CI |
| `M1-core-api.md` | Auth, user, watchlist, tickers, Pulse and report reads |
| `M2-deep-dive.md` | Jobs table, dispatch, Deep Dive runner, sweeper |
| `M3-scheduled-data.md` | Cron jobs for Pulse, prices, news, macro, sentiment, alerts |
| `M4-exports-push-billing.md` | PDFs, push, RevenueCat, email |
| `M5-cutover.md` | Remove old servers, update docs |

Do one milestone at a time. Do not start a milestone before the one before it meets its exit checks.

## Rules

1. **Keep the app contract.** The Android app must work with only a new base URL. Paths, methods, status codes and JSON field names stay as in `docs/rebuild/contract.md` (made in M0). If a change is unavoidable, stop and ask.
2. **Touch only your milestone's paths.** Each milestone file lists them. Do not edit `apps/` servers before M5; the old stack must keep working.
3. **Keep tested logic, rewrite plumbing.** Move report, Pulse and Deep Dive logic as is. Rewrite HTTP routing, queues and timers.
4. **Small files.** One Edge Function per feature. No file over about 800 lines.
5. **No secrets in the repo.** Keys go in Supabase secrets or GitHub Actions secrets. Never commit `.env` files, passwords or tokens.
6. **No new test files without approval.** Run existing tests, port the ones that cover moved code, and check behaviour against the real endpoints. Ask before you add a new test file.
7. **Free tier only.** Do not add a paid service or a paid plan. If a step needs one, stop and ask.
8. **Fixture mode stays the default** for LLM and data calls until the owner sets a budget.
9. **Write plainly.** Short sentences in docs, PR text and comments.

## Definition of done for a milestone

- Every exit check in the milestone file passes, with the command or screen that shows it.
- Existing CI is green.
- The milestone file's "Report" section is filled in the PR description.
- `docs/CURRENT_STATE.md` is not changed before M5.
