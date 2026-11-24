#!/usr/bin/env python3
"""Generate the five static Newsreader instances bundled in app/src/main/res/font.

One-off tool (not run in CI). Spec: docs/app-redesign/DESIGN-DIRECTION.md section 2.3.

    python3 tools/fonts/make_newsreader.py --roman Newsreader[opsz,wght].ttf \\
        --italic Newsreader-Italic[opsz,wght].ttf [--out app/src/main/res/font]

Sources: the variable Newsreader fonts from github.com/google/fonts (ofl/newsreader), OFL 1.1 with no Reserved
Font Name. Ship app/src/main/assets/licenses/OFL-Newsreader.txt with the fonts.

Each instance is pinned with fontTools.varLib.instancer (wght, opsz), renamed, then subset to Latin-1,
Latin Extended-A, Romanian comma-below letters and the typographic punctuation the app uses, keeping only the
kern, liga, tnum, pnum, case and locl features. Output is deterministic (no timestamps), so re-running with the
same sources gives byte-identical files. Requires fontTools >= 4.40 (pip install fonttools).
"""

from __future__ import annotations

import argparse
import hashlib
import io
import sys
from dataclasses import dataclass
from pathlib import Path

try:
    from fontTools import subset
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer
except ImportError:  # pragma: no cover
    sys.exit("make_newsreader.py needs fontTools: pip install fonttools")

HERE = Path(__file__).resolve().parent
DEFAULT_OUT = HERE.parent.parent / "app" / "src" / "main" / "res" / "font"

# Fixed head.created/modified (2024-01-01T00:00:00Z in the 1904 epoch) for reproducible output.
FIXED_TIMESTAMP = 3_786_825_600


@dataclass(frozen=True)
class Instance:
    file: str  # res/font name (lowercase, underscores: Android resource rules)
    italic: bool
    wght: int
    opsz: int
    family: str  # name table family (nameID 16 typographic family)
    style: str  # nameID 17 typographic subfamily
    use: str


# Section 2.3 table. Compose registers them as: NewsreaderDisplay = {display 400, display_italic 400 italic},
# Newsreader = {text 400, text_semibold 600, medium 500}.
INSTANCES = [
    Instance("newsreader_display.ttf", False, 400, 72, "Newsreader Display", "Regular", "display, title, headline"),
    Instance("newsreader_display_italic.ttf", True, 400, 72, "Newsreader Display", "Italic",
             "chapter numerals, hero line"),
    Instance("newsreader_text.ttf", False, 400, 16, "Newsreader Text", "Regular", "story, lede, upshot"),
    Instance("newsreader_text_semibold.ttf", False, 600, 16, "Newsreader Text", "SemiBold",
             "lead clause, lead phrase"),
    Instance("newsreader_medium.ttf", False, 500, 36, "Newsreader", "Medium",
             "card titles, KPI values, hero figure"),
]


def unicodes() -> list[int]:
    """Latin-1 + Latin Extended-A + Ș ș Ț ț + punctuation (no arrows: Newsreader has none; icons draw them)."""
    cps: set[int] = set(range(0x20, 0x7F)) | set(range(0xA0, 0x100))  # Basic Latin + Latin-1 Supplement
    cps |= set(range(0x100, 0x180))  # Latin Extended-A
    cps |= set(range(0x218, 0x21C))  # Ș ș Ț ț (comma below)
    cps |= set(range(0x2010, 0x2028))  # dashes, quotes, bullet, ellipsis
    cps |= {0x2032, 0x2033, 0x2212, 0x2248, 0x2260, 0x2264, 0x2265, 0x20AC}  # primes, minus, ≈ ≠ ≤ ≥, €
    return sorted(cps)


# Characters the UI depends on; the script fails if an instance lacks one of them.
REQUIRED = "0123456789$%+.,−–—’“”…·×€ȘșȚț"

FEATURES = ["kern", "liga", "tnum", "pnum", "case", "locl"]


def set_names(font: TTFont, inst: Instance) -> None:
    """Static-font naming: RIBBI family/subfamily (1/2) plus typographic family/subfamily (16/17)."""
    name = font["name"]
    ribbi = inst.style in ("Regular", "Italic", "Bold", "Bold Italic")
    legacy_family = inst.family if ribbi else f"{inst.family} {inst.style.replace(' Italic', '')}"
    legacy_style = inst.style if ribbi else ("Italic" if inst.italic else "Regular")
    full = f"{inst.family} {inst.style}"
    ps = f"{inst.family.replace(' ', '')}-{inst.style.replace(' ', '')}"
    # Drop the variable font's instance/axis names; keep copyright, licence, designer, URLs.
    keep = {0, 7, 8, 9, 10, 11, 12, 13, 14}
    name.names = [n for n in name.names if n.nameID in keep]
    for name_id, value in ((1, legacy_family), (2, legacy_style), (3, f"{ps};thesis-static"), (4, full),
                           (5, "Version from variable source; static instance"), (6, ps),
                           (16, inst.family), (17, inst.style)):
        name.setName(value, name_id, 3, 1, 0x409)  # Windows, Unicode BMP, en-US
        name.setName(value, name_id, 1, 0, 0)  # Mac Roman, English
    os2 = font["OS/2"]
    os2.usWeightClass = inst.wght
    sel = os2.fsSelection & ~0b1100001  # clear ITALIC(0), BOLD(5), REGULAR(6)
    if inst.italic:
        sel |= 1
    elif inst.wght == 400:
        sel |= 1 << 6
    if inst.wght >= 700:
        sel |= 1 << 5
    os2.fsSelection = sel
    head = font["head"]
    head.macStyle = (1 if inst.wght >= 700 else 0) | (2 if inst.italic else 0)
    head.created = head.modified = FIXED_TIMESTAMP


def make(inst: Instance, source: Path) -> bytes:
    var = TTFont(source)
    axes = {a.axisTag: (a.minValue, a.maxValue) for a in var["fvar"].axes}
    for tag, value in (("wght", inst.wght), ("opsz", inst.opsz)):
        lo, hi = axes[tag]
        if not lo <= value <= hi:
            raise SystemExit(f"{source.name}: {tag}={value} outside {lo}..{hi}")
    static = instancer.instantiateVariableFont(var, {"wght": inst.wght, "opsz": inst.opsz}, inplace=False)
    set_names(static, inst)

    options = subset.Options()
    options.layout_features = FEATURES
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.notdef_outline = True
    options.glyph_names = False
    options.hinting = False  # the variable sources are unhinted
    options.drop_tables += ["STAT", "fvar", "gvar", "avar", "HVAR", "MVAR", "cvar"]
    sub = subset.Subsetter(options)
    sub.populate(unicodes=unicodes())
    sub.subset(static)

    cmap = static.getBestCmap()
    missing = [f"U+{ord(c):04X}" for c in REQUIRED if ord(c) not in cmap]
    if missing:
        raise SystemExit(f"{inst.file}: required characters missing: {' '.join(missing)}")

    buf = io.BytesIO()
    static.save(buf, reorderTables=True)
    # Saving recalculates head.modified unless told otherwise; pin it again for reproducible bytes.
    font = TTFont(io.BytesIO(buf.getvalue()), recalcTimestamp=False)
    font["head"].modified = FIXED_TIMESTAMP
    out = io.BytesIO()
    font.save(out)
    return out.getvalue()


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--roman", required=True, type=Path, help="variable Newsreader[opsz,wght].ttf")
    ap.add_argument("--italic", required=True, type=Path, help="variable Newsreader-Italic[opsz,wght].ttf")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT, help=f"output folder (default {DEFAULT_OUT})")
    # Section 2.3 estimated about 290 KB; with the specified subset (Latin Extended-A included) the five files
    # measure about 375 KB, almost all of it GPOS kerning. Fail only when something grows unexpectedly.
    ap.add_argument("--budget-kb", type=int, default=400, help="fail when the five files exceed this (KB)")
    args = ap.parse_args(argv)

    args.out.mkdir(parents=True, exist_ok=True)
    total = 0
    for inst in INSTANCES:
        data = make(inst, args.italic if inst.italic else args.roman)
        (args.out / inst.file).write_bytes(data)
        total += len(data)
        digest = hashlib.sha256(data).hexdigest()[:12]
        print(f"{inst.file:34} wght {inst.wght} opsz {inst.opsz:>2}{' italic' if inst.italic else '       '}"
              f"  {len(data) / 1024:6.1f} KB  sha256 {digest}  ({inst.use})")
    print(f"{'total':34} {total / 1024:.1f} KB in {args.out}")
    if total > args.budget_kb * 1024:
        print(f"over the {args.budget_kb} KB budget", file=sys.stderr, flush=True)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
