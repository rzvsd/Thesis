#!/usr/bin/env python3
"""gold-share.py: share of gold pixels in renders (rubric T3, principle 3: under 8%).

    python3 tools/gold-share.py design-preview/build/screens            # every PNG in the folder
    python3 tools/gold-share.py a-dark.png a-light.png --max 8           # explicit files
    python3 tools/gold-share.py screens --glob 'home*' --json            # machine-readable

A pixel is gold when its HSV hue is 35-45 degrees and its saturation is above 0.35 (section 7.1, T3). One
addition: its value (brightness) must be at least --min-value (default 0.20). Without it, the dark theme's page
glow (#C5A059 at 16% over #0A0A0A = hue 39, saturation 0.43, value 0.16) counts as gold on every dark screen,
although nobody reads it as gold; pass --min-value 0 for the literal rule. Kit galleries (kit-*.png) are
skipped unless --include-kit: palette and icon sheets show gold on purpose.

Exit 0 when every image is under --max percent, 1 otherwise, 2 on usage errors. Uses Pillow (+ numpy) when
installed; otherwise a small built-in PNG reader (8-bit RGB/RGBA, non-interlaced, as Skia writes them).

The test is exact integer arithmetic on the 8-bit channels (see is_gold), so both backends count the same pixels:
a float test puts colours whose hue is exactly 45 degrees on different sides of the boundary in float32 and float64.
`--self-check FILE` measures FILE with both backends and fails unless they agree to the pixel.
"""

from __future__ import annotations

import argparse
import json
import math
import struct
import sys
import zlib
from pathlib import Path

HUE_MIN, HUE_MAX = 35, 45  # degrees, inclusive
SAT_MIN = 0.35  # exclusive: 20 * delta > 7 * max


def min_level(min_value: float) -> int:
    """--min-value as the lowest 8-bit max channel that passes (value = max / 255), rounding away float noise."""
    return math.ceil(round(min_value * 255.0, 9))


def is_gold(r: int, g: int, b: int, min_max: int) -> bool:
    """Exact HSV test on 8-bit channels; min_max is min_level(--min-value).

    HSV hue lies in 0-60 degrees only when red is the maximum channel (ties included: red wins, as in colorsys),
    and then hue = 60 * (g - b) / delta. So 35 <= hue <= 45  <=>  35 * delta <= 60 * (g - b) <= 45 * delta
    <=>  7 * delta <= 12 * (g - b) <= 9 * delta. Saturation delta / max > 0.35  <=>  20 * delta > 7 * max.
    """
    mx = max(r, g, b)
    delta = mx - min(r, g, b)
    return (r == mx and 7 * delta <= 12 * (g - b) <= 9 * delta and 20 * delta > 7 * mx and mx >= min_max)


def read_rgb(path: Path, builtin: bool = False):
    """Returns (width, height, pixels): a numpy int32 array (h, w, 3) of 0-255, or a list of (r, g, b) tuples."""
    if not builtin:
        try:
            from PIL import Image  # type: ignore
            import numpy as np  # type: ignore

            with Image.open(path) as im:
                arr = np.asarray(im.convert("RGB"), dtype=np.int32)
            return arr.shape[1], arr.shape[0], arr
        except ImportError:
            pass
    return _read_png(path)


def _read_png(path: Path):
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"{path}: not a PNG")
    pos, idat, width = 8, [], None
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos:pos + 4])
        kind = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + length]
        if kind == b"IHDR":
            width, height, depth, ctype, _, _, interlace = struct.unpack(">IIBBBBB", body)
            if depth != 8 or ctype not in (2, 6) or interlace:
                raise ValueError(f"{path}: only 8-bit RGB/RGBA non-interlaced PNGs (install Pillow for others)")
            channels = 3 if ctype == 2 else 4
        elif kind == b"IDAT":
            idat.append(body)
        elif kind == b"IEND":
            break
        pos += 12 + length
    raw = zlib.decompress(b"".join(idat))
    stride = width * channels
    prev = bytearray(stride)
    pixels = []
    i = 0
    for _ in range(height):
        ftype = raw[i]
        line = bytearray(raw[i + 1:i + 1 + stride])
        i += 1 + stride
        for x in range(stride):
            a = line[x - channels] if x >= channels else 0
            b = prev[x]
            c = prev[x - channels] if x >= channels else 0
            if ftype == 1:
                line[x] = (line[x] + a) & 0xFF
            elif ftype == 2:
                line[x] = (line[x] + b) & 0xFF
            elif ftype == 3:
                line[x] = (line[x] + ((a + b) >> 1)) & 0xFF
            elif ftype == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 0xFF
        prev = line
        pixels.extend((line[x], line[x + 1], line[x + 2]) for x in range(0, stride, channels))
    return width, height, pixels


def gold_count(path: Path, min_value: float, builtin: bool = False) -> tuple[int, int]:
    """Returns (gold pixels, total pixels)."""
    width, height, px = read_rgb(path, builtin)
    total = width * height
    min_max = min_level(min_value)
    if total == 0:
        return 0, 0
    if not isinstance(px, list):  # numpy fast path, same integer test as is_gold
        r, g, b = px[..., 0], px[..., 1], px[..., 2]
        mx = px.max(axis=2)
        delta = mx - px.min(axis=2)
        gb = 12 * (g - b)
        gold = (r == mx) & (7 * delta <= gb) & (gb <= 9 * delta) & (20 * delta > 7 * mx) & (mx >= min_max)
        return int(gold.sum()), total
    count = 0
    cache: dict[tuple[int, int, int], bool] = {}
    for rgb in px:
        hit = cache.get(rgb)
        if hit is None:
            hit = cache[rgb] = is_gold(rgb[0], rgb[1], rgb[2], min_max)
        count += hit
    return count, total


def gold_share(path: Path, min_value: float, builtin: bool = False) -> float:
    count, total = gold_count(path, min_value, builtin)
    return count * 100.0 / total if total else 0.0


def self_check(path: Path, min_value: float) -> int:
    """Both backends on one file: exit 0 when they count the same pixels, 1 when not, 2 without Pillow/numpy."""
    try:
        import numpy  # type: ignore  # noqa: F401
        from PIL import Image  # type: ignore  # noqa: F401
    except ImportError:
        print("gold-share: --self-check needs Pillow and numpy to compare against", file=sys.stderr)
        return 2
    import colorsys

    # Colours whose hue is exactly 45 degrees (float32 put them on both sides), gold, glow and grey: is_gold must
    # match colorsys with the float noise rounded away.
    for rgb in ((56, 48, 24), (128, 106, 40), (197, 160, 89), (35, 27, 15), (10, 10, 10), (255, 213, 0)):
        h, s, v = colorsys.rgb_to_hsv(*(c / 255.0 for c in rgb))
        ref = round(s, 9) > SAT_MIN and v >= min_value and HUE_MIN <= round(h * 360.0, 6) <= HUE_MAX
        if is_gold(*rgb, min_level(min_value)) != ref:
            print(f"gold-share: self-check FAILED on {rgb}: is_gold disagrees with HSV", file=sys.stderr)
            return 1
    fast, total = gold_count(path, min_value)
    slow, total2 = gold_count(path, min_value, builtin=True)
    ok = fast == slow and total == total2
    print(f"gold-share: self-check {path.name}: Pillow/numpy {fast} px, built-in {slow} px of {total} "
          f"({'agree' if ok else 'DISAGREE'})")
    return 0 if ok else 1


class UsageError(Exception):
    """A bad invocation or an unreadable input: exit 2, never confused with 'over budget' (exit 1)."""


def collect(paths: list[str], pattern: str, include_kit: bool) -> list[Path]:
    files: list[Path] = []
    for p in map(Path, paths):
        if p.is_dir():
            files.extend(sorted(p.glob(pattern if pattern.endswith(".png") else pattern + ".png")))
        elif p.is_file():
            files.append(p)
        else:
            raise UsageError(f"gold-share: no such file or folder: {p}")
    if not include_kit:
        files = [f for f in files if not f.name.startswith("kit-")]
    return files


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Share of gold pixels per render (rubric T3).")
    ap.add_argument("paths", nargs="+", help="PNG files or folders of PNGs")
    ap.add_argument("--max", type=float, default=8.0, help="fail at or above this percent (default 8)")
    ap.add_argument("--min-value", type=float, default=0.20, help="minimum HSV value of a gold pixel (default 0.20)")
    ap.add_argument("--glob", default="*.png", help="file pattern inside folders (default *.png)")
    ap.add_argument("--include-kit", action="store_true", help="also measure kit-*.png gallery sheets")
    ap.add_argument("--json", action="store_true", help="print JSON instead of a table")
    ap.add_argument("--self-check", action="store_true",
                    help="measure the one PNG given with both backends and fail unless they agree to the pixel")
    args = ap.parse_args(argv)

    if args.self_check:
        if len(args.paths) != 1 or not Path(args.paths[0]).is_file():
            print("gold-share: --self-check takes exactly one PNG file", file=sys.stderr)
            return 2
        return self_check(Path(args.paths[0]), args.min_value)

    try:
        files = collect(args.paths, args.glob, args.include_kit)
    except UsageError as e:
        print(e, file=sys.stderr)
        return 2
    if not files:
        print("gold-share: no PNGs to measure", file=sys.stderr)
        return 2
    results = []
    for f in files:
        try:
            results.append((f, gold_share(f, args.min_value)))
        except Exception as e:  # noqa: BLE001 - OSError, ValueError, PIL.UnidentifiedImageError, zlib.error...
            print(f"gold-share: cannot read {f}: {type(e).__name__}: {e}", file=sys.stderr)
            return 2
    over = [(f, s) for f, s in results if s >= args.max]
    if args.json:
        print(json.dumps({"max": args.max, "minValue": args.min_value,
                          "images": [{"file": str(f), "goldPercent": round(s, 3)} for f, s in results],
                          "over": [str(f) for f, _ in over]}, indent=2))
    else:
        width = max(len(f.name) for f, _ in results)
        for f, s in results:
            flag = "  OVER" if s >= args.max else ""
            print(f"{f.name:<{width}}  {s:6.2f}%{flag}")
        print(f"gold-share: {len(results)} image(s), max {max(s for _, s in results):.2f}%, "
              f"{len(over)} at or above {args.max:g}%")
    return 1 if over else 0


if __name__ == "__main__":
    sys.exit(main())
