package com.thesis.mobile.ui

import android.app.Application
import android.app.Activity
import android.util.Base64
import androidx.biometric.BiometricManager
import androidx.lifecycle.AndroidViewModel
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
import com.thesis.mobile.network.ProductApiClient
import com.thesis.mobile.network.ProductApiException
import com.thesis.mobile.observability.MobileTelemetry
import com.thesis.mobile.offline.OfflineCacheStore
import com.thesis.mobile.offline.PrefetchScheduler
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import org.json.JSONObject
import java.io.IOException
import java.net.URI
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

enum class AppTab {
    TODAY,
    NAMES,
    RESEARCH,
    INBOX,
    YOU
}

data class UiState(
    val currentTab: AppTab = AppTab.TODAY,
    val showWelcome: Boolean = false,
    val apiBaseUrl: String = "",
    val notificationsEnabled: Boolean = true,
    val watchlistFeatureEnabled: Boolean = true,
    val notificationPreferences: List<NotificationPreferenceView> = defaultNotificationPreferences(),
    val tokens: AuthTokens? = null,
    val verificationToken: String? = null,
    val registerStatus: String? = null,
    val message: String? = null,
    val isLoading: Boolean = false,
    val tickers: List<TickerSearchItem> = emptyList(),
    val selectedTicker: String? = null,
    val jobStatus: String? = null,
    val deepDiveReport: DeepDiveReportView? = null,
    val deepDiveError: String? = null,
    val reportNote: ReportNoteView? = null,
    val reportNoteDraft: String = "",
    val isSavingNote: Boolean = false,
    val convictionTimeline: List<ConvictionJournalEntryView> = emptyList(),
    val convictionTimelineError: String? = null,
    val convictionInsights: List<ConvictionInsightCardView> = emptyList(),
    val convictionInsightsError: String? = null,
    val oppositeCase: OppositeCaseReportView? = null,
    val oppositeCaseError: String? = null,
    val isGeneratingOppositeCase: Boolean = false,
    val scenarioStressTemplates: List<ScenarioStressTemplateView> = emptyList(),
    val selectedScenarioStressId: String? = null,
    val scenarioStressRun: ScenarioStressRunView? = null,
    val scenarioStressTemplatesError: String? = null,
    val scenarioStressRunError: String? = null,
    val isLoadingScenarioStressTemplates: Boolean = false,
    val isRunningScenarioStress: Boolean = false,
    val scenarioResult: ScenarioResultView? = null,
    val isRunningScenario: Boolean = false,
    val pulseReport: PulseReportView? = null,
    val pulseLoadedFromCache: Boolean = false,
    val pulseFreshnessText: String? = null,
    val pulseError: String? = null,
    val sentimentCurrent: SentimentSnapshotView? = null,
    val sentimentHistory: List<SentimentSnapshotView> = emptyList(),
    val sentimentRangeDays: Int = 30,
    val sentimentError: String? = null,
    val alertLedger: List<AlertLedgerItemView> = emptyList(),
    val inboxError: String? = null,
    val monitorSnapshots: List<ThesisMonitorSnapshotView> = emptyList(),
    val warRoom: WarRoomView? = null,
    val warRoomError: String? = null,
    val reportHistory: List<ReportHistoryItem> = emptyList(),
    val watchlist: List<String> = emptyList(),
    val lastViewedReport: LastViewedReport? = null,
    val biometricSupported: Boolean = false,
    val biometricLockEnabled: Boolean = false,
    val userProfile: UserProfileView? = null,
    val paywallFeature: String? = null,
    val subscriptionOffers: List<SubscriptionOfferView> = emptyList(),
    val subscriptionActionInFlight: Boolean = false
)

data class PulsePdfDownload(
    val bytes: ByteArray,
    val filename: String
)

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val sessionStore = SessionStore(application.applicationContext)
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
        tokens = sessionStore.loadTokens()
    )
        private set

    private var observer: ((UiState) -> Unit)? = null

    init {
        if (state.tokens != null) {
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
            viewModelScope.launch {
                syncPushToken()
            }
        }
    }

    fun observe(listener: (UiState) -> Unit) {
        observer = listener
        listener(state)
    }

    fun clearMessage() {
        publish(state.copy(message = null))
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
        publish(state.copy(currentTab = AppTab.TODAY))
        if (!reportDate.isNullOrBlank()) {
            loadPulseByDate(reportDate, rememberAsLastViewed = true)
        } else {
            refreshPulse(rememberAsLastViewed = true)
        }
    }

    fun setTab(tab: AppTab) {
        publish(state.copy(currentTab = tab))
        when (tab) {
            AppTab.TODAY -> {
                refreshPulse()
                refreshMacroStress()
                refreshMonitorSnapshots()
                refreshAlertLedger()
            }
            AppTab.NAMES -> {
                refreshWatchlist()
                refreshMonitorSnapshots()
                refreshAlertLedger()
            }
            AppTab.RESEARCH -> {
                refreshReportHistory()
                state.deepDiveReport?.let { refreshConvictionForReport(it) }
                maybeRefreshScenarioStressTemplates()
            }
            AppTab.INBOX -> refreshAlertLedger()
            AppTab.YOU -> {
                refreshWatchlist()
                refreshUserProfile()
                refreshNotificationPreferences()
                refreshConvictionInsights()
            }
        }
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
            publish(state.copy(isLoading = true, message = null, registerStatus = null))
            runCatching {
                client.register(state.apiBaseUrl, email, password)
            }.onSuccess { result ->
                publish(
                    state.copy(
                        isLoading = false,
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
                publish(state.copy(isLoading = false, message = toMessage(error)))
            }
        }
    }

    fun verify(token: String) {
        viewModelScope.launch {
            publish(state.copy(isLoading = true, message = null))
            runCatching {
                client.verify(state.apiBaseUrl, token)
            }.onSuccess {
                publish(state.copy(isLoading = false, message = "Account verified. You can login now."))
            }.onFailure { error ->
                publish(state.copy(isLoading = false, message = toMessage(error)))
            }
        }
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            publish(state.copy(isLoading = true, message = null))
            runCatching {
                client.login(state.apiBaseUrl, email, password)
            }.onSuccess { tokens ->
                sessionStore.saveTokens(tokens)
                sessionStore.setHasSeenWelcome(true)
                publish(
                    state.copy(
                        isLoading = false,
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
                syncPushToken()
                PrefetchScheduler.schedule(getApplication<Application>().applicationContext)
                trackEvent(
                    "login_completed",
                    mapOf("method" to "email_password")
                )
            }.onFailure { error ->
                publish(state.copy(isLoading = false, message = toMessage(error)))
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

    fun confirmPasswordReset(token: String, newPassword: String, onResult: (error: String?) -> Unit) {
        viewModelScope.launch {
            runCatching { client.confirmPasswordReset(state.apiBaseUrl, token.trim(), newPassword) }
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

        withAuthorizedCall {
            publish(
                state.copy(
                    isLoading = true,
                    deepDiveReport = null,
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
            val job = client.createDeepDiveJob(state.apiBaseUrl, requireTokens().accessToken, ticker)
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
            pollDeepDiveJob(job.jobId)
        }
    }

    fun refreshReportHistory() {
        withAuthorizedCall {
            val reports = client.listReports(state.apiBaseUrl, requireTokens().accessToken)
            publish(state.copy(reportHistory = reports))
        }
    }

    fun openHistoryReport(reportId: String) {
        viewModelScope.launch {
            publish(state.copy(isLoading = true, message = null, deepDiveError = null))
            val error = runAuthorizedWithRefresh {
                val report = client.getDeepDiveReport(state.apiBaseUrl, requireTokens().accessToken, reportId)
                val note = runCatching {
                    client.getReportNote(state.apiBaseUrl, requireTokens().accessToken, report.reportId)
                }.getOrNull()
                cacheStore.cacheDeepDive(report, notePinned = !note?.content.isNullOrBlank())
                publish(
                    state.copy(
                        currentTab = AppTab.RESEARCH,
                        deepDiveReport = report,
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
                if (cached != null) {
                    publish(
                        state.copy(
                            isLoading = false,
                            currentTab = AppTab.RESEARCH,
                            deepDiveReport = cached,
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
                    publish(state.copy(isLoading = false, message = message, deepDiveError = message))
                }
            } else {
                publish(state.copy(isLoading = false))
            }
        }
    }

    fun dismissResumeCard() {
        sessionStore.clearLastViewedReport()
        publish(state.copy(lastViewedReport = null))
    }

    fun openWarRoom(warRoomId: String) {
        val normalizedWarRoomId = warRoomId.trim()
        if (normalizedWarRoomId.isBlank()) {
            publish(state.copy(message = "Open a War Room first."))
            return
        }

        viewModelScope.launch {
            publish(state.copy(isLoading = true, message = null, warRoomError = null))
            val error = runAuthorizedWithRefresh {
                val warRoom = client.getWarRoom(
                    state.apiBaseUrl,
                    requireTokens().accessToken,
                    normalizedWarRoomId
                )
                publish(
                    state.copy(
                        currentTab = AppTab.RESEARCH,
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
            if (error != null) {
                val message = toMessage(error)
                publish(
                    state.copy(
                        isLoading = false,
                        currentTab = AppTab.RESEARCH,
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
            publish(state.copy(isLoading = false))
        }
    }

    fun refreshWarRoom() {
        val warRoomId = state.warRoom?.warRoomId?.trim().orEmpty()
        if (warRoomId.isBlank()) {
            return
        }
        openWarRoom(warRoomId)
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
                publish(state.copy(currentTab = AppTab.TODAY))
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
        viewModelScope.launch {
            publish(state.copy(isLoading = true, message = null, pulseError = null))
            val error = runAuthorizedWithRefresh {
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
                if (rememberAsLastViewed) {
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
            if (error != null) {
                val cachedPulse = cacheStore.getCachedPulse()
                if (cachedPulse != null) {
                    publish(
                        state.copy(
                            isLoading = false,
                            pulseReport = cachedPulse,
                            pulseLoadedFromCache = true,
                            pulseFreshnessText = formatPulseFreshness(cachedPulse.generatedAt, fromCache = true),
                            pulseError = null,
                            message = "Showing cached pulse while network is unavailable."
                        )
                    )
                    if (rememberAsLastViewed) {
                        rememberPulse(cachedPulse)
                    }
                    trackEvent(
                        "cache_hit",
                        mapOf(
                            "artifact" to "pulse_latest",
                            "report_id" to cachedPulse.reportId
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
                        mapOf("artifact" to "pulse_latest")
                    )
                    val message = toMessage(error)
                    publish(state.copy(isLoading = false, message = message, pulseError = message))
                }
            } else {
                publish(state.copy(isLoading = false))
            }
        }
    }

    fun loadPulseByDate(date: String, rememberAsLastViewed: Boolean = false) {
        val trimmed = date.trim()
        if (!Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(trimmed)) {
            publish(state.copy(message = "Enter date as YYYY-MM-DD."))
            return
        }
        viewModelScope.launch {
            publish(state.copy(isLoading = true, message = null, pulseError = null))
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
                publish(state.copy(isLoading = false, message = message, pulseError = message))
            } else {
                publish(state.copy(isLoading = false))
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
        viewModelScope.launch {
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
                val cachedCurrent = cacheStore.getCachedSentimentCurrent()
                val cachedHistory = cacheStore.getCachedSentimentHistory(normalizedDays)
                if (cachedCurrent != null || cachedHistory.isNotEmpty()) {
                    publish(
                        state.copy(
                            sentimentCurrent = cachedCurrent,
                            sentimentHistory = cachedHistory,
                            sentimentRangeDays = normalizedDays,
                            sentimentError = "Showing cached macro stress while network is unavailable."
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

    fun refreshWatchlist() {
        withAuthorizedCall {
            val items = client.getWatchlist(state.apiBaseUrl, requireTokens().accessToken)
            publish(state.copy(watchlist = items))
            refreshMonitorSnapshots()
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
        val tokens = state.tokens ?: return
        viewModelScope.launch {
            val error = runAuthorizedWithRefresh {
                val alerts = client.getAlertLedger(
                    state.apiBaseUrl,
                    tokens.accessToken
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
        }
    }

    fun refreshMonitorSnapshots() {
        val tokens = state.tokens ?: return
        viewModelScope.launch {
            val error = runAuthorizedWithRefresh {
                val snapshots = client.getMonitorSnapshots(
                    state.apiBaseUrl,
                    tokens.accessToken
                )
                publish(state.copy(monitorSnapshots = snapshots))
            }
            if (error != null) {
                return@launch
            }
        }
    }

    private suspend fun pollDeepDiveJob(jobId: String) {
        repeat(50) { // ~100 seconds at 2s interval
            val status = client.getJobStatus(state.apiBaseUrl, requireTokens().accessToken, jobId)
            publish(state.copy(jobStatus = status.status))
            when (status.status) {
                "complete" -> {
                    val reportId = status.reportId
                    if (!reportId.isNullOrBlank()) {
                        val report = client.getDeepDiveReport(
                            state.apiBaseUrl,
                            requireTokens().accessToken,
                            reportId
                        )
                        val note = runCatching {
                            client.getReportNote(state.apiBaseUrl, requireTokens().accessToken, report.reportId)
                        }.getOrNull()
                        cacheStore.cacheDeepDive(report, notePinned = !note?.content.isNullOrBlank())
                        publish(
                            state.copy(
                                isLoading = false,
                                deepDiveReport = report,
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
                                message = "Deep Dive ready.",
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
                    val failureMessage = status.errorMessage ?: "Deep Dive failed."
                    publish(
                        state.copy(
                            isLoading = false,
                            message = failureMessage,
                            deepDiveError = failureMessage
                        )
                    )
                    return
                }
            }
            delay(2000)
        }
        publish(
            state.copy(
                isLoading = false,
                message = "Deep Dive timed out. Please retry.",
                deepDiveError = "Deep Dive timed out. Please retry."
            )
        )
    }

    private fun withAuthorizedCall(block: suspend () -> Unit) {
        viewModelScope.launch {
            publish(state.copy(isLoading = true, message = null))
            val error = runAuthorizedWithRefresh(block)
            if (error == null) {
                publish(state.copy(isLoading = false))
            } else {
                val upgrade = (error as? ProductApiException)
                    ?.takeIf { it.code == 403 && it.errorCode == "upgrade_required" }
                if (upgrade != null) {
                    publish(
                        state.copy(
                            isLoading = false,
                            paywallFeature = upgrade.feature ?: "pro_features",
                            message = upgrade.message
                        )
                    )
                } else {
                    publish(state.copy(isLoading = false, message = toMessage(error)))
                }
            }
        }
    }

    private suspend fun runAuthorizedWithRefresh(block: suspend () -> Unit): Throwable? {
        return runCatching {
            block()
        }.recoverCatching { error ->
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
        }.exceptionOrNull()
    }

    private suspend fun clearLocalSession(message: String) {
        PrefetchScheduler.cancel(getApplication<Application>().applicationContext)
        cacheStore.clearAll()
        sessionStore.clearLastViewedReport()
        sessionStore.clearTokens()
        val hasSeenWelcome = sessionStore.hasSeenWelcome()
        publish(
            state.copy(
                currentTab = AppTab.TODAY,
                showWelcome = !hasSeenWelcome,
                tokens = null,
                tickers = emptyList(),
                selectedTicker = null,
                deepDiveReport = null,
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
                notificationPreferences = defaultNotificationPreferences(),
                lastViewedReport = null,
                jobStatus = null,
                watchlistFeatureEnabled = true,
                userProfile = null,
                paywallFeature = null,
                subscriptionOffers = emptyList(),
                subscriptionActionInFlight = false,
                isLoading = false,
                message = message
            )
        )
    }

    private suspend fun tryRefreshToken(): Boolean {
        val current = state.tokens ?: return false
        return runCatching {
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
        }
    }

    private fun refreshFeatureFlags() {
        viewModelScope.launch {
            val value = runCatching { telemetry.fetchWatchlistFlag(distinctId()) }.getOrNull()
            if (value != null) {
                publish(
                    state.copy(
                        watchlistFeatureEnabled = value,
                        currentTab = state.currentTab
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

    companion object {
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

internal fun defaultNotificationPreferences(): List<NotificationPreferenceView> =
    listOf(
        NotificationPreferenceView(type = "earnings_preview", enabled = true, quietUntil = null),
        NotificationPreferenceView(type = "earnings_war_room", enabled = true, quietUntil = null),
        NotificationPreferenceView(type = "contrarian_alert", enabled = true, quietUntil = null),
        NotificationPreferenceView(type = "kill_switch", enabled = true, quietUntil = null),
        NotificationPreferenceView(type = "freshness_decay", enabled = true, quietUntil = null),
        NotificationPreferenceView(type = "morning_exception_briefing", enabled = true, quietUntil = null),
        NotificationPreferenceView(type = "weekly_digest", enabled = true, quietUntil = null),
        NotificationPreferenceView(type = "market_pulse_ready", enabled = true, quietUntil = null),
        NotificationPreferenceView(type = "pulse_email", enabled = true, quietUntil = null)
    )

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
