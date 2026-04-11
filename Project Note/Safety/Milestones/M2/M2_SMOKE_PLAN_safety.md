# Safety M2 Smoke Plan

## Purpose

Prove runtime blast-radius reduction and production network safety posture.

## Steps

1. Validate service containers run as non-root.
2. Validate Postgres and Redis are not publicly exposed in production profile.
3. Validate Redis production auth is enforced.
4. Validate TLS termination and HSTS behavior from deployed endpoint.

## Evidence

- Compose/runtime config snippets
- Port reachability checks
- Deployment verification notes in `Milestones/M2/evidence/`
