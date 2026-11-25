package com.thesis.mobile.ui.screens.report

import androidx.compose.animation.Crossfade
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Icon
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.layout
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import com.thesis.mobile.model.NoteTrailEntry
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.ui.components.ArcSpinner
import com.thesis.mobile.ui.components.ChipRow
import com.thesis.mobile.ui.components.DockDetent
import com.thesis.mobile.ui.components.DockPanel
import com.thesis.mobile.ui.components.Eyebrow
import com.thesis.mobile.ui.components.NoteBlock
import com.thesis.mobile.ui.components.NoteSaveState
import com.thesis.mobile.ui.components.PrimaryButton
import com.thesis.mobile.ui.components.SecondaryButton
import com.thesis.mobile.ui.components.SheetActionRow
import com.thesis.mobile.ui.components.TextAction
import com.thesis.mobile.ui.components.ThesisCheckbox
import com.thesis.mobile.ui.components.ThesisChip
import com.thesis.mobile.ui.components.ThesisDivider
import com.thesis.mobile.ui.components.ThesisIconButton
import com.thesis.mobile.ui.components.ThesisTextField
import com.thesis.mobile.ui.copy.ReportCopy
import com.thesis.mobile.ui.format.LocalFmt
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.motion.thesisPress
import com.thesis.mobile.ui.parseInstantMs
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import java.time.Instant

/*
 * The report's sheets and panels (docs/app-redesign/DESIGN-DIRECTION.md 5.13): the overflow menu, Compare, the
 * notes panel and report feedback. Menus are sheet content (the host puts them in a ThesisSheet); anything with a
 * text field is a DockPanel (3 #20: no text fields inside a sheet on M3 1.2).
 */

// ---------------------------------------------------------------------------------------------------------------
// Overflow
// ---------------------------------------------------------------------------------------------------------------

/**
 * The overflow menu: Classic view, Export PDF, Share card, Report feedback. While an export is being prepared
 * ([exporting]) its row shows an arc and "Preparing…", and the other export waits.
 */
@Composable
fun ColumnScope.ReportOverflowContent(
    exporting: ExportJob,
    onClassicView: () -> Unit,
    onExportPdf: () -> Unit,
    onShareCard: () -> Unit,
    onFeedback: () -> Unit,
) {
    SheetActionRow(ThesisIcons.Document, ReportCopy.CLASSIC_VIEW, onClassicView)
    if (exporting == ExportJob.Pdf) {
        PreparingRow(ReportCopy.PREPARING_PDF)
    } else {
        SheetActionRow(ThesisIcons.ExportPdf, ReportCopy.EXPORT_PDF, onExportPdf, enabled = exporting == ExportJob.None)
    }
    if (exporting == ExportJob.Card) {
        PreparingRow(ReportCopy.PREPARING_CARD)
    } else {
        SheetActionRow(ThesisIcons.Share, ReportCopy.SHARE_CARD, onShareCard, enabled = exporting == ExportJob.None)
    }
    SheetActionRow(ThesisIcons.Info, ReportCopy.REPORT_FEEDBACK, onFeedback)
}

/**
 * A menu row whose action is under way: the 20 dp arc in place of the icon, the label in ink2. It replaces the
 * tapped row, so it is announced politely (rubric A3): TalkBack says "Preparing the PDF…" in the time before the
 * print dialog or the share sheet opens.
 */
@Composable
private fun PreparingRow(label: String) {
    val p = LocalThesisPalette.current
    Row(
        Modifier
            .fillMaxWidth()
            .semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite }
            .heightIn(min = ThesisSpace.touchMin)
            .padding(vertical = ThesisSpace.s),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(ThesisSpace.l),
    ) {
        ArcSpinner(color = p.ink2, size = ThesisSpace.iconM)
        Text(label, style = ThesisType.body, color = p.ink2)
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Compare
// ---------------------------------------------------------------------------------------------------------------

/** Which part of the Compare sheet shows. */
enum class CompareStep { Choose, Names, Reports }

/**
 * Compare (5.13 item 6): "With other names" (a picker of the person's other names, this ticker as the subject,
 * then Compare names) and "With an earlier report" (this ticker's like-for-like reports, then Compare reports; when
 * there is none, why). [step] is hoisted so the sheet keeps its place across recomposition.
 */
@Composable
fun ColumnScope.ReportCompareContent(
    ticker: String,
    step: CompareStep,
    onStep: (CompareStep) -> Unit,
    otherNames: List<String>,
    earlierReports: List<ReportHistoryItem>,
    onCompareNames: ((List<String>) -> Unit)?,
    onCompareReport: ((String) -> Unit)?,
) {
    val reduced = LocalReducedMotion.current
    Crossfade(
        targetState = step,
        animationSpec = ThesisMotion.timed(reduced, ThesisMotion.Base),
        label = "compareStep",
    ) { shown ->
        Column(Modifier.fillMaxWidth()) {
            when (shown) {
                CompareStep.Choose -> {
                    if (onCompareNames != null) {
                        SheetActionRow(ThesisIcons.Names, ReportCopy.WITH_OTHER_NAMES, { onStep(CompareStep.Names) })
                    }
                    if (onCompareReport != null) {
                        SheetActionRow(ThesisIcons.History, ReportCopy.WITH_EARLIER_REPORT, { onStep(CompareStep.Reports) })
                    }
                }
                CompareStep.Names -> NamesPicker(ticker, otherNames, onBack = { onStep(CompareStep.Choose) }) { picked ->
                    onCompareNames?.invoke(picked)
                }
                CompareStep.Reports -> EarlierReports(ticker, earlierReports, onBack = { onStep(CompareStep.Choose) }) { id ->
                    onCompareReport?.invoke(id)
                }
            }
        }
    }
}

/**
 * The head of a Compare step after the choice: Back (to the choice, "Compare AAPL") and the step's title. The back
 * glyph sits on the sheet's text edge; its 48 dp target overhangs into the sheet's padding.
 */
@Composable
private fun CompareStepHead(title: String, backLabel: String, onBack: () -> Unit) {
    val p = LocalThesisPalette.current
    Row(verticalAlignment = Alignment.CenterVertically) {
        ThesisIconButton(
            ThesisIcons.Back,
            contentDescription = backLabel,
            onClick = onBack,
            modifier = Modifier.offset(x = -BackGlyphInset),
            tint = p.ink,
        )
        Text(
            title,
            modifier = Modifier.offset(x = -BackGlyphInset).semantics { heading() },
            style = ThesisType.subhead,
            color = p.ink,
        )
    }
}

/** How far the back glyph's 48 dp target reaches past the glyph: the head shifts left by it. */
private val BackGlyphInset = (ThesisSpace.touchMin - ThesisSpace.iconL) / 2

@Composable
private fun NamesPicker(ticker: String, otherNames: List<String>, onBack: () -> Unit, onCompare: (List<String>) -> Unit) {
    val p = LocalThesisPalette.current
    var picked by rememberSaveable(ticker) { mutableStateOf(listOf<String>()) }
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
        CompareStepHead(ReportCopy.pickNamesTitle(ticker), ReportCopy.compareBack(ticker), onBack)
        if (otherNames.isEmpty()) {
            Text(ReportCopy.noOtherNames(ticker), style = ThesisType.body, color = p.ink2)
            return@Column
        }
        Text(ReportCopy.PICK_NAMES_HOW, style = ThesisType.caption, color = p.muted)
        Column {
            otherNames.forEach { name ->
                val checked = name in picked
                val full = picked.size >= MAX_COMPARE_OTHERS && !checked
                PickRow(name, checked, enabled = !full) { on ->
                    picked = if (on) picked + name else picked - name
                }
            }
        }
        Spacer(Modifier.size(ThesisSpace.xs))
        PrimaryButton(
            text = if (picked.isEmpty()) ReportCopy.PICK_A_NAME else ReportCopy.compareNamesAction(picked.size + 1),
            onClick = { onCompare(listOf(ticker) + picked) },
            modifier = Modifier.fillMaxWidth(),
            enabled = picked.isNotEmpty(),
        )
    }
}

/** One name in the picker: the whole 48 dp row toggles (Role.Checkbox), the kit checkbox shows the state. */
@Composable
private fun PickRow(name: String, checked: Boolean, enabled: Boolean, onChange: (Boolean) -> Unit) {
    val p = LocalThesisPalette.current
    val source = remember { MutableInteractionSource() }
    Row(
        Modifier
            .fillMaxWidth()
            .toggleable(
                value = checked,
                interactionSource = source,
                indication = null,
                enabled = enabled,
                role = Role.Checkbox,
                onValueChange = onChange,
            )
            .thesisPress(source, enabled = enabled)
            .heightIn(min = ThesisSpace.touchMin),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(ThesisSpace.m),
    ) {
        ThesisCheckbox(checked = checked, onCheckedChange = null, enabled = enabled || checked)
        Text(name, style = ThesisType.rowTitle, color = if (enabled) p.ink else p.muted)
    }
}

@Composable
private fun EarlierReports(ticker: String, reports: List<ReportHistoryItem>, onBack: () -> Unit, onOpen: (String) -> Unit) {
    val p = LocalThesisPalette.current
    val fmt = LocalFmt.current
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
        CompareStepHead(ReportCopy.EARLIER_REPORTS_TITLE, ReportCopy.compareBack(ticker), onBack)
        if (reports.isEmpty()) {
            Text(ReportCopy.noEarlierReport(ticker), style = ThesisType.body, color = p.ink2)
            return@Column
        }
        Column {
            reports.forEach { item ->
                // Fmt's own zone and clock ("23 days ago", then "14 Nov 2025"); never a raw timestamp.
                val label = parseInstantMs(item.createdAt)
                    ?.let { ReportCopy.earlierReportLabel(fmt.relative(Instant.ofEpochMilli(it))) }
                    ?: ReportCopy.EARLIER_REPORT
                SheetActionRow(ThesisIcons.DeepDive, label, { onOpen(item.reportId) })
            }
        }
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------------------------------------------

/** The earlier note above the field: its report's period and date, and the text. */
data class EarlierNote(val caption: String, val text: String)

/** [EarlierNote] for a trail entry ("FY2024 · 3 Mar 2025"; parts the entry lacks are left out). */
@Composable
fun earlierNoteOf(entry: NoteTrailEntry): EarlierNote {
    val fmt = LocalFmt.current
    val date = parseInstantMs(entry.updatedAt)?.let { fmt.relative(Instant.ofEpochMilli(it)) }
    val caption = listOfNotNull(entry.filingPeriod?.ifBlank { null }, date).joinToString(" · ")
    return EarlierNote(caption = caption, text = entry.text.trim())
}

/**
 * The notes panel (5.13 item 4): a DockPanel at 45% over the page (85% once the field has focus) with this
 * report's [NoteBlock]. An [earlier] note on the same ticker shows above it, with "Carry forward" while this note is
 * empty. Each change of [scrollToEnd] (Add to note) scrolls the panel to the end of the note.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ReportNotesPanel(
    visible: Boolean,
    onDismiss: () -> Unit,
    detent: DockDetent,
    onDetentChange: (DockDetent) -> Unit,
    note: String,
    onNoteChange: (String) -> Unit,
    filing: String?,
    saveState: NoteSaveState,
    savedAgo: String?,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    onCopy: (() -> Unit)? = null,
    earlier: EarlierNote? = null,
    onCarryForward: () -> Unit = {},
    scrollToEnd: Int = 0,
) {
    val end = remember { BringIntoViewRequester() }
    LaunchedEffect(scrollToEnd, visible) {
        if (scrollToEnd > 0 && visible) {
            withFrameNanos { }
            end.bringIntoView()
        }
    }
    DockPanel(
        visible = visible,
        onDismiss = onDismiss,
        detent = detent,
        onDetentChange = onDetentChange,
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(ThesisSpace.l),
    ) {
        if (earlier != null) {
            EarlierNoteBlock(
                earlier,
                // At 45% this report's note comes first: the earlier one keeps two lines; four once the panel is
                // at 85% (the field's focus or a drag).
                maxLines = if (detent == DockDetent.Full) EARLIER_NOTE_LINES_FULL else EARLIER_NOTE_LINES_HALF,
                canCarry = note.isBlank(),
                onCarryForward = onCarryForward,
            )
            ThesisDivider()
        }
        NoteBlock(
            value = note,
            onValueChange = onNoteChange,
            filing = filing,
            saveState = saveState,
            savedAgo = savedAgo,
            onRetry = onRetry,
            onCopy = onCopy,
        )
        Spacer(Modifier.bringIntoViewRequester(end))
    }
}

@Composable
private fun EarlierNoteBlock(note: EarlierNote, maxLines: Int, canCarry: Boolean, onCarryForward: () -> Unit) {
    val p = LocalThesisPalette.current
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.xs)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Eyebrow(ReportCopy.EARLIER_NOTE, Modifier.weight(1f))
            if (note.caption.isNotEmpty()) Text(note.caption, style = ThesisType.caption, color = p.muted)
        }
        Text(
            note.text,
            style = ThesisType.story,
            color = p.ink2,
            maxLines = maxLines,
            overflow = TextOverflow.Ellipsis,
        )
        if (canCarry) TextAction(ReportCopy.CARRY_FORWARD, onCarryForward)
    }
}

private const val EARLIER_NOTE_LINES_HALF = 2
private const val EARLIER_NOTE_LINES_FULL = 4

// ---------------------------------------------------------------------------------------------------------------
// Report feedback
// ---------------------------------------------------------------------------------------------------------------

/**
 * Report feedback in a DockPanel (it has a text field), the pattern of 5.15 item 5: a [ChipRow] of
 * [ReportCopy.feedbackOptions] with nothing chosen (Role.RadioButton), optional details, and Send, enabled once a
 * chip is chosen. Sending calls [onSubmit] with the code and the trimmed details and turns the panel into its sent
 * state (a thank-you and Done) until it closes; the view model's notice says whether the send went through.
 */
@Composable
fun ReportFeedbackPanel(
    visible: Boolean,
    onDismiss: () -> Unit,
    detent: DockDetent,
    onDetentChange: (DockDetent) -> Unit,
    onSubmit: (code: String, details: String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val p = LocalThesisPalette.current
    var code by rememberSaveable { mutableStateOf<String?>(null) }
    var details by rememberSaveable { mutableStateOf("") }
    var sent by rememberSaveable { mutableStateOf(false) }
    // Each opening starts fresh: no choice carried over, no sent state from last time.
    LaunchedEffect(visible) {
        if (!visible) {
            code = null
            details = ""
            sent = false
        }
    }
    DockPanel(
        visible = visible,
        onDismiss = onDismiss,
        detent = detent,
        onDetentChange = onDetentChange,
        modifier = modifier,
        title = ReportCopy.REPORT_FEEDBACK,
        verticalArrangement = Arrangement.spacedBy(ThesisSpace.m),
    ) {
        if (sent) {
            Row(
                Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(ThesisSpace.s),
            ) {
                Icon(ThesisIcons.Check, contentDescription = null, modifier = Modifier.size(ThesisSpace.iconL), tint = p.ink)
                Text(ReportCopy.FEEDBACK_THANKS, style = ThesisType.subhead, color = p.ink)
            }
            Text(ReportCopy.FEEDBACK_THANKS_HOW, style = ThesisType.body, color = p.ink2)
            SecondaryButton(ReportCopy.FEEDBACK_DONE, onDismiss, modifier = Modifier.fillMaxWidth())
        } else {
            FeedbackForm(
                code = code,
                onCode = { code = it },
                details = details,
                onDetails = { details = it },
                onSend = {
                    code?.let { chosen ->
                        onSubmit(chosen, details.trim())
                        sent = true
                    }
                },
            )
        }
    }
}

@Composable
private fun FeedbackForm(
    code: String?,
    onCode: (String) -> Unit,
    details: String,
    onDetails: (String) -> Unit,
    onSend: () -> Unit,
) {
    val p = LocalThesisPalette.current
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
        Text(ReportCopy.FEEDBACK_HOW, style = ThesisType.body, color = p.ink2)
        // The row runs to the panel's edges (as the page's chip rows do), its first chip on the text edge, so a
        // chip past the edge reads as a scrollable row rather than a cropped one.
        ChipRow(
            modifier = Modifier.bleedHorizontally(PanelGutter),
            contentPadding = PaddingValues(horizontal = PanelGutter),
        ) {
            items(ReportCopy.feedbackOptions, key = { it.first }) { (value, label) ->
                ThesisChip(label = label, selected = code == value, onClick = { onCode(value) }, role = Role.RadioButton)
            }
        }
        ThesisTextField(
            value = details,
            onValueChange = onDetails,
            label = ReportCopy.FEEDBACK_DETAILS,
            singleLine = false,
        )
        PrimaryButton(
            text = ReportCopy.FEEDBACK_SEND,
            onClick = onSend,
            modifier = Modifier.fillMaxWidth(),
            enabled = code != null,
        )
    }
}

/** The DockPanel's text inset (the kit's sheet content padding). */
private val PanelGutter = ThesisSpace.l

/** Widens this element by [amount] on both sides, past its parent's padding (a full-bleed row in a padded panel). */
private fun Modifier.bleedHorizontally(amount: Dp): Modifier = layout { measurable, constraints ->
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
