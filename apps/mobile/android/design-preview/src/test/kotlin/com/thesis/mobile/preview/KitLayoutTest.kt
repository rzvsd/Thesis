package com.thesis.mobile.preview

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.components.CompareColumn
import com.thesis.mobile.ui.components.CompareRow
import com.thesis.mobile.ui.components.CompareTable
import com.thesis.mobile.ui.components.CompareTableModel
import com.thesis.mobile.ui.components.DataRow
import com.thesis.mobile.ui.components.DialogAction
import com.thesis.mobile.ui.components.SheetActionRow
import com.thesis.mobile.ui.components.ThesisDialogContent
import com.thesis.mobile.ui.components.ThesisSheetContent
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.components.KpiGrid
import com.thesis.mobile.ui.components.KpiSpec
import com.thesis.mobile.ui.components.SkeletonKpiGrid
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.theme.ThemeMode
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisTheme
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * Kit layout rules that renders only show (rubric A4, section 2.3 and #25): at 2.0x on 360 dp a KPI value never
 * breaks, a label never breaks inside a word, and the KPI skeleton has the final grid's height.
 */
class KitLayoutTest {

    @get:Rule
    val rule = createComposeRule()

    private fun setAt(fontScale: Float, widthDp: Dp, content: @Composable () -> Unit) {
        rule.setContent {
            val base = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(base.density, fontScale)) {
                ThesisTheme(mode = ThemeMode.Light) {
                    Box(Modifier.width(widthDp).padding(horizontal = ThesisSpace.gutter)) { content() }
                }
            }
        }
        rule.waitForIdle()
    }

    /** The longest compact outputs of Fmt.money (3 significant figures, sign, the widest prefixes). */
    private val longestMoney = listOf(
        Fmt.money(-999.99, ccy = "CAD"),
        Fmt.money(-108.8e9),
        Fmt.money(12.3e9, ccy = "CHF"),
        Fmt.money(-3.10e9, ccy = "CAD"),
    )

    private fun valueNodes(values: List<String>): List<SemanticsNode> = values.map { v ->
        rule.onAllNodes(SemanticsMatcher.expectValue(SemanticsProperties.Text, listOf(androidx.compose.ui.text.AnnotatedString(v))), useUnmergedTree = true)
            .fetchSemanticsNodes()
            .single()
    }

    private fun kpiValuesOnOneLine(featured: Boolean) {
        val items = longestMoney.mapIndexed { i, v -> KpiSpec("Figure $i, FY2025", v, "+2.0%", Tone.Favourable, "vs FY2024") }
        setAt(2f, 360.dp) { KpiGrid(items, featured = featured) }
        val nodes = valueNodes(longestMoney)
        // One line of the tallest value style at 2.0x is 2 x 28 sp; two lines of the shortest are 2 x 2 x 22 sp.
        val tallestLine = listOf(ThesisType.kpiValue, ThesisType.statValue, ThesisType.body).maxOf { it.lineHeight.value } * 2f
        nodes.forEachIndexed { i, node ->
            val h = with(node.layoutInfo.density) { node.size.height.toDp() }.value
            assertTrue("'${longestMoney[i]}' wrapped: $h dp tall (one line is at most $tallestLine dp)", h <= tallestLine + 1f)
        }
        val heights = nodes.map { it.size.height }.distinct()
        assertEquals("KPI values in one grid share one style", 1, heights.size)
    }

    @Test fun kpiValuesNeverBreakAt2xOn360dp() = kpiValuesOnOneLine(featured = false)

    @Test fun featuredKpiValuesNeverBreakAt2xOn360dp() = kpiValuesOnOneLine(featured = true)

    @Test
    fun kpiSkeletonHasTheFinalGridHeight() {
        val items = listOf(
            KpiSpec("Revenue, FY2025", "$391B", "+2.0%", Tone.Favourable, "vs FY2024"),
            KpiSpec("Gross margin", "46.2%", "+40 bps", Tone.Favourable, "vs FY2024"),
            KpiSpec("Free cash flow", "$109B", "−9.2%", Tone.Unfavourable, "vs FY2024"),
            KpiSpec("Net cash", "$49.6B", null, Tone.Neutral, "at 28 Sep 2025"),
        )
        setAt(1f, PhoneSpec.WIDTH_DP.dp) {
            Column {
                SkeletonKpiGrid(Modifier.testTag("skeleton"))
                KpiGrid(items, Modifier.testTag("grid"))
            }
        }
        val skeleton = rule.onNodeWithTag("skeleton", useUnmergedTree = true).fetchSemanticsNode().size.height
        val grid = rule.onNodeWithTag("grid", useUnmergedTree = true).fetchSemanticsNode().size.height
        val slack = with(Density(rule.density.density)) { 2.dp.roundToPx() }
        assertTrue("skeleton $skeleton px vs grid $grid px", kotlin.math.abs(skeleton - grid) <= slack)
    }

    private fun assertBreaksOnlyBetweenWords(text: String) {
        val node = rule.onAllNodes(SemanticsMatcher.expectValue(SemanticsProperties.Text, listOf(androidx.compose.ui.text.AnnotatedString(text))), useUnmergedTree = true)
            .fetchSemanticsNodes()
            .first()
        val results = mutableListOf<TextLayoutResult>()
        node.config.getOrNull(SemanticsActions.GetTextLayoutResult)?.action?.invoke(results)
        val layout = results.single()
        for (line in 0 until layout.lineCount - 1) {
            val end = layout.getLineEnd(line)
            assertTrue(
                "'$text' breaks inside a word after '${text.substring(0, end)}'",
                end == 0 || text[end - 1].isWhitespace() || text[end - 1] == '-' || text[end - 1] == ',',
            )
        }
    }

    @Test
    fun dataRowLabelBreaksOnlyBetweenWordsAt2xOn360dp() {
        setAt(2f, 360.dp) { DataRow("Operating income", Fmt.money(-999.99, ccy = "CAD"), delta = "+2.0%", deltaTone = Tone.Favourable) }
        assertBreaksOnlyBetweenWords("Operating income")
    }

    @Test
    fun compareTableLabelBreaksOnlyBetweenWordsAt2xOn360dp() {
        val model = CompareTableModel(
            columns = listOf(CompareColumn("FY2025", subject = true), CompareColumn("FY2024"), CompareColumn("FY2023")),
            rows = listOf(
                CompareRow("Operating margin, %", listOf("31.5", "29.8", "30.3"), delta = "+170"),
                CompareRow("Revenue", listOf("$391B", "$383B", "$394B")),
            ),
            labelHeader = "Metric",
            deltaHeader = "Change, bps",
        )
        setAt(2f, 360.dp) { CompareTable(model) }
        assertBreaksOnlyBetweenWords("Operating margin, %")
    }

    private fun textNode(text: String): SemanticsNode =
        rule.onAllNodes(SemanticsMatcher.expectValue(SemanticsProperties.Text, listOf(androidx.compose.ui.text.AnnotatedString(text))), useUnmergedTree = true)
            .fetchSemanticsNodes()
            .first()

    @Test
    fun dialogActionsStackInsteadOfBreakingWordsAt2xOn360dp() {
        setAt(2f, 360.dp) {
            ThesisDialogContent(
                title = "Discard this note?",
                body = "The changes since your last save are lost.",
                confirm = DialogAction("Discard changes", {}),
                dismiss = DialogAction("Keep editing", {}),
                destructive = true,
            )
        }
        assertBreaksOnlyBetweenWords("Discard changes")
        assertBreaksOnlyBetweenWords("Keep editing")
        val confirm = textNode("Discard changes").boundsInRoot
        val dismiss = textNode("Keep editing").boundsInRoot
        assertTrue("stacked: confirm $confirm above dismiss $dismiss", confirm.bottom <= dismiss.top)
    }

    @Test
    fun dialogActionsShareOneLineWhenTheyFit() {
        setAt(1f, PhoneSpec.WIDTH_DP.dp) {
            ThesisDialogContent(title = "Remove AAPL?", confirm = DialogAction("Remove", {}), dismiss = DialogAction("Cancel", {}), destructive = true)
        }
        val confirm = textNode("Remove").boundsInRoot
        val dismiss = textNode("Cancel").boundsInRoot
        assertTrue("one line, dismiss left of confirm: $dismiss / $confirm", dismiss.right <= confirm.left && kotlin.math.abs(dismiss.center.y - confirm.center.y) < 1f)
    }

    @Test
    fun sheetActionRowsRunFullBleedAndFlush() {
        setAt(1f, PhoneSpec.WIDTH_DP.dp) {
            ThesisSheetContent(Modifier.testTag("sheet"), title = "AAPL") {
                SheetActionRow(ThesisIcons.Notes, "Add a note", {}, Modifier.testTag("a"))
                SheetActionRow(ThesisIcons.Compare, "Compare", {}, Modifier.testTag("b"))
            }
        }
        val sheet = rule.onNodeWithTag("sheet", useUnmergedTree = true).fetchSemanticsNode().boundsInRoot
        val a = rule.onNodeWithTag("a", useUnmergedTree = true).fetchSemanticsNode().boundsInRoot
        val b = rule.onNodeWithTag("b", useUnmergedTree = true).fetchSemanticsNode().boundsInRoot
        val title = textNode("AAPL").boundsInRoot
        val label = textNode("Add a note").boundsInRoot
        val dp = rule.density.density
        assertEquals("row starts at the sheet edge", sheet.left, a.left, 1f)
        assertEquals("row ends at the sheet edge", sheet.right, a.right, 1f)
        assertEquals("rows sit flush", a.bottom, b.top, 1f)
        // Title on the 16 dp inset; label after the 20 dp icon and the 16 dp gap.
        assertEquals(sheet.left + ThesisSpace.l.value * dp, title.left, 1f)
        assertEquals(title.left + (ThesisSpace.iconM + ThesisSpace.l).value * dp, label.left, 1f)
    }
}
