# ph2_ADR-004: Offline Caching and Prefetching

## Status
Accepted

## Context
The core value proposition of the Android app is delivering the "Morning Pulse" before the user wakes up. For commuters (e.g., subway riders), network connectivity is variable or non-existent. A premium daily habit app cannot fail to load its primary morning content due to a bad cell connection at 7 AM.

## Decision
We will implement local-first caching on the Android client (Phase 2 M9).
- **Storage:** Android Room (SQLite) will serve as the local cache.
- **Retention policy:** Keep exactly one Pulse (latest), keep Fear & Greed current snapshot plus 90-day history, and keep Deep Dive reports in LRU(25). Reports with user notes are pinned and are not evicted by LRU.
- **Prefetch:** Android `WorkManager` runs daily with a 24-hour period and 1-hour flex window, targeting **06:00 America/New_York** (effective execution window 05:30-06:30 ET, DST-aware).
- **UX Fallback:** On app open, immediately render cached content and attempt background sync. If sync fails, keep previous cache and show explicit freshness text ("Offline - showing last synced data").
- **Settings rule:** No manual "clear cache" user control is required in M9.

## Consequences
**Positive:**
- Instantaneous app load times for the Today tab.
- Near 100% reliability for morning commuters without cell service.
- Reduces repetitive load on `product-api` if the user opens the Pulse 5 times a day.

**Negative:**
- Adds complexity to the Android codebase (requires managing single-source-of-truth states between API, Room, and Compose UI).
- Background execution in Android is heavily restricted by OEM battery optimizers (Samsung, Xiaomi, etc.); WorkManager prefetch is inexact by design and may execute later in the defined window.
