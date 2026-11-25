# Thesis Android: design direction v2 ("elegant finance")

Status: **source of truth for the redesign** (v2.1: revised after three critiques, finance, design and Android;
the Critique log at the end lists every point and what happened to it). Build agents follow this file; where it is
silent, follow the research files it cites. Where research files disagree with this file, this file wins.

- App root: `apps/mobile/android/app/src/main/java/com/thesis/mobile` (paths below are relative to it unless they
  start with `apps/` or `res/`). Base branch for every PR: `rebuild`. Snapshot audited: `9dba40e`.
- Quality bar: Deep Dive 2.0 as shipped by the renderer (`supabase/functions/_lib/reports/deep_dive_v2/css.ts`),
  not the mockup where they differ (system sans body, glow on every chapter, dark closing band).
- Research inputs (all in `scratchpad/research/`): `deep-dive-visual-language.md` (tokens, exact hex),
  `compose-motion-playbook.md` (motion code), `elegant-apps.md`, `financial-apps.md`, `browse-reference-sites.md`,
  `audit-foundation.md`, `audit-screens-a.md`, `audit-screens-b.md`, `toolchain/README.md`, screenshots in `dd-shots/`.
- Hard constraints: Kotlin 1.9.24, Compose compiler 1.5.14, compose-bom **2024.06.00** (Compose 1.6.8, M3 1.2.1),
  AGP 8.5.2, minSdk 26, compileSdk/targetSdk 35, no navigation-compose. No new backend in this redesign (client
  work over data the API already returns is in scope: report payloads, `market_tape`, note endpoints, local Room
  caches; Room 2.6.1 is already a dependency). No price feed exists in the app (no quote endpoint): never show or
  imply live prices.

---

## 1. North star and principles

### 1.1 North star

Thesis should feel like a private research desk: the same quiet, editorial product whether you are reading the
Deep Dive page, scanning your names at 7 a.m., or checking macro stress. Type does the work (Newsreader for
meaning, the system sans for apparatus), gold is a material used sparingly, and every surface sits on the same warm
paper or graphite lit by two soft corner glows. Nothing teleports: the row you tap becomes the page, refreshed
values change in place, and back always returns you to where you were. Every screen answers "what is the result,
compared with what, and where do I write down what I think about it". The three jobs each have a home: results on
**Name** (5.11) with "Since the last report", comparison on **Compare names** (5.26), and notes as a dated trail per
ticker plus the **Notes** view and search (5.27, 5.28). It is a desk tool first: dense enough to scan twelve names
before the open, and every figure can be traced to its filing and copied out.

### 1.2 Principles (each one is testable; the rubric in section 7 scores them)

1. **One product, one look.** Native screens use the Deep Dive 2.0 tokens exactly (section 2). A user moving from
   a native screen into the WebView report must not see a change of font, grey, radius or gold.
2. **Serif for meaning, sans for apparatus.** Newsreader for titles, claims, story text and headline numbers.
   Roboto (system sans) for labels, navigation, tables, axes, buttons. No monospace anywhere.
3. **Gold is a material, not paint.** Gold is a text material: brand, kickers, numerals, links, `TextAction`, focus,
   one subject mark. **No filled gold controls** (primary buttons are ink-inverted, as Deep Dive's chip nav); the only
   gold fill allowed is the CTA inside a HeroBand. Never card fills, meters in lists, back arrows, bullets or icons in
   bulk. Under 8% gold pixels (measured automatically, rubric T3).
4. **Results first, with their reference point.** Every headline number shows what it is compared with (vs 7 days
   ago, vs FY2024, since your last visit, vs the scale 0 to 100), including the hub screens (Names rows, Name).
   The explanation comes first and the number follows; section headlines are conclusions ("2 of your names need a
   review"), not labels. Every proprietary score (monitor, freshness, value discipline, stress) opens a sheet that
   shows its inputs.
5. **Colour carries meaning only.** Up/down colour only on the figure or mark it describes, never on rows, cards or
   backgrounds. Up is not automatically good (VIX, yields, stress). Colour is never the only signal (sign or arrow too).
6. **Hairlines over boxes.** 1 dp lines in `line`, lists inside one card with inset dividers, not a card per row.
   Dark mode has no shadows; elevation is a lighter surface.
7. **Everything is linked.** Every ticker anywhere is tappable and opens the same Name screen. Every source,
   report reference and evidence URL opens. Back never exits the app from a sub-screen.
8. **Continuity over cuts.** Tabs fade through, pushes slide on one horizontal axis (the same axis as predictive
   back), list rows transform into their detail, content states crossfade in place, refreshes update values in place
   (no blanking spinner, ever).
9. **Feedback at the finger, haptics rare.** Every tappable surface reacts on touch-down within a frame with one
   press language (an ink tint; no ripple anywhere). Haptics mark commits, thresholds and scrub boundaries only.
10. **Quiet motion.** No bounce on data or layout (damping 1.0); one hero motion per screen; pushed screens arrive in
    one piece (stagger only on Home and Pulse, first open per Pulse issue); nothing animates on actions repeated many
    times a session beyond the press state (opening one name after another is such an action).
11. **Honest states.** Loading looks like the final layout; missing data is a styled, explained absence (dashed
    "Not seen yet"; "Not disclosed" / "n/a" / "Not computed", section 2.4), never calm filler text; progress copy
    describes what actually happens (SEC filings, no news). Action labels say what will happen: a report is opened
    or built once per filing, never "re-run".
12. **Describe, never advise.** SPEC rule 6 applies to native screens too: no ratings, no buy/sell/hold, no "upside",
    "target", "cheap", "attractive" (full list: `docs/deep-dive/SPEC.md` section 4). No POSITIVE/NEGATIVE badges.
13. **Built for scanning, tracing and extraction.** Data screens (Names, Inbox, History, Compare) are dense (24 dp
    section gaps, a Compact row option); every fundamental figure carries its period (FY / Q / LTM) and opens a
    "Source and definition" sheet; every table can be copied out as tab-separated text.
14. **Nothing implies live data.** No pulsing dots, rolling digits or colour washes on market values; market data
    is a dated snapshot ("Pre-market tape · as of 06:15"). `LiveDot` exists only for a War Room in its Live phase.

---

## 2. Design system v2 (tokens)

All tokens live in `ui/theme/`. Screens never contain colour hex, sp, numeric dp, shape or duration literals
(exceptions: `0.dp`, `Dp.Hairline`, `Dp.Unspecified`). Section 7 has the grep guard.

### 2.1 Files

| File | Contents |
|---|---|
| `ui/theme/ThesisPalette.kt` | `ThesisPalette` data class, `PaperLight`, `InkDark`, `heroOf(p)`, `LocalThesisPalette` (`staticCompositionLocalOf`), `UpDownScheme` |
| `ui/theme/ThemeTokens.kt` | kept for compatibility: `ThesisColors` (now composable getters), `ThesisDimens`, `ThesisTypography` (rebuilt) |
| `ui/theme/ThesisType.kt` | `ThesisType` styles, `Num` feature style, font-scale cap |
| `ui/theme/ThesisFonts.kt` | **Android-only** (R.font). `Newsreader`, `NewsreaderDisplay`, `Sans`. Shimmed in design-preview |
| `ui/theme/ThesisShapes.kt` | `ThesisShape` objects and the M3 `Shapes` |
| `ui/theme/ThesisSpace.kt` | spacing scale, layout and size tokens |
| `ui/theme/Semantic.kt` | `Tone`, `toneColor()`, `marketTone()`, `macroStressTone()`, `thesisStateTone()`, `alertCategoryColor()` |
| `ui/theme/ThesisTheme.kt` | `ThesisTheme(mode, upDown, reduceMotion)`, full M3 colour scheme, system bars, locals |
| `ui/format/Fmt.kt` | the one number/date formatter (section 2.4); takes an injected `Clock`, `ZoneId` and `is24h` |
| `ui/icons/ThesisIcons.kt` | the curated Material Symbols set as generated `ImageVector`s (section 2.8) |

### 2.2 Colour

**Rule:** one `@Immutable data class ThesisPalette` with two instances. Values are the renderer's `css.ts` values
(copied in `deep-dive-visual-language.md` §10.1) with **two app-specific additions** marked (+) and **deviations**
marked (!) for contrast or separation. Every (!) is also a **renderer sync item** for Razvan (section 8, Q5): the
same change in `css.ts` keeps principle 1 true.

| Token | Role | PaperLight | InkDark |
|---|---|---|---|
| `bg` | page background | `#F5F1E8` | `#0A0A0A` |
| `bg2` (!) | end of 165° page gradient | `#EEE7D8` | `#121212` (DD `#161616` equals `surface`, so cards low on the page lose their fill) |
| `surface` | cards, bars, chips, sheets | `#FFFDF8` | `#161616` |
| `surface2` | inner panels, plain callout, skeleton blocks | `#F8F4EB` | `#1C1C1C` |
| `chip` | chip fill, icon tile, tonal button | `#EFE9DD` | `#1F1F1F` |
| `callout` | upshot background | `#F3EADB` | `#1C1913` |
| `ink` | primary text | `#1A2128` | `#F2F2F0` |
| `ink2` | secondary text, verdict continuation | `#47525E` | `#BDBDB8` |
| `muted` (!) | captions, ticks, sources, timestamps | `#545E69` (DD `#68717C` is 4.39:1 on bg; ≥ 4.73 everywhere incl. glow peaks) | `#8E8E89` |
| `line` | card borders, row dividers | `#E6DFD1` | `#262626` |
| `line2` | chip/badge borders, timeline rule | `#D3C9B6` | `#363636` |
| `control` (+) | text-field and toggle boundaries (3:1 non-text) | `#81796B` (F1; `#8F8778` was 2.54:1 on bg2 under the blue glow) | `#6E6E68` (F1; `#6B6B66` was 2.95:1 on bg under the gold glow) |
| `accent` (!) | gold for text and UI | `#70572F` (DD `#7E6337` is 4.27:1 under the gold glow peak; this is ≥ 4.87) | `#C5A059` |
| `highlight` | marker band behind lead phrase | `#B48226` @ 20% | `#C5A059` @ 22% |
| `glowGold` | page glow, top right | `#B48226` @ 16% | `#C5A059` @ 16% |
| `glowBlue` | page glow, bottom left | `#256BB1` @ 10% | `#4C89CC` @ 14% |
| `focus` | focus ring | `#256BB1` | `#C5A059` |
| `selectedFill` / `onSelected` (+) | selected chip/segment (inverted, as DD chip nav) | `#1A2128` / `#FFFDF8` | `#F2F2F0` / `#0A0A0A` |
| `pos` / `neg` / `warn` (!) | semantic | `#2F6A4F` / `#954747` / `#815611` (F1; `#9B4A4A` / `#8C5E12` were 4.33 / 4.03:1 on bg2 under the blue glow) | `#7FD3A2` / `#F2A0A0` / `#D9A441` (= heroPos / heroNeg; DD's Tailwind 400s read as neon next to the muted series) |
| `series[0..5]` | gold, plum, sage, blue, clay, teal (fixed order) | `#B48226 #82498B #6B8D38 #256BB1 #BE5737 #008E7F` | `#BA882E #A166AA #779A45 #4C89CC #CB6443 #1AA291` |
| `deemph` / `grid` / `axis` | chart | `#B9B1A4` / `#EEE8DC` / `#CDC3B1` | `#5B5B58` / `#222222` / `#3A3A3A` |
| `scrim` | behind sheets/dialogs | `#1A2128` @ 40% | `#000000` @ 60% |
| `cardShadow` | Boolean | `true` | `false` |

**Hero palette** (`heroOf(p)`, used by `HeroBand`, the Deep Dive cover and the closing band; the same in idea for
both themes, see `deep-dive-visual-language.md` §1.3): `bg=heroBg`, `bg2=heroBg2`, `surface` = bottom-band surface,
`callout` = bottom-band callout, `ink=heroInk`, `ink2=heroInk2`, `muted=heroInk2`, `line=heroLine`, `chip=heroChip`,
`accent=heroAccent`, `pos=heroPos`, `neg=heroNeg`, `glowGold=heroAccent@24%`, `glowBlue=series[3]@22%`.

| Hero token | PaperLight | InkDark |
|---|---|---|
| heroBg / heroBg2 | `#121A22` / `#22303D` | `#121212` / `#1A1A1A` |
| heroInk / heroInk2 | `#F6F2EA` / `#B7BFC8` | `#F2F2F0` / `#A9A9A4` |
| heroAccent | `#D7B985` | `#C5A059` |
| heroLine / heroChip | `#F6F2EA`@16% / @8% | `#FFFFFF`@10% / @6% |
| heroPos / heroNeg | `#7FD3A2` / `#F2A0A0` | same |
| band surface / band callout | `#1B232A` / `#262B2E` | `#1B1B1B` / `#24211B` |

**Light-mode gold split:** text and UI gold is `accent #70572F` (≥ 4.87:1 on every light surface, glow included). The bright `#B48226` (series[0])
is for marks only (bars, lines, glows). Never set text in series[0] in light mode.

**Contrast test** (`PaletteContrastTest`, F1): every text token (`ink`, `ink2`, `muted`, `accent`, `upText`,
`downText` in both schemes, `pos`, `neg`, `warn`) against every surface (`bg`, `bg2`, `surface`, `surface2`, `chip`,
`callout`) **and** against the worst-case glow composite (bg/bg2 with the gold or blue glow at its peak alpha) must be
≥ 4.5:1; `control` ≥ 3:1 on the same set; hero pairs (`heroInk`, `heroInk2`, `heroAccent`, `heroPos`, `heroNeg` on
`heroBg`/`heroBg2` with the hero glows) included. Known fixes already in the table: light `muted`, light `accent`,
dark colour-blind text. F1 then measured the remaining failures over the glow peaks and fixed them until the test
passes (values recorded in the tables above and below): light `control` `#81796B` (`#8F8778` was 2.54:1 on bg2 under
the blue glow), dark `control` `#6E6E68` (`#6B6B66` was 2.95:1 on bg under the gold glow), light `neg` `#954747` and
`warn` `#815611` (were 4.33 / 4.03:1), light colour-blind text `#2261A1` / `#9C452B` (were 3.94 / 4.05:1).

**Up/down schemes** (`UpDownScheme`, user setting in You > Appearance, default `Classic`):
- `Classic`: up = `pos`, down = `neg`.
- `ColourBlind`: up = blue, down = clay. Marks: series[3] / series[4]. Text: light `#2261A1` / `#9C452B` (F1: the
  first values `#256BB1` / `#A84B2E` were AA on bg but 3.94 / 4.05:1 on bg2 under the blue glow),
  dark `#5A95D6` / `#D97757` (≥ 5.26 on every dark surface; the series values `#4C89CC` / `#CB6443` fail on
  `chip`/`surface2` and stay marks only).
- Expose as `p.up`, `p.down`, `p.upText`, `p.downText` resolved in `ThesisTheme`. Screens use only these (or `Tone`),
  never `pos`/`neg` directly for market direction. `pos`/`neg`/`warn` remain for status (thesis state, errors).

**Semantic API** (`ui/theme/Semantic.kt`, replaces the 21 private label-to-colour helpers):
```kotlin
enum class Tone { Favourable, Unfavourable, Neutral, Attention, Unknown }
@Composable @ReadOnlyComposable fun Tone.color(): Color   // Favourable=up(Text), Unfavourable=down(Text), Neutral=ink2, Attention=warn, Unknown=muted
fun marketTone(instrument: String, change: Double): Tone   // equity indices and commodities: sign -> Favourable/Unfavourable;
                                                           // VIX, yields (2Y, 10Y, 30Y), DXY, credit spreads: ALWAYS Neutral (sign + arrow only)
fun macroStressTone(score: Double): Tone                   // 0-35 Favourable "Contained", 36-69 Neutral "Balanced", 70-100 Unfavourable "Elevated"
fun macroStressDeltaTone(delta: Double): Tone              // rising stress = Unfavourable (fixes MS1)
fun thesisStateTone(state: String): Tone                   // intact=Favourable, watch/drifting=Attention, at_risk/broken=Unfavourable, else Unknown
@Composable fun alertCategoryColor(category: String): Color // thesis_drift=series[1], earnings=series[3], macro=series[4], pulse=series[0], system=muted
```
`macroStressLabel(score)` lives next to it and is the only place the three label words are produced.

**Material3 bridge** (fixes purple dialogs/snackbars). In `ThesisTheme` set every role:
`primary=accent, onPrimary=surface, primaryContainer=chip, onPrimaryContainer=ink, secondary=ink2, onSecondary=surface,
secondaryContainer=chip, onSecondaryContainer=ink, tertiary=series[3], background=bg, onBackground=ink,
surface=surface, onSurface=ink, surfaceVariant=surface2, onSurfaceVariant=ink2, surfaceTint=Color.Transparent,
surfaceBright=surface2, surfaceDim=bg, surfaceContainerLowest=bg, surfaceContainerLow=surface,
surfaceContainer=surface, surfaceContainerHigh=surface2, surfaceContainerHighest=chip, inverseSurface=ink,
inverseOnSurface=surface, inversePrimary=accent, outline=control, outlineVariant=line, error=neg, onError=surface,
errorContainer=callout, onErrorContainer=neg, scrim=scrim`.

**Compatibility layer (keeps ~1,100 `ThesisColors` call sites compiling):** `object ThesisColors` keeps every existing property name
but each becomes `val X: Color @Composable @ReadOnlyComposable get() = LocalThesisPalette.current.<token>`.
Mapping: Background→bg, Surface→surface, SurfaceElevated→surface2, SurfaceOverlay→chip, Border→line,
BorderSubtle→line, Primary→accent, PrimaryHover→accent, PrimaryMuted→accent@60%, TextPrimary→ink,
TextSecondary→ink2, TextMuted→muted, TextInverse→onSelected, SignalPositive→pos, SignalNegative→neg,
SignalNeutral→muted, SignalWarning→warn, Error→neg, OnError→surface, Shimmer*→surface2. The 16 aliases
(`AccentBlue*`, `LightBackground`, `TextPrimaryLight`, `DarkSurfaceHigh`, `TextTertiaryDark`, …) are kept with
`@Deprecated("Use LocalThesisPalette")` and mapped to the nearest token. Measured by compiling the conversion
(`scratchpad/crit/errs.txt`): it breaks exactly **21 non-composable label-to-colour helpers** (`SectionHealthStrip:132`,
`ConvictionIntelligenceCards:400,408`, `DeepDivePresentationCards:1165-1213` ×7, `DeepDiveScreen:791,1382,1474,1480,1486`,
`HomeScreen:1031`, `NamesScreen:481`, `PulseScreen:553`, `ScenarioStressScreen:490`, `WarRoomScreen:286`,
`WeeklyDigestScreen:294`, plus `SentimentDashboardScreen.dashboardLabelColor` by inspection) and **2 Canvas reads**
(`ConfidenceRing.kt:60,72`, `SentimentDashboardScreen:579`). Fix: annotate the 21 helpers `@Composable
@ReadOnlyComposable` (zero cascade, verified) and hoist the Canvas reads to `val p = LocalThesisPalette.current`.
This lands as a serial day-0 commit on `redesign/pr1` before F2 and F3 branch (section 6.1).

### 2.3 Typography

**Fonts (bundled, OFL 1.1, no Reserved Font Name):** Newsreader only, as 5 static instances generated with
fontTools from `scratchpad/ddrender/ttf/newsreader.ttf` and `newsreader_italic.ttf` (source:
`github.com/google/fonts/ofl/newsreader`). Sans = `FontFamily.Default` (Roboto), which is exactly what the Deep Dive
page shows inside the Android WebView. Inter is not shipped (open question Q4 proposes one grotesk for both the
renderer and the app; default stays Roboto).

| `res/font/` file | Instance (`instantiateVariableFont`) | Family / weight in Compose | Used for |
|---|---|---|---|
| `newsreader_display.ttf` | wght 400, opsz 72 | `NewsreaderDisplay` Normal | display, title, headline |
| `newsreader_display_italic.ttf` | italic, wght 400, opsz 72 | `NewsreaderDisplay` Normal Italic | chapter numerals, hero thesis line |
| `newsreader_text.ttf` | wght 400, opsz 16 | `Newsreader` Normal | story, lede, upshot |
| `newsreader_text_semibold.ttf` | wght 600, opsz 16 | `Newsreader` SemiBold | lead clause, lead phrase |
| `newsreader_medium.ttf` | wght 500, opsz 36 | `Newsreader` Medium | card titles, KPI values, hero figure |

Generation (one-off script committed as `apps/mobile/android/tools/fonts/make_newsreader.py`, not run in CI):
instance, then `fontTools.subset` with Latin-1 + Latin Extended-A U+0100–017F + U+0218–021B (Ș ș Ț ț) +
U+2010–2027, U+2032–2033, U+2212, U+2248, U+2260, U+2264–2265, U+20AC (no arrows: U+2190–2193 are not in
Newsreader; arrows come from icons) and `layout_features=["kern","liga","tnum","pnum","case","locl"]`.
Budget: about 290 KB total. The drop cap uses `newsreader_display` (400, opsz 72) instead of the renderer's 500/72:
a sixth instance is not worth ~50 KB at that size.
Licence: ship `app/src/main/assets/licenses/OFL-Newsreader.txt` (copy of `ddrender/ttf/OFL-newsreader.txt`) and list
it on the You > Legal > Open-source licences row.

**Type scale** (`ThesisType`; sp; letter spacing in em). Serif sizes are exactly **40, 30, 24, 20, 18, 17**
(18 only for `lede`/`cardTitle`, separated by weight and colour), so hierarchy is visible on a phone.

Numeric features: Newsreader has no `lnum` and its default digits are already tabular lining (all 1100 units), so
serif styles set nothing for "tnum"; a **static** serif `figure`/`kpiValue` sets `fontFeatureSettings = "pnum"`
(proportional digits look less gappy at 24–40 sp) and switches to default (tabular) only while it animates or sits
in a column. Sans styles marked tnum set `"tnum"` (Roboto).

| Style | Family | Weight | Size / line height | Tracking | Use |
|---|---|---|---|---|---|
| `display` | NewsreaderDisplay | 400 | 40 / 44 | −0.015 (+0.01 when the text is an all-caps ticker) | HeroBand title only (Auth wordmark, Paywall, Deep Dive classic hero) |
| `title` | NewsreaderDisplay | 400 | 30 / 32 | −0.018 | the one screen title (ScreenHeader); classic Deep Dive chapter h2 |
| `headline` | NewsreaderDisplay | 400 | 24 / 28 | −0.012 | SectionHeader, Home ScreenHeader, app-screen chapter titles |
| `subhead` | Newsreader | 400 | 20 / 26 | −0.005 | empty-state sentence, big question, sheet title |
| `heroLine` | NewsreaderDisplay | 400 italic | 20 / 28 | 0 | Pulse morning line, Auth tagline |
| `numeral` | NewsreaderDisplay | 400 italic | 40 / 40 | −0.02 | chapter numeral "01" (gold); render check that glyphs are not clipped |
| `cardTitle` | Newsreader | 500 | 18 / 23 | −0.005 | card titles (a conclusion sentence) |
| `lede` | Newsreader | 400 (lead clause 600, ink) | 18 / 27 | 0 | verdict line under a title |
| `story` | Newsreader | 400 (lead phrase 600) | 17 / 27.5 | 0 | narrative paragraphs, upshot text, note text |
| `figure` | Newsreader | 500, pnum static | 40 / 44 | −0.02 | the single hero metric of a screen |
| `kpiValue` | Newsreader | 500, pnum static | 24 / 28 | −0.01 | KpiGrid on hero/feature blocks only |
| `body` | Sans | 400 | 15 / 23 | 0 | UI body; `body.tnum()` for trailing values in rows (replaces `num`) |
| `bodySmall` | Sans | 400 | 13.5 / 20 | 0 | row subtitles, card body |
| `rowTitle` | Sans | 600 | 15 / 20 | 0 | list row title, ticker in rows |
| `barTitle` | Sans | 600 | 17 / 22 | 0 | top bar title (matches the DD app bar ticker) |
| `label` | Sans | 500 | 13 / 18 | 0.01 | chips, segments |
| `button` | Sans | 500 | 14 / 20 | 0.01 | buttons |
| `navLabel` | Sans | 500 | 12 / 16 | 0.01 | bottom bar |
| `statValue` | Sans | 600, tnum | 18 / 22 | 0 | figures inside cards, grids and tables on paper (sans) |
| `tape` | Sans | 500, tnum | 13 / 18 | 0 | Home tape row values and changes |
| `tableNum` / `tableHead` | Sans | 400 / 600, tnum | 12.5 / 18, 11.5 / 16 | 0 | tables (head in muted) |
| `caption` | Sans | 400 | 12 / 17 | 0 | sources, timestamps, units (muted) |
| `eyebrow` | Sans | 600 | 11 / 16 | 0.14, UPPERCASE | eyebrows, figure numbers "CHART 3" |
| `kicker` | Sans | 700 | 11.5 / 16 | 0.18, UPPERCASE | chapter/section kicker next to numeral (gold) |
| `tick` | Sans | 400, tnum | 11 / 14 | 0 | chart axes |

`statValue` vs `kpiValue`: sans inside cards, grids and tables on paper; serif only in a HeroBand or the one
featured KpiGrid of a screen (Macro Stress header, Name "From the 10-K").

Rules:
- Every style sets `lineHeightStyle = LineHeightStyle(Alignment.Center, Trim.None)`. Titles use
  `lineBreak = LineBreak.Heading`. (`includeFontPadding` is not set: it is `false` by default since Compose 1.5 and
  `PlatformTextStyle(includeFontPadding = false)` does not compile in the harness.)
- Minimum 11 sp. Sizes under 12 sp are only uppercase tracked labels and ticks.
- Uppercase is applied by the component (`Eyebrow`, `Kicker`), not by callers' `.uppercase()`.
- Numbers: anything that changes value or sits in a column is tabular. Use the true minus U+2212 (from `Fmt`).
  **Numbers never ellipsize**: when a figure does not fit, its label wraps or the figure steps down one style.
- **Font-scale cap (in dp, not by ratio):** `display`, `title`, `figure`, `numeral` grow with the user setting up to
  1.3× of their base size and no further: `with(LocalDensity.current) { minOf(style.fontSize.toDp(),
  (base * 1.3f).dp).toSp() }` in `ThesisType.capped(style)`. Compose 1.6 applies Android 14's non-linear font
  scaling, so a ratio formula (`size / fontScale × min(fontScale, 1.3)`) can make `display` smaller at 2.0× than at
  1.0×. Unit test (`ThesisTypeCapTest`) at 1.0, 1.3, 2.0. All other styles scale freely.
- `ThesisTypography` (M3) is rebuilt from these, so the ~430 existing `ThesisTypography.*` reads change in one edit:
  displayLarge=display, displayMedium=title, displaySmall=figure, headlineLarge=headline, headlineMedium=subhead,
  headlineSmall=cardTitle, titleLarge=barTitle, titleMedium=rowTitle, titleSmall=Sans 600 13/18, bodyLarge=Sans
  400 16/24 (text fields), bodyMedium=body, bodySmall=caption, labelLarge=button, labelMedium=Sans 500 12/16 0.02em,
  labelSmall=eyebrow. **This removes monospace from all 138 label uses.** `MonoFont` is deleted.
- Known layout shifts of the remap (PR-1 render review checks clipping on every screen): 35
  `headlineMedium.copy(fontWeight = Medium)` sites move from 18 sp sans to 20 sp serif; 2
  `displayLarge.copy(fontWeight = Black)` sites would synthesise fake bold (`NewsreaderDisplay` has only 400), so F1
  removes the `.copy` at those two sites as a mechanical fix.

### 2.4 Numbers and dates (`ui/format/Fmt.kt`)

One formatter, ported from `DeepDiveNativeMemo.formatValue` and the renderer's `format.ts`. `Locale.US` for digits
everywhere (fixes the decimal comma bug). `Fmt` takes an injected `Clock`, `ZoneId` and `is24h` (Android's
`DateFormat` is not reachable from `ui/format`; the shell passes the device values), so `FmtTest` is deterministic.

| Function | Example output |
|---|---|
| `money(v, ccy = "USD")` compact, **3 significant figures** | `$416B`, `$98.8B`, `$42.1M`, `$3.42T`; under 1,000: `$7.47`; negative `−$1.2B`; non-USD reporting currency carries its code: `€41.2B`, `CA$3.10B` (20-F/40-F filers) |
| `pct(v, dp=1)` | `32.0%` (2 dp when abs < 1) |
| `signedPct(v)` | `+6.4%`, `−2.2%` (U+2212) |
| `bps(v)` | `+120 bps`, `−35 bps`: **margin and rate changes** (never "pts" for margins) |
| `pts(v)` | `+6 pts`: score changes only (macro stress, monitor score) |
| `multiple(v)` | `28.4×` |
| `score(v)` | `62` (rounded, not truncated) |
| `count(n, one, other)` | `1 name`, `8 names` (no "name(s)") |
| `period(kind, fy, q?, fyEnd?)` | `FY2025`, `Q3 FY25`, `LTM Sep-25`; column header form `FY Sep-25` (year-ends differ) |
| `filing(form, period, filed?)` | `10-K FY2025`, `10-Q Q3 FY25 · filed 30 Oct` |
| `asOf(instant)` | `As of 07:02, Mon 24 Nov` (device zone, 12/24 h from `is24h`) |
| `relative(instant)` | `just now`, `12 min ago`, `3 h ago`, `yesterday`, `23 days ago`, then `24 Nov` (`24 Nov 2024` when not this year) |
| `marketDate(date)` | `Mon 24 Nov`; **with the year** (`24 Nov 2024`) whenever the year differs from the current one (History, Compare, notes trail) |
| `weekRange(start, end)` | `17 to 23 Nov` |

Rules:
- **Every fundamental figure carries its period** (`FY` / `Q` / `LTM`) in its label, header or caption via
  `Fmt.period`. A figure without a period is a review deduction (C1).
- **Missing values, three words, never a dash:** `Not disclosed` = absent from the filing; `n/a` = not meaningful
  (a margin on negative revenue, a growth rate from zero); `Not computed` = a pipeline gap on our side. The mapper
  decides which, from the payload's missing-data notes; when it cannot tell, `Not disclosed`.
- Jargon out: "DD 23 days" becomes `10-K FY2025 · 23 days ago` (compact form in rows: `10-K · 23 days ago`).

Every timestamp in the app goes through `asOf` or `relative`. Market-phase logic (pre-market/open/closed) uses New
York time internally but is displayed as a word, not as an EST time, and the word is **left out when unsure**
(there is no holiday calendar).

### 2.5 Spacing, grid, sizes (`ui/theme/ThesisSpace.kt`)

- Spacing scale (dp): `xxs 2, xs 4, s 8, m 12, l 16, xl 20, xxl 24, x3 32, x4 40, x5 56`. Nothing else in screens.
- **Screen gutter: 16 dp** on every screen (DD gutter). Content max width 640 dp, centred, for reading screens.
  **Data screens** (Names list, `CompareTable`, Compare names, History) may widen to 960 dp on wide windows; never
  centre a narrow column on a tablet for a table.
- **Three text edges, named.** E0 = gutter (16): screen headers, section headers, card edges. E1 = 32: text inside
  a card (gutter + card padding). E2 = 68: text in rows with the 24 dp leading column (16 + 16 + 24 + 12). Nothing
  else; rubric T4 checks against these three.
- Vertical rhythm on app screens: top bar → ScreenHeader top padding 8; ScreenHeader → first section 24; between
  sections **24 on data screens** (Home, Names, Inbox, History, Compare, Search) and 32 on reading screens (Macro
  Stress, Name, Weekly digest); between cards inside a section 12; inside a card padding 16 (DD bottom 14 → use
  16), gap 12; list row vertical padding 12 (Comfortable: min row height 56, 64 with a subtitle; Compact: 48,
  single line). Long reads (Pulse brief, classic Deep Dive): chapters 56 top / 56 bottom with a chapter divider
  (`line2` @ 60%, 1 dp).
- Sizes: `touchMin 48`, `topBar 56`, `bottomBar 64` (+ nav inset), `tapeRow 44`,
  `buttonVisual 40` inside the 48 dp touch area, `chipHeight 36` visual inside a 48 touch area, `iconS 16`, `iconM 20`, `iconL 24`, `avatar 32`, `statusSquare 7`,
  `liveDot 6`, `hairline = Dp.Hairline` for dividers and `border = 1.dp` for card borders, `accentBar 3` (upshot).
- **Fixed heights are banned on anything containing text.** Use `defaultMinSize`/`heightIn(min=…)`.

### 2.6 Shape (`ui/theme/ThesisShapes.kt`)

| Token | Radius | Used by |
|---|---|---|
| `card` | 14 | cards, report cards, sheets' inner cards |
| `panel` | 12 | upshot/callout, KPI grid, price/range box, text fields, compare table |
| `stat` | 10 | stat grids, nodata box |
| `tile` | 8 | icon tiles 28×28, tooltips |
| `badge` | 6 | status/phase badges, skeleton blocks |
| `pill` | 50% | chips, segments, buttons, bottom-dock |
| `sheet` | 20 top corners | bottom sheets, dock panel |
| `dialog` | 20 | dialogs |

Concentric rule: an element inset by `i` inside a shape of radius `r` uses `r − i` or a pill.
`MaterialTheme(shapes = Shapes(extraSmall=badge, small=tile, medium=panel, large=card, extraLarge=sheet))`.
`ThesisDimens.CardCornerRadius` becomes 14 and `SignalBadgeCorner` 6 in PR-1 so the 159 inline shapes change at once.

### 2.7 Surfaces, elevation, glows

- **Page background** (`Modifier.pageBackground(p)`): 165° linear `bg → bg2`, gold ellipse at the top right
  (rx = min(0.70w, 900 dp), ry = 560 dp, fades to 0 at 70%), blue ellipse at the bottom left (rx = min(0.60w,
  760 dp), ry = 480 dp, 70%). Geometry: `deep-dive-visual-language.md` §10.3. **Gold top right, blue bottom left**
  (the playbook's §16 has them reversed; the renderer wins). Static: no drift, no breathing, no grain.
  - **Who paints it:** every `ThesisScreen` paints it, opaque, fixed to the window (it does not scroll). The shell
    root only fills `bg` (visible while predictive back scales a screen). Screens are therefore opaque, so push
    transitions and the container transform never double-expose text.
  - **Cost:** the glow is rasterised **once per (window size, theme)** into an `ImageBitmap` held by a
    `PageBackgroundCache` provided at the shell; every screen and bar draws from that bitmap (also cheap on low-end
    phones). The harness takes `-Dpreview.glow=false` for bulk state renders (Skia software raster costs about
    0.4 s per glow frame).
  - **Bars without seams:** the collapsed top bar, sticky `ChapterPills` and the bottom bar draw the **same bitmap
    in window coordinates**, clipped to their bounds, at 92%, plus their hairline. A flat `bg@92%` would cut a hard
    rectangle through the gold glow.
- **HeroBand** (`HeroBand { }`): re-provides `LocalThesisPalette` with `heroOf(p)`, **and** wraps its content in
  `MaterialTheme(colorScheme = schemeOf(heroOf(p)))` with `LocalContentColor provides heroInk`, so M3 Switch,
  TextField, default `Icon` tint and press tint are right inside the dark band. Paints the hero background (gold
  `heroAccent@24%` ellipse 0.70w × 1.20h at top right fading by 60%, blue `series[3]@22%` 0.60w × 0.90h at the
  bottom left fading by 65%, over 165° `heroBg → heroBg2`) and a 1 dp bottom hairline
  `horizontalGradient(transparent, heroAccent 30%, heroAccent 70%, transparent)` at alpha .55. Its `Eyebrow` starts
  with the Deep Dive cover mark: a 28 × 1 dp `heroAccent` rule, 8 dp gap (`.hero .eyebrow::before`).
  - **Cover moments only:** Pulse brief, Deep Dive loading and the classic report hero, Auth, Onboarding, Paywall.
    Not on Name or War Room (utility screens opened many times a day; on Name it would also flash a light row into a
    navy slab during the container transform). At most one per screen (rubric V3).
  - **HeroBand screens rule:** the band runs edge to edge **under the status bar and the top bar**. While the band is
    under it, `ThesisTopBar` reads `heroOf(p)` (heroInk icons, no fill); once `collapsed` it switches to the normal
    palette (background bitmap @ 92% + hairline), crossfading over 200 ms. Status bar icon appearance follows the
    same `collapsed` flag through `WindowInsetsControllerCompat.isAppearanceLightStatusBars` (light icons over the
    band in both themes). Owner: WP-INT (shell), F2 (top bar). Render fixture "HeroBand screen, light, at rest and
    collapsed" is part of F2's acceptance.
- **Elevation:** dark = no shadows, separation by `bg → surface → surface2` and `line`. Light = cards may use the
  Deep Dive card shadow `0 10px 28px −20px`: a soft shadow under the bottom edge only, not an all-round Material
  halo. Implementation in `ui/platform/CardShadow.kt`: `drawBehind` on a rect inset 20 dp horizontally with
  `setShadowLayer(28.dp, 0, 10.dp, ink@35%)` on the framework paint, API 28+; none on 26–27; the harness shim draws an
  equivalent blurred rect. Never `Modifier.shadow` on cards, never M3 tonal elevation (`tonalElevation = 0.dp`
  everywhere; `surfaceTint` transparent).
- **Glass:** no backdrop blur library and no blur anywhere. Bars use the background bitmap at 92% (above). Bottom
  dock and floating pills use `surface @ 94%`.
- Content cards never get their own glow.

### 2.8 Iconography

- Set: a curated **Material Symbols Outlined** set of about 35 glyphs, weight 300, grade 0, optical size 20 and 24,
  plus the FILL=1 variant of the four tab glyphs. Generated by `tools/icons/make_icons.py` (F4) from the official
  SVGs into `ui/icons/ThesisIcons.kt` as `ImageVector`s (not XML drawables: `ui/**` must compile in the harness,
  where `R.drawable` does not exist). `material-icons-extended` is removed from `app/build.gradle.kts` by WP-INT once
  PR-3 has moved the last call site (its 2018 single-weight outlines are heavy next to Newsreader, and the artifact
  is very large). Arrows are mirrored in RTL by the generator (`autoMirror = true` on back/forward glyphs).
- Sizes: 24 in bars and buttons, 20 inline in rows, 16 inside chips. Tint `ink2` by default, `ink` when active.
  The selected tab is the FILL=1 glyph in `ink`, not gold. `accent` only for the brand. Never gold icons in bulk, no
  icon discs (the 64 dp gold disc in empty states is removed).
- Metaphors (one meaning each; Symbols names): Today `today`, Names `format_list_bulleted`, Research
  `manage_search`, Inbox `inbox`, You = 32 dp avatar circle with initials (chip fill, ink2 text), Search `search`,
  Pulse `article`, Macro Stress `speed`, Deep Dive `menu_book`, War Room `event_note`, Scenario Stress
  `stacked_line_chart`, History `history`, Notes `edit_note`, Compare `compare_arrows`, Export PDF `picture_as_pdf`,
  Share `share`, Copy `content_copy`, Follow `bookmark` (outline / FILL=1), overflow `more_vert`, open external
  `open_in_new`, back `arrow_back`, close `close`, sort `sort`, density `density_medium`/`density_small`, info `info`.
- **No chevrons in lists.** The whole row is the target (a chevron is an iOS idiom and an extra trailing atom).
  External links keep `open_in_new`.
- Status is a 7 dp radius-2 colour square inside a bordered badge (DD phase badge), not a coloured icon.
- Launcher icon: redrawn as a vector adaptive icon on the 108 dp canvas inside the 66 dp safe zone, with a
  `<monochrome>` layer and a `@color` background (WP-G).

---

## 3. Component library v2

Location: `ui/components/` (kit), `ui/motion/` (motion primitives), `ui/charts/kit/` (charts), `ui/shell/` (shell).
Every component: reads colours only from `LocalThesisPalette`, has a dark and light render in the kit gallery
(`design-preview` test `KitGalleryRenders`), meets 48 dp touch targets, exposes correct semantics. Components take
`modifier: Modifier = Modifier` first optional parameter and never hard-code outer padding.

States legend: D default, P pressed, F focused, S selected, X disabled, L loading, E error.

| # | Component | Anatomy | States and behaviour | Replaces |
|---|---|---|---|---|
| 1 | `ThesisScreen` (page scaffold) | paints `pageBackground` (opaque, from the shared cached bitmap, section 2.7) behind everything; optional `ThesisTopBar`; content slot (usually `LazyColumn` with `contentPadding` = gutter + insets + bottom bar); optional `ThesisRefreshBox`; optional bottom dock; snackbar host is the shell's | Passes `WindowInsets.safeDrawing` and `imePadding`; publishes `collapsed` (derived from list scroll) to the top bar and, through the shell, to the status-bar icon appearance; screens never call `background(...)` themselves | per-screen `background(ThesisColors.Background)` (18 files), the 56 dp overlay rows, magic `56.dp + ScreenPaddingTop` offsets |
| 2 | `HeroBand` | hero palette + hero `MaterialTheme` + `LocalContentColor` provider, hero background, gold hairline; `Eyebrow` inside it gets the 28 dp gold rule | Content inside uses normal kit components; they recolour automatically. Cover moments only (section 2.7) | Pulse/DeepDive header cards, Auth header, Paywall header |
| 3 | `ThesisTopBar` | 56 dp; left: back (`arrow_back`, ink) or brand `THESIS` (eyebrow, accent); middle: `barTitle` + optional caption subtitle (fades in when the ScreenHeader scrolls away); right: ≤ 2 icon actions + avatar (root tabs: `search` + avatar) | At rest: transparent (hero palette when over a HeroBand); when `collapsed`: background bitmap @ 92% + 1 dp `line` hairline, alpha 0→1 over 200 ms; title crossfade 200 ms. Back has `contentDescription = "Back"`. Variant `ReportTopBar` (section 5.13) | `ThesisTopBar`, `SubScreenBackRow`, `BriefTopBar`, Digest/History/Sentiment overlay rows, `DeepDiveWebTopBar`, classic DD top bar (7 back rows) |
| 4 | `ThesisBottomBar` | background bitmap @ 92% + top 1 dp hairline; 4 items (Today, Names, Research, Inbox): icon 24 + `navLabel`; **no indicator** | Selected: FILL=1 glyph and label in `ink`; unselected: outlined glyph and label in `muted`; crossfade 150 ms; press = the kit tint (no ripple, no scale); Inbox shows a 6 dp `accent` dot when there are new alerts; when You is open nothing is selected; `selected = true` semantics (`Role.Tab`). Hides on Report with slide down by its height + fade, `Base` (shows with the reverse) | `ThesisBottomBar` (fixes 5 dp offset, full-rectangle border, mono labels, `indication = null`) |
| 5 | `ScreenHeader` | `Eyebrow` (optional) → `title` (serif; Home uses `headline`, max 2 lines) → deck (`lede` ink2, 1–2 lines) → optional meta row (caption + `LoadingHairline`) | `heading()` semantics on title; the title text is what the top bar shows when collapsed | the three page-title tiers (40/30/24 sp) and duplicated titles |
| 6 | `SectionHeader` | `Kicker` (accent) → `headline` → optional deck; trailing `TextAction` ("All names") aligned to the headline baseline | **The kicker is the category, the headline is a sentence about the result, generated from data** ("2 of your names need a review", "Macro stress is Balanced and rising", "Markets were mixed before the open"). A static fallback only when there is no data; never the kicker's words twice. `heading()` | SectionHeader×2, SectionLabel, SectionTitle, MetaLabel, DeepDiveProofHeading, 29 inline caps labels |
| 7 | `ChapterHeader` | Row: `numeral` "01" (accent) + `kicker` label + `FlowRow` of `StatusBadge`s + source caption; then `title`/`headline`; then `lede` with lead clause 600 ink | Mirrors DD chapter anatomy exactly | Pulse `BriefSection` header, classic DD section headers |
| 8 | `KpiTile` / `KpiGrid` | tile: `caption` label (with period, e.g. "Revenue, FY2025"), value (`statValue` on paper, `kpiValue` in a HeroBand or the screen's one featured grid), delta line (`caption`, Tone colour, with sign), reference ("vs FY2024", "vs 7 days ago"); grid: **2 columns below 560 dp**, 3 at ≥ 560 dp, cells on a `line` background with 1 dp gaps, `panel` radius, cell padding 12×14 | Tap (or long-press when the tile navigates) opens `SourceSheet` (#47). Values use `RollingNumber` only for app-computed values that refresh in place; frozen report figures never animate. Values never ellipsize (section 2.3) | Macro card score, Weekly digest macro row, metric pills, `StatColumn`, `LabelValuePill` |
| 9 | `DataRow` | label (body, ink) left; value (`body.tnum()`, right-aligned) + delta (caption, Tone) right; optional sub (bodySmall ink2) | Clickable variant: full-row press tint, `mergeDescendants` semantics reading "label, value, change"; long-press on the value opens `SourceSheet` | tape rows, factor rows, indicator rows, `SnapshotRow`, `NotificationPreferenceRow` (toggle variant `ToggleRow` with `toggleable` + `Role.Switch`) |
| 10 | `RowGroup` + `Modifier.rowGroupSegment(position)` | **Lazy lists:** each row is its own lazy item and draws its slice of the card with `rowGroupSegment(First / Middle / Last / Only)`: outer 1 dp `line` border, top or bottom `card` corners, `surface` fill, inset hairline divider starting at the row's text edge, none after the last. **Static groups** (≤ 5 rows: Home, Settings, Name): non-lazy `RowGroup { }` wrapper | Rows inside a group press with the tint only, full-bleed to the card edges, **no scale** (a scaled row detaches from its hairlines). Works with `animateItemPlacement` because every row is an item | card-per-row lists (Names, Inbox, History, Home names) |
| 11 | `TickerRow` | leading 24 dp column: `StatusSquare` (thesis tone; replaced by `LiveDot` while a War Room is live); line 1: ticker (`rowTitle`) + company name (bodySmall muted, ellipsized) + inline `NoteMark` and `CountBadge` after it; line 2: state change since your last visit ("Intact → Watch, Tue") else the reason (bodySmall ink2, 1 line); **trailing: one stacked figure block**: monitor score (`body.tnum()`) over a delta caption ("+4 since Tue", tone) or, with no prior snapshot, the report age ("10-K · 23 days ago") | ≤ 2 trailing atoms (rubric V3), no chevron, no meter in lists. Compact variant (Names density toggle): 48 dp, one line: ticker · state square · score · Δ · note mark as aligned columns. Press: tint only inside a RowGroup; long-press opens the row's context sheet (`longPress()` haptic); captures its bounds on click for the container transform | `NamesRowCard`, Home `YourNamesSection` rows, Pulse `YourNamesBrief` rows, Scenario impact cards' name rows |
| 12 | `ThesisCard` | `surface`, 1 dp `line`, `card` radius, padding 16, gap 12; slots: eyebrow, title (`cardTitle`), body, footer (hairline + source caption left + `TextAction` right, DD card foot); light theme uses the DD card shadow (2.7) | Variants: `Plain`, `Clickable` (= `PressableCard`, #40), `NotSeen` (transparent, 1.5 dp dashed `line2`, dashed-ring tag "NOT SEEN YET", muted copy), `Selected` (1 dp `ink` border + check in the eyebrow row) | 43 inline card recipes, ~30 private `*Card` containers, `InteractiveCard`, `StorySurface`, `SurfaceCard`, M3 `Card()` |
| 13 | `Upshot` / `Callout` | Upshot: `callout` fill, `panel` radius, 3 dp accent bar inside the left edge, `Kicker` "THE UPSHOT", `story` text. Plain callout: `surface2`, 1 dp `line`, `bodySmall` ink2. `BigQuestion`: card with gold eyebrow and `subhead` question | — | gold-tinted `Primary@0.1` cards, "IN PLAIN ENGLISH" callouts, `ExplainerCard` |
| 14 | `ThesisChip` | pill, `chipHeight` 36 inside 48 touch, 1 dp `line2`, transparent, `label` text, optional leading 16 dp icon or count ("At risk 2") | S: `selectedFill`/`onSelected` (DD chip nav inversion), colour animated 150 ms; `Role.Tab` or `selected` semantics; `ChipRow` = horizontally scrolling `LazyRow` with gutter content padding (never a fixed `Row`) | SignalBadge styling, TrustBadge, StatusChip, SecondaryChip, StatusPill, CoverageStateChip, ToolPill, ViewTogglePill, AssistChip toggles, FilterRow, SentimentRangeSelector |
| 15 | `StatusBadge` | `badge` radius, 1 dp border = tone colour mixed 55% into `line2`, padding 3×8, 7 dp square + `eyebrow`-sized sentence-case text (11 sp 600, tracking .03em) | Non-interactive | `SignalBadge` (and its "NO SIGNAL"), raw status pills ("DATA_INCOMPLETE") |
| 16 | `SegmentedControl` | pill container 1 dp `line2`, 4 dp inner padding, sliding inverted pill indicator behind equal-width segments | Indicator glides (`spatial`), label colour 150 ms; `segment()` haptic; `Role.RadioButton`/`selected`; max 4 segments, else use `ChipRow` | `SegmentRow` (Names), `SegmentButton`, range `AssistChip`s, view toggles |
| 17 | `ChapterPills` | sticky `LazyRow` on the background bitmap @ 92% + bottom hairline; pills as `ThesisChip`; selected inverted; auto-centres the selection | Scroll-spy (playbook §11): selection follows the chapter crossing 45–50% of the viewport; tap scrolls to the chapter; `segment()` haptic on tap only | (new) mirrors DD chip nav in Pulse and classic Deep Dive |
| 18 | Buttons | `PrimaryButton` = **ink inversion** (`selectedFill` fill, `onSelected` text) in both themes; inside a HeroBand only: `heroAccent` fill, `heroBg` text (the one gold fill). `SecondaryButton` = transparent, 1 dp `line2` outline, ink text (DD `.iconbtn`). `TertiaryButton`/`TextAction` (accent text, no fill, 48 dp min). `DestructiveButton` (neg text, `line2` outline; confirm dialog required). `ThesisIconButton` (48 dp touch, 40 dp visual circle, tint press). `ThesisLink` (inline accent text, underline 1 dp offset 2, 48 dp touch via `minimumInteractiveComponentSize`) | All: pill, **visual height 40 inside the 48 dp touch area**, horizontal padding 16, `button` style. P: scale .97 (standalone buttons only) + the kit tint. X: fill/outline `line`, text `muted` (distinct from enabled). L: label swaps to a 16 dp arc spinner in the text colour, width locked. ≤ 1 filled control per screen (rubric V3). `press()` haptic only for commit actions (Build report, Subscribe, Run scenario) | 7+ button styles, `EmptyStateActionButton` gradient pill, the full-width bronze pill, clickable `Text` links, `OutlinedButton`s with 1.24:1 borders |
| 19 | Inputs | `ThesisTextField`: real `label` (floating, bodySmall), `surface` fill, 1 dp `control` border → 2 dp `accent` when focused, `panel` radius, min height 56, helper/error line (caption; error in `neg` with icon, `liveRegion`), placeholder in `muted`. Variants: `TickerField` (all caps, `ImeAction.Search`, `SuggestionList` #44, trailing action button), `NumberField` (decimal keyboard, unit suffix "%", validation message), `PasswordField` (visibility toggle with description "Show password"/"Hide password") | Autofill hints on email/password; IME Next/Done chains; `imePadding` from `ThesisScreen` (requires `adjustResize`, section 5.5) | Auth/Reset/Names/Deep Dive raw `OutlinedTextField`s, separate mono "EMAIL" labels |
| 20 | `ThesisSheet` | M3 `ModalBottomSheet` (1.2 experimental API), `sheet` shape, `surface` container, `scrim`, drag handle 36×4 `line2`, title `subhead`, content padding 16 + nav inset | Content enters with crossfade + 8 dp rise (`Enter`), no stagger, no blur; `confirm()` on commit then close. **No text inputs inside a `ThesisSheet` on M3 1.2** (separate window, unreliable IME insets): any sheet with a field is a `DockPanel` | tool `Dialog`s in Deep Dive, filter/sort menus, context menus |
| 21 | `DockPanel` | in-window panel anchored to the bottom (not a separate window): `sheet` shape, drag handle, detents 45% and 85% of height, `surface@98%` | Slides up `Enter`; content behind stays scrollable; back closes it first; **when a text field inside it gains focus it moves to the 85% detent** (at 45% minus the keyboard only ~3 lines show) | Notes dialog over the report, any sheet with a text field |
| 22 | `ThesisDialog` | `dialog` radius, `surface`, title `subhead`, body `body` ink2, actions right-aligned (Tertiary + Primary or Destructive) | Enter: scale .96 + 8 dp rise + fade 220 ms `EaseEnter`; exit 150 ms; destructive confirm disabled state visibly muted | M3 `AlertDialog` defaults (purple #2B2930, 28 dp) |
| 23 | Snackbar | `ThesisSnackbarHost` in the shell: `ink` container, `surface` text, `accent`-on-ink action ("Undo"), `panel` radius, 16 dp from edges above the bottom bar; duration 4 s, 8 s with an action | Enter: rise 12 dp + fade 220 ms; one at a time; `liveRegion = Polite` | lavender M3 default snackbar |
| 24 | `EmptyState` | inside a `ThesisCard`: optional 20 dp line icon (muted), `subhead` sentence (what will be here), `body` ink2 line (how to get it), at most one `PrimaryButton` or `SecondaryButton` | Sentence case only | `EmptyStateView` family (32 dp radius, gradient CTA, Title Case) |
| 25 | Skeletons | `SkeletonBlock` (`surface2`, `badge` radius), recipes `SkeletonRow`, `SkeletonCard`, `SkeletonKpiGrid`, `SkeletonHero`, `SkeletonChart`; one `shimmerSweep` per screen (playbook §12) | Shown after 300 ms, kept ≥ 400 ms (`rememberShowSkeleton`), static under reduced motion; must match final layout heights | global `CircularProgressIndicator`, bare 28 dp spinners |
| 26 | `ErrorState` / `InlineBanner` | Error: card with `subhead` "Couldn't load …", body cause in plain words, `SecondaryButton` "Try again". Banner: `surface2` row with 16 dp icon, caption text, optional `TextAction`; tones neutral/attention/error | `liveRegion`; banners never replace content that is already loaded | "Inbox unavailable" list wipe, warning-yellow error text, offline text matching |
| 27 | `StateCrossfade` + `Loadable` | `Loadable.Loading/Empty/Failed/Ready` (playbook §13) | Crossfade only when the kind changes; Ready→Ready updates in place | every loading/empty/error `if` ladder |
| 28 | `LoadingHairline` | 1 dp `line` divider with a 20% `accent` highlight travelling across in 2.25 s linear | Used as the "refreshing in background" signal under ScreenHeader; static `line` under reduced motion | refresh spinners, "Refreshing…" texts |
| 29 | `LiveDot` | 6 dp dot in `up` colour, ring 3→5 dp, alpha .18→.06, 2 s loop | **Only for a War Room in its Live phase** (War Room stepper, the Name earnings row, a TickerRow's leading column). Never next to market data or timestamps. Still under reduced motion; semantics "Live" | — |
| 30 | `CompareTable` | `panel` card; **one non-lazy composable with a single `horizontalScroll`** for the value columns and the label column pinned (no `ScrollState` shared across lazy rows); header rows: period per column (`FY Sep-25`) then filing type and date; first column labels left (with units); 2–4 value columns right-aligned `tableNum`; optional delta/basis column (`bps`/`%`, Tone, header names the basis); optional median row in `surface2`; the subject column header in accent | Header tap sorts by that column (Compare names); cell tap opens `SourceSheet` (definition, filing, derivation, evidence); overflow: "Copy as table" (tab-separated, pastes into Excel/Sheets) and "Share as image" (HeroBand-style card); `contentDescription` per row | (new) report compare, names compare, scenario compare |
| 31 | `NoteBlock` | eyebrow "YOUR NOTE" + filing caption ("10-K FY2025"); `story`-style editable text (Newsreader 17) on `surface`; empty placeholder scaffold "What I believe / What would prove me wrong / What I'm watching" (plain text, no schema); footer: saved state ("Saved · 2 min ago" / "Saving…" / "Not saved, try again") + char count + `content_copy` Copy + `share` Share; preview variant (3 lines + "Edit") | Autosave 800 ms after typing stops and on leave; on save success the footer crossfades and a 12 dp check draws (`confirm()` haptic once per editing session); never loses text on error; saved text is written through the local notes cache (section 5.5) | Deep Dive "My Notes" block, "Last saved: <raw>" |
| 32 | `HighlightText` | `Text` with lead-phrase marker band 54–96% of line height in `highlight` (DD §7), optional drop cap (`newsreader_display`, accent) | Pure draw-phase | — |
| 33 | `StageProgress` | vertical list of stages: 12 dp ring (done = accent fill + check, current = accent ring + `LoadingHairline` under its label, waiting = `line2` ring), stage label `body`, caption | Label swaps with a `Base` crossfade + 8 dp rise; completion: reward pulse | `DeepDiveLoadingScreen` timers and `PlasmaOrb` |
| 34 | `ThesisRefreshBox` | travelling-hairline indicator on M2 `pullRefresh` (delegates to `ui/motion` `ThesisPullRefresh`): a gutter-inset 1 dp line grows from the centre with the pull (`ink`, `accent` once armed); while refreshing the `HairlineLoop` highlight travels across it in a 16 dp gap the content keeps open | `refreshing` comes from the ViewModel only (no fake delays); `threshold()` haptic when armed; TalkBack "Refresh" action, polite "Refreshing" status | M2 `PullRefreshIndicator` in Home/Pulse/Sentiment, "Refresh …" buttons |
| 35 | `ActionRow` | 24 dp icon (ink2) + title (`rowTitle`) + caption; whole row clickable; no chevron (`open_in_new` only for external links) | — | card-as-link ("STRESS TEST" card), Research tool links, Settings rows |
| 36 | `Eyebrow`, `Kicker`, `NoteMark`, `CountBadge`, `Meter`, `StatusSquare`, `Avatar` | small atoms. `Meter` in lists and grids: `ink2`@60% on `grid`; `accent` only for a single subject meter | — | inline caps labels, misc |
| 37 | `RunBar` | sticky bottom bar: background bitmap @ 92% + top hairline, insets; one `PrimaryButton` (full width minus gutters) + optional caption above it ("2 selected") | Slides up `Enter` when it appears; button loading state in place | Names compare bar, Scenario run button |
| 38 | `AlertRow` | leading 24 dp category square (`alertCategoryColor`); line 1: ticker eyebrow (tappable → Name) + relative time right; line 2: title `rowTitle`; line 3: body 2 lines ink2; 6 dp `accent` "new" dot before the time | Tap expands in place (`animateContentSize(spatial)`); swipe toward start = Quiet 24 h with undo snackbar (M3 1.2 `SwipeToDismissBox`, background `surface2` + `notifications_off` icon); press tint | Inbox alert cards (5 buttons each) |
| 39 | `DayHeader` | sticky `stickyHeader`: `eyebrow` text ("TODAY", "YESTERDAY", "MON 17 NOV", year when not this year) on the background bitmap @ 92%, bottom hairline | `heading()` | History/Inbox ad-hoc date labels |
| 40 | `PressableCard` | `ThesisCard` + the kit press (tint, scale .97 when standalone) + optional bounds capture for the container transform | No border colour change on press | `InteractiveCard` |
| 41 | `ContainerTransformHost` | playbook §8a clip-reveal host in `ui/motion/`; the detail inside the clip is opaque (`ThesisScreen`) | 300 ms in, 240 ms out; reduced motion → crossfade | (new) |
| 42 | `DismissibleItem` | wraps a lazy item: `AnimatedVisibility(shrinkVertically + fadeOut, Base)` then calls `onRemoved`; screens hold a `pendingRemoval` set; undo cancels it and the item expands back | `animateItemPlacement` (1.6) moves the survivors but does not animate the removed item; this does | (new) Remove name, Quiet alert |
| 43 | `SheetActionRow` | 48 dp row in sheets: 20 dp icon + `body` label; destructive variant in `neg` | press tint | context-sheet menu items, `DropdownMenu`s |
| 44 | `SuggestionList` | in-window dropdown under a `TickerField`: `surface` card, `panel` radius, up to 6 rows (ticker `rowTitle` + company name bodySmall ink2 + "In your names" caption), keyboard-aware max height | Appears with `Quick` fade; rows press tint; `Role.Button` per row; no separate window (IME safe) | Names/Research suggestion popups |
| 45 | Selection controls | **Switch:** checked track `ink`, thumb `surface`; unchecked track `surface2` with 1 dp `control` border, thumb `control`. **Checkbox:** `badge`-radius square, checked `ink` fill + `surface` check, unchecked 1.5 dp `control` border. **Radio:** 1.5 dp `control` ring, selected `ink` dot. No gold. **PagerDots:** 6 dp dots, current `ink`, others `line2`, no stretching pill | colour 150 ms; `toggle(on)` haptic on switches | M3 defaults |
| 46 | `PlanCard` | `ThesisCard` `Selected` variant with `Role.RadioButton`: plan name `cardTitle`, price `statValue`, period caption, optional "Saves X% vs monthly" `StatusBadge` | — | Paywall plan rows |
| 47 | `SourceSheet` | `ThesisSheet`: metric name `subhead`; definition (`body`); source: form, period, filed date (`Fmt.filing`); derivation for derived metrics ("Operating income ÷ revenue"); evidence links (`ActionRow` + `open_in_new`) from the report's evidence refs; for scores: inputs and weights from `ui/copy/ScoreCopy.kt` | Opened by tap on a non-navigating figure, long-press on a figure inside a navigating row | metric glossary sheet |
| 48 | `ReportDock` | floating pill row (surface@94%, 1 dp `line2`, 48 dp, 16 dp from edges, above nav inset) of `SecondaryButton`-style segments: Notes · Compare · Stress · Conviction (Pro) | Hides on scroll down, shows on scroll up (translateY + fade, `spatial`) | 2 dp tool pills |
| 49 | `ChartReadout` | the chart card's header line rewritten during scrub: value `statValue`, date caption, change from window start (Tone); a 1 dp `ink2` vertical cursor + 4 dp dot on the line | Springs back to "now" on release (crossfade) | Vico markers |
| 50 | `TapeRow` | horizontally scrolling `LazyRow`, `tapeRow` 44 dp: items "S&P 500 5,948.71 +0.4%" (`tape` style; name in ink2, level ink, change in tone) separated by 16 dp; leading caption "Pre-market tape · as of 06:15" | No roll, no wash, no dot; refresh = `Base` crossfade per item. Tap → Pulse at the Markets chapter | Home 3×2 KPI market strip |
| 51 | `SinceLastReport` | block: eyebrow "SINCE THE LAST REPORT"; two dated lines `previousView` (ink2, filing + date) → `currentView` (ink); up to 3 `topChanges` rows (title `rowTitle`, direction mark ▲▼ as icon + text, one-line `whyItMatters`); thesis-drift `StatusBadge` from `trustMetadata.thesisDrift.status` | Rows open the report at the matching chapter; hidden when `changeSummary` is null (first report) with a caption "The comparison appears after the next filing" | (new) Name, Compare reports, drift alerts |
| 52 | `NotesTrail` | reverse-chronological list of note entries for one ticker: entry header (filing period + date + that report's verdict sentence in `bodySmall` ink2), then the note (`story`, preview 4 lines) | Newest entry is an editable `NoteBlock`, older ones read-only previews that expand; when the newest report has no note and an older one does: the older note shows with a "Carry forward" `TextAction` that copies it into the new note | (new) Name "Your notes", Notes view |

Charts (`ui/charts/kit/`, PR-2; tokens from `deep-dive-visual-language.md` §8 and §10.5; all Canvas, no Vico).
**Chart cards** follow the renderer: a gold fignum `CHART n` (eyebrow 11/600/.14em, `accent` @ .9), then a serif
conclusion title (`cardTitle`: "Services now carries the margin"), then the chart, then the source caption.

| Chart | Spec | Used on |
|---|---|---|
| `Sparkline` | 1.5 dp `ink@60%` line (monochrome; accent only for the subject), optional area fill 18%→0, end dot r 2.5; draw-on once per data identity | Home macro card, Weekly digest |
| `LineChart` | fixed height (180 compact / 240 featured), one y-axis, 4 nice ticks, horizontal `grid` lines, `axis` baseline, x labels thinned from the last, 2 dp line round caps, end dot r 4 with 2 dp surface ring, only the latest value labelled with a 3 dp halo; optional bands (regimes) as 6% fills; scrub (playbook §10) rewriting the `ChartReadout`; morph on range change; **indexed mode** (first common value = 100) for Compare names | Macro Stress, Compare names "Show chart" |
| `ColumnChart` | width min(24 dp, 72% of band), 4 dp rounded data end only, history at alpha .42 when `highlightLast` | classic Deep Dive five-year |
| `SmallMultiples` | 2-column grid of compact `ColumnChart`s, one per ticker, shared y-scale per metric | Compare names "Show chart" (alternative to indexed) |
| `RankedBars` | 34 dp rows (two-line variant 52 dp with a rationale line), label 11/500 left, value 11/600 tnum right, 8 dp track on `grid` radius 4, sorted descending; header states the scale | Scenario Stress results, evidence counts (replaces radar) |
| `Meter` | track 4–8 dp on `grid`, fill `ink2`@60% (lists, grids) or tone; accent only for one subject | factor sub-scores, Name monitor score |
| `RangeBar` | horizontal bear → base → bull band (series[0] at 35%/100%), price marker (ink 2 dp line + label), optional "your value" marker (accent ring) | classic Deep Dive fair value, scenario fan replacement |
| `ScaleBar` | 0–100 bar with three regime segments (Favourable/Neutral/Unfavourable at 18% alpha) and a marker | Macro Stress header (replaces the semicircle gauge) |
| `Timeline` | 2 dp `line2` rail, 12 dp rings (2 dp series[0] border, surface fill), item gap 16 | Conviction journal, War Room phases |

Each chart provides `semantics { contentDescription = summary }` (for example "Macro stress, 30 days, from 41 to 58,
now 58, Balanced") and a "Show table" `TextAction` that expands a `CompareTable` of the values.

**Composables deleted when their replacement lands:** `InteractiveCard` (folded into `PressableCard`),
`SignalBadge`, `PlasmaOrb`, `RevealAnimation` and `AnimatedCounter` (by WP-A, whose `HomeScreen` is their only
user), `StaggeredEntrance` (after PR-3 call sites move), `EvidenceRadar`, `ScenarioFanChart` (replaced by
`RangeBar`), `SubScreenBackRow`, dead `WelcomeScreen.kt`, `LoginScreen.kt`, dead tabs in `ThesisApp.kt`,
`res/layout/activity_main.xml`, stale `colors.xml` names. **Deleted in PR-1 by F2** (zero callers today):
`ShimmerCard`, `EmptyStateView` family, `DeltaIndicator`.

---

## 4. Motion system

Code lives in `ui/motion/`. The playbook (`compose-motion-playbook.md`) has the implementations; this section fixes
the values and where they apply. All snippets used must be the playbook's **[1.6 OK]** versions.

**What [1.6 OK] means:** it compiles on Android with this BOM. Files under `ui/` must *also* compile in the
harness, so they never import `android.*`, `androidx.activity.*` or `androidx.lifecycle.*` except in `ui/platform/`.
Concretely: back handling goes through `ui/platform/Back.kt` (`ThesisBackHandler`, `ThesisPredictiveBackHandler`;
Android implementation over `BackHandler`/`PredictiveBackHandler`/`BackEventCompat`, harness shim no-op); haptics
through `ui/platform/PlatformHaptics.kt`; the stagger clock uses `withFrameMillis` (deterministic under the
harness's virtual time), never `android.os.SystemClock`. Playbook §5, §8a and §3.3 snippets are adapted
accordingly. Press feedback is built from `interactionSource` + draw-phase reads, **never a custom
`Indication`/`IndicationInstance` class** (deprecated in 1.7).

### 4.1 Compose BOM decision: stay on 2024.06.00 for this redesign

Decision: **no BOM bump in PR-1 to PR-3.** Bump to `compose-bom:2025.04.00` (Compose 1.7.8, still Kotlin 1.9.24 and
compiler 1.5.14) as a separate **PR-4** after PR-3 merges. Never go to 2025.04.01+ before the Kotlin 2 migration.

Why this is the low-risk call:
1. Everything the redesign needs has a 1.6 path: container transform via clip-reveal (playbook §8a),
   `animateItemPlacement` (experimental) for reorders, `PredictiveBackHandler` (from activity-compose 1.9.1, not the
   BOM), M3 1.2 `ModalBottomSheet`, M2 `pullRefresh` (unchanged by any bump).
2. The only place we can see pixels is `design-preview`, which compiles against Compose Desktop 1.6.11 (= Compose
   1.6). Writing 1.7 APIs would make screens uncompilable in the harness and we would be designing blind.
3. The real Android build cannot run in the container (Google Maven blocked), so a bump can only be verified by CI
   and a device pass. Isolating it in PR-4 makes any regression attributable to one line.
4. PR-4 scope (owner: WP-INT): one-line BOM change, regression pass from the playbook §1.3 (pager, pull-to-refresh,
   serif metrics, every ripple, WebView back), then optional upgrades: §8a → §8b `sharedBounds`, `animateItem`,
   §8c seekable predictive back, M3 1.3 sheet predictive back. The harness moves to Compose Multiplatform 1.7.x in
   the same PR and re-checks its `androidx.collection` and lifecycle substitutions; otherwise those screens move to
   `androidOnlyFiles`. The kit's `RippleTheme` override (4.4) becomes `RippleConfiguration` there.

### 4.2 Tokens (`ui/motion/Motion.kt`, object `ThesisMotion`)

| Token | Value | Use |
|---|---|---|
| `Press` | 90 ms, `EaseStandard` | press-in |
| `Quick` | 150 ms | colour/selection, icon swaps, exits of small things |
| `Base` | 240 ms | crossfades, content state changes, tape refresh |
| `Enter` | 320 ms, `EaseEnter` | sheet content, panels, first-open lists on Home/Pulse |
| `Screen` | 300 ms | push/pop, container transform, tab fade-through total |
| `Roll` | 360 ms per digit, `EaseStandard`, +18 ms per position from the right (cap 4) | `RollingNumber` |
| `Draw` | 900 ms, `EaseCalm` | chart draw-on |
| `Morph` | 500 ms, `EaseCalm` | chart range change |
| `ShimmerSweep` / `ShimmerRest` | 1400 / 600 ms, `EaseInOut` | skeleton |
| `HairlineLoop` | 2250 ms linear | `LoadingHairline` |
| `LivePulse` | 2000 ms, `EaseInOut`, reverse | `LiveDot` (War Room live only) |
| `StaggerStep` / max steps | 35 ms / 8 | Home and Pulse first open per issue only |
| `EnterOffset` | 8 dp | entrance rise (sheets, panels, banners) |
| `PushOffset` | 24 dp, horizontal | shared-axis X push/pop |
| `ModalOffset` | 32 dp, vertical | modal destinations only (Paywall, You) |
| `PressScaleButton` | 0.97 | standalone buttons and standalone clickable cards only |
| `PressTint` | `ink` @ 6% (dark: @ 8%) | the one press language |
| `EaseStandard` | `CubicBezierEasing(0.2f, 0f, 0f, 1f)` | default |
| `EaseEnter` | `(0.05f, 0.7f, 0.1f, 1f)` | anything appearing |
| `EaseExit` | `(0.3f, 0f, 0.8f, 0.15f)` | anything leaving |
| `EaseCalm` | `(0.33f, 0f, 0.15f, 1f)` | data reveals |
| `EaseInOut` | `(0.45f, 0f, 0.55f, 1f)` | loops only |
| `spatialFast` | `spring(1f, 1400f)` | small moves |
| `spatial` | `spring(1f, 700f)` | segment indicator, expand, placement |
| `spatialSlow` | `spring(1f, 380f)` | bounds, large panels, predictive-back cancel |
| `effects` | `spring(1f, 1600f)` | colour/alpha that must be interruptible |
| `pressRelease` | `spring(0.85f, 700f)` | release after press (the only overshoot, ~1%) |
| `reward` | `spring(0.8f, 380f)` | once: "Deep Dive ready" pulse |

Removed in v2.1: `CountUp` (the hero figure is final on first paint), `Flash` (a colour wash on a changed figure is
trading-app vocabulary), blur of any kind. No other durations, easings or springs in screens (rubric item T5).
Exits run at about 60% of their entrance. `ui/shell/**` and `MainViewModel` use `ThesisMotion` too (the lint
excludes them only for the two polling `delay(` calls, section 7.2).

### 4.3 Choreography rules

1. One hero motion per screen (listed per screen in section 5). Everything else is press feedback or quiet fades.
2. **Pushed screens arrive in one piece.** Stagger exists only on Home's first open per Pulse issue and Pulse's first
   open per issue, through `EntranceCoordinator` (playbook §5, first 8 items): never replays on scroll-back, tab
   return, refresh or recreation. Its seen-set lives in a navigator-scoped registry keyed by the entry's `entryId`
   (not a `HashSet` in `remember`, which is disposed with the screen and replays on every tab return). Reset key =
   the data identity (Pulse report id), not `Unit`.
3. Primary element first: in a push, the whole new screen lands as one surface; nothing is choreographed after it.
4. The background (page glow) never moves during foreground motion.
5. Refresh never blanks: app-computed values roll, market values crossfade, rows animate placement, a
   `LoadingHairline` shows work in progress.
6. Expand/collapse uses `animateContentSize(spatial)` on the small container only (a card, a row), never a screen.
7. Inputs and lists the user operates many times (typing, chip filters, scrolling, opening name after name) get
   press feedback only. Filter changes swap the list with a 150 ms fade, no stagger.
8. Never start from scale 0 or alpha 0 + large travel. Start at scale ≥ .96, travel ≤ 32 dp.
9. All state reads for animation happen in the layer/draw phase (`graphicsLayer {}`, `drawWithCache`), never
   `Modifier.alpha(x.value)` / `.scale(x.value)` / `.offset(x.dp)`. `delay()` is banned for animation timing
   (use `tween(delayMillis = …)`); it is allowed only for perception delays (skeleton grace).
10. At most one infinite animation on screen at a time (`LiveDot` or `LoadingHairline` or shimmer or report-ready).
    With `LiveDot` limited to War Room, Home and Pulse can no longer run two.

### 4.4 Interaction catalogue (by component)

**One press language** (`ui/motion/Press.kt`, `Modifier.thesisPress(interactionSource, scale = false)`): on press-in
a `PressTint` fill drawn in `drawWithContent` over `Press` 90 ms, fading out over `Quick` on release; scale .97 only
when `scale = true` (standalone buttons and cards). Kit clickables use `clickable(interactionSource, indication =
null)` + `thesisPress`. For the M3 components we still use (Switch, TextField, sheets), `ThesisTheme` provides a
`RippleTheme` with `ink` colour and the `PressTint` alpha, so the residual M3 ripple (switch thumb, text field)
reads as the same tint (PR-4: `RippleConfiguration`). **No ripple on any kit or screen surface, no border flash,
no darkening.**

| Component | Interaction | Spec |
|---|---|---|
| Buttons (standalone) | press | tint + scale 1→.97, release `pressRelease`; haptic `press()` only on commit actions |
| Standalone cards (`PressableCard`) | press | tint + scale .97, release `pressRelease`; no border change; no haptic |
| Rows in a `RowGroup` (`TickerRow`, `DataRow`, `AlertRow`, `ActionRow`) | press | tint only, full-bleed to the card edges, no scale; no haptic |
| Rows | long-press | `surface2` fill (no scale), `longPress()` haptic, opens context sheet |
| Figures (`KpiTile`, `DataRow` value, `CompareTable` cell) | tap / long-press | opens `SourceSheet` (tap when the figure does not navigate) |
| Chips, segments | select | fill/text colour 150 ms; segment indicator glides `spatial`; `segment()` haptic for SegmentedControl and ChapterPills taps, none for filter chips |
| Toggle rows | toggle | Switch with kit colours (#45); `toggle(on)` haptic |
| Bottom bar | tab change | glyph outlined→filled and colour crossfade 150 ms; no indicator; no haptic |
| Top bar | scroll under | hairline and background fade in 200 ms (`derivedStateOf` on scroll > 8 dp); title crossfade 200 ms; hero → paper palette crossfade on HeroBand screens |
| Sheets / DockPanel | open | M3 sheet motion; content: crossfade + 8 dp rise, `Enter`, no stagger, no blur |
| Dialogs | open/close | scale .96 + 8 dp rise + fade 220 ms `EaseEnter`; close 150 ms `EaseExit` |
| Snackbar | show | rise 12 dp + fade 220 ms; hide 150 ms |
| Inbox alert | expand | `animateContentSize(spatial)` on the row; detail fades in 240 ms after 60 ms |
| Inbox alert | swipe / quiet / turn off | `DismissibleItem` collapse (shrink + fade, `Base`), survivors glide `animateItemPlacement(spatial)`; undo snackbar expands it back |
| Names | remove | same `DismissibleItem` pattern after the confirm dialog |
| NoteBlock | saved | footer text crossfade 240 ms; check path draws 300 ms `EaseCalm`; `confirm()` haptic |
| Text value change (non-numeric: stage labels, status lines) | swap | crossfade `Base` with an 8 dp rise on the incoming text; no blur, no scale |
| `StateCrossfade` | kind change | fade out 150 `EaseExit`, fade in 240 after 60 `EaseStandard`, size change `spatial` |
| Skeleton → content | ready | crossfade in place 240 ms (same layout, nothing jumps) |
| Pull to refresh | pull | content follows the pull (`RefreshTravel` 40 dp, settles on `spatial`); the hairline grows from the centre with progress and turns `accent` when armed, `threshold()` haptic at arm; while refreshing the `HairlineLoop` highlight travels across a 16 dp gap; on finish values update in place. Reduced motion: nothing moves, the line shows progress in place and is static while refreshing |
| Errors | inline | banner slides down 8 dp + fade 240; `reject()` haptic only for a failed commit (save, run) |

### 4.5 Navigation transitions (implemented in `ui/shell/`, all [1.6 OK])

One spatial model: **depth runs along X**, the same axis as predictive back. Vertical motion is reserved for
modal destinations.

| Move | Transition | Spec |
|---|---|---|
| Bottom tab ↔ tab | fade-through, state kept | out: fade 90 `EaseExit`; in: fade + scale .985→1, 210 after 90 `EaseEnter` (the scale applies to the page's content only, so the page glow never moves, 4.3.4); `SaveableStateHolder` per tab keeps scroll position and sub-stack |
| Push within a tab (Home→Pulse, Home→Macro, Research→History, Research→Scenario, Inbox→War Room…) | shared-axis X | `Screen` 300 ms in all, halves in sequence like the tab fade-through: old: translateX 0→−24 dp + fade out, 90 `EaseExit` (`TabOut`); then new: translateX +24 dp→0 + fade, 210 `EaseEnter` (`TabIn`) after 90. The new screen is drawn over the old one but stays transparent until the old one has gone, so nothing double-exposes and the old screen's exit (or a predictive back's .90 preview) is seen to its end. Pop: mirror. One spec in the app: `ThesisTransitions.sharedAxisX` (the shell and Auth ↔ Password reset call it). The new screen arrives complete (no stagger) |
| List item → its detail (Names row → Name, Home name row → Name, History row → report, Recent report → report) | container transform | `ContainerTransformHost` (playbook §8a): clip from the row's bounds to full screen, row corner radius → 0, `surface → bg`, detail fades in over the last 70%; **300 ms in, 240 out**; Name's KPIs arrive with the transform (no cell stagger) |
| Name ↔ next/previous name | horizontal pager | swipe on Name follows the current Names sort and filter; caption "3 of 12"; no transform |
| Any push/transform | predictive back | `ThesisPredictiveBackHandler`: content scales to .90 toward the swipe edge and shifts 8 dp with progress; commit runs the pop; cancel settles back `spatialSlow` |
| Onboarding → Auth → App | crossfade | 300 ms `EaseStandard`, no slide |
| Auth ↔ Password reset | shared-axis X | same as push |
| Report host ↔ classic view | crossfade | 240 ms; scroll position of the classic view starts at the top with a banner |
| Open Paywall, You, Search | modal rise | full-screen destination on the global modal stack, 300 ms in all: the page background covers the page under it (150 `EaseEnter`); from 120 ms (under 1% of the page under it left) the content rises `ModalOffset` 32 dp and fades in (180 `EaseEnter`). Close, 240 ms: the content falls 32 dp and fades out (90 `EaseExit`), then the background uncovers the page under it (150 `EaseStandard`). The page glow never moves; under reduced motion both are 150 ms crossfades |

`AndroidManifest.xml` gets `android:enableOnBackInvokedCallback="true"`. Back handlers are enabled only while they
have work (sub-stack non-empty, sheet open), so the system back-to-home animation still works at the root.

**Back stack model** (replaces the enums-in-`when` hard cuts; no navigation library):
`sealed interface Destination` with tab roots (`Today`, `Names`, `Research`, `Inbox`), pushes (`Pulse(date?)`,
`MacroStress`, `WeeklyDigest`, `Name(ticker, pagerScope?)`, `Report(reportId, ticker, chapter?)`, `ReportClassic(...)`,
`DeepDiveRunning(ticker)`, `CompareReports(a, b)`, `CompareNames(tickers)`, `History(filter?)`, `WarRoom(id)`,
`ScenarioStress(runId?, ticker?)`) and a **global modal stack** above all tabs (`You` and its Settings sub-pages,
`Paywall`, `Search`). Every entry carries a unique `entryId`.

- **Ownership:** `AppNavigator` (plain class in `ui/shell/AppNavigator.kt`, compilable in design-preview) is created
  and owned by `MainViewModel`. It holds one stack per tab plus the modal stack (`SnapshotStateList`), `push`, `pop`,
  `switchTab`, `replaceTop`, `openFromDeepLink(LaunchTarget)`. The stacks are persisted in `SavedStateHandle` as
  encoded strings (`Destination.encode()/decode()`; no parcelize plugin), so rotation, font-scale changes and a
  scheduled system dark-mode switch (which recreate the Activity; Q2's Auto default makes that a nightly event) keep
  the whole stack.
- **One source of truth for the tab:** `UiState.currentTab` is deleted; the ViewModel calls `navigator.switchTab` /
  `navigator.push` where it set the tab before (`MainViewModel.kt:212, 221, 1417`).
- **Saved UI state per entry:** `SaveableStateProvider` is keyed by `entryId`, not by tab, so `Name(AAPL)` →
  `Name(MSFT)` → back returns to AAPL's exact scroll position (5.25).
- `ThesisShell` stays a pure composable that receives the navigator's state and callbacks.
- **The report WebView survives pushes over it:** while a `Report` entry is anywhere in the current stack, the shell
  keeps it composed in a base layer under the `AnimatedContent` (option (b) of the Android critique), and screens
  pushed from the report (Compare reports, Compare names, Scenario Stress, Name) draw opaque on top. Back returns to
  the live WebView with its scroll position; no reload, no new token. The layer is dropped when the entry is
  popped. R1 checklist: "back from Compare restores the report scroll".
- Tests: `DestinationCodecTest` (encode/decode round trip of every destination) and `AppNavigatorTest`
  (push/pop/switchTab/back-at-root/deep link, and a simulated recreate through `SavedStateHandle`).
- `LaunchTarget.tab` strings ("today", "names", "research", "inbox", "you") are kept unchanged so
  `LaunchDestinationResolverTest` passes ("you" opens the modal stack).

### 4.6 Number and chart animation

- **Market values never animate** (principle 14): the Home tape and Pulse Markets rows crossfade (`Base`) on refresh.
- `RollingNumber` (playbook §6.1 with `Roll` timings): **app-computed values that refresh in place only**: Macro
  stress score after a refresh (Home card, Macro screen), Scenario results when a run completes, monitor scores after
  a board refresh, Weekly digest and Inbox counts. Digits roll in the direction of the change; non-digits do not
  roll; top/bottom 18% edge fade mask (`DstIn` gradient); no colour wash; **never on first paint**.
- The hero figure shows its final value on first paint (`CountUpText` is not built).
- **Frozen report figures never animate** (Deep Dive native KPIs, Name "From the 10-K" grid, history rows, compare
  tables).
- Charts: draw-on (`Draw` 900 ms) **once per data identity** (the latest reading date or report id), not once per
  screen visit, so returning to Macro Stress the same day shows the chart complete. Range change morphs (resample
  both series to 120 points, lerp y, `Morph` 500 ms) and axis labels crossfade; never redraw from zero on a range tap.
- Scrub (Macro trend; the Weekly digest sparkline is not scrubbable): horizontal drag after slop; `ChartReadout`
  shows the scrubbed value, date and change from the window start; `gestureStart()` on start, `tick()` on week
  boundaries (not every point), `segment()` when crossing a regime boundary (35/70); release crossfades the readout
  back to "now".

### 4.7 Haptics (`ui/motion/Haptics.kt`, playbook §3.3; Android calls in `ui/platform/PlatformHaptics.kt`)

| Interaction | Call | Platform constant (fallback) |
|---|---|---|
| Card tap, nav tab, back, scrolling, filter chip | none | — |
| Commit CTA: Build report, Run scenario, Subscribe, Follow (add ticker) | `press()` | `VIRTUAL_KEY` |
| Follow/unfollow, notification toggle, reduce motion toggle | `toggle(on)` | `TOGGLE_ON/OFF` 34 (`CONTEXT_CLICK`) |
| SegmentedControl / ChapterPills tap | `segment()` | `SEGMENT_TICK` 34 (`CLOCK_TICK`) |
| Scrub start / end | `gestureStart()` / `gestureEnd()` | 30 (`CLOCK_TICK`) |
| Scrub crossing week boundary / regime line | `tick()` / `segment()` | `SEGMENT_FREQUENT_TICK` 34 (`CLOCK_TICK`), throttled 28 ms |
| Pull-to-refresh armed | `threshold()` | `GESTURE_THRESHOLD_ACTIVATE` 34 (`CONTEXT_CLICK`) |
| Note saved, export done, Deep Dive ready | `confirm()` | `CONFIRM` 30 (`VIRTUAL_KEY`) |
| Validation error, failed save/run, destructive confirm | `reject()` | `REJECT` 30 (`LONG_PRESS`) |
| Row long-press, alert swipe past threshold | `longPress()` / `threshold()` | `LONG_PRESS` / `GESTURE_THRESHOLD_ACTIVATE` |

Only `View.performHapticFeedback`; never `Vibrator`/one-shot effects. Haptics respect the system setting and are
not disabled by reduce motion.

### 4.8 Reduced motion

`LocalReducedMotion` (defined once, in F1's day-one API stub) = system animator scale is 0 **or** the in-app
"Reduce motion" toggle (You > Appearance, stored in `SessionStore`). Android implementation in
`ui/platform/AnimatorScale.kt` (ContentObserver, playbook §3.2); design-preview shim returns `false` unless
`-Dpreview.reducedMotion=true`. When on: entrances and stagger appear instantly; push/transform/tab become 150 ms
crossfades; `RollingNumber` becomes a 150 ms crossfade; charts draw complete, range changes crossfade; shimmer,
`LoadingHairline`, `LiveDot` and the report-ready pulse are static; press keeps the tint but not the scale. No
information is lost.

---

## 5. Per-screen redesign plan

Notation: **Hero motion** = the one motion that defines the screen. **Links** = where taps go. **Removed** = what
disappears. **Later, needs Razvan** = needs backend or a product decision; do not build now, do not fake it.

### 5.1 Launch and splash (WP-INT: `MainActivity`, manifest theme and Gradle are hot spots)
- `core-splashscreen` (androidx, in `app/build.gradle.kts`): `Theme.Thesis.Starting` with `bg` and the vector "T"
  mark (drawn by WP-G); `installSplashScreen()` + `setKeepOnScreenCondition` while session tokens restore; exit =
  240 ms fade into the first screen.
- `MainActivity`: `enableEdgeToEdge()`; status-bar icon appearance follows the theme **and** the top bar's
  `collapsed` flag on HeroBand screens (section 2.7); remove deprecated bar-colour setters.
- Values/themes.xml and values-night/themes.xml: window background = `bg` per theme (paper vs ink).
- Removed: `activity_main.xml`, `m7_bootstrap_*` strings, hard cut to a global spinner.

### 5.2 Onboarding (WP-G, `OnboardingScreen.kt`)
- Layout: full-bleed `HeroBand` per page (dark in both themes); `Eyebrow` (page 1 "THESIS", with the 28 dp rule),
  `title`, `lede` (heroInk2); `PagerDots` (#45: 6 dp, ink/line2, no stretching pill); bottom: `PrimaryButton`
  (hero variant, the one gold fill) "Continue"/"Get started" and `TertiaryButton` "Skip", inside navigation insets.
- **Illustration = real product fragments, not icons:** page 1 the "T" mark (64 dp, heroAccent) in place of
  PlasmaOrb; Pulse page: a real morning line in `heroLine` with its eyebrow; Deep Dive page: a chapter header
  "02 BUSINESS / How Apple makes money" rendered with `ChapterHeader`; Names page: two `TickerRow`s from a fixture.
  Privacy page: text only. No outlined Material icons.
- No fixed paddings (`80.dp`/`220.dp` removed): content is a `Column` with `weight` spacers so 1.3× and 2.0× fit.
- Hero motion: the existing text cascade, re-timed to tokens (eyebrow, title, lede at 0/60/120 ms, `Enter`).
- Disclaimer: caption in heroInk2 (≥ 4.5:1), not 30% alpha.
- Links: crossfade into Auth.

### 5.3 Auth: log in, create account, verify (WP-G, `ui/screens/AuthScreen.kt` extracted from `ThesisApp.kt` in PR-1)
- Layout: `HeroBand` top block (about 40% height, shrinks with IME): wordmark "Thesis" in `display`, tagline in
  `heroLine` ("Company research from SEC filings, written plainly.") ; below on `bg`: `SegmentedControl`
  (Log in · Create account); `ThesisTextField` email (autofill email, IME Next), `PasswordField` (autofill password,
  IME Done → submit); `PrimaryButton` (ink) full width; `ThesisLink` "Forgot password?"; verify step uses a 6-digit
  `NumberField` with "Send a new code" `TertiaryButton`; status line (`InlineBanner`, liveRegion) driven by a typed
  status enum from the ViewModel (no substring guessing); legal `ThesisLink`s (48 dp) and one disclaimer caption.
- `imePadding`, scrollable, focus order correct. Remove "WHAT YOU GET" value card (Onboarding covers it).
- Links: Forgot password → Password reset (shared-axis X), back returns.

### 5.4 Password reset (WP-G, `PasswordResetScreen.kt`)
- Same field styles as Auth; `ThesisTopBar` with back; ScreenHeader "Reset your password"; step 1 email → step 2
  code + new password with the rule shown as helper text ("At least 10 characters") and live validation; status
  banner liveRegion; `ThesisBackHandler` returns to Auth.

### 5.5 Shell (WP-INT; `ui/shell/ThesisShell.kt`, `ui/shell/AppNavigator.kt`, `ui/navigation/*`)
- `ThesisShell(state, navigatorState, callbacks)` is a pure composable (no ViewModel), so it renders in
  design-preview. `ThesisApp.kt` shrinks to: collect `UiState`, build callbacks, call `ThesisShell`.
- Structure: root fills `bg` and provides the `PageBackgroundCache` → report base layer (4.5) → `AnimatedContent`
  over `(tab, stackTop)` with section 4.5 specs → modal stack layer (You, Paywall, Search) → `ThesisBottomBar`
  (hidden on Report, ReportClassic, DeepDiveRunning and the modal stack) → `ThesisSnackbarHost`.
- Top bar: each screen supplies its `TopBarSpec` (title, subtitle, back, actions, `overHero`); root tabs show brand
  + `search` + avatar.
- Manifest: `android:windowSoftInputMode="adjustResize"` (required for `imePadding` under edge-to-edge on API < 30).
- Global spinner removed. `isLoading` is split in `MainViewModel` into `isPulseRefreshing`, `isMacroRefreshing`,
  `isBoardRefreshing`, `isInboxRefreshing`, `isHistoryLoading`, `isOpeningReport`, `deepDiveJob` (status), `authBusy`.
  Tab switches do not refetch if data is younger than 5 minutes; otherwise they refresh in the background with a
  `LoadingHairline`.
- Bottom tabs: Today, Names, Research, **Inbox** (moves from the bell to a tab; the bell icon is removed). You opens
  from the avatar onto the modal stack (no tab selected).
- Inbox "new" dot: alerts with `createdAt` after `lastInboxVisitAt` (stored in `SessionStore`, client-only; "Mark
  all as seen" sets it).
- Back: pop the modal stack first, then the current tab's stack; at a tab root other than Today, go to Today; at
  Today root, system default.
- Race fixes (P0, from audit A): `loadPulseByDate` stores its job in `pulseRefreshJob` and cancels the latest fetch;
  opening a past Pulse pushes `Pulse(date)` instead of `setTab(TODAY)`; History back never loops to Deep Dive;
  unknown alert routes push the alert's detail instead of re-selecting Inbox.
- **Client data layer for PR-3 (WP-INT, no backend):**
  - `ProductApiClient.parsePulseReport` parses the structured `market_tape` (`indices`, `cross_asset`: value,
    daily_change, daily_change_pct, unit, family, direction, as_of) that `/pulse/latest` already returns into
    `PulseReportView.tape` (replaces the regex over free text in `PulseScreen.kt:691`, which had no levels and no
    DXY). `marketTone` keys on `family`, not instrument strings.
  - Room (`offline/**`, existing `OfflineCacheDatabase`, one migration): `report_notes` (reportId, ticker, text,
    updatedAt, filing period, verdict sentence) written through on every load/save of `getReportNote` /
    `saveReportNote`; `monitor_snapshot_history` (ticker, takenAt, state, score, freshnessScore, reportId) appended
    on each board refresh, kept 90 days; `report_summaries` (reportId → company name, filing, verdict,
    `changeSummary`, `annualHistory` subset) cached on each `getDeepDiveReport`.
  - ViewModel contract: `openName(ticker)`, `nameDetail` (snapshot, report summary, notes trail, alerts for the
    ticker), `notesTrail(ticker)` (lists the ticker's reports via `listReports`, fetches missing notes, caches),
    `allNotes()`, `loadCompare(a, b)`, `loadCompareNames(tickers)` (N × `getDeepDiveReport` by each snapshot's
    `reportId`, cached), `search(query)` (tickers, names, cached reports and note text), `snapshotDelta(ticker)`,
    `lastNamesVisitAt`, `lastInboxVisitAt`, War Room auto-refresh, freshness-based refetch.

### 5.6 Today / Home (WP-A, `HomeScreen.kt`)
A briefing, not a dashboard: **five blocks**, and "Your names" above the fold on a 360 × 780 phone.
1. `ThesisTopBar` root: brand `THESIS`, `search`, avatar.
2. `ScreenHeader`: eyebrow `MON 24 NOV · PRE-MARKET` (phase word left out when unsure), title = the Pulse morning
   line shortened to one sentence in **`headline` (24), max 2 lines** (fallback "Good morning" only when there is no
   Pulse and the empty state below explains why); meta row: `As of 07:02` + `LoadingHairline` while refreshing. One
   timestamp only, no `LiveDot`.
3. **Tape** (`TapeRow`, 44 dp): S&P 500, Nasdaq 100, 10Y, VIX, DXY, WTI from the structured `market_tape` (5.5), level
   + signed change, `marketTone` by family (VIX/yields/DXY neutral), leading caption "Pre-market tape · as of
   06:15". Hidden if the tape is empty. Tap → Pulse at the Markets chapter. Refresh crossfades; nothing rolls.
4. **Your names** (`SectionHeader` kicker `YOUR NAMES`, headline generated: "2 of your names changed since
   yesterday" / "All 12 of your names are intact"; action "All names" → Names tab): static `RowGroup` of up to 5
   `TickerRow`s in the Names default order (state severity, then changed since your last visit), then "+N more" row.
   Tap → Name (container transform).
5. **Macro Stress** `ThesisCard` (clickable → Macro Stress): eyebrow `MACRO STRESS`, `cardTitle` sentence first
   ("Macro stress is Balanced and rising"), then the `figure` score (final on first paint, `RollingNumber` on refresh),
   `StatusBadge` label, delta "+6 pts vs 7 days ago" (rising = Unfavourable), 30-day `Sparkline` (monochrome). One
   action only: the card itself.
6. **Today's Pulse** (`SectionHeader` kicker `TODAY'S PULSE`, headline = the Pulse's lead conclusion): the morning
   briefing alert, when present, is its first row; then a `RowGroup` of up to 4 section rows (title + one sentence +
   `StatusBadge` only when coverage is incomplete), `TextAction` "Read the full Pulse" → Pulse.
- Moved off Home: "Continue reading" (now the first row of Research > Recent reports), footer ActionRows Weekly
  digest and History (now Research > Tools).
- States: no cache → `SkeletonHero` + skeleton tape + 3 skeleton rows; offline with cache → `InlineBanner`
  "Offline · showing 07:02" above content; no names → one `EmptyState` in the names section ("Follow a company to
  see it here", `PrimaryButton` "Add a name" → Names with the field focused); no Pulse → `EmptyState` in the Pulse
  section ("Today's Pulse arrives before the open" + scheduled time if known).
- Hero motion: first-open stagger of the sections (keyed by Pulse report id; once per issue). Refresh:
  `ThesisRefreshBox` bound to `isPulseRefreshing || isMacroRefreshing`; app-computed values roll, tape crossfades.
- Removed: duplicate timestamp, `LiveDot` next to the time, 3×2 serif KPI strip, double NoNames empty state, 40 sp
  "Pre-market" title, inline Full Pulse toggle, separate morning-alert card, "Deserves a deeper look" card, "Run a
  Deep Dive" on an unnamed first ticker, mono MANAGE/OPEN/DISMISS links, three gold button styles, fake 1.8 s refresh.
- Compare: "vs 7 days ago" on macro, change vs prior close on the tape (from `market_tape`), "since your last
  visit" on names.
- Notes: `NoteMark` on names with a note (from the local notes cache).

### 5.7 Pulse brief (WP-A, `PulseScreen.kt`)
1. `ThesisTopBar`: back, title "Pulse", subtitle `Mon 24 Nov`, actions `picture_as_pdf` (shows an inline 16 dp arc
   while exporting, then `confirm()`), `share` (copy as text).
2. `HeroBand` (under the status and top bars, 2.7): eyebrow `PULSE · MON 24 NOV` with the 28 dp rule, morning line in
   `heroLine` italic, meta `Generated 06:30 · data as of 06:15` (no `LiveDot`).
3. `ChapterPills` sticky: Markets · What changed · Your names · Watch · Headlines · Sources (only chapters with content).
4. Chapters (each a `ChapterHeader` "01 MARKETS" + headline + lede):
   - 01 Markets: `RowGroup` of `DataRow`s from the structured `market_tape` (instrument, level, change, % change)
     with `marketTone`, tabular; "Show table" with "Copy as table".
   - 02 What changed: story paragraphs (`story`, lead phrase highlighted with `HighlightText`), not bold label bullets.
   - 03 Your names: `TickerRow`s (→ Name) with the Pulse sentence as the reason line.
   - 04 Watch: story list; 05 Headlines: rows with source + time.
   - Signal vs noise: two `Callout`s side by side on ≥ 400 dp, stacked below; neutral colours (no yellow "noise").
   - 06 Sources: `ActionRow`s with `open_in_new`, opening `EvidenceView.url` via `LocalUriHandler`; date caption.
   - `Upshot` at the end of the brief (from the Pulse's last section when present).
5. Colophon: `Eyebrow` "PULSE" with the 28 dp gold rule, caption "Generated 06:30 · data as of 06:15", disclaimer
   caption. (No giant 14%-alpha wordmark.)
- States via `StateCrossfade`: loading = `SkeletonHero` + 4 skeleton rows; empty = `EmptyState` "No Pulse for this
  day"; error = `ErrorState` with retry. No fallback prose ever.
- Hero motion: hero line rises (8 dp, `Enter`) then chapters stagger on the first open of this issue; pills glide
  with scroll-spy.
- Compare (P2, client): "Compare with previous issue" `TextAction` loads `getPulseByDate(previous)` and shows a
  "vs yesterday" delta under each Markets row.
- Notes: later, needs Razvan (Pulse notes need a notes table).
- Removed: `BriefTopBar` 3-block header, Search icon as "open", green for any "+", raw status strings, regex tape
  parsing.

### 5.8 Weekly digest (WP-A, `WeeklyDigestScreen.kt`) — "This week", built only from data the app already has
1. Top bar: back, title "Weekly digest", subtitle `17 to 23 Nov` (`Fmt.weekRange`). No second title.
2. `ScreenHeader` title "This week" + lede generated from facts ("Macro stress rose 6 points; 2 of your names filed;
   1 changed state; 5 alerts.").
3. `KpiGrid` (results, not usage): Macro stress now (with 7-day delta), New filings among your names (monitor
   snapshots with `reportGeneratedAt` in the last 7 days), State changes this week (from the local snapshot
   history, 5.5), Alerts this week (alert ledger, last 7 days).
4. New filings: `RowGroup` of those names; each row opens its report, and its `SinceLastReport` summary line
   ("Margins: +120 bps") is the row subtitle.
5. Macro: 7-day `Sparkline` + label → Macro Stress.
6. State changes: `RowGroup` of names whose state changed this week ("Intact → Watch, Tue") → Name.
7. Alerts by category: `DataRow`s (category square, count) → Inbox filtered by category.
8. Latest Pulse line → Pulse.
- Removed: daily sections presented as "weekly", raw `DATA_INCOMPLETE`, sun icon, clipped chip row, overlay header.
- Later, needs Razvan: a real weekly payload (index performance for the week, best/worst names, next week's catalysts).

### 5.9 Macro Stress dashboard (WP-F, `SentimentDashboardScreen.kt`; file name kept, composable renamed `MacroStressScreen`)
1. Top bar: back, title "Macro Stress".
2. Header block: eyebrow `MACRO STRESS · AS OF 24 NOV`, sentence first ("Stress is Balanced and rose 6 points this
   week", `lede`), then the `figure` score (final on first paint, `RollingNumber` on refresh) with an `info` tap
   target opening `SourceSheet` (what the score measures, its inputs and how they combine, from `ScoreCopy`),
   `StatusBadge` regime, delta line (rise = Unfavourable), `ScaleBar` 0–100 with regime segments and marker.
3. `SegmentedControl` 7D · 14D · 30D · 90D (default 30D).
4. `LineChart` featured (240 dp): y pinned 0–100, regime bands, date x-axis, scrub rewrites the header readout
   (value, date, change from window start), morph on range change, "Show table" reveals readings (`CompareTable`
   date, score, change, with "Copy as table") instead of the old Recent History list.
5. Factors: `SectionHeader` kicker `WHAT DRIVES IT`, headline generated ("Credit spreads did most of the rise");
   `RowGroup` of `DataRow`s with `Meter` 0–100 (`ink2`@60%), change since the previous reading, caption "Source: FRED"; missing inputs as `NotSeen` rows with the reason.
6. `Callout` "How to read this" (collapsible `ActionRow` → expands): plain explanation of the scale and the regimes.
- Hero motion: chart draw-on, then scrub. Refresh: `ThesisRefreshBox` bound to `isMacroRefreshing`.
- Removed: Vico (replaced by the kit `LineChart`; the file leaves `androidOnlyFiles`), the semicircle gauge and the
  duplicated score, inverted drift colour, `AssistChip` range toggles, triplicated label mapping, "Provider: fred".
- Later, needs Razvan: "Most exposed names" (needs an exposure mapping per name).

### 5.10 Names (WP-B, `NamesScreen.kt`)
1. Top bar root: brand, actions `search`, avatar; screen actions in the ScreenHeader row: `sort` (sort sheet),
   `density_medium`/`density_small` (Comfortable · Compact, remembered per device), overflow (Import holdings CSV,
   Refresh).
2. `ScreenHeader` title "Names", lede generated ("12 names · 2 changed since your last visit"), meta `As of …` +
   `LoadingHairline`.
3. `SegmentedControl` **Board · Notes**. Notes is the Notes view (5.28).
4. `TickerField` "Add a company" (caps, search IME, `SuggestionList` from `searchTickers` with company names;
   trailing "Follow" `PrimaryButton` only when the field has a valid ticker; duplicate/invalid → field error +
   `reject()`).
5. `ChipRow` filters with counts, each with a named source: All 12 · Changed 2 (state or score changed since
   `lastNamesVisitAt`, from the snapshot history) · At risk 1 (state at_risk/broken) · Earnings soon 1 (an earnings
   alert or War Room for the ticker with `eventDate` ≤ 14 days ahead, from the alert ledger) · With notes 5. No
   "Unresolved" (no data defines it). Scrolls, never clips.
6. List: lazy `TickerRow`s with `rowGroupSegment` (Comfortable or Compact, #11), sorted by the sheet choice; default
   **state severity (broken, at risk, watch, intact), then changed since your last visit, then ticker**. The
   server's `unreviewedEventsCount` does **not** drive the default sort or a permanent badge: there is no way for the
   user to clear it until a new report lands (`_lib/jobs/effects/apply.ts` resets it only then; open question Q3).
   `CountBadge` shows alerts for the ticker created since your last visit. Rows glide with
   `animateItemPlacement(spatial)` on sort/filter; removal uses `DismissibleItem`. Widens to 960 dp on tablets.
7. Context sheet (long-press, `SheetActionRow`s): Open report (or Build report, label by state, 5.11), Write a note
   (→ Name, note focused), Compare with… (→ picker → Compare names), War Room (when live), Remove from Names
   (`ThesisDialog` confirm, then undo snackbar).
8. Compare entry: top-bar-row action `compare_arrows` enters selection mode (checkboxes, #45); `RunBar` "Compare 3
   names" → **Compare names** (5.26). Selection allows 2–4.
9. CSV import (from overflow): `DockPanel` with the system picker action, progress, then a result card ("Imported 14,
   skipped 2" + collapsible row errors).
- Empty: `EmptyState` "Follow a company to start your board" with the field focused.
- Hero motion: container transform from a row into Name. Refresh: pull-to-refresh bound to `isBoardRefreshing`;
  scores roll.
- Removed: 4-option clipped segment row, "Refresh board" button, gold "Deep Dive" button on every card, "Add Note"
  that opened Research, red "Remove" next to the primary action, War Room button inside cards, pipe-joined freshness
  line, dead `buildFreshnessDetail`, card-per-row layout, accent meters in rows, "Needs review" sort by a count the
  user cannot clear, the compare `ThesisSheet` with monitor fields.
- Later, needs Razvan: price, day change, sparkline per name and position weight (needs a price feed; holdings
  weight exists via CSV but is meaningless without prices).

### 5.11 Name (new, WP-B, `ui/screens/NameScreen.kt`): one ticker screen that every ticker links to
Data available now: monitor snapshot and its local history, the latest report (`getDeepDiveReport` by the snapshot's
`reportId`, cached): company name, filing, verdict, `changeSummary`, `trustMetadata.thesisDrift`, `annualHistory`,
`quarterlyHistory`, `historical` periods; report notes for every report of the ticker in `listReports`; conviction
timeline (Pro); War Room id when live; watchlist membership; alerts for the ticker. **On paper, no HeroBand.**
1. Top bar: back, title = company name (appears when the header scrolls away), subtitle = ticker, actions `bookmark`
   follow toggle (`toggle()` haptic), overflow (Remove from Names, Compare with…, Copy figures as table).
2. Header: eyebrow `AAPL · IN YOUR NAMES` (or `NOT FOLLOWED`); `title` = company name (from the report issuer or
   `searchTickers`; the ticker alone with +0.01em tracking only when no name is known); `StatusBadge` thesis state
   + state change caption ("Intact since 12 Aug" / "Watch since Tue, was Intact"); reason as `lede`. Then a paper
   `KpiGrid` (`statValue`): Monitor score (number + `Meter` in accent, the one subject meter, + "+4 since Tue"),
   Freshness (`10-K FY2025 · 23 days ago`), Alerts since your last visit, Next earnings (when an alert or War Room
   gives a date). Monitor score and Freshness have `info` targets opening `SourceSheet` with their inputs.
   Pager caption "3 of 12" with swipe to the next/previous name in the current Names sort and filter (4.5).
3. **Since the last report** (`SinceLastReport`, #51): `previousView` → `currentView` as two dated lines, up to 3
   `topChanges` rows (title, direction mark, one-line `whyItMatters`) that open the report at that chapter; drift
   badge from `thesisDrift`. Replaces the old "What changed: reason sentence" block. Alerts link: `TextAction` "See
   alerts" (Inbox filtered by ticker).
4. **From the FY2025 10-K** (`KpiGrid`, frozen, never animates): revenue, YoY growth, operating margin, FCF margin,
   net cash, share count change, each with "vs FY2024" (`bps` for margins). Period in the header always; tap a
   figure → `SourceSheet`. "Show the five years" `TextAction` → `CompareTable` of `annualHistory` (Copy as table).
5. **Report** `ThesisCard`: eyebrow `DEEP DIVE · 10-K FY2025`, `cardTitle` = the verdict sentence; action labelled
   by state (principle 11; SPEC rule 1, one shared report per filing): `PrimaryButton` "Open report" when it exists;
   "Build report" only when no report exists for the latest filing (first request); when the report is current,
   a caption "Up to date with the 10-Q filed 30 Oct" instead of any re-run. No "Run a fresh Deep Dive" anywhere.
6. **Your notes** (`NotesTrail`, #52): every report note for the ticker, newest first, each headed by filing period,
   date and that report's verdict; newest editable (`NoteBlock` with the placeholder scaffold), older read-only;
   "Carry forward" when the newest report has no note and an earlier one does. Caption: "One note per filing; earlier
   notes stay here."
7. **Earnings** (when a War Room exists): `ActionRow` with `LiveDot` (Live phase only) → War Room.
8. **Conviction journal** (Pro): `Timeline` of events (icon per type, human label, relative date) linking to the
   alert/report; non-Pro: one `Callout` with a single "See Pro" `TextAction`.
9. **Reports**: `RowGroup` of past Deep Dives for this ticker (filing, date, note mark), action "Compare two" →
   selection (like-for-like only, 5.18) → Compare reports. Caption: "Reports you have opened" (`listReports` is your
   job history), and the empty/short-list copy says so.
- Hero motion: container transform in (300 ms); KPIs arrive with it, no stagger.
- Later, needs Razvan: ticker-level notes not tied to a filing and price/date stamping (Q6), structured thesis card
  (catalysts, kill criteria, your fair value), revisit reminders, note markers on charts.

### 5.12 Research root (WP-E, `ui/screens/ResearchScreen.kt`, extracted from `DeepDiveScreen.kt` by F3 in PR-1)
1. Top bar root: brand, `search`, avatar.
2. `ScreenHeader` title "Research", lede "Read any US-listed company from its filings."
3. `TickerField` (caps, search IME, `SuggestionList`: your names first, then `searchTickers`); the action label says
   what will happen: "Open report" when a stored report exists, "Build report" otherwise (the build may join a
   report already being built for that filing).
4. Recent reports `RowGroup`: first row "Continue reading AAPL" + relative time when a report was left mid-way
   (dismissable via `DismissibleItem`), then ticker, filing, relative date → report (container transform);
   "See all" → History.
5. Tools `RowGroup` of `ActionRow`s: Compare names, Scenario Stress, Macro Stress, Weekly digest, History.
- Removed: offline detection by text match, Title Case label, custom spinner, "Open your last report" cards with ISO
  dates.

### 5.13 Deep Dive report host (WP-C, `DeepDiveWebReportState.kt`, `DeepDiveWebPage.kt`)
1. `ReportTopBar` (56 dp, `surface`, 1 dp `line` bottom, matching the page's 52 px bar): back; `THESIS` eyebrow in
   accent + ticker `barTitle`; trailing `bookmark` follow toggle and overflow (Classic view, Export PDF, Share card,
   Report feedback). Global top bar and bottom bar hidden: the report is full screen.
2. WebView with the page (`theme=` from the active palette via `DeepDiveWebTheme.LIGHT/DARK`, not luminance). It
   lives in the shell's report base layer (4.5), so pushes from the dock never destroy it.
3. `ReportDock` (#48): Notes · Compare · Stress · Conviction (Pro).
4. Notes → `DockPanel` at 45% with `NoteBlock` for this report (jumps to 85% when the field is focused); the page
   stays readable and scrollable above. An earlier note for the ticker shows above the field with "Carry forward".
5. **Add to note (client only, no renderer change):** a custom WebView `ActionMode` item "Add to note" next to Copy.
   It reads `window.getSelection().toString()` and the nearest preceding chapter heading via `evaluateJavascript`,
   then appends `> "quote" (Ch. 04 Margins, AAPL 10-K FY2025)` to this report's note and opens the Notes panel
   scrolled to the end. Android-only code in `DeepDiveWebPage.kt`.
6. Compare → `ThesisSheet` with two `SheetActionRow`s: "With other names" (→ Compare names with this ticker as the
   subject and a picker of your names) and "With an earlier report" (this ticker's like-for-like reports → Compare
   reports; if none, explains that a comparison appears after the next comparable filing).
7. Stress → Scenario Stress with this ticker preselected (push over the report). Conviction → sheet with the
   Conviction journal.
- Loading: `SkeletonHero` in hero palette (eyebrow, two serif bars, KPI grid skeleton) + 2 dp accent progress
  hairline at the top driven by `onProgressChanged`; on `onPageFinished` crossfade the WebView in (240 ms).
- Token refresh state: the same skeleton (no second spinner).
- Failure: crossfade to the classic view with an `InlineBanner` "The new view didn't load." + `TextAction` "Try again".
- Export: states Preparing (inline arc in the overflow item) → system print dialog; no "Export generated" message
  unless the file exists; PDF/share card generation off the main thread (`Dispatchers.Default`).
- Removed: global top bar over the report, 56 dp translucent bar, 2 dp tool pills, POSITIVE/NEGATIVE `SignalBadge`
  (SPEC rule 6), centred tool `Dialog`s, bare 28 dp spinners, WebView destroy/reload on every push.
- `DeepDiveWebPolicy.kt` public API is frozen (16 tests pin it); only additive changes.
- Later, needs Razvan: persistent highlights drawn on report passages and notes pinned to the chapter on screen
  (needs anchor ids in the renderer plus a WebView↔app JS bridge). The report diff is **not** later: it is in the
  payload (`changeSummary`) and shown by `SinceLastReport`.

### 5.14 Deep Dive generation (WP-C, `DeepDiveLoadingScreen.kt`)
- Layout: `HeroBand` under the top bar (back allowed; the job keeps running on the server), eyebrow
  `DEEP DIVE · AAPL` with the 28 dp rule, `title` "Building the report", lede "From the company's latest annual and quarterly filings at the SEC."
- `StageProgress` driven by `deepDiveJob.status` only: "In the queue" (queued) → "Reading the filings and building
  the report" (running/follower, with `LoadingHairline`) → "Ready" (done). No timers, no invented sub-steps.
- Below: "What this report will contain": the 13 chapter names (static list from SPEC) as muted rows, so the wait
  teaches the structure.
- Done: the ring completes, `reward` pulse (1→1.04→1, once), `confirm()` haptic, crossfade into the report host.
- Failure: `ErrorState` with "Try again". When a stored report exists, this screen is skipped entirely.
- Removed: PlasmaOrb (and the layout bobbing), "THESIS INTELLIGENCE ENGINE", "Generating Intelligence", "Reading
  recent news", fixed 18 s timers, green check.

### 5.15 Deep Dive classic / fallback (WP-D, `DeepDiveScreen.kt`, `DeepDivePresentationCards.kt`, `DeepDiveNativeMemo.kt`, `ConvictionIntelligenceCards.kt`)
Used offline, after a failed load, for the sample, and as "Classic view". It should look like the page.
1. `ReportTopBar` (same as 5.13) + `InlineBanner` "Classic view" with `TextAction` "Open the new view" when online.
2. Hero: `HeroBand` with eyebrow `DEEP DIVE · FROM THE 10-K FOR FISCAL 2025` (28 dp rule), company name `display`,
   thesis line `heroLine`, `KpiGrid` (`kpiValue`) from the native memo key indicators (`Fmt.money/pct/bps`, period in
   each label, deltas with tone).
3. `ChapterPills` sticky mirroring the sections present, scroll-spy.
4. Chapters with `ChapterHeader` (numeral, kicker, `title`, lede) in the page's order; content per section:
   - Five-year view: `ColumnChart` (revenue, FCF) + `CompareTable` "Show table" (replaces the raw `391035000000.00` line).
   - Valuation: `RangeBar` bear/base/bull with the price at filing marker; label "Model range" (no "target").
   - What-if: `NumberField`s in percent ("Terminal growth 2.5%"), validation, "Model value vs price" result with sign tone.
   - Risks and kill switches: `DataRow`s with `StatusSquare`, threshold, latest reading ("−2.2% against a line of 1.0%").
   - Metric deltas: one `CompareTable` from `MetricDeltaItemView` (current, reference, change in bps/%, basis
     column) instead of four boxes.
   - Chart cards use the renderer anatomy: gold `CHART n` fignum, serif conclusion title, chart, source.
   - Evidence: `RankedBars` of evidence counts per section + `ActionRow`s that open the evidence URLs.
   - Each chapter ends with an `Upshot` when the data has one.
5. Notes: `NoteBlock`; long-press on story and Upshot text offers "Add to note" (quotes the paragraph with its chapter,
   same format as 5.13). Feedback: `ChipRow` (no preselection) + optional text + "Send" with a sent state.
   Export: three `ActionRow`s with icons (PDF, Share card, Memo text) and progress.
6. Footer: disclaimer caption sans 12 muted.
- Removed: ~400 lines of dead code (DeepDiveScreen.kt 604–986, 1374–1490), duplicated Watch next / risks / coverage
  blocks, "Implied upside", "NO SIGNAL" badge, radar chart, fan chart, gold `-` bullets, `%.2f` numbers, the
  `StaggeredEntrance` index-30 cascade (entrances now first-load only).
- Conviction cards: `Timeline` with an icon per event type (kill switch `report`, freshness `schedule`, opposite case
  `compare_arrows`), human labels, relative dates, links; Opposite case shows `SkeletonCard` while generating; Pro
  upsell once, as a `Callout`.

### 5.16 Sample Deep Dive (WP-D, `SampleDeepDiveScreen.kt`)
- Default (pending question Q1): native, restyled as 5.15 with the HeroBand header, a neutral `StatusBadge` "Sample
  report", charts from the sample data, and a sticky bottom bar `PrimaryButton` "Follow your first name". Asset
  parsed on `Dispatchers.IO` with a skeleton meanwhile.
- Removed: amber "SAMPLE" callout, plain headline title, CTAs only at the very bottom.

### 5.17 Compare reports (new, secondary, WP-E, `ui/screens/CompareReportsScreen.kt`)
Two reports of one ticker. Secondary to Compare names (5.26): one report already shows its own five-year history and
deltas, so this screen is reached only from Name > Reports "Compare two", History compare mode and the report dock's
"With an earlier report". Data: `getDeepDiveReport` for both ids (`loadCompare(a, b)`).
- Layout: top bar "Compare" + subtitle "AAPL · 10-K FY2024 vs 10-K FY2025"; **`SinceLastReport` at the top** (from the
  newer report's `changeSummary`, when the older one is its comparable report); header rows with both filing
  periods (older muted, newer accent) and a **basis row** ("FY2025 vs FY2024"; "Q3 FY25 vs Q3 FY24, same quarter"
  for two 10-Qs); `CompareTable` of key indicators (revenue, growth, gross and operating margin, FCF, net cash,
  share count, EPS) with the change column labelled by its basis (`bps` or %, tone); "What each report concluded":
  the two verdict sentences with their dates; your notes from both reports (`NoteBlock` previews). Copy as table.
- Only like-for-like pairs (10-K with 10-K, or the same fiscal quarter); entry points disable other pairs with a
  caption saying why.
- Hero motion: none beyond the push (frozen figures, no row stagger).

### 5.18 History (WP-E, `HistoryScreen.kt`)
1. Top bar: back (Research stack), title "History", action `compare_arrows` (enters compare mode).
2. `ChipRow`: All · Deep Dives · Pulse · With notes (from the notes cache); `TickerField`-style filter (local).
3. Day groups with sticky `DayHeader`s ("Today", "Yesterday", `Mon 17 Nov`, `24 Nov 2024` for past years): rows with
   type icon (`menu_book` / `article`), ticker or "Pulse", filing period, time, `NoteMark`. Deep Dive rows → report
   (container transform); Pulse rows → Pulse(date). Density: 24 dp section gaps.
4. Compare mode: select two Deep Dives of the same ticker **and like-for-like filings** (10-K with 10-K, or the same
   fiscal quarter); other rows disable with a caption why → Compare reports.
- Copy: History lists reports you have opened (your job history), and the empty state says so: "Reports you open
  will appear here."
- States: skeleton until `reportHistoryLoaded`; error banner; pull-to-refresh.
- Removed: duplicate title, overlay header, repeated "DEEP DIVE" label, sun icon, back loop, chevrons.
- Later, needs Razvan: stance/confidence/value range per row (needs a history payload with summary fields).

### 5.19 War Room (WP-E, `WarRoomScreen.kt`)
1. Top bar: back, title "War Room", subtitle ticker.
2. Header on paper (no HeroBand: a utility screen opened often): eyebrow `EARNINGS · AAPL`, `title` (event), phase
   stepper Pre-open · Live · After close (`Timeline` horizontal; current step `ink`; `LiveDot` on Live only),
   "Updated 12 min ago".
3. Summary as `lede`; highlights as `story` paragraphs.
4. Phase sections as collapsible `ThesisCard`s (current expanded) with relative times.
5. Related: `ChipRow` of related tickers → Name; `ActionRow` "Open the Deep Dive" → report.
- Auto-refresh every 60 s while Live and the screen is resumed (WP-INT in the ViewModel); pull-to-refresh otherwise.
- Removed: room and report UUIDs, duplicated title, non-wrapping badge row, "Refresh War Room" button, grey/gold/green
  phase colour scheme.
- Later, needs Razvan: actual vs estimate (EPS, revenue, guidance) and the price reaction.

### 5.20 Scenario Stress (WP-E, `ScenarioStressScreen.kt`)
1. Top bar: back, title "Scenario Stress". `ScreenHeader` lede "See how a macro shock would touch your 8 names."
2. Pro gate (non-Pro): one `Callout` + `TextAction` "See Pro".
3. Templates: selectable `ThesisCard`s (`Selected` variant with check, `Role.RadioButton`, `segment()` haptic), each
   with title and one-line description.
4. `RunBar` (#37): "Run ‘Rate shock’ on 8 names" `PrimaryButton` (`press()` haptic; loading state in-button).
5. Results (`StateCrossfade`): `KpiGrid` (names affected, critical count in neutral when 0, as of), then
   `RankedBars` (two-line variant) of stress score per name sorted descending, coloured by level
   (Unfavourable/Attention/Neutral). The chart header states the scale: "Stress score, 0–100, higher = more
   exposed". Each row: ticker (tappable → Name), score, a second line with the one-line `rationale`, and a
   `StatusBadge` for `thesisBreakLikelihood`; tapping the row expands its evidence links (`evidenceRefs`). Overflow:
   Copy as table. Guardrails as `Callout`s (plain description, no dead buttons).
- Hero motion: bars grow from 0 in `Draw` on the run result (first time only); `RollingNumber` on KPI counts on re-run.
- Removed: duplicated title, "Reopen run", always-amber "Critical: 0", `%.2f` scores, two spinner sizes.
- Later, needs Razvan: compare two scenarios, holdings-weighted view, "add guardrail as alert".

### 5.21 Inbox (WP-F, `InboxScreen.kt`) — now a bottom tab
1. Top bar root: brand, `search`, avatar. `ScreenHeader` title "Inbox", lede "3 new since your last visit"
   (client-side), `TextAction` "Mark all as seen" (sets `lastInboxVisitAt`).
2. `ChipRow` category filters with counts, keyed by category key (not English labels).
3. Day-grouped lazy list (sticky `DayHeader`s, `rowGroupSegment`), `AlertRow` (#38). Swipe toward the start = Quiet
   for 24 h with an undo snackbar (`DismissibleItem`).
4. Tap expands in place: detail (or Pro lock `Callout`), reason caption, actions row: `TextAction` "Open" (route),
   `ThesisChip` toggles Useful / Not useful (single-select, selected state persists), overflow: Quiet for 24 h (undo
   snackbar), Turn off this type (`ThesisDialog` confirm, then undo snackbar).
5. Routing: `thesis_drift` alerts open Name at its "Since the last report" block (not just the ticker); earnings
   alerts with a War Room open the War Room.
- States: skeleton rows on first load, pull-to-refresh bound to `isInboxRefreshing`, action errors as snackbar only
  (never wipe the list), empty "No alerts yet. You'll see thesis drift, earnings and macro changes here."
- Hero motion: expand/collapse of a row. Filters swap with a 150 ms fade. Data-screen density (24 dp gaps).
- Removed: "Refresh inbox" button, 5 buttons per card, all-gold category tags, NY-zone timestamps, clipped filter row.
- Later, needs Razvan: server read/unread state, before/after values for drift alerts, note on an alert.

### 5.22 You / Settings (WP-G, `ui/screens/SettingsScreen.kt` extracted from `ThesisApp.kt` in PR-1, plus `DeleteAccountSection.kt`)
- Opens from the avatar on the global modal stack. `ScreenHeader` title "You", lede = account email, plan `StatusBadge`.
- `RowGroup`s with `SectionHeader` kickers:
  - Appearance: Theme `SegmentedControl` Auto · Light · Dark; Up/down colours `SegmentedControl` Classic · Colour-blind
    (with a 2-swatch preview); `ToggleRow` Reduce motion.
  - Notifications: master `ToggleRow` + per-family `ToggleRow`s (`Phase4Copy` labels), quiet-until caption.
  - Security: `ToggleRow` App lock (biometric).
  - Portfolio: `ActionRow` Import holdings (CSV) (opens WP-B's import panel).
  - Your notes: `ActionRow` "Export my notes" → Markdown file (all cached notes grouped by ticker, newest first, each
    with filing and date) via the system share sheet or `CreateDocument`.
  - Subscription: plan row, `ActionRow` Manage / See Pro.
  - Help and legal: `ActionRow`s for terms, privacy, open-source licences (shows OFL text), feedback.
  - Account: `TertiaryButton` Log out; `DestructiveButton` Delete account → `ThesisDialog` (type-to-confirm), visible
    disabled state.
- Removed: unlabeled switches, red-text-on-background delete button, purple dialog.

### 5.23 Paywall (WP-G, `PaywallScreen.kt`) — full-screen destination instead of a `Dialog`
- Opens on the modal stack. `HeroBand` top: eyebrow `THESIS PRO`, `display` "Read deeper", `heroLine` one-sentence
  promise; close icon (top-left).
- Benefit list with 16 dp check icons (ink2), plain sentences (no hyphen bullets).
- Plan selector: two `PlanCard`s (#46; Yearly default with "Saves X% vs monthly" when both prices are known;
  nothing invented when not), sticky `PrimaryButton` (ink) "Continue", `TertiaryButton` "Restore purchases",
  legal caption. "Loading plans" = skeleton cards.

### 5.24 Export (WP-C, `ReportExport.kt`)
- Palette: PaperLight tokens (the print look of the Deep Dive PDF), Newsreader for titles via the bundled fonts,
  real pagination (no content dropped past y=1760), runs off the main thread. Share card: HeroBand look (dark band,
  gold hairline, ticker in Newsreader).

### 5.25 Cross-screen linking checklist (WP owners verify their screens)
- Every visible ticker → `Name(ticker)`. Every report reference → `Report` (at the chapter when known). Every
  source/evidence URL → browser. Every fundamental figure → `SourceSheet`.
- Every alert route → its destination (`thesis_drift` → Name "Since the last report"); unknown routes expand the
  alert in Inbox.
- Back from any pushed screen returns to the exact previous scroll position (per-`entryId` saved state), including
  back from Compare or Stress to the live report.

### 5.26 Compare names (new, primary compare, WP-E, `ui/screens/CompareNamesScreen.kt`)
Cross-company compare of 2–4 tickers, built now from data the client already gets: each monitor snapshot has a
`reportId`, and each report has `annualHistory`, `trendMetrics`, `qualityMetrics` and `valueDiscipline.score`.
`loadCompareNames(tickers)` = N calls to `getDeepDiveReport` (cached in `report_summaries`). No run is ever started
from this screen.
- Entry: Name overflow and report dock "Compare with…" (a picker of your other names, the current ticker is the
  subject), Names selection mode (`compare_arrows`, `RunBar`), Research > Tools.
- Layout: top bar "Compare" + subtitle "AAPL with MSFT, GOOGL"; `CompareTable` with tickers as columns (subject
  column header in accent, label column pinned), widening to 960 dp on tablets:
  - header row 1: fiscal period of each column (`FY Sep-25`, `FY Jun-25`, `FY Dec-24`), because year-ends differ;
  - header row 2: filing type and filed date;
  - rows: revenue, YoY growth, gross margin, operating margin, FCF margin, net cash, share count change YoY,
    value-discipline score (`info` → `SourceSheet` with its inputs); a median row in `surface2`;
  - column headers sort by tap (by the row last tapped); cells open `SourceSheet`.
- "Show chart" `TextAction`: `LineChart` indexed (revenue = 100 at the first common fiscal year) or
  `SmallMultiples`, chosen by a `SegmentedControl` (Indexed · Side by side).
- A ticker without a report shows "No report yet" in its column with a `TextAction` "Build report" (opens the
  Research flow; never builds silently).
- Overflow: Copy as table (tab-separated), Share as image.
- Hero motion: none beyond the push; frozen figures do not animate.

### 5.27 Search (new, WP-E, `ui/screens/SearchScreen.kt`)
- Opens from `search` on every root top bar, on the modal stack. Client-side over: tickers (`searchTickers`), your
  names, cached reports (`report_summaries`: company, filing, verdict) and note text (`report_notes`).
- Layout: `ThesisTextField` focused on open; results grouped under `Eyebrow`s (YOUR NAMES · COMPANIES · REPORTS ·
  NOTES) with up to 5 rows each and "Show all"; note hits show the matched excerpt with the term in
  `HighlightText`. Recent searches when empty. Data-screen density.
- Taps: name/company → Name; report → report; note → Name scrolled to "Your notes" at that entry.

### 5.28 Notes view (new, WP-B, inside `NamesScreen.kt` as the "Notes" segment)
- Lists tickers that have notes, newest first: ticker + company, latest note excerpt (2 lines, `bodySmall` ink2),
  filing period and relative date, count of earlier notes. Filter field
  (local text filter). Tap → Name at "Your notes". Overflow: Export my notes (same as You).
- Empty: "Notes you write on a report will collect here, one per filing."
- Data: the local `report_notes` cache, refreshed in the background from `getReportNote` for reports in
  `listReports`; no new endpoint.

---

## 6. Phased build plan

Branching: each PR branches from `rebuild` and merges into `rebuild`. Work packages (WPs) inside a PR branch from
that PR's integration branch (`redesign/pr1`, `redesign/pr2`, `redesign/pr3`) and **every WP opens a pull request
into its integration branch** (never a local merge), because `ci.yml` runs on any `pull_request` and `ThesisApp`,
`MainViewModel`, `ThesisFonts` and `ui/platform` compile only in CI. The integration branch then opens the PR into
`rebuild`. Every commit must keep `design-preview` compiling and the 34 harness unit tests passing; CI
(`testDebugUnitTest assembleDebug`, 36 tests) must be green on every PR. `rebuild-test-apk.yml` also triggers on
`redesign/**` (F4 in PR-1), so Razvan gets a phone APK per phase: motion, haptics, predictive back and the WebView
cannot be judged in the harness.

### 6.0 Rules that apply to every WP
1. **File ownership is exclusive.** Only the owner edits a file. Need a change elsewhere? Write it in the WP's
   `HANDOFF.md` section of the PR description (file, change, reason) for the owner.
2. **Hot spots:** `ui/ThesisApp.kt`, `ui/MainViewModel.kt`, `ui/shell/**`, `ui/navigation/**`, `MainActivity.kt`,
   `AndroidManifest.xml`, `app/build.gradle.kts`, `model/Models.kt`, `data/SessionStore.kt`,
   `network/ProductApiClient.kt` (all parsers), `offline/**` (Room caches), `res/values*/themes.xml` (from PR-3),
   `design-preview/build.gradle.kts`, `design-preview/.../RenderScreen.kt` are owned by **WP-INT** in every phase.
3. **Kit freeze in PR-3:** `ui/theme/**`, `ui/components/**` (except `ui/components/LegalLinks.kt`, owned by WP-G),
   `ui/motion/**`, `ui/charts/kit/**`, `ui/format/**`, `ui/platform/**`, `ui/icons/**` are owned by **WP-K** during
   PR-3. Screen WPs may add a private component inside their own files and propose promotion; WP-K fixes kit bugs.
4. **New screen parameters get defaults** so `ThesisApp.kt` keeps compiling; WP-INT wires them after the screen WP
   lands (merge order: screen WPs first, WP-INT last).
5. Android-only files (cannot compile in design-preview: `MainViewModel`, `ThesisApp`, `DeepDiveWebPage`,
   `ReportExport`, `HoldingsCsvImport`, `SampleDeepDiveScreen`, `DeleteAccountSection`, `PasswordResetScreen`,
   `ui/theme/ThesisFonts.kt`, `ui/platform/*`) must stay thin. Move UI into compilable files where possible
   (`viewModel()` calls are replaced by parameters so `DeleteAccountSection`, `PasswordResetScreen` and
   `SampleDeepDiveScreen` become renderable). Every other file under `ui/` imports no `android.*`,
   `androidx.activity.*` or `androidx.lifecycle.*` (section 4 preamble).
6. Each WP adds renders under `design-preview/src/test/kotlin/com/thesis/mobile/preview/<Area>Renders.kt` with fixtures
   in `preview/fixtures/<Area>Fixtures.kt` (owned by that WP): every screen state (loaded, loading, empty, error)
   in dark and light, plus 1.3× and **2.0× font-scale** smoke renders, one **360 dp-wide** render, and one full-page
   render (`heightDp = 2400`). Bulk state renders may pass `-Dpreview.glow=false`; the per-screen hero render keeps
   the glow.
7. Each WP adds semantics tests for its screens with `org.jetbrains.compose.ui:ui-test-junit4-desktop:1.6.11`
   (`createComposeRule`; verified to run in the harness): touch bounds, `Role`, selected, heading, toggleable,
   liveRegion.
8. Unit tests that pin symbols stay green: `DeepDiveWebPolicyTest` (keep `DeepDiveWebTheme` and the policy API),
   `Phase4CopyTest`, `RefreshFailureTest`, `LaunchDestinationResolverTest` (tab strings), mapper and codec tests.
9. Copy: sentence case, SPEC banned words never appear (rubric C1), vocabulary: Pulse, Macro Stress, Deep Dive,
   Names, Name, Notes, Compare, War Room, Scenario Stress, Inbox, Weekly digest, History, You. Copy lives in
   `ui/copy/**` per WP.

### 6.1 PR-1 Foundation (tokens, fonts, theme, component kit, background, shell/nav, harness)

Order: **day 0, serial:** F1 lands (a) the 21 `@Composable @ReadOnlyComposable` helper annotations and 2 Canvas
hoists (section 2.2; the only edits F1 makes in screen files besides the two `displayLarge.copy(Black)` removals),
(b) API stubs for `ThesisPalette`, `ThesisType`, `LocalReducedMotion`, `ThesisTheme`, and (c) a
`@Deprecated ThesisTheme(darkTheme, dynamicColor)` overload so `RenderScreen.kt` keeps compiling. Then F2, F3 and F4
branch; F1 continues inside its own files.

| WP | Owns (exclusive) | Deliverables | Acceptance criteria (testable) | Reviewers must check |
|---|---|---|---|---|
| **F4 Harness and guards** | `apps/mobile/android/design-preview/**` (except RenderScreen.kt after merge → WP-INT), `apps/mobile/android/tools/**`, `.github/workflows/design-preview.yml` (new, non-blocking), the `redesign/**` trigger in `.github/workflows/rebuild-test-apk.yml` | Apply `toolchain/screenshot-harness.patch`; add `fontScale`, `widthDp`, `reducedMotion` and `glow` params to `renderScreen`; font shim that loads `res/font/*.ttf`; shims for `ui/platform/*` (Back, haptics, animator scale, card shadow); `ui-test-junit4-desktop` test dependency; `KitGalleryRenders.kt`; `tools/design-lint.sh` (7.2) with a per-file baseline and an allowlist file, plus a lint self-test; `tools/gold-share.py` (T3 pixel count); `tools/fonts/make_newsreader.py`; `tools/icons/make_icons.py` (2.8); optional CI job running compile, unit tests, renders, uploading PNGs | `setup.sh` + `render.sh` produce dark and light PNGs for every compilable screen; `unit-tests.sh` 34/34 plus new tests; `design-lint.sh` exits 0 at baseline and non-zero when a new `Color(0x` is added to a screen (self-test); app build unaffected (`design-preview` not in `settings.gradle.kts`) | Patch contains only new files; no change to `app/` except the generated `ui/icons/ThesisIcons.kt` handed to F2; lint rules match 7.2 |
| **F1 Tokens, fonts, theme** | `ui/theme/**`, `ui/format/**`, `res/font/**`, `res/values*/themes.xml` (until PR-3), `res/values/colors.xml`, `app/src/main/assets/licenses/**`, plus the day-0 mechanical commit above | Section 2 complete: `ThesisPalette` (both, v2.1 values), hero palette, `UpDownScheme`, `Semantic.kt`, composable-getter `ThesisColors`, `ThesisType` (v2.1 scale, dp-based cap) + rebuilt `ThesisTypography` (no mono), `ThesisShapes`, `ThesisSpace`, `ThesisDimens` (CardCornerRadius 14), full M3 scheme, `ThesisTheme(mode, upDown, reduceMotion)` with `LocalThesisPalette` (static) and `LocalReducedMotion` (F1 is its only definer); 5 Newsreader TTFs (Latin Ext-A subset) + OFL; `Fmt` with injected clock/zone/24h | grep: no `FontFamily.Monospace`, no `MonoFont`; light render differs from dark for Home; `FmtTest` (minus sign, 3 sig figs, bps, period, years, missing words, Locale) passes; `ThesisTypeCapTest` at 1.0/1.3/2.0; all 36 existing tests pass; `PaletteContrastTest` as specified in 2.2 (all text tokens × all surfaces × glow composites, hero pairs) | Hex values equal section 2.2 exactly; light gold text uses `#70572F`; no screen visuals changed beyond token effects |
| **F2 Component kit and page background** | `ui/components/**` (new kit files; old ones untouched until replaced), `ui/icons/**`, `ui/motion/Motion.kt`, `ui/motion/Haptics.kt` (API), `ui/motion/Press.kt`, `ui/platform/**` | Components 1–52 of section 3 except the motion-heavy ones scheduled in PR-2 (`RollingNumber`, `ContainerTransformHost`, `DismissibleItem`, `StageProgress` pulse, chart kit); `pageBackground` + `PageBackgroundCache`; `HeroBand` (palette + M3 scheme + content colour); `thesisPress`; `rowGroupSegment`; `ui/platform/Back.kt`, `CardShadow.kt`; haptics wrapper; delete `ShimmerCard`, `EmptyStateView` family, `DeltaIndicator` (zero callers); kit gallery renders of every component state, both themes, 1.3× and 2.0× | Kit gallery PNGs exist for all components and states, including "HeroBand screen, light, at rest and collapsed"; kit `SemanticsTest`: every clickable ≥ 48 dp, roles and states; no `Color(0x`/sp/dp literals outside `ui/theme`; no ripple (`indication = null` + `thesisPress`) and no custom `Indication` classes; `ThesisButton` keeps its old signature as a deprecated wrapper | Visual parity with dd-shots (chips vs DD chip nav, buttons vs DD `.iconbtn`, card vs DD card and its shadow, upshot vs DD upshot side by side) |
| **F3 Shell, navigation and data contract (= WP-INT)** | `ui/ThesisApp.kt`, `ui/MainViewModel.kt`, `ui/shell/**`, `ui/navigation/**`, extracted `ui/screens/AuthScreen.kt`, `ui/screens/SettingsScreen.kt` and `ui/screens/ResearchScreen.kt` (logic only, visuals in PR-3), `MainActivity.kt`, `AndroidManifest.xml`, `app/build.gradle.kts`, `data/SessionStore.kt`, `network/ProductApiClient.kt`, `offline/**`; plus a **declared mechanical edit**: removing root `background(ThesisColors.Background)` calls in the 18 screen files that paint one | `AppNavigator` owned by `MainViewModel`, persisted in `SavedStateHandle`, `entryId`-keyed saved state, modal stack, `UiState.currentTab` deleted; `ThesisShell` (pure, renderable) with the report base layer; new `ThesisTopBar`/`ThesisBottomBar` (4 tabs) wiring; `ThesisBackHandler`/`ThesisPredictiveBackHandler` for every push; edge-to-edge + `adjustResize` + insets + `imePadding`; splash (5.1); global spinner removed; `isLoading` split, race fixes (5.5); theme/up-down/reduce-motion/density preferences in `SessionStore`; dead code deleted (WelcomeScreen, LoginScreen, dead tabs, `activity_main.xml`); **client data layer (5.5)**: `market_tape` parsing, Room migration (`report_notes`, `monitor_snapshot_history`, `report_summaries`), ViewModel contract for PR-3 | `ThesisApp.kt` ≤ 400 lines; `ThesisShell` renders in design-preview with fixture state for each tab; `LaunchDestinationResolverTest`, new `DestinationCodecTest` and `AppNavigatorTest` (incl. simulated recreate) pass; Room migration test; `market_tape` parser test on a real `/pulse/latest` fixture; manual list: back from every sub-screen returns (no exit), rotation keeps the stack; no `CircularProgressIndicator` replacing a tab | Navigation behaviour matrix (section 5.5) and deep links unchanged; no visual redesign of screens mixed in |

PR-1 exit criteria: all of the above; renders of every screen in both themes show Newsreader titles, sans labels,
14 dp cards, warm tokens and the page glow (screens are not yet redesigned, but already less "random"); the PR-1
render review checks every screen for clipped text after the typography remap (2.3); rubric score ≥ 2 on T1–T4.

### 6.2 PR-2 Motion system applied

| WP | Owns | Deliverables | Acceptance criteria | Reviewers must check |
|---|---|---|---|---|
| **M1 Motion kit** | `ui/motion/**`, `ui/animations/**` | `EntranceCoordinator` (navigator-scoped seen-set keyed by `entryId`, `withFrameMillis` clock) + `staggeredEntrance`; `StaggeredEntrance` rewritten as a deprecated wrapper that no longer replays and uses `graphicsLayer`; `RollingNumber` (no wash), `StateCrossfade`, `ThesisRefreshBox`, `ContainerTransformHost` (§8a, 300/240), `DismissibleItem`, shared-axis X push specs, `shimmerSweep`, `rememberShowSkeleton`, `LoadingHairline`, `LiveDot`, `StageProgress` motion, `ChapterPills` scroll-spy, `SegmentedControl` indicator glide. Not built: `CountUpText`, `BlurReveal` | Renders at `settleMs = 0`, mid and end show the expected frames; a JVM test proves `EntranceCoordinator` never replays a key, including after the screen is disposed and recomposed; grep: no `delay(` in `ui/motion` except skeleton grace, no `SystemClock`; no `Modifier.alpha(`/`.scale(` with animated values in kit; reduced-motion renders show final states | Specs equal section 4.2; no overshoot except `pressRelease`/`reward`; draw-phase reads |
| **M2 Chart kit** | `ui/charts/kit/**` | `Sparkline`, `LineChart` (bands, scrub, morph, `ChartReadout`, indexed mode), `ColumnChart`, `SmallMultiples`, `RankedBars` (two-line variant), `Meter`, `RangeBar`, `ScaleBar`, `Timeline`, chart-card anatomy (fignum + conclusion title), "Show table" helper, chart semantics; draw-on keyed by data identity | Kit gallery renders of each chart, both themes, including empty/one-point/equal-values inputs (no NaN, no crash: unit tests); colours only from palette | Visual parity with dd-shots chart cards (fignum, gridlines, end label halo, 4 dp bar ends) |
| **M3 Shell motion (WP-INT)** | same as F3 | Tab fade-through with `SaveableStateHolder`, shared-axis X push/pop, modal rise, predictive back previews, bottom-bar selection crossfade and hide on Report, top bar scroll reveal and hero → paper switch with status-bar icons, snackbar motion, auth/onboarding crossfades, `enableOnBackInvokedCallback` | Scroll position survives tab switches and `Name(A)` → `Name(B)` → back; no hard cuts left in `ThesisShell`; back from Compare restores the live report and its scroll; reduced-motion path uses crossfades | Transition specs equal 4.5; back gesture preview; no double back handling with the WebView |

### 6.3 PR-3 Screen-by-screen elegance (parallel WPs)

All WPs start from `redesign/pr3` after PR-2 merges. Each WP: implement its section-5 screens with kit components,
replace `StaggeredEntrance` call sites with the coordinator (or remove them: pushed screens have no stagger), bring
its files to **zero** lint findings, add renders and semantics tests, open its PR into `redesign/pr3`.

| WP | Owns (exclusive files) | Screens (section) | Acceptance criteria (in addition to 6.0) | Reviewers must check |
|---|---|---|---|---|
| **WP-A Today** | `HomeScreen.kt`, `PulseScreen.kt`, `WeeklyDigestScreen.kt`, new `ui/today/**` (PulseBrief, tape view model), `ui/copy/TodayCopy.kt`; deletes `RevealAnimation` and `AnimatedCounter` (only Home uses them) | 5.6, 5.7, 5.8 | Home has five blocks and "Your names" starts above 780 dp at 360 dp width (render check); one timestamp; tape hidden when empty, no roll, no `LiveDot`; VIX/yields/DXY neutral (unit test on `marketTone` by family); generated section headlines (unit test of the sentence builder); no fallback prose when `pulse == null`; Pulse sources open URLs (callback test); digest KPIs are results (new filings, state changes) | Order and content of Home; tone semantics; first-open stagger only |
| **WP-B Names** | `NamesScreen.kt` (incl. the Notes view), new `NameScreen.kt`, `HoldingsCsvImport.kt` (UI part), `ui/copy/NamesCopy.kt`, `ui/copy/ScoreCopy.kt` | 5.10, 5.11, 5.28 | Filter chips scroll at 360 dp; every chip names its data source in code; Comfortable and Compact renders; Remove requires confirm, collapses and offers undo; Name never calls build when a stored report exists (callback test) and has no "re-run"; Name renders with and without report / `changeSummary` / notes trail / carry-forward / War Room / Pro; pager caption; notes trail ordering test | Row anatomy (≤ 2 trailing atoms), no card-per-row, `SinceLastReport`, period on every figure |
| **WP-C Deep Dive host** | `DeepDiveWebReportState.kt`, `DeepDiveWebPage.kt`, `DeepDiveLoadingScreen.kt`, `ReportExport.kt`, new `ui/screens/report/**` (dock, notes panel) | 5.13, 5.14, 5.24 | No `SignalBadge`; theme param follows palette; loading = skeleton + progress hairline; generation screen has no timers (grep `delay(` = 0) and maps each `jobStatus` value (unit test); "Add to note" appends the quote format (unit test of the formatter; manual on device); notes panel jumps to 85% on focus; export off the main thread; `DeepDiveWebPolicyTest` 16/16 | Chrome height (one bar), dock behaviour, honest copy |
| **WP-D Deep Dive classic** | `DeepDiveScreen.kt` (the search state moved to `ResearchScreen.kt` in PR-1), `DeepDivePresentationCards.kt`, `DeepDiveNativeMemo.kt`, `ConvictionIntelligenceCards.kt`, `SampleDeepDiveScreen.kt`, `ui/charts/EvidenceRadar.kt`, `ScenarioFanChart.kt`, `SectionHealthStrip.kt` (to delete/replace) | 5.15, 5.16 | Dead code removed (file shrinks by ≥ 400 lines); no raw `%.2f`/`String.format` without `Fmt`; no banned words; five-year chart and range bar render from the sample fixture; evidence URLs clickable; "Add to note" on long-press | Side-by-side with dd-shots: hero, chapter header, chart card, upshot |
| **WP-E Research and compare** | `ResearchScreen.kt` (visuals), `HistoryScreen.kt`, new `CompareReportsScreen.kt`, new `CompareNamesScreen.kt`, new `SearchScreen.kt`, `WarRoomScreen.kt`, `ScenarioStressScreen.kt`, `ui/copy/ResearchCopy.kt` | 5.12, 5.17, 5.18, 5.19, 5.20, 5.26, 5.27 | No UUIDs rendered; badge rows use `FlowRow`; results sorted descending with rationale lines (unit test); History skeleton before load; compare modes enforce same ticker and like-for-like filings; Compare names: period header row, median row, sort by column, Copy as table produces TSV (unit test), "No report yet" column; Search groups and note excerpts | Linking (tickers → Name, report → host), `RunBar`, table density on 360 dp and tablet |
| **WP-F Macro and Inbox** | `SentimentDashboardScreen.kt`, `InboxScreen.kt`, `ui/copy/InboxCopy.kt` | 5.9, 5.21 | Vico import gone from the file and the file removed from `androidOnlyFiles`; rising stress uses Unfavourable (unit test); x-axis shows dates; an action error leaves the list visible; category filtering by key; swipe-to-quiet with undo; Mark all as seen; drift alerts route to Name | Scrub/morph behaviour (mid-animation renders), expand/collapse, undo |
| **WP-G Account and entry** | `AuthScreen.kt`, `PasswordResetScreen.kt`, `OnboardingScreen.kt`, `PaywallScreen.kt`, `SettingsScreen.kt`, `DeleteAccountSection.kt`, `ui/components/LegalLinks.kt`, `res/drawable/ic_launcher_*`, `res/drawable/ic_mark_t.xml`, `res/mipmap-anydpi-v26/**` | 5.2–5.4, 5.22, 5.23 | Fields have labels, password toggle described, IME actions set; no fixed paddings in Onboarding (renders at 1.3× and 2.0×: no overlap); PlasmaOrb deleted; onboarding uses product fragments; theme/up-down/reduce-motion settings change the palette in renders; delete confirm disabled state distinct; Export my notes produces Markdown (unit test) | Contrast of disclaimers, legal link targets 48 dp, icon in safe zone |
| **WP-K Kit maintenance** | `ui/theme/**`, `ui/components/**` (minus `LegalLinks.kt`), `ui/motion/**`, `ui/charts/kit/**`, `ui/format/**`, `ui/platform/**`, `ui/icons/**` | — | Fixes requested kit bugs within the PR-3 window; deletes components listed in section 3 once no references remain | No screen-specific logic leaks into the kit |
| **WP-INT Integration** | hot spots (6.0 rule 2) | 5.1, wiring | Merges last: wires new parameters and destinations (`CompareNames`, `Search`, Notes), removes Vico after WP-F and `material-icons-extended` after the last `Icons.*` call site, runs full renders and the rubric on all screens | Whole-app navigation matrix, no behaviour regression list (7.1 R-items) |

Merge order inside PR-3: A, B, C, D, E, F, G in any order (no shared files) → WP-K deletions → WP-INT wiring →
full render sweep → rubric review → PR into `rebuild`.

**Carried from the PR-1 review** (pre-existing on screens PR-1 did not redraw; add to the named WP checklists):
- WP-A, WP-B: filled gold buttons outside a HeroBand (Home "Dashboard", Names "Add" / "Deep Dive"; rubric T3, V3).
- WP-A: "LIVE" badges on Home cards (principle 14); the remaining `labelSmall` (now `eyebrow`) uses on
  sentence-case text and numbers (PR-1 moved only the Macro Stress date and the Home captions to `bodySmall`).
- WP-A, WP-C, WP-E: Title Case and "news" wording ("Weekly Digest", "Run Deep Dive", "Reading recent news" on the
  Deep Dive loading screen; rubric C1).
- WP-G: the splash `windowSplashScreenAnimatedIcon` still points at the raster launcher foreground; swap to the
  vector T mark (5.1).
- WP-INT: `values/themes.xml` and `values/splash.xml` keep an ink `windowBackground` (Q2: Dark stays the default);
  point them at `thesis_bg_paper` when the Auto default ships, or set the window background from `ThesisTheme`
  to `palette.bg`. Unknown alert routes (see Appendix A).
- WP-INT, PR-2 M3 (predictive back): PR-1 previews the layer the gesture closes (the modal layer for You and
  Search, else the report and tab layers) and, on commit, runs the pop while that whole layer settles from .90
  back to full size. M3 replaces this interim with the 4.5 behaviour: only the leaving page keeps the scaled
  state into its exit, and the page under it enters at full size.
- WP-INT (with the next Room change, at the latest PR-4): `OfflineCacheDatabase` has `exportSchema = false`, so the
  v1→v2 migration is checked only against the hand-written `OfflineCacheMigrations.MIGRATION_1_2_SQL`. Set
  `exportSchema = true` with the KSP arg `room.schemaLocation`, commit `schemas/…/2.json`, and add a
  `MigrationTestHelper` androidTest (or have the JVM test compare the SQL with the exported JSON), so an entity
  field added without a migration edit fails CI instead of crashing after the upgrade.

**Carried from the PR-2 review** (add to the named WP checklists):
- WP-G, WP-INT: the Paywall still opens as a platform `Dialog` (platform window animation, no 4.5 modal rise, no
  reduced-motion path), the one known exception to M3's "no hard cuts left in `ThesisShell`". WP-G makes it the
  full-screen destination of 5.23; WP-INT then opens it on the modal stack and deletes the shell's Dialog branch
  (HANDOFF-M3 item 9).
- WP-K: the collapsed bar's 92% page slice shows saturated content under it as a muted block (Home's gold
  "Dashboard" behind THESIS, Inbox chip labels). Re-check after WP-A removes the gold button; if it still reads as
  clutter, raise the slice opacity or fade content under the bar, checked against Deep Dive's sticky chip-nav bar.
- WP-E: History draws its own sticky bar on a flat `Background.copy(alpha = 0.97f)` (`HistoryScreen.kt`), which
  cuts a hard seam through the page glow at the bar's bottom edge (dark: (10,10,10) above, (36,31,22) below, at
  x=1050 in `shell-today-history-dark`; it shows in every push/pop frame). Drop the private bar for the shell's
  `ShellTopBar.Back` (drawn on `barBackground`), or draw the sticky header on `barBackground`.

### 6.4 PR-4 (after the redesign, WP-INT)
`compose-bom:2025.04.00` (with it, `rememberIsResumed()` and `CoveredBackScope()` in `ThesisApp.kt` move from the
deprecated `androidx.compose.ui.platform.LocalLifecycleOwner` to `androidx.lifecycle.compose.LocalLifecycleOwner`),
regression pass, harness to Compose Multiplatform 1.7.x (re-check the `androidx.collection`
and lifecycle substitutions), `RippleTheme` → `RippleConfiguration`, then optional: `sharedBounds` container
transform, `animateItem`, seekable predictive back, M3 1.3 `PullToRefreshBox` and sheet IME handling (text fields
may then move into `ThesisSheet`). Kotlin 2 + Compose 1.8+ is a separate later migration.

---

## 7. Review rubric (used every loop, per PR and per WP)

Score each item 0–3: **0** missing/broken, **1** partially done with visible issues, **2** done with minor issues,
**3** exemplary. **Pass:** no item at 0; every item marked ★ at 3; average ≥ 2.3. Reviewers attach the dark and
light renders they judged and list each deduction with file:line.

### 7.1 Items

| # | Item | What a 3 looks like | How to check |
|---|---|---|---|
| T1 ★ | Token compliance | Zero raw `Color(0x`, `Color.White/Black` (except `Transparent`), `N.sp`, numeric `N.dp`, `RoundedCornerShape(N.dp)`, `FontFamily.*`, `fontSize =` outside `ui/theme`, `ui/components`, `ui/charts/kit`, `ui/motion` | `tools/design-lint.sh` on the WP's files = 0 findings |
| T2 | Typography | Only `ThesisType`/M3 styles; serif for meaning, sans for apparatus; no `.copy(fontWeight=…)` overrides; tnum on changing/column numbers; U+2212 minus | grep `.copy(font`, render review |
| T3 | Colour discipline | Gold < 8% of pixels, no filled gold control outside a HeroBand, up/down only on figures, `marketTone`/`Tone` used, no ad-hoc alpha tints | `tools/gold-share.py` over every render (pixels with hue 35–45° and saturation > 0.35) < 8%; grep `.copy(alpha` in screens = 0 |
| T4 | Layout and rhythm | 16 dp gutter, text on the three named edges E0/E1/E2 (2.5), spacing only from the scale, data-screen density (24 dp gaps), lists in `RowGroup`/`rowGroupSegment`, no fixed heights on text containers | render overlay of gutters and edges; grep `.height(` with literals |
| V1 | Visual coherence with Deep Dive 2.0 | Side-by-side with `dd-shots/renderer-*` the screen reads as the same publication (glow, chips, cards, kicker anatomy) | reviewer compares PNG pairs |
| V3 | Density and restraint | ≤ 2 trailing atoms per row; ≤ 1 HeroBand per screen and only on cover moments; ≤ 3 type sizes per card; ≤ 1 filled control per screen; no kicker and headline with the same words; no chevrons in lists; no ripple | render review + "squint test": each screen next to `dd-shots/renderer-*` at 25% scale reads as the same publication |
| V2 | Component reuse | No private card/button/chip/header re-implementations; all from the kit | grep for `RoundedCornerShape`, `Button(`, `OutlinedButton(`, `AssistChip(` in screens = 0 |
| M1 | Motion presence | The screen's hero motion (section 5) and press feedback on every tappable exist; navigation uses 4.5 transitions | mid-animation renders (`settleMs` 0/150/400), checklist |
| M2 | Motion quality | Values from `ThesisMotion` only, no overshoot, draw-phase reads, no replays on scroll, no `delay()` timing | grep `tween(`/`spring(` in screens = 0; code review |
| M3 ★ | Reduced motion | With reduced motion on: no translation/scale/loops, no information lost | `reducedMotion = true` renders |
| H1 | Haptics | Only the 4.7 map; none on plain taps | code review |
| A1 ★ | Touch targets | Every interactive element ≥ 48×48 dp | render with touch-bounds overlay / semantics bounds test |
| A2 ★ | Contrast | Text ≥ 4.5:1 (≥ 3:1 for ≥ 24 sp), control boundaries ≥ 3:1, in both themes, including over the glow peaks and inside HeroBands | `PaletteContrastTest` (2.2) + spot checks on new pairs |
| A3 ★ | TalkBack | Icons with actions described, headings marked, chips/segments/tabs expose selected state, toggles are `toggleable` rows, status text `liveRegion`, rows merged, charts summarised | `ui-test-junit4-desktop` semantics tests (kit `SemanticsTest` + one per screen WP) |
| A4 ★ | Font scale and width | No clipping, overlap or truncation of meaning at 1.3× and 2.0× and at 360 dp width (display sizes capped in dp; numbers never ellipsize) | 1.3×, 2.0× and 360 dp renders |
| L1 | Light theme parity | Light render is designed (paper, bronze gold, shadows per 2.7), not a dark screen | light PNGs |
| P1 | Performance | No per-frame recomposition from animations, `drawWithCache` for paths, glow from the cached bitmap, stable keys and `contentType` in lazy lists, ≤ 1 infinite animation on screen, no main-thread parsing/IO | code review; harness render time (with `-Dpreview.glow=false` for state renders) not regressed > 2× |
| R1 ★ | No behaviour regressions | Every action from the audits still works (follow/remove, build/open report, notes save, export, alert feedback, mute, scenario run, auth flows, deep links, notifications routes); back never exits from a sub-screen; back from Compare/Stress restores the live report and its scroll; rotation keeps the stack | WP checklist in the PR description, `AppNavigatorTest`, device pass on the phase APK |
| U1 ★ | Unit tests | 34/34 harness, 36/36 CI, plus the WP's new tests | `unit-tests.sh`, CI |
| C1 | Copy | Sentence case, product vocabulary, no SPEC banned words or em dashes, no raw enums/UUIDs/ISO dates, numbers via `Fmt` with a period on every fundamental figure, section headlines are generated conclusions (not the kicker repeated), action labels honest (open/build, never re-run) | grep test over owned string literals; review |
| K1 | Linking | Section 5.25 checklist holds for the WP's screens | manual tap-through list |

### 7.2 `tools/design-lint.sh` (F4) — patterns and scope

Scope: `app/src/main/java/com/thesis/mobile/ui/**` excluding `ui/theme/**`, `ui/components/**`, `ui/charts/kit/**`,
`ui/motion/**`, `ui/icons/**`. `ui/shell/**` and `MainViewModel` are **in** scope (they use `ThesisMotion`); the
two polling `delay(` calls in `MainViewModel` are listed in `tools/design-lint-allow.txt`. Patterns (each counted
per file, compared with the baseline; a count above baseline fails; WPs in PR-3 must reach 0 for owned files and
lower the baseline in the same commit):
`Color\(0x`, `Color\.(White|Black)`, `[0-9.]+\.sp\b`, `\b[1-9][0-9.]*\.dp\b`, `RoundedCornerShape\([0-9]`,
`FontFamily\.`, `fontSize\s*=`, `\.copy\(alpha`, `tween\(`, `spring\(`, `\bdelay\(`, `CircularProgressIndicator\(`,
`AlertDialog\(`, `OutlinedButton\(`, `AssistChip\(`, `String\.format\(`, `"%\.[0-9]f"`, `rememberRipple\(`,
`Icons\.(Default|Filled|Outlined|AutoMirrored)\.`, `ThesisColors\.(AccentBlue|LightBackground|TextPrimaryLight|DarkSurfaceHigh|TextTertiaryDark)`.

**Copy check** (separate pass, aligned with `docs/deep-dive/SPEC.md` §4): scope = `ui/copy/**` plus string literals
passed to `Text(`; an allowlist file (`tools/design-lint-copy-allow.txt`) holds known false positives with file:line
(for example `DeepDiveNativeMemo.kt:63` "hold up"). Banned, case-insensitive, whole words inside quotes:
`buy|sell|hold|accumulate|overweight|underweight|outperform|undervalued|overvalued|cheap|expensive|upside|downside|target|entry|exit|stop|opportunity|attractive|bullish|bearish`,
plus the em dash `—` and `!` in user-facing strings. The lint has a self-test (fixture files that must fail and pass).

---

## 8. Open questions for Razvan (only the critical ones; we proceed with the default)

**Q1. Show the real Deep Dive 2.0 page as the first-run sample?** SPEC rule 7 lists "sample reports" under the native
fallback, so the first impression today is the weakest native screen. Option: bundle the server-rendered sample page
and load it in the same WebView. *Default we proceed with:* keep the native sample (rule 7 unchanged) but restyle it
to the Deep Dive 2.0 look (section 5.16). Switching later is a contained change in WP-D/WP-C.

**Q2. What should the app's theme default be once light mode is ready?** The app has been dark-only; the Deep Dive
page defaults to Auto. *Default we proceed with:* ship the Auto / Light / Dark setting in PR-1 with **Dark** as the
default until PR-3 has passed the rubric in both themes, then switch the default to **Auto (follow the system)** in
WP-INT's last PR-3 commit. Existing users who chose a value keep it.

**Q3. What counts as "reviewed" for a name?** The server's `unreviewed_events_count` returns to 0 only when a new
Deep Dive is applied (`_lib/jobs/effects/apply.ts`); there is no "mark reviewed" endpoint and the user cannot force a
report (SPEC rule 1), so a count could sit on a row for a whole quarter. Options: opening the name's alerts clears
it, or opening the report clears it; either needs a small endpoint. *Default we proceed with:* the count is shown
only on Name as "Events since the report: n", never as a row badge or a sort key; rows use the client-side "new
since your last visit" count and the default sort is state severity, then changed since your last visit.

**Q4. One grotesk for both the renderer and the app?** Roboto via `FontFamily.Default` matches the WebView exactly,
but it covers about 70% of the pixels on Names, Inbox and You and is where "generic Android" leaks in. Option: bundle
one grotesk (Inter or Public Sans) in `fonts.ts` and the app together. *Default we proceed with:* Roboto; the switch
is a `ThesisFonts.Sans` change plus the renderer's font stack.

**Q5. Renderer sync (one change in `css.ts`, so principle 1 holds).** The app deviates from the renderer in: light
`muted #545E69` and light `accent #70572F` (AA over the glow peaks), dark `bg2 #121212` (card separation), dark
`pos/neg/warn #7FD3A2 / #F2A0A0 / #D9A441` (the hero values, replacing Tailwind 400s), dark colour-blind text
`#5A95D6 / #D97757`, and the F1 contrast fixes: light `neg/warn #954747 / #815611`, light colour-blind text
`#2261A1 / #9C452B` (`control` is app-only and has no renderer counterpart). *Default we proceed with:* ship them in the app now and ask for the same values in the
renderer.

**Q6. Ticker-level notes and price stamping.** This redesign gives notes a home without backend: one note per
report, shown as a dated trail per ticker with "Carry forward", a Notes view, search and export. What it cannot do:
several notes per filing, notes not tied to a report, or stamping the price at writing time (no price feed).
*Default we proceed with:* the per-report trail; a `ticker_notes` table is the recommended next backend step.

Everything else has a decided default in this file (Inbox becomes a bottom tab; no new dependencies besides
`core-splashscreen`; static glows; no live prices; compare and the report diff are built from existing payloads).
Features that need backend are listed per screen as "Later, needs Razvan" and are collected here for planning:
- Ticker-level notes (several per filing, not tied to a report, price/date stamped; Q6), note reminders, note
  markers on charts.
- Structured thesis card (catalysts, kill criteria, your fair value) with a fair-value-vs-time chart.
- Persistent highlights drawn on report passages and notes pinned to the chapter on screen (renderer anchor ids +
  WebView bridge). Quoting a selection into a note is built now (5.13).
- A "mark reviewed" endpoint (Q3).
- A price feed (names' price, day change, sparkline, position weight; price-vs-value marker at today's price).
- Weekly digest payload; War Room actual-vs-estimate numbers and price reaction; History summary fields (stance,
  value range); server-side inbox read state; exposure mapping for "Most exposed names"; scenario compare and
  holdings weighting; "add guardrail as alert"; Pulse notes.

---

## Appendix A. Decisions log (so build agents do not re-litigate)

| Topic | Decision | Source |
|---|---|---|
| Body sans | Roboto via `FontFamily.Default`, not Inter (open: Q4) | renderer css.ts; dd-lang §2 |
| Glow positions | gold top right, blue bottom left, static; painted by each opaque `ThesisScreen` from one cached bitmap | renderer; background PNGs; Android critique |
| Light muted / accent | `#545E69` / `#70572F` (AA over glow peaks), renderer sync Q5 | contrast computation 2.2 |
| Dark semantic colours | `pos/neg` = heroPos/heroNeg, `warn #D9A441`; dark `bg2 #121212` | design critique |
| Primary button | ink inversion; gold fill only for a HeroBand CTA; secondary = outline; 40 dp visual in 48 dp touch | DD `.iconbtn`, chip nav; design critique |
| Press feedback | one ink tint, no ripple, scale only on standalone buttons/cards, no custom `Indication` classes | design + Android critiques |
| Springs | damping 1.0 everywhere, 0.85 press release, 0.8 one reward moment | playbook §2, elegant §2.9 (banking caveat) |
| Blur | none (no sheet blur, no blur-roll, no backdrop blur) | design critique |
| Shimmer | one slow sweep per screen, static on reduced motion | playbook §12, elegant §3.9 |
| Navigation axis | shared-axis X for pushes (agrees with predictive back); vertical only for modal destinations | design critique |
| Stagger | Home and Pulse, first open per issue only; pushed screens arrive whole | design + finance critiques |
| Number motion | market values never animate; `RollingNumber` only for app-computed refreshes; no CountUp, no Flash | design + finance critiques |
| LiveDot | War Room Live phase only | design + Android critiques; no live prices |
| HeroBand | cover moments only (Pulse, Deep Dive loading/classic, Auth, Onboarding, Paywall), under the status bar | design critique |
| Icons | curated Material Symbols (wght 300) as generated `ImageVector`s; no chevrons in lists | design critique; harness compilability |
| Ratings | none in native chrome (SignalBadge removed) | SPEC rule 6 |
| Market direction colour | indices/commodities by sign; VIX, yields, DXY, spreads neutral; keyed on `market_tape.family` | audit A Pulse; principle 5 |
| Macro stress colour | rising = Unfavourable | audit B MS1 |
| Inbox | bottom tab; "new" dot from local last-visit time | audit A S6; financial §2.5 |
| Needs-review sort | not driven by `unreviewed_events_count` until Q3 is answered | finance critique |
| Compare | Compare names (2–4 tickers, from report payloads) is primary; Compare reports is secondary, like-for-like only | finance critique |
| Report diff | built now from `changeSummary` + `thesisDrift` (`SinceLastReport`) | finance critique |
| Notes | per-report notes as a dated trail per ticker, carry forward, Notes view, search, export; Room cache | finance + design critiques |
| Navigation state | `AppNavigator` in `MainViewModel`, `SavedStateHandle`, `entryId`-keyed saved state, modal stack | Android critique |
| Report WebView | kept composed in a shell base layer while its entry is in the stack | Android critique, option (b) |
| Container transform | §8a clip-reveal on 1.6 (300/240 ms); §8b in PR-4 | 4.1 |
| Charts | own Canvas kit, Vico removed from Macro Stress | audit B charts; harness compilability |
| Unknown alert routes | **Open, owner decision.** PR-1 keeps the old behaviour (an alert with an unknown route lands on the Inbox root), which deviates from 5.5 ("push the alert's detail"); PR-3 WP-INT adds an alert-detail destination if Razvan agrees | PR-1 review; PR-1 description |

---

## Critique log (v2 → v2.1)

Three critiques were applied: **FP** = buy-side analyst, **DD** = design director, **AE** = Android engineer.
"Adopted" means the change is now in the body; "Partly" means some of it is in and the reason says what was not.

| # | Point | Result | Reason |
|---|---|---|---|
| FP1 | Report diff already in the payload; "Since the last report" on Name and Compare reports | Adopted | `changeSummary`, `thesisDrift`, `MetricDeltaItemView` exist in `Models.kt` (checked); `SinceLastReport` #51, 5.11, 5.17 |
| FP2 | Cross-company compare now; Compare reports secondary | Adopted | N × `getDeepDiveReport` by snapshot `reportId` needs no backend; new 5.26, entry "Compare with…" |
| FP3 | Notes vanish after each 10-Q; show a trail, carry forward, Room cache, scaffold | Adopted | Room 2.6.1 already in the app; `NotesTrail` #52, cache in 5.5 |
| FP4 | Notes need a home, search, copy/share, export | Adopted | Names "Board · Notes" (5.28), Search (5.27), NoteBlock Copy/Share, You > Export |
| FP5 | Quote into a note via WebView ActionMode; DockPanel to 85% on focus | Adopted | App-side only (5.13, 5.15); persistent highlights stay Later |
| FP6 | `unreviewed_events_count` cannot be cleared; undefined chips | Adopted | Verified reset only in `apply.ts`; Q3 added, default sort changed, chips given sources, "Unresolved" dropped |
| FP7 | Deltas on hub screens, local snapshot history, ink meters, 10-K KPIs, score explainers | Adopted | 5.5 Room history, TickerRow trailing block, Name 5.11, `SourceSheet` for scores |
| FP8 | Density: Home header, compact tape, names before macro, Compact rows, 24 dp gaps, tablet width | Adopted | 2.5, 5.6, 5.10, #11 |
| FP9 | Fmt rules: bps, 3 sig figs, negative money, period, currency, years, missing vocabulary, jargon | Adopted | 2.4 rewritten |
| FP10 | "Source and definition" sheet on figures | Adopted | `SourceSheet` #47 (tap when not navigating, long-press inside navigating rows) |
| FP11 | Copy as table / Share as image | Adopted | `CompareTable` overflow, Scenario, Macro readings |
| FP12 | Faster Name motion, delete CountUpText, name pager | Adopted | 300 ms transform, no stagger, pager "3 of 12" |
| FP13 | Scenario rows need rationale, likelihood, scale, evidence | Partly | All adopted except the trailing chevron to Name: lists have no chevrons (DD8); the ticker itself links |
| FP14 | Digest results, not usage | Adopted | New filings and state changes replace "Deep Dives opened" |
| FP15 | Run/re-run wording contradicts SPEC rule 1 | Adopted | "Open report" / "Build report" / "Up to date with…" caption |
| FP16 | Basis row, like-for-like pairs, `listReports` is job history | Adopted | 5.17, 5.18, 5.11 copy. History compare mode is kept (FP2 said Name-only), limited to like-for-like |
| FP17 | Inbox swipe actions, mark all seen, drift routing | Partly | Swipe-to-quiet, Mark all as seen and drift routing adopted; swipe-to-open rejected (tap already opens, two gestures for one action) |
| DD1 | HeroBand/top bar/status bar fit; HeroBand only on cover moments | Adopted | 2.7 rule + fixture; removed from Name and War Room |
| DD2 | No filled gold button | Adopted | Primary = ink inversion, Secondary = outline, 40 dp visual; `onAccent` removed |
| DD3 | LiveDot, roll and Flash imply live prices | Adopted | Principle 14; LiveDot War Room only; Flash deleted (same point as AE11) |
| DD4 | One press language, no ripple, no border flash, no row scale | Adopted | 4.4; built with `interactionSource` per AE19 rather than a custom `Indication` class |
| DD5 | Headlines conclude, kickers label | Adopted | #6, 5.6, 5.9, rubric C1 |
| DD6 | Shared-axis X, no stagger on pushes, draw-on per data identity | Adopted | 4.3, 4.5, 4.6 |
| DD7 | Fewer type sizes, heroLine 20, merges, company name as title, pnum, numeral clip check | Partly | Serif set {40,30,24,20,18,17}, `num` merged into `body.tnum()`; `barTitle` kept at 17 (merging rows to 17 fights FP8 density and the DD app bar is 17) |
| DD8 | TickerRow overloaded; ≤ 2 trailing atoms, no chevrons, ink meters | Adopted | Combined with FP7: trailing = score + delta block; copy uses FP9's "10-K · 23 days ago", not "Read 23 days ago" (it is report age, not reading time) |
| DD9 | Dark up/down colours are neon | Adopted | heroPos/heroNeg, warn `#D9A441`; renderer sync Q5 |
| DD10 | Material Symbols instead of Icons Extended | Adopted | Generated as `ImageVector`s, not XML, so `ui/**` still compiles in the harness |
| DD11 | Missing component specs | Adopted | Rows #37–#52; ReportTopBar reference fixed to 5.13 |
| DD12 | Bar seams over the glow; bottom bar fill; dark `bg2` | Adopted | Bars draw the cached background bitmap at 92%; dark `bg2 #121212` |
| DD13 | Eyebrow gold rule, chart fignum, drop cap weight, DD card shadow | Adopted | Drop cap accepts display 400 (no sixth font instance); shadow in `ui/platform/CardShadow.kt` with a harness shim |
| DD14 | Three named text edges | Adopted | E0/E1/E2 in 2.5, rubric T4 |
| DD15 | Cut blur, inchworm indicator, sheet gold hairline | Adopted | No blur anywhere; bottom bar without indicator; reward and scrub haptics kept |
| DD16 | Notes too weak; Home Notes row, History chip, raise as a question | Partly | History "With notes" chip and Q6 adopted; Home Notes row rejected (Home is capped at five blocks per DD17; notes live in Names > Notes and Search) |
| DD17 | Home has too many blocks | Adopted | Five blocks; alert folded into Pulse; Continue reading and footer rows moved to Research |
| DD18 | Onboarding product fragments, Pulse colophon, pager dots | Adopted | 5.2, 5.7, #45 |
| DD19 | Sans choice as an open question | Adopted | Q4, default Roboto |
| DD20 | Rubric must measure restraint | Adopted | V3, automated gold share, squint test |
| AE1 | `RowGroup` breaks lazy lists and item placement | Adopted | `rowGroupSegment`, rows tint-only |
| AE2 | Navigation state ownership and recreation | Adopted | Navigator in `MainViewModel` + `SavedStateHandle`, `entryId`, `currentTab` deleted, coordinator registry, tests |
| AE3 | Contradiction on who paints the background; ghosting | Adopted | Opaque `ThesisScreen`, root fills `bg`, F3 strips 18 root backgrounds as a declared edit |
| AE4 | WebView destroyed on pushes from the dock | Adopted | Option (b): report kept in a shell base layer; R1 check added |
| AE5 | Not all [1.6 OK] compiles in the harness | Adopted | `includeFontPadding` dropped, `ui/platform/Back.kt`, `withFrameMillis`, section 4 amendment |
| AE6 | PR-1 ownership collisions (helpers, RenderScreen, LocalReducedMotion) | Adopted | Day-0 serial commit, deprecated overload, F1 sole definer |
| AE7 | PR-2/PR-3 ownership conflicts | Adopted | CSV import → WP-B, LegalLinks → WP-G, splash → WP-INT, Research extracted by F3, API client and offline → WP-INT, deletions moved |
| AE8 | Contrast failures the test would miss | Adopted | Colour-blind dark text fixed; light muted/accent changed (as deviations, Q5); test covers all surfaces and glow peaks; light `control` to be darkened by F1 until it passes |
| AE9 | Font-scale cap wrong on API 34+; 2.0× and 360 dp; numbers never ellipsize | Adopted | dp-based cap + test; renders; 2-column KpiGrid rule (Home strip itself became a tape row) |
| AE10 | Parse structured `market_tape` | Adopted | WP-INT parser; `marketTone` by family |
| AE11 | Live-price implication | Adopted | Same as DD3; phase word left out when unsure |
| AE12 | No removal animation on 1.6 | Adopted | `DismissibleItem` #42 |
| AE13 | HeroBand must re-provide M3 scheme and content colour | Adopted | 2.7; `staticCompositionLocalOf` |
| AE14 | IME and sheets | Adopted | `adjustResize`; no text fields in `ThesisSheet` on 1.2, use `DockPanel` |
| AE15 | Harness render cost of the glow | Adopted | Cached bitmap, `-Dpreview.glow=false` |
| AE16 | More automated tests | Adopted | `ui-test-junit4-desktop` semantics tests, gold share, `Fmt` clock injection, lint self-test |
| AE17 | Lint banned words diverge from SPEC; false positives; scope | Adopted | SPEC list incl. em dash, copy scope + allowlist; shell and ViewModel in scope with a `delay(` allowlist |
| AE18 | CI per WP PR, APK per phase | Adopted | Section 6 preamble, F4 trigger |
| AE19 | No custom Indication classes; PR-4 harness to CMP 1.7 | Adopted | 4 preamble, 4.1, 6.4 |
| AE20 | Font subset and numeric features | Adopted | Latin Ext-A + Ș/Ț, arrows dropped, `lnum` dropped; static serif figures use `pnum`, story stays default |
| AE21 | Typography remap shifts layouts | Adopted | Known shifts listed in 2.3; F1 removes 2 fake-bold `.copy`; PR-1 clipping review |
| AE22 | You's stack, bottom bar hide, CompareTable scroll | Adopted | Global modal stack; hide spec in #4; single `horizontalScroll` in #30 |
