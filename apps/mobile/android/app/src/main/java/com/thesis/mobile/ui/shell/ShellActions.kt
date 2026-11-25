package com.thesis.mobile.ui.shell

import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.model.HoldingsImportResultView
import com.thesis.mobile.model.LastViewedReport
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.ui.navigation.ShellTab

/**
 * Every user intent the logged-in shell can raise. `MainViewModel` implements it (it owns the navigator, so an
 * intent both moves the stack and loads the data); design-preview passes `object : ShellActions {}`.
 *
 * Every member has a no-op default so fixtures stay one line. Names do not reuse the ViewModel's older
 * functions (several have default arguments, which an override cannot keep).
 */
interface ShellActions {

    // ---- Navigation

    /** Bottom bar tap: see [AppNavigator.selectTab]; refreshes the tab's data when it is older than 5 minutes. */
    fun onSelectTab(tab: ShellTab) {}

    /** System or toolbar back. False at Today's root (the system then closes the app). */
    fun onBack(): Boolean = false

    fun onOpenYou() {}
    fun onOpenSearch() {}
    fun onCloseModal() {}

    /** An Inbox row, the morning briefing or a notification card: [com.thesis.mobile.ui.navigation.DeepLinkRouter.routeAlert]. */
    fun onOpenAlert(alert: AlertLedgerItemView) {}

    /** Pushes `Report(reportId)` and loads it. */
    fun onOpenReport(reportId: String, ticker: String? = null) {}

    /** A `Report(id)` entry is on screen but the ViewModel holds another report (after recreate or a pop). */
    fun onEnsureReport(reportId: String) {}

    /** Pushes `DeepDiveRunning(ticker)` and starts the build; the entry becomes `Report(id)` when it is ready. */
    fun onRunDeepDive(ticker: String) {}

    /**
     * Run again from a `DeepDiveRunning` entry whose build failed: the entry is replaced by a new running entry
     * (no second copy on the stack) and the build starts.
     */
    fun onRetryDeepDive(ticker: String) {}

    /** Research tab root with [ticker] in the field (no build). */
    fun onOpenResearchFor(ticker: String) {}

    fun onOpenHistory() {}

    /** A History row: a Deep Dive opens as a report, a Pulse as `Pulse(date)`. */
    fun onOpenHistoryItem(item: ReportHistoryItem) {}

    /** Pushes `Pulse(date)`; a past date loads that issue and the latest is restored when it is popped. */
    fun onOpenPulse(date: String?) {}

    fun onOpenMacroStress() {}
    fun onOpenWeeklyDigest(date: String?) {}
    fun onOpenWarRoom(warRoomId: String) {}

    /** A `WarRoom(id)` entry is on screen but another War Room (or none) is loaded. */
    fun onEnsureWarRoom(warRoomId: String) {}
    fun onOpenScenarioStress() {}
    fun onOpenName(ticker: String) {}
    fun onResumeLastViewed(report: LastViewedReport) {}
    fun onDismissResumeCard() {}

    // ---- Today

    fun onRefreshPulse() {}
    fun onSelectMacroRange(days: Int) {}
    fun onRefreshMacro() {}

    // ---- Names

    fun onRefreshNames() {}
    fun onAddName(ticker: String) {}
    fun onRemoveName(ticker: String) {}
    suspend fun onImportHoldingsCsv(csv: String): Result<HoldingsImportResultView> =
        Result.failure(UnsupportedOperationException("preview"))

    // ---- Inbox

    fun onRefreshInbox() {}
    fun onSubmitAlertFeedback(alertId: String, feedback: String) {}
    fun onMuteAlert(alertId: String) {}
    fun onMarkInboxSeen() {}

    // ---- Research and the report

    fun onTickerChange(ticker: String) {}
    fun onReportNoteChange(content: String) {}
    fun onSaveReportNote() {}
    fun onGenerateOppositeCase() {}
    fun onRefreshConviction() {}
    fun onRunScenario(years: Int?, growth: Double?, wacc: Double?) {}
    fun onSubmitReportFeedback(code: String, message: String) {}
    fun onNotify(message: String) {}
    fun onRefreshPageToken(onResult: (String?) -> Unit) { onResult(null) }
    fun onRefreshWarRoom() {}

    /** The open War Room's 2-minute auto-refresh (5.5): no "loaded" message, no paywall on failure. */
    fun onAutoRefreshWarRoom() {}
    fun onRefreshScenarioTemplates() {}
    fun onSelectScenarioTemplate(scenarioId: String) {}
    fun onRunScenarioStress(scenarioId: String?) {}
    fun onOpenScenarioRun(runId: String, scenarioId: String?) {}

    // ---- You

    fun onSetNotificationsEnabled(enabled: Boolean) {}
    fun onSetBiometricLock(enabled: Boolean) {}
    fun onSetNotificationPreference(type: String, enabled: Boolean) {}
    fun onSaveApiBaseUrl(url: String) {}
    fun onSyncTier() {}
    fun onRefreshConvictionInsights() {}
    fun onRefreshOffers() {}
    fun onRestorePurchases() {}
    fun onSubmitSubscriptionFeedback(code: String, sourceSurface: String, message: String, promptWinBack: Boolean) {}
    fun onSetAppearance(value: AppearancePrefs) {}
    fun onLogout() {}

    // ---- Paywall and messages

    fun onRequireUpgrade(feature: String) {}
    fun onDismissPaywall() {}
    fun onMessageShown() {}
}

/**
 * What only the Android app can provide: Activity-bound actions and screens that the harness cannot compile
 * (WebView, Vico charts, app assets, `viewModel()`). `ThesisApp` builds the real one; previews use the
 * defaults, which draw nothing.
 */
class ShellPlatform(
    /** Store purchase sheet; null when no Activity is available. */
    val startPurchase: ((preferredType: String?) -> Unit)? = null,
    val exportPulsePdf: () -> Unit = {},
    val openSystemNotificationSettings: () -> Unit = {},
    /** `BuildConfig.DEBUG`: the API base URL switch in You. */
    val showDeveloperOptions: Boolean = false,
    val sampleDeepDive: @androidx.compose.runtime.Composable (
        padding: androidx.compose.foundation.layout.PaddingValues,
        onFollowName: () -> Unit,
        onDismiss: () -> Unit
    ) -> Unit = { _, _, _ -> },
    val macroStressDashboard: @androidx.compose.runtime.Composable (onBack: () -> Unit) -> Unit = {},
    val deleteAccountSection: @androidx.compose.runtime.Composable () -> Unit = {}
)
