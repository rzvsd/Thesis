package com.thesis.mobile.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material.ripple.LocalRippleTheme
import androidx.compose.material.ripple.RippleAlpha
import androidx.compose.material.ripple.RippleTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.platform.SystemBarAppearance
import com.thesis.mobile.ui.platform.rememberSystemReducedMotion

/** Light or dark. [System] follows the device setting. */
enum class ThemeMode { System, Light, Dark }

/**
 * True when motion should be reduced: the system animator scale is 0 or the in-app "Reduce motion" toggle
 * is on (section 4.8). Provided by [ThesisTheme]; this is its only definition.
 */
val LocalReducedMotion = staticCompositionLocalOf { false }

/**
 * The Material3 colour scheme for [p] (section 2.2, "Material3 bridge"). Every role is set, so M3 defaults
 * (dialogs, snackbars, menus, switches) never show the stock purple. `inversePrimary` is the accent of the
 * opposite theme, so it stays readable on `inverseSurface` (ink).
 */
fun schemeOf(p: ThesisPalette): ColorScheme {
    val inversePrimary = if (p.isLight) p.heroAccent else PaperLight.accent
    return if (p.isLight) {
        lightColorScheme(
            primary = p.accent, onPrimary = p.surface, primaryContainer = p.chip, onPrimaryContainer = p.ink,
            inversePrimary = inversePrimary,
            secondary = p.ink2, onSecondary = p.surface, secondaryContainer = p.chip, onSecondaryContainer = p.ink,
            tertiary = p.series[3], onTertiary = p.surface, tertiaryContainer = p.chip, onTertiaryContainer = p.ink,
            background = p.bg, onBackground = p.ink,
            surface = p.surface, onSurface = p.ink, surfaceVariant = p.surface2, onSurfaceVariant = p.ink2,
            surfaceTint = Color.Transparent,
            inverseSurface = p.ink, inverseOnSurface = p.surface,
            error = p.neg, onError = p.surface, errorContainer = p.callout, onErrorContainer = p.neg,
            outline = p.control, outlineVariant = p.line, scrim = p.scrim,
            surfaceBright = p.surface2, surfaceContainer = p.surface, surfaceContainerHigh = p.surface2,
            surfaceContainerHighest = p.chip, surfaceContainerLow = p.surface, surfaceContainerLowest = p.bg,
            surfaceDim = p.bg,
        )
    } else {
        darkColorScheme(
            primary = p.accent, onPrimary = p.surface, primaryContainer = p.chip, onPrimaryContainer = p.ink,
            inversePrimary = inversePrimary,
            secondary = p.ink2, onSecondary = p.surface, secondaryContainer = p.chip, onSecondaryContainer = p.ink,
            tertiary = p.series[3], onTertiary = p.surface, tertiaryContainer = p.chip, onTertiaryContainer = p.ink,
            background = p.bg, onBackground = p.ink,
            surface = p.surface, onSurface = p.ink, surfaceVariant = p.surface2, onSurfaceVariant = p.ink2,
            surfaceTint = Color.Transparent,
            inverseSurface = p.ink, inverseOnSurface = p.surface,
            error = p.neg, onError = p.surface, errorContainer = p.callout, onErrorContainer = p.neg,
            outline = p.control, outlineVariant = p.line, scrim = p.scrim,
            surfaceBright = p.surface2, surfaceContainer = p.surface, surfaceContainerHigh = p.surface2,
            surfaceContainerHighest = p.chip, surfaceContainerLow = p.surface, surfaceContainerLowest = p.bg,
            surfaceDim = p.bg,
        )
    }
}

/** Press tint alpha on `ink` (section 4.2 `PressTint`): 6% on paper, 8% on graphite. */
internal fun pressTintAlpha(p: ThesisPalette): Float =
    if (p.isLight) ThesisMotion.PressTintAlphaLight else ThesisMotion.PressTintAlphaDark

/**
 * The residual M3 ripple (Switch thumb, text fields, sheets) reads as the kit's press tint: `ink` at the
 * PressTint alpha. Kit and screen surfaces use `thesisPress` with `indication = null` instead (section 4.4).
 */
@Immutable
private object ThesisRippleTheme : RippleTheme {
    @Composable
    override fun defaultColor(): Color = LocalThesisPalette.current.ink

    @Composable
    override fun rippleAlpha(): RippleAlpha {
        val a = pressTintAlpha(LocalThesisPalette.current)
        return RippleAlpha(draggedAlpha = a, focusedAlpha = a, hoveredAlpha = a, pressedAlpha = a)
    }
}

/**
 * Provides [palette] as [LocalThesisPalette] together with the matching Material3 theme (scheme, type, shapes),
 * the ink press tint for M3 ripples and `LocalContentColor = ink`. [ThesisTheme] uses it at the root; HeroBand
 * uses it with `heroOf(p)` so M3 Switch, TextField, default Icon tint and press tint are right inside the band.
 */
@Composable
fun ThesisMaterialTheme(palette: ThesisPalette, content: @Composable () -> Unit) {
    val scheme = remember(palette) { schemeOf(palette) }
    CompositionLocalProvider(LocalThesisPalette provides palette) {
        MaterialTheme(colorScheme = scheme, typography = ThesisTypography, shapes = ThesisMaterialShapes) {
            CompositionLocalProvider(
                LocalRippleTheme provides ThesisRippleTheme,
                LocalContentColor provides palette.ink,
                content = content,
            )
        }
    }
}

/**
 * The app theme (docs/app-redesign/DESIGN-DIRECTION.md, section 2).
 *
 * Provides [LocalThesisPalette] (light paper or dark graphite, with [upDown] resolved), the full Material3 bridge,
 * [LocalReducedMotion] and the system-bar icon appearance. The default [mode] is [ThemeMode.Dark] until PR-3
 * passes the rubric in both themes (spec Q2). [reduceMotion] is the in-app toggle; the theme ORs it with the
 * system animator scale (0 = "Remove animations"), so [LocalReducedMotion] is true for either (section 4.8).
 *
 * The activity draws edge to edge (`enableEdgeToEdge()` in MainActivity, 5.1): the bars stay transparent and
 * only their icon appearance follows the palette ([SystemBarAppearance], ui/platform). [statusBarOverHero]: a
 * HeroBand at rest is under the status bar (the shell or a pre-login surface reports it, 2.7), so the status bar's
 * icons turn light in both themes; the navigation bar keeps the theme's.
 */
@Composable
fun ThesisTheme(
    mode: ThemeMode = ThemeMode.Dark,
    upDown: UpDownScheme = UpDownScheme.Classic,
    reduceMotion: Boolean = false,
    statusBarOverHero: Boolean = false,
    content: @Composable () -> Unit
) {
    val dark = when (mode) {
        ThemeMode.Dark -> true
        ThemeMode.Light -> false
        ThemeMode.System -> isSystemInDarkTheme()
    }
    val palette = remember(dark, upDown) { (if (dark) InkDark else PaperLight).withUpDown(upDown) }
    // The Android window calls live in ui/platform (section 4 preamble: android.* only there).
    SystemBarAppearance(light = palette.isLight, statusBarLight = palette.isLight && !statusBarOverHero)

    val reduced = reduceMotion || rememberSystemReducedMotion()
    CompositionLocalProvider(LocalReducedMotion provides reduced) {
        ThesisMaterialTheme(palette = palette, content = content)
    }
}
