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
"""

from __future__ import annotations

import argparse
import colorsys
import json
import struct
import sys
import zlib
from pathlib import Path

HUE_MIN, HUE_MAX = 35.0, 45.0
SAT_MIN = 0.35


def read_rgb(path: Path):
    """Returns (width, height, pixels) where pixels is a numpy array (h, w, 3) or a list of (r, g, b) tuples."""
    try:
        from PIL import Image  # type: ignore
        import numpy as np  # type: ignore

        with Image.open(path) as im:
            arr = np.asarray(im.convert("RGB"), dtype=np.float32) / 255.0
        return arr.shape[1], arr.shape[0], arr
    except ImportError:
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


def gold_share(path: Path, min_value: float) -> float:
    width, height, px = read_rgb(path)
    total = width * height
    if total == 0:
        return 0.0
    if not isinstance(px, list):  # numpy fast path
        import numpy as np  # type: ignore

        r, g, b = px[..., 0], px[..., 1], px[..., 2]
        mx = px.max(axis=2)
        mn = px.min(axis=2)
        delta = mx - mn
        sat = np.where(mx > 0, delta / np.maximum(mx, 1e-9), 0.0)
        safe = np.maximum(delta, 1e-9)
        hue = np.where(
            mx == r, ((g - b) / safe) % 6.0, np.where(mx == g, (b - r) / safe + 2.0, (r - g) / safe + 4.0)
        ) * 60.0
        hue = np.where(delta > 0, hue, -1.0)
        gold = (hue >= HUE_MIN) & (hue <= HUE_MAX) & (sat > SAT_MIN) & (mx >= min_value)
        return float(gold.sum()) * 100.0 / total
    count = 0
    cache: dict[tuple[int, int, int], bool] = {}
    for rgb in px:
        hit = cache.get(rgb)
        if hit is None:
            h, s, v = colorsys.rgb_to_hsv(rgb[0] / 255.0, rgb[1] / 255.0, rgb[2] / 255.0)
            hit = s > SAT_MIN and v >= min_value and HUE_MIN <= h * 360.0 <= HUE_MAX
            cache[rgb] = hit
        count += hit
    return count * 100.0 / total


def collect(paths: list[str], pattern: str, include_kit: bool) -> list[Path]:
    files: list[Path] = []
    for p in map(Path, paths):
        if p.is_dir():
            files.extend(sorted(p.glob(pattern if pattern.endswith(".png") else pattern + ".png")))
        elif p.is_file():
            files.append(p)
        else:
            raise SystemExit(f"gold-share: no such file or folder: {p}")
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
    args = ap.parse_args(argv)

    files = collect(args.paths, args.glob, args.include_kit)
    if not files:
        print("gold-share: no PNGs to measure", file=sys.stderr)
        return 2
    results = [(f, gold_share(f, args.min_value)) for f in files]
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
