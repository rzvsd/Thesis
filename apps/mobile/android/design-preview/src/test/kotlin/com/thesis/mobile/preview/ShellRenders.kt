package com.thesis.mobile.preview

import com.thesis.mobile.preview.fixtures.ShellFixtures
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

    private fun shell(name: String, tab: ShellTab, push: Destination? = null, modal: Destination? = null) {
        val files = renderScreen(name) {
            ThesisShell(
                state = ShellFixtures.state,
                navigator = ShellFixtures.navigator(tab, push, modal),
                actions = actions
            )
        }
        files.forEach { assertTrue("${it.name} was not written", it.isFile && it.length() > 0) }
    }

    @Test fun today() = shell("shell-today", ShellTab.Today)
    @Test fun names() = shell("shell-names", ShellTab.Names)
    @Test fun research() = shell("shell-research", ShellTab.Research)
    @Test fun inbox() = shell("shell-inbox", ShellTab.Inbox)
    @Test fun pulsePushed() = shell("shell-today-pulse", ShellTab.Today, push = Destination.Pulse())
    @Test fun historyPushed() = shell("shell-today-history", ShellTab.Today, push = Destination.History())
    @Test fun deepDiveRunning() = shell("shell-research-running", ShellTab.Research, push = Destination.DeepDiveRunning("AAPL"))
    @Test fun youModal() = shell("shell-you", ShellTab.Names, modal = Destination.You)
}
