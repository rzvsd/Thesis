# Thesis - Phase 4 PRD

**Version:** 1.0  
**Status:** Active  
**Owner:** Product Lead  
**Last Revised:** 2026-04

> This document defines the product requirements for Phase 4.  
> Earlier PRDs remain in force unless Phase 4 explicitly sharpens the information architecture or ownership model.

---

## 1. Product Vision Evolution

Phase 3 made Thesis more trustworthy and recurring.

Phase 4 must make Thesis easier to operate:

**the user should know where to go for action, where to go for evidence, where to go for alerts, and where to go for controls without hunting through sub-modes.**

The product is now judged by:

- information placement clarity
- alert transparency
- visible workflow continuity
- consistency of copy, tone, and route behavior

---

## 2. Product Requirements

### 2.1 Locked Mobile IA

The root mobile tabs are locked as:

1. Today
2. Names
3. Research
4. Inbox
5. You

**Locked decision:** Portfolio is split into Names and You. The old 3-tab canon is superseded for future work.

### 2.2 Today

Today is the daily command center.

Required behaviors:

- market regime header is visible
- pulse summary remains reachable immediately
- high-priority action cards stay tied to user names or current regime
- weekly ritual remains one tap away
- resume-where-you-left-off remains visible when relevant

### 2.3 Names

Names is the monitoring board for followed names.

Required behaviors:

- rows represent followed tickers, not general market content
- rows surface current thesis state, trust freshness, and one-line drift context
- segments exist for `All`, `At Risk`, `Catalysts Soon`, and `Unresolved`
- the board remains actionable and routes into Research without duplicating Research itself

### 2.4 Research

Research is the workbench for analysis.

Required behaviors:

- ticker search stays available
- history stays available
- Deep Dive remains the canonical reading surface for thesis, evidence, valuation, and feedback
- alert taps targeting Research land on meaningful context, not a blank search screen

### 2.5 Inbox

Inbox is the notification intelligence center.

Required behaviors:

- alert history is durable and chronological
- every alert row shows why it fired
- filters exist for `Thesis Drift`, `Earnings`, `Macro`, and `System`
- users can mark alerts useful/not useful
- users can quiet a category without disabling every notification family

**Locked implementation decision:**

- Inbox is server-backed through a Product API-owned `alert_ledger`
- mobile does not reconstruct Inbox from local notification state

### 2.6 You

You owns controls.

Required behaviors:

- subscription and usage state remain visible
- notification controls remain visible
- biometric lock remains visible
- data trust guidance is visible
- support and product feedback entry points remain reachable

---

## 3. Business Rules

1. **No visual reset.** The existing Thesis palette, typography mood, and card language remain.
2. **No hidden alert reason.** Inbox rows must explain themselves.
3. **No duplicate ownership.** Today does not become Research; Research does not become Inbox.
4. **No fake tunability.** Category controls must use real server-backed preferences.
5. **No broken push routes.** Every supported alert family lands on a reachable screen.

---

## 4. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Contracts | New alert-ledger payloads remain typed and additive |
| Mobile | Android compiles cleanly after the 5-tab refactor |
| Backend | New alert list/filter/feedback/mute endpoints are integration-tested |
| Compatibility | Existing notification preferences still work |
| Device Proof | Maestro/device validation is required in M4 once hardware is attached |

---

## 5. Edge Cases

| Scenario | Expected Behavior |
|---|---|
| User has no followed names | Today still loads and Names explains how to start |
| User has followed names but no recent monitor snapshot | Names stays readable and marks missing freshness honestly |
| Alert exists for a route with missing downstream artifact | App lands on the best reachable context, never a dead end |
| User disables one notification family | Inbox history remains visible, but future sends for that family stop |
| Device proof is unavailable in the current session | M4 remains open with explicit pending evidence, not silent closure |
