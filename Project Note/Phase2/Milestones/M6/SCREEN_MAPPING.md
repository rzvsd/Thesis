# Phase 2 M6 Screen Mapping

**Milestone:** Phase 2 M6 - 3-Tab Navigation Redesign  
**Status:** Approved precondition  
**Owner:** Mobile Engineer + Product Lead

---

## Purpose

This file is the canonical mapping from the current working mobile navigation to the approved M6 3-tab structure.

If implementation code, smoke tests, or ticket wording disagree with this file, this file wins for M6 routing behavior.

---

## Tab Naming

Approved tab labels:

- `Today`
- `Research`
- `Portfolio`

`Portfolio` is UX framing only. It does **not** introduce real holdings, cost basis, brokerage connectivity, or portfolio-performance tracking.

---

## Current Surface -> New Home

| Current location | New home | Notes |
|---|---|---|
| Market Pulse | Today | Daily time-aware briefing surface |
| Deep Dive entry | Research | Active investigation starts here |
| Search | Research | Search belongs with Deep Dive |
| Report results | Research | Opened reports remain in the research workflow |
| Report history | Research | Locked by G4 |
| Watchlist / My Names | Portfolio | Personal list management |
| Settings | Portfolio | Personal/account surface |
| Subscription status | Portfolio | Personal/account surface |

---

## Notification Deep-Link Mapping

| Notification type | Destination | Notes |
|---|---|---|
| `market_pulse_ready` | Today | Opens the daily briefing |
| `earnings_preview` | Today | Simpler approved path for M6 |
| `contrarian_alert` | Research | Opens research context for the ticker/report |
| Deep Dive report open / resume path | Research | Opens the specific report if present |

If a notification target cannot be resolved exactly, the safe fallback is:

1. `Today` for Pulse-style context
2. `Research` for report-specific context

Never send the user to a blank or dead-end screen.

---

## Today Tab State Design

The Today tab always has content. It never shows a generic "markets are closed" empty state.

### Pre-market

Priority order:

1. Fear & Greed current score plus yesterday delta
2. Earnings preview for watchlist names reporting today
3. Overnight alerts / resolved contrarian context
4. Latest Morning Pulse summary

### Market hours

Priority order:

1. Current Market Pulse
2. Fear & Greed score
3. Active contrarian alerts on watchlist tickers
4. Earnings reminders for today/tomorrow

### After hours

Priority order:

1. End-of-day Market Pulse wrap
2. Final daily Fear & Greed reading
3. Tomorrow's earnings preview for watchlist
4. Weekly digest teaser on Sunday

The same core data families stay visible across states. Only priority and ordering change.

---

## Research Tab Structure

Minimum expected structure:

1. Search bar
2. Recent reports / history list
3. "Run a Deep Dive" entry point when no active search/report is open

Research is the canonical home for:

- search
- active investigation
- completed report results
- report history / resume

---

## Portfolio Tab Structure

Minimum expected structure:

1. Subscription / profile status
2. Watchlist / My Names management
3. Notification settings
4. App settings

Portfolio is the user's personal control space. It is not the home of report history.

---

## Migration Strategy

Approved strategy: **atomic switch**

- One PR replaces the old navigation with the new 3-tab navigation.
- No adapter layer.
- No coexistence period.
- If the refactor fails smoke, revert the PR.

---

## Regression Rule

The following Phase 1 paths must still work after the M6 switch:

- Pulse loads
- Deep Dive run path is reachable
- Watchlist/My Names CRUD works
- History reopens prior content
- Settings remain reachable
- Notification tap-through still works

---

## Required M6 Proof

M6 is not honest-to-close unless real-device smoke proves:

- Today / Research / Portfolio all present
- Today state logic works
- Research history opens real reports
- Portfolio owns watchlist/settings/subscription surfaces
- Notification deep-links land on the approved destinations
- No old navigation path strands the user
