# M5 Beta Plan (Phase 3)

**Milestone:** M5 - Controlled Beta and Launch Decision  
**Status:** Active  
**Date:** 2026-04-05  
**Owners:** Product Lead, Support Owner, Engineering Lead, QA Lead

---

## Goal

Run a controlled Android beta that proves product value, reliability, and support response quality before public launch.

---

## Cohort Definition

- Beta type: closed Android beta
- Admission: invite-only
- Capacity: capped at 100 users
- Entitlement policy: every beta participant receives Pro access for the beta period

---

## Invite Criteria

1. User has accepted beta invitation.
2. User can complete sign-in and onboarding.
3. User can add at least one followed name.
4. User can receive at least one notification family during beta.

---

## Onboarding And Support Path (End-to-End)

1. Invite accepted -> user signs in on Android release candidate.
2. User completes onboarding and sets followed names.
3. User reaches Today and Deep Dive paths.
4. User submits feedback from in-app surfaces:
   - report feedback: `POST /v1/feedback/report`
   - subscription or cancel feedback: `POST /v1/feedback/subscription`
5. Product API persists feedback into durable queue (`user_feedback_queue`).
6. Support owner runs daily queue triage via `GET /internal/feedback/queue`.
7. Issues requiring engineering/product follow-up are escalated into the tracked milestone workstream.

---

## Support Ownership And Cadence

- Primary owner: Support Owner
- Triage cadence: daily at 10:00 local time
- Weekly review: every Friday with Product + Engineering + QA
- Severity routing:
  - P1 Blocker: immediate escalation to Engineering Lead and QA Lead
  - P2 High: same-day routing in milestone review
  - P3 Normal: grouped into weekly review backlog

---

## Success Thresholds (Locked For M5)

- Crash-free sessions >= 99.5%
- Five-pass release-candidate smoke remains green
- No unresolved Sev-1 launch blockers
- Activation >= 35% of beta invite acceptances
- Notification disablement < 15% of push-receiving beta users
- No unresolved severe trust-complaint cluster

---

## Evidence Sources

- M3 feedback queue proof:
  - `artifacts/ph3/m3/2026-04-04T17-49-00/m3_api_summary.json`
  - `artifacts/ph3/m3/2026-04-04T20-48-26/m3_manual_feedback_verify.json`
- M4 release-candidate reliability proof:
  - `artifacts/m4/maestro/2026-04-05T09-34-44/five-pass-summary.json`
  - `artifacts/m4/e2e/2026-04-04T22-10-40/summary.json`
  - `artifacts/m4/load/2026-04-04T21-57-01/summary.json`
  - `artifacts/m4/runbooks/2026-04-05T01-09-39/summary.json`

