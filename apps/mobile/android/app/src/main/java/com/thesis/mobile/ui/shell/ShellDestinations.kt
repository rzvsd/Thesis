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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.thesis.mobile.ui.navigation.DeepLinkRouter
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

/** How often an open War Room refreshes itself while Live (5.19: every 60 s, only while Live and resumed). */
internal const val WAR_ROOM_REFRESH_MS = 60_000L

/** `WarRoomView.status` of a room whose earnings call is under way (`earningsWarRoomStates` "live"). */
private const val WAR_ROOM_LIVE = "live"

/**
 * The screen for one stack entry. [padding] is the entry's own inner padding (its top bar, the bottom bar when
 * its destination shows it, and system insets); screens that take no padding parameter are padded here.
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
        // A build or an open always pushes its own entry (DeepDiveRunning, Report), which shows its error; the
        // root keeps its field and recent list whatever the shared deepDiveError says (same as Search).
        Destination.Research -> ResearchScreen(
            ticker = state.selectedTicker.orEmpty(),
            recentHistory = state.reportHistory,
            onTickerChange = actions::onTickerChange,
            onRunReport = { actions.onRunDeepDive(state.selectedTicker.orEmpty()) },
            onOpenReport = { reportId -> actions.onOpenReport(reportId) },
            onOpenPulse = { date -> actions.onOpenPulse(date) },
            padding = padding,
            // History on the Research stack (5.12 "See all"); the root lists only the three latest.
            onSeeAllHistory = actions::onOpenHistory
        )
        Destination.Inbox -> InboxScreen(
            padding = padding,
            alerts = state.alertLedger,
            inboxError = state.inboxError,
            onRefresh = actions::onRefreshInbox,
            onOpenAlert = actions::onOpenAlert,
            // An alert whose route only lands back on Inbox has nothing to open (5.5 race fixes, audit A).
            canOpenAlert = DeepLinkRouter::alertHasDestination,
            onUnlockDetail = { actions.onRequireUpgrade("filing_change_detail") },
            onSubmitFeedback = actions::onSubmitAlertFeedback,
            onQuietAlertType = actions::onMuteAlert,
            onDisableAlertType = { type -> actions.onSetNotificationPreference(type, false) }
        )
        is Destination.Pulse -> Box(Modifier.padding(padding)) {
            // Like Report(id) and WarRoom(id): a restored or revisited entry asks for its issue again (its day, or the
            // latest when a past day replaced it). Only while it is the top entry, so the entry under a predictive-back
            // preview does not load early.
            val onTop = navigator.tabTop.entryId == entry.entryId
            LaunchedEffect(entry.entryId, onTop) {
                if (onTop) actions.onEnsurePulse(destination.date)
            }
            PulseScreen(
                pulse = state.pulseReport,
                watchlist = state.watchlist,
                onBack = { actions.onBack() },
                onRunDeepDive = actions::onRunDeepDive,
                onExportPdf = platform.exportPulsePdf,
                // A dated entry refreshes its own day: the latest issue would replace it under a header naming
                // another date.
                onRefresh = {
                    val day = destination.date
                    if (day != null) actions.onReloadPulse(day) else actions.onRefreshPulse()
                }
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
        is Destination.Report -> ReportEntry(entry, destination.reportId, classic = false, padding = padding)
        is Destination.ReportClassic -> ReportEntry(entry, destination.reportId, classic = true, padding = padding)
        // Loading only while this entry's own build runs. MainViewModel drops a running entry restored after its
        // job ended (dropIdleRunningEntries); should one still show with no job, it shows its build's error (or
        // that the build is no longer running) with a retry, instead of spinning forever. Another name's build
        // (started from another tab after this one ended) never shows here: neither its progress nor its error.
        // Retry always builds this entry's ticker, never the shared selectedTicker (the Research field).
        is Destination.DeepDiveRunning -> {
            val own = state.deepDiveBuildTicker?.equals(destination.ticker, ignoreCase = true) == true
            DeepDiveScreenFor(
                report = null,
                isLoading = own && state.isDeepDiveRunning,
                errorMessage = (if (own) state.deepDiveError else null) ?: buildEndedMessage(destination.ticker),
                padding = padding,
                classic = false,
                onRetry = { actions.onRetryDeepDive(destination.ticker) }
            )
        }
        is Destination.WarRoom -> {
            val id = destination.warRoomId
            val warRoom = state.warRoom?.takeIf { id == null || it.warRoomId == id }
            LaunchedEffect(entry.entryId) {
                if (id != null && state.warRoom?.warRoomId != id) actions.onEnsureWarRoom(id)
            }
            // Auto-refresh (5.19): every 60 s, only while the room is Live, this entry is the visible top (no
            // modal over it) and the Activity is resumed. Leaving any of those cancels the loop; coming back
            // starts a new one. Silent: no "loaded" snackbar and no paywall from a background refresh.
            val refreshing = warRoom?.status.equals(WAR_ROOM_LIVE, ignoreCase = true) &&
                platform.isResumed &&
                navigator.tabTop.entryId == entry.entryId &&
                navigator.modalStack.isEmpty()
            LaunchedEffect(entry.entryId, refreshing) {
                while (refreshing) {
                    delay(WAR_ROOM_REFRESH_MS)
                    actions.onAutoRefreshWarRoom()
                }
            }
            WarRoomScreen(
                warRoom = warRoom,
                errorMessage = state.warRoomError,
                onRefresh = actions::onRefreshWarRoom,
                padding = padding
            )
        }
        is Destination.ScenarioStress -> Box(Modifier.padding(padding)) {
            // Like WarRoom(id): a restored entry (process death skips the Research tab refresh for 5 minutes)
            // loads its templates and the run it was opened on. Keyed on the tier as well, because the profile
            // (and with it Pro) arrives after the restore; a free tier asks for nothing (no paywall from here).
            val isPro = state.userProfile?.tier.equals(PRO_TIER, ignoreCase = true)
            LaunchedEffect(entry.entryId, isPro) {
                if (isPro) actions.onEnsureScenarioStress(destination.runId, destination.scenarioId)
            }
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
            deleteAccountSection = platform.deleteAccountSection,
            appearance = state.appearance,
            onSetAppearance = actions::onSetAppearance
        )
        // Search (WP-E) is not built yet: the modal offers the ticker search of the Research root.
        Destination.Search -> ResearchScreen(
            ticker = state.selectedTicker.orEmpty(),
            recentHistory = state.reportHistory,
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
        // exists (links and the codec work) and shows the title plus the last verdict sentence when one is
        // known. No raw state enums or ad-hoc number formats, even here (WP-B formats them through Fmt).
        is Destination.Name -> PendingScreen(
            padding,
            destination.ticker,
            listOfNotNull(
                state.nameDetail
                    ?.takeIf { it.ticker.equals(destination.ticker, ignoreCase = true) }
                    ?.summary?.verdict?.takeIf { it.isNotBlank() }
            )
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
 * A `Report(id)` entry. The ViewModel holds one open report; when it holds another one (after a recreate, a
 * second report opened on another tab, or a build started from a screen pushed over this one) the entry asks
 * for its own again.
 *
 * The base layer keeps a report composed under pushed screens, so a key on `reportId` alone is not enough: the
 * effect also re-runs when the entry comes back on top, when the held report changes, and when an open
 * finishes. It asks only while the entry is on top and no open is in flight, and at most once per held report,
 * so a failed open shows its error (with a retry that opens this report again) instead of retrying in a loop.
 */
@Composable
private fun ShellContentScope.ReportEntry(entry: NavEntry, reportId: String, classic: Boolean, padding: PaddingValues) {
    val report = state.deepDiveReport?.takeIf { it.reportId == reportId }
    val onTop = navigator.tabTop.entryId == entry.entryId
    val heldId = state.deepDiveReport?.reportId
    var askedWhileHolding by remember(reportId) { mutableStateOf<String?>(NOT_ASKED) }
    LaunchedEffect(reportId, onTop, heldId, state.isOpeningReport) {
        if (onTop && heldId != reportId && !state.isOpeningReport && askedWhileHolding != (heldId ?: NONE_HELD)) {
            askedWhileHolding = heldId ?: NONE_HELD
            actions.onEnsureReport(reportId)
        }
    }
    DeepDiveScreenFor(
        report = report,
        isLoading = report == null && (state.isOpeningReport || state.deepDiveError == null),
        errorMessage = state.deepDiveError,
        padding = padding,
        classic = classic,
        // The error card's button opens this stored report again; it never starts a new build (principle 11).
        onRetry = { actions.onEnsureReport(reportId) },
        retryLabel = OPEN_REPORT_AGAIN
    )
}

/** `UserProfileView.tier` of a Pro subscriber (as `MainViewModel.isProTier`). */
private const val PRO_TIER = "PRO"

/** A `DeepDiveRunning(ticker)` entry whose own build is not the one running or last run. */
private fun buildEndedMessage(ticker: String): String = "The ${ticker.uppercase()} Deep Dive is no longer running."

/** The failed report entry's button says what it does: open the stored report again (principle 11). */
private const val OPEN_REPORT_AGAIN = "Open report again"

private const val NOT_ASKED = "\u0000not-asked"
private const val NONE_HELD = "\u0000none"


@Composable
private fun ShellContentScope.DeepDiveScreenFor(
    report: com.thesis.mobile.model.DeepDiveReportView?,
    isLoading: Boolean,
    errorMessage: String?,
    padding: PaddingValues,
    classic: Boolean,
    onRetry: () -> Unit,
    retryLabel: String? = null
) {
    DeepDiveScreen(
        report = report,
        isLoading = isLoading,
        errorMessage = errorMessage,
        watchlist = state.watchlist,
        onRetry = onRetry,
        retryLabel = retryLabel,
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
