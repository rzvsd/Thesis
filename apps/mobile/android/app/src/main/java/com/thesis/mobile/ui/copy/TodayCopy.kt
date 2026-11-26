package com.thesis.mobile.ui.copy

import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.today.TapeLine
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToInt
import kotlin.math.roundToLong

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

    /**
     * "Mon 24 Nov · Pre-market" (the phase word is left out when unsure). The Eyebrow sets it in capitals. Each part
     * is kept whole (no-break spaces, a non-breaking hyphen U+2011, which Roboto draws like "-"): a narrow screen
     * wraps only at the " · ", so "PRE-MARKET" never splits across lines. (A word joiner would take the eyebrow's
     * letter spacing and open a gap after the hyphen.)
     */
    fun eyebrow(date: String, phase: String?): String = listOfNotNull(date, phase).joinToString(" · ") { unbreakable(it) }

    /**
     * The eyebrow on two lines, for when one line does not hold it (2.0x on a narrow phone): the date over the
     * phase, without the separator (a " · " left dangling at a line end reads as a missing word).
     */
    fun eyebrowStacked(date: String, phase: String?): String = listOfNotNull(date, phase).joinToString("\n") { unbreakable(it) }

    private const val NO_BREAK_SPACE = '\u00A0'
    private const val NO_BREAK_HYPHEN = '\u2011'

    private fun unbreakable(part: String): String = part.replace(' ', NO_BREAK_SPACE).replace('-', NO_BREAK_HYPHEN)

    // ---- Day words ("since" captions) ---------------------------------------------------------------------------

    const val DAY_TODAY = "today"
    const val DAY_YESTERDAY = "yesterday"

    /** "Tue": a day within the past week. */
    fun weekday(day: LocalDate): String = day.format(Weekday)

    private val Weekday = DateTimeFormatter.ofPattern("EEE", Locale.US)

    /** "As of 07:02" (the one timestamp on Home). */
    fun asOf(time: String): String = "As of $time"

    /** "As of 07:02, yesterday" style: the time when it is today, else the relative day. */
    fun asOfWhen(time: String, day: String?): String = if (day == null) asOf(time) else "As of $time, $day"

    /**
     * Above loaded content while offline: "Offline · showing 07:02" ([shown] carries the day when the copy is not
     * today's: "Offline · showing 06:30, Fri 20 Nov").
     */
    fun offlineShowing(shown: String?): String = if (shown == null) "Offline · showing the last copy" else "Offline · showing $shown"

    /** Above loaded content when a refresh failed for any other reason: "Couldn’t refresh · showing 07:02". */
    fun staleShowing(shown: String?): String =
        if (shown == null) "Couldn’t refresh · showing the last copy" else "Couldn’t refresh · showing $shown"

    /** The Pulse hero's banner: its meta line right above already gives the time, so the banner does not repeat it. */
    const val OFFLINE_SHOWING_ISSUE = "Offline · showing this issue"
    const val STALE_SHOWING_ISSUE = "Couldn’t refresh · showing this issue"

    /** "06:30, Fri 20 Nov": a time with its day, for a copy that is not today's. */
    fun timeOnDay(time: String, day: String): String = "$time, $day"

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
        intact == total -> "All ${num(total)} of your names are intact"
        else -> "${num(intact)} of your ${num(total)} names are intact"
    }

    private fun of(n: Int, total: Int): String =
        if (n == total) "All ${num(total)} of your names" else "${num(n)} of your names"

    /** Counts in running copy go through [Fmt] too (grouping, U+2212), as every other number on the screen. */
    private fun num(n: Int): String = Fmt.number(n.toLong())

    /** The last row of the group: "+7 more". */
    fun moreNames(n: Int): String = "+${num(n)} more"

    /** Line 2 of a name whose state changed: "Intact → Watch, Tue". */
    fun stateChange(from: String, to: String, day: String): String = "$from → $to, $day"

    /** Monitor score change under the score: "+4 since Tue". */
    fun scoreSince(delta: Double, day: String): String = "${scoreChange(delta)} since $day"

    /** The signed change alone ("+4", "−1"): the compact caption when the reason line needs the room. */
    fun scoreChange(delta: Double): String {
        // Fmt.number carries the U+2212 minus; a rise takes its "+" here (Fmt.pts would add the unit).
        val n = delta.roundToLong()
        return (if (n > 0) "+" else "") + Fmt.number(n)
    }

    /** Report age when there is no earlier reading: "Report · 23 days ago". */
    fun reportAge(relative: String): String = "Report · $relative"

    /** The compact report age, when the full one would crowd out a name's reason line: "Report · 23d". */
    fun reportAgeShort(days: Long): String = if (days <= 0L) "Report · today" else "Report · ${Fmt.number(days)}d"

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
    /** Same pattern as the Pulse block's error right below it ("Couldn’t load today’s Pulse"). */
    val MACRO_FAILED: String = KitCopy.couldNotLoad("macro stress")

    /** The card's one action, spoken by TalkBack. */
    const val OPEN_MACRO = "Open Macro Stress"

    /** "Score 0 to 100, last 30 days" (the sparkline's scale and window). */
    fun macroScale(days: Int): String = "Score 0 to 100, last $days days"

    /** Sparkline summary subject. */
    const val MACRO_SPARK_SUBJECT = "Macro stress"

    fun lastDays(days: Int): String = "last $days days"

    // ---- Home: today's Pulse ------------------------------------------------------------------------------------

    const val PULSE_KICKER = "Today’s Pulse"

    /**
     * The kicker of an issue that is not today's (a weekend, a holiday, or before the next issue): "Pulse · Fri 20
     * Nov". Never "Today’s Pulse" over an earlier day's issue.
     */
    fun datedPulseKicker(day: String): String = "Pulse · $day"
    const val READ_PULSE = "Read the full Pulse"
    const val MORNING_BRIEFING = "Morning briefing"
    const val PARTIAL_COVERAGE = "Partial coverage"

    /**
     * Fallback headline when the issue has no conclusion of its own: "This issue has 5 chapters" (not "today’s":
     * Home can show an earlier day's issue).
     */
    fun briefChapters(n: Int): String = "This issue has ${Fmt.count(n, "chapter", "chapters")}"

    /** No issue yet on a market day, while the open (and any due time) is still ahead. */
    const val NO_PULSE = "Today’s Pulse arrives before the open"

    /** No issue on a market day once its due time has passed (over [runningLate]). */
    const val NO_PULSE_LATE = "Today’s Pulse is running late"

    /** No issue on a market day once the open has passed and no due time is known (or it is still ahead). */
    const val NO_PULSE_YET = "Today’s Pulse has not arrived yet"
    const val NO_PULSE_HOW = "It reads the overnight tape, macro releases and new filings on your names."

    /** No issue on a weekend or an exchange holiday. */
    const val NO_PULSE_CLOSED = "No Pulse today: US markets are closed"

    /** "The next issue arrives before the open on Mon 30 Nov." */
    fun nextIssue(day: String): String = "The next issue arrives before the open on $day."

    /** "Expected by 06:30" when the schedule is known and the time is still ahead. */
    fun expectedBy(time: String): String = "Expected by $time."

    /** The scheduled time has passed and no issue has arrived, under [NO_PULSE_LATE]: "It was due by 06:30." */
    fun runningLate(time: String): String = "It was due by $time."

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
    fun marketsFallback(n: Int): String = "${Fmt.count(n, "market", "markets")} on this issue’s tape"
    /**
     * The Markets headline when the issue's only markets sentence is already the morning line: the levels of the
     * broad index and the 10-year from the tape ("S&P 500 5,525.21 (+0.7%), 10-year Treasury yield 4.29% (−3 bps).").
     * Null without tape lines.
     */
    fun marketsLevels(lines: List<TapeLine>): String? =
        lines.takeIf { it.isNotEmpty() }?.joinToString(", ", postfix = ".") { "${it.name} ${it.level} (${it.change})" }

    const val CHANGED_FALLBACK = "What the inputs show since the last issue"

    /**
     * What changed when the issue has events but no prose: a count of what they are ("2 filings and 1 macro release
     * in this issue"); null without events.
     */
    fun eventsHeadline(filings: Int, releases: Int, total: Int): String? {
        if (total <= 0) return null
        val other = total - filings - releases
        if (filings < 0 || releases < 0 || other < 0) return "${Fmt.count(total, "event", "events")} in this issue"
        val parts = listOfNotNull(
            Fmt.count(filings, "filing", "filings").takeIf { filings > 0 },
            Fmt.count(releases, "macro release", "macro releases").takeIf { releases > 0 },
            Fmt.count(other, "other event", "other events").takeIf { other > 0 && (filings > 0 || releases > 0) },
            Fmt.count(other, "event", "events").takeIf { other > 0 && filings == 0 && releases == 0 },
        )
        val joined = if (parts.size <= 1) parts.joinToString("") else parts.dropLast(1).joinToString(", ") + " and " + parts.last()
        return "$joined in this issue"
    }

    /** Reader words for the pipeline's macro series labels; null when a label has none (it is then not shown). */
    fun seriesWords(label: String): String? = when (label.trim().lowercase().replace(Regex("\\s+"), " ")) {
        "cpi-u all items", "cpi", "cpi-u", "consumer price index" -> "consumer prices"
        "core cpi", "cpi-u core" -> "core consumer prices"
        "core pce", "pce" -> "PCE inflation"
        "treasury 10y", "10y treasury", "dgs10" -> "the 10-year Treasury yield"
        "treasury 2y", "2y treasury", "dgs2" -> "the 2-year Treasury yield"
        "treasury 30y", "dgs30" -> "the 30-year Treasury yield"
        "unemployment rate", "unemployment" -> "unemployment"
        "real gdp", "gdp" -> "real GDP"
        "wti spot", "wti", "wti crude" -> "oil"
        "brent", "brent spot" -> "Brent crude"
        "us high yield oas", "high yield oas" -> "high-yield spreads"
        "vix" -> "volatility"
        else -> null
    }

    /**
     * "Macro pressure is elevated, led by consumer prices and the 10-year Treasury yield." ([series] in the issue's
     * order, which is by pressure); "Macro pressure is elevated." without series.
     */
    fun macroPressure(reading: String, series: List<String>): String = when (series.size) {
        0 -> "$reading."
        1 -> "$reading, led by ${series[0]}."
        else -> "$reading, led by ${series.dropLast(1).joinToString(", ")} and ${series.last()}."
    }

    /** Lists at most this many tickers in [namesRow]; the rest are counted. */
    private const val NAMES_ROW_MAX = 3

    /**
     * Home's row for the Pulse's Your names chapter, naming the tickers: "AAPL is in this issue", "AAPL and MSFT are
     * in this issue", "AAPL, MSFT, NVDA and 2 more are in this issue".
     */
    fun namesRow(tickers: List<String>): String {
        val shown = tickers.take(NAMES_ROW_MAX)
        val more = tickers.size - shown.size
        val parts = if (more > 0) shown + "${Fmt.number(more.toLong())} more" else shown
        val joined = if (parts.size == 1) parts.first() else parts.dropLast(1).joinToString(", ") + " and " + parts.last()
        return if (tickers.size == 1) "$joined is in this issue" else "$joined are in this issue"
    }

    fun namesInBrief(n: Int): String =
        if (n == 1) "1 of your names is in this issue" else "${Fmt.number(n.toLong())} of your names are in this issue"

    /**
     * The Watch headline when the issue has no sentence of its own: a count of what is on the calendar ("3 events
     * to watch"); every event stays in the list below it.
     */
    fun watchHeadline(n: Int): String = "${Fmt.count(n, "event", "events")} to watch"

    /** Home's Watch row: the first event and how many follow ("Durable goods orders, Wed 08:30; 2 more."). */
    fun watchRow(first: String, more: Int): String =
        if (more <= 0) first else "${first.trimEnd('.', ' ')}; ${Fmt.number(more.toLong())} more."

    /**
     * The Sources headline: a plain count of what the issue links to. It makes no claim that every figure is
     * traced (the app does not link figures to sources).
     */
    fun sourcesHeadline(n: Int): String = "This issue cites ${Fmt.count(n, "reference", "references")}"

    /** The caption-level label above the coverage notes (once, never a prefix on each note). */
    const val COVERAGE = "Coverage"

    /** A section the issue marks incomplete, when the issue has no flags of its own: "Market tape coverage is incomplete". */
    fun sectionStatus(title: String, unavailable: Boolean): String {
        val name = title.lowercase().replaceFirstChar { it.uppercase() }
        return if (unavailable) "$name was not available for this issue" else "$name coverage is incomplete"
    }

    /** "Read at investor.apple.com": the link under a chapter headline that quotes a headline. */
    fun readAt(source: String): String = "Read at $source"

    const val SIGNAL = "Signal"
    const val NOISE = "Noise"
    const val UPSHOT = "The upshot"

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
     * The digest lede, built from facts: "Macro stress rose 6 points; 2 of your names have new reports; 1 name
     * changed state; 5 alerts." Parts with no data are left out; [stateChanges] null means the history is not
     * available. "Reports", not "filed": the count is of Thesis reports built this week (the monitor snapshot's
     * report time), and the snapshot has no filing date yet (HANDOFF).
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
                0 -> "no new reports on your names"
                1 -> "1 of your names has a new report"
                else -> "${num(filings)} of your names have new reports"
            }
        }
        if (stateChanges != null && total > 0) {
            parts += when (stateChanges) {
                0 -> "no name changed state"
                1 -> "1 name changed state"
                else -> "${num(stateChanges)} names changed state"
            }
        }
        parts += Fmt.count(alerts, "alert", "alerts")
        return parts.joinToString("; ").replaceFirstChar { it.uppercase() } + "."
    }

    const val KPI_MACRO = "Macro stress now"
    const val KPI_FILINGS = "New reports"
    const val KPI_STATE_CHANGES = "State changes"
    const val KPI_ALERTS = "Alerts"
    fun amongNames(total: Int): String = "among your ${Fmt.count(total, "name", "names")}"
    const val LAST_7_DAYS = "last 7 days"

    const val FILINGS_KICKER = "New reports"
    fun filingsHeadline(n: Int): String = when (n) {
        0 -> "No new reports on your names this week"
        1 -> "1 of your names has a new report this week"
        else -> "${num(n)} of your names have new reports this week"
    }

    const val MACRO_KICKER = "Macro"
    const val STATE_KICKER = "State changes"
    fun stateChangesHeadline(n: Int?): String = when (n) {
        null -> "State changes appear once Thesis has a week of readings"
        0 -> "No name changed state this week"
        1 -> "1 name changed state this week"
        else -> "${num(n)} names changed state this week"
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

    /** The macro card with a single reading (no line to draw yet). */
    fun macroOneReading(score: String): String = "One reading so far, $score. The line starts with the next close."

    /** "Score 0 to 100, last 7 days". */
    const val MACRO_WEEK_SCALE = "Score 0 to 100, last 7 days"
}
