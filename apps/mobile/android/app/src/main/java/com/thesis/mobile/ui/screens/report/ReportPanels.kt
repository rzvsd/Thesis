package com.thesis.mobile.ui.screens.report

import androidx.compose.animation.Crossfade
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import com.thesis.mobile.model.NoteTrailEntry
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.ui.components.ArcSpinner
import com.thesis.mobile.ui.components.DockDetent
import com.thesis.mobile.ui.components.DockPanel
import com.thesis.mobile.ui.components.Eyebrow
import com.thesis.mobile.ui.components.NoteBlock
import com.thesis.mobile.ui.components.NoteSaveState
import com.thesis.mobile.ui.components.PrimaryButton
import com.thesis.mobile.ui.components.SheetActionRow
import com.thesis.mobile.ui.components.TextAction
import com.thesis.mobile.ui.components.ThesisCheckbox
import com.thesis.mobile.ui.components.ThesisChip
import com.thesis.mobile.ui.components.ThesisDivider
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
import java.time.ZoneId

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

/** A menu row whose action is under way: the 20 dp arc in place of the icon, the label in ink2. */
@Composable
private fun PreparingRow(label: String) {
    val p = LocalThesisPalette.current
    Row(
        Modifier
            .fillMaxWidth()
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
                CompareStep.Names -> NamesPicker(ticker, otherNames) { picked -> onCompareNames?.invoke(picked) }
                CompareStep.Reports -> EarlierReports(earlierReports) { id -> onCompareReport?.invoke(id) }
            }
        }
    }
}

@Composable
private fun NamesPicker(ticker: String, otherNames: List<String>, onCompare: (List<String>) -> Unit) {
    val p = LocalThesisPalette.current
    var picked by rememberSaveable(ticker) { mutableStateOf(listOf<String>()) }
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
        Text(ReportCopy.pickNamesTitle(ticker), style = ThesisType.subhead, color = p.ink)
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
private fun EarlierReports(reports: List<ReportHistoryItem>, onOpen: (String) -> Unit) {
    val p = LocalThesisPalette.current
    val fmt = LocalFmt.current
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
        Text(ReportCopy.EARLIER_REPORTS_TITLE, style = ThesisType.subhead, color = p.ink)
        if (reports.isEmpty()) {
            Text(ReportCopy.NO_EARLIER_REPORT, style = ThesisType.body, color = p.ink2)
            return@Column
        }
        Column {
            reports.forEach { item ->
                val date = parseInstantMs(item.createdAt)
                    ?.let { fmt.shortDate(Instant.ofEpochMilli(it).atZone(ZoneId.systemDefault()).toLocalDate()) }
                    ?: item.createdAt
                SheetActionRow(ThesisIcons.DeepDive, ReportCopy.earlierReportLabel(date), { onOpen(item.reportId) })
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
            EarlierNoteBlock(earlier, canCarry = note.isBlank(), onCarryForward = onCarryForward)
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
private fun EarlierNoteBlock(note: EarlierNote, canCarry: Boolean, onCarryForward: () -> Unit) {
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
            maxLines = EARLIER_NOTE_LINES,
            overflow = TextOverflow.Ellipsis,
        )
        if (canCarry) TextAction(ReportCopy.CARRY_FORWARD, onCarryForward)
    }
}

private const val EARLIER_NOTE_LINES = 4

// ---------------------------------------------------------------------------------------------------------------
// Report feedback
// ---------------------------------------------------------------------------------------------------------------

/**
 * Report feedback in a DockPanel (it has a text field): one choice of [ReportCopy.feedbackOptions] (chips,
 * Role.RadioButton), optional details, Send. Sending calls [onSubmit] with the code and the trimmed details.
 */
@OptIn(ExperimentalLayoutApi::class)
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
    var code by rememberSaveable { mutableStateOf(ReportCopy.feedbackOptions.first().first) }
    var details by rememberSaveable { mutableStateOf("") }
    DockPanel(
        visible = visible,
        onDismiss = onDismiss,
        detent = detent,
        onDetentChange = onDetentChange,
        modifier = modifier,
        title = ReportCopy.REPORT_FEEDBACK,
        verticalArrangement = Arrangement.spacedBy(ThesisSpace.m),
    ) {
        Text(ReportCopy.FEEDBACK_HOW, style = ThesisType.body, color = p.ink2)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
            ReportCopy.feedbackOptions.forEach { (value, label) ->
                ThesisChip(label = label, selected = code == value, onClick = { code = value }, role = Role.RadioButton)
            }
        }
        ThesisTextField(
            value = details,
            onValueChange = { details = it },
            label = ReportCopy.FEEDBACK_DETAILS,
            singleLine = false,
        )
        PrimaryButton(
            text = ReportCopy.FEEDBACK_SEND,
            onClick = {
                onSubmit(code, details.trim())
                details = ""
                onDismiss()
            },
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
