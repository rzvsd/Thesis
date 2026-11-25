package com.thesis.mobile.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import com.thesis.mobile.model.CompareNamesState
import com.thesis.mobile.model.FinancialHistoryRowView
import com.thesis.mobile.model.ValueDisciplineView
import com.thesis.mobile.ui.charts.kit.ChartCard
import com.thesis.mobile.ui.charts.kit.ChartSeries
import com.thesis.mobile.ui.charts.kit.LineChart
import com.thesis.mobile.ui.charts.kit.LineChartData
import com.thesis.mobile.ui.charts.kit.SmallMultiple
import com.thesis.mobile.ui.charts.kit.SmallMultiples
import com.thesis.mobile.ui.charts.kit.legendFor
import com.thesis.mobile.ui.components.ActionRow
import com.thesis.mobile.ui.components.CompareColumn
import com.thesis.mobile.ui.components.CompareRow
import com.thesis.mobile.ui.components.CompareTable
import com.thesis.mobile.ui.components.CompareTableModel
import com.thesis.mobile.ui.components.EmptyState
import com.thesis.mobile.ui.components.ErrorState
import com.thesis.mobile.ui.components.LeadingRowDividerInset
import com.thesis.mobile.ui.components.RowGroup
import com.thesis.mobile.ui.components.ScreenHeader
import com.thesis.mobile.ui.components.SegmentedControl
import com.thesis.mobile.ui.components.SkeletonCard
import com.thesis.mobile.ui.components.SourceInfo
import com.thesis.mobile.ui.components.SourceSheet
import com.thesis.mobile.ui.components.TextAction
import com.thesis.mobile.ui.components.ThesisIconButton
import com.thesis.mobile.ui.components.rememberTopBarCollapsed
import com.thesis.mobile.ui.copy.KitCopy
import com.thesis.mobile.ui.copy.ResearchCopy
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.format.LocalFmt
import com.thesis.mobile.ui.format.Missing
import com.thesis.mobile.ui.format.PeriodKind
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.motion.rememberHaptics
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import java.time.Instant
import java.time.ZoneId
import kotlin.math.abs

// ---- Figures from a report's history rows (shared with Compare reports)

/**
 * One figure and, when it is missing, why (2.4): `Not disclosed` (absent from the filing), `n/a` (not meaningful:
 * a margin on no revenue, growth from zero) or `Not computed` (a gap on our side, such as no prior year on record).
 */
@Immutable
internal data class Figure(val value: Double?, val missing: Missing = Missing.NotDisclosed) {
    companion object {
        val NotComputed = Figure(null, Missing.NotComputed)
        val NotMeaningful = Figure(null, Missing.NotMeaningful)
    }
}

/** One company's figures for one fiscal period ([key]), from the report's history rows. Margins in percent. */
@Immutable
internal data class PeriodFigures(
    val key: FilingKey,
    val revenue: Figure,
    val revenueGrowthPct: Figure,
    val grossMarginPct: Figure,
    val operatingMarginPct: Figure,
    val freeCashFlow: Figure,
    val fcfMarginPct: Figure,
    val netCash: Figure,
    val shares: Figure,
    val sharesChangePct: Figure,
    val eps: Figure,
)

/**
 * Margin scale of [rows]: live reports store percent numbers (46.9), some old ones fractions (0.469). Only when
 * every margin is within ±1, and the net margin says so, are they fractions (x100). The renderer's rule
 * (`deep_dive_v2/adapter.ts` marginScale), so the app reads a report the way its page does.
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

private fun FinancialHistoryRowView.key(): FilingKey =
    FilingKey(fiscalYear, if (periodType.equals("quarterly", ignoreCase = true) || periodType.startsWith("q", ignoreCase = true)) fiscalQuarter else null)

/**
 * The figures of [key] in [rows] (each report's own history), or of the latest annual row when [key] is null.
 * Growth and share change compare with the same period a year earlier (the same quarter for a 10-Q).
 */
internal fun figuresFor(rows: List<FinancialHistoryRowView>, key: FilingKey? = null): PeriodFigures? {
    if (rows.isEmpty()) return null
    val row = if (key == null) {
        rows.filter { it.key().annual }.maxByOrNull { it.fiscalYear }
    } else {
        rows.firstOrNull { it.key() == key }
    } ?: return null
    val k = row.key()
    val prior = rows.firstOrNull { it.key() == FilingKey(k.fiscalYear - 1, k.quarter) }
    val scale = marginScale(rows)
    val revenue = row.revenue
    fun ratio(now: Double?, before: Double?): Figure = when {
        now == null -> Figure(null)
        before == null -> Figure.NotComputed
        before <= 0.0 -> Figure.NotMeaningful
        else -> Figure((now / before - 1.0) * 100.0)
    }
    fun share(part: Double?): Figure = when {
        part == null -> Figure(null)
        revenue == null -> Figure(null)
        revenue <= 0.0 -> Figure.NotMeaningful
        else -> Figure(part / revenue * 100.0)
    }
    return PeriodFigures(
        key = k,
        revenue = Figure(revenue),
        revenueGrowthPct = ratio(revenue, prior?.revenue),
        grossMarginPct = Figure(row.grossMargin?.times(scale)),
        operatingMarginPct = Figure(row.operatingMargin?.times(scale)),
        freeCashFlow = Figure(row.freeCashFlow),
        fcfMarginPct = share(row.freeCashFlow),
        netCash = if (row.cashAndEquivalents != null && row.debtTotal != null) {
            Figure(row.cashAndEquivalents - row.debtTotal)
        } else {
            Figure(null)
        },
        shares = Figure(row.sharesOutstanding),
        sharesChangePct = ratio(row.sharesOutstanding, prior?.sharesOutstanding),
        eps = when {
            row.netIncome == null || row.sharesOutstanding == null -> Figure(null)
            row.sharesOutstanding <= 0.0 -> Figure.NotMeaningful
            else -> Figure(row.netIncome / row.sharesOutstanding)
        },
    )
}

// ---- Compare names model

/** The rows of Compare names (5.26), in order. */
enum class NameMetric { Revenue, Growth, Gross, Operating, Fcf, NetCash, Shares, Discipline }

/** A value-discipline score: [met] signals out of [available] (never a rating). */
@Immutable
internal data class DisciplineScore(val met: Int, val available: Int) {
    val ratio: Double? get() = if (available > 0) met.toDouble() / available else null
}

/** One ticker column: its latest annual figures, or none when it has no report yet. */
@Immutable
internal data class CompareNameColumn(
    val ticker: String,
    val company: String?,
    val figures: PeriodFigures?,
    val discipline: DisciplineScore?,
    val reportAt: Instant?,
    val hasReport: Boolean,
    val subject: Boolean,
)

/** Columns for [state] in its ticker order; the first ticker is the subject. */
internal fun compareNameColumns(
    state: CompareNamesState,
    disciplines: Map<String, ValueDisciplineView?>,
): List<CompareNameColumn> = state.tickers.mapIndexed { i, t ->
    val summary = state.summaries[t]
    CompareNameColumn(
        ticker = t,
        company = summary?.companyName,
        figures = summary?.annualHistory?.let { figuresFor(it) },
        discipline = disciplines[t]?.let { DisciplineScore(it.score, it.availableSignals.takeIf { n -> n > 0 } ?: it.maxScore) },
        reportAt = parseInstant(summary?.generatedAt),
        hasReport = summary != null,
        subject = i == 0,
    )
}

/** The value [metric] sorts and medians on (discipline as its ratio). */
internal fun metricValue(column: CompareNameColumn, metric: NameMetric): Double? {
    val f = column.figures
    return when (metric) {
        NameMetric.Revenue -> f?.revenue?.value
        NameMetric.Growth -> f?.revenueGrowthPct?.value
        NameMetric.Gross -> f?.grossMarginPct?.value
        NameMetric.Operating -> f?.operatingMarginPct?.value
        NameMetric.Fcf -> f?.fcfMarginPct?.value
        NameMetric.NetCash -> f?.netCash?.value
        NameMetric.Shares -> f?.sharesChangePct?.value
        NameMetric.Discipline -> column.discipline?.ratio
    }?.takeIf { it.isFinite() }
}

private fun figureOf(column: CompareNameColumn, metric: NameMetric): Figure? {
    val f = column.figures ?: return null
    return when (metric) {
        NameMetric.Revenue -> f.revenue
        NameMetric.Growth -> f.revenueGrowthPct
        NameMetric.Gross -> f.grossMarginPct
        NameMetric.Operating -> f.operatingMarginPct
        NameMetric.Fcf -> f.fcfMarginPct
        NameMetric.NetCash -> f.netCash
        NameMetric.Shares -> f.sharesChangePct
        NameMetric.Discipline -> null
    }
}

internal fun metricLabel(metric: NameMetric): String = when (metric) {
    NameMetric.Revenue -> ResearchCopy.ROW_REVENUE
    NameMetric.Growth -> ResearchCopy.ROW_GROWTH
    NameMetric.Gross -> ResearchCopy.ROW_GROSS
    NameMetric.Operating -> ResearchCopy.ROW_OPERATING
    NameMetric.Fcf -> ResearchCopy.ROW_FCF
    NameMetric.NetCash -> ResearchCopy.ROW_NET_CASH
    NameMetric.Shares -> ResearchCopy.ROW_SHARES
    NameMetric.Discipline -> ResearchCopy.ROW_DISCIPLINE
}

/** A formatted value; one of the three words when missing (never a dash). */
internal fun formatMetric(metric: NameMetric, value: Double?, missing: Missing = Missing.NotDisclosed): String = when (metric) {
    NameMetric.Revenue, NameMetric.NetCash -> Fmt.money(value, missing = missing)
    NameMetric.Growth, NameMetric.Shares -> Fmt.signedPct(value, missing = missing)
    NameMetric.Gross, NameMetric.Operating, NameMetric.Fcf -> Fmt.pct(value, dp = 1, missing = missing)
    NameMetric.Discipline -> if (value == null) Fmt.missing(missing) else Fmt.pct(value * 100.0, dp = 0)
}

private fun cellText(column: CompareNameColumn, metric: NameMetric): String {
    if (!column.hasReport || column.figures == null) return Fmt.NOT_COMPUTED
    if (metric == NameMetric.Discipline) {
        val d = column.discipline ?: return Fmt.NOT_COMPUTED
        return "${d.met} of ${d.available}"
    }
    val fig = figureOf(column, metric) ?: return Fmt.NOT_COMPUTED
    return formatMetric(metric, fig.value?.takeIf { it.isFinite() }, fig.missing)
}

/** The median of [values] (finite only), or null with fewer than two. */
internal fun median(values: List<Double>): Double? {
    val v = values.filter { it.isFinite() }.sorted()
    if (v.size < 2) return null
    val mid = v.size / 2
    return if (v.size % 2 == 1) v[mid] else (v[mid - 1] + v[mid]) / 2.0
}

/** [columns] sorted by [metric], highest first, gaps last; the order is kept for ties and when [metric] is null. */
internal fun sortColumns(columns: List<CompareNameColumn>, metric: NameMetric?): List<CompareNameColumn> {
    if (metric == null) return columns
    return columns.withIndex()
        .sortedWith(compareBy<IndexedValue<CompareNameColumn>> { metricValue(it.value, metric) == null }
            .thenByDescending { metricValue(it.value, metric) ?: 0.0 }
            .thenBy { it.index })
        .map { it.value }
}

/** "FY2025" / "Q3 FY25" for a key. */
internal fun periodLabel(key: FilingKey): String =
    if (key.annual) Fmt.period(PeriodKind.FY, key.fiscalYear) else Fmt.period(PeriodKind.Q, key.fiscalYear, key.quarter)

/** "10-K · built 12 Nov" (the report's date; the payload has no filed date yet). */
private fun filingLine(column: CompareNameColumn, fmt: Fmt, zone: ZoneId): String? {
    if (!column.hasReport) return null
    val form = if (column.figures?.key?.annual != false) ResearchCopy.FORM_10K else ResearchCopy.FORM_10Q
    val at = column.reportAt ?: return form
    return "$form · built ${fmt.shortDate(at.atZone(zone).toLocalDate())}"
}

/**
 * The table (#30) for [columns] (already sorted): one column per ticker (ticker over its fiscal period, then the
 * filing line), one row per [NameMetric], and the peer median per row in the basis column ("Median"; with
 * tickers as columns, the median across them is one value per row).
 */
internal fun compareNamesTable(columns: List<CompareNameColumn>, fmt: Fmt, zone: ZoneId): CompareTableModel =
    CompareTableModel(
        columns = columns.map { c ->
            CompareColumn(
                // Two header lines in one cell until the kit grows a title line (HANDOFF-E, WP-K).
                period = "${c.ticker}\n${c.figures?.key?.let(::periodLabel) ?: ResearchCopy.NO_REPORT_YET}",
                filing = filingLine(c, fmt, zone),
                subject = c.subject,
            )
        },
        rows = NameMetric.entries.map { m ->
            val med = if (m == NameMetric.Discipline) null else median(columns.mapNotNull { metricValue(it, m) })
            CompareRow(
                label = metricLabel(m),
                values = columns.map { cellText(it, m) },
                delta = formatMetric(m, med, Missing.NotMeaningful),
            )
        },
        labelHeader = ResearchCopy.LATEST_FY,
        deltaHeader = ResearchCopy.MEDIAN,
        missingDelta = Fmt.NA,
    )

/**
 * "Copy as table" (5.26): tab-separated, pastes into Excel and Sheets as cells. Header lines: tickers, fiscal
 * periods, filings; then one line per metric with the peer median last.
 */
internal fun compareNamesTsv(columns: List<CompareNameColumn>, fmt: Fmt, zone: ZoneId): String {
    fun cell(s: String?) = s.orEmpty().replace('\t', ' ').replace('\n', ' ').trim()
    val lines = mutableListOf<List<String>>()
    lines += listOf(ResearchCopy.METRIC) + columns.map { it.ticker } + ResearchCopy.MEDIAN
    lines += listOf(ResearchCopy.PERIOD) + columns.map { it.figures?.key?.let(::periodLabel) ?: ResearchCopy.NO_REPORT_YET } + ""
    lines += listOf(ResearchCopy.FILING) + columns.map { cell(filingLine(it, fmt, zone)) } + ""
    val table = compareNamesTable(columns, fmt, zone)
    table.rows.forEach { r -> lines += listOf(r.label) + r.values + r.delta.orEmpty() }
    return lines.joinToString("\n") { line -> line.joinToString("\t") { cell(it) } }
}

/** The screen title as a result: the widest operating margin, else the largest revenue (principle 4). */
internal fun compareNamesHeadline(columns: List<CompareNameColumn>): String? {
    val n = columns.size
    val group = when (n) {
        2 -> "of the two"
        3 -> "of the three"
        4 -> "of the four"
        else -> return null
    }
    columns.filter { metricValue(it, NameMetric.Operating) != null }.takeIf { it.size >= 2 }
        ?.maxByOrNull { metricValue(it, NameMetric.Operating)!! }
        ?.let { return "${it.ticker} has the widest operating margin $group" }
    columns.filter { metricValue(it, NameMetric.Revenue) != null }.takeIf { it.size >= 2 }
        ?.maxByOrNull { metricValue(it, NameMetric.Revenue)!! }
        ?.let { return "${it.ticker} is the largest by revenue $group" }
    return null
}

/** What a tapped cell is and where it comes from (#47). */
internal fun compareNamesSource(column: CompareNameColumn, metric: NameMetric, discipline: ValueDisciplineView?): SourceInfo {
    val period = column.figures?.key?.let(::periodLabel)
    val (definition, derivation) = when (metric) {
        NameMetric.Revenue -> ResearchCopy.DEF_REVENUE to null
        NameMetric.Growth -> ResearchCopy.DEF_GROWTH to ResearchCopy.DERIVE_GROWTH
        NameMetric.Gross -> ResearchCopy.DEF_GROSS to null
        NameMetric.Operating -> ResearchCopy.DEF_OPERATING to null
        NameMetric.Fcf -> ResearchCopy.DEF_FCF to ResearchCopy.DERIVE_FCF
        NameMetric.NetCash -> ResearchCopy.DEF_NET_CASH to ResearchCopy.DERIVE_NET_CASH
        NameMetric.Shares -> ResearchCopy.DEF_SHARES to ResearchCopy.DERIVE_SHARES
        NameMetric.Discipline -> ResearchCopy.DEF_DISCIPLINE to ResearchCopy.DERIVE_DISCIPLINE
    }
    return SourceInfo(
        metric = listOfNotNull("${column.ticker} ${metricLabel(metric).replaceFirstChar { it.lowercase() }}", period).joinToString(", "),
        definition = definition,
        form = if (column.hasReport) ResearchCopy.FORM_10K else null,
        period = period,
        derivation = derivation,
        inputs = if (metric == NameMetric.Discipline) {
            discipline?.signals.orEmpty().map { it.label to (ResearchCopy.humanize(it.status) ?: Fmt.NOT_COMPUTED) }
        } else {
            emptyList()
        },
    )
}

/** Revenue by fiscal year per column for the chart: shared x labels (FY years every column has), oldest first. */
internal fun revenueSeries(
    state: CompareNamesState,
    columns: List<CompareNameColumn>,
): Pair<List<String>, List<ChartSeries>> {
    val byTicker = columns.associate { c ->
        c.ticker to state.summaries[c.ticker]?.annualHistory.orEmpty()
            .filter { FilingKey(it.fiscalYear, null) == it.key() }
            .associate { it.fiscalYear to it.revenue }
    }
    val years = byTicker.values.flatMap { it.keys }.distinct().sorted()
    val series = columns.filter { byTicker[it.ticker].orEmpty().isNotEmpty() }.mapIndexed { i, c ->
        ChartSeries(name = c.ticker, values = years.map { y -> byTicker[c.ticker]?.get(y) }, subject = c.subject, colorIndex = i)
    }
    return years.map { Fmt.period(PeriodKind.FY, it) } to series
}

// ---- Screen

/**
 * Compare names (DESIGN-DIRECTION 5.26), the primary compare: 2 to 4 tickers side by side from the reports the
 * client already has (each name's latest report summary; never builds). One `CompareTable` with tickers as
 * columns, the subject column (the first ticker) in accent: ticker and fiscal period, then the filing line; rows
 * revenue, growth, gross, operating and FCF margins, net cash, share change and value discipline; the peer median
 * in the last column. A tap on a figure opens its source and picks that row; a tap on a column header then sorts
 * the columns by the picked row, highest first. "Show chart": revenue indexed (first common year = 100) or side by
 * side (small multiples). "Copy as table" puts TSV on the clipboard. A ticker with no report says so in its column
 * and offers "Build report" (never builds silently).
 *
 * Draws its own top bar ("Compare" + the tickers); the shell gives it none (HANDOFF-E). Frozen report figures: no
 * motion beyond the push.
 */
@Composable
fun CompareNamesScreen(
    state: CompareNamesState?,
    onBack: () -> Unit,
    padding: PaddingValues = PaddingValues(),
    disciplines: Map<String, ValueDisciplineView?> = emptyMap(),
    onRetry: () -> Unit = {},
    onBuildReport: (ticker: String) -> Unit = {},
    initialSortMetric: NameMetric? = null,
    initialShowChart: Boolean = false,
    initialChartMode: Int = 0,
    zone: ZoneId = ZoneId.systemDefault(),
) {
    val p = LocalThesisPalette.current
    val fmt = LocalFmt.current
    val haptics = rememberHaptics()
    val clipboard = LocalClipboardManager.current
    val scroll = rememberScrollState()
    val collapsed by rememberTopBarCollapsed(scroll)
    var sortMetric by rememberSaveable { mutableStateOf(initialSortMetric) }
    var pickedRow by rememberSaveable { mutableStateOf(initialSortMetric ?: NameMetric.Revenue) }
    var showChart by rememberSaveable { mutableStateOf(initialShowChart) }
    var chartMode by rememberSaveable { mutableStateOf(initialChartMode) }
    var copied by remember { mutableStateOf(false) }
    var source by remember { mutableStateOf<SourceInfo?>(null) }

    val tickers = state?.tickers.orEmpty()
    val subject = tickers.firstOrNull().orEmpty()
    val others = tickers.drop(1)
    val base = remember(state, disciplines) { state?.let { compareNameColumns(it, disciplines) }.orEmpty() }
    val columns = remember(base, sortMetric) { sortColumns(base, sortMetric) }
    val model = remember(columns, fmt, zone) { if (columns.isEmpty()) null else compareNamesTable(columns, fmt, zone) }
    val copy = {
        clipboard.setText(AnnotatedString(compareNamesTsv(columns, fmt, zone)))
        haptics.confirm()
        copied = true
    }

    ResearchBarPage(
        title = ResearchCopy.COMPARE,
        subtitle = ResearchCopy.compareNamesSubtitle(subject, others),
        titleAlwaysVisible = true,
        onBack = onBack,
        padding = padding,
        collapsed = collapsed,
        actions = {
            if (model != null && state?.isLoading == false) {
                ThesisIconButton(ThesisIcons.Copy, contentDescription = ResearchCopy.COPY_TABLE, onClick = copy)
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
            ScreenHeader(
                eyebrow = ResearchCopy.COMPARE_NAMES_EYEBROW,
                title = (if (state?.isLoading == false) compareNamesHeadline(columns) else null)
                    ?: ResearchCopy.compareNamesTitle(subject, others),
                deck = ResearchCopy.COMPARE_NAMES_DECK,
            )
            Spacer(Modifier.height(ThesisSpace.headerToSection))
            when {
                state == null || tickers.size < 2 -> EmptyState(
                    sentence = ResearchCopy.COMPARE_NAMES_TOO_FEW,
                    how = ResearchCopy.COMPARE_NAMES_TOO_FEW_HOW,
                    icon = ThesisIcons.Compare,
                )
                state.isLoading -> {
                    SkeletonCard(bodyLines = 6)
                }
                state.error != null && base.none { it.hasReport } -> ErrorState(
                    title = KitCopy.couldNotLoad(ResearchCopy.COMPARE_NAMES_FAILED),
                    cause = state.error,
                    onRetry = onRetry,
                )
                model != null -> {
                    CompareTable(
                        model = model,
                        onHeaderClick = { sortMetric = pickedRow },
                        onCellClick = { r, c ->
                            val metric = NameMetric.entries[r]
                            pickedRow = metric
                            val col = columns[c]
                            source = compareNamesSource(col, metric, disciplines[col.ticker])
                        },
                    )
                    Spacer(Modifier.height(ThesisSpace.s))
                    Text(
                        sortMetric?.let { ResearchCopy.sortedBy(metricLabel(it)) } ?: ResearchCopy.SORT_HINT,
                        style = ThesisType.caption,
                        color = p.muted,
                    )
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(ThesisSpace.m, Alignment.End),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        if (sortMetric != null) TextAction(ResearchCopy.ORIGINAL_ORDER, onClick = { sortMetric = null })
                        TextAction(
                            if (showChart) ResearchCopy.HIDE_CHART else ResearchCopy.SHOW_CHART,
                            onClick = { showChart = !showChart },
                        )
                        TextAction(if (copied) ResearchCopy.COPIED else ResearchCopy.COPY_TABLE, onClick = copy)
                    }
                    val missing = columns.filter { !it.hasReport }
                    if (missing.isNotEmpty()) {
                        Spacer(Modifier.height(ThesisSpace.m))
                        RowGroup {
                            missing.forEach { c ->
                                row(LeadingRowDividerInset) {
                                    ActionRow(
                                        icon = ThesisIcons.DeepDive,
                                        title = ResearchCopy.buildReportFor(c.ticker),
                                        caption = ResearchCopy.NO_REPORT_CAPTION,
                                        onClick = { onBuildReport(c.ticker) },
                                    )
                                }
                            }
                        }
                    }
                    if (showChart) {
                        Spacer(Modifier.height(ThesisSpace.sectionGapData))
                        RevenueChart(state, columns, chartMode, onMode = { chartMode = it })
                    }
                }
            }
        }
    }
    source?.let { info -> SourceSheet(info = info, onDismissRequest = { source = null }) }
}

/** "Show chart" (5.26): revenue indexed to the first common fiscal year, or side by side on a shared scale. */
@Composable
private fun RevenueChart(state: CompareNamesState, columns: List<CompareNameColumn>, mode: Int, onMode: (Int) -> Unit) {
    val (labels, series) = remember(state, columns) { revenueSeries(state, columns) }
    val leader = remember(series) {
        series.maxByOrNull { s ->
            val first = s.values.firstOrNull { it != null && it > 0.0 }
            val last = s.values.lastOrNull { it != null }
            if (first != null && last != null) last / first else Double.NEGATIVE_INFINITY
        }?.name
    }
    val firstYear = labels.firstOrNull()?.removePrefix("FY")?.toIntOrNull()
    ChartCard(
        title = ResearchCopy.chartTitle(leader, firstYear),
        subtitle = if (mode == 0) ResearchCopy.CHART_INDEXED_SUB else ResearchCopy.CHART_SIDE_SUB,
        source = ResearchCopy.CHART_SOURCE,
        legend = if (mode == 0) legendFor(series) else emptyList(),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
            SegmentedControl(
                options = listOf(ResearchCopy.CHART_INDEXED, ResearchCopy.CHART_SIDE_BY_SIDE),
                selectedIndex = mode,
                onSelect = onMode,
            )
            if (mode == 0) {
                LineChart(
                    data = LineChartData(series = series, xLabels = labels, indexed = true),
                    valueFormat = { Fmt.number(it, 0) },
                    dataKey = columns.map { it.ticker },
                )
            } else {
                SmallMultiples(
                    items = series.map { s -> SmallMultiple(title = s.name, values = s.values, xLabels = labels) },
                    valueFormat = { Fmt.money(it) },
                    dataKey = columns.map { it.ticker },
                )
            }
        }
    }
}
