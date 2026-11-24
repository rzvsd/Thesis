package com.thesis.mobile.preview

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import com.thesis.mobile.preview.fixtures.ShellFixtures
import com.thesis.mobile.ui.UiState
import com.thesis.mobile.ui.navigation.Destination
import com.thesis.mobile.ui.navigation.ShellTab
import com.thesis.mobile.ui.shell.ShellActions
import com.thesis.mobile.ui.shell.ThesisShell
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * `ThesisShell` with fixture state (F3 acceptance: "renders in design-preview with fixture state for each tab").
 * The Android-only slots (sample report, macro dashboard, delete account) draw nothing here.
 */
class ShellRenders {

    private val actions = object : ShellActions {}

    private fun shell(
        name: String,
        tab: ShellTab,
        push: Destination? = null,
        modal: Destination? = null,
        state: UiState = ShellFixtures.state,
        fontScale: Float = 1f,
        widthDp: Int = PhoneSpec.WIDTH_DP
    ) {
        val files = renderScreen(name, widthDp = widthDp) {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale)) {
                ThesisShell(
                    state = state,
                    navigator = ShellFixtures.navigator(tab, push, modal),
                    actions = actions
                )
            }
        }
        files.forEach { assertTrue("${it.name} was not written", it.isFile && it.length() > 0) }
    }

    @Test fun today() = shell("shell-today", ShellTab.Today)
    @Test fun names() = shell("shell-names", ShellTab.Names)
    @Test fun research() = shell("shell-research", ShellTab.Research)
    @Test fun inbox() = shell("shell-inbox", ShellTab.Inbox)
    @Test fun pulsePushed() = shell("shell-today-pulse", ShellTab.Today, push = Destination.Pulse())
    @Test fun historyPushed() = shell("shell-today-history", ShellTab.Today, push = Destination.History())

    /** A build in flight: loading screen under a back bar (5.14), no bottom bar. */
    @Test fun deepDiveRunning() = shell(
        "shell-research-running", ShellTab.Research, push = Destination.DeepDiveRunning("AAPL"),
        state = ShellFixtures.state.copy(isDeepDiveRunning = true, jobStatus = "running")
    )

    /** The same entry restored after the job ended: the search, not an endless spinner. */
    @Test fun deepDiveRunningEnded() = shell(
        "shell-research-running-ended", ShellTab.Research, push = Destination.DeepDiveRunning("AAPL")
    )

    /** A report entry whose report failed to open: error card under a back bar. */
    @Test fun reportOpenFailed() = shell(
        "shell-report-failed", ShellTab.Research, push = Destination.Report("rep-missing"),
        state = ShellFixtures.state.copy(deepDiveError = "Couldn't open this report. Check your connection.")
    )

    @Test fun youModal() = shell("shell-you", ShellTab.Names, modal = Destination.You)

    // Rubric A4: the bottom bar at 1.3x and 2.0x font scale, and at 360 dp.
    @Test fun inboxScale13() = shell("shell-inbox-scale1.3", ShellTab.Inbox, fontScale = 1.3f)
    @Test fun inboxScale20() = shell("shell-inbox-scale2.0", ShellTab.Inbox, fontScale = 2.0f)
    @Test fun inbox360Scale20() = shell("shell-inbox-360-scale2.0", ShellTab.Inbox, fontScale = 2.0f, widthDp = 360)
}
