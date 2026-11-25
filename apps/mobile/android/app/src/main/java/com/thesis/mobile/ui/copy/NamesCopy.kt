package com.thesis.mobile.ui.copy

import com.thesis.mobile.ui.format.Fmt

/**
 * Copy for Names, Name and the Notes view (docs/app-redesign/DESIGN-DIRECTION.md 5.10, 5.11, 5.28). Sentence case,
 * typographic apostrophes (U+2019), no SPEC banned words, no em dashes, no exclamation marks. Numbers go through
 * [Fmt]; the screens pass in what they already formatted (dates, ages).
 */
object NamesCopy {

    // ---- Names (5.10)

    const val TITLE = "Names"
    const val SEGMENT_BOARD = "Board"
    const val SEGMENT_NOTES = "Notes"
    val segments: List<String> = listOf(SEGMENT_BOARD, SEGMENT_NOTES)

    /** The generated lede: "12 names · 2 changed since your last visit". */
    fun boardLede(count: Int, changed: Int, hasVisited: Boolean): String {
        val names = Fmt.count(count, "name", "names")
        if (!hasVisited || count == 0) return names
        val tail = when (changed) {
            0 -> "none changed since your last visit"
            else -> "$changed changed since your last visit"
        }
        return "$names · $tail"
    }

    const val SORT = "Sort"
    const val SORT_TITLE = "Sort your names"
    const val DENSITY_TO_COMPACT = "Show compact rows"
    const val DENSITY_TO_COMFORTABLE = "Show comfortable rows"
    const val COMPARE = "Compare names"
    const val MORE = "More"
    const val IMPORT_CSV = "Import holdings CSV"
    const val REFRESH = "Refresh"

    // Filters: each names its data source in NamesScreen.kt (boardFilterCounts).
    const val FILTER_ALL = "All"
    const val FILTER_CHANGED = "Changed"
    const val FILTER_AT_RISK = "At risk"
    const val FILTER_EARNINGS = "Earnings soon"
    const val FILTER_NOTES = "With notes"

    // Sort options (5.10 item 6; the default is state severity).
    const val SORT_STATE = "State, most at risk first"
    const val SORT_SCORE = "Monitor score, lowest first"
    const val SORT_AGE = "Oldest report first"
    const val SORT_TICKER = "Ticker, A to Z"

    // Add a company (5.10 item 4).
    const val FIELD_LABEL = "Add a company"
    const val FIELD_PLACEHOLDER = "Ticker, for example AAPL"
    const val FOLLOW = "Follow"
    fun alreadyFollowed(ticker: String): String = "$ticker is already in your names."
    const val INVALID_TICKER = "Use a ticker such as AAPL or BRK.B."

    // States.
    const val EMPTY_BOARD = "Follow a company to start your board"
    const val EMPTY_BOARD_HOW = "Type its ticker above. Its latest Deep Dive, alerts and your notes collect here."
    const val ERROR_SUBJECT = "your names"
    const val EMPTY_CHANGED = "Nothing changed since your last visit"
    const val EMPTY_AT_RISK = "None of your names is at risk"
    const val EMPTY_EARNINGS = "No earnings dates in the next 14 days"
    const val EMPTY_NOTES_FILTER = "None of your names has a note yet"
    const val EMPTY_FILTER_HOW = "Pick All to see every name."

    // Rows.
    const val NO_REPORT = "No Deep Dive yet"
    const val NO_REPORT_FIGURE = "No report"
    const val REPORT = "Report"

    /** Line 2 of a row whose state changed since the last visit: "Intact → Weakened, 2 days ago". */
    fun stateChange(from: String, to: String, whenText: String?): String =
        if (whenText.isNullOrBlank()) "$from → $to" else "$from → $to, $whenText"

    /** Score caption since the last visit: "+4 pts since 21 Nov"; "Unchanged since 21 Nov". */
    fun scoreSince(change: String?, since: String): String =
        if (change == null) "Unchanged since $since" else "$change since $since"

    /** A count badge: alerts created since the last Names visit. */
    fun newAlerts(n: Int): String = "$n new"

    /** TalkBack for the count badge. */
    fun newAlertsSpoken(n: Int): String = Fmt.count(n, "new alert", "new alerts")

    // Context sheet (5.10 item 7).
    const val OPEN_REPORT = "Open report"
    const val BUILD_REPORT = "Build report"
    const val WRITE_NOTE = "Write a note"
    const val COMPARE_WITH = "Compare with…"
    const val WAR_ROOM = "War Room"
    const val REMOVE = "Remove from Names"
    fun removeTitle(ticker: String): String = "Remove $ticker from Names?"
    const val REMOVE_BODY = "Its reports and your notes stay in History and Notes. You can follow it again at any time."
    const val REMOVE_CONFIRM = "Remove"
    fun removed(ticker: String): String = "Removed $ticker from Names"
    const val UNDO = "Undo"

    // Compare selection (5.10 item 8).
    const val COMPARE_PICK = "Pick 2 to 4 names"
    fun compareSelected(n: Int): String = "${Fmt.count(n, "name", "names")} selected"
    fun compareRun(n: Int): String = if (n < 2) "Compare names" else "Compare ${Fmt.count(n, "name", "names")}"
    const val COMPARE_MAX = "Compare takes up to 4 names."
    const val CANCEL = "Cancel"

    // CSV import (5.10 item 9).
    const val IMPORT_TITLE = "Import holdings"
    const val IMPORT_BODY = "Pick a CSV with a ticker and a shares column (cost basis optional). Thesis reads it once " +
        "and follows every ticker in it. Nothing links to a brokerage."
    const val IMPORT_PICK = "Choose a CSV file"
    const val IMPORT_PICK_AGAIN = "Choose another file"
    const val IMPORT_PROGRESS = "Reading the file and following its tickers"
    const val IMPORT_UNREADABLE = "Couldn’t read that file. Pick a CSV under 512 KB."
    const val IMPORT_FAILED = "The import did not finish."
    fun importResult(imported: Int, skipped: Int): String =
        if (skipped == 0) "Imported ${Fmt.number(imported.toLong())}" else "Imported ${Fmt.number(imported.toLong())}, skipped ${Fmt.number(skipped.toLong())}"
    fun importFollowed(tickers: List<String>): String? =
        tickers.takeIf { it.isNotEmpty() }?.let { "Now following ${it.joinToString(", ")}." }
    fun importRows(rows: Int): String = "${Fmt.count(rows, "row", "rows")} in the file."
    fun showSkipped(n: Int): String = "Show ${Fmt.count(n, "skipped row", "skipped rows")}"
    const val HIDE_SKIPPED = "Hide skipped rows"
    fun rowError(line: Int, ticker: String?, message: String): String =
        if (ticker.isNullOrBlank()) "Line $line · $message" else "Line $line · $ticker · $message"

    // ---- Notes view (5.28)

    fun notesLede(tickers: Int, notes: Int): String =
        if (notes == 0) "Your notes, one per filing" else "${Fmt.count(notes, "note", "notes")} on ${Fmt.count(tickers, "name", "names")}"
    const val NOTES_FILTER = "Filter notes"
    const val NOTES_EMPTY = "Notes you write on a report will collect here, one per filing."
    const val NOTES_EMPTY_HOW = "Open a name and write under Your notes."
    fun notesNoMatch(query: String): String = "No notes match “${query.trim()}”"
    const val NOTES_NO_MATCH_HOW = "Try a ticker or another word from the note."
    const val EXPORT_NOTES = "Export my notes"
    fun earlierNotes(n: Int): String? = if (n <= 0) null else Fmt.count(n, "earlier note", "earlier notes")

    // ---- Name (5.11)

    fun nameEyebrow(ticker: String, following: Boolean): String =
        if (following) "$ticker · In your names" else "$ticker · Not followed"
    fun follow(ticker: String): String = "Follow $ticker"
    fun unfollow(ticker: String): String = "Remove $ticker from Names"
    const val FOLLOWING = "In your names"
    const val NOT_FOLLOWING = "Not followed"
    const val COPY_FIGURES = "Copy figures as table"
    const val COPIED = "Copied as a table"
    fun couldNotLoad(ticker: String): String = KitCopy.couldNotLoad(ticker)

    /** State caption under the badge: "Was Intact on 21 Nov" or "Unchanged since 21 Nov". */
    fun wasState(previous: String, on: String): String = "Was $previous on $on"
    fun unchangedSince(on: String): String = "Unchanged since $on"

    // KPI tiles.
    const val KPI_SCORE = "Monitor score"
    const val KPI_FRESHNESS = "Freshness"
    const val KPI_ALERTS = "Alerts since your last visit"
    const val KPI_EARNINGS = "Next earnings"
    const val KPI_EVENTS = "Events since the report"
    const val SCALE_100 = "on a scale of 0 to 100"
    fun since(on: String): String = "since $on"
    fun vs(on: String): String = "vs $on"
    const val SINCE_LAST_VISIT = "since your last visit"
    const val FROM_WAR_ROOM = "from the War Room"
    const val FROM_ALERT = "from an earnings alert"
    fun eventsOf(unreviewed: Int, material: Int): String =
        "${Fmt.number(unreviewed.toLong())} of ${Fmt.count(material, "material event", "material events")} to review"
    const val NO_EVENTS = "none waiting for review"
    const val SEE_ALERTS = "See alerts"

    // Freshness words (server freshness_state).
    fun freshnessWord(state: String?): String = when (state?.trim()?.lowercase()) {
        "current", "fresh" -> "Current"
        "aging" -> "Aging"
        "stale" -> "Stale"
        "triggered" -> "Needs review"
        else -> Fmt.NOT_COMPUTED
    }

    // From the filings (5.11 item 4).
    const val FILINGS_KICKER = "From the filings"
    fun filingsHeadline(period: String, revenue: String?, growth: String?, grew: Boolean?): String = when {
        revenue == null -> "No annual figures in the report"
        growth == null || grew == null -> "Revenue was $revenue in $period"
        grew -> "Revenue grew $growth to $revenue in $period"
        else -> "Revenue fell $growth to $revenue in $period"
    }
    fun filingsDeck(period: String, prior: String?): String =
        if (prior == null) "Annual figures, $period, from the latest Deep Dive." else "Annual figures, $period vs $prior, from the latest Deep Dive. Tap a figure for its source."
    const val SHOW_YEARS = "Show the five years"
    const val HIDE_YEARS = "Hide the five years"
    const val COPY_TABLE = "Copy as table"
    const val LABEL_REVENUE = "Revenue"
    const val LABEL_GROSS = "Gross margin"
    const val LABEL_OPERATING = "Operating margin"
    const val LABEL_FCF = "FCF margin"
    const val LABEL_NET_CASH = "Net cash"
    const val LABEL_SHARES = "Share count change"
    const val LABEL_NET_INCOME = "Net income"
    const val LABEL_FCF_ABS = "Free cash flow"
    const val LABEL_SHARES_ABS = "Shares outstanding"
    fun labelFor(metric: String, period: String): String = "$metric, $period"
    fun netCashWas(prior: String, period: String): String = "vs $prior in $period"
    const val FEWER_SHARES = "fewer shares"
    const val MORE_SHARES = "more shares"
    const val TABLE_METRIC = "Metric"

    // Report card (5.11 item 5).
    const val DEEP_DIVE = "Deep Dive"
    fun reportEyebrow(period: String?): String = if (period.isNullOrBlank()) DEEP_DIVE else "$DEEP_DIVE · $period"
    fun reportBuilt(period: String?, date: String?): String = when {
        period != null && date != null -> "Built from the $period filing on $date. One report per filing."
        date != null -> "Built on $date. One report per filing."
        else -> "One report per filing."
    }
    fun noReportTitle(ticker: String): String = "No Deep Dive for $ticker yet"
    const val NO_REPORT_BODY = "A report reads the latest 10-K or 10-Q and is built once per filing. It takes a few minutes."
    const val REPORT_LOADING = "Loading the latest report"

    // Your notes (5.11 item 6).
    const val NOTES_KICKER = "Your notes"
    fun notesHeadline(notes: Int, reports: Int): String = when {
        notes == 0 -> "No notes yet"
        reports <= 1 -> Fmt.count(notes, "note", "notes")
        else -> "${Fmt.count(notes, "note", "notes")} across ${Fmt.count(reports, "report", "reports")}"
    }
    const val NOTES_CAPTION = "One note per filing; earlier notes stay here."
    const val NOTES_NEED_REPORT = "Notes belong to a report. Build or open one to start your note."
    const val NOTE_SAVE_FAILED = "Not saved"

    // Earnings (5.11 item 7).
    fun earningsOn(date: String): String = "Earnings on $date"
    const val EARNINGS_KICKER = "Earnings"

    // Conviction journal (5.11 item 8).
    const val JOURNAL_KICKER = "Conviction journal"
    fun journalHeadline(n: Int): String = if (n == 0) "Nothing in the journal yet" else Fmt.count(n, "dated event", "dated events")
    const val JOURNAL_PRO = "Pro keeps a dated journal of every report, alert and War Room for this name."
    const val SEE_PRO = "See Pro"
    fun journalEvent(type: String): String = when (type.trim().lowercase()) {
        "report", "deep_dive", "report_generated" -> "Report"
        "alert", "alert_created" -> "Alert"
        "war_room", "earnings" -> "War Room"
        "opposite_case" -> "Opposite case"
        "note", "note_saved" -> "Note"
        else -> type.replace('_', ' ').trim().replaceFirstChar { it.uppercase() }.ifBlank { "Event" }
    }

    // Reports (5.11 item 9).
    const val REPORTS_KICKER = "Reports"
    fun reportsHeadline(n: Int): String =
        if (n == 0) "No reports opened yet" else "${Fmt.count(n, "report", "reports")} you have opened"
    const val REPORTS_CAPTION = "Reports you have opened, newest first."
    fun reportsEmpty(ticker: String): String = "You have not opened a report for $ticker yet."
    const val COMPARE_TWO = "Compare two"
    const val PICK_TWO = "Pick two reports to compare."
    const val COMPARE_REPORTS = "Compare these two"
    fun reportRow(date: String): String = "Deep Dive · $date"

    // Pager (4.5).
    fun pagerCaption(position: Int, count: Int): String = "$position of $count"
    const val NEXT_NAME = "Next name"
    const val PREVIOUS_NAME = "Previous name"
}
