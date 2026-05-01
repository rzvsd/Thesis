# Phase 7 M4 - Pulse Macro News & Geopolitical Shock Layer

## Summary

M4 adds a controlled macro/geopolitical news layer to Pulse. It lets the report account for major approved-source headlines, including shock events, without turning Thesis into a breaking-news terminal.

## Goal

If approved inputs contain a major macro/geopolitical event, Pulse should show it, label confirmation state, and explain why it changes the interpretation of the day.

## Deliverables

- Add `MarketPulseMacroNewsPack`
- Extend `MarketPulseReport` with optional `macro_news`
- Extend Pulse sections with optional `macro_news`
- Add deterministic classification for approved headline inputs
- Render macro news in HTML/PDF with severity and confirmation state
- Add tests and generated evidence artifacts

## Locked Behavior

- Headline/link/time/source only
- No article-body scraping
- No article-body summarization
- No trading language
- Shock claims must show `reported`, `corroborated`, or `official_confirmed`
- A reported shock is not written as confirmed fact

## Acceptance Criteria

- [ ] Contracts validate with and without `macro_news`
- [ ] Calm state builds when no approved macro/geopolitical input exists
- [ ] Shock state builds from approved shock-level headline inputs
- [ ] Renderer shows confirmation state and corroboration count
- [ ] Shock state appears in issue framing
- [ ] No article body text is required or rendered

## Smoke Test

```text
Step 1: Generate a Pulse fixture with a shock-level macro/geopolitical item.
Step 2: Confirm macro_news.state is shock.
Step 3: Confirm the rendered issue shows Macro News near the front.
Step 4: Confirm confirmation state and source count are visible.
Step 5: Confirm the output does not contain article-body text or trading instructions.
```
