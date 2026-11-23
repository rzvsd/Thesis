# Jobs

Code that runs on GitHub Actions for the serverless rebuild. Owners are in `docs/rebuild/OWNERSHIP.md`.

| Folder | Owner | What runs |
| --- | --- | --- |
| `ops/` | M0 | Weekly encrypted database dump (`rebuild-backup.yml`) |
| `deep-dive/` | M2 | Deep Dive runner, started by `workflow_dispatch` with a job id |
| `data/` | M3 | Python fetch scripts (prices, filings, headlines, macro, sentiment) |
| `daily/`, `weekly/` | M3 | Steps of the daily and weekly workflows |
| `pdf/` | M4 | PDF rendering with Chromium |

Rules: jobs call the API's internal routes with `THESIS_INTERNAL_TOKEN`; they do not hold the database password.
Every workflow has a timeout, `cancel-in-progress` where safe, and a minutes budget (`docs/rebuild/DECISIONS.md` D7).
