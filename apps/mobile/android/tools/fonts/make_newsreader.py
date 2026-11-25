#!/usr/bin/env python3
"""Generate the five static Newsreader instances bundled in app/src/main/res/font.

One-off tool (not run in CI). Spec: docs/app-redesign/DESIGN-DIRECTION.md section 2.3.

    python3 tools/fonts/make_newsreader.py --roman Newsreader[opsz,wght].ttf \\
        --italic Newsreader-Italic[opsz,wght].ttf [--out app/src/main/res/font]

Sources: the variable Newsreader fonts from github.com/google/fonts (ofl/newsreader), OFL 1.1 with no Reserved
Font Name. Ship app/src/main/assets/licenses/OFL-Newsreader.txt with the fonts.

Each instance is pinned with fontTools.varLib.instancer (wght, opsz), renamed, then subset to Latin-1,
Latin Extended-A, Romanian comma-below letters and the typographic punctuation the app uses, keeping only the
kern, liga, tnum, pnum, case and locl features. head.modified is copied from the source font (not "now"), so
re-running with the same sources and fontTools 4.68.0 reproduces the committed res/font files byte for byte;
compare the printed sha256 prefixes with `sha256sum app/src/main/res/font/newsreader_*.ttf`. Sources:
https://raw.githubusercontent.com/google/fonts/main/ofl/newsreader/<name>. pip install fonttools==4.68.0.
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


@dataclass(frozen=True)
class Instance:
    file: str  # res/font name (lowercase, underscores: Android resource rules)
    italic: bool
    wght: int
    opsz: int
    style: str  # name suffix: family "Newsreader <style without Italic>", subfamily Regular or Italic
    use: str


# Section 2.3 table. Compose registers them as: NewsreaderDisplay = {display 400, display_italic 400 italic},
# Newsreader = {text 400, text_semibold 600, medium 500}.
INSTANCES = [
    Instance("newsreader_display.ttf", False, 400, 72, "Display", "display, title, headline"),
    Instance("newsreader_display_italic.ttf", True, 400, 72, "Display Italic", "chapter numerals, hero line"),
    Instance("newsreader_text.ttf", False, 400, 16, "Text", "story, lede, upshot"),
    Instance("newsreader_text_semibold.ttf", False, 600, 16, "Text SemiBold", "lead clause, lead phrase"),
    Instance("newsreader_medium.ttf", False, 500, 36, "Medium", "card titles, KPI values, hero figure"),
]


def unicodes() -> list[int]:
    """Latin-1 + Latin Extended-A + Ș ș Ț ț + punctuation (no arrows: Newsreader has none; icons draw them)."""
    return (
        list(range(0x0020, 0x007F))  # Basic Latin
        + list(range(0x00A0, 0x0100))  # Latin-1 Supplement
        + list(range(0x0100, 0x0180))  # Latin Extended-A
        + list(range(0x0218, 0x021C))  # Ș ș Ț ț (comma below)
        + list(range(0x2010, 0x2028))  # dashes, quotes, bullet, ellipsis
        + [0x2032, 0x2033, 0x2212, 0x2248, 0x2260, 0x2264, 0x2265, 0x20AC]  # primes, minus, ≈ ≠ ≤ ≥, €
    )


# Characters the UI depends on; the script fails if an instance lacks one of them.
REQUIRED = "0123456789$%+.,−–—’“”…·×€ȘșȚț"

FEATURES = ["kern", "liga", "tnum", "pnum", "case", "locl"]


def set_names(font: TTFont, style: str) -> None:
    """Gives each instance a distinct, honest name (the OFL has no Reserved Font Name for Newsreader)."""
    family = "Newsreader " + style.replace(" Italic", "")
    sub = "Italic" if style.endswith("Italic") else "Regular"
    full = f"{family} {sub}" if sub != "Regular" else family
    ps = full.replace(" ", "")
    name = font["name"]
    # Drop the variable font's typographic family/subfamily, variations prefix and WWS names.
    for rec in list(name.names):
        if rec.nameID in (16, 17, 21, 22, 25):
            name.removeNames(nameID=rec.nameID)
    for nid, value in ((1, family), (2, sub), (4, full), (6, ps)):
        name.setName(value, nid, 3, 1, 0x409)  # Windows, Unicode BMP, en-US
        name.setName(value, nid, 1, 0, 0)  # Mac Roman, English


def make(inst: Instance, source: Path) -> bytes:
    var = TTFont(source)
    axes = {a.axisTag: (a.minValue, a.maxValue) for a in var["fvar"].axes}
    for tag, value in (("wght", inst.wght), ("opsz", inst.opsz)):
        lo, hi = axes[tag]
        if not lo <= value <= hi:
            raise SystemExit(f"{source.name}: {tag}={value} outside {lo}..{hi}")
    # Full instancing drops fvar/gvar/HVAR/MVAR/avar; the STAT table is kept (as in the committed files).
    static = instancer.instantiateVariableFont(var, {"wght": inst.wght, "opsz": inst.opsz}, inplace=False)
    static["OS/2"].usWeightClass = inst.wght
    fs = static["OS/2"].fsSelection
    fs &= ~((1 << 0) | (1 << 5) | (1 << 6))  # clear ITALIC, BOLD, REGULAR
    fs |= (1 << 0) if inst.italic else 0
    fs |= (1 << 6) if (not inst.italic and inst.wght == 400) else 0
    static["OS/2"].fsSelection = fs
    static["head"].macStyle = 0x02 if inst.italic else 0
    set_names(static, inst.style)

    options = subset.Options()
    options.layout_features = FEATURES
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.notdef_outline = True
    options.glyph_names = False
    options.hinting = False  # the variable sources are unhinted
    options.desubroutinize = True
    sub = subset.Subsetter(options)
    sub.populate(unicodes=unicodes())
    sub.subset(static)

    cmap = static.getBestCmap()
    missing = [f"U+{ord(c):04X}" for c in REQUIRED if ord(c) not in cmap]
    if missing:
        raise SystemExit(f"{inst.file}: required characters missing: {' '.join(missing)}")

    # Reproducible output: keep the source's head.modified instead of "now".
    static["head"].modified = var["head"].modified
    static.recalcTimestamp = False
    buf = io.BytesIO()
    static.save(buf)
    return buf.getvalue()


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--roman", required=True, type=Path, help="variable Newsreader[opsz,wght].ttf")
    ap.add_argument("--italic", required=True, type=Path, help="variable Newsreader-Italic[opsz,wght].ttf")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT, help=f"output folder (default {DEFAULT_OUT})")
    # Section 2.3 estimated about 290 KB; with the specified subset (Latin Extended-A included) the five files
    # measure about 375 KB, almost all of it GPOS kerning. Fail only when something grows unexpectedly.
    ap.add_argument("--budget-kb", type=int, default=400, help="fail when the five files exceed this (KB)")
    args = ap.parse_args(argv)

    # Check the sources before creating --out, so a typo neither leaves an empty folder nor ends in a traceback.
    for flag, path in (("--roman", args.roman), ("--italic", args.italic)):
        if not path.is_file():
            print(f"make_newsreader: {flag} {path}: no such file", file=sys.stderr)
            return 2
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
