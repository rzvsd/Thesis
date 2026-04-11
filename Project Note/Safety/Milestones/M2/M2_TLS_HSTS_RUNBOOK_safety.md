# Safety M2 TLS/HSTS Runbook

## Purpose

Document production TLS termination expectations and verify HSTS behavior.

## Termination Path

1. Public traffic terminates TLS at the production edge proxy/load balancer.
2. Edge forwards traffic to `product-api` over private network.
3. `product-api` must return strict transport security in production mode.

## Required Headers (HTTPS response)

- `strict-transport-security: max-age=31536000; includeSubDomains`
- Existing M1 security headers remain present.

## Verification Steps

1. Confirm production edge endpoint resolves over HTTPS:
   - `curl -I https://<production-api-domain>/health`
2. Verify HSTS header exists and matches policy:
   - `strict-transport-security: max-age=31536000; includeSubDomains`
3. Verify HTTP endpoint redirects to HTTPS at edge (if HTTP listener exists):
   - `curl -I http://<production-api-domain>/health`
4. Verify app-level production behavior in code path:
   - `node --test --test-concurrency=1 dist/apps/product-api/tests/safety-m2-runtime.test.js`

## Pass Criteria

1. Production HTTPS endpoint returns HSTS header with expected policy.
2. No public endpoint serves plaintext API traffic without redirect policy.
3. App-level production HSTS test passes in CI/local verification.

## Current Status (2026-04-11)

- App-level production HSTS test: pass.
- Deployed edge verification path documented; execute steps 1-3 when VPS/edge endpoint is available.
