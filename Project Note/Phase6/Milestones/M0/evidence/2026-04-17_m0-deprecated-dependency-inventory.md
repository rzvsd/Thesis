# Phase 6 M0 Deprecated Dependency Inventory

**Date:** 2026-04-17
**Milestone:** Phase 6 M0 - Dependency Audit & Cutover Plan
**Result:** Baseline inventory captured for protected active paths.

This inventory records deprecated-provider or legacy quote-heavy references that still exist before Phase 6 migration work begins. M0 does not remove all of them; it makes them explicit and adds a guard so new protected-path references cannot sneak in.

## Guard Scope

- Protected active paths are scanned and compared against `phase6-deprecated-dependency-baseline.json`.
- Archived Phase1-Phase5 docs and historical evidence are intentionally outside the blocking guard.
- A new protected-path finding fails `pnpm phase6:m0:guard` until it is removed or deliberately added to the M0 baseline with owner review.

## Summary

Total protected-path findings: 70

### alpha-vantage

Count: 6

| File | Line | Match | Context |
|---|---:|---|---|
| `.env.example` | 103 | `ALPHA_VANTAGE_API_KEY` | ALPHA_VANTAGE_API_KEY= |
| `apps/data-openbb/src/service.py` | 114 | `ALPHA_VANTAGE` | "ALPHA_VANTAGE": self.alpha_vantage_rate_limit_per_minute, |
| `docker-compose.yml` | 166 | `ALPHA_VANTAGE_API_KEY` | ALPHA_VANTAGE_API_KEY: "${ALPHA_VANTAGE_API_KEY:-}" |
| `docker-compose.yml` | 166 | `ALPHA_VANTAGE_API_KEY` | ALPHA_VANTAGE_API_KEY: "${ALPHA_VANTAGE_API_KEY:-}" |
| `infra/docker-compose.yml` | 116 | `ALPHA_VANTAGE_API_KEY` | ALPHA_VANTAGE_API_KEY: "${ALPHA_VANTAGE_API_KEY:-}" |
| `infra/docker-compose.yml` | 116 | `ALPHA_VANTAGE_API_KEY` | ALPHA_VANTAGE_API_KEY: "${ALPHA_VANTAGE_API_KEY:-}" |

### fear-greed

Count: 13

| File | Line | Match | Context |
|---|---:|---|---|
| `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/HomeScreen.kt` | 424 | `Fear & Greed` | text = "Fear & Greed", |
| `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/HomeScreen.kt` | 918 | `fearGreed` | val fearGreed = sections.firstOrNull { containsAny(it, "fear", "greed", "sentiment") } |
| `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/HomeScreen.kt` | 924 | `fearGreed` | TodayPhase.PRE_MARKET -> listOf(fearGreed, earnings, contrarian, marketMoves, weeklyDigest) |
| `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/HomeScreen.kt` | 925 | `fearGreed` | TodayPhase.MARKET_HOURS -> listOf(marketMoves, fearGreed, contrarian, earnings, weeklyDigest) |
| `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/HomeScreen.kt` | 926 | `fearGreed` | TodayPhase.AFTER_HOURS -> listOf(marketMoves, fearGreed, earnings, weeklyDigest, contrarian) |
| `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/OnboardingScreen.kt` | 77 | `Fear & Greed` | sampleLabel = "Fear & Greed", |
| `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/SentimentDashboardScreen.kt` | 416 | `Fear & Greed` | text = "Fear & Greed Dashboard", |
| `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/WeeklyDigestScreen.kt` | 119 | `Fear & Greed` | text = "Fear & Greed", |
| `apps/product-api/src/sentiment.ts` | 8 | `fear-greed` | } from "../../../packages/fear-greed-engine/src"; |
| `apps/product-api/src/server.ts` | 7122 | `Fear & Greed` | ? `Fear & Greed: ${latestFearGreed.score} (${latestFearGreed.label}).` |
| `apps/product-api/src/server.ts` | 7123 | `Fear & Greed` | : "Fear & Greed data is not ready yet.", |
| `packages/contracts/src/index.ts` | 21 | `fear-greed` | export * from "./fear-greed-snapshot"; |
| `packages/fear-greed-engine/package.json` | 2 | `fear-greed` | "name": "@thesis/fear-greed-engine", |

### fmp

Count: 21

| File | Line | Match | Context |
|---|---:|---|---|
| `apps/data-openbb/src/service.py` | 108 | `FMP` | "FMP": self.fmp_finance_rate_limit_per_minute, |
| `apps/data-openbb/src/service.py` | 33 | `FMP` | COMPANY_PROVIDER = "FMP" |
| `apps/data-openbb/src/service.py` | 34 | `FMP` | MACRO_PROVIDER = "FMP" |
| `apps/data-openbb/src/service.py` | 348 | `FMP` | message="FMP returned no usable macro observations for live mode.", |
| `apps/data-openbb/src/service.py` | 777 | `fmp` | provider="fmp", |
| `apps/data-openbb/src/service.py` | 788 | `fmp` | provider="fmp", |
| `apps/data-openbb/src/service.py` | 799 | `fmp` | provider="fmp", |
| `apps/data-openbb/src/service.py` | 822 | `fmp` | provider="fmp", |
| `apps/data-openbb/tests/test_service.py` | 102 | `FMP` | self.assertEqual(finance_data["provider"], "FMP") |
| `apps/data-openbb/tests/test_service.py` | 112 | `FMP` | self.assertEqual(payload["provider"], "FMP") |
| `apps/data-openbb/tests/test_service.py` | 117 | `FMP` | self.assertEqual(macro_data["provider"], "FMP") |
| `apps/data-openbb/tests/test_service.py` | 127 | `FMP` | self.assertEqual(finance_data["provider"], "FMP") |
| `apps/data-openbb/tests/test_service.py` | 277 | `FMP` | self.assertEqual(payload["provider"], "FMP") |
| `apps/data-openbb/tests/test_service.py` | 289 | `FMP` | self.assertEqual(payload["provider"], "FMP") |
| `apps/data-openbb/tests/test_service.py` | 353 | `FMP` | limiter.acquire("FMP", rate_limit_key="FMP_FINANCE") |
| `apps/data-openbb/tests/test_service.py` | 354 | `FMP` | limiter.acquire("FMP", rate_limit_key="FMP_MACRO") |
| `apps/data-openbb/tests/test_service.py` | 357 | `FMP` | limiter.acquire("FMP", rate_limit_key="FMP_FINANCE") |
| `apps/data-openbb/tests/test_service.py` | 387 | `FMP` | limiter.acquire("FMP", rate_limit_key="FMP_FINANCE") |
| `apps/data-openbb/tests/test_service.py` | 388 | `FMP` | limiter.acquire("FMP", rate_limit_key="FMP_FINANCE") |
| `apps/data-openbb/tests/test_service.py` | 391 | `FMP` | limiter.acquire("FMP", rate_limit_key="FMP_FINANCE") |
| `apps/data-openbb/tests/test_service.py` | 97 | `FMP` | self.assertEqual(payload["provider"], "FMP") |

### hf-transcript-corpus

Count: 4

| File | Line | Match | Context |
|---|---:|---|---|
| `.env.example` | 187 | `kurry/sp500_earnings_transcripts` | M0_HF_DATASET_ID=kurry/sp500_earnings_transcripts |
| `.env.example` | 187 | `M0_HF_DATASET_ID` | M0_HF_DATASET_ID=kurry/sp500_earnings_transcripts |
| `apps/data-openbb/src/historical_loader.py` | 99 | `kurry/sp500_earnings_transcripts` | hf_dataset_id=values.get("M0_HF_DATASET_ID", "kurry/sp500_earnings_transcripts").strip(), |
| `apps/data-openbb/src/historical_loader.py` | 99 | `M0_HF_DATASET_ID` | hf_dataset_id=values.get("M0_HF_DATASET_ID", "kurry/sp500_earnings_transcripts").strip(), |

### openbb-library

Count: 3

| File | Line | Match | Context |
|---|---:|---|---|
| `apps/data-openbb/requirements.txt` | 3 | `openbb_platform` | git+https://github.com/rzvsd/finBase.git@dddc3b328284bb953b6e5468b167b39c78490001#subdirectory=openbb_platform |
| `apps/data-openbb/src/service.py` | 696 | `import openbb` | import openbb # type: ignore |
| `apps/data-openbb/src/service.py` | 705 | `openbb.` | self._obb = openbb.obb |

### polygon

Count: 6

| File | Line | Match | Context |
|---|---:|---|---|
| `.env.example` | 102 | `POLYGON_API_KEY` | POLYGON_API_KEY= |
| `apps/data-openbb/src/service.py` | 113 | `POLYGON` | "POLYGON": self.polygon_rate_limit_per_minute, |
| `docker-compose.yml` | 165 | `POLYGON_API_KEY` | POLYGON_API_KEY: "${POLYGON_API_KEY:-}" |
| `docker-compose.yml` | 165 | `POLYGON_API_KEY` | POLYGON_API_KEY: "${POLYGON_API_KEY:-}" |
| `infra/docker-compose.yml` | 115 | `POLYGON_API_KEY` | POLYGON_API_KEY: "${POLYGON_API_KEY:-}" |
| `infra/docker-compose.yml` | 115 | `POLYGON_API_KEY` | POLYGON_API_KEY: "${POLYGON_API_KEY:-}" |

### yfinance

Count: 17

| File | Line | Match | Context |
|---|---:|---|---|
| `apps/data-openbb/requirements.txt` | 8 | `yfinance` | yfinance |
| `apps/data-openbb/src/service.py` | 111 | `YFINANCE` | "YFINANCE": self.yfinance_rate_limit_per_minute, |
| `apps/data-openbb/src/service.py` | 35 | `yfinance` | CALENDAR_PROVIDER = "yfinance" |
| `apps/data-openbb/src/service.py` | 831 | `yfinance` | import yfinance as yf # type: ignore |
| `apps/data-openbb/src/service.py` | 837 | `yfinance` | message="yfinance is not installed for live calendar mode.", |
| `apps/data-openbb/tests/test_service.py` | 151 | `yfinance` | self.assertEqual(payload["provider"], "yfinance") |
| `apps/data-openbb/tests/test_service.py` | 158 | `yfinance` | self.assertEqual(first_event["provider"], "yfinance") |
| `apps/product-api/src/sentiment.ts` | 326 | `yahoo_finance` | provider: "yahoo_finance", |
| `apps/product-api/src/sentiment.ts` | 336 | `yahoo_finance` | "yahoo_finance", |
| `apps/product-api/src/sentiment.ts` | 352 | `yahoo_finance` | provider: "yahoo_finance", |
| `apps/product-api/src/sentiment.ts` | 362 | `yahoo_finance` | "yahoo_finance", |
| `apps/product-api/src/sentiment.ts` | 386 | `yahoo_finance` | provider: "yahoo_finance", |
| `apps/product-api/src/sentiment.ts` | 396 | `yahoo_finance` | "yahoo_finance", |
| `apps/product-api/src/sentiment.ts` | 439 | `yahoo_finance` | provider: "yahoo_finance", |
| `apps/product-api/src/sentiment.ts` | 450 | `yahoo_finance` | "yahoo_finance", |
| `apps/product-api/src/server.ts` | 1422 | `yfinance` | const provider = typeof row.provider === "string" ? row.provider : "yfinance"; |
| `apps/product-api/src/server.ts` | 5675 | `yfinance` | provider: event.provider ?? "yfinance", |

## Secret Cleanup Classification

| Secret/env | Current M0 state | Owner | Expected exit |
|---|---|---|---|
| `FMP_API_KEY` | deprecated / inventoried | Platform Architect + Data Platform | Removed from core smoke path by M1/M5 |
| `POLYGON_API_KEY` | deprecated / inventoried | Platform Architect + Data Platform | Removed from core smoke path by M1/M5 |
| `ALPHA_VANTAGE_API_KEY` | deprecated / inventoried | Platform Architect + Data Platform | Removed from core smoke path by M1/M5 |
| `FMP_*_RATE_LIMIT*` | deprecated / inventoried | Platform Architect + Data Platform | Removed or archived when provider path exits |
| `POLYGON_*_RATE_LIMIT*` | deprecated / inventoried | Platform Architect + Data Platform | Removed or archived when provider path exits |
| `M0_HF_DATASET_ID` | rights-ambiguous transcript corpus / deprecated | Platform Architect + Product | Replaced by first-party call artifacts and rights-clean transcript policy |

## Rollback Note

Rollback for M0 means removing the CI/package guard command and reverting the generated baseline/inventory files. It does not require data rollback because M0 changes policy and evidence only.

