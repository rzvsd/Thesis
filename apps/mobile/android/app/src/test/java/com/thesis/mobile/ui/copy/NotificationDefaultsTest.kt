package com.thesis.mobile.ui.copy

import com.thesis.mobile.ui.defaultNotificationPreferences
import org.junit.Assert.assertTrue
import org.junit.Test

class NotificationDefaultsTest {
    @Test
    fun defaultNotificationPreferences_includeEarningsWarRoom() {
        assertTrue(defaultNotificationPreferences().any { it.type == "earnings_war_room" })
    }
}
