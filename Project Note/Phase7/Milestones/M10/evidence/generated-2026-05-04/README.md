# Generated Pulse Evidence - 2026-05-04

This folder contains a local visual-review bundle for the Phase 7 M10 Pulse Morning Brief.

## Contents

- `pulse-2026-05-04-morning-brief.json` - serialized Pulse report used for rendering.
- `pulse-2026-05-04-morning-brief.html` - rendered Morning Brief HTML.
- `pulse-2026-05-04-morning-brief.pdf` - rendered Morning Brief PDF.
- `pulse-2026-05-04-morning-brief.png` - full-page screenshot proof.
- `data-openbb.stdout.log` / `data-openbb.stderr.log` - local adapter run logs.
- `proof.txt` - generation notes and exact artifact paths.

## Scope

These artifacts prove the M10 renderer can produce the May 4 Morning Brief in HTML, PDF, and screenshot form. They were generated locally with `DATA_OPENBB_FIXTURE_MODE=true` and Dexter price-tracker fixture rows supplied to the Product API builder.

They are not a live production-data certification. Production Pulse delivery still depends on the scheduled Product API build path, the configured data providers, and the authenticated app/API export flow.

## Related Runtime Work

The Thesis Android app now requests server-rendered Pulse PDFs through authenticated Product API export endpoints:

- `GET /pulse/latest/export/pdf`
- `GET /pulse/:date/export/pdf`

The app exports the PDF through the Android share sheet from the Pulse screen.
