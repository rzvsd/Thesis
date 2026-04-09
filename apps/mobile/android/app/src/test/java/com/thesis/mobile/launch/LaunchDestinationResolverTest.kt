package com.thesis.mobile.launch

import org.junit.Assert.assertEquals
import org.junit.Test

class LaunchDestinationResolverTest {
    @Test
    fun resolveTab_routesEarningsWarRoomToResearch() {
        assertEquals("research", LaunchDestinationResolver.resolveTab(null, "earnings_war_room", null))
        assertEquals("research", LaunchDestinationResolver.resolveTab("war_room", null, null))
    }

    @Test
    fun resolveTab_keepsExistingTodayAndResearchRoutes() {
        assertEquals("today", LaunchDestinationResolver.resolveTab(null, "market_pulse_ready", null))
        assertEquals("research", LaunchDestinationResolver.resolveTab("research", null, "thesis://war-room?war_room_id=wr_1"))
    }

    @Test
    fun resolveWarRoomId_readsExplicitValueOrUriQuery() {
        assertEquals("wr_123", LaunchDestinationResolver.resolveWarRoomId("wr_123", null))
        assertEquals(
            "wr_456",
            LaunchDestinationResolver.resolveWarRoomId(
                null,
                "thesis://research/war-room?war_room_id=wr_456"
            )
        )
    }
}
