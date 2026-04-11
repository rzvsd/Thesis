# Safety M4 Smoke Plan

## Purpose

Prove security controls remain enforced by tests and CI.

## Steps

1. Run security integration tests (auth, IDOR, expiry, oversized payload).
2. Run full typecheck + test.
3. Verify CI includes audit, secret scan, and SAST steps.
4. Validate startup fails under insecure production config settings.

## Evidence

- Test and CI logs
- Startup guard proof in `Milestones/M4/evidence/`
