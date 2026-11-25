package com.thesis.mobile.ui.screens

import com.thesis.mobile.model.NoteTrailEntry
import com.thesis.mobile.model.ReportSearchHit
import com.thesis.mobile.model.ScenarioStressImpactView
import com.thesis.mobile.model.ScenarioStressRouteView
import com.thesis.mobile.model.ScenarioStressRunHeaderView
import com.thesis.mobile.model.ScenarioStressRunView
import com.thesis.mobile.model.SearchResultsView
import com.thesis.mobile.model.TickerSearchItem
import com.thesis.mobile.model.WarRoomPhaseView
import com.thesis.mobile.model.WarRoomView
import com.thesis.mobile.ui.copy.ResearchCopy
import com.thesis.mobile.ui.theme.Tone
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Scenario Stress (5.20), War Room (5.19) and Search (5.27) models. */
class StressWarRoomSearchModelTest {
    private val route = ScenarioStressRouteView("scenario", "rates_higher_for_longer", "run-1")

    private fun impact(ticker: String, score: Double, level: String, likelihood: String, rationale: String, refs: List<String> = emptyList()) =
        ScenarioStressImpactView(
            scenarioImpactId = "i-$ticker", scenarioRunId = "run-1", userId = "u", ticker = ticker, impactLevel = level,
            thesisBreakLikelihood = likelihood, stressScore = score, rationale = rationale, evidenceRefs = refs,
            route = route, createdAt = "2026-11-24T06:00:00Z",
        )

    private val run = ScenarioStressRunView(
        run = ScenarioStressRunHeaderView(
            scenarioRunId = "run-1", scenarioId = "rates_higher_for_longer", userId = "u", status = "completed",
            runMode = "manual", asOf = "2026-11-24", totalNames = 4, impactedNames = 3, criticalNames = 0,
            summary = "Rates stay high", route = route, createdAt = "2026-11-24T06:00:00Z", completedAt = "2026-11-24T06:01:00Z",
        ),
        impacts = listOf(
            impact("msft", 0.42, "watch", "low", "Cloud demand holds\nsecond line"),
            impact("NVDA", 0.81, "high", "very_high", "Rich multiple meets higher discount rates", listOf("https://www.sec.gov/x", "3f2b-uuid-like")),
            impact("KO", 0.05, "none", "low", "Staples barely move"),
            impact("AAPL", 0.42, "elevated", "moderate", "Financing costs"),
        ),
    )

    @Test
    fun stressRowsSortDescendingWithARationaleLineEach() {
        val rows = stressRows(run)
        assertEquals(listOf("NVDA", "AAPL", "MSFT", "KO"), rows.map { it.ticker })
        assertEquals(listOf(81.0, 42.0, 42.0, 5.0), rows.map { it.score })
        assertTrue(rows.all { !it.rationale.isNullOrBlank() })
        assertEquals("Cloud demand holds", rows[2].rationale)
        val bars = stressBars(rows)
        assertEquals(rows.map { it.ticker }, bars.map { it.label })
        assertEquals(rows.map { it.rationale }, bars.map { it.rationale })
        assertEquals(Tone.Unfavourable, rows[0].tone)
        assertEquals(Tone.Neutral, rows[3].tone)
        // Only web links survive as evidence; ids are never rendered.
        assertEquals(listOf("https://www.sec.gov/x"), rows[0].evidence)
    }

    @Test
    fun scoresReadAsZeroToHundredAndBreakLikelihoodAsABadge() {
        assertEquals(81.0, stressScore100(0.81)!!, 1e-9)
        assertEquals(64.0, stressScore100(64.0)!!, 1e-9)
        assertNull(stressScore100(Double.NaN))
        assertEquals(ResearchCopy.BREAK_LIKELY, breakBadge("very_high")?.text)
        assertEquals(ResearchCopy.BREAK_POSSIBLE, breakBadge("moderate")?.text)
        assertEquals(Tone.Neutral, breakBadge("low")?.tone)
        assertNull(breakBadge(null))
    }

    @Test
    fun stressCopyAsTableIsTabSeparatedInRankOrder() {
        val lines = stressTsv(stressRows(run)).split("\n")
        assertEquals(listOf(ResearchCopy.TABLE_TICKER, ResearchCopy.TABLE_SCORE, ResearchCopy.TABLE_IMPACT, ResearchCopy.TABLE_BREAK), lines[0].split("\t"))
        assertEquals(listOf("NVDA", "81", ResearchCopy.impactWord("high"), ResearchCopy.BREAK_LIKELY), lines[1].split("\t"))
        assertEquals(5, lines.size)
    }

    private fun phase(p: String, status: String? = null, reportId: String? = null) =
        WarRoomPhaseView(phase = p, title = "$p title", summary = "$p summary", status = status, reportId = reportId)

    @Test
    fun warRoomStepComesFromTheRoomStateElseTheFurthestPhase() {
        val room = WarRoomView("w", ticker = "AAPL", status = "live", phases = listOf(phase("post"), phase("pre")))
        assertEquals(WarRoomStep.Live, warRoomCurrentStep(room))
        assertTrue(warRoomIsLive(room))
        assertEquals(listOf("pre", "post"), warRoomPhasesInOrder(room).map { it.phase })
        val degraded = room.copy(status = "degraded", phases = listOf(phase("pre"), phase("live")))
        assertEquals(WarRoomStep.Live, warRoomCurrentStep(degraded))
        assertFalse(warRoomIsLive(degraded))
        assertEquals(WarRoomStep.Pre, warRoomStepOf("ready"))
        assertEquals(WarRoomStep.Post, warRoomStepOf("after_close"))
        assertNull(warRoomCurrentStep(WarRoomView("w")))
        assertTrue(warRoomClosed(room.copy(status = "closed")))
        // A scheduled phase is not written yet.
        assertEquals(2, phasesWritten(listOf(phase("pre", "complete"), phase("live", "in_progress"), phase("post", "scheduled"))))
    }

    @Test
    fun phaseStatusesBecomeSentenceCaseBadges() {
        assertEquals(ResearchCopy.PHASE_COMPLETE, phaseBadge("complete")?.text)
        assertEquals(ResearchCopy.PHASE_IN_PROGRESS, phaseBadge("IN_PROGRESS")?.text)
        assertEquals("Degraded", phaseBadge("degraded")?.text)
        assertNull(phaseBadge(" "))
    }

    @Test
    fun noteExcerptStartsAtTheMatchedWord() {
        val e = noteExcerpt("Services   margin keeps\nexpanding while hardware is flat.", "expand")
        assertEquals("expanding", e.lead)
        assertEquals(" while hardware is flat.", e.rest)
        assertTrue(e.clipped)
        val first = noteExcerpt("Margins held up", "marg")
        assertEquals("Margins", first.lead)
        assertFalse(first.clipped)
        val none = noteExcerpt("Nothing to see", "zzz")
        assertEquals("", none.lead)
        assertEquals("Nothing to see", none.rest)
        val long = noteExcerpt("buyback " + "word ".repeat(80), "buyback", max = 40)
        assertTrue(long.rest.endsWith("…"))
        assertTrue(long.rest.length <= 41)
    }

    @Test
    fun searchGroupsDoNotRepeatYourNamesUnderCompanies() {
        val results = SearchResultsView(
            query = "a",
            tickers = listOf(TickerSearchItem("AAPL", "Apple Inc.", "NASDAQ"), TickerSearchItem("AMD", "AMD", "NASDAQ")),
            names = listOf("aapl", "AAPL"),
            reports = listOf(ReportSearchHit("r1", "AAPL", "Apple", "deep_dive", "2026-11-24T06:00:00Z")),
            notes = listOf(
                NoteTrailEntry("r1", "AAPL", "A note", null, "FY2025", null),
                NoteTrailEntry("r2", "AAPL", " ", null, null, null),
            ),
        )
        val g = searchGroups(results)
        assertEquals(listOf("AAPL"), g.names)
        assertEquals(listOf("AMD"), g.companies.map { it.symbol })
        assertEquals(1, g.notes.size)
        assertFalse(g.isEmpty)
        assertTrue(searchGroups(SearchResultsView("zz")).isEmpty)
    }
}
