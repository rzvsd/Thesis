# M1 front door Worker

Code: `edge/worker/` (owner steps in its README). Decisions D2, H2, H11.

## What it does

- **Forward.** `https://<worker>/<path>?<query>` goes to
  `${API_ORIGIN}/functions/v1/${API_FUNCTION}/<path>?<query>`. Same method, body
  streamed, redirects not followed (3xx returns to the caller). `/` goes to the
  function root. A path that already starts with `/functions/v1/<API_FUNCTION>`
  is stripped once, not prefixed twice. Any other `/functions/v1/...` path gets
  a 404 `not_found` and never reaches Supabase.
- **Vars.** `API_ORIGIN` (default the Supabase project URL) and `API_FUNCTION`
  (`api`, or a preview `api-mN`; anything else falls back to `api`). Previews
  deploy as a separate Worker name (README).
- **Request headers.** Copied except hop-by-hop headers and `host`. Every
  incoming `x-thesis-*` header is dropped. The Worker sets `x-thesis-client-ip`
  from `cf-connecting-ip`, and `x-thesis-edge-token` when the optional
  `EDGE_TOKEN` Worker secret is set.
- **CORS.** OPTIONS passes through; the api answers it.
- **Errors.** If Supabase cannot be reached, 502
  `{ "error": "service_unavailable", "error_message": "..." }`. Upstream status
  codes (including 5xx) pass through unchanged.
- **Keep-alive (H11).** Cron `17 4 * * *` (04:17 UTC daily) calls
  `GET /functions/v1/<fn>/health?db=1`; logs status only.
- **No rate limits here.** They live in the api (`app.rate_limits`).

## HTML header contract (api -> Worker)

Supabase rewrites `text/html` to `text/plain` (and may add a sandboxing
`content-security-policy`) when there is no custom domain. So:

1. Every HTML response from the api sets
   `x-thesis-content-type: text/html; charset=utf-8` (`html()` in
   `api/features/web/html.ts` already does). The Worker copies it into
   `content-type`.
2. On a marked response, the Worker deletes `content-security-policy`, because
   it cannot tell Supabase's policy from the api's. **If the api wants a CSP on
   an HTML page, it must send it as `x-thesis-csp: <policy>`**; the Worker sets
   that as `content-security-policy`. The api may also send a plain
   `content-security-policy` (for direct calls); it is ignored through the
   Worker.
3. All other response headers pass through untouched (`cache-control`,
   `x-robots-tag`, `referrer-policy`, `x-content-type-options`,
   `x-frame-options`, `set-cookie`, CORS, `location`).
4. The Worker removes every `x-thesis-*` header before the browser sees the
   response.
5. Responses without `x-thesis-content-type` (JSON, PDF, etc.) are not changed
   at all.

## Client IP and trust

`_lib/store/rate_limit.ts` trusts `x-thesis-client-ip`. The Worker cannot stop
someone calling `https://<project>.supabase.co/functions/v1/api/...` directly
with a forged `x-thesis-client-ip` to dodge per-IP limits. Optional fix: set a
random `EDGE_TOKEN` secret on the Worker and as an api secret, and have the api
trust `x-thesis-client-ip` only when `x-thesis-edge-token` matches (else use
`x-forwarded-for`).
