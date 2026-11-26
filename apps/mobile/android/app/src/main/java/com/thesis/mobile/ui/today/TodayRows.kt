package com.thesis.mobile.ui.today

import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.changedToDownIgnoreConsumed
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import com.thesis.mobile.ui.components.StatusBadge
import com.thesis.mobile.ui.components.StatusSquare
import com.thesis.mobile.ui.copy.TodayCopy
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.motion.thesisPress
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone
import com.thesis.mobile.ui.theme.tnum

/*
 * Rows the Today screens share and the kit does not have: a Pulse chapter row (title, one sentence, a coverage
 * badge only when incomplete) and a category count row (category square, name, count). Built like the kit's
 * ActionRow: one tap target of at least 64 dp, the press tint, one merged TalkBack node with a button role.
 */

/** A Pulse chapter on Home: "Markets" over its one-sentence headline; [partial] adds the coverage badge. */
@Composable
internal fun PulseChapterRow(
    title: String,
    sentence: String,
    partial: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val p = LocalThesisPalette.current
    val source = remember { MutableInteractionSource() }
    Column(
        modifier
            .fillMaxWidth()
            .clickable(source, indication = null, role = Role.Button, onClick = onClick)
            .semantics(mergeDescendants = true) { }
            .thesisPress(source)
            .heightIn(min = ThesisSpace.rowMinComfortableTwoLine)
            .padding(horizontal = ThesisSpace.l, vertical = ThesisSpace.rowPaddingV),
        verticalArrangement = Arrangement.spacedBy(ThesisSpace.xxs),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
            Text(title, style = ThesisType.rowTitle, color = p.ink, modifier = Modifier.weight(1f, fill = false))
            if (partial) StatusBadge(TodayCopy.PARTIAL_COVERAGE, Tone.Attention)
        }
        Text(sentence, style = ThesisType.bodySmall, color = p.ink2, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}

/**
 * An alert category with its count this week: the category square, the name and the count (tabular). Without
 * [onClick] the row is plain text (no button role, no press tint).
 */
@Composable
internal fun CategoryCountRow(
    color: Color,
    label: String,
    count: Int,
    onClick: (() -> Unit)?,
    modifier: Modifier = Modifier,
) {
    val p = LocalThesisPalette.current
    val source = remember { MutableInteractionSource() }
    Row(
        modifier
            .fillMaxWidth()
            .then(
                if (onClick != null) {
                    Modifier
                        .clickable(source, indication = null, role = Role.Button, onClick = onClick)
                        .semantics(mergeDescendants = true) { }
                        .thesisPress(source)
                } else {
                    Modifier.semantics(mergeDescendants = true) { }
                },
            )
            .heightIn(min = ThesisSpace.rowMinComfortable)
            .padding(horizontal = ThesisSpace.l, vertical = ThesisSpace.rowPaddingV),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.width(ThesisSpace.leadingColumn), contentAlignment = Alignment.CenterStart) { StatusSquare(color) }
        Spacer(Modifier.width(ThesisSpace.leadingGap))
        Text(label, style = ThesisType.rowTitle, color = p.ink, modifier = Modifier.weight(1f))
        Spacer(Modifier.width(ThesisSpace.m))
        Text(Fmt.number(count.toLong()), style = ThesisType.body.tnum(), color = p.ink)
    }
}

/** A row that opens nothing (a headline without a link): the title over a caption, the row group's padding. */
@Composable
internal fun PlainRow(title: String, caption: String?, modifier: Modifier = Modifier) {
    val p = LocalThesisPalette.current
    Column(
        modifier
            .fillMaxWidth()
            .semantics(mergeDescendants = true) { }
            .heightIn(min = if (caption != null) ThesisSpace.rowMinComfortableTwoLine else ThesisSpace.rowMinComfortable)
            .padding(horizontal = ThesisSpace.l, vertical = ThesisSpace.rowPaddingV),
        verticalArrangement = Arrangement.Center,
    ) {
        Text(title, style = ThesisType.rowTitle, color = p.ink)
        if (caption != null) Text(caption, style = ThesisType.bodySmall, color = p.ink2)
    }
}

/**
 * For a kit row whose destination is not wired (its callback is null): TalkBack reads [description] as text, not
 * as a button, and a touch does not reach the row's own clickable (no press tint, no tap that does nothing). Only
 * the down event is consumed, so a drag that starts on the row still scrolls the list. Interim: HANDOFF-A asks
 * WP-K for a nullable `onClick` on `TickerRow`, which makes this unnecessary.
 */
internal fun Modifier.inert(description: String): Modifier = this
    .clearAndSetSemantics { contentDescription = description }
    .pointerInput(Unit) {
        awaitPointerEventScope {
            while (true) {
                awaitPointerEvent(PointerEventPass.Initial).changes.forEach { change ->
                    if (change.changedToDownIgnoreConsumed()) change.consume()
                }
            }
        }
    }
