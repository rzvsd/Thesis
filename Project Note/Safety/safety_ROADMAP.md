# Thesis - Safety Roadmap

**Status:** Active  
**Last Revised:** 2026-04-11  
**Related Documents:** safety_BLUEBOOK.md, safety_MILESTONES.md, safety_PRD.md

---

## Sequence

```text
M1 API Perimeter Hardening
  -> M2 Runtime and Infra Hardening
  -> M3 Auth Abuse Resistance
  -> M4 Verification and CI Security Gates
  -> M5 Post-Core Enhancements (TBD)
```

---

## Why This Order

1. M1 closes direct API exploit paths first.
2. M2 reduces blast radius in runtime/deployment.
3. M3 hardens identity/session abuse handling.
4. M4 locks repeatable proof so controls stay enforced.
5. M5 opens only after core controls are stable.

---

## M5 Gate (Locked)

M5 must not start unless M1-M4 are all closed with smoke evidence.

M5 scope:
- Google OIDC sign-in/sign-up integration
- `server.ts` modularization for auditability

Both are explicitly post-core enhancements, not blockers for M1-M4 closure.
