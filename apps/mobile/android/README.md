# Thesis Android App (M7 Source of Truth)

This directory contains the real Kotlin Native Android app for M7.

Important:
- This Android project is the M7 source of truth for mobile delivery.
- The existing Node health shim under `apps/mobile/src/server.ts` is transitional and is not M7 delivery evidence.
- The shim remains only for temporary baseline compatibility during implementation and should be removed or relocated after M7 stabilization.

## Minimum requirements

- Android Studio Iguana or newer
- Android SDK for API 26+ (minimum), target API 35
- JDK 17

## Build and run

From Android Studio:
1. Open `apps/mobile/android` as a project.
2. Let Gradle sync complete.
3. Run the `app` configuration on an Android device or emulator.

From command line (once Gradle wrapper is available in this folder):
```bash
./gradlew assembleDebug
./gradlew installDebug
```

Optional API base URL override at build/install time:
```bash
./gradlew installDebug -PAPI_BASE_URL=http://127.0.0.1:3001
```

## M7 implementation status

Current implementation includes:
- Kotlin Android app shell with bottom-tab navigation (`Pulse`, `Deep Dive`, `Watchlist`, `Settings`)
- Auth flow wiring (`register`, `verify`, `login`, `logout`, `refresh`)
- Product API integration for ticker search, Deep Dive job/request polling, report retrieval/history, Pulse retrieval (latest + by date), and watchlist CRUD
- Clickable evidence link handoff from reports to browser
- Welcome-first onboarding plus notification toggle and Android settings handoff
- Mobile PostHog wiring for core M7 events and watchlist feature-flag evaluation (`m7_watchlist_enabled`)
- Basic offline/error messaging and pulse deep-link routing support
- Real Firebase client wiring for push validation
- Maestro-based mobile smoke automation under `qa/maestro/`

M7 closeout status:
- Physical-device smoke evidence was completed
- PostHog events and feature-flag behavior were verified
- Real FCM receipt and tap-through were verified
- One owner-approved carry-over remains for M8: explicit Deep Dive full-render proof hardening
