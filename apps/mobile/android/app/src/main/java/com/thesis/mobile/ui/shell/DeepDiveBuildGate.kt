package com.thesis.mobile.ui.shell

import com.thesis.mobile.ui.navigation.Destination

/**
 * What a request to build a Deep Dive should do. The app follows one build at a time: `MainViewModel` polls a
 * single job, and the `DeepDiveRunning` entry reads one shared build state. So while a build runs, a second
 * request (a double tap during the push, a Run on another tab after backing out of the running screen, a
 * research link, a Retry) shows the running build instead of starting another.
 */
sealed interface DeepDiveStartDecision {
    /** Nothing is building: start [ticker]'s build and show its running entry. */
    data class Start(val ticker: String) : DeepDiveStartDecision

    /**
     * A build is running: show [runningTicker]'s entry. [replaceTop] when the screen already shows a
     * `DeepDiveRunning` entry for another name (a failed one, or the one a link just pushed), which it replaces;
     * otherwise its entry is pushed, unless it is already on screen ([alreadyShowing]). [message] is set when the
     * request was for another name, to say why that name did not start.
     */
    data class ShowRunning(
        val runningTicker: String,
        val alreadyShowing: Boolean,
        val replaceTop: Boolean,
        val message: String?
    ) : DeepDiveStartDecision
}

/**
 * Decides what a request to build [requested] does, given the build state and [top], the entry on screen in the
 * tab layer (modals are closed before a build is shown). Pure, so `DeepDiveBuildGateTest` covers it.
 */
fun decideDeepDiveStart(
    requested: String,
    isRunning: Boolean,
    runningTicker: String?,
    top: Destination
): DeepDiveStartDecision {
    val symbol = requested.trim().uppercase()
    if (!isRunning) return DeepDiveStartDecision.Start(symbol)
    val running = runningTicker?.trim()?.uppercase()?.ifBlank { null } ?: symbol
    val topRunning = top as? Destination.DeepDiveRunning
    val alreadyShowing = topRunning?.ticker.equals(running, ignoreCase = true)
    return DeepDiveStartDecision.ShowRunning(
        runningTicker = running,
        alreadyShowing = alreadyShowing,
        replaceTop = topRunning != null && !alreadyShowing,
        message = if (running == symbol) null else stillBuildingMessage(running, symbol)
    )
}

internal fun stillBuildingMessage(running: String, requested: String): String =
    "The $running Deep Dive is still building. Start $requested when it is ready."
