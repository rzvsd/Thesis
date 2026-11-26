package com.thesis.mobile.ui

import android.app.Activity
import android.app.Application
import android.content.Context
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
import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.model.AuthTokens
import com.thesis.mobile.model.CompareNamesState
import com.thesis.mobile.model.CompareReportsState
import com.thesis.mobile.model.ConvictionInsightCardView
import com.thesis.mobile.model.ConvictionJournalEntryView
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.HoldingsImportResultView
import com.thesis.mobile.model.LastViewedReport
import com.thesis.mobile.model.NameDetailView
import com.thesis.mobile.model.NoteTrailEntry
import com.thesis.mobile.model.NotificationPreferenceView
import com.thesis.mobile.model.OppositeCaseReportView
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.model.ReportNoteView
import com.thesis.mobile.model.ReportSummaryView
import com.thesis.mobile.model.ScenarioOverridesView
import com.thesis.mobile.model.ScenarioResultView
import com.thesis.mobile.model.ScenarioStressRunView
import com.thesis.mobile.model.ScenarioStressTemplateView
import com.thesis.mobile.model.SearchResultsView
import com.thesis.mobile.model.SentimentSnapshotView
import com.thesis.mobile.model.SnapshotDelta
import com.thesis.mobile.model.SnapshotPoint
import com.thesis.mobile.model.SubscriptionOfferView
import com.thesis.mobile.model.TAB_DATA_MAX_AGE_MS
import com.thesis.mobile.model.ThesisMonitorSnapshotView
import com.thesis.mobile.model.TickerSearchItem
import com.thesis.mobile.model.UserProfileView
import com.thesis.mobile.model.WarRoomView
import com.thesis.mobile.model.compareNamesReportId
import com.thesis.mobile.model.searchLocal
import com.thesis.mobile.model.snapshotDeltaSince
import com.thesis.mobile.model.toReportSummary
import com.thesis.mobile.network.ProductApiClient
import com.thesis.mobile.network.ProductApiException
import com.thesis.mobile.observability.MobileTelemetry
import com.thesis.mobile.offline.OfflineCacheStore
import com.thesis.mobile.offline.PrefetchScheduler
import com.thesis.mobile.ui.copy.AccountCopy
import com.thesis.mobile.ui.copy.AppMessages
import com.thesis.mobile.ui.copy.NamesCopy
import com.thesis.mobile.ui.navigation.DeepLinkRouter
import com.thesis.mobile.ui.navigation.Destination
import com.thesis.mobile.ui.navigation.LaunchTarget
import com.thesis.mobile.ui.navigation.NavRoute
import com.thesis.mobile.ui.navigation.RouteAction
import com.thesis.mobile.ui.navigation.ShellTab
import com.thesis.mobile.ui.screens.AuthStatus
import com.thesis.mobile.ui.screens.RemoveFailure
import com.thesis.mobile.ui.shell.AppNavigator
import com.thesis.mobile.ui.shell.AppearancePrefs
import com.thesis.mobile.ui.shell.COMPARE_NAMES_MAX
import com.thesis.mobile.ui.shell.DeepDiveStartDecision
import com.thesis.mobile.ui.shell.NavEntry
import com.thesis.mobile.ui.shell.NavigatorStateStore
import com.thesis.mobile.ui.shell.ShellActions
import com.thesis.mobile.ui.shell.TabFreshness
import com.thesis.mobile.ui.shell.decideDeepDiveStart
import com.thesis.mobile.ui.shell.pulseEntryNeedsLoad
import org.json.JSONObject
import java.io.IOException
import java.net.URI
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext

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
        lastNamesVisitAtMs = sessionStore.getLastNamesVisitAtMs(),
        recentSearches = sessionStore.getRecentSearches()
    )
        private set

    /** When each tab's data last loaded; a tab switch skips data younger than 5 minutes (5.5), a failed load clears it. */
    private val tabFreshness = TabFreshness()

    // Refresh flags: a generation number per single-flight refresh, a counter for parallel ones, so a cancelled
    // older request can never clear the flag of the newer one.
    private var pulseGeneration = 0
    private var macroGeneration = 0
    private var boardInFlight = 0
    private var inboxInFlight = 0
    private var historyInFlight = 0
    private var reportOpenGeneration = 0
    private var searchJob: Job? = null
    private var tickerSuggestJob: Job? = null

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
    // its date with this (onEnsurePulse) and asks for its day again when the latest replaced it; an undated entry (and
    // Today, refreshTab) asks for the latest again when a past day replaced it.
    private var pulseRequestedDate: String? = null
    private var macroStressRefreshJob: Job? = null

    // You restored on the modal stack after process death (AppNavigator.restore): its Monthly Coherence card loads
    // only for Pro, and the tier is known only once the profile arrives, so refreshUserProfile loads it then.
    // Declared before init, which sets it.
    private var loadYouInsightsWithProfile = false

    init {
        // A Paywall that AppNavigator restored on the modal stack (process death) keeps its request: published
        // before the first publish, so syncPaywallEntry does not close the restored modal again on arrival.
        navigator.modalStack.lastOrNull { it.destination is Destination.Paywall }?.let { entry ->
            val feature = (entry.destination as Destination.Paywall).feature
            state = state.copy(paywallFeature = feature.ifBlank { GENERAL_UPGRADE_FEATURE })
        }
        if (state.tokens != null) {
            loadYouInsightsWithProfile = navigator.modalStack.any { it.destination.isYouEntry() }
            PrefetchScheduler.schedule(getApplication<Application>().applicationContext)
            state = state.copy(lastViewedReport = sessionStore.getLastViewedReport())
            // Marked before the loads start, so a load that fails at once still clears its tab's mark.
            markAllTabsFetched()
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
        }
    }

    /**
     * After a full load (start, login) the first tab switches do not fetch the same data again. A load that fails
     * clears the marks of the tabs it feeds (TabFreshness.invalidate), so an offline start is retried on the next switch.
     */
    private fun markAllTabsFetched() = tabFreshness.markAll(System.currentTimeMillis())

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
        if (!tabFreshness.claim(tab, System.currentTimeMillis(), force)) {
            // Fresh, but a past Pulse opened on another tab (Research history) holds the shared Pulse: Today's brief
            // shows the latest issue again. A dated Pulse entry on Today's top asks for its own day (onEnsurePulse).
            val topPulseDate = (navigator.tabTop.destination as? Destination.Pulse)?.date
            if (tab == ShellTab.Today && !skipPulse && topPulseDate == null &&
                pulseEntryNeedsLoad(null, pulseRequestedDate)
            ) {
                refreshPulse()
            }
            return
        }
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
            val invalid = "Enter one valid Product API URL, for example http://192.168.1.114:3001"
            // Auth shows authStatus, not message (pre-login messages are never a snackbar): publish both.
            publish(state.copy(message = invalid, authStatus = AuthStatus(AuthStatus.Kind.Failed, invalid)))
            return
        }

        sessionStore.saveApiBaseUrl(normalized)
        publish(
            state.copy(
                apiBaseUrl = normalized,
                message = AppMessages.API_SAVED,
                authStatus = AuthStatus(AuthStatus.Kind.ApiSaved, AccountCopy.STATUS_API_SAVED)
            )
        )
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
            publish(state.copy(message = AppMessages.BIOMETRIC_UNAVAILABLE))
            return
        }

        sessionStore.saveBiometricLockEnabled(enabled)
        publish(
            state.copy(
                biometricLockEnabled = enabled,
            )
        )
        trackEvent("biometric_lock_toggled", mapOf("enabled" to enabled))
    }

    fun setNotificationPreference(notificationType: String, enabled: Boolean, announce: Boolean = true) {
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
                        // The Inbox confirms its own "turn off" with its snackbar (one message per action, 5.21).
                        message = if (announce) AppMessages.NOTIFICATIONS_SAVED else state.message
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
            publish(state.copy(authBusy = true, message = null, registerStatus = null, authStatus = null))
            runCatching {
                client.register(state.apiBaseUrl, email, password)
            }.onSuccess { result ->
                publish(
                    state.copy(
                        authBusy = false,
                        registerStatus = result.status,
                        verificationToken = result.verificationToken,
                        message = AppMessages.REGISTERED,
                        authStatus = AuthStatus(AuthStatus.Kind.VerificationSent, AccountCopy.STATUS_VERIFICATION_SENT)
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
                publish(state.copy(authBusy = false, message = toMessage(error), authStatus = authFailure(error)))
            }
        }
    }

    /** The Auth status line for a failed register, verify or log in: the error as written (5.3). */
    private fun authFailure(error: Throwable): AuthStatus = AuthStatus(AuthStatus.Kind.Failed, toMessage(error))

    fun verify(email: String, token: String) {
        viewModelScope.launch {
            publish(state.copy(authBusy = true, message = null, authStatus = null))
            runCatching {
                client.verify(state.apiBaseUrl, email.trim(), token.trim())
            }.onSuccess {
                publish(
                    state.copy(
                        authBusy = false,
                        message = AppMessages.VERIFIED,
                        authStatus = AuthStatus(AuthStatus.Kind.Verified, AccountCopy.STATUS_VERIFIED)
                    )
                )
            }.onFailure { error ->
                publish(state.copy(authBusy = false, message = toMessage(error), authStatus = authFailure(error)))
            }
        }
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            publish(state.copy(authBusy = true, message = null, authStatus = null))
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
                        // No message: Today arriving is the feedback, and a stale one (Session expired) must not
                        // show once signed in.
                        message = null,
                        authStatus = null,
                        pulseError = null,
                        deepDiveError = null
                    )
                )
                markAllTabsFetched()
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
                syncPushToken()
                PrefetchScheduler.schedule(getApplication<Application>().applicationContext)
                trackEvent(
                    "login_completed",
                    mapOf("method" to "email_password")
                )
            }.onFailure { error ->
                publish(state.copy(authBusy = false, message = toMessage(error), authStatus = authFailure(error)))
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            val current = state.tokens
            if (current == null) {
                clearLocalSession(AppMessages.LOGGED_OUT, AuthStatus(AuthStatus.Kind.SignedOut, AccountCopy.STATUS_SIGNED_OUT))
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
            clearLocalSession(AppMessages.LOGGED_OUT, AuthStatus(AuthStatus.Kind.SignedOut, AccountCopy.STATUS_SIGNED_OUT))
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
                    publish(
                        state.copy(
                            message = AppMessages.PASSWORD_RESET,
                            authStatus = AuthStatus(AuthStatus.Kind.PasswordChanged, AccountCopy.STATUS_PASSWORD_CHANGED)
                        )
                    )
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
                listOfNotNull(AppMessages.ACCOUNT_DELETED, storeNotice).joinToString(" "),
                AuthStatus(
                    AuthStatus.Kind.AccountDeleted,
                    listOfNotNull(AccountCopy.STATUS_ACCOUNT_DELETED, storeNotice?.trim()?.ifBlank { null }).joinToString(" ")
                )
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

    /**
     * Opens the Paywall (5.23) on the modal stack for [feature]. The paywall itself is the explanation, so no
     * snackbar goes with it ([message] is kept only where a screen shows it in place, such as an error line).
     */
    private fun showUpgrade(feature: String) {
        forgetClosedPaywall()
        publish(state.copy(paywallFeature = feature))
    }

    fun requestFeatureUpgrade(feature: String) {
        showUpgrade(feature)
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
            publish(state.copy(message = AppMessages.OPEN_REPORT_FOR_NOTE))
            return
        }

        viewModelScope.launch {
            // The message stays: autosave runs on every pause in typing, and clearing it would cancel a snackbar on
            // screen (a Deep Dive ready with its Open, an error) while the reader writes.
            publish(state.copy(isSavingNote = true))
            val error = runAuthorizedWithRefresh {
                val saved = client.saveReportNote(
                    state.apiBaseUrl,
                    requireTokens().accessToken,
                    report.reportId,
                    state.reportNoteDraft
                )
                // No snackbar: the report host's NoteBlock footer says Saving / Saved / Try again (5.13 item 4).
                publish(state.copy(reportNote = saved, reportNoteDraft = saved.content))
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
            publish(state.copy(message = AppMessages.OPEN_REPORT_FOR_FEEDBACK))
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
                publish(state.copy(message = AppMessages.FEEDBACK_SENT))
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
                        message = AppMessages.ALERT_FEEDBACK_SAVED
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
                publish(state.copy(message = toMessage(error), inboxError = toMessage(error), inboxErrorSeq = state.inboxErrorSeq + 1))
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
                // No success snackbar: the Inbox already said "Alerts like this are quiet for 24 hours" with Undo, and
                // calls this only once that snackbar went without Undo (5.21, one message per action).
                publish(state.copy(alertLedger = replaceAlertLedgerItem(updated), inboxError = null))
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
                publish(state.copy(message = toMessage(error), inboxError = toMessage(error), inboxErrorSeq = state.inboxErrorSeq + 1))
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
                publish(state.copy(message = AppMessages.FEEDBACK_SENT))
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
            publish(state.copy(message = AppMessages.OPEN_REPORT_FOR_SCENARIO))
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
                    showUpgrade(upgrade.feature ?: "what_if_scenario")
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
            publish(state.copy(message = AppMessages.CHOOSE_SCENARIO))
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
                    showUpgrade(upgrade.feature ?: "scenario_stress")
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
            publish(state.copy(message = AppMessages.SCENARIO_RUN_MISSING))
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
                    showUpgrade(upgrade.feature ?: "scenario_stress")
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
                            AppMessages.OPPOSITE_CASE_NONE
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
            publish(state.copy(message = AppMessages.OPEN_REPORT_FOR_OPPOSITE_CASE))
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
                    publish(state.copy(oppositeCaseError = upgrade.message))
                    showUpgrade(upgrade.feature ?: "conviction_intelligence")
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
                publish(state.copy(message = AppMessages.PURCHASES_UNAVAILABLE))
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
                    ?: throw IllegalStateException(AppMessages.NO_PLAN_OFFERED)
                trackEvent(
                    "paywall_cta_clicked",
                    mapOf(
                        "feature" to purchaseFeature(),
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
                        message = AppMessages.PURCHASE_DONE
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
                        "feature" to purchaseFeature(),
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
                publish(state.copy(message = AppMessages.PURCHASES_UNAVAILABLE))
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
                        message = AppMessages.PURCHASES_RESTORED
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
            publish(state.copy(tickers = results))
        }
    }

    /**
     * Ticker suggestions for a typed query (Names' add field, the Research field): debounced, quiet (no snackbar),
     * and cleared for an empty query.
     */
    fun suggestTickers(query: String) {
        tickerSuggestJob?.cancel()
        val q = query.trim()
        if (q.isEmpty()) {
            if (state.tickers.isNotEmpty()) publish(state.copy(tickers = emptyList()))
            return
        }
        tickerSuggestJob = viewModelScope.launch {
            delay(TICKER_SUGGEST_DEBOUNCE_MS)
            var results = emptyList<TickerSearchItem>()
            val error = runAuthorizedWithRefresh {
                results = client.searchTickers(state.apiBaseUrl, requireTokens().accessToken, q)
            }
            if (error == null) publish(state.copy(tickers = results))
        }
    }

    fun selectTicker(symbol: String) {
        publish(state.copy(selectedTicker = symbol))
    }

    fun runDeepDive() {
        val ticker = state.selectedTicker
        if (ticker.isNullOrBlank()) {
            publish(state.copy(message = AppMessages.ENTER_TICKER))
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
        }, onError = {
            tabFreshness.invalidate(ShellTab.Research)
            // History ends its skeleton on this and shows its failed state with Try again (state.message is the
            // snackbar text withAuthorizedCall has just published; null for an upgrade prompt).
            publish(state.copy(historyLoadError = state.message ?: AppMessages.LOAD_FAILED))
        }) {
            val reports = client.listReports(state.apiBaseUrl, requireTokens().accessToken)
            publish(state.copy(reportHistory = reports, reportHistoryLoaded = true, historyLoadError = null))
            refreshHeldNameDetail()
            loadReportSummaries()
            allNotes()
        }
    }

    /** Fills [UiState.reportSummaries] from the cache for every report in the history (company, filing period). */
    private suspend fun loadReportSummaries() {
        val summaries = state.reportHistory.mapNotNull { item ->
            runCatchingNonCancellation { cacheStore.getReportSummary(item.reportId) }.getOrNull()?.let { item.reportId to it }
        }.toMap()
        publish(state.copy(reportSummaries = state.reportSummaries + summaries))
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
                            convictionTimelineError = AppMessages.CONVICTION_OFFLINE,
                            oppositeCase = null,
                            oppositeCaseError = AppMessages.OPPOSITE_CASE_OFFLINE,
                            isGeneratingOppositeCase = false,
                            scenarioResult = null,
                            isRunningScenario = false,
                            message = AppMessages.REPORT_OFFLINE,
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
            if (announce) publish(state.copy(message = AppMessages.OPEN_WAR_ROOM_FIRST))
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
                        pulseError = null,
                        pulseFailureKind = null
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
                tabFreshness.invalidate(ShellTab.Today)
                val failureKind = RefreshFailure.classify(error, isDeviceOnline())
                Log.w(LOG_TAG, RefreshFailure.logLine("pulse", error, failureKind))
                publish(state.copy(pulseFailureKind = failureKind))
                val cachedPulse = cacheStore.getCachedPulse()
                if (cachedPulse != null) {
                    publish(
                        state.copy(
                            pulseReport = cachedPulse,
                            pulseLoadedFromCache = true,
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
            publish(state.copy(message = AppMessages.PULSE_DATE_UNREADABLE))
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

    /** [onReady] writes the file off the main thread and shares it; a failure there is reported as an export failure. */
    fun exportPulsePdf(onReady: suspend (PulsePdfDownload) -> Unit) {
        // One export at a time: a second tap while the arc runs would start a parallel download and share sheet.
        if (state.isExportingPulse) return
        // Marked before the request goes out, so a second tap in the same frame finds the export running.
        publish(state.copy(isExportingPulse = true))
        viewModelScope.launch {
          try {
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
                publish(state.copy(message = AppMessages.PULSE_PDF_FAILED))
                return@launch
            }

            // No "ready" message: the share sheet opening is the feedback.
            trackEvent(
                "export_generated",
                mapOf(
                    "artifact" to "pulse_pdf",
                    "report_id" to (pulse?.reportId ?: "unknown")
                )
            )
            try {
                onReady(ready)
                publish(state.copy(pulseExportDoneAt = System.currentTimeMillis()))
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                trackApiError(error)
                publish(state.copy(message = AppMessages.PULSE_PDF_FAILED))
            }
          } finally {
            publish(state.copy(isExportingPulse = false))
          }
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
                // At least two weeks whatever the range: the header compares with a reading about 7 days old
                // ("rose 6 points this week"), which a 7-day window may not hold (5.9.2).
                val history = client.getMacroStressHistory(
                    state.apiBaseUrl,
                    requireTokens().accessToken,
                    maxOf(normalizedDays, MACRO_HISTORY_MIN_DAYS)
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
                tabFreshness.invalidate(ShellTab.Today)
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
        withAuthorizedCall(onDone = ::boardFinished, onError = {
            tabFreshness.invalidate(ShellTab.Names)
            // Names ends its skeleton on this and shows its failed state with Try again.
            publish(state.copy(watchlistLoadError = state.message ?: AppMessages.LOAD_FAILED))
        }) {
            val items = client.getWatchlist(state.apiBaseUrl, requireTokens().accessToken)
            publish(state.copy(watchlist = items, watchlistLoaded = true, watchlistLoadError = null))
            if (thenSnapshots) refreshMonitorSnapshots()
        }
    }

    /** [announce]: say "Added X to Names" (Name, the report bar); the Names board's own field shows the row instead. */
    fun addWatchlistTicker(ticker: String, announce: Boolean = true) {
        if (!state.watchlistFeatureEnabled) {
            publish(state.copy(message = AppMessages.NAMES_OFF))
            return
        }
        withAuthorizedCall {
            val normalized = ticker.trim().uppercase()
            val items = client.addWatchlistTicker(
                state.apiBaseUrl,
                requireTokens().accessToken,
                normalized
            )
            publish(state.copy(watchlist = items, message = if (announce) NamesCopy.added(normalized) else state.message))
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
            return Result.failure(IllegalStateException(toMessage(error ?: IllegalStateException(AppMessages.IMPORT_FAILED))))
        }
        publish(state.copy(watchlist = imported.watchlist))
        refreshMonitorSnapshots()
        return Result.success(imported)
    }

    /** [announce]: say "Removed X from Names" once it is done (Name, the report bar); Names shows its own Undo. */
    fun removeWatchlistTicker(ticker: String, announce: Boolean = false) {
        val normalized = ticker.trim().uppercase()
        if (!state.watchlistFeatureEnabled) {
            publish(
                state.copy(
                    watchlistRemoveFailure = removeFailureFor(normalized),
                    message = AppMessages.NAMES_OFF
                )
            )
            return
        }
        // Names hid the row while its Undo snackbar showed: a refused remove brings it back.
        withAuthorizedCall(onError = { publish(state.copy(watchlistRemoveFailure = removeFailureFor(normalized))) }) {
            val items = client.removeWatchlistTicker(
                state.apiBaseUrl,
                requireTokens().accessToken,
                normalized
            )
            // From Names no message: the board shows its own "Removed X from Names" with Undo.
            publish(state.copy(watchlist = items, message = if (announce) NamesCopy.removed(normalized) else state.message))
            trackEvent(
                "watchlist_ticker_removed",
                mapOf("ticker" to normalized, "watchlist_size" to items.size)
            )
            refreshMonitorSnapshots()
        }
    }

    /** The feature a purchase is for, for analytics (init publishes a restored Paywall's feature too). */
    private fun purchaseFeature(): String = state.paywallFeature ?: GENERAL_UPGRADE_FEATURE

    /** The next [UiState.watchlistRemoveFailure] for [ticker] (a new sequence number, so a repeat is a new signal). */
    private fun removeFailureFor(ticker: String): RemoveFailure =
        RemoveFailure(ticker, (state.watchlistRemoveFailure?.seq ?: 0) + 1)

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
                        inboxError = null,
                        inboxLoadError = null,
                        inboxLoaded = true
                    )
                )
                refreshHeldNameDetail()
            }
            if (error != null) {
                // The ledger feeds Today's alerts, the Names board and Inbox.
                tabFreshness.invalidate(ShellTab.Today, ShellTab.Names, ShellTab.Inbox)
                val message = toMessage(error)
                publish(
                    state.copy(
                        inboxError = message,
                        inboxLoadError = message,
                        inboxErrorSeq = state.inboxErrorSeq + 1,
                        inboxLoaded = true
                    )
                )
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
            val error = runAuthorizedWithRefresh {
                val snapshots = client.getMonitorSnapshots(
                    state.apiBaseUrl,
                    requireTokens().accessToken
                )
                publish(state.copy(monitorSnapshots = snapshots))
                // 5.5: every board refresh appends to the 90-day history; deltas compare to the last Names visit.
                runCatchingNonCancellation { cacheStore.appendSnapshotHistory(snapshots) }
                publish(state.copy(snapshotDeltas = computeSnapshotDeltas(snapshots, state.lastNamesVisitAtMs)))
                // The weekly digest's state changes: each reading against the one at or before a week ago.
                val weekly = computeSnapshotDeltas(snapshots, System.currentTimeMillis() - WEEK_MS).values
                publish(state.copy(weeklyStateChanges = weekly.toList().takeIf { list -> list.any { it.previous != null } }))
                refreshHeldNameDetail()
            }
            if (error != null) tabFreshness.invalidate(ShellTab.Today, ShellTab.Names)
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
                    val failureMessage = status.errorMessage ?: AppMessages.DEEP_DIVE_FAILED
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
                message = AppMessages.DEEP_DIVE_TIMED_OUT,
                deepDiveError = AppMessages.DEEP_DIVE_TIMED_OUT
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
                    showUpgrade(upgrade.feature ?: "pro_features")
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
                    clearLocalSession(
                        AppMessages.SESSION_EXPIRED,
                        AuthStatus(AuthStatus.Kind.SessionExpired, AccountCopy.STATUS_SESSION_EXPIRED)
                    )
                    throw ProductApiException(401, AppMessages.SESSION_EXPIRED)
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

    private suspend fun clearLocalSession(message: String, authStatus: AuthStatus) {
        PrefetchScheduler.cancel(getApplication<Application>().applicationContext)
        cacheStore.clearAll()
        sessionStore.clearLastViewedReport()
        sessionStore.clearTokens()
        deepDivePoll?.cancel()
        activeDeepDiveJobId = null
        clearDeepDiveInFlight()
        sessionStore.clearVisitMarkers()
        sessionStore.saveRecentSearches(emptyList())
        tabFreshness.clear()
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
                watchlistLoadError = null,
                historyLoadError = null,
                watchlistRemoveFailure = null,
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
                pulseFailureKind = null,
                isExportingPulse = false,
                pulseExportDoneAt = null,
                inboxLoadError = null,
                inboxLoaded = false,
                reportSummaries = emptyMap(),
                weeklyStateChanges = null,
                recentSearches = emptyList(),
                message = message,
                authStatus = authStatus
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
            is IOException -> AppMessages.NO_CONNECTION
            else -> error.message ?: AppMessages.UNEXPECTED
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
        val paywallBefore = state.paywallFeature
        state = newState
        syncPaywallEntry(paywallBefore, newState.paywallFeature)
        observer?.invoke(state)
    }

    /**
     * The Paywall is a modal-stack destination (5.23): a new upgrade request opens it, a cleared one (dismiss, a
     * purchase or restore that made the user Pro) closes it. A Paywall closed by navigation (back, a tab, a route)
     * clears the request in [forgetClosedPaywall].
     */
    private fun syncPaywallEntry(before: String?, after: String?) {
        val open = navigator.modalStack.any { it.destination is Destination.Paywall }
        when {
            !after.isNullOrBlank() && after != before && !open -> navigator.openModal(Destination.Paywall(after))
            after.isNullOrBlank() && open -> navigator.closeModals { it is Destination.Paywall }
        }
    }

    /**
     * Closes every modal for a navigation that opens a page under them (a report, a name, Pulse, a compare). A
     * Paywall closed this way clears its request too, as one closed by its own button does.
     */
    private fun closeModalsAndForget() {
        navigator.closeModals()
        forgetClosedPaywall()
    }

    /** The Paywall left the modal stack by navigation: the request it showed is over. */
    private fun forgetClosedPaywall() {
        if (state.paywallFeature != null && navigator.modalStack.none { it.destination is Destination.Paywall }) {
            publish(state.copy(paywallFeature = null))
        }
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
        forgetClosedPaywall()
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
        forgetClosedPaywall()
        noteTabLeft(previous, tab)
        refreshTab(tab, force = false)
    }

    override fun onBack(): Boolean {
        // Back from another tab's root switches to Today: that leaves Names or Inbox, so move its marker.
        val previousTab = navigator.currentTab
        val handled = navigator.back(::onEntryPopped)
        forgetClosedPaywall()
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
        closeModalsAndForget()
    }

    override fun onOpenAlert(alert: AlertLedgerItemView) {
        applyRoute(DeepLinkRouter.routeAlert(alert))
    }

    override fun onOpenReport(reportId: String, ticker: String?) {
        closeModalsAndForget()
        navigator.push(Destination.Report(reportId, reportTicker(reportId, ticker)))
        openHistoryReport(reportId)
    }

    /**
     * The ticker a Report entry opens under: the caller's, else the history's (or the open report's) for that id. With
     * it the entry opens under the ReportOpeningBar and keeps one chrome when the report lands (5.13); without it the
     * bar would swap from the shell's Back bar to the report's.
     */
    private fun reportTicker(reportId: String, ticker: String?): String? =
        (
            ticker
                ?: state.reportHistory.firstOrNull { it.reportId == reportId }?.ticker
                ?: state.deepDiveReport?.takeIf { it.reportId == reportId }?.ticker
            )?.trim()?.uppercase()?.ifBlank { null }

    override fun onEnsureReport(reportId: String) {
        if (state.deepDiveReport?.reportId != reportId) openHistoryReport(reportId)
    }

    override fun onEnsurePulse(date: String?) {
        if (!pulseEntryNeedsLoad(date, pulseRequestedDate)) return
        // An undated entry shows the latest issue: a past day opened elsewhere (Research history) must not stand in.
        val day = date?.trim()?.ifBlank { null }
        if (day == null) refreshPulse() else loadPulseByDate(day)
    }

    override fun onReloadPulse(date: String) = loadPulseByDate(date)

    override fun onRunDeepDive(ticker: String) {
        val symbol = ticker.trim().uppercase()
        if (symbol.isBlank()) {
            publish(state.copy(message = AppMessages.ENTER_TICKER))
            return
        }
        startOrShowDeepDive(symbol) { navigator.push(Destination.DeepDiveRunning(it)) }
    }

    override fun onRetryDeepDive(ticker: String) {
        val symbol = ticker.trim().uppercase()
        if (symbol.isBlank()) {
            publish(state.copy(message = AppMessages.ENTER_TICKER))
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
        closeModalsAndForget()
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
        closeModalsAndForget()
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

    override fun onOpenName(ticker: String) = onOpenNameIn(ticker, null, null)

    override fun onOpenNameIn(ticker: String, pagerScope: String?, anchor: String?) {
        val symbol = ticker.trim().uppercase().ifBlank { return }
        // From Search (modal) or the Paywall's caller: the Name opens on the tab under it.
        closeModalsAndForget()
        navigator.push(Destination.Name(symbol, pagerScope, anchor))
        openName(symbol)
    }

    override fun onPageName(ticker: String, pagerScope: String?) {
        val symbol = ticker.trim().uppercase().ifBlank { return }
        if (navigator.tabTop.destination is Destination.Name) {
            navigator.replaceTop(Destination.Name(symbol, pagerScope))
        } else {
            navigator.push(Destination.Name(symbol, pagerScope))
        }
        openName(symbol)
    }

    override fun onEnsureName(ticker: String) {
        val symbol = ticker.trim().uppercase().ifBlank { return }
        val held = state.nameDetail
        // Another name, or none: load it. The held name keeps its page when Name comes back on top (no reload, no
        // notes blink): refreshHeldNameDetail rebuilds it from what arrived while no Name page held it, and opens
        // it again only when its report is now known but not read yet.
        if (held == null || held.ticker != symbol) openName(symbol) else refreshHeldNameDetail()
    }

    override fun onOpenCompareNames(tickers: List<String>) {
        val symbols = tickers.map { it.trim().uppercase() }.filter { it.isNotBlank() }.distinct().take(COMPARE_NAMES_MAX)
        if (symbols.isEmpty()) return
        closeModalsAndForget()
        navigator.push(Destination.CompareNames(symbols))
        loadCompareNames(symbols)
    }

    override fun onEnsureCompareNames(tickers: List<String>) {
        val symbols = tickers.map { it.trim().uppercase() }.filter { it.isNotBlank() }.distinct().take(COMPARE_NAMES_MAX)
        val held = state.compareNames
        val failed = held != null && !held.isLoading && (held.error != null || held.errors.isNotEmpty())
        if (held == null || held.tickers != symbols || failed) loadCompareNames(symbols)
    }

    override fun onOpenCompareReports(reportIdA: String, reportIdB: String) {
        closeModalsAndForget()
        navigator.push(Destination.CompareReports(reportIdA, reportIdB))
        loadCompare(reportIdA, reportIdB)
    }

    override fun onEnsureCompareReports(reportIdA: String, reportIdB: String) {
        val held = state.compareReports
        if (held == null || held.reportIdA != reportIdA || held.reportIdB != reportIdB ||
            (held.error != null && !held.isLoading)
        ) {
            loadCompare(reportIdA, reportIdB)
        }
    }

    override fun onOpenInbox(category: String?) {
        navigator.requestInboxCategory(category)
        onSelectTab(ShellTab.Inbox)
        navigator.popToRoot(ShellTab.Inbox, ::onEntryPopped)
    }

    override fun onOpenInboxFor(ticker: String) {
        navigator.requestInboxTicker(ticker)
        onOpenInbox(null)
    }

    override fun onOpenNamesToAdd() {
        navigator.requestNamesFocusAdd()
        onSelectTab(ShellTab.Names)
        navigator.popToRoot(ShellTab.Names, ::onEntryPopped)
    }

    override fun onOpenHoldingsImport() {
        closeModalsAndForget()
        navigator.requestNamesImport()
        onSelectTab(ShellTab.Names)
        navigator.popToRoot(ShellTab.Names, ::onEntryPopped)
    }

    override fun onOpenPulseAt(chapter: String) {
        closeModalsAndForget()
        navigator.push(Destination.Pulse(null, chapter))
    }

    override fun onSearchTickers(query: String) = suggestTickers(query)
    override fun onLoadAllNotes() = allNotes()
    override fun onLoadNotesTrail(ticker: String) = notesTrail(ticker)
    override suspend fun onSaveNoteFor(reportId: String, text: String): Boolean = saveNoteFor(reportId, text)
    override fun onSaveNoteOnLeave(reportId: String, text: String) {
        viewModelScope.launch { saveNoteFor(reportId, text) }
    }
    override fun onRefreshHistory() = refreshReportHistory()
    override fun onSearch(query: String) = search(query)

    override fun onAddRecentSearch(query: String) {
        val q = query.trim().ifBlank { return }
        val updated = (listOf(q) + state.recentSearches.filterNot { it.equals(q, ignoreCase = true) }).take(RECENT_SEARCHES_MAX)
        sessionStore.saveRecentSearches(updated)
        publish(state.copy(recentSearches = updated))
    }

    override fun onClearRecentSearches() {
        sessionStore.saveRecentSearches(emptyList())
        publish(state.copy(recentSearches = emptyList()))
    }

    override fun onDisableAlertType(type: String) = setNotificationPreference(type, enabled = false, announce = false)

    /**
     * Saves [text] as the note of [reportId] (any report, Name's NoteBlock), updating the notes cache, the trail and
     * [UiState.allNotes]. True once the server has it; no snackbar (the block's footer says Saved).
     */
    suspend fun saveNoteFor(reportId: String, text: String): Boolean {
        var saved: ReportNoteView? = null
        val error = runAuthorizedWithRefresh {
            saved = client.saveReportNote(state.apiBaseUrl, requireTokens().accessToken, reportId, text)
        }
        val note = saved
        if (error != null || note == null) return false
        val open = state.deepDiveReport?.takeIf { it.reportId == reportId }
        if (open != null) publish(state.copy(reportNote = note, reportNoteDraft = note.content))
        val ticker = state.reportHistory.firstOrNull { it.reportId == reportId }?.ticker?.trim()?.uppercase()
            ?: open?.ticker?.trim()?.uppercase()
            ?: state.nameDetail?.ticker
        runCatchingNonCancellation {
            cacheStore.cacheReportNote(reportId, note, report = open, ticker = ticker)
        }
        // As saveReportNote: a report with a note is kept for offline reading.
        runCatchingNonCancellation { cacheStore.setDeepDiveNotePinned(reportId, note.content.isNotBlank()) }
        if (ticker != null) {
            val trail = runCatchingNonCancellation { cacheStore.getNotesTrail(ticker) }.getOrNull()
            if (trail != null) {
                val detail = state.nameDetail?.takeIf { it.ticker == ticker }?.copy(notesTrail = trail)
                publish(state.copy(notesTrails = state.notesTrails + (ticker to trail), nameDetail = detail ?: state.nameDetail))
            }
        }
        val notes = runCatchingNonCancellation { cacheStore.getAllNotes() }.getOrNull()
        if (notes != null) publish(state.copy(allNotes = notes))
        return true
    }

    override fun onResumeLastViewed(report: LastViewedReport) {
        if (report.type == "PULSE") {
            navigator.push(Destination.Pulse(report.referenceDate?.ifBlank { null }))
            resumeLastViewed(report)
        } else {
            navigator.push(Destination.Report(report.reportId, reportTicker(report.reportId, null)))
            openHistoryReport(report.reportId)
        }
    }

    override fun onDismissResumeCard() = dismissResumeCard()

    override fun onRefreshPulse() = refreshPulse()
    override fun onSelectMacroRange(days: Int) = openMacroStressDashboard(days)
    override fun onRefreshMacro() = refreshMacroStress()

    override fun onRefreshNames() {
        tabFreshness.mark(ShellTab.Names, System.currentTimeMillis())
        // The snapshots refresh on their own, so the board's states and scores update even when the list call fails.
        refreshWatchlist(thenSnapshots = false)
        refreshMonitorSnapshots()
        refreshAlertLedger()
    }

    override fun onAddName(ticker: String) = addWatchlistTicker(ticker)
    override fun onAddNameFromBoard(ticker: String) = addWatchlistTicker(ticker, announce = false)
    override fun onRemoveName(ticker: String) = removeWatchlistTicker(ticker)
    override fun onUnfollowName(ticker: String) = removeWatchlistTicker(ticker, announce = true)
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
        publish(state.copy(nameDetail = nameDetailFor(symbol, null, state.notesTrails[symbol].orEmpty(), loading = true)))
        viewModelScope.launch {
            val reportId = nameReportId(symbol)
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
                publish(state.copy(nameDetail = nameDetailFor(symbol, summary, trail, loading = false)))
                // Opened before the snapshots or the history had arrived (a restored Name entry right after launch):
                // the report they name now is fetched, so the page never offers "Build report" for a name that
                // has one. Only when the first look found no report at all, so a failed fetch does not loop.
                if (reportId == null && summary == null && nameReportId(symbol) != null) openName(symbol)
            }
        }
    }

    /** The report Name reads for [symbol]: its monitor snapshot's report, else its newest Deep Dive in the history. */
    private fun nameReportId(symbol: String): String? =
        state.monitorSnapshots.firstOrNull { it.ticker.equals(symbol, ignoreCase = true) }?.reportId?.ifBlank { null }
            ?: state.reportHistory.filter { it.ticker.equals(symbol, true) && it.type == "deep_dive" }
                .maxByOrNull { it.createdAt }?.reportId

    private fun nameDetailFor(
        symbol: String,
        summary: ReportSummaryView?,
        trail: List<NoteTrailEntry>,
        loading: Boolean
    ): NameDetailView = NameDetailView(
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

    /**
     * Rebuilds the held [UiState.nameDetail] after its inputs changed (snapshots, history, alerts): the page reads
     * the new snapshot, reports and alerts, and a page that found no report fetches the one the new data names.
     */
    private fun refreshHeldNameDetail() {
        val held = state.nameDetail ?: return
        val symbol = held.ticker
        // Only while a Name page for it is on a stack: a popped page needs no rebuild, and must not fetch again on
        // every refresh. When a Name page for it comes back, onEnsureName brings it up to date.
        if (!navigator.isOnAnyStack { it is Destination.Name && it.ticker.equals(symbol, ignoreCase = true) }) return
        if (!held.isLoading && held.summary == null && nameReportId(symbol) != null) {
            openName(symbol)
            return
        }
        publish(state.copy(nameDetail = nameDetailFor(symbol, held.summary, held.notesTrail, held.isLoading)))
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
                        error = if (a == null || b == null) AppMessages.REPORTS_NOT_LOADED else null
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
            val errors = LinkedHashMap<String, String>()
            for (symbol in symbols) {
                // The open report itself when it is this name's (the report dock's "Compare with" puts the report's
                // own ticker first, followed or not); otherwise the name's latest report (compareNamesReportId).
                val open = state.deepDiveReport?.takeIf { it.ticker.equals(symbol, ignoreCase = true) }
                val reportId = compareNamesReportId(symbol, state.monitorSnapshots, state.reportHistory, open?.reportId)
                summaries[symbol] = when {
                    reportId == null -> null
                    open != null && open.reportId == reportId -> open.toSummaryOrNull()
                    else -> runCatchingNonCancellation { cacheStore.getReportSummary(reportId) }.getOrNull()
                        ?: fetchReportForCompare(reportId)?.toSummaryOrNull()
                }
                // The name has a report that neither the cache nor the server gave back (offline, a failed call):
                // its column says "Couldn't load" with Try again, never "No report yet" with "Build report".
                if (reportId != null && summaries[symbol] == null) errors[symbol] = AppMessages.LOAD_FAILED
            }
            if (state.compareNames?.tickers != symbols) return@launch
            publish(state.copy(compareNames = CompareNamesState(symbols, summaries, isLoading = false, errors = errors)))
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
        private const val TICKER_SUGGEST_DEBOUNCE_MS = 250L
        private const val MACRO_HISTORY_MIN_DAYS = 14
        private const val WEEK_MS = 7L * 24 * 60 * 60 * 1000
        private const val RECENT_SEARCHES_MAX = 8
        private const val DEEP_DIVE_RESUME_PREFS = "thesis_deep_dive_resume"
        /** The analytics feature of a purchase made from a Paywall that names none. */
        private const val GENERAL_UPGRADE_FEATURE = "general_upgrade"
        private const val KEY_RESUME_JOB_ID = "job_id"
        private const val KEY_RESUME_TICKER = "ticker"
        private const val KEY_RESUME_STARTED_AT = "started_at_ms"
        private const val DEEP_DIVE_POLL_INTERVAL_MS = 2_000L
        private const val DEEP_DIVE_READY_MESSAGE = AppMessages.DEEP_DIVE_READY
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
