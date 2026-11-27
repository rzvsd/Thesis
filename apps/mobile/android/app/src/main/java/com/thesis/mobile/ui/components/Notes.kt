package com.thesis.mobile.ui.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathMeasure
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.onPlaced
import androidx.compose.ui.layout.positionInParent
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.motion.rememberHaptics
import com.thesis.mobile.ui.theme.Kit
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisShape
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import kotlin.math.roundToInt
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay

/*
 * Notes (docs/app-redesign/DESIGN-DIRECTION.md, section 3 #31 NoteBlock and #52 NotesTrail).
 */

/** Where a note's save stands. */
enum class NoteSaveState { Idle, Saving, Saved, Failed }

/** The placeholder scaffold an empty note shows (plain text, no schema). */
const val NotePlaceholder = "What I believe\n\nWhat would prove me wrong\n\nWhat I\u2019m watching"

/** Autosave wait after typing stops. */
const val NOTE_AUTOSAVE_MS = 800L

/**
 * Autosave for a note (#31): saves [text] [NOTE_AUTOSAVE_MS] after the last change, and hands any unsaved text to
 * [onLeave] when the note leaves composition (the ViewModel saves it in its own scope). Text is never dropped on
 * error: [NoteAutosave.state] turns [NoteSaveState.Failed] and [NoteAutosave.retry] saves again.
 */
@Stable
class NoteAutosave internal constructor() {
    var state by mutableStateOf(NoteSaveState.Idle)
        internal set
    internal var attempt by mutableIntStateOf(0)
    internal var lastSaved: String? = null

    /** Tries the save again (the footer's "try again"). */
    fun retry() {
        attempt++
    }
}

@Composable
fun rememberNoteAutosave(
    text: String,
    save: suspend (String) -> Boolean,
    onLeave: (String) -> Unit = {},
): NoteAutosave {
    val autosave = remember { NoteAutosave().also { it.lastSaved = text } }
    val currentSave by rememberUpdatedState(save)
    val currentText by rememberUpdatedState(text)
    val leave by rememberUpdatedState(onLeave)
    LaunchedEffect(text, autosave.attempt) {
        if (text == autosave.lastSaved) return@LaunchedEffect
        delay(NOTE_AUTOSAVE_MS)
        autosave.state = NoteSaveState.Saving
        // A restart (the user typed during a slow save) cancels this save: rethrow, so a cancelled save is never
        // reported as "Not saved, try again" (principle 11).
        val ok = try {
            currentSave(text)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            false
        }
        if (ok) autosave.lastSaved = text
        autosave.state = if (ok) NoteSaveState.Saved else NoteSaveState.Failed
    }
    DisposableEffect(autosave) {
        onDispose { if (currentText != autosave.lastSaved) leave(currentText) }
    }
    return autosave
}

/**
 * The note editor (#31): eyebrow "Your note" and the [filing] caption; `story` text on `surface` with the
 * placeholder scaffold; footer with the save state ([savedAgo], e.g. "2 min ago"), the character count, Copy and
 * Share. On the first [NoteSaveState.Saved] of an editing session the footer crossfades, a 12 dp check draws and the
 * `confirm()` haptic plays once.
 */
@Composable
fun NoteBlock(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    filing: String? = null,
    saveState: NoteSaveState = NoteSaveState.Idle,
    savedAgo: String? = null,
    onRetry: (() -> Unit)? = null,
    onCopy: (() -> Unit)? = null,
    onShare: (() -> Unit)? = null,
    enabled: Boolean = true,
    eyebrow: String = "Your note",
) {
    val p = LocalThesisPalette.current
    val haptics = rememberHaptics()
    var confirmed by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(saveState) {
        if (saveState == NoteSaveState.Saved && !confirmed) {
            confirmed = true
            haptics.confirm()
        }
    }
    Column(
        modifier
            .fillMaxWidth()
            .kitCardShadow(p)
            .border(ThesisSpace.border, p.line, ThesisShape.card)
            .background(p.surface, ThesisShape.card)
            .padding(ThesisSpace.cardPadding),
        verticalArrangement = Arrangement.spacedBy(ThesisSpace.cardInnerGap),
    ) {
        NoteHeader(eyebrow, filing)
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            enabled = enabled,
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = ThesisSpace.x5 * 2)
                .semantics { contentDescription = eyebrow },
            textStyle = ThesisType.story.copy(color = p.ink),
            cursorBrush = SolidColor(p.ink),
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
            decorationBox = { inner ->
                Box {
                    if (value.isEmpty()) Text(NotePlaceholder, style = ThesisType.story, color = p.muted)
                    inner()
                }
            },
        )
        ThesisDivider()
        Row(verticalAlignment = Alignment.CenterVertically) {
            SaveStatus(saveState, savedAgo, onRetry, Modifier.weight(1f))
            Text("${value.length} chars", style = ThesisType.caption, color = p.muted)
            if (onCopy != null) ThesisIconButton(ThesisIcons.Small.Copy, "Copy note", onCopy)
            if (onShare != null) ThesisIconButton(ThesisIcons.Small.Share, "Share note", onShare)
        }
    }
}

@Composable
private fun NoteHeader(eyebrow: String, filing: String?) {
    val p = LocalThesisPalette.current
    Row(verticalAlignment = Alignment.CenterVertically) {
        Eyebrow(eyebrow, Modifier.weight(1f))
        if (filing != null) Text(filing, style = ThesisType.caption, color = p.muted)
    }
}

@Composable
private fun SaveStatus(state: NoteSaveState, savedAgo: String?, onRetry: (() -> Unit)?, modifier: Modifier) {
    val p = LocalThesisPalette.current
    val reduced = LocalReducedMotion.current
    AnimatedContent(
        targetState = state,
        modifier = modifier.semantics { liveRegion = LiveRegionMode.Polite },
        transitionSpec = {
            fadeIn(ThesisMotion.timed(reduced, ThesisMotion.Base, delayMillis = ThesisMotion.CrossfadeDelay)) togetherWith
                fadeOut(ThesisMotion.timed(reduced, ThesisMotion.Quick))
        },
        label = "save",
    ) { s ->
        Row(verticalAlignment = Alignment.CenterVertically) {
            when (s) {
                NoteSaveState.Idle -> Text("", style = ThesisType.caption)
                NoteSaveState.Saving -> Text("Saving…", style = ThesisType.caption, color = p.muted)
                NoteSaveState.Saved -> {
                    DrawnCheck()
                    Spacer(Modifier.width(ThesisSpace.xs))
                    Text(
                        if (savedAgo != null) "Saved · $savedAgo" else "Saved",
                        style = ThesisType.caption,
                        color = p.ink2,
                    )
                }
                NoteSaveState.Failed -> {
                    Text("Not saved", style = ThesisType.caption, color = p.neg)
                    if (onRetry != null) {
                        Spacer(Modifier.width(ThesisSpace.s))
                        TextAction("Try again", onRetry, style = ThesisType.caption)
                    }
                }
            }
        }
    }
}

/** The 12 dp check that draws itself (Base) when a note saves; drawn complete under reduced motion. */
@Composable
private fun DrawnCheck() {
    val p = LocalThesisPalette.current
    val reduced = LocalReducedMotion.current
    val progress = remember { Animatable(if (reduced) 1f else 0f) }
    LaunchedEffect(Unit) { progress.animateTo(1f, ThesisMotion.timed(reduced, ThesisMotion.Base)) }
    Canvas(Modifier.size(ThesisSpace.iconS * CHECK_SCALE)) {
        val path = Path().apply {
            moveTo(size.width * 0.16f, size.height * 0.54f)
            lineTo(size.width * 0.42f, size.height * 0.78f)
            lineTo(size.width * 0.86f, size.height * 0.26f)
        }
        val measure = PathMeasure().apply { setPath(path, false) }
        val seg = Path()
        measure.getSegment(0f, measure.length * progress.value, seg, true)
        drawPath(seg, p.pos, style = Stroke(Kit.ringStroke.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
    }
}

private const val CHECK_SCALE = 0.75f

/**
 * Note preview (#31 preview variant): the note's first three lines (`story`) and an "Edit" action. Use on cards
 * and lists; [onEdit] opens the editor (a DockPanel over the report, or the Name's notes).
 */
@Composable
fun NotePreview(
    text: String,
    onEdit: () -> Unit,
    modifier: Modifier = Modifier,
    filing: String? = null,
    eyebrow: String = "Your note",
) {
    val p = LocalThesisPalette.current
    Column(
        modifier
            .fillMaxWidth()
            .kitCardShadow(p)
            .border(ThesisSpace.border, p.line, ThesisShape.card)
            .background(p.surface, ThesisShape.card)
            .padding(ThesisSpace.cardPadding),
        verticalArrangement = Arrangement.spacedBy(ThesisSpace.s),
    ) {
        NoteHeader(eyebrow, filing)
        Text(
            text.ifBlank { NotePlaceholder },
            style = ThesisType.story,
            color = if (text.isBlank()) p.muted else p.ink,
            maxLines = Kit.NOTE_PREVIEW_LINES,
            overflow = TextOverflow.Ellipsis,
        )
        TextAction("Edit", onEdit)
    }
}

/**
 * One entry of a ticker's notes: the report's [filing] period, its [date], that report's [verdict] and the note.
 * [key] is the entry's stable identity (the report id: one note per report), which keeps an entry's state (expanded)
 * with it when the trail changes, and names the entry a note search hit opens at ([NotesTrail]'s `focusKey`).
 */
@Immutable
data class NoteEntry(
    val key: String,
    val filing: String,
    val date: String,
    val text: String,
    val verdict: String? = null,
)

/**
 * The notes trail (#52), newest first. The first entry is the newest report: its header, then [editor] (usually a
 * [NoteBlock]). Older entries are read-only previews (4 lines) that expand in place. When the newest note is empty
 * and an older one is not, that older note offers "Carry forward" ([onCarryForward] copies it into the new note).
 *
 * [focusKey] names the entry a note search hit opens at (5.27): an older one opens expanded, so the matched words are
 * in view, and a 3 dp accent rule in the gutter beside it marks it once, then fades ([NOTE_MARK_HOLD] ms, then
 * `Base`; a `Quick` crossfade under reduced motion, which keeps the rule still). [onFocusPlaced] gets the entry's
 * top (px from the trail's top) whenever it is placed: the host scrolls there once, so the entry sits right under
 * its bar (the page knows its bar and scroll; the trail does not).
 */
@Composable
fun NotesTrail(
    entries: List<NoteEntry>,
    modifier: Modifier = Modifier,
    focusKey: String? = null,
    onFocusPlaced: ((top: Int) -> Unit)? = null,
    onCarryForward: ((NoteEntry) -> Unit)? = null,
    editor: @Composable (NoteEntry) -> Unit,
) {
    if (entries.isEmpty()) return
    val newest = entries.first()
    val carryFrom = if (newest.text.isBlank()) entries.drop(1).firstOrNull { it.text.isNotBlank() } else null
    val focus = focusKey?.takeIf { k -> entries.any { it.key == k } }
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(ThesisSpace.xl)) {
        key(newest.key) {
            Column(
                Modifier.focusedEntry(newest.key == focus, focus, onFocusPlaced),
                verticalArrangement = Arrangement.spacedBy(ThesisSpace.s),
            ) {
                EntryHeader(newest)
                editor(newest)
            }
        }
        entries.drop(1).forEach { entry ->
            key(entry.key) {
                OlderNote(
                    entry,
                    carry = if (entry == carryFrom) onCarryForward else null,
                    focused = entry.key == focus,
                    modifier = Modifier.focusedEntry(entry.key == focus, focus, onFocusPlaced),
                )
            }
        }
    }
}

/** How long the focused entry's mark holds before it fades: about the page's scroll to it (`Screen`), then a `Draw`. */
const val NOTE_MARK_HOLD = ThesisMotion.Screen + ThesisMotion.Draw

/**
 * The focused entry ([focused]): reports its top to [onPlaced], and draws the
 * accent rule in the gutter at its start edge, which fades once per [focusKey] (not again on a return to the page).
 */
@Composable
private fun Modifier.focusedEntry(focused: Boolean, focusKey: String?, onPlaced: ((Int) -> Unit)?): Modifier {
    if (!focused) return this
    val p = LocalThesisPalette.current
    val reduced = LocalReducedMotion.current
    var shown by rememberSaveable(focusKey) { mutableStateOf(false) }
    val mark = remember(focusKey) { Animatable(if (shown) 0f else 1f) }
    val place by rememberUpdatedState(onPlaced)
    LaunchedEffect(focusKey) {
        if (!shown) {
            mark.animateTo(
                0f,
                tween(
                    durationMillis = if (reduced) ThesisMotion.Quick else ThesisMotion.Base,
                    delayMillis = NOTE_MARK_HOLD,
                    easing = ThesisMotion.EaseStandard,
                ),
            )
            shown = true
        }
    }
    return this
        .onPlaced { coordinates -> place?.invoke(coordinates.positionInParent().y.roundToInt()) }
        .drawBehind {
            val alpha = mark.value
            if (alpha <= 0f) return@drawBehind
            val bar = ThesisSpace.accentBar.toPx()
            // Hugs the entry like the Deep Dive's upshot bar, well clear of the screen edge in the 16 dp gutter.
            val gap = ThesisSpace.xs.toPx()
            val x = if (layoutDirection == LayoutDirection.Rtl) size.width + gap else -gap - bar
            drawRect(p.accent, topLeft = Offset(x, 0f), size = Size(bar, size.height), alpha = alpha)
        }
}

@Composable
private fun EntryHeader(entry: NoteEntry) {
    val p = LocalThesisPalette.current
    Column {
        Text("${entry.filing} · ${entry.date}", style = ThesisType.label, color = p.ink)
        if (entry.verdict != null) Text(entry.verdict, style = ThesisType.bodySmall, color = p.ink2)
    }
}

@Composable
private fun OlderNote(entry: NoteEntry, carry: ((NoteEntry) -> Unit)?, focused: Boolean, modifier: Modifier) {
    val p = LocalThesisPalette.current
    val reduced = LocalReducedMotion.current
    // A note search hit's entry opens whole, so the matched words are in view.
    var expanded by rememberSaveable(entry.key) { mutableStateOf(focused) }
    var clipped by remember(entry.key) { mutableStateOf(false) }
    Column(
        modifier
            .fillMaxWidth()
            .then(if (reduced) Modifier else Modifier.animateContentSize(ThesisMotion.spatial())),
        verticalArrangement = Arrangement.spacedBy(ThesisSpace.xs),
    ) {
        EntryHeader(entry)
        if (entry.text.isBlank()) {
            Text("No note for this report.", style = ThesisType.bodySmall, color = p.muted)
        } else {
            Text(
                entry.text,
                style = ThesisType.story,
                color = p.ink2,
                maxLines = if (expanded) Int.MAX_VALUE else Kit.TRAIL_PREVIEW_LINES,
                overflow = TextOverflow.Ellipsis,
                // Whether the 4-line preview cuts the note, read in either state (an entry can open expanded).
                onTextLayout = { clipped = if (expanded) it.lineCount > Kit.TRAIL_PREVIEW_LINES else it.hasVisualOverflow },
            )
            Row(horizontalArrangement = Arrangement.spacedBy(ThesisSpace.l)) {
                if (clipped) TextAction(if (expanded) "Show less" else "Show all", { expanded = !expanded })
                if (carry != null) TextAction("Carry forward", { carry(entry) })
            }
        }
    }
}
