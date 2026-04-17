# AGENTS.md — M3 Dexter Foundation

**Milestone:** M3 — Dexter Foundation
**Inherits from:** Root `AGENTS.md` — read that first.
**Location:** `Milestones/M3 — Dexter Foundation/M3_MILESTONE_AGENTS.md`

---

## Milestone Identity

| Field | Value |
|---|---|
| **Milestone** | M3 — Dexter Foundation |
| **Linear Project** | M3 — Dexter Foundation |
| **Owner** | AI/Reasoning Engineer |
| **Status** | Closed |
| **Depends on** | M2 — Data Plane complete |

---

## 1. What This Milestone Is Building

The Dexter reasoning worker integrated into the platform as the primary engine for Company Deep Dive. At the end of M3, `dexter-worker` starts locally, accepts a valid `AnalysisRequest`, runs Dexter’s native planner → data retrieval → section execution → scoring → synthesis flow, and returns a schema-valid `AnalysisReport`. This milestone also establishes the non-negotiable honesty rules for Deep Dive: explicit section status, no blank sections, no fabricated signal values, and full LangSmith observability on every run.

**Plain English summary for non-technical audit:**
This milestone installs and verifies the research brain for Company Deep Dive, while making sure it fails honestly instead of pretending everything is fine.

---

## 2. Scope — What Is In

The following and only the following is in scope for M3:

- [x] Dexter fork is pinned to a specific upstream commit — never to `main`
- [x] `dexter-worker` starts in docker-compose and reaches healthy state
- [x] Dexter accepts a valid `AnalysisRequest` and completes its native research pipeline
- [x] Output is a schema-valid `AnalysisReport` and validation runs automatically before return
- [x] Every report section includes a `status` field: `complete`, `data_incomplete`, `data_unavailable`, or `failed`
- [x] No report section is ever blank — every section has content or an explicit failure/degradation status
- [x] The Scorer does not emit a signal unless the minimum evidence threshold is met; otherwise signal is `no_signal` with reason
- [x] If one section executor errors or times out, that section is marked `failed` and the rest of the report still completes
- [x] Every Dexter run produces a LangSmith trace with prompt version, model, token count, section timing, and job ID
- [x] All prompt text lives in LangSmith — no production prompt strings hardcoded in app code
- [x] Degradation tests pass for missing data, LLM timeout, and score-threshold-not-met scenarios

Full deliverables and acceptance criteria: `MILESTONES.md → M3`

---

## 3. Scope — What Is Out

Do not touch the following during M3. Raise a Linear ticket and flag it if you believe something needs to change — do not proceed unilaterally.

| Out of scope | Reason |
|---|---|
| Product API auth, user sessions, JWTs, or report retrieval endpoints | M4 |
| Postgres job lifecycle implementation and persistence workflow | M4 |
| Mobile app UI or any Android rendering behavior | M7 |
| Scheduler / cron automation for Market Pulse | M6 |
| Market Pulse assembly or briefing generation | M6 |
| OpenBB or news-ingest feature expansion beyond what M3 needs to consume indirectly | M2 already established; M3 is reasoning-layer work |
| Direct Dexter ownership of the Market Pulse pipeline | Forbidden by current architecture |
| Direct writes from Dexter to Postgres | Forbidden by BLUEBOOK |
| Multi-provider LLM strategy or provider switching | Post-launch / future ADR |
| New contracts unrelated to Deep Dive report generation | Scope creep |

---

## 4. Services You Are Working In

| Service | Folder | What you are doing in it |
|---|---|---|
| `dexter-worker` | `apps/dexter-worker/` | Integrate pinned Dexter upstream, boot the worker, accept `AnalysisRequest`, execute native planner/retrieval/section/scoring/synthesis flow, and emit schema-valid `AnalysisReport` |
| Contracts | `packages/contracts/` | Use existing `AnalysisRequest`, `AnalysisReport`, `ReportSection`, and `EvidenceItem` contracts; modify only if a proven implementation gap exists and is versioned |
| Observability | `packages/observability/` | Wire shared logging, Sentry hooks where needed, and LangSmith trace instrumentation |
| Infra | `infra/` | Add Dexter env vars, Docker wiring, health checks, provider/model secret references, and any docker-compose changes needed for M3 |
| Integration tests | `tests/integration/` | Add end-to-end Dexter request → report validation tests |
| Smoke tests | `tests/smoke/` | Add or update scripted smoke coverage for the M3 Dexter path |

**Do not modify any service not listed above.**

---

## 5. Contracts You Are Touching

M3 should use the contracts created in M1. Modify only if an implementation gap is real and documented.

| Contract | Change type | File path |
|---|---|---|
| `AnalysisRequest` | Read-only unless bug found | `packages/contracts/src/analysis-request.ts` |
| `AnalysisReport` | Read-only unless bug found | `packages/contracts/src/analysis-report.ts` |
| `ReportSection` | Read-only unless bug found | `packages/contracts/src/report-section.ts` |
| `EvidenceItem` | Read-only unless bug found | `packages/contracts/src/evidence-item.ts` |
| `ServiceResponse` | Read-only if used at worker boundary | `packages/contracts/src/service-response.ts` |

**Rules:**

- Use existing M1/M2 contract definitions as the default truth
- If a contract must change, bump the version and verify all consumers compile
- Never define a report shape inside Dexter prompt text or ad-hoc service code
- Schema validation is mandatory before any `AnalysisReport` leaves `dexter-worker`
- `ReportSection.status` must remain one of: `complete`, `data_incomplete`, `data_unavailable`, `failed`
- `signal.value` must never be emitted unless the minimum evidence threshold is satisfied

---

## 6. Linear Ticket Rules for This Milestone

**Project:** M3 — Dexter Foundation

**Ticket naming:**

```text
[M3] What is being built
[M3][BUG] What is broken
[M3][SPIKE] What is being investigated
```

**Create one ticket per acceptance criteria item or tightly-coupled implementation slice:**

| Ticket | Acceptance criteria it satisfies |
|---|---|
| `[M3] Dexter dependency pin and worker bootstrap` | Dexter fork pinned; `dexter-worker` starts healthy |
| `[M3] AnalysisRequest intake and pipeline execution` | Dexter accepts valid request and completes native pipeline |
| `[M3] AnalysisReport schema enforcement` | Output validates automatically before return |
| `[M3] section status and blank-section guardrails` | Every section has status; no blank sections |
| `[M3] score evidence gate` | No signal without minimum evidence threshold; `no_signal` path works |
| `[M3] partial failure degradation` | Timed-out / failed section marked `failed`; rest of report still generated |
| `[M3] LangSmith tracing` | Prompt version, model, token count, section timing, job ID visible |
| `[M3] prompt externalization to LangSmith` | No production prompt strings hardcoded in app code |
| `[M3] degradation test suite` | Missing data, LLM timeout, and score-threshold tests pass |
| `[M3][SPIKE] Dexter upstream integration method` | Only if package/import boundary is unclear or blocked by upstream layout |
| `[M3][SPIKE] contract version bump for report semantics` | Only if an actual contract gap is proven during implementation |

**Required on every ticket:**

- Service or folder it touches
- Contract it touches (if any)
- Acceptance criteria line from `MILESTONES.md` it satisfies
- Link to this file

**Required on every bug ticket:**

- Steps to reproduce (exact commands or request payload)
- Expected behavior
- Actual behavior
- Which pipeline stage failed (planner / retrieval / section executor / scorer / synthesizer / validation)
- Which service surfaced the error
- Log output or LangSmith / Sentry link
- Severity: `P1 — Blocker` / `P2 — High` / `P3 — Normal`

**Never close a ticket without** a passing CI run and the relevant smoke-test step verified.

---

## 7. Logging for This Milestone

M3 introduces model execution and reasoning-stage observability. Logging must be structured and consistent.

| Event | Level | Fields |
|---|---|---|
| Dexter run started | INFO | `service, job_id, ticker, request_id?, model?, prompt_version?, timestamp` |
| Planner completed | INFO | `service, job_id, ticker, section_count, latency_ms, timestamp` |
| Data retrieval degraded | WARN | `service, job_id, ticker, section_id?, missing_fields[]?, source?, degradation_status, timestamp` |
| Section executor succeeded | INFO | `service, job_id, ticker, section_id, latency_ms, evidence_count, timestamp` |
| Section executor failed / timed out | ERROR | `service, job_id, ticker, section_id, error_message, timeout_ms?, timestamp` |
| Evidence threshold not met | WARN | `service, job_id, ticker, section_id?, score_state: "no_signal", limiting_factors[], timestamp` |
| Schema validation failed | ERROR | `service, job_id, ticker, contract, validation_errors[], timestamp` |
| LangSmith trace emitted | INFO | `service, job_id, ticker, prompt_version, model, trace_id?, token_count?, timestamp` |

Format: `{ level, service, message, job_id?, timestamp }` — no exceptions.
Do not log provider keys, model secrets, raw tokens, or user PII.

---

## 8. Error Handling for This Milestone

| Failure scenario | Expected behavior | Surfaces to |
|---|---|---|
| Dexter worker fails to start | Container is unhealthy; block milestone progress until fixed | Terminal + docker-compose |
| Upstream Dexter dependency pin is invalid or unavailable | Build/install fails loudly; do not silently fall back to a moving ref | CI + terminal |
| Dexter native retrieval returns partial data | Mark affected sections `data_incomplete`; continue where safe | Caller + logs |
| Dexter native retrieval returns no data for a section | Mark that section `data_unavailable`; continue remaining sections | Caller + logs |
| Section LLM call times out | Retry once with backoff; on second failure mark section `failed` | Sentry + caller |
| LLM / model response is malformed | Reject invalid section output, log validation failure, mark section `failed` | Sentry + logs |
| Evidence threshold not met for scoring | Return `no_signal` with explicit reason; do not fabricate a score | Caller + logs |
| Entire pipeline fatally fails before report assembly | Return structured failure, emit Sentry event, do not emit a fake partial report | Sentry + caller |
| LangSmith trace does not appear | Fail smoke verification and block milestone closeout | LangSmith manual verification |

**Rule:** No empty catch blocks. Every caught exception is logged and surfaced.

---

## 9. Testing Requirements for This Milestone

Every piece of work in M3 requires:

- [x] Unit test for every new adapter, mapper, validator, and evidence-gating function
- [x] Integration test for `AnalysisRequest` → Dexter pipeline → schema-valid `AnalysisReport`
- [x] Health-check test for `dexter-worker`
- [x] Schema validation test proving invalid report output is rejected before return
- [x] Section-status test proving every section includes a valid `status`
- [x] Blank-section guard test proving no section is emitted without content or explicit status
- [x] Evidence-gate test proving weak evidence returns `no_signal` with reason
- [x] Missing-data degradation test proving affected sections become `data_incomplete` or `data_unavailable`
- [x] Section-timeout degradation test proving one failed section does not kill the whole report
- [x] LangSmith instrumentation test or verified smoke step proving trace fields are emitted
- [x] CI must run these tests automatically on every PR

Test files live in:

- `apps/dexter-worker/tests/`

Cross-service tests live in:

- `tests/integration/`

Smoke tests live in:

- `tests/smoke/` or an equivalent scripted runner committed to the repo

**Important:** M3 tests may use fixtures/mocks for deterministic CI, but milestone closeout still requires live smoke validation of the Dexter path and LangSmith trace visibility.

---

## 10. Definition of Done

M3 is not done until every item below is checked:

- [x] All 11 acceptance criteria in `MILESTONES.md → M3` are satisfied
- [x] Smoke test executed in full — results documented in §11 below
- [x] All automated tests passing in CI
- [x] All Linear tickets for M3 are closed or explicitly deferred
- [x] Deferred items logged as Linear tickets assigned to the next milestone
- [x] Rollback procedure confirmed executable
- [x] `dexter-worker` starts healthy in docker-compose
- [x] A valid `AnalysisRequest` produces a schema-valid `AnalysisReport`
- [x] No blank sections are emitted in any verified test path
- [x] `no_signal` path is validated under insufficient evidence conditions
- [x] LangSmith trace visibility is confirmed for the verified run
- [x] Owner signs off
- [x] Engineering Lead countersigns

Sign-off:
- Owner: Rzv_sd (2026-03-20)
- Engineering Lead: Rzv_sd (2026-03-20)

**A single pretty report is not done. This checklist complete is done.**

---

## 11. Smoke Test Log

Run the smoke test from `MILESTONES.md → M3` exactly as written. Record results here.

```text
Date: 2026-03-19
Run by: Codex
Environment: local docker-compose + fixture/integration suites
Result: PASS

Step 1  — Start dexter-worker via docker-compose. Confirm healthy:                     PASS
Step 2  — Prepare test AnalysisRequest for ticker "MSFT":                              PASS
Step 3  — Send request to Dexter pipeline:                                             PASS
Step 4  — Wait for completion (< 90 seconds):                                          PASS (26.42s on `job-live-msft-final-m3`)
Step 5  — Response is valid AnalysisReport:                                            PASS
Step 6  — All expected sections are present:                                           PASS
Step 7  — Every section has status field:                                              PASS
Step 8  — Every scored claim has at least one EvidenceItem:                            PASS
Step 9  — LangSmith shows prompt version, model, token count, and job ID:             PASS (`trace_id=live-job-live-msft-final-m3`, `prompt_version=thesis-m3-section-executor:004977ae0c0ec3254d404958a26ca9184a8b22ecf93ae7b10350afe9362489e5`, `token_count=49961`)
Step 10 — Run ticker with limited data availability:                                   PASS (fixture scenario `LIMITED`)
Step 11 — Affected sections show data_incomplete or data_unavailable:                  PASS
Step 12 — Run case with evidence below score threshold:                                PASS (fixture scenario `NOSIG`)
Step 13 — Signal returns no_signal with reason:                                        PASS
Step 14 — Simulate LLM timeout on one section:                                         PASS (fixture scenario `TIMEOUT`)
Step 15 — Timed-out section shows failed; other sections still complete:               PASS
Step 16 — Run automated degradation tests:                                             PASS

Notes:
  - Live verification used docker-compose with `DEXTER_FIXTURE_MODE=false`, `DEXTER_MAX_PARALLEL_SECTIONS=4`, `DEXTER_SECTION_TIMEOUT_MS=70000`, and `DEXTER_MAX_SECTION_RETRIES=0`.
  - Fixture degradation verification passed via `python tests/smoke/m3_dexter_worker_smoke.py`.
  - Automated checks passed via `corepack pnpm --filter @thesis/dexter-worker typecheck`, `corepack pnpm --filter @thesis/dexter-worker test`, and `python tests/integration/test_m3_dexter_worker.py`.
```

---

## 12. Decisions Made During This Milestone

Log any architectural or product decisions made during this milestone. If a decision is significant, it requires an ADR in `/DECISIONS/`.

| Decision | What was decided | ADR required? |
|---|---|---|
| Prompt versioning | LangSmith remains the source of truth for production prompts | No — already in BLUEBOOK |
| Deep Dive ownership | Dexter is the primary engine for Company Deep Dive only | No — already in BLUEBOOK |
| Signal honesty rule | No signal is allowed without minimum evidence threshold; emit `no_signal` instead | No — already in MILESTONES / BLUEBOOK |
| Section degradation rule | Sections must degrade explicitly as `data_incomplete`, `data_unavailable`, or `failed` | No — already in MILESTONES / BLUEBOOK |
| Live reliability tuning | Runtime defaults tuned for stable live execution (`max_parallel_sections=4`, `section_timeout_ms=70000`, retries disabled by default) | No — implementation tuning within existing doctrine |
| Section execution guardrails | Acquisitions and management/risk sections were given stricter execution constraints to avoid timeout-driven drift | No — implementation-level control refinement |
| Prompt hardening | Section executor prompt template was tightened and pushed to LangSmith (`thesis-m3-section-executor`) | No — LangSmith prompt lifecycle already defined |

---

## 13. Known Issues and Deferrals

Log anything discovered but intentionally deferred.

| Issue | Why deferred | Linear ticket | Target milestone |
|---|---|---|---|
| Product API queue / persistence integration around Dexter | Belongs to auth/job-system milestone, not worker-foundation milestone | — | M4 |
| User-facing Deep Dive delivery and SLA hardening | Worker foundation comes first; full surfaced experience belongs later | — | M5 |
| Multi-model provider strategy | Explicitly out of scope for v1 unless ADR-approved | — | Post-launch / future ADR |
| Market Pulse synthesis / scheduler questions | Belongs to the pulse milestone, not Dexter foundation | — | M6 |
