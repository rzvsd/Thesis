package com.thesis.mobile.ui.screens

import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.ui.copy.InboxCopy
import com.thesis.mobile.ui.format.Fmt
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

class InboxModelTest {
    private val zone: ZoneId = ZoneId.of("Europe/Bucharest")
    private val now: Instant = Instant.parse("2025-11-25T10:00:00Z")
    private val clock: Clock = Clock.fixed(now, zone)
    private val fmt = Fmt(clock, zone, is24h = true)
    private val today: LocalDate = LocalDate.now(clock)

    private fun alert(
        id: String,
        category: String = "system",
        type: String = "system_notice",
        createdAt: String = "2025-11-25T08:00:00Z",
        ticker: String? = null,
        warRoomId: String? = null,
        reportId: String? = null,
        mutedAt: String? = null,
    ) = AlertLedgerItemView(
        id = id,
        notificationType = type,
        category = category,
        route = "inbox",
        title = "Title $id",
        body = "Body $id",
        reasonCode = "watchlist",
        reasonText = "You follow this name",
        deliveryState = "delivered",
        mutedAt = mutedAt,
        ticker = ticker,
        reportId = reportId,
        createdAt = createdAt,
        updatedAt = createdAt,
        warRoomId = warRoomId,
    )

    @Test
    fun `filters by category key, never by the English label`() {
        val alerts = listOf(
            alert("a", category = "thesis_drift"),
            alert("b", category = "Earnings"),
            alert("c", category = "earnings"),
            alert("d", category = "macro"),
            alert("e", category = "thesis-drift"),
        )
        assertEquals(listOf("b", "c"), InboxModels.filter(alerts, "earnings").map { it.id })
        assertEquals(listOf("a", "e"), InboxModels.filter(alerts, "thesis_drift").map { it.id })
        assertEquals(alerts, InboxModels.filter(alerts, null))
        // A label is not a key.
        assertTrue(InboxModels.filter(alerts, "Thesis drift").isEmpty())
    }

    @Test
    fun `filter chips are All then the categories present, in order, with counts`() {
        val alerts = listOf(
            alert("a", category = "macro"),
            alert("b", category = "earnings"),
            alert("c", category = "earnings"),
            alert("d", category = "thesis_drift"),
            alert("e", category = ""),
        )
        val filters = InboxModels.filters(alerts)
        assertEquals(listOf(null, "thesis_drift", "earnings", "macro", "system"), filters.map { it.key })
        assertEquals(listOf(InboxCopy.ALL, "Thesis drift", "Earnings", "Macro", "System"), filters.map { it.label })
        assertEquals(listOf(5, 1, 2, 1, 1), filters.map { it.count })
    }

    @Test
    fun `groups by day newest first in the device zone`() {
        val alerts = listOf(
            alert("old", createdAt = "2025-11-20T10:00:00Z"),
            alert("today", createdAt = "2025-11-25T07:30:00Z"),
            // 23:30 in Bucharest on the 24th, so yesterday there although it is the 24th in UTC as well.
            alert("yesterday", createdAt = "2025-11-24T21:30:00Z"),
            // 00:30 on the 25th in Bucharest: today, though still the 24th in UTC.
            alert("past-midnight", createdAt = "2025-11-24T22:30:00Z"),
            alert("undated", createdAt = "soon"),
        )
        val days = InboxModels.groupByDay(alerts, zone, today, fmt)
        assertEquals(
            listOf(InboxCopy.TODAY, InboxCopy.YESTERDAY, fmt.marketDate(LocalDate.of(2025, 11, 20)), InboxCopy.UNDATED),
            days.map { it.label },
        )
        assertEquals(listOf("today", "past-midnight"), days[0].alerts.map { it.id })
        assertEquals(listOf("yesterday"), days[1].alerts.map { it.id })
    }

    @Test
    fun `thesis drift alerts route to the Name, not the alert's own route`() {
        val drift = alert("a", category = "thesis_drift", type = "contrarian_alert", ticker = "NVDA", reportId = "r1")
        assertEquals(InboxRoute.NameChanges("NVDA"), InboxModels.route(drift, canOpen = true))
        // Even when the alert's own route would only land back on Inbox.
        assertEquals(InboxRoute.NameChanges("NVDA"), InboxModels.route(drift, canOpen = false))
        assertEquals("Open NVDA", InboxModels.openLabel(drift, InboxRoute.NameChanges("NVDA")))
        // Without a ticker there is no Name to open.
        assertEquals(InboxRoute.Alert, InboxModels.route(alert("b", category = "thesis_drift"), canOpen = true))
    }

    @Test
    fun `without a Name or War Room callback, Open is offered only when the alert's own route goes somewhere`() {
        val drift = alert("a", category = "thesis_drift", type = "contrarian_alert", ticker = "NVDA")
        assertEquals(InboxRoute.NameChanges("NVDA"), InboxModels.route(drift, canOpen = true, canOpenName = false))
        assertNull(InboxModels.route(drift, canOpen = false, canOpenName = false))
        val earnings = alert("b", category = "earnings", type = "earnings_preview", warRoomId = "wr-1")
        assertEquals(InboxRoute.WarRoom("wr-1"), InboxModels.route(earnings, canOpen = true, canOpenWarRoom = false))
        assertNull(InboxModels.route(earnings, canOpen = false, canOpenWarRoom = false))
    }

    @Test
    fun `earnings alerts with a War Room open the War Room`() {
        val earnings = alert("a", category = "earnings", type = "earnings_preview", ticker = "AAPL", warRoomId = "wr-1")
        assertEquals(InboxRoute.WarRoom("wr-1"), InboxModels.route(earnings, canOpen = false))
        assertEquals(InboxCopy.OPEN_WAR_ROOM, InboxModels.openLabel(earnings, InboxRoute.WarRoom("wr-1")))
        assertEquals(InboxRoute.Alert, InboxModels.route(alert("b", category = "earnings"), canOpen = true))
    }

    @Test
    fun `an alert with nowhere to go has no Open`() {
        assertNull(InboxModels.route(alert("a"), canOpen = false))
        val report = alert("b", reportId = "r1")
        assertEquals(InboxCopy.OPEN_REPORT, InboxModels.openLabel(report, InboxRoute.Alert))
        assertEquals(InboxCopy.OPEN, InboxModels.openLabel(alert("c"), InboxRoute.Alert))
    }

    @Test
    fun `new since the last visit is client-side`() {
        val alerts = listOf(
            alert("a", createdAt = "2025-11-25T09:00:00Z"),
            alert("b", createdAt = "2025-11-25T08:00:00Z"),
            alert("c", createdAt = "2025-11-24T08:00:00Z"),
        )
        val visit = Instant.parse("2025-11-25T07:00:00Z").toEpochMilli()
        assertEquals(2, InboxModels.newCount(alerts, visit))
        assertTrue(InboxModels.isNew(alerts[0], visit))
        assertFalse(InboxModels.isNew(alerts[2], visit))
        assertEquals("2 new alerts since your last visit", InboxModels.lede(alerts, visit))
        assertEquals("Nothing new since your last visit", InboxModels.lede(alerts, now.toEpochMilli()))
        // No visit recorded: nothing is marked new, the lede counts the alerts.
        assertEquals(0, InboxModels.newCount(alerts, null))
        assertEquals("3 alerts, newest first", InboxModels.lede(alerts, null))
        // UiState keeps 0 for "never visited": the same as no visit.
        assertEquals(0, InboxModels.newCount(alerts, 0L))
        assertEquals("3 alerts, newest first", InboxModels.lede(alerts, 0L))
        assertNull(InboxModels.lede(emptyList(), visit))
    }

    @Test
    fun `a quiet lasts 24 hours`() {
        assertTrue(InboxModels.isQuiet(alert("a", mutedAt = "2025-11-25T08:00:00Z"), now))
        assertFalse(InboxModels.isQuiet(alert("b", mutedAt = "2025-11-24T08:00:00Z"), now))
        assertFalse(InboxModels.isQuiet(alert("c"), now))
        assertTrue(InboxModels.isQuiet(alert("d", mutedAt = "yes"), now))
    }

    @Test
    fun `server times with an offset parse`() {
        assertEquals(Instant.parse("2025-11-25T08:00:00Z"), InboxModels.instant("2025-11-25T10:00:00+02:00"))
        assertNull(InboxModels.instant(""))
        assertNull(InboxModels.instant(null))
    }
}
