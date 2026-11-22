package com.thesis.mobile.network

import com.thesis.mobile.model.AuthTokens
import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.model.ConvictionEvidenceRefView
import com.thesis.mobile.model.ConvictionInsightCardView
import com.thesis.mobile.model.ConvictionInsightFindingView
import com.thesis.mobile.model.ConvictionJournalEntryView
import com.thesis.mobile.model.ConvictionThesisSnapshotView
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.EvidenceView
import com.thesis.mobile.model.HoldingsImportResultView
import com.thesis.mobile.model.HoldingsImportRowErrorView
import com.thesis.mobile.model.JobStatus
import com.thesis.mobile.model.NotificationPreferenceView
import com.thesis.mobile.model.BriefingContextView
import com.thesis.mobile.model.OppositeCasePointView
import com.thesis.mobile.model.OppositeCaseReportView
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.RegisterResult
import com.thesis.mobile.model.ReportNoteView
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.model.ScenarioOverridesView
import com.thesis.mobile.model.ScenarioStressImpactView
import com.thesis.mobile.model.ScenarioStressRouteView
import com.thesis.mobile.model.ScenarioStressRuleSuggestionView
import com.thesis.mobile.model.ScenarioStressRunHeaderView
import com.thesis.mobile.model.ScenarioStressRunView
import com.thesis.mobile.model.ScenarioStressTemplateView
import com.thesis.mobile.model.ScenarioResultView
import com.thesis.mobile.model.SectionView
import com.thesis.mobile.model.SentimentSnapshotView
import com.thesis.mobile.model.SentimentSubScoreView
import com.thesis.mobile.model.ThesisMonitorSnapshotView
import com.thesis.mobile.model.TickerSearchItem
import com.thesis.mobile.model.UserProfileView
import com.thesis.mobile.model.WarRoomView
import com.thesis.mobile.model.ReportViewMapper
import com.thesis.mobile.model.WarRoomViewMapper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException

class ProductApiClient {
    private val client = OkHttpClient()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    suspend fun register(baseUrl: String, email: String, password: String): RegisterResult =
        withContext(Dispatchers.IO) {
            val body = JSONObject()
                .put("email", email)
                .put("password", password)
            val json = requestJson(baseUrl, "POST", "/auth/register", body = body)
            RegisterResult(
                status = json.optString("status"),
                email = json.optNullableString("email"),
                verificationToken = json.optNullableString("verification_token")
            )
        }

    suspend fun verify(baseUrl: String, token: String) = withContext(Dispatchers.IO) {
        val body = JSONObject().put("token", token)
        requestJson(baseUrl, "POST", "/auth/verify", body = body)
    }

    suspend fun login(baseUrl: String, email: String, password: String): AuthTokens =
        withContext(Dispatchers.IO) {
            val body = JSONObject()
                .put("email", email)
                .put("password", password)
            parseTokens(requestJson(baseUrl, "POST", "/auth/login", body = body))
        }

    suspend fun requestPasswordReset(baseUrl: String, email: String): String =
        withContext(Dispatchers.IO) {
            val body = JSONObject().put("email", email)
            requestJson(baseUrl, "POST", "/auth/password-reset/request", body = body)
                .optString("message")
        }

    suspend fun confirmPasswordReset(baseUrl: String, token: String, newPassword: String) =
        withContext(Dispatchers.IO) {
            val body = JSONObject()
                .put("token", token)
                .put("new_password", newPassword)
            requestJson(baseUrl, "POST", "/auth/password-reset/confirm", body = body)
        }

    /** Returns the store subscription notice when the account had a paid tier. */
    suspend fun deleteAccount(baseUrl: String, accessToken: String): String? =
        withContext(Dispatchers.IO) {
            requestJson(baseUrl, "DELETE", "/v1/account", accessToken = accessToken)
                .optNullableString("store_subscription_notice")
        }

    suspend fun refresh(baseUrl: String, refreshToken: String): AuthTokens =
        withContext(Dispatchers.IO) {
            val body = JSONObject().put("refresh_token", refreshToken)
            parseTokens(requestJson(baseUrl, "POST", "/auth/refresh", body = body))
        }

    suspend fun logout(baseUrl: String, accessToken: String, refreshToken: String?) =
        withContext(Dispatchers.IO) {
            val body = JSONObject()
            if (!refreshToken.isNullOrBlank()) {
                body.put("refresh_token", refreshToken)
            }
            requestJson(baseUrl, "POST", "/auth/logout", accessToken = accessToken, body = body)
        }

    suspend fun updateDeviceToken(
        baseUrl: String,
        accessToken: String,
        deviceToken: String?,
        installationId: String,
        platform: String = "android"
    ) =
        withContext(Dispatchers.IO) {
            val body = JSONObject()
                .put("device_token", deviceToken)
                .put("installation_id", installationId)
                .put("platform", platform)
            requestJson(
                baseUrl,
                "POST",
                "/notifications/device-token",
                accessToken = accessToken,
                body = body
            )
        }

    suspend fun getNotificationPreferences(
        baseUrl: String,
        accessToken: String
    ): List<NotificationPreferenceView> = withContext(Dispatchers.IO) {
        val json = requestJson(
            baseUrl,
            "GET",
            "/v1/user/notification-preferences",
            accessToken = accessToken
        )
        parseNotificationPreferences(json)
    }

    suspend fun updateNotificationPreference(
        baseUrl: String,
        accessToken: String,
        notificationType: String,
        enabled: Boolean
    ): List<NotificationPreferenceView> = withContext(Dispatchers.IO) {
        val body = JSONObject()
            .put(
                "preferences",
                JSONArray().put(
                    JSONObject()
                        .put("type", notificationType)
                        .put("enabled", enabled)
                )
            )
        val json = requestJson(
            baseUrl,
            "PUT",
            "/v1/user/notification-preferences",
            accessToken = accessToken,
            body = body
        )
        parseNotificationPreferences(json)
    }

    suspend fun getAlertLedger(
        baseUrl: String,
        accessToken: String,
        category: String? = null,
        limit: Int = 50
    ): List<AlertLedgerItemView> = withContext(Dispatchers.IO) {
        val query = buildString {
            append("/v1/user/alerts?limit=$limit")
            if (!category.isNullOrBlank()) {
                append("&category=${urlEncode(category)}")
            }
        }
        val json = requestJson(
            baseUrl,
            "GET",
            query,
            accessToken = accessToken
        )
        val rows = json.optJSONArray("data") ?: JSONArray()
        (0 until rows.length()).mapNotNull { index ->
            mapAlertLedgerItem(rows.optJSONObject(index))
        }
    }

    suspend fun submitAlertFeedback(
        baseUrl: String,
        accessToken: String,
        alertId: String,
        feedback: String
    ): AlertLedgerItemView = withContext(Dispatchers.IO) {
        val body = JSONObject().put("feedback", feedback)
        val json = requestJson(
            baseUrl,
            "POST",
            "/v1/user/alerts/${urlEncode(alertId)}/feedback",
            accessToken = accessToken,
            body = body
        )
        mapAlertLedgerItem(json.optJSONObject("data"))
            ?: throw ProductApiException(500, "Alert feedback response was missing expected fields.")
    }

    suspend fun muteAlert(
        baseUrl: String,
        accessToken: String,
        alertId: String
    ): AlertLedgerItemView = withContext(Dispatchers.IO) {
        val json = requestJson(
            baseUrl,
            "POST",
            "/v1/user/alerts/${urlEncode(alertId)}/mute",
            accessToken = accessToken,
            body = JSONObject()
        )
        mapAlertLedgerItem(json.optJSONObject("data"))
            ?: throw ProductApiException(500, "Alert mute response was missing expected fields.")
    }

    suspend fun getWarRoom(
        baseUrl: String,
        accessToken: String,
        warRoomId: String
    ): WarRoomView = withContext(Dispatchers.IO) {
        val json = requestJson(
            baseUrl,
            "GET",
            "/v1/research/war-room/${urlEncode(warRoomId)}",
            accessToken = accessToken
        )
        WarRoomViewMapper.mapWarRoomView(json)
            ?: throw ProductApiException(500, "War Room response was missing expected fields.")
    }

    suspend fun searchTickers(baseUrl: String, accessToken: String, query: String): List<TickerSearchItem> =
        withContext(Dispatchers.IO) {
            val json = requestJson(
                baseUrl,
                "GET",
                "/tickers/search?q=${urlEncode(query)}",
                accessToken = accessToken
            )
            val data = json.optJSONArray("data") ?: JSONArray()
            (0 until data.length()).mapNotNull { index ->
                data.optJSONObject(index)?.let { row ->
                    TickerSearchItem(
                        symbol = row.optString("symbol"),
                        companyName = row.optString("company_name"),
                        exchange = row.optString("exchange")
                    )
                }
            }
        }

    suspend fun createDeepDiveJob(baseUrl: String, accessToken: String, ticker: String): JobStatus =
        withContext(Dispatchers.IO) {
            val body = JSONObject().put("ticker", ticker)
            parseJobStatus(requestJson(baseUrl, "POST", "/jobs", accessToken = accessToken, body = body))
        }

    suspend fun getJobStatus(baseUrl: String, accessToken: String, jobId: String): JobStatus =
        withContext(Dispatchers.IO) {
            parseJobStatus(requestJson(baseUrl, "GET", "/jobs/$jobId", accessToken = accessToken))
        }

    suspend fun getDeepDiveReport(baseUrl: String, accessToken: String, reportId: String): DeepDiveReportView =
        withContext(Dispatchers.IO) {
            val json = requestJson(baseUrl, "GET", "/reports/$reportId", accessToken = accessToken)
            ReportViewMapper.mapAnalysisReport(json)
        }

    suspend fun getReportNote(
        baseUrl: String,
        accessToken: String,
        reportId: String
    ): ReportNoteView? = withContext(Dispatchers.IO) {
        runCatching {
            val json = requestJson(baseUrl, "GET", "/v1/reports/$reportId/note", accessToken = accessToken)
            ReportViewMapper.mapReportNote(json)
        }.getOrElse { error ->
            if (error is ProductApiException && error.code == 404 && error.errorCode == "note_not_found") {
                null
            } else {
                throw error
            }
        }
    }

    suspend fun saveReportNote(
        baseUrl: String,
        accessToken: String,
        reportId: String,
        content: String
    ): ReportNoteView = withContext(Dispatchers.IO) {
        val body = JSONObject().put("content", content)
        val json = requestJson(
            baseUrl,
            "PUT",
            "/v1/reports/$reportId/note",
            accessToken = accessToken,
            body = body
        )
        ReportViewMapper.mapReportNote(json)
            ?: throw ProductApiException(500, "Note response was missing expected fields.")
    }

    suspend fun submitReportFeedback(
        baseUrl: String,
        accessToken: String,
        reportId: String,
        ticker: String?,
        code: String,
        sourceSurface: String,
        message: String? = null,
        severity: String = "normal"
    ): String = withContext(Dispatchers.IO) {
        val body = JSONObject()
            .put("report_id", reportId)
            .put("code", code)
            .put("source_surface", sourceSurface)
            .put("severity", severity)
        if (!ticker.isNullOrBlank()) {
            body.put("ticker", ticker.trim().uppercase())
        }
        if (!message.isNullOrBlank()) {
            body.put("message", message.trim())
        }

        val json = requestJson(
            baseUrl,
            "POST",
            "/v1/feedback/report",
            accessToken = accessToken,
            body = body
        )
        json.optJSONObject("data")?.optString("feedback_id").orEmpty()
    }

    suspend fun submitSubscriptionFeedback(
        baseUrl: String,
        accessToken: String,
        code: String,
        sourceSurface: String,
        message: String? = null,
        severity: String = "normal"
    ): String = withContext(Dispatchers.IO) {
        val body = JSONObject()
            .put("code", code)
            .put("source_surface", sourceSurface)
            .put("severity", severity)
        if (!message.isNullOrBlank()) {
            body.put("message", message.trim())
        }

        val json = requestJson(
            baseUrl,
            "POST",
            "/v1/feedback/subscription",
            accessToken = accessToken,
            body = body
        )
        json.optJSONObject("data")?.optString("feedback_id").orEmpty()
    }

    suspend fun getScenarioStressTemplates(
        baseUrl: String,
        accessToken: String
    ): List<ScenarioStressTemplateView> = withContext(Dispatchers.IO) {
        val json = requestJson(
            baseUrl,
            "GET",
            "/v1/scenarios/templates",
            accessToken = accessToken
        )
        val rows = json.optJSONArray("data") ?: JSONArray()
        (0 until rows.length()).mapNotNull { index ->
            mapScenarioStressTemplate(rows.optJSONObject(index))
        }
    }

    suspend fun runScenarioStress(
        baseUrl: String,
        accessToken: String,
        scenarioId: String,
        asOf: String? = null
    ): ScenarioStressRunView = withContext(Dispatchers.IO) {
        val body = JSONObject()
            .put("scenario_id", scenarioId)
        if (!asOf.isNullOrBlank()) {
            body.put("as_of", asOf.trim())
        }

        val json = requestJson(
            baseUrl,
            "POST",
            "/v1/scenarios/runs",
            accessToken = accessToken,
            body = body
        )
        mapScenarioStressRun(json)
            ?: throw ProductApiException(500, "Scenario stress run response was missing expected fields.")
    }

    suspend fun getScenarioStressRun(
        baseUrl: String,
        accessToken: String,
        scenarioRunId: String
    ): ScenarioStressRunView = withContext(Dispatchers.IO) {
        val json = requestJson(
            baseUrl,
            "GET",
            "/v1/scenarios/runs/${urlEncode(scenarioRunId)}",
            accessToken = accessToken
        )
        mapScenarioStressRun(json)
            ?: throw ProductApiException(500, "Scenario stress run detail response was missing expected fields.")
    }

    suspend fun runScenario(
        baseUrl: String,
        accessToken: String,
        reportId: String,
        overrides: ScenarioOverridesView
    ): ScenarioResultView = withContext(Dispatchers.IO) {
        val payload = JSONObject()
        val overrideJson = JSONObject()
        overrides.projectionYears?.let { overrideJson.put("projection_years", it) }
        overrides.terminalGrowthRate?.let { overrideJson.put("terminal_growth_rate", it) }
        overrides.wacc?.let { overrideJson.put("wacc", it) }
        payload.put("overrides", overrideJson)

        val json = requestJson(
            baseUrl,
            "POST",
            "/v1/reports/$reportId/scenario",
            accessToken = accessToken,
            body = payload
        )
        ReportViewMapper.mapScenarioResult(json)
            ?: throw ProductApiException(500, "Scenario response was missing expected fields.")
    }

    suspend fun getConvictionTimeline(
        baseUrl: String,
        accessToken: String,
        ticker: String? = null,
        limit: Int = 20
    ): List<ConvictionJournalEntryView> = withContext(Dispatchers.IO) {
        val path = buildString {
            append("/v1/conviction/timeline?limit=$limit")
            if (!ticker.isNullOrBlank()) {
                append("&ticker=${urlEncode(ticker)}")
            }
        }
        val json = requestJson(baseUrl, "GET", path, accessToken = accessToken)
        val rows = json.optJSONArray("data") ?: JSONArray()
        (0 until rows.length()).mapNotNull { index ->
            mapConvictionJournalEntry(rows.optJSONObject(index))
        }
    }

    suspend fun getConvictionInsights(
        baseUrl: String,
        accessToken: String,
        limit: Int = 5
    ): List<ConvictionInsightCardView> = withContext(Dispatchers.IO) {
        val json = requestJson(
            baseUrl,
            "GET",
            "/v1/conviction/insights?limit=$limit",
            accessToken = accessToken
        )
        val rows = json.optJSONArray("data") ?: JSONArray()
        (0 until rows.length()).mapNotNull { index ->
            mapConvictionInsightCard(rows.optJSONObject(index))
        }
    }

    suspend fun getOppositeCase(
        baseUrl: String,
        accessToken: String,
        reportId: String
    ): OppositeCaseReportView? = withContext(Dispatchers.IO) {
        runCatching {
            val json = requestJson(
                baseUrl,
                "GET",
                "/v1/reports/${urlEncode(reportId)}/opposite-case",
                accessToken = accessToken
            )
            mapOppositeCaseReport(json.optJSONObject("data"))
        }.getOrElse { error ->
            if (error is ProductApiException && error.code == 404 && error.errorCode == "opposite_case_not_found") {
                null
            } else {
                throw error
            }
        }
    }

    suspend fun createOppositeCase(
        baseUrl: String,
        accessToken: String,
        reportId: String
    ): OppositeCaseReportView = withContext(Dispatchers.IO) {
        val json = requestJson(
            baseUrl,
            "POST",
            "/v1/reports/${urlEncode(reportId)}/opposite-case",
            accessToken = accessToken,
            body = JSONObject()
        )
        mapOppositeCaseReport(json.optJSONObject("data"))
            ?: throw ProductApiException(500, "Opposite-case response was missing expected fields.")
    }

    suspend fun getLatestPulse(baseUrl: String, accessToken: String): PulseReportView =
        withContext(Dispatchers.IO) {
            parsePulseReport(requestJson(baseUrl, "GET", "/pulse/latest", accessToken = accessToken))
        }

    suspend fun getPulseByDate(baseUrl: String, accessToken: String, date: String): PulseReportView =
        withContext(Dispatchers.IO) {
            parsePulseReport(
                requestJson(
                    baseUrl,
                    "GET",
                    "/pulse/${date.trim()}",
                    accessToken = accessToken
                )
            )
        }

    suspend fun getLatestPulsePdf(baseUrl: String, accessToken: String): ByteArray =
        withContext(Dispatchers.IO) {
            requestBytes(baseUrl, "/pulse/latest/export/pdf", accessToken)
        }

    suspend fun getPulsePdfByDate(baseUrl: String, accessToken: String, date: String): ByteArray =
        withContext(Dispatchers.IO) {
            requestBytes(baseUrl, "/pulse/${urlEncode(date.trim())}/export/pdf", accessToken)
        }

    suspend fun getCurrentMacroStress(
        baseUrl: String,
        accessToken: String
    ): SentimentSnapshotView? = withContext(Dispatchers.IO) {
        runCatching {
            val json = requestCurrentMacroStress(baseUrl, accessToken)
            mapSentimentSnapshot(json.optJSONObject("data") ?: json)
        }.getOrElse { error ->
            if (
                error is ProductApiException &&
                error.code == 404 &&
                (error.errorCode == "macro_stress_not_found" || error.errorCode == "sentiment_not_found")
            ) {
                null
            } else {
                throw error
            }
        }
    }

    suspend fun getMacroStressHistory(
        baseUrl: String,
        accessToken: String,
        days: Int
    ): List<SentimentSnapshotView> = withContext(Dispatchers.IO) {
        runCatching {
            val json = requestMacroStressHistory(baseUrl, accessToken, days)
            val rows = json.optFirstArray("data", "history", "snapshots") ?: JSONArray()
            (0 until rows.length()).mapNotNull { index ->
                mapSentimentSnapshot(rows.optJSONObject(index))
            }
        }.getOrElse { error ->
            if (
                error is ProductApiException &&
                error.code == 404 &&
                (error.errorCode == "macro_stress_not_found" || error.errorCode == "sentiment_not_found")
            ) {
                emptyList()
            } else {
                throw error
            }
        }
    }

    suspend fun getCurrentSentiment(
        baseUrl: String,
        accessToken: String
    ): SentimentSnapshotView? = getCurrentMacroStress(baseUrl, accessToken)

    suspend fun getSentimentHistory(
        baseUrl: String,
        accessToken: String,
        days: Int
    ): List<SentimentSnapshotView> = getMacroStressHistory(baseUrl, accessToken, days)

    private fun shouldFallbackToLegacySentiment(error: ProductApiException): Boolean =
        error.code == 404 && error.errorCode !in setOf("macro_stress_not_found", "sentiment_not_found")

    private fun requestCurrentMacroStress(baseUrl: String, accessToken: String): JSONObject =
        try {
            requestJson(
                baseUrl,
                "GET",
                "/v1/macro-stress/current",
                accessToken = accessToken
            )
        } catch (error: ProductApiException) {
            if (shouldFallbackToLegacySentiment(error)) {
                requestJson(
                    baseUrl,
                    "GET",
                    "/v1/sentiment/current",
                    accessToken = accessToken
                )
            } else {
                throw error
            }
        }

    private fun requestMacroStressHistory(baseUrl: String, accessToken: String, days: Int): JSONObject =
        try {
            requestJson(
                baseUrl,
                "GET",
                "/v1/macro-stress/history?days=$days",
                accessToken = accessToken
            )
        } catch (error: ProductApiException) {
            if (shouldFallbackToLegacySentiment(error)) {
                requestJson(
                    baseUrl,
                    "GET",
                    "/v1/sentiment/history?days=$days",
                    accessToken = accessToken
                )
            } else {
                throw error
            }
        }

    suspend fun getMonitorSnapshots(
        baseUrl: String,
        accessToken: String
    ): List<ThesisMonitorSnapshotView> = withContext(Dispatchers.IO) {
        val json = requestJson(
            baseUrl,
            "GET",
            "/v1/user/monitor-snapshots",
            accessToken = accessToken
        )
        val rows = json.optJSONArray("data") ?: JSONArray()
        (0 until rows.length()).mapNotNull { index ->
            val row = rows.optJSONObject(index) ?: return@mapNotNull null
            val ticker = row.optString("ticker").trim().uppercase()
            if (ticker.isBlank()) {
                return@mapNotNull null
            }
            val state = row.optString("state").trim()
            if (state.isBlank()) {
                return@mapNotNull null
            }
            ThesisMonitorSnapshotView(
                ticker = ticker,
                state = state,
                reason = row.optString("reason").ifBlank { "No explanation available yet." },
                score = row.optNullableDouble("score") ?: 0.0,
                reportId = row.optNullableString("report_id"),
                reportGeneratedAt = row.optNullableString("report_generated_at"),
                reportSchemaVersion = row.optNullableString("report_schema_version"),
                lastDeepDiveAt = row.optNullableString("last_deep_dive_at"),
                materialEventsCount = row.optNullableInt("material_events_count") ?: 0,
                unreviewedEventsCount = row.optNullableInt("unreviewed_events_count") ?: 0,
                freshnessState = row.optString("freshness_state").ifBlank { "stale" },
                freshnessScore = row.optNullableDouble("freshness_score") ?: 0.0,
                killSwitchTriggeredAt = row.optNullableString("kill_switch_triggered_at"),
                freshnessReason = row.optNullableString("freshness_reason"),
                updatedAt = row.optString("updated_at").ifBlank { "" }
            )
        }
    }

    suspend fun listReports(baseUrl: String, accessToken: String): List<ReportHistoryItem> =
        withContext(Dispatchers.IO) {
            val rows = requestJsonArray(baseUrl, "GET", "/reports", accessToken = accessToken)
            (0 until rows.length()).mapNotNull { index ->
                rows.optJSONObject(index)?.let { row ->
                    ReportHistoryItem(
                        reportId = row.optString("report_id"),
                        jobId = row.optString("job_id"),
                        type = row.optString("type"),
                        ticker = row.optNullableString("ticker"),
                        createdAt = row.optString("created_at")
                    )
                }
            }
        }

    suspend fun getWatchlist(baseUrl: String, accessToken: String): List<String> =
        withContext(Dispatchers.IO) {
            val json = requestJson(baseUrl, "GET", "/watchlist", accessToken = accessToken)
            val data = json.optJSONArray("data") ?: JSONArray()
            (0 until data.length()).mapNotNull { index -> data.optString(index) }
        }

    suspend fun addWatchlistTicker(baseUrl: String, accessToken: String, ticker: String): List<String> =
        withContext(Dispatchers.IO) {
            val body = JSONObject().put("ticker", ticker)
            val json = requestJson(baseUrl, "POST", "/watchlist", accessToken = accessToken, body = body)
            val data = json.optJSONArray("data") ?: JSONArray()
            (0 until data.length()).mapNotNull { index -> data.optString(index) }
        }

    suspend fun removeWatchlistTicker(baseUrl: String, accessToken: String, ticker: String): List<String> =
        withContext(Dispatchers.IO) {
            val json = requestJson(
                baseUrl,
                "DELETE",
                "/watchlist/${ticker.uppercase()}",
                accessToken = accessToken
            )
            val data = json.optJSONArray("data") ?: JSONArray()
            (0 until data.length()).mapNotNull { index -> data.optString(index) }
        }

    suspend fun importHoldingsCsv(baseUrl: String, accessToken: String, csv: String): HoldingsImportResultView =
        withContext(Dispatchers.IO) {
            val body = JSONObject().put("csv", csv)
            val json = requestJson(baseUrl, "POST", "/v1/user/holdings/import", accessToken = accessToken, body = body)
            val data = json.optJSONObject("data") ?: JSONObject()
            fun strings(key: String): List<String> {
                val array = data.optJSONArray(key) ?: JSONArray()
                return (0 until array.length()).mapNotNull { index -> array.optString(index) }
            }
            val errors = data.optJSONArray("errors") ?: JSONArray()
            HoldingsImportResultView(
                rows = data.optInt("rows"),
                imported = strings("imported"),
                newlyFollowed = strings("newly_followed"),
                errors = (0 until errors.length()).mapNotNull { index ->
                    val row = errors.optJSONObject(index) ?: return@mapNotNull null
                    HoldingsImportRowErrorView(
                        line = row.optInt("line"),
                        ticker = row.optNullableString("ticker"),
                        message = row.optString("error_message")
                    )
                },
                watchlist = strings("watchlist")
            )
        }

    suspend fun getUserProfile(baseUrl: String, accessToken: String): UserProfileView =
        withContext(Dispatchers.IO) {
            val json = requestJson(baseUrl, "GET", "/v1/user/profile", accessToken = accessToken)
            val data = json.optJSONObject("data") ?: JSONObject()
            parseUserProfile(data)
        }

    suspend fun syncUserTier(
        baseUrl: String,
        accessToken: String,
        revenuecatAppUserId: String?
    ): UserProfileView = withContext(Dispatchers.IO) {
        val body = JSONObject()
        if (!revenuecatAppUserId.isNullOrBlank()) {
            body.put("revenuecat_app_user_id", revenuecatAppUserId.trim())
        }
        val json = requestJson(
            baseUrl,
            "POST",
            "/v1/user/sync-tier",
            accessToken = accessToken,
            body = body
        )
        val data = json.optJSONObject("data") ?: JSONObject()
        parseUserProfile(data)
    }

    private fun parsePulseReport(json: JSONObject): PulseReportView {
        val sectionsObj = json.optJSONObject("sections") ?: JSONObject()
        val preferredOrder = listOf(
            "macro_stress",
            "macro_stress_context",
            "official_macro_pressure",
            "market_moves",
            "macro_releases",
            "rates_fx_commodities",
            "news_summary",
            "uncertainty_flags",
            "watchlist_overlay"
        )
        val discoveredKeys = mutableListOf<String>()
        val keys = sectionsObj.keys()
        while (keys.hasNext()) {
            val key = keys.next().trim()
            if (key.isNotBlank()) {
                discoveredKeys += key
            }
        }
        val orderedKeys = (preferredOrder + discoveredKeys).distinct()
        val sections = orderedKeys.mapNotNull { key ->
            sectionsObj.optJSONObject(key)?.let { row ->
                SectionView(
                    sectionId = row.optNullableString("section_id") ?: key,
                    title = row.optString("title", key),
                    body = row.optString("body", ""),
                    status = row.optNullableString("status"),
                    evidence = parseEvidence(row.optJSONArray("evidence"))
                )
            }
        }
        return PulseReportView(
            reportId = json.optString("report_id"),
            generatedAt = json.optString("generated_at"),
            cycleEnd = json.optNullableString("cycle_end"),
            sections = sections
        )
    }

    private fun mapAlertLedgerItem(row: JSONObject?): AlertLedgerItemView? {
        if (row == null) {
            return null
        }
        val id = row.optString("id").trim()
        val notificationType = row.optString("notification_type").trim()
        if (id.isBlank() || notificationType.isBlank()) {
            return null
        }
        val context = row.optJSONObject("context")
        val relatedTickers = context?.optJSONArray("related_tickers")
        return AlertLedgerItemView(
            id = id,
            notificationType = notificationType,
            category = row.optString("category").ifBlank { "system" },
            route = row.optString("route").ifBlank { "inbox" },
            title = row.optString("title").ifBlank { notificationType },
            body = row.optString("body").ifBlank { "" },
            detailBody = row.optNullableString("detail_body"),
            detailLocked = row.optBoolean("detail_locked", false),
            reasonCode = row.optString("reason_code").ifBlank { "unknown" },
            reasonText = row.optString("reason_text").ifBlank { "" },
            deliveryState = row.optString("delivery_state").ifBlank { "sent" },
            feedbackState = row.optNullableString("feedback_state"),
            mutedAt = row.optNullableString("muted_at"),
            ticker = context?.optNullableString("ticker"),
            reportId = context?.optNullableString("report_id"),
            pulseDate = context?.optNullableString("pulse_date"),
            digestDate = context?.optNullableString("digest_date"),
            briefingContext = parseBriefingContext(notificationType, context),
            relatedTickers = if (relatedTickers == null) {
                emptyList()
            } else {
                (0 until relatedTickers.length()).mapNotNull { index ->
                    relatedTickers.optString(index)?.takeIf { it.isNotBlank() }
                }
            },
            createdAt = row.optString("created_at").ifBlank { "" },
            updatedAt = row.optString("updated_at").ifBlank { "" },
            warRoomId = context?.optNullableString("war_room_id"),
            eventDate = context?.optNullableString("event_date")
        )
    }

    private fun mapConvictionJournalEntry(row: JSONObject?): ConvictionJournalEntryView? {
        if (row == null) {
            return null
        }
        val id = row.optString("journal_entry_id").trim()
        val ticker = row.optString("ticker").trim().uppercase()
        val eventType = row.optString("event_type").trim()
        if (id.isBlank() || ticker.isBlank() || eventType.isBlank()) {
            return null
        }

        return ConvictionJournalEntryView(
            journalEntryId = id,
            ticker = ticker,
            eventType = eventType,
            sourceType = row.optString("source_type").ifBlank { "report" },
            sourceId = row.optString("source_id").ifBlank { id },
            eventAt = row.optString("event_at").ifBlank { row.optString("created_at") },
            title = row.optString("title").ifBlank { eventType },
            summary = row.optString("summary").ifBlank { "" },
            thesisSnapshot = mapConvictionThesisSnapshot(row.optJSONObject("thesis_snapshot")),
            evidenceRefs = mapConvictionEvidenceRefs(row.optJSONArray("evidence_refs")),
            reportId = row.optNullableString("report_id"),
            alertLedgerId = row.optNullableString("alert_ledger_id"),
            warRoomId = row.optNullableString("war_room_id"),
            oppositeCaseId = row.optNullableString("opposite_case_id")
        )
    }

    private fun mapConvictionThesisSnapshot(row: JSONObject?): ConvictionThesisSnapshotView? {
        if (row == null) {
            return null
        }
        return ConvictionThesisSnapshotView(
            ticker = row.optNullableString("ticker"),
            reportId = row.optNullableString("report_id"),
            reportGeneratedAt = row.optNullableString("report_generated_at"),
            signalValue = row.optNullableString("signal_value"),
            confidenceLabel = row.optNullableString("confidence_label"),
            confidenceScore = row.optNullableDouble("confidence_score"),
            thesisSummary = row.optNullableString("thesis_summary"),
            monitorState = row.optNullableString("monitor_state"),
            freshnessState = row.optNullableString("freshness_state")
        )
    }

    private fun mapConvictionInsightCard(row: JSONObject?): ConvictionInsightCardView? {
        if (row == null) {
            return null
        }
        val id = row.optString("insight_id").trim()
        if (id.isBlank()) {
            return null
        }
        val findings = row.optJSONArray("findings") ?: JSONArray()
        return ConvictionInsightCardView(
            insightId = id,
            periodStart = row.optString("period_start").ifBlank { "" },
            periodEnd = row.optString("period_end").ifBlank { "" },
            insightType = row.optString("insight_type").ifBlank { "monthly_coherence" },
            status = row.optString("status").ifBlank { "generated" },
            title = row.optString("title").ifBlank { "Conviction review" },
            summary = row.optString("summary").ifBlank { "" },
            findings = (0 until findings.length()).mapNotNull { index ->
                mapConvictionInsightFinding(findings.optJSONObject(index))
            },
            generatedAt = row.optString("generated_at").ifBlank { row.optString("created_at") }
        )
    }

    private fun mapConvictionInsightFinding(row: JSONObject?): ConvictionInsightFindingView? {
        if (row == null) {
            return null
        }
        val type = row.optString("finding_type").trim()
        if (type.isBlank()) {
            return null
        }
        return ConvictionInsightFindingView(
            findingType = type,
            title = row.optString("title").ifBlank { type },
            summary = row.optString("summary").ifBlank { "" },
            tickers = parseStringList(row.optJSONArray("tickers")),
            confidence = row.optNullableDouble("confidence") ?: 0.0,
            evidenceRefs = mapConvictionEvidenceRefs(row.optJSONArray("evidence_refs"))
        )
    }

    private fun mapOppositeCaseReport(row: JSONObject?): OppositeCaseReportView? {
        if (row == null) {
            return null
        }
        val id = row.optString("opposite_case_id").trim()
        val ticker = row.optString("ticker").trim().uppercase()
        if (id.isBlank() || ticker.isBlank()) {
            return null
        }
        val points = row.optJSONArray("key_points") ?: JSONArray()
        return OppositeCaseReportView(
            oppositeCaseId = id,
            sourceReportId = row.optString("source_report_id").ifBlank { "" },
            ticker = ticker,
            thesisSummary = row.optString("thesis_summary").ifBlank { "" },
            oppositeCaseSummary = row.optString("opposite_case_summary").ifBlank { "" },
            keyPoints = (0 until points.length()).mapNotNull { index ->
                mapOppositeCasePoint(points.optJSONObject(index))
            },
            sharedEvidenceRefs = mapConvictionEvidenceRefs(row.optJSONArray("shared_evidence_refs")),
            decisiveFactors = parseStringList(row.optJSONArray("decisive_factors")),
            generatedAt = row.optString("generated_at").ifBlank { row.optString("created_at") }
        )
    }

    private fun mapOppositeCasePoint(row: JSONObject?): OppositeCasePointView? {
        if (row == null) {
            return null
        }
        val title = row.optString("title").trim()
        if (title.isBlank()) {
            return null
        }
        return OppositeCasePointView(
            title = title,
            summary = row.optString("summary").ifBlank { "" },
            evidenceRefs = mapConvictionEvidenceRefs(row.optJSONArray("evidence_refs"))
        )
    }

    private fun mapScenarioStressTemplate(row: JSONObject?): ScenarioStressTemplateView? {
        if (row == null) {
            return null
        }
        val scenarioId = row.optString("scenario_id").trim()
        val title = row.optString("title").trim()
        if (scenarioId.isBlank() || title.isBlank()) {
            return null
        }

        return ScenarioStressTemplateView(
            scenarioId = scenarioId,
            title = title,
            summary = row.optString("summary").ifBlank { "No summary provided." },
            hypothesis = row.optString("hypothesis").ifBlank { "No hypothesis provided." },
            active = row.optBoolean("active", true),
            createdAt = row.optString("created_at").ifBlank { "" },
            updatedAt = row.optString("updated_at").ifBlank { "" }
        )
    }

    private fun mapScenarioStressRun(payload: JSONObject): ScenarioStressRunView? {
        val data = payload.optJSONObject("data") ?: payload
        val run = mapScenarioStressRunHeader(data.optJSONObject("run")) ?: return null
        val impacts = data.optJSONArray("impacts") ?: JSONArray()
        val suggestions = data.optJSONArray("rule_suggestions") ?: JSONArray()

        return ScenarioStressRunView(
            run = run,
            impacts = (0 until impacts.length()).mapNotNull { index ->
                mapScenarioStressImpact(impacts.optJSONObject(index))
            },
            ruleSuggestions = (0 until suggestions.length()).mapNotNull { index ->
                mapScenarioStressRuleSuggestion(suggestions.optJSONObject(index))
            }
        )
    }

    private fun mapScenarioStressRunHeader(row: JSONObject?): ScenarioStressRunHeaderView? {
        if (row == null) {
            return null
        }
        val runId = row.optString("scenario_run_id").trim()
        val scenarioId = row.optString("scenario_id").trim()
        val route = mapScenarioStressRoute(row.optJSONObject("route"))
        if (runId.isBlank() || scenarioId.isBlank() || route == null) {
            return null
        }

        return ScenarioStressRunHeaderView(
            scenarioRunId = runId,
            scenarioId = scenarioId,
            userId = row.optString("user_id").ifBlank { "" },
            status = row.optString("status").ifBlank { "completed" },
            runMode = row.optString("run_mode").ifBlank { "manual" },
            asOf = row.optString("as_of").ifBlank { "" },
            totalNames = row.optInt("total_names", 0),
            impactedNames = row.optInt("impacted_names", 0),
            criticalNames = row.optInt("critical_names", 0),
            summary = row.optString("summary").ifBlank { "No summary available." },
            route = route,
            createdAt = row.optString("created_at").ifBlank { "" },
            completedAt = row.optString("completed_at").ifBlank { "" }
        )
    }

    private fun mapScenarioStressImpact(row: JSONObject?): ScenarioStressImpactView? {
        if (row == null) {
            return null
        }
        val impactId = row.optString("scenario_impact_id").trim()
        val runId = row.optString("scenario_run_id").trim()
        val ticker = row.optString("ticker").trim().uppercase()
        val route = mapScenarioStressRoute(row.optJSONObject("route"))
        if (impactId.isBlank() || runId.isBlank() || ticker.isBlank() || route == null) {
            return null
        }

        return ScenarioStressImpactView(
            scenarioImpactId = impactId,
            scenarioRunId = runId,
            userId = row.optString("user_id").ifBlank { "" },
            ticker = ticker,
            impactLevel = row.optString("impact_level").ifBlank { "none" },
            thesisBreakLikelihood = row.optString("thesis_break_likelihood").ifBlank { "low" },
            stressScore = row.optNullableDouble("stress_score") ?: 0.0,
            rationale = row.optString("rationale").ifBlank { "No rationale provided." },
            evidenceRefs = parseStringList(row.optJSONArray("evidence_refs")),
            route = route,
            createdAt = row.optString("created_at").ifBlank { "" }
        )
    }

    private fun mapScenarioStressRuleSuggestion(row: JSONObject?): ScenarioStressRuleSuggestionView? {
        if (row == null) {
            return null
        }
        val suggestionId = row.optString("scenario_rule_suggestion_id").trim()
        val runId = row.optString("scenario_run_id").trim()
        val ticker = row.optString("ticker").trim().uppercase()
        val signalType = row.optString("signal_type").trim()
        val direction = row.optString("direction").trim()
        val route = mapScenarioStressRoute(row.optJSONObject("route"))
        if (
            suggestionId.isBlank() ||
            runId.isBlank() ||
            ticker.isBlank() ||
            signalType.isBlank() ||
            direction.isBlank() ||
            route == null
        ) {
            return null
        }

        return ScenarioStressRuleSuggestionView(
            scenarioRuleSuggestionId = suggestionId,
            scenarioRunId = runId,
            userId = row.optString("user_id").ifBlank { "" },
            ticker = ticker,
            signalType = signalType,
            direction = direction,
            conditionText = row.optString("condition_text").ifBlank { "No condition text provided." },
            rationale = row.optString("rationale").ifBlank { "No rationale provided." },
            confidence = row.optNullableDouble("confidence") ?: 0.0,
            route = route,
            createdAt = row.optString("created_at").ifBlank { "" }
        )
    }

    private fun mapScenarioStressRoute(row: JSONObject?): ScenarioStressRouteView? {
        if (row == null) {
            return null
        }
        val openTab = row.optString("open_tab").trim().lowercase()
        val scenarioId = row.optString("scenario_id").trim()
        val scenarioRunId = row.optString("scenario_run_id").trim()
        if (openTab.isBlank() || scenarioId.isBlank() || scenarioRunId.isBlank()) {
            return null
        }
        return ScenarioStressRouteView(
            openTab = openTab,
            scenarioId = scenarioId,
            scenarioRunId = scenarioRunId,
            ticker = row.optNullableString("ticker"),
            ruleId = row.optNullableString("rule_id")
        )
    }

    private fun mapConvictionEvidenceRefs(rows: JSONArray?): List<ConvictionEvidenceRefView> {
        if (rows == null) {
            return emptyList()
        }

        return (0 until rows.length()).mapNotNull { index ->
            rows.optJSONObject(index)?.let { row ->
                val kind = row.optString("kind").trim()
                val refId = row.optString("ref_id").trim()
                if (kind.isBlank() || refId.isBlank()) {
                    return@let null
                }
                ConvictionEvidenceRefView(
                    kind = kind,
                    refId = refId,
                    label = row.optNullableString("label"),
                    ticker = row.optNullableString("ticker"),
                    capturedAt = row.optNullableString("captured_at")
                )
            }
        }
    }

    private fun parseBriefingContext(
        notificationType: String,
        context: JSONObject?
    ): BriefingContextView? {
        if (context == null) {
            return null
        }

        val mode = context.optFirstString("mode", "briefing_mode", "exception_mode")
        val count = context.optNullableInt("count")
            ?: context.optNullableInt("exception_count")
            ?: context.optNullableInt("exceptions_count")
        val watchlistCount = context.optNullableInt("watchlist_count")
        val leadRoute = context.optFirstString("lead_route", "downstream_route", "route")
        val leadTicker = context.optFirstString("lead_ticker", "ticker")
        val leadReportId = context.optFirstString("lead_report_id", "report_id")
        val leadPulseDate = context.optFirstString("lead_pulse_date", "pulse_date")
        val leadDigestDate = context.optFirstString("lead_digest_date", "digest_date")
        val relatedTickers = parseStringList(context.optJSONArray("related_tickers"))

        val hasBriefingShape =
            mode != null ||
                count != null ||
                watchlistCount != null ||
                leadRoute != null ||
                leadTicker != null ||
                leadReportId != null ||
                leadPulseDate != null ||
                leadDigestDate != null ||
                relatedTickers.isNotEmpty()

        if (notificationType != "morning_exception_briefing" && !hasBriefingShape) {
            return null
        }

        return BriefingContextView(
            mode = mode,
            count = count,
            watchlistCount = watchlistCount,
            leadRoute = leadRoute,
            leadTicker = leadTicker,
            leadReportId = leadReportId,
            leadPulseDate = leadPulseDate,
            leadDigestDate = leadDigestDate,
            relatedTickers = relatedTickers
        )
    }

    private fun parseTokens(json: JSONObject): AuthTokens =
        AuthTokens(
            accessToken = json.optString("access_token"),
            refreshToken = json.optString("refresh_token"),
            accessTokenExpiresAt = json.optString("access_token_expires_at"),
            refreshTokenExpiresAt = json.optString("refresh_token_expires_at")
        )

    private fun parseSection(row: JSONObject): SectionView =
        SectionView(
            title = row.optString("title", "Untitled"),
            body = row.optString("body", ""),
            status = row.optNullableString("status"),
            evidence = parseEvidence(row.optJSONArray("evidence"))
        )

    private fun parseEvidence(rows: JSONArray?): List<EvidenceView> {
        if (rows == null) {
            return emptyList()
        }

        return (0 until rows.length()).mapNotNull { index ->
            rows.optJSONObject(index)?.let { row ->
                EvidenceView(
                    sourceName = row.optString("source_name", "Unknown source"),
                    excerpt = row.optString("excerpt", ""),
                    url = row.optNullableString("url")
                )
            }
        }
    }

    private fun parseStringList(rows: JSONArray?): List<String> {
        if (rows == null) {
            return emptyList()
        }

        return (0 until rows.length()).mapNotNull { index ->
            rows.optString(index).takeIf { it.isNotBlank() }
        }
    }

    private fun parseJobStatus(json: JSONObject): JobStatus =
        JobStatus(
            jobId = json.optString("job_id"),
            status = json.optString("status"),
            ticker = json.optNullableString("ticker"),
            reportId = json.optNullableString("report_id"),
            errorMessage = json.optNullableString("error_message")
        )

    private fun parseUserProfile(data: JSONObject): UserProfileView =
        UserProfileView(
            userId = data.optString("user_id"),
            email = data.optString("email"),
            tier = data.optString("tier", "FREE"),
            billingPeriodEnd = data.optNullableString("billing_period_end"),
            watchlistLimit = data.optInt("watchlist_limit", 3),
            dailyDeepDiveLimit = data.optInt("daily_deep_dive_limit", 1),
            deepDivesRemainingToday = data.optInt("deep_dives_remaining_today", 0)
        )

    private fun parseNotificationPreferences(json: JSONObject): List<NotificationPreferenceView> {
        val data = when {
            json.has("data") && json.opt("data") is JSONObject -> json.optJSONObject("data")
            else -> json
        } ?: JSONObject()

        val rows = when {
            data.has("preferences") && data.opt("preferences") is JSONArray ->
                data.optJSONArray("preferences") ?: JSONArray()
            data.has("data") && data.opt("data") is JSONArray ->
                data.optJSONArray("data") ?: JSONArray()
            json.opt("data") is JSONArray ->
                json.optJSONArray("data") ?: JSONArray()
            else -> JSONArray()
        }

        if (rows.length() > 0) {
            return (0 until rows.length()).mapNotNull { index ->
                rows.optJSONObject(index)?.let { row ->
                    val type = row.optString("type")
                        .ifBlank { row.optString("notification_type") }
                        .trim()
                    if (type.isBlank()) {
                        return@let null
                    }
                    NotificationPreferenceView(
                        type = type,
                        enabled = row.optBoolean("enabled", true),
                        quietUntil = row.optString("quiet_until").ifBlank { null }
                    )
                }
            }
        }

        val type = data.optString("type").ifBlank { data.optString("notification_type") }.trim()
        return if (type.isBlank()) {
            emptyList()
        } else {
            listOf(
                NotificationPreferenceView(
                    type = type,
                    enabled = data.optBoolean("enabled", true),
                    quietUntil = data.optString("quiet_until").ifBlank { null }
                )
            )
        }
    }

    private fun mapSentimentSnapshot(row: JSONObject?): SentimentSnapshotView? {
        if (row == null) {
            return null
        }

        val id = row.optFirstString("id", "snapshot_id", "macro_stress_id", "sentiment_id") ?: return null
        val marketDate = row.optFirstString("market_date", "as_of", "as_of_date", "date") ?: return null
        val score = row.optFirstNullableDouble(
            "score",
            "macro_stress_score",
            "stress_score",
            "pressure_score",
            "index_value",
            "value"
        ) ?: return null
        val label = row.optFirstString(
            "label",
            "stress_label",
            "pressure_label",
            "regime_label",
            "sentiment_label"
        ) ?: deriveMacroStressLabel(score)
        val calculatedAt = row.optFirstString(
            "calculated_at",
            "generated_at",
            "updated_at",
            "captured_at",
            "evaluated_at"
        ) ?: marketDate

        val subScoresJson = row.optFirstArray("sub_scores", "components", "factors", "series") ?: JSONArray()
        val subScores = (0 until subScoresJson.length()).mapNotNull { index ->
            mapSentimentSubScore(subScoresJson.optJSONObject(index))
        }
        val missingInputsJson = row.optFirstArray(
            "missing_inputs",
            "missing_series",
            "omitted_series",
            "degraded_inputs"
        ) ?: JSONArray()
        val missingInputs = (0 until missingInputsJson.length()).mapNotNull { index ->
            missingInputsJson.optString(index).takeIf { it.isNotBlank() }
        }

        return SentimentSnapshotView(
            id = id,
            marketDate = marketDate,
            score = score,
            label = label,
            subScores = subScores,
            missingInputs = missingInputs,
            calculatedAt = calculatedAt
        )
    }

    private fun mapSentimentSubScore(row: JSONObject?): SentimentSubScoreView? {
        if (row == null) {
            return null
        }

        val inputName = row.optFirstString("input_name", "name", "series_id", "factor", "metric")
            ?: return null
        val provider = row.optFirstString("provider", "source", "feed", "dataset")
            ?: "official_macro"
        val available = if (row.has("available") && !row.isNull("available")) {
            row.optBoolean("available", false)
        } else {
            true
        }
        val weight = row.optFirstNullableDouble("weight", "contribution_weight", "importance") ?: 0.0

        return SentimentSubScoreView(
            inputName = inputName,
            provider = provider,
            available = available,
            weight = weight,
            normalizedScore = row.optFirstNullableDouble("normalized_score", "score", "value", "pressure_score"),
            rawValue = row.optFirstNullableDouble("raw_value", "raw", "latest_value"),
            retrievedAt = row.optFirstString("retrieved_at", "as_of", "updated_at"),
            notes = row.optFirstString("notes", "status", "reason")
        )
    }

    private fun deriveMacroStressLabel(score: Double): String = when {
        score >= 70.0 -> "high_stress"
        score <= 35.0 -> "low_stress"
        else -> "balanced"
    }

    @Throws(IOException::class, ProductApiException::class)
    private fun requestJson(
        baseUrl: String,
        method: String,
        path: String,
        accessToken: String? = null,
        body: JSONObject? = null
    ): JSONObject {
        val normalizedBase = baseUrl.trim().trimEnd('/')
        val url = "$normalizedBase$path"

        val builder = Request.Builder()
            .url(url)

        if (!accessToken.isNullOrBlank()) {
            builder.addHeader("Authorization", "Bearer $accessToken")
        }

        val request = when (method) {
            "GET" -> builder.get().build()
            "DELETE" -> {
                if (body != null) {
                    builder.delete(body.toString().toRequestBody(jsonMediaType)).build()
                } else {
                    builder.delete().build()
                }
            }
            else -> {
                val requestBody = (body ?: JSONObject())
                    .toString()
                    .toRequestBody(jsonMediaType)
                builder.method(method, requestBody).build()
            }
        }

        client.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            val payload = if (raw.isBlank()) JSONObject() else JSONObject(raw)
            if (!response.isSuccessful) {
                val message = payload.optString("error_message")
                    .ifBlank { payload.optString("error").ifBlank { "Request failed." } }
                val errorCode = payload.optNullableString("error")
                val feature = payload.optNullableString("feature")
                throw ProductApiException(response.code, message, errorCode, feature)
            }
            return payload
        }
    }

    @Throws(IOException::class, ProductApiException::class)
    private fun requestJsonArray(
        baseUrl: String,
        method: String,
        path: String,
        accessToken: String? = null
    ): JSONArray {
        val normalizedBase = baseUrl.trim().trimEnd('/')
        val url = "$normalizedBase$path"

        val builder = Request.Builder().url(url)
        if (!accessToken.isNullOrBlank()) {
            builder.addHeader("Authorization", "Bearer $accessToken")
        }

        val request = when (method) {
            "GET" -> builder.get().build()
            "DELETE" -> builder.delete().build()
            else -> throw IllegalArgumentException("requestJsonArray only supports GET/DELETE.")
        }

        client.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                val message = if (raw.isBlank()) {
                    "Request failed."
                } else {
                    val payload = JSONObject(raw)
                    payload.optString("error_message")
                        .ifBlank { payload.optString("error").ifBlank { "Request failed." } }
                }
                throw ProductApiException(response.code, message)
            }
            return if (raw.isBlank()) JSONArray() else JSONArray(raw)
        }
    }

    @Throws(IOException::class, ProductApiException::class)
    private fun requestBytes(baseUrl: String, path: String, accessToken: String? = null): ByteArray {
        val normalizedBase = baseUrl.trim().trimEnd('/')
        val url = "$normalizedBase$path"

        val builder = Request.Builder().url(url)
        if (!accessToken.isNullOrBlank()) {
            builder.addHeader("Authorization", "Bearer $accessToken")
        }

        client.newCall(builder.get().build()).execute().use { response ->
            val bytes = response.body?.bytes() ?: ByteArray(0)
            if (!response.isSuccessful) {
                val raw = bytes.toString(Charsets.UTF_8)
                val message = if (raw.isBlank()) {
                    "Request failed."
                } else {
                    runCatching {
                        val payload = JSONObject(raw)
                        payload.optString("error_message")
                            .ifBlank { payload.optString("error").ifBlank { "Request failed." } }
                    }.getOrDefault("Request failed.")
                }
                throw ProductApiException(response.code, message)
            }
            return bytes
        }
    }

    private fun urlEncode(input: String): String = java.net.URLEncoder.encode(input.trim(), "UTF-8")

    private fun JSONObject.optNullableString(key: String): String? {
        val value = optString(key, "")
        return if (value.isBlank()) null else value
    }

    private fun JSONObject.optNullableDouble(key: String): Double? {
        if (!has(key) || isNull(key)) {
            return null
        }
        val value = optDouble(key, Double.NaN)
        return if (value.isNaN()) null else value
    }

    private fun JSONObject.optNullableInt(key: String): Int? {
        if (!has(key) || isNull(key)) {
            return null
        }
        val value = optInt(key, Int.MIN_VALUE)
        return if (value == Int.MIN_VALUE) null else value
    }

    private fun JSONObject.optFirstNullableDouble(vararg keys: String): Double? {
        keys.forEach { key ->
            val value = optNullableDouble(key)
            if (value != null) {
                return value
            }
        }
        return null
    }

    private fun JSONObject.optFirstArray(vararg keys: String): JSONArray? {
        keys.forEach { key ->
            val value = opt(key)
            if (value is JSONArray) {
                return value
            }
        }
        return null
    }

    private fun JSONObject.optFirstString(vararg keys: String): String? {
        keys.forEach { key ->
            val value = optString(key).trim()
            if (value.isNotBlank()) {
                return value
            }
        }
        return null
    }
}

class ProductApiException(
    val code: Int,
    override val message: String,
    val errorCode: String? = null,
    val feature: String? = null
) : RuntimeException(message)
