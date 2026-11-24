package com.thesis.mobile.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import com.thesis.mobile.ui.motion.rememberHaptics
import com.thesis.mobile.ui.motion.thesisPress
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisPalette
import com.thesis.mobile.ui.theme.ThesisShape
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType

/*
 * Buttons (docs/app-redesign/DESIGN-DIRECTION.md, section 3 #18). All pills with a 40 dp visual height inside a
 * 48 dp touch area, 16 dp horizontal padding, `button` text. Press: the kit tint plus a 0.97 scale (standalone
 * buttons). Disabled: fill/outline `line`, text `muted`. Loading: the label is replaced by a 16 dp arc in the text
 * colour, with the width locked. At most one filled control per screen (rubric V3). Gold fill only for the
 * primary button inside a HeroBand.
 */

/** Button looks. Screens use the named composables below. */
enum class ButtonKind { Primary, Secondary, Tertiary, Destructive }

private data class ButtonColors(val fill: Color, val border: Color, val text: Color)

private fun buttonColors(kind: ButtonKind, enabled: Boolean, inHero: Boolean, p: ThesisPalette): ButtonColors {
    val clear = Color.Transparent
    if (!enabled) {
        return when (kind) {
            ButtonKind.Primary -> ButtonColors(p.line, clear, p.muted)
            ButtonKind.Secondary, ButtonKind.Destructive -> ButtonColors(clear, p.line, p.muted)
            ButtonKind.Tertiary -> ButtonColors(clear, clear, p.muted)
        }
    }
    return when (kind) {
        // Ink inversion (DD chip nav); inside a HeroBand the one gold fill: heroAccent with heroBg text.
        ButtonKind.Primary -> if (inHero) ButtonColors(p.accent, clear, p.bg) else ButtonColors(p.selectedFill, clear, p.onSelected)
        ButtonKind.Secondary -> ButtonColors(clear, p.line2, p.ink)
        ButtonKind.Tertiary -> ButtonColors(clear, clear, p.accent)
        ButtonKind.Destructive -> ButtonColors(clear, p.line2, p.neg)
    }
}

/**
 * The shared button. [commit] = true performs the `press()` haptic (Build report, Run scenario, Subscribe,
 * Follow); everything else is silent. [interactionSource] lets galleries and tests drive the pressed state.
 */
@Composable
fun KitButton(
    text: String,
    onClick: () -> Unit,
    kind: ButtonKind,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    leadingIcon: ImageVector? = null,
    commit: Boolean = false,
    contentDescription: String? = null,
    interactionSource: MutableInteractionSource = remember { MutableInteractionSource() },
) {
    val p = LocalThesisPalette.current
    val colors = buttonColors(kind, enabled, LocalInHeroBand.current, p)
    val haptics = rememberHaptics()
    val shape = ThesisShape.pill
    Box(
        modifier
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                enabled = enabled && !loading,
                role = Role.Button,
                onClick = {
                    if (commit) haptics.press()
                    onClick()
                },
            )
            .semantics {
                if (contentDescription != null) this.contentDescription = contentDescription
                if (loading) stateDescription = "Loading"
            }
            .minimumInteractiveComponentSize()
            .thesisPress(interactionSource, scale = true, shape = shape, enabled = enabled && !loading)
            .heightIn(min = ThesisSpace.buttonVisual)
            .clip(shape)
            .background(colors.fill)
            .then(if (colors.border != Color.Transparent) Modifier.border(ThesisSpace.border, colors.border, shape) else Modifier)
            .padding(horizontal = ThesisSpace.controlPaddingH),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            Modifier.alpha(if (loading) 0f else 1f),
            horizontalArrangement = Arrangement.spacedBy(ThesisSpace.s),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (leadingIcon != null) {
                Icon(leadingIcon, contentDescription = null, modifier = Modifier.size(ThesisSpace.iconM), tint = colors.text)
            }
            Text(text, style = ThesisType.button, color = colors.text, textAlign = TextAlign.Center)
        }
        if (loading) ArcSpinner(color = colors.text)
    }
}

/** Primary action: ink inversion (gold only inside a HeroBand). One per screen. */
@Composable
fun PrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    leadingIcon: ImageVector? = null,
    commit: Boolean = false,
    interactionSource: MutableInteractionSource = remember { MutableInteractionSource() },
) = KitButton(
    text, onClick, ButtonKind.Primary, modifier, enabled, loading, leadingIcon, commit,
    interactionSource = interactionSource,
)

/** Secondary action: transparent with a 1 dp `line2` outline and ink text (DD `.iconbtn`). */
@Composable
fun SecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    leadingIcon: ImageVector? = null,
    commit: Boolean = false,
    interactionSource: MutableInteractionSource = remember { MutableInteractionSource() },
) = KitButton(
    text, onClick, ButtonKind.Secondary, modifier, enabled, loading, leadingIcon, commit,
    interactionSource = interactionSource,
)

/** Tertiary action: accent text, no fill, pill touch area. */
@Composable
fun TertiaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    leadingIcon: ImageVector? = null,
    interactionSource: MutableInteractionSource = remember { MutableInteractionSource() },
) = KitButton(
    text, onClick, ButtonKind.Tertiary, modifier, enabled, loading, leadingIcon,
    interactionSource = interactionSource,
)

/** Destructive action: neg text on a `line2` outline. Always behind a confirm dialog. */
@Composable
fun DestructiveButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    interactionSource: MutableInteractionSource = remember { MutableInteractionSource() },
) = KitButton(
    text, onClick, ButtonKind.Destructive, modifier, enabled, loading,
    interactionSource = interactionSource,
)

/**
 * Text action ("All names", "Show table", "Try again" in a banner): accent `label` text aligned to the text edge
 * (no horizontal padding), 48 dp tall touch area, tint press without scale.
 */
@Composable
fun TextAction(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    style: TextStyle = ThesisType.label,
    interactionSource: MutableInteractionSource = remember { MutableInteractionSource() },
) {
    val p = LocalThesisPalette.current
    Box(
        modifier
            .clickable(interactionSource, indication = null, enabled = enabled, role = Role.Button, onClick = onClick)
            .heightIn(min = ThesisSpace.touchMin)
            .thesisPress(interactionSource, shape = ThesisShape.badge, enabled = enabled),
        contentAlignment = Alignment.CenterStart,
    ) {
        Text(text, style = style, color = if (enabled) p.accent else p.muted)
    }
}

/**
 * Icon button: 48 dp touch, 40 dp visual circle, tint press, no ripple. [tint] defaults to ink2 (2.8); pass ink
 * when active. [contentDescription] is required: it is what TalkBack reads.
 */
@Composable
fun ThesisIconButton(
    icon: ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    tint: Color = Color.Unspecified,
    interactionSource: MutableInteractionSource = remember { MutableInteractionSource() },
) {
    val p = LocalThesisPalette.current
    val resolved = when {
        !enabled -> p.muted
        tint != Color.Unspecified -> tint
        else -> p.ink2
    }
    Box(
        modifier
            .size(ThesisSpace.touchMin)
            .clickable(interactionSource, indication = null, enabled = enabled, role = Role.Button, onClick = onClick)
            .semantics { this.contentDescription = contentDescription },
        contentAlignment = Alignment.Center,
    ) {
        Box(
            Modifier
                .size(ThesisSpace.buttonVisual)
                .thesisPress(interactionSource, shape = CircleShape, enabled = enabled),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(ThesisSpace.iconL), tint = resolved)
        }
    }
}

/**
 * Inline link: accent text with a 1 dp underline 2 dp below the baseline, 48 dp touch height.
 */
@Composable
fun ThesisLink(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    style: TextStyle = ThesisType.bodySmall,
    interactionSource: MutableInteractionSource = remember { MutableInteractionSource() },
) {
    val p = LocalThesisPalette.current
    var layout by remember { mutableStateOf<TextLayoutResult?>(null) }
    Box(
        modifier
            .clickable(interactionSource, indication = null, role = Role.Button, onClick = onClick)
            .minimumInteractiveComponentSize()
            .thesisPress(interactionSource, shape = ThesisShape.badge),
        contentAlignment = Alignment.CenterStart,
    ) {
        Text(
            text,
            style = style,
            color = p.accent,
            onTextLayout = { layout = it },
            modifier = Modifier.drawBehind {
                val l = layout ?: return@drawBehind
                val stroke = ThesisSpace.border.toPx()
                val offset = Kit.underlineOffset.toPx()
                // Baseline of each line: its bottom minus the first line's descent below its baseline.
                val descent = l.getLineBottom(0) - l.firstBaseline
                for (line in 0 until l.lineCount) {
                    val y = l.getLineBottom(line) - descent + offset
                    drawLine(
                        p.accent,
                        Offset(l.getLineLeft(line), y),
                        Offset(l.getLineRight(line), y),
                        strokeWidth = stroke,
                    )
                }
            },
        )
    }
}
