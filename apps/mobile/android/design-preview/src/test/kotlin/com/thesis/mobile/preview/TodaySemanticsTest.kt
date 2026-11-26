package com.thesis.mobile.preview

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import com.thesis.mobile.preview.fixtures.HomeState
import com.thesis.mobile.preview.fixtures.PulseState
import com.thesis.mobile.preview.fixtures.TodayDigest
import com.thesis.mobile.preview.fixtures.TodayHome
import com.thesis.mobile.preview.fixtures.TodayPulse
import com.thesis.mobile.ui.copy.KitCopy
import com.thesis.mobile.ui.copy.TodayCopy
import com.thesis.mobile.ui.theme.ThemeMode
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisTheme
import com.thesis.mobile.ui.today.ChapterKind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
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

    private fun set(widthDp: Int = 412, heightDp: Int = 915, fontScale: Float? = null, content: @Composable () -> Unit) {
        rule.setContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale ?: density.fontScale)) {
                ThesisTheme(mode = ThemeMode.Dark) {
                    Box(Modifier.size(widthDp.dp, heightDp.dp)) { content() }
                }
            }
        }
    }

    private fun SemanticsNodeInteraction.textLayout(): TextLayoutResult {
        val results = mutableListOf<TextLayoutResult>()
        performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(results) }
        return results.single()
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

    // The morning line at 360 dp, 1.0x and 2.0x (the headline is capped at 1.3x): shortened at a clause, never cut
    // mid-word, never ellipsized.
    @Test fun theMorningLineFitsTwoLinesAt360() = assertMorningLineFits(1f)

    @Test fun theMorningLineFitsTwoLinesAt360And2x() = assertMorningLineFits(2f)

    private fun assertMorningLineFits(scale: Float) {
        set(widthDp = 360, heightDp = 780, fontScale = scale) { TodayHome(HomeState.Loaded) }
        val node = rule.onNodeWithText("Stocks rose for a third day", substring = true)
        val text = node.fetchSemanticsNode().config[SemanticsProperties.Text].joinToString("")
        assertFalse("\"$text\" overflows at ${scale}x", node.textLayout().hasVisualOverflow)
        assertTrue("\"$text\" at ${scale}x", text.endsWith("."))
        assertFalse(text, text.contains("…"))
    }

    @Test
    fun theMacroCardRetriesMacroStressAndNotThePulse() {
        var pulse = 0
        var macro = 0
        set { TodayHome(HomeState.Error, onRetryPulse = { pulse++ }, onRetryMacro = { macro++ }) }
        // The name rows' reasons take up to two lines, so the macro card can start below the test window.
        rule.onAllNodesWithText(KitCopy.TRY_AGAIN)[0].performScrollTo().performClick()
        assertEquals(1, macro)
        assertEquals(0, pulse)
    }

    @Test
    fun yourNamesStartsAboveTheFoldOnA360By780Phone() {
        // As the reader sees it: under the status bar (24 dp) and the shell's root bar.
        set(widthDp = 360, heightDp = 780) { TodayHome(HomeState.Loaded, padding = PaddingValues(top = 24.dp + ThesisSpace.topBar)) }
        val headline = rule.onNodeWithText("1 of your names changed since your last visit").getUnclippedBoundsInRoot()
        assertTrue("names headline ends at ${headline.bottom}", headline.bottom < 780.dp)
        val firstRow = rule.onNodeWithText("NVDA").getUnclippedBoundsInRoot()
        assertTrue("first name row starts at ${firstRow.top}", firstRow.top < 780.dp)
    }

    // The reason line is the row's content: whole (or cut at a clause) at every size, never ellipsized (rubric A4).
    @Test fun nameReasonsAreWholeAt412() = assertReasonsWhole(412, 1f)

    @Test fun nameReasonsAreWholeAt360() = assertReasonsWhole(360, 1f)

    // At 1.3x a one-sentence reason does not fit one line beside a two-character caption ("Customer concentration
    // rose again." needs about 292 dp of 278): Home passes `TickerRow(line2MaxLines = 2)` and measures for two lines.
    @Test fun nameReasonsAreWholeAt412And1_3x() = assertReasonsWhole(412, 1.3f)

    @Test fun nameReasonsAreWholeAt360And1_3x() = assertReasonsWhole(360, 1.3f)

    private fun assertReasonsWhole(widthDp: Int, scale: Float) {
        set(widthDp = widthDp, heightDp = 915, fontScale = scale) { TodayHome(HomeState.Loaded) }
        val starts = listOf("Customer concentration", "Services margin", "Retail operating", "Search revenue")
        starts.forEach { start ->
            rule.onNode(vertical).performScrollToNode(hasText(start, substring = true))
            val node = rule.onNodeWithText(start, substring = true, useUnmergedTree = true)
            val text = node.fetchSemanticsNode().config[SemanticsProperties.Text].joinToString("")
            // The row's Text is ellipsized (1 line up to 1.3x, 2 above): a cut shows as an ellipsized line or lines
            // that do not fit. (`didOverflowWidth` is not a signal here: a weighted Text reports its layout width.)
            val layout = node.textLayout()
            val ellipsized = (0 until layout.lineCount).any { layout.isLineEllipsized(it) }
            assertFalse("\"$text\" is cut at $widthDp dp, ${scale}x", ellipsized || layout.didOverflowHeight)
            assertTrue("\"$text\" at $widthDp dp, ${scale}x", text.endsWith("."))
        }
    }

    @Test
    fun anEarlierIssueIsNeverLabelledToday() {
        set { TodayHome(HomeState.PreviousIssue) }
        // The earlier issue's tape is dated, never captioned as this morning's (the tape is read as one description).
        rule.onNodeWithContentDescription(TodayCopy.tapeCaption(null, null, "Fri 20 Nov"), substring = true).assertExists()
        rule.onNodeWithContentDescription("Pre-market tape", substring = true).assertDoesNotExist()
        val kicker = TodayCopy.datedPulseKicker("Mon 23 Nov").uppercase()
        rule.onNode(vertical).performScrollToNode(hasText(kicker))
        rule.onNodeWithText(kicker).assertExists()
        rule.onNodeWithText(TodayCopy.PULSE_KICKER.uppercase()).assertDoesNotExist()
    }

    @Test
    fun aLateIssueSaysSoRatherThanAPassedTime() {
        // The fixture clock is 07:15 and the issue was due by 06:30.
        set { TodayHome(HomeState.Empty) }
        rule.onNode(vertical).performScrollToNode(hasText(TodayCopy.runningLate("06:30")))
        rule.onNodeWithText(TodayCopy.runningLate("06:30")).assertExists()
        rule.onNodeWithText(TodayCopy.expectedBy("06:30")).assertDoesNotExist()
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
        // 07:15 with the issue due by 06:30: the title says it is late, never "arrives before the open".
        rule.onNode(vertical).performScrollToNode(hasText(TodayCopy.NO_PULSE_LATE))
        rule.onNodeWithText(TodayCopy.NO_PULSE_LATE).assertExists()
        rule.onNodeWithText(TodayCopy.NO_PULSE).assertDoesNotExist()
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

    private fun selectedPill(label: String) =
        rule.onNode(hasText(label) and SemanticsMatcher.expectValue(SemanticsProperties.Selected, true))

    // A short chapter lands under the pinned pills while the next chapter's start has crossed the scroll-spy's line:
    // the tapped pill stays the selected one until the reader scrolls on.
    @Test
    fun aTappedShortChapterKeepsItsPill() {
        set { TodayPulse(PulseState.Loaded) }
        rule.onNodeWithText(TodayCopy.CHAPTER_HEADLINES).performClick()
        rule.waitForIdle()
        rule.mainClock.advanceTimeBy(2_000)
        rule.waitForIdle()
        selectedPill(TodayCopy.CHAPTER_HEADLINES).assertExists()
        selectedPill(TodayCopy.CHAPTER_SOURCES).assertDoesNotExist()
    }

    @Test
    fun theChapterThePulseOpensAtIsTheSelectedPill() {
        set { TodayPulse(PulseState.Real, initialChapter = ChapterKind.Changed) }
        rule.waitForIdle()
        selectedPill(TodayCopy.CHAPTER_CHANGED).assertExists()
        selectedPill(TodayCopy.CHAPTER_NAMES).assertDoesNotExist()
    }

    @Test
    fun pulseOfflineWithNoIssueSaysOffline() {
        set { TodayPulse(PulseState.Offline) }
        rule.onNodeWithText(com.thesis.mobile.ui.copy.StateCopy.OFFLINE_TITLE).assertExists()
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

    @Test
    fun anUnwiredDigestRowIsNotAButton() {
        set(heightDp = 2400) { TodayDigest(wired = false) }
        val buttons = rule.onAllNodes(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Button)).fetchSemanticsNodes()
        // Back and the macro card (it always opens Macro Stress); rows with nowhere to go read as text.
        val labels = buttons.map { n ->
            (n.config.getOrElse(SemanticsProperties.Text) { emptyList() }.map { it.text } +
                n.config.getOrElse(SemanticsProperties.ContentDescription) { emptyList() }).joinToString(" ")
        }
        assertEquals(labels.toString(), 2, buttons.size)
        listOf("AAPL", "MSFT", "Thesis drift").forEach { word -> assertTrue(labels.toString(), labels.none { it.contains(word) }) }
        // The kit row with no onClick: one merged text node, read as text.
        assertTrue(rule.onAllNodesWithText("AAPL", substring = true).fetchSemanticsNodes().isNotEmpty())
        rule.onNodeWithText(TodayCopy.OPEN_PULSE).assertDoesNotExist()
    }
}
