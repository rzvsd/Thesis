package com.thesis.mobile.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.thesis.mobile.MainActivity
import com.thesis.mobile.R
import com.thesis.mobile.data.SessionStore
import com.thesis.mobile.launch.LaunchDestinationResolver
import com.thesis.mobile.network.ProductApiClient
import com.thesis.mobile.observability.MobileTelemetry
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlin.math.abs

class ThesisFirebaseMessagingService : FirebaseMessagingService() {
    private val ioScope = CoroutineScope(Dispatchers.IO)

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        syncToken(token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        ensureChannel()

        val notificationType = message.data["notification_type"]?.trim().orEmpty()
        val route = message.data["route"]?.trim()?.lowercase()
        val openTab = LaunchDestinationResolver.resolveTab(route, notificationType, null) ?: "today"
        val warRoomId = message.data["war_room_id"]?.trim().orEmpty().ifBlank { null }
        val scenarioId = message.data["scenario_id"]?.trim().orEmpty().ifBlank { null }
        val scenarioRunId = message.data["scenario_run_id"]?.trim().orEmpty().ifBlank { null }

        val contentTitle =
            message.data["headline"]
                ?: message.data["title"]
                ?: message.notification?.title
                ?: getString(R.string.pulse_notification_title)
        val contentBody =
            message.data["body"]
                ?: message.notification?.body
                ?: getString(R.string.pulse_notification_body)
        val notificationSeed = buildNotificationSeed(
            notificationType = notificationType,
            ticker = message.data["ticker"],
            alertId = message.data["alert_id"],
            warRoomId = warRoomId,
            scenarioId = scenarioId,
            scenarioRunId = scenarioRunId,
            reportDate = message.data["report_date"],
            digestDate = message.data["digest_date"],
            messageId = message.messageId,
            sentTime = message.sentTime
        )
        val launchIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("open_tab", openTab)
            putExtra("notification_type", notificationType)
            putExtra("ticker", message.data["ticker"])
            putExtra("pulse_date", message.data["report_date"])
            putExtra("digest_date", message.data["digest_date"])
            putExtra("report_id", message.data["report_id"])
            putExtra("alert_id", message.data["alert_id"])
            putExtra("war_room_id", warRoomId)
            putExtra("scenario_id", scenarioId)
            putExtra("scenario_run_id", scenarioRunId)
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            interactionRequestCode(notificationSeed),
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val dismissIntent = Intent(this, NotificationDismissReceiver::class.java).apply {
            putExtra(NotificationDismissReceiver.EXTRA_NOTIFICATION_TYPE, notificationType)
            putExtra(NotificationDismissReceiver.EXTRA_OPEN_TAB, openTab)
            putExtra(NotificationDismissReceiver.EXTRA_TICKER, message.data["ticker"])
            putExtra(NotificationDismissReceiver.EXTRA_ALERT_ID, message.data["alert_id"])
            putExtra(NotificationDismissReceiver.EXTRA_WAR_ROOM_ID, warRoomId)
            putExtra(NotificationDismissReceiver.EXTRA_SCENARIO_ID, scenarioId)
            putExtra(NotificationDismissReceiver.EXTRA_SCENARIO_RUN_ID, scenarioRunId)
        }
        val dismissPendingIntent = PendingIntent.getBroadcast(
            this,
            dismissRequestCode(
                notificationType,
                message.data["ticker"],
                message.data["alert_id"],
                warRoomId,
                scenarioId,
                scenarioRunId
            ),
            dismissIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(contentTitle)
            .setContentText(contentBody)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setDeleteIntent(dismissPendingIntent)
            .build()

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(notificationId(notificationSeed), notification)
        ioScope.launch {
            runCatching {
                MobileTelemetry().capture(
                    event = "push_delivered",
                    distinctId = SessionStore(applicationContext).getInstallationId(),
                    properties = mapOf(
                        "notification_type" to notificationType,
                        "open_tab" to openTab,
                        "ticker" to message.data["ticker"],
                        "alert_id" to message.data["alert_id"],
                        "war_room_id" to warRoomId,
                        "scenario_id" to scenarioId,
                        "scenario_run_id" to scenarioRunId
                    )
                )
            }
        }
    }

    private fun syncToken(token: String) {
        ioScope.launch {
            val sessionStore = SessionStore(applicationContext)
            val auth = sessionStore.loadTokens() ?: return@launch
            val baseUrl = sessionStore.loadApiBaseUrl()
            val notificationsEnabled = sessionStore.areNotificationsEnabled()
            if (!notificationsEnabled) {
                return@launch
            }
            runCatching {
                ProductApiClient().updateDeviceToken(
                    baseUrl = baseUrl,
                    accessToken = auth.accessToken,
                    deviceToken = token,
                    installationId = sessionStore.getInstallationId()
                )
            }
        }
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return
        }
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (manager.getNotificationChannel(CHANNEL_ID) != null) {
            return
        }
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.pulse_notification_channel_name),
            NotificationManager.IMPORTANCE_DEFAULT
        )
        manager.createNotificationChannel(channel)
    }

    companion object {
        const val CHANNEL_ID = "morning_pulse"

        private fun buildNotificationSeed(
            notificationType: String,
            ticker: String?,
            alertId: String?,
            warRoomId: String?,
            scenarioId: String?,
            scenarioRunId: String?,
            reportDate: String?,
            digestDate: String?,
            messageId: String?,
            sentTime: Long
        ): String {
            val normalizedType = notificationType.trim().lowercase()
            val normalizedTicker = ticker.orEmpty().trim().uppercase()
            val normalizedAlertId = alertId.orEmpty().trim()
            val normalizedWarRoomId = warRoomId.orEmpty().trim()
            val normalizedScenarioId = scenarioId.orEmpty().trim()
            val normalizedScenarioRunId = scenarioRunId.orEmpty().trim()
            val normalizedReportDate = reportDate.orEmpty().trim()
            val normalizedDigestDate = digestDate.orEmpty().trim()
            val normalizedMessageId = messageId.orEmpty().trim()
            return listOf(
                normalizedType,
                normalizedTicker,
                normalizedAlertId,
                normalizedWarRoomId,
                normalizedScenarioId,
                normalizedScenarioRunId,
                normalizedReportDate,
                normalizedDigestDate,
                normalizedMessageId,
                sentTime.toString()
            ).joinToString("|")
        }

        private fun safeHash(seed: String): Int {
            val hash = seed.hashCode()
            return if (hash == Int.MIN_VALUE) 0 else abs(hash)
        }

        private fun notificationId(seed: String): Int = safeHash(seed)

        private fun interactionRequestCode(seed: String): Int = safeHash("open|$seed")

        private fun dismissRequestCode(
            notificationType: String,
            ticker: String?,
            alertId: String?,
            warRoomId: String?,
            scenarioId: String?,
            scenarioRunId: String?
        ): Int {
            val seed = buildString {
                append(notificationType.trim().lowercase())
                append("|")
                append(ticker.orEmpty().trim().uppercase())
                append("|")
                append(alertId.orEmpty().trim())
                append("|")
                append(warRoomId.orEmpty().trim())
                append("|")
                append(scenarioId.orEmpty().trim())
                append("|")
                append(scenarioRunId.orEmpty().trim())
            }
            return safeHash("dismiss|$seed")
        }
    }
}
