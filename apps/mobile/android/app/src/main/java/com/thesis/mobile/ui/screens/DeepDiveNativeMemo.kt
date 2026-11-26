package com.thesis.mobile.ui.screens

import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.FilingMetricDeltaView
import com.thesis.mobile.model.FinancialHistoryRowView
import com.thesis.mobile.model.IndicatorView
import com.thesis.mobile.ui.components.KpiSpec
import com.thesis.mobile.ui.copy.DeepDiveCopy
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.format.Missing
import com.thesis.mobile.ui.format.PeriodKind
import com.thesis.mobile.ui.theme.Tone
import org.json.JSONObject
import kotlin.math.abs

/*
 * The classic Deep Dive's data layer (docs/app-redesign/DESIGN-DIRECTION.md 5.15, 5.16): pure functions from the
 * report payload to what the screen shows. Every figure goes through [Fmt] (U+2212 minus, 3 significant figures,
 * margins in bps) and carries its period; no raw printf-style formatting. Unit tested in
 * DeepDiveClassicModelTest.
 */

/** How a filing delta is compared: with the previous quarter, the same quarter a year ago, or fiscal year on year. */
internal enum class DeltaBasis { Quarter, Year, Fiscal }

/** Reads `2025-Q4`, `2025-FY`, `FY2025`, `Q3 FY25` and plain years. */
internal data class ParsedPeriod(val year: Int, val quarter: Int?)

internal object ClassicFormat {
    private val isoPeriod = Regex("""^(\d{4})-(Q([1-4])|FY)$""", RegexOption.IGNORE_CASE)
    private val fyPeriod = Regex("""^FY\s?(\d{4})$""", RegexOption.IGNORE_CASE)
    private val qPeriod = Regex("""^Q([1-4])\s?FY\s?(\d{2,4})$""", RegexOption.IGNORE_CASE)
    private val plainYear = Regex("""^(\d{4})$""")

    fun parsePeriod(raw: String?): ParsedPeriod? {
        val s = raw?.trim().orEmpty()
        isoPeriod.find(s)?.let { m ->
            return ParsedPeriod(m.groupValues[1].toInt(), m.groupValues[3].toIntOrNull())
        }
        fyPeriod.find(s)?.let { return ParsedPeriod(it.groupValues[1].toInt(), null) }
        qPeriod.find(s)?.let { m ->
            val y = m.groupValues[2].toInt().let { if (it < 100) 2000 + it else it }
            return ParsedPeriod(y, m.groupValues[1].toInt())
        }
        plainYear.find(s)?.let { return ParsedPeriod(it.groupValues[1].toInt(), null) }
        return null
    }

    /** "2025-Q4" → "Q4 FY25", "2025-FY" → "FY2025"; anything else is shown as it came. */
    fun periodLabel(raw: String?): String? {
        if (raw.isNullOrBlank()) return null
        val p = parsePeriod(raw) ?: return raw.trim()
        return if (p.quarter != null) Fmt.period(PeriodKind.Q, p.year, p.quarter) else Fmt.period(PeriodKind.FY, p.year)
    }

    /** The period in running text: "fiscal 2025", "Q4 FY25". */
    fun periodWords(raw: String?): String? {
        val p = parsePeriod(raw) ?: return raw?.trim()?.ifBlank { null }
        return if (p.quarter != null) Fmt.period(PeriodKind.Q, p.year, p.quarter) else DeepDiveCopy.fiscalYearWords(p.year)
    }

    /** "10-Q Q4 FY25", "10-K FY2025", or what is known of it. */
    fun filingLabel(form: String?, period: String?): String? =
        listOfNotNull(form?.trim()?.ifBlank { null }, periodLabel(period)).joinToString(" ").ifBlank { null }

    /** A figure in its unit: money compact, percents with one decimal, multiples with ×, counts compact. */
    fun value(v: Double?, unit: String?, missing: Missing = Missing.NotDisclosed): String = when (unit?.lowercase()) {
        "pct", "percent" -> Fmt.pct(v, 1, missing)
        "multiple" -> Fmt.multiple(v, 1, missing)
        "ratio" -> Fmt.number(v, 2, missing)
        "currency", "usd", "money" -> Fmt.money(v, missing = missing)
        "count", "shares" -> count(v, missing)
        else -> plain(v, missing)
    }

    /** A large count without a currency sign: "7.42B", "−3.10M"; small counts with grouping. */
    fun count(v: Double?, missing: Missing = Missing.NotDisclosed): String {
        if (v == null || !v.isFinite()) return Fmt.money(v, missing = missing)
        if (abs(v) < 1_000.0) return Fmt.number(v, 0)
        return Fmt.money(v).replace(Fmt.currencyPrefix("USD"), "")
    }

    /** A number of unknown unit (visual panels): compact when large, one decimal when small. */
    fun plain(v: Double?, missing: Missing = Missing.NotDisclosed): String = when {
        v == null || !v.isFinite() -> Fmt.number(v, 0, missing)
        abs(v) >= 1_000_000.0 -> count(v)
        abs(v) >= 100.0 -> Fmt.number(v, 0)
        else -> Fmt.number(v, 1)
    }

    /**
     * A filing delta's change: margins and other percent lines changed by points, shown in bps; everything else as a
     * signed percent.
     */
    fun change(d: FilingMetricDeltaView): String? = d.deltaPct?.takeIf { it.isFinite() }?.let { pct ->
        if (d.unit.equals("pct", ignoreCase = true)) Fmt.bpsFromPoints(pct) else Fmt.signedPct(pct)
    }

    /** The worker's own judgement of the line (improved / weakened); never a market direction. */
    fun tone(direction: String?): Tone = when (direction?.lowercase()) {
        "improved", "improving" -> Tone.Favourable
        "weakened", "deteriorating" -> Tone.Unfavourable
        "mixed" -> Tone.Attention
        else -> Tone.Neutral
    }

    fun basis(d: FilingMetricDeltaView): DeltaBasis? {
        val cur = parsePeriod(d.currentPeriod) ?: return null
        val ref = parsePeriod(d.referencePeriod) ?: return null
        return when {
            cur.quarter == null && ref.quarter == null -> DeltaBasis.Fiscal
            cur.quarter != null && ref.quarter == cur.quarter && ref.year == cur.year - 1 -> DeltaBasis.Year
            cur.quarter != null && ref.quarter != null -> DeltaBasis.Quarter
            else -> null
        }
    }

    /** "balance_sheet" → "Balance sheet", "cash_flow_quality" → "Cash flow quality". */
    fun humanize(key: String): String =
        key.replace('_', ' ').replace('-', ' ').trim().lowercase().replaceFirstChar { it.uppercase() }

    /**
     * The value-lens chip's label: the known classification in product words ([DeepDiveCopy.valueClass]); an unknown
     * key humanized, unless its words are on the SPEC 4 list, then [DeepDiveCopy.valueClassOther].
     */
    fun classificationLabel(key: String): String =
        DeepDiveCopy.valueClass(key)
            ?: humanize(key).takeUnless { SPEC_BANNED.containsMatchIn(it) }
            ?: DeepDiveCopy.valueClassOther

    /** SPEC 4 banned words (docs/deep-dive/SPEC.md section 4; the same list as tools/design-lint.sh). */
    internal val SPEC_BANNED = Regex(
        "\\b(?:buy|sell|hold|accumulate|overweight|underweight|outperform|undervalued|overvalued|cheap|expensive|" +
            "upside|downside|target|entry|exit|stop|opportunity|attractive|bullish|bearish)\\b",
        RegexOption.IGNORE_CASE,
    )

    /**
     * The lead clause of a paragraph (its first sentence) and the rest, for the Deep Dive lede and the highlighted
     * lead phrase. A paragraph that is one sentence is all lead.
     */
    fun splitLead(text: String): Pair<String, String> {
        val t = text.trim()
        val end = Regex("""[.?](\s+)(?=[A-Z0-9“"(])""").find(t)
        return if (end == null) t to "" else t.substring(0, end.range.first + 1) to t.substring(end.range.last + 1)
    }

    /**
     * A margin in percent. The structured history carries margins as fractions (0.44); the native memo as percents
     * (44.0). A margin of more than 150% is not a margin, so anything up to 1.5 is read as a fraction.
     */
    fun marginPercent(v: Double): Double = if (abs(v) <= 1.5) v * 100.0 else v

    /**
     * Money in whole units for axis ticks and headlines, as the renderer sets them: "$0", "$186", "$1.2K",
     * "$300B", "$2.5B" (no ".00", no trailing zeros after the point).
     */
    fun wholeMoney(v: Double): String {
        if (!v.isFinite()) return Fmt.money(v)
        val r = Math.round(v).toDouble()
        if (abs(r) < 1_000.0) return (if (r < 0) Fmt.MINUS else "") + Fmt.currencyPrefix("USD") + Fmt.number(abs(r), 0)
        return Fmt.money(v).replace(trailingZeros, "$1$2").replace(barePoint, "$1")
    }

    private val trailingZeros = Regex("""(\.\d*?)0+([KMBT])$""")
    private val barePoint = Regex("""\.([KMBT])$""")

    /**
     * A RangeBar figure: whole dollars when the value is whole (ticks and round model values: "$180", "$186"), cents
     * when it is not, so a stored price keeps its precision ("$241.50").
     */
    fun rangeMoney(v: Double): String =
        if (v.isFinite() && abs(v) < 1_000.0 && v != Math.rint(v)) Fmt.money(v) else wholeMoney(v)

    /** A percent axis tick in whole percent: "50%". */
    fun wholePct(v: Double): String = Fmt.pct(v, 0)

    /** "up 8.2%" / "down 300 bps": a signed change in words for generated titles (the sign is dropped). */
    fun moved(positive: Boolean, change: String): String =
        change.trimStart('+', Fmt.MINUS.first()).let { if (positive) DeepDiveCopy.movedUp(it) else DeepDiveCopy.movedDown(it) }

    /** One line of plain text, never a blank string. */
    fun clean(text: String?): String? = text?.replace(Regex("\\s+"), " ")?.trim()?.ifBlank { null }
}

// -------------------------------------------------------------------------------------------------------------
// Five-year view
// -------------------------------------------------------------------------------------------------------------

/**
 * Fiscal years for the five-year chart, oldest first, one value per year (null = a line the payload does not have
 * for that year, never interpolated). Years with no value at all are left out ([trimmed]), so a chart never shows
 * an empty slot under a year label; [consecutive] says whether the years left run without a gap (the sample has
 * FY2020, FY2022, FY2024 and FY2025 only). [source] names where it came from (the chart card's foot).
 */
internal data class FiveYearSeries(
    val years: List<Int>,
    val revenue: List<Double?>,
    val freeCashFlow: List<Double?>,
    val grossMargin: List<Double?> = emptyList(),
    val operatingMargin: List<Double?> = emptyList(),
    val source: String = DeepDiveCopy.incomeStatement,
) {
    val labels: List<String> get() = years.map { Fmt.period(PeriodKind.FY, it) }

    /** True when the years run without a gap (FY2020 to FY2025); false for selected years. */
    val consecutive: Boolean get() = years.zipWithNext().all { (a, b) -> b == a + 1 }

    /** The same series without the years that have no value in any line. */
    fun trimmed(): FiveYearSeries {
        val keep = years.indices.filter { i ->
            listOf(revenue, freeCashFlow, grossMargin, operatingMargin).any { it.getOrNull(i)?.isFinite() == true }
        }
        fun List<Double?>.kept(): List<Double?> = if (isEmpty()) this else keep.map { getOrNull(it) }
        return copy(
            years = keep.map { years[it] },
            revenue = revenue.kept(),
            freeCashFlow = freeCashFlow.kept(),
            grossMargin = grossMargin.kept(),
            operatingMargin = operatingMargin.kept(),
        )
    }
    val hasMargins: Boolean get() = (grossMargin + operatingMargin).any { it != null && it.isFinite() }
    val hasRevenue: Boolean get() = (revenue + freeCashFlow).any { it != null && it.isFinite() }

    /** Change of [values] from the first year that has one to the last, in percent; null with fewer than two. */
    fun growthPct(values: List<Double?>): Pair<Int, Double>? {
        val first = values.indexOfFirst { it != null && it.isFinite() }
        val last = values.indexOfLast { it != null && it.isFinite() }
        if (first < 0 || last <= first) return null
        val a = values[first]!!
        val b = values[last]!!
        if (a <= 0.0) return null
        return years[first] to (b / a - 1.0) * 100.0
    }

    companion object {
        /** Years shown: the latest fiscal year and the five before it. */
        const val SPAN = 6

        /** From the structured report's annual history (fiscal-year rows; quarters are ignored). */
        fun fromHistory(rows: List<FinancialHistoryRowView>): FiveYearSeries? {
            val annual = rows
                .filter { it.fiscalQuarter == null && !it.periodType.equals("quarter", ignoreCase = true) }
                .groupBy { it.fiscalYear }
                .mapValues { (_, v) -> v.last() }
            if (annual.isEmpty()) return null
            val last = annual.keys.max()
            val years = ((last - SPAN + 1)..last).filter { y -> y >= annual.keys.min() }
            val byYear = years.map { annual[it] }
            val series = FiveYearSeries(
                years = years,
                revenue = byYear.map { it?.revenue },
                freeCashFlow = byYear.map { it?.freeCashFlow },
                grossMargin = byYear.map { it?.grossMargin?.let(ClassicFormat::marginPercent) },
                operatingMargin = byYear.map { it?.operatingMargin?.let(ClassicFormat::marginPercent) },
            )
            return series.takeIf { it.hasRevenue || it.hasMargins }?.trimmed()
        }

        /**
         * From `financial_indicators.five_year_trends` (the memo payload of the bundled sample and of reports with a
         * native memo): `current`, `one_year_ago`, `three_years_ago` and `five_years_ago` per indicator, placed on
         * their fiscal years. The two years in between are not in the payload, so they are left out ([trimmed]).
         */
        fun fromIndicatorsJson(indicators: JSONObject?): FiveYearSeries? {
            val trends = indicators?.optJSONArray("five_year_trends") ?: return null
            val latest = ClassicFormat.parsePeriod(indicators.optString("period"))?.year ?: return null
            val years = ((latest - SPAN + 1)..latest).toList()
            val offsets = listOf("current" to 0, "one_year_ago" to 1, "three_years_ago" to 3, "five_years_ago" to 5)
            fun series(id: String): List<Double?> {
                val row = (0 until trends.length()).mapNotNull { trends.optJSONObject(it) }
                    .firstOrNull { it.optString("indicator_id") == id } ?: return List(years.size) { null }
                val values = arrayOfNulls<Double>(years.size)
                offsets.forEach { (key, back) ->
                    val v = if (row.isNull(key)) null else row.optDouble(key).takeIf { it.isFinite() }
                    val i = years.indexOf(latest - back)
                    if (i >= 0) values[i] = v
                }
                return values.toList()
            }
            val result = FiveYearSeries(
                years = years,
                revenue = series("revenue"),
                freeCashFlow = series("free_cash_flow"),
                grossMargin = series("gross_margin"),
                operatingMargin = series("operating_margin"),
                source = DeepDiveCopy.filingSource,
            )
            return result.takeIf { it.hasRevenue || it.hasMargins }?.trimmed()
        }
    }
}

/** The five-year series a report can show: the structured history first, else the one handed in (the sample). */
internal fun DeepDiveReportView.fiveYear(override: FiveYearSeries?): FiveYearSeries? =
    override ?: financialAnalysis?.annualHistory?.let(FiveYearSeries::fromHistory)

// -------------------------------------------------------------------------------------------------------------
// Hero KPIs
// -------------------------------------------------------------------------------------------------------------

/** The lines the hero prefers, in order (the Deep Dive hero: sales, margin, cash, then the rest). */
private val heroOrder = listOf(
    "revenue", "operating margin", "free cash flow", "gross margin", "net income", "cash and equivalents",
)

/**
 * The hero's KpiGrid (5.15 item 2): up to four filing lines, each with its period in the label, the change with its
 * sign and tone, and what it is compared with ("vs FY2024"). Fiscal-year comparisons first, then the year-ago
 * quarter. Without a native memo the structured report's annual history gives the same four lines. An odd count
 * drops its last tile, so the two-column grid has no hole.
 */
internal fun heroKpis(report: DeepDiveReportView, fiveYear: FiveYearSeries?): List<KpiSpec> {
    val deltas = report.filingRead?.metricDeltas.orEmpty()
    val fromFiling = if (deltas.isNotEmpty()) {
        val preferred = listOf(DeltaBasis.Fiscal, DeltaBasis.Year, DeltaBasis.Quarter)
        val basis = preferred.firstOrNull { b -> deltas.any { ClassicFormat.basis(it) == b } }
        val pool = deltas.filter { ClassicFormat.basis(it) == basis }
        heroOrder.mapNotNull { name -> pool.firstOrNull { it.label.equals(name, ignoreCase = true) } }
            .take(4)
            .map { d ->
                val period = ClassicFormat.periodLabel(d.currentPeriod)
                KpiSpec(
                    label = listOfNotNull(d.label, period).joinToString(", "),
                    value = ClassicFormat.value(d.currentValue, d.unit),
                    delta = ClassicFormat.change(d),
                    deltaTone = ClassicFormat.tone(d.direction),
                    reference = ClassicFormat.periodLabel(d.referencePeriod)?.let(DeepDiveCopy::vsPeriod),
                )
            }
    } else {
        emptyList()
    }
    val kpis = fromFiling.ifEmpty { historyKpis(report.financialAnalysis?.annualHistory.orEmpty()) }
    return if (kpis.size % 2 == 1 && kpis.size > 1) kpis.dropLast(1) else kpis
}

private fun historyKpis(rows: List<FinancialHistoryRowView>): List<KpiSpec> {
    val annual = rows.filter { it.fiscalQuarter == null }.sortedBy { it.fiscalYear }
    val cur = annual.lastOrNull() ?: return emptyList()
    val prev = annual.getOrNull(annual.size - 2)?.takeIf { it.fiscalYear == cur.fiscalYear - 1 }
    val period = Fmt.period(PeriodKind.FY, cur.fiscalYear)
    val reference = prev?.let { DeepDiveCopy.vsPeriod(Fmt.period(PeriodKind.FY, it.fiscalYear)) }
    fun money(label: String, now: Double?, before: Double?): KpiSpec? {
        now ?: return null
        val change = if (before != null && before > 0.0) (now / before - 1.0) * 100.0 else null
        return KpiSpec(
            label = "$label, $period",
            value = Fmt.money(now),
            delta = change?.let { Fmt.signedPct(it) },
            deltaTone = Tone.Neutral,
            reference = reference.takeIf { change != null },
        )
    }
    fun margin(label: String, nowRaw: Double?, beforeRaw: Double?): KpiSpec? {
        val now = nowRaw?.let(ClassicFormat::marginPercent) ?: return null
        val before = beforeRaw?.let(ClassicFormat::marginPercent)
        return KpiSpec(
            label = "$label, $period",
            value = Fmt.pct(now, 1),
            delta = before?.let { Fmt.bpsFromPoints(now - it) },
            deltaTone = Tone.Neutral,
            reference = reference.takeIf { before != null },
        )
    }
    return listOfNotNull(
        money(DeepDiveCopy.revenue, cur.revenue, prev?.revenue),
        margin(DeepDiveCopy.operatingMargin, cur.operatingMargin, prev?.operatingMargin),
        money(DeepDiveCopy.freeCashFlow, cur.freeCashFlow, prev?.freeCashFlow),
        money(DeepDiveCopy.netIncome, cur.netIncome, prev?.netIncome),
    ).take(4)
}

// -------------------------------------------------------------------------------------------------------------
// Filing deltas as one table per basis
// -------------------------------------------------------------------------------------------------------------

/** One basis's lines: the period columns and the rows (label, now, before, change, tone). */
internal data class DeltaTable(
    val basis: DeltaBasis,
    val currentPeriod: String,
    val referencePeriod: String,
    val rows: List<FilingMetricDeltaView>,
)

/** The filing deltas grouped by basis, fiscal year first, then on the year, then on the quarter. */
internal fun deltaTables(deltas: List<FilingMetricDeltaView>): List<DeltaTable> {
    val order = listOf(DeltaBasis.Fiscal, DeltaBasis.Year, DeltaBasis.Quarter)
    return order.mapNotNull { b ->
        val rows = deltas.filter { ClassicFormat.basis(it) == b }.distinctBy { it.label.lowercase() }
        val first = rows.firstOrNull() ?: return@mapNotNull null
        DeltaTable(
            basis = b,
            currentPeriod = ClassicFormat.periodLabel(first.currentPeriod).orEmpty(),
            referencePeriod = ClassicFormat.periodLabel(first.referencePeriod).orEmpty(),
            rows = rows,
        )
    }
}

internal fun DeltaBasis.label(): String = when (this) {
    DeltaBasis.Fiscal -> DeepDiveCopy.basisFiscal
    DeltaBasis.Year -> DeepDiveCopy.basisYear
    DeltaBasis.Quarter -> DeepDiveCopy.basisQuarter
}

/**
 * The filing chapter's headline, generated from the data: the first preferred line that moved, "Revenue rose 8.2%
 * in fiscal 2025" style ("Operating margin up 300 bps on the year"); the static title when nothing moved.
 */
internal fun filingHeadline(deltas: List<FilingMetricDeltaView>): String {
    val table = deltaTables(deltas).firstOrNull() ?: return DeepDiveCopy.filingTitle
    val line = heroOrder.firstNotNullOfOrNull { name ->
        table.rows.firstOrNull { it.label.equals(name, ignoreCase = true) && (it.deltaPct ?: 0.0) != 0.0 }
    } ?: table.rows.firstOrNull { (it.deltaPct ?: 0.0) != 0.0 } ?: return DeepDiveCopy.filingTitle
    val change = ClassicFormat.change(line) ?: return DeepDiveCopy.filingTitle
    val basis = when (table.basis) {
        DeltaBasis.Fiscal -> ClassicFormat.periodWords(line.currentPeriod)?.let(DeepDiveCopy::basisInPeriod)
            ?: return DeepDiveCopy.filingTitle
        DeltaBasis.Year -> DeepDiveCopy.basisOnYear
        DeltaBasis.Quarter -> DeepDiveCopy.basisOnQuarter
    }
    return DeepDiveCopy.filingTitleMoved(line.label, ClassicFormat.moved((line.deltaPct ?: 0.0) > 0, change), basis)
}

/** Indicators grouped as the payload groups them, groups in payload order, labels humanised. */
internal fun indicatorGroups(indicators: List<IndicatorView>): List<Pair<String, List<IndicatorView>>> =
    indicators.groupBy { it.group }.map { (group, rows) -> ClassicFormat.humanize(group) to rows }

/**
 * Where a quote added to a note comes from (5.13 "Add to note" format): `> "quote" (Ch. 04 Margins, AAPL 10-K
 * FY2025)`. [filing] is the report's filing label when known.
 */
internal data class QuoteSource(val chapterNumber: Int, val chapterLabel: String, val ticker: String?, val filing: String?)

internal object NoteQuotes {
    /** The quote line, same format (straight ASCII quotes) as the new view's "Add to note" (WP-C ReportQuote). */
    fun format(text: String, source: QuoteSource): String {
        val where = buildString {
            append("Ch. ").append(source.chapterNumber.toString().padStart(2, '0')).append(' ').append(source.chapterLabel)
            val ref = listOfNotNull(source.ticker?.uppercase(), source.filing).joinToString(" ")
            if (ref.isNotBlank()) append(", ").append(ref)
        }
        val quote = text.replace(Regex("\\s+"), " ").trim()
        return "> \"$quote\" ($where)"
    }

    /** Appends [quote] to [draft] after a blank line (or starts the note with it). */
    fun append(draft: String, quote: String): String =
        if (draft.isBlank()) quote else draft.trimEnd() + "\n\n" + quote
}
