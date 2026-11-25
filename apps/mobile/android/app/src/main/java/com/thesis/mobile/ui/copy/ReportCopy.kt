package com.thesis.mobile.ui.copy

/**
 * Copy of the Deep Dive report host, the generation screen and the report's tools (WP-C; docs/app-redesign/
 * DESIGN-DIRECTION.md 5.13, 5.14, 5.24). Sentence case, no em dashes, no "!", nothing that reads as advice
 * (SPEC rule 6). Typographic apostrophes (U+2019).
 */
object ReportCopy {
    // ---- Report host (5.13)

    /** Overflow menu. */
    const val CLASSIC_VIEW = "Classic view"
    const val NEW_VIEW = "New view"
    const val EXPORT_PDF = "Export PDF"
    const val SHARE_CARD = "Share card"
    const val REPORT_FEEDBACK = "Report feedback"
    const val PREPARING_PDF = "Preparing the PDF…"
    const val PREPARING_CARD = "Preparing the card…"

    /** The dock (#48). */
    const val DOCK_NOTES = "Notes"
    const val DOCK_COMPARE = "Compare"
    const val DOCK_STRESS = "Stress"
    const val DOCK_CONVICTION = "Conviction"
    const val PRO_BADGE = "Pro"

    /** The page failed: the classic view shows with this banner. */
    const val LOAD_FAILED = "The new view didn’t load."
    const val TRY_AGAIN = "Try again"
    const val NEEDS_CONNECTION = "The new view needs an internet connection."

    /** Export failures (no success message: the system dialog is the feedback). */
    const val EXPORT_FAILED = "Couldn’t prepare the export. Try again."

    /** Accessibility: the page while it loads, and the page itself. */
    const val PAGE_LOADING = "Loading the report"
    fun pageDescription(ticker: String): String = "$ticker Deep Dive report"

    // ---- Notes panel

    const val EARLIER_NOTE = "Earlier note"
    const val CARRY_FORWARD = "Carry forward"
    const val ADD_TO_NOTE = "Add to note"

    // ---- Compare sheet

    fun compareTitle(ticker: String): String = "Compare $ticker"
    const val WITH_OTHER_NAMES = "With other names"
    const val WITH_EARLIER_REPORT = "With an earlier report"
    fun pickNamesTitle(ticker: String): String = "Compare $ticker with"
    const val PICK_NAMES_HOW = "Pick up to 3 of your names."
    fun noOtherNames(ticker: String): String = "Follow other names to compare them with $ticker."
    const val PICK_A_NAME = "Pick a name"
    fun compareNamesAction(count: Int): String = "Compare $count names"
    const val EARLIER_REPORTS_TITLE = "Compare with an earlier report"
    const val NO_EARLIER_REPORT =
        "There is no earlier report on a comparable filing yet. A comparison appears after the next one."
    fun earlierReportLabel(date: String): String = "Report of $date"

    // ---- Conviction sheet

    const val CONVICTION_TITLE = "Conviction"

    // ---- Report feedback panel

    const val FEEDBACK_HOW = "Tell us whether this report helped, or what needs fixing."
    const val FEEDBACK_DETAILS = "Details (optional)"
    const val FEEDBACK_SEND = "Send feedback"

    /** Feedback codes the API accepts, with their labels. */
    val feedbackOptions: List<Pair<String, String>> = listOf(
        "useful" to "Useful",
        "confusing" to "Confusing",
        "generic" to "Too generic",
        "stale" to "Out of date",
        "bug_report" to "Something’s broken",
    )

    // ---- Generation (5.14)

    fun buildingEyebrow(ticker: String): String = "Deep Dive · $ticker"
    const val BUILDING_TITLE = "Building the report"
    const val BUILDING_LEDE = "From the company’s latest annual and quarterly filings at the SEC."
    const val STAGE_QUEUED = "In the queue"
    const val STAGE_BUILDING = "Reading the filings and building the report"
    const val STAGE_READY = "Ready"
    const val CAN_LEAVE =
        "You can leave this screen. The build keeps running, and Thesis tells you when the report is ready."
    const val CONTENTS_KICKER = "What this report will contain"
    const val CONTENTS_HEADLINE = "Thirteen chapters, in the same order for every company"
    fun buildFailedTitle(ticker: String?): String =
        if (ticker.isNullOrBlank()) "Couldn’t build the report" else "Couldn’t build the $ticker report"
    const val BUILD_FAILED_CAUSE = "The build stopped before the report was ready."

    /** The 13 chapters of every Deep Dive (docs/deep-dive/SPEC.md section 3, the chip names). */
    val chapters: List<String> = listOf(
        "Summary",
        "Business",
        "Countries",
        "Customers & suppliers",
        "Owners & people",
        "Financials",
        "Price & value",
        "Price action",
        "Forecasts",
        "Risks",
        "Events",
        "Bottom line",
        "Sources",
    )

    fun chapterRow(number: Int, name: String): String = "Chapter $number, $name"

    // ---- Export (5.24)

    const val EXPORT_BRAND = "THESIS"
    const val EXPORT_REPORT_TITLE = "Deep Dive"
    const val EXPORT_MEMO_TITLE = "Investment memo"
    const val EXPORT_THESIS = "The thesis"
    const val EXPORT_REASONS = "Why"
    const val EXPORT_VALUATION = "Valuation"
    const val EXPORT_NOTICE = "A research summary from SEC filings, frozen at the filing date. Not financial advice."
    const val EXPORT_CARD_NOTICE = "Research, not advice"
    const val EXPORT_NO_SUMMARY = "This report has no summary yet."
    const val SHARE_PDF_TITLE = "Share the Deep Dive PDF"
    const val SHARE_MEMO_TITLE = "Share the investment memo"
    const val SHARE_CARD_TITLE = "Share the card"
    const val SHARE_PULSE_TITLE = "Share the Pulse PDF"
    fun pageOf(page: Int, pages: Int): String = "$page of $pages"
}
