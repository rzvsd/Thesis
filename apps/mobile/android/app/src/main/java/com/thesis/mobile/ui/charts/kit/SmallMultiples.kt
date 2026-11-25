package com.thesis.mobile.ui.charts.kit

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType

/*
 * SmallMultiples (section 3 "Charts"; Compare names "Show chart", the alternative to indexed lines): a two-column
 * grid of compact ColumnCharts, one per ticker, all on one shared y scale per metric, so heights compare across
 * cells. Tick labels only on the left column (the scale is shared); the right column keeps their width, so both
 * columns have the same plot and their x labels line up.
 */

/** One cell: [title] (the ticker), its [values] over [xLabels], an optional [caption] ("Revenue, FY2025"). */
@Immutable
data class SmallMultiple(
    val title: String,
    val values: List<Double?>,
    val xLabels: List<String>,
    val caption: String? = null,
)

/**
 * The grid. [valueFormat] labels each cell's latest column; ticks use [tickFormat]. [dataKey] draws every cell on
 * once for this data identity.
 */
@Composable
fun SmallMultiples(
    items: List<SmallMultiple>,
    modifier: Modifier = Modifier,
    valueFormat: (Double) -> String = { Fmt.number(it, 1) },
    tickFormat: (Double) -> String = valueFormat,
    highlightLast: Boolean = true,
    dataKey: Any? = null,
    emptyText: String = CHART_NO_DATA,
) {
    if (items.isEmpty() || items.all { m -> m.values.all { it.finiteOrNull() == null } }) {
        ChartEmpty(emptyText, modifier)
        return
    }
    val p = LocalThesisPalette.current
    val shared = remember(items) { ChartMath.niceScale(items.flatMap { it.values }, target = 3, includeZero = true) }
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(ThesisSpace.l)) {
        items.chunked(2).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(ThesisSpace.m), verticalAlignment = Alignment.Top) {
                row.forEachIndexed { col, item ->
                    Column(Modifier.weight(1f)) {
                        Text(item.title, modifier = Modifier.semantics { heading() }, style = ThesisType.rowTitle, color = p.ink)
                        if (item.caption != null) Text(item.caption, style = ThesisType.caption, color = p.muted)
                        Spacer(Modifier.height(ThesisSpace.xs))
                        ColumnChart(
                            series = listOf(ChartSeries(item.title, item.values)),
                            xLabels = item.xLabels,
                            valueFormat = valueFormat,
                            tickFormat = tickFormat,
                            height = ChartHeights.Multiple,
                            highlightLast = highlightLast,
                            scale = shared,
                            showYLabels = col == 0,
                            reserveYLabels = true,
                            dataKey = dataKey?.let { it to item.title },
                            summary = ChartMath.summary(item.title, item.values, valueFormat),
                            emptyText = emptyText,
                        )
                    }
                }
                if (row.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}
