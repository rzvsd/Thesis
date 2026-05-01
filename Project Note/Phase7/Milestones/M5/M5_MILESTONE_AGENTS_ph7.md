# Phase 7 M5 - User Research State & Analyst Refresh Agent

## Goal

Build the persistent analyst layer that keeps each user's research context current across watchlist names and manual holdings, then feeds Pulse personalization from that maintained state.

## Locked Behavior

- `UserResearchState` owns user-specific research context.
- Pulse remains globally stored and cacheable; authenticated retrieval may overlay the latest user research state.
- Manual holdings are local user-declared context only, not brokerage integration.
- Regex-based `watchlist_overlay` runtime personalization is removed.
- Existing `thesis_monitor_snapshots` remains an input/cache, not a deleted system.
- No LLM generation, trade advice, broker connection, WhatsApp path, Q&A endpoint, or terminal workflow is introduced.

## Acceptance

- Contract-valid complete, partial, and baseline user research states.
- Internal refresh route creates/updates state with omission truth.
- Manual holdings CRUD works without execution semantics.
- Pulse uses typed state for personalization when available.
- Missing inputs produce omissions rather than filler.
- Focused Product API and contract tests pass.

