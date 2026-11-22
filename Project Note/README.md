# Project Note - Historical Phase Packs

**These files are history. They are not the current source of truth.**

The current state of Thesis is in [`docs/CURRENT_STATE.md`](../docs/CURRENT_STATE.md).
Read that first. When a file in this folder disagrees with `docs/CURRENT_STATE.md` or with
the code, the file in this folder is out of date.

The files stay here unchanged so that the reasons behind past decisions are not lost. Do not
add new PRD, Bluebook, Roadmap or Milestone files here. Record new state in
`docs/CURRENT_STATE.md` and new decisions in [`Decisions/`](../Decisions/README.md).

## What is here

| Folder | What it records |
|---|---|
| `Phase1/` | Original technical foundation, Android MVP, first Deep Dive and Pulse architecture. |
| `Phase2/` | Subscriptions, historical data, UX evolution. |
| `Phase3/` to `Phase5/` | Shipped substrate and the active intelligence engine. |
| `Phase6/` | Official-source-first data plane, safety and hardening, decision locks. |
| `Phase7/` | Pulse briefing work (M1-M12) and Deep Dive memo work (M11-M13). The last active pack. |
| `DeepDive/` | Deep Dive revamp pack, report standard and DDR decision records. |
| `Safety/` | Safety pack and vibe-code safety notes. |
| `Admin/` | Admin notes and the admin login runbook. |
| `Archive/` | Pre-phase drafts. |

## Status words

The phase roadmaps used status words loosely. Read them like this:

| Word | Meaning |
|---|---|
| **Validated** | Implementation evidence files exist (fixture runs, renders, test logs). It does **not** mean live data, real users or production. Every "Validated" milestone in these packs is at this level only. |
| **Done** | Validated, plus a recorded production run on live data, plus owner sign-off. No milestone in these packs reached Done. |
| **Active** | The milestone was the working surface when the pack was last edited. It may be stale. |
| **Deferred** | Accepted scope moved out of the phase. |

The same definitions are in `docs/CURRENT_STATE.md`.
