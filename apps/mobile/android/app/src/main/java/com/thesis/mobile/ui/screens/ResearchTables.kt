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
import com.thesis.mobile.ui.components.CompareTable
import com.thesis.mobile.ui.components.CompareTableModel
import com.thesis.mobile.ui.components.fitCompareTable
import com.thesis.mobile.ui.components.rememberCompareTableNeeds
import com.thesis.mobile.ui.copy.ResearchCopy
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType

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
    val density = LocalDensity.current
    // The kit's own fit (the same needs and densities the table lays out with), so the caption never disagrees.
    val needs = rememberCompareTableNeeds(model, sortedColumn)
    BoxWithConstraints(modifier.fillMaxWidth()) {
        val widthPx = constraints.maxWidth
        val hidden = remember(needs, widthPx, density, onHeaderClick != null) {
            with(density) { fitCompareTable(needs, widthPx, sortable = onHeaderClick != null) }.hidden
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
