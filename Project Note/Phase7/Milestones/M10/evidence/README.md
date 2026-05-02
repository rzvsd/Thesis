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

## Notes

- M10 supersedes the M8 short-form Pulse brief copy cap for the Morning Brief renderer only.
- M9 remains the Dexter Evidence Quality Skills milestone; M10 does not rename or overwrite it.
- The historical Pulse revamp stash was applied into M10 and should not be reapplied after M10 is committed.
