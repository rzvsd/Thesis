package com.thesis.mobile.preview

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.unit.dp
import com.thesis.mobile.model.NoteTrailEntry
import com.thesis.mobile.model.SearchResultsView
import com.thesis.mobile.preview.fixtures.NamesFixtures
import com.thesis.mobile.preview.fixtures.ShellFixtures
import com.thesis.mobile.ui.navigation.Destination
import com.thesis.mobile.ui.navigation.DestinationCodec
import com.thesis.mobile.ui.screens.NameAnchor
import com.thesis.mobile.ui.screens.NameScreen
import com.thesis.mobile.ui.shell.AppNavigator
import com.thesis.mobile.ui.shell.ShellActions
import com.thesis.mobile.ui.shell.ThesisShell
import com.thesis.mobile.ui.shell.noteEntryAnchor
import com.thesis.mobile.ui.shell.noteEntryOf
import com.thesis.mobile.ui.theme.ThemeMode
import com.thesis.mobile.ui.theme.ThesisTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * A note search hit lands on its own notes trail entry (5.27; PR-3 tracking list item 2): the anchor carries the
 * entry's key through the destination codec, and after navigation the matched entry is on screen, below the bar,
 * opened whole.
 */
class NoteHitTest {

    @get:Rule
    val rule = createComposeRule()

    /** The oldest AAPL note: far down the trail, past the first screen of the page. */
    private val oldest: NoteTrailEntry = NamesFixtures.notes.single { it.reportId == "rep-aapl-2025" }

    @Test
    fun theAnchorNamesTheEntryAndSurvivesTheSavedStack() {
        val anchor = noteEntryAnchor(oldest.reportId)
        val name = Destination.Name("AAPL", null, anchor)
        val decoded = DestinationCodec.decode(DestinationCodec.encode(name)) as Destination.Name
        assertEquals(oldest.reportId, noteEntryOf(decoded.anchor))
        assertNull(noteEntryOf(Destination.Name.ANCHOR_NOTES))
        assertNull(noteEntryOf(Destination.Name.ANCHOR_CHANGES))
        assertNull(noteEntryOf(null))
    }

    private fun textNodes(text: String): List<SemanticsNode> =
        rule.onAllNodesWithText(text, substring = true, useUnmergedTree = true).fetchSemanticsNodes()

    /**
     * The entry's note is right under the top bar: below it (readable) and within one entry header of it, so the page
     * opened at this entry, not at the section's top with the entry further down.
     */
    private fun assertOnScreenBelowTheBar(text: String, windowHeightPx: Float) {
        val node = textNodes(text).single()
        val top = node.boundsInRoot.top
        val barBottom = rule.density.run { 56.dp.toPx() }
        assertTrue("the entry starts at $top px, under the bar (bottom $barBottom px)", top >= barBottom - 1f)
        assertTrue("the entry starts at $top px, past the window ($windowHeightPx px)", top < windowHeightPx)
        // Right under the bar, unless the page ends first (it cannot scroll further: the entry is then lower down).
        val near = barBottom + rule.density.run { 96.dp.toPx() }
        val atEnd = rule.onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsProperties.VerticalScrollAxisRange)).fetchSemanticsNodes()
            .map { it.config[SemanticsProperties.VerticalScrollAxisRange] }
            .any { it.value() > 0f && it.value() >= it.maxValue() - 1f }
        assertTrue("the entry's note starts at $top px, not right under the bar (by $near px), page not at its end", top <= near || atEnd)
    }

    @Test
    fun nameOpensAtTheMatchedEntryNotTheSectionTop() {
        rule.setContent {
            ThesisTheme(mode = ThemeMode.Light) {
                Box(Modifier.size(412.dp, 915.dp)) {
                    NamesFixtures.Clocked {
                        NameScreen(
                            padding = androidx.compose.foundation.layout.PaddingValues(), ticker = "AAPL", detail = NamesFixtures.detail, following = true,
                            companyName = NamesFixtures.companyNames["AAPL"], now = NamesFixtures.now,
                            scrollTo = NameAnchor.Notes, noteKey = oldest.reportId, onBack = {},
                        )
                    }
                }
            }
        }
        rule.mainClock.advanceTimeBy(2_000)
        rule.waitForIdle()
        assertOnScreenBelowTheBar(oldest.text, rule.density.run { 915.dp.toPx() })
    }

    @Test
    fun aSearchHitOpensNameOnItsEntry() {
        val navigator = AppNavigator()
        val state = ShellFixtures.state.copy(
            nameDetail = NamesFixtures.detail,
            allNotes = NamesFixtures.notes,
            searchResults = SearchResultsView(query = "China unit", notes = listOf(oldest)),
        )
        val actions = object : ShellActions {
            override fun onBack(): Boolean = navigator.back()
            override fun onOpenNameIn(ticker: String, pagerScope: String?, anchor: String?) {
                // As MainViewModel: close the modal stack, push Name on the tab under it.
                navigator.closeModals()
                navigator.push(Destination.Name(ticker, pagerScope, anchor))
            }
        }
        rule.setContent {
            ThesisTheme(mode = ThemeMode.Light) {
                Box(Modifier.size(412.dp, 915.dp)) {
                    ThesisShell(state = state, navigator = navigator, actions = actions, snackbarHostState = remember { SnackbarHostState() })
                }
            }
        }
        rule.runOnIdle { navigator.openModal(Destination.Search) }
        rule.waitForIdle()
        rule.onAllNodes(hasSetTextAction()).onFirst().performTextReplacement("China unit")
        rule.mainClock.advanceTimeBy(1_000)
        rule.waitForIdle()
        // The hit's excerpt starts at the matched words.
        rule.onNode(hasText("China unit", substring = true) and hasClickAction() and !hasSetTextAction()).performClick()
        rule.mainClock.advanceTimeBy(3_000)
        rule.waitForIdle()
        val top = navigator.tabTop.destination as Destination.Name
        assertEquals(oldest.reportId, noteEntryOf(top.anchor))
        assertOnScreenBelowTheBar(oldest.text, rule.density.run { 915.dp.toPx() })
    }
}
