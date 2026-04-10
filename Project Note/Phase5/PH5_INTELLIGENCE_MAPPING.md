# PH5 Intelligence Mapping

**Version:** 1.0  
**Status:** Active  
**Last Revised:** 2026-04-09
**Owner:** Product Lead + Engineering Lead

---

## Purpose

Define one canonical ownership map for Phase 5 intelligence loops so behavior does not fragment across services or screens.

All mapped user surfaces must preserve the same Thesis colors, typography, tone, and component style.

---

## Loop Ownership Map

| Loop | Trigger | Primary Service Owners | Primary User Surface |
|---|---|---|---|
| Kill-Switch Evaluation | New Deep Dive, daily pre-market, event trigger | `dexter-worker`, `scheduler`, `product-api` | Inbox, Names, Research |
| Freshness Decay | Daily pre-market and post-event reset | `scheduler`, `product-api` | Names, Today, You |
| Morning Exception Briefing | Morning cycle | `scheduler`, `product-api`, `mobile` | Today, Inbox, Push |
| Earnings War Room | Calendar event windows | `scheduler`, `product-api`, `dexter-worker`, `mobile` | Research, Today |
| Cross-Name Propagation | Material event on related name | `scheduler`, `product-api`, `dexter-worker` | Inbox, Names |
| Conviction Intelligence | User actions and periodic retrospective jobs | `product-api`, `dexter-worker`, `mobile` | Research, You |
| Scenario Stress Evaluation | User-triggered and optional scheduled cycle | `product-api`, `dexter-worker` | Research, Today |

---

## Operational Defaults

1. Earnings War Room live cycle defaults to `15 min`.
2. War Room falls back from `15 min` to `30 min` when any one condition occurs for the same `war_room_id`: (a) `2` consecutive cycle failures/timeouts, (b) source freshness lag `>= 20 min` for `2` consecutive cycles, or (c) cycle runtime `> 12 min` for `2` consecutive cycles.
3. War Room returns from `30 min` to `15 min` only after `3` consecutive healthy cycles (`success`, lag `<= 10 min`, runtime `<= 8 min`).
4. War Room entitlement is Pro-only; Free keeps existing `earnings_preview` behavior and does not receive War Room payloads.
5. During M4 cutover, legacy `earnings_preview` coexists and is the degraded fallback path when War Room preparation fails.
6. Cross-name propagation alerts require minimum confidence `0.70` by default.
7. Relationship edges below `0.70` remain queryable but do not emit propagated alerts by default.
8. Cross-name propagation alerts are Pro-only.
9. Macro is a propagation event/signal category through sector relationships, not a relationship type.
10. M5 uses existing Names and Inbox surfaces; no new top-level mobile screen is introduced.

---

## Information Placement Rule

- Portfolio-wide exception summary -> `Today`
- Per-name monitoring urgency -> `Names`
- Full thesis evidence and war-room context -> `Research`
- Alert history, reasons, and quality loop -> `Inbox`
- Settings, trust controls, and conviction profile controls -> `You`

---

## No-Duplication Rule

1. If a screen owns a concern, other screens can reference it but not duplicate full ownership.
2. Alert reason detail is canonical in `Inbox` and deep-link targets.
3. Deep thesis reading and opposite-case context are canonical in `Research`.
4. Freshness state is canonical in monitor snapshots and rendered in `Names`.

---

## Required Route Targets (Phase 5)

All push and alert-ledger entries must resolve to one of:

- `today`
- `names`
- `research`
- `inbox`
- `you`

Plus optional deep-link context keys:

- `ticker`
- `report_id`
- `alert_id`
- `rule_id`
- `scenario_id`
- `war_room_id`

War Room route contract (M4 lock):

- Required tuple for War Room push/open: `open_tab=research`, `notification_type=earnings_war_room`, `war_room_id`, `ticker`
- Optional additive keys: `alert_id`, `report_id`
- Mobile launch parsing must accept `war_room_id` from both push extras and URI query params before M4 can close
