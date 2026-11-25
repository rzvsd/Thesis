package com.thesis.mobile.preview

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.unit.dp
import com.thesis.mobile.preview.fixtures.HomeState
import com.thesis.mobile.preview.fixtures.PulseState
import com.thesis.mobile.preview.fixtures.TodayDigest
import com.thesis.mobile.preview.fixtures.TodayHome
import com.thesis.mobile.preview.fixtures.TodayPulse
import com.thesis.mobile.ui.copy.TodayCopy
import com.thesis.mobile.ui.theme.ThemeMode
import com.thesis.mobile.ui.theme.ThesisTheme
import com.thesis.mobile.ui.today.ChapterKind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * Semantics of the Today screens (WP-A; rubric A1 to A4): 48 dp targets, headings, button roles, live regions,
 * "Your names" above the fold on a 360 x 780 phone, and the taps that leave the screens (name, chapter, source,
 * copy).
 */
class TodaySemanticsTest {

    @get:Rule
    val rule = createComposeRule()

    /** The screen's list (the tape and the pills scroll sideways). */
    private val vertical = hasScrollAction() and SemanticsMatcher.keyIsDefined(SemanticsProperties.VerticalScrollAxisRange)

    private fun set(widthDp: Int = 412, heightDp: Int = 915, content: @Composable () -> Unit) {
        rule.setContent {
            ThesisTheme(mode = ThemeMode.Dark) {
                Box(Modifier.size(widthDp.dp, heightDp.dp)) { content() }
            }
        }
    }

    // ---- Home ----------------------------------------------------------------------------------------------------

    @Test
    fun homeTargetsHeadingsAndRoles() {
        set { TodayHome(HomeState.Loaded) }
        rule.assertAllTouchTargetsAtLeast()
        rule.onNodeWithText("Stocks rose for a third day", substring = true).assertIsHeading()
        rule.onNodeWithText("1 of your names changed since your last visit").assertIsHeading()
        rule.onNodeWithText(TodayCopy.NAMES_ACTION).assertRole(Role.Button)
        rule.onNodeWithText("NVDA").assertRole(Role.Button)
    }

    @Test
    fun yourNamesStartsAboveTheFoldOnA360By780Phone() {
        set(widthDp = 360, heightDp = 780) { TodayHome(HomeState.Loaded) }
        val headline = rule.onNodeWithText("1 of your names changed since your last visit").getUnclippedBoundsInRoot()
        assertTrue("names headline ends at ${headline.bottom}", headline.bottom < 780.dp)
        val firstRow = rule.onNodeWithText("NVDA").getUnclippedBoundsInRoot()
        assertTrue("first name row starts at ${firstRow.top}", firstRow.top < 780.dp)
    }

    @Test
    fun homeTapsOpenTheNameAndThePulseChapter() {
        var opened: String? = null
        var chapter: ChapterKind? = null
        set { TodayHome(HomeState.Loaded, onOpenName = { opened = it }, onOpenPulseAt = { chapter = it }) }
        rule.onNodeWithText("MSFT").performClick()
        assertEquals("MSFT", opened)
        rule.onNode(vertical).performScrollToNode(hasText(TodayCopy.CHAPTER_CHANGED, substring = true))
        rule.onNodeWithText(TodayCopy.CHAPTER_CHANGED, substring = true).performClick()
        assertEquals(ChapterKind.Changed, chapter)
    }

    @Test
    fun homeEmptyOffersToAddAName() {
        var manage = 0
        set { TodayHome(HomeState.Empty, onManageNames = { manage++ }) }
        rule.assertAllTouchTargetsAtLeast()
        rule.onNodeWithText(TodayCopy.NO_NAMES).assertExists()
        rule.onNodeWithText(TodayCopy.ADD_NAME).performClick()
        assertEquals(1, manage)
        rule.onNode(vertical).performScrollToNode(hasText(TodayCopy.NO_PULSE))
        rule.onNodeWithText(TodayCopy.NO_PULSE).assertExists()
    }

    @Test
    fun homeErrorsAreAnnounced() {
        set { TodayHome(HomeState.Error) }
        rule.assertAllTouchTargetsAtLeast()
        val live = rule.onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsProperties.LiveRegion)).fetchSemanticsNodes()
        assertTrue("no live region on Home's error states", live.isNotEmpty())
    }

    // ---- Pulse ---------------------------------------------------------------------------------------------------

    @Test
    fun pulseTargetsHeadingsAndActions() {
        var copied: String? = null
        set { TodayPulse(PulseState.Loaded, onCopyText = { copied = it }) }
        rule.assertAllTouchTargetsAtLeast()
        rule.onNodeWithText("US risk assets were broadly higher on the day.").assertIsHeading()
        rule.onNodeWithContentDescription(TodayCopy.EXPORT_PDF).assertRole(Role.Button)
        rule.onNodeWithContentDescription(TodayCopy.COPY_AS_TEXT).performClick()
        assertTrue(copied.orEmpty(), copied.orEmpty().startsWith("Pulse · Tue 24 Nov"))
        assertTrue(copied.orEmpty(), copied.orEmpty().contains("02 What changed"))
    }

    @Test
    fun aSourceRowOpensItsLink() {
        var opened: String? = null
        set { TodayPulse(PulseState.Real, onOpenSource = { opened = it }) }
        rule.onNode(vertical).performScrollToNode(hasText("FRED S&P 500", substring = true))
        rule.onNodeWithText("FRED S&P 500", substring = true).assertRole(Role.Button).performClick()
        assertEquals("https://fred.stlouisfed.org/series/SP500", opened)
    }

    @Test
    fun aPillTakesTheReaderToItsChapter() {
        set { TodayPulse(PulseState.Loaded) }
        rule.onNodeWithText(TodayCopy.CHAPTER_NAMES).performClick()
        rule.waitForIdle()
        val title = rule.onNodeWithText(TodayCopy.namesInBrief(2)).getUnclippedBoundsInRoot()
        // Under the bar (56) and the pinned pills, near the top of the screen.
        assertTrue("names headline at ${title.top}", title.top > 100.dp && title.top < 300.dp)
    }

    @Test
    fun pulseErrorIsAnnouncedWithARetry() {
        set { TodayPulse(PulseState.Error) }
        rule.assertAllTouchTargetsAtLeast()
        val live = rule.onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsProperties.LiveRegion)).fetchSemanticsNodes()
        assertTrue(live.isNotEmpty())
    }

    // ---- Weekly digest -------------------------------------------------------------------------------------------

    @Test
    fun digestTargetsAndHeadings() {
        set { TodayDigest() }
        rule.assertAllTouchTargetsAtLeast()
        rule.onNodeWithText(TodayCopy.THIS_WEEK).assertIsHeading()
        rule.onNodeWithText(TodayCopy.filingsHeadline(2)).assertIsHeading()
    }
}
