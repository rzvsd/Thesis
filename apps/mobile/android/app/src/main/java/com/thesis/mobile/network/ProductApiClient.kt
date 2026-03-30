package com.thesis.mobile.network

import com.thesis.mobile.model.AuthTokens
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.EvidenceView
import com.thesis.mobile.model.JobStatus
import com.thesis.mobile.model.NotificationPreferenceView
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.RegisterResult
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.model.SectionView
import com.thesis.mobile.model.TickerSearchItem
import com.thesis.mobile.model.UserProfileView
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

    suspend fun updateDeviceToken(baseUrl: String, accessToken: String, deviceToken: String?) =
        withContext(Dispatchers.IO) {
            val body = JSONObject().put("device_token", deviceToken)
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
            val sectionsJson = json.optJSONArray("sections") ?: JSONArray()
            val sections = (0 until sectionsJson.length()).mapNotNull { index ->
                sectionsJson.optJSONObject(index)?.let(::parseSection)
            }
            DeepDiveReportView(
                reportId = json.optString("report_id"),
                ticker = json.optNullableString("ticker"),
                signalValue = json.optJSONObject("signal")?.optNullableString("value"),
                confidenceLabel = json.optJSONObject("confidence")?.optNullableString("label"),
                confidenceScore = json.optJSONObject("confidence")?.optDouble("score"),
                sections = sections
            )
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
            "market_moves",
            "macro_releases",
            "rates_fx_commodities",
            "news_summary",
            "uncertainty_flags",
            "watchlist_overlay"
        )
        val sections = preferredOrder.mapNotNull { key ->
            sectionsObj.optJSONObject(key)?.let { row ->
                SectionView(
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
            sections = sections
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
            watchlistLimit = data.optInt("watchlist_limit", 5),
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
                        enabled = row.optBoolean("enabled", true)
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
                    enabled = data.optBoolean("enabled", true)
                )
            )
        }
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

    private fun urlEncode(input: String): String = java.net.URLEncoder.encode(input.trim(), "UTF-8")

    private fun JSONObject.optNullableString(key: String): String? {
        val value = optString(key, "")
        return if (value.isBlank()) null else value
    }
}

class ProductApiException(
    val code: Int,
    override val message: String,
    val errorCode: String? = null,
    val feature: String? = null
) : RuntimeException(message)
