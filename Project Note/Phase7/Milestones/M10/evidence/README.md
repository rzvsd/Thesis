# M10 Evidence

Phase 7 M10 validates the Pulse A+ Morning Brief Engagement Overhaul.

## Required Proof

- `product_api_test.txt` - full `@thesis/product-api` suite, including Pulse render tests
- `contracts_test.txt` - `@thesis/contracts` contract compatibility proof
- `dexter_worker_test.txt` - Dexter Pulse editorial and worker regression proof
- `typecheck.txt` - workspace typecheck proof
- `lint.txt` - workspace lint proof
- `changed_files_scope.txt` - scoped files changed for M10
- `render_artifact_proof.txt` - sample artifact generation proof
- `m10_sample_morning_brief.html` - sample rendered Morning Brief HTML
- `m10_sample_morning_brief.pdf` - sample rendered Morning Brief PDF
- `m10_sample_morning_brief_fullpage.png` - headless Chrome visual sanity screenshot
- `generated-2026-05-04/` - May 4 Pulse Morning Brief artifacts generated locally for visual review; this folder is fixture-backed evidence, not a production live-data claim

## Notes

- M10 supersedes the M8 short-form Pulse brief copy cap for the Morning Brief renderer only.
- M9 remains the Dexter Evidence Quality Skills milestone; M10 does not rename or overwrite it.
- The historical Pulse revamp stash was applied into M10 and should not be reapplied after M10 is committed.
- The May 4 generated artifacts use `DATA_OPENBB_FIXTURE_MODE=true` and Dexter price-tracker fixture inputs so the PDF/HTML can be reviewed deterministically.
- Pulse PDF export in the Thesis app is implemented through authenticated Product API export endpoints and Android share-sheet integration; it is separate from the checked-in static evidence artifacts.
