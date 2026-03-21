# M8 Implementation Plan
**Milestone:** M8 - Product Quality / UX Refinement  
**Derived from:** `MILESTONES.md -> M8` and `Milestones/M8/M8_MILESTONE_AGENTS.md`  
**Purpose:** Concrete implementation sequencing for M8. This document does not change scope. It translates the finalized milestone definition into an execution-ready plan.

---

## 1. Recommended Ticket Order

The following is the recommended execution order for the 10 M8 ticket groups:

1. `[M8] First-run / no-data clarity`
2. `[M8] Home loop refinement`
3. `[M8] My Names UX`
4. `[M8] Delta-first presentation`
5. `[M8] Premium state handling`
6. `[M8] History/resume flow`
7. `[M8] Push UX and tap-through`
8. `[M8] UX analytics validation`
9. `[M8] Quality bug closeout`
10. `[M8] Product coherence sign-off`

This order is intentional:
- first define the user's first impression
- then shape the daily loop and personalization
- then improve reading quality and state quality
- then tighten continuity and push entry paths
- then verify the journey with analytics
- then close bugs and run sign-off last

---

## 2. Ticket-by-Ticket Plan

### 1. `[M8] First-run / no-data clarity`

**Goal**  
Make a new user understand the app's purpose quickly and ensure empty states are useful rather than dead ends.

**Touched folders/services**
- `apps/mobile/`
- `tests/e2e/`
- `tests/integration/`
- `apps/product-api/` only if current API responses do not expose enough state for clean empty-state rendering

**Dependencies**
- M7 onboarding/auth flow already stable
- approved legal/disclaimer wording already present
- current watchlist/history/pulse availability states already accessible

**Mobile-only or backend support**
- Primarily mobile-only
- Backend support only if a state signal is missing for cleaner empty-state branching

**Proof/test expectation**
- Physical-device test: fresh install user can explain the app purpose in under 30 seconds
- Empty-state tests for no watchlist, no history, and no new pulse yet
- No blank or misleading first-run screens

**Priority**
- Must-have for M8

---

### 2. `[M8] Home loop refinement`

**Goal**  
Reshape home so it feels like one daily loop: what moved, what matters to my names, what deserves a deeper look.

**Touched folders/services**
- `apps/mobile/`
- `tests/e2e/`
- `tests/integration/`
- `apps/product-api/` only if response composition or ordering support is needed
- `packages/ui-schema/` only if shared render primitives are truly required

**Dependencies**
- first-run/no-data clarity should be drafted first
- latest pulse data and watchlist overlay data already available from M6/M7
- no architecture change to Market Pulse ownership

**Mobile-only or backend support**
- Mostly mobile
- Possible light backend support for response shaping, not new orchestration

**Proof/test expectation**
- Manual device test: home is understandable without explanation
- Product review confirms home answers the three-loop questions quickly
- Integration check that home still renders correctly with and without personalization data

**Priority**
- Must-have for M8

---

### 3. `[M8] My Names UX`

**Goal**  
Expose watchlist relevance more personally in the UX without changing the backend model away from watchlist.

**Touched folders/services**
- `apps/mobile/`
- `tests/e2e/`
- `tests/integration/`
- `apps/product-api/` only if read/query support is needed for cleaner relevance presentation

**Dependencies**
- home loop work should already be started
- watchlist persistence from M6/M7 must already be stable
- exact ticker-symbol overlay logic remains unchanged

**Mobile-only or backend support**
- Mostly mobile
- Backend only if an existing response does not expose enough relevance detail

**Proof/test expectation**
- Device test: user sees clearly what matters to their names
- Add/remove watchlist still works without confusion
- No portfolio semantics, holdings, or cost-basis language appear

**Priority**
- Must-have for M8

---

### 4. `[M8] Delta-first presentation`

**Goal**  
Make both Market Pulse and Deep Dive emphasize change, drivers, uncertainty, and follow-up instead of feeling like generic summaries.

**Touched folders/services**
- `apps/mobile/`
- `tests/e2e/`
- `tests/integration/`
- `apps/product-api/` only if presentation metadata or ordering support is needed
- `packages/ui-schema/` only if rendering support is truly required

**Dependencies**
- home loop and My Names framing should already be underway
- existing Deep Dive and Pulse payloads already render correctly from M7
- no contract redesign unless a real schema gap is proven

**Mobile-only or backend support**
- Mostly mobile
- Possible light backend support for response shaping

**Proof/test expectation**
- Device test: Pulse and Deep Dive both read as "what changed and why"
- Section hierarchy and emphasis reviewed by Product Lead
- No generic summary feel on key screens

**Priority**
- Must-have for M8

---

### 5. `[M8] Premium state handling`

**Goal**  
Upgrade loading, empty, retry, offline, degraded, and failure states so the main user path never feels broken or abandoned.

**Touched folders/services**
- `apps/mobile/`
- `tests/e2e/`
- `tests/integration/`
- `apps/product-api/` only if better state signaling is needed
- `packages/observability/` if state transitions need clearer analytics or error hooks

**Dependencies**
- first-run/no-data clarity should already exist
- current failure/degraded behaviors from M7/M6 must be understood before reworking copy and recovery UX

**Mobile-only or backend support**
- Mostly mobile
- Backend support only for cleaner state exposure

**Proof/test expectation**
- Manual tests for offline, retry, degraded, and no-data paths
- No blank/confusing screen remains on the core path
- Sentry still captures real failures; UX does not hide broken behavior

**Priority**
- Must-have for M8

---

### 6. `[M8] History/resume flow`

**Goal**  
Make it easier to revisit prior Pulse and Deep Dive content and resume context naturally.

**Touched folders/services**
- `apps/mobile/`
- `tests/e2e/`
- `tests/integration/`
- `apps/product-api/` if resume/history response support needs cleanup

**Dependencies**
- home loop should already be shaped
- prior report and pulse retrieval from earlier milestones must be stable
- product framing decisions from delta-first presentation should already be underway

**Mobile-only or backend support**
- Likely mobile with light backend support

**Proof/test expectation**
- Device test: prior Pulse and Deep Dive are easy to find and reopen
- Re-entry path feels natural after app relaunch
- No loss of existing history semantics

**Priority**
- Must-have for M8

---

### 7. `[M8] Push UX and tap-through`

**Goal**  
Improve push copy and guarantee that push tap lands in the correct in-app state and feels relevant.

**Touched folders/services**
- `apps/mobile/`
- `apps/product-api/`
- `tests/e2e/`
- `tests/integration/`

**Dependencies**
- home loop and resume flow should already be mostly defined
- M7 push delivery path must already work
- fixed 06:30 America/New_York doctrine remains unchanged

**Mobile-only or backend support**
- Needs backend support
- Mobile for routing and opened-from-push handling
- Product API for copy payload or metadata adjustments if needed

**Proof/test expectation**
- Push arrives
- Tap opens the correct briefing/screen/state every time
- Push copy review passes product-quality bar and does not feel generic

**Priority**
- Must-have for M8

---

### 8. `[M8] UX analytics validation`

**Goal**  
Use PostHog to validate whether the intended user journey actually works, not merely whether events exist.

**Touched folders/services**
- `apps/mobile/`
- `packages/observability/`
- `apps/product-api/` only if event support needs light server coordination
- `tests/e2e/`

**Dependencies**
- first-run, home loop, and core path instrumentation points must be stable enough to validate
- at least one feature flag remains in place from M7
- PostHog project already operational

**Mobile-only or backend support**
- Mobile plus observability support
- Possible light backend support

**Proof/test expectation**
- Reviewable PostHog path for onboarding/home/pulse/deep-dive/history journey
- Product team can identify drop-off or dead-end points
- Feature flag still works and is not broken by UX changes

**Priority**
- Must-have for M8

---

### 9. `[M8] Quality bug closeout`

**Goal**  
Fix or explicitly defer product-facing bugs discovered during M8 so quality debt does not silently spill into M9.

**Touched folders/services**
- Primarily `apps/mobile/`
- Possibly `apps/product-api/`
- Possibly `packages/observability/`
- `tests/e2e/`
- `tests/integration/`

**Dependencies**
- should run continuously through M8, but formal closeout happens late
- depends on earlier tickets exposing the real product-quality gaps

**Mobile-only or backend support**
- Mixed, depending on bug source

**Proof/test expectation**
- Every discovered bug is either fixed with verification or explicitly deferred with rationale
- No unresolved P1/P2 product-quality bug remains at closeout

**Priority**
- Must-have for M8

---

### 10. `[M8] Product coherence sign-off`

**Goal**  
Run the final product review and confirm the app feels coherent and premium, not just functional.

**Touched folders/services**
- No primary implementation surface
- Uses the built product, smoke materials, and milestone docs
- `apps/mobile/` if final polish fixes emerge from sign-off

**Dependencies**
- all prior M8 must-have work substantially complete
- PostHog review available
- non-technical smoke path executable

**Mobile-only or backend support**
- Neither by default
- May trigger small final polish fixes in mobile

**Proof/test expectation**
- Product Lead sign-off recorded
- Non-technical smoke path completed
- M8 smoke test passes end-to-end

**Priority**
- Must-have for M8

---

## 3. Priority Summary

### Must-have for M8
- `[M8] First-run / no-data clarity`
- `[M8] Home loop refinement`
- `[M8] My Names UX`
- `[M8] Delta-first presentation`
- `[M8] Premium state handling`
- `[M8] History/resume flow`
- `[M8] Push UX and tap-through`
- `[M8] UX analytics validation`
- `[M8] Quality bug closeout`
- `[M8] Product coherence sign-off`

### Strongly recommended for M8
- None outside the 10 defined ticket groups. The milestone identity depends on all 10 groups being represented.

### Defer only if schedule pressure requires it
- If schedule pressure is real, defer only sub-scope within a ticket group, not the existence of the group itself
- Most deferrable sub-scope areas:
  - extra copy polish beyond the critical path
  - non-critical secondary history affordances
  - lower-value visual refinement that does not change perceived coherence
  - non-blocking analytics segmentation depth beyond the core path

---

## 4. Minimum Viable M8 Cut

The minimum viable cut that still preserves M8 milestone identity is:

1. First-run / no-data clarity is complete
2. Home loop refinement is complete
3. My Names UX is visible and understandable
4. Delta-first presentation is visible in both Pulse and Deep Dive
5. Premium state handling covers the core journey with no blank/confusing states
6. Push tap-through is reliable and the copy is no longer generic
7. History/resume flow works for the main revisit path
8. PostHog can validate the core journey
9. Open product-quality bugs are either fixed or explicitly deferred
10. Product Lead signs off that the app feels coherent and premium

In plain terms: if the app still feels like two disconnected features, or if the user journey still contains dead-end states, M8 identity has not been preserved.

---

## 5. Risky Sequencing and Hidden Dependencies

### Risk 1: Home refinement before first-run clarity
If home is redesigned before first-run and no-data framing is understood, the team can build a cleaner screen that still fails the "understand the app in 30 seconds" test.

**Mitigation**
- Start with first-run/no-data clarity and use that to anchor home decisions

### Risk 2: My Names UX accidentally drifting into portfolio semantics
Personalization language can easily drift into holdings/portfolio language, which would violate product doctrine.

**Mitigation**
- Keep backend model and user-language review anchored to watchlist semantics
- Product copy review required before sign-off

### Risk 3: Delta-first presentation causing accidental backend scope creep
Teams often try to "solve" presentation gaps by changing contracts or backend orchestration too early.

**Mitigation**
- Default to mobile presentation changes first
- Backend changes only if a real response-shaping blocker is proven

### Risk 4: Premium state handling hiding real failures
Better UX states can accidentally mask real product failures and make debugging harder.

**Mitigation**
- Preserve Sentry visibility
- Keep degraded/failure states explicit and honest

### Risk 5: Push UX before resume/navigation is stabilized
Improving push copy without stabilizing destination routing and resume behavior can produce a nicer notification that still lands in the wrong context.

**Mitigation**
- Sequence push work after home and history/resume direction is mostly settled

### Risk 6: Analytics validation added too late
If PostHog journey validation is left to the very end, the team may discover too late that the intended path cannot be measured clearly.

**Mitigation**
- Define event/path validation expectations early, even if final review comes late

### Risk 7: Bug closeout treated as a cleanup sprint instead of continuous pressure
If bug closeout only starts at the end, quality debt can pile up and threaten sign-off.

**Mitigation**
- Log and triage bugs continuously, but keep formal closeout near the end

---

## 6. Execution Guidance

Recommended practical work pattern:

1. Lock first-run framing and no-data behavior
2. Shape the daily-loop home experience
3. Add visible My Names personalization
4. Improve Pulse and Deep Dive delta-first reading quality
5. Eliminate weak states on the critical path
6. Refine history/resume and then push tap-through
7. Validate the journey in PostHog
8. Burn down bugs
9. Run non-technical smoke and Product Lead sign-off

This is the leanest path that preserves milestone identity without reopening architecture.
