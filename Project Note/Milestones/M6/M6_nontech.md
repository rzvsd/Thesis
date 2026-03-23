# M6 - non-technical explanation

M6 turns Market Pulse into a daily autopilot briefing.
If M5 proves deep company analysis on request, M6 proves the system can wake itself up each morning, gather overnight context, and deliver a usable briefing automatically.

Before M6:
Market information could be retrieved by services, but there was no complete daily briefing pipeline that ran on schedule, assembled a report, stored it, and notified users as one reliable cycle.

After M6:
At the configured morning time, the scheduler triggers a pulse run, the system gathers market + macro + approved news inputs, builds a structured briefing, stores it, and sends notifications to eligible users.

## What specifically gets built - in plain English

### The morning trigger becomes automatic

M6 gives the system a real scheduled wake-up behavior (timezone-aware) so briefing generation is automatic, not manual.

### Data is assembled from the right sources

Market Pulse uses the data plane services (`data-openbb` + `news-ingest`) and combines inputs into one canonical briefing shape.

### Every section must be explicit

No mystery blanks are allowed.
Each briefing section must carry a status that tells the truth about whether that section is complete or unavailable.

### Degradation is honest, not silent

If one source is down, the whole day does not disappear.
The affected section is marked as unavailable, healthy sections still publish, and users still get a usable report with clear limits.

### Notification delivery is tied to real users

Successful runs send push notifications to users with valid stored device tokens and notification permission.

### Historical retrieval is preserved

Users can access the latest pulse and prior pulse dates through API retrieval, so the briefing is not ephemeral.

### Full failure behavior is controlled

If the whole pipeline fails, no false notification is sent, previous briefing access remains, and operational alerting/logging records the failure.

## What M6 did NOT build

M6 does not redesign Deep Dive reasoning (M3-M5 domain).
M6 does not build the full Android app experience (M7).
M6 does not add per-user custom notification schedule controls.

M6 is the milestone that makes Market Pulse autonomous, reliable, and operationally honest.

## The simple version

M6 answers this question:
Can the system reliably produce and deliver one truthful morning briefing every day without manual intervention?

That is what M6 delivers.

