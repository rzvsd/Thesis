package com.thesis.mobile.preview

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.assertIsOn
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.thesis.mobile.ui.components.ErrorState
import com.thesis.mobile.ui.components.KitButton
import com.thesis.mobile.ui.components.ButtonKind
import com.thesis.mobile.ui.components.ReportTopBar
import com.thesis.mobile.ui.components.RowGroup
import com.thesis.mobile.ui.components.ScreenHeader
import com.thesis.mobile.ui.components.SectionHeader
import com.thesis.mobile.ui.components.SegmentedControl
import com.thesis.mobile.ui.components.ThesisBottomBar
import com.thesis.mobile.ui.components.ThesisCheckbox
import com.thesis.mobile.ui.components.ThesisChip
import com.thesis.mobile.ui.components.ThesisRadio
import com.thesis.mobile.ui.components.ThesisSnackbar
import com.thesis.mobile.ui.components.ToggleRow
import com.thesis.mobile.ui.components.defaultBottomBarItems
import com.thesis.mobile.ui.platform.HapticKind
import com.thesis.mobile.ui.platform.PreviewHaptics
import com.thesis.mobile.ui.theme.ThemeMode
import com.thesis.mobile.ui.theme.ThesisTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test

/**
 * Kit semantics (section 6.0 rule 7; rubric A1, A3, H1): every clickable in every sheet is at least 48 x 48 dp;
 * chips, segments and toggles expose their roles and states; headings and live regions are marked; haptics follow
 * the section 4.7 map.
 */
class KitSemanticsTest {

    @get:Rule
    val rule = createComposeRule()

    @Before
    fun clearHaptics() = PreviewHaptics.clear()

    private fun setKit(content: @Composable () -> Unit) {
        rule.setContent {
            ThesisTheme(mode = ThemeMode.Light) {
                Column(Modifier.verticalScroll(rememberScrollState())) { content() }
            }
        }
    }

    private fun touchTargets(sheet: String) {
        setKit { Column { KitComponentSheets.all.getValue(sheet)(remember { GalleryScope() }) } }
        rule.assertAllLaidOutTargetsAtLeast()
    }

    @Test fun touchTargetsButtons() = touchTargets("buttons")
    @Test fun touchTargetsChips() = touchTargets("chips")
    @Test fun touchTargetsCards() = touchTargets("cards")
    @Test fun touchTargetsData() = touchTargets("data")
    @Test fun touchTargetsControls() = touchTargets("controls")
    @Test fun touchTargetsOverlays() = touchTargets("overlays")
    @Test fun touchTargetsBars() = touchTargets("bars")
    @Test fun touchTargetsReport() = touchTargets("report")
    @Test fun touchTargetsAtoms() = touchTargets("atoms")
    @Test fun touchTargetsHeaders() = touchTargets("headers")
    @Test fun touchTargetsLoading() = touchTargets("loading")

    @Test
    fun chipIsATabWithSelection() {
        setKit {
            var selected by remember { mutableStateOf(false) }
            ThesisChip("At risk", selected = selected, onClick = { selected = !selected })
        }
        rule.onNodeWithText("At risk").assertRole(Role.Tab).assertIsNotSelected().performClick()
        rule.onNodeWithText("At risk").assertIsSelected()
    }

    @Test
    fun segmentedControlIsRadioGroupWithSegmentHaptic() {
        setKit {
            var index by remember { mutableIntStateOf(0) }
            SegmentedControl(listOf("Names", "Notes"), index, { index = it })
        }
        rule.onNodeWithText("Names").assertRole(Role.RadioButton).assertIsSelected()
        rule.onNodeWithText("Notes").assertIsNotSelected().performClick()
        rule.onNodeWithText("Notes").assertIsSelected()
        assertEquals(listOf(HapticKind.Segment), PreviewHaptics.log)
    }

    @Test
    fun toggleRowIsASwitchWithToggleHaptics() {
        setKit {
            var on by remember { mutableStateOf(false) }
            RowGroup { row { ToggleRow("Morning pulse", on, { on = it }) } }
        }
        rule.onNodeWithText("Morning pulse").assertRole(Role.Switch).assertIsOff().performClick()
        rule.onNodeWithText("Morning pulse").assertIsOn().performClick()
        assertEquals(listOf(HapticKind.ToggleOn, HapticKind.ToggleOff), PreviewHaptics.log)
    }

    @Test
    fun checkboxAndRadioRoles() {
        setKit {
            var checked by remember { mutableStateOf(false) }
            ThesisCheckbox(checked, { checked = it }, Modifier)
            ThesisRadio(true, {}, Modifier)
        }
        rule.onNode(hasRoleMatcher(Role.Checkbox)).assertIsOff().performClick().assertIsOn()
        rule.onNode(hasRoleMatcher(Role.RadioButton)).assertIsSelected()
        rule.assertAllTouchTargetsAtLeast()
    }

    @Test
    fun followToggleIsASwitch() {
        setKit {
            var following by remember { mutableStateOf(true) }
            ReportTopBar("AAPL", {}, following, { following = it }, {})
        }
        rule.onNode(hasRoleMatcher(Role.Switch)).assertIsOn().performClick().assertIsOff()
        assertEquals(listOf(HapticKind.ToggleOff), PreviewHaptics.log)
        rule.onNodeWithContentDescription("More options").assertRole(Role.Button)
        rule.assertAllTouchTargetsAtLeast()
    }

    @Test
    fun bottomBarItemsAreTabs() {
        val items = defaultBottomBarItems()
        setKit { ThesisBottomBar(items, items.first().key, {}) }
        rule.onNodeWithText(items.first().label, useUnmergedTree = false).assertRole(Role.Tab).assertIsSelected()
        rule.onNodeWithText(items[1].label).assertRole(Role.Tab).assertIsNotSelected()
        rule.assertAllTouchTargetsAtLeast()
    }

    @Test
    fun headersAreHeadings() {
        setKit {
            ScreenHeader("Today", eyebrow = "Tuesday")
            SectionHeader("Your names", "Two need a look")
        }
        rule.onNodeWithText("Today").assertIsHeading()
        rule.onNodeWithText("Two need a look").assertIsHeading()
    }

    @Test
    fun errorStateIsALiveRegion() {
        setKit { ErrorState("Couldn\u2019t load your names", cause = "No connection.", onRetry = {}) }
        rule.onNode(hasLiveRegionMatcher()).assertExists()
        rule.onNodeWithText("Try again").assertRole(Role.Button)
        rule.assertAllTouchTargetsAtLeast()
    }

    @Test
    fun buttonsAreButtonsAndDisabledIsNotClickable() {
        var clicks = 0
        setKit {
            KitButton("Run", { clicks++ }, ButtonKind.Primary)
            KitButton("Off", { clicks++ }, ButtonKind.Secondary, enabled = false)
        }
        rule.onNodeWithText("Run").assertRole(Role.Button).performClick()
        rule.onNodeWithText("Off").performClick()
        assertEquals(1, clicks)
        assertTrue(PreviewHaptics.log.isEmpty() || PreviewHaptics.log.all { it == HapticKind.Press || it == HapticKind.Confirm })
    }

    /** Rubric A2: the snackbar action ("Undo") on the ink container reaches 4.5:1 in both themes (review round 2). */
    @Test fun snackbarActionContrastLight() = snackbarActionContrast(ThemeMode.Light)

    @Test fun snackbarActionContrastDark() = snackbarActionContrast(ThemeMode.Dark)

    private fun snackbarActionContrast(mode: ThemeMode) {
        rule.setContent {
            ThesisTheme(mode = mode) {
                Column { ThesisSnackbar("Removed AAPL from your names", actionLabel = "Undo") }
            }
        }
        val pixels = rule.onNodeWithText("Undo").captureToImage().toPixelMap()
        val counts = HashMap<Int, Int>()
        for (y in 0 until pixels.height) for (x in 0 until pixels.width) {
            val c = pixels[x, y].toArgb()
            counts[c] = (counts[c] ?: 0) + 1
        }
        val background = Color(counts.maxByOrNull { it.value }!!.key)
        val best = counts.keys.maxOf { contrast(Color(it), background) }
        assertTrue("Snackbar action contrast ${"%.2f".format(best)}:1 in $mode is under 4.5:1", best >= 4.5f)
    }
}

private fun contrast(a: Color, b: Color): Float {
    val la = a.luminance() + 0.05f
    val lb = b.luminance() + 0.05f
    return maxOf(la, lb) / minOf(la, lb)
}

private fun hasRoleMatcher(role: Role) = androidx.compose.ui.test.SemanticsMatcher.expectValue(
    androidx.compose.ui.semantics.SemanticsProperties.Role,
    role,
)

private fun hasLiveRegionMatcher() = androidx.compose.ui.test.SemanticsMatcher.keyIsDefined(
    androidx.compose.ui.semantics.SemanticsProperties.LiveRegion,
)

/**
 * [assertAllTouchTargetsAtLeast] for sheets taller than the test window: checks each clickable node's own layout
 * size (unclipped), so targets scrolled past the window edge are still measured.
 */
private fun androidx.compose.ui.test.junit4.ComposeContentTestRule.assertAllLaidOutTargetsAtLeast(min: androidx.compose.ui.unit.Dp = MinTouchTarget) {
    val failures = onAllNodes(androidx.compose.ui.test.hasClickAction()).fetchSemanticsNodes().mapNotNull { node ->
        val d = node.layoutInfo.density
        val w = with(d) { node.size.width.toDp() }
        val h = with(d) { node.size.height.toDp() }
        val slack = with(d) { 0.5f.toDp() }
        if (w >= min - slack && h >= min - slack) {
            null
        } else {
            val text = node.config.getOrNull(androidx.compose.ui.semantics.SemanticsProperties.Text)?.joinToString(" ")
            val desc = node.config.getOrNull(androidx.compose.ui.semantics.SemanticsProperties.ContentDescription)?.joinToString(" ")
            "  ${text ?: desc ?: "node #${node.id}"}: ${w.value.toInt()} x ${h.value.toInt()} dp"
        }
    }
    assertTrue("Touch targets under $min:\n" + failures.joinToString("\n"), failures.isEmpty())
}
