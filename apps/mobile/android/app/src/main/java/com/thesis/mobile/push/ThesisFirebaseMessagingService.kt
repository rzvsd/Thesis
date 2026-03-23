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

        val contentTitle =
            message.data["title"]
                ?: message.notification?.title
                ?: getString(R.string.pulse_notification_title)
        val contentBody =
            message.data["body"]
                ?: message.notification?.body
                ?: getString(R.string.pulse_notification_body)
        val launchIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("open_tab", "pulse")
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(contentTitle)
            .setContentText(contentBody)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, notification)
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
    }
}
