# ADR-002: news-ingest Ingestion Method and Approved Source List

**Date:** 2026-03  
**Status:** Accepted  
**Needed before:** M2  
**Deciders:** Engineering Lead, Product Lead

---

## Context

`news-ingest` needs to retrieve articles from financial news sources. The original Bluebook referenced `news-please`, a Python scraping library. Before building M2, we need to decide the ingestion method and lock down the approved source list. The method choice has significant implications for reliability, legal risk, and maintenance burden.

Three options were considered:

| Method | Pros | Cons |
|---|---|---|
| HTML scraping (news-please) | No API dependency, free | Brittle, anti-scraping blocks, legal gray area with financial publishers |
| RSS feeds | Reliable, lightweight, no ToS issues | Not all sources offer RSS, limited article body content |
| News API (NewsAPI, Diffbot) | Structured, reliable, full content | Cost, API dependency, rate limits |

## Decision

**Primary method: RSS feeds** for sources that offer them.  
**Secondary method: news-please HTML scraping** only for approved sources that do not offer RSS, with explicit per-source maintenance accepted.  
**No third-party news API in v1** — adds cost and an external dependency without sufficient justification at current scale.

### Approved Source List (v1)

| Source | Method | URL |
|---|---|---|
| Reuters | RSS | https://feeds.reuters.com/reuters/businessNews |
| Bloomberg | RSS | https://feeds.bloomberg.com/markets/news.rss |
| Financial Times | RSS | https://www.ft.com/rss/home |
| SEC EDGAR Filings | RSS | https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=10-Q&dateb=&owner=include&count=40&search_text=&output=atom |
| WSJ Markets | HTML scraping | https://www.wsj.com/news/markets |

> **Note:** The approved source list must be reviewed by legal before M5 (public release). Sources can be added only via a Product Lead decision — no engineering-only additions.

## Rationale

- RSS is stable, legally unambiguous, and sufficient for approved sources
- news-please is retained as a fallback only — not the primary method
- Keeping the source list small and curated reduces legal risk and maintenance surface
- A third-party news API can be added post-launch if coverage gaps are identified in production

## Consequences

- `news-ingest` must implement both RSS and HTML scraping paths
- Each source in the approved list must be configured with its method
- `is_approved_source: true` is only set for sources on this list
- Parser failures return empty list with error flag — Dexter treats as `data_unavailable`
- Anti-scraping blocks on HTML sources must be handled gracefully — no crashing

## Revisit When

- An approved source blocks scraping repeatedly in production
- A third-party news API offers materially better coverage at acceptable cost
- Legal review flags a source as problematic
