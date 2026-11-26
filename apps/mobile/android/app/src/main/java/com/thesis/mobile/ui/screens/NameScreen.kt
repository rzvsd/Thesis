package com.thesis.mobile.ui.screens

import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onPlaced
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.layout.positionInParent
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.toggleableState
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.style.TextOverflow
import com.thesis.mobile.model.ConvictionJournalEntryView
import com.thesis.mobile.model.FinancialHistoryRowView
import com.thesis.mobile.model.NameDetailView
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.model.ReportSummaryView
import com.thesis.mobile.ui.charts.kit.Timeline
import com.thesis.mobile.ui.charts.kit.TimelineItem
import com.thesis.mobile.ui.charts.kit.TimelineState
import com.thesis.mobile.ui.components.ActionRow
import com.thesis.mobile.ui.components.Callout
import com.thesis.mobile.ui.components.CompareColumn
import com.thesis.mobile.ui.components.CompareRow
import com.thesis.mobile.ui.components.CompareTable
import com.thesis.mobile.ui.components.CompareTableModel
import com.thesis.mobile.ui.components.DialogAction
import com.thesis.mobile.ui.components.ErrorState
import com.thesis.mobile.ui.components.KpiGrid
import com.thesis.mobile.ui.components.KpiSpec
import com.thesis.mobile.ui.components.LeadingRowDividerInset
import com.thesis.mobile.ui.components.LiveDot
import com.thesis.mobile.ui.components.NoteBlock
import com.thesis.mobile.ui.components.NoteEntry
import com.thesis.mobile.ui.components.NoteMark
import com.thesis.mobile.ui.components.NotesTrail
import com.thesis.mobile.ui.components.PrimaryButton
import com.thesis.mobile.ui.components.ReportChange
import com.thesis.mobile.ui.components.RowPosition
import com.thesis.mobile.ui.components.ScreenHeader
import com.thesis.mobile.ui.components.SecondaryButton
import com.thesis.mobile.ui.components.SectionHeader
import com.thesis.mobile.ui.components.SheetActionRow
import com.thesis.mobile.ui.components.SinceLastReport
import com.thesis.mobile.ui.components.SinceLastReportModel
import com.thesis.mobile.ui.components.SkeletonCard
import com.thesis.mobile.ui.components.SkeletonKpiGrid
import com.thesis.mobile.ui.components.SourceInfo
import com.thesis.mobile.ui.components.SourceLink
import com.thesis.mobile.ui.components.SourceSheet
import com.thesis.mobile.ui.components.StatusBadge
import com.thesis.mobile.ui.components.TextAction
import com.thesis.mobile.ui.components.ThesisCard
import com.thesis.mobile.ui.components.ThesisCheckbox
import com.thesis.mobile.ui.components.ThesisDialog
import com.thesis.mobile.ui.components.ThesisIconButton
import com.thesis.mobile.ui.components.ThesisSheet
import com.thesis.mobile.ui.components.ThesisTopBar
import com.thesis.mobile.ui.components.rememberNoteAutosave
import com.thesis.mobile.ui.components.rememberTopBarCollapsed
import com.thesis.mobile.ui.components.rowGroupSegment
import com.thesis.mobile.ui.copy.NamesCopy
import com.thesis.mobile.ui.copy.ResearchCopy
import com.thesis.mobile.ui.copy.ScoreCopy
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.format.LocalFmt
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.motion.rememberHaptics
import com.thesis.mobile.ui.motion.thesisPress
import com.thesis.mobile.ui.shell.exceptTop
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone
import com.thesis.mobile.ui.theme.thesisStateTone
import java.time.Instant
import java.time.ZoneId
import kotlin.math.abs
import kotlin.math.roundToInt
import kotlinx.coroutines.launch

/*
 * Name (docs/app-redesign/DESIGN-DIRECTION.md 5.11): the one ticker screen every ticker links to. On paper, no
 * HeroBand. Header with state and the monitor KPIs, Since the last report, From the filings, the Report card (Open
 * when a report is stored, Build only when none is), Your notes, Earnings, Conviction journal, Reports.
 * The pure helpers come first so the unit tests cover them without Compose.
 */

// =====================================================================================================================
// Pure model
// =====================================================================================================================

/** One report in the notes trail, newest first: the report's filing, its date, your note on it and its verdict. */
@Immutable
data class NameNote(
    val reportId: String,
    val filing: String?,
    val atMs: Long?,
    val text: String,
    val verdict: String?,
)

/** Deep Dives of [ticker] in the job history: other report kinds and reports without a ticker are not this name's. */
fun deepDivesOf(reports: List<ReportHistoryItem>, ticker: String): List<ReportHistoryItem> =
    reports.filter {
        it.type.trim().equals(DEEP_DIVE_TYPE, ignoreCase = true) &&
            it.ticker?.trim()?.equals(ticker.trim(), ignoreCase = true) == true &&
            it.reportId.isNotBlank()
    }

private const val DEEP_DIVE_TYPE = "deep_dive"

/**
 * The report the Name screen treats as current: the cached summary's, else the snapshot's, else the newest opened,
 * else the newest report a note of yours is on (a stored report missing from the job history still opens, never
 * builds).
 */
fun currentReportId(detail: NameDetailView): String? {
    val ticker = detail.ticker.trim()
    return detail.summary?.reportId?.ifBlank { null }
        ?: detail.snapshot?.reportId?.trim()?.ifBlank { null }
        ?: deepDivesOf(detail.reports, ticker)
            .maxByOrNull { parseMs(it.createdAt) ?: 0L }?.reportId?.ifBlank { null }
        ?: detail.notesTrail
            .filter { it.reportId.isNotBlank() && (it.ticker == null || it.ticker.trim().equals(ticker, ignoreCase = true)) }
            .maxByOrNull { parseMs(it.updatedAt) ?: 0L }?.reportId
}

/**
 * The kind of filing a period names, for like-for-like report comparison (5.18): "annual" for "FY2026", "quarterly"
 * for "Q3 FY25"; null when the period does not say (then any pair is allowed: ReportHistoryItem has no filing form).
 */
internal fun filingKindOf(period: String?): String? {
    val p = period?.trim()?.uppercase()?.ifBlank { null } ?: return null
    return when {
        Regex("""\bQ[1-4]\b""").containsMatchIn(p) -> "quarterly"
        p.startsWith("FY") || p.contains("10-K") -> "annual"
        else -> null
    }
}

/**
 * True when reports of [a] and [b] filing kinds may be compared: same kind, or either one unknown. Named apart from
 * WP-E's `likeForLike(FilingKey, FilingKey)` so the two never form an overload set (HANDOFF-B: consolidate).
 */
internal fun sameReportKind(a: String?, b: String?): Boolean = a == null || b == null || a == b

/**
 * Every report of the ticker with your note on it (5.11 item 6), newest first: the current report heads the list,
 * then by report date (newest first, undated last, then by id so the order is stable). Reports without a note
 * appear with an empty text, so the newest report always has its editor and older notes can be carried forward.
 */
fun nameNotes(detail: NameDetailView): List<NameNote> {
    val ticker = detail.ticker.trim().uppercase()
    val current = currentReportId(detail)
    val summary = detail.summary
    val notes = detail.notesTrail.filter { it.ticker == null || it.ticker.trim().uppercase() == ticker }
    val reports = deepDivesOf(detail.reports, ticker)
    val ids = LinkedHashSet<String>().apply {
        current?.let(::add)
        reports.forEach { add(it.reportId) }
        notes.forEach { add(it.reportId) }
    }.filter { it.isNotBlank() }
    val merged = ids.map { id ->
        val note = notes.firstOrNull { it.reportId == id }
        val report = reports.firstOrNull { it.reportId == id }
        val fromSummary = summary?.takeIf { it.reportId == id }
        NameNote(
            reportId = id,
            filing = note?.filingPeriod?.ifBlank { null } ?: fromSummary?.filingPeriod?.ifBlank { null },
            atMs = parseMs(report?.createdAt) ?: parseMs(fromSummary?.generatedAt) ?: parseMs(note?.updatedAt),
            text = note?.text.orEmpty(),
            verdict = note?.verdict?.ifBlank { null } ?: fromSummary?.verdict?.ifBlank { null },
        )
    }
    val head = merged.filter { it.reportId == current }
    val rest = merged.filter { it.reportId != current }
        .sortedWith(compareByDescending<NameNote> { it.atMs ?: Long.MIN_VALUE }.thenBy { it.reportId })
    return head + rest
}

/** What the Report card offers (5.11 item 5; SPEC rule 1, one shared report per filing). */
sealed interface NameReportAction {
    /** A report is stored: open it. There is no re-run. */
    data class Open(val reportId: String) : NameReportAction

    /** No report exists for this name yet: the first request builds it. */
    data object Build : NameReportAction
}

fun nameReportAction(detail: NameDetailView): NameReportAction =
    currentReportId(detail)?.let { NameReportAction.Open(it) } ?: NameReportAction.Build

/**
 * The From the filings figures (5.11 item 4): the latest annual row against the one before. [operatingMargin] and
 * [priorOperatingMargin] are percents (32.0 = 32%), normalised once per report by [marginScale] ([marginScale] is
 * the factor for the rows in [annual]: live reports store percents, some old ones fractions). Growth, FCF margin
 * and share change are fractions (0.10 = 10%), computed here from the filing's amounts. Null means the filing did
 * not give the input.
 */
@Immutable
data class FilingsFigures(
    val period: String,
    val priorPeriod: String?,
    val revenue: Double?,
    val priorRevenue: Double?,
    val growth: Double?,
    val operatingMargin: Double?,
    val priorOperatingMargin: Double?,
    val fcfMargin: Double?,
    val priorFcfMargin: Double?,
    val netCash: Double?,
    val priorNetCash: Double?,
    val shareChange: Double?,
    val shares: Double?,
    val priorShares: Double?,
    val annual: List<FinancialHistoryRowView>,
    val marginScale: Double = 1.0,
) {
    /** A history row's gross or operating margin in percent, on this report's scale. */
    fun marginPct(raw: Double?): Double? = raw?.takeIf { it.isFinite() }?.times(marginScale)
}

private fun FinancialHistoryRowView.isAnnual(): Boolean =
    fiscalQuarter == null && !periodType.trim().lowercase().let { it.startsWith("q") || it == "quarterly" || it == "ttm" }

/** "FY2025" whether the payload writes "2025-FY" (live reports) or "FY2025". */
private fun FinancialHistoryRowView.fiscalLabel(): String = periodDisplay(period) ?: "FY$fiscalYear"

private fun ratio(part: Double?, whole: Double?): Double? =
    if (part == null || whole == null || whole == 0.0) null else part / whole

private fun change(now: Double?, before: Double?): Double? =
    if (now == null || before == null || before == 0.0) null else now / before - 1.0

private fun FinancialHistoryRowView.netCash(): Double? =
    if (cashAndEquivalents == null || debtTotal == null) null else cashAndEquivalents - debtTotal

fun filingsFigures(history: List<FinancialHistoryRowView>): FilingsFigures? {
    val annual = history.filter { it.isAnnual() }.sortedBy { it.fiscalYear }.takeLast(5)
    val latest = annual.lastOrNull() ?: return null
    val prior = annual.dropLast(1).lastOrNull()
    val scale = marginScale(history)
    return FilingsFigures(
        period = latest.fiscalLabel(),
        priorPeriod = prior?.fiscalLabel(),
        revenue = latest.revenue,
        priorRevenue = prior?.revenue,
        growth = change(latest.revenue, prior?.revenue),
        operatingMargin = latest.operatingMargin?.takeIf { it.isFinite() }?.times(scale),
        priorOperatingMargin = prior?.operatingMargin?.takeIf { it.isFinite() }?.times(scale),
        fcfMargin = ratio(latest.freeCashFlow, latest.revenue),
        priorFcfMargin = prior?.let { ratio(it.freeCashFlow, it.revenue) },
        netCash = latest.netCash(),
        priorNetCash = prior?.netCash(),
        shareChange = change(latest.sharesOutstanding, prior?.sharesOutstanding),
        shares = latest.sharesOutstanding,
        priorShares = prior?.sharesOutstanding,
        annual = annual,
        marginScale = scale,
    )
}

/** A margin change in basis points from two percents: 31.0 → 32.0 is "+100 bps". */
private fun marginDelta(now: Double?, before: Double?): Pair<String?, Tone> {
    if (now == null || before == null) return null to Tone.Neutral
    val points = now - before
    val tone = when {
        abs(points) < 0.005 -> Tone.Neutral
        points > 0 -> Tone.Favourable
        else -> Tone.Unfavourable
    }
    return Fmt.bpsFromPoints(points) to tone
}

/** The six tiles of From the filings, in the spec's order; each names its period through the label or reference. */
fun filingsKpis(f: FilingsFigures): List<KpiSpec> {
    val vs = f.priorPeriod?.let { NamesCopy.vs(it) }
    val growthTone = when {
        f.growth == null || abs(f.growth) < 0.0005 -> Tone.Neutral
        f.growth > 0 -> Tone.Favourable
        else -> Tone.Unfavourable
    }
    val (opDelta, opTone) = marginDelta(f.operatingMargin, f.priorOperatingMargin)
    val (fcfDelta, fcfTone) = marginDelta(f.fcfMargin?.times(100.0), f.priorFcfMargin?.times(100.0))
    return listOf(
        KpiSpec(
            label = NamesCopy.labelFor(NamesCopy.LABEL_REVENUE, f.period),
            value = Fmt.money(f.revenue),
            reference = if (f.priorPeriod != null && f.priorRevenue != null) NamesCopy.priorValue(Fmt.money(f.priorRevenue), f.priorPeriod) else null,
        ),
        KpiSpec(
            label = NamesCopy.labelFor(NamesCopy.LABEL_GROWTH, f.period),
            value = if (f.growth == null) Fmt.NOT_COMPUTED else Fmt.signedPct(f.growth * 100.0),
            deltaTone = growthTone,
            reference = vs,
        ),
        KpiSpec(
            label = NamesCopy.labelFor(NamesCopy.LABEL_OPERATING, f.period),
            value = Fmt.pct(f.operatingMargin),
            delta = opDelta,
            deltaTone = opTone,
            reference = vs,
        ),
        KpiSpec(
            label = NamesCopy.labelFor(NamesCopy.LABEL_FCF, f.period),
            value = if (f.fcfMargin == null) Fmt.NOT_DISCLOSED else Fmt.pct(f.fcfMargin * 100.0),
            delta = fcfDelta,
            deltaTone = fcfTone,
            reference = vs,
        ),
        netCashKpi(f),
        KpiSpec(
            label = NamesCopy.labelFor(NamesCopy.LABEL_SHARES, f.period),
            value = if (f.shareChange == null) Fmt.NOT_COMPUTED else Fmt.signedPct(f.shareChange * 100.0),
            reference = vs,
        ),
    )
}

/**
 * Net cash, or Net debt when debt exceeds cash: a finance reader calls a negative net cash net debt and reads it as a
 * positive amount ("Net debt, FY2026 $33.2B, vs $43.3B in FY2025"). A prior year on the other side of zero is named.
 */
internal fun netCashKpi(f: FilingsFigures): KpiSpec {
    val debt = f.netCash != null && f.netCash < 0
    val prior = f.priorNetCash
    val reference = if (f.priorPeriod != null && prior != null) {
        val priorDebt = prior < 0
        val amount = Fmt.money(abs(prior))
        when {
            f.netCash == null || priorDebt == debt -> NamesCopy.priorValue(amount, f.priorPeriod)
            priorDebt -> NamesCopy.priorValue("${NamesCopy.LABEL_NET_DEBT.lowercase()} of $amount", f.priorPeriod)
            else -> NamesCopy.priorValue("${NamesCopy.LABEL_NET_CASH.lowercase()} of $amount", f.priorPeriod)
        }
    } else {
        null
    }
    return KpiSpec(
        label = NamesCopy.labelFor(if (debt) NamesCopy.LABEL_NET_DEBT else NamesCopy.LABEL_NET_CASH, f.period),
        value = Fmt.money(f.netCash?.let { abs(it) }),
        reference = reference,
    )
}

/** The SourceSheet behind each filings tile, in [filingsKpis] order. */
fun filingsSource(
    f: FilingsFigures,
    index: Int,
    /** Opens the report the figures were read from: the sheet ends on "Open the FY2025 report" (#47). */
    onOpenReport: (() -> Unit)? = null,
): SourceInfo {
    val prior = f.priorPeriod
    fun pair(label: String, period: String?, value: String): Pair<String, String>? =
        period?.let { "$label, $it" to value }
    val (metric, definition, derivation, inputs) = when (index) {
        0 -> Quad(
            NamesCopy.LABEL_REVENUE, ScoreCopy.REVENUE_DEFINITION, null,
            listOfNotNull(pair(NamesCopy.LABEL_REVENUE, f.period, Fmt.money(f.revenue)), pair(NamesCopy.LABEL_REVENUE, prior, Fmt.money(f.priorRevenue))),
        )
        1 -> Quad(
            NamesCopy.LABEL_GROWTH, ScoreCopy.GROWTH_DEFINITION, ScoreCopy.GROWTH_DERIVATION,
            listOfNotNull(pair(NamesCopy.LABEL_REVENUE, f.period, Fmt.money(f.revenue)), pair(NamesCopy.LABEL_REVENUE, prior, Fmt.money(f.priorRevenue))),
        )
        2 -> Quad(
            NamesCopy.LABEL_OPERATING, ScoreCopy.OPERATING_DEFINITION, ScoreCopy.OPERATING_DERIVATION,
            listOfNotNull(
                pair(NamesCopy.LABEL_OPERATING, f.period, Fmt.pct(f.operatingMargin)),
                pair(NamesCopy.LABEL_OPERATING, prior, Fmt.pct(f.priorOperatingMargin)),
            ),
        )
        3 -> Quad(
            NamesCopy.LABEL_FCF, ScoreCopy.FCF_DEFINITION, ScoreCopy.FCF_DERIVATION,
            listOfNotNull(
                pair(NamesCopy.LABEL_FCF_ABS, f.period, Fmt.money(f.annual.lastOrNull()?.freeCashFlow)),
                pair(NamesCopy.LABEL_REVENUE, f.period, Fmt.money(f.revenue)),
            ),
        )
        4 -> Quad(
            if (f.netCash != null && f.netCash < 0) NamesCopy.LABEL_NET_DEBT else NamesCopy.LABEL_NET_CASH,
            if (f.netCash != null && f.netCash < 0) ScoreCopy.NET_DEBT_DEFINITION else ScoreCopy.NET_CASH_DEFINITION,
            if (f.netCash != null && f.netCash < 0) ScoreCopy.NET_DEBT_DERIVATION else ScoreCopy.NET_CASH_DERIVATION,
            listOfNotNull(
                pair(NamesCopy.LABEL_CASH, f.period, Fmt.money(f.annual.lastOrNull()?.cashAndEquivalents)),
                pair(NamesCopy.LABEL_DEBT, f.period, Fmt.money(f.annual.lastOrNull()?.debtTotal)),
            ),
        )
        else -> Quad(
            NamesCopy.LABEL_SHARES, ScoreCopy.SHARES_DEFINITION, ScoreCopy.SHARES_DERIVATION,
            listOfNotNull(
                pair(NamesCopy.LABEL_SHARES_ABS, f.period, Fmt.number(f.shares, 0)),
                pair(NamesCopy.LABEL_SHARES_ABS, prior, Fmt.number(f.priorShares, 0)),
            ),
        )
    }
    return SourceInfo(
        metric = metric,
        definition = definition,
        form = ScoreCopy.SOURCE_FORM,
        period = f.period,
        derivation = derivation,
        inputs = inputs,
        evidence = listOfNotNull(onOpenReport?.let { SourceLink(ScoreCopy.openSourceReport(period = f.period), it, external = false) }),
    )
}

/** CompareTable's column limit. */
const val TABLE_YEARS = 4

private data class Quad(val a: String, val b: String, val c: String?, val d: List<Pair<String, String>>)

/**
 * The annual rows as a CompareTable (5.11 item 4), newest year first: the latest year is the subject column and sits
 * next to the labels, so it is in view at 360 dp without a sideways scroll. The kit's CompareTable takes at most
 * [TABLE_YEARS] value columns, so the table shows the latest four years (HANDOFF-B: five).
 */
fun filingsTable(f: FilingsFigures): CompareTableModel {
    val years = f.annual.takeLast(TABLE_YEARS).reversed()
    fun row(label: String, value: (FinancialHistoryRowView) -> String) = CompareRow(label, years.map(value))
    return CompareTableModel(
        columns = years.mapIndexed { i, y -> CompareColumn(y.fiscalLabel(), subject = i == 0) },
        rows = listOf(
            row(NamesCopy.LABEL_REVENUE) { Fmt.money(it.revenue) },
            row(NamesCopy.LABEL_GROSS) { Fmt.pct(f.marginPct(it.grossMargin)) },
            row(NamesCopy.LABEL_OPERATING) { Fmt.pct(f.marginPct(it.operatingMargin)) },
            row(NamesCopy.LABEL_NET_INCOME) { Fmt.money(it.netIncome) },
            row(NamesCopy.LABEL_FCF_ABS) { Fmt.money(it.freeCashFlow) },
            row(NamesCopy.LABEL_FCF) { r -> ratio(r.freeCashFlow, r.revenue)?.let { Fmt.pct(it * 100.0) } ?: Fmt.NOT_DISCLOSED },
            // Across years the sign can change, so the row keeps one signed line: below zero is net debt.
            row(NamesCopy.LABEL_NET_CASH_SIGNED) { Fmt.money(it.netCash()) },
            row(NamesCopy.LABEL_SHARES_ABS) { compactShares(it.sharesOutstanding) },
        ),
        labelHeader = NamesCopy.TABLE_METRIC,
    )
}

/**
 * "Copy figures as table" (principle 13): the years of [filingsTable], newest first, as tab-separated plain numbers
 * that Excel and Sheets read as numbers, the way Compare names and Compare reports copy theirs: ASCII minus, no
 * grouping, the unit in the row label ("Revenue (USD bn)"), an empty cell when the filing did not give the value.
 */
fun filingsTsv(f: FilingsFigures): String {
    val years = f.annual.takeLast(TABLE_YEARS).reversed()
    fun line(label: String, unit: String, dp: Int, value: (FinancialHistoryRowView) -> Double?) =
        listOf(ResearchCopy.withUnit(label, unit)) + years.map { rawCell(value(it), dp) }
    val lines = listOf(
        listOf(NamesCopy.TABLE_METRIC) + years.map { it.fiscalLabel() },
        line(NamesCopy.LABEL_REVENUE, ResearchCopy.UNIT_USD_BN, 2) { it.revenue?.div(1e9) },
        line(NamesCopy.LABEL_GROSS, ResearchCopy.UNIT_PCT, 1) { f.marginPct(it.grossMargin) },
        line(NamesCopy.LABEL_OPERATING, ResearchCopy.UNIT_PCT, 1) { f.marginPct(it.operatingMargin) },
        line(NamesCopy.LABEL_NET_INCOME, ResearchCopy.UNIT_USD_BN, 2) { it.netIncome?.div(1e9) },
        line(NamesCopy.LABEL_FCF_ABS, ResearchCopy.UNIT_USD_BN, 2) { it.freeCashFlow?.div(1e9) },
        line(NamesCopy.LABEL_FCF, ResearchCopy.UNIT_PCT, 1) { r -> ratio(r.freeCashFlow, r.revenue)?.times(100.0) },
        line(NamesCopy.LABEL_NET_CASH_SIGNED, ResearchCopy.UNIT_USD_BN, 2) { it.netCash()?.div(1e9) },
        line(NamesCopy.LABEL_SHARES_ABS, ResearchCopy.UNIT_MILLIONS, 1) { it.sharesOutstanding?.div(1e6) },
    )
    return lines.joinToString("\n") { l -> l.joinToString("\t") { it.replace('\t', ' ').replace('\n', ' ').trim() } }
}

/**
 * A share count in the table's compact scale, beside compact money: "15.55B", "742.3M"; under a million in full.
 * (Fmt has no plain compact count; HANDOFF-B asks WP-K for one, and WP-INT to fold WP-E's `compactCount` into it.)
 */
internal fun compactShares(v: Double?): String {
    if (v == null || v.isNaN()) return Fmt.NOT_DISCLOSED
    val a = abs(v)
    return when {
        a >= 1e9 -> Fmt.number(v / 1e9, 2) + "B"
        a >= 1e6 -> Fmt.number(v / 1e6, 1) + "M"
        else -> Fmt.number(v, 0)
    }
}

/** Direction words for a top change; the mark is ▲ for up and ▼ for down, nothing for mixed or watch. */
private fun directionOf(raw: String): Pair<String, Boolean?> = when (raw.trim().lowercase()) {
    "up", "improved", "positive" -> NamesCopy.CHANGE_UP to true
    "down", "weakened", "negative" -> NamesCopy.CHANGE_DOWN to false
    "mixed" -> NamesCopy.CHANGE_MIXED to null
    else -> NamesCopy.CHANGE_WATCH to null
}

/**
 * The server compares a new Deep Dive with the latest stored Deep Dive of the ticker built in the 120 days before
 * it, of any filing kind (`apps/dexter-worker/src/historical-context.ts`, `comparable-latest?lookback_days=120`).
 */
internal const val COMPARABLE_LOOKBACK_DAYS = 120L

/**
 * The report of yours that the change summary most likely compared against, or null when that cannot be said: the
 * newest earlier report in [notes] (newest first) with a known filing period, and only when it falls inside the
 * server's comparison window before the current report. The summary does not name its comparable report
 * (HANDOFF-B asks WP-INT to carry it), so outside the window, or without a period, nothing is dated: a filing line
 * never names another report's period or date.
 */
internal fun comparedReport(summary: ReportSummaryView, notes: List<NameNote>): NameNote? {
    val currentAt = parseMs(summary.generatedAt) ?: return null
    val earlier = notes
        .filter { it.reportId != summary.reportId && it.atMs != null && it.atMs < currentAt }
        .maxByOrNull { it.atMs ?: Long.MIN_VALUE }
        ?: return null
    val withinWindow = currentAt - (earlier.atMs ?: return null) <= COMPARABLE_LOOKBACK_DAYS * 86_400_000L
    return earlier.takeIf { withinWindow && it.filing != null }
}

/**
 * Since the last report (5.11 item 3) from the report's change summary: the previous view over the current one,
 * each with its filing line, and up to three changes. Null when the report has no comparison yet (first report),
 * which SinceLastReport shows as its caption. The previous line names a report of yours only through
 * [comparedReport]; otherwise it reads "Previous report". The drift badge waits for `thesisDrift` on
 * ReportSummaryView (HANDOFF).
 */
fun sinceLastReportModel(summary: ReportSummaryView?, notes: List<NameNote>, fmt: Fmt, zone: ZoneId): SinceLastReportModel? {
    val change = summary?.changeSummary ?: return null
    fun line(filing: String?, atMs: Long?): String = listOfNotNull(
        filing,
        atMs?.let { fmt.shortDate(Instant.ofEpochMilli(it).atZone(zone).toLocalDate()) },
    ).joinToString(" · ").ifBlank { NamesCopy.PREVIOUS_REPORT }
    val currentAt = parseMs(summary.generatedAt)
    val previous = comparedReport(summary, notes)
    return SinceLastReportModel(
        previousView = change.previousView,
        previousFiling = if (previous == null) NamesCopy.PREVIOUS_REPORT else line(previous.filing, previous.atMs),
        currentView = change.currentView,
        currentFiling = line(summary.filingPeriod, currentAt),
        changes = change.topChanges.take(3).map { c ->
            val (label, up) = directionOf(c.direction)
            ReportChange(title = c.title, directionLabel = label, up = up, tone = Tone.Neutral, whyItMatters = c.whyItMatters.ifBlank { null })
        },
    )
}

/** Where this name sits in the Names board order (4.5 pager): 1-based position and the count. */
@Immutable
data class NamePager(val position: Int, val count: Int)

/** The pager for [ticker] in a board [order] (from [namesBoardOrder]); null when it is not on the board. */
fun namePagerOf(order: List<String>, ticker: String): NamePager? {
    val i = order.indexOfFirst { it.equals(ticker, ignoreCase = true) }
    return if (i < 0 || order.size < 2) null else NamePager(i + 1, order.size)
}

/** The neighbours of [ticker] in [order]: previous and next, null at either end. */
fun nameNeighbours(order: List<String>, ticker: String): Pair<String?, String?> {
    val i = order.indexOfFirst { it.equals(ticker, ignoreCase = true) }
    if (i < 0) return null to null
    return order.getOrNull(i - 1) to order.getOrNull(i + 1)
}

// =====================================================================================================================
// Screen
// =====================================================================================================================

/**
 * Name (5.11). [detail] null while the first load runs. Everything after [following] has a default, so WP-INT
 * wires it to `Destination.Name` without changing this signature (HANDOFF-B). The Report card never builds when a
 * report is stored: [onBuildReport] runs only from the no-report state. [now] is for renders and tests (the app
 * leaves it null; the screen reads the clock when the detail changes). [warRoomLive] marks the Earnings row with the LiveDot while the
 * War Room is in its Live phase (5.11 item 7; WP-INT wires it from the War Room state). [focusNote] opens the screen
 * with the newest note focused (Write a note on the board, a Notes-view row): the editor takes focus once the notes
 * trail has arrived, which scrolls it into view. [onSaveNote] reports false until WP-INT wires the real save, so
 * the note never says Saved when nothing was stored. [onCompareWith] null hides "Compare with…" until it is wired.
 * [onShowMessage] shows a short confirmation (WP-INT: the shell snackbar), for "Copy figures as table" in the
 * overflow sheet, which closes as it copies; the in-section copy action confirms in place.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NameScreen(
    padding: PaddingValues,
    ticker: String,
    detail: NameDetailView?,
    following: Boolean,
    error: String? = null,
    companyName: String? = null,
    lastVisitAtMs: Long = 0L,
    warRoomId: String? = null,
    isPro: Boolean = false,
    journal: List<ConvictionJournalEntryView> = emptyList(),
    pager: NamePager? = null,
    now: Instant? = null,
    warRoomLive: Boolean = false,
    focusNote: Boolean = false,
    onRetry: () -> Unit = {},
    onFollowChange: (Boolean) -> Unit = {},
    onOpenReport: (reportId: String) -> Unit = {},
    onOpenReportChange: (reportId: String, change: Int) -> Unit = { id, _ -> onOpenReport(id) },
    onBuildReport: () -> Unit = {},
    onSaveNote: suspend (reportId: String, text: String) -> Boolean = { _, _ -> false },
    onLeaveNote: (reportId: String, text: String) -> Unit = { _, _ -> },
    onShareNote: ((String) -> Unit)? = null,
    onOpenWarRoom: (String) -> Unit = {},
    onSeeAlerts: (() -> Unit)? = null,
    onSeePro: () -> Unit = {},
    onCompareWith: (() -> Unit)? = null,
    onCompareReports: (String, String) -> Unit = { _, _ -> },
    onPrevious: (() -> Unit)? = null,
    onNext: (() -> Unit)? = null,
    onShowMessage: ((String) -> Unit)? = null,
    /** The bar's back arrow (the shell's pop). Null shows the brand instead (renders of the page alone). */
    onBack: (() -> Unit)? = null,
    /** Where the page opens: scrolled to a section once the detail has loaded (no focus, no keyboard). */
    scrollTo: NameAnchor? = null,
) {
    val seed = LocalNameSeed.current
    val haptics = rememberHaptics()
    val clipboard = LocalClipboardManager.current
    val symbol = ticker.trim().uppercase()

    var source by remember { mutableStateOf(seed.source) }
    var moreOpen by rememberSaveable { mutableStateOf(seed.moreOpen) }
    var confirmRemove by rememberSaveable { mutableStateOf(seed.confirmRemove) }
    var showYears by rememberSaveable { mutableStateOf(seed.showYears) }
    // "Copied as a table" confirms the last copy of these figures: it resets when the table hides or the figures
    // change (another report, another name).
    var copied by remember(detail?.summary?.annualHistory) { mutableStateOf(false) }

    val notes = remember(detail) { detail?.let(::nameNotes).orEmpty() }
    val figures = remember(detail?.summary) { detail?.summary?.annualHistory?.let(::filingsFigures) }
    val title = companyName?.trim()?.ifBlank { null }
        ?: detail?.summary?.companyName?.trim()?.ifBlank { null }
        ?: symbol
    val loading = detail == null && error == null
    val clock = rememberNow(now, detail)

    val swipe = rememberPagerSwipe(symbol, onPrevious, onNext)

    val scroll = rememberScrollState()
    val collapsed by rememberTopBarCollapsed(scroll)
    val density = LocalDensity.current
    var barPx by remember { mutableIntStateOf(0) }
    val barH = with(density) { barPx.toDp() }
    // The anchor's position in the page (px from the content's top), reported by its section once placed. The page
    // scrolls there once, when the detail has loaded, so the section sits right under the bar.
    val anchorY = remember { mutableStateMapOf<NameAnchor, Int>() }
    var anchored by rememberSaveable(scrollTo) { mutableStateOf(false) }
    val target = scrollTo?.let { anchorY[it] }
    val reducedScroll = LocalReducedMotion.current
    LaunchedEffect(scrollTo, target, detail?.isLoading) {
        if (!anchored && target != null && detail != null && !detail.isLoading) {
            anchored = true
            if (reducedScroll) scroll.scrollTo(target) else scroll.animateScrollTo(target)
        }
    }

    Box(
        Modifier
            .fillMaxSize()
            .padding(padding.exceptTop()),
    ) {
        Column(
            Modifier
                .fillMaxSize()
                .then(swipe)
                .verticalScroll(scroll)
                .wrapDataWidth()
                .padding(horizontal = ThesisSpace.gutter)
                .padding(top = barH + ThesisSpace.headerTop, bottom = ThesisSpace.x5),
        ) {
            ScreenHeader(title = title, eyebrow = NamesCopy.nameEyebrow(symbol, following))

            when {
                loading -> NameLoading()
                detail == null -> {
                    Spacer(Modifier.height(ThesisSpace.headerToSection))
                    ErrorState(title = NamesCopy.couldNotLoad(symbol), cause = error, onRetry = onRetry)
                }
                else -> NameBody(
                    detail = detail,
                    notes = notes,
                    figures = figures,
                    now = clock,
                    warRoomLive = warRoomLive,
                    focusNote = focusNote,
                    onAnchorPlaced = { anchor, y -> if (anchorY[anchor] != y) anchorY[anchor] = y },
                    lastVisitAtMs = lastVisitAtMs,
                    warRoomId = warRoomId,
                    isPro = isPro,
                    journal = journal,
                    showYears = showYears,
                    copied = copied,
                    onShowYears = {
                        showYears = !showYears
                        copied = false
                    },
                    onCopyTable = { f ->
                        // No haptic for a copy (4.7): the Copied label is the feedback.
                        clipboard.setText(AnnotatedString(filingsTsv(f)))
                        copied = true
                    },
                    onSource = { source = it },
                    onOpenReport = onOpenReport,
                    onOpenReportChange = onOpenReportChange,
                    onBuildReport = onBuildReport,
                    onSaveNote = onSaveNote,
                    onLeaveNote = onLeaveNote,
                    onShareNote = onShareNote,
                    onOpenWarRoom = onOpenWarRoom,
                    onSeeAlerts = onSeeAlerts,
                    onSeePro = onSeePro,
                    onCompareReports = onCompareReports,
                )
            }
        }
        // One chrome row (5.11 item 1): back, the company name once the header scrolls away with the ticker under
        // it, then the pager, the follow toggle and the overflow. The shell gives Name no bar of its own.
        ThesisTopBar(
            modifier = Modifier.align(Alignment.TopCenter).onSizeChanged { barPx = it.height },
            title = title,
            subtitle = symbol.takeIf { it != title },
            onBack = onBack,
            collapsed = collapsed,
        ) {
            NameToolbarActions(
                ticker = symbol,
                following = following,
                pager = pager,
                onPrevious = onPrevious,
                onNext = onNext,
                onFollow = {
                    if (following) {
                        confirmRemove = true
                    } else {
                        haptics.toggle(true)
                        onFollowChange(true)
                    }
                },
                onMore = { moreOpen = true },
            )
        }
    }

    source?.let { info -> SourceSheet(info = info.closingOnOpen { source = null }, onDismissRequest = { source = null }) }

    if (moreOpen) {
        ThesisSheet(onDismissRequest = { moreOpen = false }, title = title.takeIf { it != symbol }?.let { "$symbol · $it" } ?: symbol) {
            if (onCompareWith != null) {
                SheetActionRow(ThesisIcons.Small.Compare, NamesCopy.COMPARE_WITH, {
                    moreOpen = false
                    onCompareWith()
                })
            }
            if (figures != null) {
                SheetActionRow(ThesisIcons.Small.Copy, NamesCopy.COPY_FIGURES, {
                    moreOpen = false
                    clipboard.setText(AnnotatedString(filingsTsv(figures)))
                    // Visible confirmation: the snackbar when wired, and the in-section action reads "Copied as
                    // a table" if the years are showing.
                    copied = true
                    onShowMessage?.invoke(NamesCopy.COPIED)
                })
            }
            if (following) {
                SheetActionRow(ThesisIcons.Small.Remove, NamesCopy.REMOVE, {
                    moreOpen = false
                    confirmRemove = true
                }, destructive = true)
            }
        }
    }

    if (confirmRemove) {
        ThesisDialog(
            onDismissRequest = { confirmRemove = false },
            title = NamesCopy.removeTitle(symbol),
            body = NamesCopy.REMOVE_BODY,
            confirm = DialogAction(NamesCopy.REMOVE_CONFIRM, {
                confirmRemove = false
                haptics.toggle(false)
                onFollowChange(false)
            }),
            destructive = true,
        )
    }
}

/**
 * The screen's starting UI state. Always the default in the app; renders and semantics tests provide one to open
 * Name with a SourceSheet, the overflow sheet, the remove confirm or the five-year table showing.
 */
internal data class NameSeed(
    val source: SourceInfo? = null,
    val moreOpen: Boolean = false,
    val confirmRemove: Boolean = false,
    val showYears: Boolean = false,
    val selectReports: List<String>? = null,
)

internal val LocalNameSeed = staticCompositionLocalOf { NameSeed() }

/**
 * Swipe sideways to the previous or next name of the board (4.5, a horizontal pager). The page follows the finger;
 * released past twice the touch target (96 dp), it carries on out with the `spatial` spring while [onPrevious] or
 * [onNext] replaces the entry (the shell crossfades the replace, so the next name fades in at rest); short of it,
 * it springs back. Toward an end with no neighbour the page moves at a third of the drag, so the edge reads.
 * Reduced motion: nothing follows the finger, and the replace is the shell's crossfade alone. The detector keys
 * on whether paging is possible at all and reads the callbacks through [rememberUpdatedState], so new lambdas on
 * recomposition never restart a gesture.
 */
@Composable
private fun rememberPagerSwipe(ticker: String, onPrevious: (() -> Unit)?, onNext: (() -> Unit)?): Modifier {
    val reduced = LocalReducedMotion.current
    val previous by rememberUpdatedState(onPrevious)
    val next by rememberUpdatedState(onNext)
    val offset = remember { Animatable(0f) }
    val scope = rememberCoroutineScope()
    // A host that keeps this entry and swaps the name shows the new one at rest.
    LaunchedEffect(ticker) { offset.snapTo(0f) }
    val enabled = onPrevious != null || onNext != null
    if (!enabled) return Modifier
    return Modifier
        .pointerInput(reduced) {
            val threshold = ThesisSpace.touchMin.toPx() * 2
            var dx = 0f
            fun settleBack() {
                dx = 0f
                if (!reduced) scope.launch { offset.animateTo(0f, ThesisMotion.spatial()) }
            }
            detectHorizontalDragGestures(
                onDragStart = { dx = 0f },
                onDragEnd = {
                    val forward = dx < 0f
                    val target = when {
                        dx <= -threshold -> next
                        dx >= threshold -> previous
                        else -> null
                    }
                    if (target == null) {
                        settleBack()
                    } else {
                        dx = 0f
                        target()
                        if (!reduced) {
                            val out = size.width.toFloat() * if (forward) -1f else 1f
                            scope.launch {
                                offset.animateTo(out, ThesisMotion.spatial())
                                // Still showing this name once the replace had time to run (no navigation
                                // happened): come back rather than stay off screen. A host that swaps the name
                                // or drops the entry cancels this first.
                                offset.animateTo(
                                    0f,
                                    ThesisMotion.timed(false, ThesisMotion.Base, delayMillis = ThesisMotion.Screen),
                                )
                            }
                        }
                    }
                },
                onDragCancel = { settleBack() },
                onHorizontalDrag = { change, amount ->
                    change.consume()
                    dx += amount
                    if (!reduced) {
                        val hasNeighbour = if (dx < 0f) next != null else previous != null
                        val shown = if (hasNeighbour) dx else dx * PAGER_EDGE_RESISTANCE
                        scope.launch { offset.snapTo(shown) }
                    }
                },
            )
        }
        .graphicsLayer {
            translationX = offset.value
            val width = size.width
            if (width > 0f) alpha = 1f - PAGER_FADE * (abs(offset.value) / width).coerceIn(0f, 1f)
        }
}

/** Toward an end with no neighbour the page moves at this share of the drag. */
private const val PAGER_EDGE_RESISTANCE = 0.33f

/** How much the page fades as it travels its own width (it reads as leaving, not as a slab sliding). */
private const val PAGER_FADE = 0.6f

/**
 * The line above the header, all on the trailing side: the pager ("3 of 12" with previous and next as up and down,
 * mail style, never the back arrow the top bar already shows at the leading edge), then follow and overflow.
 */
@Composable
private fun NameToolbarActions(
    ticker: String,
    following: Boolean,
    pager: NamePager?,
    onPrevious: (() -> Unit)?,
    onNext: (() -> Unit)?,
    onFollow: () -> Unit,
    onMore: () -> Unit,
) {
    val p = LocalThesisPalette.current
    Row(verticalAlignment = Alignment.CenterVertically) {
        if (pager != null) {
            val previous by rememberUpdatedState(onPrevious)
            val next by rememberUpdatedState(onNext)
            Row(
                Modifier.semantics(mergeDescendants = false) {
                    customActions = listOfNotNull(
                        previous?.let { action -> CustomAccessibilityAction(NamesCopy.PREVIOUS_NAME) { action(); true } },
                        next?.let { action -> CustomAccessibilityAction(NamesCopy.NEXT_NAME) { action(); true } },
                    )
                },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // Above 1.3x the caption would take the bar's title room: the position stays in TalkBack's
                // custom actions and the arrows' enabled state.
                if (LocalDensity.current.fontScale <= ThesisType.MAX_DISPLAY_SCALE) {
                    Text(
                        NamesCopy.pagerCaption(pager.position, pager.count),
                        modifier = Modifier
                            .padding(end = ThesisSpace.xs)
                            .semantics { contentDescription = NamesCopy.pagerSpoken(pager.position, pager.count) },
                        style = ThesisType.caption,
                        color = p.muted,
                        maxLines = 1,
                    )
                }
                ThesisIconButton(ThesisIcons.Up, NamesCopy.PREVIOUS_NAME, { onPrevious?.invoke() }, enabled = onPrevious != null)
                ThesisIconButton(ThesisIcons.Down, NamesCopy.NEXT_NAME, { onNext?.invoke() }, enabled = onNext != null)
            }
        }
        // A follow toggle (5.11 item 1): one stable label, its state said as on/off with the state in words, so
        // TalkBack reads "Follow AAPL, In your names" and turning it off asks first.
        ThesisIconButton(
            icon = if (following) ThesisIcons.FollowFilled else ThesisIcons.Follow,
            contentDescription = NamesCopy.follow(ticker),
            onClick = onFollow,
            modifier = Modifier.semantics {
                toggleableState = ToggleableState(following)
                stateDescription = if (following) NamesCopy.FOLLOWING else NamesCopy.NOT_FOLLOWING
            },
        )
        ThesisIconButton(ThesisIcons.Overflow, NamesCopy.MORE, onMore)
    }
}

@Composable
private fun NameLoading() {
    Spacer(Modifier.height(ThesisSpace.headerToSection))
    SkeletonKpiGrid(cells = 4)
    Spacer(Modifier.height(ThesisSpace.sectionGapData))
    SkeletonCard()
}

/** A section Name can open at (`Destination.Name` anchors): "Since the last report" or "Your notes". */
enum class NameAnchor { Changes, Notes }

/** A zero-size mark that reports its y in the page column, for [NameScreen]'s `scrollTo`. */
@Composable
private fun AnchorMark(anchor: NameAnchor, onPlaced: (NameAnchor, Int) -> Unit) {
    Spacer(Modifier.onPlaced { onPlaced(anchor, it.positionInParent().y.roundToInt()) })
}

@Composable
private fun NameBody(
    detail: NameDetailView,
    notes: List<NameNote>,
    figures: FilingsFigures?,
    now: Instant,
    warRoomLive: Boolean,
    focusNote: Boolean,
    onAnchorPlaced: (NameAnchor, Int) -> Unit,
    lastVisitAtMs: Long,
    warRoomId: String?,
    isPro: Boolean,
    journal: List<ConvictionJournalEntryView>,
    showYears: Boolean,
    copied: Boolean,
    onShowYears: () -> Unit,
    onCopyTable: (FilingsFigures) -> Unit,
    onSource: (SourceInfo) -> Unit,
    onOpenReport: (String) -> Unit,
    onOpenReportChange: (String, Int) -> Unit,
    onBuildReport: () -> Unit,
    onSaveNote: suspend (String, String) -> Boolean,
    onLeaveNote: (String, String) -> Unit,
    onShareNote: ((String) -> Unit)?,
    onOpenWarRoom: (String) -> Unit,
    onSeeAlerts: (() -> Unit)?,
    onSeePro: () -> Unit,
    onCompareReports: (String, String) -> Unit,
) {
    val fmt = LocalFmt.current
    val zone = ZoneId.systemDefault()
    val ticker = detail.ticker.trim().uppercase()
    val snapshot = detail.snapshot
    val summary = detail.summary
    val action = nameReportAction(detail)

    // ---- State line and reason (5.11 item 2)
    Spacer(Modifier.height(ThesisSpace.m))
    StateLine(detail, zone, now)
    snapshot?.reason?.trim()?.ifBlank { null }?.let { reason ->
        Spacer(Modifier.height(ThesisSpace.s))
        Text(reason, style = ThesisType.lede, color = LocalThesisPalette.current.ink2)
    }

    // ---- Monitor KPIs. Without a snapshot the score and freshness tiles go, but the alert ledger's facts stay.
    val tiles = remember(detail, lastVisitAtMs, now, fmt) { monitorTiles(detail, lastVisitAtMs, now, fmt, zone) }
    if (tiles.isNotEmpty()) {
        Spacer(Modifier.height(ThesisSpace.headerToSection))
        KpiGrid(items = tiles.map { it.first }, onItemClick = { onSource(tiles[it].second) })
        // With the Alerts tile it explains (5.11 item 3's Inbox link), not under the report-to-report block.
        if (onSeeAlerts != null && detail.alerts.any { it.concerns(ticker) }) {
            Spacer(Modifier.height(ThesisSpace.xs))
            TextAction(NamesCopy.SEE_ALERTS, onSeeAlerts)
        }
    }

    // ---- Since the last report (item 3)
    AnchorMark(NameAnchor.Changes, onAnchorPlaced)
    if (summary != null) {
        val model = remember(summary, notes, fmt) { sinceLastReportModel(summary, notes, fmt, zone) }
        when {
            // The previous line takes its period from the notes trail: hold the block until the trail has arrived,
            // so the line never shows a date alone and then shifts in place.
            model != null && detail.isLoading -> {
                Spacer(Modifier.height(ThesisSpace.sectionGapReading))
                SkeletonCard()
            }
            // The kit's first-report caption ("appears after the next filing") would contradict Reports below,
            // which lists an earlier report and offers Compare two: leave the block out then.
            model == null && deepDivesOf(detail.reports, ticker).distinctBy { it.reportId }.size >= 2 -> Unit
            else -> {
                Spacer(Modifier.height(ThesisSpace.sectionGapReading))
                // SinceLastReport carries its own kicker, so no SectionHeader above it.
                SinceLastReport(model = model, onChangeClick = { onOpenReportChange(summary.reportId, it) })
            }
        }
    }

    // ---- From the filings (item 4)
    if (figures != null) {
        Spacer(Modifier.height(ThesisSpace.sectionGapData))
        val revenue = figures.revenue?.let { Fmt.money(it) }
        val growth = figures.growth?.let { Fmt.pct(abs(it) * 100.0, 1) }
        SectionHeader(
            kicker = NamesCopy.FILINGS_KICKER,
            headline = NamesCopy.filingsHeadline(figures.period, revenue, growth, figures.growth?.let { it >= 0 }),
            deck = NamesCopy.filingsDeck(figures.period, figures.priorPeriod),
        )
        Spacer(Modifier.height(ThesisSpace.l))
        val kpis = remember(figures) { filingsKpis(figures) }
        // The screen's one featured grid (2.3): serif kpiValue figures, as the Deep Dive's KPI block.
        val openSummary = summary?.reportId?.let { id -> { onOpenReport(id) } }
        KpiGrid(items = kpis, featured = true, onItemClick = { onSource(filingsSource(figures, it, openSummary)) })
        if (figures.annual.size >= 2) {
            Spacer(Modifier.height(ThesisSpace.s))
            TextAction(if (showYears) NamesCopy.HIDE_YEARS else NamesCopy.SHOW_YEARS, onShowYears)
            if (showYears) {
                val table = remember(figures) { filingsTable(figures) }
                Spacer(Modifier.height(ThesisSpace.s))
                CompareTable(table)
                TextAction(if (copied) NamesCopy.COPIED else NamesCopy.COPY_TABLE, { onCopyTable(figures) })
            }
        }
    }

    // ---- Report card (item 5)
    Spacer(Modifier.height(ThesisSpace.sectionGapData))
    ReportCard(detail = detail, action = action, notes = notes, onOpenReport = onOpenReport, onBuildReport = onBuildReport)

    // ---- Your notes (item 6)
    Spacer(Modifier.height(ThesisSpace.sectionGapReading))
    AnchorMark(NameAnchor.Notes, onAnchorPlaced)
    NotesSection(
        ticker = ticker,
        notes = notes,
        reportCount = notes.size,
        // The trail arrives after the cached detail (MainViewModel.openName): no editor until it has, so an empty
        // draft never hides, then overwrites, the stored note.
        loading = detail.isLoading,
        focus = focusNote,
        currentReportId = (action as? NameReportAction.Open)?.reportId,
        onSaveNote = onSaveNote,
        onLeaveNote = onLeaveNote,
        onShareNote = onShareNote,
    )

    // ---- Earnings (item 7)
    if (warRoomId != null) {
        Spacer(Modifier.height(ThesisSpace.sectionGapData))
        val day = nextEarnings(detail.alerts, ticker, now.atZone(zone).toLocalDate())?.first
        EarningsSection(
            title = day?.let { NamesCopy.earningsOn(fmt.marketDate(it)) },
            live = warRoomLive,
            onClick = { onOpenWarRoom(warRoomId) },
        )
    }

    // ---- Conviction journal (item 8)
    Spacer(Modifier.height(ThesisSpace.sectionGapData))
    JournalSection(isPro = isPro, journal = journal.filter { it.ticker.equals(ticker, ignoreCase = true) }, zone = zone, onSeePro = onSeePro)

    // ---- Reports (item 9)
    Spacer(Modifier.height(ThesisSpace.sectionGapData))
    ReportsSection(ticker = ticker, reports = detail.reports, notes = notes, zone = zone, onOpenReport = onOpenReport, onCompareReports = onCompareReports)
}

/**
 * Earnings (5.11 item 7): kicker, then one ActionRow in a RowGroup segment, its icon on the section's text edge
 * like the Reports rows. In the Live phase the LiveDot takes the icon's place (ActionRow has no leading slot yet:
 * HANDOFF-B asks WP-K for one; until then the dot sits over the row's empty leading column).
 */
@Composable
private fun EarningsSection(title: String?, live: Boolean, onClick: () -> Unit) {
    // The headline is the conclusion (V3): live, the dated earnings, or an open window without a date; never the
    // row's own title again.
    val headline = when {
        live -> NamesCopy.WAR_ROOM_LIVE
        title != null -> title
        else -> NamesCopy.EARNINGS_WINDOW_UNDATED
    }
    SectionHeader(kicker = NamesCopy.EARNINGS_KICKER, headline = headline)
    Spacer(Modifier.height(ThesisSpace.l))
    Box(Modifier.rowGroupSegment(RowPosition.of(0, 1), LeadingRowDividerInset)) {
        ActionRow(
            icon = if (live) null else ThesisIcons.WarRoom,
            title = if (live) title ?: NamesCopy.WAR_ROOM else NamesCopy.WAR_ROOM,
            caption = NamesCopy.WAR_ROOM_CAPTION,
            onClick = onClick,
            reserveLeading = true,
        )
        if (live) {
            LiveDot(
                Modifier
                    .align(Alignment.CenterStart)
                    .padding(start = ThesisSpace.l),
            )
        }
    }
}

/** StatusBadge with the state and its change caption: "Was Intact on 21 Nov" or "No state change since 21 Nov". */
@Composable
private fun StateLine(detail: NameDetailView, zone: ZoneId, now: Instant) {
    val p = LocalThesisPalette.current
    val fmt = LocalFmt.current
    val snapshot = detail.snapshot
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
        if (snapshot == null) {
            StatusBadge(NamesCopy.NO_REPORT, Tone.Unknown)
            return@Row
        }
        StatusBadge(stateWordOf(snapshot.state), thesisStateTone(snapshot.state))
        val previous = detail.delta?.previous
        val caption = previous?.let {
            val on = briefDay(Instant.ofEpochMilli(it.takenAtMs).atZone(zone).toLocalDate(), now.atZone(zone).toLocalDate(), fmt)
            if (detail.delta.stateChanged) NamesCopy.wasState(stateWordOf(it.state), on) else NamesCopy.stateSteadySince(on)
        }
        if (caption != null) {
            Text(caption, style = ThesisType.caption, color = p.muted, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
    }
}

/**
 * The monitor tiles with their SourceSheets (5.11 item 2): score, freshness, alerts, next earnings. Without a
 * date the earnings tile says so ("Not dated yet", principle 11) rather than leave a blank cell in the 2-column grid
 * (a spec deviation, HANDOFF-B). The material and unreviewed event counts live in Freshness's SourceSheet: the user
 * cannot clear them until a new report lands (5.10 item 6, Q3), so no tile of their own. Without a monitor snapshot
 * (no report yet) the score and freshness tiles go; alerts and next earnings come from the alert ledger and the War
 * Room, so they stay whenever the ledger has an alert or a date for the name. Muted alerts are not counted, as on
 * the board.
 */
internal fun monitorTiles(detail: NameDetailView, lastVisitAtMs: Long, now: Instant, fmt: Fmt, zone: ZoneId): List<Pair<KpiSpec, SourceInfo>> {
    val ticker = detail.ticker.trim().uppercase()
    val ledgerTiles = ledgerTiles(detail, ticker, lastVisitAtMs, now, fmt, zone)
    val s = detail.snapshot ?: return if (ledgerTiles.hasFacts) ledgerTiles.tiles else emptyList()
    val score = scoreOutOf100(s.score)
    val previous = detail.delta?.previous
    // Said as the board says it ("+4 since Sat"), so the row and the tile read the same.
    val since = previous?.let { briefDay(Instant.ofEpochMilli(it.takenAtMs).atZone(zone).toLocalDate(), now.atZone(zone).toLocalDate(), fmt) }
    val change = if (previous != null && score != null) scoreOutOf100(previous.score)?.let { score - it } else null
    val changeTone = when {
        change == null || abs(change) < 0.5 -> Tone.Neutral
        change > 0 -> Tone.Favourable
        else -> Tone.Unfavourable
    }
    val reportAt = parseMs(s.lastDeepDiveAt) ?: parseMs(s.reportGeneratedAt)
    val period = detail.summary?.filingPeriod?.ifBlank { null }
    val reportAge = reportAt?.let { fmt.reportAge(NamesCopy.REPORT, Instant.ofEpochMilli(it), period) }
    // The SourceSheet row is already labelled "Report": its value is the period and age alone ("FY2026 · 23 days ago").
    val reportInput = reportAt?.let { listOfNotNull(period, fmt.relative(Instant.ofEpochMilli(it))).joinToString(" · ") }
    // Both scores come from the Deep Dive, so the sheet's Source line names that document and when it was built:
    // "Deep Dive on the FY2026 filing · built 13 Nov".
    val reportSource = NamesCopy.reportSource(period)
    val reportBuilt = reportAt?.let { NamesCopy.builtOn(fmt.shortDate(Instant.ofEpochMilli(it).atZone(zone).toLocalDate())) }
    val freshness = NamesCopy.freshnessWord(s.freshnessState)

    val scoreTile = KpiSpec(
        label = NamesCopy.KPI_SCORE,
        value = Fmt.score(score),
        // The board's wording ("+4 since Sat"): the same change reads the same on both screens.
        delta = change?.takeIf { abs(it) >= 0.5 && Math.round(it) != 0L }?.let { signedPoints(it) },
        deltaTone = changeTone,
        reference = when {
            since == null -> NamesCopy.SCALE_100
            change != null && abs(change) >= 0.5 && Math.round(change) != 0L -> NamesCopy.since(since)
            else -> NamesCopy.unchangedSince(since)
        },
        // The score's place on its 0 to 100 scale (5.11 item 2, principle 4): the page's one subject meter.
        meter = score?.let { (it / 100.0).toFloat().coerceIn(0f, 1f) },
    ) to SourceInfo(
        metric = ScoreCopy.MONITOR_SCORE,
        definition = ScoreCopy.MONITOR_DEFINITION,
        form = reportSource,
        period = reportBuilt,
        derivation = ScoreCopy.MONITOR_DERIVATION,
        inputs = ScoreCopy.monitorInputs(
            score = Fmt.score(score),
            state = stateWordOf(s.state),
            reason = s.reason,
            report = reportInput,
            previous = previous?.let { "${Fmt.score(scoreOutOf100(it.score))}, ${stateWordOf(it.state)}" + (since?.let { d -> ", $d" } ?: "") },
        ),
    )

    val freshnessTile = KpiSpec(
        label = NamesCopy.KPI_FRESHNESS,
        value = freshness,
        reference = reportAge,
    ) to SourceInfo(
        metric = ScoreCopy.FRESHNESS,
        definition = ScoreCopy.FRESHNESS_DEFINITION,
        form = reportSource,
        period = reportBuilt,
        derivation = ScoreCopy.FRESHNESS_DERIVATION,
        inputs = ScoreCopy.freshnessInputs(
            score = Fmt.score(scoreOutOf100(s.freshnessScore)),
            state = freshness,
            reportAge = reportAge,
            unreviewed = s.unreviewedEventsCount,
            material = s.materialEventsCount,
            killSwitch = s.killSwitchTriggeredAt != null,
            reason = s.freshnessReason,
        ),
    )

    return listOf(scoreTile, freshnessTile) + ledgerTiles.tiles
}

/** The alerts and next-earnings tiles, and whether the ledger knows anything about the name (an alert or a date). */
private class LedgerTiles(val tiles: List<Pair<KpiSpec, SourceInfo>>, val hasFacts: Boolean)

private fun ledgerTiles(detail: NameDetailView, ticker: String, lastVisitAtMs: Long, now: Instant, fmt: Fmt, zone: ZoneId): LedgerTiles {
    // Muted alerts are ones the user said they do not want: not counted, as on the board (nextEarnings drops them too).
    val tickerAlerts = detail.alerts.filter { it.concerns(ticker) && it.mutedAt == null }
    val visited = lastVisitAtMs > 0L
    val newAlerts = if (visited) tickerAlerts.count { (parseMs(it.createdAt) ?: 0L) > lastVisitAtMs } else tickerAlerts.size
    val visitDay = if (visited) fmt.shortDate(Instant.ofEpochMilli(lastVisitAtMs).atZone(zone).toLocalDate()) else null
    val alertsTile = KpiSpec(
        label = if (visited) NamesCopy.KPI_ALERTS else NamesCopy.KPI_ALERTS_ALL,
        value = Fmt.number(newAlerts.toLong()),
        // The label already says "since your last visit"; its date is in the SourceSheet.
        reference = null,
    ) to SourceInfo(
        metric = if (visited) ScoreCopy.ALERTS else NamesCopy.KPI_ALERTS_ALL,
        definition = if (visited) ScoreCopy.ALERTS_DEFINITION else ScoreCopy.ALERTS_ALL_DEFINITION,
        inputs = listOfNotNull(
            NamesCopy.KPI_ALERTS_ALL to Fmt.number(tickerAlerts.size.toLong()),
            visitDay?.let { NamesCopy.LAST_VISIT to it },
        ),
    )

    val next = nextEarnings(detail.alerts, ticker, now.atZone(zone).toLocalDate())
    val earningsTile = next?.let { (day, fromWarRoom) ->
        KpiSpec(
            label = NamesCopy.KPI_EARNINGS,
            value = fmt.marketDate(day),
            reference = if (fromWarRoom) NamesCopy.FROM_WAR_ROOM else NamesCopy.FROM_ALERT,
        ) to SourceInfo(
            metric = ScoreCopy.EARNINGS,
            definition = ScoreCopy.EARNINGS_DEFINITION,
            inputs = listOf(NamesCopy.KPI_EARNINGS to fmt.marketDate(day)),
        )
    } ?: (
        KpiSpec(
            label = NamesCopy.KPI_EARNINGS,
            value = NamesCopy.EARNINGS_UNDATED,
            reference = NamesCopy.EARNINGS_UNDATED_WHY,
        ) to SourceInfo(
            metric = ScoreCopy.EARNINGS,
            definition = ScoreCopy.EARNINGS_DEFINITION,
            inputs = listOf(NamesCopy.KPI_EARNINGS to NamesCopy.EARNINGS_UNDATED),
        )
    )
    return LedgerTiles(listOf(alertsTile, earningsTile), hasFacts = tickerAlerts.isNotEmpty() || next != null)
}

/** The Report card: Open report when one is stored (with when it was built), Build report only when none is. */
@Composable
private fun ReportCard(
    detail: NameDetailView,
    action: NameReportAction,
    notes: List<NameNote>,
    onOpenReport: (String) -> Unit,
    onBuildReport: () -> Unit,
) {
    val fmt = LocalFmt.current
    val p = LocalThesisPalette.current
    val ticker = detail.ticker.trim().uppercase()
    when (action) {
        is NameReportAction.Open -> {
            val current = notes.firstOrNull { it.reportId == action.reportId }
            val period = detail.summary?.filingPeriod?.ifBlank { null } ?: current?.filing
            val builtAt = current?.atMs ?: parseMs(detail.snapshot?.reportGeneratedAt)
            val date = builtAt?.let { fmt.shortDate(Instant.ofEpochMilli(it).atZone(ZoneId.systemDefault()).toLocalDate()) }
            ThesisCard(
                eyebrow = NamesCopy.reportEyebrow(period),
                title = detail.summary?.verdict?.ifBlank { null } ?: current?.verdict,
            ) {
                Text(NamesCopy.reportBuilt(period, date), style = ThesisType.bodySmall, color = p.ink2)
                PrimaryButton(NamesCopy.OPEN_REPORT, { onOpenReport(action.reportId) }, Modifier.fillMaxWidth())
            }
        }
        NameReportAction.Build -> ThesisCard(eyebrow = NamesCopy.DEEP_DIVE, title = NamesCopy.noReportTitle(ticker)) {
            Text(NamesCopy.NO_REPORT_BODY, style = ThesisType.bodySmall, color = p.ink2)
            PrimaryButton(NamesCopy.BUILD_REPORT, onBuildReport, Modifier.fillMaxWidth(), commit = true)
        }
    }
}

/** Your notes (5.11 item 6): the trail, newest report first and editable; Carry forward when it has no note yet. */
@Composable
private fun NotesSection(
    ticker: String,
    notes: List<NameNote>,
    reportCount: Int,
    loading: Boolean,
    focus: Boolean,
    currentReportId: String?,
    onSaveNote: suspend (String, String) -> Boolean,
    onLeaveNote: (String, String) -> Unit,
    onShareNote: ((String) -> Unit)?,
) {
    val fmt = LocalFmt.current
    val zone = ZoneId.systemDefault()
    val clipboard = LocalClipboardManager.current
    val written = notes.count { it.text.isNotBlank() }
    // The conclusion is where the latest note sits (notes are newest report first).
    val lastWritten = notes.firstOrNull { it.text.isNotBlank() }
    SectionHeader(
        kicker = NamesCopy.NOTES_KICKER,
        headline = NamesCopy.notesHeadline(
            written = lastWritten != null,
            filing = lastWritten?.filing,
            date = lastWritten?.atMs?.let { fmt.shortDate(Instant.ofEpochMilli(it).atZone(zone).toLocalDate()) },
        ),
        deck = NamesCopy.notesDeck(written, reportCount),
    )
    Spacer(Modifier.height(ThesisSpace.l))
    if (loading) {
        SkeletonCard()
        return
    }
    val newest = notes.firstOrNull()
    if (newest == null) {
        Callout(NamesCopy.NOTES_NEED_REPORT)
        return
    }
    // The draft follows the stored note until the user types: a note that arrives (or changes on the server)
    // while the editor still shows the last stored text replaces it; an edit in progress is never overwritten.
    var draft by rememberSaveable(newest.reportId) { mutableStateOf(newest.text) }
    var stored by rememberSaveable(newest.reportId) { mutableStateOf(newest.text) }
    // One autosave per report, seeded with the stored text, so showing a stored note never saves it again.
    val autosave = key(newest.reportId) {
        rememberNoteAutosave(
            text = draft,
            save = { text -> onSaveNote(newest.reportId, text) },
            onLeave = { text -> onLeaveNote(newest.reportId, text) },
        )
    }
    // Synced in an effect, not during composition (rubric P1). A server text the draft follows becomes the
    // autosave's baseline in the same snapshot, so it is not saved straight back.
    LaunchedEffect(newest.reportId, newest.text) {
        if (newest.text != stored) {
            if (draft == stored) {
                autosave.lastSaved = newest.text
                draft = newest.text
            }
            stored = newest.text
        }
    }
    val editorFocus = remember { FocusRequester() }
    var focused by rememberSaveable { mutableStateOf(false) }
    val entries = notes.mapIndexed { i, n ->
        NoteEntry(
            key = n.reportId,
            filing = n.filing ?: NamesCopy.DEEP_DIVE,
            date = n.atMs?.let { fmt.shortDate(Instant.ofEpochMilli(it).atZone(zone).toLocalDate()) } ?: Fmt.NOT_DISCLOSED,
            text = if (i == 0) draft else n.text,
            // The Report card right above carries the current report's verdict (its title): not again here.
            verdict = n.verdict.takeUnless { i == 0 && n.reportId == currentReportId },
        )
    }
    NotesTrail(
        entries = entries,
        onCarryForward = { draft = it.text },
    ) { entry ->
        key(entry.key) {
            NoteBlock(
                value = draft,
                onValueChange = { draft = it },
                // Focus lands on the block's first focus target, its text field, which brings itself into view.
                modifier = Modifier.focusRequester(editorFocus),
                // The entry's header right above names the filing and date.
                filing = null,
                saveState = autosave.state,
                onRetry = autosave::retry,
                onCopy = { clipboard.setText(AnnotatedString(draft)) }.takeIf { draft.isNotBlank() },
                onShare = onShareNote?.let { share -> { share("$ticker · ${entry.filing}\n\n$draft") } }?.takeIf { draft.isNotBlank() },
            )
        }
    }
    // Write a note (5.10 item 7): the newest note takes focus once, after the trail has arrived.
    LaunchedEffect(focus) {
        if (focus && !focused) {
            focused = true
            runCatching { editorFocus.requestFocus() }
        }
    }
}

/** Conviction journal (5.11 item 8): the Timeline for Pro, one Callout with See Pro otherwise. */
@Composable
private fun JournalSection(isPro: Boolean, journal: List<ConvictionJournalEntryView>, zone: ZoneId, onSeePro: () -> Unit) {
    val fmt = LocalFmt.current
    if (!isPro) {
        SectionHeader(kicker = NamesCopy.JOURNAL_KICKER, headline = NamesCopy.JOURNAL_PRO_HEADLINE)
        Spacer(Modifier.height(ThesisSpace.m))
        Callout(NamesCopy.JOURNAL_PRO)
        TextAction(NamesCopy.SEE_PRO, onSeePro)
        return
    }
    if (journal.isEmpty()) {
        SectionHeader(kicker = NamesCopy.JOURNAL_KICKER, headline = NamesCopy.JOURNAL_EMPTY)
        return
    }
    val all = journal.sortedByDescending { parseMs(it.eventAt) ?: 0L }
    val (headline, deck) = remember(all, fmt) { journalConclusion(all, fmt, zone) }
    SectionHeader(kicker = NamesCopy.JOURNAL_KICKER, headline = headline, deck = deck)
    Spacer(Modifier.height(ThesisSpace.l))
    val sorted = all.take(JOURNAL_MAX)
    Timeline(
        items = sorted.mapIndexed { i, e ->
            TimelineItem(
                title = e.title.ifBlank { NamesCopy.journalEvent(e.eventType) },
                meta = listOfNotNull(
                    NamesCopy.journalEvent(e.eventType),
                    parseMs(e.eventAt)?.let { fmt.relative(Instant.ofEpochMilli(it)) },
                ).joinToString(" · "),
                body = e.summary.ifBlank { null },
                state = if (i == 0) TimelineState.Current else TimelineState.Done,
            )
        },
    )
}

private const val JOURNAL_MAX = 8

/**
 * The journal's headline and deck, as a conclusion (V3): when the entries carry the monitor state, how long the
 * current state has held ("State held Intact since 31 Jul"); otherwise the latest entry leads and the deck counts.
 * [newestFirst] is sorted by event date, newest first, and not empty.
 */
internal fun journalConclusion(newestFirst: List<ConvictionJournalEntryView>, fmt: Fmt, zone: ZoneId): Pair<String, String> {
    fun day(e: ConvictionJournalEntryView): String? =
        parseMs(e.eventAt)?.let { fmt.shortDate(Instant.ofEpochMilli(it).atZone(zone).toLocalDate()) }
    val latest = newestFirst.first()
    val state = latest.thesisSnapshot?.monitorState?.trim()?.ifBlank { null }
    if (state != null) {
        // The run of entries, from the newest back, that carry the same state; entries without a state do not break it.
        val run = newestFirst.takeWhile { e ->
            val s = e.thesisSnapshot?.monitorState?.trim()?.ifBlank { null }
            s == null || s.equals(state, ignoreCase = true)
        }
        val since = run.lastOrNull { it.thesisSnapshot?.monitorState != null }?.let(::day)
        if (since != null) {
            val latestWhen = parseMs(latest.eventAt)?.let { fmt.relative(Instant.ofEpochMilli(it)) } ?: since
            return NamesCopy.journalHeld(stateWordOf(state), since) to NamesCopy.journalHeldDeck(newestFirst.size, latestWhen)
        }
    }
    val title = latest.title.ifBlank { NamesCopy.journalEvent(latest.eventType) }
    return title to NamesCopy.journalDeck(newestFirst.size, newestFirst.last().let(::day))
}

/** Reports (5.11 item 9): your opened Deep Dives for this ticker; Compare two selects a like-for-like pair. */
@Composable
private fun ReportsSection(
    ticker: String,
    reports: List<ReportHistoryItem>,
    notes: List<NameNote>,
    zone: ZoneId,
    onOpenReport: (String) -> Unit,
    onCompareReports: (String, String) -> Unit,
) {
    val fmt = LocalFmt.current
    val seed = LocalNameSeed.current
    val mine = deepDivesOf(reports, ticker)
        .distinctBy { it.reportId }
        .sortedByDescending { parseMs(it.createdAt) ?: 0L }
    var selecting by rememberSaveable { mutableStateOf(seed.selectReports != null) }
    var selected by rememberSaveable { mutableStateOf(seed.selectReports.orEmpty()) }
    fun kindOf(reportId: String): String? = filingKindOf(notes.firstOrNull { it.reportId == reportId }?.filing)
    val latestDate = mine.firstOrNull()?.let { parseMs(it.createdAt) }?.let { fmt.shortDate(Instant.ofEpochMilli(it).atZone(zone).toLocalDate()) }
    SectionHeader(
        kicker = NamesCopy.REPORTS_KICKER,
        headline = NamesCopy.reportsHeadline(mine.size, latestDate),
        deck = if (mine.isEmpty()) NamesCopy.reportsEmpty(ticker) else NamesCopy.REPORTS_CAPTION,
        actionLabel = when {
            mine.size < 2 -> null
            selecting -> NamesCopy.CANCEL
            else -> NamesCopy.COMPARE_TWO
        },
        onAction = {
            selecting = !selecting
            selected = emptyList()
        },
    )
    if (mine.isEmpty()) return
    Spacer(Modifier.height(ThesisSpace.l))
    Column {
        mine.forEachIndexed { i, report ->
            val note = notes.firstOrNull { it.reportId == report.reportId }
            val date = parseMs(report.createdAt)?.let { fmt.shortDate(Instant.ofEpochMilli(it).atZone(zone).toLocalDate()) } ?: Fmt.NOT_DISCLOSED
            val title = note?.filing?.let { "${NamesCopy.DEEP_DIVE} · $it" } ?: NamesCopy.reportRow(date)
            val caption = date.takeIf { note?.filing != null }
            val hasNote = note?.text?.isNotBlank() == true
            val segment = Modifier.rowGroupSegment(RowPosition.of(i, mine.size), LeadingRowDividerInset)
            if (selecting) {
                // Like-for-like only (5.18): a report is off when its filing kind differs from any picked report's
                // known kind, so a pair can never mix an annual and a quarterly report.
                val kind = kindOf(report.reportId)
                val isSelected = report.reportId in selected
                val keeps = if (selected.size >= 2) selected.drop(1) else selected
                ReportRow(
                    title = title,
                    caption = caption,
                    hasNote = hasNote,
                    selecting = true,
                    selected = isSelected,
                    enabled = isSelected || keeps.all { sameReportKind(kindOf(it), kind) },
                    modifier = segment,
                    onClick = {
                        selected = when {
                            report.reportId in selected -> selected - report.reportId
                            selected.size >= 2 -> selected.drop(1) + report.reportId
                            else -> selected + report.reportId
                        }
                    },
                )
            } else {
                ReportRow(
                    title = title,
                    caption = caption,
                    hasNote = hasNote,
                    selecting = false,
                    selected = false,
                    enabled = true,
                    modifier = segment,
                    onClick = { onOpenReport(report.reportId) },
                )
            }
        }
    }
    if (selecting) {
        Spacer(Modifier.height(ThesisSpace.m))
        val kinds = mine.mapNotNull { kindOf(it.reportId) }.toSet()
        Text(if (kinds.size > 1) NamesCopy.PICK_LIKE else NamesCopy.PICK_TWO, style = ThesisType.caption, color = LocalThesisPalette.current.muted)
        Spacer(Modifier.height(ThesisSpace.s))
        // Secondary: Open report above stays the screen's one filled control (V3).
        val pairOk = selected.size == 2 && sameReportKind(kindOf(selected[0]), kindOf(selected[1]))
        SecondaryButton(
            text = NamesCopy.COMPARE_REPORTS,
            onClick = {
                val (a, b) = selected
                selecting = false
                selected = emptyList()
                onCompareReports(a, b)
            },
            modifier = Modifier.fillMaxWidth(),
            enabled = pairOk,
        )
    }
}

/**
 * A Reports row (5.11 item 9): the Deep Dive icon (a check box in selection) in the leading column, the filing and
 * date, and the note mark the board rows use when you wrote a note on that report. ActionRow has no trailing slot
 * for the mark (HANDOFF-B asks WP-K for one), so the row is built here with ActionRow's metrics.
 */
@Composable
private fun ReportRow(
    title: String,
    caption: String?,
    hasNote: Boolean,
    selecting: Boolean,
    selected: Boolean,
    enabled: Boolean,
    modifier: Modifier,
    onClick: () -> Unit,
) {
    val p = LocalThesisPalette.current
    val source = remember { MutableInteractionSource() }
    val action = if (selecting) {
        Modifier.toggleable(
            value = selected,
            interactionSource = source,
            indication = null,
            enabled = enabled,
            role = Role.Checkbox,
            onValueChange = { onClick() },
        )
    } else {
        Modifier.clickable(source, indication = null, role = Role.Button, onClick = onClick)
    }
    Row(
        modifier
            .fillMaxWidth()
            .then(action)
            .semantics(mergeDescendants = true) { }
            .thesisPress(source)
            .heightIn(min = if (caption != null) ThesisSpace.rowMinComfortableTwoLine else ThesisSpace.rowMinComfortable)
            .padding(horizontal = ThesisSpace.l, vertical = ThesisSpace.rowPaddingV),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.width(ThesisSpace.leadingColumn), contentAlignment = Alignment.CenterStart) {
            if (selecting) {
                ThesisCheckbox(checked = selected, onCheckedChange = null, enabled = enabled)
            } else {
                Icon(ThesisIcons.DeepDive, contentDescription = null, modifier = Modifier.size(ThesisSpace.iconL), tint = p.ink2)
            }
        }
        Spacer(Modifier.width(ThesisSpace.leadingGap))
        Column(Modifier.weight(1f)) {
            Text(title, style = ThesisType.rowTitle, color = if (enabled) p.ink else p.muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (caption != null) Text(caption, style = ThesisType.bodySmall, color = p.ink2, maxLines = 1)
        }
        if (hasNote) {
            Spacer(Modifier.width(ThesisSpace.m))
            NoteMark(contentDescription = NamesCopy.WITH_NOTE)
        }
    }
}
