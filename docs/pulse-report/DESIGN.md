---
name: Thesis Briefing
description: A restrained visual system for Thesis market briefings and report exports. Built for dense, scannable financial intelligence rather than dashboard theater.
colors:
  primary: "#1A2128"
  secondary: "#5A6672"
  tertiary: "#7E6337"
  neutral: "#F6F2EA"
  surface: "#FFFDF8"
  line: "#D8D0C2"
  positive: "#2F6A4F"
  warning: "#A06E1C"
  negative: "#9B4A4A"
typography:
  h1:
    fontFamily: Georgia
    fontSize: 2.6rem
    fontWeight: 700
    lineHeight: 1.03
  h2:
    fontFamily: Georgia
    fontSize: 1.45rem
    fontWeight: 700
    lineHeight: 1.12
  body-md:
    fontFamily: Arial
    fontSize: 0.98rem
    lineHeight: 1.58
  label-caps:
    fontFamily: Arial
    fontSize: 0.72rem
    fontWeight: 700
    letterSpacing: 0.08em
rounded:
  sm: 4px
  md: 6px
  lg: 8px
spacing:
  xs: 6px
  sm: 10px
  md: 16px
  lg: 24px
  xl: 32px
components:
  hero-surface:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral}"
    rounded: "{rounded.lg}"
    padding: 28px
  section-surface:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 22px
  label-chip:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.sm}"
    padding: 8px
---

## Overview

Thesis briefings should read like institutional research prepared for fast review on a serious day. The visual language is editorial, not consumer-product glossy and not terminal cosplay. The page should feel calm, deliberate, and dense enough to reward scrutiny.

## Colors

The palette is mostly neutral. Accent is used for hierarchy, not decoration.

- **Primary (#1A2128):** deep ink for hero surfaces, headings, and high-importance framing.
- **Secondary (#5A6672):** muted slate for metadata, labels, and supporting notes.
- **Tertiary (#7E6337):** restrained bronze for emphasis, dividers, and report identity.
- **Neutral (#F6F2EA):** warm paper background.
- **Surface (#FFFDF8):** lifted paper surface for report sections.
- **Line (#D8D0C2):** quiet borders and table rules.
- **Positive / Warning / Negative:** used only for pressure or risk semantics.

## Typography

Headlines should feel editorial and calm. Body text should stay extremely readable in export. Labels should be compact, uppercase, and sparing.

## Layout

Pulse reports should open with one decisive summary band, then split into:

1. the main thesis-relevant sections
2. a right rail for regime, coverage, and structural context

The layout should collapse cleanly to one column on narrow screens or print previews. Fixed cards should not jump in height because of status labels or dynamic content.

## Components

- The hero should carry the report name, cycle timing, regime state, and one-sentence structural context.
- Metric strips should summarize state, confidence, and coverage without turning into a dashboard.
- Section blocks should be full-width reading surfaces with compact evidence lists beneath the body.
- Macro inputs belong in a disciplined table, not in oversized tiles.
- Structural observations should appear as short relevance statements tied to why the regime matters.
- Omission truth should always remain visible when coverage is partial.

## Do's and Don'ts

- Do keep the report company-thesis and decision oriented.
- Do use whitespace to separate ideas, not to create empty luxury.
- Do make evidence provenance easy to scan.
- Do keep Macro Stress visually bounded to the locked five categories.
- Do not flood the page with decorative metrics.
- Do not make structural context feel like generic country wallpaper.
- Do not create a macro dashboard or terminal-style control surface.
- Do not hide missing coverage behind polished prose.
