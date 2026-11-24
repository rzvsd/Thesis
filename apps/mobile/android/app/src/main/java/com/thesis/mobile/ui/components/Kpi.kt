package com.thesis.mobile.ui.components

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
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
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.SpanStyle
import com.thesis.mobile.ui.motion.thesisPress
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisShape
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone
import com.thesis.mobile.ui.theme.textColor

/*
 * KPI tiles and grids (docs/app-redesign/DESIGN-DIRECTION.md, section 3 #8). Results first, with their reference
 * point: every tile shows what its value is compared with. Values never ellipsize: they wrap.
 */

/** One KPI: [label] carries the period ("Revenue, FY2025"); [delta] has its sign; [reference] says "vs FY2024". */
@Immutable
data class KpiSpec(
    val label: String,
    val value: String,
    val delta: String? = null,
    val deltaTone: Tone = Tone.Neutral,
    val reference: String? = null,
)

/**
 * A KPI tile: `caption` label, the value (`statValue` on paper, `kpiValue` when [featured]: in a HeroBand or the
 * screen's one featured grid), and a delta line (tone colour, with its sign) plus the reference. [onClick] opens
 * the SourceSheet (or navigates, then [onLongClick] opens the SourceSheet). TalkBack reads one merged sentence.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun KpiTile(
    spec: KpiSpec,
    modifier: Modifier = Modifier,
    featured: Boolean = false,
    onClick: (() -> Unit)? = null,
    onLongClick: (() -> Unit)? = null,
    interactionSource: MutableInteractionSource = remember { MutableInteractionSource() },
) {
    val p = LocalThesisPalette.current
    val spoken = listOfNotNull(spec.label, spec.value, spec.delta, spec.reference).joinToString(", ")
    val interactive = onClick != null || onLongClick != null
    Column(
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
            .thesisPress(interactionSource, enabled = interactive)
            .padding(horizontal = Kit.kpiCellPaddingH, vertical = ThesisSpace.m),
        verticalArrangement = Arrangement.spacedBy(ThesisSpace.xxs),
    ) {
        Text(spec.label, style = ThesisType.caption, color = p.ink2)
        Text(spec.value, style = if (featured) ThesisType.kpiValue else ThesisType.statValue, color = p.ink)
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
 * radius. [onItemClick] makes each tile open its SourceSheet.
 */
@Composable
fun KpiGrid(
    items: List<KpiSpec>,
    modifier: Modifier = Modifier,
    featured: Boolean = false,
    onItemClick: ((Int) -> Unit)? = null,
) {
    KpiGridLayout(items.size, modifier) { i ->
        KpiTile(
            items[i],
            Modifier.fillMaxWidth(),
            featured = featured,
            onClick = onItemClick?.let { { it(i) } },
        )
    }
}

/** Grid scaffold shared by [KpiGrid] and the KPI skeleton. */
@Composable
internal fun KpiGridLayout(count: Int, modifier: Modifier = Modifier, cell: @Composable (Int) -> Unit) {
    val p = LocalThesisPalette.current
    val cellFill = if (LocalInHeroBand.current) p.bg else p.surface
    BoxWithConstraints(modifier.fillMaxWidth()) {
        val columns = if (maxWidth >= Kit.kpiThreeColumnsFrom) 3 else 2
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
                            if (i < count) cell(i)
                        }
                    }
                }
            }
        }
    }
}
