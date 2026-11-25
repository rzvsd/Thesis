package com.thesis.mobile.ui.shell

import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.ui.UiState
import com.thesis.mobile.ui.navigation.Destination
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Which bar the shell draws (5.5, 5.14): every state without a bar of its own still has a way back on screen. */
class ShellTopBarTest {

    private val idle = UiState()
    private val loaded = UiState(
        deepDiveReport = DeepDiveReportView(
            reportId = "rep-1", ticker = "AAPL", signalValue = null,
            confidenceLabel = null, confidenceScore = null, sections = emptyList()
        )
    )

    @Test
    fun tabRootsGetTheRootBar() {
        listOf(Destination.Today, Destination.Names, Destination.Research, Destination.Inbox).forEach {
            assertEquals(ShellTopBar.Root, topBarFor(it, idle))
        }
    }

    @Test
    fun aRunningBuildHasABackBar() {
        assertEquals(ShellTopBar.Back, topBarFor(Destination.DeepDiveRunning("AAPL"), idle))
        assertEquals(ShellTopBar.Back, topBarFor(Destination.DeepDiveRunning("AAPL"), idle.copy(isDeepDiveRunning = true)))
    }

    @Test
    fun aReportHasABackBarUntilItIsLoaded() {
        assertEquals(ShellTopBar.Back, topBarFor(Destination.Report("rep-1"), idle))
        assertEquals(ShellTopBar.Back, topBarFor(Destination.Report("rep-1"), idle.copy(deepDiveError = "failed")))
        assertEquals(ShellTopBar.Back, topBarFor(Destination.Report("rep-2"), loaded))
        assertEquals(ShellTopBar.None, topBarFor(Destination.Report("rep-1"), loaded))
        assertEquals(ShellTopBar.Back, topBarFor(Destination.ReportClassic("rep-1"), idle))
        assertEquals(ShellTopBar.None, topBarFor(Destination.ReportClassic("rep-1"), loaded))
    }

    @Test
    fun screensWithTheirOwnHeaderGetNoBar() {
        assertEquals(ShellTopBar.None, topBarFor(Destination.Pulse(), idle))
        assertEquals(ShellTopBar.None, topBarFor(Destination.History(), idle))
        assertEquals(ShellTopBar.None, topBarFor(Destination.MacroStress, idle))
    }

    @Test
    fun theNamePlaceholderDoesNotRepeatItsHeadlineInTheBar() {
        assertEquals("", titleOf(Destination.Name("AAPL"), idle))
    }

    @Test
    fun scenarioStressDoesNotRepeatItsHeadlineInTheBar() {
        // The screen's own headline is "Scenario Stress" (Phase4Copy.researchStressHeadline).
        assertEquals("", titleOf(Destination.ScenarioStress(), idle))
    }

    @Test
    fun eachRootBarShowsOnlyItsOwnTabsRefresh() {
        assertTrue(rootRefreshing(Destination.Today, idle.copy(isPulseRefreshing = true)))
        assertTrue(rootRefreshing(Destination.Today, idle.copy(isMacroRefreshing = true)))
        assertTrue(rootRefreshing(Destination.Names, idle.copy(isBoardRefreshing = true)))
        assertTrue(rootRefreshing(Destination.Research, idle.copy(isHistoryLoading = true)))
        assertTrue(rootRefreshing(Destination.Inbox, idle.copy(isInboxRefreshing = true)))
        assertFalse(rootRefreshing(Destination.Inbox, idle.copy(isBoardRefreshing = true)))
        assertFalse(rootRefreshing(Destination.Names, idle))
        // Pushed screens have no root bar; their own refresh signals land with their screens in PR-3.
        assertFalse(rootRefreshing(Destination.Pulse(), idle.copy(isPulseRefreshing = true)))
    }
}
