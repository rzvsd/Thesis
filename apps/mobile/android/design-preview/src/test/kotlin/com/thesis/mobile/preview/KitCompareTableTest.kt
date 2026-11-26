package com.thesis.mobile.preview

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.click
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.thesis.mobile.preview.fixtures.ResearchFixtures as F
import com.thesis.mobile.ui.components.CompareColumn
import com.thesis.mobile.ui.components.CompareRow
import com.thesis.mobile.ui.components.CompareTable
import com.thesis.mobile.ui.components.CompareTableModel
import com.thesis.mobile.ui.copy.ResearchCopy
import com.thesis.mobile.ui.screens.CompareNamesScreen
import com.thesis.mobile.ui.theme.ThemeMode
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * CompareTable column fit and row targets (PR-4b, WP-K; #30, rubric A1, A3, A4): Compare names keeps the fourth name
 * and the median in view at 412 dp, still scrolls where it must (360 dp, 2.0x), each row is one 48 dp button whose
 * tap opens the figure under the finger, and TalkBack gets one source action per column.
 */
class KitCompareTableTest {

    @get:Rule
    val rule = createComposeRule()

    private fun setAt(fontScale: Float, widthDp: Dp, gutter: Boolean, content: @Composable () -> Unit) {
        rule.setContent {
            val base = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(base.density, fontScale)) {
                ThesisTheme(mode = ThemeMode.Light) {
                    F.Fixed {
                        Box(Modifier.width(widthDp).then(if (gutter) Modifier.padding(horizontal = ThesisSpace.gutter) else Modifier)) {
                            content()
                        }
                    }
                }
            }
        }
        rule.waitForIdle()
    }

    private fun names(fontScale: Float, widthDp: Dp) = setAt(fontScale, widthDp, gutter = false) {
        CompareNamesScreen(state = F.compareNames, onBack = {}, disciplines = F.disciplines, zone = F.zone)
    }

    private fun textNode(text: String): SemanticsNode =
        rule.onAllNodes(SemanticsMatcher.expectValue(SemanticsProperties.Text, listOf(androidx.compose.ui.text.AnnotatedString(text))), useUnmergedTree = true)
            .fetchSemanticsNodes()
            .first()

    private fun swipeCaptions() = rule.onAllNodesWithText("Swipe the table", substring = true).fetchSemanticsNodes()

    @Test
    fun compareNamesShowsEveryNameAndTheMedianAt412dp() {
        names(1f, 412.dp)
        assertTrue("no swipe caption at 412 dp", swipeCaptions().isEmpty())
        val density = rule.density
        val edge = with(density) { (412.dp - ThesisSpace.gutter).toPx() }
        // The last name's header and the median header and figures end inside the panel, not past the screen edge.
        listOf(ResearchCopy.MEDIAN, "−\$13.0B").forEach { text ->
            val right = rule.onAllNodes(SemanticsMatcher.expectValue(SemanticsProperties.Text, listOf(androidx.compose.ui.text.AnnotatedString(text))), useUnmergedTree = true)
                .fetchSemanticsNodes().maxOf { it.boundsInRoot.right }
            assertTrue("'$text' ends at $right px, past $edge", right <= edge + 0.5f)
        }
        val nvda = rule.onAllNodesWithText("NVDA", substring = true, useUnmergedTree = true).fetchSemanticsNodes()
        assertTrue(nvda.any { it.boundsInRoot.right <= edge + 0.5f && it.boundsInRoot.left >= 0f })
        rule.assertAllTouchTargetsAtLeast()
    }

    @Test
    fun compareNamesStillScrollsWhereItCannotFit() {
        names(1f, 360.dp)
        assertTrue("360 dp names the columns past the edge", swipeCaptions().isNotEmpty())
    }

    @Test
    fun compareNamesAt2xKeepsTargetsAndScrolls() {
        names(2f, 412.dp)
        assertTrue(swipeCaptions().isNotEmpty())
        rule.assertAllTouchTargetsAtLeast()
    }

    private val model = CompareTableModel(
        columns = listOf(CompareColumn("AAPL", subject = true), CompareColumn("MSFT"), CompareColumn("COST")),
        rows = listOf(
            CompareRow("Revenue", listOf("\$416B", "\$282B", "\$275B"), delta = "\$282B"),
            CompareRow("Operating margin", listOf("32.0%", "45.6%", "3.6%"), delta = "32.0%"),
        ),
        labelHeader = "Latest FY",
        deltaHeader = "Median",
        deltaIsMedian = true,
    )

    @Test
    fun aRowIsOneTargetAndItsTapOpensTheFigureUnderTheFinger() {
        val taps = mutableListOf<Pair<Int, Int>>()
        setAt(1f, 412.dp, gutter = true) { CompareTable(model, onCellClick = { r, c -> taps += r to c }) }
        val rows = rule.onAllNodes(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Button))
        assertEquals("one button per row", model.rows.size, rows.fetchSemanticsNodes().size)
        rule.assertAllTouchTargetsAtLeast()
        val row = rule.onNode(hasContentDescription("Operating margin:", substring = true))
        val rowBounds = row.fetchSemanticsNode().boundsInRoot
        // Tap under MSFT's header, then COST's, then over the label (the subject column), then under the median.
        fun header(text: String) = rule.onNode(hasText(text) and SemanticsMatcher.keyIsDefined(SemanticsProperties.Heading))
            .fetchSemanticsNode().boundsInRoot
        listOf("MSFT", "COST").forEach { text ->
            val b = header(text)
            row.performTouchInput { click(Offset(b.center.x - rowBounds.left, height / 2f)) }
        }
        row.performTouchInput { click(Offset(width * 0.05f, height / 2f)) }
        val median = header("Median")
        row.performTouchInput { click(Offset(median.center.x - rowBounds.left, height / 2f)) }
        rule.waitForIdle()
        assertEquals(listOf(1 to 1, 1 to 2, 1 to 0), taps)
        // TalkBack: the row reads whole; its click opens the subject's figure; one action per name.
        val node = row.fetchSemanticsNode()
        assertEquals(listOf("Source for AAPL", "Source for MSFT", "Source for COST"), node.config[SemanticsActions.CustomActions].map { it.label })
        node.config[SemanticsActions.CustomActions][2].action()
        node.config[SemanticsActions.OnClick].action?.invoke()
        assertEquals(listOf(1 to 1, 1 to 2, 1 to 0, 1 to 2, 1 to 0), taps)
    }

    @Test
    fun aReadOnlyTableHasNoButtonsAndSpeaksEachRow() {
        setAt(1f, 412.dp, gutter = true) { CompareTable(model) }
        assertTrue(rule.onAllNodes(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Button)).fetchSemanticsNodes().isEmpty())
        rule.onNode(hasContentDescription("Revenue: AAPL \$416B, MSFT \$282B, COST \$275B, Median \$282B")).assertExistsCompat()
    }

    private fun androidx.compose.ui.test.SemanticsNodeInteraction.assertExistsCompat() {
        fetchSemanticsNode()
    }
}
