# Thesis Branding Assets

All app icon and branding assets for the Thesis Android app.

## Folder Structure

```
branding/
├── source/                          # Master high-res source files
│   ├── thesis_icon_master.png       # 1024x1024 launcher icon master
│   └── thesis_notification_master.png # 512x512 notification icon master
├── generated/                       # Export-ready assets
│   ├── thesis_play_store_512.png    # Google Play Store listing (512x512)
│   └── thesis_notification_96.png   # Notification preview
└── scripts/                         # Reproducible generation scripts
    ├── generate_launcher_icon.py    # Launcher icon (all densities)
    └── generate_notification_icon.py # Notification icon (all densities)
```

## Where Assets Are Installed (Android res/)

### Launcher Icon (Home screen, App drawer, Recent apps, Play Store)
```
res/mipmap-mdpi/ic_launcher.png          (48x48)
res/mipmap-hdpi/ic_launcher.png          (72x72)
res/mipmap-xhdpi/ic_launcher.png         (96x96)
res/mipmap-xxhdpi/ic_launcher.png        (144x144)
res/mipmap-xxxhdpi/ic_launcher.png       (192x192)
res/mipmap-*/ic_launcher_round.png       (same sizes, circular mask)
res/mipmap-*/ic_launcher_foreground.png  (adaptive icon foreground)
res/mipmap-*/ic_launcher_background.png  (adaptive icon background)
res/mipmap-anydpi-v26/ic_launcher.xml    (adaptive icon definition)
res/mipmap-anydpi-v26/ic_launcher_round.xml
```

### Notification Icon (Status bar, notification shade)
```
res/drawable-mdpi/ic_notification.png    (24x24)
res/drawable-hdpi/ic_notification.png    (36x36)
res/drawable-xhdpi/ic_notification.png   (48x48)
res/drawable-xxhdpi/ic_notification.png  (72x72)
res/drawable-xxxhdpi/ic_notification.png (96x96)
```

## Design

- **Launcher**: Gold T (#C5A059) on true dark (#0A0A0A) with 7 convergence lines
- **Notification**: White T silhouette on transparent (Android requirement)
- **Play Store**: 512x512 version of launcher icon

## Regenerating

```bash
python3 branding/scripts/generate_launcher_icon.py
python3 branding/scripts/generate_notification_icon.py
```
