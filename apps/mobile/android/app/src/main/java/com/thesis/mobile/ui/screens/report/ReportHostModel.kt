package com.thesis.mobile.ui.screens.report

import androidx.compose.runtime.Immutable
import com.thesis.mobile.model.NoteTrailEntry
import com.thesis.mobile.model.ReportHistoryItem

/*
 * State and rules of the Deep Dive report host (docs/app-redesign/DESIGN-DIRECTION.md 5.13) that do not need a
 * WebView: what the shell hands the host beyond the classic tools, the dock's scroll behaviour, the earlier note,
 * the reports a comparison can use and the export states. Pure, so the JVM tests cover them.
 */

/**
 * What the report host needs from the shell besides [com.thesis.mobile.ui.screens.DeepDiveNativeTools]. Every field
 * has a default so callers keep compiling until WP-INT wires them; a null callback hides its control instead of
 * showing one that does nothing.
 */
@Immutable
data class ReportHostExtras(
    /** The report's ticker is one of the person's names (the top bar's bookmark). */
    val isFollowing: Boolean = false,
    /** Follow or unfollow the ticker (the bookmark; `toggle(on)` haptic in the kit). Null hides the bookmark. */
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

/** The dock's show/hide rule (#48): hides on scroll down, shows on scroll up and at the top of the page. */
object ReportDockScroll {
    /**
     * Whether the dock shows after the page scrolled by [dy] px to [scrollY]. Movements under [slopPx] keep the
     * current state, so a slow reader's small corrections do not make the dock flicker.
     */
    fun visibleAfter(visible: Boolean, scrollY: Int, dy: Int, slopPx: Int): Boolean = when {
        scrollY <= slopPx -> true
        dy > slopPx -> false
        dy < -slopPx -> true
        else -> visible
    }
}

/** The earlier note shown above the field: the newest non-empty note on another report of the same ticker. */
fun earlierNoteFor(reportId: String, trail: List<NoteTrailEntry>): NoteTrailEntry? =
    trail.firstOrNull { it.reportId != reportId && it.text.isNotBlank() }

/**
 * Earlier reports "With an earlier report" can open: same ticker, same report type (like for like), not this
 * report, newest first.
 */
fun earlierReportsFor(
    reportId: String,
    ticker: String?,
    history: List<ReportHistoryItem>,
): List<ReportHistoryItem> {
    val symbol = ticker?.trim()?.uppercase()?.ifBlank { null } ?: return emptyList()
    val type = history.firstOrNull { it.reportId == reportId }?.type
    return history
        .filter { it.reportId != reportId && it.ticker?.trim()?.uppercase() == symbol }
        .filter { type == null || it.type.equals(type, ignoreCase = true) }
        .distinctBy { it.reportId }
        .sortedByDescending { it.createdAt }
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
