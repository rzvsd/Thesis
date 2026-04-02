package com.thesis.mobile.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.thesis.mobile.BuildConfig
import com.thesis.mobile.model.AuthTokens
import com.thesis.mobile.model.LastViewedReport
import java.util.UUID

class SessionStore(context: Context) {
    private val prefs = buildPrefs(context)

    private fun buildPrefs(context: Context): SharedPreferences {
        return runCatching {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()
            EncryptedSharedPreferences.create(
                context,
                PREFS_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        }.getOrElse {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        }
    }

    fun saveTokens(tokens: AuthTokens) {
        prefs.edit()
            .putString(KEY_ACCESS_TOKEN, tokens.accessToken)
            .putString(KEY_REFRESH_TOKEN, tokens.refreshToken)
            .putString(KEY_ACCESS_EXPIRES_AT, tokens.accessTokenExpiresAt)
            .putString(KEY_REFRESH_EXPIRES_AT, tokens.refreshTokenExpiresAt)
            .apply()
    }

    fun loadTokens(): AuthTokens? {
        val access = prefs.getString(KEY_ACCESS_TOKEN, null) ?: return null
        val refresh = prefs.getString(KEY_REFRESH_TOKEN, null) ?: return null
        val accessExpires = prefs.getString(KEY_ACCESS_EXPIRES_AT, null) ?: return null
        val refreshExpires = prefs.getString(KEY_REFRESH_EXPIRES_AT, null) ?: return null
        return AuthTokens(
            accessToken = access,
            refreshToken = refresh,
            accessTokenExpiresAt = accessExpires,
            refreshTokenExpiresAt = refreshExpires
        )
    }

    fun clearTokens() {
        prefs.edit()
            .remove(KEY_ACCESS_TOKEN)
            .remove(KEY_REFRESH_TOKEN)
            .remove(KEY_ACCESS_EXPIRES_AT)
            .remove(KEY_REFRESH_EXPIRES_AT)
            .apply()
    }

    fun saveApiBaseUrl(url: String) {
        prefs.edit().putString(KEY_API_BASE_URL, url).apply()
    }

    fun loadApiBaseUrl(): String = prefs.getString(KEY_API_BASE_URL, BuildConfig.API_BASE_URL).orEmpty()

    fun saveNotificationsEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_NOTIFICATIONS_ENABLED, enabled).apply()
    }

    fun areNotificationsEnabled(): Boolean = prefs.getBoolean(KEY_NOTIFICATIONS_ENABLED, true)

    fun hasSeenWelcome(): Boolean = prefs.getBoolean(KEY_HAS_SEEN_WELCOME, false)

    fun setHasSeenWelcome(value: Boolean) {
        prefs.edit().putBoolean(KEY_HAS_SEEN_WELCOME, value).apply()
    }

    fun getInstallationId(): String {
        val existing = prefs.getString(KEY_INSTALLATION_ID, null)
        if (!existing.isNullOrBlank()) {
            return existing
        }
        val generated = UUID.randomUUID().toString()
        prefs.edit().putString(KEY_INSTALLATION_ID, generated).apply()
        return generated
    }

    fun saveLastViewedReport(
        reportId: String,
        label: String,
        type: String,
        referenceDate: String? = null
    ) {
        prefs.edit()
            .putString(KEY_LAST_VIEWED_REPORT_ID, reportId)
            .putString(KEY_LAST_VIEWED_LABEL, label)
            .putString(KEY_LAST_VIEWED_TYPE, type)
            .putString(KEY_LAST_VIEWED_REFERENCE_DATE, referenceDate)
            .putLong(KEY_LAST_VIEWED_TIMESTAMP, System.currentTimeMillis())
            .apply()
    }

    fun getLastViewedReport(): LastViewedReport? {
        val reportId = prefs.getString(KEY_LAST_VIEWED_REPORT_ID, null) ?: return null
        val label = prefs.getString(KEY_LAST_VIEWED_LABEL, null) ?: return null
        val type = prefs.getString(KEY_LAST_VIEWED_TYPE, null) ?: return null
        val referenceDate = prefs.getString(KEY_LAST_VIEWED_REFERENCE_DATE, null)
        val timestamp = prefs.getLong(KEY_LAST_VIEWED_TIMESTAMP, 0L)
        
        val isOld = (System.currentTimeMillis() - timestamp) > 24 * 60 * 60 * 1000L
        if (isOld) {
            clearLastViewedReport()
            return null
        }
        
        return LastViewedReport(reportId, label, type, referenceDate, timestamp)
    }

    fun clearLastViewedReport() {
        prefs.edit()
            .remove(KEY_LAST_VIEWED_REPORT_ID)
            .remove(KEY_LAST_VIEWED_LABEL)
            .remove(KEY_LAST_VIEWED_TYPE)
            .remove(KEY_LAST_VIEWED_REFERENCE_DATE)
            .remove(KEY_LAST_VIEWED_TIMESTAMP)
            .apply()
    }

    fun saveBiometricLockEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_BIOMETRIC_LOCK_ENABLED, enabled).apply()
    }

    fun isBiometricLockEnabled(): Boolean = prefs.getBoolean(KEY_BIOMETRIC_LOCK_ENABLED, false)

    fun saveAppBackgroundedAtMs(value: Long) {
        prefs.edit().putLong(KEY_APP_BACKGROUNDED_AT_MS, value).apply()
    }

    fun getAppBackgroundedAtMs(): Long = prefs.getLong(KEY_APP_BACKGROUNDED_AT_MS, 0L)

    companion object {
        private const val PREFS_NAME = "thesis_mobile_prefs"
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_ACCESS_EXPIRES_AT = "access_expires_at"
        private const val KEY_REFRESH_EXPIRES_AT = "refresh_expires_at"
        private const val KEY_API_BASE_URL = "api_base_url"
        private const val KEY_NOTIFICATIONS_ENABLED = "notifications_enabled"
        private const val KEY_HAS_SEEN_WELCOME = "has_seen_welcome"
        private const val KEY_INSTALLATION_ID = "installation_id"
        private const val KEY_LAST_VIEWED_REPORT_ID = "last_viewed_report_id"
        private const val KEY_LAST_VIEWED_LABEL = "last_viewed_label"
        private const val KEY_LAST_VIEWED_TYPE = "last_viewed_type"
        private const val KEY_LAST_VIEWED_REFERENCE_DATE = "last_viewed_reference_date"
        private const val KEY_LAST_VIEWED_TIMESTAMP = "last_viewed_timestamp"
        private const val KEY_BIOMETRIC_LOCK_ENABLED = "biometric_lock_enabled"
        private const val KEY_APP_BACKGROUNDED_AT_MS = "app_backgrounded_at_ms"
    }
}
