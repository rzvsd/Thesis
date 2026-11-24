package com.thesis.mobile.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.motion.rememberHaptics
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop

/*
 * SourceSheet (docs/app-redesign/DESIGN-DIRECTION.md, section 3 #47) and the alert swipe-to-quiet wrapper (#38).
 */

/** An evidence link in a source sheet; [onOpen] opens it (outside the app or at the report section). */
@Immutable
data class SourceLink(val label: String, val onOpen: () -> Unit, val external: Boolean = true)

/**
 * What a figure is and where it comes from (#47). [form], [period] and [filed] are already formatted
 * (`Fmt.filing`); [derivation] for derived metrics ("Operating income ÷ revenue"); [inputs] (label to value) for
 * scores, from `ui/copy/ScoreCopy.kt`.
 */
@Immutable
data class SourceInfo(
    val metric: String,
    val definition: String? = null,
    val form: String? = null,
    val period: String? = null,
    val filed: String? = null,
    val derivation: String? = null,
    val inputs: List<Pair<String, String>> = emptyList(),
    val evidence: List<SourceLink> = emptyList(),
) {
    /** "10-K · FY2025 · filed 14 Nov 2025", or null when nothing is known. */
    val sourceLine: String?
        get() = listOfNotNull(form, period, filed?.let { "filed $it" }).joinToString(" · ").ifEmpty { null }
}

/** The body of the source sheet, for galleries and for a [DockPanel] host. */
@Composable
fun SourceSheetContent(info: SourceInfo, modifier: Modifier = Modifier) {
    ThesisSheetContent(modifier = modifier, title = info.metric) {
        SourceBody(info)
    }
}

/** The source sheet (#47) as a modal [ThesisSheet]. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SourceSheet(info: SourceInfo, onDismissRequest: () -> Unit, modifier: Modifier = Modifier) {
    ThesisSheet(onDismissRequest = onDismissRequest, modifier = modifier, title = info.metric) {
        SourceBody(info)
    }
}

@Composable
private fun ColumnScope.SourceBody(info: SourceInfo) {
    val p = LocalThesisPalette.current
    if (info.definition != null) Text(info.definition, style = ThesisType.body, color = p.ink)
    info.sourceLine?.let { line ->
        Labelled("Source") { Text(line, style = ThesisType.body, color = p.ink) }
    }
    if (info.derivation != null) {
        Labelled("How it is worked out") { Text(info.derivation, style = ThesisType.body, color = p.ink) }
    }
    if (info.inputs.isNotEmpty()) {
        Labelled("Inputs") {
            RowGroup {
                info.inputs.forEach { (label, value) -> row { DataRow(label = label, value = value) } }
            }
        }
    }
    if (info.evidence.isNotEmpty()) {
        Labelled("Evidence") {
            RowGroup {
                info.evidence.forEach { link ->
                    row(dividerInset = LeadingRowDividerInset) {
                        ActionRow(
                            icon = if (link.external) ThesisIcons.OpenExternal else ThesisIcons.DeepDive,
                            title = link.label,
                            onClick = link.onOpen,
                            external = link.external,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun Labelled(label: String, content: @Composable ColumnScope.() -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.xs)) {
        Eyebrow(label)
        content()
    }
}

/**
 * Swipe toward the start to quiet an alert for 24 h (#38): M3 `SwipeToDismissBox`, background `surface2` with the
 * Quiet icon and "Quiet 24 h". The `threshold()` haptic plays when the swipe arms; [onQuiet] runs on release past
 * it (the screen removes the item and shows the undo snackbar). The same action is offered to accessibility
 * services as a custom action.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SwipeToQuiet(
    onQuiet: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    actionLabel: String = "Quiet for 24 hours",
    content: @Composable RowScope.() -> Unit,
) {
    val haptics = rememberHaptics()
    val quiet by rememberUpdatedState(onQuiet)
    val state = rememberSwipeToDismissBoxState(
        confirmValueChange = { value ->
            if (value == SwipeToDismissBoxValue.EndToStart) {
                quiet()
                true
            } else {
                false
            }
        },
    )
    LaunchedEffect(state) {
        snapshotFlow { state.targetValue }
            .distinctUntilChanged()
            .drop(1)
            .collect { if (it == SwipeToDismissBoxValue.EndToStart) haptics.threshold() }
    }
    SwipeToDismissBox(
        state = state,
        modifier = modifier.semantics {
            if (enabled) customActions = listOf(CustomAccessibilityAction(actionLabel) { quiet(); true })
        },
        enableDismissFromStartToEnd = false,
        enableDismissFromEndToStart = enabled,
        backgroundContent = { QuietBackground() },
        content = content,
    )
}

/** The swipe background: `surface2` with the Quiet icon and label at the end. */
@Composable
fun QuietBackground(modifier: Modifier = Modifier) {
    val p = LocalThesisPalette.current
    Box(
        modifier
            .fillMaxSize()
            .background(p.surface2)
            .padding(horizontal = ThesisSpace.l),
        contentAlignment = Alignment.CenterEnd,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Quiet 24 h", style = ThesisType.label, color = p.ink2)
            Spacer(Modifier.width(ThesisSpace.s))
            Icon(ThesisIcons.Quiet, contentDescription = null, modifier = Modifier.size(ThesisSpace.iconL), tint = p.ink2)
        }
    }
}
