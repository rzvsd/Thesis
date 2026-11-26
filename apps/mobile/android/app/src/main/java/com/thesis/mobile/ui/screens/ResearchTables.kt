package com.thesis.mobile.ui.screens

import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.rememberTextMeasurer
import com.thesis.mobile.ui.components.CompareTable
import com.thesis.mobile.ui.components.CompareTableModel
import com.thesis.mobile.ui.copy.ResearchCopy
import com.thesis.mobile.ui.theme.Kit
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType

/** The share of the width the kit's CompareTable lets its pinned label column take (CompareTable.kt). */
private const val LABEL_MAX_FRACTION = 0.42f

/** A text's width on one line per explicit line break ([wide]) and its widest single word ([word]), in px. */
internal data class TextWidth(val wide: Int, val word: Int)

/**
 * The value columns of [model] (index; the delta column is `columns.size`) whose text does not fit in [maxWidth] px
 * beside the pinned labels, sized the way the kit's `CompareTable` sizes them: the label column takes its longest
 * line up to 42% of the width (never less than its longest word), each value column its widest value or header
 * line, at least [columnMin]. [measure] gives a text's width in a style; [padding] is a cell's two side paddings.
 */
internal fun hiddenColumns(
    model: CompareTableModel,
    maxWidth: Int,
    columnMin: Int,
    padding: Int,
    measure: (String, TextStyle) -> TextWidth,
): List<Int> {
    if (maxWidth <= 0) return emptyList()
    val labels = listOf(measure(model.labelHeader, ThesisType.tableHead)) +
        model.rows.map { measure(model.labelOf(it), if (it.median) ThesisType.label else ThesisType.bodySmall) }
    val labelWide = labels.maxOf { it.wide } + padding
    val labelWord = labels.maxOf { it.word } + padding
    val labelW = labelWide
        .coerceAtMost((maxWidth * LABEL_MAX_FRACTION).toInt())
        .coerceAtLeast(labelWord)
        .coerceAtMost((maxWidth - columnMin).coerceAtLeast(0))
    val room = maxWidth - labelW
    val withDelta = model.deltaHeader != null
    val count = model.columns.size + if (withDelta) 1 else 0
    val hidden = mutableListOf<Int>()
    var x = labelW
    for (c in 0 until count) {
        val delta = c == model.columns.size
        val values = model.rows.maxOfOrNull { r ->
            val text = if (delta) r.delta ?: model.missingDelta else r.values[c]
            measure(text, ThesisType.tableNum).wide
        }?.plus(padding) ?: 0
        val period = measure(if (delta) model.deltaHeader.orEmpty() else model.columns[c].period, ThesisType.tableHead)
        val filing = if (delta) null else model.columns[c].filing?.let { measure(it, ThesisType.tick) }
        val headerLine = maxOf(period.wide, filing?.wide ?: 0) + padding
        val headerWord = maxOf(period.word, filing?.word ?: 0) + padding
        val headerW = if (headerLine <= room) headerLine else maxOf(room, headerWord)
        x += maxOf(columnMin, values, headerW)
        // Values are right-aligned: a column is in view while its text is, even if its end padding is not.
        if (x - padding / 2 > maxWidth) hidden += c
    }
    return hidden
}

/**
 * The kit `CompareTable` plus, when it is wider than the screen, one caption naming the columns past the edge
 * ("Swipe the table for COST, NVDA and the median."): the shades at the edge alone are easy to miss, and the
 * headline above may name a column that is not in view. [columnNames] names each value column; [deltaName] the
 * delta column.
 */
@Composable
internal fun FittedCompareTable(
    model: CompareTableModel,
    columnNames: List<String>,
    deltaName: String?,
    modifier: Modifier = Modifier,
    sortedColumn: Int? = null,
    onHeaderClick: ((Int) -> Unit)? = null,
    onCellClick: ((row: Int, col: Int) -> Unit)? = null,
) {
    val p = LocalThesisPalette.current
    val measurer = rememberTextMeasurer()
    val density = LocalDensity.current
    BoxWithConstraints(modifier.fillMaxWidth()) {
        val widthPx = constraints.maxWidth
        val hidden = remember(model, widthPx, density) {
            val padding = with(density) { (Kit.tableCellPaddingH * 2).roundToPx() }
            val columnMin = with(density) { Kit.tableColumnMin.roundToPx() }
            hiddenColumns(model, widthPx, columnMin, padding) { text, style ->
                fun width(s: String) = measurer.measure(AnnotatedString(s), style, softWrap = false).size.width
                TextWidth(
                    wide = width(text),
                    word = text.split(' ', '\n').filter { it.isNotEmpty() }.maxOfOrNull { width(it) } ?: 0,
                )
            }
        }
        Column {
            CompareTable(model = model, sortedColumn = sortedColumn, onHeaderClick = onHeaderClick, onCellClick = onCellClick)
            val names = hidden.mapNotNull { i -> if (i < model.columns.size) columnNames.getOrNull(i) else deltaName }
            ResearchCopy.swipeFor(names)?.let {
                Text(it, style = ThesisType.caption, color = p.muted, modifier = Modifier.padding(top = ThesisSpace.s))
            }
        }
    }
}
