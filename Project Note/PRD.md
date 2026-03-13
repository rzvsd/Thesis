# Finance Intelligence Platform — Product Requirements Document (PRD)

Name of the app : "Thesis" 
Marketing for the app : "Every position needs one"

****Thesis — every position needs one****

**Version:** 1.0  
**Status:** Active  
**Owner:** Product Lead  
**Last Revised:** 2026-03  
**Related Documents:** BLUEBOOK cld.md, ROADMAP.md, MILESTONES.md

---

## How to Read This Document

This document defines **what** the product does, **who** it is for, and **what the rules are** for every feature. It is written so that non-technical stakeholders — founders, investors, operations leads, legal reviewers — can read, audit, and challenge it.

If something in this document is unclear or missing, that is a gap that must be filled before engineering builds it. A feature that is not defined here should not be built.

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [Who This Is For](#2-who-this-is-for)
3. [What the Product Is Not](#3-what-the-product-is-not)
4. [Legal and Compliance Boundaries](#4-legal-and-compliance-boundaries)
5. [Product Surfaces](#5-product-surfaces)
6. [Feature Specifications](#6-feature-specifications)
7. [User Flows](#7-user-flows)
8. [Business Rules](#8-business-rules)
9. [Edge Cases and Failure Behavior](#9-edge-cases-and-failure-behavior)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Open Questions](#11-open-questions)

---

## 1. Product Vision

**One sentence:** Give individual investors the same quality of structured financial research that institutional analysts produce — on demand, on their phone, every morning.

**The problem it solves:**  
Understanding what is happening in public markets requires reading SEC filings, earnings transcripts, macro data releases, and news — then synthesizing all of it into a coherent picture. This takes institutional analysts hours. Individual investors either skip it or rely on opinion-heavy media that does not show its work.

**The solution:**  
A mobile application that retrieves verified financial data, reads primary sources, and produces a structured, evidence-backed research report — with every claim traceable to its source. It does not tell users what to do. It tells them what is happening and why, with explicit confidence levels.

---

## 2. Who This Is For

### Primary User: The Informed Individual Investor

- Invests their own money in public equities
- Has some financial literacy — understands revenue, margins, debt, what a 10-Q is
- Does not have access to Bloomberg terminals or institutional research
- Wants to make informed decisions, not follow tips
- Checks their phone before markets open

### Secondary User: The Curious Follower

- Follows specific companies or sectors with general interest
- Less financially literate but wants to understand what is happening
- Uses Market Pulse primarily; may request occasional Deep Dives

### Who This Is NOT For

- Professional fund managers (they have Bloomberg)
- Day traders (this is not a real-time data terminal)
- People who want to be told what to buy or sell (this product does not do that)

---

## 3. What the Product Is Not

This is not a minor disclaimer. These boundaries are product doctrine and must survive every future feature discussion.

| What people might expect | What this product does instead |
|---|---|
| "Tell me if I should buy this stock" | Shows research signal with evidence — user decides |
| "Manage my portfolio" | No portfolio tracking in v1 |
| "Execute a trade for me" | No trade execution, ever, without a major product pivot and regulatory review |
| "Give me real-time prices" | Shows data as of the last retrieval — not a live ticker |
| "Predict the market" | Summarizes what happened and what is uncertain — no predictions |
| "Search the whole internet for news" | Only approved, vetted news sources are included |

---

## 4. Legal and Compliance Boundaries

> **Important:** This section must be reviewed by legal counsel before the product is released to the public.

### What the product must never say or imply

- "You should buy / sell / hold [stock]"
- Any specific price target for any security
- That any research signal is a guarantee or prediction of future performance
- That the product is regulated financial advice

### What the product must always show

- A clear disclaimer on every report: *"This is a research summary, not financial advice. Always do your own research."*
- The source of every claim (evidence references)
- A confidence level on every signal
- When data is missing or incomplete

### Data sourcing

- Financial data is retrieved from regulated data providers via OpenBB
- News is retrieved only from a pre-approved list of sources
- No user-generated content is used as a data source
- All data carries a retrieval timestamp so users know how recent it is

---

## 5. Product Surfaces

The v1 product has two and only two user-facing features.

---

### Surface A: Company Deep Dive

**What it is:**  
A user types in a company ticker (e.g., AAPL, MSFT, TSLA) and receives a structured research report on that company within 90 seconds.

**When a user would use this:**  
"I'm considering a position in Tesla. I want to understand the last two quarters, their debt situation, and whether anything major has happened recently."

**What the report contains:**

| Section | Plain English Explanation |
|---|---|
| Executive Summary | 3–5 sentence overview of the company's current financial position and any major recent developments |
| Quarter-over-Quarter Changes | How key numbers (revenue, profit, margins) changed from last quarter to this quarter |
| Year-over-Year Changes | How the same numbers compare to the same period last year |
| Revenue and Margin Analysis | Where the company makes money, how much it keeps after costs, and whether this is improving or declining |
| Debt and Liquidity | How much the company owes, how much cash it has, and whether it can meet its near-term obligations |
| Acquisitions and Major Events | Any mergers, acquisitions, leadership changes, lawsuits, or significant corporate events in the recent period |
| Management Commentary | What executives said on the earnings call about the business outlook and risks |
| Research Signal | A synthesized indicator (Positive / Neutral / Negative / No Signal) with the specific reasons behind it |
| Confidence Score | How confident the system is in this report, and what limited it |
| Evidence References | Every source used — filing name, article title, data point — so the user can verify |

---

### Surface B: Market Pulse

**What it is:**  
Every morning, at a configured time before markets open, the app generates a briefing explaining what changed in markets, macro, and major news since the previous day.

**When a user would use this:**  
"I want to know what happened overnight and this morning before I think about anything market-related today."

**What the briefing contains:**

| Section | Plain English Explanation |
|---|---|
| Market Moves | Which major indices (S&P 500, NASDAQ, etc.) moved materially and by how much |
| What Likely Drove It | The system's synthesis of the most likely causes, with sources |
| Macro Releases | Any economic data released (inflation numbers, jobs reports, Fed decisions, etc.) and what they showed |
| Rates, FX, Commodities | Changes in interest rates, major currency pairs, oil, gold |
| News Summary | Key stories from approved sources that are relevant to markets |
| Uncertainty Flags | What is unclear, contested, or requires more information before drawing conclusions |
| Watchlist Overlay | If the user has a watchlist, any of their tickers that are mentioned in today's briefing |

**Delivery:**  
- A push notification arrives on the user's phone before markets open
- Tapping it opens the pre-generated briefing
- Briefings are stored and accessible historically (user can review yesterday's briefing)

---

## 6. Feature Specifications

### 6.1 Account and Authentication

**Registration:**
- User registers with email and password, or via Google Sign-In
- Email verification required for email/password accounts
- Google Sign-In users are verified via Google OAuth2 — no separate email verification step

**Login:**
- Email and password, or Google Sign-In
- Session stays active for 30 days via secure refresh token
- After 30 days of inactivity, user must log in again

**Security:**
- Passwords are never stored in plain text (hashed with bcrypt)
- Auth tokens stored in Android's secure storage (Keystore) — not in plain text files
- User is logged out immediately if they tap "Log out"

**Account deletion:**
- User can request account deletion from settings
- All personal data deleted within 30 days of request
- Reports are anonymized and archived — not deleted (see ADR-005)
- Anonymized usage data may be retained per privacy policy

---

### 6.2 Ticker Search

- User types a company name or ticker symbol
- Search returns matching results from the ticker registry
- Each result shows: ticker symbol, company name, exchange
- Selecting a result goes to the Company Deep Dive request screen
- If a ticker is not found: show a clear "not found" message, no crash

**Supported securities in v1:**
- US-listed public equities (NYSE, NASDAQ)
- No OTC stocks, no ETFs, no crypto, no international exchanges (deferred)

---

### 6.3 Deep Dive Request and Job Lifecycle

**What happens when a user requests a Deep Dive:**

```
Step 1: User selects a ticker and taps "Run Deep Dive"
Step 2: App sends request to the server
Step 3: Server creates a job and adds it to the processing queue
Step 4: App shows a "Generating report..." screen with a progress indicator
Step 5: The analysis pipeline runs in the background (target: under 90 seconds)
Step 6: App receives a notification that the report is ready
Step 7: Report screen opens automatically
```

**What the user sees during processing:**
- A progress indicator (spinner or progress bar)
- Estimated time remaining if available
- A message explaining what is happening: *"We're retrieving financial data and analyzing recent filings. This takes about 60–90 seconds."*

**What the user sees if it fails:**
- A clear error message: *"We couldn't complete this report. Please try again."*
- A retry button
- No partial or incomplete reports are shown — either the report is complete or it is not shown

---

### 6.4 Report Viewing

- Reports are stored and accessible after generation
- User can view any previously generated report from their history
- Each report shows: generated timestamp, ticker, confidence level
- Reports do not update after generation — they are a snapshot of data at the time of the request
- Evidence references are tappable — tapping opens the source article or filing URL

**Report history:**
- User can see a list of all their previously generated Deep Dives
- History is sorted newest first
- Reports cannot be deleted — they are permanently archived (see ADR-005)
- Users can hide a report from their visible history view

---

### 6.5 Watchlist

- User can maintain a list of up to 20 tickers (v1 limit)
- Adding a ticker: search → tap "Add to Watchlist"
- Removing a ticker: swipe or tap remove in watchlist screen
- Watchlist is used to generate the Watchlist Overlay section in Market Pulse

---

### 6.6 Market Pulse Delivery

**Schedule:**
- Generated once per day at **06:30 EST** (fixed for all users in v1)
- Per-user timezone scheduling is deferred to post-launch
- User receives a push notification when the briefing is ready

**Push notifications:**
- User must grant notification permission (requested on first launch)
- If permission is denied, briefing is available in the app but no push notification is sent
- Notification text: *"Your Morning Pulse is ready. Here's what moved overnight."*

**If generation fails:**
- No notification is sent
- The previous day's briefing remains accessible
- An internal alert is triggered for the operations team (via Sentry)
- User is not shown an error unless they open the app and see no new briefing

---

### 6.7 Settings

| Setting | Options |
|---|---|
| Notification time | Toggle on/off; time picker (default 06:30) |
| Notification permission | Link to Android system settings |
| Account | View email, change password, delete account |
| About | App version, terms of service, privacy policy, disclaimer |

---

## 7. User Flows

### Flow 1: New User Onboarding

```
Launch app
  └─► Welcome screen (what the app does, 3 bullet points)
        └─► Register screen (email + password)
              └─► Email verification sent
                    └─► User verifies email
                          └─► Notification permission prompt
                                └─► Home screen (Market Pulse tab)
```

### Flow 2: Requesting a Deep Dive

```
Home screen
  └─► Tap "Deep Dive" tab
        └─► Search bar
              └─► Type ticker or company name
                    └─► Select result
                          └─► Tap "Run Deep Dive"
                                └─► Processing screen (spinner + status message)
                                      ├─► Success: Report screen opens
                                      └─► Failure: Error screen with retry button
```

### Flow 3: Reading the Morning Pulse

```
Push notification arrives
  └─► Tap notification
        └─► Market Pulse report opens
              └─► Scroll through sections
                    └─► Tap evidence reference → opens source URL
                          └─► Return to app
```

### Flow 4: Managing Watchlist

```
Home screen
  └─► Tap "Watchlist" tab
        └─► View current tickers
              ├─► Tap "+" → search → add ticker
              └─► Swipe left on ticker → remove
```

---

## 8. Business Rules

These are non-negotiable rules that engineering must enforce in the system, not just in the UI.

| Rule | Detail |
|---|---|
| **No fabricated data** | If financial data is unavailable for a section, that section is marked incomplete. It is never filled with estimated or invented content. |
| **No signal without evidence** | A Research Signal value (Positive/Neutral/Negative) cannot be generated unless a minimum number of evidence items support it. If evidence is insufficient, the signal reads "No Signal — insufficient data." |
| **No report without a confidence score** | Every report must include a confidence score and the factors that limited it. |
| **Approved sources only** | News content in reports comes only from a maintained whitelist of approved sources. No user-submitted URLs, no random web content. |
| **Data timestamp always visible** | Every report shows when the data was retrieved. Users must always know how recent the information is. |
| **Disclaimer on every report** | The research disclaimer appears on every Deep Dive and Market Pulse report, every time. It cannot be hidden or dismissed. |
| **Reports are immutable** | Once a report is generated and stored, it is never edited. If newer data changes the picture, a new report must be requested. |
| **Job failure is visible internally** | Every failed job triggers an alert to the operations team. Users see a clean error; engineers see the full failure detail. |
| **Watchlist cap at 20 tickers** | Enforced server-side, not just in the UI. Attempting to add a 21st ticker returns an error. |

---

## 9. Edge Cases and Failure Behavior

This section defines what the product does in non-ideal situations. Every edge case listed here must be handled — not ignored.

### Data Edge Cases

| Situation | What the system does |
|---|---|
| A ticker exists but OpenBB has no data for it | Report is not generated. User sees: *"We don't have sufficient data for this company yet."* |
| Some financial fields are missing (e.g., no debt data) | Affected section is marked "Data incomplete for this section." Other sections are still generated. |
| News ingest returns no articles for the cycle | Market Pulse news section reads: "No material news was retrieved from approved sources for this period." — not blank, not fabricated. |
| Macro data provider is down | Affected sections in Market Pulse are marked incomplete. Briefing is still generated and delivered with a flag. |

### System Edge Cases

| Situation | What the system does |
|---|---|
| Report takes longer than 90 seconds | Job continues running. User sees updated status. If over 3 minutes, job is marked failed and user is notified. |
| User requests two Deep Dives simultaneously | Both jobs are queued. Both run. Both reports are stored. |
| User has no internet connection when opening a report | Previously loaded report is shown from local cache. New requests fail with a connectivity message. |
| Push notification permission denied | No notification sent. User sees the briefing when they open the app. No repeated permission prompts. |
| User deletes the app and reinstalls | Account persists (server-side). Report history persists. User logs in again. |
| User changes their phone | Same as above — log in on new device, history is restored. |

### Content Edge Cases

| Situation | What the system does |
|---|---|
| A company's earnings are not yet reported for the most recent quarter | Report uses the most recent available quarter and states which period it covers. |
| A company has recent news that is behind a paywall | Article is not included. Only freely accessible approved-source content is used. |
| Conflicting data between two sources | Both values are shown with their respective sources. Dexter does not arbitrate — it surfaces the conflict. |

---

## 10. Non-Functional Requirements

These are requirements about *how* the product behaves, not what it does.

### Performance

| Metric | Target |
|---|---|
| Deep Dive report generation | Under 90 seconds, 95% of the time |
| App launch to home screen | Under 2 seconds on mid-range Android devices |
| Report load from history | Under 1 second |
| Market Pulse delivery | Briefing available within 15 minutes of the configured time |

### Reliability

| Metric | Target |
|---|---|
| Product API uptime | 99.5% monthly |
| Scheduled Market Pulse success rate | ≥ 95% of scheduled runs produce a deliverable briefing |
| Data loss | Zero tolerance — no user data or report is ever silently lost |

### Security

- All data in transit is encrypted (HTTPS / TLS 1.3)
- Auth tokens stored in Android Keystore — never in plain text
- No financial data is stored on the device beyond what is needed to render the current screen
- All API endpoints require authentication except registration and login
- Rate limiting on all public endpoints

### Privacy

- No location data collected
- No microphone or camera access
- Analytics (PostHog) collect behavioral data only — no personally identifiable content
- Users can request full data export or deletion at any time

### Accessibility

- Text sizes respect Android system font size settings
- All interactive elements have content descriptions for screen readers
- Minimum contrast ratio 4.5:1 for all text

---

## 11. Open Questions

These must be answered before the relevant milestone begins.

| Question | Needed By | Owner | Status |
|---|---|---|---|
| What is the approved news source whitelist for v1? | M2 | Product Lead | **Resolved — see ADR-002** |
| What is the pricing model — free, freemium, subscription? | M7 | Founder | Open |
| Are Deep Dives unlimited or gated by plan? | M7 | Founder | Open |
| What disclaimer language has been reviewed by legal? | M5 | Legal | Open |
| Is report history visible across devices? | M4 | Product Lead | **Resolved — yes, server-side, restored on reinstall/new device (PRD §9)** |

**Resolved:**
- Market Pulse delivery time → **06:30 EST fixed for all users in v1** (per-timezone deferred)
- Minimum Android version → **Android 8.0 (API 26)** — see ADR-003
- Report deletion policy → **Reports are never deleted, only archived** — see ADR-005
- Auth providers → **Email/password + Google Sign-In (OAuth2)**