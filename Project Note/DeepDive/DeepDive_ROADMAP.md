# Deep Dive Revamp Roadmap

**Status:** M8 closeout pending; M9 implementation complete with final closeout pending
**Last Revised:** 2026-04-22

---

## Implementation Order

```text
M0 Report Standard and Interface Lock
  -> M1 Structured Report Contract
  -> M2 Financial Analysis Engine
  -> M3 Value Discipline Scorecard
  -> M4 Research Authoring Engine
  -> M5 Institutional PDF Export
  -> M5.2 Visual Exhibits Layer
  -> M6 Mobile Research Reader
  -> M7 End-to-End Quality and Device Proof
  -> M8 Due Diligence Default Upgrade
  -> M9 Verbose Due Diligence Authoring And Editorial PDF Upgrade
```

---

## Why This Order

| Milestone | Why It Comes Here |
|---|---|
| M0 | Locks the shape before code spreads |
| M1 | Contracts must exist before services and mobile consume new fields |
| M2 | Deterministic numbers must exist before narrative and visuals |
| M3 | Value discipline depends on financial metrics from M2 |
| M4 | Dexter authors around structured facts from M1-M3 |
| M5 | PDF renders the artifact once the artifact is rich enough |
| M5.2 | Visual exhibit language is locked in PDF before mobile inherits it |
| M6 | Mobile reader uses the same artifact and exhibit language, avoiding fake UI-first data |
| M7 | Device and regression proof close the foundation workstream |
| M8 | Reopens the workstream on top of the proven foundation so `Deep Dive` becomes a due diligence-default product without breaking compatibility |
| M9 | Hardens M8 into a verbose editorial report with issuer metadata and HTML/CSS-to-PDF export while preserving summary-first mobile behavior |

M0 also locks the reference mapping, report template, and test matrix. These are not optional design notes; they are gates for M1-M9 and M5.2.

Milestone naming stays in the existing DeepDive style:

- whole-number milestones continue the main line of work, so the follow-on path after `M7` continues through `M8` and `M9`
- decimal-suffix milestones remain reserved for inserted slices between locked whole-number milestones, as with `M5.2`

---

## Release Shape

| Release Slice | User-Visible Outcome |
|---|---|
| M0-M1 | No visible user change; report contract becomes ready |
| M2-M3 | Reports gain real financial/value substance |
| M4 | Writing becomes memo-like and company-specific |
| M5 | Downloaded report becomes structurally serious |
| M5.2 | Downloaded report becomes visually publication-worthy |
| M6 | Mobile Deep Dive feels like a research reader with shared exhibit language |
| M7 | Full workflow foundation is proven and documented |
| M8 | Deep Dive stays the same entrypoint, but the default artifact becomes a full due diligence report with summary-first mobile behavior |
| M9 | Deep Dive keeps the M8 artifact shape, but the report becomes more editorial, issuer-aware, and HTML/CSS-to-PDF export quality while mobile stays summary-first inline expand |

Every release slice must preserve the user-facing promise: the output should feel like a serious research report, not a short generated summary.

---

## Regression Baseline

Every slice that touches report generation or rendering must preserve:

- login
- Research tab
- Deep Dive run
- job polling
- report history
- report detail
- offline cache
- notes
- feedback
- scenario controls
- existing old-report rendering
- `investment_memo` compatibility behavior
