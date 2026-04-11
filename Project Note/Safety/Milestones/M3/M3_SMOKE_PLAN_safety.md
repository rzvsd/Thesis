# Safety M3 Smoke Plan

## Purpose

Prove deterministic protection against brute force and refresh-token abuse.

## Steps

1. Hit auth endpoints past configured thresholds and verify route-specific rate limiting.
2. Trigger lockout by failed attempts and verify auto-unlock window behavior.
3. Perform refresh flow and verify old refresh token/session invalidation.
4. Reuse rotated-out token and verify token-family revocation path.

## Evidence

- Auth integration test output
- Manual flow logs in `Milestones/M3/evidence/`
