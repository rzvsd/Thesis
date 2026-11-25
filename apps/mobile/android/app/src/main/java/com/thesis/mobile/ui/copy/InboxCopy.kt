package com.thesis.mobile.ui.copy

import com.thesis.mobile.ui.format.Fmt

/*
 * Copy of WP-F's two screens (docs/app-redesign/DESIGN-DIRECTION.md 5.9 and 5.21): the Inbox and Macro Stress.
 * Sentence case, product vocabulary, no SPEC banned words, no em dashes, typographic apostrophes (U+2019).
 * Numbers go through Fmt.
 */

/** The Inbox tab (5.21). */
object InboxCopy {
    const val TITLE = "Inbox"

    /** The header lede: what is new since the last visit (client-side, `lastInboxVisitAt`). */
    fun newSinceLastVisit(newCount: Int): String =
        if (newCount == 0) {
            "Nothing new since your last visit"
        } else {
            "${Fmt.count(newCount, "new alert", "new alerts")} since your last visit"
        }

    /** The lede when no visit has been recorded yet. */
    fun total(count: Int): String = "${Fmt.count(count, "alert", "alerts")}, newest first"

    const val MARK_ALL_SEEN = "Mark all as seen"

    /** The filter chip that shows every category. */
    const val ALL = "All"

    /** Category labels, keyed by the alert's category key (never by English labels). */
    fun category(key: String): String = when (key) {
        "thesis_drift" -> "Thesis drift"
        "earnings" -> "Earnings"
        "macro" -> "Macro"
        "pulse" -> "Pulse"
        "system" -> "System"
        else -> humanize(key)
    }

    /** Notification families, as the Turn off dialog and snackbar name them. */
    fun family(type: String): String = when (type.trim().lowercase()) {
        "earnings_preview" -> "Earnings preview"
        "contrarian_alert", "thesis_drift" -> "Thesis drift"
        "kill_switch" -> "Kill switch"
        "freshness_decay" -> "Freshness"
        "morning_exception_briefing" -> "Morning briefing"
        "earnings_war_room" -> "War Room"
        "weekly_digest" -> "Weekly digest"
        "market_pulse_ready" -> "Pulse"
        "pulse_email" -> "Pulse email"
        else -> humanize(type)
    }

    // ---- Day headers (the eyebrow sets them in capitals)

    const val TODAY = "Today"
    const val YESTERDAY = "Yesterday"

    /** Alerts without a readable time, at the end of the list. */
    const val UNDATED = "Earlier"

    // ---- Row detail

    const val OPEN = "Open"
    fun openName(ticker: String): String = "Open $ticker"
    const val OPEN_WAR_ROOM = "Open War Room"
    const val OPEN_REPORT = "Open report"
    const val OPEN_PULSE = "Open Pulse"
    const val OPEN_DIGEST = "Open Weekly digest"

    /** What a Free user sees in place of the change detail (Pro). */
    const val PRO_LOCKED = "The full change, before and after, is part of Pro."
    const val UNLOCK = "See what changed with Pro"

    const val USEFUL = "Useful"
    const val NOT_USEFUL = "Not useful"
    const val FEEDBACK_GROUP = "Was this alert useful"

    const val MORE_ACTIONS = "More actions"
    const val QUIET_24H = "Quiet for 24 hours"
    const val TURN_OFF_TYPE = "Turn off this type"

    /** "Why you got this" caption prefix is the server's own reason text; this labels it for TalkBack. */
    const val REASON = "Reason"

    fun quietSince(relative: String): String = "Quiet since $relative"

    // ---- Quiet and turn off (undo snackbar)

    const val QUIETED = "Alerts like this are quiet for 24 hours"
    const val UNDO = "Undo"
    fun turnedOff(family: String): String = "$family alerts are off"
    fun turnOffTitle(family: String): String = "Turn off $family alerts?"
    const val TURN_OFF_BODY = "Thesis won’t send alerts of this type. You can turn them on again in You, Notifications."
    const val TURN_OFF_CONFIRM = "Turn off"
    const val CANCEL = "Cancel"

    /** Quiet alerts are kept out of the list but never lost: the footer offers them. */
    fun quietHidden(count: Int): String = "${Fmt.count(count, "quiet alert", "quiet alerts")} hidden"
    fun quietShown(count: Int): String = "${Fmt.count(count, "quiet alert", "quiet alerts")} shown"
    const val SHOW_QUIET = "Show"
    const val HIDE_QUIET = "Hide"

    // ---- States

    const val EMPTY = "No alerts yet."
    const val EMPTY_HOW = "You’ll see thesis drift, earnings and macro changes here."

    /** Every alert in the ledger is quiet: the footer below offers them. */
    const val ALL_QUIET = "All your alerts are quiet for now."
    const val ALL_QUIET_HOW = "Quiet alerts come back after 24 hours. Show them below."
    fun filteredEmpty(category: String): String = "No ${category.lowercase()} alerts."
    const val FILTERED_EMPTY_HOW = "Other categories still have alerts."
    const val SHOW_ALL = "Show all alerts"
    const val LOAD_SUBJECT = "the Inbox"
    const val REFRESH_FAILED = "Couldn’t refresh the Inbox. These are the alerts already loaded."

    /** "thesis_drift" -> "Thesis drift". */
    fun humanize(key: String): String =
        key.trim().replace('_', ' ').replace('-', ' ').lowercase().replaceFirstChar { it.uppercase() }
}

/** Macro Stress (5.9). The three regime words come from `macroStressLabel` (Semantic.kt) only. */
object MacroStressCopy {
    const val TITLE = "Macro Stress"

    /** Header eyebrow ("MACRO STRESS · AS OF 24 NOV" once the eyebrow sets it in capitals). */
    fun eyebrow(asOf: String?): String = if (asOf == null) "Macro stress" else "Macro stress · as of $asOf"

    /** The lead clause of the header sentence: "Stress is Balanced". */
    fun leadClause(label: String): String = "Stress is $label"

    /** The rest of the header sentence: "and rose 6 points this week." */
    fun changeClause(delta: Double, basis: String): String {
        val points = kotlin.math.abs(delta).let { Math.round(it) }
        val unit = if (points == 1L) "point" else "points"
        return when {
            kotlin.math.abs(delta) < 0.5 -> "and held steady $basis."
            delta > 0 -> "and rose $points $unit $basis."
            else -> "and fell $points $unit $basis."
        }
    }

    const val THIS_WEEK = "this week"
    fun since(date: String): String = "since $date"
    const val VS_WEEK_AGO = "vs 7 days ago"
    fun versus(date: String): String = "vs $date"
    const val FIRST_READING = "First reading, no change to compare yet"

    const val OF_100 = "of 100"
    const val INFO = "What the score measures"

    /** The range segments (7D · 14D · 30D · 90D). */
    val RANGES: List<String> = listOf("7D", "14D", "30D", "90D")
    fun rangeSpoken(days: Int): String = "Last $days days"

    // ---- Trend chart

    fun chartTitle(from: Double, to: Double, days: Int): String {
        val a = Fmt.score(from)
        val b = Fmt.score(to)
        return when {
            kotlin.math.abs(to - from) < 0.5 -> "Stress held at $b over $days days"
            to > from -> "Stress rose from $a to $b over $days days"
            else -> "Stress fell from $a to $b over $days days"
        }
    }

    fun chartTitleOne(value: Double): String = "One reading so far: ${Fmt.score(value)}"
    fun chartSubtitle(days: Int): String = "Score 0 to 100, higher is more pressure, last $days days"
    const val CHART_SOURCE = "Thesis macro model on official releases"
    const val SERIES = "Macro stress"
    const val TABLE_DATE = "Date"
    const val TABLE_SCORE = "Score"
    const val TABLE_CHANGE = "Change, pts"
    const val COPY_TABLE = "Copy readings as table"
    const val COPIED = "Readings copied"

    /** The readout's change, from the window's first reading: "+22 pts since 30 Oct". */
    fun changeSinceStart(change: String, startDate: String): String = "$change since $startDate"

    // ---- Factors

    const val FACTORS_KICKER = "What drives it"
    fun didMostOfTheRise(label: String): String = "$label did most of the rise"
    fun didMostOfTheFall(label: String): String = "$label did most of the fall"
    fun carriesMost(label: String): String = "$label carries the most pressure"
    const val EVEN_PRESSURE = "Pressure is spread evenly across the inputs"
    const val NO_FACTORS = "No input readings yet"
    fun changeSince(date: String): String = "Change since $date"
    fun sources(names: List<String>): String = "Source: ${names.joinToString(", ")}"

    const val PRESSURE_HIGH = "high pressure"
    const val PRESSURE_MEDIUM = "medium pressure"
    const val PRESSURE_LOW = "low pressure"

    /** Spoken factor row: "Treasury 10-year yield, 85 of 100, high pressure, +30 pts since Sun 23 Nov". */
    fun factorSpoken(label: String, score: String, pressure: String?, change: String?): String =
        listOfNotNull(label, "$score $OF_100", pressure, change).joinToString(", ")

    const val MISSING_TITLE = "Not in this reading"

    /** Why an input is missing, from the server's reason code ("stale_period"). */
    fun missingReason(code: String?): String = when (code?.trim()?.lowercase()) {
        "stale_period", "stale" -> "The latest release is older than the model accepts."
        "provider_error", "fetch_failed", "unavailable" -> "The source did not answer at the last pull."
        "not_released", "pending" -> "Not released yet for this period."
        else -> "Not in the latest official pull."
    }

    // ---- Inputs (registry ids from the server's macro model)

    fun inputLabel(registryId: String): String = when (registryId.trim().uppercase()) {
        "TREASURY_DAILY_10Y" -> "Treasury 10-year yield"
        "TREASURY_DAILY_2Y" -> "Treasury 2-year yield"
        "BLS_CPI_U_ALL_ITEMS" -> "Consumer prices, CPI-U"
        "BLS_UNEMPLOYMENT_RATE" -> "Unemployment rate"
        "BEA_REAL_GDP" -> "Real GDP growth"
        "EIA_WTI_SPOT" -> "WTI crude oil, spot"
        else -> InboxCopy.humanize(registryId)
    }

    fun sourceName(registryId: String, provider: String?): String? {
        val id = registryId.trim().uppercase()
        return when {
            id.startsWith("TREASURY") -> "U.S. Treasury"
            id.startsWith("BLS") -> "BLS"
            id.startsWith("BEA") -> "BEA"
            id.startsWith("EIA") -> "EIA"
            provider.isNullOrBlank() -> null
            provider.trim().lowercase() == "fred" -> "FRED"
            provider.trim().lowercase() == "official_macro" -> null
            else -> InboxCopy.humanize(provider)
        }
    }

    // ---- How to read this

    const val HOW_TITLE = "How to read this"
    const val HOW_CAPTION = "The scale, the regimes and what moves the score"
    const val EXPANDED = "Expanded"
    const val COLLAPSED = "Collapsed"
    const val HOW_BODY = "The score runs from 0 to 100, and higher means more macro pressure. 0 to 35 reads Contained, " +
        "36 to 69 Balanced and 70 to 100 Elevated. Each official input is rated low, medium or high pressure " +
        "against fixed levels, and the score is the average of the inputs available that day. It describes " +
        "conditions; it is not a forecast."

    // ---- Source sheet

    const val SHEET_METRIC = "Macro stress"
    const val SHEET_DEFINITION = "How much pressure official macro data puts on markets today, from 0 to 100. " +
        "Higher means more pressure."
    const val SHEET_FORM = "Official releases"
    const val SHEET_DERIVATION = "Each available input is rated low (25), medium (55) or high (85) pressure " +
        "against fixed levels; the score is their average. Missing inputs are left out."
    fun sheetPeriod(asOf: String): String = "as of $asOf"

    // ---- States

    const val EMPTY = "No macro stress reading yet."
    const val EMPTY_HOW = "The score appears after the first official data pull of the day."
    const val LOAD_SUBJECT = "macro stress"
    const val REFRESH_FAILED = "Couldn’t refresh macro stress. This is the last reading."
}
