# Rebuild decisions

The audit ended with six decisions for the owner. The owner asked the coordinator to act as architect.
The rule used: take the audit's recommended option, unless it costs money or cannot be undone.
Each pick below can be changed later. Where a pick was forced by "no money", it says so.

## D1 Deep Dive runner and GitHub's terms (C4)

**Pick: Option A. Run user-requested Deep Dives on GitHub Actions for the closed test only.**
Option B (Google Cloud Run) needs a billing account, so it is out under the free-only rule.

- GitHub's terms say not to use Actions "as part of a serverless application". This is a known risk.
- Exit path, built in from day one: the `api` function starts a run through one module,
  `supabase/functions/_lib/jobs/dispatch.ts`. Swapping the runner means changing that module and the runner's
  entry script only. The runner talks to the API through internal routes (H5), not to the database.
- **Before any public launch the owner must decide the runner again.** M5 cannot finish without that answer.
- Daily data jobs on Actions are normal CI-style use and stay there.

## D2 Domain and front door (H2, H3)

**Pick: a free Cloudflare Worker is the front door from M1, on its free `*.workers.dev` address.**
Buying a domain costs money, so we do not buy one now.

- The Worker forwards `/*` API calls to `https://oizahjzcowflmrffoxjg.supabase.co/functions/v1/api/*`
  and serves the HTML pages (legal, delete-account form, shared report reader, unsubscribe) itself (H2).
- When the owner adds a domain on Cloudflare, it becomes a route on the same Worker. No code change.
  This is also the rollback lever: the app's base URL points at the Worker, not at Supabase.
- Without a domain, Resend cannot send email (it needs a verified domain). See D6.

## D3 Small app changes (H1, H4)

**Pick: yes, two small app changes are allowed. Nothing else in the app changes.**

- **Deep Dive wait** (owner: M2): poll up to 6 minutes instead of 100 seconds, and resume polling a running job
  when the screen reopens. Server side: `POST /jobs` returns the running job when the same user asks for
  the same ticker again (H1).
- **Certificate pinning** (owner: M5): drop pinning for the managed hosts (`*.workers.dev`, `*.supabase.co`)
  and rely on normal certificate checks. Cloudflare and Supabase rotate their certificates on their own schedule (H4).
- Debug builds use the existing Gradle property: `./gradlew assembleDebug -PAPI_BASE_URL=<worker url>`. No file change.

## D4 Pulse personalisation (H7)

**Pick: ship the plain version first, then build the personal version in the daily job.**

- M1: `GET /pulse/latest` serves the stored issue plus the existing deterministic brief. No worker call per request.
  The response shape does not change.
- M3: the daily workflow builds each user's personal brief and stores it. `/pulse/latest` then returns the stored one.
- M4: the Pulse PDF is rendered per user by the PDF job from the stored brief. Report PDFs use the pure TypeScript
  fallback `buildLegacyInstitutionalPdfExport` inside `api` where it fits the CPU limit, else the PDF job.

## D5 GitHub plan (H10)

**Pick: stay on GitHub Free.** Pro costs money.

Free has no protected branches or environment secrets on a private repo, so a workflow on any branch can read every
repo secret. We limit what a leak can do:

- No database password in GitHub. The Deep Dive runner holds only the internal API token and LLM keys (H5).
- Data jobs (M3) talk to the API's internal routes too. If one ever needs the database, it uses the `thesis_jobs`
  role, which can write only its own tables.
- The dispatch token is fine-grained: this repo only, Actions write only, 90-day expiry, kept in Supabase secrets.
- Workflows take only a job id as input and never paste inputs into shell lines. Jobs are claimed atomically.
- LLM keys get spend caps at the provider.
- Workflow file changes get the owner's review (AGENTS rule 7).

## D6 Auth (H9)

**Pick: Supabase Auth behind the current `/auth/*` paths.** Confirmed.

- `app.users.id` stays text and holds the Supabase auth user id. `app.users.auth_user_id` links to `auth.users`
  with `on delete cascade`. `password_hash` is kept, nullable, unused.
- M1 writes the route mapping table (lockout 423, verify-token, 409 on known email, reset revokes sessions,
  account delete removes the auth user, app rows and stored files).
- Email: Supabase's built-in email sends only to the project team's addresses. That is enough for the owner's
  own testing. Real testers need Resend, which needs a domain (D2). M1 builds the email module against an interface
  with two drivers (Supabase built-in now, Resend later) so adding the domain is a config change.

## D7 Actions minutes budget (C1, C2)

GitHub bills each job in whole minutes, rounded up. A private repo on Free gets 2,000 minutes a month.

| Use | Monthly budget | How it stays there |
| --- | --- | --- |
| CI (`ci`, `rebuild-ci`) | 600 | Path filters: Android only when `apps/mobile` changes, Docker smoke only when a Dockerfile changes, `rebuild-ci` only for `supabase/` and `jobs/`. Superseded runs cancel. |
| Deep Dives (closed test) | 600 | About 200 runs at 3 minutes. Global cap of 15 dispatches a day, per-user limits as today. |
| Daily data workflow | 450 | One workflow, many steps, once a day (about 15 minutes). Not one workflow per job (H6). |
| Weekly workflow | 60 | Digest, coherence, official-source refresh. |
| PDF job | 100 | Only when a PDF is missing. |
| Backup | 10 | Weekly, about 2 minutes. |
| Reserve | 180 | Retries and manual runs. |

**No sweeper cron on Actions** (C1). Stuck jobs are handled in `GET /jobs/:id` (the app polls it every 2 seconds)
and by a `pg_cron` job in Postgres every 10 minutes for jobs nobody polls. Both cost zero minutes.
**The keep-alive does not use Actions** (H11): the Worker's daily cron calls `GET /health?db=1`.

## ADR list

The plan's ADRs 1-10 stay, with these changes. M5 writes them as real ADR files.

| ADR | Status | Decision |
| --- | --- | --- |
| 1 API host | settled | Supabase Edge Functions, one function `api` |
| 2 Language | settled | TypeScript API, Python data jobs |
| 3 Auth | changed | D6 |
| 4 Job queue | changed | Existing `jobs` table plus columns, dispatch, poll-time sweeper and `pg_cron` (C1) |
| 5 Long work runner | changed | D1 and D7 |
| 6 Contract | settled | Keep it; `contract.md` is the source |
| 7 Data | settled | Fresh start, no data migration |
| 8 Storage | changed | Supabase Storage for PDFs **and** report JSON bodies (N2), through its S3-compatible API |
| 9 Layout | changed | `supabase/` and `jobs/`; shared Deno code in `supabase/functions/_lib/`, not `packages/` |
| 10 Visibility | changed | Stay private. Going public publishes logs and history; it is not a quick fallback (N10) |
| 11 Front door | new | D2 |
| 12 Database exposure | new | Schema `app`, RLS on every table, no grants to public roles, pooler connections (C3, N4) |
| 13 Secrets | new | D5 |
| 14 Tests | new | Request-in Response-out handlers; tests next to new code; old tests stay until M5 (H8) |
| 15 PDF and Pulse | new | D4 |
| 16 Backup and keep-alive | new | Weekly encrypted dump workflow; Worker cron keep-alive; size alert (H11). The M0 dump covers schema `app` only. `auth.users` rows are not in it yet, and `app.users.auth_user_id` points at them, so M1 (owner of auth) adds an auth export to the recovery plan before real users sign up |
| 17 Rate limits and spend caps | new | `app.rate_limits` counter table, daily dispatch cap, LLM spend caps (N3, C2) |

## Free-tier limits checked on 2026-11-23

| Limit | Value | Source |
| --- | --- | --- |
| Edge Function wall clock (free) | 150 s; request idle timeout 150 s | Supabase docs, Edge Functions limits |
| Edge Function CPU per request | 2 s (async I/O not counted) | same |
| Edge Function memory / size | 256 MB / 20 MB bundled | same |
| Functions per project (free) | 100 (so previews `api-m1`..`api-m4` fit) | same |
| Edge Function secrets | 100 per project; names may not start with `SUPABASE_` | same |
| HTML from Edge Functions | Rewritten to `text/plain` without a custom domain (H2) | same |
| Outbound SMTP ports 25 and 587 | Blocked from Edge Functions; send email over HTTPS (Resend API) | same |
| Function-to-function calls | about 5,000 a minute per request chain | Supabase docs, recursive functions |
| GitHub Actions, private repo, Free | 2,000 minutes a month; each job rounded up to a whole minute | GitHub docs, Actions billing |
| Database size (free) | 500 MB; read-only above it (from the audit, not re-checked) | Supabase docs |
| Project pause (free) | after about 7 days without activity (from the audit) | Supabase docs |

Measured: the empty baseline database is 13 MB.

## Contract findings to keep in mind

From building `contract.md` (100 server routes, 47 Kotlin calls):

- **The app's paths sit at the root of the base URL.** HTML forms post to absolute paths and share and unsubscribe
  links are built from `PUBLIC_API_BASE_URL`. The Worker (D2) must serve the API at its root and rewrite to
  `/functions/v1/api/...`. Set `PUBLIC_API_BASE_URL` to the Worker URL.
- **Some work runs after the response** (Pulse dispatch, job complete push). In Edge Functions use
  `EdgeRuntime.waitUntil(...)` for it, inside the 150 s limit, or move it to the daily workflow.
- **Macro stress shows nothing in the app today.** `/v1/macro-stress/*` returns no numeric `score`, so the Kotlin
  parser drops it. M3 keeps the shape and reports it; fixing it is an owner decision (server field or app change).
- About 10 routes have no production caller (for example `/tickers`, `/v1/historical/coverage`, Google auth). They are
  marked "drop?" in `contract.md`. Nothing is dropped without the owner's yes.
