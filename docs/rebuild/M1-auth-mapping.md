# M1 auth mapping: old `/auth/*` routes on Supabase Auth

Decision D6: Supabase Auth (GoTrue, `${SUPABASE_URL}/auth/v1`) owns passwords, sessions and JWTs.
The app keeps calling the old paths with the old bodies. This file says what each route does now.

Code: `supabase/functions/api/features/auth/` and `account/`, `_lib/auth/` (GoTrue client, tokens, config, seed),
`_lib/email/` (email module), `_lib/store/auth.ts` (SQL).

## How it fits together

- `app.users` keeps one row per user. `id` = the auth user id (text), `auth_user_id` = the same uuid,
  `email` lowercased, `verified_at` and the lockout columns. `password_hash` stays null.
- `app.sessions` and `app.verification_tokens` are no longer written. Supabase keeps sessions and email tokens.
  `app.account_action_tokens` holds our own account deletion codes (resend driver only).
- Public GoTrue calls use `SUPABASE_ANON_KEY`. `/admin/*` calls use `SUPABASE_SERVICE_ROLE_KEY`. Both are set by the
  platform inside Edge Functions.
- The bearer guard (`_shared/auth.ts`) checks access tokens with `GET /auth/v1/user`. GoTrue checks that the session
  still exists, so a logout or a password reset kills the access token at once, as before.

### The codes users type

A code is a Supabase **token hash** with a short tag in front. The tag tells the server which GoTrue verify `type`
to use, so no email is needed ("verify token without email").

| Tag | Made by | GoTrue `type` on `POST /verify` | Accepted by |
| --- | --- | --- | --- |
| `v1s.` | signup confirmation (`/resend type=signup`, or `generate_link type=signup`) | `signup` | `/auth/verify` |
| `v1m.` | magic link (resend driver fallback when `generate_link signup` is refused) | `magiclink` | `/auth/verify` |
| `v1r.` | recovery (`/recover`, or `generate_link type=recovery`) | `recovery` | `/auth/password-reset/confirm` |
| `v1d.` | magic link OTP (`/otp create_user=false`, supabase driver) | `magiclink` | `/auth/delete-account/confirm` |

- An untagged code at `/auth/verify` is tried as `signup`. An untagged code at `/auth/password-reset/confirm` is tried
  as `recovery`. An untagged code at `/auth/delete-account/confirm` is looked up in `app.account_action_tokens`
  (our own code, resend driver).
- A code with another route's tag is refused without calling GoTrue. This matters because recovery and magic link
  tokens share one column in GoTrue: without the tag check, a reset code typed into the delete form would delete the account.
- Old codes were 43-char opaque strings. The app sends the code as free text, so the longer format needs no app change.

## Routes

Rate limits are unchanged (contract "Rate limit"): login, register and refresh have their own buckets; other
`/auth/*` paths use the login limit; `/v1/account` uses the general limit. Every error body is `{ error, error_message }`.

| Route | GoTrue call(s) | App tables touched | Success response | Error codes |
| --- | --- | --- | --- | --- |
| `POST /auth/register` | `POST /admin/users` (email, password, `email_confirm:false`); then the email module (verify). On an insert failure: `DELETE /admin/users/{id}` | `users` (insert), `audit_events` | 201 `{status:"verification_sent", email, verification_expires_at, verification_token?}` | 422 `validation_failed` (bad email, password < 8, GoTrue `weak_password`); 409 `email_exists` (row in `app.users`, or GoTrue says the email exists); 503 `service_unavailable` (GoTrue down) |
| `POST /auth/verify` | `POST /verify {type, token_hash}`; then `POST /logout?scope=local` with the session it returns (we do not hand it out) | `users.verified_at`, `audit_events` | 200 `{status:"verified"}` | 422 `validation_failed` (no token); 400 `invalid_verification_token`; 404 `user_not_found` (no `app.users` row) |
| `POST /auth/login` | `POST /token?grant_type=password` (only after the app checks: user exists, verified, not locked) | `users` lockout columns, `audit_events`; bootstrap hook may write `users`, `subscriptions` | 200 `AuthTokensResponse` | 422 `validation_failed`; 401 `auth_failed` (unknown, unverified or wrong password); 423 `account_locked` + `locked_until`, `retry_after_seconds`; 503 `service_unavailable` (GoTrue error other than 400; not counted as a failed attempt) |
| `POST /auth/refresh` | `POST /token?grant_type=refresh_token` (GoTrue rotates and detects reuse) | `audit_events` | 200 `AuthTokensResponse` | 422 `validation_failed`; 401 `refresh_failed` on any failure |
| `POST /auth/logout` | Bearer (or body `refresh_token`; the bearer wins). A JWT: `POST /logout?scope=local` with it. A refresh token: `POST /token?grant_type=refresh_token`, then `POST /logout?scope=local` with the new access token | `audit_events` | 200 `{status:"logged_out"}` | 401 `unauthorized`; 503 on a GoTrue outage |
| `POST /auth/password-reset/request` | email module (reset), only when `app.users` has the email; runs after the response | none | always 202 `{status:"reset_requested", message, reset_token?}` | 422 `validation_failed` (bad email) |
| `POST /auth/password-reset/confirm` | `POST /verify {type:"recovery"}`; `PUT /admin/users/{id} {password}`; `POST /logout?scope=global` with the recovery session (ends every session of the user) | `users` (clear lockout, set `verified_at`), `audit_events` | 200 `{status:"password_reset"}` | 422 `validation_failed` (token missing, password < 8, GoTrue `weak_password`); 400 `invalid_reset_token` (bad, used or expired code, or no `app.users` row); 503 |
| `POST /auth/google`, `POST /auth/google/link` | none (Google sign-in is off; only the off path is ported, TODO in `handlers.ts`) | none | 404 `{status:"not_found"}` | none |
| `DELETE /v1/account` (bearer) | `DELETE /admin/users/{id}` (404 counts as done) | `audit_events` (emails stripped, then `account.deleted`), every `app` table with `user_id` (see below), `report_shares.created_by`, `users`; Storage files through `deleteUserFiles` (TODO M4) | 200 `{status:"deleted", store_subscription_notice?}` (notice when the tier is not FREE) | 401 `unauthorized` (guard); 500 if the auth delete fails (nothing deleted in the app) |
| `GET /auth/delete-account` | none | none | 200 HTML form, posts to `/auth/delete-account` | none |
| `POST /auth/delete-account` (form `email`) | supabase driver: `POST /otp {create_user:false}`. Resend driver: none (our own code). Runs after the response | `account_action_tokens` (resend driver) | 200 HTML, same page whether or not the account exists; form posts to `/auth/delete-account/confirm` | 422 HTML (bad email) |
| `POST /auth/delete-account/confirm` (form `token`) | `v1d.` codes: `POST /verify {type:"magiclink"}`. Then the same delete as `DELETE /v1/account` | as `DELETE /v1/account`, plus `account_action_tokens` (consume) | 200 HTML "Account deleted" | 400 HTML (bad, used or expired code) |

`AuthTokensResponse` is exactly the old shape:
`{ access_token, refresh_token, token_type: "Bearer", access_token_expires_at, refresh_token_expires_at }`.
`access_token_expires_at` comes from the GoTrue session (`expires_at`). `refresh_token_expires_at` is
now + `REFRESH_TOKEN_TTL_SECONDS` (default 30 days), as before; see "Sessions" below.

### Account delete order

1. Read the tier (`store_subscription_notice`), strip `email` from the user's `audit_events` payloads.
2. `deleteUserFiles(userId)`: no-op until M4 adds Storage objects (TODO in `api/features/auth/deps.ts`).
3. `DELETE /admin/users/{id}`. If this fails, stop with 500 and keep everything, so the user can retry.
   On the hosted project `app.users.auth_user_id` cascades, so this already removes `app.users` and its FK children.
4. `deleteUserRows`: one transaction that deletes from **every** base table in schema `app` with a `user_id` column
   (found in `information_schema`, so tables added by M2-M4 are covered), then `report_shares` by `created_by`,
   then the `users` row. Kept on purpose, as the old server did: `jobs` (user_id set null; reports hang off jobs)
   and `audit_events` (security history, detached). A milestone that adds a user table that must be kept should
   tell M1.

## Email module (`_lib/email/`)

`EMAIL_PROVIDER_MODE` picks the driver: `supabase` (default) or `resend`.

| Message | supabase driver | resend driver |
| --- | --- | --- |
| verify email | `POST /resend {type:"signup"}`; Supabase sends "Confirm signup" | `POST /admin/generate_link {type:"signup"}` (fallback `magiclink`), our text via Resend |
| password reset | `POST /recover`; Supabase sends "Reset Password" | `POST /admin/generate_link {type:"recovery"}`, our text via Resend |
| account deletion code | `POST /otp {create_user:false}`; Supabase sends "Magic Link" (tag `v1d.`) | our own code in `app.account_action_tokens` (16 bytes, sha256 stored, single use, 1 hour, a new one supersedes), our text via Resend |
| generic `send({to, subject, text, html?})` | `{delivered:false, provider:"supabase", reason:"unsupported"}` | `POST https://api.resend.com/emails` |

Why the deletion code differs: the supabase driver cannot send our own text, so the code must be a Supabase OTP.
With Resend we keep the old design (our code, our table).

Resend settings: `RESEND_API_KEY`, `EMAIL_FROM` (a sender on a verified domain; needs the domain from D2).
The old server called these `EMAIL_RESEND_API_KEY` and `EMAIL_FROM_ADDRESS`; OWNERSHIP.md names the new ones.
Our texts are the old subjects and texts, with the tagged code in place of the old code.

## Dashboard settings for the owner

### Email templates (Authentication > Emails > Templates)

Paste these. The tag before `{{ .TokenHash }}` is required.

**Confirm signup**
- Subject: `Verify your Thesis account`
- Body:
```html
<p>Your Thesis verification code is:</p>
<p><strong>v1s.{{ .TokenHash }}</strong></p>
<p>Enter it in the Thesis app to verify your account. If you did not create an account, ignore this email.</p>
```

**Reset Password**
- Subject: `Your Thesis password reset code`
- Body:
```html
<p>Your password reset code is:</p>
<p><strong>v1r.{{ .TokenHash }}</strong></p>
<p>Enter it in the Thesis app to choose a new password. It expires in 1 hour. If you did not ask for this, ignore this email.</p>
```

**Magic Link** (used only for account deletion)
- Subject: `Confirm deletion of your Thesis account`
- Body:
```html
<p>Your account deletion code is:</p>
<p><strong>v1d.{{ .TokenHash }}</strong></p>
<p>Enter it on the account deletion page to permanently delete your account. It expires in 1 hour. If you did not ask for this, ignore this email.</p>
```

Leave the other templates as they are; nothing sends them.

### Auth settings

| Setting (dashboard) | Value | Why |
| --- | --- | --- |
| Sign In / Providers > Email > enabled | on | password login |
| Email > "Confirm email" | **on** | unverified users must not log in; `/resend type=signup` only works for unconfirmed users |
| "Allow new users to sign up" | **off** | otherwise anyone with the public anon key can `POST /auth/v1/signup` and skip `/auth/register` (no `app.users` row, no 409 check, no rate limit). Our flows do not use public sign-up: register uses the admin API, deletion uses `/otp` with `create_user:false`, reset uses `/recover`. **Check on `api-m1` before real users:** register then confirm a "Confirm signup" email arrives with sign-ups off. If `/resend` is refused, tell the coordinator (fix: send the verify code with `/otp` and a shared template). The resend driver is not affected (admin API, with a magic link fallback) |
| Email > "Email OTP Expiration" | **3600** s | one value for every email code. Matches the "expires in 1 hour" texts. Set `AUTH_EMAIL_OTP_EXPIRY_SECONDS` to the same value (default 3600); it feeds `verification_expires_at` |
| Email > "Minimum password length" | 8 | same rule as our 422 check |
| JWT / Sessions > "Access token (JWT) expiry" | **900** s | the old `ACCESS_TOKEN_TTL_SECONDS` (15 minutes). Default is 3600 |
| Sessions > "Detect and revoke potentially compromised refresh tokens" | on (rotation is always on) | contract: reuse of a rotated token revokes the session family |
| Sessions > "Refresh token reuse interval" | **0** s | the old server revoked at the first reuse. The default 10 s lets a retried refresh in that window succeed instead. 0 matches the contract; if the app ever refreshes twice in parallel, the second call gets 401 and the user must log in again (same as the old server) |
| Sessions > time-box / inactivity timeout | leave off (Pro plan only) | refresh tokens then live until logout, so `refresh_token_expires_at` (30 days) is a nominal value, as before for the app |
| Rate Limits | defaults; raise "emails per hour" only with custom SMTP | the built-in mailer sends only to project team addresses and only a few emails an hour (D6) |

Later, with a domain: either set `EMAIL_PROVIDER_MODE=resend` (our texts), or keep the supabase driver and put
Resend in Authentication > SMTP Settings (custom SMTP); then Supabase's own emails reach any address. Both work.

### Environment for `api`

| Name | Default | Note |
| --- | --- | --- |
| `EMAIL_PROVIDER_MODE` | `supabase` | or `resend` |
| `RESEND_API_KEY`, `EMAIL_FROM` | none | resend driver only |
| `AUTH_EMAIL_OTP_EXPIRY_SECONDS` | 3600 | must equal the dashboard value |
| `AUTH_LOCKOUT_MAX_FAILURES` / `_WINDOW_SECONDS` / `_DURATION_SECONDS` | 10 / 900 / 900 | old defaults |
| `REFRESH_TOKEN_TTL_SECONDS` | 2592000 | nominal refresh expiry we report |
| `AUTH_EXPOSE_VERIFICATION_TOKEN` | off | returns codes in register/reset responses. Ignored unless `THESIS_ENV` is `development`, `test` or `local`, so it can never turn on in production. Only works with the resend driver (with the supabase driver the server never sees the code) |
| `ADMIN_BOOTSTRAP_ENABLED`, `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD`, `ADMIN_BOOTSTRAP_FORCE_PRO` | off | old login hook; same `THESIS_ENV` gate. Takes a plain password secret instead of the old bcrypt hash |
| `OIDC_GOOGLE_ENABLED` | off | not ported; the Google routes always answer 404 |

### Admin seed (N11)

`_lib/auth/seed_admin.ts` creates or repairs one verified account, sets `app_metadata.thesis_test_account = true`
in Supabase Auth, and gives PRO with `ADMIN_SEED_PRO=1`. The password comes only from `ADMIN_SEED_PASSWORD`.
It refuses to run without `--yes`. Usage is in the file header. Prefer it to the login hook.

### Per-user rate limits in Supabase Auth (needed before many users)

Supabase Auth limits `/token` (login, refresh) and `/verify` per caller IP. Every call comes from the `api`
function, so without this step all users share one bucket (about 1,800 logins and refreshes an hour, bursts of 30).
1. Authentication > Rate Limits: turn on **IP address forwarding**.
2. Settings > API Keys: create a **secret key** (`sb_secret_...`) and store it as the function secret
   `AUTH_SUPABASE_SECRET_KEY` (Supabase refuses custom names starting with `SUPABASE_`). The api then sends the caller's IP as `sb-forwarded-for` (`_lib/auth/gotrue.ts`).
3. Set the same random value as the Worker secret `EDGE_TOKEN` (`npx wrangler secret put EDGE_TOKEN`) and the
   function secret `EDGE_TOKEN`, so the api trusts the IP the Worker sends and nobody can fake it.

## Differences from the old server (no shape changes)

- Invalid JSON bodies on these routes get the route's 422 (old: 500 `internal_error`).
- A GoTrue outage gives 503 `service_unavailable` on register, login, logout and reset confirm (old had no such
  dependency). A refresh failure of any kind stays 401 `refresh_failed`.
- Verification codes expire after 1 hour (old: 24 hours), because Supabase has one OTP expiry for all email codes
  and reset and deletion texts promise 1 hour. A user who misses it can still use password reset, which also marks
  the account verified (as before).
- `audit_events` payloads no longer carry `request_id` (the new stack has none).
- The bootstrap hook compares a plain secret, not a bcrypt hash, and is gated by `THESIS_ENV` instead of `NODE_ENV`.

## Open points

- GoTrue rate limits by caller IP. All our calls come from the Edge Function, so per-IP limits (for example token
  verifications) are shared by all users. Check the hosted limits on `api-m1` under load; raise them in
  Authentication > Rate Limits if needed.
- Backup (DECISIONS ADR 16): the weekly dump covers schema `app` only. `auth.users` and `auth.identities` need an
  export before anyone but the owner signs up (change to `jobs/ops/backup.sh`, owned by M0).

## Audit fixes (2026-11-23)

From the audit of the rebuild branch (S1, S2, S7, S8, S10-S13). Function secrets, set in the Supabase dashboard
(Edge Functions > Secrets):

| Secret | Meaning |
| --- | --- |
| `AUTH_INVITE_EMAILS` | Emails that may register during the closed test, separated by commas. Unset means nobody can register. |
| `AUTH_REGISTRATION_OPEN` | `true` lets anyone register (public launch). Leave unset for the closed test. |
| `DEEP_DIVE_PRO_DAILY_LIMIT` | Optional. Deep Dives a Pro user may start per day. Default 5. |

- Register answers 403 `registration_closed` for an email that is not invited. The check runs before any lookup.
- New passwords (register, password reset) need 10 characters. Login still takes 8 for older accounts.
- Password-reset emails: at most 3 per address per hour (table `app.rate_limits`, key hashed). Over the cap the
  answer is the same and no email goes out.
- With `EDGE_TOKEN` set, the function URL answers 404 to anything without the Worker's edge token or the
  internal token. The client IP comes only from the Worker's `x-thesis-client-ip`.
- Account delete removes the user's report files from the `report-artifacts` bucket and their report rows,
  unless another user's report points at the same file.
- Request bodies: 1 MiB on public and user routes (`MAX_JSON_BODY_BYTES`), 16 MiB on internal routes.
- No CORS answer. Nightly pg_cron job `m1-trim-rate-limits` deletes rate-limit rows older than a day.
