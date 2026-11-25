package com.thesis.mobile.ui.navigation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DestinationCodecTest {

    /** One value of every destination, with awkward text where a field is free text. */
    private val every: List<Destination> = listOf(
        Destination.Today,
        Destination.Names,
        Destination.Research,
        Destination.Inbox,
        Destination.Pulse(),
        Destination.Pulse("2026-11-24"),
        Destination.MacroStress,
        Destination.WeeklyDigest(),
        Destination.WeeklyDigest("2026-11-23"),
        Destination.Name("AAPL"),
        Destination.Name("BRK.B", pagerScope = "names:filter=at_risk|sort=score"),
        Destination.Report("rep_1"),
        Destination.Report("rep_2", ticker = "MSFT", chapter = "02-business"),
        Destination.ReportClassic("rep_3", "NVDA"),
        Destination.DeepDiveRunning("AMD"),
        Destination.CompareReports("rep_a", "rep_b"),
        Destination.CompareNames(listOf("AAPL", "MSFT", "GOOGL")),
        Destination.CompareNames(emptyList()),
        Destination.History(),
        Destination.History("with notes ~ 100% | 10-K"),
        Destination.WarRoom("wr_1"),
        Destination.WarRoom(null),
        Destination.ScenarioStress(),
        Destination.ScenarioStress(runId = "sr_1", scenarioId = "rates_higher_for_longer", ticker = "AAPL"),
        Destination.You,
        Destination.YouPage("appearance"),
        Destination.Paywall("filing_change_detail"),
        Destination.Search,
    )

    @Test
    fun everyDestinationRoundTrips() {
        every.forEach { destination ->
            val encoded = destination.encode()
            assertEquals("round trip of $encoded", destination, Destination.decode(encoded))
        }
    }

    /**
     * Exhaustive `when` (no else): a new destination does not compile until it is listed here, and the
     * assertion below then fails until [every] has a value of it.
     */
    private fun kind(d: Destination): String = when (d) {
        Destination.Today -> "today"
        Destination.Names -> "names"
        Destination.Research -> "research"
        Destination.Inbox -> "inbox"
        is Destination.Pulse -> "pulse"
        Destination.MacroStress -> "macro"
        is Destination.WeeklyDigest -> "digest"
        is Destination.Name -> "name"
        is Destination.Report -> "report"
        is Destination.ReportClassic -> "classic"
        is Destination.DeepDiveRunning -> "running"
        is Destination.CompareReports -> "compare_reports"
        is Destination.CompareNames -> "compare_names"
        is Destination.History -> "history"
        is Destination.WarRoom -> "war_room"
        is Destination.ScenarioStress -> "scenario"
        Destination.You -> "you"
        is Destination.YouPage -> "you_page"
        is Destination.Paywall -> "paywall"
        Destination.Search -> "search"
    }

    private val kindCount = 20

    @Test
    fun everyDestinationClassIsCovered() {
        assertEquals("add new destinations to `every`", kindCount, every.map(::kind).toSet().size)
    }

    @Test
    fun encodedFormHasNoLineBreaks() {
        // The navigator stores one entry per line.
        every.forEach { assertTrue(it.encode(), '\n' !in it.encode()) }
        assertTrue('\n' !in Destination.History("a\nb").encode())
        assertEquals(Destination.History("a\nb"), Destination.decode(Destination.History("a\nb").encode()))
    }

    @Test
    fun tagsAreUnique() {
        val tags = every.map { it.tag }.distinct()
        assertEquals(kindCount, tags.size)
    }

    @Test
    fun unknownOrBrokenStringsDecodeToNull() {
        assertNull(Destination.decode("not_a_destination|x"))
        assertNull(Destination.decode("report|~"))
        assertNull(Destination.decode("report"))
        assertNull(Destination.decode(""))
    }

    @Test
    fun modalAndBottomBarFlags() {
        listOf(Destination.You, Destination.YouPage("legal"), Destination.Paywall("x"), Destination.Search)
            .forEach { assertTrue(it.isModal); assertTrue(it.hidesBottomBar) }
        listOf(Destination.Report("r"), Destination.ReportClassic("r"), Destination.DeepDiveRunning("AAPL"))
            .forEach { assertTrue(!it.isModal && it.hidesBottomBar) }
        listOf(Destination.Today, Destination.Pulse(), Destination.History(), Destination.WarRoom("w"))
            .forEach { assertTrue(!it.isModal && !it.hidesBottomBar) }
    }

    @Test
    fun launchKeysMatchLaunchTargetTabs() {
        assertEquals(ShellTab.Today, ShellTab.fromLaunchKey("today"))
        assertEquals(ShellTab.Names, ShellTab.fromLaunchKey("names"))
        assertEquals(ShellTab.Research, ShellTab.fromLaunchKey(" Research "))
        assertEquals(ShellTab.Inbox, ShellTab.fromLaunchKey("inbox"))
        assertNull(ShellTab.fromLaunchKey("you"))
    }
}
