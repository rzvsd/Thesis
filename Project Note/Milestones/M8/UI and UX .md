# M8 Research Synthesis & UI/UX Vision for Thesis

## What I Now Understand

**Thesis** — *"Every position needs one"* — is an Android-first financial intelligence platform for individual investors. It delivers two surfaces:

1. **Company Deep Dive** — On-demand, AI-generated research reports (via Dexter) with evidence-backed claims, confidence scores, and traceable sources. Target: under 90 seconds.
2. **Market Pulse** — A daily pre-market morning briefing (06:30 ET) covering what moved, why, macro releases, and news from approved sources.

### Current State (M7 MVP)

The existing Android app is a **functional but visually basic** Jetpack Compose app:

| What Works | What Feels Basic |
|---|---|
| Auth (register, verify, login, logout, refresh) | Plain white Material3 defaults, no visual identity |
| 4-tab nav (Pulse, Deep Dive, Watchlist, Settings) | Flat cards with no hierarchy or visual rhythm |
| Ticker search + Deep Dive job flow | Generic loading spinner, no progress narrative |
| Market Pulse with sections + evidence links | Reports feel like data dumps, not curated reads |
| Watchlist add/remove | No personality — "Watchlist" feels mechanical |
| Push notifications + tap-through | Push copy is generic |
| PostHog analytics + feature flags | No journey validation |

**Bottom line:** M7 proves the system works end-to-end. M8's job is to make users *want to come back*.

---

## M8 Goal Restated

> Turn the Android MVP from "technically correct" into a product that feels **coherent**, **personal**, and **premium** — so that a real user would want to open it again tomorrow.

---

## 🎨 Fresh, Smart, AI-ish UI/UX Ideas

These ideas are grounded in the M8 scope (no architecture changes, no new features) but push the visual and interaction design toward something that feels **alive, intelligent, and addictive**.

---

### 1. 🏠 The "Morning Loop" Home — Not Tabs, a Story

**Current:** 4 flat tabs. Pulse is a list of sections. No flow.

**Vision:** Home becomes a single **scrollable narrative** — like an AI-curated morning brief that flows through three beats:

```
┌─────────────────────────────────────┐
│  ☀️ Good morning, Razvan            │  ← Personalized greeting, timestamp
│  Markets are moving on CPI data     │  ← One-line "what happened" hook
├─────────────────────────────────────┤
│  📊 WHAT MOVED                      │  ← Market Pulse summary (delta-first)
│  S&P 500  ▼ 1.2%  |  NASDAQ ▲ 0.4% │  ← Visual deltas, color-coded
│  ──────────────────────              │
│  YOUR NAMES                         │  ← "My Names" overlay
│  🔴 TSLA mentioned in 3 stories    │
│  🟢 AAPL — quiet day               │
│  ──────────────────────              │
│  🔍 WORTH A DEEPER LOOK            │  ← Natural bridge to Deep Dive
│  "CPI beat may affect TSLA margins" │
│  [ Run Deep Dive → ]               │  ← One-tap transition
├─────────────────────────────────────┤
│  📖 Full Pulse  |  📚 History       │  ← Expand / revisit
└─────────────────────────────────────┘
```

**Why this works:**
- **One screen answers three questions:** What moved? What matters to me? What deserves deeper analysis?
- **No tab-switching needed for the daily ritual**
- **Pulse → Deep Dive is a natural scroll**, not a navigation jump
- Users feel the app *curated something for them*

---

### 2. 🧠 "AI Awareness" Visual Language

Make the AI nature of the product visible through subtle design cues:

- **Confidence halos:** Instead of just text "Confidence: 0.78 / high", show a glowing ring around the signal indicator. Higher confidence = brighter, fuller ring. Low confidence = dim, pulsing. This makes trust *visual*.

- **Evidence dots:** Each section of a report shows small dots indicating how many evidence items back it. Tap a dot cluster → evidence cards fan out. This makes the *evidence density* visible at a glance.

- **"Dexter is thinking" animation:** Replace the generic spinner during Deep Dive generation with a bespoke animation showing Dexter's pipeline stages:
  ```
  🔍 Searching filings...     ✓
  📊 Analyzing fundamentals... ⟳  ← current stage pulses
  📰 Reading recent news...    ○
  ✍️ Writing synthesis...      ○
  ```
  This turns waiting time into *trust-building* transparency.

- **Uncertainty markers:** Where data is incomplete or conflicting, show a subtle ⚡ or `~` indicator. Not scary — honest. Users learn that the app *doesn't hide what it doesn't know*.

---

### 3. 🌙 Dark Mode by Default — Premium Palette

Finance apps that feel premium are almost always dark. Current app: plain white Material3.

**Proposed palette:**

| Element | Color | Rationale |
|---|---|---|
| Background | `#0A0E1A` (deep navy-black) | Premium, easy on eyes for morning reading |
| Surface cards | `#141A2E` | Subtle elevation from background |
| Primary accent | `#4F8CFF` (electric blue) | Trust, intelligence, clean contrast |
| Positive delta | `#00D68F` (mint green) | Standard positive signal |
| Negative delta | `#FF5C5C` (soft red) | Standard negative signal |
| Neutral/uncertain | `#9CA3AF` (muted gray) | Honest uncertainty |
| Text primary | `#E8ECF4` | Readable on dark |
| Text secondary | `#8B95A8` | Hierarchy without harshness |

**Light mode:** Yes, accessible, but dark is the hero.

---

### 4. 🎭 "My Names" — Personal Without Being Portfolio

**Current:** A "Watchlist" tab with ticker symbols and add/remove buttons. Feels like a settings panel.

**Vision: "My Names" is everywhere, not a separate tab:**

- On the home loop: "YOUR NAMES" section shows which of the user's tickers appeared in today's Pulse
- On Deep Dive results: If the ticker is in "My Names", show a subtle badge `✦ In your names`
- On Pulse sections: Highlight sentences that mention a user's ticker with a soft glow/underline
- Managing names: Moved to Settings or a floating action — not a full tab

**The mental model shift:** "I don't go to a watchlist. My names follow me through the app."

---

### 5. 📊 Delta-First Report Design

**Current:** Reports are flat card stacks with title, body, status. Every section feels equal.

**Vision — Hierarchy and emphasis:**

```
┌──────────────────────────────────────┐
│  TSLA — Deep Dive                    │
│  March 23, 2026                      │
│                                      │
│  ▼ SIGNAL: NEGATIVE                  │  ← Large, color-coded, impossible to miss
│  ●●●○○ Confidence: Medium            │  ← Visual dots, not just text
│  ──────────────────────              │
│                                      │
│  📌 WHAT CHANGED                     │  ← Delta-first: lead with change
│  Revenue down 8% QoQ. Margin         │
│  compression accelerating.           │
│  ──────────────────────              │
│                                      │
│  ⚡ WHY IT MATTERS                   │  ← Driver explanation
│  Automotive segment declining while  │
│  energy storage can't offset yet.    │
│  ──────────────────────              │
│                                      │
│  ❓ WHAT'S UNCERTAIN                 │  ← Honest uncertainty
│  Q4 guidance was unusually vague.    │
│  Robotaxi timeline unconfirmed.      │
│  ──────────────────────              │
│                                      │
│  📚 FULL SECTIONS                    │  ← Expandable for detail readers
│  ▷ Revenue & Margins                 │
│  ▷ Debt & Liquidity                  │
│  ▷ Management Commentary             │
│  ▷ Evidence (12 sources)             │
└──────────────────────────────────────┘
```

**Key design choices:**
- **Signal + confidence at the top** — not buried at the bottom
- **Three-act structure:** What changed → Why it matters → What's uncertain
- **Sections are collapsible** — detail readers expand, scanners get the story fast
- **Evidence count visible** — builds trust without forcing reading

---

### 6. ✨ Micro-Animations & Transitions

- **Card entrance:** Reports load section-by-section with a subtle slide-up + fade
- **Tab transitions:** Shared-element transitions when moving between Pulse and Deep Dive (e.g., ticker name animates from Pulse mention to Deep Dive header)
- **Pull-to-refresh:** Custom animation — a small Thesis "T" logo pulses while refreshing
- **Haptic feedback:** Subtle vibration on signal reveal ("here's the verdict")
- **Skeleton loading:** Instead of a single spinner, show shimmer placeholder cards matching the report layout

---

### 7. 📱 Smart Empty States That Teach

**Current:** "No pulse loaded yet. Tap refresh." / "No prior reports yet."

**Vision:** Every empty state is an **invitation**, not a dead end:

| State | Current | Should Be |
|---|---|---|
| No Pulse yet | "No pulse loaded yet" | "Your morning pulse arrives daily at 6:30 AM ET. Check back then — or explore a company now." + [Run a Deep Dive →] |
| No Deep Dives | "No prior reports" | "You haven't analyzed a company yet. Search any US stock ticker and get an evidence-backed report in 90 seconds." + [Search →] |
| No Names | "No watchlist tickers" | "Names you're following will appear throughout Thesis — in your morning pulse, in reports. Add up to 20." + [Add your first →] |
| Offline | (crash or blank) | "You're offline. Reports you've already viewed are cached. When you reconnect, everything picks up." |

---

### 8. 🔔 Push That Feels Like a Signal, Not Spam

**Current:** Generic notification.

**Vision:** Push notification copy should feel like your **AI briefly tapping you on the shoulder**:

```
Old:  "Your Morning Pulse is ready. Here's what moved overnight."
New:  "Markets opened lower on CPI surprise. TSLA in the news. → Your Pulse"
```

- **Dynamic copy** pulled from the Pulse headline + user's names
- **If a user's ticker is mentioned**: "AAPL moved +2.3% on supply chain news. Your Pulse is ready."
- **If nothing dramatic**: "Quiet overnight. Your Pulse has the full picture."

---

### 9. 📜 History as a Timeline, Not a List

**Current:** Flat list of report history items with "Open report" chips.

**Vision:** A **visual timeline** grouped by day:

```
── TODAY ──
  📰 Market Pulse — March 23
  🔍 TSLA Deep Dive — Signal: Negative

── YESTERDAY ──
  📰 Market Pulse — March 22
  🔍 AAPL Deep Dive — Signal: Positive
  🔍 MSFT Deep Dive — Signal: Neutral

── MARCH 20 ──
  📰 Market Pulse — March 20
```

Each item shows the **signal color dot** and can be expanded in-place or tapped to full view.

---

### 10. 🎯 The "One More Thing" — Resume Intelligence

When the user reopens the app, don't just show the home screen. **Show awareness of where they left off:**

- "You were reading the TSLA Deep Dive. Pick up where you left off?" + [Resume →]
- If a new Pulse arrived since last visit: "New morning pulse since your last visit" + priority placement

This makes the app feel **alive and aware** — not a static page that resets every launch.

---

## How Stitch + Antigravity Work Together Here

| Step | Tool | What it produces |
|---|---|---|
| 1. Design each screen in Stitch | Stitch | Visual prototypes for Home Loop, Deep Dive report, Pulse, My Names, Empty States |
| 2. Export the designs | You | Kotlin/Compose or Flutter code |
| 3. Bring to Antigravity | Me | Wire up to Product API, add real data bindings, state management, animations, analytics |
| 4. Iterate | Both | Refine until the M8 smoke test passes and Product Lead signs off |

---

## What I Can Do Right Now

1. **Generate visual mockups** of these screen designs for you to review before touching Stitch
2. **Create a detailed Stitch prompting guide** — exact prompts to use for each screen
3. **Start coding the design system** — dark palette, typography, spacing tokens in Compose
4. **Build the component library** — signal indicators, evidence chips, delta bars, skeleton loaders
5. **Prototype the home loop** as a scrollable Compose screen with mock data

> [!IMPORTANT]
> This document is a **vision** — not a locked-in plan. The goal is to give you fresh ideas to iterate on and bring to Stitch as reference. Let me know which directions excite you and we'll go deeper.
