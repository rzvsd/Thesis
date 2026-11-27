package com.thesis.mobile.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.rememberScrollableState
import androidx.compose.foundation.gestures.scrollable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.FloatState
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.IntState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.IntrinsicMeasurable
import androidx.compose.ui.layout.IntrinsicMeasureScope
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.Measurable
import androidx.compose.ui.layout.MeasurePolicy
import androidx.compose.ui.layout.MeasureResult
import androidx.compose.ui.layout.MeasureScope
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.layoutId
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.text
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.constrainHeight
import androidx.compose.ui.unit.constrainWidth
import androidx.compose.ui.unit.offset
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.motion.thesisPress
import com.thesis.mobile.ui.theme.Kit
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisShape
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone
import com.thesis.mobile.ui.theme.textColor
import kotlin.math.max
import kotlin.math.min

/*
 * CompareTable (docs/app-redesign/DESIGN-DIRECTION.md, section 3 #30): one non-lazy layout with a single horizontal
 * scroll for the value columns; the label column stays pinned and paints over the values that scroll under it.
 *
 * Column fit (PR-4b, WP-K; HANDOFF-D 8, HANDOFF-E 33 to 35): the table tries four densities, from the comfortable
 * one (12 dp cell padding, 88 dp column floor) down to a compact one (6 dp padding, columns as wide as their
 * figures, headers and labels wrapping between words). It takes the first at which every column is in view with
 * nothing wrapped, else the first at which it is with labels wrapped between words (a wrapped label costs a taller
 * row, so the comfortable densities try first without one). Spare width goes to the value columns, so the last one
 * sits flush with the panel's end. Only when even the compact density does not fit (360 dp at a large font scale)
 * does the table scroll. Figures never wrap or ellipsize.
 * With a cell tap, each row is one 48 dp touch target over compact cells; the tap's x picks the column.
 */

/** A value column: the [period] header ("FY Sep-25") and the [filing] line ("10-K · 14 Nov 2025"). */
@Immutable
data class CompareColumn(val period: String, val filing: String? = null, val subject: Boolean = false)

/**
 * A table row: [label] (with [unit]), one value per column (already formatted, a missing value in one of the three
 * words of 2.4: "Not disclosed", "n/a", "Not computed"; never a dash), an optional [delta] in the basis column with
 * its [deltaTone]; [median] rows sit on `surface2`.
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

/**
 * The whole table. [deltaHeader] names the basis ("Change, bps"); when null there is no delta column. A row with no
 * delta shows [missingDelta] (2.4: "n/a" when a change is not meaningful, "Not computed" for a gap on our side).
 * [deltaIsMedian]: the basis column is a median across the value columns (Compare names), so it sits on `surface2`
 * like a median row (5.26) and does not read as one more name.
 */
@Immutable
data class CompareTableModel(
    val columns: List<CompareColumn>,
    val rows: List<CompareRow>,
    val labelHeader: String = "",
    val deltaHeader: String? = null,
    val missingDelta: String = Fmt.NA,
    val deltaIsMedian: Boolean = false,
) {
    init {
        require(columns.size in 1..MAX_COLUMNS) { "CompareTable takes 1 to $MAX_COLUMNS value columns" }
        require(rows.all { it.values.size == columns.size }) { "Every row needs one value per column" }
    }

    /** Value columns plus the delta column, when there is one. */
    val valueColumnCount: Int get() = columns.size + if (deltaHeader != null) 1 else 0

    /** The label as shown, with its unit: "Revenue, $bn". */
    fun labelOf(row: CompareRow): String = if (row.unit.isNullOrBlank()) row.label else "${row.label}, ${row.unit}"

    /**
     * The label as drawn: [labelOf] with a non-breaking space before the unit, so a wrapped label keeps its unit with
     * its last word ("Gross" over "margin, %", never "Revenue," over "$bn").
     */
    fun labelShown(row: CompareRow): String =
        if (row.unit.isNullOrBlank()) row.label else "${row.label},\u00A0${row.unit}"

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
        append(columns.indices.joinToString(", ") { "${spoken(columns[it].period)} ${row.values[it]}" })
        if (deltaHeader != null && row.delta != null) append(", ").append(deltaHeader).append(' ').append(row.delta)
    }

    companion object {
        const val MAX_COLUMNS = 4

        /** A header as one spoken line ("AAPL\nFY2025" reads "AAPL FY2025"). */
        internal fun spoken(text: String): String = text.split('\n').joinToString(" ") { it.trim() }.trim()
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Column fit
// ---------------------------------------------------------------------------------------------------------------

/**
 * What the table's text needs, in px and without cell padding: the label column's longest line ([labelWide]) and
 * longest word ([labelWord]), each row label's line ([labelLines], row order, the label header not included); per
 * value column (the delta column last) its widest figure ([valueWide]) and its header's longest line
 * ([headerLine]), the narrowest it wraps to in a fitting table ([headerWrap]: a period never
 * breaks, "FY Sep-25" is one unit, though a status in its place, "No report yet", may; the filing line and the delta
 * header break between words; each onto at most two lines)
 * and its longest word ([headerWord], the last resort of a table that scrolls anyway, so its first column stays whole
 * in view at 2.0x on 360 dp). From [rememberCompareTableNeeds] (or [compareTableNeeds] with any measure, in tests).
 */
@Immutable
class CompareTableNeeds(
    val labelWide: Int,
    val labelWord: Int,
    val valueWide: List<Int>,
    val headerLine: List<Int>,
    val headerWrap: List<Int>,
    val headerWord: List<Int>,
    val labelLines: List<Int> = emptyList(),
)

/**
 * The needs of [model] with [sortedColumn] marked, measured by [measure] (a text's width on one line per explicit
 * line break, in px, in a style). The styles are the ones the table draws with.
 */
fun compareTableNeeds(
    model: CompareTableModel,
    sortedColumn: Int?,
    measure: (String, TextStyle) -> Int,
): CompareTableNeeds {
    fun words(text: String, style: TextStyle) =
        text.split(' ', '\n').filter { it.isNotEmpty() }.maxOfOrNull { measure(it, style) } ?: 0
    // The narrowest width that holds each explicit line of [text] on at most two lines, broken between words. With
    // [periods], a line holding a figure ("FY Sep-25", "Q3 FY25") is a period and stays whole; a status in its place
    // ("No report yet") may break.
    fun twoLines(text: String, style: TextStyle, periods: Boolean = false) = text.split('\n').maxOf { line ->
        val w = line.split(' ').filter { it.isNotEmpty() }
        if (w.size < 2 || (periods && line.any { it.isDigit() })) {
            if (line.isBlank()) 0 else measure(line.trim(), style)
        } else {
            // A filing line ("10-K · 31 Oct 2025") breaks at its separator, which then goes ("10-K" over "31 Oct 2025"),
            // so the date stays whole.
            val seps = (1 until w.size).filter { w[it - 1] == "·" }
            if (seps.isNotEmpty()) {
                seps.minOf { i ->
                    max(measure(w.subList(0, i - 1).joinToString(" "), style), measure(w.subList(i, w.size).joinToString(" "), style))
                }
            } else {
                (1 until w.size).minOf { i ->
                    max(measure(w.subList(0, i).joinToString(" "), style), measure(w.subList(i, w.size).joinToString(" "), style))
                }
            }
        }
    }
    val rowLabels = model.rows.map { model.labelShown(it) to labelStyleOf(it) }
    val labels = listOf(model.labelHeader to ThesisType.tableHead) + rowLabels
    val n = model.valueColumnCount
    // Each header text with whether it may wrap (filing lines and the delta header do; a period line only when it
    // holds no figure).
    val headers = List(n) { c ->
        if (c < model.columns.size) {
            val col = model.columns[c]
            listOfNotNull(
                Triple(headerText(col.period, sortedColumn == c), ThesisType.tableHead, false),
                col.filing?.let { Triple(it, ThesisType.tick, true) },
            )
        } else {
            listOf(Triple(model.deltaHeader.orEmpty(), ThesisType.tableHead, true))
        }
    }
    return CompareTableNeeds(
        labelWide = labels.maxOf { (t, s) -> if (t.isEmpty()) 0 else measure(t, s) },
        labelWord = labels.maxOf { (t, s) -> words(t, s) },
        valueWide = List(n) { c ->
            model.rows.maxOfOrNull { r -> measure(cellText(model, r, c), ThesisType.tableNum) } ?: 0
        },
        headerLine = headers.map { h -> h.maxOf { (t, s, _) -> if (t.isEmpty()) 0 else measure(t, s) } },
        headerWrap = headers.map { h ->
            h.maxOf { (t, s, wraps) -> if (t.isEmpty()) 0 else if (wraps) twoLines(t, s) else twoLines(t, s, periods = true) }
        },
        headerWord = headers.map { h -> h.maxOf { (t, s, _) -> words(t, s) } },
        labelLines = rowLabels.map { (t, s) -> if (t.isEmpty()) 0 else measure(t, s) },
    )
}

/** [compareTableNeeds] measured with this composition's text measurer (density, font scale, fonts). */
@Composable
fun rememberCompareTableNeeds(model: CompareTableModel, sortedColumn: Int? = null): CompareTableNeeds {
    val measurer = rememberTextMeasurer()
    return remember(model, sortedColumn, measurer) {
        compareTableNeeds(model, sortedColumn) { text, style ->
            measurer.measure(AnnotatedString(text), style, softWrap = false).size.width
        }
    }
}

/** One density the table tries: cell [padding] per side, value column [columnMin], headers may [wrapHeaders]. */
@Immutable
data class CompareTableDensity(val padding: Int, val columnMin: Int, val wrapHeaders: Boolean)

/**
 * The widths the table takes (px): [padding] per cell side, the pinned [labelWidth], one width per value column
 * ([columnWidths], delta last). [scrolls] when even the compact density does not fit; [hidden] are the value columns
 * whose figures end past the panel's edge until the table is swiped.
 */
@Immutable
class CompareTableFit(
    val padding: Int,
    val labelWidth: Int,
    val columnWidths: List<Int>,
    val scrolls: Boolean,
    val hidden: List<Int>,
) {
    val width: Int get() = labelWidth + columnWidths.sum()
}

/**
 * Fits [needs] into [maxWidth] px (null: unbounded, natural widths). [densities] go from comfortable to compact. The
 * first density that keeps every column in view with nothing wrapped wins (only densities with one-line headers are
 * tried for that); else the first that keeps every column in view with labels wrapping between words (down to their
 * longest word) and headers too where the density allows: of one-line headers and wrapped ones, the shape with fewer
 * taller rows (each wrapped label is one, the header row one more when its headers wrap), one-line headers on a tie.
 * The spare width is spread over the value columns.
 * [columnFloor] keeps every value column at least that wide (48 dp when its header is a sort button). When none
 * fits, the [scrollDensity] is used with the label column capped at [labelMaxFraction] of the width (never under its
 * longest word, always leaving the first value column in view).
 */
fun fitCompareTable(
    needs: CompareTableNeeds,
    maxWidth: Int?,
    densities: List<CompareTableDensity>,
    scrollDensity: CompareTableDensity,
    columnFloor: Int = 0,
    labelMaxFraction: Float = LABEL_MAX_FRACTION,
): CompareTableFit {
    fun columns(d: CompareTableDensity, room: Int?): List<Int> = needs.valueWide.indices.map { c ->
        val pad = d.padding * 2
        val line = needs.headerLine[c] + pad
        val header = when {
            !d.wrapHeaders -> line
            // Wrapping between words, never narrower than the figures under it.
            room == null -> max(needs.headerWrap[c], needs.valueWide[c]) + pad
            line <= room -> line
            else -> max(room, max(needs.headerWord[c], needs.valueWide[c]) + pad)
        }
        maxOf(d.columnMin, columnFloor, needs.valueWide[c] + pad, header)
    }
    if (maxWidth == null) {
        val d = densities.first()
        return CompareTableFit(d.padding, needs.labelWide + d.padding * 2, columns(d, null), scrolls = false, hidden = emptyList())
    }
    // First a density at which nothing wraps (comfortable padding, one-line labels and headers), then the first at
    // which labels wrap between words and headers may wrap: a wrapped label costs a taller row, so it comes second.
    for (d in densities.filter { !it.wrapHeaders }) {
        val pad = d.padding * 2
        val cols = columns(d, null)
        val room = maxWidth - cols.sum()
        if (room >= needs.labelWide + pad) return spread(d.padding, needs.labelWide + pad, cols, room)
    }
    for (d in densities) {
        val pad = d.padding * 2
        // Headers on one line, or wrapped (when the density allows): whichever grows fewer rows. A header that wraps
        // gives its width to the labels, so fewer of them wrap ("No report yet" over a column with no figures).
        val oneLine = columns(d.copy(wrapHeaders = false), null)
        val shapes = listOfNotNull(oneLine to 0, if (d.wrapHeaders) columns(d, null).takeIf { it != oneLine }?.let { it to 1 } else null)
        val best = shapes
            .filter { (cols, _) -> maxWidth - cols.sum() >= needs.labelWord + pad }
            .minByOrNull { (cols, headerCost) ->
                val label = min(needs.labelWide + pad, maxWidth - cols.sum())
                headerCost + needs.labelLines.count { it + pad > label }
            } ?: continue
        val room = maxWidth - best.first.sum()
        return spread(d.padding, min(needs.labelWide + pad, room), best.first, room)
    }
    val d = scrollDensity
    val pad = d.padding * 2
    // The first value column's figures always stay in view beside the labels.
    val firstColumn = max(columnFloor, (needs.valueWide.firstOrNull() ?: 0) + pad)
    val labelW = (needs.labelWide + pad)
        .coerceAtMost((maxWidth * labelMaxFraction).toInt())
        .coerceAtLeast(needs.labelWord + pad)
        .coerceAtMost((maxWidth - firstColumn).coerceAtLeast(0))
    val cols = columns(d, maxWidth - labelW)
    val hidden = mutableListOf<Int>()
    var x = labelW
    cols.forEachIndexed { c, w ->
        x += w
        // Figures are end-aligned: a column is in view while its text is, even if its end padding is not.
        if (x - d.padding > maxWidth) hidden += c
    }
    return CompareTableFit(d.padding, labelW, cols, scrolls = labelW + cols.sum() > maxWidth, hidden = hidden)
}

/** A fit with the [room] beside the value columns: [label] to the labels, the rest spread over the value columns. */
private fun spread(padding: Int, label: Int, cols: List<Int>, room: Int): CompareTableFit {
    val spare = room - label
    val n = cols.size
    val widths = cols.mapIndexed { i, w -> w + spare / n + if (i == n - 1) spare % n else 0 }
    return CompareTableFit(padding, label, widths, scrolls = false, hidden = emptyList())
}

/** The kit's densities in px: comfortable, content-sized, compact (8 dp) and tight (6 dp). */
fun Density.compareTableDensities(): List<CompareTableDensity> {
    val comfortable = Kit.tableCellPaddingH.roundToPx()
    return listOf(
        CompareTableDensity(comfortable, Kit.tableColumnMin.roundToPx(), wrapHeaders = false),
        CompareTableDensity(comfortable, 0, wrapHeaders = false),
        CompareTableDensity(Kit.tableCellPaddingCompactH.roundToPx(), 0, wrapHeaders = true),
        CompareTableDensity(Kit.tableCellPaddingTightH.roundToPx(), 0, wrapHeaders = true),
    )
}

/** The density a table that cannot fit scrolls at: compact (8 dp), so more columns show before the swipe. */
fun Density.compareTableScrollDensity(): CompareTableDensity =
    CompareTableDensity(Kit.tableCellPaddingCompactH.roundToPx(), 0, wrapHeaders = true)

/** [fitCompareTable] with the kit's densities; [sortable] headers keep every column at 48 dp. */
fun Density.fitCompareTable(needs: CompareTableNeeds, maxWidth: Int?, sortable: Boolean = false): CompareTableFit =
    fitCompareTable(
        needs = needs,
        maxWidth = maxWidth,
        densities = compareTableDensities(),
        scrollDensity = compareTableScrollDensity(),
        columnFloor = if (sortable) ThesisSpace.touchMin.roundToPx() else 0,
    )

private const val LABEL_MAX_FRACTION = 0.42f

private fun labelStyleOf(row: CompareRow): TextStyle = if (row.median) ThesisType.label else ThesisType.bodySmall

private fun headerText(period: String, sorted: Boolean): String = if (sorted) "$period ↓" else period

private fun cellText(model: CompareTableModel, row: CompareRow, c: Int): String =
    if (c < model.columns.size) row.values[c] else row.delta ?: model.missingDelta

// ---------------------------------------------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------------------------------------------

private sealed interface CellId {
    data class Label(val row: Int) : CellId
    data class Value(val row: Int, val col: Int) : CellId
    data class Target(val row: Int) : CellId
}

/** Where the columns sit, written by the measure pass and read by a row's tap (which column was under it). */
private class TableGeometry {
    var labelWidth = 0
    var columnWidths: List<Int> = emptyList()
    var scroll = 0
    var width = 0
}

/**
 * The table (#30) in a `panel` card. Header rows: period per column (the [CompareColumn.subject] column in accent),
 * then the filing line. Values end-aligned `tableNum`; the delta column in its Tone. With [onHeaderClick] a header tap
 * sorts ([sortedColumn] shows "sorted"); with [onCellClick] each row is one touch target (48 dp tall, the full width)
 * and a tap opens the figure under the finger (its `SourceSheet`); a tap on the label opens the subject column's.
 * TalkBack reads the row and offers one "Source for …" action per column.
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
    val density = LocalDensity.current
    val needs = rememberCompareTableNeeds(model, sortedColumn)
    val scroll = remember { mutableFloatStateOf(0f) }
    // Written by the measure pass, read by the cells' padding (measure), the scroll handler and the shades (draw).
    val maxScroll = remember { mutableFloatStateOf(0f) }
    val labelWidth = remember { mutableIntStateOf(0) }
    val padding = remember { mutableIntStateOf(with(density) { Kit.tableCellPaddingH.roundToPx() }) }
    val geometry = remember { TableGeometry() }
    // Per value column, how much of its header shows (written by the placement, read by the header's draw): a column
    // past the panel's end edge shows its header only as its widest line comes whole into view, so a lone first word
    // ("No" of "No report yet") never peeks in beside the last column in view.
    val headerReveal = remember(model.valueColumnCount) { List(model.valueColumnCount) { mutableFloatStateOf(1f) } }
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val scrollable = rememberScrollableState { delta ->
        val signed = if (rtl) delta else -delta
        val target = (scroll.floatValue + signed).coerceIn(0f, maxScroll.floatValue)
        val consumed = target - scroll.floatValue
        scroll.floatValue = target
        if (rtl) consumed else -consumed
    }
    val valueCols = model.valueColumnCount
    val headerRows = if (model.columns.any { it.filing != null }) 2 else 1
    val interactive = onCellClick != null
    val rowMin = if (interactive) ThesisSpace.touchMin else ThesisSpace.xxs
    val headMin = if (onHeaderClick != null) ThesisSpace.touchMin else ThesisSpace.xxs
    val subjectColumn = model.columns.indexOfFirst { it.subject }.coerceAtLeast(0)
    val cellClick by rememberUpdatedState(onCellClick)

    Box(
        modifier
            .fillMaxWidth()
            .kitCardShadow(p, ThesisShape.PanelRadius)
            // Clip to the panel shape before the cells paint, so their opaque fills keep the 12 dp corners.
            .clip(ThesisShape.panel)
            .background(p.surface)
            .scrollable(scrollable, Orientation.Horizontal),
    ) {
        Layout(
            modifier = Modifier.drawWithContent {
                drawContent()
                drawScrollShades(
                    shade = p.ink.copy(alpha = Kit.TABLE_SCROLL_SHADE_ALPHA),
                    width = Kit.tableCellPaddingH.toPx() * 2,
                    labelEdge = labelWidth.intValue.toFloat(),
                    before = scroll.floatValue,
                    after = maxScroll.floatValue - scroll.floatValue,
                    rtl = rtl,
                )
            },
            content = {
                // Header: the label header and one cell per value column (period over filing).
                HeaderLabel(model.labelHeader, padding, Modifier.layoutId(CellId.Label(-1)))
                model.columns.forEachIndexed { c, col ->
                    val click = onHeaderClick?.let { { it(c) } }
                    HeaderCell(
                        period = col.period,
                        filing = col.filing.takeIf { headerRows == 2 },
                        accent = col.subject,
                        sorted = sortedColumn == c,
                        fill = p.surface,
                        padding = padding,
                        onClick = click,
                        reveal = headerReveal[c],
                        modifier = Modifier.layoutId(CellId.Value(-1, c)),
                    )
                }
                val deltaFill = if (model.deltaIsMedian) p.surface2 else p.surface
                if (model.deltaHeader != null) {
                    HeaderCell(
                        model.deltaHeader, null, false, false, deltaFill, padding, null, headerReveal[valueCols - 1],
                        Modifier.layoutId(CellId.Value(-1, valueCols - 1)),
                    )
                }
                model.rows.forEachIndexed { r, row ->
                    val fill = if (row.median) p.surface2 else p.surface
                    // Label and values share one line height with proportional line spacing, so their first
                    // baselines coincide in every row (same family: the baseline no longer depends on font size).
                    val labelStyle = labelStyleOf(row).copy(lineHeightStyle = TableLines)
                    val valueStyle = ThesisType.tableNum.copy(lineHeight = labelStyle.lineHeight, lineHeightStyle = TableLines)
                    // A touch row is 48 dp: its first line sits centred in it, a wrapped label grows it downwards.
                    val (top, bottom) = rowPadding(interactive, labelStyle, density)
                    Text(
                        model.labelShown(row),
                        modifier = Modifier
                            .layoutId(CellId.Label(r))
                            .background(fill)
                            .then(
                                if (interactive) {
                                    Modifier.clearAndSetSemantics { }
                                } else {
                                    Modifier.semantics { contentDescription = model.describe(row) }
                                },
                            )
                            .cellPadding(padding, top, bottom),
                        style = labelStyle,
                        color = if (row.median) p.ink2 else p.ink,
                    )
                    for (c in 0 until valueCols) {
                        val delta = c >= model.columns.size
                        ValueCell(
                            text = cellText(model, row, c),
                            style = valueStyle,
                            color = when {
                                delta -> row.deltaTone.textColor(p)
                                model.columns[c].subject -> p.ink
                                else -> p.ink2
                            },
                            fill = if (delta && !row.median) deltaFill else fill,
                            padding = padding,
                            top = top,
                            bottom = bottom,
                            modifier = Modifier.layoutId(CellId.Value(r, c)),
                        )
                    }
                    if (interactive) {
                        RowTarget(
                            description = model.describe(row),
                            actions = model.columns.mapIndexed { c, col ->
                                CustomAccessibilityAction("Source for ${CompareTableModel.spoken(col.period)}") {
                                    cellClick?.invoke(r, c)
                                    true
                                }
                            },
                            columnAt = { x -> if (x == null) subjectColumn else columnAt(geometry, x, rtl, model.columns.size, subjectColumn) },
                            onClick = { col -> cellClick?.invoke(r, col) },
                            modifier = Modifier.layoutId(CellId.Target(r)),
                        )
                    }
                }
            },
        ) { measurables, constraints ->
            val byId = measurables.associateBy { it.layoutId as CellId }
            val rowsAll = (-1 until model.rows.size)
            val bounded = constraints.hasBoundedWidth
            val fit = fitCompareTable(needs, if (bounded) constraints.maxWidth else null, sortable = onHeaderClick != null)
            // The cells read the padding while they measure, below.
            padding.intValue = fit.padding
            val labelW = fit.labelWidth
            val colW = fit.columnWidths
            labelWidth.intValue = labelW
            val rowH = IntArray(model.rows.size + 1) { i ->
                val r = i - 1
                val label = byId.getValue(CellId.Label(r)).minIntrinsicHeight(labelW)
                val values = (0 until valueCols).maxOf { c -> byId.getValue(CellId.Value(r, c)).minIntrinsicHeight(colW[c]) }
                maxOf(label, values, (if (r == -1) headMin else rowMin).roundToPx())
            }
            val width = if (bounded) constraints.maxWidth else fit.width
            maxScroll.floatValue = (fit.width - width).coerceAtLeast(0).toFloat()
            if (scroll.floatValue > maxScroll.floatValue) scroll.floatValue = maxScroll.floatValue
            val fixed = { w: Int, h: Int -> Constraints.fixed(w, h) }
            val labels = rowsAll.map { r -> byId.getValue(CellId.Label(r)).measure(fixed(labelW, rowH[r + 1])) }
            val values = rowsAll.map { r -> (0 until valueCols).map { c -> byId.getValue(CellId.Value(r, c)).measure(fixed(colW[c], rowH[r + 1])) } }
            val targets = model.rows.indices.map { r -> byId[CellId.Target(r)]?.measure(fixed(width, rowH[r + 1])) }
            val height = rowH.sum()
            geometry.labelWidth = labelW
            geometry.columnWidths = colW
            geometry.width = width
            layout(width, height) {
                val off = scroll.floatValue.toInt()
                geometry.scroll = off
                // A header shows once its widest line is two thirds in view, fully once it is whole.
                var end = labelW - off
                colW.forEachIndexed { c, w ->
                    end += w
                    val text = min(needs.headerLine[c], w - 2 * fit.padding).coerceAtLeast(1)
                    val inView = (width - (end - fit.padding - text)).toFloat() / text
                    headerReveal.getOrNull(c)?.floatValue = ((inView - REVEAL_FROM) / (1f - REVEAL_FROM)).coerceIn(0f, 1f)
                }
                var y = 0
                rowsAll.forEachIndexed { i, r ->
                    var x = labelW - off
                    values[i].forEachIndexed { c, pl ->
                        pl.placeRelative(x, y)
                        x += colW[c]
                    }
                    labels[i].placeRelative(0, y, zIndex = 1f)
                    if (r >= 0) targets[r]?.placeRelative(0, y, zIndex = 2f)
                    y += rowH[i]
                }
            }
        }
        // The outline on top of the cells, so their fills never cover it.
        Box(Modifier.matchParentSize().border(ThesisSpace.border, p.line, ThesisShape.panel))
    }
}

/** The share of a past-the-edge header's widest line in view at which it starts to show. */
private const val REVEAL_FROM = 2f / 3f

/** The value column under [x] (px from the table's left edge); the label column opens [subject]; the delta none. */
private fun columnAt(g: TableGeometry, x: Float, rtl: Boolean, valueColumns: Int, subject: Int): Int? {
    val logical = if (rtl) g.width - x else x
    if (logical < g.labelWidth) return subject
    var edge = (g.labelWidth - g.scroll).toFloat()
    g.columnWidths.forEachIndexed { c, w ->
        edge += w
        if (logical < edge) return c.takeIf { it < valueColumns }
    }
    return null
}

/**
 * Vertical cell padding: comfortable (10 dp) for a read-only table; in a touch row the first line sits centred in
 * the 48 dp row and the bottom keeps a 4 dp margin, so a wrapped label grows the row downwards only.
 */
private fun rowPadding(interactive: Boolean, style: TextStyle, density: Density): Pair<Dp, Dp> {
    if (!interactive) return Kit.tableCellPaddingV to Kit.tableCellPaddingV
    val top = with(density) { ((ThesisSpace.touchMin.toPx() - style.lineHeight.toPx()) / 2f).toDp() }
    return maxOf(top, ThesisSpace.xs) to ThesisSpace.xs
}

/** Cell padding: [horizontal] px per side as the fit chose it (read while measuring), [top] and [bottom] fixed. */
private fun Modifier.cellPadding(horizontal: IntState, top: Dp, bottom: Dp): Modifier =
    layout { measurable, constraints ->
        val h = horizontal.intValue
        val t = top.roundToPx()
        val b = bottom.roundToPx()
        val placeable = measurable.measure(constraints.offset(horizontal = -2 * h, vertical = -(t + b)))
        layout(constraints.constrainWidth(placeable.width + 2 * h), constraints.constrainHeight(placeable.height + t + b)) {
            placeable.placeRelative(h, t)
        }
    }

/**
 * Scroll cues for the value columns. Values are right-aligned, so a column past the edge often shows nothing in
 * the sliver that peeks in; a soft [shade] at the end edge says "more this way" while [after] > 0, and one beside
 * the pinned label column ([labelEdge]) while [before] > 0. Each fades in over its first [width] of scroll.
 */
private fun DrawScope.drawScrollShades(shade: Color, width: Float, labelEdge: Float, before: Float, after: Float, rtl: Boolean) {
    if (width <= 0f) return
    val clear = shade.copy(alpha = 0f)
    fun band(x: Float, towardStart: Boolean, amount: Float) {
        if (amount <= 0f) return
        val colors = if (towardStart) listOf(shade, clear) else listOf(clear, shade)
        drawRect(
            Brush.horizontalGradient(colors, startX = x, endX = x + width),
            topLeft = Offset(x, 0f),
            size = Size(width, size.height),
            alpha = (amount / width).coerceAtMost(1f),
        )
    }
    if (rtl) {
        band(0f, towardStart = true, amount = after)
        band(size.width - labelEdge - width, towardStart = false, amount = before)
    } else {
        band(size.width - width, towardStart = false, amount = after)
        band(labelEdge, towardStart = true, amount = before)
    }
}

@Composable
private fun HeaderLabel(text: String, padding: IntState, modifier: Modifier) {
    val p = LocalThesisPalette.current
    Box(
        modifier.background(p.surface).cellPadding(padding, Kit.tableCellPaddingV, Kit.tableCellPaddingV),
        contentAlignment = Alignment.TopStart,
    ) {
        Text(text, style = ThesisType.tableHead, color = p.muted)
    }
}

@Composable
private fun HeaderCell(
    period: String,
    filing: String?,
    accent: Boolean,
    sorted: Boolean,
    fill: Color,
    padding: IntState,
    onClick: (() -> Unit)?,
    reveal: FloatState,
    modifier: Modifier,
) {
    val p = LocalThesisPalette.current
    val source = remember { MutableInteractionSource() }
    Column(
        modifier
            .background(fill)
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
                if (sorted) contentDescription = "${CompareTableModel.spoken(period)}, sorted"
            }
            // Only the text fades with [reveal]; the cell's fill stays.
            .graphicsLayer { alpha = reveal.floatValue }
            .cellPadding(padding, Kit.tableCellPaddingV, Kit.tableCellPaddingV),
        horizontalAlignment = Alignment.End,
    ) {
        Text(
            headerText(period, sorted),
            style = ThesisType.tableHead,
            color = if (accent) p.accent else p.ink,
            textAlign = TextAlign.End,
        )
        if (filing != null) FilingLine(filing, p.muted)
    }
}

/**
 * The filing line, end-aligned: on one line when it fits ("10-K · 31 Oct 2025"), else stacked at its " · "
 * separators, which then go ("10-K" over "31 Oct 2025"; never "10-K · 31" over "Oct 2025"), as [compareTableNeeds]
 * sizes it. A line with no separator wraps between words. Spoken as the one line.
 */
@Composable
private fun FilingLine(filing: String, color: Color) {
    if (" · " !in filing) {
        Text(filing, style = ThesisType.tick, color = color, textAlign = TextAlign.End)
        return
    }
    val parts = filing.split(" · ").map { it.trim().replace(' ', '\u00A0') }
    Layout(
        content = {
            Text(parts.joinToString(" · "), style = ThesisType.tick, color = color, textAlign = TextAlign.End, maxLines = 1, softWrap = false)
            Text(parts.joinToString("\n"), style = ThesisType.tick, color = color, textAlign = TextAlign.End)
        },
        modifier = Modifier.clearAndSetSemantics { text = AnnotatedString(filing) },
        measurePolicy = FilingLinePolicy,
    )
}

/** Places the one-line filing (first child) when it fits the width, else the stacked one (second). */
private object FilingLinePolicy : MeasurePolicy {
    private fun oneLineFits(measurables: List<IntrinsicMeasurable>, width: Int) =
        measurables[0].maxIntrinsicWidth(Constraints.Infinity) <= width

    override fun MeasureScope.measure(measurables: List<Measurable>, constraints: Constraints): MeasureResult {
        val loose = constraints.copy(minWidth = 0, minHeight = 0)
        val one = measurables[0].measure(loose.copy(maxWidth = Constraints.Infinity))
        val placeable = if (one.width <= constraints.maxWidth) one else measurables[1].measure(loose)
        return layout(constraints.constrainWidth(placeable.width), constraints.constrainHeight(placeable.height)) {
            // End-aligned in the space given.
            placeable.placeRelative(constraints.constrainWidth(placeable.width) - placeable.width, 0)
        }
    }

    override fun IntrinsicMeasureScope.minIntrinsicWidth(measurables: List<IntrinsicMeasurable>, height: Int) =
        measurables[1].minIntrinsicWidth(height)

    override fun IntrinsicMeasureScope.maxIntrinsicWidth(measurables: List<IntrinsicMeasurable>, height: Int) =
        measurables[0].maxIntrinsicWidth(height)

    override fun IntrinsicMeasureScope.minIntrinsicHeight(measurables: List<IntrinsicMeasurable>, width: Int) =
        if (oneLineFits(measurables, width)) measurables[0].minIntrinsicHeight(width) else measurables[1].minIntrinsicHeight(width)

    override fun IntrinsicMeasureScope.maxIntrinsicHeight(measurables: List<IntrinsicMeasurable>, width: Int) =
        if (oneLineFits(measurables, width)) measurables[0].maxIntrinsicHeight(width) else measurables[1].maxIntrinsicHeight(width)
}

/** Proportional line spacing for table cells: with equal line heights, label and value baselines line up. */
private val TableLines = LineHeightStyle(
    alignment = LineHeightStyle.Alignment.Proportional,
    trim = LineHeightStyle.Trim.None,
)

/** A figure: end-aligned, one line, never wrapped or cut (its column is as wide as its widest figure). */
@Composable
private fun ValueCell(
    text: String,
    style: TextStyle,
    color: Color,
    fill: Color,
    padding: IntState,
    top: Dp,
    bottom: Dp,
    modifier: Modifier,
) {
    Box(
        modifier
            .background(fill)
            // The row speaks the whole row (the label cell, or the row's touch target).
            .clearAndSetSemantics { }
            .cellPadding(padding, top, bottom),
        contentAlignment = Alignment.TopEnd,
    ) {
        Text(text, style = style, color = color, textAlign = TextAlign.End, maxLines = 1, softWrap = false)
    }
}

/**
 * A row's one touch target, over its cells: the kit press tint across the whole row where a tap opens something,
 * [columnAt] the value column under the tap's x (null x for TalkBack's and the keyboard's click: the subject column;
 * null back for the delta column, which opens nothing and shows no press), [onClick] opens it, one custom action per
 * column. It takes focus for a hardware keyboard or D-pad (Enter or centre opens, with the press tint while focused).
 */
@Composable
private fun RowTarget(
    description: String,
    actions: List<CustomAccessibilityAction>,
    columnAt: (x: Float?) -> Int?,
    onClick: (col: Int) -> Unit,
    modifier: Modifier,
) {
    val p = LocalThesisPalette.current
    val source = remember { MutableInteractionSource() }
    val focused by source.collectIsFocusedAsState()
    val at by rememberUpdatedState(columnAt)
    val click by rememberUpdatedState(onClick)
    val open = { x: Float? -> at(x)?.let { click(it) } != null }
    Box(
        modifier
            .pointerInput(source) {
                detectTapGestures(
                    onPress = { offset ->
                        if (at(offset.x) == null) return@detectTapGestures
                        val press = PressInteraction.Press(offset)
                        source.emit(press)
                        val released = tryAwaitRelease()
                        source.emit(if (released) PressInteraction.Release(press) else PressInteraction.Cancel(press))
                    },
                    onTap = { offset -> open(offset.x) },
                )
            }
            .onKeyEvent { e ->
                if (!e.isActivation()) return@onKeyEvent false
                if (e.type == KeyEventType.KeyUp) open(null)
                true
            }
            .focusable(interactionSource = source)
            .thesisPress(source)
            .drawWithContent {
                drawContent()
                if (focused) drawRect(ThesisMotion.pressTint(p))
            }
            .semantics {
                role = Role.Button
                contentDescription = description
                customActions = actions
                onClick(label = "Show source") { open(null) }
            },
    )
}

/** Enter, numpad Enter, D-pad centre or Space: the keys that click a focused control. */
private fun KeyEvent.isActivation(): Boolean =
    key == Key.Enter || key == Key.NumPadEnter || key == Key.DirectionCenter || key == Key.Spacebar
