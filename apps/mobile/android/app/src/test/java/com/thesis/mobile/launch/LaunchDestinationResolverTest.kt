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

    @Test
    fun resolveTab_routesScenarioRunQueryToResearch() {
        assertEquals(
            "research",
            LaunchDestinationResolver.resolveTab(null, null, "thesis://research?scenario_run_id=sr_123")
        )
        assertEquals("research", LaunchDestinationResolver.resolveTab("scenario", null, null))
        assertEquals(
            "research",
            LaunchDestinationResolver.resolveTab(
                null,
                null,
                "thesis://open?open_tab=research&scenario_id=rates_higher_for_longer&scenario_run_id=sr_123"
            )
        )
        assertEquals(
            null,
            LaunchDestinationResolver.resolveTab(
                null,
                null,
                "thesis://open?scenario_run_id=sr_123"
            )
        )
    }

    @Test
    fun resolveScenarioIds_readExplicitValueOrUriQuery() {
        assertEquals("rates_higher_for_longer", LaunchDestinationResolver.resolveScenarioId("rates_higher_for_longer", null))
        assertEquals(
            "ai_hype_burst",
            LaunchDestinationResolver.resolveScenarioId(
                null,
                "thesis://research/scenario?scenario_id=ai_hype_burst"
            )
        )
        assertEquals("sr_789", LaunchDestinationResolver.resolveScenarioRunId("sr_789", null))
        assertEquals(
            "sr_456",
            LaunchDestinationResolver.resolveScenarioRunId(
                null,
                "thesis://research/scenario?scenario_run_id=sr_456"
            )
        )
    }
}
