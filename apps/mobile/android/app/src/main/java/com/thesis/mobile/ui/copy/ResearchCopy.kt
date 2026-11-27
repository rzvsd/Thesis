package com.thesis.mobile.ui.copy

import com.thesis.mobile.ui.format.Fmt
import kotlin.math.roundToLong

/**
 * Copy of the Research area (WP-E, docs/app-redesign/DESIGN-DIRECTION.md 5.12, 5.17 to 5.20, 5.26, 5.27): the
 * Research root, History, Compare reports, Compare names, Search, War Room and Scenario Stress. Sentence case,
 * product vocabulary, typographic quotes and apostrophes (U+2018, U+2019, U+201C, U+201D), no em dash. Section
 * headlines are sentences built from data; the static ones are the fallbacks for when there is no data (rubric C1).
 */
object ResearchCopy {
    // ---- Shared

    const val DEEP_DIVE = "Deep Dive"
    const val PULSE = "Pulse"
    const val COMPARE = "Compare"
    const val COPY_TABLE = "Copy as table"
    const val COPIED = "Copied"
    const val SHOW_ALL = "Show all"
    const val SHOW_LESS = "Show less"
    const val MORE_OPTIONS = "More options"
    const val TODAY = "Today"
    const val YESTERDAY = "Yesterday"

    /** "Deep Dive · FY2025", or "Deep Dive" while the filing is not known. */
    fun deepDiveLine(period: String?): String = if (period.isNullOrBlank()) DEEP_DIVE else "$DEEP_DIVE · $period"

    /** "8 names". */
    fun names(n: Int): String = Fmt.count(n, "name", "names")

    // ---- Research root (5.12)

    const val RESEARCH_TITLE = "Research"
    /** The coverage claim is ProductCopy's, as on onboarding and the empty states (one promise everywhere). */
    const val RESEARCH_DECK = "Read ${ProductCopy.coverage} from their filings."
    const val TICKER_LABEL = "Ticker"
    const val OPEN_REPORT = "Open report"
    const val BUILD_REPORT = "Build report"
    const val FIELD_HELPER_EMPTY = "Type a ticker to open its report, or build one from its filings."

    /** What the field's action will do for [ticker], said before the tap (principle 11). */
    fun fieldHelper(ticker: String, opens: Boolean, openedAgo: String?): String =
        if (opens) {
            "You read $ticker ${openedAgo?.let(::keepTogether) ?: "before"}. Open report shows it again; nothing is rebuilt."
        } else {
            "Builds $ticker from its latest 10-K and 10-Q at the SEC, or joins a build already running."
        }

    const val RECENT_KICKER = "Recent reports"
    const val RECENT_DECK = "Reports you have opened, newest first."
    const val SEE_ALL = "See all"
    const val RECENT_EMPTY = "Reports you open will appear here."
    const val RECENT_EMPTY_HOW = "Type a ticker above to read the company’s latest filings."

    /**
     * The Recent reports headline: a result, not a label. [openedThisWeek] counts Deep Dives only (a Pulse brief is
     * not a report). Null when there is nothing to report: the section then shows its kicker and empty state only.
     */
    fun recentHeadline(openedThisWeek: Int, lastTicker: String?, lastAgo: String?): String? = when {
        openedThisWeek >= 2 -> "You opened ${Fmt.count(openedThisWeek, "report", "reports")} this week"
        lastTicker != null && lastAgo != null -> "$lastTicker was the last report you opened, ${keepTogether(lastAgo)}"
        lastTicker != null -> "$lastTicker was the last report you opened"
        else -> null
    }

    fun continueReading(ticker: String): String = "Continue reading $ticker"
    /** A past Pulse issue left mid-way: "Continue the Pulse of 24 Nov". */
    fun continuePulse(date: String): String = if (date.isBlank()) "Continue the Pulse" else "Continue the Pulse of $date"

    /** "Where you left it, 19 h ago": the time never breaks across lines ("19 / h ago" at 2.0x). */
    fun continueCaption(ago: String): String = "Where you left it, ${keepTogether(ago)}"

    /** [s] with its spaces made non-breaking, so a short figure and its unit stay on one line. */
    fun keepTogether(s: String): String = s.replace(' ', '\u00A0')
    const val DISMISS = "Dismiss"

    const val TOOLS_KICKER = "Tools"

    fun toolsHeadline(namesCount: Int): String =
        if (namesCount > 0) "Work across your ${names(namesCount)}" else "Work across the companies you follow"

    const val TOOL_COMPARE = "Compare names"
    const val TOOL_COMPARE_CAPTION = "Line up 2 to 4 names on the same figures"
    const val TOOL_STRESS = "Scenario Stress"
    const val TOOL_STRESS_CAPTION = "See how a macro shock would touch your names"
    const val TOOL_MACRO = "Macro Stress"
    const val TOOL_MACRO_CAPTION = "Where the market backdrop stands today"
    const val TOOL_DIGEST = "Weekly digest"
    const val TOOL_DIGEST_CAPTION = "What changed across your names this week"
    const val TOOL_HISTORY = "History"
    const val TOOL_HISTORY_CAPTION = "Every report and Pulse you have opened"

    // ---- History (5.18)

    const val HISTORY_TITLE = "History"
    const val HISTORY_DECK = "Reports you have opened, newest first."
    /** "9 reports · 2 Pulse briefs · latest 2 h ago": a Pulse brief is not a report, so each is counted on its own. */
    fun historyMeta(reports: Int, briefs: Int, latestAgo: String?): String =
        listOfNotNull(
            Fmt.count(reports, "report", "reports").takeIf { reports > 0 || briefs == 0 },
            Fmt.count(briefs, "Pulse brief", "Pulse briefs").takeIf { briefs > 0 },
            latestAgo?.let { "latest ${keepTogether(it)}" },
        ).joinToString(" · ")

    const val FILTER_ALL = "All"
    const val FILTER_DEEP_DIVES = "Deep Dives"
    const val FILTER_PULSE = "Pulse"
    const val FILTER_NOTES = "With notes"
    const val FILTER_FIELD = "Filter by ticker"
    const val HISTORY_EMPTY = "Reports you open will appear here."
    const val HISTORY_EMPTY_HOW = "Open a report from Research or from one of your names."
    const val HISTORY_NO_NOTES = "None of these reports has a note yet."
    fun historyNoMatch(query: String): String = "Nothing in History matches “$query”."
    const val HISTORY_REFRESH_FAILED = "History couldn’t refresh. What you see may be out of date."
    const val PULSE_LINE = "Morning brief before the open"

    const val COMPARE_ACTION = "Compare two reports"
    const val COMPARE_CANCEL = "Cancel"
    const val COMPARE_BANNER = "Pick two Deep Dives of one company, from the same kind of filing."
    const val COMPARE_PICK_TWO = "Pick two reports"
    const val COMPARE_PICK_ONE_MORE = "1 of 2 picked"
    fun compareRun(ticker: String, older: String, newer: String): String = "Compare $ticker $older with $newer"

    const val WHY_PULSE = "A Pulse brief has no filing to compare"
    const val WHY_OTHER_COMPANY = "Another company: Compare names lines up two companies"
    const val WHY_NOT_LIKE = "Not the same kind of filing as your first pick"
    /**
     * The pick covers the same period as the first one. Worded on the period, not the filing: until History gets
     * each report's own filing (HANDOFF-E), the period is the latest annual row the report holds.
     */
    fun whySamePeriod(annual: Boolean): String =
        if (annual) "Covers the same fiscal year as your first pick" else "Covers the same quarter as your first pick"
    const val WHY_UNKNOWN_FILING = "Filing not known yet: open this report once"
    const val WHY_TWO_PICKED = "Two reports picked already"

    // ---- Compare reports (5.17)

    fun compareReportsSubtitle(ticker: String, older: String, newer: String): String = "$ticker · $older vs $newer"

    /**
     * The deck under the result title: what was compared (company, filing kind, when each report was built). The
     * basis ("FY2025 vs FY2024") is said once, in the table header.
     */
    fun compareReportsDeck(company: String, form: String, olderBuilt: String?, newerBuilt: String?): String =
        if (olderBuilt != null && newerBuilt != null) {
            "Two reports on $company’s $form filings, built $olderBuilt and $newerBuilt."
        } else {
            "Two reports on $company’s $form filings."
        }

    /**
     * The key-figure result in words: "Revenue up 6.4%, operating margin up 50 bps"; null when neither is known.
     * [operatingMarginBps] is the change in basis points between the two margins as shown.
     */
    fun compareReportsHeadline(revenueChangePct: Double?, operatingMarginBps: Double?): String? {
        val revenue = revenueChangePct?.let {
            when {
                kotlin.math.abs(it) < 0.05 -> "revenue flat"
                it > 0 -> "revenue up ${Fmt.pct(kotlin.math.abs(it), dp = 1)}"
                else -> "revenue down ${Fmt.pct(kotlin.math.abs(it), dp = 1)}"
            }
        }
        val margin = operatingMarginBps?.let {
            val n = kotlin.math.abs(it).roundToLong()
            when {
                n == 0L -> "operating margin flat"
                it > 0 -> "operating margin up ${Fmt.number(n)} bps"
                else -> "operating margin down ${Fmt.number(n)} bps"
            }
        }
        return listOfNotNull(revenue, margin).joinToString(", ").ifBlank { null }?.replaceFirstChar { it.uppercase() }
    }
    /** "FY2025 vs FY2024: revenue up 6.4%, operating margin up 50 bps": the result with its basis first. */
    fun withBasis(newer: String, older: String, result: String): String =
        "$newer vs $older: ${result.replaceFirstChar { it.lowercase() }}"
    fun basis(newer: String, older: String, sameQuarter: Boolean): String =
        if (sameQuarter) "$newer vs $older, same quarter" else "$newer vs $older"
    const val KEY_FIGURES_KICKER = "Key figures"
    const val KEY_FIGURES_FALLBACK = "The figures each report was built on"
    const val VERDICTS_KICKER = "Verdicts"
    const val VERDICTS_HEADLINE = "What each report concluded"
    const val NO_VERDICT = "This report has no one-line verdict."
    const val NOTES_KICKER = "Your notes"
    fun notesHeadline(count: Int): String =
        if (count == 0) "No notes on these two reports yet" else "${Fmt.count(count, "note", "notes")} on these two reports"
    const val NO_NOTE = "No note on this report."
    const val OPEN_THIS_REPORT = "Open report"
    const val COMPARE_REPORTS_FAILED = "these two reports"
    const val NOT_LIKE_FOR_LIKE = "These two reports cover different kinds of filings."
    const val NOT_LIKE_FOR_LIKE_HOW = "Compare a 10-K with a 10-K, or the same quarter a year apart."
    const val SAME_FILING = "These two reports read the same filing."
    const val SAME_FILING_HOW = "Pick a report on an earlier year to see what changed."
    const val OTHER_COMPANIES = "These reports are on different companies."
    const val OTHER_COMPANIES_HOW = "Compare names lines up two or more companies on the same figures."
    const val CHANGE = "Change"
    const val CHANGE_UNIT = "Change unit"
    const val YOUR_NOTE = "Your note"

    // Units in "Copy as table": the cells are plain numbers, the unit is in the label or its own column.
    const val UNIT_USD_BN = "USD bn"
    const val UNIT_USD = "USD"
    const val UNIT_MILLIONS = "millions"
    const val UNIT_PCT = "%"
    const val UNIT_BPS = "bps"

    /** "Revenue (USD bn)". */
    fun withUnit(name: String, unit: String): String = "$name ($unit)"

    // ---- Compare names (5.26)

    const val COMPARE_NAMES_EYEBROW = "Compare names"
    /** The caption over the ticker links under the table (5.25: every visible ticker opens its Name). */
    const val OPEN_A_NAME = "Open a name"
    fun openNameDescription(name: String): String = "Open $name"
    fun compareNamesSubtitle(subject: String, others: List<String>): String =
        if (others.isEmpty()) subject else "$subject with ${others.joinToString(", ")}"
    fun compareNamesTitle(subject: String, others: List<String>): String = when (others.size) {
        0 -> subject
        1 -> "$subject with ${others[0]}"
        else -> "$subject with ${others.dropLast(1).joinToString(", ")} and ${others.last()}"
    }
    /** Until each column carries its fiscal year-end (HANDOFF-E), the deck does not claim the columns name it. */
    const val COMPARE_NAMES_DECK =
        "Each company’s latest annual figures, from its own annual filing. Fiscal years can end in different months."
    const val COMPARE_NAMES_DECK_YEAR_ENDS =
        "Each company’s latest annual figures, from its own annual filing. Year-ends differ, so every column names its own."
    const val COMPARE_NAMES_TOO_FEW = "Pick at least two names to compare."
    const val COMPARE_NAMES_TOO_FEW_HOW = "Choose them on Names, or from a report’s Compare."
    const val COMPARE_NAMES_FAILED = "these names"
    const val NO_REPORT_YET = "No report yet"
    /** A compared name's column whose report exists but did not load. */
    const val COLUMN_LOAD_FAILED = "Couldn’t load"

    /** "Couldn’t load the MSFT report." / "Couldn’t load the MSFT and NVDA reports." */
    fun columnsLoadFailed(tickers: List<String>): String =
        if (tickers.size == 1) {
            "Couldn’t load the ${tickers.single()} report."
        } else {
            "Couldn’t load the ${tickers.dropLast(1).joinToString(", ")} and ${tickers.last()} reports."
        }
    const val NO_ANNUAL_FIGURES = "No annual figures"

    /** A column's filing line in "Copy as table": "Annual filing · built 24 Nov" (the report's date; no filed date yet). */
    fun formBuilt(form: String, built: String): String = "$form · built $built"

    /** A value-discipline cell: "4 of 6" signals met. */
    fun signalsMet(met: Int, available: Int): String = "${Fmt.number(met.toLong())} of ${Fmt.number(available.toLong())}"

    /** The peer median of signals met, in the cells' unit: "4 of 6", "3.5 of 6". */
    fun signalsMetMedian(met: Double, available: Int): String {
        val dp = if (met == kotlin.math.floor(met)) 0 else 1
        return "${Fmt.number(met, dp)} of ${Fmt.number(available.toLong())}"
    }

    private fun ofThe(n: Int): String? = when (n) {
        2 -> "of the two"
        3 -> "of the three"
        4 -> "of the four"
        else -> null
    }

    /** "MSFT has the widest operating margin of the three": [n] counts the names that have the figure. */
    fun widestMarginHeadline(ticker: String, n: Int): String? = ofThe(n)?.let { "$ticker has the widest operating margin $it" }

    /** "AAPL is the largest by revenue of the three". */
    fun largestRevenueHeadline(ticker: String, n: Int): String? = ofThe(n)?.let { "$ticker is the largest by revenue $it" }

    /** Under a table wider than the phone: which columns are past the edge. */
    fun swipeFor(hidden: List<String>): String? = when (hidden.size) {
        0 -> null
        1 -> "Swipe the table for ${hidden[0]}."
        else -> "Swipe the table for ${hidden.dropLast(1).joinToString(", ")} and ${hidden.last()}."
    }
    const val THE_MEDIAN = "the median"
    const val THE_CHANGE = "the change"
    fun buildReportFor(ticker: String): String = "Build report for $ticker"
    const val NO_REPORT_CAPTION = "Compare never builds on its own: building reads the latest filings at the SEC."
    const val METRIC = "Metric"
    const val PERIOD = "Period"
    const val FILING = "Filing"
    const val LATEST_FY = "Latest FY"
    const val MEDIAN = "Median"
    /** The zero gridline of a money axis: "$0", not "$0.00". */
    const val ZERO_DOLLARS = "\$0"
    /** Names past the table's [max] columns: "Not in the table: AMZN. It holds 4 names at a time." */
    fun namesLeftOut(names: List<String>, max: Int): String =
        "Not in the table: ${names.joinToString(", ")}. It holds ${Fmt.number(max.toLong())} names at a time."
    const val ROW_REVENUE = "Revenue"
    const val ROW_GROWTH = "Revenue growth, YoY"
    const val ROW_GROSS = "Gross margin"
    const val ROW_OPERATING = "Operating margin"
    const val ROW_FCF = "FCF margin"
    /**
     * Signed (negative is net debt), named as Name's years table names it, so a figure reads the same on Name and in
     * both compare tables.
     */
    const val ROW_NET_CASH = NamesCopy.LABEL_NET_CASH_SIGNED
    const val ROW_SHARES = "Share count, YoY"
    const val ROW_SHARES_CHANGE = "Share count change, YoY"
    const val ROW_DISCIPLINE_SIGNALS = "Value discipline, signals met"
    const val ROW_FCF_FULL = "Free cash flow"
    const val ROW_SHARES_FULL = "Shares outstanding"
    const val ROW_DISCIPLINE = "Value discipline"
    const val ROW_EPS = "EPS, derived"

    // Compare reports' and Compare names' row labels: the conventional short forms of a filings table, so the label
    // column leaves room for both years and the change on a 412 dp phone. The source sheet and the spoken row keep
    // the meaning. "YoY" goes in the row's unit (CompareRow.unit), which the table joins to the label with a
    // non-breaking space ("Growth, YoY" never leaves "YoY" alone on a line); spoken and copied text keep a plain one.
    const val ROW_GROWTH_SHORT = "Growth"
    const val ROW_FCF_SHORT = "FCF"
    const val ROW_SHARES_SHORT = "Shares"
    const val UNIT_YOY = "YoY"
    const val UP = "Up"
    const val DOWN = "Down"
    const val CHANGED = "Changed"
    const val COMPARE_REPORTS_EYEBROW = "Compare reports"
    fun sortedBy(metric: String): String = "Columns sorted by ${metric.replaceFirstChar { it.lowercase() }}, highest first."

    /** Sorted by one row, another row picked: what the next header tap will do. */
    fun sortedThenPicked(sorted: String, picked: String): String =
        "Columns sorted by ${sorted.replaceFirstChar { it.lowercase() }}. Tap a column header to sort by ${picked.replaceFirstChar { it.lowercase() }}."

    /** A row picked, nothing sorted yet. */
    fun pickedRow(metric: String): String =
        "Tap a column header to sort by ${metric.replaceFirstChar { it.lowercase() }}, or a figure to pick another row."
    const val SORT_HINT = "Tap a figure to choose a row, then a column header to sort by it."
    const val ORIGINAL_ORDER = "Original order"
    const val SHOW_CHART = "Show chart"
    const val HIDE_CHART = "Hide chart"
    const val CHART_INDEXED = "Indexed"
    const val CHART_SIDE_BY_SIDE = "Side by side"
    /** [firstYear] is the first fiscal year every line has (the index base). */
    fun chartTitle(leader: String?, firstYear: Int?): String =
        if (leader != null && firstYear != null) "$leader grew revenue the most since fiscal $firstYear" else "Revenue over the years"
    const val CHART_INDEXED_SUB = "Revenue, fiscal years, first common year = 100"
    const val CHART_SIDE_SUB = "Revenue, fiscal years, shared scale"
    const val CHART_SOURCE = "Income statements in each company’s annual filing."

    const val DEF_REVENUE = "Total revenue for the fiscal year, as reported in the income statement."
    const val DEF_GROWTH = "Revenue for the year against the year before."
    const val DEF_GROSS = "Gross profit as a share of revenue."
    const val DEF_OPERATING = "Operating income as a share of revenue."
    const val DEF_FCF = "Free cash flow as a share of revenue."
    const val DEF_NET_CASH = "Cash and equivalents minus total debt at the fiscal year-end. Negative means net debt."
    const val DEF_SHARES = "Shares outstanding at the year-end against the year before. Falling means buybacks."
    const val DEF_DISCIPLINE =
        "How many of the report’s value-discipline signals are met, out of those available. It describes the evidence; it is not a rating."
    const val DERIVE_GROWTH = "Revenue ÷ prior-year revenue − 1"
    const val DERIVE_GROWTH_QUARTER = "Revenue ÷ revenue of the same quarter a year earlier − 1"
    const val DERIVE_EPS = "Net income ÷ shares outstanding"
    const val DEF_REVENUE_PERIOD = "Total revenue for the period, as reported in the income statement."
    const val DEF_GROWTH_QUARTER = "Revenue for the quarter against the same quarter a year earlier."
    const val DEF_FCF_AMOUNT = "Free cash flow for the period: cash from operations less capital expenditure."
    const val DEF_NET_CASH_PERIOD = "Cash and equivalents minus total debt at the period end. Negative means net debt."
    const val DEF_SHARES_OUTSTANDING = "Shares outstanding at the period end."
    const val DEF_EPS = "Earnings per share worked out from the filing: net income over shares outstanding at the period end. It can differ from the diluted EPS the company reports."
    const val DERIVE_FCF = "Free cash flow ÷ revenue"
    const val DERIVE_NET_CASH = "Cash and equivalents − total debt"
    const val DERIVE_SHARES = "Shares outstanding ÷ prior-year shares − 1"
    const val DERIVE_DISCIPLINE = "Signals met ÷ signals available"
    const val FORM_10K = "10-K"
    const val FORM_10Q = "10-Q"
    /**
     * The filing when the payload does not name its form: a summary carries none, and a 20-F or 40-F filer's annual
     * report is not a 10-K (2.4), so no form is claimed until the filing-form field lands (HANDOFF-D, deferred).
     */
    const val FORM_ANNUAL = "Annual filing"
    const val FORM_QUARTERLY = "Quarterly filing"

    // ---- Search (5.27)

    const val SEARCH_TITLE = "Search"
    const val SEARCH_LABEL = "Search"
    const val SEARCH_PLACEHOLDER = "Ticker, company or a word from your notes"
    const val GROUP_NAMES = "Your names"
    const val GROUP_COMPANIES = "Companies"
    const val GROUP_REPORTS = "Reports"
    const val GROUP_NOTES = "Notes"
    const val RECENT_SEARCHES = "Recent searches"
    const val SEARCH_START = "Search your names, companies, reports and notes."
    const val SEARCH_START_HOW = "Tickers and companies come from the SEC list; reports and notes stay on this phone."
    fun searchNoMatch(query: String): String = "Nothing matches “$query”."
    const val SEARCH_NO_MATCH_HOW = "Try a ticker, such as AAPL, or a word from one of your notes."
    const val IN_YOUR_NAMES = "In your names"
    const val SEARCHING = "Searching companies"
    const val CLEAR_SEARCH = "Clear search"
    const val CLEAR_RECENT = "Clear"
    const val SHOW_FEWER = "Show fewer"
    /** Before a note excerpt that starts mid-note. */
    const val EXCERPT_CLIPPED = "… "
    fun showAll(n: Int): String = "Show all ${Fmt.number(n.toLong())}"

    // ---- War Room (5.19)

    const val WAR_ROOM_TITLE = "War Room"
    fun warRoomEyebrow(ticker: String?): String = if (ticker.isNullOrBlank()) "Earnings" else "Earnings · $ticker"
    const val WAR_ROOM_FALLBACK_TITLE = "Earnings room"
    const val STEP_PRE = "Pre-open"
    const val STEP_LIVE = "Live"
    const val STEP_POST = "After close"
    fun updated(ago: String): String = "Updated ${keepTogether(ago)}"
    const val PHASES_KICKER = "The room"
    fun phasesHeadline(written: Int, complete: Boolean): String = when {
        complete -> "All three phases are in"
        written <= 0 -> "Nothing written yet"
        else -> "${Fmt.count(written, "phase", "phases")} written so far"
    }
    const val PHASES_EMPTY = "The room fills in as the event moves from pre-open to after close."
    const val SHOW_PHASE = "Show phase"
    const val HIDE_PHASE = "Hide phase"
    const val RELATED_KICKER = "Related"
    fun relatedHeadline(n: Int): String = "${Fmt.count(n, "name", "names")} tied to this event"
    const val OPEN_DEEP_DIVE = "Open the Deep Dive"
    const val OPEN_DEEP_DIVE_CAPTION = "The report this room reads against"
    const val WAR_ROOM_EMPTY = "No War Room is open."
    const val WAR_ROOM_EMPTY_HOW = "A War Room opens around a name’s earnings. Inbox tells you when one starts."
    const val WAR_ROOM_FAILED = "the War Room"
    const val WAR_ROOM_REFRESH_FAILED = "The War Room couldn’t refresh. What you see may be out of date."
    const val PHASE_COMPLETE = "Complete"
    const val PHASE_IN_PROGRESS = "In progress"
    const val PHASE_SCHEDULED = "Scheduled"
    const val STEP_STATE_DONE = "Done"
    const val STEP_STATE_CURRENT = "Current step"
    const val STEP_STATE_UPCOMING = "Upcoming"
    const val SHOW = "Show"
    const val HIDE = "Hide"
    const val EXPANDED = "Expanded"
    const val COLLAPSED = "Collapsed"

    // ---- Scenario Stress (5.20)

    const val STRESS_TITLE = "Scenario Stress"
    fun stressDeck(namesCount: Int): String =
        if (namesCount > 0) {
            "See how a macro shock would touch your ${names(namesCount)}."
        } else {
            "Follow a few names to see how a macro shock would touch them."
        }
    const val STRESS_PRO =
        "Scenario Stress is part of Pro. It runs one macro shock across every name you follow and ranks what it would touch first."
    const val SEE_PRO = "See Pro"
    const val SCENARIOS_KICKER = "Scenarios"
    fun scenariosHeadline(n: Int): String = "${Fmt.count(n, "scenario", "scenarios")} ready to run"
    const val SCENARIOS_FAILED = "the scenarios"
    const val NO_SCENARIOS = "No scenarios are available right now."
    const val NO_SCENARIOS_HOW = "They come back once the scenario library is published again."
    const val PICK_SCENARIO = "Pick a scenario to run"
    const val SELECTED_SCENARIO = "Selected"
    fun runLabel(title: String, namesCount: Int): String = "Run ‘$title’ on ${names(namesCount)}"
    const val RUN_NEEDS_NAMES = "Follow at least one name to run a scenario."
    const val RESULTS_KICKER = "Results"
    fun resultsHeadline(topTicker: String?, impacted: Int): String = when {
        impacted == 0 || topTicker == null -> "None of your names is under stress in this scenario"
        else -> "$topTicker is the most exposed of your names"
    }
    const val NO_RUN = "No run yet."
    const val NO_RUN_HOW = "Pick a scenario above and run it on your names."
    const val RUN_FAILED = "The run didn’t finish"
    const val KPI_AFFECTED = "Names affected"
    fun ofTotal(n: Int, total: Int): String = "${Fmt.number(n.toLong())} of ${Fmt.number(total.toLong())}"
    const val KPI_CRITICAL = "Critical"
    const val STRESS_SCALE = "Stress score 0 to 100, higher is more exposed"
    fun stressSource(asOf: String): String = "Scenario Stress run · as of $asOf"
    const val BY_NAME = "By name"
    /** The By name result: how many names could see their thesis break (likely or possible). */
    fun byNameHeadline(breaks: Int): String = when (breaks) {
        0 -> "No thesis looks likely to break in this scenario"
        1 -> "1 name could see its thesis break"
        else -> "${Fmt.number(breaks.toLong())} names could see their thesis break"
    }
    /** A By name row's evidence count: "1 source", "2 sources". */
    fun sourcesCount(n: Int): String = Fmt.count(n, "source", "sources")
    fun openName(ticker: String): String = "Open $ticker"
    const val NO_EVIDENCE = "No linked evidence for this name."
    const val GUARDRAILS_KICKER = "Guardrails"
    fun guardrailsHeadline(n: Int): String = "${Fmt.count(n, "line", "lines")} worth watching after this run"
    const val BREAK_LIKELY = "Break likely"
    const val BREAK_POSSIBLE = "Break possible"
    const val BREAK_UNLIKELY = "Break unlikely"
    const val TABLE_TICKER = "Name"
    const val TABLE_SCORE = "Stress score (0 to 100)"
    const val TABLE_IMPACT = "Impact"
    const val TABLE_BREAK = "Thesis break"
    const val STRESS_CHART_TITLE = "Stress score by name"
    const val RUN_DEGRADED = "Part of this run used incomplete data. Treat the lower scores with care."
    const val RUN_STALE = "This run didn’t finish. You are looking at the previous one."
    const val EVIDENCE = "Evidence"
    fun impactWord(raw: String?): String = when (raw?.trim()?.lowercase()) {
        "critical" -> "Critical"
        "high" -> "High stress"
        "elevated" -> "Elevated"
        "watch" -> "Watch"
        "none" -> "Not touched"
        else -> humanize(raw) ?: "Not rated"
    }
    fun guardrailLine(ticker: String, condition: String): String = "$ticker: $condition"
    const val RUNNING = "Running the scenario on your names"

    /** A raw enum word ("thesis_drift", "AT_RISK") as sentence-case text ("Thesis drift", "At risk"). */
    fun humanize(raw: String?): String? {
        val words = raw?.trim()?.replace('_', ' ')?.replace('-', ' ')?.lowercase()?.ifBlank { null } ?: return null
        return words.replaceFirstChar { it.uppercase() }
    }
}
