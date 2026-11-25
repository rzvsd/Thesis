package com.thesis.mobile.ui.shell

import com.thesis.mobile.ui.navigation.Destination
import org.junit.Assert.assertEquals
import org.junit.Test

class DeepDiveBuildGateTest {

    @Test
    fun nothingBuildingStartsTheRequestedName() {
        assertEquals(
            DeepDiveStartDecision.Start("AAPL"),
            decideDeepDiveStart(" aapl ", isRunning = false, runningTicker = "MSFT", top = Destination.Research)
        )
    }

    @Test
    fun aDoubleTapDuringThePushDoesNothing() {
        assertEquals(
            DeepDiveStartDecision.ShowRunning("AAPL", alreadyShowing = true, replaceTop = false, message = null),
            decideDeepDiveStart("AAPL", isRunning = true, runningTicker = "AAPL", top = Destination.DeepDiveRunning("AAPL"))
        )
    }

    @Test
    fun theSameNameFromElsewherePushesItsRunningEntryAgain() {
        assertEquals(
            DeepDiveStartDecision.ShowRunning("AAPL", alreadyShowing = false, replaceTop = false, message = null),
            decideDeepDiveStart("aapl", isRunning = true, runningTicker = "AAPL", top = Destination.Name("AAPL"))
        )
    }

    @Test
    fun anotherNameShowsTheRunningBuildAndSaysWhy() {
        assertEquals(
            DeepDiveStartDecision.ShowRunning(
                "AAPL",
                alreadyShowing = false,
                replaceTop = false,
                message = "The AAPL Deep Dive is still building. Start MSFT when it is ready."
            ),
            decideDeepDiveStart("MSFT", isRunning = true, runningTicker = "AAPL", top = Destination.Names)
        )
    }

    @Test
    fun aRetryOrLinkEntryForAnotherNameIsReplacedByTheRunningOne() {
        // A Retry on MSFT's failed entry, or a research link that just pushed DeepDiveRunning(MSFT), while AAPL builds:
        // that entry would otherwise say "no longer running" and offer a Retry that starts a second job.
        assertEquals(
            DeepDiveStartDecision.ShowRunning(
                "AAPL",
                alreadyShowing = false,
                replaceTop = true,
                message = stillBuildingMessage("AAPL", "MSFT")
            ),
            decideDeepDiveStart("MSFT", isRunning = true, runningTicker = "AAPL", top = Destination.DeepDiveRunning("MSFT"))
        )
    }

    @Test
    fun aRunningBuildWithNoKnownNameIsTreatedAsTheRequestedOne() {
        assertEquals(
            DeepDiveStartDecision.ShowRunning("NVDA", alreadyShowing = true, replaceTop = false, message = null),
            decideDeepDiveStart("nvda", isRunning = true, runningTicker = null, top = Destination.DeepDiveRunning("NVDA"))
        )
    }
}
