# Thesis - Safety Milestones

**Version:** 1.0  
**Status:** Active  
**Last Revised:** 2026-04-14

---

## Milestone Index

| # | Name | Output |
|---|---|---|
| M1 | API Perimeter Hardening | Timing-safe internal auth checks, body limit, headers, strict CORS |
| M2 | Runtime and Infra Hardening | Non-root containers, closed DB/Redis exposure, TLS posture lock |
| M3 | Auth Abuse Resistance | Auth rate-limit buckets, timed lockout, refresh rotation + reuse handling |
| M4 | Verification and CI Security Gates | Security integration tests + CI audit/secret/sast controls |
| M5 | Post-Core Enhancements (TBD) | Google OIDC and `server.ts` modularization |

---

# M1 - API Perimeter Hardening

## Acceptance Criteria

- [x] Internal token comparison is timing-safe
- [x] JSON body size is capped and oversized payloads return `413`
- [x] Security headers are set for API responses
- [x] CORS policy is explicit and allowlist-based (no wildcard)

## Smoke Test

```text
1. Call internal endpoint with invalid token and compare response timing does not leak obvious length/char behavior
2. Send oversized JSON payload and verify 413
3. Verify security headers on representative API responses
4. Verify preflight and origin allowlist behavior
```

---

# M2 - Runtime and Infra Hardening

## Acceptance Criteria

- [x] Product API container runs as non-root
- [x] Production compose/runtime does not expose Redis/Postgres publicly
- [x] Redis auth posture is locked for production runtime
- [x] TLS/HSTS termination path is documented and verified (local production profile)

## Smoke Test

```text
1. Inspect running container user
2. Validate compose/runtime ports and host bindings
3. Validate Redis runtime auth config in production profile
4. Validate TLS path and HSTS behavior on production endpoint
```

---

# M3 - Auth Abuse Resistance

## Acceptance Criteria

- [x] Auth endpoints have stricter route-specific rate limits
- [x] Timed account lockout is enforced (`10 failures / 15 min`)
- [x] `/auth/refresh` rotates refresh token/session every use
- [x] Refresh reuse detection revokes token family safely

## Smoke Test

```text
1. Trigger auth rate limits and verify threshold behavior
2. Trigger lockout and verify auto-unlock window
3. Refresh once and verify old token is invalid
4. Reuse old refresh token and verify family/session revocation behavior
```

---

# M4 - Verification and CI Security Gates

## Acceptance Criteria

- [x] Security integration tests exist for auth/IDOR/oversize/token expiry paths
- [x] CI runs vulnerability audit gate
- [x] CI runs secret scan and SAST baseline
- [x] Production startup fails on insecure config values

## Smoke Test

```text
1. Run security integration suite
2. Run full typecheck/test pipeline
3. Verify CI gate commands are present and passing
4. Verify startup guard rejects insecure production config
```

---

# M5 - Post-Core Enhancements (TBD)

## Start Gate (Mandatory)

- [x] M1 closed
- [x] M2 closed
- [x] M3 closed
- [x] M4 closed

## Scope

- [ ] Google OIDC sign-in/sign-up with strict account-linking controls
- [ ] `server.ts` modular extraction into domain route modules with no behavior regressions

## Notes

M5 is intentionally deferred until core hardening is delivered and stable.
