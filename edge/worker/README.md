# Thesis front door (Cloudflare Worker)

This small program is the app's single front door (DECISIONS D2). It runs on
Cloudflare's free plan at
`https://thesis-front-door.<your-subdomain>.workers.dev` and forwards every
request to the Supabase `api` function. It also calls `GET /health?db=1` once a
day so the free Supabase project does not pause (H11). Design and header rules:
`docs/rebuild/M1-worker.md`.

You need Node.js (for `npx`). Nothing to install in this folder: the Worker has
no dependencies. Every command below runs from this folder (`edge/worker`).

## First deploy

1. Create a free account at https://dash.cloudflare.com/sign-up. No card is
   needed for the free plan.
2. Log in from your computer. A browser window opens; click Allow:
   ```
   npx wrangler@4.155.0 login
   ```
3. Deploy:
   ```
   npx wrangler@4.155.0 deploy
   ```
   The first time, wrangler may ask you to pick your account and to choose a
   `workers.dev` subdomain. Any name is fine.
4. Wrangler prints the address, for example
   `https://thesis-front-door.<your-subdomain>.workers.dev`. Write it down. This
   is the app's API base URL (`PUBLIC_API_BASE_URL` in the api, and
   `-PAPI_BASE_URL=` for a debug APK build).
5. Check it:
   ```
   curl https://thesis-front-door.<your-subdomain>.workers.dev/health
   ```
   You should see the api's health JSON.

## Point a test copy at a preview function

Use a different Worker name so production is not touched:

```
npx wrangler@4.155.0 deploy --name thesis-front-door-m1 --var API_FUNCTION:api-m1
```

This gives a second address,
`https://thesis-front-door-m1.<your-subdomain>.workers.dev`, that talks to
`api-m1`. Delete it when done:
`npx wrangler@4.155.0 delete --name thesis-front-door-m1`.

Do not run `deploy --var API_FUNCTION:api-m1` without `--name`: that would point
production at the preview.

## Roll back

- See past versions: `npx wrangler@4.155.0 deployments list`
- Go back to the previous version: `npx wrangler@4.155.0 rollback` (or pass a
  version id from the list).
- Or in the dashboard: Workers & Pages, `thesis-front-door`, Deployments, pick a
  version, Rollback.

## Logs

`npx wrangler@4.155.0 tail` shows live requests and the daily `keep_alive` line
with its status.

## Optional: edge token

If the lead turns on the edge check in the api, set the same random value in
both places:

```
npx wrangler@4.155.0 secret put EDGE_TOKEN
```

The Worker then sends it as `x-thesis-edge-token`. Never put it in
`wrangler.toml`.

## Cost

Free. On the Workers free plan (from my knowledge as of late 2026; check
https://developers.cloudflare.com/workers/platform/limits/ before relying on
it):

- 100,000 requests a day per account; above that, requests fail until the next
  day (no bill).
- 10 ms CPU per request. Forwarding uses far less; waiting on Supabase does not
  count.
- 5 cron triggers per account. This Worker uses one.
- The `workers.dev` address is free. A custom domain needs a domain you own; it
  becomes a route on this same Worker.
