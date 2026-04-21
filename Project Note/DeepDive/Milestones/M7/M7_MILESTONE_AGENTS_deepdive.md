# M7 AGENTS - End-to-End Quality and Device Proof

**Milestone:** Deep Dive Revamp M7 - End-to-End Quality and Device Proof
**Status:** Passed
**Inherits from:** Root `AGENTS.md`, `Project Note/DeepDive/DeepDive_AGENTS.md`

---

## Identity

| Field | Value |
|---|---|
| Owner | Engineering Lead + Product Lead |
| Depends on | M0-M6 plus M5.2 closed |
| Services | Full stack and mobile |
| Contracts | Full report artifact |

---

## Scope

- [x] Run full relevant quality checks
- [x] Start full local stack
- [x] Run Deep Dive end to end
- [x] Export PDF
- [x] Verify mobile reader
- [x] Verify old report fallback
- [x] Record closeout evidence
- [x] Run owner-level acceptance checklist from `DEEPDIVE_TEST_MATRIX.md`

## Out Of Scope

- New feature development
- Provider upgrades
- Brokerage/portfolio extensions

## Required Tests

- Workspace lint/typecheck as applicable
- Contract/Product API/Dexter tests
- Android tests
- PDF render inspection
- Physical-device or Maestro smoke
- Owner acceptance checklist

## Definition Of Done

- [x] All prior milestone acceptance evidence exists
- [x] Full Deep Dive flow passes
- [x] PDF proof passes
- [x] Device proof passes
- [x] `DEEPDIVE_TEST_MATRIX.md` owner tests pass
- [x] `DeepDive_ACCEPTANCE.md` is updated

## Verification Snapshot

- Relevant Deep Dive quality checks passed:
  - `corepack pnpm --filter @thesis/contracts lint`
  - `corepack pnpm --filter @thesis/contracts typecheck`
  - `corepack pnpm --filter @thesis/contracts test`
  - `corepack pnpm --filter @thesis/product-api lint`
  - `corepack pnpm --filter @thesis/product-api typecheck`
  - `corepack pnpm --filter @thesis/product-api test`
  - `corepack pnpm --filter @thesis/dexter-worker lint`
  - `corepack pnpm --filter @thesis/dexter-worker typecheck`
  - `corepack pnpm --filter @thesis/dexter-worker test`
  - `./gradlew.bat testDebugUnitTest`
  - `./gradlew.bat lintDebug`
- End-to-end local closeout run passed:
  - Product API started in memory-backed local mode.
  - Dexter fixture pipeline generated a structured `MSFT` Deep Dive artifact.
  - Product API completed job lifecycle, stored the report, returned history, and exported PDF.
  - Legacy fallback report remained retrievable and exportable.
- Follow-up live closeout run passed on 2026-04-21:
  - Product API started in memory-backed local mode.
  - Dexter generated a real live `MSFT` Deep Dive through OpenRouter `gpt-5.4-mini`.
  - Product API completed job lifecycle, stored the report, returned it to the signed-in user, and exported PDF.
  - Live proof artifacts were written to the M7 evidence folder.
- Device proof attached from the completed M6 physical-phone verification set.
- Owner-level acceptance checklist completed in M7 evidence with one explicit limitation note:
  - the phone proof still relies on the M6 seeded offline-reader verification path.
- Follow-up architecture fix completed on 2026-04-21:
  - Dexter live mode no longer requires `FINANCIAL_DATASETS_API_KEY`.
  - OpenRouter-first provider routing is implemented with Anthropic/OpenAI fallback support.
  - OpenRouter `gpt-5.4-mini` is now proven as the working live provider path for Deep Dive generation.
