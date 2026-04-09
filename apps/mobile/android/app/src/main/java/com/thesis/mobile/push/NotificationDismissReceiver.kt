package com.thesis.mobile.push

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.thesis.mobile.data.SessionStore
import com.thesis.mobile.observability.MobileTelemetry
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class NotificationDismissReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val notificationType =
            intent?.getStringExtra(EXTRA_NOTIFICATION_TYPE)?.trim().orEmpty().ifBlank { "unknown" }
        val openTab = intent?.getStringExtra(EXTRA_OPEN_TAB)?.trim().orEmpty().ifBlank { "today" }
        val ticker = intent?.getStringExtra(EXTRA_TICKER)?.trim()?.ifBlank { null }
        val alertId = intent?.getStringExtra(EXTRA_ALERT_ID)?.trim()?.ifBlank { null }
        val warRoomId = intent?.getStringExtra(EXTRA_WAR_ROOM_ID)?.trim()?.ifBlank { null }

        CoroutineScope(Dispatchers.IO).launch {
            runCatching {
                MobileTelemetry().capture(
                    event = "push_dismissed",
                    distinctId = SessionStore(context.applicationContext).getInstallationId(),
                    properties = mapOf(
                        "notification_type" to notificationType,
                        "open_tab" to openTab,
                        "ticker" to ticker,
                        "alert_id" to alertId,
                        "war_room_id" to warRoomId
                    )
                )
            }
        }
    }

    companion object {
        const val EXTRA_NOTIFICATION_TYPE = "notification_type"
        const val EXTRA_OPEN_TAB = "open_tab"
        const val EXTRA_TICKER = "ticker"
        const val EXTRA_ALERT_ID = "alert_id"
        const val EXTRA_WAR_ROOM_ID = "war_room_id"
    }
}
