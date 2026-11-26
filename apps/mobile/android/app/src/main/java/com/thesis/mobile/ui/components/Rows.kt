package com.thesis.mobile.ui.components

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.motion.rememberHaptics
import com.thesis.mobile.ui.motion.thesisPress
import com.thesis.mobile.ui.theme.Kit
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisShape
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone
import com.thesis.mobile.ui.theme.textColor
import com.thesis.mobile.ui.theme.tnum
import kotlin.math.roundToInt

/*
 * Rows and row groups (docs/app-redesign/DESIGN-DIRECTION.md, section 3 #9, #10, #11, #35, #38, #43). Lists live
 * inside one card with inset hairline dividers, never a card per row. Rows in a group press with the tint only,
 * full-bleed to the card edges, no scale (a scaled row would detach from its hairlines), no haptic.
 */

/** Where a row sits in its group. */
enum class RowPosition {
    First, Middle, Last, Only;

    companion object {
        /** Position of item [index] in a group of [count]. */
        fun of(index: Int, count: Int): RowPosition = when {
            count <= 1 -> Only
            index == 0 -> First
            index == count - 1 -> Last
            else -> Middle
        }
    }
}

/**
 * Draws this row's slice of the group card (#10): `surface` fill, the outer 1 dp `line` border, top corners on the
 * first row and bottom corners on the last, and an inset hairline divider starting at [dividerInset] (the row's
 * text edge) after every row but the last. Each lazy item applies it to itself, so `animateItem` works.
 * The last row carries the light-theme card shadow (it only shows under the bottom edge).
 */
fun Modifier.rowGroupSegment(position: RowPosition, dividerInset: Dp = ThesisSpace.l): Modifier = composed {
    val p = LocalThesisPalette.current
    val r = ThesisShape.CardRadius
    val shape = when (position) {
        RowPosition.First -> RoundedCornerShape(topStart = r, topEnd = r)
        RowPosition.Middle -> RectangleShape
        RowPosition.Last -> RoundedCornerShape(bottomStart = r, bottomEnd = r)
        RowPosition.Only -> ThesisShape.card
    }
    val closesTop = position == RowPosition.First || position == RowPosition.Only
    val closesBottom = position == RowPosition.Last || position == RowPosition.Only
    val shadow = if (closesBottom) Modifier.kitCardShadow(p) else Modifier
    this
        .then(shadow)
        .clip(shape)
        .background(p.surface)
        .drawWithContent {
            drawContent()
            val stroke = ThesisSpace.border.toPx()
            val radius = r.toPx()
            // Draw the whole rounded outline, extended past the edges this row leaves open, clipped to the row.
            clipRect {
                val top = if (closesTop) stroke / 2f else -radius * 2f
                val bottom = if (closesBottom) size.height - stroke / 2f else size.height + radius * 2f
                drawRoundRect(
                    p.line,
                    topLeft = Offset(stroke / 2f, top),
                    size = Size(size.width - stroke, bottom - top),
                    cornerRadius = CornerRadius(radius - stroke / 2f),
                    style = Stroke(stroke),
                )
            }
            if (!closesBottom) {
                val inset = dividerInset.toPx()
                drawRect(p.line, topLeft = Offset(inset, size.height - 1f), size = Size(size.width - inset - stroke, 1f))
            }
        }
}

/** Scope of a static [RowGroup]. */
class RowGroupScope internal constructor() {
    internal val rows = mutableListOf<Pair<Dp, @Composable () -> Unit>>()

    /** Adds a row; its divider starts at [dividerInset] (16 for plain rows, 52 for rows with a 24 dp leading column). */
    fun row(dividerInset: Dp = ThesisSpace.l, content: @Composable () -> Unit) {
        rows += dividerInset to content
    }
}

/**
 * A static group of up to about five rows in one card (#10: Home, Settings, Name). Lazy lists use
 * [rowGroupSegment] on each item instead.
 */
@Composable
fun RowGroup(modifier: Modifier = Modifier, content: RowGroupScope.() -> Unit) {
    val scope = RowGroupScope().apply(content)
    val count = scope.rows.size
    Column(modifier.fillMaxWidth()) {
        scope.rows.forEachIndexed { i, (inset, row) ->
            Box(Modifier.fillMaxWidth().rowGroupSegment(RowPosition.of(i, count), inset)) { row() }
        }
    }
}

/** Divider inset for rows with the 24 dp leading column (16 + 24 + 12). */
val LeadingRowDividerInset: Dp = ThesisSpace.l + ThesisSpace.leadingColumn + ThesisSpace.leadingGap

/**
 * Divider inset for compact [TickerRow]s. Their state square sits in the same 24 dp leading column as a
 * comfortable row's, so at every font scale the ticker is the text edge at [LeadingRowDividerInset] and a board
 * keeps one divider line when its density changes. Read it in the composable that builds the group.
 */
val CompactRowDividerInset: Dp
    @Composable
    @ReadOnlyComposable
    get() = LeadingRowDividerInset

/**
 * Data row (#9): label (`body`, ink) with an optional [sub] line, and on the right the value (`body` tabular) over
 * its [delta] (caption, tone colour, with its sign). With [onClick] the whole row presses with the tint; TalkBack
 * reads "label, value, change". [onLongClick] opens the SourceSheet for the value.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun DataRow(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    delta: String? = null,
    deltaTone: Tone = Tone.Neutral,
    sub: String? = null,
    onClick: (() -> Unit)? = null,
    onLongClick: (() -> Unit)? = null,
    /** What TalkBack calls the long press (its custom action, e.g. "Show source", "More actions"); unnamed without it. */
    onLongClickLabel: String? = null,
    interactionSource: MutableInteractionSource = remember { MutableInteractionSource() },
) {
    val p = LocalThesisPalette.current
    val interactive = onClick != null || onLongClick != null
    val spoken = listOfNotNull(label, value, delta).joinToString(", ")
    Row(
        modifier
            .fillMaxWidth()
            .then(
                if (interactive) {
                    Modifier.combinedClickable(
                        interactionSource = interactionSource,
                        indication = null,
                        role = Role.Button,
                        onLongClickLabel = onLongClickLabel,
                        onLongClick = onLongClick,
                        onClick = onClick ?: {},
                    )
                } else {
                    Modifier
                },
            )
            .semantics(mergeDescendants = true) { contentDescription = spoken }
            .thesisPress(interactionSource, enabled = interactive)
            .heightIn(min = if (sub != null) ThesisSpace.rowMinComfortableTwoLine else ThesisSpace.rowMinComfortable)
            .padding(horizontal = ThesisSpace.l, vertical = ThesisSpace.rowPaddingV),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        LabelValueLayout(gap = ThesisSpace.m) {
            Column {
                Text(label, style = ThesisType.body, color = p.ink)
                if (sub != null) Text(sub, style = ThesisType.bodySmall, color = p.ink2)
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(value, style = ThesisType.body.tnum(), color = p.ink)
                if (delta != null) Text(delta, style = ThesisType.caption.tnum(), color = deltaTone.textColor(p))
            }
        }
    }
}

/**
 * A label (first child) and a value block (second child) on one line, [gap] apart: the value takes its full
 * width, the label the rest. The label wraps between words, never inside one (2.3), and the value never wraps:
 * when the label's longest word and the value cannot share the line (large font scale on a narrow screen), the
 * value moves under the label, end-aligned, instead of breaking "Operating" into "Operatin / g".
 */
@Composable
private fun LabelValueLayout(gap: Dp, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Layout(content, modifier.fillMaxWidth()) { measurables, constraints ->
        require(measurables.size == 2) { "LabelValueLayout takes a label and a value" }
        val (label, value) = measurables
        val gapPx = gap.roundToPx()
        val width = constraints.maxWidth
        val loose = constraints.copy(minWidth = 0, minHeight = 0)
        val valueW = value.maxIntrinsicWidth(Constraints.Infinity)
        val labelWord = label.minIntrinsicWidth(Constraints.Infinity)
        val oneLine = !constraints.hasBoundedWidth || labelWord + gapPx + valueW <= width
        if (oneLine) {
            val v = value.measure(loose)
            val labelMax = if (constraints.hasBoundedWidth) (width - gapPx - v.width).coerceAtLeast(0) else Constraints.Infinity
            val l = label.measure(loose.copy(maxWidth = labelMax))
            val w = if (constraints.hasBoundedWidth) width else l.width + gapPx + v.width
            val h = maxOf(l.height, v.height).coerceAtLeast(constraints.minHeight)
            layout(w, h) {
                l.placeRelative(0, (h - l.height) / 2)
                v.placeRelative(w - v.width, (h - v.height) / 2)
            }
        } else {
            val l = label.measure(loose)
            val v = value.measure(loose)
            val h = (l.height + v.height).coerceAtLeast(constraints.minHeight)
            layout(width, h) {
                l.placeRelative(0, 0)
                v.placeRelative(width - v.width, l.height)
            }
        }
    }
}

/**
 * Toggle row (#9 ToggleRow): the whole row is one `toggleable` with Role.Switch; the kit switch inside only draws.
 * `toggle(on)` haptic.
 */
@Composable
fun ToggleRow(
    title: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    sub: String? = null,
    enabled: Boolean = true,
    interactionSource: MutableInteractionSource = remember { MutableInteractionSource() },
) {
    val p = LocalThesisPalette.current
    val haptics = rememberHaptics()
    Row(
        modifier
            .fillMaxWidth()
            .toggleable(
                value = checked,
                interactionSource = interactionSource,
                indication = null,
                enabled = enabled,
                role = Role.Switch,
                onValueChange = {
                    haptics.toggle(it)
                    onCheckedChange(it)
                },
            )
            .thesisPress(interactionSource, enabled = enabled)
            .heightIn(min = if (sub != null) ThesisSpace.rowMinComfortableTwoLine else ThesisSpace.rowMinComfortable)
            .padding(horizontal = ThesisSpace.l, vertical = ThesisSpace.rowPaddingV),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(ThesisSpace.m),
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, style = ThesisType.body, color = if (enabled) p.ink else p.muted)
            if (sub != null) Text(sub, style = ThesisType.bodySmall, color = p.ink2)
        }
        ThesisSwitch(checked = checked, onCheckedChange = null, enabled = enabled)
    }
}

/**
 * Ticker row (#11). Leading 24 dp column: the thesis-state square ([stateTone]; a [LiveDot] while a War Room is
 * [live]). Line 1: [ticker] (`rowTitle`) + [company] (muted, ellipsized) + [hasNote] mark + [count] badge. Line 2:
 * the change since the last visit ("Intact -> Watch, Tue") or the reason. Trailing: one stacked figure block,
 * [figure] (`body` tabular) over [figureCaption] (tone). No chevron, no meter.
 *
 * [compact] is the Names density option: 48 dp, one line of aligned columns (state, ticker, figure, change, note:
 * the state square keeps the leading column it has in the comfortable row),
 * up to 1.15x font scale (the ticker column grows with the font scale so a five-letter ticker never pushes the
 * state square out of its column). Above 1.15x a compact row uses the comfortable layout at the compact height;
 * above 1.3x both densities move the figure block under the text and let line 2 wrap to two lines. Divider insets:
 * [LeadingRowDividerInset] for comfortable rows, [CompactRowDividerInset] for compact ones.
 * Press: tint only (inside a RowGroup). [onLongClick] opens the context sheet with the `longPress()` haptic.
 * [onClick] null makes the row non-interactive (no role, no press, no long press; one merged description).
 * [onBoundsCaptured] receives the row's window bounds just before [onClick] (container transform).
 * [stateLabel] ("Intact") is what TalkBack says for the square.
 * [line2MaxLines] caps line 2 in the comfortable layout (default 1; a reason sentence passes 2). Above 1.3x the
 * row allows one more line. The company name keeps [Kit.tickerCompanyMin] or is dropped when less is left.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun TickerRow(
    ticker: String,
    stateTone: Tone,
    onClick: (() -> Unit)?,
    modifier: Modifier = Modifier,
    company: String? = null,
    line2: String? = null,
    line2MaxLines: Int = 1,
    figure: String? = null,
    figureCaption: String? = null,
    figureCaptionTone: Tone = Tone.Neutral,
    stateLabel: String? = null,
    hasNote: Boolean = false,
    count: String? = null,
    live: Boolean = false,
    compact: Boolean = false,
    onLongClick: (() -> Unit)? = null,
    /** What TalkBack calls the long press (its custom action, e.g. "Show source", "More actions"); unnamed without it. */
    onLongClickLabel: String? = null,
    onBoundsCaptured: ((Rect) -> Unit)? = null,
    interactionSource: MutableInteractionSource = remember { MutableInteractionSource() },
) {
    val p = LocalThesisPalette.current
    val haptics = rememberHaptics()
    var bounds by remember { mutableStateOf(Rect.Zero) }
    val container = modifier
        .fillMaxWidth()
        .then(if (onBoundsCaptured != null) Modifier.onGloballyPositioned { bounds = it.boundsInWindow() } else Modifier)
        .then(
            if (onClick == null) {
                Modifier
            } else {
                Modifier
                    .combinedClickable(
                        interactionSource = interactionSource,
                        indication = null,
                        role = Role.Button,
                        onLongClickLabel = onLongClickLabel,
                        onLongClick = onLongClick?.let {
                            {
                                haptics.longPress()
                                it()
                            }
                        },
                        onClick = {
                            onBoundsCaptured?.invoke(bounds)
                            onClick()
                        },
                    )
                    .thesisPress(interactionSource)
            },
        )
        .semantics(mergeDescendants = true) { if (stateLabel != null) stateDescription = stateLabel }

    val leading: @Composable () -> Unit = {
        Box(Modifier.width(ThesisSpace.leadingColumn), contentAlignment = Alignment.CenterStart) {
            if (live) LiveDot() else StatusSquare(stateTone)
        }
    }

    // Large font scales (> 1.3x): the trailing figure block moves under the text so the company name and line 2
    // keep their meaning on a 360 dp screen (rubric A4) instead of ellipsizing to nothing.
    val fontScale = LocalDensity.current.fontScale
    val large = fontScale > ThesisType.MAX_DISPLAY_SCALE
    val figureStyle = ThesisType.body.tnum()
    val captionStyle = ThesisType.caption.tnum()

    if (compact && fontScale <= Kit.COMPACT_ALIGNED_MAX_SCALE) {
        // Aligned columns: state, ticker, figure, change, note. The state square keeps the comfortable row's leading
        // column, so it reads with its ticker and a density change moves nothing sideways. The figure and change
        // columns have fixed minimum widths and are right-aligned, so every compact row lines up and the two never
        // run together.
        Row(
            container
                .heightIn(min = ThesisSpace.rowMinCompact)
                .padding(horizontal = ThesisSpace.l),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            leading()
            Spacer(Modifier.width(ThesisSpace.leadingGap))
            Text(
                ticker,
                modifier = Modifier.widthIn(min = Kit.compactTickerColumn * fontScale),
                style = ThesisType.rowTitle,
                color = p.ink,
                maxLines = 1,
            )
            Spacer(Modifier.weight(1f))
            Text(
                figure.orEmpty(),
                modifier = Modifier.widthIn(min = Kit.compactFigureColumn),
                style = figureStyle,
                color = p.ink,
                textAlign = TextAlign.End,
                maxLines = 1,
            )
            Spacer(Modifier.width(ThesisSpace.s))
            Text(
                figureCaption.orEmpty(),
                modifier = Modifier.widthIn(min = Kit.compactCaptionColumn),
                style = captionStyle,
                color = figureCaptionTone.textColor(p),
                textAlign = TextAlign.End,
                maxLines = 1,
            )
            Box(Modifier.padding(start = ThesisSpace.s).size(ThesisSpace.iconS)) { if (hasNote) NoteMark() }
        }
        return
    }

    val hasFigure = figure != null || figureCaption != null

    Row(
        container
            .heightIn(
                min = when {
                    compact -> ThesisSpace.rowMinCompact
                    line2 != null -> ThesisSpace.rowMinComfortableTwoLine
                    else -> ThesisSpace.rowMinComfortable
                },
            )
            .padding(horizontal = ThesisSpace.l, vertical = ThesisSpace.rowPaddingV),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        leading()
        Spacer(Modifier.width(ThesisSpace.leadingGap))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
                Text(ticker, style = ThesisType.rowTitle, color = p.ink, maxLines = 1)
                if (company != null) {
                    Text(
                        company,
                        modifier = Modifier.weight(1f, fill = false).dropBelow(Kit.tickerCompanyMin),
                        style = ThesisType.bodySmall,
                        color = p.muted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                if (hasNote) NoteMark()
                if (count != null) CountBadge(count)
            }
            if (line2 != null) {
                Text(
                    line2,
                    style = ThesisType.bodySmall,
                    color = p.ink2,
                    maxLines = if (large) line2MaxLines.coerceAtLeast(1) + 1 else line2MaxLines.coerceAtLeast(1),
                    overflow = TextOverflow.Ellipsis,
                )
            }
            if (large && hasFigure) {
                // The figure, then its caption, which wraps rather than clipping at the row edge.
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(ThesisSpace.s),
                ) {
                    if (figure != null) Text(figure, style = figureStyle, color = p.ink, maxLines = 1)
                    if (figureCaption != null) {
                        Text(
                            figureCaption,
                            modifier = Modifier.weight(1f, fill = false),
                            style = captionStyle,
                            color = figureCaptionTone.textColor(p),
                        )
                    }
                }
            }
        }
        if (!large && hasFigure) {
            Spacer(Modifier.width(ThesisSpace.m))
            Column(horizontalAlignment = Alignment.End) {
                if (figure != null) Text(figure, style = figureStyle, color = p.ink, maxLines = 1)
                if (figureCaption != null) {
                    Text(figureCaption, style = captionStyle, color = figureCaptionTone.textColor(p), maxLines = 1)
                }
            }
        }
    }
}

/** Lays the element out normally when at least [min] is offered, and as nothing (unplaced, 0 x 0) when less is. */
private fun Modifier.dropBelow(min: Dp): Modifier = layout { measurable, constraints ->
    if (constraints.maxWidth < min.roundToPx()) {
        layout(0, 0) {}
    } else {
        val placeable = measurable.measure(constraints)
        layout(placeable.width, placeable.height) { placeable.place(0, 0) }
    }
}

/**
 * Action row (#35): a 24 dp icon (ink2), a `rowTitle` and an optional caption; the whole row is the target. No
 * chevron; [external] adds `open_in_new` for links that leave the app. An external link passes [icon] = null: its
 * one glyph is the trailing `open_in_new`, so the row never shows the same glyph twice. [reserveLeading] keeps the
 * empty 24 dp leading column so its title lines up with icon rows in the same group (default: only with an icon;
 * the group's divider inset follows, 52 dp with it, 16 dp without).
 */
@Composable
fun ActionRow(
    icon: ImageVector?,
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    caption: String? = null,
    external: Boolean = false,
    reserveLeading: Boolean = icon != null,
    interactionSource: MutableInteractionSource = remember { MutableInteractionSource() },
) {
    val p = LocalThesisPalette.current
    Row(
        modifier
            .fillMaxWidth()
            .clickable(interactionSource, indication = null, role = Role.Button, onClick = onClick)
            .semantics(mergeDescendants = true) { }
            .thesisPress(interactionSource)
            .heightIn(min = if (caption != null) ThesisSpace.rowMinComfortableTwoLine else ThesisSpace.rowMinComfortable)
            .padding(horizontal = ThesisSpace.l, vertical = ThesisSpace.rowPaddingV),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null || reserveLeading) {
            Box(Modifier.width(ThesisSpace.leadingColumn), contentAlignment = Alignment.CenterStart) {
                if (icon != null) Icon(icon, contentDescription = null, modifier = Modifier.size(ThesisSpace.iconL), tint = p.ink2)
            }
            Spacer(Modifier.width(ThesisSpace.leadingGap))
        }
        Column(Modifier.weight(1f)) {
            Text(title, style = ThesisType.rowTitle, color = p.ink)
            if (caption != null) Text(caption, style = ThesisType.bodySmall, color = p.ink2)
        }
        if (external) {
            Spacer(Modifier.width(ThesisSpace.m))
            Icon(
                ThesisIcons.Small.OpenExternal,
                contentDescription = "Opens outside the app",
                modifier = Modifier.size(ThesisSpace.iconM),
                tint = p.ink2,
            )
        }
    }
}

/**
 * Alert row (#38): a 24 dp category square ([categoryColor], from `alertCategoryColor`); line 1: the [ticker] as an
 * eyebrow (tappable, opens Name) and the relative [time] with an accent "new" dot before it; line 2: [title]
 * (`rowTitle`); line 3: [body] (2 lines, ink2; all of it when [expanded]). Tap expands in place
 * (`animateContentSize(spatial)`); [detail] shows below when expanded.
 */
@Composable
fun AlertRow(
    categoryColor: Color,
    title: String,
    body: String,
    time: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    ticker: String? = null,
    onTickerClick: (() -> Unit)? = null,
    isNew: Boolean = false,
    expanded: Boolean = false,
    categoryLabel: String? = null,
    interactionSource: MutableInteractionSource = remember { MutableInteractionSource() },
    detail: (@Composable ColumnScope.() -> Unit)? = null,
) {
    val p = LocalThesisPalette.current
    val reduced = LocalReducedMotion.current
    Row(
        modifier
            .fillMaxWidth()
            .clickable(
                interactionSource,
                indication = null,
                role = Role.Button,
                onClickLabel = if (expanded) "Collapse" else "Expand",
                onClick = onClick,
            )
            .semantics(mergeDescendants = true) {
                stateDescription = listOfNotNull(categoryLabel, if (isNew) "New" else null).joinToString(", ")
            }
            .thesisPress(interactionSource)
            .then(if (reduced) Modifier else Modifier.animateContentSize(ThesisMotion.spatial()))
            .padding(horizontal = ThesisSpace.l, vertical = ThesisSpace.rowPaddingV),
    ) {
        Box(
            Modifier
                .width(ThesisSpace.leadingColumn)
                .padding(top = ThesisSpace.xs),
            contentAlignment = Alignment.TopStart,
        ) {
            StatusSquare(categoryColor)
        }
        Spacer(Modifier.width(ThesisSpace.leadingGap))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(ThesisSpace.xxs)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (ticker != null) {
                    val tickerSource = remember { MutableInteractionSource() }
                    Box(
                        Modifier
                            .then(
                                if (onTickerClick != null) {
                                    Modifier
                                        .widthIn(min = ThesisSpace.touchMin)
                                        .touchHeight(ThesisSpace.touchMin)
                                        .clickable(tickerSource, indication = null, role = Role.Button, onClick = onTickerClick)
                                        .thesisPress(tickerSource, shape = ThesisShape.badge)
                                } else {
                                    Modifier
                                },
                            ),
                        contentAlignment = Alignment.CenterStart,
                    ) {
                        Eyebrow(ticker, color = if (onTickerClick != null) p.accent else p.muted)
                    }
                }
                Spacer(Modifier.weight(1f))
                if (isNew) {
                    Box(Modifier.size(ThesisSpace.newDot).clip(CircleShape).background(p.accent))
                    Spacer(Modifier.width(ThesisSpace.s))
                }
                Text(time, style = ThesisType.caption, color = p.muted, maxLines = 1)
            }
            Text(title, style = ThesisType.rowTitle, color = p.ink)
            Text(
                body,
                style = ThesisType.bodySmall,
                color = p.ink2,
                maxLines = if (expanded) Int.MAX_VALUE else 2,
                overflow = TextOverflow.Ellipsis,
            )
            if (expanded && detail != null) {
                Spacer(Modifier.height(ThesisSpace.xs))
                detail()
            }
        }
    }
}

/**
 * Gives a small inline target (a ticker eyebrow) a [min]-tall touch area without making its line taller: the
 * clickable node below this modifier is [min] tall and centred on the line, overlapping its neighbours a little,
 * as Compose's own touch-slop expansion would.
 */
internal fun Modifier.touchHeight(min: Dp): Modifier = layout { measurable, constraints ->
    val minPx = min.roundToPx()
    val width = if (constraints.hasBoundedWidth) constraints.maxWidth else measurable.maxIntrinsicWidth(Int.MAX_VALUE)
    val natural = measurable.minIntrinsicHeight(width).coerceIn(constraints.minHeight, constraints.maxHeight)
    val placeable = measurable.measure(
        constraints.copy(minHeight = minPx, maxHeight = maxOf(constraints.maxHeight, minPx)),
    )
    val height = minOf(natural, placeable.height)
    layout(placeable.width, height) {
        placeable.place(0, ((height - placeable.height) / 2f).roundToInt())
    }
}

/**
 * Sheet menu row (#43): 48 dp, a 20 dp icon and a `body` label; [destructive] in neg. Press tint. Inside a sheet
 * ([ThesisSheetContent]) it runs full-bleed across the sheet's 16 dp content inset, so the press tint reaches both
 * sheet edges and the icon sits on the title's text edge; consecutive rows sit flush (48 dp pitch).
 */
@Composable
fun SheetActionRow(
    icon: ImageVector,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    destructive: Boolean = false,
    enabled: Boolean = true,
    interactionSource: MutableInteractionSource = remember { MutableInteractionSource() },
) {
    val p = LocalThesisPalette.current
    val color = when {
        !enabled -> p.muted
        destructive -> p.neg
        else -> p.ink
    }
    val bleed = LocalSheetGutter.current
    Row(
        modifier
            .bleedHorizontally(bleed)
            .fillMaxWidth()
            .clickable(interactionSource, indication = null, enabled = enabled, role = Role.Button, onClick = onClick)
            .thesisPress(interactionSource, enabled = enabled)
            .heightIn(min = ThesisSpace.touchMin)
            .padding(horizontal = bleed.takeIf { it > 0.dp } ?: ThesisSpace.l, vertical = ThesisSpace.s),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(ThesisSpace.l),
    ) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(ThesisSpace.iconM), tint = if (destructive) color else p.ink2)
        Text(label, style = ThesisType.body, color = color)
    }
}

/** Widens this element by [amount] on both sides past its parent's padding (full-bleed rows in a padded column). */
private fun Modifier.bleedHorizontally(amount: Dp): Modifier =
    if (amount <= 0.dp) {
        this
    } else {
        layout { measurable, constraints ->
            val extra = amount.roundToPx() * 2
            val wide = if (constraints.hasBoundedWidth) {
                constraints.copy(minWidth = constraints.minWidth + extra, maxWidth = constraints.maxWidth + extra)
            } else {
                constraints
            }
            val placeable = measurable.measure(wide)
            val width = (placeable.width - extra).coerceIn(constraints.minWidth, constraints.maxWidth)
            layout(width, placeable.height) { placeable.place(-amount.roundToPx(), 0) }
        }
    }
