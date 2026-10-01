Thesis/                     <- top-level folder on your laptop
|- fintech/                 <- main repo / source of truth
|  |- Project Note/         <- planning + operating docs
|  |  |- Archive/           <- unused or retired documents
|  |  |- Phase1/            <- docs for MVP build (M1–M9)
|  |  |  |- Milestones/
|  |  |  |- AGENTS.md
|  |  |  |- BLUEBOOK cld.md
|  |  |  |- MILESTONES.md
|  |  |  |- PRD.md
|  |  |  |- ROADMAP.md
|  |  |  |- README.md
|  |  |  `- Security.md
|  |  `- Phase2/            <- docs for V2 / Monetization (M1–M9)
|  |     |- Milestones/
|  |     |- ph2_AGENTS.md
|  |     |- ph2_BLUEBOOK.md
|  |     |- ph2_MILESTONES.md
|  |     |- ph2_PRD.md
|  |     |- ph2_ROADMAP.md
|  |     `- ph2_README.md
|  |- Decisions/            <- ADRs
|  |- apps/
|  |  |- mobile/
|  |  |  |- src/            <- temporary Node health shim
|  |  |  `- android/        <- real Kotlin Android app (M7 source of truth)
|  |  |- product-api/
|  |  |- dexter-worker/
|  |  |- data-openbb/
|  |  |- news-ingest/
|  |  `- scheduler/
|  |- packages/
|  |- infra/
|  |- tests/
|  |- qa/
|  |  `- maestro/           <- mobile smoke automation, flows + scripts
|  |- README.md             <- repo root pointer
|  `- new_PRODUCT_ROADMAP.md<- Full Phase 2 feature backlog
`- _tmp_finBase/            <- temporary local clone/work area, not source of truth

Local-only / not pushed to GitHub:
- fintech/.env
- fintech/secrets/
- fintech/apps/mobile/android/app/google-services.json
- C:\Users\razva\.gradle\gradle.properties

Production rule:
- code lives in GitHub
- backend runtime secrets must live on Hetzner
- Android release build secrets must live on the release-build machine / CI
- never rely on one personal laptop as the long-term secret store
