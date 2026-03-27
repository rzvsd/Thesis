# M5 - non-technical explanation

M5 makes Deep Dive a real product feature.
If M4 built the secure delivery hallway, M5 is the milestone where that hallway starts delivering a complete, trustworthy analysis output for real companies.

Before M5:
Users could authenticate and create jobs, but the system still needed to prove that a full Company Deep Dive path was reliable, evidence-backed, and honest under real conditions.

After M5:
A supported company can be searched, requested, processed, stored, and retrieved as a complete Deep Dive report with section-level status, evidence, confidence, and disclaimer rules enforced end-to-end.

## What specifically gets built - in plain English

### The supported-company gate becomes real

M5 introduces a real ticker registry path so the system knows which companies are supported and can reject unsupported requests clearly instead of failing later in confusing ways.

### Deep Dive becomes complete, not partial

A valid request now goes all the way through queue + Dexter + storage and comes back as a full report shape expected by the product contract.

### Evidence rules are enforced, not optional

M5 locks in trust rules:
- every scored claim must have named evidence
- directional research signal needs stronger evidence
- if evidence is not strong enough, the system must say `no_signal`

This prevents fake certainty.

### Confidence and disclaimer become mandatory

Every completed report includes confidence context and the required research disclaimer, so users always see both the output and its limits.

### Failure behavior is made safe

If a run fails, the system returns a clean failed state and does not expose partial/half-valid reports as if they were complete.

### Traceability is preserved

Runs are linked with lineage/trace visibility, so the team can inspect what happened rather than guessing after the fact.

## What M5 did NOT build

M5 does not build the morning Market Pulse scheduler pipeline (that is M6).
M5 does not build the full Android MVP user experience (that is M7).
M5 does not add monetization or advanced account policy flows.

M5 is specifically the milestone that proves Company Deep Dive is operationally real, contract-safe, and trust-safe.

## The simple version

M5 answers this question:
Can a supported company request reliably become a complete, evidence-backed Deep Dive report with honest limits and no silent failure behavior?

That is what M5 delivers.

