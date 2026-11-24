package com.thesis.mobile.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.semantics.Role
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.motion.rememberHaptics
import com.thesis.mobile.ui.motion.thesisPress
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisShape
import com.thesis.mobile.ui.theme.ThesisSpace

/*
 * Selection controls (docs/app-redesign/DESIGN-DIRECTION.md, section 3 #45). No gold: checked states are ink.
 * Colours change over Quick (150 ms). In rows, the row is the toggle (ToggleRow) and the control only draws: pass
 * a null callback.
 */

/**
 * Switch: checked track `ink` with a `surface` thumb; unchecked track `surface2` with a 1 dp `control` border and a
 * `control` thumb. With [onCheckedChange] it is its own 48 dp target and performs `toggle(on)`; with null it only
 * draws (inside a ToggleRow).
 */
@Composable
fun ThesisSwitch(
    checked: Boolean,
    onCheckedChange: ((Boolean) -> Unit)?,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val p = LocalThesisPalette.current
    val haptics = rememberHaptics()
    Switch(
        checked = checked,
        onCheckedChange = onCheckedChange?.let { change ->
            { on: Boolean ->
                haptics.toggle(on)
                change(on)
            }
        },
        modifier = modifier,
        enabled = enabled,
        colors = SwitchDefaults.colors(
            checkedThumbColor = p.surface,
            checkedTrackColor = p.ink,
            checkedBorderColor = p.ink,
            checkedIconColor = p.ink,
            uncheckedThumbColor = p.control,
            uncheckedTrackColor = p.surface2,
            uncheckedBorderColor = p.control,
            uncheckedIconColor = p.surface2,
            disabledCheckedThumbColor = p.surface,
            disabledCheckedTrackColor = p.line2,
            disabledCheckedBorderColor = p.line2,
            disabledUncheckedThumbColor = p.line2,
            disabledUncheckedTrackColor = p.surface2,
            disabledUncheckedBorderColor = p.line,
        ),
    )
}

/**
 * Checkbox: a badge-radius square; checked = `ink` fill with a `surface` check, unchecked = 1.5 dp `control`
 * border. With [onCheckedChange] it is a 48 dp target (Role.Checkbox).
 */
@Composable
fun ThesisCheckbox(
    checked: Boolean,
    onCheckedChange: ((Boolean) -> Unit)?,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    interactionSource: MutableInteractionSource = remember { MutableInteractionSource() },
) {
    val p = LocalThesisPalette.current
    val reduced = LocalReducedMotion.current
    val t by animateFloatAsState(
        if (checked) 1f else 0f,
        ThesisMotion.timed(reduced, ThesisMotion.Quick),
        label = "checkbox",
    )
    val target = if (onCheckedChange != null) {
        Modifier
            .toggleable(
                value = checked,
                interactionSource = interactionSource,
                indication = null,
                enabled = enabled,
                role = Role.Checkbox,
                onValueChange = onCheckedChange,
            )
            .minimumInteractiveComponentSize()
    } else {
        Modifier
    }
    val on = if (enabled) p.ink else p.line2
    val off = if (enabled) p.control else p.line2
    Box(modifier.then(target), contentAlignment = Alignment.Center) {
        Box(
            Modifier
                .size(Kit.selectionControl)
                .thesisPress(interactionSource, shape = ThesisShape.badge, enabled = onCheckedChange != null && enabled)
                .drawBehind {
                    val stroke = Kit.ringStroke.toPx()
                    val r = CornerRadius(ThesisShape.BadgeRadius.toPx() * 0.66f)
                    drawRoundRect(on.copy(alpha = t), cornerRadius = r)
                    drawRoundRect(
                        lerp(off, on, t),
                        topLeft = Offset(stroke / 2f, stroke / 2f),
                        size = Size(size.width - stroke, size.height - stroke),
                        cornerRadius = r,
                        style = Stroke(stroke),
                    )
                },
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                ThesisIcons.Small.Check,
                contentDescription = null,
                modifier = Modifier
                    .size(ThesisSpace.iconS)
                    .graphicsLayer { alpha = t },
                tint = p.surface,
            )
        }
    }
}

/**
 * Radio: a 1.5 dp `control` ring with an `ink` dot when [selected]. With [onClick] it is a 48 dp target
 * (Role.RadioButton).
 */
@Composable
fun ThesisRadio(
    selected: Boolean,
    onClick: (() -> Unit)?,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    interactionSource: MutableInteractionSource = remember { MutableInteractionSource() },
) {
    val p = LocalThesisPalette.current
    val reduced = LocalReducedMotion.current
    val t by animateFloatAsState(
        if (selected) 1f else 0f,
        ThesisMotion.timed(reduced, ThesisMotion.Quick),
        label = "radio",
    )
    val target = if (onClick != null) {
        Modifier
            .selectable(
                selected = selected,
                interactionSource = interactionSource,
                indication = null,
                enabled = enabled,
                role = Role.RadioButton,
                onClick = onClick,
            )
            .minimumInteractiveComponentSize()
    } else {
        Modifier
    }
    val ring = if (enabled) p.control else p.line2
    val dot = if (enabled) p.ink else p.line2
    Box(modifier.then(target), contentAlignment = Alignment.Center) {
        Box(
            Modifier
                .size(Kit.selectionControl)
                .thesisPress(interactionSource, shape = CircleShape, enabled = onClick != null && enabled)
                .drawBehind {
                    val stroke = Kit.ringStroke.toPx()
                    drawCircle(ring, radius = size.minDimension / 2f - stroke / 2f, style = Stroke(stroke))
                    if (t > 0f) drawCircle(dot.copy(alpha = t), radius = Kit.radioDot.toPx() / 2f)
                },
        )
    }
}
