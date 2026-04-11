# Thesis - Safety Bluebook

**Status:** Living Document  
**Last Revised:** 2026-04-11

This document translates the safety audit into architecture-safe control ownership.

---

## 1. Mission

Raise production security posture without changing Thesis core architecture.

---

## 2. Architecture Interpretation

- No new services are introduced for this phase.
- Hardening is applied inside existing boundaries.
- Controls must remain testable and observable.

---

## 3. Service Ownership

| Service | Safety Ownership |
|---|---|
| `apps/product-api` | API perimeter controls, auth hardening, session rotation, secure headers, CORS policy |
| `infra/docker-compose` and deploy config | Runtime isolation, port exposure controls, TLS posture documentation |
| `packages/contracts` | Additive typing only if auth/session payloads need extension |
| `apps/scheduler` | No new ownership unless required by auth/session event processing |
| `apps/mobile/android` | No mandatory auth redesign in core hardening; post-core Google auth lane only |

---

## 4. Control Doctrine

1. Exploitable-first: patch immediate attack paths first.
2. Deterministic behavior: lock thresholds and responses for abuse controls.
3. Fail closed in production for insecure config.
4. Security proof is required for closeout (not just code merged).

---

## 5. Deferred By Design

| Item | Reason |
|---|---|
| Large `server.ts` split | Maintainability value, not immediate exploit blocker |
| Google OIDC sign-in/sign-up | Product/auth enhancement after core perimeter hardening is stable |
| Email unlock flow | Higher UX/system overhead than timed lock for current phase |
