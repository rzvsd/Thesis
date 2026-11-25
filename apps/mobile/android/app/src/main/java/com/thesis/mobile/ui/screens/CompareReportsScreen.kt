package com.thesis.mobile.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
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
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone
import com.thesis.mobile.ui.theme.thesisStateTone
import java.time.Instant
import java.time.ZoneId

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

@Immutable
internal data class CompareReportsModel(
    val ticker: String,
    val company: String?,
    val older: ReportSide,
    val newer: ReportSide,
    val basis: String,
    val table: CompareTableModel,
    /** The result ("Revenue up 6.4%, operating margin +50 bps"), the screen title; null when neither is known. */
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

private fun signedMoney(d: Double?): String? = d?.let { (if (it > 0) "+" else "") + Fmt.money(it) }

/** Share counts in the compact money style, without the currency: "15.2B". */
private fun compactCount(v: Double?): String = Fmt.money(v).replaceFirst("$", "")

/**
 * The pair [a], [b] as Compare reports shows it: older first, like for like only, with the key-figure table
 * (each report's own figures for its own filing), the change column named by its basis, a headline built from the
 * revenue and operating-margin changes, and the newer report's "Since the last report" block when the older one
 * is the report it was compared with.
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
    val revD = pctChange(v(fo?.revenue), v(fn?.revenue))
    val opD = v(fn?.operatingMarginPct)?.let { n -> v(fo?.operatingMarginPct)?.let { n - it } }
    val rows = listOf(
        CompareRow(
            ResearchCopy.ROW_REVENUE,
            listOf(Fmt.money(v(fo?.revenue), missing = word(fo?.revenue)), Fmt.money(v(fn?.revenue), missing = word(fn?.revenue))),
            delta = revD?.let { Fmt.signedPct(it) },
            deltaTone = toneOf(revD),
        ),
        CompareRow(
            ResearchCopy.ROW_GROWTH_SHORT,
            listOf(Fmt.signedPct(v(fo?.revenueGrowthPct), missing = word(fo?.revenueGrowthPct)), Fmt.signedPct(v(fn?.revenueGrowthPct), missing = word(fn?.revenueGrowthPct))),
            delta = v(fn?.revenueGrowthPct)?.let { n -> v(fo?.revenueGrowthPct)?.let { Fmt.bpsFromPoints(n - it) } },
        ),
        marginRow(ResearchCopy.ROW_GROSS, fo?.grossMarginPct, fn?.grossMarginPct),
        marginRow(ResearchCopy.ROW_OPERATING_SHORT, fo?.operatingMarginPct, fn?.operatingMarginPct),
        run {
            val d = pctChange(v(fo?.freeCashFlow), v(fn?.freeCashFlow))
            CompareRow(
                ResearchCopy.ROW_FCF_SHORT,
                listOf(Fmt.money(v(fo?.freeCashFlow), missing = word(fo?.freeCashFlow)), Fmt.money(v(fn?.freeCashFlow), missing = word(fn?.freeCashFlow))),
                delta = d?.let { Fmt.signedPct(it) },
                deltaTone = toneOf(d),
            )
        },
        run {
            val d = v(fn?.netCash)?.let { n -> v(fo?.netCash)?.let { n - it } }
            CompareRow(
                ResearchCopy.ROW_NET_CASH,
                listOf(Fmt.money(v(fo?.netCash), missing = word(fo?.netCash)), Fmt.money(v(fn?.netCash), missing = word(fn?.netCash))),
                delta = signedMoney(d),
                deltaTone = toneOf(d),
            )
        },
        run {
            val d = pctChange(v(fo?.shares), v(fn?.shares))
            CompareRow(
                ResearchCopy.ROW_SHARES_SHORT,
                listOf(compactCount(v(fo?.shares)), compactCount(v(fn?.shares))),
                delta = d?.let { Fmt.signedPct(it) },
            )
        },
        run {
            val d = pctChange(v(fo?.eps), v(fn?.eps))
            CompareRow(
                ResearchCopy.ROW_EPS,
                listOf(Fmt.money(v(fo?.eps), missing = word(fo?.eps)), Fmt.money(v(fn?.eps), missing = word(fn?.eps))),
                delta = d?.let { Fmt.signedPct(it) },
                deltaTone = toneOf(d),
            )
        },
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
    fun built(side: ReportSide) = side.at?.let { fmt.shortDate(it.atZone(zone).toLocalDate()) }
    return ReportPair.Ready(
        CompareReportsModel(
            ticker = ticker,
            company = company,
            older = older,
            newer = newer,
            basis = basis,
            table = table,
            headline = ResearchCopy.compareReportsHeadline(revD, opD?.let { Fmt.bpsFromPoints(it) }),
            deck = ResearchCopy.compareReportsDeck(company ?: ticker, newer.form, built(older), built(newer)),
            since = sinceLastReportOf(older, newer, fmt, zone),
        ),
    )
}

private fun marginRow(label: String, older: Figure?, newer: Figure?): CompareRow {
    val o = older?.value?.takeIf { it.isFinite() }
    val n = newer?.value?.takeIf { it.isFinite() }
    val d = if (o != null && n != null) n - o else null
    return CompareRow(
        label,
        listOf(
            Fmt.pct(o, dp = 1, missing = older?.missing ?: Missing.NotComputed),
            Fmt.pct(n, dp = 1, missing = newer?.missing ?: Missing.NotComputed),
        ),
        delta = d?.let { Fmt.bpsFromPoints(it) },
        deltaTone = toneOf(d),
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

private fun sinceLastReportOf(older: ReportSide, newer: ReportSide, fmt: Fmt, zone: ZoneId): SinceLastReportModel? {
    val change = newer.report.changeSummary ?: return null
    val drift = newer.report.trustMetadata?.thesisDrift
    if (drift?.comparableReportId != null && drift.comparableReportId != older.report.reportId) return null
    fun line(side: ReportSide) = listOfNotNull(side.label, side.at?.let { fmt.shortDate(it.atZone(zone).toLocalDate()) }).joinToString(" · ")
    return SinceLastReportModel(
        previousView = change.previousView,
        previousFiling = line(older),
        currentView = change.currentView,
        currentFiling = line(newer),
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
 * the older one is the report it compared with), then the key figures each report was built on with the change
 * named by its basis, what each report concluded, and your notes on both. Copy as table. Frozen figures: no motion
 * beyond the push.
 *
 * Draws its own top bar ("Compare" + "AAPL · 10-K FY2024 vs 10-K FY2025"); the shell gives it none (HANDOFF-E).
 * [notes] is the ticker's notes trail (`state.notesTrails[ticker]`).
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
    zone: ZoneId = ZoneId.systemDefault(),
) {
    val fmt = LocalFmt.current
    val haptics = rememberHaptics()
    val clipboard = LocalClipboardManager.current
    val scroll = rememberScrollState()
    val collapsed by rememberTopBarCollapsed(scroll)
    var copied by remember { mutableStateOf(false) }
    val a = state?.a
    val b = state?.b
    val pair = remember(a, b, fmt, zone) { if (a != null && b != null) compareReportsModel(a, b, fmt, zone) else null }
    val ready = (pair as? ReportPair.Ready)?.model
    val copy = {
        if (ready != null) {
            clipboard.setText(AnnotatedString(ready.table.toTsv()))
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
            if (ready != null) ThesisIconButton(ThesisIcons.Copy, contentDescription = ResearchCopy.COPY_TABLE, onClick = copy)
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
                state == null || (state.isLoading && pair == null) -> {
                    ScreenHeader(title = ResearchCopy.COMPARE, eyebrow = ResearchCopy.COMPARE_REPORTS_EYEBROW)
                    Spacer(Modifier.height(ThesisSpace.headerToSection))
                    SkeletonCard(bodyLines = 4)
                    Spacer(Modifier.height(ThesisSpace.cardGap))
                    SkeletonCard(bodyLines = 6)
                }
                pair == null -> {
                    ScreenHeader(title = ResearchCopy.COMPARE, eyebrow = ResearchCopy.COMPARE_REPORTS_EYEBROW)
                    Spacer(Modifier.height(ThesisSpace.headerToSection))
                    ErrorState(
                        title = KitCopy.couldNotLoad(ResearchCopy.COMPARE_REPORTS_FAILED),
                        cause = state.error,
                        onRetry = onRetry,
                    )
                }
                ready == null -> {
                    ScreenHeader(title = ResearchCopy.COMPARE, eyebrow = ResearchCopy.COMPARE_REPORTS_EYEBROW)
                    Spacer(Modifier.height(ThesisSpace.headerToSection))
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
                    copied = copied,
                    onCopy = copy,
                    onOpenReport = onOpenReport,
                    onOpenChange = onOpenChange,
                    fmt = fmt,
                    zone = zone,
                )
            }
        }
    }
}

@Composable
private fun ColumnScope.CompareReportsBody(
    model: CompareReportsModel,
    notes: List<NoteTrailEntry>,
    copied: Boolean,
    onCopy: () -> Unit,
    onOpenReport: (String) -> Unit,
    onOpenChange: ((String, Int) -> Unit)?,
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
    FittedCompareTable(model = model.table, columnNames = listOf(model.older.label, model.newer.label), deltaName = ResearchCopy.THE_CHANGE)
    TextAction(
        if (copied) ResearchCopy.COPIED else ResearchCopy.COPY_TABLE,
        onClick = onCopy,
        modifier = Modifier.align(Alignment.End),
    )

    Spacer(Modifier.height(ThesisSpace.sectionGapData))
    SectionHeader(kicker = ResearchCopy.VERDICTS_KICKER, headline = ResearchCopy.VERDICTS_HEADLINE)
    Spacer(Modifier.height(ThesisSpace.m))
    ThesisCard {
        listOf(model.newer to true, model.older to false).forEachIndexed { i, (side, newer) ->
            if (i > 0) ThesisDivider()
            Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.xs)) {
                Eyebrow(
                    listOfNotNull(side.label, side.at?.let { fmt.marketDate(it.atZone(zone).toLocalDate()) }).joinToString(" · "),
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
        NotePreview(text = note.text, onEdit = { onOpenReport(side.report.reportId) }, filing = side.label)
    }
}
