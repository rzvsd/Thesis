package com.thesis.mobile.ui.components

import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import com.thesis.mobile.ui.theme.ThesisSpace

/**
 * The pre-v2 button, kept with its old signature so existing screens compile (docs/app-redesign/DESIGN-DIRECTION.md,
 * section 6.1 F2). It now draws the kit [PrimaryButton] / [SecondaryButton] at full width; [minHeight] is ignored
 * (the kit uses a 40 dp visual inside a 48 dp touch area) and a custom [content] is no longer drawn (the label is).
 * A caller whose [content] showed a spinner passes [loading] instead, which draws the kit's arc in place of the
 * label. Screens move to the kit buttons in PR-3.
 */
@Deprecated(
    "Use PrimaryButton / SecondaryButton (section 3 #18)",
    ReplaceWith("PrimaryButton(text = text, onClick = onClick, modifier = modifier.fillMaxWidth(), enabled = enabled, loading = loading)"),
)
@Composable
fun ThesisButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    isPrimary: Boolean = true,
    accessibilityLabel: String = text,
    minHeight: Dp = ThesisSpace.touchMin,
    loading: Boolean = false,
    content: @Composable (() -> Unit)? = null,
) {
    val source = remember { MutableInteractionSource() }
    KitButton(
        text = text,
        onClick = onClick,
        kind = if (isPrimary) ButtonKind.Primary else ButtonKind.Secondary,
        modifier = modifier.fillMaxWidth(),
        enabled = enabled,
        loading = loading,
        contentDescription = accessibilityLabel.takeIf { it != text },
        interactionSource = source,
    )
}
