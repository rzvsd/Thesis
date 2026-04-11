# Thesis - Safety Phase

**"Security hardening without architectural drift."**

Status: Active  
Last Revised: 2026-04-11

This workstream turns the audit in `vibe_code_safety.md` into a controlled execution phase.

## What This Phase Covers

- Hardening of Product API perimeter controls
- Runtime and deployment security baseline
- Auth abuse resistance (rate limit, lockout, refresh rotation)
- Security CI gates and regression coverage

## What This Phase Does Not Cover (Now)

- Large `server.ts` modular refactor as a blocker
- Web-cookie auth migration patterns not required for Android-native auth
- Email-based account unlock workflow

## Milestones

| # | Name | Status |
|---|---|---|
| M1 | API Perimeter Hardening | Active |
| M2 | Runtime and Infra Hardening | Active |
| M3 | Auth Abuse Resistance | Active |
| M4 | Verification and CI Security Gates | Active |
| M5 | Post-Core Enhancements (Google auth + `server.ts` split) | TBD |

## Key Docs

- [safety_ROADMAP.md](./safety_ROADMAP.md)
- [safety_MILESTONES.md](./safety_MILESTONES.md)
- [safety_BLUEBOOK.md](./safety_BLUEBOOK.md)
- [safety_PRD.md](./safety_PRD.md)
- [safety_AGENTS.md](./safety_AGENTS.md)
- [vibe_code_safety.md](./vibe_code_safety.md)
