package com.thesis.mobile.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
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

@Composable
fun ThesisTheme(
    darkTheme: Boolean = true,
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme || !dynamicColor) ThesisDarkColorScheme else ThesisLightColorScheme
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

    MaterialTheme(
        colorScheme = colorScheme,
        typography = ThesisTypography,
        content = content
    )
}
