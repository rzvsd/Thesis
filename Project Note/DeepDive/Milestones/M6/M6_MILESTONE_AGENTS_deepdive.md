# M6 AGENTS - Mobile Research Reader

**Milestone:** Deep Dive Revamp M6 - Mobile Research Reader
**Status:** Pending
**Inherits from:** Root `AGENTS.md`, `Project Note/DeepDive/DeepDive_AGENTS.md`

---

## Identity

| Field | Value |
|---|---|
| Owner | Android Engineer + Product Lead |
| Depends on | M1-M5 closed |
| Services | `apps/mobile/android`, `qa/maestro` |
| Contracts | Structured report artifact, offline cache fields |

---

## Scope

- [ ] Render executive reader from structured artifact
- [ ] Render financial quality and value discipline sections
- [ ] Render valuation, risks, evidence, PDF entry
- [ ] Preserve old report fallback
- [ ] Preserve offline cache round trip
- [ ] Preserve Thesis visual language
- [ ] Follow the mobile reader order in `DEEPDIVE_REPORT_TEMPLATE.md`

## Out Of Scope

- New root navigation
- Decorative charts unsupported by report data
- Replacing PDF artifact with mobile-only rendering

## Required Tests

- Android mapper tests
- Offline cache tests
- UI/unit tests where existing test shape supports it
- Maestro/device smoke
- M6 hard gates from `DEEPDIVE_TEST_MATRIX.md`

## Definition Of Done

- [ ] Phone reader feels coherent and serious
- [ ] Old reports still work
- [ ] Offline report opens
- [ ] Mobile reader satisfies `DEEPDIVE_REPORT_TEMPLATE.md`
- [ ] Smoke plan passes
