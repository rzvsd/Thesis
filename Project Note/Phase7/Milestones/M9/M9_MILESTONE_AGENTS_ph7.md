# Phase 7 M9 - Dexter Evidence Quality Skills

## Summary

M9 adds a Dexter-native internal evidence skills layer that improves Deep Dive reasoning quality without changing public product surfaces.

The milestone is deliberately not a Pulse revamp, not a trading-agent port, and not a new external dependency adoption. TradingAgents-CN, last30days-skill, and scientific-agent-skills are inspiration only. Thesis keeps the useful idea: better evidence quality, better recent-context awareness, better claim checking, and better internal reasoning tension.

## Goal

Build optional deterministic tools inside `apps/dexter-worker` that help Dexter verify financial math, evaluate evidence quality, and inspect fixture-only recent context before and after Deep Dive section generation.

Plain English: make Dexter harder to fool by its own prose.

## Locked Scope

- Dexter-owned only.
- Tools are internal-only by default.
- Tools are disabled by default in production.
- No Product API contract changes.
- No mobile changes.
- No Docker service changes.
- No public API route.
- No Pulse customer section.
- No external repo import.
- No live `last30days` adapter in M9.

## Deliverables

| Deliverable | Description |
|---|---|
| Tool foundation | `tool-contract`, safe runner, omissions, source policy, evidence conversion, and prompt-context renderer |
| Config flags | Disabled-by-default flags for tools, financial validation, evidence debate, recent context, timeout, max results, and future last30days config |
| Financial validator | Deterministic YoY/QoQ growth, margin, cash conversion, and debt checks from existing financial snapshots |
| Evidence debate evaluator | Deterministic supporting/challenging/unresolved internal review with claim-quality scoring |
| Recent context fixture adapter | Fixture provider for AAPL, MSFT, TSLA, macro inflation, and geopolitical risk |
| Pipeline integration | Internal prompt context before section generation and conservative confidence limits after evidence review |
| Test proof | Focused tool tests plus a tools-enabled Deep Dive fixture test proving no internal recent context leaks |

## Interface Plan

New Dexter files live under:

```text
apps/dexter-worker/src/tools/
apps/dexter-worker/tests/tools/
```

The common tool result shape is:

```text
DexterToolResult<T>
  tool_name
  ok
  generated_at
  data
  evidence
  omissions
  confidence
  visibility
  customer_safe
  notes
```

## Pipeline Order

1. Resolve existing M2 financial/context inputs.
2. Run financial validator.
3. Run fixture-only recent context.
4. Render safe internal tool context into live section prompts.
5. Generate Deep Dive sections normally.
6. Run deterministic evidence debate against produced sections.
7. Apply conservative confidence limiting factors.
8. Validate the normal `AnalysisReport` contract.

## Source And Safety Policy

- Official/company/SEC/FRED/Treasury/BEA/BLS/EIA families may be customer metadata.
- Reddit, X, YouTube, Hacker News, Polymarket, and generic web findings default to internal-only.
- Polymarket is attention/consensus context only, not factual confirmation.
- Internal-only findings cannot be quoted, summarized, attributed, or used as facts in customer copy.
- Tool output never writes directly into a customer section.

## Acceptance Criteria

- [ ] M9 docs and evidence scaffold exist.
- [ ] Tool layer is Dexter-native and dependency-free.
- [ ] All tools are optional and disabled by default.
- [ ] Financial validator produces deterministic evidence and omissions.
- [ ] Debate evaluator produces support/challenge/unresolved analysis without trading language.
- [ ] Recent context fixture adapter works without live external calls.
- [ ] Deep Dive generation remains resilient if any tool fails.
- [ ] No Product API contract, mobile UI, Docker service, public route, broker flow, or Pulse customer section is added.
- [ ] Test output proof is stored under M9 evidence.

## Smoke Test

```text
Step 1: Run the Dexter worker test suite with M9 tool tests included.
Step 2: Confirm tool runner success/disabled/timeout/internal-error paths pass.
Step 3: Confirm source policy blocks trading advice, price targets, position sizing, and unsafe causality.
Step 4: Confirm financial validator computes growth/margins and emits omissions for missing or zero-denominator inputs.
Step 5: Confirm evidence debate scores complete official evidence above incomplete evidence and avoids trading language.
Step 6: Confirm recent context fixtures are bounded, internal-only by default, and Polymarket is not factual confirmation.
Step 7: Run a tools-enabled fixture Deep Dive.
Step 8: Confirm the report remains contract-valid and internal-only recent context does not appear in customer report text.
Step 9: Run contracts, typecheck, and lint.
```

## Rollback

Set `DEXTER_TOOLS_ENABLED=false`. The Deep Dive path remains valid because every tool is optional and omission-forward.

## Owner

Reasoning / ML Engineer + Product Lead
