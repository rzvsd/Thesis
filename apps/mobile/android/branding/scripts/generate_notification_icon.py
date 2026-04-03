#!/usr/bin/env python3
"""
Generate Thesis notification icon — Monochrome white T on transparent.
Android status bar requires single-color (white) icons with alpha channel.
No convergence lines — pure T silhouette for max clarity at 24dp.
"""
from PIL import Image, ImageDraw
import os

RES_DIR = '/app/apps/mobile/android/app/src/main/res'
BRAND_DIR = '/app/apps/mobile/android/branding'
SIZE = 512  # Master size
WHITE = (255, 255, 255, 255)

def create_notification_icon(size=512):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    cx = size // 2
    
    # T proportions — bold, simple, fills the space well
    # Generous padding for safe zone
    pad = int(size * 0.12)
    
    t_top = pad + int(size * 0.08)
    t_crossbar_h = int(size * 0.09)
    t_crossbar_left = pad
    t_crossbar_right = size - pad
    
    t_stem_width = int(size * 0.13)
    t_stem_top = t_top + t_crossbar_h
    t_stem_bottom = size - pad - int(size * 0.06)
    t_stem_left = cx - t_stem_width // 2
    t_stem_right = cx + t_stem_width // 2
    
    # Draw solid white T
    draw.rectangle([t_crossbar_left, t_top, t_crossbar_right, t_top + t_crossbar_h], fill=WHITE)
    draw.rectangle([t_stem_left, t_stem_top, t_stem_right, t_stem_bottom], fill=WHITE)
    
    return img


# Generate master
master = create_notification_icon(SIZE)
master.save(f'{BRAND_DIR}/source/thesis_notification_master.png')
print(f"Master: {BRAND_DIR}/source/thesis_notification_master.png")

# Android notification icon densities (dp -> px)
# Notification icons are 24dp with 2dp padding = 20dp visible
densities = {
    'drawable-mdpi': 24,
    'drawable-hdpi': 36,
    'drawable-xhdpi': 48,
    'drawable-xxhdpi': 72,
    'drawable-xxxhdpi': 96,
}

for folder, px in densities.items():
    d = f'{RES_DIR}/{folder}'
    os.makedirs(d, exist_ok=True)
    icon = master.resize((px, px), Image.LANCZOS)
    icon.save(f'{d}/ic_notification.png')
    print(f"  {folder}: {px}px")

# Also save a generated copy
master_96 = master.resize((96, 96), Image.LANCZOS)
master_96.save(f'{BRAND_DIR}/generated/thesis_notification_96.png')

print("\nNotification icon assets generated!")
