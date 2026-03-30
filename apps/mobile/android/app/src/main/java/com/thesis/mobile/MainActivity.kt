package com.thesis.mobile

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import com.thesis.mobile.ui.ThesisApp

data class LaunchTarget(
    val tab: String,
    val pulseDate: String? = null,
    val ticker: String? = null,
    val requestId: Long = System.nanoTime()
)

class MainActivity : ComponentActivity() {
    private var launchTarget by mutableStateOf<LaunchTarget?>(null)
    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { /* no-op */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        applyLaunchIntent(intent)
        requestNotificationPermissionIfNeeded()

        setContent {
            ThesisApp(
                launchTarget = launchTarget,
                onLaunchHandled = { launchTarget = null }
            )
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        applyLaunchIntent(intent)
    }

    private fun applyLaunchIntent(intent: Intent?) {
        if (intent == null) {
            launchTarget = null
            return
        }

        val openTab = intent.getStringExtra("open_tab")
        val notificationType = intent.getStringExtra("notification_type")
        val normalizedTab = openTab?.trim()?.lowercase()
        val normalizedType = notificationType?.trim()?.lowercase()

        val shouldOpenPulse =
            normalizedTab == "pulse" ||
                normalizedType == "market_pulse_ready" ||
                normalizedType == "weekly_digest" ||
                intent.data?.toString().orEmpty().contains("thesis://pulse", ignoreCase = true)
        val shouldOpenDeepDive =
            normalizedTab == "deep_dive" ||
                normalizedType == "earnings_preview" ||
                normalizedType == "contrarian_alert" ||
                intent.data?.toString().orEmpty().contains("thesis://deep-dive", ignoreCase = true)

        launchTarget = when {
            shouldOpenPulse -> LaunchTarget(
                tab = "pulse",
                pulseDate = extractPulseDate(intent)
            )

            shouldOpenDeepDive -> LaunchTarget(
                tab = "deep_dive",
                ticker = extractDeepDiveTicker(intent)
            )

            else -> null
        }
    }

    private fun extractPulseDate(intent: Intent?): String? {
        if (intent == null) {
            return null
        }
        val pulseDate = intent.getStringExtra("pulse_date")?.trim()
        if (!pulseDate.isNullOrBlank()) {
            return pulseDate
        }
        return intent.data?.getQueryParameter("date")?.trim()?.ifBlank { null }
    }

    private fun extractDeepDiveTicker(intent: Intent?): String? {
        if (intent == null) {
            return null
        }
        val ticker = intent.getStringExtra("ticker")?.trim()
        if (!ticker.isNullOrBlank()) {
            return ticker.uppercase()
        }
        return intent.data?.getQueryParameter("ticker")?.trim()?.uppercase()?.ifBlank { null }
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return
        }
        val status = ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
        if (status != PackageManager.PERMISSION_GRANTED) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }
}
