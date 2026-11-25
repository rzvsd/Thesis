package com.thesis.mobile.ui.screens

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
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
import com.thesis.mobile.ui.components.NoteBlock
import com.thesis.mobile.ui.components.NoteEntry
import com.thesis.mobile.ui.components.NotesTrail
import com.thesis.mobile.ui.components.PrimaryButton
import com.thesis.mobile.ui.components.ReportChange
import com.thesis.mobile.ui.components.RowPosition
import com.thesis.mobile.ui.components.ScreenHeader
import com.thesis.mobile.ui.components.SectionHeader
import com.thesis.mobile.ui.components.SheetActionRow
import com.thesis.mobile.ui.components.SinceLastReport
import com.thesis.mobile.ui.components.SinceLastReportModel
import com.thesis.mobile.ui.components.SkeletonCard
import com.thesis.mobile.ui.components.SkeletonKpiGrid
import com.thesis.mobile.ui.components.SourceInfo
import com.thesis.mobile.ui.components.SourceSheet
import com.thesis.mobile.ui.components.StatusBadge
import com.thesis.mobile.ui.components.TextAction
import com.thesis.mobile.ui.components.ThesisCard
import com.thesis.mobile.ui.components.ThesisCheckbox
import com.thesis.mobile.ui.components.ThesisDialog
import com.thesis.mobile.ui.components.ThesisIconButton
import com.thesis.mobile.ui.components.ThesisSheet
import com.thesis.mobile.ui.components.rememberNoteAutosave
import com.thesis.mobile.ui.components.rowGroupSegment
import com.thesis.mobile.ui.copy.NamesCopy
import com.thesis.mobile.ui.copy.ScoreCopy
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.format.LocalFmt
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.motion.rememberHaptics
import com.thesis.mobile.ui.motion.thesisPress
import com.thesis.mobile.ui.shell.exceptTop
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone
import com.thesis.mobile.ui.theme.thesisStateTone
import java.time.Instant
import java.time.ZoneId
import kotlin.math.abs

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

/** The report the Name screen treats as current: the cached summary's, else the snapshot's, else the newest opened. */
fun currentReportId(detail: NameDetailView): String? =
    detail.summary?.reportId?.ifBlank { null }
        ?: detail.snapshot?.reportId?.trim()?.ifBlank { null }
        ?: detail.reports
            .filter { it.ticker == null || it.ticker.equals(detail.ticker.trim(), ignoreCase = true) }
            .maxByOrNull { parseMs(it.createdAt) ?: 0L }?.reportId?.ifBlank { null }

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
    val reports = detail.reports.filter { it.ticker == null || it.ticker.trim().uppercase() == ticker }
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
 * The From the filings figures (5.11 item 4): the latest annual row against the one before. Margins are
 * fractions as on the wire (0.31 = 31%); null means the filing did not give the input.
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
)

private fun FinancialHistoryRowView.isAnnual(): Boolean =
    fiscalQuarter == null && !periodType.trim().lowercase().let { it.startsWith("q") || it == "quarterly" || it == "ttm" }

fun FinancialHistoryRowView.periodLabel(): String = period.trim().ifBlank { "FY$fiscalYear" }

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
    return FilingsFigures(
        period = latest.periodLabel(),
        priorPeriod = prior?.periodLabel(),
        revenue = latest.revenue,
        priorRevenue = prior?.revenue,
        growth = change(latest.revenue, prior?.revenue),
        operatingMargin = latest.operatingMargin,
        priorOperatingMargin = prior?.operatingMargin,
        fcfMargin = ratio(latest.freeCashFlow, latest.revenue),
        priorFcfMargin = prior?.let { ratio(it.freeCashFlow, it.revenue) },
        netCash = latest.netCash(),
        priorNetCash = prior?.netCash(),
        shareChange = change(latest.sharesOutstanding, prior?.sharesOutstanding),
        shares = latest.sharesOutstanding,
        priorShares = prior?.sharesOutstanding,
        annual = annual,
    )
}

/** A margin change in basis points from two fractions: 0.31 → 0.32 is "+100 bps". */
private fun marginDelta(now: Double?, before: Double?): Pair<String?, Tone> {
    if (now == null || before == null) return null to Tone.Neutral
    val points = (now - before) * 100.0
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
    val (fcfDelta, fcfTone) = marginDelta(f.fcfMargin, f.priorFcfMargin)
    return listOf(
        KpiSpec(
            label = NamesCopy.labelFor(NamesCopy.LABEL_REVENUE, f.period),
            value = Fmt.money(f.revenue),
            reference = if (f.priorPeriod != null && f.priorRevenue != null) NamesCopy.netCashWas(Fmt.money(f.priorRevenue), f.priorPeriod) else null,
        ),
        KpiSpec(
            label = NamesCopy.labelFor(NamesCopy.LABEL_GROWTH, f.period),
            value = if (f.growth == null) Fmt.NOT_COMPUTED else Fmt.signedPct(f.growth * 100.0),
            deltaTone = growthTone,
            reference = vs,
        ),
        KpiSpec(
            label = NamesCopy.labelFor(NamesCopy.LABEL_OPERATING, f.period),
            value = Fmt.pct(f.operatingMargin?.let { it * 100.0 }),
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
        KpiSpec(
            label = NamesCopy.labelFor(NamesCopy.LABEL_NET_CASH, f.period),
            value = Fmt.money(f.netCash),
            reference = if (f.priorPeriod != null && f.priorNetCash != null) NamesCopy.netCashWas(Fmt.money(f.priorNetCash), f.priorPeriod) else null,
        ),
        KpiSpec(
            label = NamesCopy.labelFor(NamesCopy.LABEL_SHARES, f.period),
            value = if (f.shareChange == null) Fmt.NOT_COMPUTED else Fmt.signedPct(f.shareChange * 100.0),
            reference = vs,
        ),
    )
}

/** The SourceSheet behind each filings tile, in [filingsKpis] order. */
fun filingsSource(f: FilingsFigures, index: Int): SourceInfo {
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
                pair(NamesCopy.LABEL_OPERATING, f.period, Fmt.pct(f.operatingMargin?.let { it * 100.0 })),
                pair(NamesCopy.LABEL_OPERATING, prior, Fmt.pct(f.priorOperatingMargin?.let { it * 100.0 })),
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
            NamesCopy.LABEL_NET_CASH, ScoreCopy.NET_CASH_DEFINITION, ScoreCopy.NET_CASH_DERIVATION,
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
    )
}

/** CompareTable's column limit. */
const val TABLE_YEARS = 4

private data class Quad(val a: String, val b: String, val c: String?, val d: List<Pair<String, String>>)

/**
 * The annual rows as a CompareTable (5.11 item 4); the latest year is the subject column. The kit's CompareTable
 * takes at most [TABLE_YEARS] value columns, so the table shows the latest four years (HANDOFF-B: five).
 */
fun filingsTable(f: FilingsFigures): CompareTableModel {
    val years = f.annual.takeLast(TABLE_YEARS)
    fun row(label: String, value: (FinancialHistoryRowView) -> String) = CompareRow(label, years.map(value))
    return CompareTableModel(
        columns = years.map { CompareColumn(it.periodLabel(), subject = it === years.last()) },
        rows = listOf(
            row(NamesCopy.LABEL_REVENUE) { Fmt.money(it.revenue) },
            row(NamesCopy.LABEL_GROSS) { Fmt.pct(it.grossMargin?.let { m -> m * 100.0 }) },
            row(NamesCopy.LABEL_OPERATING) { Fmt.pct(it.operatingMargin?.let { m -> m * 100.0 }) },
            row(NamesCopy.LABEL_NET_INCOME) { Fmt.money(it.netIncome) },
            row(NamesCopy.LABEL_FCF_ABS) { Fmt.money(it.freeCashFlow) },
            row(NamesCopy.LABEL_FCF) { r -> ratio(r.freeCashFlow, r.revenue)?.let { Fmt.pct(it * 100.0) } ?: Fmt.NOT_DISCLOSED },
            row(NamesCopy.LABEL_NET_CASH) { Fmt.money(it.netCash()) },
            row(NamesCopy.LABEL_SHARES_ABS) { Fmt.number(it.sharesOutstanding, 0) },
        ),
        labelHeader = NamesCopy.TABLE_METRIC,
    )
}

/** Direction words for a top change; the mark is ▲ for up and ▼ for down, nothing for mixed or watch. */
private fun directionOf(raw: String): Pair<String, Boolean?> = when (raw.trim().lowercase()) {
    "up", "improved", "positive" -> NamesCopy.CHANGE_UP to true
    "down", "weakened", "negative" -> NamesCopy.CHANGE_DOWN to false
    "mixed" -> NamesCopy.CHANGE_MIXED to null
    else -> NamesCopy.CHANGE_WATCH to null
}

/**
 * Since the last report (5.11 item 3) from the report's change summary: the previous view over the current one,
 * each with its filing line, and up to three changes. Null when the report has no comparison yet (first report),
 * which SinceLastReport shows as its caption. The drift badge waits for `thesisDrift` on ReportSummaryView (HANDOFF).
 */
fun sinceLastReportModel(summary: ReportSummaryView?, notes: List<NameNote>, fmt: Fmt, zone: ZoneId): SinceLastReportModel? {
    val change = summary?.changeSummary ?: return null
    fun line(filing: String?, atMs: Long?): String = listOfNotNull(
        filing,
        atMs?.let { fmt.shortDate(Instant.ofEpochMilli(it).atZone(zone).toLocalDate()) },
    ).joinToString(" · ").ifBlank { NamesCopy.PREVIOUS_REPORT }
    val currentAt = parseMs(summary.generatedAt)
    val previous = notes.firstOrNull { it.reportId != summary.reportId }
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
 * report is stored: [onBuildReport] runs only from the no-report state.
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
    now: Instant = Instant.now(),
    onRetry: () -> Unit = {},
    onFollowChange: (Boolean) -> Unit = {},
    onOpenReport: (reportId: String) -> Unit = {},
    onOpenReportChange: (reportId: String, change: Int) -> Unit = { id, _ -> onOpenReport(id) },
    onBuildReport: () -> Unit = {},
    onSaveNote: suspend (reportId: String, text: String) -> Boolean = { _, _ -> true },
    onLeaveNote: (reportId: String, text: String) -> Unit = { _, _ -> },
    onShareNote: ((String) -> Unit)? = null,
    onOpenWarRoom: (String) -> Unit = {},
    onSeeAlerts: (() -> Unit)? = null,
    onSeePro: () -> Unit = {},
    onCompareWith: () -> Unit = {},
    onCompareReports: (String, String) -> Unit = { _, _ -> },
    onPrevious: (() -> Unit)? = null,
    onNext: (() -> Unit)? = null,
) {
    val seed = LocalNameSeed.current
    val haptics = rememberHaptics()
    val clipboard = LocalClipboardManager.current
    val symbol = ticker.trim().uppercase()

    var source by remember { mutableStateOf(seed.source) }
    var moreOpen by rememberSaveable { mutableStateOf(seed.moreOpen) }
    var confirmRemove by rememberSaveable { mutableStateOf(seed.confirmRemove) }
    var showYears by rememberSaveable { mutableStateOf(seed.showYears) }
    var copied by remember { mutableStateOf(false) }

    val notes = remember(detail) { detail?.let(::nameNotes).orEmpty() }
    val figures = remember(detail?.summary) { detail?.summary?.annualHistory?.let(::filingsFigures) }
    val title = companyName?.trim()?.ifBlank { null }
        ?: detail?.summary?.companyName?.trim()?.ifBlank { null }
        ?: symbol
    val loading = detail == null && error == null

    val swipe = Modifier.pagerSwipe(onPrevious, onNext)

    Box(
        Modifier
            .fillMaxSize()
            .padding(padding.exceptTop()),
    ) {
        Column(
            Modifier
                .fillMaxSize()
                .then(swipe)
                .verticalScroll(rememberScrollState())
                .wrapDataWidth()
                .padding(horizontal = ThesisSpace.gutter)
                .padding(top = padding.calculateTopPadding(), bottom = ThesisSpace.x5),
        ) {
            NameToolbar(
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
                    now = now,
                    lastVisitAtMs = lastVisitAtMs,
                    warRoomId = warRoomId,
                    isPro = isPro,
                    journal = journal,
                    showYears = showYears,
                    copied = copied,
                    onShowYears = { showYears = !showYears },
                    onCopyTable = { table ->
                        clipboard.setText(AnnotatedString(table.toTsv()))
                        haptics.confirm()
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
    }

    source?.let { info -> SourceSheet(info = info, onDismissRequest = { source = null }) }

    if (moreOpen) {
        ThesisSheet(onDismissRequest = { moreOpen = false }, title = title.takeIf { it != symbol }?.let { "$symbol · $it" } ?: symbol) {
            SheetActionRow(ThesisIcons.Small.Compare, NamesCopy.COMPARE_WITH, {
                moreOpen = false
                onCompareWith()
            })
            if (figures != null) {
                SheetActionRow(ThesisIcons.Small.Copy, NamesCopy.COPY_FIGURES, {
                    moreOpen = false
                    clipboard.setText(AnnotatedString(filingsTable(figures).toTsv()))
                    haptics.confirm()
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

/** Swipe sideways to the previous or next name of the board (4.5); a quarter of the touch target width or more. */
private fun Modifier.pagerSwipe(onPrevious: (() -> Unit)?, onNext: (() -> Unit)?): Modifier {
    if (onPrevious == null && onNext == null) return this
    return this.then(
        Modifier.pointerInput(onPrevious, onNext) {
            val threshold = ThesisSpace.touchMin.toPx() * 2
            var dx = 0f
            detectHorizontalDragGestures(
                onDragStart = { dx = 0f },
                onDragEnd = {
                    when {
                        dx <= -threshold -> onNext?.invoke()
                        dx >= threshold -> onPrevious?.invoke()
                    }
                    dx = 0f
                },
                onDragCancel = { dx = 0f },
                onHorizontalDrag = { change, amount ->
                    dx += amount
                    change.consume()
                },
            )
        },
    )
}

/** The line above the header: the pager ("3 of 12" between previous and next) and the follow and overflow actions. */
@Composable
private fun NameToolbar(
    ticker: String,
    following: Boolean,
    pager: NamePager?,
    onPrevious: (() -> Unit)?,
    onNext: (() -> Unit)?,
    onFollow: () -> Unit,
    onMore: () -> Unit,
) {
    val p = LocalThesisPalette.current
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = ThesisSpace.touchMin),
        verticalAlignment = Alignment.CenterVertically,
    ) {
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
                ThesisIconButton(ThesisIcons.Back, NamesCopy.PREVIOUS_NAME, { onPrevious?.invoke() }, enabled = onPrevious != null)
                Text(
                    NamesCopy.pagerCaption(pager.position, pager.count),
                    modifier = Modifier.semantics { contentDescription = NamesCopy.pagerSpoken(pager.position, pager.count) },
                    style = ThesisType.caption,
                    color = p.muted,
                )
                ThesisIconButton(ThesisIcons.Forward, NamesCopy.NEXT_NAME, { onNext?.invoke() }, enabled = onNext != null)
            }
        }
        Spacer(Modifier.weight(1f))
        ThesisIconButton(
            icon = if (following) ThesisIcons.FollowFilled else ThesisIcons.Follow,
            contentDescription = if (following) NamesCopy.unfollow(ticker) else NamesCopy.follow(ticker),
            onClick = onFollow,
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

@Composable
private fun NameBody(
    detail: NameDetailView,
    notes: List<NameNote>,
    figures: FilingsFigures?,
    now: Instant,
    lastVisitAtMs: Long,
    warRoomId: String?,
    isPro: Boolean,
    journal: List<ConvictionJournalEntryView>,
    showYears: Boolean,
    copied: Boolean,
    onShowYears: () -> Unit,
    onCopyTable: (CompareTableModel) -> Unit,
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
    StateLine(detail, zone)
    snapshot?.reason?.trim()?.ifBlank { null }?.let { reason ->
        Spacer(Modifier.height(ThesisSpace.s))
        Text(reason, style = ThesisType.lede, color = LocalThesisPalette.current.ink2)
    }

    // ---- Monitor KPIs
    if (snapshot != null) {
        Spacer(Modifier.height(ThesisSpace.headerToSection))
        val tiles = remember(detail, lastVisitAtMs, now, fmt) { monitorTiles(detail, lastVisitAtMs, now, fmt, zone) }
        KpiGrid(items = tiles.map { it.first }, onItemClick = { onSource(tiles[it].second) })
    }

    // ---- Since the last report (item 3)
    if (summary != null) {
        Spacer(Modifier.height(ThesisSpace.sectionGapReading))
        // SinceLastReport carries its own kicker, so no SectionHeader above it.
        val model = remember(summary, notes, fmt) { sinceLastReportModel(summary, notes, fmt, zone) }
        SinceLastReport(model = model, onChangeClick = { onOpenReportChange(summary.reportId, it) })
        if (onSeeAlerts != null && detail.alerts.isNotEmpty()) {
            TextAction(NamesCopy.SEE_ALERTS, onSeeAlerts)
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
        KpiGrid(items = kpis, onItemClick = { onSource(filingsSource(figures, it)) })
        if (figures.annual.size >= 2) {
            Spacer(Modifier.height(ThesisSpace.s))
            TextAction(if (showYears) NamesCopy.HIDE_YEARS else NamesCopy.SHOW_YEARS, onShowYears)
            if (showYears) {
                val table = remember(figures) { filingsTable(figures) }
                Spacer(Modifier.height(ThesisSpace.s))
                CompareTable(table)
                TextAction(if (copied) NamesCopy.COPIED else NamesCopy.COPY_TABLE, { onCopyTable(table) })
            }
        }
    }

    // ---- Report card (item 5)
    Spacer(Modifier.height(ThesisSpace.sectionGapData))
    ReportCard(detail = detail, action = action, notes = notes, onOpenReport = onOpenReport, onBuildReport = onBuildReport)

    // ---- Your notes (item 6)
    Spacer(Modifier.height(ThesisSpace.sectionGapReading))
    NotesSection(
        ticker = ticker,
        notes = notes,
        reportCount = notes.size,
        onSaveNote = onSaveNote,
        onLeaveNote = onLeaveNote,
        onShareNote = onShareNote,
    )

    // ---- Earnings (item 7)
    if (warRoomId != null) {
        Spacer(Modifier.height(ThesisSpace.sectionGapData))
        val day = nextEarnings(detail.alerts, ticker, now.atZone(zone).toLocalDate())?.first
        ActionRow(
            icon = ThesisIcons.WarRoom,
            title = day?.let { NamesCopy.earningsOn(fmt.marketDate(it)) } ?: NamesCopy.WAR_ROOM,
            caption = NamesCopy.WAR_ROOM_CAPTION,
            onClick = { onOpenWarRoom(warRoomId) },
        )
    }

    // ---- Conviction journal (item 8)
    Spacer(Modifier.height(ThesisSpace.sectionGapData))
    JournalSection(isPro = isPro, journal = journal.filter { it.ticker.equals(ticker, ignoreCase = true) }, onSeePro = onSeePro)

    // ---- Reports (item 9)
    Spacer(Modifier.height(ThesisSpace.sectionGapData))
    ReportsSection(ticker = ticker, reports = detail.reports, notes = notes, zone = zone, onOpenReport = onOpenReport, onCompareReports = onCompareReports)
}

/** StatusBadge with the state and its change caption: "Was Intact on 21 Nov" or "Unchanged since 21 Nov". */
@Composable
private fun StateLine(detail: NameDetailView, zone: ZoneId) {
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
            val on = fmt.shortDate(Instant.ofEpochMilli(it.takenAtMs).atZone(zone).toLocalDate())
            if (detail.delta.stateChanged) NamesCopy.wasState(stateWordOf(it.state), on) else NamesCopy.unchangedSince(on)
        }
        if (caption != null) {
            Text(caption, style = ThesisType.caption, color = p.muted, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
    }
}

/** The four monitor tiles with their SourceSheets: score, freshness, alerts, and next earnings or events. */
internal fun monitorTiles(detail: NameDetailView, lastVisitAtMs: Long, now: Instant, fmt: Fmt, zone: ZoneId): List<Pair<KpiSpec, SourceInfo>> {
    val s = detail.snapshot ?: return emptyList()
    val ticker = detail.ticker.trim().uppercase()
    val score = scoreOutOf100(s.score)
    val previous = detail.delta?.previous
    val since = previous?.let { fmt.shortDate(Instant.ofEpochMilli(it.takenAtMs).atZone(zone).toLocalDate()) }
    val change = if (previous != null && score != null) scoreOutOf100(previous.score)?.let { score - it } else null
    val changeTone = when {
        change == null || abs(change) < 0.5 -> Tone.Neutral
        change > 0 -> Tone.Favourable
        else -> Tone.Unfavourable
    }
    val reportAt = parseMs(s.lastDeepDiveAt) ?: parseMs(s.reportGeneratedAt)
    val period = detail.summary?.filingPeriod?.ifBlank { null }
    val reportAge = reportAt?.let { fmt.reportAge(NamesCopy.REPORT, Instant.ofEpochMilli(it), period) }
    val freshness = NamesCopy.freshnessWord(s.freshnessState)

    val scoreTile = KpiSpec(
        label = NamesCopy.KPI_SCORE,
        value = Fmt.score(score),
        delta = change?.takeIf { abs(it) >= 0.5 }?.let { Fmt.pts(it) },
        deltaTone = changeTone,
        reference = when {
            since == null -> NamesCopy.SCALE_100
            change != null && abs(change) >= 0.5 -> NamesCopy.since(since)
            else -> NamesCopy.unchangedSince(since)
        },
    ) to SourceInfo(
        metric = ScoreCopy.MONITOR_SCORE,
        definition = ScoreCopy.MONITOR_DEFINITION,
        period = period,
        filed = reportAt?.let { fmt.shortDate(Instant.ofEpochMilli(it).atZone(zone).toLocalDate()) },
        derivation = ScoreCopy.MONITOR_DERIVATION,
        inputs = ScoreCopy.monitorInputs(
            score = Fmt.score(score),
            state = stateWordOf(s.state),
            reason = s.reason,
            report = reportAge,
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
        period = period,
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

    val tickerAlerts = detail.alerts.filter { it.concerns(ticker) }
    val visited = lastVisitAtMs > 0L
    val newAlerts = if (visited) tickerAlerts.count { (parseMs(it.createdAt) ?: 0L) > lastVisitAtMs } else tickerAlerts.size
    val visitDay = if (visited) fmt.shortDate(Instant.ofEpochMilli(lastVisitAtMs).atZone(zone).toLocalDate()) else null
    val alertsTile = KpiSpec(
        label = if (visited) NamesCopy.KPI_ALERTS else NamesCopy.KPI_ALERTS_ALL,
        value = Fmt.number(newAlerts.toLong()),
        reference = visitDay?.let { NamesCopy.since(it) },
    ) to SourceInfo(
        metric = if (visited) ScoreCopy.ALERTS else NamesCopy.KPI_ALERTS_ALL,
        definition = ScoreCopy.ALERTS_DEFINITION,
        inputs = listOfNotNull(
            NamesCopy.KPI_ALERTS_ALL to Fmt.number(tickerAlerts.size.toLong()),
            visitDay?.let { NamesCopy.LAST_VISIT to it },
        ),
    )

    val earnings = nextEarnings(detail.alerts, ticker, now.atZone(zone).toLocalDate())
    val fourth = if (earnings != null) {
        val (day, fromWarRoom) = earnings
        KpiSpec(
            label = NamesCopy.KPI_EARNINGS,
            value = fmt.marketDate(day),
            reference = if (fromWarRoom) NamesCopy.FROM_WAR_ROOM else NamesCopy.FROM_ALERT,
        ) to SourceInfo(
            metric = ScoreCopy.EARNINGS,
            definition = ScoreCopy.EARNINGS_DEFINITION,
            inputs = listOf(NamesCopy.KPI_EARNINGS to fmt.marketDate(day)),
        )
    } else {
        KpiSpec(
            label = NamesCopy.KPI_EVENTS,
            value = Fmt.number(s.materialEventsCount.toLong()),
            reference = if (s.unreviewedEventsCount > 0) NamesCopy.eventsOf(s.unreviewedEventsCount, s.materialEventsCount) else NamesCopy.NO_EVENTS,
        ) to SourceInfo(
            metric = ScoreCopy.EVENTS,
            definition = ScoreCopy.EVENTS_DEFINITION,
            period = period,
            inputs = listOf(
                NamesCopy.MATERIAL_EVENTS to Fmt.number(s.materialEventsCount.toLong()),
                NamesCopy.UNREVIEWED_EVENTS to Fmt.number(s.unreviewedEventsCount.toLong()),
            ),
        )
    }
    return listOf(scoreTile, freshnessTile, alertsTile, fourth)
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
                Spacer(Modifier.height(ThesisSpace.l))
                PrimaryButton(NamesCopy.OPEN_REPORT, { onOpenReport(action.reportId) }, Modifier.fillMaxWidth())
            }
        }
        NameReportAction.Build -> ThesisCard(eyebrow = NamesCopy.DEEP_DIVE, title = NamesCopy.noReportTitle(ticker)) {
            Text(NamesCopy.NO_REPORT_BODY, style = ThesisType.bodySmall, color = p.ink2)
            Spacer(Modifier.height(ThesisSpace.l))
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
    onSaveNote: suspend (String, String) -> Boolean,
    onLeaveNote: (String, String) -> Unit,
    onShareNote: ((String) -> Unit)?,
) {
    val fmt = LocalFmt.current
    val zone = ZoneId.systemDefault()
    val clipboard = LocalClipboardManager.current
    val written = notes.count { it.text.isNotBlank() }
    SectionHeader(
        kicker = NamesCopy.NOTES_KICKER,
        headline = NamesCopy.notesHeadline(written, reportCount),
        deck = NamesCopy.NOTES_CAPTION,
    )
    Spacer(Modifier.height(ThesisSpace.l))
    val newest = notes.firstOrNull()
    if (newest == null) {
        Callout(NamesCopy.NOTES_NEED_REPORT)
        return
    }
    var draft by rememberSaveable(newest.reportId) { mutableStateOf(newest.text) }
    val entries = notes.mapIndexed { i, n ->
        NoteEntry(
            key = n.reportId,
            filing = n.filing ?: NamesCopy.DEEP_DIVE,
            date = n.atMs?.let { fmt.shortDate(Instant.ofEpochMilli(it).atZone(zone).toLocalDate()) } ?: Fmt.NOT_DISCLOSED,
            text = if (i == 0) draft else n.text,
            verdict = n.verdict,
        )
    }
    NotesTrail(
        entries = entries,
        onCarryForward = { draft = it.text },
    ) { entry ->
        val autosave = rememberNoteAutosave(
            text = draft,
            save = { text -> onSaveNote(entry.key, text) },
            onLeave = { text -> onLeaveNote(entry.key, text) },
        )
        NoteBlock(
            value = draft,
            onValueChange = { draft = it },
            filing = entry.filing,
            saveState = autosave.state,
            onRetry = autosave::retry,
            onCopy = { clipboard.setText(AnnotatedString(draft)) }.takeIf { draft.isNotBlank() },
            onShare = onShareNote?.let { share -> { share("$ticker · ${entry.filing}\n\n$draft") } }?.takeIf { draft.isNotBlank() },
        )
    }
}

/** Conviction journal (5.11 item 8): the Timeline for Pro, one Callout with See Pro otherwise. */
@Composable
private fun JournalSection(isPro: Boolean, journal: List<ConvictionJournalEntryView>, onSeePro: () -> Unit) {
    val fmt = LocalFmt.current
    if (!isPro) {
        SectionHeader(kicker = NamesCopy.JOURNAL_KICKER, headline = NamesCopy.JOURNAL_PRO_HEADLINE)
        Spacer(Modifier.height(ThesisSpace.m))
        Callout(NamesCopy.JOURNAL_PRO)
        TextAction(NamesCopy.SEE_PRO, onSeePro)
        return
    }
    SectionHeader(kicker = NamesCopy.JOURNAL_KICKER, headline = NamesCopy.journalHeadline(journal.size))
    if (journal.isEmpty()) return
    Spacer(Modifier.height(ThesisSpace.l))
    val sorted = journal.sortedByDescending { parseMs(it.eventAt) ?: 0L }.take(JOURNAL_MAX)
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
    val mine = reports
        .filter { it.ticker == null || it.ticker.equals(ticker, ignoreCase = true) }
        .distinctBy { it.reportId }
        .sortedByDescending { parseMs(it.createdAt) ?: 0L }
    var selecting by rememberSaveable { mutableStateOf(seed.selectReports != null) }
    var selected by rememberSaveable { mutableStateOf(seed.selectReports.orEmpty()) }
    SectionHeader(
        kicker = NamesCopy.REPORTS_KICKER,
        headline = NamesCopy.reportsHeadline(mine.size),
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
            val caption = listOfNotNull(
                date.takeIf { note?.filing != null },
                NamesCopy.WITH_NOTE.takeIf { note?.text?.isNotBlank() == true },
            ).joinToString(" · ").ifBlank { null }
            val segment = Modifier.rowGroupSegment(RowPosition.of(i, mine.size), LeadingRowDividerInset)
            if (selecting) {
                SelectableReportRow(
                    title = title,
                    caption = caption,
                    selected = report.reportId in selected,
                    modifier = segment,
                    onToggle = {
                        selected = when {
                            report.reportId in selected -> selected - report.reportId
                            selected.size >= 2 -> selected.drop(1) + report.reportId
                            else -> selected + report.reportId
                        }
                    },
                )
            } else {
                Box(segment) {
                    ActionRow(icon = ThesisIcons.DeepDive, title = title, caption = caption, onClick = { onOpenReport(report.reportId) })
                }
            }
        }
    }
    if (selecting) {
        Spacer(Modifier.height(ThesisSpace.m))
        Text(NamesCopy.PICK_TWO, style = ThesisType.caption, color = LocalThesisPalette.current.muted)
        Spacer(Modifier.height(ThesisSpace.s))
        PrimaryButton(
            text = NamesCopy.COMPARE_REPORTS,
            onClick = {
                val (a, b) = selected
                selecting = false
                selected = emptyList()
                onCompareReports(a, b)
            },
            modifier = Modifier.fillMaxWidth(),
            enabled = selected.size == 2,
        )
    }
}

@Composable
private fun SelectableReportRow(title: String, caption: String?, selected: Boolean, modifier: Modifier, onToggle: () -> Unit) {
    val p = LocalThesisPalette.current
    val source = remember { MutableInteractionSource() }
    Row(
        modifier
            .fillMaxWidth()
            .toggleable(value = selected, interactionSource = source, indication = null, role = Role.Checkbox, onValueChange = { onToggle() })
            .thesisPress(source)
            .heightIn(min = ThesisSpace.rowMinComfortable)
            .padding(horizontal = ThesisSpace.l, vertical = ThesisSpace.rowPaddingV),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.width(ThesisSpace.leadingColumn), contentAlignment = Alignment.CenterStart) {
            ThesisCheckbox(checked = selected, onCheckedChange = null)
        }
        Spacer(Modifier.width(ThesisSpace.leadingGap))
        Column(Modifier.weight(1f)) {
            Text(title, style = ThesisType.rowTitle, color = p.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (caption != null) Text(caption, style = ThesisType.caption, color = p.muted, maxLines = 1)
        }
    }
}
