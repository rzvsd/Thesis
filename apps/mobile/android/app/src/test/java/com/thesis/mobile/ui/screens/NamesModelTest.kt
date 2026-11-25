package com.thesis.mobile.ui.screens

import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.model.NoteTrailEntry
import com.thesis.mobile.model.SnapshotDelta
import com.thesis.mobile.model.SnapshotPoint
import com.thesis.mobile.model.ThesisMonitorSnapshotView
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.theme.Tone
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The Names board model (5.10): rows, filters and their counts, sorts, pager scope, follow errors, Notes grouping. */
class NamesModelTest {

    private val now = Instant.parse("2026-11-25T15:00:00Z")
    private val fmt = Fmt(Clock.fixed(now, ZoneOffset.UTC), ZoneOffset.UTC, is24h = true)
    private val visit = Instant.parse("2026-11-21T09:00:00Z").toEpochMilli()

    private fun snap(t: String, state: String, score: Double, report: String = "2026-11-01T00:00:00Z") = ThesisMonitorSnapshotView(
        ticker = t, state = state, reason = "$t reason", score = score, reportId = "rep-$t", reportGeneratedAt = report,
        lastDeepDiveAt = report, updatedAt = "2026-11-25T14:00:00Z",
    )

    private fun point(t: String, at: String, state: String, score: Double) =
        SnapshotPoint(t, Instant.parse(at).toEpochMilli(), state, score, 0.9, "rep-$t")

    private fun alert(id: String, t: String, created: String, category: String = "thesis", eventDate: String? = null, warRoom: String? = null) =
        AlertLedgerItemView(
            id = id, notificationType = category, category = category, route = "name", title = id, body = id,
            reasonCode = category, reasonText = id, deliveryState = "delivered", ticker = t, createdAt = created,
            updatedAt = created, warRoomId = warRoom, eventDate = eventDate,
        )

    private val inputs = BoardInputs(
        watchlist = listOf("aapl", "MSFT", "NVDA", "JPM", "COST"),
        snapshots = listOf(
            snap("AAPL", "intact", 0.78, "2026-11-10T00:00:00Z"),
            snap("MSFT", "weakened", 0.61, "2026-09-01T00:00:00Z"),
            snap("NVDA", "improved", 0.84, "2026-11-20T00:00:00Z"),
            snap("COST", "intact", 0.50, "2026-10-01T00:00:00Z"),
        ),
        alerts = listOf(
            alert("a1", "MSFT", "2026-11-23T10:00:00Z"),
            alert("a2", "MSFT", "2026-11-20T10:00:00Z"),
            alert("a3", "COST", "2026-11-24T08:00:00Z", category = "earnings", eventDate = "2026-12-03"),
        ),
        deltas = mapOf(
            "AAPL" to SnapshotDelta("AAPL", point("AAPL", "2026-11-25T14:00:00Z", "intact", 0.78), point("AAPL", "2026-11-21T08:00:00Z", "intact", 0.74)),
            "MSFT" to SnapshotDelta("MSFT", point("MSFT", "2026-11-25T14:00:00Z", "weakened", 0.61), point("MSFT", "2026-11-21T08:00:00Z", "intact", 0.62)),
        ),
        notedTickers = setOf("NVDA"),
        lastVisitAtMs = visit,
    )

    private val rows = buildBoardRows(inputs, fmt, now)

    @Test
    fun `rows keep watchlist order, upper-case tickers and read the score out of 100`() {
        assertEquals(listOf("AAPL", "MSFT", "NVDA", "JPM", "COST"), rows.map { it.ticker })
        assertEquals("78", rows[0].figure)
        assertNull(rows.first { it.ticker == "JPM" }.figure)
        assertEquals(Tone.Unknown, rows.first { it.ticker == "JPM" }.stateTone)
    }

    @Test
    fun `changed means a state change or a score move since the last visit`() {
        val changed = rows.filter { it.changed }.map { it.ticker }
        assertEquals(listOf("AAPL", "MSFT"), changed)
        val msft = rows.first { it.ticker == "MSFT" }
        assertEquals("Intact → Weakened, today", msft.line2)
        // The short #11 form: no unit, the weekday within the week (21 Nov 2026 is a Saturday).
        assertEquals("+4 since Sat", rows[0].figureCaption)
        assertEquals(Tone.Favourable, rows[0].figureTone)
        assertEquals("−1 since Sat", msft.figureCaption)
    }

    @Test
    fun `an unchanged score has no caption and a name without a reading shows its report age`() {
        val flat = inputs.copy(
            deltas = mapOf(
                "AAPL" to SnapshotDelta("AAPL", point("AAPL", "2026-11-25T14:00:00Z", "intact", 0.78), point("AAPL", "2026-11-21T08:00:00Z", "intact", 0.78)),
            ),
        )
        val built = buildBoardRows(flat, fmt, now)
        // #11: "none when unchanged" (Name's wider tile says "Unchanged since Sat").
        assertNull(built.first { it.ticker == "AAPL" }.figureCaption)
        assertNull(built.first { it.ticker == "AAPL" }.compactCaption)
        assertEquals(Tone.Neutral, built.first { it.ticker == "AAPL" }.figureTone)
        // Compact rows hold the change alone: no report age there, so the Δ column keeps one width.
        assertNull(built.first { it.ticker == "NVDA" }.compactCaption)
        assertEquals("+4 since Sat", rows[0].compactCaption)
        // The report's age, relative within 30 days (#11 "10-K · 23 days ago"), then the date.
        assertEquals("Report · 1 Oct", built.first { it.ticker == "COST" }.figureCaption)
        assertEquals("Report · 5 days ago", built.first { it.ticker == "NVDA" }.figureCaption)
    }

    @Test
    fun `brief days and signed points`() {
        val today = java.time.LocalDate.parse("2026-11-25")
        assertEquals("today", briefDay(today, today, fmt))
        assertEquals("Tue", briefDay(today.minusDays(1), today, fmt))
        assertEquals("Thu", briefDay(today.minusDays(6), today, fmt))
        assertEquals("18 Nov", briefDay(today.minusDays(7), today, fmt))
        assertEquals("+4", signedPoints(3.6))
        assertEquals("−9", signedPoints(-9.2))
    }

    @Test
    fun `a War Room in its earnings window counts as earnings soon without a dated alert`() {
        val withRoom = buildBoardRows(inputs.copy(warRooms = mapOf("AAPL" to "wr-1")), fmt, now)
        assertTrue(withRoom.first { it.ticker == "AAPL" }.earningsSoon)
        assertEquals(2, boardFilterCounts(withRoom)[BoardFilter.EarningsSoon])
    }

    @Test
    fun `only a War Room in its Live phase marks the row live`() {
        val window = buildBoardRows(inputs.copy(warRooms = mapOf("AAPL" to "wr-1")), fmt, now)
        assertTrue(window.none { it.live })
        val live = buildBoardRows(inputs.copy(warRooms = mapOf("AAPL" to "wr-1"), liveWarRooms = setOf("aapl")), fmt, now)
        assertEquals(listOf("AAPL"), live.filter { it.live }.map { it.ticker })
    }

    @Test
    fun `nothing reads as changed before the first visit`() {
        val first = buildBoardRows(inputs.copy(lastVisitAtMs = 0L), fmt, now)
        assertTrue(first.none { it.changed })
        assertTrue(first.all { it.newAlerts == 0 })
    }

    @Test
    fun `new alerts count only alerts after the last visit`() {
        assertEquals(1, rows.first { it.ticker == "MSFT" }.newAlerts)
    }

    @Test
    fun `filter counts match the filtered rows for every chip`() {
        val counts = boardFilterCounts(rows)
        BoardFilter.entries.forEach { f -> assertEquals(f.name, filterBoard(rows, f).size, counts[f]) }
        assertEquals(5, counts[BoardFilter.All])
        assertEquals(1, counts[BoardFilter.AtRisk])
        assertEquals(1, counts[BoardFilter.EarningsSoon])
        assertEquals(1, counts[BoardFilter.WithNotes])
    }

    @Test
    fun `state sort puts the most at risk first and pins the focus ticker`() {
        assertEquals("MSFT", sortBoard(rows, BoardSort.State).first().ticker)
        val pinned = buildBoardRows(inputs.copy(focusTicker = "cost"), fmt, now)
        assertEquals("COST", sortBoard(pinned, BoardSort.State).first().ticker)
    }

    @Test
    fun `score sort is lowest first with no score last, age sort is oldest report first`() {
        val byScore = sortBoard(rows, BoardSort.Score).map { it.ticker }
        assertEquals(listOf("COST", "MSFT", "AAPL", "NVDA", "JPM"), byScore)
        val byAge = sortBoard(rows, BoardSort.ReportAge).map { it.ticker }
        assertEquals("JPM", byAge.first())
        assertEquals("MSFT", byAge[1])
        assertEquals(listOf("AAPL", "COST", "JPM", "MSFT", "NVDA"), sortBoard(rows, BoardSort.Ticker).map { it.ticker })
    }

    @Test
    fun `pager scope round-trips and orders the board like the screen`() {
        val scope = namesPagerScope(BoardFilter.Changed, BoardSort.Score)
        assertEquals(BoardFilter.Changed to BoardSort.Score, parseNamesPagerScope(scope))
        assertEquals(BoardFilter.All to BoardSort.State, parseNamesPagerScope("nonsense"))
        assertEquals(listOf("MSFT", "AAPL"), namesBoardOrder(scope, inputs, now))
    }

    @Test
    fun `follow rejects a ticker already followed and a malformed one`() {
        assertEquals("AAPL is already in your names.", followError("aapl", listOf("AAPL")))
        assertTrue(followError("not a ticker!", emptyList()) != null)
        assertNull(followError("BRK.B", listOf("AAPL")))
    }

    @Test
    fun `notes group by ticker, newest note first, with the earlier count`() {
        val notes = listOf(
            NoteTrailEntry("r1", "AAPL", "old", "2025-11-01T00:00:00Z", "FY2025", null),
            NoteTrailEntry("r2", "AAPL", "new", "2026-11-01T00:00:00Z", "FY2026", null),
            NoteTrailEntry("r3", "MSFT", "msft", "2026-10-01T00:00:00Z", "FY2026", null),
            NoteTrailEntry("r4", "MSFT", "   ", "2026-11-20T00:00:00Z", "FY2026 Q1", null),
        )
        val groups = groupNotes(notes)
        assertEquals(listOf("AAPL", "MSFT"), groups.map { it.ticker })
        assertEquals("new", groups[0].latest.text)
        assertEquals(1, groups[0].earlier)
        assertEquals("msft", groups[1].latest.text)
        assertEquals(listOf("MSFT"), filterNotes(groups, "msft").map { it.ticker })
        assertFalse(filterNotes(groups, "zzz").isNotEmpty())
    }
}
