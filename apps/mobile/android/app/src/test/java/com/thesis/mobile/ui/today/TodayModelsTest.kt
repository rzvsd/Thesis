package com.thesis.mobile.ui.today

import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.model.SentimentSnapshotView
import com.thesis.mobile.model.SnapshotDelta
import com.thesis.mobile.model.SnapshotPoint
import com.thesis.mobile.model.ThesisMonitorSnapshotView
import com.thesis.mobile.ui.copy.TodayCopy
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.theme.Tone
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/** Home's names and macro models, the weekly digest and the market calendar, under a fixed clock. */
class TodayModelsTest {

    private val zone = ZoneId.of("America/New_York")
    private val now = Instant.parse("2026-11-24T12:15:00Z") // Tue 24 Nov 2026, 07:15 New York
    private val clock = Clock.fixed(now, zone)
    private val fmt = Fmt(clock, zone, is24h = true)

    private fun snap(t: String, state: String, score: Double, report: String? = "2026-11-01T21:00:00Z") = ThesisMonitorSnapshotView(
        ticker = t, state = state, reason = "$t reason (thesis_drift).", score = score, reportId = "rep-$t",
        reportGeneratedAt = report, updatedAt = "2026-11-24T11:00:00Z",
    )

    private fun point(t: String, state: String, score: Double, at: String) = SnapshotPoint(t, Instant.parse(at).toEpochMilli(), state, score, 0.8, null)

    // ---- names ----------------------------------------------------------------------------------------------------

    @Test
    fun namesAreOrderedBySeverityThenChangeAndCapped() {
        val watchlist = listOf("AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "JPM", "XOM")
        val snaps = listOf(
            snap("AAPL", "intact", 78.0), snap("MSFT", "watch", 61.0), snap("NVDA", "at_risk", 44.0),
            snap("AMZN", "intact", 72.0), snap("GOOGL", "intact", 70.0), snap("JPM", "watch", 69.0),
        )
        val deltas = mapOf(
            "JPM" to SnapshotDelta("JPM", point("JPM", "watch", 69.0, "2026-11-24T11:00:00Z"), point("JPM", "intact", 70.0, "2026-11-17T12:00:00Z")),
            "AAPL" to SnapshotDelta("AAPL", point("AAPL", "intact", 78.0, "2026-11-24T11:00:00Z"), point("AAPL", "intact", 74.0, "2026-11-17T12:00:00Z")),
        )
        val s = HomeNames.summary(watchlist, snaps, deltas, setOf("aapl"), clock, fmt)
        assertEquals(listOf("NVDA", "JPM", "MSFT", "XOM", "AAPL"), s.rows.map { it.ticker })
        assertEquals(2, s.more)
        assertEquals("1 of your names changed since your last visit", s.headline)

        val jpm = s.rows[1]
        assertEquals("Intact → Watch, today", jpm.line2)
        assertEquals("69", jpm.figure)
        // The last visit was a week ago, so the day carries its date.
        assertEquals("${Fmt.MINUS}1 since 17 Nov", jpm.figureCaption)
        assertEquals(Tone.Unfavourable, jpm.figureCaptionTone)

        val aapl = s.rows.last()
        assertTrue(aapl.hasNote)
        assertEquals("+4 since 17 Nov", aapl.figureCaption)
        assertEquals(Tone.Favourable, aapl.figureCaptionTone)
        assertEquals("AAPL reason.", aapl.line2)
        // The compact forms Home falls back to when the reason would not fit beside the long caption.
        assertEquals("+4", aapl.figureCaptionShort)
        assertEquals("${Fmt.MINUS}1", jpm.figureCaptionShort)
        assertEquals(listOf("AAPL reason."), aapl.line2Forms)

        val xom = s.rows[3]
        assertEquals(TodayCopy.NO_READING_YET, xom.line2)
        assertNull(xom.figure)
        assertEquals(Tone.Unknown, xom.tone)
    }

    @Test
    fun theNamesHeadlineStatesTheResult() {
        assertEquals("You don’t follow any names yet", TodayCopy.namesHeadline(0, 0, 0, 0, 0))
        assertEquals("2 of your names need a review", TodayCopy.namesHeadline(12, 12, 0, 2, 10))
        assertEquals("1 of your names needs a review", TodayCopy.namesHeadline(12, 12, 0, 1, 11))
        assertEquals("All 12 of your names are intact", TodayCopy.namesHeadline(12, 12, 0, 0, 12))
        assertEquals("Both your names are intact", TodayCopy.namesHeadline(2, 2, 0, 0, 2))
        assertEquals("No monitor readings for your names yet", TodayCopy.namesHeadline(3, 0, 0, 0, 0))
        assertEquals("Report · 23 days ago", HomeNames.summary(listOf("A"), listOf(snap("A", "intact", 70.0)), emptyMap(), emptySet(), clock, fmt).rows.single().figureCaption)
    }

    @Test
    fun aLongReasonHasShorterFormsCutAtAClause() {
        val long = snap("A", "intact", 70.0).copy(reason = "Services margin held near 46%, while hardware revenue slipped for a third quarter.")
        val row = HomeNames.summary(listOf("A"), listOf(long), emptyMap(), emptySet(), clock, fmt).rows.single()
        assertEquals("Services margin held near 46%, while hardware revenue slipped for a third quarter.", row.line2)
        assertEquals(
            listOf(row.line2, "Services margin held near 46%, while hardware revenue slipped.", "Services margin held near 46%."),
            row.line2Forms,
        )
        // The report is 23 days old.
        assertEquals("Report · 23d", row.figureCaptionShort)
    }

    // ---- macro ----------------------------------------------------------------------------------------------------

    private fun reading(day: String, score: Double) = SentimentSnapshotView("m-$day", day, score, "x", calculatedAt = "${day}T21:00:00Z")

    @Test
    fun macroComparesWithTheReadingSevenDaysEarlier() {
        val history = listOf(reading("2026-11-13", 40.0), reading("2026-11-16", 46.0), reading("2026-11-20", 50.0))
        val m = MacroModel.summary(reading("2026-11-23", 52.0), history, fmt)!!
        assertEquals("Macro stress is Balanced and rising", m.title)
        assertEquals("+6 pts", m.deltaValue)
        assertEquals(TodayCopy.VS_7_DAYS, m.deltaReference)
        assertEquals(Tone.Unfavourable, m.deltaTone)
        assertEquals(listOf(40.0, 46.0, 50.0, 52.0), m.spark)
    }

    @Test
    fun macroFallsBackToTheEarliestReadingAndSaysSince() {
        val m = MacroModel.summary(reading("2026-11-23", 30.0), listOf(reading("2026-11-19", 33.0)), fmt)!!
        assertEquals("Macro stress is Contained and easing", m.title)
        assertEquals("${Fmt.MINUS}3 pts", m.deltaValue)
        assertEquals("since Thu 19 Nov", m.deltaReference)
        assertEquals(Tone.Favourable, m.deltaTone)
        val first = MacroModel.summary(reading("2026-11-23", 75.0), emptyList(), fmt)!!
        assertEquals("Macro stress is Elevated", first.title)
        assertNull(first.deltaValue)
        assertNull(MacroModel.summary(null, emptyList(), fmt))
    }

    // ---- weekly digest -------------------------------------------------------------------------------------------

    private fun alert(id: String, category: String, at: String) = AlertLedgerItemView(
        id = id, notificationType = category, category = category, route = "inbox", title = id, body = id,
        reasonCode = category, reasonText = "", deliveryState = "delivered", createdAt = at, updatedAt = at,
    )

    @Test
    fun theDigestCountsOnlyThisWeek() {
        val d = DigestBuilder.build(
            digestDate = "2026-11-24", clock = clock, fmt = fmt,
            watchlist = listOf("AAPL", "MSFT", "NVDA"),
            monitorSnapshots = listOf(
                snap("AAPL", "intact", 78.0, "2026-11-20T21:00:00Z"),
                snap("MSFT", "watch", 61.0, "2026-11-10T21:00:00Z"),
                snap("NVDA", "at_risk", 44.0, null),
            ),
            sentimentCurrent = reading("2026-11-23", 52.0),
            sentimentHistory = listOf(reading("2026-11-16", 46.0)),
            alerts = listOf(
                alert("a", "thesis_drift", "2026-11-23T14:00:00Z"), alert("b", "thesis_drift", "2026-11-19T14:00:00Z"),
                alert("c", "earnings", "2026-11-20T14:00:00Z"), alert("old", "earnings", "2026-11-10T14:00:00Z"),
            ),
            weeklyDeltas = listOf(
                SnapshotDelta("MSFT", point("MSFT", "watch", 61.0, "2026-11-23T15:00:00Z"), point("MSFT", "intact", 66.0, "2026-11-17T12:00:00Z")),
                SnapshotDelta("AAPL", point("AAPL", "intact", 78.0, "2026-11-23T15:00:00Z"), point("AAPL", "intact", 74.0, "2026-11-17T12:00:00Z")),
            ),
            reportSummaries = emptyMap(),
            pulseLine = "Stocks rose.",
            pulseDate = "2026-11-24",
        )
        assertEquals(LocalDate.of(2026, 11, 18), d.start)
        assertEquals(listOf("AAPL"), d.filings.map { it.ticker })
        assertEquals(listOf("MSFT"), d.stateChanges!!.map { it.ticker })
        assertEquals("Intact → Watch, yesterday", d.stateChanges!!.single().line2)
        assertEquals(3, d.alertsTotal)
        assertEquals(listOf("Thesis drift" to 2, "Earnings" to 1), d.alerts.map { it.label to it.count })
        assertEquals("Macro stress rose 6 points; 1 of your names has a new report; 1 name changed state; 3 alerts.", d.lede)
        assertFalse(d.isEmpty)
    }

    @Test
    fun withNoNamesTheDigestListsNoFilings() {
        val d = DigestBuilder.build(
            digestDate = "2026-11-24", clock = clock, fmt = fmt,
            watchlist = emptyList(),
            monitorSnapshots = listOf(snap("AAPL", "intact", 78.0, "2026-11-20T21:00:00Z")),
            sentimentCurrent = null, sentimentHistory = emptyList(), alerts = emptyList(), weeklyDeltas = null,
            reportSummaries = emptyMap(), pulseLine = null, pulseDate = null,
        )
        assertEquals(emptyList<String>(), d.filings.map { it.ticker })
        assertEquals(0, d.total)
    }

    @Test
    fun theDigestLedeLeavesOutWhatItDoesNotKnow() {
        assertEquals("0 alerts.", TodayCopy.digestLede(null, 0, null, 0, 0))
        assertEquals("Macro stress held level; no new reports on your names; 0 alerts.", TodayCopy.digestLede(0.2, 0, null, 0, 4))
        assertEquals(
            "Macro stress eased 3 points; 2 of your names have new reports; no name changed state; 1 alert.",
            TodayCopy.digestLede(-3.0, 2, 0, 1, 4),
        )
        assertEquals(
            "1 of your names has a new report; 1 name changed state; 2 alerts.",
            TodayCopy.digestLede(null, 1, 1, 2, 4),
        )
        // Numerals in every generated headline (house style).
        assertEquals("1 name changed state this week", TodayCopy.stateChangesHeadline(1))
        assertEquals("1 of your names has a new report this week", TodayCopy.filingsHeadline(1))
    }

    // ---- market calendar -----------------------------------------------------------------------------------------

    private fun ny(local: String): Instant = java.time.LocalDateTime.parse(local).atZone(MarketCalendar.NewYork).toInstant()

    @Test
    fun thePhaseFollowsNewYorkTime() {
        assertEquals(MarketPhase.PreMarket, MarketCalendar.phase(ny("2026-11-24T07:15")))
        assertEquals(MarketPhase.Open, MarketCalendar.phase(ny("2026-11-24T09:30")))
        assertEquals(MarketPhase.AfterClose, MarketCalendar.phase(ny("2026-11-24T16:00")))
        // Thanksgiving, a weekend and the afternoon of the early close: not certain, so no word.
        assertNull(MarketCalendar.phase(ny("2026-11-26T10:00")))
        assertNull(MarketCalendar.phase(ny("2026-11-28T10:00")))
        assertEquals(MarketPhase.Open, MarketCalendar.phase(ny("2026-11-27T12:59")))
        assertNull(MarketCalendar.phase(ny("2026-11-27T13:30")))
    }

    @Test
    fun holidaysAreComputedWithTheirObservedDates() {
        val h2026 = MarketCalendar.holidays(2026)
        listOf("2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25")
            .forEach { assertTrue(it, LocalDate.parse(it) in h2026) }
        assertEquals(10, h2026.size)
        // 1 Jan 2028 is a Saturday: the exchange stays open on Fri 31 Dec 2027.
        assertFalse(LocalDate.of(2027, 12, 31) in MarketCalendar.holidays(2027))
        assertEquals(LocalDate.of(2027, 3, 28), MarketCalendar.easter(2027))
        assertTrue(MarketCalendar.isTradingDay(LocalDate.of(2026, 11, 24)))
    }

    @Test
    fun theNextIssueDaySkipsWeekendsAndHolidays() {
        // Wed 25 Nov -> Fri 27 Nov (Thanksgiving on Thu 26); Fri 27 -> Mon 30; Sat 28 -> Mon 30.
        assertEquals(LocalDate.of(2026, 11, 27), MarketCalendar.nextTradingDay(LocalDate.of(2026, 11, 25)))
        assertEquals(LocalDate.of(2026, 11, 30), MarketCalendar.nextTradingDay(LocalDate.of(2026, 11, 27)))
        assertEquals(LocalDate.of(2026, 11, 30), MarketCalendar.nextTradingDay(LocalDate.of(2026, 11, 28)))
    }
}
