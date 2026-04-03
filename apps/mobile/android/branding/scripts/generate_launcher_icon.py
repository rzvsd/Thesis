#!/usr/bin/env python3
"""
Thesis App Icon v2 — Convergence T (Enhanced lines)
Bold gold T with visible convergence lines on true dark.
"""
from PIL import Image, ImageDraw, ImageFilter
import math, os

SIZE = 1024
BG = (10, 10, 10)
GOLD = (197, 160, 89)

def lerp(a, b, t):
    return a + (b - a) * t

def draw_tapered_line(draw, x1, y1, x2, y2, start_w, end_w, color, steps=120):
    for i in range(steps):
        t = i / steps
        x = lerp(x1, x2, t)
        y = lerp(y1, y2, t)
        w = lerp(start_w, end_w, t) / 2
        draw.ellipse([x - w, y - w, x + w, y + w], fill=color)

def create_icon():
    img = Image.new('RGBA', (SIZE, SIZE), (*BG, 255))
    
    cx, cy = SIZE // 2, SIZE // 2
    
    # T dimensions
    t_top = int(SIZE * 0.28)
    t_crossbar_h = int(SIZE * 0.065)
    t_crossbar_left = int(SIZE * 0.20)
    t_crossbar_right = int(SIZE * 0.80)
    t_stem_width = int(SIZE * 0.085)
    t_stem_top = t_top + t_crossbar_h
    t_stem_bottom = int(SIZE * 0.76)
    t_stem_left = cx - t_stem_width // 2
    t_stem_right = cx + t_stem_width // 2
    
    # === CONVERGENCE LINES (drawn first, behind T) ===
    line_layer = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    line_draw = ImageDraw.Draw(line_layer)
    
    lines = [
        # From top-left -> left end of crossbar
        (int(SIZE * 0.03), int(SIZE * 0.04), t_crossbar_left + 15, t_top + t_crossbar_h // 2),
        # From top-right -> right end of crossbar
        (int(SIZE * 0.97), int(SIZE * 0.04), t_crossbar_right - 15, t_top + t_crossbar_h // 2),
        # From left mid -> crossbar left-center
        (int(SIZE * 0.02), int(SIZE * 0.42), t_crossbar_left + 60, t_top + t_crossbar_h),
        # From right mid -> crossbar right-center
        (int(SIZE * 0.98), int(SIZE * 0.42), t_crossbar_right - 60, t_top + t_crossbar_h),
        # From bottom-left -> stem bottom-left
        (int(SIZE * 0.12), int(SIZE * 0.96), t_stem_left + 8, t_stem_bottom - 5),
        # From bottom-right -> stem bottom-right
        (int(SIZE * 0.88), int(SIZE * 0.96), t_stem_right - 8, t_stem_bottom - 5),
        # From bottom center -> stem bottom
        (cx, int(SIZE * 0.98), cx, t_stem_bottom),
    ]
    
    for sx, sy, ex, ey in lines:
        # Outer glow (wider, dimmer)
        draw_tapered_line(line_draw, sx, sy, ex, ey,
                          start_w=2.0, end_w=8.0,
                          color=(*GOLD, 35), steps=140)
        # Core line (brighter, thinner)
        draw_tapered_line(line_draw, sx, sy, ex, ey,
                          start_w=1.5, end_w=5.5,
                          color=(*GOLD, 120), steps=140)
        # Hot center (brightest, thinnest) 
        draw_tapered_line(line_draw, sx, sy, ex, ey,
                          start_w=0.8, end_w=3.0,
                          color=(*GOLD, 180), steps=140)
    
    line_layer = line_layer.filter(ImageFilter.GaussianBlur(radius=1.5))
    img = Image.alpha_composite(img, line_layer)
    
    # === GLOW behind T ===
    glow = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    g = 16
    gc = (*GOLD, 25)
    gd.rectangle([t_crossbar_left - g, t_top - g, t_crossbar_right + g, t_top + t_crossbar_h + g], fill=gc)
    gd.rectangle([t_stem_left - g, t_stem_top - g, t_stem_right + g, t_stem_bottom + g], fill=gc)
    glow = glow.filter(ImageFilter.GaussianBlur(radius=24))
    img = Image.alpha_composite(img, glow)
    
    # === SOLID T ===
    draw = ImageDraw.Draw(img)
    t_color = (*GOLD, 255)
    draw.rectangle([t_crossbar_left, t_top, t_crossbar_right, t_top + t_crossbar_h], fill=t_color)
    draw.rectangle([t_stem_left, t_stem_top, t_stem_right, t_stem_bottom], fill=t_color)
    
    # Subtle 1px highlight on top edge
    draw.line([(t_crossbar_left, t_top), (t_crossbar_right, t_top)], fill=(225, 200, 130, 160), width=2)
    
    # Small nodes where lines meet the T
    dot_r = 3.5
    dc = (215, 185, 120, 180)
    for sx, sy, ex, ey in lines:
        draw.ellipse([ex - dot_r, ey - dot_r, ex + dot_r, ey + dot_r], fill=dc)
    
    return img.convert('RGB')


def create_foreground(master):
    fg = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    safe = int(1024 * 0.667)
    off = (1024 - safe) // 2
    fg.paste(master.resize((safe, safe), Image.LANCZOS), (off, off))
    return fg


# === Generate all assets ===
out_dir = '/app/apps/mobile/android/app/src/main/res'
icon_dir = '/app/apps/mobile/android/ui_drop'

master = create_icon()
master.save(f'{icon_dir}/thesis_icon_master.png', quality=95)

play_store = master.resize((512, 512), Image.LANCZOS)
play_store.save(f'{icon_dir}/thesis_play_store_512.png', quality=95)

fg_master = create_foreground(master.convert('RGBA'))

densities = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
}

for folder, size in densities.items():
    d = f'{out_dir}/{folder}'
    os.makedirs(d, exist_ok=True)
    
    icon = master.resize((size, size), Image.LANCZOS)
    icon.save(f'{d}/ic_launcher.png')
    
    # Round version
    rnd = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, size, size], fill=255)
    rnd.paste(icon, (0, 0), mask)
    rnd.save(f'{d}/ic_launcher_round.png')
    
    # Foreground
    fg = fg_master.resize((size, size), Image.LANCZOS)
    fg.save(f'{d}/ic_launcher_foreground.png')
    
    # Background
    Image.new('RGB', (size, size), BG).save(f'{d}/ic_launcher_background.png')
    
    print(f"  {folder}: {size}px")

print("All assets generated!")
