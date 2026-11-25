package com.thesis.mobile.ui

import android.app.Application
import android.content.Context
import android.app.Activity
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.util.Base64
import android.util.Log
import androidx.biometric.BiometricManager
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.viewModelScope
import com.google.firebase.messaging.FirebaseMessaging
import com.revenuecat.purchases.PackageType
import com.thesis.mobile.billing.RevenueCatBilling
import com.thesis.mobile.data.SessionStore
import com.thesis.mobile.model.AuthTokens
import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.model.ConvictionInsightCardView
import com.thesis.mobile.model.ConvictionJournalEntryView
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.HoldingsImportResultView
import com.thesis.mobile.model.LastViewedReport
import com.thesis.mobile.model.NotificationPreferenceView
import com.thesis.mobile.model.OppositeCaseReportView
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.ReportNoteView
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.model.ScenarioOverridesView
import com.thesis.mobile.model.ScenarioStressRunView
import com.thesis.mobile.model.ScenarioStressTemplateView
import com.thesis.mobile.model.ScenarioResultView
import com.thesis.mobile.model.SentimentSnapshotView
import com.thesis.mobile.model.SubscriptionOfferView
import com.thesis.mobile.model.ThesisMonitorSnapshotView
import com.thesis.mobile.model.TickerSearchItem
import com.thesis.mobile.model.UserProfileView
import com.thesis.mobile.model.WarRoomView
import com.thesis.mobile.model.CompareNamesState
import com.thesis.mobile.model.CompareReportsState
import com.thesis.mobile.model.NameDetailView
import com.thesis.mobile.model.NoteTrailEntry
import com.thesis.mobile.model.ReportSummaryView
import com.thesis.mobile.model.SearchResultsView
import com.thesis.mobile.model.SnapshotDelta
import com.thesis.mobile.model.SnapshotPoint
import com.thesis.mobile.model.TAB_DATA_MAX_AGE_MS
import com.thesis.mobile.model.isFresh
import com.thesis.mobile.model.searchLocal
import com.thesis.mobile.model.snapshotDeltaSince
import com.thesis.mobile.model.toReportSummary
import com.thesis.mobile.ui.navigation.DeepLinkRouter
import com.thesis.mobile.ui.navigation.Destination
import com.thesis.mobile.ui.navigation.LaunchTarget
import com.thesis.mobile.ui.navigation.NavRoute
import com.thesis.mobile.ui.navigation.RouteAction
import com.thesis.mobile.ui.navigation.ShellTab
import com.thesis.mobile.ui.shell.AppNavigator
import com.thesis.mobile.ui.shell.AppearancePrefs
import com.thesis.mobile.ui.shell.DeepDiveStartDecision
import com.thesis.mobile.ui.shell.NavEntry
import com.thesis.mobile.ui.shell.NavigatorStateStore
import com.thesis.mobile.ui.shell.ShellActions
import com.thesis.mobile.ui.shell.decideDeepDiveStart
import com.thesis.mobile.network.ProductApiClient
import com.thesis.mobile.network.ProductApiException
import com.thesis.mobile.observability.MobileTelemetry
import com.thesis.mobile.offline.OfflineCacheStore
import com.thesis.mobile.offline.PrefetchScheduler
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.URI
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

data class PulsePdfDownload(
    val bytes: ByteArray,
    val filename: String
)

/**
 * The app's single ViewModel. It owns the [navigator] (back stacks, persisted in [savedStateHandle] so rotation
 * and the nightly dark-mode switch keep them) and implements [ShellActions]: each user intent moves the stack
 * and loads the data it needs (DESIGN-DIRECTION 4.5, 5.5).
 */
class MainViewModel(
    application: Application,
    savedStateHandle: SavedStateHandle
) : AndroidViewModel(application), ShellActions {
    private val sessionStore = SessionStore(application.applicationContext)

    /** Back stacks for the four tabs and the modal stack. `ThesisShell` renders it; only this class mutates it. */
    val navigator = AppNavigator(SavedStateNavigatorStore(savedStateHandle))
    private val client = ProductApiClient()
    private val cacheStore = OfflineCacheStore.getInstance(application.applicationContext)
    private val telemetry = MobileTelemetry()
    private val installationDistinctId = sessionStore.getInstallationId()

    var state: UiState = UiState(
        showWelcome = !sessionStore.hasSeenWelcome(),
        apiBaseUrl = sessionStore.loadApiBaseUrl(),
        notificationsEnabled = sessionStore.areNotificationsEnabled(),
        biometricSupported = isBiometricSupported(application),
        biometricLockEnabled = sessionStore.isBiometricLockEnabled(),
        tokens = sessionStore.loadTokens(),
        appearance = sessionStore.loadAppearance(),
        lastInboxVisitAtMs = sessionStore.getLastInboxVisitAtMs(),
        lastNamesVisitAtMs = sessionStore.getLastNamesVisitAtMs()
    )
        private set

    /** When each tab's data last loaded (epoch ms); a tab switch skips data younger than 5 minutes (5.5). */
    private val tabFetchedAtMs = mutableMapOf<ShellTab, Long>()

    // Refresh flags: a generation number per single-flight refresh, a counter for parallel ones, so a cancelled
    // older request can never clear the flag of the newer one.
    private var pulseGeneration = 0
    private var macroGeneration = 0
    private var boardInFlight = 0
    private var inboxInFlight = 0
    private var historyInFlight = 0
    private var reportOpenGeneration = 0
    private var searchJob: Job? = null

    private var observer: ((UiState) -> Unit)? = null

    // Deep Dive resume (rebuild M2, DECISIONS.md D3): the in-flight job id survives the screen closing,
    // so polling picks up again when the app reopens. Kept in this file's own small preferences file.
    private val deepDiveResumePrefs = application.applicationContext
        .getSharedPreferences(DEEP_DIVE_RESUME_PREFS, Context.MODE_PRIVATE)
    private var deepDivePoll: Job? = null
    // The job the app follows (one build at a time, decideDeepDiveStart). A poll that is not for this job (an older
    // one still winding down) never publishes the build state or clears the resume prefs of the current one.
    private var activeDeepDiveJobId: String? = null

    // Only one Pulse / macro stress refresh runs at a time: a newer refresh cancels the older one, so a
    // slow or stuck older request can no longer finish late and replace fresh data with the saved copy.
    private var pulseRefreshJob: Job? = null
    private var pulseRememberRequested = false
    // The day the shared Pulse was last asked for (null = the latest issue). A restored Pulse(date) entry compares
    // its date with this (onEnsurePulse) and asks for its day again when the latest replaced it.
    private var pulseRequestedDate: String? = null
    private var macroStressRefreshJob: Job? = null

    // You restored on the modal stack after process death (AppNavigator.restore): its Monthly Coherence card loads
    // only for Pro, and the tier is known only once the profile arrives, so refreshUserProfile loads it then.
    // Declared before init, which sets it.
    private var loadYouInsightsWithProfile = false

    init {
        if (state.tokens != null) {
            loadYouInsightsWithProfile = navigator.modalStack.any { it.destination.isYouEntry() }
            PrefetchScheduler.schedule(getApplication<Application>().applicationContext)
            state = state.copy(lastViewedReport = sessionStore.getLastViewedReport())
            refreshFeatureFlags()
            refreshUserProfile()
            refreshNotificationPreferences()
            refreshSubscriptionOffers()
            refreshPulse()
            refreshMacroStress()
            refreshAlertLedger()
            refreshMonitorSnapshots()
            refreshReportHistory()
            refreshWatchlist()
            viewModelScope.launch {
                syncPushToken()
            }
            resumeDeepDiveIfRunning()
            markAllTabsFetched()
        }
    }

    /** After a full load (start, login) the first tab switches do not fetch the same data again. */
    private fun markAllTabsFetched() {
        val now = System.currentTimeMillis()
        ShellTab.entries.forEach { tabFetchedAtMs[it] = now }
    }

    fun observe(listener: (UiState) -> Unit) {
        observer = listener
        listener(state)
    }

    fun clearMessage() {
        publish(state.copy(message = null, messageAction = null))
    }

    fun notifyUser(message: String) {
        publish(state.copy(message = message))
        if (message.startsWith("Export generated", ignoreCase = true)) {
            trackEvent("export_generated")
        }
    }

    fun completeWelcome() {
        if (state.tokens != null) {
            sessionStore.setHasSeenWelcome(true)
        }
        publish(state.copy(showWelcome = false))
    }

    fun openPulseFromNotification(reportDate: String? = null) {
        if (!reportDate.isNullOrBlank()) {
            loadPulseByDate(reportDate, rememberAsLastViewed = true)
        } else {
            refreshPulse(rememberAsLastViewed = true)
        }
    }

    /**
     * Loads [tab]'s data. A tab switch passes [force] = false: data younger than five minutes is kept and older
     * data refreshes in the background (the screen shows what it has; no spinner replaces it).
     * [skipPulse]: the caller loads the Pulse itself (a route with [RouteAction.OpenPulse]), so the latest issue
     * is not fetched here only to be cancelled.
     */
    private fun refreshTab(tab: ShellTab, force: Boolean, skipPulse: Boolean = false) {
        val now = System.currentTimeMillis()
        if (!force && isFresh(tabFetchedAtMs[tab], now)) return
        tabFetchedAtMs[tab] = now
        when (tab) {
            ShellTab.Today -> {
                if (!skipPulse) refreshPulse()
                refreshMacroStress()
                refreshMonitorSnapshots()
                refreshAlertLedger()
            }
            ShellTab.Names -> {
                refreshWatchlist()
                refreshAlertLedger()
            }
            ShellTab.Research -> {
                refreshReportHistory()
                state.deepDiveReport?.let { refreshConvictionForReport(it) }
                maybeRefreshScenarioStressTemplates()
            }
            ShellTab.Inbox -> refreshAlertLedger()
        }
    }

    private fun refreshYou() {
        refreshWatchlist()
        refreshUserProfile()
        refreshNotificationPreferences()
        refreshConvictionInsights()
    }

    fun updateApiBaseUrl(newUrl: String) {
        val normalized = normalizeApiBaseUrl(newUrl)
        if (normalized == null) {
            publish(
                state.copy(
                    message = "Enter one valid Product API URL, for example http://192.168.1.114:3001"
                )
            )
            return
        }

        sessionStore.saveApiBaseUrl(normalized)
        publish(state.copy(apiBaseUrl = normalized, message = "API base URL saved."))
    }

    fun setNotificationsEnabled(enabled: Boolean) {
        sessionStore.saveNotificationsEnabled(enabled)
        publish(state.copy(notificationsEnabled = enabled))
        trackEvent(
            if (enabled) "notifications_enabled_global" else "notifications_disabled_global",
            mapOf("enabled" to enabled)
        )
        viewModelScope.launch {
            syncPushToken()
        }
    }

    fun trackPushDeepLinkLanded(
        targetTab: String,
        notificationType: String?,
        ticker: String?,
        alertId: String? = null,
        warRoomId: String? = null,
        scenarioId: String? = null,
        scenarioRunId: String? = null
    ) {
        trackEvent(
            "push_deep_link_landed",
            mapOf(
                "target_tab" to targetTab,
                "notification_type" to notificationType,
                "ticker" to ticker,
                "alert_id" to alertId,
                "war_room_id" to warRoomId,
                "scenario_id" to scenarioId,
                "scenario_run_id" to scenarioRunId
            )
        )
    }

    fun setBiometricLockEnabled(enabled: Boolean) {
        if (enabled && !state.biometricSupported) {
            publish(state.copy(message = "Biometric lock is not available on this device."))
            return
        }

        sessionStore.saveBiometricLockEnabled(enabled)
        publish(
            state.copy(
                biometricLockEnabled = enabled,
                message = if (enabled) "Biometric lock enabled." else "Biometric lock disabled."
            )
        )
        trackEvent("biometric_lock_toggled", mapOf("enabled" to enabled))
    }

    fun setNotificationPreference(notificationType: String, enabled: Boolean) {
        val normalizedType = notificationType.trim()
        if (normalizedType.isBlank()) {
            return
        }

        viewModelScope.launch {
            val error = runAuthorizedWithRefresh {
                val preferences = client.updateNotificationPreference(
                    state.apiBaseUrl,
                    requireTokens().accessToken,
                    normalizedType,
                    enabled
                )
                publish(
                    state.copy(
                        notificationPreferences = mergeNotificationPreferences(preferences),
                        message = "Notification preference saved."
                    )
                )
                trackEvent(
                    if (enabled) "notification_family_enabled" else "notification_family_muted",
                    mapOf("notification_type" to normalizedType, "enabled" to enabled)
                )
            }

            if (error != null) {
                publish(state.copy(message = toMessage(error)))
            }
        }
    }

    fun register(email: String, password: String) {
        viewModelScope.launch {
            publish(state.copy(authBusy = true, message = null, registerStatus = null))
            runCatching {
                client.register(state.apiBaseUrl, email, password)
            }.onSuccess { result ->
                publish(
                    state.copy(
                        authBusy = false,
                        registerStatus = result.status,
                        verificationToken = result.verificationToken,
                        message = "Registration created. Verify your account to continue."
                    )
                )
                trackEvent(
                    "registration_completed",
                    mapOf(
                        "method" to "email_password",
                        "result" to result.status
                    )
                )
                trackEvent(
                    "user_registered",
                    mapOf(
                        "method" to "email_password",
                        "result" to result.status
                    )
                )
            }.onFailure { error ->
                publish(state.copy(authBusy = false, message = toMessage(error)))
            }
        }
    }

    fun verify(email: String, token: String) {
        viewModelScope.launch {
            publish(state.copy(authBusy = true, message = null))
            runCatching {
                client.verify(state.apiBaseUrl, email.trim(), token.trim())
            }.onSuccess {
                publish(state.copy(authBusy = false, message = "Account verified. You can login now."))
            }.onFailure { error ->
                publish(state.copy(authBusy = false, message = toMessage(error)))
            }
        }
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            publish(state.copy(authBusy = true, message = null))
            runCatching {
                client.login(state.apiBaseUrl, email, password)
            }.onSuccess { tokens ->
                sessionStore.saveTokens(tokens)
                sessionStore.setHasSeenWelcome(true)
                publish(
                    state.copy(
                        authBusy = false,
                        showWelcome = false,
                        tokens = tokens,
                        message = "Login successful.",
                        pulseError = null,
                        deepDiveError = null
                    )
                )
                refreshFeatureFlags()
                refreshUserProfile()
                refreshWatchlist()
                refreshNotificationPreferences()
                refreshSubscriptionOffers()
                refreshPulse()
                refreshMacroStress()
                refreshAlertLedger()
                refreshMonitorSnapshots()
                refreshReportHistory()
                markAllTabsFetched()
                syncPushToken()
                PrefetchScheduler.schedule(getApplication<Application>().applicationContext)
                trackEvent(
                    "login_completed",
                    mapOf("method" to "email_password")
                )
            }.onFailure { error ->
                publish(state.copy(authBusy = false, message = toMessage(error)))
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            val current = state.tokens
            if (current == null) {
                clearLocalSession("Logged out.")
                return@launch
            }

            runCatching {
                // Unregister device before token clear to avoid stale push subscriptions.
                client.updateDeviceToken(
                    state.apiBaseUrl,
                    current.accessToken,
                    null,
                    sessionStore.getInstallationId()
                )
            }
            runCatching {
                client.logout(state.apiBaseUrl, current.accessToken, current.refreshToken)
            }
            runCatching {
                RevenueCatBilling.logOutSafely()
            }
            clearLocalSession("Logged out.")
        }
    }

    fun requestPasswordReset(email: String, onResult: (error: String?, message: String?) -> Unit) {
        viewModelScope.launch {
            runCatching { client.requestPasswordReset(state.apiBaseUrl, email.trim()) }
                .onSuccess { message -> onResult(null, message) }
                .onFailure { error -> onResult(toMessage(error), null) }
        }
    }

    fun confirmPasswordReset(
        email: String,
        token: String,
        newPassword: String,
        onResult: (error: String?) -> Unit
    ) {
        viewModelScope.launch {
            runCatching {
                client.confirmPasswordReset(state.apiBaseUrl, email.trim(), token.trim(), newPassword)
            }
                .onSuccess {
                    publish(state.copy(message = "Password reset successful. Log in with your new password."))
                    onResult(null)
                }
                .onFailure { error -> onResult(toMessage(error)) }
        }
    }

    fun deleteAccount(onError: (String) -> Unit) {
        viewModelScope.launch {
            var storeNotice: String? = null
            val error = runAuthorizedWithRefresh {
                storeNotice = client.deleteAccount(state.apiBaseUrl, requireTokens().accessToken)
            }
            if (error != null) {
                onError(toMessage(error))
                return@launch
            }
            runCatching {
                RevenueCatBilling.logOutSafely()
            }
            clearLocalSession(
                listOfNotNull("Account deleted successfully.", storeNotice).joinToString(" ")
            )
        }
    }

    /**
     * The in-app Deep Dive page answered 401: the WebView cannot refresh the token, so the app does it
     * here and calls back with the new access token, or null when the refresh did not work (the page
     * then falls back to the native screen; a later API call handles an ended session as before).
     */
    fun refreshAccessTokenForPage(onResult: (String?) -> Unit) {
        viewModelScope.launch {
            val refreshed = tryRefreshToken()
            onResult(if (refreshed) state.tokens?.accessToken else null)
        }
    }

    fun dismissPaywall() {
        publish(state.copy(paywallFeature = null))
    }

    fun requestFeatureUpgrade(feature: String) {
        publish(
            state.copy(
                paywallFeature = feature,
                message = "Upgrade to Pro to use this feature."
            )
        )
        trackEvent(
            "paywall_shown",
            mapOf("feature" to feature)
        )
        if (feature.contains("win_back", ignoreCase = true)) {
            trackEvent(
                "win_back_prompt_shown",
                mapOf("feature" to feature)
            )
        }
    }

    fun updateReportNoteDraft(content: String) {
        publish(state.copy(reportNoteDraft = content))
    }

    fun saveReportNote() {
        val report = state.deepDiveReport
        if (report == null) {
            publish(state.copy(message = "Open a report before saving notes."))
            return
        }

        viewModelScope.launch {
            publish(state.copy(isSavingNote = true, message = null))
            val error = runAuthorizedWithRefresh {
                val saved = client.saveReportNote(
                    state.apiBaseUrl,
                    requireTokens().accessToken,
                    report.reportId,
                    state.reportNoteDraft
                )
                publish(
                    state.copy(
                        reportNote = saved,
                        reportNoteDraft = saved.content,
                        message = "Note saved."
                    )
                )
                cacheStore.setDeepDiveNotePinned(report.reportId, saved.content.isNotBlank())
                runCatchingNonCancellation { cacheStore.cacheReportNote(report.reportId, saved, report) }
                trackEvent(
                    "deep_dive_note_saved",
                    mapOf(
                        "report_id" to report.reportId,
                        "content_length" to saved.content.length
                    )
                )
            }
            if (error != null) {
                publish(state.copy(message = toMessage(error)))
            }
            publish(state.copy(isSavingNote = false))
        }
    }

    fun submitReportFeedback(code: String, message: String = "") {
        val report = state.deepDiveReport
        if (report == null) {
            publish(state.copy(message = "Open a report before sending feedback."))
            return
        }

        viewModelScope.launch {
            publish(state.copy(message = null))
            val error = runAuthorizedWithRefresh {
                val feedbackId = client.submitReportFeedback(
                    baseUrl = state.apiBaseUrl,
                    accessToken = requireTokens().accessToken,
                    reportId = report.reportId,
                    ticker = report.ticker,
                    code = code,
                    sourceSurface = "deep_dive_report",
                    message = message.ifBlank { null },
                    severity = if (code == "bug_report") "high" else "normal"
                )
                trackEvent(
                    "report_feedback_submitted",
                    mapOf(
                        "feedback_id" to feedbackId,
                        "report_id" to report.reportId,
                        "ticker" to report.ticker,
                        "code" to code
                    )
                )
                trackEvent(
                    "trust_feedback_submitted",
                    mapOf(
                        "report_id" to report.reportId,
                        "code" to code
                    )
                )
                publish(state.copy(message = "Feedback submitted. Thank you."))
            }

            if (error != null) {
                publish(state.copy(message = toMessage(error)))
            }
        }
    }

    fun submitAlertFeedback(alertId: String, feedback: String) {
        val normalizedId = alertId.trim()
        val normalizedFeedback = feedback.trim()
        if (normalizedId.isBlank() || normalizedFeedback.isBlank()) {
            return
        }

        viewModelScope.launch {
            publish(state.copy(message = null))
            val error = runAuthorizedWithRefresh {
                val updated = client.submitAlertFeedback(
                    state.apiBaseUrl,
                    requireTokens().accessToken,
                    normalizedId,
                    normalizedFeedback
                )
                publish(
                    state.copy(
                        alertLedger = replaceAlertLedgerItem(updated),
                        inboxError = null,
                        message = "Alert feedback saved."
                    )
                )
                trackEvent(
                    "alert_feedback_submitted",
                    mapOf(
                        "alert_id" to normalizedId,
                        "feedback" to normalizedFeedback,
                        "notification_type" to updated.notificationType
                    )
                )
            }

            if (error != null) {
                publish(state.copy(message = toMessage(error), inboxError = toMessage(error)))
            }
        }
    }

    fun muteAlert(alertId: String) {
        val normalizedId = alertId.trim()
        if (normalizedId.isBlank()) {
            return
        }

        viewModelScope.launch {
            publish(state.copy(message = null))
            val error = runAuthorizedWithRefresh {
                val updated = client.muteAlert(
                    state.apiBaseUrl,
                    requireTokens().accessToken,
                    normalizedId
                )
                publish(
                    state.copy(
                        alertLedger = replaceAlertLedgerItem(updated),
                        inboxError = null,
                        message = "Alerts like this are quiet for 24 hours."
                    )
                )
                refreshNotificationPreferences()
                trackEvent(
                    "notification_family_quieted",
                    mapOf(
                        "alert_id" to normalizedId,
                        "notification_type" to updated.notificationType,
                        "quiet_for_hours" to 24
                    )
                )
            }

            if (error != null) {
                publish(state.copy(message = toMessage(error), inboxError = toMessage(error)))
            }
        }
    }

    fun submitSubscriptionFeedback(
        code: String,
        sourceSurface: String,
        message: String = "",
        promptWinBack: Boolean = false
    ) {
        viewModelScope.launch {
            publish(state.copy(message = null))
            val error = runAuthorizedWithRefresh {
                val feedbackId = client.submitSubscriptionFeedback(
                    baseUrl = state.apiBaseUrl,
                    accessToken = requireTokens().accessToken,
                    code = code,
                    sourceSurface = sourceSurface,
                    message = message.ifBlank { null },
                    severity = "normal"
                )
                val isDowngrade = sourceSurface.contains("downgrade", ignoreCase = true)
                trackEvent(
                    if (isDowngrade) "downgrade_reason_submitted" else "cancel_reason_submitted",
                    mapOf(
                        "feedback_id" to feedbackId,
                        "code" to code,
                        "source_surface" to sourceSurface
                    )
                )
                publish(state.copy(message = "Subscription feedback submitted."))
                if (promptWinBack) {
                    requestFeatureUpgrade("win_back_offer")
                }
            }
            if (error != null) {
                publish(state.copy(message = toMessage(error)))
            }
        }
    }

    fun runScenario(
        projectionYears: Int?,
        terminalGrowthRate: Double?,
        wacc: Double?
    ) {
        val report = state.deepDiveReport
        if (report == null) {
            publish(state.copy(message = "Open a report before running a scenario."))
            return
        }

        viewModelScope.launch {
            publish(state.copy(isRunningScenario = true, message = null))
            val error = runAuthorizedWithRefresh {
                val scenario = client.runScenario(
                    state.apiBaseUrl,
                    requireTokens().accessToken,
                    report.reportId,
                    ScenarioOverridesView(
                        projectionYears = projectionYears,
                        terminalGrowthRate = terminalGrowthRate,
                        wacc = wacc
                    )
                )
                publish(
                    state.copy(
                        scenarioResult = scenario,
                        message = "Scenario updated."
                    )
                )
                trackEvent(
                    "deep_dive_scenario_run",
                    mapOf(
                        "report_id" to report.reportId,
                        "has_projection_years" to (projectionYears != null),
                        "has_terminal_growth_rate" to (terminalGrowthRate != null),
                        "has_wacc" to (wacc != null)
                    )
                )
                trackEvent(
                    "what_if_requested",
                    mapOf("report_id" to report.reportId)
                )
            }
            if (error != null) {
                val upgrade = (error as? ProductApiException)
                    ?.takeIf { it.code == 403 && it.errorCode == "upgrade_required" }
                if (upgrade != null) {
                    publish(
                        state.copy(
                            paywallFeature = upgrade.feature ?: "what_if_scenario",
                            message = upgrade.message
                        )
                    )
                } else {
                    publish(state.copy(message = toMessage(error)))
                }
            }
            publish(state.copy(isRunningScenario = false))
        }
    }

    fun selectScenarioStressTemplate(scenarioId: String) {
        val normalized = scenarioId.trim()
        if (normalized.isBlank()) {
            return
        }
        publish(
            state.copy(
                selectedScenarioStressId = normalized,
                scenarioStressRun = null,
                scenarioStressRunError = null
            )
        )
    }

    fun refreshScenarioStressTemplates(force: Boolean = false) {
        if (!isProTier()) {
            publish(
                state.copy(
                    scenarioStressTemplates = emptyList(),
                    selectedScenarioStressId = null,
                    scenarioStressTemplatesError = null,
                    scenarioStressRun = null,
                    scenarioStressRunError = null
                )
            )
            return
        }
        if (!force && state.isLoadingScenarioStressTemplates) {
            return
        }

        viewModelScope.launch {
            publish(state.copy(isLoadingScenarioStressTemplates = true, scenarioStressTemplatesError = null))
            val error = runAuthorizedWithRefresh {
                val templates = client.getScenarioStressTemplates(
                    state.apiBaseUrl,
                    requireTokens().accessToken
                ).filter { it.active }
                val selected = when {
                    !state.selectedScenarioStressId.isNullOrBlank() &&
                        templates.any { it.scenarioId == state.selectedScenarioStressId } ->
                        state.selectedScenarioStressId
                    templates.isNotEmpty() -> templates.first().scenarioId
                    else -> null
                }
                publish(
                    state.copy(
                        scenarioStressTemplates = templates,
                        selectedScenarioStressId = selected,
                        scenarioStressTemplatesError = null
                    )
                )
            }
            if (error != null) {
                val upgrade = (error as? ProductApiException)
                    ?.takeIf { it.code == 403 && it.errorCode == "upgrade_required" }
                if (upgrade == null) {
                    publish(state.copy(scenarioStressTemplatesError = toMessage(error)))
                }
            }
            publish(state.copy(isLoadingScenarioStressTemplates = false))
        }
    }

    fun runScenarioStress(scenarioId: String? = state.selectedScenarioStressId) {
        val normalizedId = scenarioId?.trim().orEmpty()
        if (normalizedId.isBlank()) {
            publish(state.copy(message = "Choose a scenario template first."))
            return
        }
        if (!isProTier()) {
            requestFeatureUpgrade("scenario_stress")
            return
        }

        viewModelScope.launch {
            publish(
                state.copy(
                    isRunningScenarioStress = true,
                    scenarioStressRun = null,
                    scenarioStressRunError = null,
                    message = null
                )
            )
            val error = runAuthorizedWithRefresh {
                val result = client.runScenarioStress(
                    state.apiBaseUrl,
                    requireTokens().accessToken,
                    normalizedId
                )
                publish(
                    state.copy(
                        selectedScenarioStressId = normalizedId,
                        scenarioStressRun = result,
                        scenarioStressRunError = null,
                        message = "Scenario stress run complete."
                    )
                )
                trackEvent(
                    "scenario_stress_run_requested",
                    mapOf(
                        "scenario_id" to normalizedId,
                        "scenario_run_id" to result.run.scenarioRunId,
                        "impacted_names" to result.run.impactedNames,
                        "critical_names" to result.run.criticalNames
                    )
                )
            }
            if (error != null) {
                val upgrade = (error as? ProductApiException)
                    ?.takeIf { it.code == 403 && it.errorCode == "upgrade_required" }
                if (upgrade != null) {
                    publish(
                        state.copy(
                            paywallFeature = upgrade.feature ?: "scenario_stress",
                            message = upgrade.message
                        )
                    )
                } else {
                    publish(state.copy(scenarioStressRunError = toMessage(error)))
                }
            }
            publish(state.copy(isRunningScenarioStress = false))
        }
    }

    fun openScenarioStressRun(scenarioRunId: String, scenarioId: String? = null) {
        val normalizedRunId = scenarioRunId.trim()
        if (normalizedRunId.isBlank()) {
            publish(state.copy(message = "Scenario run id is missing."))
            return
        }
        if (!isProTier()) {
            requestFeatureUpgrade("scenario_stress")
            return
        }
        val normalizedScenarioId = scenarioId?.trim()?.ifBlank { null }

        viewModelScope.launch {
            publish(
                state.copy(
                    isRunningScenarioStress = true,
                    scenarioStressRun = null,
                    scenarioStressRunError = null,
                    message = null
                )
            )
            val error = runAuthorizedWithRefresh {
                val result = client.getScenarioStressRun(
                    state.apiBaseUrl,
                    requireTokens().accessToken,
                    normalizedRunId
                )
                val selected = normalizedScenarioId ?: result.run.scenarioId
                publish(
                    state.copy(
                        selectedScenarioStressId = selected,
                        scenarioStressRun = result,
                        scenarioStressRunError = null,
                        message = "Scenario stress run loaded."
                    )
                )
                trackEvent(
                    "scenario_stress_run_viewed",
                    mapOf(
                        "scenario_id" to result.run.scenarioId,
                        "scenario_run_id" to result.run.scenarioRunId
                    )
                )
            }
            if (error != null) {
                val upgrade = (error as? ProductApiException)
                    ?.takeIf { it.code == 403 && it.errorCode == "upgrade_required" }
                if (upgrade != null) {
                    publish(
                        state.copy(
                            paywallFeature = upgrade.feature ?: "scenario_stress",
                            message = upgrade.message
                        )
                    )
                } else {
                    publish(state.copy(scenarioStressRunError = toMessage(error)))
                }
            }
            publish(state.copy(isRunningScenarioStress = false))
        }
    }

    fun refreshConvictionTimeline(ticker: String? = state.deepDiveReport?.ticker) {
        if (!isProTier()) {
            return
        }
        val normalizedTicker = ticker?.trim()?.uppercase()?.ifBlank { null }
        viewModelScope.launch {
            val error = runAuthorizedWithRefresh {
                val timeline = client.getConvictionTimeline(
                    state.apiBaseUrl,
                    requireTokens().accessToken,
                    normalizedTicker,
                    limit = 20
                )
                publish(
                    state.copy(
                        convictionTimeline = timeline,
                        convictionTimelineError = null
                    )
                )
            }
            if (error != null) {
                publish(state.copy(convictionTimelineError = toMessage(error)))
            }
        }
    }

    fun refreshConvictionInsights() {
        if (!isProTier()) {
            return
        }
        viewModelScope.launch {
            val error = runAuthorizedWithRefresh {
                val insights = client.getConvictionInsights(
                    state.apiBaseUrl,
                    requireTokens().accessToken,
                    limit = 5
                )
                publish(
                    state.copy(
                        convictionInsights = insights,
                        convictionInsightsError = null
                    )
                )
            }
            if (error != null) {
                publish(state.copy(convictionInsightsError = toMessage(error)))
            }
        }
    }

    fun refreshOppositeCase(reportId: String? = state.deepDiveReport?.reportId) {
        if (!isProTier()) {
            return
        }
        val normalizedReportId = reportId?.trim().orEmpty()
        if (normalizedReportId.isBlank()) {
            return
        }

        viewModelScope.launch {
            val error = runAuthorizedWithRefresh {
                val opposite = client.getOppositeCase(
                    state.apiBaseUrl,
                    requireTokens().accessToken,
                    normalizedReportId
                )
                publish(
                    state.copy(
                        oppositeCase = opposite,
                        oppositeCaseError = if (opposite == null) {
                            "No opposite case generated yet."
                        } else {
                            null
                        }
                    )
                )
            }
            if (error != null) {
                publish(state.copy(oppositeCaseError = toMessage(error)))
            }
        }
    }

    fun generateOppositeCase() {
        val report = state.deepDiveReport
        if (report == null) {
            publish(state.copy(message = "Open a report before generating the opposite case."))
            return
        }
        if (!isProTier()) {
            requestFeatureUpgrade("conviction_intelligence")
            return
        }

        viewModelScope.launch {
            publish(state.copy(isGeneratingOppositeCase = true, message = null, oppositeCaseError = null))
            val error = runAuthorizedWithRefresh {
                val opposite = client.createOppositeCase(
                    state.apiBaseUrl,
                    requireTokens().accessToken,
                    report.reportId
                )
                publish(
                    state.copy(
                        oppositeCase = opposite,
                        oppositeCaseError = null,
                        message = "Opposite case ready."
                    )
                )
                refreshConvictionTimeline(report.ticker)
                trackEvent(
                    "opposite_case_generated",
                    mapOf(
                        "report_id" to report.reportId,
                        "ticker" to report.ticker,
                        "opposite_case_id" to opposite.oppositeCaseId
                    )
                )
            }
            if (error != null) {
                val upgrade = (error as? ProductApiException)
                    ?.takeIf { it.code == 403 && it.errorCode == "upgrade_required" }
                if (upgrade != null) {
                    publish(
                        state.copy(
                            paywallFeature = upgrade.feature ?: "conviction_intelligence",
                            oppositeCaseError = upgrade.message,
                            message = upgrade.message
                        )
                    )
                } else {
                    publish(state.copy(oppositeCaseError = toMessage(error), message = toMessage(error)))
                }
            }
            publish(state.copy(isGeneratingOppositeCase = false))
        }
    }

    fun syncTierFromServer(revenuecatAppUserId: String? = null) {
        withAuthorizedCall {
            val profile = client.syncUserTier(
                state.apiBaseUrl,
                requireTokens().accessToken,
                revenuecatAppUserId
            )
            publish(
                state.copy(
                    userProfile = profile,
                    paywallFeature = null,
                    message = "Subscription status refreshed."
                )
            )
            refreshConvictionInsights()
            state.deepDiveReport?.let { refreshConvictionForReport(it) }
        }
    }

    fun refreshSubscriptionOffers() {
        viewModelScope.launch {
            val appUserId = parseJwtSubject(state.tokens?.accessToken)
            val configured = runCatching {
                RevenueCatBilling.configureIfPossible(getApplication(), appUserId)
            }.getOrDefault(false)

            if (!configured) {
                publish(state.copy(subscriptionOffers = emptyList()))
                return@launch
            }

            val offers = runCatching {
                val offerings = RevenueCatBilling.getOfferings()
                // packageType is the paywall slot (MONTHLY / ANNUAL), also when a configured product ID
                // matched a custom package.
                listOf(PackageType.MONTHLY, PackageType.ANNUAL)
                    .mapNotNull { slot ->
                        RevenueCatBilling.pickPreferredPackage(offerings, slot)?.let { slot to it }
                    }
                    .distinctBy { (_, pack) -> pack.identifier }
                    .map { (slot, pack) ->
                        SubscriptionOfferView(
                            packageType = slot.name,
                            identifier = pack.identifier,
                            title = pack.product.title.ifBlank { pack.identifier },
                            price = pack.product.price.formatted
                        )
                    }
            }.getOrElse {
                emptyList()
            }

            publish(state.copy(subscriptionOffers = offers))
        }
    }

    fun startPurchase(activity: Activity, preferredType: String? = null) {
        withAuthorizedCall {
            val appUserId = parseJwtSubject(requireTokens().accessToken)
            if (!RevenueCatBilling.configureIfPossible(getApplication(), appUserId)) {
                publish(state.copy(message = "In-app purchases are not configured for this build."))
                return@withAuthorizedCall
            }

            publish(state.copy(subscriptionActionInFlight = true))
            try {
                val offerings = RevenueCatBilling.getOfferings()
                val packageType = when (preferredType?.uppercase()) {
                    "MONTHLY" -> PackageType.MONTHLY
                    "ANNUAL", "YEARLY" -> PackageType.ANNUAL
                    else -> PackageType.MONTHLY
                }
                val selected = RevenueCatBilling.pickPreferredPackage(offerings, packageType)
                    ?: throw IllegalStateException("No subscription package is currently available.")
                trackEvent(
                    "paywall_cta_clicked",
                    mapOf(
                        "feature" to (state.paywallFeature ?: "general_upgrade"),
                        "package_type" to selected.packageType.name
                    )
                )
                trackEvent(
                    "purchase_started",
                    mapOf(
                        "package_type" to selected.packageType.name,
                        "identifier" to selected.identifier
                    )
                )
                val customerInfo = RevenueCatBilling.purchase(activity, selected)
                val profile = client.syncUserTier(
                    state.apiBaseUrl,
                    requireTokens().accessToken,
                    customerInfo.originalAppUserId
                )
                publish(
                    state.copy(
                        userProfile = profile,
                        paywallFeature = null,
                        message = "Purchase completed. Subscription upgraded."
                    )
                )
                trackEvent(
                    "purchase_completed",
                    mapOf(
                        "tier" to profile.tier,
                        "package_type" to selected.packageType.name,
                        "period_type" to customerInfo.entitlements.active.values.firstOrNull()?.periodType?.name,
                        "billing_period_end" to profile.billingPeriodEnd
                    )
                )
                refreshSubscriptionOffers()
            } catch (error: Throwable) {
                trackEvent(
                    "purchase_failed",
                    mapOf(
                        "feature" to (state.paywallFeature ?: "general_upgrade"),
                        "reason" to (error.message ?: error::class.java.simpleName)
                    )
                )
                throw error
            } finally {
                publish(state.copy(subscriptionActionInFlight = false))
            }
        }
    }

    fun restorePurchases() {
        withAuthorizedCall {
            val appUserId = parseJwtSubject(requireTokens().accessToken)
            if (!RevenueCatBilling.configureIfPossible(getApplication(), appUserId)) {
                publish(state.copy(message = "In-app purchases are not configured for this build."))
                return@withAuthorizedCall
            }

            publish(state.copy(subscriptionActionInFlight = true))
            try {
                trackEvent("restore_started")
                val customerInfo = RevenueCatBilling.restorePurchases()
                val profile = client.syncUserTier(
                    state.apiBaseUrl,
                    requireTokens().accessToken,
                    customerInfo.originalAppUserId
                )
                publish(
                    state.copy(
                        userProfile = profile,
                        paywallFeature = null,
                        message = "Purchases restored."
                    )
                )
                trackEvent(
                    "restore_completed",
                    mapOf(
                        "tier" to profile.tier,
                        "billing_period_end" to profile.billingPeriodEnd
                    )
                )
                refreshSubscriptionOffers()
            } catch (error: Throwable) {
                trackEvent(
                    "restore_failed",
                    mapOf("reason" to (error.message ?: error::class.java.simpleName))
                )
                throw error
            } finally {
                publish(state.copy(subscriptionActionInFlight = false))
            }
        }
    }

    fun searchTickers(query: String) {
        withAuthorizedCall {
            val results = client.searchTickers(state.apiBaseUrl, requireTokens().accessToken, query)
            publish(state.copy(tickers = results, message = "Search returned ${results.size} result(s)."))
        }
    }

    fun selectTicker(symbol: String) {
        publish(state.copy(selectedTicker = symbol))
    }

    fun runDeepDive() {
        val ticker = state.selectedTicker
        if (ticker.isNullOrBlank()) {
            publish(state.copy(message = "Select a ticker first."))
            return
        }
        // One build at a time: callers go through startOrShowDeepDive, which shows the running build instead.
        if (state.isDeepDiveRunning) return

        // The entry that shows this build's progress and failure is DeepDiveRunning(buildTicker) (ShellDestinations).
        val buildTicker = ticker.trim().uppercase()
        // Marked running before the request goes out, so a second tap in the same frame finds the build running.
        activeDeepDiveJobId = null
        publish(
            state.copy(
                isDeepDiveRunning = true,
                deepDiveBuildTicker = buildTicker,
                deepDiveReport = null,
                deepDiveLoadedFromCache = false,
                reportNote = null,
                reportNoteDraft = "",
                isSavingNote = false,
                convictionTimeline = emptyList(),
                convictionTimelineError = null,
                oppositeCase = null,
                oppositeCaseError = null,
                isGeneratingOppositeCase = false,
                scenarioResult = null,
                isRunningScenario = false,
                deepDiveError = null,
                jobStatus = "queued"
            )
        )
        var createdJobId: String? = null
        withAuthorizedCall(onError = {
            // Only this build's failure ends the build state (never a newer job's).
            if (activeDeepDiveJobId == null || activeDeepDiveJobId == createdJobId) {
                activeDeepDiveJobId = null
                publish(state.copy(isDeepDiveRunning = false, deepDiveBuildTicker = buildTicker, deepDiveError = state.message))
            }
        }) {
            val job = client.createDeepDiveJob(state.apiBaseUrl, requireTokens().accessToken, ticker)
            createdJobId = job.jobId
            activeDeepDiveJobId = job.jobId
            publish(state.copy(jobStatus = job.status))
            trackEvent(
                "deep_dive_requested",
                mapOf(
                    "ticker" to ticker.uppercase(),
                    "job_id" to job.jobId
                )
            )
            trackEvent(
                "deep_dive_started",
                mapOf(
                    "ticker" to ticker.uppercase(),
                    "job_id" to job.jobId
                )
            )
            saveDeepDiveInFlight(job.jobId, ticker)
            pollDeepDiveJob(job.jobId)
        }
    }

    // Picks up polling a Deep Dive that was still running when the screen or app closed.
    private fun resumeDeepDiveIfRunning() {
        val jobId = deepDiveResumePrefs.getString(KEY_RESUME_JOB_ID, null)
        if (jobId == null) {
            dropIdleRunningEntries()
            return
        }
        val startedAt = deepDiveResumePrefs.getLong(KEY_RESUME_STARTED_AT, 0L)
        if (System.currentTimeMillis() - startedAt > DEEP_DIVE_MAX_WAIT_MS) {
            clearDeepDiveInFlight()
            dropIdleRunningEntries()
            return
        }
        if (deepDivePoll?.isActive == true || state.isDeepDiveRunning) return
        val ticker = deepDiveResumePrefs.getString(KEY_RESUME_TICKER, null)
        activeDeepDiveJobId = jobId
        publish(
            state.copy(
                selectedTicker = state.selectedTicker ?: ticker,
                isDeepDiveRunning = true,
                deepDiveBuildTicker = ticker?.trim()?.uppercase()?.ifBlank { null },
                jobStatus = "running",
                deepDiveError = null
            )
        )
        viewModelScope.launch {
            val error = runAuthorizedWithRefresh { pollDeepDiveJob(jobId) }
            // The job may already have ended (complete, then the report fetch failed): its failure still ends the build.
            if (error != null && (activeDeepDiveJobId == null || activeDeepDiveJobId == jobId)) {
                activeDeepDiveJobId = null
                clearDeepDiveInFlight()
                // The restored running entry shows the failure (with Retry) rather than an empty search.
                val message = toMessage(error)
                publish(state.copy(isDeepDiveRunning = false, message = message, deepDiveError = message))
            }
        }
    }

    /**
     * A `DeepDiveRunning` entry restored (process death, recreate) with no job left to follow would only show a
     * second copy of the Research search: remove it, so back and the tab show what was under it.
     */
    private fun dropIdleRunningEntries() {
        if (state.isDeepDiveRunning) return
        navigator.removeWhere { it is Destination.DeepDiveRunning }
    }

    private fun saveDeepDiveInFlight(jobId: String, ticker: String) {
        deepDiveResumePrefs.edit()
            .putString(KEY_RESUME_JOB_ID, jobId)
            .putString(KEY_RESUME_TICKER, ticker)
            .putLong(KEY_RESUME_STARTED_AT, System.currentTimeMillis())
            .apply()
    }

    private fun clearDeepDiveInFlight() {
        deepDiveResumePrefs.edit().clear().apply()
    }

    /**
     * Ends [jobId]'s build: forgets it and clears its resume prefs. False (and nothing changes) when [jobId] is not
     * the job the app follows any more, so a poll that outlived its build cannot end the current one.
     */
    private fun endDeepDiveJob(jobId: String): Boolean {
        if (activeDeepDiveJobId != jobId) return false
        activeDeepDiveJobId = null
        clearDeepDiveInFlight()
        return true
    }

    fun refreshReportHistory() {
        historyInFlight++
        publish(state.copy(isHistoryLoading = true))
        withAuthorizedCall(onDone = {
            historyInFlight = (historyInFlight - 1).coerceAtLeast(0)
            publish(state.copy(isHistoryLoading = historyInFlight > 0))
        }) {
            val reports = client.listReports(state.apiBaseUrl, requireTokens().accessToken)
            publish(state.copy(reportHistory = reports, reportHistoryLoaded = true))
        }
    }

    fun openHistoryReport(reportId: String) {
        val generation = ++reportOpenGeneration
        viewModelScope.launch {
            publish(state.copy(isOpeningReport = true, message = null, deepDiveError = null))
            val error = runAuthorizedWithRefresh {
                val report = client.getDeepDiveReport(state.apiBaseUrl, requireTokens().accessToken, reportId)
                val note = runCatchingNonCancellation {
                    client.getReportNote(state.apiBaseUrl, requireTokens().accessToken, report.reportId)
                }.getOrNull()
                cacheStore.cacheDeepDive(report, notePinned = !note?.content.isNullOrBlank())
                cacheReportExtras(report, note)
                // A newer open (another report tapped meanwhile) wins; this result is only cached.
                if (generation != reportOpenGeneration) return@runAuthorizedWithRefresh
                publish(
                    state.copy(
                        deepDiveReport = report,
                        deepDiveLoadedFromCache = false,
                        reportNote = note,
                        reportNoteDraft = note?.content ?: "",
                        isSavingNote = false,
                        convictionTimeline = emptyList(),
                        convictionTimelineError = null,
                        oppositeCase = null,
                        oppositeCaseError = null,
                        isGeneratingOppositeCase = false,
                        scenarioResult = null,
                        isRunningScenario = false,
                        message = "Loaded report from history.",
                        deepDiveError = null
                    )
                )
                val tickerSafe = report.ticker ?: "unknown"
                sessionStore.saveLastViewedReport(report.reportId, tickerSafe, "DEEP_DIVE")
                publish(state.copy(lastViewedReport = sessionStore.getLastViewedReport()))
                refreshConvictionForReport(report)
                trackEvent(
                    "deep_dive_viewed",
                    mapOf(
                        "report_id" to report.reportId,
                        "ticker" to tickerSafe
                    )
                )
                trackEvent(
                    "report_opened",
                    mapOf(
                        "report_id" to report.reportId,
                        "source" to "history_network"
                    )
                )
            }
            if (error != null) {
                val cached = cacheStore.getCachedDeepDive(reportId)
                if (generation != reportOpenGeneration) return@launch
                if (cached != null) {
                    publish(
                        state.copy(
                            isOpeningReport = false,
                            deepDiveReport = cached,
                            deepDiveLoadedFromCache = true,
                            reportNote = null,
                            reportNoteDraft = "",
                            isSavingNote = false,
                            convictionTimeline = emptyList(),
                            convictionTimelineError = "Conviction intelligence is unavailable while offline.",
                            oppositeCase = null,
                            oppositeCaseError = "Opposite case is unavailable while offline.",
                            isGeneratingOppositeCase = false,
                            scenarioResult = null,
                            isRunningScenario = false,
                            message = "Loaded cached report (offline).",
                            deepDiveError = null
                        )
                    )
                    trackEvent(
                        "cache_hit",
                        mapOf(
                            "artifact" to "deep_dive",
                            "report_id" to reportId
                        )
                    )
                    trackEvent(
                        "report_opened",
                        mapOf(
                            "report_id" to reportId,
                            "source" to "history_cache"
                        )
                    )
                } else {
                    trackEvent(
                        "cache_miss",
                        mapOf(
                            "artifact" to "deep_dive",
                            "report_id" to reportId
                        )
                    )
                    val message = toMessage(error)
                    publish(state.copy(isOpeningReport = false, message = message, deepDiveError = message))
                }
            } else if (generation == reportOpenGeneration) {
                publish(state.copy(isOpeningReport = false))
            }
        }
    }

    fun dismissResumeCard() {
        sessionStore.clearLastViewedReport()
        publish(state.copy(lastViewedReport = null))
    }

    /**
     * Loads a War Room. [announce] = false is the open War Room's background auto-refresh: no message (so no
     * snackbar every minute), no `war_room_viewed` event, and a failure keeps the loaded War Room on screen
     * without an error or the paywall.
     */
    fun openWarRoom(warRoomId: String, announce: Boolean = true) {
        val normalizedWarRoomId = warRoomId.trim()
        if (normalizedWarRoomId.isBlank()) {
            if (announce) publish(state.copy(message = "Open a War Room first."))
            return
        }

        viewModelScope.launch {
            if (announce) {
                publish(state.copy(isWarRoomLoading = true, message = null, warRoomError = null))
            } else {
                publish(state.copy(isWarRoomLoading = true))
            }
            val error = runAuthorizedWithRefresh {
                val warRoom = client.getWarRoom(
                    state.apiBaseUrl,
                    requireTokens().accessToken,
                    normalizedWarRoomId
                )
                if (!announce) {
                    publish(state.copy(warRoom = warRoom, warRoomError = null))
                    return@runAuthorizedWithRefresh
                }
                publish(
                    state.copy(
                        warRoom = warRoom,
                        warRoomError = null,
                        message = "War Room loaded."
                    )
                )
                trackEvent(
                    "war_room_viewed",
                    mapOf(
                        "war_room_id" to warRoom.warRoomId,
                        "ticker" to warRoom.ticker,
                        "phase_count" to warRoom.phases.size
                    )
                )
            }
            if (error != null && !announce) {
                publish(state.copy(isWarRoomLoading = false))
                return@launch
            }
            if (error != null) {
                val message = toMessage(error)
                publish(
                    state.copy(
                        isWarRoomLoading = false,
                        warRoomError = message,
                        message = message
                    )
                )
                val upgrade = (error as? ProductApiException)
                    ?.takeIf { it.code == 403 && it.errorCode == "upgrade_required" }
                if (upgrade != null) {
                    requestFeatureUpgrade(upgrade.feature ?: "earnings_war_room")
                }
                return@launch
            }
            publish(state.copy(isWarRoomLoading = false))
        }
    }

    fun refreshWarRoom(announce: Boolean = true) {
        val warRoomId = state.warRoom?.warRoomId?.trim().orEmpty()
        if (warRoomId.isBlank()) {
            return
        }
        // A background refresh never stacks on a load that is still running.
        if (!announce && state.isWarRoomLoading) return
        openWarRoom(warRoomId, announce)
    }

    private fun maybeRefreshScenarioStressTemplates() {
        if (isProTier()) {
            refreshScenarioStressTemplates()
        }
    }

    private fun refreshConvictionForReport(report: DeepDiveReportView) {
        if (!isProTier()) {
            return
        }
        refreshConvictionTimeline(report.ticker)
        refreshOppositeCase(report.reportId)
    }

    private fun isProTier(): Boolean =
        state.userProfile?.tier.equals("PRO", ignoreCase = true)

    fun resumeLastViewed(lastViewedReport: LastViewedReport) {
        when (lastViewedReport.type) {
            "PULSE" -> {
                val referenceDate = lastViewedReport.referenceDate
                if (!referenceDate.isNullOrBlank()) {
                    loadPulseByDate(referenceDate, rememberAsLastViewed = true)
                } else {
                    refreshPulse(rememberAsLastViewed = true)
                }
            }

            else -> openHistoryReport(lastViewedReport.reportId)
        }
    }

    fun refreshPulse(rememberAsLastViewed: Boolean = false) {
        pulseRememberRequested = pulseRememberRequested || rememberAsLastViewed
        pulseRefreshJob?.cancel()
        pulseRequestedDate = null
        val generation = ++pulseGeneration
        publish(state.copy(isPulseRefreshing = true, message = null, pulseError = null))
        pulseRefreshJob = viewModelScope.launch {
          try {
            val fetchLatest: suspend () -> Unit = {
                val pulse = client.getLatestPulse(state.apiBaseUrl, requireTokens().accessToken)
                cacheStore.cachePulse(pulse)
                publish(
                    state.copy(
                        pulseReport = pulse,
                        pulseLoadedFromCache = false,
                        pulseFreshnessText = formatPulseFreshness(pulse.generatedAt, fromCache = false),
                        pulseError = null
                    )
                )
                // Consumed only here, with no suspension point before rememberPulse, so a refresh
                // cancelled mid-way leaves the request for the next one.
                if (pulseRememberRequested) {
                    pulseRememberRequested = false
                    rememberPulse(pulse)
                }
                trackEvent(
                    "pulse_viewed",
                    mapOf("report_id" to pulse.reportId)
                )
                trackEvent(
                    "pulse_opened",
                    mapOf(
                        "report_id" to pulse.reportId,
                        "source" to "network"
                    )
                )
            }
            var error = runAuthorizedWithRefresh(fetchLatest)
            if (error is IOException) {
                // One quiet retry: a single dropped or stale connection should not send the user to the saved copy.
                delay(PULSE_RETRY_DELAY_MS)
                error = runAuthorizedWithRefresh(fetchLatest)
            }
            if (error != null) {
                val failureKind = RefreshFailure.classify(error, isDeviceOnline())
                Log.w(LOG_TAG, RefreshFailure.logLine("pulse", error, failureKind))
                val cachedPulse = cacheStore.getCachedPulse()
                if (cachedPulse != null) {
                    publish(
                        state.copy(
                            pulseReport = cachedPulse,
                            pulseLoadedFromCache = true,
                            pulseFreshnessText = formatPulseFreshness(cachedPulse.generatedAt, fromCache = true),
                            pulseError = null,
                            message = RefreshFailure.cachedPulseMessage(failureKind)
                        )
                    )
                    if (pulseRememberRequested) {
                        pulseRememberRequested = false
                        rememberPulse(cachedPulse)
                    }
                    trackEvent(
                        "cache_hit",
                        mapOf(
                            "artifact" to "pulse_latest",
                            "report_id" to cachedPulse.reportId,
                            "failure_kind" to failureKind.name
                        )
                    )
                    trackEvent(
                        "pulse_opened",
                        mapOf(
                            "report_id" to cachedPulse.reportId,
                            "source" to "cache"
                        )
                    )
                } else {
                    trackEvent(
                        "cache_miss",
                        mapOf("artifact" to "pulse_latest", "failure_kind" to failureKind.name)
                    )
                    val message = toMessage(error).let { generic ->
                        RefreshFailure.noCacheMessage(failureKind) ?: generic
                    }
                    publish(state.copy(message = message, pulseError = message))
                }
            }
          } finally {
            if (generation == pulseGeneration) publish(state.copy(isPulseRefreshing = false))
          }
        }
    }

    fun loadPulseByDate(date: String, rememberAsLastViewed: Boolean = false) {
        // A specific day was asked for: a still-running "latest" refresh must not replace it.
        pulseRefreshJob?.cancel()
        pulseRememberRequested = false
        val trimmed = date.trim()
        // Set before the check, so an entry with a malformed date does not ask again on every recomposition.
        pulseRequestedDate = trimmed
        if (!Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(trimmed)) {
            publish(state.copy(message = "Enter date as YYYY-MM-DD."))
            return
        }
        // Race fix (5.5): the dated load is the Pulse job too, so a later refresh or another date cancels it.
        val generation = ++pulseGeneration
        publish(state.copy(isPulseRefreshing = true, message = null, pulseError = null))
        pulseRefreshJob = viewModelScope.launch {
          try {
            val error = runAuthorizedWithRefresh {
                val pulse = client.getPulseByDate(state.apiBaseUrl, requireTokens().accessToken, trimmed)
                publish(
                    state.copy(
                        pulseReport = pulse,
                        pulseLoadedFromCache = false,
                        pulseFreshnessText = formatPulseFreshness(pulse.generatedAt, fromCache = false),
                        message = "Loaded pulse for $trimmed.",
                        pulseError = null
                    )
                )
                if (rememberAsLastViewed) {
                    rememberPulse(pulse, trimmed)
                }
                trackEvent(
                    "pulse_viewed",
                    mapOf(
                        "report_id" to pulse.reportId,
                        "requested_date" to trimmed
                    )
                )
                trackEvent(
                    "pulse_opened",
                    mapOf(
                        "report_id" to pulse.reportId,
                        "requested_date" to trimmed,
                        "source" to "network"
                    )
                )
            }
            if (error != null) {
                val message = toMessage(error)
                publish(state.copy(message = message, pulseError = message))
            }
          } finally {
            if (generation == pulseGeneration) publish(state.copy(isPulseRefreshing = false))
          }
        }
    }

    fun exportPulsePdf(onReady: (PulsePdfDownload) -> Unit) {
        viewModelScope.launch {
            publish(state.copy(message = null))
            var download: PulsePdfDownload? = null
            val pulse = state.pulseReport
            val exportDate = pulse?.cycleEnd?.take(10)
                ?.takeIf { Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(it) }
            val error = runAuthorizedWithRefresh {
                val accessToken = requireTokens().accessToken
                val bytes = if (exportDate != null) {
                    client.getPulsePdfByDate(state.apiBaseUrl, accessToken, exportDate)
                } else {
                    client.getLatestPulsePdf(state.apiBaseUrl, accessToken)
                }
                val filenameDate = exportDate ?: pulse?.generatedAt?.take(10)?.ifBlank { null } ?: "latest"
                val reportId = pulse?.reportId?.ifBlank { null } ?: "pulse"
                download = PulsePdfDownload(
                    bytes = bytes,
                    filename = "thesis-pulse-$filenameDate-$reportId.pdf"
                )
            }

            if (error != null) {
                publish(state.copy(message = toMessage(error)))
                return@launch
            }

            val ready = download
            if (ready == null) {
                publish(state.copy(message = "Pulse PDF export failed."))
                return@launch
            }

            publish(state.copy(message = "Pulse PDF ready."))
            trackEvent(
                "export_generated",
                mapOf(
                    "artifact" to "pulse_pdf",
                    "report_id" to (pulse?.reportId ?: "unknown")
                )
            )
            onReady(ready)
        }
    }

    fun refreshMacroStress(days: Int = state.sentimentRangeDays) {
        val normalizedDays = normalizeMacroStressRange(days)
        // Update selection immediately so the chosen range is always the one displayed/requested.
        if (state.sentimentRangeDays != normalizedDays) {
            publish(state.copy(sentimentRangeDays = normalizedDays))
        }
        macroStressRefreshJob?.cancel()
        val generation = ++macroGeneration
        publish(state.copy(isMacroRefreshing = true))
        macroStressRefreshJob = viewModelScope.launch {
          try {
            val error = runAuthorizedWithRefresh {
                val current = client.getCurrentMacroStress(
                    state.apiBaseUrl,
                    requireTokens().accessToken
                )
                val history = client.getMacroStressHistory(
                    state.apiBaseUrl,
                    requireTokens().accessToken,
                    normalizedDays
                ).sortedByDescending { it.marketDate }
                cacheStore.cacheSentiment(current, history)
                publish(
                    state.copy(
                        sentimentCurrent = current,
                        sentimentHistory = history,
                        sentimentRangeDays = normalizedDays,
                        sentimentError = null
                    )
                )
            }
            if (error != null) {
                val failureKind = RefreshFailure.classify(error, isDeviceOnline())
                Log.w(LOG_TAG, RefreshFailure.logLine("macro_stress", error, failureKind))
                val cachedCurrent = cacheStore.getCachedSentimentCurrent()
                val cachedHistory = cacheStore.getCachedSentimentHistory(normalizedDays)
                if (cachedCurrent != null || cachedHistory.isNotEmpty()) {
                    publish(
                        state.copy(
                            sentimentCurrent = cachedCurrent,
                            sentimentHistory = cachedHistory,
                            sentimentRangeDays = normalizedDays,
                            sentimentError = RefreshFailure.cachedMacroStressMessage(failureKind)
                        )
                    )
                    trackEvent(
                        "cache_hit",
                        mapOf(
                            "artifact" to "macro_stress",
                            "artifact_legacy" to "sentiment",
                            "range_days" to normalizedDays
                        )
                    )
                } else {
                    trackEvent(
                        "cache_miss",
                        mapOf(
                            "artifact" to "macro_stress",
                            "artifact_legacy" to "sentiment",
                            "range_days" to normalizedDays
                        )
                    )
                    publish(
                        state.copy(
                            sentimentCurrent = null,
                            sentimentHistory = emptyList(),
                            sentimentRangeDays = normalizedDays,
                            sentimentError = toMessage(error)
                        )
                    )
                }
            }
          } finally {
            if (generation == macroGeneration) publish(state.copy(isMacroRefreshing = false))
          }
        }
    }

    fun refreshSentiment(days: Int = state.sentimentRangeDays) {
        refreshMacroStress(days)
    }

    fun openMacroStressDashboard(rangeDays: Int = state.sentimentRangeDays) {
        val normalizedDays = normalizeMacroStressRange(rangeDays)
        refreshMacroStress(normalizedDays)
        trackEvent(
            "macro_stress_dashboard_opened",
            mapOf("range_days" to normalizedDays)
        )
        // Keep legacy event for downstream analytics compatibility during transition.
        trackEvent(
            "sentiment_dashboard_opened",
            mapOf("range_days" to normalizedDays)
        )
    }

    fun openSentimentDashboard(rangeDays: Int = state.sentimentRangeDays) {
        openMacroStressDashboard(rangeDays)
    }

    fun openWeeklyDigest(fromPush: Boolean) {
        trackEvent(
            "weekly_digest_opened",
            mapOf("from_push" to fromPush)
        )
    }

    /** [thenSnapshots]: refresh the board's snapshots after the list (false when the caller refreshes them itself). */
    fun refreshWatchlist(thenSnapshots: Boolean = true) {
        boardStarted()
        withAuthorizedCall(onDone = ::boardFinished) {
            val items = client.getWatchlist(state.apiBaseUrl, requireTokens().accessToken)
            publish(state.copy(watchlist = items, watchlistLoaded = true))
            if (thenSnapshots) refreshMonitorSnapshots()
        }
    }

    fun addWatchlistTicker(ticker: String) {
        if (!state.watchlistFeatureEnabled) {
            publish(state.copy(message = "Watchlist is currently disabled by feature flag."))
            return
        }
        withAuthorizedCall {
            val normalized = ticker.trim().uppercase()
            val items = client.addWatchlistTicker(
                state.apiBaseUrl,
                requireTokens().accessToken,
                normalized
            )
            publish(state.copy(watchlist = items, message = "$normalized added to watchlist."))
            trackEvent(
                "watchlist_ticker_added",
                mapOf("ticker" to normalized, "watchlist_size" to items.size)
            )
            refreshMonitorSnapshots()
        }
    }

    suspend fun importHoldingsCsv(csv: String): Result<HoldingsImportResultView> {
        var result: HoldingsImportResultView? = null
        val error = runAuthorizedWithRefresh {
            result = client.importHoldingsCsv(state.apiBaseUrl, requireTokens().accessToken, csv)
        }
        val imported = result
        if (error != null || imported == null) {
            return Result.failure(IllegalStateException(toMessage(error ?: IllegalStateException("Import failed."))))
        }
        publish(state.copy(watchlist = imported.watchlist))
        refreshMonitorSnapshots()
        return Result.success(imported)
    }

    fun removeWatchlistTicker(ticker: String) {
        if (!state.watchlistFeatureEnabled) {
            publish(state.copy(message = "Watchlist is currently disabled by feature flag."))
            return
        }
        withAuthorizedCall {
            val normalized = ticker.trim().uppercase()
            val items = client.removeWatchlistTicker(
                state.apiBaseUrl,
                requireTokens().accessToken,
                normalized
            )
            publish(state.copy(watchlist = items, message = "$normalized removed from watchlist."))
            trackEvent(
                "watchlist_ticker_removed",
                mapOf("ticker" to normalized, "watchlist_size" to items.size)
            )
            refreshMonitorSnapshots()
        }
    }

    fun refreshAlertLedger() {
        state.tokens ?: return
        inboxInFlight++
        publish(state.copy(isInboxRefreshing = true))
        viewModelScope.launch {
          try {
            val error = runAuthorizedWithRefresh {
                // requireTokens(), not the tokens captured above: after a token refresh the retry needs the new one.
                val alerts = client.getAlertLedger(
                    state.apiBaseUrl,
                    requireTokens().accessToken
                )
                publish(
                    state.copy(
                        alertLedger = alerts,
                        inboxError = null
                    )
                )
            }
            if (error != null) {
                publish(state.copy(inboxError = toMessage(error)))
            }
          } finally {
            inboxInFlight = (inboxInFlight - 1).coerceAtLeast(0)
            publish(state.copy(isInboxRefreshing = inboxInFlight > 0))
          }
        }
    }

    fun refreshMonitorSnapshots() {
        state.tokens ?: return
        boardStarted()
        viewModelScope.launch {
          try {
            runAuthorizedWithRefresh {
                val snapshots = client.getMonitorSnapshots(
                    state.apiBaseUrl,
                    requireTokens().accessToken
                )
                publish(state.copy(monitorSnapshots = snapshots))
                // 5.5: every board refresh appends to the 90-day history; deltas compare to the last Names visit.
                runCatchingNonCancellation { cacheStore.appendSnapshotHistory(snapshots) }
                publish(state.copy(snapshotDeltas = computeSnapshotDeltas(snapshots, state.lastNamesVisitAtMs)))
            }
          } finally {
            boardFinished()
          }
        }
    }

    private fun boardStarted() {
        boardInFlight++
        if (!state.isBoardRefreshing) publish(state.copy(isBoardRefreshing = true))
    }

    private fun boardFinished() {
        boardInFlight = (boardInFlight - 1).coerceAtLeast(0)
        if (boardInFlight == 0) publish(state.copy(isBoardRefreshing = false))
    }

    private suspend fun pollDeepDiveJob(jobId: String) {
        val current = currentCoroutineContext()[Job]
        // One poll at a time: an older poll still running (it should not be; see decideDeepDiveStart) stops here.
        deepDivePoll?.takeIf { it !== current && it.isActive }?.cancel()
        deepDivePoll = current
        // Up to 6 minutes at a 2 s interval: a cloud runner needs a few minutes to start and finish.
        repeat(DEEP_DIVE_MAX_POLLS) {
            val status = client.getJobStatus(state.apiBaseUrl, requireTokens().accessToken, jobId)
            if (activeDeepDiveJobId != jobId) return
            publish(state.copy(jobStatus = status.status))
            when (status.status) {
                "complete" -> {
                    val reportId = status.reportId
                    if (!reportId.isNullOrBlank()) {
                        if (!endDeepDiveJob(jobId)) return
                        val report = client.getDeepDiveReport(
                            state.apiBaseUrl,
                            requireTokens().accessToken,
                            reportId
                        )
                        val note = runCatchingNonCancellation {
                            client.getReportNote(state.apiBaseUrl, requireTokens().accessToken, report.reportId)
                        }.getOrNull()
                        cacheStore.cacheDeepDive(report, notePinned = !note?.content.isNullOrBlank())
                        cacheReportExtras(report, note)
                        // The running entry becomes the report (4.5), wherever it is on the stacks. When the user
                        // backed out of it (5.14), the snackbar offers Open instead.
                        val built = report.ticker?.trim()?.uppercase()
                        val replaced = navigator.replaceWhere(
                            Destination.Report(report.reportId, report.ticker)
                        ) { destination ->
                            destination is Destination.DeepDiveRunning &&
                                (built == null || destination.ticker.equals(built, ignoreCase = true))
                        }
                        publish(
                            state.copy(
                                isDeepDiveRunning = false,
                                deepDiveReport = report,
                                deepDiveLoadedFromCache = false,
                                reportNote = note,
                                reportNoteDraft = note?.content ?: "",
                                isSavingNote = false,
                                convictionTimeline = emptyList(),
                                convictionTimelineError = null,
                                oppositeCase = null,
                                oppositeCaseError = null,
                                isGeneratingOppositeCase = false,
                                scenarioResult = null,
                                isRunningScenario = false,
                                message = DEEP_DIVE_READY_MESSAGE,
                                messageAction = if (replaced == 0) {
                                    MessageAction.OpenReport(DEEP_DIVE_READY_MESSAGE, report.reportId, report.ticker)
                                } else {
                                    null
                                },
                                deepDiveError = null
                            )
                        )
                        val tickerSafe = report.ticker ?: "unknown"
                        sessionStore.saveLastViewedReport(report.reportId, tickerSafe, "DEEP_DIVE")
                        publish(state.copy(lastViewedReport = sessionStore.getLastViewedReport()))
                        refreshReportHistory()
                        refreshMonitorSnapshots()
                        refreshConvictionForReport(report)
                        trackEvent(
                            "deep_dive_viewed",
                            mapOf(
                                "report_id" to report.reportId,
                                "ticker" to tickerSafe
                            )
                        )
                        trackEvent(
                            "report_opened",
                            mapOf(
                                "report_id" to report.reportId,
                                "source" to "deep_dive_complete"
                            )
                        )
                        return
                    }
                }
                "failed" -> {
                    if (!endDeepDiveJob(jobId)) return
                    val failureMessage = status.errorMessage ?: "Deep Dive failed."
                    publish(
                        state.copy(
                            isDeepDiveRunning = false,
                            message = failureMessage,
                            deepDiveError = failureMessage
                        )
                    )
                    return
                }
            }
            delay(DEEP_DIVE_POLL_INTERVAL_MS)
        }
        if (!endDeepDiveJob(jobId)) return
        publish(
            state.copy(
                isDeepDiveRunning = false,
                message = "Deep Dive timed out. Please retry.",
                deepDiveError = "Deep Dive timed out. Please retry."
            )
        )
    }

    /**
     * Runs [block] with a token refresh on 401; errors become a message (or the paywall). No global loading flag:
     * callers set their own ([onDone] runs on success, failure and cancellation; [onError] after a failure).
     */
    private fun withAuthorizedCall(
        onDone: () -> Unit = {},
        onError: () -> Unit = {},
        block: suspend () -> Unit
    ) {
        viewModelScope.launch {
          try {
            publish(state.copy(message = null))
            val error = runAuthorizedWithRefresh(block)
            if (error != null) {
                val upgrade = (error as? ProductApiException)
                    ?.takeIf { it.code == 403 && it.errorCode == "upgrade_required" }
                if (upgrade != null) {
                    publish(
                        state.copy(
                            paywallFeature = upgrade.feature ?: "pro_features",
                            message = upgrade.message
                        )
                    )
                } else {
                    publish(state.copy(message = toMessage(error)))
                }
                onError()
            }
          } finally {
            onDone()
          }
        }
    }

    private suspend fun runAuthorizedWithRefresh(block: suspend () -> Unit): Throwable? {
        return runCatching {
            block()
        }.recoverCatching { error ->
            if (error is CancellationException) {
                throw error
            }
            if (error is ProductApiException && error.code == 401) {
                if (tryRefreshToken()) {
                    block()
                } else {
                    clearLocalSession("Session expired. Please log in again.")
                    throw ProductApiException(401, "Session expired. Please log in again.")
                }
            } else {
                throw error
            }
        }.exceptionOrNull().also { error ->
            // A cancelled coroutine (screen closed, newer refresh started) is not an error to show.
            if (error is CancellationException) {
                throw error
            }
        }
    }

    private fun isDeviceOnline(): Boolean = runCatching {
        val connectivity = getApplication<Application>()
            .getSystemService(ConnectivityManager::class.java) ?: return@runCatching true
        val capabilities = connectivity.getNetworkCapabilities(connectivity.activeNetwork)
            ?: return@runCatching false
        capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }.getOrDefault(true)

    private suspend fun clearLocalSession(message: String) {
        PrefetchScheduler.cancel(getApplication<Application>().applicationContext)
        cacheStore.clearAll()
        sessionStore.clearLastViewedReport()
        sessionStore.clearTokens()
        deepDivePoll?.cancel()
        activeDeepDiveJobId = null
        clearDeepDiveInFlight()
        sessionStore.clearVisitMarkers()
        tabFetchedAtMs.clear()
        navigator.reset()
        val hasSeenWelcome = sessionStore.hasSeenWelcome()
        publish(
            state.copy(
                showWelcome = !hasSeenWelcome,
                tokens = null,
                tickers = emptyList(),
                selectedTicker = null,
                deepDiveReport = null,
                deepDiveLoadedFromCache = false,
                reportNote = null,
                reportNoteDraft = "",
                isSavingNote = false,
                convictionTimeline = emptyList(),
                convictionTimelineError = null,
                convictionInsights = emptyList(),
                convictionInsightsError = null,
                oppositeCase = null,
                oppositeCaseError = null,
                isGeneratingOppositeCase = false,
                scenarioStressTemplates = emptyList(),
                selectedScenarioStressId = null,
                scenarioStressRun = null,
                scenarioStressTemplatesError = null,
                scenarioStressRunError = null,
                isLoadingScenarioStressTemplates = false,
                isRunningScenarioStress = false,
                scenarioResult = null,
                isRunningScenario = false,
                pulseReport = null,
                pulseLoadedFromCache = false,
                pulseFreshnessText = null,
                pulseError = null,
                sentimentCurrent = null,
                sentimentHistory = emptyList(),
                sentimentRangeDays = 30,
                sentimentError = null,
                alertLedger = emptyList(),
                inboxError = null,
                monitorSnapshots = emptyList(),
                warRoom = null,
                warRoomError = null,
                deepDiveError = null,
                watchlist = emptyList(),
                reportHistory = emptyList(),
                watchlistLoaded = false,
                reportHistoryLoaded = false,
                notificationPreferences = defaultNotificationPreferences(),
                lastViewedReport = null,
                jobStatus = null,
                watchlistFeatureEnabled = true,
                userProfile = null,
                paywallFeature = null,
                subscriptionOffers = emptyList(),
                subscriptionActionInFlight = false,
                authBusy = false,
                isDeepDiveRunning = false,
                deepDiveBuildTicker = null,
                isOpeningReport = false,
                lastInboxVisitAtMs = 0L,
                lastNamesVisitAtMs = 0L,
                snapshotDeltas = emptyMap(),
                nameDetail = null,
                notesTrails = emptyMap(),
                allNotes = emptyList(),
                compareReports = null,
                compareNames = null,
                searchResults = null,
                message = message
            )
        )
    }

    // NonCancellable: refresh tokens rotate, so a token refresh that started must finish and save the new
    // tokens even if the refresh that asked for it is cancelled (for example by a newer Pulse refresh).
    // Otherwise a cancelled refresh would look like a failed one and log the user out.
    private suspend fun tryRefreshToken(): Boolean = withContext(NonCancellable) {
        val current = state.tokens ?: return@withContext false
        runCatching {
            client.refresh(state.apiBaseUrl, current.refreshToken)
        }.onSuccess { newTokens ->
            sessionStore.saveTokens(newTokens)
            sessionStore.setHasSeenWelcome(true)
            publish(state.copy(tokens = newTokens))
            refreshNotificationPreferences()
        }.isSuccess
    }

    private fun refreshNotificationPreferences() {
        val tokens = state.tokens ?: return
        viewModelScope.launch {
            val error = runAuthorizedWithRefresh {
                val preferences = client.getNotificationPreferences(
                    state.apiBaseUrl,
                    tokens.accessToken
                )
                publish(state.copy(notificationPreferences = mergeNotificationPreferences(preferences)))
            }

            if (error != null) {
                return@launch
            }
        }
    }

    private suspend fun syncPushToken() {
        val tokens = state.tokens ?: return
        if (!state.notificationsEnabled) {
            runCatching {
                client.updateDeviceToken(
                    state.apiBaseUrl,
                    tokens.accessToken,
                    null,
                    sessionStore.getInstallationId()
                )
            }
            return
        }

        val firebaseToken = runCatching {
            FirebaseMessaging.getInstance().token.await()
        }.getOrNull()

        if (firebaseToken.isNullOrBlank()) {
            return
        }

        runCatching {
            client.updateDeviceToken(
                state.apiBaseUrl,
                tokens.accessToken,
                firebaseToken,
                sessionStore.getInstallationId()
            )
        }
    }

    private fun refreshUserProfile() {
        withAuthorizedCall {
            val profile = client.getUserProfile(state.apiBaseUrl, requireTokens().accessToken)
            // Links pre-login events (installation id) to the signed-in user for retention.
            trackEvent("\$identify", mapOf("\$anon_distinct_id" to installationDistinctId))
            val isPro = profile.tier.equals("PRO", ignoreCase = true)
            publish(
                state.copy(
                    userProfile = profile,
                    scenarioStressTemplates = if (isPro) state.scenarioStressTemplates else emptyList(),
                    selectedScenarioStressId = if (isPro) state.selectedScenarioStressId else null,
                    scenarioStressRun = if (isPro) state.scenarioStressRun else null,
                    scenarioStressTemplatesError = if (isPro) state.scenarioStressTemplatesError else null,
                    scenarioStressRunError = if (isPro) state.scenarioStressRunError else null
                )
            )
            if (isPro) {
                refreshScenarioStressTemplates()
            }
            if (loadYouInsightsWithProfile) {
                loadYouInsightsWithProfile = false
                refreshConvictionInsights()
            }
        }
    }

    private fun Destination.isYouEntry(): Boolean = this == Destination.You || this is Destination.YouPage

    private fun refreshFeatureFlags() {
        viewModelScope.launch {
            val value = runCatching { telemetry.fetchWatchlistFlag(distinctId()) }.getOrNull()
            if (value != null) {
                publish(
                    state.copy(
                        watchlistFeatureEnabled = value
                    )
                )
            }
        }
    }

    private fun trackEvent(event: String, properties: Map<String, Any?> = emptyMap()) {
        viewModelScope.launch {
            runCatching {
                telemetry.capture(
                    event = event,
                    distinctId = distinctId(),
                    properties = properties
                )
            }
        }
    }

    private fun distinctId(): String {
        val authDistinctId = parseJwtSubject(state.tokens?.accessToken)
        return authDistinctId ?: installationDistinctId
    }

    private fun parseJwtSubject(token: String?): String? {
        if (token.isNullOrBlank()) {
            return null
        }
        val parts = token.split("\\.".toRegex())
        if (parts.size != 3) {
            return null
        }
        return runCatching {
            val decoded = Base64.decode(parts[1], Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
            val payload = JSONObject(String(decoded, Charsets.UTF_8))
            payload.optString("sub").ifBlank { null }
        }.getOrNull()
    }

    private fun requireTokens(): AuthTokens =
        state.tokens ?: throw ProductApiException(401, "Authentication required.")

    private fun toMessage(error: Throwable): String {
        trackApiError(error)
        return when (error) {
            is ProductApiException -> error.message
            is IOException -> "No internet connection. Please check network and retry."
            else -> error.message ?: "Unexpected error."
        }
    }

    private fun rememberPulse(pulse: PulseReportView, fallbackDate: String? = null) {
        val referenceDate = fallbackDate ?: pulse.generatedAt.take(10)
        sessionStore.saveLastViewedReport(
            reportId = pulse.reportId,
            label = "Morning Pulse",
            type = "PULSE",
            referenceDate = referenceDate
        )
        publish(state.copy(lastViewedReport = sessionStore.getLastViewedReport()))
    }

    private fun publish(newState: UiState) {
        state = newState
        observer?.invoke(state)
    }

    private fun replaceAlertLedgerItem(updated: AlertLedgerItemView): List<AlertLedgerItemView> {
        val existing = state.alertLedger
        if (existing.none { it.id == updated.id }) {
            return listOf(updated) + existing
        }
        return existing.map { item ->
            if (item.id == updated.id) updated else item
        }
    }

    private fun mergeNotificationPreferences(
        fetched: List<NotificationPreferenceView>
    ): List<NotificationPreferenceView> {
        val byType = fetched.associateBy { it.type.trim() }
        return notificationPreferenceTypes.map { type ->
            byType[type] ?: NotificationPreferenceView(type = type, enabled = true, quietUntil = null)
        }
    }

    private fun normalizeMacroStressRange(days: Int): Int =
        when (days) {
            7, 14, 30, 90 -> days
            else -> 30
        }

    private fun formatPulseFreshness(generatedAt: String, fromCache: Boolean): String {
        val parsed = runCatching {
            Instant.parse(generatedAt)
                .atZone(ZoneId.of("America/New_York"))
                .format(DateTimeFormatter.ofPattern("MMM d, HH:mm z"))
        }.getOrElse { generatedAt }
        return if (fromCache) {
            "Offline cache • Last updated $parsed"
        } else {
            "Last updated $parsed"
        }
    }

    private fun trackApiError(error: Throwable) {
        val apiError = error as? ProductApiException
        viewModelScope.launch {
            runCatching {
                telemetry.capture(
                    event = "api_error",
                    distinctId = distinctId(),
                    properties = mapOf(
                        "http_code" to apiError?.code,
                        "error_code" to apiError?.errorCode,
                        "message" to (error.message ?: error::class.java.simpleName)
                    )
                )
            }
        }
    }

    // =====================================================================================================
    // Navigation (DESIGN-DIRECTION 4.5, 5.5): the ViewModel owns the stacks, so an intent moves the stack and
    // loads its data in one place. `ThesisShell` calls these through [ShellActions].
    // =====================================================================================================

    /** A notification, App Link or launcher shortcut (see [DeepLinkRouter.route]). Ignored while logged out. */
    fun applyLaunchTarget(target: LaunchTarget) {
        if (state.tokens == null) return
        val route = DeepLinkRouter.route(target) ?: return
        // A notification or link means the server has something new: refetch the landing tab even when its data is
        // under five minutes old (the 5-minute rule is for tab switches; 5.5 keeps deep links as they were).
        applyRoute(route, forceRefresh = true) { tab ->
            trackPushDeepLinkLanded(
                targetTab = tab,
                notificationType = target.notificationType,
                ticker = target.ticker,
                alertId = target.alertId,
                warRoomId = target.warRoomId,
                scenarioId = target.scenarioId,
                scenarioRunId = target.scenarioRunId
            )
        }
    }

    private fun applyRoute(route: NavRoute, forceRefresh: Boolean = false, onLanded: (String) -> Unit = {}) {
        val previousTab = navigator.currentTab
        // The tab refresh runs before the route's own loads, so a dated Pulse load below cancels a "latest" refresh
        // (5.5 race fix) and never the other way round. A route that opens a Pulse loads it itself.
        val opensPulse = route.actions.any { it is RouteAction.OpenPulse }
        // Entries the route pops (a dated Pulse under the landing tab) are undone like a back; a route that loads
        // the Pulse itself replaces the shared Pulse anyway.
        navigator.apply(route, onRemoved = { removed ->
            if (!opensPulse || removed.destination !is Destination.Pulse) onEntryPopped(removed)
        })
        noteTabLeft(previousTab, navigator.currentTab)
        route.tab?.let { refreshTab(it, force = forceRefresh, skipPulse = opensPulse) }
        if (route.modal is Destination.You) refreshYou()
        route.actions.forEach { action ->
            when (action) {
                is RouteAction.OpenPulse -> openPulseFromNotification(action.date)
                is RouteAction.OpenWeeklyDigest -> openWeeklyDigest(action.fromPush)
                is RouteAction.OpenWarRoom -> openWarRoom(action.warRoomId)
                is RouteAction.OpenScenarioRun -> openScenarioStressRun(action.runId, action.scenarioId)
                is RouteAction.SelectScenario -> selectScenarioStressTemplate(action.scenarioId)
                is RouteAction.OpenReport -> openHistoryReport(action.reportId)
                is RouteAction.SelectTicker -> selectTicker(action.ticker)
                // The route already pushed DeepDiveRunning(ticker); while another build runs, that entry shows it instead.
                is RouteAction.RunDeepDive -> startOrShowDeepDive(action.ticker) {}
                is RouteAction.TrackLanded -> onLanded(action.tab)
            }
        }
    }

    /** Leaving Names or Inbox moves its "since your last visit" marker (client-only, SessionStore). */
    private fun noteTabLeft(from: ShellTab, to: ShellTab) {
        if (from == to) return
        val now = System.currentTimeMillis()
        when (from) {
            ShellTab.Inbox -> {
                sessionStore.saveLastInboxVisitAtMs(now)
                publish(state.copy(lastInboxVisitAtMs = now))
            }
            ShellTab.Names -> {
                sessionStore.saveLastNamesVisitAtMs(now)
                publish(state.copy(lastNamesVisitAtMs = now))
            }
            else -> Unit
        }
    }

    /**
     * Undo work tied to an entry that left the stacks: by back, a tab reselect, a route or a jump to a tab's root.
     */
    private fun onEntryPopped(entry: NavEntry) {
        when (val destination = entry.destination) {
            // A past Pulse replaced the shared Pulse; once it is gone the latest issue comes back (once, even when
            // several dated entries leave together).
            is Destination.Pulse -> if (destination.date != null && pulseRequestedDate != null) refreshPulse()
            else -> Unit
        }
    }

    override fun onSelectTab(tab: ShellTab) {
        val previous = navigator.currentTab
        navigator.selectTab(tab, ::onEntryPopped)
        noteTabLeft(previous, tab)
        refreshTab(tab, force = false)
    }

    override fun onBack(): Boolean {
        // Back from another tab's root switches to Today: that leaves Names or Inbox, so move its marker.
        val previousTab = navigator.currentTab
        val handled = navigator.back(::onEntryPopped)
        noteTabLeft(previousTab, navigator.currentTab)
        return handled
    }

    override fun onOpenYou() {
        if (navigator.modalStack.lastOrNull()?.destination != Destination.You) navigator.openModal(Destination.You)
        refreshYou()
    }

    override fun onOpenSearch() {
        if (navigator.modalStack.lastOrNull()?.destination != Destination.Search) navigator.openModal(Destination.Search)
    }

    override fun onCloseModal() {
        navigator.closeModals()
    }

    override fun onOpenAlert(alert: AlertLedgerItemView) {
        applyRoute(DeepLinkRouter.routeAlert(alert))
    }

    override fun onOpenReport(reportId: String, ticker: String?) {
        navigator.closeModals()
        navigator.push(Destination.Report(reportId, ticker?.trim()?.uppercase()?.ifBlank { null }))
        openHistoryReport(reportId)
    }

    override fun onEnsureReport(reportId: String) {
        if (state.deepDiveReport?.reportId != reportId) openHistoryReport(reportId)
    }

    override fun onEnsurePulse(date: String) {
        if (pulseRequestedDate != date.trim()) loadPulseByDate(date)
    }

    override fun onReloadPulse(date: String) = loadPulseByDate(date)

    override fun onRunDeepDive(ticker: String) {
        val symbol = ticker.trim().uppercase()
        if (symbol.isBlank()) {
            publish(state.copy(message = "Select a ticker first."))
            return
        }
        startOrShowDeepDive(symbol) { navigator.push(Destination.DeepDiveRunning(it)) }
    }

    override fun onRetryDeepDive(ticker: String) {
        val symbol = ticker.trim().uppercase()
        if (symbol.isBlank()) {
            publish(state.copy(message = "Select a ticker first."))
            return
        }
        // Retry on a failed running entry rebuilds in place; from anywhere else it pushes a new running entry.
        startOrShowDeepDive(symbol) {
            if (navigator.tabTop.destination is Destination.DeepDiveRunning) {
                navigator.replaceTop(Destination.DeepDiveRunning(it))
            } else {
                navigator.push(Destination.DeepDiveRunning(it))
            }
        }
    }

    /**
     * Starts [ticker]'s build, or shows the build already running (one at a time, see [decideDeepDiveStart]):
     * a double tap during the push, a Run after backing out of a running build, a research link or a Retry never
     * start a second job. [showEntry] puts the new build's running entry on screen before it starts.
     */
    private fun startOrShowDeepDive(ticker: String, showEntry: (String) -> Unit) {
        navigator.closeModals()
        val decision = decideDeepDiveStart(
            requested = ticker,
            isRunning = state.isDeepDiveRunning,
            runningTicker = state.deepDiveBuildTicker,
            top = navigator.tabTop.destination
        )
        when (decision) {
            is DeepDiveStartDecision.Start -> {
                selectTicker(decision.ticker)
                showEntry(decision.ticker)
                runDeepDive()
            }
            is DeepDiveStartDecision.ShowRunning -> {
                val running = Destination.DeepDiveRunning(decision.runningTicker)
                when {
                    decision.alreadyShowing -> Unit
                    decision.replaceTop -> navigator.replaceTop(running)
                    else -> navigator.push(running)
                }
                decision.message?.let { publish(state.copy(message = it)) }
            }
        }
    }

    override fun onOpenResearchFor(ticker: String) {
        selectTicker(ticker)
        onSelectTab(ShellTab.Research)
        navigator.popToRoot(ShellTab.Research, ::onEntryPopped)
    }

    override fun onOpenHistory() {
        navigator.push(Destination.History())
        refreshReportHistory()
    }

    override fun onOpenHistoryItem(item: ReportHistoryItem) {
        if (item.type == "deep_dive") onOpenReport(item.reportId, item.ticker) else onOpenPulse(item.createdAt.take(10))
    }

    override fun onOpenPulse(date: String?) {
        val day = date?.trim()?.ifBlank { null }
        navigator.closeModals()
        navigator.push(Destination.Pulse(day))
        if (day != null) loadPulseByDate(day, rememberAsLastViewed = true)
    }

    override fun onOpenMacroStress() {
        navigator.push(Destination.MacroStress)
        openMacroStressDashboard()
    }

    override fun onOpenWeeklyDigest(date: String?) {
        navigator.push(Destination.WeeklyDigest(date))
        openWeeklyDigest(fromPush = false)
    }

    override fun onOpenWarRoom(warRoomId: String) {
        navigator.push(Destination.WarRoom(warRoomId))
        openWarRoom(warRoomId)
    }

    override fun onEnsureWarRoom(warRoomId: String) {
        if (state.warRoom?.warRoomId != warRoomId && !state.isWarRoomLoading) openWarRoom(warRoomId)
    }

    override fun onOpenScenarioStress() {
        navigator.push(Destination.ScenarioStress(ticker = state.deepDiveReport?.ticker))
        maybeRefreshScenarioStressTemplates()
    }

    override fun onEnsureScenarioStress(runId: String?, scenarioId: String?) {
        if (!isProTier()) return
        if (state.scenarioStressTemplates.isEmpty() && !state.isLoadingScenarioStressTemplates) {
            refreshScenarioStressTemplates()
        }
        val run = runId?.trim()?.ifBlank { null } ?: return
        if (state.scenarioStressRun?.run?.scenarioRunId != run && !state.isRunningScenarioStress) {
            openScenarioStressRun(run, scenarioId)
        }
    }

    override fun onOpenName(ticker: String) {
        navigator.push(Destination.Name(ticker.trim().uppercase()))
        openName(ticker)
    }

    override fun onResumeLastViewed(report: LastViewedReport) {
        if (report.type == "PULSE") {
            navigator.push(Destination.Pulse(report.referenceDate?.ifBlank { null }))
            resumeLastViewed(report)
        } else {
            navigator.push(Destination.Report(report.reportId))
            openHistoryReport(report.reportId)
        }
    }

    override fun onDismissResumeCard() = dismissResumeCard()

    override fun onRefreshPulse() = refreshPulse()
    override fun onSelectMacroRange(days: Int) = openMacroStressDashboard(days)
    override fun onRefreshMacro() = refreshMacroStress()

    override fun onRefreshNames() {
        tabFetchedAtMs[ShellTab.Names] = System.currentTimeMillis()
        // The snapshots refresh on their own, so the board's states and scores update even when the list call fails.
        refreshWatchlist(thenSnapshots = false)
        refreshMonitorSnapshots()
        refreshAlertLedger()
    }

    override fun onAddName(ticker: String) = addWatchlistTicker(ticker)
    override fun onRemoveName(ticker: String) = removeWatchlistTicker(ticker)
    override suspend fun onImportHoldingsCsv(csv: String): Result<HoldingsImportResultView> = importHoldingsCsv(csv)

    override fun onRefreshInbox() = refreshAlertLedger()
    override fun onSubmitAlertFeedback(alertId: String, feedback: String) = submitAlertFeedback(alertId, feedback)
    override fun onMuteAlert(alertId: String) = muteAlert(alertId)

    override fun onMarkInboxSeen() {
        val now = System.currentTimeMillis()
        sessionStore.saveLastInboxVisitAtMs(now)
        publish(state.copy(lastInboxVisitAtMs = now))
    }

    override fun onTickerChange(ticker: String) = selectTicker(ticker)
    override fun onReportNoteChange(content: String) = updateReportNoteDraft(content)
    override fun onSaveReportNote() = saveReportNote()
    override fun onGenerateOppositeCase() = generateOppositeCase()
    override fun onRefreshConviction() = refreshConvictionTimeline()
    override fun onRunScenario(years: Int?, growth: Double?, wacc: Double?) = runScenario(years, growth, wacc)
    override fun onSubmitReportFeedback(code: String, message: String) = submitReportFeedback(code, message)
    override fun onNotify(message: String) = notifyUser(message)
    override fun onRefreshPageToken(onResult: (String?) -> Unit) = refreshAccessTokenForPage(onResult)
    override fun onRefreshWarRoom() = refreshWarRoom()
    override fun onAutoRefreshWarRoom() = refreshWarRoom(announce = false)
    override fun onRefreshScenarioTemplates() = refreshScenarioStressTemplates(force = true)
    override fun onSelectScenarioTemplate(scenarioId: String) = selectScenarioStressTemplate(scenarioId)
    override fun onRunScenarioStress(scenarioId: String?) = runScenarioStress(scenarioId)
    override fun onOpenScenarioRun(runId: String, scenarioId: String?) = openScenarioStressRun(runId, scenarioId)

    override fun onSetNotificationsEnabled(enabled: Boolean) = setNotificationsEnabled(enabled)
    override fun onSetBiometricLock(enabled: Boolean) = setBiometricLockEnabled(enabled)
    override fun onSetNotificationPreference(type: String, enabled: Boolean) = setNotificationPreference(type, enabled)
    override fun onSaveApiBaseUrl(url: String) = updateApiBaseUrl(url)
    override fun onSyncTier() = syncTierFromServer()
    override fun onRefreshConvictionInsights() = refreshConvictionInsights()
    override fun onRefreshOffers() = refreshSubscriptionOffers()
    override fun onRestorePurchases() = restorePurchases()
    override fun onSubmitSubscriptionFeedback(code: String, sourceSurface: String, message: String, promptWinBack: Boolean) =
        submitSubscriptionFeedback(code, sourceSurface, message, promptWinBack)

    override fun onSetAppearance(value: AppearancePrefs) {
        sessionStore.saveAppearance(value)
        publish(state.copy(appearance = value))
    }

    override fun onLogout() = logout()
    override fun onRequireUpgrade(feature: String) = requestFeatureUpgrade(feature)
    override fun onDismissPaywall() = dismissPaywall()
    override fun onMessageShown() = clearMessage()

    override fun onMessageAction(action: MessageAction) {
        when (action) {
            is MessageAction.OpenReport -> onOpenReport(action.reportId, action.ticker)
        }
    }

    // =====================================================================================================
    // Client data layer for PR-3 (5.5): built from endpoints the app already calls, cached in Room.
    // =====================================================================================================

    /** Caches what Name, Compare and the notes trail read later (report summary and note). Never throws. */
    private suspend fun cacheReportExtras(report: DeepDiveReportView, note: ReportNoteView?) {
        runCatchingNonCancellation { cacheStore.cacheReportSummary(report) }
        if (note != null) runCatchingNonCancellation { cacheStore.cacheReportNote(report.reportId, note, report) }
    }

    private suspend fun computeSnapshotDeltas(
        snapshots: List<ThesisMonitorSnapshotView>,
        sinceMs: Long
    ): Map<String, SnapshotDelta> {
        if (sinceMs <= 0L) return emptyMap()
        val takenAt = System.currentTimeMillis()
        return snapshots.mapNotNull { snapshot ->
            val ticker = snapshot.ticker.trim().uppercase().ifBlank { return@mapNotNull null }
            val current = SnapshotPoint(ticker, takenAt, snapshot.state, snapshot.score, snapshot.freshnessScore, snapshot.reportId)
            val previous = runCatchingNonCancellation { cacheStore.getSnapshotAtOrBefore(ticker, sinceMs) }.getOrNull()
            ticker to snapshotDeltaSince(current, listOfNotNull(previous), sinceMs)
        }.toMap()
    }

    /** The change of [ticker] since the last Names visit; null until the history has an older reading. */
    fun snapshotDelta(ticker: String): SnapshotDelta? = state.snapshotDeltas[ticker.trim().uppercase()]

    /** Last Names / Inbox visit (epoch ms, 0 = never). */
    val lastNamesVisitAt: Long get() = state.lastNamesVisitAtMs
    val lastInboxVisitAt: Long get() = state.lastInboxVisitAtMs

    /** Fills [UiState.nameDetail] for [ticker]: snapshot, delta, latest report summary, notes trail, alerts. */
    fun openName(ticker: String) {
        val symbol = ticker.trim().uppercase().ifBlank { return }
        fun assemble(summary: ReportSummaryView?, trail: List<NoteTrailEntry>, loading: Boolean) = NameDetailView(
            ticker = symbol,
            snapshot = state.monitorSnapshots.firstOrNull { it.ticker.equals(symbol, ignoreCase = true) },
            delta = state.snapshotDeltas[symbol],
            summary = summary,
            notesTrail = trail,
            alerts = state.alertLedger.filter { alert ->
                alert.ticker.equals(symbol, ignoreCase = true) ||
                    alert.relatedTickers.any { it.equals(symbol, ignoreCase = true) }
            },
            reports = state.reportHistory.filter { it.ticker.equals(symbol, ignoreCase = true) },
            isLoading = loading
        )
        publish(state.copy(nameDetail = assemble(null, state.notesTrails[symbol].orEmpty(), loading = true)))
        viewModelScope.launch {
            val reportId = state.monitorSnapshots.firstOrNull { it.ticker.equals(symbol, ignoreCase = true) }?.reportId
                ?: state.reportHistory.filter { it.ticker.equals(symbol, true) && it.type == "deep_dive" }
                    .maxByOrNull { it.createdAt }?.reportId
            var summary = reportId?.let { runCatchingNonCancellation { cacheStore.getReportSummary(it) }.getOrNull() }
            if (summary == null && reportId != null) {
                runAuthorizedWithRefresh {
                    val report = client.getDeepDiveReport(state.apiBaseUrl, requireTokens().accessToken, reportId)
                    cacheReportExtras(report, null)
                    summary = report.toSummaryOrNull()
                }
            }
            val trail = loadNotesTrail(symbol)
            if (state.nameDetail?.ticker == symbol) {
                publish(state.copy(nameDetail = assemble(summary, trail, loading = false)))
            }
        }
    }

    private fun DeepDiveReportView.toSummaryOrNull(): ReportSummaryView? =
        runCatching { toReportSummary() }.getOrNull()

    /**
     * Fills [UiState.notesTrails] for [ticker]: lists the ticker's reports (`listReports`), fetches notes that
     * are not cached yet, caches them, and publishes the trail newest first.
     */
    fun notesTrail(ticker: String) {
        val symbol = ticker.trim().uppercase().ifBlank { return }
        viewModelScope.launch { loadNotesTrail(symbol) }
    }

    private suspend fun loadNotesTrail(symbol: String): List<NoteTrailEntry> {
        runAuthorizedWithRefresh {
            val reports = client.listReports(state.apiBaseUrl, requireTokens().accessToken)
                .filter { it.type == "deep_dive" && it.ticker.equals(symbol, ignoreCase = true) }
            for (item in reports) {
                if (cacheStore.getCachedReportNote(item.reportId) != null) continue
                val note = runCatchingNonCancellation {
                    client.getReportNote(state.apiBaseUrl, requireTokens().accessToken, item.reportId)
                }.getOrNull() ?: continue
                // The ticker comes from the history row: the report itself may not be cached.
                cacheStore.cacheReportNote(item.reportId, note, ticker = symbol)
            }
        }
        val trail = runCatchingNonCancellation { cacheStore.getNotesTrail(symbol) }.getOrDefault(emptyList())
        publish(state.copy(notesTrails = state.notesTrails + (symbol to trail)))
        return trail
    }

    /** Fills [UiState.allNotes] from the cache (every non-empty note, newest first). */
    fun allNotes() {
        viewModelScope.launch {
            val notes = runCatchingNonCancellation { cacheStore.getAllNotes() }.getOrDefault(emptyList())
            publish(state.copy(allNotes = notes))
        }
    }

    /** Loads two reports for Compare reports into [UiState.compareReports] (network, else the offline copy). */
    fun loadCompare(reportIdA: String, reportIdB: String) {
        publish(state.copy(compareReports = CompareReportsState(reportIdA, reportIdB)))
        viewModelScope.launch {
            val a = fetchReportForCompare(reportIdA)
            val b = fetchReportForCompare(reportIdB)
            val current = state.compareReports ?: return@launch
            if (current.reportIdA != reportIdA || current.reportIdB != reportIdB) return@launch
            publish(
                state.copy(
                    compareReports = current.copy(
                        a = a,
                        b = b,
                        isLoading = false,
                        error = if (a == null || b == null) "One of the reports could not be loaded." else null
                    )
                )
            )
        }
    }

    private suspend fun fetchReportForCompare(reportId: String): DeepDiveReportView? {
        if (state.deepDiveReport?.reportId == reportId) return state.deepDiveReport
        var report: DeepDiveReportView? = null
        runAuthorizedWithRefresh {
            report = client.getDeepDiveReport(state.apiBaseUrl, requireTokens().accessToken, reportId).also {
                cacheReportExtras(it, null)
            }
        }
        return report ?: runCatchingNonCancellation { cacheStore.getCachedDeepDive(reportId) }.getOrNull()
    }

    /** Compare names: each ticker's latest report (by its monitor snapshot's `reportId`) as a cached summary. */
    fun loadCompareNames(tickers: List<String>) {
        val symbols = tickers.map { it.trim().uppercase() }.filter { it.isNotBlank() }.distinct()
        publish(state.copy(compareNames = CompareNamesState(symbols)))
        viewModelScope.launch {
            val summaries = LinkedHashMap<String, ReportSummaryView?>()
            for (symbol in symbols) {
                val reportId = state.monitorSnapshots.firstOrNull { it.ticker.equals(symbol, ignoreCase = true) }?.reportId
                summaries[symbol] = when (reportId) {
                    null -> null
                    else -> runCatchingNonCancellation { cacheStore.getReportSummary(reportId) }.getOrNull()
                        ?: fetchReportForCompare(reportId)?.toSummaryOrNull()
                }
            }
            if (state.compareNames?.tickers != symbols) return@launch
            publish(state.copy(compareNames = CompareNamesState(symbols, summaries, isLoading = false)))
        }
    }

    /**
     * Search (5.26): local hits (followed names, report history and cached company names, note text) at once,
     * then server ticker matches. A newer query cancels the older one.
     */
    fun search(query: String) {
        searchJob?.cancel()
        val q = query.trim()
        if (q.isEmpty()) {
            publish(state.copy(searchResults = null))
            return
        }
        searchJob = viewModelScope.launch {
            val notes = runCatchingNonCancellation { cacheStore.getAllNotes() }.getOrDefault(emptyList())
            val summaries = state.reportHistory.mapNotNull { item ->
                runCatchingNonCancellation { cacheStore.getReportSummary(item.reportId) }.getOrNull()?.let { item.reportId to it }
            }.toMap()
            val local = searchLocal(q, state.watchlist, state.reportHistory, summaries, notes)
                .copy(isSearchingServer = true)
            publish(state.copy(searchResults = local))
            var tickers = emptyList<TickerSearchItem>()
            runAuthorizedWithRefresh {
                tickers = client.searchTickers(state.apiBaseUrl, requireTokens().accessToken, q)
            }
            if (state.searchResults?.query == local.query) {
                publish(state.copy(searchResults = local.copy(tickers = tickers, isSearchingServer = false)))
            }
        }
    }

    companion object {
        private const val LOG_TAG = "ThesisRefresh"
        private const val PULSE_RETRY_DELAY_MS = 600L
        private const val DEEP_DIVE_RESUME_PREFS = "thesis_deep_dive_resume"
        private const val KEY_RESUME_JOB_ID = "job_id"
        private const val KEY_RESUME_TICKER = "ticker"
        private const val KEY_RESUME_STARTED_AT = "started_at_ms"
        private const val DEEP_DIVE_POLL_INTERVAL_MS = 2_000L
        private const val DEEP_DIVE_READY_MESSAGE = "Deep Dive ready."
        private const val DEEP_DIVE_MAX_POLLS = 180 // 6 minutes at 2 s
        private const val DEEP_DIVE_MAX_WAIT_MS = 6 * 60 * 1000L
        private val notificationPreferenceTypes = listOf(
            "earnings_preview",
            "earnings_war_room",
            "contrarian_alert",
            "kill_switch",
            "freshness_decay",
            "morning_exception_briefing",
            "weekly_digest",
            "market_pulse_ready",
            "pulse_email"
        )
    }
}

private fun isBiometricSupported(application: Application): Boolean {
    val authenticators =
        BiometricManager.Authenticators.BIOMETRIC_STRONG or
            BiometricManager.Authenticators.DEVICE_CREDENTIAL
    val manager = BiometricManager.from(application.applicationContext)
    return manager.canAuthenticate(authenticators) == BiometricManager.BIOMETRIC_SUCCESS
}

internal fun normalizeApiBaseUrl(input: String): String? {
    val trimmed = input.trim().trimEnd('/')
    if (trimmed.isBlank()) {
        return null
    }
    if ("""https?://""".toRegex(RegexOption.IGNORE_CASE).findAll(trimmed).count() != 1) {
        return null
    }
    if (trimmed.any(Char::isWhitespace)) {
        return null
    }

    val uri = runCatching { URI(trimmed) }.getOrNull() ?: return null
    val scheme = uri.scheme?.lowercase() ?: return null
    if (scheme != "http" && scheme != "https") {
        return null
    }

    val host = uri.host ?: return null
    if (uri.query != null || uri.fragment != null) {
        return null
    }

    val port = if (uri.port >= 0) ":${uri.port}" else ""
    val path = uri.rawPath?.trimEnd('/').orEmpty()

    return buildString {
        append(scheme)
        append("://")
        append(host)
        append(port)
        if (path.isNotBlank() && path != "/") {
            append(path)
        }
    }
}

/** [NavigatorStateStore] over the ViewModel's [SavedStateHandle] (plain strings, no parcelize). */
private class SavedStateNavigatorStore(private val handle: SavedStateHandle) : NavigatorStateStore {
    override fun get(key: String): String? = handle.get<String>(key)
    override fun set(key: String, value: String?) {
        if (value == null) handle.remove<String>(key) else handle[key] = value
    }
}

/**
 * [runCatching] that lets cancellation through. Inside a coroutine, plain runCatching also catches the
 * CancellationException of a cancelled job, so the job would carry on (publish, cache) instead of stopping.
 */
private inline fun <T> runCatchingNonCancellation(block: () -> T): Result<T> =
    try {
        Result.success(block())
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (error: Throwable) {
        Result.failure(error)
    }
