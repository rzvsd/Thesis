package com.thesis.mobile.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.style.TextOverflow
import com.thesis.mobile.model.CompareReportsState
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.NoteTrailEntry
import com.thesis.mobile.model.latestFilingPeriod
import com.thesis.mobile.model.verdictSentence
import com.thesis.mobile.ui.components.BadgeSpec
import com.thesis.mobile.ui.components.CompareColumn
import com.thesis.mobile.ui.components.CompareRow
import com.thesis.mobile.ui.components.CompareTableModel
import com.thesis.mobile.ui.components.EmptyState
import com.thesis.mobile.ui.components.ErrorState
import com.thesis.mobile.ui.components.Eyebrow
import com.thesis.mobile.ui.components.NotePreview
import com.thesis.mobile.ui.components.ReportChange
import com.thesis.mobile.ui.components.ScreenHeader
import com.thesis.mobile.ui.components.SectionHeader
import com.thesis.mobile.ui.components.SinceLastReport
import com.thesis.mobile.ui.components.SinceLastReportModel
import com.thesis.mobile.ui.components.SkeletonCard
import com.thesis.mobile.ui.components.SourceInfo
import com.thesis.mobile.ui.components.SourceSheet
import com.thesis.mobile.ui.components.TextAction
import com.thesis.mobile.ui.components.ThesisCard
import com.thesis.mobile.ui.components.ThesisDivider
import com.thesis.mobile.ui.components.ThesisIconButton
import com.thesis.mobile.ui.components.rememberTopBarCollapsed
import com.thesis.mobile.ui.copy.KitCopy
import com.thesis.mobile.ui.copy.ResearchCopy
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.format.LocalFmt
import com.thesis.mobile.ui.format.Missing
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.motion.rememberHaptics
import com.thesis.mobile.ui.theme.Kit
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone
import com.thesis.mobile.ui.theme.thesisStateTone
import java.math.BigDecimal
import java.math.MathContext
import java.math.RoundingMode
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs

// ---- Filings: what "like for like" means (shared with History)

/**
 * A filing's fiscal period: annual ([quarter] null, a 10-K) or one fiscal quarter (a 10-Q). Two reports compare
 * like for like when both are annual, or both cover the same fiscal quarter (5.17, 5.18).
 */
@Immutable
internal data class FilingKey(val fiscalYear: Int, val quarter: Int? = null) {
    val annual: Boolean get() = quarter == null
}

private val QuarterPattern = Regex("""Q([1-4])\s*[-/ ]?\s*(?:FY)?\s*'?(\d{4}|\d{2})\b""")
private val YearQuarterPattern = Regex("""\b(\d{4})\s*[-/ ]\s*Q([1-4])\b""")
private val YearFyPattern = Regex("""\b(\d{4})\s*[-/ ]\s*FY\b""")
private val FyPattern = Regex("""\bFY\s*'?(\d{4}|\d{2})\b""")
private val FyMonthPattern = Regex("""\bFY\s+[A-Z]{3}-(\d{2})\b""")
private val YearPattern = Regex("""^\s*(\d{4})\s*$""")

/**
 * Reads a report's period as the payload and the app write it: "2025-FY", "2025-Q3", "FY2025", "FY25",
 * "Q3 FY25", "Q3 FY2025", "FY Sep-25", "2025". Null when it says neither a year nor a quarter.
 */
internal fun filingKeyOf(period: String?): FilingKey? {
    val s = period?.trim()?.uppercase()?.ifBlank { null } ?: return null
    fun year(raw: String): Int = raw.toInt().let { if (raw.length == 2) 2000 + it else it }
    YearQuarterPattern.find(s)?.let { return FilingKey(year(it.groupValues[1]), it.groupValues[2].toInt()) }
    QuarterPattern.find(s)?.let { return FilingKey(year(it.groupValues[2]), it.groupValues[1].toInt()) }
    YearFyPattern.find(s)?.let { return FilingKey(year(it.groupValues[1])) }
    FyMonthPattern.find(s)?.let { return FilingKey(year(it.groupValues[1])) }
    FyPattern.find(s)?.let { return FilingKey(year(it.groupValues[1])) }
    YearPattern.find(s)?.let { return FilingKey(year(it.groupValues[1])) }
    return null
}

/** 10-K with 10-K, or the same fiscal quarter (Q3 with Q3). */
internal fun likeForLike(a: FilingKey, b: FilingKey): Boolean =
    (a.annual && b.annual) || (a.quarter != null && a.quarter == b.quarter)

/** A report's period display ("FY2025", "Q3 FY25") from a raw period string, or the raw text when unreadable. */
internal fun periodDisplay(raw: String?): String? = filingKeyOf(raw)?.let(::periodLabel) ?: raw?.trim()?.ifBlank { null }

// ---- Compare reports model

/** One side of the comparison: the report, its filing and its verdict. */
@Immutable
internal data class ReportSide(
    val report: DeepDiveReportView,
    val key: FilingKey,
    val form: String,
    val at: Instant?,
) {
    /** "10-K FY2025". */
    val label: String get() = "$form ${periodLabel(key)}"
    val verdict: String? get() = report.verdictSentence()
}

/** What Compare reports can show for a pair (5.17: like-for-like pairs only). */
internal sealed interface ReportPair {
    data object OtherCompanies : ReportPair
    data object NotLikeForLike : ReportPair
    data object SameFiling : ReportPair
    data class Ready(val model: CompareReportsModel) : ReportPair
}

/** The key figures of Compare reports (5.17), in table order. */
internal enum class ReportMetric { Revenue, Growth, Gross, Operating, Fcf, NetCash, Shares, Eps }

/**
 * One key-figure row as numbers, for "Copy as table": each side's value in [unit] ("USD bn", "%") and the change
 * in [changeUnit] ("%", "bps", "USD bn"), rounded as the screen shows them; null when missing or not meaningful.
 */
@Immutable
internal data class RawRow(
    val metric: ReportMetric,
    val unit: String,
    val older: Double?,
    val newer: Double?,
    val change: Double?,
    val changeUnit: String,
    val dp: Int,
    val changeDp: Int,
)

@Immutable
internal data class CompareReportsModel(
    val ticker: String,
    val company: String?,
    val older: ReportSide,
    val newer: ReportSide,
    val basis: String,
    val table: CompareTableModel,
    /** The table's rows as numbers, in table order (Copy as table, the source sheets). */
    val raw: List<RawRow>,
    /** The result ("Revenue up 6.4%, operating margin up 50 bps"), the screen title; null when neither is known. */
    val headline: String?,
    /** What was compared: company, filing kind and when each report was built. */
    val deck: String,
    val since: SinceLastReportModel?,
)

private fun sideOf(report: DeepDiveReportView): ReportSide? {
    val key = filingKeyOf(report.filingRead?.period) ?: filingKeyOf(report.latestFilingPeriod()) ?: return null
    val form = report.filingRead?.form?.trim()?.uppercase()?.ifBlank { null }
        ?: if (key.annual) ResearchCopy.FORM_10K else ResearchCopy.FORM_10Q
    return ReportSide(report, key, form, parseInstant(report.generatedAt))
}

private fun historyOf(report: DeepDiveReportView, key: FilingKey) =
    report.financialAnalysis?.let { if (key.annual) it.annualHistory else it.quarterlyHistory + it.annualHistory }.orEmpty()

private fun toneOf(d: Double?): Tone = when {
    d == null || d == 0.0 -> Tone.Neutral
    d > 0 -> Tone.Favourable
    else -> Tone.Unfavourable
}

/** Percent change from [before] (the older filing) to [now] (the newer one); null without a positive base. */
private fun pctChange(before: Double?, now: Double?): Double? =
    if (now == null || before == null || before <= 0.0) null else (now / before - 1.0) * 100.0

/** [v] rounded half up to [dp] decimals, as the formatter shows it. */
internal fun roundTo(v: Double, dp: Int): Double = BigDecimal.valueOf(v).setScale(dp, RoundingMode.HALF_UP).toDouble()

/**
 * The change in points between two percentages as the reader sees them: both rounded to one decimal first, so
 * "+2.0%" and "+6.4%" give +440 bps, never the +444 of the unrounded inputs.
 */
internal fun shownPointsChange(older: Double?, newer: Double?): Double? =
    if (older == null || newer == null) null else roundTo(roundTo(newer, 1) - roundTo(older, 1), 1)

private fun signedMoney(d: Double?): String? = d?.let { (if (it > 0) "+" else "") + Fmt.money(it) }

/**
 * A share count in the compact style of the money figures, without a currency: "15.2B", "980M". Missing values
 * take their own word (2.4). (A count formatter in `Fmt` is requested from WP-K in HANDOFF-E.)
 */
internal fun compactCount(v: Double?, missing: Missing): String {
    if (v == null) return Fmt.missing(missing)
    if (!v.isFinite()) return Fmt.NA
    val a = abs(v)
    if (a < 1_000.0) return Fmt.number(v, 0)
    val r = BigDecimal.valueOf(a).round(MathContext(3, RoundingMode.HALF_UP))
    val (scale, suffix) = CountScales.first { r >= it.first }
    val mantissa = r.divide(scale)
    val decimals = when {
        mantissa >= BigDecimal(100) -> 0
        mantissa >= BigDecimal(10) -> 1
        else -> 2
    }
    return (if (v < 0) Fmt.MINUS else "") + mantissa.setScale(decimals, RoundingMode.HALF_UP).toPlainString() + suffix
}

private val CountScales = listOf(
    BigDecimal("1e12") to "T",
    BigDecimal("1e9") to "B",
    BigDecimal("1e6") to "M",
    BigDecimal("1e3") to "K",
)

private const val BN = 1e9
private const val MN = 1e6

/**
 * The pair [a], [b] as Compare reports shows it: older first, like for like only, with the key-figure table
 * (each report's own figures for its own filing), the change column named by its basis, a headline built from the
 * revenue and operating-margin changes, and the newer report's "Since the last report" block when the older one
 * is verifiably the report it was compared with ([sinceVerified]).
 */
internal fun compareReportsModel(a: DeepDiveReportView, b: DeepDiveReportView, fmt: Fmt, zone: ZoneId): ReportPair {
    if (!a.ticker.equals(b.ticker, ignoreCase = true)) return ReportPair.OtherCompanies
    val sa = sideOf(a) ?: return ReportPair.NotLikeForLike
    val sb = sideOf(b) ?: return ReportPair.NotLikeForLike
    if (sa.key == sb.key) return ReportPair.SameFiling
    if (!likeForLike(sa.key, sb.key)) return ReportPair.NotLikeForLike
    val (older, newer) = if (sa.key.fiscalYear <= sb.key.fiscalYear) sa to sb else sb to sa
    val fo = figuresFor(historyOf(older.report, older.key), older.key)
    val fn = figuresFor(historyOf(newer.report, newer.key), newer.key)
    val newerLabel = periodLabel(newer.key)
    val olderLabel = periodLabel(older.key)
    val sameQuarter = !newer.key.annual
    val basis = ResearchCopy.basis(newerLabel, olderLabel, sameQuarter)

    fun v(f: Figure?) = f?.value?.takeIf { it.isFinite() }
    fun word(f: Figure?) = f?.missing ?: Missing.NotComputed
    fun money(f: Figure?) = Fmt.money(v(f), missing = word(f))
    fun pctDelta(o: Figure?, n: Figure?) = pctChange(v(o), v(n))

    val revD = pctDelta(fo?.revenue, fn?.revenue)
    val growthD = shownPointsChange(v(fo?.revenueGrowthPct), v(fn?.revenueGrowthPct))
    val grossD = shownPointsChange(v(fo?.grossMarginPct), v(fn?.grossMarginPct))
    val opD = shownPointsChange(v(fo?.operatingMarginPct), v(fn?.operatingMarginPct))
    val fcfD = pctDelta(fo?.freeCashFlow, fn?.freeCashFlow)
    val cashD = v(fn?.netCash)?.let { n -> v(fo?.netCash)?.let { n - it } }
    val sharesD = pctDelta(fo?.shares, fn?.shares)
    val epsD = pctDelta(fo?.eps, fn?.eps)

    val rows = listOf(
        CompareRow(ResearchCopy.ROW_REVENUE, listOf(money(fo?.revenue), money(fn?.revenue)), delta = revD?.let { Fmt.signedPct(it) }, deltaTone = toneOf(revD)),
        CompareRow(
            ResearchCopy.ROW_GROWTH_SHORT,
            listOf(Fmt.signedPct(v(fo?.revenueGrowthPct), missing = word(fo?.revenueGrowthPct)), Fmt.signedPct(v(fn?.revenueGrowthPct), missing = word(fn?.revenueGrowthPct))),
            delta = growthD?.let { Fmt.bpsFromPoints(it) },
        ),
        marginRow(ResearchCopy.ROW_GROSS, fo?.grossMarginPct, fn?.grossMarginPct, grossD),
        marginRow(ResearchCopy.ROW_OPERATING_SHORT, fo?.operatingMarginPct, fn?.operatingMarginPct, opD),
        CompareRow(ResearchCopy.ROW_FCF_SHORT, listOf(money(fo?.freeCashFlow), money(fn?.freeCashFlow)), delta = fcfD?.let { Fmt.signedPct(it) }, deltaTone = toneOf(fcfD)),
        CompareRow(ResearchCopy.ROW_NET_CASH, listOf(money(fo?.netCash), money(fn?.netCash)), delta = signedMoney(cashD), deltaTone = toneOf(cashD)),
        CompareRow(
            ResearchCopy.ROW_SHARES_SHORT,
            listOf(compactCount(v(fo?.shares), word(fo?.shares)), compactCount(v(fn?.shares), word(fn?.shares))),
            delta = sharesD?.let { Fmt.signedPct(it) },
        ),
        CompareRow(ResearchCopy.ROW_EPS, listOf(money(fo?.eps), money(fn?.eps)), delta = epsD?.let { Fmt.signedPct(it) }, deltaTone = toneOf(epsD)),
    )
    fun scaled(f: Figure?, by: Double) = v(f)?.div(by)
    val raw = listOf(
        RawRow(ReportMetric.Revenue, ResearchCopy.UNIT_USD_BN, scaled(fo?.revenue, BN), scaled(fn?.revenue, BN), revD, ResearchCopy.UNIT_PCT, 2, 1),
        RawRow(ReportMetric.Growth, ResearchCopy.UNIT_PCT, v(fo?.revenueGrowthPct), v(fn?.revenueGrowthPct), growthD?.times(100), ResearchCopy.UNIT_BPS, 1, 0),
        RawRow(ReportMetric.Gross, ResearchCopy.UNIT_PCT, v(fo?.grossMarginPct), v(fn?.grossMarginPct), grossD?.times(100), ResearchCopy.UNIT_BPS, 1, 0),
        RawRow(ReportMetric.Operating, ResearchCopy.UNIT_PCT, v(fo?.operatingMarginPct), v(fn?.operatingMarginPct), opD?.times(100), ResearchCopy.UNIT_BPS, 1, 0),
        RawRow(ReportMetric.Fcf, ResearchCopy.UNIT_USD_BN, scaled(fo?.freeCashFlow, BN), scaled(fn?.freeCashFlow, BN), fcfD, ResearchCopy.UNIT_PCT, 2, 1),
        RawRow(ReportMetric.NetCash, ResearchCopy.UNIT_USD_BN, scaled(fo?.netCash, BN), scaled(fn?.netCash, BN), cashD?.div(BN), ResearchCopy.UNIT_USD_BN, 2, 2),
        RawRow(ReportMetric.Shares, ResearchCopy.UNIT_MILLIONS, scaled(fo?.shares, MN), scaled(fn?.shares, MN), sharesD, ResearchCopy.UNIT_PCT, 1, 1),
        RawRow(ReportMetric.Eps, ResearchCopy.UNIT_USD, v(fo?.eps), v(fn?.eps), epsD, ResearchCopy.UNIT_PCT, 2, 1),
    )
    // Header row 2 is the filing form only: the build dates go in the deck, so label, both values and the change
    // fit a phone instead of the date line setting each column's width.
    val table = CompareTableModel(
        columns = listOf(
            CompareColumn(period = olderLabel, filing = older.form),
            CompareColumn(period = newerLabel, filing = newer.form, subject = true),
        ),
        rows = rows,
        labelHeader = basis,
        deltaHeader = ResearchCopy.CHANGE,
    )
    val ticker = (newer.report.ticker ?: older.report.ticker).orEmpty().trim().uppercase()
    val company = newer.report.issuer?.name?.trim()?.ifBlank { null } ?: older.report.issuer?.name?.trim()?.ifBlank { null }
    val (olderBuilt, newerBuilt) = pairedDates(older.at, newer.at, fmt, zone)
    return ReportPair.Ready(
        CompareReportsModel(
            ticker = ticker,
            company = company,
            older = older,
            newer = newer,
            basis = basis,
            table = table,
            raw = raw,
            // The basis leads the result, so every figure in the title carries its period (C1).
            headline = ResearchCopy.compareReportsHeadline(revD, opD?.times(100))?.let { ResearchCopy.withBasis(newerLabel, olderLabel, it) },
            deck = ResearchCopy.compareReportsDeck(company ?: ticker, newer.form, olderBuilt, newerBuilt),
            since = if (sinceVerified(older, newer)) sinceLastReportOf(older, newer, fmt, zone) else null,
        ),
    )
}

private fun marginRow(label: String, older: Figure?, newer: Figure?, change: Double?): CompareRow {
    val o = older?.value?.takeIf { it.isFinite() }
    val n = newer?.value?.takeIf { it.isFinite() }
    return CompareRow(
        label,
        listOf(
            Fmt.pct(o, dp = 1, missing = older?.missing ?: Missing.NotComputed),
            Fmt.pct(n, dp = 1, missing = newer?.missing ?: Missing.NotComputed),
        ),
        delta = change?.let { Fmt.bpsFromPoints(it) },
        deltaTone = toneOf(change),
    )
}

/** [v] as a plain number for a spreadsheet: ASCII minus, no grouping, [dp] decimals; empty when missing. */
internal fun rawCell(v: Double?, dp: Int): String =
    v?.takeIf { it.isFinite() }?.let { BigDecimal.valueOf(it).setScale(dp, RoundingMode.HALF_UP).toPlainString() }.orEmpty()

/**
 * "Copy as table" (5.17): tab-separated numbers that Excel and Sheets read as numbers. Header lines: the basis
 * with both periods, then the filing forms; one line per figure with its unit in the label ("Revenue (USD bn)"),
 * the change and the change's unit in its own column. A missing value is an empty cell.
 */
internal fun compareReportsTsv(model: CompareReportsModel): String {
    fun cell(s: String) = s.replace('\t', ' ').replace('\n', ' ').trim()
    val lines = mutableListOf<List<String>>()
    lines += listOf(model.basis, periodLabel(model.older.key), periodLabel(model.newer.key), ResearchCopy.CHANGE, ResearchCopy.CHANGE_UNIT)
    lines += listOf("", model.older.form, model.newer.form, "", "")
    model.raw.forEach { r ->
        lines += listOf(
            ResearchCopy.withUnit(reportMetricName(r.metric), r.unit),
            rawCell(r.older, r.dp),
            rawCell(r.newer, r.dp),
            rawCell(r.change, r.changeDp),
            if (r.change == null) "" else r.changeUnit,
        )
    }
    return lines.joinToString("\n") { line -> line.joinToString("\t") { cell(it) } }
}

/** A key figure's full name (the table shows the short form): for the source sheet and the TSV. */
internal fun reportMetricName(metric: ReportMetric): String = when (metric) {
    ReportMetric.Revenue -> ResearchCopy.ROW_REVENUE
    ReportMetric.Growth -> ResearchCopy.ROW_GROWTH
    ReportMetric.Gross -> ResearchCopy.ROW_GROSS
    ReportMetric.Operating -> ResearchCopy.ROW_OPERATING
    ReportMetric.Fcf -> ResearchCopy.ROW_FCF_FULL
    ReportMetric.NetCash -> ResearchCopy.ROW_NET_CASH
    ReportMetric.Shares -> ResearchCopy.ROW_SHARES_FULL
    ReportMetric.Eps -> ResearchCopy.ROW_EPS
}

/**
 * What a key figure is and where it comes from (#47, 5.25 "every fundamental figure → SourceSheet"): the figure
 * of side [col] (0 the older report, 1 the newer) of row [row], with that report's filing and the derivation of the
 * figures the app computes (growth, net cash, EPS). Null for a row or column that is not a figure.
 */
internal fun compareReportsSource(model: CompareReportsModel, row: Int, col: Int): SourceInfo? {
    val r = model.raw.getOrNull(row) ?: return null
    val side = when (col) {
        0 -> model.older
        1 -> model.newer
        else -> return null
    }
    val annual = side.key.annual
    val (definition, derivation) = when (r.metric) {
        ReportMetric.Revenue -> ResearchCopy.DEF_REVENUE_PERIOD to null
        ReportMetric.Growth -> (if (annual) ResearchCopy.DEF_GROWTH else ResearchCopy.DEF_GROWTH_QUARTER) to
            (if (annual) ResearchCopy.DERIVE_GROWTH else ResearchCopy.DERIVE_GROWTH_QUARTER)
        ReportMetric.Gross -> ResearchCopy.DEF_GROSS to null
        ReportMetric.Operating -> ResearchCopy.DEF_OPERATING to null
        ReportMetric.Fcf -> ResearchCopy.DEF_FCF_AMOUNT to null
        ReportMetric.NetCash -> ResearchCopy.DEF_NET_CASH_PERIOD to ResearchCopy.DERIVE_NET_CASH
        ReportMetric.Shares -> ResearchCopy.DEF_SHARES_OUTSTANDING to null
        ReportMetric.Eps -> ResearchCopy.DEF_EPS to ResearchCopy.DERIVE_EPS
    }
    val period = periodLabel(side.key)
    return SourceInfo(
        metric = "${model.ticker} ${reportMetricName(r.metric).replaceFirstChar { it.lowercase() }}, $period",
        definition = definition,
        form = side.form,
        period = period,
        derivation = derivation,
    )
}

/** The direction words a top change may carry, read as up / down / neither. */
internal fun changeDirection(raw: String?): Boolean? {
    val d = raw?.lowercase().orEmpty()
    return when {
        listOf("up", "increase", "improv", "higher", "rise", "expan", "strength").any { d.contains(it) } -> true
        listOf("down", "decrease", "declin", "lower", "fall", "contract", "weaken", "deterior").any { d.contains(it) } -> false
        else -> null
    }
}

/**
 * Whether the newer report's "Since the last report" is a change since [older] (5.17: shown only "when the older
 * one is its comparable report"). The drift metadata names the comparable report: then it must be [older]. Without
 * it, only two consecutive annual reports qualify (FY2024 then FY2025); FY2023 with FY2025 would label a
 * one-year change as a change since FY2023, and a quarterly report may have been compared with the quarter before.
 */
private val DateWithYear = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.US)

/**
 * The two reports' dates in one form: "19 Nov 2025" and "24 Nov 2026" when either falls outside the current year,
 * else "19 Nov" and "24 Nov" ([Fmt.shortDate] drops the year only for this year, which mixes the forms in one
 * sentence: "built 19 Nov 2025 and 24 Nov").
 */
internal fun pairedDates(older: Instant?, newer: Instant?, fmt: Fmt, zone: ZoneId): Pair<String?, String?> {
    val dates = listOf(older, newer).map { it?.atZone(zone)?.toLocalDate() }
    val short = dates.map { d -> d?.let(fmt::shortDate) }
    val anyWithYear = dates.zip(short).any { (d, text) -> d != null && text != null && text.endsWith(d.year.toString()) }
    val shown = if (anyWithYear) dates.map { it?.format(DateWithYear) } else short
    return shown[0] to shown[1]
}

internal fun sinceVerified(older: ReportSide, newer: ReportSide): Boolean {
    val comparable = newer.report.trustMetadata?.thesisDrift?.comparableReportId?.trim()?.ifBlank { null }
    if (comparable != null) return comparable == older.report.reportId
    return older.key.annual && newer.key.annual && newer.key.fiscalYear - older.key.fiscalYear == 1
}

private fun sinceLastReportOf(older: ReportSide, newer: ReportSide, fmt: Fmt, zone: ZoneId): SinceLastReportModel? {
    val change = newer.report.changeSummary ?: return null
    val drift = newer.report.trustMetadata?.thesisDrift
    val (olderAt, newerAt) = pairedDates(older.at, newer.at, fmt, zone)
    return SinceLastReportModel(
        previousView = change.previousView,
        previousFiling = listOfNotNull(older.label, olderAt).joinToString(" · "),
        currentView = change.currentView,
        currentFiling = listOfNotNull(newer.label, newerAt).joinToString(" · "),
        changes = change.topChanges.take(3).map { c ->
            val up = changeDirection(c.direction)
            ReportChange(
                title = c.title,
                directionLabel = when (up) {
                    true -> ResearchCopy.UP
                    false -> ResearchCopy.DOWN
                    null -> ResearchCopy.CHANGED
                },
                up = up,
                tone = Tone.Neutral,
                whyItMatters = c.whyItMatters.ifBlank { null },
            )
        },
        drift = drift?.status?.let { s -> ResearchCopy.humanize(s)?.let { BadgeSpec(it, thesisStateTone(s).takeIf { t -> t != Tone.Unknown } ?: Tone.Neutral) } },
    )
}

// ---- Screen

/**
 * Compare reports (DESIGN-DIRECTION 5.17), secondary to Compare names: two reports of one ticker, like for like
 * only (10-K with 10-K, or the same fiscal quarter). "Since the last report" first (from the newer report, when
 * the older one is verifiably the report it compared with), then the key figures each report was built on with the
 * change named by its basis (a tap on a figure opens its source), what each report concluded, and your notes on
 * both. Copy as table (the bar's action) puts the figures on the clipboard as numbers. Frozen figures: no motion
 * beyond the push.
 *
 * Draws its own top bar ("Compare" + "AAPL · 10-K FY2024 vs 10-K FY2025"); the shell gives it none (HANDOFF-E).
 * [notes] is the ticker's notes trail (`state.notesTrails[ticker]`). [onEditNote] opens a report's note in its
 * editor; while it is null the notes show without an action, so no "Edit" that only opens the report.
 */
@Composable
fun CompareReportsScreen(
    state: CompareReportsState?,
    onBack: () -> Unit,
    padding: PaddingValues = PaddingValues(),
    notes: List<NoteTrailEntry> = emptyList(),
    onRetry: () -> Unit = {},
    onOpenReport: (reportId: String) -> Unit = {},
    onOpenChange: ((reportId: String, index: Int) -> Unit)? = null,
    onEditNote: ((reportId: String) -> Unit)? = null,
    zone: ZoneId = ZoneId.systemDefault(),
) {
    val fmt = LocalFmt.current
    val haptics = rememberHaptics()
    val clipboard = LocalClipboardManager.current
    val scroll = rememberScrollState()
    val collapsed by rememberTopBarCollapsed(scroll)
    var source by remember { mutableStateOf<SourceInfo?>(null) }
    val a = state?.a
    val b = state?.b
    val pair = remember(a, b, fmt, zone) { if (a != null && b != null) compareReportsModel(a, b, fmt, zone) else null }
    val ready = (pair as? ReportPair.Ready)?.model
    // Keyed on what was copied: once the pair changes the clipboard holds the old table, so the check goes.
    var copied by remember(ready) { mutableStateOf(false) }
    val copy = {
        if (ready != null) {
            clipboard.setText(AnnotatedString(compareReportsTsv(ready)))
            haptics.confirm()
            copied = true
        }
    }

    ResearchBarPage(
        title = ResearchCopy.COMPARE,
        subtitle = ready?.let { ResearchCopy.compareReportsSubtitle(it.ticker, it.older.label, it.newer.label) },
        titleAlwaysVisible = true,
        onBack = onBack,
        padding = padding,
        collapsed = collapsed,
        actions = {
            if (ready != null) {
                // The one Copy as table entry (5.17); the icon turns to a check once the table is on the clipboard.
                ThesisIconButton(
                    if (copied) ThesisIcons.Check else ThesisIcons.Copy,
                    contentDescription = if (copied) ResearchCopy.COPIED else ResearchCopy.COPY_TABLE,
                    onClick = copy,
                )
            }
        },
    ) { inner ->
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(scroll)
                .researchWidth(data = true)
                .padding(top = inner.calculateTopPadding() + ThesisSpace.headerTop, bottom = inner.calculateBottomPadding())
                .padding(horizontal = ThesisSpace.gutter),
        ) {
            when {
                // The fallback states carry their own sentence; no header repeating the bar's "Compare" (V3).
                state == null || (state.isLoading && pair == null) -> {
                    SkeletonCard(bodyLines = 4)
                    Spacer(Modifier.height(ThesisSpace.cardGap))
                    SkeletonCard(bodyLines = 6)
                }
                pair == null -> {
                    ErrorState(
                        title = KitCopy.couldNotLoad(ResearchCopy.COMPARE_REPORTS_FAILED),
                        cause = state.error,
                        onRetry = onRetry,
                    )
                }
                ready == null -> {
                    val (sentence, how) = when (pair) {
                        ReportPair.OtherCompanies -> ResearchCopy.OTHER_COMPANIES to ResearchCopy.OTHER_COMPANIES_HOW
                        ReportPair.SameFiling -> ResearchCopy.SAME_FILING to ResearchCopy.SAME_FILING_HOW
                        else -> ResearchCopy.NOT_LIKE_FOR_LIKE to ResearchCopy.NOT_LIKE_FOR_LIKE_HOW
                    }
                    EmptyState(sentence = sentence, how = how, icon = ThesisIcons.Compare)
                }
                else -> CompareReportsBody(
                    model = ready,
                    notes = notes,
                    onOpenReport = onOpenReport,
                    onOpenChange = onOpenChange,
                    onEditNote = onEditNote,
                    onSource = { source = it },
                    fmt = fmt,
                    zone = zone,
                )
            }
        }
    }
    source?.let { info -> SourceSheet(info = info, onDismissRequest = { source = null }) }
}

@Composable
private fun ColumnScope.CompareReportsBody(
    model: CompareReportsModel,
    notes: List<NoteTrailEntry>,
    onOpenReport: (String) -> Unit,
    onOpenChange: ((String, Int) -> Unit)?,
    onEditNote: ((String) -> Unit)?,
    onSource: (SourceInfo) -> Unit,
    fmt: Fmt,
    zone: ZoneId,
) {
    val p = LocalThesisPalette.current
    // The title is the result; the deck says what was compared; the basis is said once, in the table header.
    ScreenHeader(
        eyebrow = "${ResearchCopy.COMPARE_REPORTS_EYEBROW} · ${model.ticker}",
        title = model.headline ?: model.company ?: model.ticker,
        deck = model.deck,
    )
    if (model.since != null) {
        Spacer(Modifier.height(ThesisSpace.headerToSection))
        SinceLastReport(
            model = model.since,
            onChangeClick = onOpenChange?.let { cb -> { i: Int -> cb(model.newer.report.reportId, i) } },
        )
    }

    Spacer(Modifier.height(ThesisSpace.sectionGapData))
    SectionHeader(kicker = ResearchCopy.KEY_FIGURES_KICKER, headline = ResearchCopy.KEY_FIGURES_FALLBACK)
    Spacer(Modifier.height(ThesisSpace.m))
    FittedCompareTable(
        model = model.table,
        columnNames = listOf(model.older.label, model.newer.label),
        deltaName = ResearchCopy.THE_CHANGE,
        onCellClick = { r, c -> compareReportsSource(model, r, c)?.let(onSource) },
    )

    Spacer(Modifier.height(ThesisSpace.sectionGapData))
    SectionHeader(kicker = ResearchCopy.VERDICTS_KICKER, headline = ResearchCopy.VERDICTS_HEADLINE)
    Spacer(Modifier.height(ThesisSpace.m))
    val (olderAt, newerAt) = pairedDates(model.older.at, model.newer.at, fmt, zone)
    ThesisCard {
        listOf(model.newer to true, model.older to false).forEachIndexed { i, (side, newer) ->
            if (i > 0) ThesisDivider()
            Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.xs)) {
                Eyebrow(
                    listOfNotNull(side.label, if (newer) newerAt else olderAt).joinToString(" · "),
                    color = if (newer) p.accent else p.muted,
                )
                Text(
                    side.verdict ?: ResearchCopy.NO_VERDICT,
                    style = ThesisType.story,
                    color = if (newer) p.ink else p.ink2,
                )
                TextAction(ResearchCopy.OPEN_THIS_REPORT, onClick = { onOpenReport(side.report.reportId) })
            }
        }
    }

    val byReport = notes.filter { it.text.isNotBlank() }.associateBy { it.reportId }
    val pairNotes = listOf(model.newer, model.older).mapNotNull { side -> byReport[side.report.reportId]?.let { side to it } }
    Spacer(Modifier.height(ThesisSpace.sectionGapData))
    SectionHeader(kicker = ResearchCopy.NOTES_KICKER, headline = ResearchCopy.notesHeadline(pairNotes.size))
    pairNotes.forEach { (side, note) ->
        Spacer(Modifier.height(ThesisSpace.m))
        if (onEditNote != null) {
            NotePreview(text = note.text, onEdit = { onEditNote(side.report.reportId) }, filing = side.label)
        } else {
            NoteReadOnly(text = note.text, filing = side.label)
        }
    }
}

/**
 * A note shown without an action, until the shell can open a report's note editor ([CompareReportsScreen]
 * `onEditNote`): the kit's `NotePreview` always offers "Edit" (a label request is in HANDOFF-E).
 */
@Composable
private fun NoteReadOnly(text: String, filing: String) {
    val p = LocalThesisPalette.current
    ThesisCard {
        Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Eyebrow(ResearchCopy.YOUR_NOTE, Modifier.weight(1f))
                Text(filing, style = ThesisType.caption, color = p.muted)
            }
            Text(text, style = ThesisType.story, color = p.ink, maxLines = Kit.NOTE_PREVIEW_LINES, overflow = TextOverflow.Ellipsis)
        }
    }
}
