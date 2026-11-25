package com.thesis.mobile.preview

import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import com.thesis.mobile.model.WarRoomView
import com.thesis.mobile.preview.fixtures.ShellFixtures
import com.thesis.mobile.ui.UiState
import com.thesis.mobile.ui.components.showThesisSnackbar
import com.thesis.mobile.ui.navigation.Destination
import com.thesis.mobile.ui.navigation.ShellTab
import com.thesis.mobile.ui.screens.AuthScreen
import com.thesis.mobile.ui.shell.ShellActions
import com.thesis.mobile.ui.shell.ThesisShell
import kotlinx.coroutines.delay
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
        widthDp: Int = PhoneSpec.WIDTH_DP,
        heightDp: Int = PhoneSpec.HEIGHT_DP,
        snackbar: String? = null
    ) {
        val files = renderScreen(name, widthDp = widthDp, heightDp = heightDp) {
            val density = LocalDensity.current
            val host = remember { SnackbarHostState() }
            if (snackbar != null) LaunchedEffect(Unit) { host.showThesisSnackbar(snackbar) }
            CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale)) {
                ThesisShell(
                    state = state,
                    navigator = ShellFixtures.navigator(tab, push, modal),
                    actions = actions,
                    snackbarHostState = host
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
        state = ShellFixtures.state.copy(isDeepDiveRunning = true, deepDiveBuildTicker = "AAPL", jobStatus = "running")
    )

    /**
     * Fallback only: MainViewModel removes a running entry restored with no job left (dropIdleRunningEntries).
     * Should one still show, it says the build is no longer running, with a retry, rather than an endless spinner.
     */
    @Test fun deepDiveRunningEnded() = shell(
        "shell-research-running-ended", ShellTab.Research, push = Destination.DeepDiveRunning("AAPL")
    )

    /**
     * The AAPL entry while another name's build runs (or failed): it shows neither MSFT's progress nor MSFT's
     * error, only that its own build is no longer running; its retry builds AAPL.
     */
    @Test fun deepDiveRunningOtherTicker() = shell(
        "shell-research-running-other", ShellTab.Research, push = Destination.DeepDiveRunning("AAPL"),
        state = ShellFixtures.state.copy(
            isDeepDiveRunning = false,
            deepDiveBuildTicker = "MSFT",
            deepDiveError = "MSFT Deep Dive failed."
        )
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

    // Rule 6.0.6: every tab root and a pushed screen at 360 dp x 2.0. The shell chrome holds; the screen bodies
    // under it are WP-A/WP-B's (HANDOFF-F3 section 4 lists what breaks).
    @Test fun today360Scale20() = shell("shell-today-360-scale2.0", ShellTab.Today, fontScale = 2.0f, widthDp = 360)
    @Test fun names360Scale20() = shell("shell-names-360-scale2.0", ShellTab.Names, fontScale = 2.0f, widthDp = 360)
    @Test fun research360Scale20() = shell("shell-research-360-scale2.0", ShellTab.Research, fontScale = 2.0f, widthDp = 360)
    @Test fun pulse360Scale20() = shell(
        "shell-today-pulse-360-scale2.0", ShellTab.Today, push = Destination.Pulse(), fontScale = 2.0f, widthDp = 360
    )

    /** Full page (rule 6.0.6): Today's whole scroll under the shell chrome. */
    @Test fun todayFullPage() = shell("shell-today-fullpage", ShellTab.Today, heightDp = 2400)

    /** A message raised while You is open shows above the modal (the host is the shell's top layer, 5.5). */
    @Test fun snackbarOverYou() = shell(
        "shell-you-snackbar", ShellTab.Names, modal = Destination.You, snackbar = "Notification preference saved."
    )

    /** Interim refresh signal: a 1 dp line on the root bar's bottom edge while the board refreshes. */
    @Test fun namesRefreshing() = shell(
        "shell-names-refreshing", ShellTab.Names, state = ShellFixtures.state.copy(isBoardRefreshing = true)
    )

    /** Scenario Stress: the back bar has no title over the screen's own "Scenario Stress" headline (rubric V3). */
    @Test fun scenarioStress() = shell("shell-research-scenario", ShellTab.Research, push = Destination.ScenarioStress())

    /** On a tab root the snackbar sits on the bottom bar, not under it. */
    @Test fun snackbarOverBar() = shell("shell-inbox-snackbar", ShellTab.Inbox, snackbar = "Deep Dive ready.")

    /** A failed report open elsewhere leaves the Research root's field and recent list in place. */
    @Test fun researchRootWithReportError() = shell(
        "shell-research-root-error", ShellTab.Research,
        state = ShellFixtures.state.copy(deepDiveError = "Couldn't open this report. Check your connection.")
    )

    /** War Room: the back bar has no title over the screen's own "War Room" headline (rubric V3). */
    @Test fun warRoom() = shell(
        "shell-warroom", ShellTab.Names, push = Destination.WarRoom("wr-aapl"),
        state = ShellFixtures.state.copy(
            warRoom = WarRoomView(
                warRoomId = "wr-aapl", title = "AAPL earnings", ticker = "AAPL", status = "active",
                generatedAt = "2026-11-24T06:00:00Z", summary = "Services margin is the line to watch."
            )
        )
    )

    /**
     * Mid-transition frames (principle 8, 4.5): each entry draws its own top bar, so on a push from a root (brand
     * bar) to Pulse (no bar) the brand bar slides out with Today and Today's content does not jump up; on a push to
     * a running build the bottom bar slides down and fades (3 #4) instead of vanishing.
     */
    @Test fun pushToPulse40ms() = transition("shell-transition-pulse-40ms", ShellTab.Today, Destination.Pulse(), 40)
    @Test fun pushToPulse120ms() = transition("shell-transition-pulse-120ms", ShellTab.Today, Destination.Pulse(), 120)
    @Test fun pushToRunning120ms() = transition(
        "shell-transition-running-120ms", ShellTab.Research, Destination.DeepDiveRunning("AAPL"), 120,
        state = ShellFixtures.state.copy(isDeepDiveRunning = true, deepDiveBuildTicker = "AAPL", jobStatus = "running")
    )

    private fun transition(name: String, tab: ShellTab, push: Destination, atMs: Long, state: UiState = ShellFixtures.state) {
        val pushAtMs = 96L
        val files = renderScreen(name, settleMs = pushAtMs + atMs, frameMs = 16, themes = listOf(PreviewTheme.DARK)) {
            val navigator = remember { ShellFixtures.navigator(tab) }
            LaunchedEffect(Unit) {
                delay(pushAtMs)
                navigator.push(push)
            }
            ThesisShell(state = state, navigator = navigator, actions = actions, snackbarHostState = remember { SnackbarHostState() })
        }
        files.forEach { assertTrue("${it.name} was not written", it.isFile && it.length() > 0) }
    }

    /** Auth, which F3 extracted from ThesisApp (ThesisApp adds the safeDrawing insets around it). */
    @Test fun auth() = authRender("shell-auth", 1f, PhoneSpec.WIDTH_DP)
    @Test fun auth360Scale20() = authRender("shell-auth-360-scale2.0", 2f, 360)

    private fun authRender(name: String, fontScale: Float, widthDp: Int) {
        val files = renderScreen(name, widthDp = widthDp) {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale)) {
                AuthScreen(
                    isLoading = false,
                    currentApiBaseUrl = "https://api.example.invalid",
                    verificationToken = null,
                    registerStatus = null,
                    message = null,
                    onSaveApiBaseUrl = {},
                    onRegister = { _, _ -> },
                    onVerify = { _, _ -> },
                    onLogin = { _, _ -> },
                    onForgotPassword = {}
                )
            }
        }
        files.forEach { assertTrue("${it.name} was not written", it.isFile && it.length() > 0) }
    }
}
