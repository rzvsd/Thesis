# Phase 4 Mobile Screen Mapping

**Version:** 1.0  
**Status:** Locked for implementation  
**Owner:** Product Lead + Mobile Engineer  
**Last Revised:** 2026-04

---

## Root Tabs

| Tab | Owns | Must Not Own |
|---|---|---|
| Today | Market regime, pulse summary, action queue, weekly ritual, resume context | Full report workbench, settings, alert archive |
| Names | Followed-name monitoring, priority segments, thesis state/freshness, catalyst markers | Global market recap, account controls |
| Research | Search, Deep Dive, history, evidence, valuation, report feedback | Alert archive, account controls |
| Inbox | Alert history, alert filters, alert quality loop, quiet-category actions | Deep analysis UI, subscription UI |
| You | Subscription, usage, notification controls, biometric lock, trust guidance, support/feedback entry points | Per-ticker monitoring or alert history |

---

## Legacy Surface -> New Home

| Legacy Surface | Phase 4 Home | Notes |
|---|---|---|
| Market Pulse | Today | Daily command-center ownership remains here |
| Weekly digest | Today | Ritual content remains a Today-owned mode |
| Deep Dive entry | Research | Active investigation starts here |
| Search | Research | Search stays paired with report reading/history |
| Report history | Research | History remains canonical research context |
| Watchlist / My Names | Names | Per-name monitoring now has its own top-level home |
| Notification archive | Inbox | No longer implicit in transient push state |
| Settings | You | Control surfaces move out of the old overloaded Portfolio area |
| Subscription | You | Stays with controls, not monitoring |

---

## Ownership Rules

1. Global market context belongs to Today.
2. Per-name monitoring belongs to Names.
3. Full thesis and evidence belong to Research.
4. Alert history and alert review belong to Inbox.
5. Preferences, trust posture, and account controls belong to You.

---

## Tab Inventory

### Today

- Market regime header
- Pulse summary and pulse freshness
- Top action queue
- Weekly ritual entry
- Resume-where-you-left-off

### Names

- Followed tickers
- Segments: `All / At Risk / Catalysts Soon / Unresolved`
- Thesis state and freshness
- Catalyst markers
- Quick actions into Research

### Research

- Search
- Deep Dive reading
- History/resume
- Evidence and valuation context
- Report feedback

### Inbox

- Chronological alert history
- Alert filters
- Alert reason visibility
- Per-alert feedback/mute actions
- Current quiet-family control path through notification preferences

### You

- Subscription and usage
- Notification controls
- Biometric lock
- Trust guidance
- Support and feedback entry points

---

## Notification Routing Rules

| Notification Family | Default Route | Exact Context |
|---|---|---|
| `market_pulse_ready` | Today | Pulse date |
| `weekly_digest` | Today | Digest date |
| `earnings_preview` | Research | Lead ticker |
| `contrarian_alert` | Research | Report ID when present, otherwise ticker |

Inbox does not replace downstream landing.  
Inbox preserves history and explanation of the alert after delivery.

---

## Entry-Point Rules

| Entry Point | Destination Rule | Fallback |
|---|---|---|
| Push tap | Go to the route target with exact ticker/report/date context when present | Best reachable tab, never a dead end |
| Resume card | Reopen the last viewed Pulse, Deep Dive, or digest context | Research for report context, Today for pulse/digest context |
| Weekly ritual entry | Open the Today-owned weekly digest mode | Today |
| Search | Opens inside Research only | Research |
| History reopen | Opens inside Research only | Research |

---

## Names Segments

| Segment | Inclusion Rule |
|---|---|
| All | Every followed ticker |
| At Risk | Weakened thesis state or active thesis-drift alert context |
| Catalysts Soon | Earnings alert context exists for the ticker |
| Unresolved | Snapshot state is unresolved |

---

## Notes

- This file supersedes the old 3-tab mobile assumptions from Phase 2 M6 for future work.
- The visual language remains unchanged; this mapping governs information placement, not branding.
