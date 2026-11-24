package com.thesis.mobile.ui.navigation

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.automirrored.filled.ManageSearch
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.Newspaper
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.copy.Phase4Copy
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography

data class ThesisNavItem(
    val label: String,
    val icon: ImageVector,
    val tag: String,
    /** A small "new" dot on the icon (Inbox: alerts since the last visit). */
    val showDot: Boolean = false
)

/** The four tabs (DESIGN-DIRECTION 5.5): Today, Names, Research, Inbox. You opens from the top bar avatar. */
fun shellNavItems(inboxHasNew: Boolean): List<ThesisNavItem> = listOf(
    ThesisNavItem(Phase4Copy.todayTab, Icons.Filled.Newspaper, ShellTab.Today.name),
    ThesisNavItem(Phase4Copy.namesTab, Icons.AutoMirrored.Filled.List, ShellTab.Names.name),
    // manage_search, not the magnifier: the top bar's Search action owns that glyph (one meaning per icon, 2.8).
    ThesisNavItem(Phase4Copy.researchTab, Icons.AutoMirrored.Filled.ManageSearch, ShellTab.Research.name),
    ThesisNavItem(Phase4Copy.inboxTab, Icons.Filled.Inbox, ShellTab.Inbox.name, showDot = inboxHasNew),
)

/**
 * Bottom tab bar. [selectedTag] is null while a modal (You, Search, Paywall) is open: no tab is selected.
 * Selection is shown by ink and weight only (no gold indicator bar); PR-2's kit restyles it.
 *
 * Font scale (rubric A4): items have a minimum height, not a fixed one, and each label is one line whose size
 * grows with the user setting up to [NAV_LABEL_MAX_SCALE] of its base size, in dp (the 2.3 cap rule, applied
 * to the bar label). Four labels side by side cannot fit "Research" at 2.0x on a 360 dp phone without breaking
 * the word; the icon and the tab's content description carry the meaning at any scale.
 */
@Composable
fun ThesisBottomBar(
    items: List<ThesisNavItem>,
    selectedTag: String?,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(ThesisColors.Background)
            .navigationBarsPadding()
    ) {
        HorizontalDivider(thickness = ThesisDimens.BorderWidth, color = ThesisColors.Border)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = BAR_HEIGHT)
                .padding(horizontal = ThesisDimens.SpacingSm),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            items.forEach { item ->
                val isSelected = item.tag == selectedTag
                val itemColor = if (isSelected) ThesisColors.TextPrimary else ThesisColors.TextMuted
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .heightIn(min = BAR_HEIGHT)
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            onClick = { onSelect(item.tag) }
                        )
                        .semantics {
                            contentDescription = item.label + if (item.showDot) ", new" else ""
                            role = Role.Tab
                            selected = isSelected
                        },
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    val labelStyle = ThesisTypography.labelSmall.cappedForBar(LocalDensity.current).copy(
                        fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal
                    )
                    Box {
                        Icon(
                            imageVector = item.icon,
                            contentDescription = null,
                            tint = itemColor,
                            modifier = Modifier.size(22.dp)
                        )
                        if (item.showDot) {
                            Box(
                                modifier = Modifier
                                    .align(Alignment.TopEnd)
                                    .offset(x = 2.dp, y = 0.dp)
                                    .size(6.dp)
                                    .clip(CircleShape)
                                    .background(ThesisColors.Primary)
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = item.label,
                        style = labelStyle,
                        color = itemColor,
                        maxLines = 1,
                        softWrap = false,
                        overflow = TextOverflow.Clip
                    )
                }
            }
        }
    }
}

private val BAR_HEIGHT = 64.dp

/** The bar label grows with the font-scale setting up to this multiple of its base size (rubric A4). */
private const val NAV_LABEL_MAX_SCALE = 1.3f

/** Caps [TextStyle.fontSize] and [TextStyle.lineHeight] at [NAV_LABEL_MAX_SCALE] of their base size, in dp. */
private fun TextStyle.cappedForBar(density: Density): TextStyle {
    fun TextUnit.capped(): TextUnit =
        if (!isSp) this else with(density) { minOf(toDp(), (value * NAV_LABEL_MAX_SCALE).dp).toSp() }
    return copy(fontSize = fontSize.capped(), lineHeight = lineHeight.capped())
}
