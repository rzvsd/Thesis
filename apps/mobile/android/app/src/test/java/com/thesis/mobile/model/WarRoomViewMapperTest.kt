package com.thesis.mobile.model

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class WarRoomViewMapperTest {
    @Test
    fun mapWarRoomView_parsesRootAndThreePhases() {
        val json = JSONObject(
            """
            {
              "data": {
                "war_room_id": "wr_1",
                "title": "Tesla Earnings War Room",
                "ticker": "TSLA",
                "status": "live",
                "generated_at": "2026-04-09T09:00:00Z",
                "summary": "One room for the full earnings arc.",
                "related_tickers": ["TSLA", "NVDA"],
                "pre": {
                  "title": "Pre-open",
                  "summary": "Pre-open setup.",
                  "highlights": ["Gap risk", "Options elevated"]
                },
                "live": {
                  "title": "Live",
                  "summary": "The room is live.",
                  "bullets": ["First move", "Volume spike"],
                  "route": "research",
                  "ticker": "TSLA",
                  "report_id": "report_1"
                },
                "post": {
                  "title": "Post-close",
                  "summary": "Post-close wrap.",
                  "points": ["Close reaction"]
                }
              }
            }
            """.trimIndent()
        )

        val view = WarRoomViewMapper.mapWarRoomView(json)

        assertNotNull(view)
        view!!
        assertEquals("wr_1", view.warRoomId)
        assertEquals("Tesla Earnings War Room", view.title)
        assertEquals(3, view.phases.size)
        assertEquals("pre", view.phases[0].phase)
        assertEquals(listOf("Gap risk", "Options elevated"), view.phases[0].highlights)
        assertEquals("research", view.phases[1].route)
        assertEquals("report_1", view.phases[1].reportId)
        assertEquals(listOf("TSLA", "NVDA"), view.relatedTickers)
    }

    @Test
    fun mapWarRoomView_parsesTimelineShapeFromProductApi() {
        val json = JSONObject(
            """
            {
              "data": {
                "war_room_id": "wr_api_1",
                "ticker": "AAPL",
                "state": "live",
                "current_cadence_min": 30,
                "timeline": [
                  {
                    "war_room_event_id": "evt1",
                    "phase": "pre",
                    "event_type": "prepared",
                    "reason_text": "AAPL reports tomorrow. War Room prep is ready.",
                    "created_at": "2026-07-27T10:00:00Z"
                  },
                  {
                    "war_room_event_id": "evt2",
                    "phase": "live",
                    "event_type": "cadence_changed",
                    "reason_text": "Cadence changed from 15 min to 30 min (failures).",
                    "created_at": "2026-07-28T13:00:00Z"
                  }
                ]
              }
            }
            """.trimIndent()
        )

        val view = WarRoomViewMapper.mapWarRoomView(json)

        assertNotNull(view)
        view!!
        assertEquals("wr_api_1", view.warRoomId)
        assertEquals("AAPL", view.ticker)
        assertEquals("live", view.status)
        assertEquals("Cadence changed from 15 min to 30 min (failures).", view.summary)
        assertEquals(2, view.phases.size)
        assertEquals("pre", view.phases[0].phase)
        assertEquals("live", view.phases[1].phase)
        assertEquals("cadence_changed", view.phases[1].status)
    }
}
