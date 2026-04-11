# Safety M1 Smoke Plan

## Purpose

Prove API perimeter protections are active and deterministic.

## Steps

1. Verify invalid internal token path behaves correctly with timing-safe compare implementation.
2. Submit oversized JSON payload and confirm `413 Payload Too Large`.
3. Verify required response security headers on representative endpoints.
4. Verify CORS preflight and allowlist behavior for approved and rejected origins.

## Evidence

- API test output
- Manual curl/httpie command output
- Notes saved in `Milestones/M1/evidence/`
