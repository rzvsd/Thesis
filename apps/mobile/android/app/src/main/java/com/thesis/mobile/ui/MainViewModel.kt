package com.thesis.mobile.ui

import android.app.Application
import android.app.Activity
import android.util.Base64
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.messaging.FirebaseMessaging
import com.revenuecat.purchases.PackageType
import com.thesis.mobile.billing.RevenueCatBilling
import com.thesis.mobile.data.SessionStore
import com.thesis.mobile.model.AuthTokens
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.LastViewedReport
import com.thesis.mobile.model.NotificationPreferenceView
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.model.SubscriptionOfferView
import com.thesis.mobile.model.TickerSearchItem
import com.thesis.mobile.model.UserProfileView
import com.thesis.mobile.network.ProductApiClient
import com.thesis.mobile.network.ProductApiException
import com.thesis.mobile.observability.MobileTelemetry
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import org.json.JSONObject
import java.io.IOException
import java.net.URI

enum class AppTab {
    TODAY,
    RESEARCH,
    PORTFOLIO
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
    val pulseReport: PulseReportView? = null,
    val pulseError: String? = null,
    val reportHistory: List<ReportHistoryItem> = emptyList(),
    val watchlist: List<String> = emptyList(),
    val lastViewedReport: LastViewedReport? = null,
    val userProfile: UserProfileView? = null,
    val paywallFeature: String? = null,
    val subscriptionOffers: List<SubscriptionOfferView> = emptyList(),
    val subscriptionActionInFlight: Boolean = false
)

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val sessionStore = SessionStore(application.applicationContext)
    private val client = ProductApiClient()
    private val telemetry = MobileTelemetry()
    private val installationDistinctId = sessionStore.getInstallationId()

    var state: UiState = UiState(
        showWelcome = !sessionStore.hasSeenWelcome(),
        apiBaseUrl = sessionStore.loadApiBaseUrl(),
        notificationsEnabled = sessionStore.areNotificationsEnabled(),
        tokens = sessionStore.loadTokens()
    )
        private set

    private var observer: ((UiState) -> Unit)? = null

    init {
        if (state.tokens != null) {
            state = state.copy(lastViewedReport = sessionStore.getLastViewedReport())
            refreshFeatureFlags()
            refreshUserProfile()
            refreshNotificationPreferences()
            refreshSubscriptionOffers()
            refreshPulse()
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

    fun completeWelcome() {
        sessionStore.setHasSeenWelcome(true)
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
            AppTab.TODAY -> refreshPulse()
            AppTab.RESEARCH -> refreshReportHistory()
            AppTab.PORTFOLIO -> {
                refreshWatchlist()
                refreshUserProfile()
                refreshNotificationPreferences()
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
        viewModelScope.launch {
            syncPushToken()
        }
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
                publish(
                    state.copy(
                        isLoading = false,
                        tokens = tokens,
                        message = "Login successful.",
                        pulseError = null,
                        deepDiveError = null
                    )
                )
                refreshFeatureFlags()
                refreshUserProfile()
                refreshNotificationPreferences()
                refreshSubscriptionOffers()
                refreshPulse()
                refreshReportHistory()
                syncPushToken()
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
                sessionStore.clearTokens()
                publish(state.copy(tokens = null, message = "Logged out."))
                return@launch
            }

            runCatching {
                // Unregister device before token clear to avoid stale push subscriptions.
                client.updateDeviceToken(state.apiBaseUrl, current.accessToken, null)
            }
            runCatching {
                client.logout(state.apiBaseUrl, current.accessToken, current.refreshToken)
            }
            runCatching {
                RevenueCatBilling.logOutSafely()
            }
            sessionStore.clearTokens()
            publish(
                state.copy(
                    tokens = null,
                    tickers = emptyList(),
                    selectedTicker = null,
                    deepDiveReport = null,
                    pulseReport = null,
                    pulseError = null,
                    deepDiveError = null,
                    watchlist = emptyList(),
                    reportHistory = emptyList(),
                    notificationPreferences = defaultNotificationPreferences(),
                    jobStatus = null,
                    watchlistFeatureEnabled = true,
                    userProfile = null,
                    paywallFeature = null,
                    subscriptionOffers = emptyList(),
                    message = "Logged out."
                )
            )
        }
    }

    fun dismissPaywall() {
        publish(state.copy(paywallFeature = null))
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
                val monthly = RevenueCatBilling.pickPreferredPackage(offerings, PackageType.MONTHLY)
                val annual = RevenueCatBilling.pickPreferredPackage(offerings, PackageType.ANNUAL)
                listOfNotNull(monthly, annual)
                    .distinctBy { it.identifier }
                    .map { pack ->
                        SubscriptionOfferView(
                            packageType = pack.packageType.name,
                            identifier = pack.identifier,
                            title = pack.product.title.ifBlank { pack.identifier }
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
                refreshSubscriptionOffers()
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
                refreshSubscriptionOffers()
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
                publish(
                    state.copy(
                        currentTab = AppTab.RESEARCH,
                        deepDiveReport = report,
                        message = "Loaded report from history.",
                        deepDiveError = null
                    )
                )
                val tickerSafe = report.ticker ?: "unknown"
                sessionStore.saveLastViewedReport(report.reportId, tickerSafe, "DEEP_DIVE")
                publish(state.copy(lastViewedReport = sessionStore.getLastViewedReport()))
                trackEvent(
                    "deep_dive_viewed",
                    mapOf(
                        "report_id" to report.reportId,
                        "ticker" to tickerSafe
                    )
                )
            }
            if (error != null) {
                val message = toMessage(error)
                publish(state.copy(isLoading = false, message = message, deepDiveError = message))
            } else {
                publish(state.copy(isLoading = false))
            }
        }
    }

    fun dismissResumeCard() {
        sessionStore.clearLastViewedReport()
        publish(state.copy(lastViewedReport = null))
    }

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
                publish(state.copy(pulseReport = pulse, pulseError = null))
                if (rememberAsLastViewed) {
                    rememberPulse(pulse)
                }
                trackEvent(
                    "pulse_viewed",
                    mapOf("report_id" to pulse.reportId)
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
                publish(state.copy(pulseReport = pulse, message = "Loaded pulse for $trimmed.", pulseError = null))
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
            }
            if (error != null) {
                val message = toMessage(error)
                publish(state.copy(isLoading = false, message = message, pulseError = message))
            } else {
                publish(state.copy(isLoading = false))
            }
        }
    }

    fun refreshWatchlist() {
        withAuthorizedCall {
            val items = client.getWatchlist(state.apiBaseUrl, requireTokens().accessToken)
            publish(state.copy(watchlist = items))
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
                        publish(
                            state.copy(
                                isLoading = false,
                                deepDiveReport = report,
                                message = "Deep Dive ready.",
                                deepDiveError = null
                            )
                        )
                        val tickerSafe = report.ticker ?: "unknown"
                        sessionStore.saveLastViewedReport(report.reportId, tickerSafe, "DEEP_DIVE")
                        publish(state.copy(lastViewedReport = sessionStore.getLastViewedReport()))
                        refreshReportHistory()
                        trackEvent(
                            "deep_dive_viewed",
                            mapOf(
                                "report_id" to report.reportId,
                                "ticker" to tickerSafe
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
            if (error is ProductApiException && error.code == 401 && tryRefreshToken()) {
                block()
            } else {
                throw error
            }
        }.exceptionOrNull()
    }

    private suspend fun tryRefreshToken(): Boolean {
        val current = state.tokens ?: return false
        return runCatching {
            client.refresh(state.apiBaseUrl, current.refreshToken)
        }.onSuccess { newTokens ->
            sessionStore.saveTokens(newTokens)
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
                client.updateDeviceToken(state.apiBaseUrl, tokens.accessToken, null)
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
            client.updateDeviceToken(state.apiBaseUrl, tokens.accessToken, firebaseToken)
        }
    }

    private fun refreshUserProfile() {
        withAuthorizedCall {
            val profile = client.getUserProfile(state.apiBaseUrl, requireTokens().accessToken)
            publish(state.copy(userProfile = profile))
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

    private fun toMessage(error: Throwable): String = when (error) {
        is ProductApiException -> error.message
        is IOException -> "No internet connection. Please check network and retry."
        else -> error.message ?: "Unexpected error."
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

    private fun mergeNotificationPreferences(
        fetched: List<NotificationPreferenceView>
    ): List<NotificationPreferenceView> {
        val byType = fetched.associateBy { it.type.trim() }
        return notificationPreferenceTypes.map { type ->
            byType[type] ?: NotificationPreferenceView(type = type, enabled = true)
        }
    }

    companion object {
        private val notificationPreferenceTypes = listOf(
            "earnings_preview",
            "contrarian_alert",
            "weekly_digest",
            "market_pulse_ready"
        )
    }
}

private fun defaultNotificationPreferences(): List<NotificationPreferenceView> =
    listOf(
        NotificationPreferenceView(type = "earnings_preview", enabled = true),
        NotificationPreferenceView(type = "contrarian_alert", enabled = true),
        NotificationPreferenceView(type = "weekly_digest", enabled = true),
        NotificationPreferenceView(type = "market_pulse_ready", enabled = true)
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
