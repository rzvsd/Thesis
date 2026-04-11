# Thesis - Safety PRD

**Status:** Active  
**Owner:** Product Lead + Engineering Lead  
**Last Revised:** 2026-04-11

---

## 1. Product Outcome

Users should trust that Thesis protects accounts, sessions, and data paths by default.

Success means:
- lower exploitability of auth and API perimeter
- deterministic abuse controls
- auditable security checks in CI and smoke flows

---

## 2. Required Behaviors

### 2.1 API Perimeter

- Internal token checks are timing-safe.
- Oversized request payloads are rejected with `413`.
- Security headers are set on API responses.
- CORS is explicit and allowlist-based.

### 2.2 Runtime and Infra

- App containers run as non-root.
- Postgres/Redis are not publicly exposed in production topology.
- TLS termination and HSTS behavior are documented and verified.

### 2.3 Auth Abuse Resistance

- Auth routes use stricter rate limits than global API limits.
- Timed lockout is enforced (`10 failures / 15 min`).
- Refresh token/session rotates every refresh.
- Reuse detection revokes token family.

### 2.4 Verification

- Security integration tests exist for core abuse scenarios.
- CI includes dependency audit and secret/sast checks.
- Startup rejects insecure production config.

### 2.5 Post-Core TODO (M5)

- Google sign-in/sign-up (OIDC) with strict account linking.
- `server.ts` modular extraction for safer long-term auditing.

---

## 3. Non-Goals

- No new service creation.
- No UI redesign.
- No migration to browser cookie auth patterns as core requirement for this phase.
