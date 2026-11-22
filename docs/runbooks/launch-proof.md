# Launch Proof Runbook

Goal: record, once, that one production environment runs in live mode with real data, and that the core user flows work end to end. When every step below has evidence, a roadmap item can move from `Validated` to `Done` (owner sign-off plus production proof, see `Project Note/Phase7/ph7_ROADMAP.md`).

Setup that this runbook assumes: one Linux host, Docker Compose, deployed by the manual `deploy-production` workflow over SSH. See `Decisions/ph1/ADR-009-hosting-as-built.md`.

Time needed: about 2 hours, most of it waiting for Play test renewals.

## 0. Where evidence goes

Make one folder per proof run and commit it:

```
Project Note/Launch-Proof/evidence/<YYYY-MM-DD>/
  health-<HHMMSS>Z.json     written by the health script (step 3)
  PROOF.md                  the checklist at the end of this file, filled in
  *.json / *.png            API outputs and phone screenshots named by step
```

Before you commit: remove access tokens, passwords, full email addresses and device tokens from every file.

## 1. Preconditions

| Check | Command or place | Pass when |
|---|---|---|
| CI green on the commit you deploy | `gh run list --repo rzvsd/Thesis --workflow ci.yml --branch main --limit 1` | `completed success`. Record the SHA |
| GitHub `production` environment secrets set | GitHub > Settings > Environments > production | All 7 `PROD_*` secrets exist |
| Host `.env` complete | section 2 | Every "required" row has a value |
| Firebase admin key on host | `ls <PROD_REPO_DIR>/secrets/firebase-admin.json` | File exists |
| Public HTTPS URL to Product API | TLS proxy on or in front of the host (not in this repo) | `curl -fsS https://<api-host>/health` returns `"status":"ok"` |
| Android release build | `API_BASE_URL_RELEASE`, `RELEASE_API_HOST`, `RELEASE_CERT_PIN_PRIMARY`, `RELEASE_CERT_PIN_BACKUP`, `REVENUECAT_PUBLIC_ANDROID_KEY` set as Gradle properties; `app/google-services.json` present | `bundleRelease` succeeds and the AAB is on the Play internal or closed testing track |

## 2. Host `.env` (in `PROD_REPO_DIR`)

Docker Compose reads this file. The deploy workflow itself exports `NODE_ENV=production` and `THESIS_ALLOW_PRODUCTION_FIXTURES=false`. With those two values, every service refuses to start in fixture mode, and Product API refuses dev secrets. A wrong value shows up as a container that does not become healthy.

### Required for live proof

| Variable | Used by | Value rule |
|---|---|---|
| `INTERNAL_WORKER_TOKEN` | all | 16+ chars, not `dev-internal-worker-token`. Same value as the `PROD_INTERNAL_WORKER_TOKEN` secret |
| `POSTGRES_PASSWORD` | postgres | Not `postgres` |
| `DATABASE_URL_DOCKER` | product-api, data-openbb | `postgres://postgres:<POSTGRES_PASSWORD>@postgres:5432/thesis` |
| `REDIS_PASSWORD` | redis | Not empty |
| `REDIS_URL` | all | `redis://:<REDIS_PASSWORD>@redis:6379/0` (Product API rejects a URL without password in production) |
| `JWT_SECRET` | product-api | 16+ chars, not the dev default |
| `AUTH_EXPOSE_VERIFICATION_TOKEN` | product-api | `false`. Compose defaults it to `true`, and Product API then refuses to start in production |
| `PUSH_PROVIDER_MODE` | product-api | `fcm` (compose mounts `./secrets/firebase-admin.json`) |
| `REVENUECAT_SERVER_API_KEY` and `REVENUECAT_ENTITLEMENT_ID` | product-api | Both set, or neither |
| `REVENUECAT_WEBHOOK_SECRET` | product-api | Same value as the Authorization header set in the RevenueCat webhook settings. Without it every webhook returns 401 |
| `DEXTER_FIXTURE_MODE` | dexter-worker | `false` |
| One LLM key: `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`, with the matching model variable and `DEXTER_PROVIDER_ORDER` | dexter-worker | Dexter refuses to start live without at least one usable provider. Provider and budget are an owner decision |
| `DATA_OPENBB_FIXTURE_MODE` | data-openbb | `false` |
| `INSTALL_LIVE_OPENBB` | data-openbb (build arg) | `true`, or the live OpenBB client is not installed in the image |
| `SEC_USER_AGENT` | data-openbb | A real contact string, as SEC EDGAR requires |
| Market data key(s): `FMP_API_KEY`, `POLYGON_API_KEY`, `ALPHA_VANTAGE_API_KEY` | data-openbb | Only the provider(s) the owner selects. The price data provider is an open decision |
| `NEWS_INGEST_FIXTURE_MODE` | news-ingest | `false` |
| `SCHEDULER_TEST_MODE` | scheduler | `false` (default) |

### Optional

`SENTRY_DSN`, `SENTIMENT_FRED_API_KEY` (macro stress inputs), `PULSE_LLM_EDITORIAL_ENABLED`, `EXASEARCH_API_KEY`, `PERPLEXITY_API_KEY`, `TAVILY_API_KEY`, `LANGSMITH_*`, `MARKET_PULSE_TICKERS`, the `SCHEDULER_*_TIME_LOCAL` values listed in compose.

### Known gap: variables the code reads but `docker-compose.yml` does not pass

Setting these in `.env` has **no effect** today, because compose lists each container variable by name:

- product-api: `CORS_ALLOWED_ORIGINS`, `EMAIL_PROVIDER_MODE`, `EMAIL_RESEND_API_KEY`, `EMAIL_RESEND_API_BASE_URL`, `EMAIL_FROM_ADDRESS`, `OIDC_GOOGLE_*`, `ARTIFACT_STORE_MODE`, `ARTIFACT_S3_*`, `ARTIFACT_REQUIRE_DURABLE`, `AUTH_RATE_LIMIT_*`, `AUTH_LOCKOUT_*`, `BCRYPT_COST`, `MAX_JSON_BODY_BYTES`, `DEEP_DIVE_REUSE_FRESHNESS_HOURS`, `ADMIN_BOOTSTRAP_*` (disabled in production anyway).
- dexter-worker: `DEXTER_TOOLS_ENABLED` and the other `DEXTER_*_TOOL_*` flags, `DEXTER_TOOL_*`, `DEXTER_PROMPT_MANIFEST_PATH`, `LAST30DAYS_*`, `LANGSMITH_*_PROMPT`, `OPENROUTER_APP_TITLE`, `OPENROUTER_HTTP_REFERER`, `SENTIMENT_YAHOO_BASE_URL`.
- scheduler: `SCHEDULER_MACRO_STRESS_TIME_LOCAL`, `SCHEDULER_CALENDAR_SYNC_TIME_LOCAL`, `SCHEDULER_EARNINGS_PREVIEW_TIME_LOCAL`, `SCHEDULER_CONTRARIAN_EVAL_TIME_LOCAL`, `SCHEDULER_WEEKLY_DIGEST_TIME_LOCAL`, `SCHEDULER_OFFICIAL_SOURCE_TICKERS`, `SCHEDULER_WAR_ROOM_DISPATCH_ROUTE`.
- data-openbb: `YFINANCE_RATE_LIMIT_PER_MINUTE`, `FMP_RATE_LIMIT_PER_MINUTE`.

`EMAIL_*` is also missing from `.env.example`. The code defaults apply (email `stub`, artifacts on host disk, Google sign-in off).

### Known blocker: new accounts cannot verify in production

Login requires a verified email. Registration returns the verification token only when `AUTH_EXPOSE_VERIFICATION_TOKEN=true`, which production forbids. No code path emails the token (the email notifier sends only the weekly digest). The Android app has no Google sign-in screen. Result: a new user cannot sign up from the app in production.

Until this is fixed, verify the proof account by hand, on the host:

```bash
cd "$PROD_REPO_DIR"
docker compose exec -T postgres psql -U postgres -d thesis \
  -c "update users set verified_at = now() where email = 'proof-account@your-domain' and verified_at is null;"
```

Record in PROOF.md that the account was verified by SQL. This is a workaround for the proof only, not a launch fix.

## 3. Deploy and check live mode

1. GitHub > Actions > `deploy-production` > Run workflow. `ref` = the CI-green SHA, `mode` = `remote`. Approve the environment. Save the run URL.
2. On the host, confirm the deployed SHA and container state:

   ```bash
   cd "$PROD_REPO_DIR"
   git rev-parse HEAD
   docker compose ps
   ```

3. Run the health script **on the host** (all ports are local there). It needs Node 18 or later. If the host has no Node, run it on your machine through an SSH tunnel for ports 3001-3005 instead.

   ```bash
   cd "$PROD_REPO_DIR"
   node scripts/deploy/launch-proof-health.mjs
   ```

   It prints one line per service and writes `Project Note/Launch-Proof/evidence/<date>/health-<time>Z.json`. Exit code 0 means every service is healthy **and** live:

   | Service | Live when the `/health` response has |
   |---|---|
   | product-api | `modes.push = "fcm"` and `modes.email = "resend"` |
   | dexter-worker | `fixture_mode: false` |
   | data-openbb | `fixture_mode: false` |
   | news-ingest | `fixture_mode: false` |
   | scheduler | `mode: "scheduled"` |

   Because of the compose gap above, product-api reports `email = "stub"` today. The script then reports product-api as `fixture` and the verdict as FAIL. Record this as a known gap, or fix the compose gap first. Every other service must show `live`.

   Copy the evidence file to your machine (`scp`) and commit it.

4. If a service is not healthy, read its startup error: `docker compose logs --tail=100 <service>`. Most failures are the production config checks listed in section 2.

## 4. One Deep Dive, end to end

Run on the host. Set these in the shell first (do not save them in files):

```bash
API=http://127.0.0.1:3001
EMAIL='proof-account@your-domain'
read -rs PASSWORD
TOKEN=$(curl -fsS -X POST "$API/auth/login" -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')
```

1. Submit: `curl -fsS -X POST "$API/jobs" -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"ticker":"MSFT"}'`. Save `job_id`.
2. Poll until `status` is `completed` (a few minutes): `curl -fsS -H "authorization: Bearer $TOKEN" "$API/jobs/<job_id>"`. Save `report_id`.
3. Fetch and check that the memo was written live:

   ```bash
   curl -fsS -H "authorization: Bearer $TOKEN" "$API/reports/<report_id>" > deep-dive-MSFT.json
   python3 -c 'import json; r=json.load(open("deep-dive-MSFT.json")); print("memo:", r["investment_memo"]["generation_mode"], "due_diligence:", r["due_diligence"]["generation_mode"])'
   ```

   Pass: both are `live_prompt`. `deterministic_fixture` means fixture mode. `fallback` means the LLM call failed and needs a look at `docker compose logs dexter-worker`.
4. Open the same report in the Android app (test-track build). Take a screenshot.

Evidence: `deep-dive-MSFT.json`, the poll output with timestamps, the screenshot.

## 5. One Pulse and one push

The Pulse job sends a `market_pulse_ready` push to every user with a registered device. Do the device step first.

1. On the test phone, install the test-track build, sign in with the proof account, and allow notifications. The app registers its FCM token (`POST /notifications/device-token`). Check it on the host:

   ```bash
   docker compose exec -T postgres psql -U postgres -d thesis \
     -c "select platform, created_at, invalidated_at from user_devices order by created_at desc limit 3;"
   ```

2. Dispatch a Pulse:

   ```bash
   curl -fsS -X POST "$API/internal/pulse/dispatch" -H 'content-type: application/json' \
     -H "x-internal-token: $INTERNAL_WORKER_TOKEN" -d '{}'
   ```

   Save `job.job_id`. A Pulse job has no owner, so `GET /jobs/<id>` returns 404 for it. Poll the database until `status` is `completed`:

   ```bash
   docker compose exec -T postgres psql -U postgres -d thesis \
     -c "select status, completed_at, error_message from jobs where id = '<job_id>';"
   ```
3. Fetch it: `curl -fsS -H "authorization: Bearer $TOKEN" "$API/pulse/latest" > pulse-latest.json`. Check that the date is today and the market data is current (compare one price with a public quote).
4. The phone shows the Pulse notification. Take a screenshot. Tap it; the app opens the Pulse.
5. Confirm delivery on the server side:

   ```bash
   docker compose exec -T postgres psql -U postgres -d thesis -c \
     "select created_at, payload->>'provider' as provider, payload->>'delivered' as delivered, payload->>'failed' as failed
      from audit_events where event_type = 'market_pulse.push_delivery' order by created_at desc limit 1;"
   ```

   Pass: `provider = fcm`, `delivered >= 1`, `failed = 0`.

Evidence: `pulse-latest.json`, the SQL output, the notification screenshot.

## 6. Play test track: purchase, renewal, cancel

Preconditions: the proof Google account is a license tester in Play Console; the subscription product and the RevenueCat entitlement exist; the RevenueCat webhook points to `https://<api-host>/v1/webhooks/revenuecat` with the Authorization value equal to `REVENUECAT_WEBHOOK_SECRET`.

Play test subscriptions renew fast (a monthly plan renews about every 5 minutes, up to 6 times, then expires). Use that to see renewals in one session.

| Step | Action | Pass when |
|---|---|---|
| 6.1 Purchase | In the app, open the paywall, buy the subscription with the test card | App shows Pro. `GET /v1/user/profile` shows tier `PRO` |
| 6.2 Webhook | Run the SQL below | Row with `INITIAL_PURCHASE`, tier `PRO` |
| 6.3 Renewal | Wait about 5 minutes, run the SQL again | Row with `RENEWAL`, `billing_period_end` moved forward |
| 6.4 Cancel | Play Store > Payments and subscriptions > Subscriptions > Cancel | Row with `CANCELLATION`, tier still `PRO` until period end |
| 6.5 Expire | Wait for the period end | Row with `EXPIRATION`, tier `FREE`. App shows Free |
| 6.6 Fallback | In the app, trigger restore or reopen it (calls `POST /v1/user/sync-tier`) | Tier matches RevenueCat |

```bash
docker compose exec -T postgres psql -U postgres -d thesis -c \
  "select created_at, payload->>'event_type' as event, payload->>'tier' as tier, payload->>'billing_period_end' as period_end
   from audit_events where event_type = 'subscription.webhook_processed' order by created_at desc limit 10;"
```

If no rows appear: in the RevenueCat dashboard, open the webhook delivery log. A 401 means the Authorization value does not match `REVENUECAT_WEBHOOK_SECRET`. A 202 `user_not_found` means the app did not log in to RevenueCat with the Product API user id.

Evidence: SQL output after each step, screenshots of the paywall, the Pro state and the Free state, and the RevenueCat customer page.

## 7. Sign-off

Fill in `PROOF.md` and commit the evidence folder. Then the owner changes the roadmap status to `Done` and links the folder.

### PROOF.md template

```markdown
# Launch proof <YYYY-MM-DD>

Owner: Razvan
Deployed SHA: <sha>   CI run: <url>   Deploy run: <url>
API host: https://<api-host>

| # | Check | Result | Evidence file |
|---|---|---|---|
| 1 | CI green on deployed SHA | pass/fail | |
| 3 | All services healthy and live (script verdict) | pass/fail | health-<time>Z.json |
| 4 | Deep Dive MSFT, generation_mode live_prompt | pass/fail | deep-dive-MSFT.json |
| 5 | Pulse generated with current data | pass/fail | pulse-latest.json |
| 5 | Push delivered via FCM and seen on phone | pass/fail | |
| 6.1-6.2 | Play test purchase, INITIAL_PURCHASE webhook, tier PRO | pass/fail | |
| 6.3 | Renewal webhook | pass/fail | |
| 6.4-6.5 | Cancel, then expire to FREE | pass/fail | |

Known gaps accepted for this run (for example: product-api email stub, account verified by SQL):

Owner sign-off: <name, date>
```
