package com.thesis.mobile.ui.screens

import com.thesis.mobile.model.FinancialHistoryRowView
import kotlin.math.abs

/**
 * Margin scale of [rows]: live reports store percent numbers (46.9, `percent()` in the worker's fact-pack ingest),
 * some old ones fractions (0.469). Only when every margin is within ±1, and the net margin says so, are they
 * fractions (x100). The renderer's rule (`deep_dive_v2/adapter.ts` marginScale), decided once per report so one
 * series never mixes scales, and so every screen (Name, both compare tables, the classic Deep Dive) reads a report
 * the way its page does.
 */
internal fun marginScale(rows: List<FinancialHistoryRowView>): Double {
    val ms = rows.flatMap { listOfNotNull(it.grossMargin, it.operatingMargin) }.filter { it.isFinite() }
    if (ms.isEmpty() || !ms.all { abs(it) <= 1.0 } || ms.none { abs(it) >= 0.02 }) return 1.0
    var fraction = 0
    var percent = 0
    rows.forEach { r ->
        val rev = r.revenue
        val ni = r.netIncome
        val m = r.operatingMargin ?: r.grossMargin
        if (rev == null || rev <= 0.0 || ni == null || m == null) return@forEach
        val netPct = ni / rev * 100.0
        if (abs(m * 100.0 - netPct) < abs(m - netPct)) fraction++ else percent++
    }
    return if (fraction + percent == 0 || fraction > percent) 100.0 else 1.0
}
