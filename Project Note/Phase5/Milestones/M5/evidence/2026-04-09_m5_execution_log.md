# Phase 5 M5 Execution Log - Cross-Name Intelligence

Date: 2026-04-09
Run by: Codex
Environment: local memory backends, stub push provider, Product API + Scheduler test lanes

## Implementation Summary

- Added `packages/contracts/src/name-relationship.ts` for relationship records, ingestion payloads, and propagation evaluation payloads.
- Extended Deep Dive report payloads with `name_relationships`.
- Added Dexter Worker relationship extraction via `relationship_extractor` prompt manifest, LangSmith sync hook, report-text fallback parser, runtime validation, and GRAPH fixture proof.
- Added `cross_name_propagation` notification type and alert-ledger relationship context.
- Added Product API durable `name_relationships` persistence with Postgres migration `ph5m5_023_name_relationships`.
- Added internal relationship ingestion endpoint: `POST /internal/name-relationships/ingest`.
- Added internal propagation evaluator endpoint: `POST /internal/notifications/cross-name/evaluate`.
- Added user query endpoint: `GET /v1/names/relationships`.
- Added scheduler daily evaluator hook after kill-switch evaluation.
- Added focused Dexter fixture test in `apps/dexter-worker/tests/pipeline.test.ts`.
- Added focused integration test `apps/product-api/tests/ph5-m5-cross-name.test.ts`.

## Verified Acceptance

- Structured relationship records persist from Deep Dive output.
- Dexter Worker emits report-backed `AnalysisReport.name_relationships` without inventing unsupported edges.
- Relationship confidence and provenance are stored and queryable.
- Material events on source names evaluate propagation candidates.
- Propagated alerts include source ticker, affected ticker, relationship type, confidence, trigger key, and reason text.
- Low-confidence edges remain queryable but do not emit at default `0.70`; stricter override suppression is tested.
- Cross-name propagation alerts are Pro-only; Free users are suppressed.
- Macro-origin events propagate only through `sector` relationships.
- Supplier, competitor, macro-sector, low-confidence, and unrelated-name paths are covered.
- Alert-ledger and route behavior remain backward-compatible.

## Commands Run

```text
corepack pnpm --filter @thesis/contracts typecheck
corepack pnpm --filter @thesis/dexter-worker typecheck
corepack pnpm --filter @thesis/dexter-worker test
corepack pnpm --filter @thesis/product-api typecheck
corepack pnpm --filter @thesis/scheduler typecheck
corepack pnpm --filter @thesis/product-api test
corepack pnpm --filter @thesis/scheduler test
git diff --check
```

## Results

```text
contracts typecheck: PASS
dexter-worker typecheck: PASS
dexter-worker test: PASS - 18/18
product-api typecheck: PASS
scheduler typecheck: PASS
product-api test: PASS - 42/42
scheduler test: PASS - 9/9
git diff --check: PASS - Windows LF-to-CRLF warnings only
```

## Notes

- Mobile code was not touched in M5. Existing Names/Inbox ownership is preserved through `route=names`, alert-ledger context, and `GET /v1/names/relationships`.
- LangSmith prompt registration was not executed because no `LANGSMITH_API_KEY` is available in this environment; local prompt manifest and `langsmith:push-prompts` sync hook are implemented.
- No new service was added.
- GitHub push was deferred until owner closeout instruction; closeout instruction was received on 2026-04-10.
