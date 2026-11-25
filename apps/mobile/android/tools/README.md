# Android redesign tools

Guards and generators for the redesign (`docs/app-redesign/DESIGN-DIRECTION.md`). Run from `apps/mobile/android`.

| Tool | What it does | Typical use |
|---|---|---|
| `design-lint.sh` | Token, motion and copy guard (section 7.2) with a per-file baseline (`design-lint-baseline.txt`) and allowlists (`design-lint-allow.txt`, `design-lint-copy-allow.txt`) | `tools/design-lint.sh` before every commit; `--strict <files>` for a PR-3 WP's owned files; `--update-baseline [files]` when counts go down (with files, only their rows change); `--allow-raise` to move findings between files (the total still may not rise without `--allow-total-raise`); `--self-test` after editing the lint. The copy check covers string literals in `ui/copy/**` and literals passed directly to `Text(` or as `text = "..."` (the letter of 7.2); literals passed through other parameters (`body =`, `title =`, `label =`, `value =`...) are not checked, so a clean copy run is not full coverage: move user-facing copy into `ui/copy` to have it checked. Exit 2 = usage error (unknown option, option without its value, missing `--root` folder) |
| `gold-share.py` | Gold pixel share per render (rubric T3, under 8%) | `python3 tools/gold-share.py design-preview/build/screens`; exit 1 = an image at or over 8%, 2 = bad path or unreadable PNG. Pixels are classified in exact integer arithmetic, so the Pillow/numpy path and the built-in PNG reader count the same pixels; `--self-check <one.png>` proves it on a render (needs Pillow and numpy) |
| `fonts/make_newsreader.py` | The five static Newsreader instances in `app/src/main/res/font` (section 2.3) | one-off; `--roman`/`--italic` point at the variable fonts from google/fonts `ofl/newsreader`; with fontTools 4.68.0 it reproduces the committed files byte for byte (compare the printed sha256 with `sha256sum`) |
| `icons/make_icons.py` | `ui/icons/ThesisIcons.kt` from Material Symbols (section 2.8) | add a glyph to `ICONS`, rerun; `--check` in review |

Requirements: bash and perl 5 (lint), Python 3.9+ (Pillow and numpy speed up `gold-share.py` but are optional),
fontTools for `make_newsreader.py`. Renders come from `design-preview/` (see its README).
