package com.thesis.mobile.preview

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.components.NoteEntry
import com.thesis.mobile.ui.components.NotesTrail
import com.thesis.mobile.ui.theme.ThemeMode
import com.thesis.mobile.ui.theme.ThesisTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs

/**
 * A note joining the notes trail (a new report's entry) comes in with the 4.4 item motion (HANDOFF-M, PR-4b): the
 * trail opens room for it while it fades in; the first paint never animates; under reduced motion it fades but the
 * entries below take their new place at once.
 */
class NotesTrailMotionTest {

    @get:Rule
    val rule = createComposeRule()

    private val editorColour = Color(0xFF00C853)

    private fun entry(key: String, filing: String) = NoteEntry(key = key, filing = filing, date = "1 Feb 2026", text = "Note on $filing.")

    private fun setTrail(entries: List<NoteEntry>, reducedMotion: Boolean) {
        rule.setContent {
            ThesisTheme(mode = ThemeMode.Dark, reduceMotion = reducedMotion) {
                Box(Modifier.fillMaxSize().background(Color.Black).padding(horizontal = 16.dp)) {
                    NotesTrail(entries = entries) { newest ->
                        Box(Modifier.fillMaxWidth().height(60.dp).background(editorColour).testTag("editor-${newest.key}"))
                    }
                }
            }
        }
    }

    /** The colour at the centre of the newest entry's editor box. */
    private fun editorPixel(key: String): Int {
        val bounds = rule.onNodeWithTag("editor-$key", useUnmergedTree = true).getBoundsInRoot()
        val x = with(rule.density) { ((bounds.left + bounds.right) / 2).toPx() }.toInt()
        val y = with(rule.density) { ((bounds.top + bounds.bottom) / 2).toPx() }.toInt()
        return rule.onRoot().captureToImage().toPixelMap()[x, y].toArgb()
    }

    private fun topOf(text: String): Dp = rule.onNodeWithText(text, substring = true, useUnmergedTree = true).getBoundsInRoot().top

    @Test
    fun aNewReportsEntryFadesInWhileTheTrailOpensRoomForIt() {
        val entries = mutableStateListOf(entry("rep-2", "FY2025"), entry("rep-1", "FY2024"))
        rule.mainClock.autoAdvance = false
        setTrail(entries, reducedMotion = false)
        rule.mainClock.advanceTimeByFrame()
        assertEquals("first paint never fades", editorColour.toArgb(), editorPixel("rep-2"))
        val olderTop = topOf("FY2024 ·")

        rule.runOnIdle { entries.add(0, entry("rep-3", "FY2026")) }
        rule.mainClock.advanceTimeByFrame()
        rule.mainClock.advanceTimeByFrame()
        assertNotEquals("the new entry starts transparent", editorColour.toArgb(), editorPixel("rep-3"))
        val midTop = topOf("FY2024 ·")
        rule.mainClock.advanceTimeBy(800)
        assertEquals("then reaches full", editorColour.toArgb(), editorPixel("rep-3"))
        val settledTop = topOf("FY2024 ·")
        assertTrue("the entries below move down ($olderTop -> $settledTop)", settledTop > olderTop + 40.dp)
        assertTrue("over time, not in one frame (mid $midTop, settled $settledTop)", midTop < settledTop - 4.dp)
    }

    @Test
    fun underReducedMotionTheEntryFadesAndTheTrailMakesRoomAtOnce() {
        val entries = mutableStateListOf(entry("rep-2", "FY2025"), entry("rep-1", "FY2024"))
        rule.mainClock.autoAdvance = false
        setTrail(entries, reducedMotion = true)
        rule.mainClock.advanceTimeByFrame()
        rule.runOnIdle { entries.add(0, entry("rep-3", "FY2026")) }
        rule.mainClock.advanceTimeByFrame()
        rule.mainClock.advanceTimeByFrame()
        val firstTop = topOf("FY2024 ·")
        assertNotEquals("the new entry fades in", editorColour.toArgb(), editorPixel("rep-3"))
        rule.mainClock.advanceTimeBy(500)
        assertEquals(editorColour.toArgb(), editorPixel("rep-3"))
        val settledTop = topOf("FY2024 ·")
        assertTrue("no travel: the older entry is in its place at once ($firstTop vs $settledTop)", abs((settledTop - firstTop).value) < 1f)
    }
}
