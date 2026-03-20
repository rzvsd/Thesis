# M4 - non-technical explanation

M4 builds the secure front door and delivery hallway.
If M3 installed the research brain, M4 is the milestone that makes that brain usable as a real product flow.

Before M4:
The system could run deep-dive research internally, but it was not yet packaged as a safe, user-facing workflow. There was no full identity flow, no reliable job lifecycle management, and no complete retrieval path for finished reports.

After M4:
A user can create an account, verify identity, sign in, request a company deep dive, track the request while it runs, and retrieve the finished report through proper API endpoints. The system now has visible status transitions, durable storage paths, audit history, rate-limit protection, and failure visibility in Sentry.

## What specifically gets built - in plain English

### The secure account entry path

M4 adds the core account lifecycle:
register, verify, log in, refresh session, and log out.

In simple terms, this means the platform now knows who the user is, only allows verified users in, and can safely keep a session alive without forcing constant re-login.

### The protected front door

M4 ensures protected endpoints reject unauthenticated access with clean 401 responses.
That matters because a secure system must fail clearly and safely, not crash or leak internal behavior.

### The job request flow

When a user asks for a deep dive, the system now creates a durable job record and queues it correctly.
This turns the research request into a tracked unit of work, not a fragile one-off call.

### The tracked lifecycle

Each request moves through real states:
queued -> running -> complete or failed.

This gives operational truth. Users and engineers can see exactly where work is, instead of guessing.

### Report storage split that stays clean

M4 enforces the storage boundary:
full report content is stored as an artifact, while report metadata is stored in Postgres.

In plain language, the system keeps heavy report payloads and database indexes in the right places, so retrieval stays reliable and maintainable.

### Retrieval endpoints that work end-to-end

M4 adds and verifies:
- get single report by id
- get report history list
- get job status by id

This is the practical user-facing value: a request can be made, followed, and consumed later.

### Rate-limiting and abuse control

M4 adds clear 429 behavior on request limits.
This protects service stability and prevents noisy traffic from degrading everyone else.

### Audit trail for major actions

M4 records key lifecycle events in an append-only audit stream.
In simple terms, important system actions now leave a permanent breadcrumb trail for troubleshooting and accountability.

### Failure visibility that does not hide truth

M4 proves failed jobs are visible as failed, with error context, and that failures are captured in Sentry.
This is critical trust behavior: when something breaks, the system says so clearly instead of pretending success.

## What M4 did NOT build

M4 does not deliver the full mobile experience.
M4 does not deliver Market Pulse scheduling and delivery.
M4 does not deliver final deep-dive quality/SLA hardening.
M4 does not deliver pricing, quota, billing, or full account-compliance flows.

M4 is the milestone that turns deep-dive capability into a real, secure, operable product pipeline.

## The simple version

M4 answers this question:
can a real user securely request a deep dive, have it processed through a reliable job system, and retrieve results with clear status and failure visibility?

That is what M4 delivers.
