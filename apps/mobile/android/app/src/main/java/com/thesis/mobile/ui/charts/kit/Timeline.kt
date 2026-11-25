package com.thesis.mobile.ui.charts.kit

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import com.thesis.mobile.ui.copy.ChartCopy
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType

/*
 * Timeline (section 3 "Charts"; Conviction journal, War Room phases): a 2 dp `line2` rail, 12 dp rings (2 dp
 * series[0] border, surface fill), items 16 dp apart. The ring sits on the title's first line, in the 24 dp
 * leading column of the row anatomy (text on edge E2 inside a card).
 */

/** Where an item stands: done (gold ring), current (gold ring with a gold core) or upcoming (`line2` ring). */
enum class TimelineState { Done, Current, Upcoming }

/** One entry: [title] (rowTitle), [meta] (caption: date, phase), [body] (bodySmall ink2). */
@Immutable
data class TimelineItem(
    val title: String,
    val meta: String? = null,
    val body: String? = null,
    val state: TimelineState = TimelineState.Done,
)

/** The vertical timeline. Each item is one TalkBack stop with its state ("Current"). */
@Composable
fun Timeline(items: List<TimelineItem>, modifier: Modifier = Modifier) {
    val p = LocalThesisPalette.current
    val density = LocalDensity.current
    val titleLine = with(density) { ThesisType.rowTitle.lineHeight.toDp() }
    Column(modifier.fillMaxWidth()) {
        items.forEachIndexed { index, item ->
            val last = index == items.lastIndex
            Row(
                Modifier
                    .fillMaxWidth()
                    .height(IntrinsicSize.Min)
                    .semantics(mergeDescendants = true) { stateDescription = stateWord(item.state) },
            ) {
                Box(
                    Modifier
                        .width(ThesisSpace.leadingColumn)
                        .fillMaxHeight()
                        .drawBehind {
                            val ring = ChartDims.ring.toPx()
                            val border = ChartDims.ringBorder.toPx()
                            val cx = size.width / 2f
                            val cy = titleLine.toPx() / 2f
                            if (!last) {
                                // The rail runs from this ring down through the gap to the next one.
                                drawLine(
                                    p.line2,
                                    Offset(cx, cy + ring / 2f),
                                    Offset(cx, size.height + ChartDims.timelineGap.toPx() + cy - ring / 2f),
                                    ChartDims.rail.toPx(),
                                )
                            }
                            val stroke = if (item.state == TimelineState.Upcoming) p.line2 else p.series[0]
                            drawCircle(p.surface, ring / 2f, Offset(cx, cy))
                            drawCircle(stroke, (ring - border) / 2f, Offset(cx, cy), style = Stroke(border))
                            if (item.state == TimelineState.Current) {
                                drawCircle(p.series[0], ChartDims.ringCore.toPx() / 2f, Offset(cx, cy))
                            }
                        },
                )
                Spacer(Modifier.width(ThesisSpace.leadingGap))
                Column(Modifier.weight(1f)) {
                    Text(item.title, style = ThesisType.rowTitle, color = if (item.state == TimelineState.Upcoming) p.ink2 else p.ink)
                    if (item.meta != null) Text(item.meta, style = ThesisType.caption, color = p.muted)
                    if (item.body != null) {
                        Spacer(Modifier.height(ThesisSpace.xs))
                        Text(item.body, style = ThesisType.bodySmall, color = p.ink2)
                    }
                }
            }
            if (!last) Spacer(Modifier.height(ChartDims.timelineGap))
        }
    }
}

private fun stateWord(state: TimelineState): String = when (state) {
    TimelineState.Done -> ChartCopy.DONE
    TimelineState.Current -> ChartCopy.CURRENT
    TimelineState.Upcoming -> ChartCopy.UPCOMING
}
