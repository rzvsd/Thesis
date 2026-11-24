package com.thesis.mobile.ui.shell

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import com.thesis.mobile.ui.navigation.Destination
import com.thesis.mobile.ui.navigation.warRoomsInEarningsWindow
import com.thesis.mobile.ui.screens.DeepDiveScreen
import com.thesis.mobile.ui.screens.DeepDiveWebPageAccess
import com.thesis.mobile.ui.screens.HistoryScreen
import com.thesis.mobile.ui.screens.HomeScreen
import com.thesis.mobile.ui.screens.InboxScreen
import com.thesis.mobile.ui.screens.NamesScreen
import com.thesis.mobile.ui.screens.PaywallScreen
import com.thesis.mobile.ui.screens.PulseScreen
import com.thesis.mobile.ui.screens.ResearchScreen
import com.thesis.mobile.ui.screens.ScenarioStressScreen
import com.thesis.mobile.ui.screens.SettingsScreen
import com.thesis.mobile.ui.screens.WarRoomScreen
import com.thesis.mobile.ui.screens.WeeklyDigestScreen
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography
import kotlinx.coroutines.delay

/** How often an open War Room refreshes itself (5.5 "War Room auto-refresh"). */
internal const val WAR_ROOM_REFRESH_MS = 2 * 60 * 1000L

/**
 * The screen for one stack entry. [padding] is the shell scaffold's inner padding (bars and system insets);
 * screens that take no padding parameter are padded here.
 */
@Composable
internal fun ShellContentScope.Content(entry: NavEntry, padding: PaddingValues) {
    when (val destination = entry.destination) {
        Destination.Today -> TodayRoot(padding)
        Destination.Names -> NamesScreen(
            padding = padding,
            watchlist = state.watchlist,
            monitorSnapshots = state.monitorSnapshots,
            alerts = state.alertLedger,
            focusTicker = navigator.namesFocusTicker,
            onRefresh = actions::onRefreshNames,
            onAddTicker = actions::onAddName,
            onRemoveTicker = actions::onRemoveName,
            warRoomByTicker = warRoomsInEarningsWindow(state.alertLedger),
            onOpenWarRoom = actions::onOpenWarRoom,
            onImportHoldingsCsv = { csv -> actions.onImportHoldingsCsv(csv) },
            onRunDeepDive = actions::onRunDeepDive,
            onOpenResearch = actions::onOpenResearchFor
        )
        Destination.Research -> ResearchScreen(
            ticker = state.selectedTicker.orEmpty(),
            recentHistory = state.reportHistory,
            watchlist = state.watchlist,
            errorMessage = state.deepDiveError,
            onTickerChange = actions::onTickerChange,
            onRunReport = { actions.onRunDeepDive(state.selectedTicker.orEmpty()) },
            onOpenReport = { reportId -> actions.onOpenReport(reportId) },
            onOpenPulse = { date -> actions.onOpenPulse(date) },
            padding = padding
        )
        Destination.Inbox -> InboxScreen(
            padding = padding,
            alerts = state.alertLedger,
            inboxError = state.inboxError,
            onRefresh = actions::onRefreshInbox,
            onOpenAlert = actions::onOpenAlert,
            onUnlockDetail = { actions.onRequireUpgrade("filing_change_detail") },
            onSubmitFeedback = actions::onSubmitAlertFeedback,
            onQuietAlertType = actions::onMuteAlert,
            onDisableAlertType = { type -> actions.onSetNotificationPreference(type, false) }
        )
        is Destination.Pulse -> Box(Modifier.padding(padding)) {
            PulseScreen(
                pulse = state.pulseReport,
                watchlist = state.watchlist,
                onBack = { actions.onBack() },
                onRunDeepDive = actions::onRunDeepDive,
                onExportPdf = platform.exportPulsePdf,
                onRefresh = actions::onRefreshPulse
            )
        }
        Destination.MacroStress -> Box(Modifier.padding(padding)) {
            platform.macroStressDashboard { actions.onBack() }
        }
        is Destination.WeeklyDigest -> Box(Modifier.padding(padding)) {
            WeeklyDigestScreen(
                digestDate = destination.date,
                sentimentCurrent = state.sentimentCurrent,
                watchlist = state.watchlist,
                monitorSnapshots = state.monitorSnapshots,
                pulse = state.pulseReport,
                onOpenDashboard = actions::onOpenMacroStress,
                onBack = { actions.onBack() }
            )
        }
        is Destination.History -> Box(Modifier.padding(padding)) {
            HistoryScreen(
                historyItems = state.reportHistory,
                onBack = { actions.onBack() },
                onOpenReport = actions::onOpenHistoryItem
            )
        }
        is Destination.Report -> ReportEntry(destination.reportId, classic = false, padding = padding)
        is Destination.ReportClassic -> ReportEntry(destination.reportId, classic = true, padding = padding)
        is Destination.DeepDiveRunning -> DeepDiveScreenFor(
            report = null,
            isLoading = state.isDeepDiveRunning || state.deepDiveError == null,
            padding = padding,
            classic = false
        )
        is Destination.WarRoom -> {
            val id = destination.warRoomId
            LaunchedEffect(entry.entryId) {
                if (id != null && state.warRoom?.warRoomId != id) actions.onEnsureWarRoom(id)
                while (true) {
                    delay(WAR_ROOM_REFRESH_MS)
                    actions.onRefreshWarRoom()
                }
            }
            WarRoomScreen(
                warRoom = state.warRoom?.takeIf { id == null || it.warRoomId == id },
                errorMessage = state.warRoomError,
                onRefresh = actions::onRefreshWarRoom,
                padding = padding
            )
        }
        is Destination.ScenarioStress -> Box(Modifier.padding(padding)) {
            ScenarioStressScreen(
                userTier = state.userProfile?.tier,
                templates = state.scenarioStressTemplates,
                selectedScenarioId = state.selectedScenarioStressId,
                run = state.scenarioStressRun,
                templatesError = state.scenarioStressTemplatesError,
                runError = state.scenarioStressRunError,
                isLoadingTemplates = state.isLoadingScenarioStressTemplates,
                isRunning = state.isRunningScenarioStress,
                watchlistCount = state.watchlist.size,
                onRefreshTemplates = actions::onRefreshScenarioTemplates,
                onSelectTemplate = actions::onSelectScenarioTemplate,
                onRunScenario = actions::onRunScenarioStress,
                onOpenTickerResearch = actions::onRunDeepDive,
                onOpenRunFromRoute = actions::onOpenScenarioRun,
                onRequireUpgrade = actions::onRequireUpgrade
            )
        }
        Destination.You, is Destination.YouPage -> SettingsScreen(
            padding = padding,
            currentApiBaseUrl = state.apiBaseUrl,
            profile = state.userProfile,
            convictionInsights = state.convictionInsights,
            convictionInsightsError = state.convictionInsightsError,
            subscriptionOffers = state.subscriptionOffers,
            subscriptionActionInFlight = state.subscriptionActionInFlight,
            notificationsEnabled = state.notificationsEnabled,
            biometricSupported = state.biometricSupported,
            biometricLockEnabled = state.biometricLockEnabled,
            notificationPreferences = state.notificationPreferences,
            onSetNotifications = actions::onSetNotificationsEnabled,
            onSetBiometricLockEnabled = actions::onSetBiometricLock,
            onSetNotificationPreference = actions::onSetNotificationPreference,
            onSaveApiBaseUrl = actions::onSaveApiBaseUrl,
            onSyncTier = actions::onSyncTier,
            onRefreshConvictionInsights = actions::onRefreshConvictionInsights,
            onRequireUpgrade = actions::onRequireUpgrade,
            onRefreshOffers = actions::onRefreshOffers,
            onStartPurchase = { type -> platform.startPurchase?.invoke(type) },
            onRestorePurchases = actions::onRestorePurchases,
            onSubmitSubscriptionFeedback = actions::onSubmitSubscriptionFeedback,
            onLogout = actions::onLogout,
            onOpenSystemNotificationSettings = platform.openSystemNotificationSettings,
            canStartPurchase = platform.startPurchase != null,
            showDeveloperOptions = platform.showDeveloperOptions,
            deleteAccountSection = platform.deleteAccountSection
        )
        // Search (WP-E) is not built yet: the modal offers the ticker search of the Research root.
        Destination.Search -> ResearchScreen(
            ticker = state.selectedTicker.orEmpty(),
            recentHistory = state.reportHistory,
            watchlist = state.watchlist,
            errorMessage = null,
            onTickerChange = actions::onTickerChange,
            onRunReport = { actions.onRunDeepDive(state.selectedTicker.orEmpty()) },
            onOpenReport = { reportId -> actions.onOpenReport(reportId) },
            onOpenPulse = { date -> actions.onOpenPulse(date) },
            padding = padding
        )
        is Destination.Paywall -> PaywallScreen(
            alerts = state.alertLedger,
            watchlist = state.watchlist,
            offers = state.subscriptionOffers,
            actionInFlight = state.subscriptionActionInFlight,
            onPurchase = { type -> platform.startPurchase?.invoke(type) },
            onRestore = actions::onRestorePurchases,
            onRefreshOffers = actions::onRefreshOffers,
            onDismiss = { actions.onBack() }
        )
        // Name, Compare reports and Compare names are drawn by WP-B and WP-E in PR-3. Until then the entry
        // exists (links and the codec work) and says what it will show.
        is Destination.Name -> PendingScreen(
            padding,
            destination.ticker,
            state.nameDetail?.takeIf { it.ticker.equals(destination.ticker, ignoreCase = true) }?.let { detail ->
                listOfNotNull(
                    detail.snapshot?.let { "${it.state} · score ${"%.0f".format(it.score)}" },
                    detail.summary?.verdict,
                    "${detail.notesTrail.count { it.text.isNotBlank() }} notes · ${detail.reports.size} reports"
                )
            }.orEmpty()
        )
        is Destination.CompareReports -> PendingScreen(padding, "Compare reports", emptyList())
        is Destination.CompareNames -> PendingScreen(padding, destination.tickers.joinToString(" · "), emptyList())
    }
}

@Composable
private fun ShellContentScope.TodayRoot(padding: PaddingValues) {
    val showSample = !sampleDismissed &&
        state.watchlistLoaded && state.watchlist.isEmpty() &&
        state.reportHistoryLoaded && state.reportHistory.isEmpty()
    if (showSample) {
        platform.sampleDeepDive(
            padding,
            {
                onDismissSample()
                actions.onSelectTab(com.thesis.mobile.ui.navigation.ShellTab.Names)
            },
            onDismissSample
        )
        return
    }
    HomeScreen(
        pulse = state.pulseReport,
        pulseLoadedFromCache = state.pulseLoadedFromCache,
        pulseFreshnessText = state.pulseFreshnessText,
        sentimentCurrent = state.sentimentCurrent,
        sentimentHistory = state.sentimentHistory,
        sentimentError = state.sentimentError,
        watchlist = state.watchlist,
        monitorSnapshots = state.monitorSnapshots,
        morningBriefing = state.alertLedger.firstOrNull { it.notificationType == "morning_exception_briefing" },
        padding = padding,
        lastViewedReport = state.lastViewedReport,
        pulseError = state.pulseError,
        onOpenHistory = actions::onOpenHistory,
        onRunDeepDive = actions::onRunDeepDive,
        onManageNames = { actions.onSelectTab(com.thesis.mobile.ui.navigation.ShellTab.Names) },
        onRetryPulse = actions::onRefreshPulse,
        onOpenMacroStressDashboard = actions::onOpenMacroStress,
        onOpenWeeklyDigest = { actions.onOpenWeeklyDigest(state.sentimentCurrent?.marketDate) },
        onOpenPulseBrief = { actions.onOpenPulse(null) },
        onOpenMorningBriefing = actions::onOpenAlert,
        onResumeLastViewed = actions::onResumeLastViewed,
        onDismissResume = actions::onDismissResumeCard
    )
}

/**
 * A `Report(id)` entry. The ViewModel holds one open report; when it holds another one (after a recreate, or a
 * second report opened on another tab) the entry asks for its own once.
 */
@Composable
private fun ShellContentScope.ReportEntry(reportId: String, classic: Boolean, padding: PaddingValues) {
    val report = state.deepDiveReport?.takeIf { it.reportId == reportId }
    LaunchedEffect(reportId) {
        if (state.deepDiveReport?.reportId != reportId && !state.isOpeningReport) actions.onEnsureReport(reportId)
    }
    DeepDiveScreenFor(
        report = report,
        isLoading = report == null && (state.isOpeningReport || state.deepDiveError == null),
        padding = padding,
        classic = classic
    )
}

@Composable
private fun ShellContentScope.DeepDiveScreenFor(
    report: com.thesis.mobile.model.DeepDiveReportView?,
    isLoading: Boolean,
    padding: PaddingValues,
    classic: Boolean
) {
    DeepDiveScreen(
        report = report,
        isLoading = isLoading,
        errorMessage = state.deepDiveError,
        tickerState = state.selectedTicker.orEmpty(),
        recentHistory = state.reportHistory,
        watchlist = state.watchlist,
        onTickerChange = actions::onTickerChange,
        onRunReport = { actions.onRunDeepDive(state.selectedTicker.orEmpty()) },
        userTier = state.userProfile?.tier,
        reportNoteDraft = state.reportNoteDraft,
        noteUpdatedAt = state.reportNote?.updatedAt,
        isSavingNote = state.isSavingNote,
        convictionTimeline = state.convictionTimeline,
        convictionTimelineError = state.convictionTimelineError,
        oppositeCase = state.oppositeCase,
        oppositeCaseError = state.oppositeCaseError,
        isGeneratingOppositeCase = state.isGeneratingOppositeCase,
        onReportNoteChange = actions::onReportNoteChange,
        onSaveReportNote = actions::onSaveReportNote,
        onGenerateOppositeCase = actions::onGenerateOppositeCase,
        onRefreshConvictionTimeline = actions::onRefreshConviction,
        scenarioResult = state.scenarioResult,
        isRunningScenario = state.isRunningScenario,
        onRunScenario = actions::onRunScenario,
        onRequireUpgrade = actions::onRequireUpgrade,
        onSubmitReportFeedback = actions::onSubmitReportFeedback,
        onNotify = actions::onNotify,
        onOpenHistoryReport = { reportId -> actions.onOpenReport(reportId) },
        onOpenPulseHistory = { date -> actions.onOpenPulse(date) },
        onOpenScenarioStress = actions::onOpenScenarioStress,
        webPage = if (classic) null else DeepDiveWebPageAccess(
            apiBaseUrl = state.apiBaseUrl,
            accessToken = state.tokens?.accessToken,
            reportLoadedFromCache = state.deepDiveLoadedFromCache,
            isPaywallOpen = !state.paywallFeature.isNullOrBlank(),
            refreshAccessToken = actions::onRefreshPageToken
        ),
        onBack = { actions.onBack() },
        padding = padding
    )
}

/** Placeholder body for destinations whose screens land in PR-3 (title and what is already known). */
@Composable
private fun PendingScreen(padding: PaddingValues, title: String, lines: List<String>) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding)
            .padding(horizontal = ThesisDimens.ScreenPaddingHorizontal, vertical = ThesisDimens.SpacingLg),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
    ) {
        Text(title, style = ThesisTypography.headlineSmall, color = ThesisColors.TextPrimary)
        lines.forEach { Text(it, style = ThesisTypography.bodyMedium, color = ThesisColors.TextSecondary) }
    }
}
