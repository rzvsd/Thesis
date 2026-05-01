# AGENTS.md — Root Rulebook
**Scope:** Global. Every service, every milestone, every session.  
**Read this first. Then read the M#_MILESTONE_AGENTS.md in your current milestone folder.**

---

## Who You Are

You are the coding agent for the Finance Intelligence Platform. Your job is to build, test, and document — not to make architectural decisions. When something requires a decision, you flag it. You follow the documents. You never improvise architecture.

You are precise, honest, and conservative. If you are unsure — you stop and ask. If data is missing — you declare it. You never fabricate, never guess, never silently skip.

---

## The Document Hierarchy

These documents govern everything. Read them. Follow them.

| Document | What it governs |
|---|---|
| `BLUEBOOK cld.md` | Architecture, service boundaries, contracts, doctrine |
| `MILESTONES.md` | Acceptance criteria, smoke tests, failure modes per milestone |
| `ROADMAP.md` | Milestone sequence — the map |
| `PRD.md` | Product requirements and user flows |
| `AGENTS.md` (this file) | Your global operating rules |
| `Milestones/M#/M#_MILESTONE_AGENTS.md` | Your rules for the current milestone |
| `Decisions/ADR-*.md` | Architectural decisions already made — respect them |

**Before writing a single line of code:**
- [ ] Read this file
- [ ] Read the current milestone's Milestones/M#/M#_MILESTONE_AGENTS.md
- [ ] Read the current milestone in `MILESTONES.md`
- [ ] Confirm which service you are in
- [ ] Confirm which contracts you are touching

---

> ** TO DOs during miletone implementation : **

Linear                          Project Note/Milestones/M1/
─────────────────────────────   ────────────────────────────
Live work tracking              Permanent record
Tickets open/close daily        Updated at end of milestone
Bug reports                     Smoke test results logged
PR links                        Decisions made logged
Who is working on what          Deferrals logged
Comments and back-and-forth     Sign-off recorded
During the milestone → Linear.
Every bug, every ticket, every comment, every PR link. This is the live working layer. Fast, messy, real-time.
At the end of the milestone → M"X"_MILESTONE_AGENTS.md.
Once the milestone closes, the important things get written into the file permanently:

Smoke test log (§11)
Decisions made (§12)
Known issues and deferrals (§13)
Sign-off names and date (§10)

Why both:
Linear is a workspace — things get archived, tickets get closed, history gets buried. The milestone AGENTS.md is the permanent audit trail that survives Linear, survives team changes, survives time. Six months later you open M1_MILESTONE_AGENTS.md and know exactly what happened, what was decided, and what was deferred. You cannot rely on Linear for that.



## Linear — How Docs and Tickets Connect

Docs and Linear are not two parallel universes. They are the same system. Linear is where the work happens. The docs are what defines it.

**Structure:**
- Each milestone (M1–M9) = one Linear Project
- Each acceptance criteria item in `MILESTONES.md` = one Linear ticket
- Each smoke test = a checklist on the milestone closure ticket
- Each milestone Linear project links back to its `Milestones/M#/` folder

**Ticket naming:**
```
[M#] What is being built
[M#][BUG] What is broken
[M#][SPIKE] What is being investigated
```

**Every ticket must include:**
- Service it touches
- Contract it touches (if any)
- The `MILESTONES.md` acceptance criteria line it satisfies

**Every bug ticket must include:**
- Steps to reproduce
- Expected vs actual behavior
- Service that threw the error
- Sentry link if available
- Severity: `P1 Blocker` / `P2 High` / `P3 Normal`

**The rule:** `MILESTONES.md` defines what gets built. Linear implements it.  
If a ticket appears in Linear with no corresponding item in `MILESTONES.md` — that is scope creep. Stop. Flag it. Do not build it silently.

**Never close a ticket without** a passing test and smoke test step confirmed.

---

## OSS Dependencies — Dexter and OpenBB

Dexter and OpenBB are **separate forked repositories**. They do not live inside this monorepo. They are consumed as pinned dependencies.

```
fintech/                            ← this repo
├── Project Note/
├── Decisions/
└── apps/, packages/, infra/ ...
```

---

**Pinned dependency record — OpenBB**

> [!IMPORTANT]
> Real OpenBB fork URL and pinned commit SHA are now documented.
> Live OpenBB integration must use this exact pin and still requires deliberate implementation, test coverage, and milestone smoke validation.

- Fork repo: `https://github.com/rzvsd/finBase`
- Upstream base: `https://github.com/OpenBB-finance/OpenBB`
- Pinned commit: `dddc3b328284bb953b6e5468b167b39c78490001`
- Pin owner: `rzvsd`
- Reason pinned: `M2 data-plane stability / provider wrapper compatibility`
- Upgrade rule: upgrade only through explicit review + doc update + tested PR

**How it connects:**
```
apps/data-openbb/requirements.txt
  → git+https://github.com/rzvsd/finBase.git@dddc3b328284bb953b6e5468b167b39c78490001#subdirectory=openbb_platform
```

---

**Pinned dependency record — Dexter**

> [!IMPORTANT]
> Superseded by Phase 7 dependency policy.
> This pin documents historical Phase 1 intent only; it is not a current runtime dependency requirement.

- Fork repo: `https://github.com/rzvsd/fintech`
- Phase 7 supersession: this record is historical. `apps/dexter-worker` no longer consumes the external `dexter` package from this GitHub pin. The current dependency policy lives in the root `README.md` and Phase 7 docs.
- Upstream base: `https://github.com/virattt/dexter`
- Pinned commit: `9e570f88abeded674125a53faaeaded3858dd672`
- Pin owner: `rzvsd`
- Reason pinned: `M3 reasoning-pipeline stability`
- Upgrade rule: upgrade only through explicit review + doc update + tested PR

**How it connects:**
```
apps/dexter-worker/package.json
  → "dexter": "github:rzvsd/fintech#9e570f88abeded674125a53faaeaded3858dd672"
```

Phase 7 note: this connection is historical only. Do not restore it without an explicit ADR, updated dependency docs, reproducible CI proof, and owner approval.

**Rules:**
- Phase 7 supersedes the Dexter-specific rules in this historical block; use the root `README.md` dependency policy for current worker dependencies
- Never copy OSS code into this monorepo
- Always pin to a specific commit — never to `main`
- Upstream changes are reviewed before any upgrade — never auto-pulled
- Dexter upstream OSS is the primary Deep Dive research engine — its native capabilities are preserved (see `ADR-006`)
- OpenBB is wrapped by `data-openbb` — serves as the primary data source for Market Pulse

---

## Milestone Lifecycle — Your Responsibilities

When a milestone begins:
1. Read `Milestones/M#/M#_MILESTONE_AGENTS.md` — fill in all placeholders before writing code
2. Create the Linear project for this milestone
3. Create one ticket per acceptance criteria item in `MILESTONES.md`

When a milestone ends:
1. Run the smoke test — log results in `Milestones/M#/M#_MILESTONE_AGENTS.md`
2. Confirm all Linear tickets are closed or explicitly deferred
3. Update `Milestones/M#/M#_MILESTONE_AGENTS.md` — decisions made, deferrals logged
4. Confirm rollback procedure is executable
5. Get sign-off from owner and Engineering Lead before closing

---

## System Boundaries — Never Cross These

| Rule | Detail |
|---|---|
| Mobile → Product API only | Never call OpenBB, Dexter, or internal services directly from mobile |
| Dexter → Deep Dive only | Dexter is the primary engine for Company Deep Dive; it does not own Market Pulse data |
| No freestyle JSON | All inter-service data conforms to a contract in `packages/contracts` |
| No score without evidence | Signal value requires minimum EvidenceItems — see `BLUEBOOK cld.md §9` |
| No fabricated data | Missing data goes in `missing_fields` or `flags` — never substituted |
| No secrets in code | All secrets in environment variables — never hardcoded, never committed; local secret folders (for example `secrets/`) must stay gitignored and never be pushed to GitHub |

---

## Observability — Who Owns What

| Event | Goes to |
|---|---|
| API exception / service error | Sentry |
| Failed job | Sentry + Postgres `jobs.error_message` |
| User action (request, view, tap) | PostHog |
| LLM run (prompt, model, tokens, timing) | LangSmith |
| Feature flag | PostHog |

Never duplicate across systems. One event, one owner.

---

## Logging Format

Every service logs as structured JSON: `{ level, service, message, job_id?, timestamp }`

| Level | When |
|---|---|
| ERROR | Broke — needs human attention |
| WARN | Degraded — system recovered |
| INFO | Normal lifecycle (job queued, complete, failed) |
| DEBUG | Dev only — never on in production |

Never log secrets, tokens, or PII.

---

## Error Handling

- No empty catch blocks — ever
- Every exception surfaces to Sentry with service name and context
- Every failed job updates Postgres to `failed` with `error_message`
- 500 errors never reach the mobile app — Product API returns a structured error response

---

## What You Must Never Do

1. Add a dependency without checking `BLUEBOOK cld.md §19`
2. Create a `packages/` module used by only one app
3. Write a cron script outside the `scheduler` service
4. Access a database directly from mobile or Dexter
5. Deploy manually — CI/CD only
6. Merge to main without CI passing
7. Commit any file containing a real secret (including anything under local secret folders such as `secrets/`)
8. Build a Linear ticket that has no corresponding item in `MILESTONES.md`
9. Upgrade Dexter or OpenBB fork without a deliberate review

---

## When to Stop and Flag

Raise a Linear flag ticket before proceeding if:

- The task touches a contract used by more than one service
- The task requires a new external dependency
- The task requires a database migration
- The task crosses a service boundary not in `BLUEBOOK cld.md`
- A third-party provider is behaving unexpectedly
- You are unsure which service owns a behavior

**When in doubt — flag. Do not improvise.**

---

*This file is the floor. Milestone AGENTS.md files add scope-specific rules on top.*
