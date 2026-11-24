package com.thesis.mobile.preview

import androidx.compose.foundation.layout.PaddingValues
import com.thesis.mobile.ui.screens.HomeScreen
import com.thesis.mobile.ui.screens.LoginScreen
import com.thesis.mobile.ui.screens.WelcomeScreen
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Sample renders. Add one @Test (or one renderScreen call) per screen/state you want to review.
 * Run: gradle -p apps/mobile/android/design-preview test  (PNGs in design-preview/build/screens)
 */
class SampleScreensTest {

    @Test
    fun welcome() {
        renderScreen("welcome") { WelcomeScreen(onContinue = {}) }.forEach { assertTrue(it.length() > 0) }
    }

    @Test
    fun login() {
        renderScreen("login") {
            LoginScreen(isLoading = false, message = null, onLogin = { _, _ -> }, onRegisterClick = {})
        }
    }

    @Test
    fun homeEmpty() {
        renderScreen("home-empty") {
            HomeScreen(
                pulse = null,
                pulseLoadedFromCache = false,
                pulseFreshnessText = null,
                sentimentCurrent = null,
                sentimentHistory = emptyList(),
                sentimentError = null,
                watchlist = listOf("AAPL", "MSFT", "NVDA"),
                monitorSnapshots = emptyList(),
                padding = PaddingValues(),
                onOpenHistory = {},
                onRunDeepDive = {},
                onManageNames = {},
                onRetryPulse = {},
                onOpenMacroStressDashboard = {},
                onOpenWeeklyDigest = {},
                onOpenPulseBrief = {},
            )
        }
    }

    @Test
    fun welcomeFirstFrame() {
        // Motion check: the same screen at t=0 (before entrance animations run).
        renderScreen("welcome-t0", themes = listOf(PreviewTheme.DARK), settleMs = 0) { WelcomeScreen(onContinue = {}) }
    }
}
