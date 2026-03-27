# ph2_ADR-004: Offline Caching and Prefetching

## Status
Accepted

## Context
The core value proposition of the Android app is delivering the "Morning Pulse" before the user wakes up. For commuters (e.g., subway riders), network connectivity is variable or non-existent. A premium daily habit app cannot fail to load its primary morning content due to a bad cell connection at 7 AM.

## Decision
We will implement local-first caching on the Android client (Phase 2 M9).
- **Storage:** Android Room (SQLite) will serve as the local cache.
- **Prefetch:** Android `WorkManager` will be configured to fire a background network request between 5 AM and 6:30 AM ET every morning to silently download the day's Morning Pulse.
- **UX Fallback:** When the app is opened, it immediately displays the `Room` cache. A background sync will attempt to fetch updates; if it fails, the UI will display an "Offline - showing last synced data" indicator.

## Consequences
**Positive:**
- Instantaneous app load times for the Today tab.
- Near 100% reliability for morning commuters without cell service.
- Reduces repetitive load on `product-api` if the user opens the Pulse 5 times a day.

**Negative:**
- Adds complexity to the Android codebase (requires managing single-source-of-truth states between API, Room, and Compose UI).
- Background execution in Android is heavily restricted by OEM battery optimizers (Samsung, Xiaomi, etc.); the WorkManager prefetch is not guaranteed to fire perfectly at 5 AM on aggressively optimized devices.
