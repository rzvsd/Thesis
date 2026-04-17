# M5 Smoke Plan (Phase 5)

**Milestone:** M5 - Cross-Name Intelligence  
**Owner:** Dexter Engineer + Scheduler Engineer + Product API Engineer + Mobile Engineer for existing-surface copy/context only
**Status:** Closed (PASS) on 2026-04-10; LangSmith prompt registration proof completed on 2026-04-16

---

## Purpose

Prove that relationship extraction and propagation deliver explainable second-order exceptions without flooding noise.

---

## Locked Decision Targets

1. Relationship extraction quality and provenance
2. Confidence-threshold suppression behavior at default `0.70`
3. Propagation alert explainability
4. Non-related name protection
5. Pro-only entitlement behavior
6. Existing Names/Inbox ownership with no new top-level mobile surface
7. Macro treated as an event/signal category that can propagate through sector edges, not as a relationship type

Locked interface names:

- Contract file: `packages/contracts/src/name-relationship.ts`
- Internal ingestion endpoint: `POST /internal/name-relationships/ingest`
- Internal propagation endpoint: `POST /internal/notifications/cross-name/evaluate`
- User query endpoint: `GET /v1/names/relationships`
- Alert notification type: `cross_name_propagation`
- Relationship types: `supplier`, `competitor`, `partner`, `sector`

---

## Preconditions

- M1 rule substrate is stable
- M4 alert ledger, routing, and Inbox behavior are stable
- Report ingestion and extraction path is operational
- Scheduler propagation lane is test-runnable

---

## Smoke Steps

1. Seed relationship graph from deterministic report fixtures.
2. Trigger source event and run propagation evaluation.
3. Confirm only qualified related names receive propagated exceptions.
4. Confirm alert text includes source, relationship type, and reasoning.
5. Validate default `0.70` behavior, then apply stricter threshold (for example `0.85`) and confirm additional suppression.
6. Confirm unrelated names receive no propagation alert.
7. Confirm Free users receive no cross-name propagation alert while Pro users do.
8. Confirm macro-origin fixture propagates only through qualifying sector edges.
9. Confirm existing Names/Inbox surfaces remain visually consistent if mobile rendering is touched.

---

## Evidence Required For Closeout

- Extraction fixture proof
- Relationship persistence proof
- Propagation evaluator proof
- Confidence-threshold test proof for default and stricter override
- Alert-ledger propagation proof
- Pro-only entitlement proof
- Macro-as-signal proof through sector edge
- Names/Inbox visual regression proof if mobile is touched

---

## Pass/Fail Record

| Step | Result | Evidence Path | Notes |
|---|---|---|---|
| 1 | PASS | `apps/dexter-worker/tests/pipeline.test.ts`, `apps/product-api/tests/ph5-m5-cross-name.test.ts`, `Project Note/Phase5/Milestones/M5/evidence/2026-04-09_m5_execution_log.md` | Dexter GRAPH fixture extracted report-backed relationships; Deep Dive completion fixture persisted `name_relationships` |
| 2 | PASS | `apps/product-api/tests/ph5-m5-cross-name.test.ts` | Source events evaluate through `/internal/notifications/cross-name/evaluate` |
| 3 | PASS | `apps/product-api/tests/ph5-m5-cross-name.test.ts` | Pro followed target received propagated exception; Free candidate suppressed |
| 4 | PASS | `apps/product-api/tests/ph5-m5-cross-name.test.ts` | Alert ledger context includes source, affected ticker, relationship type, confidence, and reason |
| 5 | PASS | `apps/product-api/tests/ph5-m5-cross-name.test.ts` | Default `0.70` and stricter `0.80` override suppression validated |
| 6 | PASS | `apps/product-api/tests/ph5-m5-cross-name.test.ts` | Unrelated AMZN source event emitted no alert |
| 7 | PASS | `apps/product-api/tests/ph5-m5-cross-name.test.ts` | Free user had matching edge and device token but no propagated alert |
| 8 | PASS | `apps/product-api/tests/ph5-m5-cross-name.test.ts` | Macro propagated through QQQ sector edge only; macro on supplier edge emitted no alert |
| 9 | N/A | `Project Note/Phase5/Milestones/M5/evidence/2026-04-09_m5_execution_log.md` | Mobile was not touched; Names/Inbox ownership preserved through server route/context |

LangSmith closeout addendum (2026-04-16):
- Remote prompt registration executed successfully.
- Evidence: `Project Note/Phase5/Milestones/M5/evidence/2026-04-16_langsmith_prompt_push.json`.
