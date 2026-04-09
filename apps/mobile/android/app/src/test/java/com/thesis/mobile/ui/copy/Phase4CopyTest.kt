package com.thesis.mobile.ui.copy

import com.thesis.mobile.ui.defaultNotificationPreferences
import org.junit.Assert.assertTrue
import org.junit.Assert.assertEquals
import org.junit.Test

class Phase4CopyTest {
    @Test
    fun notificationFamilyLabel_includesEarningsWarRoom() {
        assertEquals("Earnings War Room", Phase4Copy.notificationFamilyLabel("earnings_war_room"))
    }

    @Test
    fun defaultNotificationPreferences_includeEarningsWarRoom() {
        assertTrue(defaultNotificationPreferences().any { it.type == "earnings_war_room" })
    }
}
