package com.thesis.mobile.ui.screens.report

import androidx.compose.runtime.Immutable
import com.thesis.mobile.model.NoteTrailEntry
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.ui.parseInstantMs

/*
 * State and rules of the Deep Dive report host (docs/app-redesign/DESIGN-DIRECTION.md 5.13) that do not need a
 * WebView: what the shell hands the host beyond the classic tools, the dock's scroll behaviour, the earlier note,
 * the reports a comparison can use and the export states. Pure, so the JVM tests cover them.
 */

/**
 * What the report host needs from the shell besides [com.thesis.mobile.ui.screens.DeepDiveNativeTools]. Every field
 * has a default so callers keep compiling until WP-INT wires them; a null compare callback hides its control
 * instead of showing one that does nothing ([onFollowChange] is the exception, see there).
 */
@Immutable
data class ReportHostExtras(
    /** The report's ticker is one of the person's names (the top bar's bookmark). */
    val isFollowing: Boolean = false,
    /**
     * Follow or unfollow the ticker (the bookmark; `toggle(on)` haptic in the kit). Null leaves the bookmark out of
     * the kit [com.thesis.mobile.ui.components.ReportTopBar] (no dead control).
     */
    val onFollowChange: ((Boolean) -> Unit)? = null,
    /** The person's names, for "Compare with other names". */
    val watchlist: List<String> = emptyList(),
    /** Report history, for "Compare with an earlier report" (filtered to this ticker, like for like). */
    val reportHistory: List<ReportHistoryItem> = emptyList(),
    /** This ticker's notes trail (newest first), for the earlier note above the field. */
    val notesTrail: List<NoteTrailEntry> = emptyList(),
    /** Push Compare names with these tickers, the report's ticker first (the subject). */
    val onCompareNames: ((List<String>) -> Unit)? = null,
    /** Push Compare reports: the earlier report's id, then this report's id. */
    val onCompareReports: ((earlierReportId: String, reportId: String) -> Unit)? = null,
)

/**
 * Where the dock's show/hide rule (#48) stands: whether the dock shows, and how far the page has scrolled (px) in
 * the current direction since that direction began (positive down, negative up).
 */
@Immutable
data class DockScroll(val visible: Boolean = true, val travel: Int = 0)

/** The dock's show/hide rule (#48): hides on scroll down, shows on scroll up and at the top of the page. */
object ReportDockScroll {
    /**
     * [state] after the page scrolled by [dy] px to [scrollY]. The scroll listener fires once a frame, so a reading
     * drag moves a few px per event: the rule adds up the movement in one direction (starting over when the
     * direction flips) and hides or shows the dock once that distance passes [slopPx]. Shorter movements keep the
     * current state, so a slow reader's small corrections do not make the dock flicker.
     */
    fun next(state: DockScroll, scrollY: Int, dy: Int, slopPx: Int): DockScroll {
        if (scrollY <= slopPx) return DockScroll(visible = true, travel = 0)
        if (dy == 0) return state
        val sameDirection = state.travel == 0 || (state.travel > 0) == (dy > 0)
        // Capped, so a long read never piles up a number that a flip would have to undo.
        val travel = ((if (sameDirection) state.travel else 0) + dy).coerceIn(-TRAVEL_CAP * slopPx, TRAVEL_CAP * slopPx)
        val visible = when {
            travel > slopPx -> false
            travel < -slopPx -> true
            else -> state.visible
        }
        return DockScroll(visible = visible, travel = travel)
    }

    private const val TRAVEL_CAP = 4
}

/**
 * The host's running copy of the dock rule. Deliberately not snapshot state: the WebView reports every scroll
 * frame and `travel` changes on each, so keeping it here (and only [onScroll]'s visibility in composition state)
 * means a reading scroll recomposes the host only when the dock actually hides or shows.
 */
class DockScrollTracker {
    var state: DockScroll = DockScroll()
        private set

    /** Applies one scroll event; returns whether the dock shows afterwards. */
    fun onScroll(scrollY: Int, dy: Int, slopPx: Int): Boolean {
        state = ReportDockScroll.next(state, scrollY, dy, slopPx)
        return state.visible
    }
}

/** The earlier note shown above the field: the newest non-empty note on another report of the same ticker. */
fun earlierNoteFor(reportId: String, trail: List<NoteTrailEntry>): NoteTrailEntry? =
    trail.firstOrNull { it.reportId != reportId && it.text.isNotBlank() }

/**
 * Earlier reports "With an earlier report" can open: same ticker, same report type, not this report, made before
 * this report, newest first. "Before" uses this report's own history row when history has it, else [createdAt]
 * (the report's generated time); a report newer than the one open would turn the comparison around, so it is left
 * out. When neither time is known, every other report of the ticker is offered.
 * The type is the kind of report (a Deep Dive), not the filing it reads: history does not carry the filing form or
 * period yet (HANDOFF-C, WP-INT 5), so a 10-Q based report can sit next to a 10-K based one and the sheet's copy
 * promises no more than "an earlier report".
 */
fun earlierReportsFor(
    reportId: String,
    ticker: String?,
    history: List<ReportHistoryItem>,
    createdAt: String? = null,
): List<ReportHistoryItem> {
    val symbol = ticker?.trim()?.uppercase()?.ifBlank { null } ?: return emptyList()
    val current = history.firstOrNull { it.reportId == reportId }
    val type = current?.type
    val currentAt = current?.createdAt?.ifBlank { null } ?: createdAt?.ifBlank { null }
    return history
        .filter { it.reportId != reportId && it.ticker?.trim()?.uppercase() == symbol }
        .filter { type == null || it.type.equals(type, ignoreCase = true) }
        .filter { currentAt == null || isEarlier(it.createdAt, currentAt) }
        .distinctBy { it.reportId }
        .sortedWith(compareByDescending<ReportHistoryItem> { parseInstantMs(it.createdAt) }.thenByDescending { it.createdAt })
}

/** [at] is before [than]: as instants when both parse, else as ISO-8601 text (which sorts in time order). */
private fun isEarlier(at: String, than: String): Boolean {
    val a = parseInstantMs(at)
    val b = parseInstantMs(than)
    return if (a != null && b != null) a < b else at.trim() < than.trim()
}

/** The other names a comparison can add to [ticker] (the subject), in the person's order. */
fun otherNamesFor(ticker: String?, watchlist: List<String>): List<String> {
    val symbol = ticker?.trim()?.uppercase().orEmpty()
    return watchlist.map { it.trim().uppercase() }.filter { it.isNotEmpty() && it != symbol }.distinct()
}

/** At most this many names next to the subject (Compare names takes 2 to 4 tickers). */
const val MAX_COMPARE_OTHERS = 3

/** What the overflow is preparing (an inline arc on that item, 5.13 Export). */
enum class ExportJob { None, Pdf, Card }

/** The sheets and panels the host opens. One at a time. */
enum class ReportPanel { None, Overflow, Notes, Compare, Conviction, Feedback }
