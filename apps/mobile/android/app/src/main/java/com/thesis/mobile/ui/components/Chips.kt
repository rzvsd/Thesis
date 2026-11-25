package com.thesis.mobile.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.animateScrollBy
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.text.BasicText
import androidx.compose.material3.Icon
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
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
import com.thesis.mobile.ui.theme.markColor
import com.thesis.mobile.ui.theme.tnum
import kotlin.math.abs

/*
 * Chips, badges, segments and chapter pills (docs/app-redesign/DESIGN-DIRECTION.md, section 3 #14 to #17).
 * Selected = inverted (`selectedFill` / `onSelected`), as Deep Dive's chip nav. Colours change over Quick (150 ms),
 * read in the draw phase.
 */

/**
 * A chip (#14): pill, 36 dp visual inside a 48 dp touch area, 1 dp `line2`, transparent, `label` text, optional
 * 16 dp [leadingIcon] or [count] ("At risk 2"). Selected = inverted. [role] is Tab for view switches and
 * chapter pills; filter chips may pass Role.Checkbox. No haptic (filter chips are operated many times).
 */
@Composable
fun ThesisChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    leadingIcon: ImageVector? = null,
    count: Int? = null,
    enabled: Boolean = true,
    role: Role = Role.Tab,
    interactionSource: MutableInteractionSource = remember { MutableInteractionSource() },
) {
    val p = LocalThesisPalette.current
    val inHero = LocalInHeroBand.current
    val reduced = LocalReducedMotion.current
    val t by animateFloatAsState(
        targetValue = if (selected) 1f else 0f,
        animationSpec = ThesisMotion.timed(reduced, ThesisMotion.Quick),
        label = "chipSelected",
    )
    val restFill = if (inHero) p.chip else Color.Transparent
    val restBorder = if (inHero) p.line else p.line2
    val restText = if (enabled) p.ink else p.muted
    val shape = ThesisShape.pill
    Box(
        modifier
            .selectable(
                selected = selected,
                interactionSource = interactionSource,
                indication = null,
                enabled = enabled,
                role = role,
                onClick = onClick,
            )
            .minimumInteractiveComponentSize()
            .thesisPress(interactionSource, shape = shape, enabled = enabled)
            // At least 48 wide: a short label ("All") widens the pill instead of floating centred in the 48 dp touch
            // area, so the outline starts on the gutter and ChipRow gaps stay 6 dp.
            .heightIn(min = ThesisSpace.chipHeight)
            .widthIn(min = ThesisSpace.touchMin)
            .drawBehind {
                val stroke = ThesisSpace.border.toPx()
                val r = CornerRadius(size.height / 2f)
                drawRoundRect(lerp(restFill, p.selectedFill, t), cornerRadius = r)
                drawRoundRect(
                    lerp(restBorder, p.selectedFill, t),
                    topLeft = Offset(stroke / 2f, stroke / 2f),
                    size = Size(size.width - stroke, size.height - stroke),
                    cornerRadius = CornerRadius(size.height / 2f - stroke / 2f),
                    style = Stroke(stroke),
                )
            }
            .padding(horizontal = ThesisSpace.m, vertical = ThesisSpace.xs),
        contentAlignment = Alignment.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (leadingIcon != null) {
                Icon(
                    leadingIcon,
                    contentDescription = null,
                    modifier = Modifier.size(ThesisSpace.iconS),
                    tint = lerp(p.ink2, p.onSelected, t),
                )
                Spacer(Modifier.width(Kit.chipGap))
            }
            BasicText(
                if (count != null) "$label $count" else label,
                style = ThesisType.label.tnum(),
                color = { lerp(restText, p.onSelected, t) },
                maxLines = 1,
            )
        }
    }
}

/**
 * A horizontally scrolling row of chips (#14 ChipRow), never a fixed Row: gutter content padding, 6 dp gaps.
 */
@Composable
fun ChipRow(
    modifier: Modifier = Modifier,
    state: LazyListState = rememberLazyListState(),
    contentPadding: PaddingValues = PaddingValues(horizontal = ThesisSpace.gutter),
    content: LazyListScope.() -> Unit,
) {
    LazyRow(
        modifier = modifier.fillMaxWidth().selectableGroup(),
        state = state,
        contentPadding = contentPadding,
        horizontalArrangement = Arrangement.spacedBy(Kit.chipGap),
        verticalAlignment = Alignment.CenterVertically,
        content = content,
    )
}

/**
 * Status badge (#15, DD phase badge): `badge` radius, 1 dp border = the tone colour mixed 55% into `line2`, a 7 dp
 * square and sentence-case 11 sp 600 text. Non-interactive. Pass [color] instead of a tone for category marks.
 */
@Composable
fun StatusBadge(text: String, tone: Tone, modifier: Modifier = Modifier) {
    StatusBadge(text, tone.markColor(LocalThesisPalette.current), modifier)
}

@Composable
fun StatusBadge(text: String, color: Color, modifier: Modifier = Modifier) {
    val p = LocalThesisPalette.current
    val border = lerp(p.line2, color, Kit.BADGE_TONE_MIX)
    Row(
        modifier
            .border(BorderStroke(ThesisSpace.border, border), ThesisShape.badge)
            .padding(horizontal = ThesisSpace.s, vertical = Kit.badgePaddingV),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Kit.chipGap),
    ) {
        StatusSquare(color)
        Text(text, style = ThesisType.badge, color = p.ink2, maxLines = 1)
    }
}

/**
 * Segmented control (#16), at most 4 equal segments: a pill container with a 1 dp `line2` outline and an inverted
 * indicator that glides (`spatial`) behind the selected label. `segment()` haptic on a change.
 * Segments are radio buttons for TalkBack.
 */
@Composable
fun SegmentedControl(
    options: List<String>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    require(options.size in 2..4) { "SegmentedControl takes 2 to 4 options; use a ChipRow for more" }
    val p = LocalThesisPalette.current
    val reduced = LocalReducedMotion.current
    val haptics = rememberHaptics()
    val position by animateFloatAsState(
        targetValue = selectedIndex.toFloat(),
        animationSpec = if (reduced) ThesisMotion.timed(true, 0) else ThesisMotion.spatial(),
        label = "segmentIndicator",
    )
    val count = options.size
    Row(
        modifier
            .fillMaxWidth()
            .heightIn(min = ThesisSpace.touchMin)
            .selectableGroup()
            .drawBehind {
                val inset = Kit.segmentInset.toPx()
                val stroke = ThesisSpace.border.toPx()
                val outerH = size.height - inset * 2f
                drawRoundRect(
                    p.line2,
                    topLeft = Offset(stroke / 2f, inset + stroke / 2f),
                    size = Size(size.width - stroke, outerH - stroke),
                    cornerRadius = CornerRadius(outerH / 2f),
                    style = Stroke(stroke),
                )
                val segW = size.width / count
                val indH = outerH - inset * 2f
                drawRoundRect(
                    p.selectedFill,
                    topLeft = Offset(segW * position + inset, inset * 2f),
                    size = Size(segW - inset * 2f, indH),
                    cornerRadius = CornerRadius(indH / 2f),
                )
            },
    ) {
        options.forEachIndexed { i, option ->
            val source = remember { MutableInteractionSource() }
            Box(
                Modifier
                    .weight(1f)
                    .heightIn(min = ThesisSpace.touchMin)
                    .selectable(
                        selected = i == selectedIndex,
                        interactionSource = source,
                        indication = null,
                        role = Role.RadioButton,
                        onClick = {
                            if (i != selectedIndex) {
                                haptics.segment()
                                onSelect(i)
                            }
                        },
                    )
                    .padding(vertical = Kit.segmentInset * 2)
                    .padding(horizontal = Kit.segmentInset)
                    .thesisPress(source, shape = ThesisShape.pill),
                contentAlignment = Alignment.Center,
            ) {
                BasicText(
                    option,
                    modifier = Modifier.padding(horizontal = ThesisSpace.s, vertical = ThesisSpace.xs),
                    style = ThesisType.label,
                    color = {
                        val t = (1f - abs(position - i)).coerceIn(0f, 1f)
                        lerp(p.ink2, p.onSelected, t)
                    },
                    maxLines = 1,
                )
            }
        }
    }
}

/**
 * Chapter pills (#17): a sticky row of chips on the bar background with a bottom hairline; the selected chapter is
 * inverted and auto-centred. The caller drives [selectedIndex] (tap, or scroll-spy in PR-2); `segment()` haptic on
 * tap only.
 */
@Composable
fun ChapterPills(
    chapters: List<String>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
    state: LazyListState = rememberLazyListState(),
) {
    val haptics = rememberHaptics()
    val reduced = LocalReducedMotion.current
    // The first placement jumps (a screen never opens mid-scroll); later selection changes glide.
    var placed by remember(state) { mutableStateOf(false) }
    LaunchedEffect(selectedIndex) {
        val animate = placed && !reduced
        placed = true
        if (state.layoutInfo.visibleItemsInfo.none { it.index == selectedIndex }) {
            if (animate) state.animateScrollToItem(selectedIndex) else state.scrollToItem(selectedIndex)
        }
        val info = state.layoutInfo
        val item = info.visibleItemsInfo.firstOrNull { it.index == selectedIndex } ?: return@LaunchedEffect
        val center = (info.viewportStartOffset + info.viewportEndOffset) / 2f
        val delta = item.offset + item.size / 2f - center
        if (animate) state.animateScrollBy(delta, ThesisMotion.spatial()) else state.scrollBy(delta)
    }
    Box(modifier.fillMaxWidth().barBackground(BarHairline.Bottom)) {
        ChipRow(Modifier.padding(vertical = ThesisSpace.xs), state = state) {
            itemsIndexed(chapters) { i, chapter ->
                ThesisChip(
                    label = chapter,
                    selected = i == selectedIndex,
                    onClick = {
                        if (i != selectedIndex) haptics.segment()
                        onSelect(i)
                    },
                )
            }
        }
    }
}

/** A dashed-ring caps tag ("NOT SEEN YET") for the Not-seen card. */
@Composable
internal fun DashedTag(text: String, modifier: Modifier = Modifier) {
    val p = LocalThesisPalette.current
    Text(
        text.uppercase(),
        modifier = modifier
            .dashedBorder(p.line2, ThesisShape.BadgeRadius, Kit.ringStroke)
            .padding(horizontal = ThesisSpace.s, vertical = Kit.badgePaddingV),
        style = ThesisType.eyebrow,
        color = p.muted,
    )
}

