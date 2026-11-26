package com.thesis.mobile.preview

import androidx.compose.foundation.layout.PaddingValues
import com.thesis.mobile.ui.screens.HomeScreen
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Sample renders. Add one @Test (or one renderScreen call) per screen/state you want to review.
 * Run: gradle -p apps/mobile/android/design-preview test  (PNGs in design-preview/build/screens)
 */
class SampleScreensTest {

    @Test
    fun homeEmpty() {
        val pngs = renderScreen("home-empty") {
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
                onManageNames = {},
                onRetryPulse = {},
                onOpenMacroStressDashboard = {},
                onOpenPulseBrief = {},
            )
        }
        pngs.forEach { assertTrue(it.length() > 0) }
    }
}
