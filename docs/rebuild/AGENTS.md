# Serverless rebuild: rules for every agent

Read this file, `OWNERSHIP.md`, `DECISIONS.md` and the file of your milestone before you change anything.
The plan is the "Thesis serverless rebuild plan" doc. The "Audit of the Thesis serverless rebuild plan" doc
lists the findings (C1-C4, H1-H11, N1-N11) that these files fix. Finding ids are quoted where a rule comes from one.

## Goal

Run Thesis on free tiers with nothing always on:

- **Supabase** (project `thesis`, ref `oizahjzcowflmrffoxjg`, eu-central-1): Postgres, Auth, Storage, and one Edge Function named `api`.
- **Cloudflare Worker** (free plan): the single front door. It forwards API calls to the `api` function,
  serves the HTML pages, and runs the keep-alive cron.
- **GitHub Actions**: Deep Dive runs (closed test only, see `DECISIONS.md` D1), daily and weekly data jobs, PDF rendering.

## Branches (safety rule)

- `main` is the working app today. **Never push to `main` or merge into it.**
- `rebuild` is the integration branch. Every milestone opens PRs into `rebuild`.
- Your work branch is the one your thread was given. One PR per milestone, or a few small ones.
- Cutover to `main` happens once, at the end of M5, and only with the owner's yes.

## Milestones

| File | Milestone | Starts when |
| --- | --- | --- |
| `M0-foundations.md` | Project, baseline schema with RLS, contract, `api` skeleton, slim CI | now |
| `M1-core-api.md` | Front door Worker, auth, user, watchlist, tickers, Pulse and report reads, email | M0 merged |
| `M2-deep-dive.md` | Jobs, dispatch, Deep Dive runner, internal job routes, poll-time sweeper | M0 merged |
| `M3-scheduled-data.md` | Daily and weekly workflows for the full scheduler list, research read routes | M0 merged |
| `M4-exports-push-billing.md` | PDFs, push, RevenueCat webhook | M1 merged |
| `M5-cutover.md` | Release settings, legal texts, delete old servers, docs | M1-M4 merged and 7 clean days |

M1, M2 and M3 run in parallel. `OWNERSHIP.md` says who owns which file, table and route, so they never touch the same file.

## Rules

1. **Keep the app contract.** Paths, methods, status codes and JSON field names stay as in `contract.md`.
   The only allowed app changes are in `DECISIONS.md` D3. Anything else: stop and ask.
2. **Touch only the paths you own** (`OWNERSHIP.md`). You may import from another milestone's files; you may not edit them.
   If you need a change in a shared or foreign file, stop and ask the coordinator. Do not edit `apps/` before M5,
   except the app files `OWNERSHIP.md` gives you.
3. **Keep tested logic, rewrite plumbing.** Copy report, Pulse and Deep Dive logic as is into your `_lib/` folder.
   Rewrite HTTP routing, queues and timers.
4. **Small files.** No file over about 800 lines.
5. **Handlers are Request in, Response out** (H8). No framework. That lets the same tests drive them.
6. **Every new table enables row level security** (C3). App tables live in schema `app`, never `public`.
   Never grant anything in `app` to `anon` or `authenticated`. The public key must not read or write app data.
7. **No secrets in the repo.** Keys go in Supabase secrets or GitHub Actions secrets. Never commit `.env` files,
   passwords, tokens or connection strings. No workflow may print or forward a secret. Workflow files get the owner's review.
8. **The hosted Supabase project is production** (N9). No destructive SQL (drop, truncate, delete without a where,
   reset, schema drop) on it without the owner's yes. Migrations are additive: create, add column, add index, grant.
9. **Only `rebuild` deploys `api`.** To test your branch live, deploy it as `api-m1`, `api-m2`, ... (your preview
   function). Never deploy a branch as `api`. Delete your preview function when your milestone merges.
10. **Free tier only.** No paid service, plan or add-on. If a step needs one, stop and ask.
11. **Fixture mode stays the default** for LLM and data calls until the owner sets a budget.
12. **Watch the Actions minutes** (C2). The monthly budget is in `DECISIONS.md` D7. Every workflow has
    `concurrency` with `cancel-in-progress`, a `timeout-minutes`, and path filters. No cron more often than daily,
    except what D7 lists.
13. **Tests.** New code under `supabase/` and `jobs/` comes with tests next to it (`*_test.ts`, `test_*.py`).
    Do not delete or weaken an existing test in `apps/` or `tests/` without the owner's yes (H8).
14. **No emails or tokens in logs** (N10). Log user ids and job ids only.
15. **Write plainly.** Short sentences in docs, PR text and comments.

## Definition of done for a milestone

- Every exit check in the milestone file passes, with the command, query or screen that shows it.
- `ci` and `rebuild-ci` are green on the PR.
- The Supabase security advisor shows no errors after your migrations.
- The milestone file's "Report" section is filled in the PR description.
- `docs/CURRENT_STATE.md` is not changed before M5.
