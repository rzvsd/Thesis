package com.thesis.mobile.ui.theme

import android.app.Activity
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
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

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
internal fun pressTintAlpha(p: ThesisPalette): Float = if (p.isLight) 0.06f else 0.08f

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
 * [LocalReducedMotion] and the system-bar appearance. The default [mode] is [ThemeMode.Dark] until PR-3 passes
 * the rubric in both themes (spec Q2). [reduceMotion] is the combined value (system animator scale 0 or the
 * in-app toggle), computed by the caller.
 *
 * [edgeToEdge]: when the activity draws behind the system bars, the bars are left transparent and only their
 * icon appearance is set; otherwise both bars are painted `bg`.
 */
@Composable
fun ThesisTheme(
    mode: ThemeMode = ThemeMode.Dark,
    upDown: UpDownScheme = UpDownScheme.Classic,
    reduceMotion: Boolean = false,
    edgeToEdge: Boolean = false,
    content: @Composable () -> Unit
) {
    val dark = when (mode) {
        ThemeMode.Dark -> true
        ThemeMode.Light -> false
        ThemeMode.System -> isSystemInDarkTheme()
    }
    val palette = remember(dark, upDown) { (if (dark) InkDark else PaperLight).withUpDown(upDown) }
    val view = LocalView.current

    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            val barColor = if (edgeToEdge) Color.Transparent else palette.bg
            window.statusBarColor = barColor.toArgb()
            window.navigationBarColor = barColor.toArgb()
            val controller = WindowCompat.getInsetsController(window, view)
            controller.isAppearanceLightStatusBars = palette.isLight
            controller.isAppearanceLightNavigationBars = palette.isLight
        }
    }

    CompositionLocalProvider(LocalReducedMotion provides reduceMotion) {
        ThesisMaterialTheme(palette = palette, content = content)
    }
}

/**
 * The pre-v2 signature, kept so existing callers (design-preview's RenderScreen.kt) compile.
 * Same selection as before: the light theme is used only when `darkTheme = false` and `dynamicColor = true`.
 * `darkTheme` has no default so that `ThesisTheme { }` resolves to the v2 overload.
 */
@Deprecated(
    "Use ThesisTheme(mode, upDown, reduceMotion)",
    ReplaceWith("ThesisTheme(mode = if (darkTheme) ThemeMode.Dark else ThemeMode.Light, content = content)")
)
@Composable
fun ThesisTheme(
    darkTheme: Boolean,
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    ThesisTheme(
        mode = if (darkTheme || !dynamicColor) ThemeMode.Dark else ThemeMode.Light,
        content = content
    )
}
