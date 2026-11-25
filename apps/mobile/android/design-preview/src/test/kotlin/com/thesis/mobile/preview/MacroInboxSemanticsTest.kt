package com.thesis.mobile.preview

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.hasScrollToNodeAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToNode
import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.preview.fixtures.MacroInboxFixtures
import com.thesis.mobile.ui.copy.InboxCopy
import com.thesis.mobile.ui.copy.MacroStressCopy
import com.thesis.mobile.ui.format.LocalFmt
import com.thesis.mobile.ui.screens.InboxScreen
import com.thesis.mobile.ui.screens.MacroStressScreen
import com.thesis.mobile.ui.theme.ThemeMode
import com.thesis.mobile.ui.theme.ThesisTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * WP-F semantics (section 6.0 rule 7): touch targets, headings, selected chips and segments, live regions, the
 * swipe's accessibility action with its Undo, routing, and an action error that leaves the list in place.
 */
class MacroInboxSemanticsTest {

    @get:Rule
    val rule = createComposeRule()

    private val alerts = MacroInboxFixtures.alerts
    private val drift = alerts.first { it.id == "a1" }
    private val earnings = alerts.first { it.id == "a2" }

    private class Calls {
        val quiet = mutableListOf<String>()
        val disabled = mutableListOf<String>()
        val feedback = mutableListOf<Pair<String, String>>()
        val names = mutableListOf<String>()
        val warRooms = mutableListOf<String>()
        val opened = mutableListOf<String>()
        var markedSeen = 0
        var refreshed = 0
    }

    private fun setInbox(
        calls: Calls = Calls(),
        list: List<AlertLedgerItemView> = alerts,
        error: () -> String? = { null },
        expanded: String? = null,
        host: SnackbarHostState? = null,
    ): Calls {
        rule.setContent {
            Fixed {
                InboxScreen(
                    padding = PaddingValues(),
                    alerts = list,
                    inboxError = error(),
                    onRefresh = { calls.refreshed++ },
                    onOpenAlert = { calls.opened += it.id },
                    onUnlockDetail = {},
                    onSubmitFeedback = { id, value -> calls.feedback += id to value },
                    onQuietAlertType = { calls.quiet += it },
                    onDisableAlertType = { calls.disabled += it },
                    lastInboxVisitAtMs = MacroInboxFixtures.lastVisitAtMs,
                    onMarkAllSeen = { calls.markedSeen++ },
                    onOpenName = { calls.names += "name:$it" },
                    onOpenNameAtChanges = { calls.names += it },
                    onOpenWarRoom = { calls.warRooms += it },
                    initialExpandedId = expanded,
                    snackbarHostState = host,
                    clock = MacroInboxFixtures.clock,
                )
            }
        }
        return calls
    }

    @Composable
    private fun Fixed(content: @Composable () -> Unit) {
        ThesisTheme(mode = ThemeMode.Light) {
            CompositionLocalProvider(LocalFmt provides MacroInboxFixtures.fmt, content = content)
        }
    }

    // ---- Inbox

    @Test
    fun `inbox title and day headers are headings, and every target is 48 dp`() {
        setInbox(expanded = drift.id)
        rule.onNodeWithText(InboxCopy.TITLE).assertIsHeading()
        rule.onNodeWithText(InboxCopy.TODAY, ignoreCase = true).assertIsHeading()
        rule.assertAllTouchTargetsAtLeast()
    }

    @Test
    fun `category chips filter by key and show the selection`() {
        setInbox()
        val earningsChip = rule.onNodeWithText("Earnings", substring = true)
        earningsChip.assertIsNotSelected().performClick()
        rule.waitForIdle()
        earningsChip.assertIsSelected()
        rule.onNodeWithText(earnings.title).assertExists()
        rule.onNodeWithText(drift.title).assertDoesNotExist()
        rule.onNodeWithText("All", substring = true).performClick()
        rule.onNodeWithText(drift.title).assertExists()
    }

    @Test
    fun `mark all as seen is offered while there are new alerts`() {
        val calls = setInbox()
        rule.onNodeWithText("3 new alerts since your last visit").assertIsDisplayed()
        rule.onNodeWithText(InboxCopy.MARK_ALL_SEEN).performClick()
        assertEquals(1, calls.markedSeen)
    }

    @Test
    fun `a thesis drift alert opens the Name at its changes`() {
        val calls = setInbox()
        rule.onNodeWithText(drift.title).performClick()
        rule.onNodeWithText("Open NVDA").performClick()
        assertEquals(listOf("NVDA"), calls.names)
        assertTrue(calls.opened.isEmpty())
    }

    @Test
    fun `an earnings alert with a War Room opens the War Room`() {
        val calls = setInbox(expanded = earnings.id)
        rule.onNodeWithText(InboxCopy.OPEN_WAR_ROOM).performClick()
        assertEquals(listOf("wr-aapl"), calls.warRooms)
    }

    @Test
    fun `feedback chips are single-select radio buttons and keep the choice`() {
        val calls = setInbox(expanded = drift.id)
        val useful = rule.onNodeWithText(InboxCopy.USEFUL)
        useful.assertRole(Role.RadioButton).assertIsNotSelected().performClick()
        rule.waitForIdle()
        useful.assertIsSelected()
        rule.onNodeWithText(InboxCopy.NOT_USEFUL).assertIsNotSelected()
        // A second tap on the chosen answer sends nothing.
        useful.performClick()
        assertEquals(listOf(drift.id to "useful"), calls.feedback)
    }

    @Test
    fun `quiet is an accessibility action with an Undo that sends nothing`() {
        // The shell's host: the test reads and answers its snackbar directly.
        val host = SnackbarHostState()
        val calls = setInbox(host = host)
        rule.quietAction(drift.title)
        rule.waitForIdle()
        assertEquals(InboxCopy.QUIETED, host.currentSnackbarData?.visuals?.message)
        assertEquals(InboxCopy.UNDO, host.currentSnackbarData?.visuals?.actionLabel)
        assertTrue("the mute waits for the snackbar", calls.quiet.isEmpty())
        rule.runOnIdle { host.currentSnackbarData!!.performAction() }
        rule.waitForIdle()
        rule.onNodeWithText(drift.title).assertIsDisplayed()
        assertTrue("Undo never mutes", calls.quiet.isEmpty())
    }

    @Test
    fun `quiet without Undo mutes once the snackbar goes, and the row leaves the list`() {
        val host = SnackbarHostState()
        val calls = setInbox(host = host)
        rule.quietAction(drift.title)
        rule.waitForIdle()
        rule.runOnIdle { host.currentSnackbarData!!.dismiss() }
        rule.waitForIdle()
        assertEquals(listOf(drift.id), calls.quiet)
        rule.onNodeWithText(drift.title).assertDoesNotExist()
        rule.onAllNodes(hasScrollToNodeAction()).onFirst().performScrollToNode(hasText("2 quiet alerts hidden"))
    }

    @Test
    fun `the screen's own snackbar shows the quiet with Undo`() {
        setInbox()
        rule.mainClock.autoAdvance = false
        rule.quietAction(drift.title)
        rule.mainClock.advanceTimeBy(SETTLE_MS)
        rule.onNodeWithText(InboxCopy.QUIETED).assertExists()
        rule.onNodeWithText(InboxCopy.UNDO).assertExists()
    }

    @Test
    fun `turning a type off asks first, then offers Undo`() {
        val host = SnackbarHostState()
        val calls = setInbox(expanded = earnings.id, host = host)
        rule.onNodeWithContentDescription(InboxCopy.MORE_ACTIONS).performClick()
        rule.onNodeWithText(InboxCopy.TURN_OFF_TYPE).performClick()
        rule.onNodeWithText(InboxCopy.turnOffTitle("Earnings preview")).assertExists()
        rule.onNodeWithText(InboxCopy.TURN_OFF_CONFIRM).performClick()
        rule.waitForIdle()
        assertEquals(InboxCopy.turnedOff("Earnings preview"), host.currentSnackbarData?.visuals?.message)
        assertTrue(calls.disabled.isEmpty())
        rule.runOnIdle { host.currentSnackbarData!!.dismiss() }
        rule.waitForIdle()
        assertEquals(listOf("earnings_preview"), calls.disabled)
    }

    @Test
    fun `an action error leaves the list visible`() {
        var error by mutableStateOf<String?>(null)
        setInbox(error = { error })
        rule.onNodeWithText(drift.title).assertExists()
        error = "Couldn’t save your feedback."
        rule.waitForIdle()
        rule.onNodeWithText(drift.title).assertExists()
        rule.onAllNodesWithText("Couldn’t load", substring = true).assertCountEquals(0)
    }

    @Test
    fun `a load error with nothing to show is a live region with a retry`() {
        val calls = setInbox(list = emptyList(), error = { "The Inbox service did not answer." })
        rule.onNodeWithText("The Inbox service did not answer.", substring = true).assertExists()
        rule.onNodeWithText("Try again").performClick()
        assertEquals(1, calls.refreshed)
        rule.onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsProperties.LiveRegion))
            .onFirst().assertExists()
    }

    @Test
    fun `no alerts reads the empty sentence`() {
        setInbox(list = emptyList())
        rule.onNodeWithText(InboxCopy.EMPTY).assertExists()
        rule.onNodeWithText(InboxCopy.EMPTY_HOW).assertExists()
    }

    // ---- Macro Stress

    private fun setMacro(onRange: (Int) -> Unit = {}) {
        rule.setContent {
            Fixed {
                MacroStressScreen(
                    current = MacroInboxFixtures.macroCurrent,
                    history = MacroInboxFixtures.macroHistory,
                    selectedRangeDays = 30,
                    sentimentError = null,
                    onSelectRange = onRange,
                    onBack = {},
                )
            }
        }
    }

    @Test
    fun `macro title is a heading, the range segment is selected, targets are 48 dp`() {
        setMacro()
        rule.onNodeWithText("Stress is Balanced", substring = true).assertIsHeading()
        rule.onNodeWithText("30D").assertIsSelected()
        rule.onNodeWithText("90D").assertIsNotSelected()
        rule.assertAllTouchTargetsAtLeast()
    }

    @Test
    fun `selecting a range asks for it`() {
        val asked = mutableListOf<Int>()
        setMacro { asked += it }
        rule.onNodeWithText("90D").performClick()
        assertEquals(listOf(90), asked)
    }

    @Test
    fun `the header sentence and the factor headline read from the data`() {
        setMacro()
        rule.onNodeWithText("Stress is Balanced", substring = true).assertExists()
        rule.onNodeWithText("Treasury 10-year yield did most of the rise").assertExists()
        rule.onNodeWithText(MacroStressCopy.MISSING_TITLE).assertExists()
    }

    @Test
    fun `how to read this expands in place`() {
        setMacro()
        rule.onNodeWithText(MacroStressCopy.HOW_BODY).assertDoesNotExist()
        rule.onNodeWithText(MacroStressCopy.HOW_TITLE).performScrollTo().performClick()
        rule.waitForIdle()
        rule.onNodeWithText(MacroStressCopy.HOW_BODY).assertExists()
    }

    private companion object {
        /** Past the row's collapse or expand and the snackbar's rise. */
        const val SETTLE_MS = 600L
    }
}

/** Runs the "Quiet for 24 hours" accessibility action of the row titled [title]. */
private fun androidx.compose.ui.test.junit4.ComposeContentTestRule.quietAction(title: String) {
    val node = quietActionNode(title)
    runOnUiThread { node.config[SemanticsActions.CustomActions].first { it.label == InboxCopy.QUIET_24H }.action() }
}

/** The node carrying the "Quiet for 24 hours" accessibility action (SwipeToQuiet) around the row titled [title]. */
internal fun androidx.compose.ui.test.SemanticsNodeInteractionsProvider.quietActionNode(title: String): SemanticsNode {
    val nodes = onAllNodes(
        SemanticsMatcher("quiet action") { n ->
            n.config.getOrElseNullable(SemanticsActions.CustomActions) { null }.orEmpty().any { it.label == InboxCopy.QUIET_24H }
        },
        useUnmergedTree = true,
    ).fetchSemanticsNodes()
    return nodes.firstOrNull { n -> descendantsText(n).any { it == title } }
        ?: error("No quiet action on \"$title\" (${nodes.size} nodes carry one)")
}

private fun descendantsText(n: SemanticsNode): List<String> =
    n.config.getOrElseNullable(SemanticsProperties.Text) { null }.orEmpty().map { it.text } +
        n.children.flatMap { descendantsText(it) }
