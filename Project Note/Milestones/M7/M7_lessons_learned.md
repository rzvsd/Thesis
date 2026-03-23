# M7 - lessons learned

## Purpose

This file captures what we learned while delivering M7, so M8 and later milestones move faster with fewer surprises.

## What worked well

### 1. End-to-end validation as the true quality gate

Unit and integration tests were necessary, but not sufficient. The most important confidence came from full device flows across auth, Deep Dive, Pulse, watchlist, and push behavior.

### 2. Maestro smoke automation reduced regressions

Keeping focused M7 smoke flows in `qa/maestro/` gave repeatable proof and made closeout easier to audit.

### 3. Fast bug logging in Linear kept momentum

Creating explicit bug tickets with repro steps and evidence prevented confusion and helped close issues systematically.

### 4. Structured milestone logging improved handoff

Keeping `M7_MILESTONE_AGENTS.md` updated with smoke artifacts, decisions, and deferrals made status transparent and reduced rework during closeout.

### 5. Real push validation mattered

Moving from stub push behavior to real FCM delivery and proving tap-through on device was essential. "Configured" is not the same as "received by a real phone."

## What hurt / where we lost time

### 1. Device and emulator instability

Android emulator instability and device connection issues created friction. Practical takeaway: prefer physical-device proof for milestone acceptance whenever possible.

### 2. Local machine artifacts polluted git status

Android Studio and Gradle generated many local files. Tight `.gitignore` hygiene was required to avoid accidental commit noise.

### 3. Local-vs-production config confusion

Questions around `.env`, `secrets/`, `google-services.json`, and local Gradle properties caused avoidable uncertainty. This is now documented in `Project Note/Security.md`.

### 4. Documentation status drift risk

At closeout, some checkboxes and wording could appear "fully complete" while a known carry-over still existed. Final alignment pass was required to keep milestone status truthful.

## Decisions to preserve going forward

- Keep milestone doctrine strict: if a criterion is carried over, document it explicitly.
- Keep live work in Linear and permanent closure evidence in milestone docs.
- Keep mobile smoke automation narrow and practical; avoid overbuilding test frameworks.
- Keep secrets out of GitHub and treat local files as local-runtime/build material only.

## M7 carry-over

Owner-approved carry-over to M8:
- Deep Dive full-render proof hardening

This is intentional and documented, not hidden.

## Operational checklist for M8 start

1. Reconfirm device connectivity before smoke runs.
2. Reconfirm local secret files are present but untracked.
3. Start from the M8 milestone doctrine and acceptance criteria.
4. Keep Linear ticket-to-criteria mapping strict.
5. Log every deferral explicitly as a carry-over ticket.

## Bottom line

M7 proved the Android MVP is real and usable.
The biggest lesson is simple: real product confidence comes from end-to-end device proof, honest status tracking, and disciplined documentation hygiene.

