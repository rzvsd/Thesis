package com.thesis.mobile.ui.copy

import com.thesis.mobile.ui.format.Fmt

/**
 * What every proprietary score and every Name figure is, for the SourceSheet (docs/app-redesign/DESIGN-DIRECTION.md
 * principle 4, section 3 #47, 5.11). The score definitions restate the server's own rules
 * (`supabase/functions/_lib/jobs/effects/monitor.ts`, `helpers.ts`) in plain words, so the sheet shows the inputs
 * and the weights the number is made of. Keep them in step with those files.
 */
object ScoreCopy {

    // ---- Monitor score (thesis monitor snapshot `score`, the latest report's confidence score, 0 to 1 on the wire)

    const val MONITOR_SCORE = "Monitor score"
    const val MONITOR_DEFINITION = "How firmly the latest Deep Dive supports its own reading of the thesis, on a " +
        "scale of 0 to 100. It is the report’s confidence score, and the state next to it (Intact, Improved, " +
        "Weakened, Unresolved) comes from the same report’s thesis-drift check."
    const val MONITOR_DERIVATION = "Report confidence × 100. Unresolved when the evidence is stale or conflicting " +
        "or the report is older than 14 days; Weakened or Improved when the drift check says so; else Intact."

    /** Inputs of the monitor score: label to formatted value. */
    fun monitorInputs(score: String, state: String, reason: String?, report: String?, previous: String?): List<Pair<String, String>> =
        listOfNotNull(
            "Report confidence" to score,
            "State" to state,
            reason?.takeIf { it.isNotBlank() }?.let { "Why" to it },
            report?.let { "Report" to it },
            previous?.let { "Your last visit" to it },
        )

    // ---- Freshness (snapshot `freshness_score`, `freshness_state`)

    const val FRESHNESS = "Freshness"
    const val FRESHNESS_DEFINITION = "How current the report is for this name. It starts at 100 and loses up to 55 " +
        "points as the report ages (aging from 14 days, stale after 45), up to 35 points for material events you " +
        "have not reviewed (all 35 at 6 or more) and 20 points when kill-switch conditions fired."
    const val FRESHNESS_DERIVATION = "100 − age (up to 55) − unreviewed events (up to 35) − kill switch (20)."

    fun freshnessInputs(
        score: String,
        state: String,
        reportAge: String?,
        unreviewed: Int,
        material: Int,
        killSwitch: Boolean,
        reason: String?,
    ): List<Pair<String, String>> = listOfNotNull(
        "Freshness score" to score,
        "State" to state,
        reportAge?.let { "Report age" to it },
        "Unreviewed material events" to "${Fmt.number(unreviewed.toLong())} of ${Fmt.number(material.toLong())}",
        "Kill switch" to if (killSwitch) "Fired" else "Not fired",
        reason?.takeIf { it.isNotBlank() }?.let { "Why" to it },
    )

    // ---- Name: events and alerts

    const val EVENTS = "Events since the report"
    const val EVENTS_DEFINITION = "Material events (filings, guidance, kill-switch checks) the monitor recorded " +
        "since the latest Deep Dive. The count returns to 0 when the next report for a new filing lands."
    const val ALERTS = "Alerts since your last visit"
    const val ALERTS_DEFINITION = "Alerts for this name created after you last opened Names. Opening Names " +
        "moves the reference point."

    // ---- Name: figures from the filings (5.11 item 4); the report's annual history rows

    const val REVENUE_DEFINITION = "Total revenue the company reported for the fiscal year."
    const val GROSS_DEFINITION = "Gross profit as a share of revenue."
    const val GROSS_DERIVATION = "Gross profit ÷ revenue."
    const val OPERATING_DEFINITION = "Operating income as a share of revenue: what is left after the cost of " +
        "sales and operating expenses."
    const val OPERATING_DERIVATION = "Operating income ÷ revenue."
    const val FCF_DEFINITION = "Free cash flow as a share of revenue: cash from operations less capital spending."
    const val FCF_DERIVATION = "Free cash flow ÷ revenue."
    const val NET_CASH_DEFINITION = "Cash and equivalents less total debt at the fiscal year end. Negative means " +
        "more debt than cash."
    const val NET_CASH_DERIVATION = "Cash and equivalents − total debt."
    const val SHARES_DEFINITION = "Change in shares outstanding over the fiscal year. Fewer shares usually means " +
        "buybacks; more shares, issuance or stock pay."
    const val SHARES_DERIVATION = "Shares outstanding this year ÷ last year − 1."
    const val GROWTH_DERIVATION = "Revenue this year ÷ revenue last year − 1."
    const val SOURCE_FORM = "Annual filing"
}
