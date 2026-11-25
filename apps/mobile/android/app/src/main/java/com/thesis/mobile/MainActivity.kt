package com.thesis.mobile

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.fragment.app.FragmentActivity
import androidx.compose.ui.platform.ComposeView
import com.thesis.mobile.data.SessionStore
import com.thesis.mobile.launch.LaunchDestinationResolver
import com.thesis.mobile.observability.MobileTelemetry
import com.thesis.mobile.offline.PrefetchScheduler
import com.thesis.mobile.security.AppLockManager
import com.thesis.mobile.ui.ThesisApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/** Kept under its old name for existing callers; the class lives in `ui/navigation` so routing is testable. */
typealias LaunchTarget = com.thesis.mobile.ui.navigation.LaunchTarget

class MainActivity : FragmentActivity() {
    private var launchTarget by mutableStateOf<LaunchTarget?>(null)
    private val sessionStore by lazy { SessionStore(applicationContext) }
    private val appLockManager by lazy { AppLockManager(this, sessionStore) }
    private val telemetry by lazy { MobileTelemetry() }
    private val ioScope = CoroutineScope(Dispatchers.IO)
    private var unlockPromptInFlight = false
    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { /* no-op */ }

    /** The splash stays until the first Compose frame (session restored, first screen chosen). */
    private var firstFrameDrawn = false

    override fun onCreate(savedInstanceState: Bundle?) {
        // Before super.onCreate (5.1): the launch theme hands over to Theme.ThesisMobile.
        val splash = installSplashScreen()
        splash.setKeepOnScreenCondition { !firstFrameDrawn }
        splash.setOnExitAnimationListener { provider ->
            provider.view.animate()
                .alpha(0f)
                .setDuration(SPLASH_EXIT_MS)
                .withEndAction { provider.remove() }
                .start()
        }
        // Edge to edge on every API level; Compose pads with WindowInsets, and ThesisTheme sets the icon colours.
        // Both bars transparent: the default auto style paints a 90 % white navigation bar on API 26-28 when the
        // system is in light mode, under the (dark by default) app and its light icons. Revisit when
        // ThemeMode.System becomes the default.
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT)
        )
        super.onCreate(savedInstanceState)
        // A recreate (rotation, the night-mode switch, process death) gets the same intent again. Once it has been
        // routed, routing it again would reset the restored stack to the link's destination and start a second
        // build for a research link, so it is applied only on a fresh start or while it is still waiting (a link
        // opened before log-in). New intents arrive in onNewIntent.
        if (savedInstanceState?.getBoolean(STATE_LAUNCH_ROUTED, false) != true) applyLaunchIntent(intent)
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
                    SideEffect { firstFrameDrawn = true }
                }
            }
        )
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        // ThesisApp clears launchTarget (onLaunchHandled) once it has routed it.
        outState.putBoolean(STATE_LAUNCH_ROUTED, launchTarget == null)
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
        val normalizedType = notificationType?.trim()?.lowercase()
        val uriString = intent.data?.toString()
        val resolvedTab = LaunchDestinationResolver.resolveTab(openTab, notificationType, uriString)
        val warRoomId = LaunchDestinationResolver.resolveWarRoomId(
            intent.getStringExtra("war_room_id"),
            uriString
        )
        val scenarioId = LaunchDestinationResolver.resolveScenarioId(
            intent.getStringExtra("scenario_id"),
            uriString
        )
        val scenarioRunId = LaunchDestinationResolver.resolveScenarioRunId(
            intent.getStringExtra("scenario_run_id"),
            uriString
        )

        launchTarget = resolvedTab?.let { target ->
            LaunchTarget(
                tab = target,
                alertId = extractAlertId(intent),
                reportId = extractReportId(intent),
                warRoomId = warRoomId,
                scenarioId = scenarioId,
                scenarioRunId = scenarioRunId,
                pulseDate = extractPulseDate(intent),
                digestDate = extractDigestDate(intent),
                notificationType = normalizedType,
                ticker = extractDeepDiveTicker(intent)
            )
        }

        launchTarget?.let { target ->
            ioScope.launch {
                telemetry.capture(
                    event = "push_opened",
                    distinctId = sessionStore.getInstallationId(),
                    properties = mapOf(
                        "notification_type" to target.notificationType,
                        "tab" to target.tab,
                        "ticker" to target.ticker,
                        "alert_id" to target.alertId,
                        "war_room_id" to target.warRoomId,
                        "scenario_id" to target.scenarioId,
                        "scenario_run_id" to target.scenarioRunId
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
        return LaunchDestinationResolver.resolveTicker(
            intent.getStringExtra("ticker"),
            intent.data?.toString()
        )
    }

    private fun extractAlertId(intent: Intent?): String? {
        if (intent == null) {
            return null
        }
        val alertId = intent.getStringExtra("alert_id")?.trim()
        if (!alertId.isNullOrBlank()) {
            return alertId
        }
        return intent.data?.getQueryParameter("alert_id")?.trim()?.ifBlank { null }
    }

    private fun extractReportId(intent: Intent?): String? {
        if (intent == null) {
            return null
        }
        return LaunchDestinationResolver.resolveReportId(
            intent.getStringExtra("report_id"),
            intent.data?.toString()
        )
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

    private companion object {
        const val SPLASH_EXIT_MS = 240L
        /** Saved state: the launch intent has been routed (nothing pending), so a recreate does not route it again. */
        const val STATE_LAUNCH_ROUTED = "thesis.launch_routed"
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
