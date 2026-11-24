package com.thesis.mobile.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.rememberScrollableState
import androidx.compose.foundation.gestures.scrollable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.layoutId
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.LayoutDirection
import com.thesis.mobile.ui.motion.thesisPress
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisShape
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone
import com.thesis.mobile.ui.theme.textColor

/*
 * CompareTable (docs/app-redesign/DESIGN-DIRECTION.md, section 3 #30): one non-lazy layout with a single horizontal
 * scroll for the value columns; the label column stays pinned and paints over the values that scroll under it.
 */

/** A value column: the [period] header ("FY Sep-25") and the [filing] line ("10-K · 14 Nov 2025"). */
@Immutable
data class CompareColumn(val period: String, val filing: String? = null, val subject: Boolean = false)

/**
 * A table row: [label] (with [unit]), one value per column (already formatted; "—" for missing), an optional
 * [delta] in the basis column with its [deltaTone]; [median] rows sit on `surface2`.
 */
@Immutable
data class CompareRow(
    val label: String,
    val values: List<String>,
    val unit: String? = null,
    val delta: String? = null,
    val deltaTone: Tone = Tone.Neutral,
    val median: Boolean = false,
)

/** The whole table. [deltaHeader] names the basis ("Change, bps"); when null there is no delta column. */
@Immutable
data class CompareTableModel(
    val columns: List<CompareColumn>,
    val rows: List<CompareRow>,
    val labelHeader: String = "",
    val deltaHeader: String? = null,
) {
    init {
        require(columns.size in 1..MAX_COLUMNS) { "CompareTable takes 1 to $MAX_COLUMNS value columns" }
        require(rows.all { it.values.size == columns.size }) { "Every row needs one value per column" }
    }

    /** The label as shown, with its unit: "Revenue, $bn". */
    fun labelOf(row: CompareRow): String = if (row.unit.isNullOrBlank()) row.label else "${row.label}, ${row.unit}"

    /**
     * "Copy as table": tab-separated, one line per row, header lines first (period, then filing when any column has
     * one); pastes into Excel and Sheets as cells. Tabs and line breaks inside cells become spaces.
     */
    fun toTsv(): String {
        fun cell(s: String?) = s.orEmpty().replace('\t', ' ').replace('\r', ' ').replace('\n', ' ').trim()
        val withDelta = deltaHeader != null
        val lines = mutableListOf<List<String>>()
        lines += listOf(cell(labelHeader)) + columns.map { cell(it.period) } + if (withDelta) listOf(cell(deltaHeader)) else emptyList()
        if (columns.any { it.filing != null }) {
            lines += listOf("") + columns.map { cell(it.filing) } + if (withDelta) listOf("") else emptyList()
        }
        rows.forEach { r ->
            lines += listOf(cell(labelOf(r))) + r.values.map(::cell) + if (withDelta) listOf(cell(r.delta)) else emptyList()
        }
        return lines.joinToString("\n") { it.joinToString("\t") }
    }

    /** The row's spoken description: "Revenue, $bn: FY Sep-25 391.0, FY Sep-24 383.3, change +2.0%". */
    fun describe(row: CompareRow): String = buildString {
        append(labelOf(row)).append(": ")
        append(columns.indices.joinToString(", ") { "${columns[it].period} ${row.values[it]}" })
        if (deltaHeader != null && row.delta != null) append(", ").append(deltaHeader).append(' ').append(row.delta)
    }

    companion object {
        const val MAX_COLUMNS = 4
    }
}

private sealed interface CellId {
    data class Label(val row: Int) : CellId
    data class Value(val row: Int, val col: Int) : CellId
}

/**
 * The table (#30) in a `panel` card. Header rows: period per column (the [CompareColumn.subject] column in accent),
 * then the filing line. Values right-aligned `tableNum`; the delta column in its Tone. With [onHeaderClick] a
 * header tap sorts ([sortedColumn] shows "sorted"); with [onCellClick] a value tap opens `SourceSheet`.
 */
@Composable
fun CompareTable(
    model: CompareTableModel,
    modifier: Modifier = Modifier,
    sortedColumn: Int? = null,
    onHeaderClick: ((Int) -> Unit)? = null,
    onCellClick: ((row: Int, col: Int) -> Unit)? = null,
) {
    val p = LocalThesisPalette.current
    val scroll = remember { mutableFloatStateOf(0f) }
    val maxScroll = remember { FloatRef() }
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val scrollable = rememberScrollableState { delta ->
        val signed = if (rtl) delta else -delta
        val target = (scroll.floatValue + signed).coerceIn(0f, maxScroll.value)
        val consumed = target - scroll.floatValue
        scroll.floatValue = target
        if (rtl) consumed else -consumed
    }
    val valueCols = model.columns.size + if (model.deltaHeader != null) 1 else 0
    val headerRows = if (model.columns.any { it.filing != null }) 2 else 1
    val rowMin = if (onCellClick != null) ThesisSpace.touchMin else ThesisSpace.xxs
    val headMin = if (onHeaderClick != null) ThesisSpace.touchMin else ThesisSpace.xxs

    Box(
        modifier
            .fillMaxWidth()
            .kitCardShadow(p, ThesisShape.PanelRadius)
            .border(ThesisSpace.border, p.line, ThesisShape.panel)
            .background(p.surface, ThesisShape.panel)
            .clipToBounds()
            .scrollable(scrollable, Orientation.Horizontal),
    ) {
        Layout(
            content = {
                // Header: the label header and one cell per value column (period over filing).
                HeaderLabel(model.labelHeader, Modifier.layoutId(CellId.Label(-1)))
                model.columns.forEachIndexed { c, col ->
                    val click = onHeaderClick?.let { { it(c) } }
                    HeaderCell(
                        period = col.period,
                        filing = col.filing.takeIf { headerRows == 2 },
                        accent = col.subject,
                        sorted = sortedColumn == c,
                        onClick = click,
                        modifier = Modifier.layoutId(CellId.Value(-1, c)),
                    )
                }
                if (model.deltaHeader != null) {
                    HeaderCell(model.deltaHeader, null, false, false, null, Modifier.layoutId(CellId.Value(-1, valueCols - 1)))
                }
                model.rows.forEachIndexed { r, row ->
                    val fill = if (row.median) p.surface2 else p.surface
                    Text(
                        model.labelOf(row),
                        modifier = Modifier
                            .layoutId(CellId.Label(r))
                            .background(fill)
                            .semantics { contentDescription = model.describe(row) }
                            .padding(horizontal = Kit.tableCellPaddingH, vertical = Kit.tableCellPaddingV),
                        style = if (row.median) ThesisType.label else ThesisType.bodySmall,
                        color = if (row.median) p.ink2 else p.ink,
                    )
                    row.values.forEachIndexed { c, v ->
                        ValueCell(
                            text = v,
                            color = if (model.columns[c].subject) p.ink else p.ink2,
                            fill = fill,
                            label = "${model.labelOf(row)}, ${model.columns[c].period}",
                            onClick = onCellClick?.let { { it(r, c) } },
                            modifier = Modifier.layoutId(CellId.Value(r, c)),
                        )
                    }
                    if (model.deltaHeader != null) {
                        ValueCell(
                            text = row.delta ?: "—",
                            color = row.deltaTone.textColor(p),
                            fill = fill,
                            label = null,
                            onClick = null,
                            modifier = Modifier.layoutId(CellId.Value(r, valueCols - 1)),
                        )
                    }
                }
            },
        ) { measurables, constraints ->
            val byId = measurables.associateBy { it.layoutId as CellId }
            val rowsAll = (-1 until model.rows.size)
            val colMin = Kit.tableColumnMin.roundToPx()
            val labelMax = (constraints.maxWidth * LABEL_MAX_FRACTION).toInt()
            val labelW = rowsAll.maxOf { r -> byId.getValue(CellId.Label(r)).maxIntrinsicWidth(Constraints.Infinity) }
                .coerceAtMost(labelMax)
            val colW = IntArray(valueCols) { c ->
                maxOf(colMin, rowsAll.maxOf { r -> byId.getValue(CellId.Value(r, c)).maxIntrinsicWidth(Constraints.Infinity) })
            }
            val rowH = IntArray(model.rows.size + 1) { i ->
                val r = i - 1
                val label = byId.getValue(CellId.Label(r)).minIntrinsicHeight(labelW)
                val values = (0 until valueCols).maxOf { c -> byId.getValue(CellId.Value(r, c)).minIntrinsicHeight(colW[c]) }
                maxOf(label, values, (if (r == -1) headMin else rowMin).roundToPx())
            }
            val width = constraints.maxWidth
            val valuesW = colW.sum()
            maxScroll.value = (labelW + valuesW - width).coerceAtLeast(0).toFloat()
            if (scroll.floatValue > maxScroll.value) scroll.floatValue = maxScroll.value
            val fixed = { w: Int, h: Int -> Constraints.fixed(w, h) }
            val labels = rowsAll.map { r -> byId.getValue(CellId.Label(r)).measure(fixed(labelW, rowH[r + 1])) }
            val values = rowsAll.map { r -> (0 until valueCols).map { c -> byId.getValue(CellId.Value(r, c)).measure(fixed(colW[c], rowH[r + 1])) } }
            val height = rowH.sum()
            layout(width, height) {
                val off = scroll.floatValue.toInt()
                var y = 0
                rowsAll.forEachIndexed { i, _ ->
                    var x = labelW - off
                    values[i].forEachIndexed { c, pl ->
                        pl.placeRelative(x, y)
                        x += colW[c]
                    }
                    labels[i].placeRelative(0, y, zIndex = 1f)
                    y += rowH[i]
                }
            }
        }
    }
}

private class FloatRef(var value: Float = 0f)

private const val LABEL_MAX_FRACTION = 0.42f

@Composable
private fun HeaderLabel(text: String, modifier: Modifier) {
    val p = LocalThesisPalette.current
    Box(modifier.background(p.surface).padding(horizontal = Kit.tableCellPaddingH, vertical = Kit.tableCellPaddingV), contentAlignment = Alignment.TopStart) {
        Text(text, style = ThesisType.tableHead, color = p.muted)
    }
}

@Composable
private fun HeaderCell(
    period: String,
    filing: String?,
    accent: Boolean,
    sorted: Boolean,
    onClick: (() -> Unit)?,
    modifier: Modifier,
) {
    val p = LocalThesisPalette.current
    val source = remember { MutableInteractionSource() }
    Column(
        modifier
            .background(p.surface)
            .then(
                if (onClick != null) {
                    Modifier
                        .clickable(source, indication = null, role = Role.Button, onClickLabel = "Sort", onClick = onClick)
                        .thesisPress(source)
                } else {
                    Modifier
                },
            )
            .semantics(mergeDescendants = true) {
                heading()
                if (sorted) contentDescription = "$period, sorted"
            }
            .padding(horizontal = Kit.tableCellPaddingH, vertical = Kit.tableCellPaddingV),
        horizontalAlignment = Alignment.End,
    ) {
        Text(
            if (sorted) "$period ↓" else period,
            style = ThesisType.tableHead,
            color = if (accent) p.accent else p.ink,
            textAlign = TextAlign.End,
        )
        if (filing != null) Text(filing, style = ThesisType.tick, color = p.muted, textAlign = TextAlign.End)
    }
}

@Composable
private fun ValueCell(
    text: String,
    color: Color,
    fill: Color,
    label: String?,
    onClick: (() -> Unit)?,
    modifier: Modifier,
) {
    val source = remember { MutableInteractionSource() }
    Box(
        modifier
            .background(fill)
            .then(
                if (onClick != null) {
                    Modifier
                        .clickable(source, indication = null, role = Role.Button, onClickLabel = "Show source", onClick = onClick)
                        .semantics { contentDescription = "$label: $text" }
                        .thesisPress(source)
                } else {
                    // The row's label cell speaks the whole row.
                    Modifier.clearAndSetSemantics { }
                },
            )
            .padding(horizontal = Kit.tableCellPaddingH, vertical = Kit.tableCellPaddingV),
        contentAlignment = Alignment.TopEnd,
    ) {
        Text(text, style = ThesisType.tableNum, color = color, textAlign = TextAlign.End, maxLines = 1)
    }
}
