# M3 Event Semantics (Phase 3)

**Milestone:** Phase 3 M3 - Monetization, Growth Instrumentation and Feedback  
**Owner:** Analytics Owner + Product Lead  
**Status:** Active

---

## Purpose

Define canonical M3 analytics events and required properties so funnels and dashboards are reproducible across environments.

---

## Required Monetization Events

| Event | Required properties | Source |
|---|---|---|
| `paywall_shown` | `feature` | Mobile (`MainViewModel.requestFeatureUpgrade`) |
| `paywall_cta_clicked` | `feature`, `package_type` | Mobile (`MainViewModel.startPurchase`) |
| `purchase_started` | `package_type`, `identifier` | Mobile |
| `purchase_completed` | `tier`, `billing_period_end` | Mobile |
| `purchase_failed` | `feature`, `reason` | Mobile |
| `restore_started` | none | Mobile |
| `restore_completed` | `tier`, `billing_period_end` | Mobile |
| `restore_failed` | `reason` | Mobile |
| `cancel_reason_submitted` | `feedback_id`, `code`, `source_surface` | Mobile |
| `downgrade_reason_submitted` | `feedback_id`, `code`, `source_surface` | Mobile |
| `win_back_prompt_shown` | `feature` | Mobile |

---

## Required Feedback Events

| Event | Required properties | Source |
|---|---|---|
| `report_feedback_submitted` | `feedback_id`, `report_id`, `ticker`, `code` | Mobile |
| `trust_feedback_submitted` | `report_id`, `code` | Mobile |

---

## Queue Persistence Contract

In-app feedback must persist to Product API-owned `user_feedback_queue` before human triage.

Ingestion endpoints:

- `POST /v1/feedback/report`
- `POST /v1/feedback/subscription`

Queue inspection endpoint (internal token required):

- `GET /internal/feedback/queue`

Primary triage dimensions:

- `feedback_type`
- `severity`
- `source_surface`
- `user_tier`
- `report_id`
- `ticker`
- `triage_status`
- `route_status`

---

## Funnel Mapping

### Activation Funnel (M3-owned extension)

- `user_registered` -> `watchlist_ticker_added` -> `deep_dive_started` -> `deep_dive_viewed`

### Pro Conversion Funnel

- `paywall_shown` -> `purchase_started` -> `purchase_completed`

### Subscription Recovery / Win-Back Funnel

- `cancel_reason_submitted` or `downgrade_reason_submitted` -> `win_back_prompt_shown` -> `purchase_started` -> `purchase_completed`

---

## Validation Rule

An event is considered M3-valid only if:

1. Event name matches this document.
2. Required properties are present.
3. The matching queue row exists for feedback-related events.
