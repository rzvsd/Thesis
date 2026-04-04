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
import com.thesis.mobile.network.ProductApiClient
import com.thesis.mobile.observability.MobileTelemetry
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

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
        val openTab = when (notificationType) {
            "contrarian_alert", "earnings_preview" -> "deep_dive"
            "weekly_digest", "market_pulse_ready" -> "pulse"
            else -> message.data["route"]?.trim().orEmpty().ifBlank { "pulse" }
        }

        val contentTitle =
            message.data["headline"]
                ?: message.data["title"]
                ?: message.notification?.title
                ?: getString(R.string.pulse_notification_title)
        val contentBody =
            message.data["body"]
                ?: message.notification?.body
                ?: getString(R.string.pulse_notification_body)
        val launchIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("open_tab", openTab)
            putExtra("notification_type", notificationType)
            putExtra("ticker", message.data["ticker"])
            putExtra("pulse_date", message.data["report_date"])
            putExtra("digest_date", message.data["digest_date"])
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val dismissIntent = Intent(this, NotificationDismissReceiver::class.java).apply {
            putExtra(NotificationDismissReceiver.EXTRA_NOTIFICATION_TYPE, notificationType)
            putExtra(NotificationDismissReceiver.EXTRA_OPEN_TAB, openTab)
            putExtra(NotificationDismissReceiver.EXTRA_TICKER, message.data["ticker"])
        }
        val dismissPendingIntent = PendingIntent.getBroadcast(
            this,
            dismissRequestCode(notificationType, message.data["ticker"]),
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
        manager.notify(NOTIFICATION_ID, notification)
        ioScope.launch {
            runCatching {
                MobileTelemetry().capture(
                    event = "push_delivered",
                    distinctId = SessionStore(applicationContext).getInstallationId(),
                    properties = mapOf(
                        "notification_type" to notificationType,
                        "open_tab" to openTab,
                        "ticker" to message.data["ticker"]
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
                    deviceToken = token
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
        private const val NOTIFICATION_ID = 7301

        private fun dismissRequestCode(notificationType: String, ticker: String?): Int {
            val seed = "${notificationType.trim().lowercase()}|${ticker.orEmpty().trim().uppercase()}"
            return seed.hashCode()
        }
    }
}
