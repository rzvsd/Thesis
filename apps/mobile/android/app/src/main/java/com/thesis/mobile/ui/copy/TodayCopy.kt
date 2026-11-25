package com.thesis.mobile.ui.copy

import com.thesis.mobile.ui.format.Fmt
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * Copy of the Today screens: Home, the Pulse brief and the Weekly digest (docs/app-redesign/DESIGN-DIRECTION.md
 * 5.6 to 5.8, WP-A). Sentence case, typographic apostrophes (U+2019), numbers through [Fmt]. Section headlines are
 * sentences about the result, built here from data (the kicker is the category; never the kicker repeated).
 */
object TodayCopy {

    // ---- Home: header -------------------------------------------------------------------------------------------

    /** Header title when there is no Pulse yet (the Pulse section below explains why). By local hour. */
    fun greeting(hour: Int): String = when (hour) {
        in 5..11 -> "Good morning"
        in 12..17 -> "Good afternoon"
        else -> "Good evening"
    }

    const val PHASE_PRE_MARKET = "Pre-market"
    const val PHASE_OPEN = "Market open"
    const val PHASE_AFTER_CLOSE = "After the close"

    /** "Mon 24 Nov · Pre-market" (the phase word is left out when unsure). The Eyebrow sets it in capitals. */
    fun eyebrow(date: String, phase: String?): String = listOfNotNull(date, phase).joinToString(" · ")

    /** "As of 07:02" (the one timestamp on Home). */
    fun asOf(time: String): String = "As of $time"

    /** "As of 07:02, yesterday" style: the time when it is today, else the relative day. */
    fun asOfWhen(time: String, day: String?): String = if (day == null) asOf(time) else "As of $time, $day"

    /** Above loaded content while offline: "Offline · showing 07:02". */
    fun offlineShowing(time: String?): String = if (time == null) "Offline · showing the last copy" else "Offline · showing $time"

    // ---- Home: tape ---------------------------------------------------------------------------------------------

    /** "Pre-market tape · as of 06:15", "Tape · as of 06:15", "Tape · Fri 24 Apr" (a dated snapshot, never live). */
    fun tapeCaption(phase: String?, time: String?, day: String?): String {
        val head = if (phase == PHASE_PRE_MARKET) "Pre-market tape" else "Tape"
        return when {
            time != null && day == null -> "$head · as of $time"
            time != null -> "Tape · as of $time, $day"
            day != null -> "Tape · $day"
            else -> head
        }
    }

    // ---- Home: your names ---------------------------------------------------------------------------------------

    const val NAMES_KICKER = "Your names"
    const val NAMES_ACTION = "All names"

    /**
     * The names headline, a conclusion from data: changes since the last visit first, then names that need a
     * review (Watch or At risk), then the all-clear. [monitored] = names with a monitor reading.
     */
    fun namesHeadline(total: Int, monitored: Int, changed: Int, review: Int, intact: Int): String = when {
        total == 0 -> "You don’t follow any names yet"
        changed > 0 && total == 1 -> "Your one name changed since your last visit"
        changed > 0 -> "${of(changed, total)} changed since your last visit"
        review > 0 && total == 1 -> "Your one name needs a review"
        review > 0 -> "${of(review, total)} ${if (review == 1) "needs" else "need"} a review"
        monitored == 0 -> "No monitor readings for your names yet"
        intact == total && total == 1 -> "Your one name is intact"
        intact == total && total == 2 -> "Both your names are intact"
        intact == total -> "All $total of your names are intact"
        else -> "$intact of your $total names are intact"
    }

    private fun of(n: Int, total: Int): String = if (n == total) "All $total of your names" else "$n of your names"

    /** The last row of the group: "+7 more". */
    fun moreNames(n: Int): String = "+$n more"

    /** Line 2 of a name whose state changed: "Intact → Watch, Tue". */
    fun stateChange(from: String, to: String, day: String): String = "$from → $to, $day"

    /** Monitor score change under the score: "+4 since Tue". */
    fun scoreSince(delta: Double, day: String): String {
        val n = delta.roundToInt()
        val sign = when {
            n > 0 -> "+"
            n < 0 -> Fmt.MINUS
            else -> ""
        }
        return "$sign${abs(n)} since $day"
    }

    /** Report age when there is no earlier reading: "Report · 23 days ago". */
    fun reportAge(relative: String): String = "Report · $relative"

    const val NO_REPORT_YET = "No report yet"
    const val NO_READING_YET = "No monitor reading yet"

    /** Monitor state words (sentence case; never the raw enum). */
    fun stateWord(raw: String?): String = when (raw?.trim()?.lowercase()?.replace(' ', '_')?.replace('-', '_')) {
        "intact" -> "Intact"
        "improved", "strengthening" -> "Improving"
        "watch" -> "Watch"
        "drifting", "drift" -> "Drifting"
        "weakening", "weakened" -> "Weakening"
        "unresolved" -> "Unresolved"
        "at_risk" -> "At risk"
        "broken" -> "Broken"
        null, "" -> "No reading"
        else -> raw.replace('_', ' ').trim().replaceFirstChar { it.uppercase() }
    }

    const val NO_NAMES = "Follow a company to see it here"
    const val NO_NAMES_HOW = "Thesis reads each name’s filings and tells you here when its story changes."
    const val ADD_NAME = "Add a name"

    // ---- Home: macro stress -------------------------------------------------------------------------------------

    const val MACRO_EYEBROW = "Macro stress"

    /** "Macro stress is Balanced and rising" ([trend]: "rising", "easing", "steady"; null when no reference). */
    fun macroTitle(label: String, trend: String?): String =
        if (trend == null) "Macro stress is $label" else "Macro stress is $label and $trend"

    const val TREND_RISING = "rising"
    const val TREND_EASING = "easing"
    const val TREND_STEADY = "steady"

    const val VS_7_DAYS = "vs 7 days ago"

    /** "since Mon 17 Nov" when the reference is not exactly a week old. */
    fun since(day: String): String = "since $day"

    const val MACRO_NO_READING = "Macro stress has no reading yet"
    const val MACRO_NO_READING_HOW = "The first reading appears after the next market close."
    const val MACRO_FAILED = "Macro stress could not be loaded"

    /** The card's one action, spoken by TalkBack. */
    const val OPEN_MACRO = "Open Macro Stress"

    /** "Score 0 to 100, last 30 days" (the sparkline's scale and window). */
    fun macroScale(days: Int): String = "Score 0 to 100, last $days days"

    /** Sparkline summary subject. */
    const val MACRO_SPARK_SUBJECT = "Macro stress"

    fun lastDays(days: Int): String = "last $days days"

    // ---- Home: today's Pulse ------------------------------------------------------------------------------------

    const val PULSE_KICKER = "Today’s Pulse"
    const val READ_PULSE = "Read the full Pulse"
    const val MORNING_BRIEFING = "Morning briefing"
    const val PARTIAL_COVERAGE = "Partial coverage"

    /** Fallback headline when the issue has no conclusion of its own: "Today’s brief has 5 chapters". */
    fun briefChapters(n: Int): String = "Today’s brief has ${Fmt.count(n, "chapter", "chapters")}"

    const val NO_PULSE = "Today’s Pulse arrives before the open"
    const val NO_PULSE_HOW = "It reads the overnight tape, macro releases and new filings on your names."

    /** "Expected by 06:30" when the schedule is known. */
    fun expectedBy(time: String): String = "Expected by $time"

    const val PULSE_SUBJECT = "today’s Pulse"

    /** Morning briefing context line from the briefing's counts. */
    fun briefingContext(mode: String?, count: Int, watchlistCount: Int, lead: String?): String? = when {
        mode == "no_change" && watchlistCount > 0 ->
            "Checked ${Fmt.count(watchlistCount, "name", "names")}; nothing changed at the thesis level."
        mode == "no_change" -> "Nothing changed at the thesis level in the latest cycle."
        lead != null && count > 1 -> "$lead first, ${Fmt.count(count - 1, "more name", "more names")} flagged."
        lead != null -> "$lead flagged."
        count > 0 -> "${Fmt.count(count, "name", "names")} flagged for a review."
        else -> null
    }

    // ---- Pulse brief --------------------------------------------------------------------------------------------

    const val PULSE_TITLE = "Pulse"
    const val EXPORT_PDF = "Export as PDF"
    const val EXPORTING_PDF = "Exporting PDF"
    const val COPY_AS_TEXT = "Copy as text"
    const val COPY_AS_TABLE = "Copy as table"

    /** "Pulse · Mon 24 Nov" (the hero eyebrow, with the 28 dp gold rule). */
    fun heroEyebrow(date: String?): String = if (date == null) "Pulse" else "Pulse · $date"

    /** "Generated 06:30 · data as of 06:15" (either part may be missing). */
    fun generatedLine(generated: String?, dataAsOf: String?): String? = listOfNotNull(
        generated?.let { "Generated $it" },
        dataAsOf?.let { "data as of $it" },
    ).joinToString(" · ").ifBlank { null }

    const val CHAPTER_MARKETS = "Markets"
    const val CHAPTER_CHANGED = "What changed"
    const val CHAPTER_NAMES = "Your names"
    const val CHAPTER_WATCH = "Watch"
    const val CHAPTER_HEADLINES = "Headlines"
    const val CHAPTER_SOURCES = "Sources"

    /** Chapter headlines used only when the issue gives no sentence of its own. */
    fun marketsFallback(n: Int): String = "${Fmt.count(n, "market", "markets")} on today’s tape"
    const val CHANGED_FALLBACK = "What the inputs show since the last issue"
    fun namesInBrief(n: Int): String =
        if (n == 1) "One of your names is in today’s brief" else "$n of your names are in today’s brief"
    fun watchHeadline(n: Int): String = "${Fmt.count(n, "item", "items")} to watch"
    fun headlinesHeadline(n: Int): String = "${Fmt.count(n, "headline", "headlines")} with a source"
    fun sourcesHeadline(n: Int): String = "Every figure traces to ${Fmt.count(n, "source", "sources")}"

    const val SIGNAL = "Signal"
    const val NOISE = "Noise"
    const val UPSHOT = "The upshot"

    /** Coverage notes in the Sources chapter: "Coverage: market tape data incomplete". */
    fun coverageNote(text: String): String = "Coverage: $text"

    const val NO_PULSE_DAY = "No Pulse for this day"
    const val NO_PULSE_DAY_HOW = "Pulse issues are written on market days, before the open."
    const val PULSE_ISSUE_SUBJECT = "this Pulse"

    const val COLOPHON = "Pulse"
    const val DISCLAIMER = "Pulse describes public market data, macro releases and filings. It is not investment advice."

    /** Spoken for a source row: where the link goes. */
    fun sourceCaption(host: String?, date: String?): String? = listOfNotNull(host, date).joinToString(" · ").ifBlank { null }

    // ---- Weekly digest ------------------------------------------------------------------------------------------

    const val DIGEST_TITLE = "Weekly digest"
    const val THIS_WEEK = "This week"

    /**
     * The digest lede, built from facts: "Macro stress rose 6 points; 2 of your names filed; 1 changed state;
     * 5 alerts." Parts with no data are left out; [stateChanges] null means the history is not available.
     */
    fun digestLede(macroDelta: Double?, filings: Int, stateChanges: Int?, alerts: Int, total: Int): String {
        val parts = mutableListOf<String>()
        if (macroDelta != null) {
            val n = abs(macroDelta).roundToInt()
            parts += when {
                n == 0 -> "Macro stress held level"
                macroDelta > 0 -> "Macro stress rose ${Fmt.count(n, "point", "points")}"
                else -> "Macro stress eased ${Fmt.count(n, "point", "points")}"
            }
        }
        if (total > 0) {
            parts += when (filings) {
                0 -> "none of your names filed"
                else -> "${filings} of your names filed"
            }
        }
        if (stateChanges != null && total > 0) {
            parts += when (stateChanges) {
                0 -> "no name changed state"
                1 -> "1 changed state"
                else -> "$stateChanges changed state"
            }
        }
        parts += Fmt.count(alerts, "alert", "alerts")
        return parts.joinToString("; ").replaceFirstChar { it.uppercase() } + "."
    }

    const val KPI_MACRO = "Macro stress now"
    const val KPI_FILINGS = "New filings"
    const val KPI_STATE_CHANGES = "State changes"
    const val KPI_ALERTS = "Alerts"
    fun amongNames(total: Int): String = "among your ${Fmt.count(total, "name", "names")}"
    const val LAST_7_DAYS = "last 7 days"

    const val FILINGS_KICKER = "New filings"
    fun filingsHeadline(n: Int): String = when (n) {
        0 -> "None of your names filed this week"
        1 -> "One of your names filed this week"
        else -> "$n of your names filed this week"
    }

    const val MACRO_KICKER = "Macro"
    const val STATE_KICKER = "State changes"
    fun stateChangesHeadline(n: Int?): String = when (n) {
        null -> "State changes appear once Thesis has a week of readings"
        0 -> "No name changed state this week"
        1 -> "One name changed state this week"
        else -> "$n names changed state this week"
    }

    const val ALERTS_KICKER = "Alerts by category"
    fun alertsHeadline(n: Int, top: String?): String = when {
        n == 0 -> "No alerts this week"
        top == null -> "${Fmt.count(n, "alert", "alerts")} this week"
        else -> "${Fmt.count(n, "alert", "alerts")} this week, most about ${top.lowercase()}"
    }

    /** Alert category names (never the raw key). */
    fun categoryName(raw: String?): String = when (raw?.trim()?.lowercase()?.replace(' ', '_')?.replace('-', '_')) {
        "thesis_drift", "drift" -> "Thesis drift"
        "earnings" -> "Earnings"
        "macro" -> "Macro"
        "pulse" -> "Pulse"
        "system" -> "Account and system"
        null, "" -> "Other"
        else -> raw.replace('_', ' ').trim().replaceFirstChar { it.uppercase() }
    }

    const val LATEST_PULSE_KICKER = "Latest Pulse"
    const val OPEN_PULSE = "Open the Pulse"
    const val DIGEST_NO_DATA = "Nothing to sum up yet"
    const val DIGEST_NO_DATA_HOW = "The digest is built from your names, alerts and macro readings once they arrive."
    const val DIGEST_SUBJECT = "this week’s digest"

    /** "Score 0 to 100, last 7 days". */
    const val MACRO_WEEK_SCALE = "Score 0 to 100, last 7 days"
}
