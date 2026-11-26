package com.thesis.mobile.preview

import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.IssuerView
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.model.ScenarioStressTemplateView
import com.thesis.mobile.model.SectionView
import com.thesis.mobile.model.WarRoomView
import com.thesis.mobile.preview.fixtures.ShellFixtures
import com.thesis.mobile.ui.UiState
import com.thesis.mobile.ui.components.showThesisSnackbar
import com.thesis.mobile.ui.navigation.Destination
import com.thesis.mobile.ui.navigation.ShellTab
import com.thesis.mobile.ui.screens.AuthScreen
import com.thesis.mobile.ui.shell.AppearancePrefs
import com.thesis.mobile.ui.shell.ShellActions
import com.thesis.mobile.ui.shell.ThesisShell
import com.thesis.mobile.ui.theme.ThemeMode
import com.thesis.mobile.ui.theme.UpDownScheme
import kotlinx.coroutines.delay
import org.junit.Assert.assertEquals
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
        snackbar: String? = null,
        snackbarAction: String? = null
    ) {
        // Per rendered scene (one per theme): the message on the host at the last composition before the capture.
        val onHost = mutableListOf<String?>()
        val files = renderScreen(name, widthDp = widthDp, heightDp = heightDp) {
            val density = LocalDensity.current
            val host = remember { SnackbarHostState() }
            if (snackbar != null) {
                LaunchedEffect(Unit) { host.showThesisSnackbar(snackbar, snackbarAction) }
                val slot = remember { onHost.add(null); onHost.lastIndex }
                val message = host.currentSnackbarData?.visuals?.message
                SideEffect { onHost[slot] = message }
            }
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
        // A render named "...snackbar..." must show its snackbar: fail rather than capture a frame without it.
        if (snackbar != null) {
            onHost.forEachIndexed { i, shown -> assertEquals("$name scene $i: snackbar on the host at capture", snackbar, shown) }
        }
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

    /** You > Appearance with stored choices (spec Q2): Light, colour-blind colours and Reduce motion on. */
    @Test fun youAppearanceChosen() = shell(
        "shell-you-appearance", ShellTab.Names, modal = Destination.You,
        state = ShellFixtures.state.copy(
            appearance = AppearancePrefs(themeMode = ThemeMode.Light, upDown = UpDownScheme.ColourBlind, reduceMotion = true)
        )
    )

    /** Rule 6.0.6 for the Appearance controls: segment labels and switch rows at 360 dp x 2.0. */
    @Test fun you360Scale20() = shell(
        "shell-you-360-scale2.0", ShellTab.Names, modal = Destination.You, fontScale = 2.0f, widthDp = 360
    )

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

    /**
     * "Deep Dive ready." after the user backed out of the build: the snackbar offers Open (MessageAction.OpenReport),
     * since no running entry became the report.
     */
    @Test fun snackbarWithOpen() = shell(
        "shell-research-snackbar-open", ShellTab.Research, snackbar = "Deep Dive ready.", snackbarAction = "Open"
    )

    /** More than three reports: "See all" under the three recent cards opens History (interim for 5.12). */
    @Test fun researchSeeAll() = shell(
        "shell-research-see-all", ShellTab.Research,
        state = ShellFixtures.state.copy(
            reportHistory = listOf("AAPL", "MSFT", "NVDA", "AMD", "TSM").mapIndexed { i, t ->
                ReportHistoryItem("rep-$t", "j$i", "deep_dive", t, "2026-11-${(20 - i * 3).toString().padStart(2, '0')}T10:00:00Z")
            }
        )
    )

    /** An alert whose route only lands back on Inbox has no "Open" (DeepLinkRouter.alertHasDestination, 5.5). */
    @Test fun inboxUnknownRoute() = shell(
        "shell-inbox-unknown-route", ShellTab.Inbox,
        state = ShellFixtures.state.copy(
            alertLedger = listOf(
                ShellFixtures.state.alertLedger.first().copy(
                    id = "al9", route = "something_new", title = "A new kind of alert", createdAt = "2026-11-24T07:30:00Z"
                )
            ) + ShellFixtures.state.alertLedger
        )
    )

    /** A failed report open elsewhere leaves the Research root's field and recent list in place. */
    @Test fun researchRootWithReportError() = shell(
        "shell-research-root-error", ShellTab.Research,
        state = ShellFixtures.state.copy(deepDiveError = "Couldn't open this report. Check your connection.")
    )

    private val warRoomState = ShellFixtures.state.copy(
        warRoom = WarRoomView(
            warRoomId = "wr-aapl", title = "AAPL earnings", ticker = "AAPL", status = "active",
            generatedAt = "2026-11-24T06:00:00Z", summary = "Services margin is the line to watch."
        )
    )

    /** War Room: the back bar has no title over the screen's own "War Room" headline (rubric V3). */
    @Test fun warRoom() = shell("shell-warroom", ShellTab.Names, push = Destination.WarRoom("wr-aapl"), state = warRoomState)

    // Rule 6.0.6 and the 6.1 type-remap check: the pushed screens with data at 360 dp x 2.0, tall enough to show
    // their whole first screens. No-data states are in ScreenSmokeRenders; restyles are PR-3's (each WP re-renders).
    // What these show at 2.0x (legacy screen bodies, for the PR-3 screen WPs; the shell chrome holds):
    // - classic report: the POSITIVE / FOLLOWED badges beside the title stack one letter per line, and the
    //   CONFIDENCE / FRESHNESS tiles break mid-word;
    // - War Room: the "Status: ACTIVE" chip breaks mid-word;
    // - Weekly digest: the "MSFT · Watch" chip wraps; Scenario Stress: "Refresh templates" wraps (readable).
    // History has no clipping.
    private val scenarioState = ShellFixtures.state.copy(
        scenarioStressTemplates = listOf(
            ScenarioStressTemplateView(
                "rates-up", "Rates up 100 bp", "Long yields rise a full point in a quarter.",
                "Higher discount rates compress long-duration growth multiples.", true,
                "2026-11-01T00:00:00Z", "2026-11-01T00:00:00Z"
            ),
            ScenarioStressTemplateView(
                "china-demand", "China demand slump", "Mainland consumer spending falls for two quarters.",
                "Hardware names with high China revenue share miss guidance.", true,
                "2026-11-01T00:00:00Z", "2026-11-01T00:00:00Z"
            ),
        ),
        selectedScenarioStressId = "rates-up"
    )
    private val classicReportState = ShellFixtures.state.copy(
        deepDiveReport = DeepDiveReportView(
            reportId = "rep-AAPL", ticker = "AAPL", generatedAt = "2026-11-20T14:00:00Z",
            issuer = IssuerView(name = "Apple Inc.", exchange = "NASDAQ"),
            thesisStatement = "Services keep growing faster than hardware, so margins hold up through the cycle.",
            signalValue = "positive", confidenceLabel = "medium", confidenceScore = 0.7,
            sections = listOf(
                SectionView(sectionId = "summary", title = "Summary", body = "Revenue grew 6% on Services."),
                SectionView(sectionId = "risks", title = "Risks", body = "China demand and App Store rules."),
            ),
        )
    )

    private fun scale20(name: String, tab: ShellTab, push: Destination, state: UiState = ShellFixtures.state) =
        shell(name, tab, push = push, state = state, fontScale = 2.0f, widthDp = 360, heightDp = 1800)

    @Test fun history360Scale20() = scale20("shell-today-history-360-scale2.0", ShellTab.Today, Destination.History())
    @Test fun warRoom360Scale20() =
        scale20("shell-warroom-360-scale2.0", ShellTab.Names, Destination.WarRoom("wr-aapl"), warRoomState)
    @Test fun scenarioStress360Scale20() =
        scale20("shell-research-scenario-360-scale2.0", ShellTab.Research, Destination.ScenarioStress(), scenarioState)
    @Test fun weeklyDigest360Scale20() =
        scale20("shell-today-digest-360-scale2.0", ShellTab.Today, Destination.WeeklyDigest("2026-11-23"))
    @Test fun reportClassic360Scale20() = scale20(
        "shell-research-report-classic-360-scale2.0", ShellTab.Research,
        Destination.ReportClassic("rep-AAPL", "AAPL"), classicReportState
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
