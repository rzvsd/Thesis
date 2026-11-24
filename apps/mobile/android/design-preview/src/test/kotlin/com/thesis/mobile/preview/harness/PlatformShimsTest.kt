package com.thesis.mobile.preview.harness

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.thesis.mobile.preview.assertAllTouchTargetsAtLeast
import com.thesis.mobile.preview.assertIsHeading
import com.thesis.mobile.preview.assertRole
import com.thesis.mobile.preview.assertTouchTargetAtLeast
import com.thesis.mobile.ui.platform.BackSwipeEdge
import com.thesis.mobile.ui.platform.HapticKind
import com.thesis.mobile.ui.platform.PreviewBack
import com.thesis.mobile.ui.platform.PreviewHaptics
import com.thesis.mobile.ui.platform.ThesisBackEvent
import com.thesis.mobile.ui.platform.ThesisBackHandler
import com.thesis.mobile.ui.platform.ThesisPredictiveBackHandler
import com.thesis.mobile.ui.platform.rememberPlatformHaptics
import com.thesis.mobile.ui.theme.PreviewFontLoader
import com.thesis.mobile.ui.theme.ThesisFonts
import com.thesis.mobile.ui.theme.ThesisTheme
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File
import java.nio.file.Files

/** The ui/platform and ThesisFonts shims, and ui-test-junit4-desktop itself (section 6.1 F4). */
class PlatformShimsTest {

    @get:Rule
    val rule = createComposeRule()

    // ---- Fonts

    @Test
    fun fontsFallBackToTheSystemSerifWhenAbsent() {
        val empty = Files.createTempDirectory("no-fonts").toFile()
        assertEquals(FontFamily.Serif, PreviewFontLoader.family(PreviewFontLoader.TextFaces, empty))
        assertEquals(FontFamily.Serif, PreviewFontLoader.family(PreviewFontLoader.DisplayFaces, null))
        assertEquals(FontFamily.Default, ThesisFonts.Sans)
    }

    @Test
    fun fontsLoadFromResFontWhenPresent() {
        // Any TTF stands in for a Newsreader instance: the loader only cares about file names.
        val sample = listOf(
            PreviewFontLoader.fontDir?.resolve("newsreader_text.ttf"),
            File(System.getProperty("user.home"), ".local/share/fonts/thesis-preview/NotoSerif-400.ttf"),
        ).firstOrNull { it?.isFile == true }
        assumeTrue("no TTF available to stand in for Newsreader", sample != null)
        val dir = Files.createTempDirectory("fonts").toFile()
        sample!!.copyTo(File(dir, "newsreader_text.ttf"))
        sample.copyTo(File(dir, "newsreader_medium.ttf"))
        assertEquals(2, PreviewFontLoader.fonts(PreviewFontLoader.TextFaces, dir).size)
        val family = PreviewFontLoader.family(PreviewFontLoader.TextFaces, dir)
        assertNotEquals("partial sets still load", FontFamily.Serif, family)
    }

    // ---- Back

    @Test
    fun backPressGoesToTheInnermostEnabledHandler() {
        var outer = 0
        var inner = 0
        var innerEnabled by mutableStateOf(true)
        rule.setContent {
            ThesisBackHandler { outer++ }
            ThesisBackHandler(enabled = innerEnabled) { inner++ }
        }
        rule.waitForIdle()
        assertTrue(runBlocking { PreviewBack.press() })
        assertEquals(1 to 0, inner to outer)
        innerEnabled = false
        rule.waitForIdle()
        assertTrue(runBlocking { PreviewBack.press() })
        assertEquals(1 to 1, inner to outer)
    }

    @Test
    fun backAtTheRootIsNotHandled() {
        rule.setContent { ThesisBackHandler(enabled = false) {} }
        rule.waitForIdle()
        assertEquals(0, PreviewBack.enabledCount)
        assertFalse(runBlocking { PreviewBack.press() })
    }

    @Test
    fun predictiveBackReceivesProgressThenCompletes() {
        val seen = mutableListOf<ThesisBackEvent>()
        var committed = false
        rule.setContent {
            ThesisPredictiveBackHandler { events ->
                events.collect { seen += it }
                committed = true
            }
        }
        rule.waitForIdle()
        assertTrue(runBlocking { PreviewBack.press(BackSwipeEdge.Right) })
        assertEquals(listOf(0f, 0.5f, 1f), seen.map { it.progress })
        assertTrue(seen.all { it.swipeEdge == BackSwipeEdge.Right })
        assertTrue(committed)
    }

    // ---- Haptics

    @Test
    fun hapticsAreRecorded() {
        PreviewHaptics.clear()
        rule.setContent {
            val haptics = rememberPlatformHaptics()
            Box(Modifier.size(48.dp).testTag("commit").clickable { haptics.perform(HapticKind.Confirm) })
        }
        rule.onNodeWithTag("commit").performClick()
        rule.waitForIdle()
        assertEquals(listOf(HapticKind.Confirm), PreviewHaptics.log)
    }

    // ---- ui-test-junit4-desktop and the shared semantics assertions

    @Test
    fun semanticsAssertionsWork() {
        rule.setContent {
            ThesisTheme {
                Column {
                    Text("Your names", Modifier.semantics { heading() })
                    Box(Modifier.size(48.dp).testTag("ok").clickable(role = Role.Button) {})
                }
            }
        }
        rule.onNodeWithText("Your names").assertIsHeading()
        rule.onNodeWithTag("ok").assertRole(Role.Button).assertTouchTargetAtLeast()
        rule.assertAllTouchTargetsAtLeast()
    }

    @Test
    fun offScreenTargetsInAScrollingColumnAreMeasuredUnclipped() {
        // A 200 dp viewport over ten 48 dp targets: b4 is half visible, b5..b9 are scrolled out of view.
        rule.setContent {
            Box(Modifier.size(200.dp)) {
                Column(Modifier.verticalScroll(rememberScrollState())) {
                    repeat(10) { i -> Box(Modifier.size(48.dp).testTag("b$i").clickable {}) }
                }
            }
        }
        rule.assertAllTouchTargetsAtLeast()
        rule.onNodeWithTag("b9").assertTouchTargetAtLeast()
        rule.onNodeWithTag("b4").assertTouchTargetAtLeast()
    }

    @Test
    fun smallTouchTargetsFail() {
        rule.setContent { Box(Modifier.size(24.dp).testTag("tiny").clickable {}) }
        val failure = runCatching { rule.assertAllTouchTargetsAtLeast() }.exceptionOrNull()
        assertTrue("a 24 dp target must fail, got $failure", failure is AssertionError)
        assertTrue(failure!!.message!!, failure.message!!.contains("tag=tiny: 24 x 24 dp"))
    }
}
