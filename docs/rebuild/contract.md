# Product API contract (as built today)

This file records the HTTP contract of the current `apps/product-api` server.
The rebuild (one Supabase Edge Function `api` behind a Cloudflare Worker) must keep it.
The Android app must work with only a new base URL.
So paths, methods, status codes and JSON field names below must not change.

Every row comes from code in `apps/product-api/src/server.ts` or `apps/product-api/src/routes/*.ts`.
The appendix gives file:line for each route.
The Kotlin client is `apps/mobile/android/app/src/main/java/com/thesis/mobile/network/ProductApiClient.kt`.

The old plan counted 43 Kotlin calls. The real numbers are: **100 routes** on the server, **47** method+path calls in the Kotlin client, plus 2 legal pages the app opens in a browser.
Since 2026-11-24 (D3) the tables also list one route that is new in the rebuild, `GET /v1/reports/:id/page`, which the app loads in a WebView. With it: **101 routes** and **48** app calls.

## Summary counts

| Audience | Routes | read | write | long |
|---|---:|---:|---:|---:|
| app (Android, bearer JWT or pre-login auth) | 61 | 28 | 28 | 5 |
| web (HTML pages and public links, no login) | 9 | 6 | 3 | 0 |
| webhook | 1 | 0 | 1 | 0 |
| internal (`x-internal-token`, worker/scheduler; also `/health`) | 30 | 8 | 5 | 17 |
| **Total** | **101** | **42** | **37** | **22** |

- Called by Kotlin client: **48** (48 distinct method+path pairs, all 48 exist on the server). 47 are in `ProductApiClient.kt`; `GET /v1/reports/:id/page` is loaded by the Deep Dive WebView (`ui/screens/DeepDiveWebPolicy.kt` builds the URL).
- The app also opens `GET /legal/terms` and `GET /legal/privacy` in a browser (`ui/components/LegalLinks.kt:19`). These are counted under web.
- 13 app-audience routes are not called by the Kotlin client (see "Diff vs Kotlin client").
- Not counted: the CORS `OPTIONS` preflight that answers any path (`server.ts:5900`).

"long" means the handler can take more than a couple of seconds, or calls the worker, an LLM, headless Chrome, or another service on every request.

## Cross-cutting behavior

These apply to every route and are part of the contract.

- **Bearer auth.** `Authorization: Bearer <access_token>`. The token is an HS256 JWT signed by product-api (`typ: "access"`, `sub` = user id, `sid` = session id). Each request also checks that the session row exists, is not revoked and not expired (`server.ts:3814`). A logout or password reset therefore kills the access token at once.
- **Internal auth.** Header `x-internal-token` must equal `INTERNAL_WORKER_TOKEN` (timing-safe compare, `server.ts:1239`). Every `/internal/*` path is gated at `server.ts:6059`, except `/internal/deep-dive/precompute`, which checks the token itself (`coverage-routes.ts:58`).
- **Route order matters.** The order is: `OPTIONS`, `/health`, `/legal/*`, rate limit, auth routes, account routes, coverage routes, unsubscribe, `/r/:token`, `/internal/*`, the RevenueCat webhook, `/v1/historical/*`, then the bearer gate (`server.ts:8753`). Every route after the gate returns 401 without a valid access token.
- **Rate limit.** Applies to every non-`/internal/` path, per client IP + method + bucket (`server.ts:1159`). `POST /auth/login`, `/auth/register` and `/auth/refresh` each have their own auth limit. Other `/auth/*` paths share the login limit. Everything else uses the general limit. Buckets collapse `/jobs/*`, `/reports/*`, `/pulse/*`, `/watchlist/*` and `/v1/user/alerts/*` into one key each. Over the limit: `429 { error: "rate_limited", error_message, retry_after_seconds }`.
- **Body limit.** A JSON body over `maxJsonBodyBytes` returns `413 { error: "payload_too_large", error_message }`.
- **Unknown route.** `404 { status: "not_found" }`. This body has **no** `error` field.
- **Unhandled error.** `500 { error: "internal_error", error_message: "Product API failed to process the request." }`.
- **Runtime init failure.** `500 { error: "service_unavailable", error_message }`.
- **CORS.** `OPTIONS` returns 204 for an allowed origin, 400 if the preflight headers are missing, and 403 `forbidden_origin` if the origin is not allowed.
- **JSON responses** use `content-type: application/json`. Pulse JSON also sends `cache-control: private, no-store` and `vary: Authorization`.

### Error shape

```ts
interface ApiError {
  error: string;            // machine code, e.g. "validation_failed", "unauthorized", "report_not_found"
  error_message: string;    // human text; Kotlin shows this
  // optional extras, only on some routes:
  feature?: string;         // with error = "upgrade_required" (HTTP 403)
  locked_until?: string;    // 423 account_locked
  retry_after_seconds?: number; // 423 account_locked, 429 rate_limited
  error_code?: string;      // 401 google_token_invalid
  job?: JobStatusResponse;  // 503 queue_unavailable on POST /jobs
}
// Pro gate (403): { error: "upgrade_required", feature: string, error_message: string }
//   feature values: watchlist_cap, deep_dive_daily_limit, conviction_intelligence, scenario_stress,
//   earnings_war_room, report_export, what_if_scenario
// Unknown path or bad sub-path (404): { status: "not_found" }
```

Kotlin reads only `error` (as `errorCode`), `error_message` and `feature` (`ProductApiClient.kt:1462`). It branches on these exact codes: `note_not_found`, `macro_stress_not_found`, `sentiment_not_found`, `opposite_case_not_found`. Keep them.

### Response envelope

Most routes wrap the result as `{ data: ... }`. These do **not** wrap it, and Kotlin depends on that:

- `POST /auth/*` token responses (bare `AuthTokensResponse`)
- `POST /jobs`, `GET /jobs/:id` (bare `JobStatusResponse`)
- `GET /reports` (a **bare JSON array**; Kotlin uses `requestJsonArray`)
- `GET /reports/:id` (bare `AnalysisReport`)
- `GET /pulse/latest`, `GET /pulse/:date` (bare `MarketPulseReport`)
- `POST /v1/reports/:id/scenario` (bare `ScenarioResponse`)
- `/v1/historical/*` and `/internal/reports/comparable-latest` (`{ data, missing }`)

## Route tables

Column key: **Aud** = audience. **Kt** = called by the Kotlin client. **MS** = owner milestone.

### Auth

| Method | Path | Aud | Auth | Kind | Kt | MS | Notes |
|---|---|---|---|---|---|---|---|
| POST | /auth/register | app | none | write | yes | M1 | 201 `verification_sent`. 409 `email_exists`. 422 if the email is invalid or the password is under 8 chars. Sends the verification email inside the request. Own rate-limit bucket. |
| POST | /auth/verify | app | none | write | yes | M1 | 200 `verified`. 400 `invalid_verification_token`. 404 `user_not_found`. 422. |
| POST | /auth/login | app | none | write | yes | M1 | 200 tokens. 401 `auth_failed` (also for unverified users). 423 `account_locked` with `locked_until` and `retry_after_seconds`. 422. A failed attempt can lock the account. Admin bootstrap hook runs here. |
| POST | /auth/google | app | none (Google id_token) | write | no | M1 | 404 `{status:"not_found"}` when OIDC is off. 401 `google_token_invalid` (+`error_code`). 409 `google_link_required` / `google_subject_in_use` / `google_already_linked` / `google_link_conflict`. 503. drop? No Kotlin caller and off by config. Keep only if Google sign-in is planned. |
| POST | /auth/google/link | app | user JWT | write | no | M1 | Same codes as above, plus 409 `google_email_mismatch` and 404 `user_not_found`. drop? Same reason. |
| POST | /auth/refresh | app | none (refresh token in body) | write | yes | M1 | 200 new tokens; the old session is rotated. Reuse of a rotated token revokes the whole session family. 401 `refresh_failed`. 422. Own rate-limit bucket. |
| POST | /auth/logout | app | user JWT or refresh token in body | write | yes | M1 | Revokes the session of the bearer token (the bearer wins over the body). 200 `logged_out`. 401 `unauthorized`. |
| POST | /auth/password-reset/request | app | none | write | yes | M1 | Always **202** `reset_requested`, whether or not the account exists. Sends email in the request. |
| POST | /auth/password-reset/confirm | app | none | write | yes | M1 | 200 `password_reset`. 400 `invalid_reset_token`. 422. Revokes all sessions and marks the user verified. |

### User, profile, preferences

| Method | Path | Aud | Auth | Kind | Kt | MS | Notes |
|---|---|---|---|---|---|---|---|
| GET | /v1/user/profile | app | user JWT | read | yes | M1 | 404 `user_not_found`. Computes `deep_dives_remaining_today` per request. |
| GET | /v1/user/notification-preferences | app | user JWT | read | yes | M1 | Returns every notification type, with defaults filled in. |
| PUT | /v1/user/notification-preferences | app | user JWT | write | yes | M1 | 422 for an empty list, an unknown type, a non-boolean `enabled` or a bad `quiet_until`. |
| GET | /v1/user/email-preferences | app | user JWT | read | no | M1 | Not called by the app today. |
| PUT | /v1/user/email-preferences | app | user JWT | write | no | M1 | 422 if `email_opt_out` is not a boolean. |

### Account

| Method | Path | Aud | Auth | Kind | Kt | MS | Notes |
|---|---|---|---|---|---|---|---|
| DELETE | /v1/account | app | user JWT | write | yes | M1 | 200 `deleted`, plus `store_subscription_notice` when the user had a paid tier. Deletes all personal data. |
| GET | /auth/delete-account | web | none | read | no | M1 | HTML form (the store listing requires a web delete-account page). It posts to the **absolute** path `/auth/delete-account`. |
| POST | /auth/delete-account | web | none (form `email`) | write | no | M1 | HTML. Reads an urlencoded form. 422 HTML for a bad email. Emails a code, with the same answer whether or not the account exists. The next form posts to `/auth/delete-account/confirm`. |
| POST | /auth/delete-account/confirm | web | none (form `token`) | write | no | M1 | HTML. 400 HTML for a bad or expired code. 200 HTML after the delete. |

### Watchlist

| Method | Path | Aud | Auth | Kind | Kt | MS | Notes |
|---|---|---|---|---|---|---|---|
| GET | /watchlist | app | user JWT | read | yes | M1 | `{ data: string[] }` |
| POST | /watchlist | app | user JWT | write | yes | M1 | 422 for a bad ticker. 404 `ticker_not_found`. 403 `upgrade_required` with feature `watchlist_cap`. Adding a ticker that is already there is fine. |
| DELETE | /watchlist/:ticker | app | user JWT | write | yes | M1 | 422 for a bad ticker. Returns the updated list. |

### Holdings

| Method | Path | Aud | Auth | Kind | Kt | MS | Notes |
|---|---|---|---|---|---|---|---|
| GET | /v1/user/holdings | app | user JWT | read | no | M1 | |
| POST | /v1/user/holdings | app | user JWT | write | no | M1 | Upsert by ticker. 422 for a bad ticker, quantity or cost_basis. 404 `ticker_not_found`. |
| DELETE | /v1/user/holdings/:ticker | app | user JWT | write | no | M1 | `{ deleted: boolean }`. This body has no `data` wrapper. |
| POST | /v1/user/holdings/import | app | user JWT | write | yes | M1 | CSV text in JSON. Per-row errors come back in a 200 body. 422 for an empty CSV, a missing shares column, or too many rows. Also adds new names to the watchlist, within the tier limit. |

### Notifications and devices

| Method | Path | Aud | Auth | Kind | Kt | MS | Notes |
|---|---|---|---|---|---|---|---|
| POST | /notifications/device-token | app | user JWT | write | yes | M1 | A missing or empty `device_token` means **unregister**. Kotlin sends `put("device_token", null)`, which drops the key. 422 for a token under 16 chars, an installation_id under 8 chars, or a platform over 32 chars. 404 `user_not_found`. 500 `device_registration_failed`. With no installation_id, the server uses `legacy:<userId>`. |

### Tickers and coverage

| Method | Path | Aud | Auth | Kind | Kt | MS | Notes |
|---|---|---|---|---|---|---|---|
| GET | /tickers/search | app | user JWT | read | yes | M1 | `?q=`. 422 without q. **404 `ticker_not_found` when nothing matches**, not an empty list. At most 25 results. |
| GET | /tickers | app | user JWT | read | no | M1 | Same handler as `/tickers/search`. drop? It is an alias with no caller. |
| GET | /v1/coverage | web | none | read | no | M1 | `?ticker=` optional. Public list of covered tickers. No caller found in the repo. Keep it if a website or store page uses it, otherwise drop?. |

### Pulse

| Method | Path | Aud | Auth | Kind | Kt | MS | Notes |
|---|---|---|---|---|---|---|---|
| GET | /pulse/latest | app | user JWT | long | yes | M1 | Bare `MarketPulseReport`. 404 `report_not_found`. **On every request**, when `pulseDexterBriefEnabled` is on, it POSTs to the worker's `/internal/pulse/brief` (timeout `pulseDexterTimeoutMs`). On failure it falls back to the stored report plus the user research state. M1 = the deterministic fallback only. |
| GET | /pulse/:date | app | user JWT | long | yes | M1 | `:date` = YYYY-MM-DD. 422 for a bad date. 404 `report_not_found`. Same per-request worker call. |
| GET | /pulse/latest/export/pdf | app | user JWT | long | yes | M4 | `application/pdf` attachment. Does the worker brief call and then renders with **headless Chrome** (`execFileSync`, `market-pulse-render.ts`). 404 `report_not_found`. 500 `internal_error`. Not Pro-gated. |
| GET | /pulse/:date/export/pdf | app | user JWT | long | yes | M4 | Same as above, by date. 422 / 404. |

### Reports, notes, share, export

| Method | Path | Aud | Auth | Kind | Kt | MS | Notes |
|---|---|---|---|---|---|---|---|
| GET | /reports | app | user JWT | read | yes | M1 | **Bare array** of `ReportListItem`. |
| GET | /reports/:id | app | user JWT | read | yes | M1 | Bare `AnalysisReport` (validated, with issuer enriched). 404 `report_not_found` when there is no row, no access, or no artifact. Reads the artifact from storage. |
| GET | /v1/reports/:id/note | app | user JWT | read | yes | M1 | 404 `note_not_found` (Kotlin treats it as "no note"). 404 `report_not_found`. |
| PUT | /v1/reports/:id/note | app | user JWT | write | yes | M1 | 422 if content is not a string or is over 10000 chars. |
| POST | /v1/reports/:id/share | app | user JWT | write | no | M1 | **201** on the first create, **200** after that (same token). Deep Dive only, otherwise 404. `url` is built from `PUBLIC_API_BASE_URL` and is null if that is unset. |
| GET | /v1/reports/:id/page | app | user JWT | read | yes | M1 | **HTML** Deep Dive 2.0 page for the app's WebView (D3, 2026-11-24). Query: `theme=light\|dark` sets `html[data-theme]`; `embed=1` drops the app bar, theme switch and app link; other values are ignored. Same access rules as `GET /reports/:id` (Deep Dive only). Same CSP and editorial fallback as `/r/:token`, `cache-control: private, no-store`. 404 HTML page (`report_not_found`) when there is no row, no access, not a Deep Dive, or no artifact. |
| GET | /r/:token | web | none (share token) | read | no | M1 | **HTML** reader (`noindex`, `no-referrer`, strict CSP, `private, max-age=300`). 404 HTML when not found. The token must match `[A-Za-z0-9_-]{20,64}`. Builds editorial HTML per request (no Chrome). |
| GET | /v1/reports/:id/export/pdf | app | user JWT | long | no | M4 | **Pro only** (403 `report_export`). `application/pdf`. Uses headless Chrome when present (`report-pdf-editorial.ts`), otherwise the built-in PDF writer. 404 / 500. |

### Jobs and Deep Dive

| Method | Path | Aud | Auth | Kind | Kt | MS | Notes |
|---|---|---|---|---|---|---|---|
| POST | /jobs | app | user JWT | write | yes | M2 | **202** with `JobStatusResponse` (queued). **200** with a completed job when a fresh report is reused (the reused path copies the artifact and writes several rows). 422 for a bad ticker. 404 `ticker_not_found`. 403 `deep_dive_daily_limit` (only new generation counts). 503 `queue_unavailable` (+`job`). 500. Publishes to `runtime.queue`. |
| GET | /jobs/:id | app | user JWT | read | yes | M2 | 404 `job_not_found` for someone else's job too. The app polls this. |
| POST | /internal/jobs/:id/claim | internal | internal token | write | no | M2 | 200 `{ job, analysis_request }`. **409 `job_not_claimable`**. Called by dexter-worker. |
| POST | /internal/jobs/:id/complete | internal | internal token | long | no | M2 | Body `{ report, llm_usage? }`. Stores the artifact and report row, then derives contrarian anchors, kill-switch rules, name relationships, monitor snapshots and the conviction journal. Responds 200 `{status:"ok", report_id}`, **then** sends filing-change alerts (push/email) after the response. In an Edge Function that tail needs `waitUntil`. 422 / 404 / 500. |
| POST | /internal/jobs/:id/fail | internal | internal token | write | no | M2 | Body `{ error_message? }`. 200 `{status:"ok"}`. 404 `job_not_found`. |
| GET | /internal/reports/comparable-latest | internal | internal token | read | no | M2 | `?ticker&schema_major=2&lookback_days`. 200 `{ missing, data }`. Called by dexter-worker. |

### Research data (historical, relationships, earnings, war room, scenarios, opposite case, conviction, macro, sentiment, alerts, monitor, feedback)

| Method | Path | Aud | Auth | Kind | Kt | MS | Notes |
|---|---|---|---|---|---|---|---|
| GET | /v1/historical/financials | internal | internal token **or** user JWT | read | no | M2 | `?ticker=`. `{ data, missing }`. Called by dexter-worker. |
| GET | /v1/historical/transcripts | internal | internal token or user JWT | read | no | M2 | Same. Called by dexter-worker. |
| GET | /v1/historical/filing-sections | internal | internal token or user JWT | long | no | M2 | Proxies data-openbb `/v1/official/filing-sections` (SEC EDGAR) on every request. If the upstream fails, it still returns 200 with `missing: true`. |
| GET | /v1/historical/coverage | internal | internal token or user JWT | read | no | M2 | drop? No caller found (dexter-worker uses the other three). |
| GET | /v1/names/relationships | app | user JWT | read | no | M3 | Query: `source_ticker`, `target_ticker`, `state` (csv), `min_confidence`, `limit<=250`. 422s. |
| GET | /v1/research/earnings/state | app | user JWT | read | no | M3 | Query: `as_of`, `window_past_days` (1-30), `window_ahead_days` (1-120), `tickers` (csv). Defaults to the watchlist. |
| GET | /v1/research/war-room/:id | app | user JWT | read | yes | M3 | **Pro only** (403 `earnings_war_room`). 404 `war_room_not_found`. Also computes the earnings state and evidence pack per request. |
| GET | /v1/scenarios/templates | app | user JWT | read | yes | M3 | Pro only (403 `scenario_stress`). |
| POST | /v1/scenarios/runs | app | user JWT | write | yes | M3 | Pro only. 422 for a bad scenario_id or as_of. 404 `scenario_not_found`. Runs a deterministic stress test over the user's names and stores the run. |
| GET | /v1/scenarios/runs/:id | app | user JWT | read | yes | M3 | Pro only. 404 `scenario_run_not_found`. |
| POST | /v1/reports/:id/scenario | app | user JWT | read | yes | M3 | What-if DCF recompute. A POST, but it saves nothing (audit only). Pro only (403 `what_if_scenario`). 422 `validation_failed` / `scenario_unavailable`. Bare `ScenarioResponse`. |
| GET | /v1/reports/:id/opposite-case | app | user JWT | read | yes | M3 | Pro only (403 `conviction_intelligence`). 404 `opposite_case_not_found` (Kotlin treats it as "none yet"). |
| POST | /v1/reports/:id/opposite-case | app | user JWT | write | yes | M3 | Pro only. Returns the existing one if present. Otherwise builds it deterministically (no LLM) and writes a journal entry. 422 if not a Deep Dive. |
| GET | /v1/conviction/timeline | app | user JWT | read | yes | M3 | Pro only. `?limit<=100&ticker=`. |
| GET | /v1/conviction/insights | app | user JWT | read | yes | M3 | Pro only. `?limit<=50`. |
| GET | /v1/macro-stress/current | app | user JWT | read | yes | M3 | 404 `macro_stress_not_found`. Converts the latest fear/greed row to `MacroStressSnapshot` (see Diff: the app cannot parse it). |
| GET | /v1/macro-stress/history | app | user JWT | read | yes | M3 | `?days=1..365` (default 90). |
| GET | /v1/sentiment/current | app | user JWT | read | yes | M3 | 404 `sentiment_not_found`. Raw `FearGreedSnapshot`. Kotlin calls it only as a fallback, after a 404 from macro-stress that has another error code. drop? once macro-stress parsing is fixed in the app. |
| GET | /v1/sentiment/history | app | user JWT | read | yes | M3 | `?days=`. Same fallback note. |
| GET | /v1/user/alerts | app | user JWT | read | yes | M3 | `?limit<=100&category=thesis_drift\|earnings\|macro\|system`. Free tier gets `detail_body` hidden and `detail_locked: true`. |
| GET | /v1/user/alerts/:id | app | user JWT | read | no | M3 | 404 `alert_not_found`. Not called by Kotlin. |
| POST | /v1/user/alerts/:id/feedback | app | user JWT | write | yes | M3 | `feedback`: `useful\|not_useful`. 422 / 404. Also writes a conviction journal entry. |
| POST | /v1/user/alerts/:id/mute | app | user JWT | write | yes | M3 | Sets `quiet_until` = now + 24h for that notification type and marks the alert muted. 404. |
| GET | /v1/user/monitor-snapshots | app | user JWT | read | yes | M3 | |
| POST | /v1/feedback/report | app | user JWT | write | yes | M3 | **202** `queued_for_review`. 422 for code, source_surface, severity or a message over 2000 chars. 404 `report_not_found`. |
| POST | /v1/feedback/subscription | app | user JWT | write | yes | M3 | **202**. Same validations. |

### Billing and RevenueCat

| Method | Path | Aud | Auth | Kind | Kt | MS | Notes |
|---|---|---|---|---|---|---|---|
| POST | /v1/user/sync-tier | app | user JWT | write | yes | M4 | Closest milestone is M4 (RevenueCat). Calls the RevenueCat REST API per request. 403 `forbidden` if `revenuecat_app_user_id` is not bound to this user. 503 `sync_unavailable`. 404. Returns the updated profile. Until M4, the rebuild could return the stored profile unchanged. |
| POST | /v1/webhooks/revenuecat | webhook | webhook secret (`Authorization` header) | write | no | M4 | 401 for a bad secret. 422 for a bad payload. **202 `{status:"ignored", reason:"user_not_found"}`** for an unknown user. 200 `{status:"ok"}`. |

### Email and unsubscribe

| Method | Path | Aud | Auth | Kind | Kt | MS | Notes |
|---|---|---|---|---|---|---|---|
| GET | /v1/email/unsubscribe | web | signed token in `?token=` | read | no | M1 | HTML confirm page. 400 HTML for a bad token. The form posts to the **absolute** path `/v1/email/unsubscribe?token=...`. Emails build this link from `PUBLIC_API_BASE_URL` (`pulse-email.ts:218`, `filing-change-alerts.ts:232`). The token is signed with `jwtSecret`, so changing the secret breaks old links. |
| POST | /v1/email/unsubscribe | web | signed token in `?token=` | write | no | M1 | Sets email opt-out. HTML 200. |

### Legal and web pages

| Method | Path | Aud | Auth | Kind | Kt | MS | Notes |
|---|---|---|---|---|---|---|---|
| GET | /legal/privacy | web | none | read | no (opened by app) | M1 | HTML, `public, max-age=300`. A trailing slash is accepted. Served before the runtime and DB init. The app builds the URL as `<apiBaseUrl>/legal/privacy`. |
| GET | /legal/terms | web | none | read | no (opened by app) | M1 | Same. |

(`/auth/delete-account*` and `/r/:token` are web pages too. They are listed under Account and Reports.)

### Health

| Method | Path | Aud | Auth | Kind | Kt | MS | Notes |
|---|---|---|---|---|---|---|---|
| GET | /health | internal | none | read | no | M1 | `{ status:"ok", modes:{ push, email, artifact_store } }`. Answers before runtime init and without a rate limit. |

### Internal (scheduler, ingest, evaluators)

All need `x-internal-token`. A bad token gets `401 { error:"unauthorized", error_message:"Internal token mismatch." }`. Callers come from a grep of `apps/scheduler`, `apps/dexter-worker`, `apps/news-ingest` and `apps/data-openbb`.

| Method | Path | Aud | Auth | Kind | Kt | MS | Notes |
|---|---|---|---|---|---|---|---|
| POST | /internal/canonical-events/ingest | internal | internal token | write | no | M3 | Body `{ events[] }`. 422. Caller: scheduler. |
| GET | /internal/canonical-events | internal | internal token | read | no | M3 | `?subject_type&subject_id&family&limit`. drop? Only tests call it. |
| POST | /internal/first-party/context/ingest | internal | internal token | write | no | M3 | Body `{ context_items[], call_artifacts[] }`. drop? Only tests call it (news-ingest serves its own `/v1/first-party/context`, which product-api reads). |
| GET | /internal/first-party/context | internal | internal token | read | no | M3 | `?ticker&event_id&limit`. drop? Only tests call it. |
| POST | /internal/pulse/dispatch | internal | internal token | long | no | M3 | **202** `{ deduplicated:false, job }`, or 200 `{ deduplicated:true, job }`. Starts `processMarketPulseJob` with `setImmediate` **after** the response: it builds the pulse from data-openbb and news-ingest, then sends push to Free and Pro users. An Edge Function needs a queue or `waitUntil` here. Caller: scheduler. |
| POST | /internal/macro-stress/dispatch | internal | internal token | long | no | M3 | Body `{ market_date? }`. Fetches data-openbb macro data. 200 `skipped` on a non-trading day, 200 `created`/`updated`, 503 when data-openbb fails. Caller: scheduler. |
| POST | /internal/sentiment/dispatch | internal | internal token | long | no | M3 | **Same handler** as macro-stress/dispatch. drop? It is a legacy alias (the scheduler still calls both names). |
| POST | /internal/calendar/sync | internal | internal token | long | no | M3 | Pulls the earnings calendar from data-openbb `/internal/calendar/earnings`. 422 / 503. Caller: scheduler. |
| POST | /internal/name-relationships/ingest | internal | internal token | write | no | M3 | 422 / 404. drop? No caller found (relationships are made in job complete). |
| POST | /internal/notifications/earnings-war-room | internal | internal token | long | no | M3 | Batch over users; sends push (3 push sites). Push delivery itself moves in M4. Caller: scheduler. |
| POST | /internal/notifications/earnings-preview | internal | internal token | long | no | M3 | Batch; push. Caller: scheduler. |
| POST | /internal/notifications/cross-name/evaluate | internal | internal token | long | no | M3 | Batch; push (`dispatchCrossNamePropagation`). Caller: scheduler. |
| POST | /internal/conviction/coherence/evaluate | internal | internal token | long | no | M3 | Batch over users; no push. 422. Caller: scheduler. |
| POST | /internal/notifications/kill-switch/evaluate | internal | internal token | long | no | M3 | Batch; push. Caller: scheduler. |
| POST | /internal/notifications/freshness-decay | internal | internal token | long | no | M3 | Batch; push. Caller: scheduler. |
| POST | /internal/notifications/contrarian/evaluate | internal | internal token | long | no | M3 | Batch; push. Caller: scheduler. |
| POST | /internal/notifications/weekly-digest | internal | internal token | long | no | M3 | Batch; **push and email**. Email sending internals are M4. Caller: scheduler. |
| POST | /internal/push/send | internal | internal token | write | no | M4 | **New in the rebuild.** Body `{ user_ids (1-500), notification: { type, route, title, body, data? } }`. Sends FCM push to active devices of users who have not turned that type off; marks dead tokens invalid. 200 `{ data: { mode, users, targets, attempted, delivered, failed, skipped, invalidated } }`. 422 `validation_failed`. |
| POST | /internal/push/test | internal | internal token | write | no | M4 | **New in the rebuild.** Body `{ user_id, title?, body? }`. Sends one test push to that user's devices. Same 200 shape as `/internal/push/send`. 422. |
| POST | /internal/monitor/recompute | internal | internal token | long | no | M3 | Body `{ as_of?, user_ids? }`. Batch recompute of monitor snapshots. Caller: scheduler. |
| GET | /internal/feedback/queue | internal | internal token | read | no | M3 | Filters `limit`, `feedback_type`, and more; 422s. This is the only "admin"-like read; no admin role exists. drop? Only tests call it (keep it if ops reads feedback here). |
| POST | /internal/research-state/refresh | internal | internal token | long | no | M3 | Body `{ as_of?, user_ids?, dry_run? }`. Batch over users. drop? Only tests call it. Pulse reads the latest state, so something must still refresh it. |
| POST | /internal/deep-dive/precompute | internal | internal token | long | no | M3 | Loops over every covered ticker and queues stale Deep Dives. 200 `{ status:"accepted", queued, in_flight, jobs }`. Needs the M2 queue. Caller: scheduler. |

## Shapes (app-facing routes)

Field names are exactly as serialized. `?` means the key may be missing. `undefined` values are dropped by `JSON.stringify`. Types named `*` come from `packages/contracts/src`.

### Auth

```ts
// POST /auth/register   req
{ email: string; password: string }            // password >= 8
// 201
{ status: "verification_sent"; email: string; verification_token?: string /* only if EXPOSE_VERIFICATION_TOKEN */; verification_expires_at: string }

// POST /auth/verify     req { token: string }   200 { status: "verified" }

// POST /auth/login      req { email: string; password: string }
// POST /auth/refresh    req { refresh_token: string }
// POST /auth/google     req { id_token: string }
// 200 (all three) AuthTokensResponse
{ access_token: string; refresh_token: string; token_type: "Bearer"; access_token_expires_at: string; refresh_token_expires_at: string }

// POST /auth/google/link req { id_token: string }  200 { status: "linked" }
// POST /auth/logout     req { refresh_token?: string } (+ bearer)  200 { status: "logged_out" }

// POST /auth/password-reset/request  req { email: string }
// 202 { status: "reset_requested"; message: string; reset_token?: string /* only if exposed */ }
// POST /auth/password-reset/confirm  req { token: string; new_password: string }  200 { status: "password_reset" }
```

### Account

```ts
// DELETE /v1/account   200
{ status: "deleted"; store_subscription_notice?: string }
// /auth/delete-account (web): form fields `email`, then `token` (application/x-www-form-urlencoded); responses are HTML.
```

### User, preferences, devices

```ts
// GET /v1/user/profile, POST /v1/user/sync-tier   200 { data: UserProfile }
interface UserProfile {
  user_id: string; email: string; tier: "FREE" | "PRO"; billing_period_end?: string;
  watchlist_limit: number; daily_deep_dive_limit: number /* -1 = unlimited */; deep_dives_remaining_today: number /* -1 = unlimited */;
}
// POST /v1/user/sync-tier  req { revenuecat_app_user_id?: string }

// GET/PUT /v1/user/notification-preferences  200
{ data: { user_id: string; tier: "FREE" | "PRO"; preferences: Array<{ type: NotificationType; enabled: boolean; quiet_until?: string }> } }
// PUT req
{ preferences: Array<{ type: NotificationType; enabled?: boolean; quiet_until?: string | null }> }
// NotificationType = earnings_preview | earnings_war_room | contrarian_alert | kill_switch | freshness_decay |
//   morning_exception_briefing | cross_name_propagation | weekly_digest | market_pulse_ready | filing_change | pulse_email

// GET/PUT /v1/user/email-preferences   PUT req { email_opt_out: boolean }   200 { data: { email_opt_out: boolean } }

// POST /notifications/device-token
// req { device_token?: string | null; installation_id?: string | null; platform?: string /* default "android" */ }
// 200 { status: "ok"; has_device_token: boolean; installation_id: string }
```

### Watchlist and holdings

```ts
// GET /watchlist, POST /watchlist, DELETE /watchlist/:ticker   200 { data: string[] }
// POST /watchlist req { ticker: string }

interface UserResearchHolding { ticker: string; quantity?: number; cost_basis?: number; label?: string; notes?: string; updated_at: string }
// GET /v1/user/holdings  200 { data: UserResearchHolding[] }
// POST /v1/user/holdings req { ticker: string; quantity?: number; cost_basis?: number; label?: string; notes?: string }
//   200 { data: UserResearchHolding }
// DELETE /v1/user/holdings/:ticker  200 { deleted: boolean }

// POST /v1/user/holdings/import  req { csv: string }   // columns ticker, shares|quantity, cost_basis (header optional)
// 200
{ data: { rows: number; imported: string[]; newly_followed: string[];
          errors: Array<{ line: number; ticker?: string; error: "invalid_ticker" | "invalid_shares" | "invalid_cost_basis" | "duplicate_ticker" | "ticker_not_found" | "name_limit_reached"; error_message: string }>;
          watchlist: string[] } }
```

### Tickers and coverage

```ts
// GET /tickers/search?q=  (and /tickers)   200 { data: Array<{ symbol: string; company_name: string; exchange: TickerExchange }> }
// GET /v1/coverage          200 { data: { count: number; tickers: string[] } }
// GET /v1/coverage?ticker=X 200 { data: { ticker: string; is_covered: boolean } }
```

### Pulse

```ts
// GET /pulse/latest, GET /pulse/:date   200 MarketPulseReport (bare)
interface MarketPulseReport {
  report_id: string; schema_version: string; generated_at: string; cycle_start: string; cycle_end: string;
  macro_stress: MacroStressSnapshot; market_tape?; editorial_issue?; brief_editorial?; editorial_generation?;
  macro_news?; morning_edition?; context?; structural_context?; user_research_state?;
  sections: { market_moves; market_tape; macro_releases; rates_fx_commodities; news_summary; uncertainty_flags; [k: string]: Section };
  flags: string[]; confidence: ConfidenceBlock;
}
// The server rejects a stored or worker report unless report_id, generated_at and those 6 section keys are objects (pulse-routes.ts:74).
// Kotlin reads report_id, generated_at, cycle_end, and sections.*.{section_id,title,body,status,evidence[{source_name,excerpt,url}]}.
// GET /pulse/.../export/pdf  200 application/pdf, content-disposition: attachment; filename="thesis-pulse-<date>-<id>.pdf"
```

### Reports, notes, share

```ts
// GET /reports  200 ReportListItem[] (bare array)
interface ReportListItem { report_id: string; job_id: string; type: "deep_dive" | "market_pulse"; ticker?: string; schema_version: string; created_at: string }

// GET /reports/:id  200 AnalysisReport (bare; see packages/contracts/src/analysis-report.ts)
//   top level: report_id, job_id, schema_version, type, ticker?, issuer?, generated_at, confidence, signal?, historical_context?,
//   valuation?, trust_metadata?, kill_switch_conditions?, name_relationships?, story_header?, change_summary?, visual_panels?,
//   explainers?, watch_items?, coverage_truth?, investment_memo?, due_diligence?, filing_intelligence?, financial_indicators?,
//   structural_context?, financial_analysis?, value_discipline?, sections[], flags[], data_sources[], ...

// GET/PUT /v1/reports/:id/note   PUT req { content: string /* <= 10000 */ }
// 200 { data: { report_id: string; content: string; updated_at: string } }

// POST /v1/reports/:id/share   201|200
{ data: { share_token: string; path: string /* "/r/<token>" */; url: string | null } }

// GET /v1/reports/:id/page?theme=light|dark&embed=1  200 text/html (Deep Dive 2.0 page; editorial page if it fails)
//   headers: content-security-policy (also x-thesis-csp), cache-control "private, no-store", x-robots-tag "noindex, nofollow",
//   referrer-policy "no-referrer", x-frame-options "DENY", x-content-type-options "nosniff". 404 text/html when not found.

// GET /v1/reports/:id/export/pdf  200 application/pdf, filename="thesis-deep-dive-<TICKER>-<reportId>.pdf"
```

### Jobs

```ts
// POST /jobs  req { ticker: string }    202|200 JobStatusResponse (bare)
// GET /jobs/:id                          200 JobStatusResponse (bare)
interface JobStatusResponse {
  job_id: string; type: "deep_dive" | "market_pulse"; status: "queued" | "running" | "complete" | "failed";
  ticker?: string; report_id?: string; created_at: string; started_at?: string; completed_at?: string; error_message?: string;
}
```

### Research data

```ts
// GET /v1/names/relationships  200 { data: NameRelationshipItem[] }
interface NameRelationshipItem { relationship_id; user_id; source_ticker; target_ticker; relationship_type; confidence: number; state;
  source_report_id?; prompt_version?; evidence_text?; rationale?; created_at; updated_at; suppressed_at? }

// GET /v1/research/earnings/state  200 { data: EarningsEventStateListResponse }
interface EarningsEventStateListResponse { as_of: string; window_start: string; window_end: string; states: EarningsEventState[] }
interface EarningsEventState { ticker; earnings_event_id; event_date; event_time?; timing_state; source_state; evidence_state; reason_text;
  primary_candidate; candidates[]; conflict; release_artifact?; has_transcript: boolean; updated_at }

// GET /v1/research/war-room/:id  200
{ data: { war_room_id; ticker; earnings_event_id; event_date; state; current_cadence_min; prepared_at?; closed_at?; last_cycle_status?;
  last_lag_min?; last_runtime_min?; last_cycle_at?; earnings_state: EarningsEventState | null; evidence_pack;
  reason_path: { earnings_state_reason?; latest_timeline_reason? };
  timeline: Array<{ war_room_event_id; war_room_id; phase; event_type; reason_text; source_refs; alert_ledger_id?; report_id?; created_at }> } }

// GET /v1/scenarios/templates  200 { data: Array<{ scenario_id; title; summary; hypothesis; active: boolean; created_at; updated_at }> }
// POST /v1/scenarios/runs  req { scenario_id: ScenarioStressTemplateId; as_of?: "YYYY-MM-DD" }
// POST /v1/scenarios/runs, GET /v1/scenarios/runs/:id  200
{ data: {
  run: { scenario_run_id; scenario_id; user_id; status; run_mode; as_of; total_names; impacted_names; critical_names; summary; route: Route; created_at; completed_at? };
  impacts: Array<{ scenario_impact_id; scenario_run_id; user_id; ticker; impact_level; thesis_break_likelihood; stress_score; rationale; evidence_refs: string[]; route: Route; created_at }>;
  rule_suggestions: Array<{ scenario_rule_suggestion_id; scenario_run_id; user_id; ticker; signal_type; direction; condition_text; rationale; confidence; route: Route; created_at }> } }
type Route = { open_tab: "research"; scenario_id; scenario_run_id; ticker?; rule_id? }

// POST /v1/reports/:id/scenario  req { overrides: { projection_years?: int 1..30; terminal_growth_rate?: -0.2..0.2; wacc?: (0,1] } }
// 200 ScenarioResponse (bare)
{ report_id; deterministic_model: "phase6_deterministic_v1"; base: ValuationSnap; scenario: ValuationSnap; omissions: Array<{ omission_code; omission_text; affects_fields: string[] }> }
type ValuationSnap = { fair_value_mid?; fair_value_low?; fair_value_high?; spot_price?; implied_upside_pct?; assumptions: ValuationAssumptions; degraded_reason?; omissions? }

// GET/POST /v1/reports/:id/opposite-case  200
{ data: { opposite_case_id; user_id; source_report_id; ticker; prompt_version; thesis_summary; opposite_case_summary;
  key_points: Array<{ title; summary; evidence_refs: EvidenceRef[]; ... }>; shared_evidence_refs: EvidenceRef[]; decisive_factors: string[]; generated_at; created_at } }
type EvidenceRef = { kind; ref_id; label?; ticker?; captured_at? }

// GET /v1/conviction/timeline  200 { data: Array<{ journal_entry_id; user_id; ticker; event_type; source_type; source_id; event_at; title; summary;
//   thesis_snapshot: { ticker?; report_id?; report_generated_at?; signal_value?; confidence_label?; confidence_score?; thesis_summary?; monitor_state?; freshness_state?; signal_reasons?: string[] };
//   evidence_refs: EvidenceRef[]; report_id?; alert_ledger_id?; war_room_id?; monitor_snapshot_key?; opposite_case_id?; created_at; updated_at }> }
// GET /v1/conviction/insights  200 { data: Array<{ insight_id; user_id; period_start; period_end; insight_type; status; title; summary;
//   findings: Array<{ finding_type; title; summary; tickers: string[]; confidence; evidence_refs: EvidenceRef[] }>; source_journal_entry_ids: string[]; generated_at; created_at; updated_at }> }

// GET /v1/macro-stress/current  200 { data: MacroStressSnapshot }   history: { data: MacroStressSnapshot[] }
interface MacroStressSnapshot { snapshot_id; as_of; generated_at; state; summary; no_material_change: boolean;
  inputs: Array<{ registry_id; label; category; pressure; source_state; value?; unit?; period?; reason; source_name?; retrieved_at? }>;
  omissions: Array<{ registry_id; reason_code; reason_text }> }
// GET /v1/sentiment/current  200 { data: FearGreedSnapshot }   history: { data: FearGreedSnapshot[] }
interface FearGreedSnapshot { id; market_date; score: number; label: "extreme_fear"|"fear"|"neutral"|"greed"|"extreme_greed";
  sub_scores: Array<{ input_name; provider; available: boolean; weight: number; normalized_score?; raw_value?; retrieved_at?; notes? }>; missing_inputs: string[]; calculated_at }

// GET /v1/user/alerts, GET /v1/user/alerts/:id, POST .../feedback, POST .../mute
// list: { data: AlertView[] }   single: { data: AlertView }
// feedback req { feedback: "useful" | "not_useful" }   mute req: no body
interface AlertView { id; user_id; notification_type; category; route; title; body; detail_body?; detail_locked?: true; reason_code; reason_text;
  delivery_state; feedback_state?; muted_at?; context /* free object: ticker, report_id, pulse_date, digest_date, war_room_id, event_date, related_tickers[], ... */; created_at; updated_at }

// GET /v1/user/monitor-snapshots  200
{ data: Array<{ user_id; ticker; state; reason; score; report_id?; report_generated_at?; report_schema_version?; last_deep_dive_at?;
  material_events_count; unreviewed_events_count; freshness_state; freshness_score; kill_switch_triggered_at?; freshness_reason?; updated_at }> }

// POST /v1/feedback/report        req { report_id; code: "useful"|"confusing"|"generic"|"stale"|"bug_report"; source_surface (<=100); severity?: "normal"|"high"|"blocker"; ticker?; message? (<=2000) }
// POST /v1/feedback/subscription  req { code: "cancel_price"|"cancel_low_value"|"cancel_too_noisy"|"cancel_other"; source_surface; severity?; message? }
// 202 { data: { feedback_id; status: "queued_for_review"; triage_status; route_status; created_at } }
```

### Worker-facing shapes the rebuild must keep (M2)

```ts
// POST /internal/jobs/:id/claim   200 { job: JobStatusResponse; analysis_request: { request_id; type; ticker?; user_id?; job_id; requested_at } }
// POST /internal/jobs/:id/complete req { report: AnalysisReport; llm_usage?: object }  200 { status: "ok"; report_id }
// POST /internal/jobs/:id/fail     req { error_message?: string }  200 { status: "ok" }
// GET  /internal/reports/comparable-latest  200 { missing: boolean; data: { report_id; generated_at; schema_version; ticker?; signal_value?;
//        confidence_label?; confidence_score?; thesis_statement?; valuation_mid?; trust_metadata? } | null }
// GET  /v1/historical/{financials,transcripts,filing-sections}  200 { data: unknown[]; missing: boolean }
// GET  /v1/historical/coverage  200 { data: TickerCoverage | null; missing: boolean }
```

## Diff vs Kotlin client

**Paths the client calls that the server does not have: none.** All 48 Kotlin calls match a server route by method and path.

The 48th call is the Deep Dive WebView (D3, 2026-11-24): `GET /v1/reports/:id/page?theme=light|dark&embed=1`, URL built in `ui/screens/DeepDiveWebPolicy.kt` (`pageUrl`) and loaded by `ui/screens/DeepDiveWebPage.kt` with the bearer token.

The other 47 Kotlin calls (ProductApiClient.kt line of the path):
auth: register 60, verify 70, login 78, password-reset/request 84, password-reset/confirm 93, DELETE /v1/account 99, refresh 106, logout 115.
user: device-token 133, notification-preferences GET 146 / PUT 170, profile 771, sync-tier 788.
alerts: list 184, feedback 211, mute 227. War room 243.
tickers/search 255. Jobs: POST /jobs 273, GET /jobs/:id 278.
reports: GET /reports/:id 283, note GET 293 / PUT 314, GET /reports 702.
feedback: report 347, subscription 373.
scenarios: templates 387, runs POST 411, runs GET 427, report scenario 450.
conviction: timeline 465, insights 485. Opposite case: GET 503, POST 524.
pulse: latest 534, by date 543, latest pdf 551, date pdf 556.
macro: current 622, sentiment current 630, history 643, sentiment history 651. Monitor snapshots 666.
watchlist: GET 718, POST 726, DELETE 736. Holdings import 746.

**Server app routes that Kotlin does not call (13):** `POST /auth/google`, `POST /auth/google/link`, `GET` and `PUT /v1/user/email-preferences`, `GET` and `POST /v1/user/holdings`, `DELETE /v1/user/holdings/:ticker`, `GET /tickers`, `POST /v1/reports/:id/share`, `GET /v1/reports/:id/export/pdf`, `GET /v1/names/relationships`, `GET /v1/research/earnings/state`, `GET /v1/user/alerts/:id`. Before dropping any of them, check whether a newer app build or a web page uses it.

**Mismatches and traps:**

1. **Macro stress cannot be parsed by the app (live bug).** `GET /v1/macro-stress/current` and `/history` return `MacroStressSnapshot` (`snapshot_id`, `as_of`, `state`, `summary`, `inputs`, ...), which has no numeric score. Kotlin `mapSentimentSnapshot` (`ProductApiClient.kt:1338`) returns null unless one of `score`, `macro_stress_score`, `stress_score`, `pressure_score`, `index_value` or `value` is present. So on a 200 the app shows "no data" (current) or an empty list (history). The legacy `/v1/sentiment/*` fallback runs only after a 404 whose error code is not `macro_stress_not_found` or `sentiment_not_found`, so it never runs here. The rebuild must decide: keep the server shape (the app stays broken), or add a `score` and `label` to the macro-stress payload. Record the choice in DECISIONS.md.
2. **Envelope differences are load-bearing.** `GET /reports` must stay a bare array. `/jobs`, `/reports/:id`, `/pulse/*` and the report scenario must stay unwrapped. Everything else the app reads expects `data`.
3. **The error-code branches depend on exact strings:** `note_not_found`, `opposite_case_not_found`, `macro_stress_not_found`, `sentiment_not_found`, and `upgrade_required` with `feature`. `requestJsonArray` (used only by `GET /reports`) ignores `error` and keeps only the message.
4. **Device token unregister.** Kotlin sends `device_token: null`, which org.json drops from the body. The server must treat a missing token as "unregister this installation".
5. **Logout** sends both the bearer access token and `refresh_token` in the body. The server revokes the bearer's session first.
6. **War room.** Kotlin also looks for `title`, `summary`, `phases`, `related_tickers` and `<phase>_summary` keys (`model/WarRoomViewMapper.kt`). The server never sends them, so the app falls back to `timeline`. This is not breaking, but do not "fix" it by renaming `timeline` or `state`.
7. **Ticker search 404.** "No match" is `404 ticker_not_found`, not `200 []`. Keep it.
8. **Root-path assumptions.** The app opens `<baseUrl>/legal/{terms,privacy}`. The HTML forms post to absolute `/auth/delete-account`, `/auth/delete-account/confirm` and `/v1/email/unsubscribe?token=`. Share links (`/r/<token>`) and email unsubscribe links are built from `PUBLIC_API_BASE_URL`. The Worker must serve the API at the **root** of the new base URL, not under `/functions/v1/api`, and `PUBLIC_API_BASE_URL` must point at the Worker.
9. **Release builds pin certificates.** The release config needs `RELEASE_API_HOST`, `RELEASE_CERT_PIN_PRIMARY` and `RELEASE_CERT_PIN_BACKUP` (`app/build.gradle.kts`). A new host on Cloudflare needs new pins and a new release build, not just a server switch.
10. **Token format.** Access and refresh tokens are product-api HS256 JWTs tied to a session row, and the email-unsubscribe tokens use the same `jwtSecret`. If the rebuild moves to Supabase Auth, it must still return the same 5-field token body, keep refresh rotation, and keep old unsubscribe links working (or accept that they break).

## Appendix: route to source (file:line)

`S` = `apps/product-api/src/server.ts`, `R/` = `apps/product-api/src/routes/`.

| Method | Path | Source |
|---|---|---|
| OPTIONS | * (CORS preflight) | S:5900 |
| GET | /health | S:5920 |
| GET | /legal/privacy, /legal/terms | R/legal-routes.ts:6-7, handler :11 (called S:5933) |
| POST | /auth/register | R/auth-routes.ts:102 |
| POST | /auth/verify | R/auth-routes.ts:185 |
| POST | /auth/login | R/auth-routes.ts:236 |
| POST | /auth/google | R/auth-routes.ts:342 |
| POST | /auth/google/link | R/auth-routes.ts:498 |
| POST | /auth/refresh | R/auth-routes.ts:596 |
| POST | /auth/logout | R/auth-routes.ts:705 |
| POST | /auth/password-reset/request | R/account-routes.ts:63 |
| POST | /auth/password-reset/confirm | R/account-routes.ts:84 |
| DELETE | /v1/account | R/account-routes.ts:145 |
| GET | /auth/delete-account | R/account-routes.ts:163 |
| POST | /auth/delete-account | R/account-routes.ts:181 |
| POST | /auth/delete-account/confirm | R/account-routes.ts:208 |
| GET | /v1/coverage | R/coverage-routes.ts:37 |
| POST | /internal/deep-dive/precompute | R/coverage-routes.ts:57 |
| GET, POST | /v1/email/unsubscribe | R/email-unsubscribe-routes.ts:40 (GET :51, POST :62) |
| GET | /r/:token | R/report-share-routes.ts:32, :166 |
| POST | /internal/canonical-events/ingest | S:6068 |
| GET | /internal/canonical-events | S:6098 |
| POST | /internal/first-party/context/ingest | S:6149 |
| GET | /internal/first-party/context | S:6191 |
| GET | /internal/reports/comparable-latest | S:6222 |
| POST | /internal/pulse/dispatch | S:6300 |
| POST | /internal/macro-stress/dispatch | S:6379 |
| POST | /internal/sentiment/dispatch | S:6380 |
| POST | /internal/calendar/sync | S:6521 |
| POST | /internal/name-relationships/ingest | S:6620 |
| POST | /internal/notifications/earnings-war-room | S:6662 |
| POST | /internal/notifications/earnings-preview | S:7301 |
| POST | /internal/notifications/cross-name/evaluate | S:7492 |
| POST | /internal/conviction/coherence/evaluate | S:7568 |
| POST | /internal/notifications/kill-switch/evaluate | S:7621 |
| POST | /internal/notifications/freshness-decay | S:7875 |
| POST | /internal/notifications/contrarian/evaluate | S:7937 |
| POST | /internal/notifications/weekly-digest | S:8092 |
| POST | /internal/research-state/refresh | R/research-state-routes.ts:75 (called S:8331) |
| POST | /internal/monitor/recompute | S:8352 |
| GET | /internal/feedback/queue | S:8388 |
| POST | /internal/jobs/:id/claim | S:8449, :8458 |
| POST | /internal/jobs/:id/complete | S:8493 |
| POST | /internal/jobs/:id/fail | S:8669 |
| POST | /v1/webhooks/revenuecat | R/revenuecat-routes.ts:105 (called S:8710) |
| GET | /v1/historical/financials | R/public-routes.ts:54, :80 (called S:8732) |
| GET | /v1/historical/transcripts | R/public-routes.ts:55, :139 |
| GET | /v1/historical/filing-sections | R/public-routes.ts:56, :101 |
| GET | /v1/historical/coverage | R/public-routes.ts:57, :160 |
| (gate) | bearer auth for everything below | S:8753 |
| GET | /v1/conviction/timeline | S:8762 |
| GET | /v1/conviction/insights | S:8810 |
| GET | /v1/scenarios/templates | S:8847 |
| POST | /v1/scenarios/runs | S:8875 |
| GET | /v1/scenarios/runs/:id | S:8945 |
| GET | /v1/user/alerts | S:9012 |
| GET | /v1/user/alerts/:id | S:9071 |
| POST | /v1/user/alerts/:id/feedback | S:9097 |
| POST | /v1/user/alerts/:id/mute | S:9137 |
| GET | /v1/user/profile | S:9190 |
| POST | /v1/user/sync-tier | R/revenuecat-routes.ts:192 (called S:9218) |
| POST | /v1/feedback/report | S:9240 |
| POST | /v1/feedback/subscription | S:9361 |
| GET | /v1/macro-stress/current | S:9448 |
| GET | /v1/macro-stress/history | S:9477 |
| GET | /v1/sentiment/current | S:9508 |
| GET | /v1/sentiment/history | S:9536 |
| POST | /notifications/device-token | R/notification-routes.ts:93 (called S:9566) |
| GET, PUT | /v1/user/email-preferences | R/notification-routes.ts:226 |
| GET | /v1/user/notification-preferences | R/notification-routes.ts:254 |
| PUT | /v1/user/notification-preferences | R/notification-routes.ts:276 |
| POST | /v1/reports/:id/share | R/report-share-routes.ts:31, :67 (called S:9587) |
| GET | /v1/reports/:id/page | new in the rebuild (D3): `supabase/functions/api/features/reports/page.ts` |
| GET | /v1/user/monitor-snapshots | S:9595 |
| GET | /v1/names/relationships | S:9631 |
| GET | /v1/research/earnings/state | S:9690 |
| GET | /v1/research/war-room/:id | S:9753 |
| GET | /watchlist | S:9860 |
| GET | /v1/user/holdings | R/research-state-routes.ts:133 (called S:9869) |
| POST | /v1/user/holdings | R/research-state-routes.ts:141 |
| DELETE | /v1/user/holdings/:ticker | R/research-state-routes.ts:201 |
| POST | /v1/user/holdings/import | R/holdings-import-routes.ts:6, :102 (called S:9892) |
| POST | /watchlist | S:9900 |
| DELETE | /watchlist/:ticker | S:9960 |
| GET | /pulse/latest/export/pdf | R/pulse-routes.ts:297 (called S:9996) |
| GET | /pulse/:date/export/pdf | R/pulse-routes.ts:316 |
| GET | /pulse/latest | R/pulse-routes.ts:345 (worker call :133) |
| GET | /pulse/:date | R/pulse-routes.ts:378 |
| GET | /tickers/search, /tickers | S:10017 |
| POST | /jobs | S:10060 |
| GET | /jobs/:id | S:10343 |
| GET | /reports | S:10369 |
| GET | /reports/:id | S:10376 |
| GET | /v1/reports/:id/export/pdf | S:10440 |
| GET | /v1/reports/:id/opposite-case | S:10535 |
| GET, PUT | /v1/reports/:id/note | S:10598 |
| POST | /v1/reports/:id/opposite-case | S:10687 |
| POST | /v1/reports/:id/scenario | S:10801 |
| (any) | 404 fallback `{status:"not_found"}` | S:10929 |
