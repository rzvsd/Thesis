# AGENTS.md - Phase 2 M8 Fear & Greed UI and Weekly Digest
**Milestone:** Phase 2 M8 - Fear & Greed UI and Weekly Digest  
**Inherits from:** Root `AGENTS.md`, then `Project Note/Phase2/ph2_AGENTS.md` - read both first.  
**Location:** `Project Note/Phase2/Milestones/M8/M8_MILESTONE_AGENTS_ph2.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | Phase 2 M8 - Fear & Greed UI and Weekly Digest |
| **Linear Project** | Phase 2 M8 - Fear & Greed UI and Weekly Digest |
| **Owner** | Mobile Engineer + Product Lead |
| **Status** | Completed |
| **Depends on** | Phase 2 M3 closed, Phase 2 M6 closed |

---

## Gated Pre-Conditions

These decisions must be resolved before coding starts.

| # | Decision | Current Status | Owner | Needed By |
|---|---|---|---|---|
| G1 | Weekly digest delivery for M8 is in-app surface plus FCM push entry path. No email client dependency in M8. | **RESOLVED** | Product Lead | Before coding |
| G2 | Fear and Greed data source remains the M3 sentiment endpoints (`/v1/sentiment/current`, `/v1/sentiment/history`). | **RESOLVED** | Product Lead + API Engineer | Before coding |
| G3 | M8 does not change platform ownership boundaries; mobile consumes Product API only. | **RESOLVED** | Product Lead | Before coding |
| G4 | Dashboard and Today-card placement are in mobile surfaces only; no architecture rewrite. | **RESOLVED** | Mobile Engineer + Product Lead | Before coding |
| G5 | Visualization stack lock: use **Vico** for trend chart and a small **Compose Canvas** gauge. No custom charting framework. | **RESOLVED** | Mobile Engineer + Product Lead | Before coding |

**Rule:** M8 is a presentation milestone on top of M3 outputs. It is not a scoring-engine rewrite.

---

## 1. What This Milestone Is Building

M8 adds a user-facing sentiment experience:
- a Fear and Greed dashboard screen
- sub-score visibility and trend context
- a Today-tab summary card
- weekly digest rendering in-app and push entry behavior

This milestone turns M3 sentiment data into clear daily/weekly product surfaces.

**Plain English summary for non-technical audit:**  
M3 calculates the score. M8 makes it understandable and useful for real users every day.

---

## 2. Read These Files First

### Phase 1 docs

- `Project Note/Phase1/BLUEBOOK cld.md`
- `Project Note/Phase1/MILESTONES.md`
- `Project Note/Phase1/PRD.md`

### Phase 2 docs

- `Project Note/Phase2/ph2_AGENTS.md`
- `Project Note/Phase2/ph2_BLUEBOOK.md`
- `Project Note/Phase2/ph2_MILESTONES.md` (M8 section)
- `Project Note/Phase2/ph2_PRD.md`
- `Project Note/Phase2/Milestones/M3/M3_MILESTONE_AGENTS_ph2.md`
- `Project Note/Phase2/Milestones/M6/M6_MILESTONE_AGENTS_ph2.md`

### Code surfaces

- `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/`
- `apps/mobile/android/app/src/main/java/com/thesis/mobile/network/ProductApiClient.kt`
- `apps/product-api/src/server.ts` (read-only unless a real blocker is proven)
- `packages/contracts/src/fear-greed-snapshot.ts`

---

## 3. Scope - What Is In

- [x] Fear and Greed dashboard is accessible from mobile navigation
- [x] Gauge shows score and correct label band (Extreme Fear/Fear/Neutral/Greed/Extreme Greed) using Compose Canvas implementation
- [x] Historical trend chart renders expected range from M3 history endpoint using Vico
- [x] Sub-input breakdown is visible and readable
- [x] Weekly digest content renders correctly in-app
- [x] Push deep-link opens weekly digest correctly
- [x] Fear and Greed surfaces are available to all users
- [x] Today tab shows Fear and Greed summary card with score and direction
- [x] Phase 1/Phase 2 regressions remain green (navigation, pulse, deep dive routing)

Full acceptance source: `Project Note/Phase2/ph2_MILESTONES.md -> M8`.

---

## 4. Scope - What Is Out

| Out of scope | Reason |
|---|---|
| Recomputing or redesigning Fear and Greed math | M3 already owns scoring |
| New paid data providers | Not required for M8 |
| Email digest system | Explicitly out for M8 |
| Custom charting framework | Out of scope; use Vico + simple Compose Canvas gauge only |
| Deep Dive model rewrite | Different milestone |
| Offline cache and release hardening | M9 scope |

---

## 5. Services You Are Working In

| Service | Folder | What is being changed |
|---|---|---|
| Mobile app | `apps/mobile/` | Dashboard UI, chart/gauge presentation, Today card, digest screens/routing |
| Product API | `apps/product-api/` | Minimal only if route/shape bug blocks M8 rendering |
| Contracts | `packages/contracts/` | Read-only by default; only adjust if proven schema mismatch |
| Observability | `packages/observability/` | Event logging for dashboard opens and digest opens |

---

## 6. Contracts You Are Touching

| Contract | Change Type | File |
|---|---|---|
| `FearGreedSnapshot` | Read-only by default | `packages/contracts/src/fear-greed-snapshot.ts` |
| Digest payload contracts | Read-only by default | Existing notification/digest shapes |

Rule: do not drift contracts for UI convenience.

---

## 7. Linear Ticket Rules for This Milestone

**Project:** Phase 2 M8 - Fear and Greed UI and Weekly Digest

**Naming:**
```
[PH2-M8] What is being built
[PH2-M8][BUG] What is broken
[PH2-M8][SPIKE] What is being investigated
```

| Ticket | Acceptance mapping |
|---|---|
| `[PH2-M8] Fear and Greed dashboard access` | Dashboard reachable |
| `[PH2-M8] Gauge and label accuracy` | Score and label correctness |
| `[PH2-M8] Historical trend chart` | History rendering |
| `[PH2-M8] Sub-score breakdown visibility` | Input breakdown rendering |
| `[PH2-M8] Weekly digest in-app rendering` | Digest content in-app |
| `[PH2-M8] Weekly digest push deep-link` | Push open behavior |
| `[PH2-M8] Today card integration` | Today summary card |
| `[PH2-M8] M8 closeout` | Smoke + DoD completion |

Never close without test evidence.

---

## 8. Logging and Observability

| Event | Level | Fields |
|---|---|---|
| Dashboard opened | INFO | `{ service, message, user_id_hash, timestamp }` |
| Sentiment card viewed | INFO | `{ service, score, label, timestamp }` |
| Digest opened from push | INFO | `{ service, route_target, timestamp }` |
| Sentiment render degraded | WARN | `{ service, missing_inputs_count, timestamp }` |
| Dashboard render failure | ERROR | `{ service, error_message, timestamp }` |

No PII, no tokens.

---

## 9. Error Handling

| Failure | Expected behavior | Surface |
|---|---|---|
| Missing sentiment history | Show empty-state guidance, no crash | UI |
| Partial sub-scores | Render available items and a clear missing-data note | UI |
| Push deep-link mismatch | Fallback to Today tab and log warning | UI + logs |
| Chart fails to render | Show score + labels fallback, no blank screen | UI |

---

## 10. Testing Requirements

- [x] Dashboard route opens successfully
- [x] Gauge label bands are correct for sample scores
- [x] Historical trend chart renders 7/30/90-day ranges (or approved range set) through Vico
- [x] Sub-score list shows available inputs and missing-input behavior
- [x] Weekly digest page renders in-app content correctly
- [x] Push opens digest destination correctly
- [x] Today card shows current score and direction
- [x] Regression: Pulse still works
- [x] Regression: Deep Dive entry and history remain reachable
- [x] Real-device smoke completed
- [x] No custom chart engine code introduced (only Vico chart + Compose Canvas gauge)

---

## 11. Rollback Plan

1. Revert mobile dashboard and digest UI commits.
2. Revert Today sentiment card integration.
3. Keep M3 backend intact (no data loss risk from M8 UI rollback).
4. Re-run baseline navigation/pulse smoke.

---

## 12. Definition of Done

M8 is done only when all below are true:

- [x] All M8 acceptance criteria in `ph2_MILESTONES.md` are satisfied
- [x] Smoke test completed and logged in this file
- [x] Real-device verification complete
- [x] Quality checks pass (`lint`, relevant tests, Android build)
- [x] Linear tickets closed or explicitly deferred
- [x] Owner sign-off
- [x] Engineering Lead countersign

---

## 13. Smoke Test Log

```text
Date: 2026-04-01
Run by: Codex agent
Environment: Local Docker + Android physical device + Maestro
Device: Samsung SM-S928B (serial: R3CXA03J3LH)
Result: PASS

Step 1 - Open dashboard from app navigation:                     PASS
Step 2 - Verify gauge score/label correctness:                  PASS
Step 3 - Verify historical chart loads expected range:          PASS
Step 4 - Verify sub-score breakdown readability:                PASS
Step 5 - Open weekly digest in-app view:                        PASS
Step 6 - Open weekly digest from push deep-link:                PASS
Step 7 - Verify Today card score and direction:                 PASS
Step 8 - Regression check Pulse and Deep Dive routing:          PASS (Deep Dive entry/history route reachable; live Deep Dive generation remains separately gated by provider key)
Step 9 - Run quality checks:                                    PASS (`pnpm lint`, `pnpm typecheck`, `pnpm --filter @thesis/product-api test`, Android `:app:assembleDebug`)

Notes:
- Maestro core M8 smoke: `qa/maestro/output/2026-04-01T11-03-54-608Z/summary.json`
- Weekly digest deep-link smoke: `qa/maestro/flows/m8_weekly_digest_deeplink.yaml` (pass on physical device)
- `qa:maestro:prepare` now degrades gracefully if Deep Dive seed is unavailable; M8 smoke remains executable.
```

---

## 14. Known Issues and Deferrals

| Issue | Why deferred | Linear ticket | Target milestone |
|---|---|---|---|
| Email digest delivery | Out of M8 scope | TBD | Future milestone |
| Advanced chart analytics overlays | Not required for M8 acceptance | TBD | Future milestone |
| Deep Dive live seed in Maestro prep | Missing `FINANCIAL_DATASETS_API_KEY` when `DEXTER_FIXTURE_MODE=false`; not required to validate M8 sentiment/digest UI | TBD | M9+ |

---

## 15. Decisions Made During This Milestone

| Decision | Outcome | ADR required |
|---|---|---|
| Digest client target | In-app digest + push deep-link | No |
| Fear and Greed scoring ownership | Remains M3 backend | No |
| Contract changes for M8 | Avoid unless blocker proven | No |
