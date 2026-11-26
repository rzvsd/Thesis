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
    /** The Conviction segment's badge for free accounts, once the kit dock can fit it (HANDOFF-C). */
    const val PRO_BADGE = "Pro"

    /** The page failed: the classic view shows with this banner. */
    const val LOAD_FAILED = "The new view didn’t load."
    const val TRY_AGAIN = "Try again"
    const val NEEDS_CONNECTION = "The new view needs an internet connection."

    /** Export failures (no success message: the system dialog is the feedback). */
    const val EXPORT_FAILED = "Couldn’t prepare the export. Try again."

    /** Accessibility: the page while it loads. */
    const val PAGE_LOADING = "Loading the report"

    // ---- Notes panel

    const val EARLIER_NOTE = "Earlier note"
    const val CARRY_FORWARD = "Carry forward"
    const val ADD_TO_NOTE = "Add to note"

    // ---- Compare sheet

    fun compareTitle(ticker: String): String = "Compare $ticker"
    /** The back control of a Compare step (to the choice). */
    fun compareBack(ticker: String): String = "Back to Compare $ticker"
    const val WITH_OTHER_NAMES = "With other names"
    const val WITH_EARLIER_REPORT = "With an earlier report"
    fun pickNamesTitle(ticker: String): String = "Compare $ticker with"
    const val PICK_NAMES_HOW = "Pick up to 3 of your names."
    fun noOtherNames(ticker: String): String = "Follow other names to compare them with $ticker."
    const val PICK_A_NAME = "Pick a name"
    /** The names picker with no subject (Research > Tools > Compare names): 2 to 4 of your names. */
    const val PICK_NAMES_ANY_TITLE = "Compare names"
    const val PICK_NAMES_ANY_HOW = "Pick 2 to 4 of your names."
    const val PICK_TWO_NAMES = "Pick two names"
    fun compareNamesAction(count: Int): String = "Compare $count names"
    const val EARLIER_REPORTS_TITLE = "Compare with an earlier report"
    fun noEarlierReport(ticker: String): String =
        "There is no earlier Deep Dive on $ticker yet. A comparison appears after the next one."
    /** An earlier report by when it was built: "Built 23 days ago", "Built 14 Nov 2025" ([age] from Fmt.relative). */
    fun earlierReportLabel(age: String): String = "Built $age"
    /** An earlier report whose date the history did not give. */
    const val EARLIER_REPORT = "Earlier report"

    // ---- Report feedback panel

    const val FEEDBACK_HOW = "Tell us whether this report helped, or what needs fixing."
    const val FEEDBACK_DETAILS = "Details (optional)"
    const val FEEDBACK_SEND = "Send feedback"
    /** The sent state (the view model's notice then says whether the send went through). */
    const val FEEDBACK_THANKS = "Thanks for telling us"
    const val FEEDBACK_THANKS_HOW = "It’s attached to this report for the Thesis team to review."
    const val FEEDBACK_DONE = "Done"

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
    /** The generation screen's title, by phase: honest about where the build stands. */
    const val BUILDING_TITLE = "Building the report"
    const val READY_TITLE = "The report is ready"
    const val STOPPED_TITLE = "The build stopped"
    const val BUILDING_LEDE = "From the company’s latest annual and quarterly filings at the SEC."
    const val STAGE_QUEUED = "In the queue"
    const val STAGE_BUILDING = "Reading the filings and building the report"
    const val STAGE_READY = "Ready"
    /** The caption on the stage a failed build reached. */
    const val STAGE_STOPPED = "Stopped here"
    /** Shown only while the build is queued or running. No push is sent when it ends, so no promise of one. */
    const val CAN_LEAVE =
        "You can leave this screen. The build keeps running, and the report appears in History when it’s ready."
    const val CONTENTS_KICKER = "What this report will contain"
    const val CONTENTS_HEADLINE = "Thirteen chapters, in the same order for every company"
    /**
     * The failed build's card under the stages. The hero's "The build stopped" is the one sentence that says it
     * failed (rubric V3); the card says what trying again does.
     */
    const val BUILD_RETRY_TITLE = "Trying again starts a new build"

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
    /** The memo's valuation lines: "Fair value, mid: $212.00 ($180.00 to $240.00)", "Price at the report: $198.50". */
    fun fairValueLine(mid: String, low: String?, high: String?): String =
        if (low != null && high != null) "Fair value, mid: $mid ($low to $high)" else "Fair value, mid: $mid"
    fun priceAtReport(price: String): String = "Price at the report: $price"
}
