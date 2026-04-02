package com.thesis.mobile

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import androidx.compose.ui.platform.ComposeView
import com.thesis.mobile.data.SessionStore
import com.thesis.mobile.observability.MobileTelemetry
import com.thesis.mobile.offline.PrefetchScheduler
import com.thesis.mobile.security.AppLockManager
import com.thesis.mobile.ui.ThesisApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

data class LaunchTarget(
    val tab: String,
    val pulseDate: String? = null,
    val digestDate: String? = null,
    val notificationType: String? = null,
    val ticker: String? = null,
    val requestId: Long = System.nanoTime()
)

class MainActivity : FragmentActivity() {
    private var launchTarget by mutableStateOf<LaunchTarget?>(null)
    private val sessionStore by lazy { SessionStore(applicationContext) }
    private val appLockManager by lazy { AppLockManager(this, sessionStore) }
    private val telemetry by lazy { MobileTelemetry() }
    private val ioScope = CoroutineScope(Dispatchers.IO)
    private var unlockPromptInFlight = false
    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { /* no-op */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        applyLaunchIntent(intent)
        requestNotificationPermissionIfNeeded()
        if (sessionStore.loadTokens() != null) {
            PrefetchScheduler.schedule(applicationContext)
        } else {
            PrefetchScheduler.cancel(applicationContext)
        }
        ioScope.launch {
            telemetry.capture(
                event = "app_opened",
                distinctId = sessionStore.getInstallationId(),
                properties = mapOf("source" to "activity_on_create")
            )
        }

        setContentView(
            ComposeView(this).apply {
                setContent {
                    ThesisApp(
                        launchTarget = launchTarget,
                        onLaunchHandled = { launchTarget = null }
                    )
                }
            }
        )
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        applyLaunchIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        if (unlockPromptInFlight) {
            return
        }
        val hasAuthenticatedSession = sessionStore.loadTokens() != null
        if (!appLockManager.shouldPromptForUnlock(hasAuthenticatedSession)) {
            return
        }
        unlockPromptInFlight = true
        appLockManager.promptForUnlock { unlocked ->
            unlockPromptInFlight = false
            if (unlocked) {
                appLockManager.clearBackgroundMarker()
            } else {
                finish()
            }
        }
    }

    override fun onStop() {
        super.onStop()
        if (!isChangingConfigurations) {
            sessionStore.saveAppBackgroundedAtMs(System.currentTimeMillis())
        }
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
                normalizedType == "earnings_preview" ||
                normalizedType == "market_pulse_ready" ||
                normalizedType == "weekly_digest" ||
                intent.data?.toString().orEmpty().contains("thesis://pulse", ignoreCase = true)
        val shouldOpenDeepDive =
            normalizedTab == "deep_dive" ||
                normalizedType == "contrarian_alert" ||
                intent.data?.toString().orEmpty().contains("thesis://deep-dive", ignoreCase = true)

        launchTarget = when {
            shouldOpenPulse -> LaunchTarget(
                tab = "pulse",
                pulseDate = extractPulseDate(intent),
                digestDate = extractDigestDate(intent),
                notificationType = normalizedType
            )

            shouldOpenDeepDive -> LaunchTarget(
                tab = "deep_dive",
                ticker = extractDeepDiveTicker(intent),
                notificationType = normalizedType
            )

            else -> null
        }

        launchTarget?.let { target ->
            ioScope.launch {
                telemetry.capture(
                    event = "push_opened",
                    distinctId = sessionStore.getInstallationId(),
                    properties = mapOf(
                        "notification_type" to target.notificationType,
                        "tab" to target.tab,
                        "ticker" to target.ticker
                    )
                )
            }
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

    private fun extractDigestDate(intent: Intent?): String? {
        if (intent == null) {
            return null
        }
        val digestDate = intent.getStringExtra("digest_date")?.trim()
        if (!digestDate.isNullOrBlank()) {
            return digestDate
        }
        return intent.data?.getQueryParameter("digest_date")?.trim()?.ifBlank { null }
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
