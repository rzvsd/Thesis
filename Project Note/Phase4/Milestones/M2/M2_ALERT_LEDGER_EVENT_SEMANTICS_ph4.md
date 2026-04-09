# M2 Alert Ledger Event Semantics (Phase 4)

**Milestone:** Phase 4 M2 - Inbox and Notification Ledger Backend  
**Status:** Implemented locally  
**Owner:** Product API Engineer + Contracts Owner  
**Last Revised:** 2026-04-08

---

## Purpose

Define the durable semantics for alert-ledger rows so Inbox history is auditable and the mobile app does not reconstruct meaning locally.

---

## Alert Families Recorded

| Notification Type | Category | Default Route |
|---|---|---|
| `market_pulse_ready` | `macro` | `today` |
| `weekly_digest` | `macro` | `today` |
| `earnings_preview` | `earnings` | `research` |
| `contrarian_alert` | `thesis_drift` | `research` |

---

## Row Creation Rule

An alert-ledger row is created when Product API dispatches a supported notification family and knows:

- the target user
- the notification family
- the route target
- human-readable title/body/reason text
- the delivery result for that dispatch attempt

Inbox history is therefore dispatch-backed, not mobile-local and not analytics-only.

---

## Required Fields

Each row must include:

- `id`
- `userId`
- `notificationType`
- `category`
- `route`
- `title`
- `body`
- `reasonCode`
- `reasonText`
- `deliveryState`
- `context`
- `createdAt`
- `updatedAt`

Optional mutable fields:

- `feedbackState`
- `mutedAt`

---

## Context Expectations

`context` may carry:

- `ticker`
- `relatedTickers`
- `reportId`
- `pulseDate`
- `digestDate`

The mobile app uses this context for exact landing and display hints, but Product API remains the owner of the source payload.

---

## Feedback Semantics

Current feedback states:

- `useful`
- `not_useful`

Feedback is attached to an existing alert row and does not create a second alert artifact.

---

## Mute Semantics

Current implemented mute surfaces are:

- alert-row audit stamp via `POST /v1/user/alerts/:id/mute`
- notification-family quieting via the existing notification preference system
- additive `quiet_until` support on notification-family preferences for temporary quieting without creating a second preference table

`POST /v1/user/alerts/:id/mute` now works as a compatibility adapter:

- it stamps `mutedAt` on the alert row for audit/history
- it applies a 24-hour `quiet_until` window to the alert's `notification_type`
- it does not invent a second category-level mute model

Not yet locked:

- cross-family category mute semantics
- frequency-tuning semantics beyond current notification-family preferences
- per-name mute semantics

Those remain explicit follow-up scope.

---

## Delivery State Semantics

Current delivery states:

- `sent`
- `partial_failure`

Future expansion must remain additive.

---

## Auditability Rule

An Inbox item is only considered auditable if it includes:

- a reason text understandable by the user
- a resolvable route target
- enough context to land on the downstream screen without a dead end

If these fields are absent, the notification family is not ready for Inbox history.
