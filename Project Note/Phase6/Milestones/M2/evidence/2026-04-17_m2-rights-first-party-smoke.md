# PH6 M2 Rights & First-Party Context Smoke Proof

**Date:** 2026-04-17  
**Run by:** Codex  
**Environment:** Local Windows workspace, deterministic fixtures, in-memory Product API test store  
**Result:** PASS

---

## Scope

This proof covers Phase 6 M2:

- evidence rights contracts
- first-party source registry seed for AAPL, MSFT, and TSLA
- bounded first-party context fetch endpoint
- Product API rights-aware storage and retrieval
- call artifact storage and retrieval
- safe rejection of unapproved or rights-undefined inputs

No deprecated provider key was required.

---

## Commands

```powershell
corepack pnpm --filter @thesis/contracts typecheck
```

Result: PASS

```powershell
$env:PYTHONPATH='apps/news-ingest/src'; python -m unittest discover -s apps/news-ingest/tests -p 'test_*.py'
```

Result: PASS - 11 tests passed.

```powershell
corepack pnpm --filter @thesis/product-api typecheck
```

Result: PASS

```powershell
corepack pnpm --filter @thesis/product-api test
```

Result: PASS - 78 tests passed.

```powershell
corepack pnpm run phase6:m0:guard
```

Result: PASS - 70 known baseline findings, 0 new protected-path findings.

```powershell
corepack pnpm run security:audit
```

Result: PASS - no known vulnerabilities found.

```powershell
git diff --check
```

Result: PASS - line-ending warnings only, no whitespace errors.

---

## Smoke Steps

| Step | Result | Evidence |
|---|---|---|
| Trigger a first-party fetch for a supported issuer event | PASS | `news-ingest` returned deterministic first-party context for AAPL and MSFT fixtures |
| Confirm source, rights, display mode, and retrieval time | PASS | Context items include `source_domain`, `rights_class=first_party_public`, `display_mode=excerpt_only`, and `retrieved_at` |
| Retrieve a call artifact for an earnings-related event | PASS | Product API stored and retrieved `CallArtifact` with `artifact_type` and `completeness_state` |
| Attempt an unapproved-domain fetch | PASS | `https://example.com/aapl-earnings` returned `SOURCE_REJECTED` and produced no user-facing evidence |
| Attempt rights-undefined storage | PASS | Product API rejected context items without `rights` metadata with HTTP 422 |
| Confirm display-mode rule | PASS | Seed context stores bounded excerpts/links only with `full_text_stored=false` |

---

## Seed Registry Confirmed

| Ticker | Domain | Path scope | Default display mode |
|---|---|---|---|
| `AAPL` | `investor.apple.com` | `/investor-relations/`, `/` | `excerpt_only` |
| `AAPL` | `www.apple.com` | `/newsroom/` | `excerpt_only` |
| `MSFT` | `www.microsoft.com` | `/en-us/investor/`, `/en-us/Investor/` | `excerpt_only` |
| `MSFT` | `news.microsoft.com` | `/` | `excerpt_only` |
| `TSLA` | `ir.tesla.com` | `/`, `/press-release/` | `excerpt_only` |
| `TSLA` | `assets-ir.tesla.com` | `/` | `excerpt_only` |
| `TSLA` | `digitalassets.tesla.com` | `/` | `excerpt_only` |
| `TSLA` | `www.tesla.com` | `/` | `excerpt_only` |

This is seed coverage only. Broad ticker coverage requires reviewed registry entries before use.

---

## Rollback

Rollback is executable by disabling the new first-party fetch endpoint and Product API ingest/read paths while preserving the additive contract files and migration rollback:

```text
infra/migrations/ph6m2_029_first_party_context.down.sql
```

Do not roll back by storing unclassified full text or by reintroducing deprecated provider paths.

---

## Sign-Off State

Owner approval: Approved.  
Engineering closeout: Pending GitHub CI after push/PR.  
