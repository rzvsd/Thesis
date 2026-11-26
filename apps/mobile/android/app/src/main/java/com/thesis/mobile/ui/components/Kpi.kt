package com.thesis.mobile.ui.components

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.text
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.SpanStyle
import com.thesis.mobile.ui.motion.thesisPress
import com.thesis.mobile.ui.theme.Kit
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisShape
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone
import com.thesis.mobile.ui.theme.textColor
import com.thesis.mobile.ui.theme.tnum

/*
 * KPI tiles and grids (docs/app-redesign/DESIGN-DIRECTION.md, section 3 #8). Results first, with their reference
 * point: every tile shows what its value is compared with. Values never ellipsize and never break inside a number
 * (2.3): a value that does not fit its cell steps down one style ([FitFigure]); the label wraps.
 */

/** One KPI: [label] carries the period ("Revenue, FY2025"); [delta] has its sign; [reference] says "vs FY2024". */
@Immutable
data class KpiSpec(
    val label: String,
    val value: String,
    val delta: String? = null,
    val deltaTone: Tone = Tone.Neutral,
    val reference: String? = null,
    /**
     * A 0..1 position on the figure's scale, drawn as the subject [Meter] (accent) under the value: the one subject
     * meter of a page (Name's Monitor score, 0 to 100). Null: no meter.
     */
    val meter: Float? = null,
)

/**
 * A KPI tile: `caption` label, the value (`statValue` on paper, `kpiValue` when [featured]: in a HeroBand or the
 * screen's one featured grid), and a delta line (tone colour, with its sign) plus the reference. [onClick] opens
 * the SourceSheet (or navigates, then [onLongClick] opens the SourceSheet). TalkBack reads one merged sentence.
 * [valueStep] starts the value further down its style steps ([kpiValueStyles]); [KpiGrid] passes one step for the
 * whole grid so its figures share a size.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun KpiTile(
    spec: KpiSpec,
    modifier: Modifier = Modifier,
    featured: Boolean = false,
    onClick: (() -> Unit)? = null,
    onLongClick: (() -> Unit)? = null,
    valueStep: Int = 0,
    interactionSource: MutableInteractionSource = remember { MutableInteractionSource() },
) {
    val p = LocalThesisPalette.current
    val styles = kpiValueStyles(featured)
    val spoken = listOfNotNull(spec.label, spec.value, spec.delta, spec.reference).joinToString(", ")
    val interactive = onClick != null || onLongClick != null
    KpiCellColumn(
        modifier
            .then(
                if (interactive) {
                    Modifier.combinedClickable(
                        interactionSource = interactionSource,
                        indication = null,
                        role = Role.Button,
                        onLongClick = onLongClick,
                        onClick = onClick ?: {},
                    )
                } else {
                    Modifier
                },
            )
            .semantics(mergeDescendants = true) { contentDescription = spoken }
            .thesisPress(interactionSource, enabled = interactive),
    ) {
        Text(spec.label, style = ThesisType.caption, color = p.ink2)
        FitFigure(spec.value, styles.subList(valueStep.coerceIn(0, styles.lastIndex), styles.size), color = p.ink)
        if (spec.meter != null) {
            Meter(spec.meter, Modifier.padding(vertical = ThesisSpace.xxs), subject = true)
        }
        if (spec.delta != null || spec.reference != null) {
            Text(
                buildAnnotatedString {
                    if (spec.delta != null) {
                        withStyle(SpanStyle(color = spec.deltaTone.textColor(p))) { append(spec.delta) }
                        if (spec.reference != null) append(" ")
                    }
                    if (spec.reference != null) withStyle(SpanStyle(color = p.muted)) { append(spec.reference) }
                },
                style = ThesisType.caption,
            )
        }
    }
}

/**
 * A KPI grid: 2 columns below 560 dp, 3 at 560 dp and wider; cells on a `line` background with 1 dp gaps, `panel`
 * radius. [onItemClick] makes each tile open its SourceSheet. All values share one style: the largest step at which
 * every value fits its cell on one line (2.3), so a long figure at 2.0x on 360 dp steps the whole grid down
 * together instead of leaving one tile smaller than its neighbours; if even the smallest step does not fit, the grid
 * goes to one column. A value never breaks.
 */
@Composable
fun KpiGrid(
    items: List<KpiSpec>,
    modifier: Modifier = Modifier,
    featured: Boolean = false,
    onItemClick: ((Int) -> Unit)? = null,
) {
    val values = remember(items) { items.map { it.value } }
    KpiGridLayout(items.size, modifier, fitValues = values, featured = featured) { i, step ->
        KpiTile(
            items[i],
            Modifier.fillMaxWidth(),
            featured = featured,
            onClick = onItemClick?.let { { it(i) } },
            valueStep = step,
        )
    }
}

/**
 * The KPI cell's padding (DD 12 x 14) and rhythm, shared by [KpiTile] and [SkeletonKpiGrid] so the skeleton has
 * the final grid's row heights and the crossfade to content does not jump (#25).
 */
@Composable
internal fun KpiCellColumn(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier.padding(horizontal = Kit.kpiCellPaddingH, vertical = ThesisSpace.m),
        verticalArrangement = Arrangement.spacedBy(ThesisSpace.xxs),
        content = content,
    )
}

/** The KPI value's styles, largest first: `kpiValue` (featured), `statValue`, then `body` with tabular figures. */
@Composable
internal fun kpiValueStyles(featured: Boolean): List<TextStyle> = remember(featured) {
    val steps = listOf(ThesisType.statValue, ThesisType.body.tnum())
    if (featured) listOf(ThesisType.kpiValue) + steps else steps
}

/**
 * A figure on one line (2.3: numbers never ellipsize or break): it takes the first of [styles] whose single line
 * fits the width it is given, so "$391.0bn" in a 2.0x, 360 dp grid steps down a style instead of splitting into
 * "$391.0b / n". Only if even the last style does not fit does it wrap, at spaces. The candidates carry no
 * semantics; the figure is one text node for TalkBack and tests.
 */
@Composable
fun FitFigure(text: String, styles: List<TextStyle>, color: Color, modifier: Modifier = Modifier) {
    require(styles.isNotEmpty()) { "FitFigure needs at least one style" }
    Layout(
        content = {
            styles.forEachIndexed { i, style ->
                val last = i == styles.lastIndex
                Text(
                    text,
                    modifier = Modifier.clearAndSetSemantics { },
                    style = style,
                    color = color,
                    softWrap = last,
                    maxLines = if (last) Int.MAX_VALUE else 1,
                )
            }
        },
        modifier = modifier.semantics { this.text = AnnotatedString(text) },
    ) { measurables, constraints ->
        val chosen = if (!constraints.hasBoundedWidth) {
            measurables.first()
        } else {
            measurables.firstOrNull { it.maxIntrinsicWidth(Constraints.Infinity) <= constraints.maxWidth }
                ?: measurables.last()
        }
        val placeable = chosen.measure(constraints)
        layout(placeable.width, placeable.height) { placeable.placeRelative(0, 0) }
    }
}

/**
 * Grid scaffold shared by [KpiGrid] and the KPI skeleton. [cell] gets its index and the value style step at which
 * every one of [fitValues] fits its cell on one line (0 when [fitValues] is empty); if none fits at two or three
 * columns the grid uses one.
 */
@Composable
internal fun KpiGridLayout(
    count: Int,
    modifier: Modifier = Modifier,
    fitValues: List<String> = emptyList(),
    featured: Boolean = false,
    cell: @Composable (index: Int, valueStep: Int) -> Unit,
) {
    val p = LocalThesisPalette.current
    val cellFill = if (LocalInHeroBand.current) p.bg else p.surface
    val measurer = rememberTextMeasurer()
    val styles = kpiValueStyles(featured)
    BoxWithConstraints(modifier.fillMaxWidth()) {
        val density = LocalDensity.current
        val wide = if (maxWidth >= Kit.kpiThreeColumnsFrom) 3 else 2
        // Width a value has in a cell at a column count: the cell (outer 1 dp border, 1 dp gaps) less its padding.
        fun innerPx(columns: Int): Int = with(density) {
            val cellPx = (maxWidth.toPx() - ThesisSpace.border.toPx() * (columns + 1)) / columns
            (cellPx - Kit.kpiCellPaddingH.toPx() * 2).toInt()
        }
        // The first style at which every value fits on one line, or null if none does.
        fun fitStep(width: Int): Int? = styles.indices.firstOrNull { i ->
            fitValues.all { v -> measurer.measure(AnnotatedString(v), styles[i], softWrap = false, maxLines = 1).size.width <= width }
        }
        // (columns, step). When even the smallest style overflows a cell (a long figure at 2.0x on 360 dp), the grid
        // drops to one column rather than break a number.
        val (columns, step) = remember(fitValues, styles, maxWidth, density) {
            if (fitValues.isEmpty() || !constraints.hasBoundedWidth) {
                wide to 0
            } else {
                fitStep(innerPx(wide))?.let { wide to it } ?: (1 to (fitStep(innerPx(1)) ?: styles.lastIndex))
            }
        }
        val rows = (count + columns - 1) / columns
        Column(
            Modifier
                .fillMaxWidth()
                .clip(ThesisShape.panel)
                .background(p.line)
                .padding(ThesisSpace.border),
            verticalArrangement = Arrangement.spacedBy(ThesisSpace.border),
        ) {
            for (r in 0 until rows) {
                Row(
                    Modifier.fillMaxWidth().height(IntrinsicSize.Min),
                    horizontalArrangement = Arrangement.spacedBy(ThesisSpace.border),
                ) {
                    for (c in 0 until columns) {
                        val i = r * columns + c
                        Box(Modifier.weight(1f).fillMaxHeight().background(cellFill)) {
                            if (i < count) cell(i, step)
                        }
                    }
                }
            }
        }
    }
}
