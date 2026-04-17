# Thesis - Phase 6 Security, Source, and Fetch Policy

**Status:** Working Phase 6 Note  
**Last Revised:** 2026-04-16  
**Scope:** Phase 6 source governance, secret cleanup, rights-aware storage, and bounded fetch policy

---

## 1. Purpose

This file explains how Phase 6 handles:

- source classes
- fetch permissions and limits
- storage/display rights
- legacy provider-secret cleanup
- production expectations for official-source-first operation

It does not replace the root `Security.md`. It extends it for the final data-substrate architecture phase. `PH6_DECISION_LOCKS.md` controls the minimum source registry, transcript stance, guard scope, and evidence format before implementation begins.

---

## 2. Core Rule

**A source is not production-safe until both its technical access path and its rights posture are documented.**

Phase 6 rejects the old assumption that "publicly reachable" means "safe to store and redistribute."

---

## 3. Source Classes

### 3.1 Official public sources

Examples:

- SEC / EDGAR / XBRL / filing exhibits
- official macro agencies and official public datasets
- official rates / FX / energy / fiscal releases from approved public institutions

Use:

- hard truth
- canonical event generation
- deterministic calculations

### 3.2 First-party corporate sources

Examples:

- IR pages
- company-hosted press releases
- investor presentations
- webcast landing pages
- company-hosted supplemental materials

Use:

- bounded enrichment
- event-driven fetches only
- call artifacts

### 3.3 Allowlisted bounded context sources

Examples:

- headline/summary/link feeds
- allowlisted RSS feeds

Use:

- context enrichment only
- display and storage constrained by the documented rights posture

### 3.4 Prohibited default sources

Examples:

- paid market-data providers in the core path
- personal-use wrappers
- broad news-site scraping
- broad transcript corpus scraping
- any source requiring login bypass, anti-bot evasion, or unclear redistribution assumptions

---

## 4. Official-Source Access Hygiene

### 4.1 SEC and official source discipline

- use a compliant `User-Agent`
- obey documented or conservative rate limits
- keep retries bounded and back off on throttling
- use nightly reconciliation where the source supports bulk or replay-safe refresh
- do not rely on one-off ad hoc pulls as the only source of truth

### 4.2 Revision awareness

Where official macro sources revise data:

- store `retrieved_at`
- store the reporting period and release identifier where possible
- allow the product to mark "revised since prior pull"

---

## 5. First-Party Fetch Policy

First-party fetches are allowed only under these conditions:

1. the domain is on an approved allowlist
2. the fetch is tied to an event trigger, watchlist target, or scheduled bounded review
3. the fetch path is documented
4. the storage/display mode is known before the content becomes user-facing

### Forbidden fetch behavior

- broad domain crawling
- login-wall bypass
- anti-bot evasion
- uncontrolled HTML capture for "maybe useful later" text warehousing

---

## 6. Rights-Aware Storage Policy

Every evidence or context item must carry at least:

- `rights_class`
- `display_mode`
- `source_type`
- `source_rank`
- `retrieved_at`

### Display modes

- `full_text_allowed`
- `excerpt_only`
- `headline_only`
- `link_only`
- `internal_only_not_user_visible`

If the display mode is unknown, default to the safest non-display posture until reviewed.

---

## 7. Transcript and Call-Artifact Rule

Transcript text is not assumed safe by default.

Phase 6 product-safe preference order:

1. filed earnings release and exhibits
2. first-party slide deck or management materials
3. first-party webcast page or official call references
4. transcript text only when the provenance and rights posture are documented well enough to use

This rule applies to storage, display, and downstream LLM context construction.

---

## 8. Legacy Secret Cleanup

Phase 6 requires a documented inventory of deprecated secrets and environment variables, including but not limited to:

- old OpenBB provider keys
- FMP keys
- Polygon keys
- Alpha Vantage keys
- any yfinance- or wrapper-specific credentials or fallback toggles

### Hard rule

These secrets must not remain required for core local smoke tests, CI, or staging production paths after the relevant Phase 6 milestone closes.

Archival retention for rollback is allowed only if:

- it is documented,
- it is not the active default,
- and it is clearly marked deprecated.

### Guard scope

The dependency guard is a production-path safety control, not a historical-document eraser. It protects active code, runtime config, contracts, mobile production code, and active Phase 6 docs. Archived Phase1-Phase5 docs and evidence may mention old providers only as superseded history.

---

## 9. Production Expectations

Production must not depend on:

- a developer laptop for source allowlists
- a developer laptop for secret files
- ad hoc undocumented scraping behavior
- hidden provider fallback environment variables

Production must be able to run the core Thesis intelligence loop from:

- server-side official/public-source configuration
- documented allowlists
- documented event-driven fetch rules
- documented secrets for the remaining non-provider infrastructure

---

## 10. Security Proof Required For Closeout

A Phase 6 source path is not considered complete until the milestone evidence shows:

- the source path respects the documented source class
- the storage/display rights are enforced
- the old provider dependency is no longer required in the affected production path
- observability captures failures in source retrieval and rights enforcement
