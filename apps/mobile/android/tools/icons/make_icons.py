#!/usr/bin/env python3
"""Generate ui/icons/ThesisIcons.kt: the curated Material Symbols set as Compose ImageVectors.

Spec: docs/app-redesign/DESIGN-DIRECTION.md section 2.8. Material Symbols Outlined, weight 300, grade 0,
optical sizes 24 (bars, buttons) and 20 (inline in rows, chips), plus FILL=1 variants of the four tab glyphs
and Follow. ImageVectors (not XML drawables) so ui/** compiles in design-preview, where R.drawable does not
exist. Back/forward-style glyphs get autoMirror = true (mirrored in RTL).

    python3 tools/icons/make_icons.py                # download (cached) and write ThesisIcons.kt
    python3 tools/icons/make_icons.py --offline      # use only the SVG cache
    python3 tools/icons/make_icons.py --check        # exit 1 if ThesisIcons.kt is not up to date

SVGs come from Google Fonts' static Material Symbols endpoint (fonts.gstatic.com, Apache 2.0) and are cached in
--cache (default ~/.cache/thesis-icons). The output is deterministic. Adding a glyph: append it to ICONS, rerun,
commit the regenerated file (WP-K owns ui/icons during PR-3).
"""

from __future__ import annotations

import argparse
import re
import sys
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from xml.etree import ElementTree

HERE = Path(__file__).resolve().parent
ANDROID = HERE.parent.parent
DEFAULT_OUT = ANDROID / "app/src/main/java/com/thesis/mobile/ui/icons/ThesisIcons.kt"
URL = "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/{name}/{style}/{size}px.svg"
WEIGHT = 300


@dataclass(frozen=True)
class Icon:
    symbol: str  # Material Symbols name
    kotlin: str  # property name on ThesisIcons
    use: str  # one meaning each (section 2.8)
    filled: bool = False  # also generate the FILL=1 variant (<Name>Filled)
    mirror: bool = False  # autoMirror in RTL


# Section 2.8 metaphors first, then the glyphs the components in section 3 name.
ICONS = [
    Icon("today", "Today", "Today tab", filled=True),
    Icon("format_list_bulleted", "Names", "Names tab", filled=True, mirror=True),
    Icon("manage_search", "Research", "Research tab", filled=True),
    Icon("inbox", "Inbox", "Inbox tab", filled=True),
    Icon("search", "Search", "Search"),
    Icon("article", "Pulse", "Pulse"),
    Icon("speed", "MacroStress", "Macro Stress"),
    Icon("menu_book", "DeepDive", "Deep Dive"),
    Icon("event_note", "WarRoom", "War Room"),
    Icon("stacked_line_chart", "ScenarioStress", "Scenario Stress"),
    Icon("history", "History", "History"),
    Icon("edit_note", "Notes", "Notes"),
    Icon("compare_arrows", "Compare", "Compare"),
    Icon("picture_as_pdf", "ExportPdf", "Export PDF"),
    Icon("share", "Share", "Share"),
    Icon("content_copy", "Copy", "Copy"),
    Icon("bookmark", "Follow", "Follow (outline) / following (filled)", filled=True),
    Icon("more_vert", "Overflow", "overflow menu"),
    Icon("open_in_new", "OpenExternal", "open an external link", mirror=True),
    Icon("arrow_back", "Back", "back", mirror=True),
    Icon("arrow_forward", "Forward", "forward / continue", mirror=True),
    Icon("close", "Close", "close"),
    Icon("sort", "Sort", "sort", mirror=True),
    Icon("density_medium", "DensityComfortable", "Comfortable rows"),
    Icon("density_small", "DensityCompact", "Compact rows"),
    Icon("info", "Info", "info / source and definition"),
    Icon("notifications_off", "Quiet", "Quiet 24 h (Inbox swipe)"),
    Icon("check", "Check", "selected / saved"),
    Icon("visibility", "ShowPassword", "Show password"),
    Icon("visibility_off", "HidePassword", "Hide password"),
    Icon("arrow_upward", "Up", "direction mark: up"),
    Icon("arrow_downward", "Down", "direction mark: down"),
    Icon("add", "Add", "add a name"),
    Icon("delete", "Remove", "remove (destructive sheet row)"),
    Icon("error", "Error", "error state / banner"),
    Icon("warning", "Attention", "attention banner"),
    Icon("refresh", "Retry", "try again"),
    Icon("tune", "Filter", "filters"),
    Icon("schedule", "Scheduled", "time / schedule"),
    Icon("logout", "SignOut", "sign out"),
]

SIZES = (24, 20)  # optical sizes: 24 -> ThesisIcons.X, 20 -> ThesisIcons.Small.X


def fetch(icon: str, filled: bool, size: int, cache: Path, offline: bool) -> str:
    style = f"wght{WEIGHT}{'fill1' if filled else ''}"
    path = cache / icon / style / f"{size}px.svg"
    if not path.is_file():
        if offline:
            raise SystemExit(f"not cached (run without --offline): {path}")
        url = URL.format(name=icon, style=style, size=size)
        req = urllib.request.Request(url, headers={"User-Agent": "thesis-make-icons"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read().decode("utf-8")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(data, encoding="utf-8")
    return path.read_text(encoding="utf-8")


def parse(svg: str, what: str) -> tuple[float, float, float, list[str]]:
    """Returns (viewport width, viewport height, translateY, path data list) for a Symbols SVG."""
    # Downloaded data: refuse DTDs/entities before parsing (no XXE or entity expansion with the stdlib parser).
    if "<!DOCTYPE" in svg or "<!ENTITY" in svg or len(svg) > 200_000:
        raise SystemExit(f"{what}: refusing SVG with a DTD, entities or an unexpected size")
    root = ElementTree.fromstring(svg)
    view_box = [float(v) for v in root.attrib["viewBox"].split()]
    min_x, min_y, width, height = view_box
    if min_x != 0:
        raise SystemExit(f"{what}: unexpected viewBox {view_box}")
    paths = [el.attrib["d"] for el in root.iter() if el.tag.endswith("path")]
    if not paths or any(not re.fullmatch(r"[0-9MmLlHhVvCcSsQqTtAaZz.,\- e]+", d) for d in paths):
        raise SystemExit(f"{what}: unexpected path data")
    for el in root.iter():
        tag = el.tag.split("}")[-1]
        if tag not in ("svg", "path"):
            raise SystemExit(f"{what}: unsupported element <{tag}>")
    return width, height, -min_y, paths


def kotlin_string(d: str) -> str:
    return '"' + d.replace("\\", "\\\\").replace('"', '\\"').replace("$", "\\$") + '"'


def generate(cache: Path, offline: bool) -> str:
    out: list[str] = []
    w = out.append
    w("// GENERATED by apps/mobile/android/tools/icons/make_icons.py. Do not edit; rerun the script.")
    w("// Material Symbols Outlined (Apache License 2.0, Google), weight 300, grade 0, from fonts.gstatic.com.")
    w("// Section 2.8 of docs/app-redesign/DESIGN-DIRECTION.md: one meaning per glyph; tint ink2, ink when active.")
    w("@file:Suppress(\"MagicNumber\")")
    w("")
    w("package com.thesis.mobile.ui.icons")
    w("")
    w("import androidx.compose.ui.graphics.Color")
    w("import androidx.compose.ui.graphics.SolidColor")
    w("import androidx.compose.ui.graphics.vector.ImageVector")
    w("import androidx.compose.ui.graphics.vector.addPathNodes")
    w("import androidx.compose.ui.unit.dp")
    w("")

    def emit(indent: str, size: int) -> None:
        for icon in ICONS:
            for filled in ((False, True) if icon.filled else (False,)):
                name = icon.kotlin + ("Filled" if filled else "")
                svg = fetch(icon.symbol, filled, size, cache, offline)
                vw, vh, ty, paths = parse(svg, f"{icon.symbol} {size}px{' fill' if filled else ''}")
                doc = f"{icon.use}{' (selected / filled)' if filled else ''}. Symbols `{icon.symbol}`" \
                      f"{', FILL 1' if filled else ''}, opsz {size}{', mirrored in RTL' if icon.mirror else ''}."
                w(f"{indent}/** {doc} */")
                w(f"{indent}val {name}: ImageVector by lazy {{")
                w(f"{indent}    symbol(")
                w(f"{indent}        name = \"{name}{'' if size == 24 else str(size)}\", size = {size}, "
                  f"viewport = {vw:g}f to {vh:g}f, translateY = {ty:g}f, autoMirror = {str(icon.mirror).lower()},")
                for d in paths:
                    w(f"{indent}        {kotlin_string(d)},")
                w(f"{indent}    )")
                w(f"{indent}}}")
                w("")

    w("/**")
    w(" * The app's icon set. `ThesisIcons.X` is optical size 24 (bars, buttons, 24 dp); `ThesisIcons.Small.X` is")
    w(" * optical size 20 (inline in rows at 20 dp, inside chips at 16 dp). Tab glyphs and Follow have a `XFilled`")
    w(" * variant for the selected state. Never tint icons gold in bulk.")
    w(" */")
    w("object ThesisIcons {")
    emit("    ", 24)
    w("    /** Optical size 20: inline in rows (20 dp) and inside chips (16 dp). */")
    w("    object Small {")
    emit("        ", 20)
    if out[-1] == "":
        out.pop()
    w("    }")
    w("}")
    w("")
    w("private fun symbol(")
    w("    name: String,")
    w("    size: Int,")
    w("    viewport: Pair<Float, Float>,")
    w("    translateY: Float,")
    w("    autoMirror: Boolean,")
    w("    vararg pathData: String,")
    w("): ImageVector {")
    w("    val builder = ImageVector.Builder(")
    w("        name = name,")
    w("        defaultWidth = size.dp,")
    w("        defaultHeight = size.dp,")
    w("        viewportWidth = viewport.first,")
    w("        viewportHeight = viewport.second,")
    w("        autoMirror = autoMirror,")
    w("    )")
    w("    // Symbols SVGs use viewBox 0 -960 960 960: shift the paths down into the viewport.")
    w("    builder.addGroup(translationY = translateY)")
    w("    pathData.forEach { d -> builder.addPath(pathData = addPathNodes(d), fill = SolidColor(Color.Black)) }")
    w("    builder.clearGroup()")
    w("    return builder.build()")
    w("}")
    return "\n".join(out) + "\n"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--cache", type=Path, default=Path.home() / ".cache" / "thesis-icons")
    ap.add_argument("--offline", action="store_true", help="do not download; fail on a cache miss")
    ap.add_argument("--check", action="store_true", help="exit 1 if --out differs from the generated text")
    ap.add_argument("--list", action="store_true", help="print the icon table and exit")
    args = ap.parse_args(argv)

    if args.list:
        for icon in ICONS:
            print(f"{icon.kotlin:20} {icon.symbol:22} {'filled ' if icon.filled else '       '}"
                  f"{'mirror ' if icon.mirror else '       '}{icon.use}")
        return 0
    names = [i.kotlin for i in ICONS]
    if len(set(names)) != len(names) or len({i.symbol for i in ICONS}) != len(ICONS):
        raise SystemExit("duplicate icon name or symbol")

    text = generate(args.cache, args.offline)
    if args.check:
        current = args.out.read_text(encoding="utf-8") if args.out.is_file() else ""
        if current != text:
            print(f"{args.out} is out of date; rerun tools/icons/make_icons.py", file=sys.stderr)
            return 1
        print(f"{args.out} is up to date")
        return 0
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(text, encoding="utf-8")
    variants = sum(2 if i.filled else 1 for i in ICONS)
    print(f"wrote {args.out} ({len(ICONS)} glyphs, {variants} variants x {len(SIZES)} optical sizes, "
          f"{len(text) // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
