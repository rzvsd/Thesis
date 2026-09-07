# Phase 7 M9 review

## Scope

Reviewed the M9 milestone brief and evidence, Dexter tool contracts/runner/policy, financial-analysis, evidence-debate and recent-context tools, pipeline integration, runtime configuration, schema validation, focused tool tests, the Dexter worker suite, contracts, typecheck, lint, dependency scan, and changed-file scope. M9 is still relevant as an internal Dexter layer; later M10-M13 work changes Pulse and Deep Dive presentation but does not supersede the tool runner, source policy, or evidence-quality pipeline.

## Findings

### P1 — Fixture recent context is injected into live Deep Dive runs

**Location:** `apps/dexter-worker/src/pipeline.ts:3083-3094`; `apps/dexter-worker/src/tools/recent-context/recent-context-tool.ts:53-61`

**Trigger:** Run with `DEXTER_FIXTURE_MODE=false`, `DEXTER_TOOLS_ENABLED=true`, and `DEXTER_RECENT_CONTEXT_TOOL_ENABLED=true`. `runAnalysisPipeline` calls `runRecentContextTool` without a provider, so the tool constructs `FixtureRecentContextProvider` even in live mode. The fixture provider maps arbitrary tickers to hard-coded AAPL/MSFT/TSLA findings or defaults to the macro-inflation fixture.

**Impact:** Live Deep Dive section prompts receive fabricated, ticker-specific or macro “recent context” as if it were the run's current context. The prompt labels social findings internal-only, but the model can still be biased by them and can repeat them; the resulting customer report is then based on data that was never retrieved for the requested name. The optional feature is disabled by default, but the configuration permits enabling it in live/production mode and `validateLiveModeConfig` does not reject this combination.

**Evidence:** `runRecentContextTool` defaults its provider to `new FixtureRecentContextProvider()`; the pipeline passes no provider. The M9 brief explicitly says the adapter is fixture-only and there is no live `last30days` adapter, so a live run needs an omission/disabled result or an explicit mode guard rather than fixture substitution. Existing evidence proves the fixture-mode path and no-leak fixture test only; it does not exercise tools-enabled live mode.

### P2 — Customer-safety policy helper is not enforced on generated customer text

**Location:** `apps/dexter-worker/src/tools/tool-policy.ts:48-82`; `apps/dexter-worker/src/pipeline.ts:3593-3606`

**Trigger:** A live section executor returns customer-facing text containing a policy-blocked trading term, price-target phrase, or unsupported causality. `assertCustomerSafeText` implements those checks but has no caller. The pipeline only runs `validateAnalysisReport`, which validates the report shape and field types, before returning the report.

**Impact:** M9's source/safety policy is advisory rather than an enforced output boundary. A model can emit prohibited language or restate internal context in a customer section and still produce a schema-valid report. This is especially relevant because the tool prompt explicitly supplies internal-only findings and relies on the model's hard-rule compliance.

**Evidence:** Repository search found `assertCustomerSafeText` only at its definition. The final pipeline path constructs `report`, calls `validateAnalysisReport(report)`, and returns it; no customer-text policy check or sanitizing fallback occurs. The recorded tests exercise the policy predicates directly and prove fixture recent-context non-leakage, but no test feeds a violating live section through final report assembly.

## P3 review

No separate P3 defect was established. The timeout runner's lack of cancellation was not reported because the current M9 recent-context implementation is fixture-only and deterministic; it should be reconsidered when a real external provider is added.

## Validation reviewed/run

Reviewed `Project Note/Phase7/Milestones/M9/evidence/dexter_worker_test.txt`: the Dexter worker suite passed 53 tests, including tool runner success/disabled/timeout/error paths, policy unit tests, financial-analysis, evidence-debate, recent-context, and a tools-enabled fixture Deep Dive with no internal recent-context leakage. Reviewed the M9 contracts, typecheck, lint, dependency-scan, changed-file-scope, and Pulse-stash evidence; each recorded the expected passing result/scope. I did not rerun tests, add tests, or modify source files.

## Gaps

The evidence has no tools-enabled live-mode run, no assertion that fixture recent context is impossible in live mode, no final-report safety-policy regression, and no production configuration check covering enabled M9 tools. The dependency scan also only shows the future `LAST30DAYS_*` configuration strings; it does not demonstrate a live provider implementation.

## Verdict

**M9 is not production-safe as currently implemented.** The deterministic tools and fixture-mode proof are present, but enabling the optional tools in live mode can contaminate prompts with fixture data, and the customer-safety policy is not enforced at the final report boundary. Keep M9 conditional until live mode produces omissions without a real provider and violating generated text is rejected or degraded deterministically.
