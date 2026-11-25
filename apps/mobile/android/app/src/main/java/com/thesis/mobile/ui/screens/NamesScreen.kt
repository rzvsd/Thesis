package com.thesis.mobile.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.model.HoldingsImportResultView
import com.thesis.mobile.model.NoteTrailEntry
import com.thesis.mobile.model.SnapshotDelta
import com.thesis.mobile.model.ThesisMonitorSnapshotView
import com.thesis.mobile.model.TickerSearchItem
import com.thesis.mobile.ui.components.BannerTone
import com.thesis.mobile.ui.components.ChipRow
import com.thesis.mobile.ui.components.CompactRowDividerInset
import com.thesis.mobile.ui.components.DialogAction
import com.thesis.mobile.ui.components.DockDetent
import com.thesis.mobile.ui.components.DockPanel
import com.thesis.mobile.ui.components.EmptyState
import com.thesis.mobile.ui.components.ErrorState
import com.thesis.mobile.ui.components.InlineBanner
import com.thesis.mobile.ui.components.LeadingRowDividerInset
import com.thesis.mobile.ui.components.LoadingHairline
import com.thesis.mobile.ui.components.NoteMark
import com.thesis.mobile.ui.components.PrimaryButton
import com.thesis.mobile.ui.components.RowPosition
import com.thesis.mobile.ui.components.RunBar
import com.thesis.mobile.ui.components.ScreenHeader
import com.thesis.mobile.ui.components.SecondaryButton
import com.thesis.mobile.ui.components.SegmentedControl
import com.thesis.mobile.ui.components.SheetActionRow
import com.thesis.mobile.ui.components.SkeletonRow
import com.thesis.mobile.ui.components.StatusSquare
import com.thesis.mobile.ui.components.TextAction
import com.thesis.mobile.ui.components.ThesisCard
import com.thesis.mobile.ui.components.ThesisCheckbox
import com.thesis.mobile.ui.components.ThesisChip
import com.thesis.mobile.ui.components.ThesisDialog
import com.thesis.mobile.ui.components.ThesisIconButton
import com.thesis.mobile.ui.components.ThesisRadio
import com.thesis.mobile.ui.components.ThesisRefreshBox
import com.thesis.mobile.ui.components.ThesisSheet
import com.thesis.mobile.ui.components.ThesisTextField
import com.thesis.mobile.ui.components.TickerField
import com.thesis.mobile.ui.components.TickerRow
import com.thesis.mobile.ui.components.TickerSuggestion
import com.thesis.mobile.ui.components.rowGroupSegment
import com.thesis.mobile.ui.copy.KitCopy
import com.thesis.mobile.ui.copy.NamesCopy
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.format.LocalFmt
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.motion.DismissibleItem
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.motion.ThesisTransitions
import com.thesis.mobile.ui.motion.rememberHaptics
import com.thesis.mobile.ui.motion.rememberShowSkeleton
import com.thesis.mobile.ui.motion.thesisPress
import com.thesis.mobile.ui.platform.ThesisBackHandler
import com.thesis.mobile.ui.shell.ListDensity
import com.thesis.mobile.ui.shell.exceptTop
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone
import com.thesis.mobile.ui.theme.thesisStateTone
import kotlinx.coroutines.launch
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs

/*
 * Names (docs/app-redesign/DESIGN-DIRECTION.md 5.10) and its Notes view (5.28): the board of followed tickers as
 * one card of TickerRows, filters with named data sources, sort and density, compare selection, the long-press
 * context sheet with a confirmed, undoable remove, and the holdings CSV import panel. Everything a row shows is
 * built by [buildBoardRows] (pure, unit-tested); the composables only lay it out.
 */

// =====================================================================================================================
// Board model (pure)
// =====================================================================================================================

/** Board filters (5.10 item 5). Each one names its data source in [BoardRow]. */
enum class BoardFilter(val key: String, val label: String) {
    All("all", NamesCopy.FILTER_ALL),
    Changed("changed", NamesCopy.FILTER_CHANGED),
    AtRisk("at_risk", NamesCopy.FILTER_AT_RISK),
    EarningsSoon("earnings_soon", NamesCopy.FILTER_EARNINGS),
    WithNotes("with_notes", NamesCopy.FILTER_NOTES);

    companion object {
        fun of(key: String?): BoardFilter = entries.firstOrNull { it.key == key } ?: All
    }
}

/** Board sort (5.10 item 6). The default is state severity, then changed since your last visit, then ticker. */
enum class BoardSort(val key: String, val label: String) {
    State("state", NamesCopy.SORT_STATE),
    Score("score", NamesCopy.SORT_SCORE),
    ReportAge("report_age", NamesCopy.SORT_AGE),
    Ticker("ticker", NamesCopy.SORT_TICKER);

    companion object {
        fun of(key: String?): BoardSort = entries.firstOrNull { it.key == key } ?: State
    }
}

/** Earnings within this many days count as "Earnings soon" (5.10 item 5). */
const val EARNINGS_SOON_DAYS = 14L

/** A score change smaller than this (points on the 0-100 scale) is no change. */
private const val SCORE_CHANGE_MIN = 0.5

/** Everything the board reads, from `UiState` (5.5 client data layer). */
@Immutable
data class BoardInputs(
    val watchlist: List<String>,
    val snapshots: List<ThesisMonitorSnapshotView>,
    val alerts: List<AlertLedgerItemView> = emptyList(),
    /** Change since the last Names visit per ticker (`UiState.snapshotDeltas`). */
    val deltas: Map<String, SnapshotDelta> = emptyMap(),
    /** Tickers with at least one non-empty report note (`UiState.allNotes`, the `report_notes` cache). */
    val notedTickers: Set<String> = emptySet(),
    /** Company names by ticker (report summaries, `searchTickers`); a row shows the ticker alone without one. */
    val companyNames: Map<String, String> = emptyMap(),
    /** War Room id by ticker for names in their earnings window (`warRoomsInEarningsWindow`). */
    val warRooms: Map<String, String> = emptyMap(),
    /** Last Names visit, epoch ms; 0 = never (no "changed" or "new" marks then). */
    val lastVisitAtMs: Long = 0L,
    val focusTicker: String? = null,
)

/** One row of the board: what [TickerRow] draws plus what filters and sorts read. */
@Immutable
data class BoardRow(
    val ticker: String,
    val company: String?,
    /** "Intact"; [NamesCopy.NO_REPORT_FIGURE] without a snapshot. */
    val stateWord: String,
    val stateTone: Tone,
    val line2: String,
    /** Monitor score on the 0-100 scale, formatted; null without a snapshot. */
    val figure: String?,
    val figureCaption: String?,
    val figureTone: Tone,
    /** Source: `snapshotDeltas` (state changed, or score moved by half a point or more, since the last visit). */
    val changed: Boolean,
    /** Source: the snapshot's thesis state (Unfavourable: weakened, at risk, broken). */
    val atRisk: Boolean,
    /**
     * Source: the alert ledger (an unmuted earnings alert or War Room whose event date is within 14 days) or a War
     * Room in its earnings window for the ticker (`BoardInputs.warRooms`, `warRoomsInEarningsWindow`).
     */
    val earningsSoon: Boolean,
    /** Source: the `report_notes` cache (`allNotes`). */
    val hasNote: Boolean,
    /** Source: the alert ledger (alerts for the ticker created after the last Names visit). */
    val newAlerts: Int,
    val score: Double?,
    val reportAtMs: Long?,
    val reportId: String?,
    val warRoomId: String?,
    val pinned: Boolean = false,
) {
    /** 0 Unfavourable, 1 Attention, 2 Favourable, 3 no assessment: the default sort's first key. */
    val severity: Int
        get() = when (stateTone) {
            Tone.Unfavourable -> 0
            Tone.Attention -> 1
            Tone.Favourable -> 2
            else -> 3
        }
}

/** The display word for a monitor state ("weakened" → "Weakened", "at_risk" → "At risk"). */
fun stateWordOf(state: String?): String {
    val raw = state?.trim()?.lowercase()?.replace('-', '_')?.replace(' ', '_')?.ifBlank { null }
        ?: return NamesCopy.NO_REPORT_FIGURE
    return when (raw) {
        "at_risk" -> "At risk"
        else -> raw.replace('_', ' ').replaceFirstChar { it.uppercase() }
    }
}

/** Monitor scores arrive as 0-1 (report confidence); the app shows 0-100. Values above 1 are already on that scale. */
fun scoreOutOf100(raw: Double?): Double? = when {
    raw == null || raw.isNaN() -> null
    raw in 0.0..1.0 -> raw * 100.0
    else -> raw
}

/** Epoch ms of an ISO-8601 instant, offset date-time or plain date; null when unreadable. */
internal fun parseMs(raw: String?): Long? {
    val value = raw?.trim()?.ifBlank { null } ?: return null
    return runCatching { Instant.parse(value).toEpochMilli() }.getOrNull()
        ?: runCatching { OffsetDateTime.parse(value).toInstant().toEpochMilli() }.getOrNull()
        ?: runCatching { LocalDate.parse(value.take(10)).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli() }.getOrNull()
}

internal fun parseDay(raw: String?): LocalDate? {
    val value = raw?.trim()?.ifBlank { null } ?: return null
    return runCatching { LocalDate.parse(value.take(10)) }.getOrNull()
        ?: runCatching { OffsetDateTime.parse(value).toLocalDate() }.getOrNull()
}

/** True when [alert] concerns [ticker] (its own ticker or a related one). */
internal fun AlertLedgerItemView.concerns(ticker: String): Boolean =
    this.ticker.equals(ticker, ignoreCase = true) || relatedTickers.any { it.equals(ticker, ignoreCase = true) }

/** The earnings date an alert announces ([AlertLedgerItemView.eventDate]), for earnings alerts and War Rooms only. */
internal fun AlertLedgerItemView.earningsDay(): LocalDate? {
    val earnings = category.equals("earnings", ignoreCase = true) ||
        notificationType.contains("earnings", ignoreCase = true) || warRoomId != null
    return if (earnings) parseDay(eventDate) else null
}

/** The next earnings date for [ticker] at or after [today] from the alert ledger, with whether a War Room gave it. */
internal fun nextEarnings(alerts: List<AlertLedgerItemView>, ticker: String, today: LocalDate): Pair<LocalDate, Boolean>? =
    alerts.asSequence()
        .filter { it.concerns(ticker) && it.mutedAt == null }
        .mapNotNull { alert -> alert.earningsDay()?.takeIf { !it.isBefore(today) }?.let { it to (alert.warRoomId != null) } }
        .minByOrNull { it.first }

private val Weekday = DateTimeFormatter.ofPattern("EEE", Locale.US)

/** A day said briefly in rows and captions (#11): "today", "Tue" within the last week, else "21 Nov". */
internal fun briefDay(day: LocalDate, today: LocalDate, fmt: Fmt): String = when {
    day == today -> NamesCopy.TODAY
    day.isBefore(today) && !day.isBefore(today.minusDays(BRIEF_WEEKDAY_DAYS)) -> day.format(Weekday)
    else -> fmt.shortDate(day)
}

private const val BRIEF_WEEKDAY_DAYS = 6L

/** A whole-point score change with its sign and no unit (#11 "+4 since Tue"): "+4", "−9". */
internal fun signedPoints(change: Double): String {
    val n = Math.round(change)
    return when {
        n > 0 -> "+" + Fmt.number(n)
        n < 0 -> Fmt.MINUS + Fmt.number(-n)
        else -> Fmt.number(0L)
    }
}

/** Builds the board's rows from [inputs] in watchlist order (sorting is [sortBoard]'s job). */
fun buildBoardRows(inputs: BoardInputs, fmt: Fmt, now: Instant): List<BoardRow> {
    val zone = ZoneId.systemDefault()
    val today = now.atZone(zone).toLocalDate()
    fun dayOf(ms: Long): String = briefDay(Instant.ofEpochMilli(ms).atZone(zone).toLocalDate(), today, fmt)
    val focus = inputs.focusTicker?.trim()?.uppercase()?.ifBlank { null }
    return inputs.watchlist.map { it.trim().uppercase() }.filter { it.isNotEmpty() }.distinct().map { ticker ->
        val snapshot = inputs.snapshots.firstOrNull { it.ticker.equals(ticker, ignoreCase = true) }
        val delta = inputs.deltas[ticker]
        val tone = if (snapshot == null) Tone.Unknown else thesisStateTone(snapshot.state)
        val word = stateWordOf(snapshot?.state)
        val score = scoreOutOf100(snapshot?.score)
        val previous = delta?.previous
        val change = if (previous != null && score != null) {
            scoreOutOf100(previous.score)?.let { score - it }
        } else {
            null
        }
        val changed = delta?.stateChanged == true || (change != null && abs(change) >= SCORE_CHANGE_MIN)
        val reportAtMs = parseMs(snapshot?.lastDeepDiveAt) ?: parseMs(snapshot?.reportGeneratedAt)
        val line2 = when {
            snapshot == null -> NamesCopy.NO_REPORT
            delta?.stateChanged == true -> NamesCopy.stateChange(
                stateWordOf(previous?.state),
                word,
                parseMs(snapshot.updatedAt)?.let(::dayOf),
            )
            else -> snapshot.reason.trim().ifBlank { word }
        }
        // The caption is short on purpose (#11 "+4 since Tue"): at 360 dp the trailing block must leave room for the
        // company name and line 2. An unchanged score says nothing; with no earlier reading, the report's day.
        val (caption, captionTone) = when {
            snapshot == null -> null to Tone.Neutral
            previous != null && change != null -> {
                if (abs(change) >= SCORE_CHANGE_MIN && Math.round(change) != 0L) {
                    NamesCopy.scoreSince(signedPoints(change), dayOf(previous.takenAtMs)) to
                        if (change > 0) Tone.Favourable else Tone.Unfavourable
                } else {
                    null to Tone.Neutral
                }
            }
            reportAtMs != null -> NamesCopy.reportOn(dayOf(reportAtMs)) to Tone.Neutral
            else -> null to Tone.Neutral
        }
        val tickerAlerts = inputs.alerts.filter { it.concerns(ticker) }
        val newAlerts = if (inputs.lastVisitAtMs <= 0L) {
            0
        } else {
            tickerAlerts.count { (parseMs(it.createdAt) ?: 0L) > inputs.lastVisitAtMs }
        }
        val earningsSoon = ticker in inputs.warRooms || tickerAlerts.any { alert ->
            alert.mutedAt == null && alert.earningsDay()?.let { day ->
                !day.isBefore(today) && !day.isAfter(today.plusDays(EARNINGS_SOON_DAYS))
            } == true
        }
        BoardRow(
            ticker = ticker,
            company = inputs.companyNames[ticker]?.trim()?.ifBlank { null },
            stateWord = word,
            stateTone = tone,
            line2 = line2,
            figure = score?.let { Fmt.score(it) },
            figureCaption = caption,
            figureTone = captionTone,
            changed = inputs.lastVisitAtMs > 0L && changed,
            atRisk = tone == Tone.Unfavourable,
            earningsSoon = earningsSoon,
            hasNote = ticker in inputs.notedTickers,
            newAlerts = newAlerts,
            score = score,
            reportAtMs = reportAtMs,
            reportId = snapshot?.reportId?.trim()?.ifBlank { null },
            warRoomId = inputs.warRooms[ticker],
            pinned = ticker == focus,
        )
    }
}

/** Rows that pass [filter]. */
fun filterBoard(rows: List<BoardRow>, filter: BoardFilter): List<BoardRow> = when (filter) {
    BoardFilter.All -> rows
    BoardFilter.Changed -> rows.filter { it.changed }
    BoardFilter.AtRisk -> rows.filter { it.atRisk }
    BoardFilter.EarningsSoon -> rows.filter { it.earningsSoon }
    BoardFilter.WithNotes -> rows.filter { it.hasNote }
}

/** Count per filter, for the chip labels ("At risk 1"). */
fun boardFilterCounts(rows: List<BoardRow>): Map<BoardFilter, Int> =
    BoardFilter.entries.associateWith { filterBoard(rows, it).size }

/** Rows in [sort] order; a pinned row (opened from an alert) leads. */
fun sortBoard(rows: List<BoardRow>, sort: BoardSort): List<BoardRow> {
    val byTicker = compareBy<BoardRow> { it.ticker }
    val comparator: Comparator<BoardRow> = when (sort) {
        BoardSort.State -> compareBy<BoardRow> { it.severity }.thenBy { if (it.changed) 0 else 1 }.then(byTicker)
        BoardSort.Score -> compareBy<BoardRow> { it.score == null }.thenBy { it.score ?: 0.0 }.then(byTicker)
        BoardSort.ReportAge -> compareBy<BoardRow> { it.reportAtMs != null }.thenBy { it.reportAtMs ?: 0L }.then(byTicker)
        BoardSort.Ticker -> byTicker
    }
    return rows.sortedWith(compareBy<BoardRow> { if (it.pinned) 0 else 1 }.then(comparator))
}

/** The pager scope a Name opened from the board carries ("names:filter=changed|sort=state", 4.5). */
fun namesPagerScope(filter: BoardFilter, sort: BoardSort): String = "names:filter=${filter.key}|sort=${sort.key}"

/** Filter and sort named by a [namesPagerScope] string; defaults for anything unreadable. */
fun parseNamesPagerScope(scope: String?): Pair<BoardFilter, BoardSort> {
    val parts = scope?.removePrefix("names:")?.split('|').orEmpty()
        .mapNotNull { part -> part.split('=', limit = 2).takeIf { it.size == 2 }?.let { it[0] to it[1] } }
        .toMap()
    return BoardFilter.of(parts["filter"]) to BoardSort.of(parts["sort"])
}

/**
 * The tickers of the board in the order [scope] shows them: what the Name pager walks through ("3 of 12"). WP-INT
 * calls it with the same [inputs] the board renders from, so the pager and the list never disagree.
 */
fun namesBoardOrder(scope: String?, inputs: BoardInputs, now: Instant = Instant.now()): List<String> {
    val (filter, sort) = parseNamesPagerScope(scope)
    val fmt = Fmt(Clock.systemDefaultZone(), ZoneId.systemDefault(), is24h = true)
    return sortBoard(filterBoard(buildBoardRows(inputs, fmt, now), filter), sort).map { it.ticker }
}

/** Ticker syntax the board accepts: letters first, then letters, digits, dot or dash (BRK.B, RDS-A). */
private val TickerPattern = Regex("^[A-Z][A-Z0-9.\\-]{0,9}$")

/** Why [input] cannot be followed, or null when it can. */
fun followError(input: String, watchlist: List<String>): String? {
    val ticker = input.trim().uppercase()
    return when {
        ticker.isEmpty() -> null
        !TickerPattern.matches(ticker) -> NamesCopy.INVALID_TICKER
        watchlist.any { it.equals(ticker, ignoreCase = true) } -> NamesCopy.alreadyFollowed(ticker)
        else -> null
    }
}

// =====================================================================================================================
// Notes view model (pure)
// =====================================================================================================================

/** One ticker in the Notes view: its latest note and how many earlier ones it has. */
@Immutable
data class NotesGroup(
    val ticker: String,
    val company: String?,
    val latest: NoteTrailEntry,
    val earlier: Int,
    val latestAtMs: Long?,
    val texts: List<String>,
)

/** Tickers that have notes, newest note first (5.28); blank notes are not notes. */
fun groupNotes(notes: List<NoteTrailEntry>, companyNames: Map<String, String> = emptyMap()): List<NotesGroup> =
    notes.asSequence()
        .filter { it.text.isNotBlank() && !it.ticker.isNullOrBlank() }
        .groupBy { it.ticker!!.trim().uppercase() }
        .map { (ticker, entries) ->
            val sorted = entries.sortedByDescending { parseMs(it.updatedAt) ?: Long.MIN_VALUE }
            NotesGroup(
                ticker = ticker,
                company = companyNames[ticker]?.trim()?.ifBlank { null },
                latest = sorted.first(),
                earlier = sorted.size - 1,
                latestAtMs = parseMs(sorted.first().updatedAt),
                texts = sorted.map { it.text },
            )
        }
        .sortedWith(compareByDescending<NotesGroup> { it.latestAtMs ?: Long.MIN_VALUE }.thenBy { it.ticker })

/** The Notes view's local text filter: ticker, company or any note text, case-insensitive. */
fun filterNotes(groups: List<NotesGroup>, query: String): List<NotesGroup> {
    val q = query.trim()
    if (q.isEmpty()) return groups
    return groups.filter { g ->
        g.ticker.contains(q, ignoreCase = true) ||
            g.company?.contains(q, ignoreCase = true) == true ||
            g.texts.any { it.contains(q, ignoreCase = true) }
    }
}

// =====================================================================================================================
// Holdings CSV import (5.10 item 9): the UI state; the Android file picker is in HoldingsCsvImport.kt
// =====================================================================================================================

/** What the system file picker handed back (HoldingsCsvImport.kt reads the file off the main thread). */
sealed interface CsvPick {
    data class Text(val csv: String) : CsvPick
    data object Unreadable : CsvPick
    data object Cancelled : CsvPick
}

/** Where the import panel stands. */
sealed interface CsvImportState {
    data object Idle : CsvImportState
    data object Importing : CsvImportState
    data class Done(val result: HoldingsImportResultView) : CsvImportState
    data class Failed(val message: String) : CsvImportState
}

// =====================================================================================================================
// Screen
// =====================================================================================================================

/**
 * Names (5.10). Parameters after [onOpenWarRoom] are new in PR-3 and have defaults, so the shell keeps compiling
 * until WP-INT wires them (HANDOFF-B):
 * - [refreshing] / [loaded] / [error]: `isBoardRefreshing`, `watchlistLoaded`, the board's last load error.
 * - [snapshotDeltas], [lastVisitAtMs], [allNotes], [companyNames]: the 5.5 client data layer.
 * - [onOpenName] (until wired: [onOpenResearch]) gets the ticker, the pager scope (`Destination.Name(ticker, pagerScope)`) and the row's window
 *   bounds for the container transform; [onOpenNotes] opens Name at "Your notes".
 * - [onShowUndo] shows the undo snackbar and returns true when the user tapped Undo; without it the remove commits
 *   once the row has collapsed. A confirmed remove is never dropped: when Names leaves composition before the
 *   snackbar resolves (tab switch, push, the Notes segment), the remove commits then.
 * - [now] is for renders and tests; the app leaves it null and the screen reads the clock when new data arrives.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun NamesScreen(
    padding: PaddingValues,
    watchlist: List<String>,
    monitorSnapshots: List<ThesisMonitorSnapshotView>,
    alerts: List<AlertLedgerItemView>,
    focusTicker: String? = null,
    onRefresh: () -> Unit,
    onAddTicker: (String) -> Unit,
    onRemoveTicker: (String) -> Unit,
    onRunDeepDive: (String) -> Unit,
    onOpenResearch: (String) -> Unit,
    onImportHoldingsCsv: suspend (String) -> Result<HoldingsImportResultView>,
    warRoomByTicker: Map<String, String> = emptyMap(),
    onOpenWarRoom: (String) -> Unit = {},
    refreshing: Boolean = false,
    loaded: Boolean = true,
    error: String? = null,
    snapshotDeltas: Map<String, SnapshotDelta> = emptyMap(),
    lastVisitAtMs: Long = 0L,
    allNotes: List<NoteTrailEntry> = emptyList(),
    companyNames: Map<String, String> = emptyMap(),
    tickerSuggestions: List<TickerSearchItem> = emptyList(),
    density: ListDensity = ListDensity.Comfortable,
    now: Instant? = null,
    onDensityChange: (ListDensity) -> Unit = {},
    onQueryTickers: (String) -> Unit = {},
    onLoadNotes: () -> Unit = {},
    onOpenName: (ticker: String, pagerScope: String, bounds: Rect?) -> Unit = { ticker, _, _ -> onOpenResearch(ticker) },
    onOpenNotes: (ticker: String) -> Unit = { onOpenName(it, namesPagerScope(BoardFilter.All, BoardSort.State), null) },
    // Until WP-INT wires it: the Deep Dive request for the ticker returns the stored report (SPEC rule 1).
    onOpenReport: (reportId: String, ticker: String) -> Unit = { _, ticker -> onRunDeepDive(ticker) },
    onCompare: (List<String>) -> Unit = {},
    onCompareWith: (String) -> Unit = {},
    onExportNotes: (() -> Unit)? = null,
    onShowUndo: (suspend (message: String, action: String) -> Boolean)? = null,
    initialSegment: Int = 0,
) {
    val fmt = LocalFmt.current
    var segment by rememberSaveable { mutableStateOf(initialSegment.coerceIn(0, 1)) }
    LaunchedEffect(Unit) { onLoadNotes() }

    val notedTickers = remember(allNotes) {
        allNotes.filter { it.text.isNotBlank() }.mapNotNull { it.ticker?.trim()?.uppercase() }.toSet()
    }
    val inputs = BoardInputs(
        watchlist = watchlist,
        snapshots = monitorSnapshots,
        alerts = alerts,
        deltas = snapshotDeltas,
        notedTickers = notedTickers,
        companyNames = companyNames,
        warRooms = warRoomByTicker,
        lastVisitAtMs = lastVisitAtMs,
        focusTicker = focusTicker,
    )
    val clock = rememberNow(now, monitorSnapshots to alerts)
    val rows = remember(inputs, fmt, clock) { buildBoardRows(inputs, fmt, clock) }
    val asOf = remember(monitorSnapshots, fmt) {
        monitorSnapshots.mapNotNull { parseMs(it.updatedAt) }.maxOrNull()?.let { fmt.asOf(Instant.ofEpochMilli(it)) }
    }
    val latestNoteAt = remember(allNotes) { allNotes.filter { it.text.isNotBlank() }.mapNotNull { parseMs(it.updatedAt) }.maxOrNull() }
    val notesMeta = latestNoteAt?.let { NamesCopy.notesMeta(fmt.relative(Instant.ofEpochMilli(it))) } ?: asOf

    Box(Modifier.fillMaxSize()) {
        if (segment == 0) {
            Board(
                padding = padding,
                rows = rows,
                watchlist = watchlist,
                loaded = loaded,
                refreshing = refreshing,
                error = error,
                asOf = asOf,
                hasVisited = lastVisitAtMs > 0L,
                tickerSuggestions = tickerSuggestions,
                density = density,
                onDensityChange = onDensityChange,
                header = { NamesHeaderRow(segment, { segment = it }) },
                onRefresh = onRefresh,
                onAddTicker = onAddTicker,
                onRemoveTicker = onRemoveTicker,
                onRunDeepDive = onRunDeepDive,
                onOpenReport = onOpenReport,
                onOpenWarRoom = onOpenWarRoom,
                onImportHoldingsCsv = onImportHoldingsCsv,
                onQueryTickers = onQueryTickers,
                onOpenName = onOpenName,
                onOpenNotes = onOpenNotes,
                onCompare = onCompare,
                onCompareWith = onCompareWith,
                onShowUndo = onShowUndo,
            )
        } else {
            NotesView(
                padding = padding,
                notes = allNotes,
                companyNames = companyNames,
                meta = notesMeta,
                header = { NamesHeaderRow(segment, { segment = it }) },
                onOpenNotes = onOpenNotes,
                onExportNotes = onExportNotes,
            )
        }
    }
}

/**
 * The current time for relative captions: [override] in renders and tests, else the wall clock read once per
 * [refreshKey] (new data from a load or refresh), so rows are not rebuilt on every recomposition (rubric P1) and
 * "2 days ago" moves with each refresh. No ticking loop: a perpetual delay would keep Compose tests from idling.
 */
@Composable
internal fun rememberNow(override: Instant?, refreshKey: Any?): Instant =
    remember(override, refreshKey) { override ?: Instant.now() }

/** The Board · Notes segmented control under the header (5.10 item 3). */
@Composable
private fun NamesHeaderRow(segment: Int, onSegment: (Int) -> Unit) {
    SegmentedControl(
        options = NamesCopy.segments,
        selectedIndex = segment,
        onSelect = onSegment,
        modifier = Modifier.padding(horizontal = ThesisSpace.gutter),
    )
}


/** Where a list starts and ends under the shell's bars; the gutter is applied per item so chips scroll edge to edge. */
private fun listPadding(padding: PaddingValues, extraBottom: Dp = 0.dp): PaddingValues = PaddingValues(
    top = padding.calculateTopPadding() + ThesisSpace.headerTop,
    bottom = ThesisSpace.xxl + extraBottom,
)

/** Room the RunBar takes over the list's end while compare selection is on (button, caption, padding). */
private val RunBarAllowance: Dp = ThesisSpace.x5 + ThesisSpace.x3

/** The screen title block with the screen's icon actions on the title line (5.10 item 1). */
@Composable
private fun HeaderWithActions(
    deck: String?,
    meta: String?,
    refreshing: Boolean,
    actions: @Composable () -> Unit,
) {
    Box(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = ThesisSpace.gutter),
    ) {
        ScreenHeader(title = NamesCopy.TITLE, deck = deck, meta = meta, refreshing = refreshing)
        // Centred on the title's first line: the 48 dp targets overhang it by 8 dp above, never the deck's text.
        Row(
            Modifier
                .align(Alignment.TopEnd)
                .offset(y = -ThesisSpace.s),
        ) { actions() }
    }
}

/** Mutable holder for the bounds a TickerRow reports just before its click (container transform, 4.5). */
private class BoundsHolder {
    var bounds: Rect? = null
}

@OptIn(ExperimentalFoundationApi::class, ExperimentalMaterial3Api::class)
@Composable
private fun Board(
    padding: PaddingValues,
    rows: List<BoardRow>,
    watchlist: List<String>,
    loaded: Boolean,
    refreshing: Boolean,
    error: String?,
    asOf: String?,
    hasVisited: Boolean,
    tickerSuggestions: List<TickerSearchItem>,
    density: ListDensity,
    onDensityChange: (ListDensity) -> Unit,
    header: @Composable () -> Unit,
    onRefresh: () -> Unit,
    onAddTicker: (String) -> Unit,
    onRemoveTicker: (String) -> Unit,
    onRunDeepDive: (String) -> Unit,
    onOpenReport: (String, String) -> Unit,
    onOpenWarRoom: (String) -> Unit,
    onImportHoldingsCsv: suspend (String) -> Result<HoldingsImportResultView>,
    onQueryTickers: (String) -> Unit,
    onOpenName: (String, String, Rect?) -> Unit,
    onOpenNotes: (String) -> Unit,
    onCompare: (List<String>) -> Unit,
    onCompareWith: (String) -> Unit,
    onShowUndo: (suspend (String, String) -> Boolean)?,
) {
    val haptics = rememberHaptics()
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()

    val seed = LocalBoardSeed.current
    var filterKey by rememberSaveable { mutableStateOf(seed.filter.key) }
    var sortKey by rememberSaveable { mutableStateOf(seed.sort.key) }
    // The device preference (You > Appearance, SessionStore) seeds it; the toggle answers at once and reports back.
    var compact by rememberSaveable(density) { mutableStateOf(density == ListDensity.Compact) }
    var input by rememberSaveable { mutableStateOf(seed.input) }
    var inputError by remember { mutableStateOf(seed.inputError) }
    var selecting by rememberSaveable { mutableStateOf(seed.selected.isNotEmpty()) }
    var selected by rememberSaveable { mutableStateOf(seed.selected) }
    var contextFor by rememberSaveable { mutableStateOf(seed.contextFor) }
    var confirmRemove by rememberSaveable { mutableStateOf(seed.confirmRemove) }
    var openSheet by rememberSaveable { mutableStateOf(seed.sheet) }
    var importOpen by rememberSaveable { mutableStateOf(seed.importState != null) }
    var importDetent by remember { mutableStateOf(DockDetent.Half) }
    var importState by remember { mutableStateOf(seed.importState ?: CsvImportState.Idle) }
    val removing = remember { mutableStateListOf<String>() }
    // Tickers already handed to onRemoveTicker, so the snackbar's end, the collapse and leaving the screen commit
    // each confirmed remove exactly once.
    val committed = remember { mutableSetOf<String>() }
    val boundsHolder = remember { BoundsHolder() }
    val undo by rememberUpdatedState(onShowUndo)
    val removeTicker by rememberUpdatedState(onRemoveTicker)
    val fieldFocus = remember { FocusRequester() }

    // A ticker leaves the collapse set once the watchlist no longer has it (the remove reached the server).
    LaunchedEffect(watchlist) {
        val live = watchlist.map { it.trim().uppercase() }.toSet()
        removing.removeAll { it !in live }
        committed.retainAll(live)
        selected = selected.filter { it in live }
    }

    fun endSelection() {
        selecting = false
        selected = emptyList()
    }

    // System back ends compare selection before it leaves the tab.
    ThesisBackHandler(enabled = selecting) { endSelection() }

    val filter = BoardFilter.of(filterKey)
    val sort = BoardSort.of(sortKey)
    val counts = remember(rows) { boardFilterCounts(rows) }
    val shown = remember(rows, filter, sort) { sortBoard(filterBoard(rows, filter), sort) }
    val pagerScope = namesPagerScope(filter, sort)
    val changedCount = counts[BoardFilter.Changed] ?: 0
    val firstLoad = !loaded && watchlist.isEmpty() && error == null
    val showSkeleton = rememberShowSkeleton(loading = firstLoad)

    fun follow(raw: String) {
        val ticker = raw.trim().uppercase()
        if (ticker.isEmpty()) return
        val problem = followError(ticker, watchlist)
        if (problem != null) {
            inputError = problem
            haptics.reject()
        } else {
            haptics.press()
            onAddTicker(ticker)
            input = ""
            inputError = null
        }
    }

    fun commitRemoval(ticker: String) {
        if (committed.add(ticker)) removeTicker(ticker)
    }

    fun startRemoval(ticker: String) {
        if (ticker !in removing) removing += ticker
        selected = selected - ticker
        val show = undo ?: return
        scope.launch {
            var undone = false
            try {
                undone = show(NamesCopy.removed(ticker), NamesCopy.UNDO)
            } finally {
                // Also on cancellation (the board left composition before the snackbar resolved): the user
                // confirmed the remove, so only an Undo tap keeps the name.
                if (undone) removing -= ticker else commitRemoval(ticker)
            }
        }
    }

    // A remove still collapsing (no undo wired) or waiting on its snackbar commits when the board leaves.
    DisposableEffect(Unit) {
        onDispose { removing.toList().forEach(::commitRemoval) }
    }

    val emptyAndLoaded = loaded && error == null && watchlist.isEmpty()

    val launchPicker = rememberHoldingsCsvPicker { pick ->
        when (pick) {
            is CsvPick.Text -> scope.launch {
                importState = CsvImportState.Importing
                importState = onImportHoldingsCsv(pick.csv).fold(
                    onSuccess = { CsvImportState.Done(it) },
                    onFailure = { CsvImportState.Failed(it.message?.takeIf(String::isNotBlank) ?: NamesCopy.IMPORT_FAILED) },
                )
            }
            CsvPick.Unreadable -> importState = CsvImportState.Failed(NamesCopy.IMPORT_UNREADABLE)
            CsvPick.Cancelled -> Unit
        }
    }

    Box(Modifier.fillMaxSize()) {
        ThesisRefreshBox(
            refreshing = refreshing,
            onRefresh = onRefresh,
            modifier = Modifier
                .fillMaxSize()
                .padding(padding.exceptTop()),
            indicatorTop = padding.calculateTopPadding(),
        ) {
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .fillMaxSize()
                    .wrapDataWidth(),
                contentPadding = listPadding(padding, if (selecting) RunBarAllowance else 0.dp),
            ) {
                item(key = "header", contentType = "header") {
                    HeaderWithActions(
                        deck = if (firstLoad) null else NamesCopy.boardLede(rows.size, changedCount, hasVisited),
                        meta = asOf,
                        refreshing = refreshing,
                    ) {
                        // Sort, density and compare act on rows: none of them shows on an empty board.
                        if (rows.isNotEmpty()) {
                            ThesisIconButton(ThesisIcons.Sort, NamesCopy.SORT, { openSheet = SHEET_SORT })
                            ThesisIconButton(
                                if (compact) ThesisIcons.DensityComfortable else ThesisIcons.DensityCompact,
                                if (compact) NamesCopy.DENSITY_TO_COMFORTABLE else NamesCopy.DENSITY_TO_COMPACT,
                                {
                                    compact = !compact
                                    onDensityChange(if (compact) ListDensity.Compact else ListDensity.Comfortable)
                                },
                            )
                        }
                        if (rows.size >= 2) {
                            ThesisIconButton(
                                ThesisIcons.Compare,
                                NamesCopy.COMPARE,
                                { if (selecting) endSelection() else selecting = true },
                                tint = if (selecting) LocalThesisPalette.current.accent else Color.Unspecified,
                            )
                        }
                        ThesisIconButton(ThesisIcons.Overflow, NamesCopy.MORE, { openSheet = SHEET_MORE })
                    }
                }
                item(key = "segments", contentType = "segments") {
                    Column {
                        Spacer(Modifier.height(ThesisSpace.headerToSection))
                        header()
                    }
                }
                item(key = "field", contentType = "field") {
                    val trimmed = input.trim().uppercase()
                    val suggestions = remember(trimmed, tickerSuggestions, watchlist) {
                        tickerSuggestionsFor(trimmed, tickerSuggestions, watchlist)
                    }
                    Column(Modifier.padding(horizontal = ThesisSpace.gutter)) {
                        // One header group: the field sits close under the control it belongs with (24 dp to data).
                        Spacer(Modifier.height(ThesisSpace.l))
                        TickerField(
                            value = input,
                            onValueChange = {
                                input = it
                                inputError = null
                                onQueryTickers(it.trim())
                            },
                            onSearch = { follow(input) },
                            label = NamesCopy.FIELD_LABEL,
                            placeholder = NamesCopy.FIELD_PLACEHOLDER,
                            error = inputError,
                            suggestions = suggestions,
                            onPickSuggestion = { s ->
                                if (s.inYourNames) {
                                    input = ""
                                    onOpenName(s.ticker, pagerScope, null)
                                } else {
                                    follow(s.ticker)
                                }
                            },
                            actionLabel = NamesCopy.FOLLOW.takeIf { trimmed.isNotEmpty() && followError(trimmed, watchlist) == null },
                            modifier = Modifier.focusRequester(fieldFocus),
                        )
                        // Empty board (5.10): the field is focused, so the first thing to do is type a ticker. Run
                        // from the field's own item, so the requester is attached when it asks.
                        LaunchedEffect(emptyAndLoaded) {
                            if (emptyAndLoaded) runCatching { fieldFocus.requestFocus() }
                        }
                    }
                }
                if (watchlist.isNotEmpty()) {
                    item(key = "filters", contentType = "filters") {
                        Column {
                            Spacer(Modifier.height(ThesisSpace.m))
                            ChipRow {
                                items(BoardFilter.entries, key = { it.key }) { f ->
                                    ThesisChip(
                                        label = f.label,
                                        selected = f == filter,
                                        onClick = { filterKey = f.key },
                                        count = counts[f],
                                    )
                                }
                            }
                        }
                    }
                }
                item(key = "gap", contentType = "gap") { Spacer(Modifier.height(ThesisSpace.m)) }
                if (selecting) {
                    // Compare selection says what it wants and how to leave it (system back does the same).
                    item(key = "selecting", contentType = "selecting") {
                        Row(
                            Modifier
                                .padding(start = ThesisSpace.gutter, end = ThesisSpace.gutter, bottom = ThesisSpace.s)
                                .fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                if (selected.size < 2) NamesCopy.COMPARE_PICK else NamesCopy.compareSelected(selected.size),
                                Modifier.weight(1f),
                                style = ThesisType.caption,
                                color = LocalThesisPalette.current.muted,
                            )
                            TextAction(NamesCopy.CANCEL, { endSelection() })
                        }
                    }
                }
                if (error != null && watchlist.isNotEmpty()) {
                    item(key = "banner", contentType = "banner") {
                        InlineBanner(
                            text = error,
                            tone = BannerTone.Attention,
                            actionLabel = KitCopy.TRY_AGAIN,
                            onAction = onRefresh,
                            modifier = Modifier.padding(start = ThesisSpace.gutter, end = ThesisSpace.gutter, bottom = ThesisSpace.m),
                        )
                    }
                }
                boardBody(
                    firstLoad = firstLoad,
                    showSkeleton = showSkeleton,
                    failed = error != null && watchlist.isEmpty(),
                    error = error,
                    watchlistEmpty = watchlist.isEmpty(),
                    shown = shown,
                    filter = filter,
                    compact = compact,
                    selecting = selecting,
                    selected = selected,
                    removing = removing,
                    onRetry = onRefresh,
                    onShowAll = { filterKey = BoardFilter.All.key },
                    onToggleSelected = { ticker ->
                        selected = when {
                            ticker in selected -> selected - ticker
                            selected.size >= COMPARE_MAX -> {
                                haptics.reject()
                                selected
                            }
                            else -> selected + ticker
                        }
                    },
                    onOpen = { ticker -> onOpenName(ticker, pagerScope, boundsHolder.bounds) },
                    onBounds = { boundsHolder.bounds = it },
                    onContext = { contextFor = it },
                    onRemoved = { ticker -> if (undo == null) commitRemoval(ticker) },
                )
            }
        }

        RunBar(
            label = NamesCopy.compareRun(selected.size),
            onClick = {
                onCompare(selected)
                endSelection()
            },
            visible = selecting,
            enabled = selected.size in 2..COMPARE_MAX,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = padding.calculateBottomPadding()),
        )

        DockPanel(
            visible = importOpen,
            onDismiss = {
                importOpen = false
                if (importState !is CsvImportState.Importing) importState = CsvImportState.Idle
            },
            detent = importDetent,
            onDetentChange = { importDetent = it },
            title = NamesCopy.IMPORT_TITLE,
            modifier = Modifier.padding(bottom = padding.calculateBottomPadding()),
        ) {
            HoldingsImportPanel(state = importState, onPick = launchPicker)
        }
    }

    contextFor?.let { ticker ->
        val row = rows.firstOrNull { it.ticker == ticker }
        if (row == null) {
            contextFor = null
        } else {
            ThesisSheet(onDismissRequest = { contextFor = null }, title = row.company?.let { "${row.ticker} · $it" } ?: row.ticker) {
                NameContextActions(
                    row = row,
                    onAction = { action ->
                        contextFor = null
                        when (action) {
                            NameContextAction.OpenReport -> row.reportId?.let { onOpenReport(it, row.ticker) }
                            NameContextAction.BuildReport -> onRunDeepDive(row.ticker)
                            NameContextAction.WriteNote -> onOpenNotes(row.ticker)
                            NameContextAction.CompareWith -> onCompareWith(row.ticker)
                            NameContextAction.WarRoom -> row.warRoomId?.let(onOpenWarRoom)
                            NameContextAction.Remove -> confirmRemove = row.ticker
                        }
                    },
                )
            }
        }
    }

    confirmRemove?.let { ticker ->
        ThesisDialog(
            onDismissRequest = { confirmRemove = null },
            title = NamesCopy.removeTitle(ticker),
            body = NamesCopy.REMOVE_BODY,
            confirm = DialogAction(NamesCopy.REMOVE_CONFIRM, {
                haptics.reject()
                confirmRemove = null
                startRemoval(ticker)
            }),
            destructive = true,
        )
    }

    when (openSheet) {
        SHEET_SORT -> ThesisSheet(onDismissRequest = { openSheet = null }, title = NamesCopy.SORT_TITLE) {
            BoardSort.entries.forEach { option ->
                OptionRow(label = option.label, selected = option == sort, onClick = {
                    sortKey = option.key
                    openSheet = null
                })
            }
        }
        SHEET_MORE -> ThesisSheet(onDismissRequest = { openSheet = null }) {
            SheetActionRow(ThesisIcons.Small.Add, NamesCopy.IMPORT_CSV, {
                openSheet = null
                importState = CsvImportState.Idle
                importOpen = true
            })
            SheetActionRow(ThesisIcons.Small.Retry, NamesCopy.REFRESH, {
                openSheet = null
                onRefresh()
            })
        }
    }
}

internal const val SHEET_SORT = "sort"
internal const val SHEET_MORE = "more"

/**
 * The board's starting UI state. Always the default in the app; renders and semantics tests provide one to open
 * the board on a filter, a selection, a sheet, the remove confirm or the import panel. An empty [selected] list
 * means compare selection is off; [importState] non-null opens the import panel in that state.
 */
internal data class BoardSeed(
    val filter: BoardFilter = BoardFilter.All,
    val sort: BoardSort = BoardSort.State,
    val input: String = "",
    val inputError: String? = null,
    val selected: List<String> = emptyList(),
    val contextFor: String? = null,
    val confirmRemove: String? = null,
    val sheet: String? = null,
    val importState: CsvImportState? = null,
)

internal val LocalBoardSeed = staticCompositionLocalOf { BoardSeed() }

/** Compare names takes 2 to 4 tickers (5.26). */
const val COMPARE_MAX = 4

/** Rows of the field's in-window suggestion list: your names first, then the server's matches (at most 6). */
internal fun tickerSuggestionsFor(query: String, items: List<TickerSearchItem>, watchlist: List<String>): List<TickerSuggestion> {
    if (query.isEmpty()) return emptyList()
    val followed = watchlist.map { it.uppercase() }.toSet()
    return items.asSequence()
        .filter { it.symbol.startsWith(query, ignoreCase = true) || it.companyName.contains(query, ignoreCase = true) }
        .distinctBy { it.symbol.uppercase() }
        .map { TickerSuggestion(it.symbol.uppercase(), it.companyName.ifBlank { null }, inYourNames = it.symbol.uppercase() in followed) }
        .sortedBy { if (it.inYourNames) 0 else 1 }
        .take(SUGGESTIONS_MAX)
        .toList()
}

private const val SUGGESTIONS_MAX = 6

/** The board below the field: skeleton, error, empty states or the rows (one card, a lazy item per row). */
@OptIn(ExperimentalFoundationApi::class)
private fun LazyListScope.boardBody(
    firstLoad: Boolean,
    showSkeleton: Boolean,
    failed: Boolean,
    error: String?,
    watchlistEmpty: Boolean,
    shown: List<BoardRow>,
    filter: BoardFilter,
    compact: Boolean,
    selecting: Boolean,
    selected: List<String>,
    removing: List<String>,
    onRetry: () -> Unit,
    onShowAll: () -> Unit,
    onToggleSelected: (String) -> Unit,
    onOpen: (String) -> Unit,
    onBounds: (Rect) -> Unit,
    onContext: (String) -> Unit,
    onRemoved: (String) -> Unit,
) {
    when {
        firstLoad -> item(key = "skeleton", contentType = "skeleton") {
            // Shown only after the 300 ms grace (#25), so a fast load never flashes it.
            if (showSkeleton) {
                Column(Modifier.padding(horizontal = ThesisSpace.gutter)) {
                    repeat(SKELETON_ROWS) { i ->
                        SkeletonRow(Modifier.rowGroupSegment(RowPosition.of(i, SKELETON_ROWS), LeadingRowDividerInset))
                    }
                }
            }
        }
        failed -> item(key = "error", contentType = "state") {
            ErrorState(
                title = KitCopy.couldNotLoad(NamesCopy.ERROR_SUBJECT),
                cause = error,
                onRetry = onRetry,
                modifier = Modifier.padding(horizontal = ThesisSpace.gutter),
            )
        }
        watchlistEmpty -> item(key = "empty", contentType = "state") {
            EmptyState(
                sentence = NamesCopy.EMPTY_BOARD,
                how = NamesCopy.EMPTY_BOARD_HOW,
                icon = ThesisIcons.Names,
                modifier = Modifier.padding(horizontal = ThesisSpace.gutter),
            )
        }
        shown.isEmpty() -> item(key = "filter-empty", contentType = "state") {
            EmptyState(
                sentence = emptyFilterSentence(filter),
                how = NamesCopy.EMPTY_FILTER_HOW,
                actionLabel = NamesCopy.FILTER_ALL,
                onAction = onShowAll,
                modifier = Modifier.padding(horizontal = ThesisSpace.gutter),
            )
        }
        else -> itemsIndexed(shown, key = { _, row -> row.ticker }, contentType = { _, _ -> if (compact) "row-compact" else "row" }) { i, row ->
            val position = RowPosition.of(i, shown.size)
            val inset = if (compact && !selecting) CompactRowDividerInset else LeadingRowDividerInset
            DismissibleItem(
                removing = row.ticker in removing,
                onRemoved = { onRemoved(row.ticker) },
                modifier = Modifier
                    .animateItemPlacement(ThesisMotion.spatial())
                    .padding(horizontal = ThesisSpace.gutter)
                    .rowGroupSegment(position, inset),
            ) {
                if (selecting) {
                    SelectableNameRow(row = row, selected = row.ticker in selected, compact = compact, onToggle = { onToggleSelected(row.ticker) })
                } else {
                    TickerRow(
                        ticker = row.ticker,
                        stateTone = row.stateTone,
                        onClick = { onOpen(row.ticker) },
                        company = row.company,
                        line2 = row.line2,
                        figure = row.figure,
                        figureCaption = row.figureCaption,
                        figureCaptionTone = row.figureTone,
                        stateLabel = row.stateWord,
                        hasNote = row.hasNote,
                        count = row.newAlerts.takeIf { it > 0 }?.let(NamesCopy::newAlerts),
                        compact = compact,
                        onLongClick = { onContext(row.ticker) },
                        onBoundsCaptured = onBounds,
                    )
                }
            }
        }
    }
}

private const val SKELETON_ROWS = 5

private fun emptyFilterSentence(filter: BoardFilter): String = when (filter) {
    BoardFilter.Changed -> NamesCopy.EMPTY_CHANGED
    BoardFilter.AtRisk -> NamesCopy.EMPTY_AT_RISK
    BoardFilter.EarningsSoon -> NamesCopy.EMPTY_EARNINGS
    BoardFilter.WithNotes -> NamesCopy.EMPTY_NOTES_FILTER
    BoardFilter.All -> NamesCopy.EMPTY_BOARD
}

/** Data screens may widen to 960 dp on wide windows, never centring a narrow column for a table (2.5). */
internal fun Modifier.wrapDataWidth(): Modifier = this.then(Modifier.widthIn(max = ThesisSpace.dataMaxWidth))

/** A board row in compare selection (5.10 item 8): the check box in the leading column, the whole row toggles. */
@Composable
private fun SelectableNameRow(row: BoardRow, selected: Boolean, compact: Boolean, onToggle: () -> Unit) {
    val p = LocalThesisPalette.current
    val source = remember { MutableInteractionSource() }
    Row(
        Modifier
            .fillMaxWidth()
            .toggleable(value = selected, interactionSource = source, indication = null, role = Role.Checkbox, onValueChange = { onToggle() })
            .thesisPress(source)
            .heightIn(min = if (compact) ThesisSpace.rowMinCompact else ThesisSpace.rowMinComfortable)
            .padding(horizontal = ThesisSpace.l, vertical = ThesisSpace.rowPaddingV),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.width(ThesisSpace.leadingColumn), contentAlignment = Alignment.CenterStart) {
            ThesisCheckbox(checked = selected, onCheckedChange = null)
        }
        Spacer(Modifier.width(ThesisSpace.leadingGap))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
                Text(row.ticker, style = ThesisType.rowTitle, color = p.ink, maxLines = 1)
                if (row.company != null) {
                    Text(row.company, Modifier.weight(1f, fill = false), style = ThesisType.bodySmall, color = p.muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
        Spacer(Modifier.width(ThesisSpace.m))
        StatusSquare(row.stateTone)
        Spacer(Modifier.width(ThesisSpace.s))
        Text(row.stateWord, style = ThesisType.caption, color = p.ink2, maxLines = 1)
    }
}

/** The long-press menu of a board row (5.10 item 7). */
enum class NameContextAction { OpenReport, BuildReport, WriteNote, CompareWith, WarRoom, Remove }

/** The context sheet's rows, labelled by the row's state: Open report when one is stored, else Build report. */
@Composable
internal fun NameContextActions(row: BoardRow, onAction: (NameContextAction) -> Unit) {
    if (row.reportId != null) {
        SheetActionRow(ThesisIcons.Small.DeepDive, NamesCopy.OPEN_REPORT, { onAction(NameContextAction.OpenReport) })
    } else {
        SheetActionRow(ThesisIcons.Small.DeepDive, NamesCopy.BUILD_REPORT, { onAction(NameContextAction.BuildReport) })
    }
    SheetActionRow(ThesisIcons.Small.Notes, NamesCopy.WRITE_NOTE, { onAction(NameContextAction.WriteNote) })
    SheetActionRow(ThesisIcons.Small.Compare, NamesCopy.COMPARE_WITH, { onAction(NameContextAction.CompareWith) })
    if (row.warRoomId != null) {
        SheetActionRow(ThesisIcons.Small.WarRoom, NamesCopy.WAR_ROOM, { onAction(NameContextAction.WarRoom) })
    }
    SheetActionRow(ThesisIcons.Small.Remove, NamesCopy.REMOVE, { onAction(NameContextAction.Remove) }, destructive = true)
}

/** A radio row in a sheet (sort options): the whole row is the target. */
@Composable
private fun OptionRow(label: String, selected: Boolean, onClick: () -> Unit) {
    val p = LocalThesisPalette.current
    val source = remember { MutableInteractionSource() }
    Row(
        Modifier
            .fillMaxWidth()
            .selectable(selected = selected, interactionSource = source, indication = null, role = Role.RadioButton, onClick = onClick)
            .thesisPress(source)
            .heightIn(min = ThesisSpace.touchMin)
            .padding(vertical = ThesisSpace.s),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(ThesisSpace.l),
    ) {
        ThesisRadio(selected = selected, onClick = null)
        Text(label, style = ThesisType.body, color = p.ink)
    }
}

/** The import panel's body (5.10 item 9): what the file needs, the picker action, progress, then the result card. */
@Composable
internal fun HoldingsImportPanel(state: CsvImportState, onPick: () -> Unit) {
    val p = LocalThesisPalette.current
    val reduced = LocalReducedMotion.current
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
        Text(NamesCopy.IMPORT_BODY, style = ThesisType.body, color = p.ink2)
        AnimatedContent(
            targetState = state,
            contentKey = { it::class },
            transitionSpec = { ThesisTransitions.stateCrossfade(reduced) },
            label = "csv-import",
        ) { s ->
            Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
                when (s) {
                    CsvImportState.Idle -> PrimaryButton(NamesCopy.IMPORT_PICK, onPick, Modifier.fillMaxWidth())
                    CsvImportState.Importing -> {
                        Text(NamesCopy.IMPORT_PROGRESS, style = ThesisType.caption, color = p.muted)
                        LoadingHairline(active = true)
                    }
                    is CsvImportState.Done -> {
                        ImportResultCard(s.result)
                        SecondaryButton(NamesCopy.IMPORT_PICK_AGAIN, onPick, Modifier.fillMaxWidth())
                    }
                    is CsvImportState.Failed -> {
                        InlineBanner(text = s.message, tone = BannerTone.Error)
                        PrimaryButton(NamesCopy.IMPORT_PICK, onPick, Modifier.fillMaxWidth())
                    }
                }
            }
        }
    }
}

@Composable
private fun ImportResultCard(result: HoldingsImportResultView) {
    val p = LocalThesisPalette.current
    var expanded by rememberSaveable { mutableStateOf(false) }
    ThesisCard(title = NamesCopy.importResult(result.imported.size, result.errors.size)) {
        NamesCopy.importFollowed(result.newlyFollowed)?.let { Text(it, style = ThesisType.body, color = p.ink) }
        Text(NamesCopy.importRows(result.rows), style = ThesisType.caption, color = p.muted)
        if (result.errors.isNotEmpty()) {
            TextAction(if (expanded) NamesCopy.HIDE_SKIPPED else NamesCopy.showSkipped(result.errors.size), { expanded = !expanded })
            if (expanded) {
                result.errors.forEach { e ->
                    Text(NamesCopy.rowError(e.line, e.ticker, e.message), style = ThesisType.bodySmall, color = p.ink2)
                }
            }
        }
    }
}

// =====================================================================================================================
// Notes view (5.28)
// =====================================================================================================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NotesView(
    padding: PaddingValues,
    notes: List<NoteTrailEntry>,
    companyNames: Map<String, String>,
    meta: String?,
    header: @Composable () -> Unit,
    onOpenNotes: (String) -> Unit,
    onExportNotes: (() -> Unit)?,
) {
    val fmt = LocalFmt.current
    var query by rememberSaveable { mutableStateOf("") }
    var moreOpen by rememberSaveable { mutableStateOf(false) }
    val groups = remember(notes, companyNames) { groupNotes(notes, companyNames) }
    val shown = remember(groups, query) { filterNotes(groups, query) }
    val noteCount = remember(groups) { groups.sumOf { it.earlier + 1 } }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding.exceptTop())
            .wrapDataWidth(),
        contentPadding = listPadding(padding),
    ) {
        item(key = "header", contentType = "header") {
            // The meta line holds the header at the board's height, so the segmented control does not jump.
            HeaderWithActions(deck = NamesCopy.notesLede(groups.size, noteCount), meta = meta, refreshing = false) {
                if (onExportNotes != null) ThesisIconButton(ThesisIcons.Overflow, NamesCopy.MORE, { moreOpen = true })
            }
        }
        item(key = "segments", contentType = "segments") {
            Column {
                Spacer(Modifier.height(ThesisSpace.headerToSection))
                header()
            }
        }
        if (groups.isNotEmpty()) {
            item(key = "filter", contentType = "field") {
                Column(Modifier.padding(horizontal = ThesisSpace.gutter)) {
                    Spacer(Modifier.height(ThesisSpace.l))
                    ThesisTextField(
                        value = query,
                        onValueChange = { query = it },
                        label = NamesCopy.NOTES_FILTER,
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    )
                }
            }
        }
        item(key = "gap", contentType = "gap") { Spacer(Modifier.height(ThesisSpace.m)) }
        when {
            groups.isEmpty() -> item(key = "empty", contentType = "state") {
                EmptyState(
                    sentence = NamesCopy.NOTES_EMPTY,
                    how = NamesCopy.NOTES_EMPTY_HOW,
                    icon = ThesisIcons.Notes,
                    modifier = Modifier.padding(horizontal = ThesisSpace.gutter),
                )
            }
            shown.isEmpty() -> item(key = "no-match", contentType = "state") {
                EmptyState(
                    sentence = NamesCopy.notesNoMatch(query),
                    how = NamesCopy.NOTES_NO_MATCH_HOW,
                    modifier = Modifier.padding(horizontal = ThesisSpace.gutter),
                )
            }
            else -> itemsIndexed(shown, key = { _, g -> g.ticker }, contentType = { _, _ -> "note" }) { i, group ->
                NotesRow(
                    group = group,
                    meta = listOfNotNull(
                        group.latest.filingPeriod?.trim()?.ifBlank { null },
                        group.latestAtMs?.let { fmt.relative(Instant.ofEpochMilli(it)) },
                        NamesCopy.earlierNotes(group.earlier),
                    ).joinToString(" · "),
                    onClick = { onOpenNotes(group.ticker) },
                    modifier = Modifier
                        .padding(horizontal = ThesisSpace.gutter)
                        .rowGroupSegment(RowPosition.of(i, shown.size)),
                )
            }
        }
    }

    if (moreOpen && onExportNotes != null) {
        ThesisSheet(onDismissRequest = { moreOpen = false }) {
            SheetActionRow(ThesisIcons.Small.Share, NamesCopy.EXPORT_NOTES, {
                moreOpen = false
                onExportNotes()
            })
        }
    }
}

/** One ticker in the Notes view: ticker and company, the latest note (2 lines), its filing, age and earlier count. */
@Composable
private fun NotesRow(group: NotesGroup, meta: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
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
            Text(group.ticker, style = ThesisType.rowTitle, color = p.ink, maxLines = 1)
            if (group.company != null) {
                Text(group.company, Modifier.weight(1f, fill = false), style = ThesisType.bodySmall, color = p.muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            NoteMark(contentDescription = null)
        }
        Text(
            group.latest.text.trim(),
            style = ThesisType.bodySmall,
            color = p.ink2,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        if (meta.isNotEmpty()) Text(meta, style = ThesisType.caption, color = p.muted)
    }
}
