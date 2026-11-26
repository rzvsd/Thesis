package com.thesis.mobile.preview

import androidx.compose.foundation.layout.PaddingValues
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.IssuerView
import com.thesis.mobile.model.SectionView
import com.thesis.mobile.ui.screens.DeepDiveLoadingScreen
import com.thesis.mobile.ui.screens.DeepDiveScreen
import com.thesis.mobile.ui.screens.HistoryScreen
import com.thesis.mobile.ui.screens.HomeScreen
import com.thesis.mobile.ui.screens.InboxScreen
import com.thesis.mobile.ui.screens.NamesScreen
import com.thesis.mobile.ui.screens.OnboardingScreen
import com.thesis.mobile.ui.screens.PaywallScreen
import com.thesis.mobile.ui.screens.PulseScreen
import com.thesis.mobile.ui.screens.ResearchScreen
import com.thesis.mobile.ui.screens.ScenarioStressScreen
import com.thesis.mobile.ui.screens.WarRoomScreen
import com.thesis.mobile.ui.screens.WeeklyDigestScreen
import org.junit.Test

/**
 * Smoke renders: every screen design-preview compiles, in its no-data state, dark and light (PR-1 exit
 * criteria: "renders of every screen in both themes"). Data-rich states, loading/error states and the
 * 1.3x / 2.0x / 360 dp / full-page variants belong to each screen WP's <Area>Renders.kt (section 6.0 rule 6);
 * the last three tests here show the knobs on Home. Run: render.sh '^smoke-'
 */
class ScreenSmokeRenders {

    private val names = listOf("AAPL", "MSFT", "NVDA")

    @Test fun onboarding() { renderScreen("smoke-onboarding") { OnboardingScreen(onComplete = {}) } }

    @Test
    fun paywall() {
        renderScreen("smoke-paywall") {
            PaywallScreen(
                alerts = emptyList(), watchlist = names, offers = emptyList(), actionInFlight = false,
                onPurchase = {}, onRestore = {}, onRefreshOffers = {}, onDismiss = {},
            )
        }
    }

    @Test fun home() { renderScreen("smoke-home") { HomeEmpty() } }

    @Test
    fun pulse() {
        renderScreen("smoke-pulse") {
            PulseScreen(pulse = null, watchlist = names, onBack = {}, onRunDeepDive = {}, onExportPdf = {}, onRefresh = {})
        }
    }

    @Test
    fun weeklyDigest() {
        renderScreen("smoke-weekly-digest") {
            WeeklyDigestScreen(
                digestDate = null, sentimentCurrent = null, watchlist = names, monitorSnapshots = emptyList(),
                pulse = null, onOpenDashboard = {}, onBack = {},
            )
        }
    }

    @Test
    fun names() {
        renderScreen("smoke-names") {
            NamesScreen(
                padding = PaddingValues(), watchlist = names, monitorSnapshots = emptyList(), alerts = emptyList(),
                onRefresh = {}, onAddTicker = {}, onRemoveTicker = {}, onRunDeepDive = {}, onOpenResearch = {},
                onImportHoldingsCsv = { Result.failure(UnsupportedOperationException("preview")) },
            )
        }
    }

    @Test
    fun research() {
        renderScreen("smoke-research") {
            ResearchScreen(
                ticker = "", recentHistory = emptyList(), onTickerChange = {}, onRunReport = {}, onOpenReport = {},
                onOpenPulse = {}, padding = PaddingValues(),
            )
        }
    }

    /** The open-report path (DeepDiveReportHost, section 5.13) with no web page: the native classic report. */
    @Test
    fun researchReport() {
        val report = DeepDiveReportView(
            reportId = "smoke-report", ticker = "AAPL", generatedAt = "2026-11-20T14:00:00Z",
            issuer = IssuerView(name = "Apple Inc.", exchange = "NASDAQ"),
            thesisStatement = "Services keep growing faster than hardware, so margins hold up through the cycle.",
            signalValue = "positive", confidenceLabel = "medium", confidenceScore = 0.7,
            sections = listOf(
                SectionView(sectionId = "summary", title = "Summary", body = "Revenue grew 6% on Services."),
                SectionView(sectionId = "risks", title = "Risks", body = "China demand and App Store rules."),
            ),
        )
        renderScreen("smoke-research-report") {
            DeepDiveScreen(
                report = report, isLoading = false, errorMessage = null, userTier = "free", reportNoteDraft = "", noteUpdatedAt = null, isSavingNote = false,
                convictionTimeline = emptyList(), convictionTimelineError = null, oppositeCase = null,
                oppositeCaseError = null, isGeneratingOppositeCase = false, onReportNoteChange = {},
                onSaveReportNote = {}, onGenerateOppositeCase = {}, onRefreshConvictionTimeline = {},
                scenarioResult = null, isRunningScenario = false, onRunScenario = { _, _, _ -> },
                onRequireUpgrade = {}, onSubmitReportFeedback = { _, _ -> }, onNotify = {}, watchlist = names,
                onRetry = {}, onBack = {}, padding = PaddingValues(), webPage = null,
            )
        }
    }

    @Test fun deepDiveLoading() { renderScreen("smoke-deep-dive-loading") { DeepDiveLoadingScreen() } }

    @Test
    fun history() {
        renderScreen("smoke-history") { HistoryScreen(historyItems = emptyList(), onBack = {}, onOpenReport = {}) }
    }

    @Test
    fun warRoom() {
        renderScreen("smoke-war-room") {
            WarRoomScreen(warRoom = null, errorMessage = null, onRefresh = {}, padding = PaddingValues())
        }
    }

    @Test
    fun scenarioStress() {
        renderScreen("smoke-scenario-stress") {
            ScenarioStressScreen(
                userTier = "free", templates = emptyList(), selectedScenarioId = null, run = null,
                templatesError = null, runError = null, isLoadingTemplates = false, isRunning = false,
                watchlistCount = names.size, onRefreshTemplates = {}, onSelectTemplate = {}, onRunScenario = {},
                onRequireUpgrade = {},
            )
        }
    }

    @Test
    fun inbox() {
        renderScreen("smoke-inbox") {
            InboxScreen(
                padding = PaddingValues(), alerts = emptyList(), inboxError = null, onRefresh = {}, onOpenAlert = {},
                onUnlockDetail = {}, onSubmitFeedback = { _, _ -> }, onQuietAlertType = {}, onDisableAlertType = {},
            )
        }
    }

    // ---- The section 6.0 rule 6 variants, demonstrated on Home.

    @Test
    fun homeAtTwiceFontSize() {
        renderScreen("smoke-home-fs2", fontScale = 2f, themes = listOf(PreviewTheme.LIGHT)) { HomeEmpty() }
    }

    @Test
    fun homeNarrowReducedMotion() {
        renderScreen(
            "smoke-home-360-reduced", widthDp = PhoneSpec.NARROW_WIDTH_DP, reducedMotion = true,
            themes = listOf(PreviewTheme.DARK),
        ) { HomeEmpty() }
    }

    @Test
    fun homeFullPage() {
        renderScreen("smoke-home-full", heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP, themes = listOf(PreviewTheme.DARK),
            glow = false) { HomeEmpty() }
    }
}

@androidx.compose.runtime.Composable
private fun HomeEmpty() {
    HomeScreen(
        pulse = null, pulseLoadedFromCache = false, sentimentCurrent = null,
        sentimentHistory = emptyList(), sentimentError = null, watchlist = listOf("AAPL", "MSFT", "NVDA"),
        monitorSnapshots = emptyList(), padding = PaddingValues(),
        onManageNames = {}, onRetryPulse = {}, onOpenMacroStressDashboard = {},
        onOpenPulseBrief = {},
    )
}
