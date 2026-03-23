package com.thesis.mobile.observability

import com.thesis.mobile.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException

class MobileTelemetry(
    private val client: OkHttpClient = OkHttpClient()
) {
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
    private val enabled = BuildConfig.POSTHOG_ENABLED && BuildConfig.POSTHOG_API_KEY.isNotBlank()
    private val normalizedHost = BuildConfig.POSTHOG_HOST.trim().trimEnd('/')

    suspend fun capture(
        event: String,
        distinctId: String,
        properties: Map<String, Any?> = emptyMap()
    ) = withContext(Dispatchers.IO) {
        if (!enabled || event.isBlank() || distinctId.isBlank()) {
            return@withContext
        }

        val payload = JSONObject()
            .put("api_key", BuildConfig.POSTHOG_API_KEY)
            .put("event", event)
            .put("distinct_id", distinctId)
            .put("properties", mapToJson(properties))

        postJson("$normalizedHost/capture/", payload)
    }

    suspend fun fetchWatchlistFlag(distinctId: String): Boolean? = withContext(Dispatchers.IO) {
        if (!enabled || distinctId.isBlank()) {
            return@withContext null
        }

        val payload = JSONObject()
            .put("api_key", BuildConfig.POSTHOG_API_KEY)
            .put("distinct_id", distinctId)
        val response = postJson("$normalizedHost/decide/?v=3", payload)
        val featureFlags = response.optJSONObject("featureFlags") ?: return@withContext null
        val value = featureFlags.opt(BuildConfig.POSTHOG_WATCHLIST_FLAG_KEY)
        when (value) {
            is Boolean -> value
            is String -> value.equals("true", ignoreCase = true) || value.equals("enabled", ignoreCase = true)
            else -> null
        }
    }

    @Throws(IOException::class)
    private fun postJson(url: String, payload: JSONObject): JSONObject {
        val request = Request.Builder()
            .url(url)
            .post(payload.toString().toRequestBody(jsonMediaType))
            .build()

        client.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IOException("PostHog request failed: HTTP ${response.code}")
            }
            return if (raw.isBlank()) JSONObject() else JSONObject(raw)
        }
    }

    private fun mapToJson(values: Map<String, Any?>): JSONObject {
        val json = JSONObject()
        for ((key, value) in values) {
            when (value) {
                null -> json.put(key, JSONObject.NULL)
                is Number, is Boolean, is String -> json.put(key, value)
                else -> json.put(key, value.toString())
            }
        }
        return json
    }
}
