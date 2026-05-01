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

Total protected-path findings: 60

### alpha-vantage

Count: 6

| File | Line | Match | Context |
|---|---:|---|---|
| `.env.example` | 109 | `ALPHA_VANTAGE_API_KEY` | ALPHA_VANTAGE_API_KEY= |
| `apps/data-openbb/src/service.py` | 468 | `ALPHA_VANTAGE` | "ALPHA_VANTAGE": self.alpha_vantage_rate_limit_per_minute, |
| `docker-compose.yml` | 185 | `ALPHA_VANTAGE_API_KEY` | ALPHA_VANTAGE_API_KEY: "${ALPHA_VANTAGE_API_KEY:-}" |
| `docker-compose.yml` | 185 | `ALPHA_VANTAGE_API_KEY` | ALPHA_VANTAGE_API_KEY: "${ALPHA_VANTAGE_API_KEY:-}" |
| `infra/docker-compose.yml` | 131 | `ALPHA_VANTAGE_API_KEY` | ALPHA_VANTAGE_API_KEY: "${ALPHA_VANTAGE_API_KEY:-}" |
| `infra/docker-compose.yml` | 131 | `ALPHA_VANTAGE_API_KEY` | ALPHA_VANTAGE_API_KEY: "${ALPHA_VANTAGE_API_KEY:-}" |

### fear-greed

Count: 5

| File | Line | Match | Context |
|---|---:|---|---|
| `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/OnboardingScreen.kt` | 77 | `Fear & Greed` | sampleLabel = "Fear & Greed", |
| `apps/mobile/android/app/src/main/java/com/thesis/mobile/ui/screens/WeeklyDigestScreen.kt` | 119 | `Fear & Greed` | text = "Fear & Greed", |
| `apps/product-api/src/sentiment.ts` | 8 | `fear-greed` | } from "../../../packages/fear-greed-engine/src"; |
| `packages/contracts/src/index.ts` | 26 | `fear-greed` | export * from "./fear-greed-snapshot"; |
| `packages/fear-greed-engine/package.json` | 2 | `fear-greed` | "name": "@thesis/fear-greed-engine", |

### fmp

Count: 21

| File | Line | Match | Context |
|---|---:|---|---|
| `apps/data-openbb/src/service.py` | 462 | `FMP` | "FMP": self.fmp_finance_rate_limit_per_minute, |
| `apps/data-openbb/src/service.py` | 38 | `FMP` | COMPANY_PROVIDER = "FMP" |
| `apps/data-openbb/src/service.py` | 39 | `FMP` | MACRO_PROVIDER = "FMP" |
| `apps/data-openbb/src/service.py` | 719 | `FMP` | message="FMP returned no usable macro observations for live mode.", |
| `apps/data-openbb/src/service.py` | 2077 | `fmp` | provider="fmp", |
| `apps/data-openbb/src/service.py` | 2088 | `fmp` | provider="fmp", |
| `apps/data-openbb/src/service.py` | 2099 | `fmp` | provider="fmp", |
| `apps/data-openbb/src/service.py` | 2122 | `fmp` | provider="fmp", |
| `apps/data-openbb/tests/test_service.py` | 566 | `FMP` | limiter.acquire("FMP", rate_limit_key="FMP_FINANCE") |
| `apps/data-openbb/tests/test_service.py` | 570 | `FMP` | limiter.acquire("FMP", rate_limit_key="FMP_FINANCE") |
| `apps/data-openbb/tests/test_service.py` | 600 | `FMP` | limiter.acquire("FMP", rate_limit_key="FMP_FINANCE") |
| `apps/data-openbb/tests/test_service.py` | 601 | `FMP` | limiter.acquire("FMP", rate_limit_key="FMP_FINANCE") |
| `apps/data-openbb/tests/test_service.py` | 604 | `FMP` | limiter.acquire("FMP", rate_limit_key="FMP_FINANCE") |
| `apps/data-openbb/tests/test_service.py` | 567 | `FMP` | limiter.acquire("FMP", rate_limit_key="FMP_MACRO") |
| `apps/data-openbb/tests/test_service.py` | 168 | `FMP` | self.assertEqual(finance_data["provider"], "FMP") |
| `apps/data-openbb/tests/test_service.py` | 287 | `FMP` | self.assertEqual(finance_data["provider"], "FMP") |
| `apps/data-openbb/tests/test_service.py` | 183 | `FMP` | self.assertEqual(macro_data["provider"], "FMP") |
| `apps/data-openbb/tests/test_service.py` | 163 | `FMP` | self.assertEqual(payload["provider"], "FMP") |
| `apps/data-openbb/tests/test_service.py` | 178 | `FMP` | self.assertEqual(payload["provider"], "FMP") |
| `apps/data-openbb/tests/test_service.py` | 490 | `FMP` | self.assertEqual(payload["provider"], "FMP") |
| `apps/data-openbb/tests/test_service.py` | 502 | `FMP` | self.assertEqual(payload["provider"], "FMP") |

### hf-transcript-corpus

Count: 4

| File | Line | Match | Context |
|---|---:|---|---|
| `.env.example` | 206 | `kurry/sp500_earnings_transcripts` | M0_HF_DATASET_ID=kurry/sp500_earnings_transcripts |
| `.env.example` | 206 | `M0_HF_DATASET_ID` | M0_HF_DATASET_ID=kurry/sp500_earnings_transcripts |
| `apps/data-openbb/src/historical_loader.py` | 99 | `kurry/sp500_earnings_transcripts` | hf_dataset_id=values.get("M0_HF_DATASET_ID", "kurry/sp500_earnings_transcripts").strip(), |
| `apps/data-openbb/src/historical_loader.py` | 99 | `M0_HF_DATASET_ID` | hf_dataset_id=values.get("M0_HF_DATASET_ID", "kurry/sp500_earnings_transcripts").strip(), |

### openbb-library

Count: 3

| File | Line | Match | Context |
|---|---:|---|---|
| `apps/data-openbb/requirements-live.txt` | 5 | `openbb_platform` | git+https://github.com/rzvsd/finBase.git@dddc3b328284bb953b6e5468b167b39c78490001#subdirectory=openbb_platform |
| `apps/data-openbb/src/service.py` | 1996 | `import openbb` | import openbb # type: ignore |
| `apps/data-openbb/src/service.py` | 2005 | `openbb.` | self._obb = openbb.obb |

### polygon

Count: 6

| File | Line | Match | Context |
|---|---:|---|---|
| `.env.example` | 108 | `POLYGON_API_KEY` | POLYGON_API_KEY= |
| `apps/data-openbb/src/service.py` | 467 | `POLYGON` | "POLYGON": self.polygon_rate_limit_per_minute, |
| `docker-compose.yml` | 184 | `POLYGON_API_KEY` | POLYGON_API_KEY: "${POLYGON_API_KEY:-}" |
| `docker-compose.yml` | 184 | `POLYGON_API_KEY` | POLYGON_API_KEY: "${POLYGON_API_KEY:-}" |
| `infra/docker-compose.yml` | 130 | `POLYGON_API_KEY` | POLYGON_API_KEY: "${POLYGON_API_KEY:-}" |
| `infra/docker-compose.yml` | 130 | `POLYGON_API_KEY` | POLYGON_API_KEY: "${POLYGON_API_KEY:-}" |

### yfinance

Count: 15

| File | Line | Match | Context |
|---|---:|---|---|
| `apps/data-openbb/requirements.txt` | 8 | `yfinance` | yfinance==1.2.0 |
| `apps/data-openbb/src/service.py` | 465 | `YFINANCE` | "YFINANCE": self.yfinance_rate_limit_per_minute, |
| `apps/data-openbb/src/service.py` | 40 | `yfinance` | CALENDAR_PROVIDER = "yfinance" |
| `apps/data-openbb/src/service.py` | 2131 | `yfinance` | import yfinance as yf # type: ignore |
| `apps/data-openbb/src/service.py` | 2137 | `yfinance` | message="yfinance is not installed for live calendar mode.", |
| `apps/data-openbb/tests/test_service.py` | 318 | `yfinance` | self.assertEqual(first_event["provider"], "yfinance") |
| `apps/data-openbb/tests/test_service.py` | 311 | `yfinance` | self.assertEqual(payload["provider"], "yfinance") |
| `apps/product-api/src/sentiment.ts` | 336 | `yahoo_finance` | "yahoo_finance", |
| `apps/product-api/src/sentiment.ts` | 362 | `yahoo_finance` | "yahoo_finance", |
| `apps/product-api/src/sentiment.ts` | 396 | `yahoo_finance` | "yahoo_finance", |
| `apps/product-api/src/sentiment.ts` | 450 | `yahoo_finance` | "yahoo_finance", |
| `apps/product-api/src/sentiment.ts` | 326 | `yahoo_finance` | provider: "yahoo_finance", |
| `apps/product-api/src/sentiment.ts` | 352 | `yahoo_finance` | provider: "yahoo_finance", |
| `apps/product-api/src/sentiment.ts` | 386 | `yahoo_finance` | provider: "yahoo_finance", |
| `apps/product-api/src/sentiment.ts` | 439 | `yahoo_finance` | provider: "yahoo_finance", |

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

