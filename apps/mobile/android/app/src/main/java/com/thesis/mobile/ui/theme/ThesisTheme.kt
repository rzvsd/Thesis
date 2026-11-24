package com.thesis.mobile.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val ThesisDarkColorScheme = darkColorScheme(
    primary = ThesisColors.Primary,
    onPrimary = ThesisColors.TextInverse,
    secondary = ThesisColors.PrimaryHover,
    onSecondary = ThesisColors.TextInverse,
    tertiary = ThesisColors.Primary,
    onTertiary = ThesisColors.TextInverse,
    background = ThesisColors.Background,
    onBackground = ThesisColors.TextPrimary,
    surface = ThesisColors.Surface,
    onSurface = ThesisColors.TextPrimary,
    surfaceVariant = ThesisColors.SurfaceElevated,
    onSurfaceVariant = ThesisColors.TextSecondary,
    outline = ThesisColors.Border,
    outlineVariant = ThesisColors.BorderSubtle,
    error = ThesisColors.Error,
    onError = ThesisColors.OnError
)

private val ThesisLightColorScheme = lightColorScheme(
    primary = ThesisColors.Primary,
    onPrimary = ThesisColors.TextInverse,
    secondary = ThesisColors.PrimaryHover,
    onSecondary = ThesisColors.TextInverse,
    tertiary = ThesisColors.Primary,
    onTertiary = ThesisColors.TextInverse,
    background = ThesisColors.LightBackground,
    onBackground = ThesisColors.TextPrimaryLight,
    surface = ThesisColors.LightSurface,
    onSurface = ThesisColors.TextPrimaryLight,
    error = ThesisColors.Error,
    onError = ThesisColors.OnError
)

/** Light or dark. [System] follows the device setting. */
enum class ThemeMode { System, Light, Dark }

/**
 * True when motion should be reduced: the system animator scale is 0 or the in-app "Reduce motion" toggle
 * is on (section 4.8). Provided by [ThesisTheme]; this is its only definition.
 */
val LocalReducedMotion = staticCompositionLocalOf { false }

/**
 * The app theme.
 *
 * Day-0 API stub of the v2 signature (docs/app-redesign/DESIGN-DIRECTION.md, section 2): it provides
 * [LocalThesisPalette] (with [upDown] resolved) and [LocalReducedMotion], and keeps the shipped Material
 * colour schemes, so screens look exactly as before. The default [mode] is [ThemeMode.Dark], which is what
 * the app ships today. F1 completes it (full M3 bridge, system bars per mode).
 */
@Composable
fun ThesisTheme(
    mode: ThemeMode = ThemeMode.Dark,
    upDown: UpDownScheme = UpDownScheme.Classic,
    reduceMotion: Boolean = false,
    content: @Composable () -> Unit
) {
    val dark = when (mode) {
        ThemeMode.Dark -> true
        ThemeMode.Light -> false
        ThemeMode.System -> isSystemInDarkTheme()
    }
    val palette = (if (dark) InkDark else PaperLight).withUpDown(upDown)
    val colorScheme = if (dark) ThesisDarkColorScheme else ThesisLightColorScheme
    val view = LocalView.current

    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.background.toArgb()
            window.navigationBarColor = colorScheme.background.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = false
            WindowCompat.getInsetsController(window, view).isAppearanceLightNavigationBars = false
        }
    }

    CompositionLocalProvider(
        LocalThesisPalette provides palette,
        LocalReducedMotion provides reduceMotion,
    ) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = ThesisTypography,
            content = content
        )
    }
}

/**
 * The pre-v2 signature, kept so existing callers (design-preview's RenderScreen.kt) compile.
 * Same behaviour as before: the light scheme is used only when `darkTheme = false` and `dynamicColor = true`.
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
