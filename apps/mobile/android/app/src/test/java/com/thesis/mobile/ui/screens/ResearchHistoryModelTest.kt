package com.thesis.mobile.ui.screens

import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.model.TickerSearchItem
import com.thesis.mobile.ui.copy.ResearchCopy
import com.thesis.mobile.ui.format.Fmt
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Clock
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime

/** Research root and History (5.12, 5.18): stored-report lookup, suggestions, filters, day groups, compare picks. */
class ResearchHistoryModelTest {
    private val zone: ZoneId = ZoneId.of("Europe/Bucharest")
    private val now: ZonedDateTime = ZonedDateTime.of(2026, 11, 24, 9, 0, 0, 0, zone)
    private val fmt = Fmt(Clock.fixed(now.toInstant(), zone), zone, is24h = true)

    private fun dd(id: String, ticker: String, at: String) = ReportHistoryItem(id, "job-$id", TYPE_DEEP_DIVE, ticker, at)
    private fun pulse(id: String, at: String) = ReportHistoryItem(id, "job-$id", "pulse", null, at)

    private val history = listOf(
        dd("r1", "AAPL", "2026-11-24T06:00:00Z"),
        dd("r2", "AAPL", "2025-11-20T06:00:00Z"),
        dd("r3", "MSFT", "2026-11-23T10:00:00Z"),
        pulse("p1", "2026-11-24T05:00:00Z"),
        dd("r4", "AAPL", "2026-08-01T06:00:00Z"),
    )
    private val periods = mapOf("r1" to "2026-FY", "r2" to "2025-FY", "r3" to "2026-FY", "r4" to "2026-Q3")

    @Test
    fun storedReportIsTheNewestDeepDiveForTheTicker() {
        assertEquals("r1", storedReportFor("aapl", history)?.reportId)
        assertNull(storedReportFor("NVDA", history))
        assertNull(storedReportFor("", history))
    }

    @Test
    fun suggestionsPutYourNamesFirstAndDropAnExactPick() {
        val server = listOf(TickerSearchItem("AAPL", "Apple Inc.", "NASDAQ"), TickerSearchItem("AAP", "Advance Auto Parts", "NYSE"))
        val s = tickerSuggestions("aa", server, watchlist = listOf("AAPL"), companyNames = mapOf("AAPL" to "Apple Inc."))
        assertEquals(listOf("AAPL", "AAP"), s.map { it.ticker })
        assertTrue(s.first().inYourNames)
        assertTrue(tickerSuggestions("AAPL", emptyList(), listOf("AAPL"), emptyMap()).isEmpty())
        assertTrue(tickerSuggestions(" ", server, emptyList(), emptyMap()).isEmpty())
        // The server list may be from an earlier query: it is filtered by the current one too.
        val stale = listOf(TickerSearchItem("MSFT", "Microsoft Corp.", "NASDAQ"), TickerSearchItem("AMD", "Advanced Micro Devices", "NASDAQ"))
        assertEquals(listOf("AMD"), tickerSuggestions("am", stale, emptyList(), emptyMap()).map { it.ticker })
        assertEquals(listOf("MSFT"), tickerSuggestions("soft", stale, emptyList(), emptyMap()).map { it.ticker })
    }

    @Test
    fun openedThisWeekCountsReportsNotPulseBriefs() {
        // r1, r3 and p1 are within the week; p1 is a Pulse brief.
        assertEquals(2, openedSince(history, now.minusDays(7).toInstant()))
        assertEquals("You opened 2 reports this week", ResearchCopy.recentHeadline(2, "AAPL", "3 h ago"))
        assertNull(ResearchCopy.recentHeadline(0, null, null))
    }

    @Test
    fun filtersMatchTypeNotesAndCompanyNewestFirst() {
        val noted = setOf("r2")
        assertEquals(listOf("r1", "p1", "r3", "r4", "r2"), filterHistory(history, HistoryFilter.All, "", noted, emptyMap()).map { it.reportId })
        assertEquals(listOf("p1"), filterHistory(history, HistoryFilter.Pulse, "", noted, emptyMap()).map { it.reportId })
        assertEquals(listOf("r2"), filterHistory(history, HistoryFilter.WithNotes, "", noted, emptyMap()).map { it.reportId })
        assertEquals(
            listOf("r3"),
            filterHistory(history, HistoryFilter.DeepDives, "micro", noted, mapOf("MSFT" to "Microsoft")).map { it.reportId },
        )
    }

    @Test
    fun daysGroupNewestFirstWithTodayAndYesterdayLabels() {
        val days = historyDays(filterHistory(history, HistoryFilter.All, "", emptySet(), emptyMap()), zone)
        assertEquals(LocalDate.of(2026, 11, 24), days[0].date)
        assertEquals(listOf("r1", "p1"), days[0].items.map { it.reportId })
        val today = now.toLocalDate()
        assertEquals(ResearchCopy.TODAY, dayLabel(days[0].date, today, fmt))
        assertEquals(ResearchCopy.YESTERDAY, dayLabel(days[1].date, today, fmt))
        assertEquals(fmt.marketDate(LocalDate.of(2026, 8, 1)), dayLabel(LocalDate.of(2026, 8, 1), today, fmt))
    }

    @Test
    fun compareModeAllowsOnlyLikeForLikeFilingsOfOneCompany() {
        val r1 = history[0]
        val r2 = history[1]
        val r3 = history[2]
        val p1 = history[3]
        val r4 = history[4]
        assertEquals(ResearchCopy.WHY_PULSE, historyPickBlock(p1, emptyList(), periods))
        assertNull(historyPickBlock(r1, emptyList(), periods))
        assertEquals(ResearchCopy.WHY_OTHER_COMPANY, historyPickBlock(r3, listOf(r1), periods))
        assertEquals(ResearchCopy.WHY_NOT_LIKE, historyPickBlock(r4, listOf(r1), periods))
        assertNull(historyPickBlock(r2, listOf(r1), periods))
        // The same period: worded on the period, since the History period is not yet each report's own filing.
        val r1b = dd("r1b", "AAPL", "2026-11-20T06:00:00Z")
        assertEquals(ResearchCopy.whySamePeriod(annual = true), historyPickBlock(r1b, listOf(r1), periods + ("r1b" to "2026-FY")))
        assertEquals(ResearchCopy.WHY_TWO_PICKED, historyPickBlock(r4, listOf(r1, r2), periods))
        // A picked row can always be unpicked.
        assertNull(historyPickBlock(r1, listOf(r1, r2), periods))
        // A report whose filing is unknown cannot be picked.
        val unknown = dd("r9", "AAPL", "2026-01-01T00:00:00Z")
        assertEquals(ResearchCopy.WHY_UNKNOWN_FILING, historyPickBlock(unknown, emptyList(), periods))
    }

    @Test
    fun orderedPairPutsTheOlderFilingFirst() {
        val pair = orderedPair(listOf(history[0], history[1]), periods)
        assertEquals("r2" to "r1", pair?.let { it.first.reportId to it.second.reportId })
        assertNull(orderedPair(listOf(history[0], history[2]), periods))
        assertNull(orderedPair(listOf(history[0], history[4]), periods))
        assertNull(orderedPair(listOf(history[0]), periods))
    }

    @Test
    fun recentRowsLeaveOutTheReportContinueReadingOffers() {
        assertEquals(listOf("r1", "p1", "r3"), recentRows(history, null).map { it.reportId })
        assertEquals(listOf("p1", "r3", "r4"), recentRows(history, "r1").map { it.reportId })
    }

    @Test
    fun historyMetaCountsReportsAndPulseBriefsApart() {
        assertEquals("9 reports · 2 Pulse briefs · latest 2 h ago", ResearchCopy.historyMeta(9, 2, "2 h ago"))
        assertEquals("1 report", ResearchCopy.historyMeta(1, 0, null))
        assertEquals("1 Pulse brief", ResearchCopy.historyMeta(0, 1, null))
    }
}
