package com.thesis.mobile.ui

import android.app.Application
import android.util.Base64
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.messaging.FirebaseMessaging
import com.thesis.mobile.data.SessionStore
import com.thesis.mobile.model.AuthTokens
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.model.TickerSearchItem
import com.thesis.mobile.network.ProductApiClient
import com.thesis.mobile.network.ProductApiException
import com.thesis.mobile.observability.MobileTelemetry
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import org.json.JSONObject
import java.io.IOException

enum class AppTab {
    PULSE,
    DEEP_DIVE,
    WATCHLIST,
    SETTINGS
}

data class UiState(
    val currentTab: AppTab = AppTab.PULSE,
    val showWelcome: Boolean = false,
    val apiBaseUrl: String = "",
    val notificationsEnabled: Boolean = true,
    val watchlistFeatureEnabled: Boolean = true,
    val tokens: AuthTokens? = null,
    val verificationToken: String? = null,
    val registerStatus: String? = null,
    val message: String? = null,
    val isLoading: Boolean = false,
    val tickers: List<TickerSearchItem> = emptyList(),
    val selectedTicker: String? = null,
    val jobStatus: String? = null,
    val deepDiveReport: DeepDiveReportView? = null,
    val pulseReport: PulseReportView? = null,
    val reportHistory: List<ReportHistoryItem> = emptyList(),
    val watchlist: List<String> = emptyList()
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
            refreshFeatureFlags()
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

    fun openPulseFromNotification() {
        setTab(AppTab.PULSE)
    }

    fun setTab(tab: AppTab) {
        if (tab == AppTab.WATCHLIST && !state.watchlistFeatureEnabled) {
            publish(state.copy(message = "Watchlist is currently disabled by feature flag."))
            return
        }

        publish(state.copy(currentTab = tab))
        when (tab) {
            AppTab.PULSE -> refreshPulse()
            AppTab.WATCHLIST -> refreshWatchlist()
            AppTab.DEEP_DIVE -> refreshReportHistory()
            else -> Unit
        }
    }

    fun updateApiBaseUrl(newUrl: String) {
        val normalized = newUrl.trim().trimEnd('/')
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
                publish(state.copy(isLoading = false, tokens = tokens, message = "Login successful."))
                refreshFeatureFlags()
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
                client.logout(state.apiBaseUrl, current.accessToken, current.refreshToken)
            }
            sessionStore.clearTokens()
            publish(
                state.copy(
                    tokens = null,
                    tickers = emptyList(),
                    selectedTicker = null,
                    deepDiveReport = null,
                    pulseReport = null,
                    watchlist = emptyList(),
                    reportHistory = emptyList(),
                    jobStatus = null,
                    watchlistFeatureEnabled = true,
                    message = "Logged out."
                )
            )
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
            publish(state.copy(isLoading = true, deepDiveReport = null, jobStatus = "queued"))
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
        withAuthorizedCall {
            val report = client.getDeepDiveReport(state.apiBaseUrl, requireTokens().accessToken, reportId)
            publish(
                state.copy(
                    currentTab = AppTab.DEEP_DIVE,
                    deepDiveReport = report,
                    message = "Loaded report from history."
                )
            )
            trackEvent(
                "deep_dive_viewed",
                mapOf(
                    "report_id" to report.reportId,
                    "ticker" to (report.ticker ?: "unknown")
                )
            )
        }
    }

    fun refreshPulse() {
        withAuthorizedCall {
            val pulse = client.getLatestPulse(state.apiBaseUrl, requireTokens().accessToken)
            publish(state.copy(pulseReport = pulse))
            trackEvent(
                "pulse_viewed",
                mapOf("report_id" to pulse.reportId)
            )
        }
    }

    fun loadPulseByDate(date: String) {
        val trimmed = date.trim()
        if (!Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(trimmed)) {
            publish(state.copy(message = "Enter date as YYYY-MM-DD."))
            return
        }
        withAuthorizedCall {
            val pulse = client.getPulseByDate(state.apiBaseUrl, requireTokens().accessToken, trimmed)
            publish(state.copy(pulseReport = pulse, message = "Loaded pulse for $trimmed."))
            trackEvent(
                "pulse_viewed",
                mapOf(
                    "report_id" to pulse.reportId,
                    "requested_date" to trimmed
                )
            )
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
                                message = "Deep Dive ready."
                            )
                        )
                        refreshReportHistory()
                        trackEvent(
                            "deep_dive_viewed",
                            mapOf(
                                "report_id" to report.reportId,
                                "ticker" to (report.ticker ?: "unknown")
                            )
                        )
                        return
                    }
                }
                "failed" -> {
                    publish(
                        state.copy(
                            isLoading = false,
                            message = status.errorMessage ?: "Deep Dive failed."
                        )
                    )
                    return
                }
            }
            delay(2000)
        }
        publish(state.copy(isLoading = false, message = "Deep Dive timed out. Please retry."))
    }

    private fun withAuthorizedCall(block: suspend () -> Unit) {
        viewModelScope.launch {
            publish(state.copy(isLoading = true, message = null))
            runCatching {
                block()
            }.onSuccess {
                publish(state.copy(isLoading = false))
            }.onFailure { error ->
                if (error is ProductApiException && error.code == 401 && tryRefreshToken()) {
                    runCatching { block() }
                        .onSuccess { publish(state.copy(isLoading = false)) }
                        .onFailure { secondError ->
                            publish(state.copy(isLoading = false, message = toMessage(secondError)))
                        }
                    return@launch
                }
                publish(state.copy(isLoading = false, message = toMessage(error)))
            }
        }
    }

    private suspend fun tryRefreshToken(): Boolean {
        val current = state.tokens ?: return false
        return runCatching {
            client.refresh(state.apiBaseUrl, current.refreshToken)
        }.onSuccess { newTokens ->
            sessionStore.saveTokens(newTokens)
            publish(state.copy(tokens = newTokens))
        }.isSuccess
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

    private fun refreshFeatureFlags() {
        viewModelScope.launch {
            val value = runCatching { telemetry.fetchWatchlistFlag(distinctId()) }.getOrNull()
            if (value != null) {
                val safeTab = if (!value && state.currentTab == AppTab.WATCHLIST) AppTab.PULSE else state.currentTab
                publish(
                    state.copy(
                        watchlistFeatureEnabled = value,
                        currentTab = safeTab
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

    private fun publish(newState: UiState) {
        state = newState
        observer?.invoke(state)
    }
}
