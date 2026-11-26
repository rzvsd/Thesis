package com.thesis.mobile.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.SubcomposeLayout
import androidx.compose.ui.unit.Dp
import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.ReportSummaryView
import com.thesis.mobile.model.SentimentSnapshotView
import com.thesis.mobile.model.SnapshotDelta
import com.thesis.mobile.model.ThesisMonitorSnapshotView
import com.thesis.mobile.ui.charts.kit.ChartMath
import com.thesis.mobile.ui.charts.kit.Sparkline
import com.thesis.mobile.ui.components.ActionRow
import com.thesis.mobile.ui.components.EmptyState
import com.thesis.mobile.ui.components.KpiGrid
import com.thesis.mobile.ui.components.KpiSpec
import com.thesis.mobile.ui.components.LeadingRowDividerInset
import com.thesis.mobile.ui.components.PressableCard
import com.thesis.mobile.ui.components.RowGroup
import com.thesis.mobile.ui.components.ScreenHeader
import com.thesis.mobile.ui.components.SkeletonKpiGrid
import com.thesis.mobile.ui.components.SkeletonRow
import com.thesis.mobile.ui.components.SkeletonText
import com.thesis.mobile.ui.components.rememberTopBarCollapsed
import com.thesis.mobile.ui.components.SectionHeader
import com.thesis.mobile.ui.components.ThesisTopBar
import com.thesis.mobile.ui.components.TickerRow
import com.thesis.mobile.ui.copy.TodayCopy
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.format.LocalFmt
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.motion.ShimmerHost
import com.thesis.mobile.ui.motion.rememberShowSkeleton
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone
import com.thesis.mobile.ui.theme.alertCategoryColor
import com.thesis.mobile.ui.today.CategoryCountRow
import com.thesis.mobile.ui.today.DigestBuilder
import com.thesis.mobile.ui.today.DigestModel
import com.thesis.mobile.ui.today.LocalTodayClock
import com.thesis.mobile.ui.today.PulseBrief
import com.thesis.mobile.ui.today.PulseText
import com.thesis.mobile.ui.today.inert

/*
 * The weekly digest, "This week" (docs/app-redesign/DESIGN-DIRECTION.md 5.8): built only from data the app already
 * has (monitor snapshots, the macro stress history, the alert ledger, the snapshot history and the latest Pulse).
 * A top bar with the week's range, a lede generated from facts, four result KPIs, then the week's new filings,
 * macro stress over seven days, state changes, alerts by category and the latest Pulse line. Nothing daily is
 * presented as weekly, and no raw status strings.
 */

@Composable
fun WeeklyDigestScreen(
    digestDate: String?,
    sentimentCurrent: SentimentSnapshotView?,
    watchlist: List<String>,
    monitorSnapshots: List<ThesisMonitorSnapshotView>,
    pulse: PulseReportView?,
    onOpenDashboard: () -> Unit,
    onBack: () -> Unit,
    /** The shell's padding (bottom: the navigation bar). */
    padding: PaddingValues = PaddingValues(),
    sentimentHistory: List<SentimentSnapshotView> = emptyList(),
    /** The alert ledger; this week's alerts are counted by category. */
    alerts: List<AlertLedgerItemView> = emptyList(),
    /** Monitor readings now against a week ago (the local snapshot history); null when not available. */
    stateChanges: List<SnapshotDelta>? = null,
    /** Cached report summaries by report id, for each filing's change line. */
    reportSummaries: Map<String, ReportSummaryView> = emptyMap(),
    onOpenReport: ((reportId: String, ticker: String) -> Unit)? = null,
    onOpenName: ((String) -> Unit)? = null,
    onOpenInbox: ((category: String) -> Unit)? = null,
    onOpenPulse: (() -> Unit)? = null,
    /**
     * The cached state the digest is built from is still loading (the shell's first load after launch): with
     * nothing to show yet, a skeleton instead of "Nothing to sum up yet". The digest has no error state of its
     * own: it never fetches, it only reads what the other screens already loaded.
     */
    loading: Boolean = false,
) {
    val fmt = LocalFmt.current
    val clock = LocalTodayClock.current
    val pulseLine = remember(pulse, watchlist) {
        pulse?.let { PulseBrief.from(it, watchlist) }?.let { b -> b.morningLine.ifBlank { b.leadConclusion } }
    }
    // The clock and the formatter are keys: a change of the 24 h, locale or date setting re-reads the range and captions.
    val model = remember(digestDate, sentimentCurrent, sentimentHistory, watchlist, monitorSnapshots, alerts, stateChanges, reportSummaries, pulseLine, clock, fmt) {
        DigestBuilder.build(
            digestDate = digestDate,
            clock = clock,
            fmt = fmt,
            watchlist = watchlist,
            monitorSnapshots = monitorSnapshots,
            sentimentCurrent = sentimentCurrent,
            sentimentHistory = sentimentHistory,
            alerts = alerts,
            weeklyDeltas = stateChanges,
            reportSummaries = reportSummaries,
            pulseLine = pulseLine,
            pulseDate = pulse?.cycleEnd,
        )
    }
    // Nothing for the skeleton's grace period, then the skeleton while the cached state is still arriving.
    val showSkeleton = rememberShowSkeleton(loading = loading && model.isEmpty)
    val list = rememberLazyListState()
    val collapsed by rememberTopBarCollapsed(list)

    // A pushed screen arrives whole with the push transition: no entrance stagger here (spec 4.3 rule 2).
    BarOverContent(
        bar = {
            ThesisTopBar(
                title = TodayCopy.DIGEST_TITLE,
                subtitle = fmt.weekRange(model.start, model.end),
                onBack = onBack,
                collapsed = collapsed,
                titleAlwaysVisible = true,
            )
        },
    ) { barHeight ->
        LazyColumn(
            state = list,
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                top = barHeight,
                bottom = padding.calculateBottomPadding() + ThesisSpace.x5,
            ),
        ) {
            item(key = "header") {
                ScreenHeader(
                    title = TodayCopy.THIS_WEEK,
                    deck = if (model.isEmpty) null else model.lede,
                    modifier = Modifier
                        .padding(horizontal = ThesisSpace.gutter)
                        .padding(top = ThesisSpace.headerTop),
                )
            }
            when {
                !model.isEmpty -> digest(model, onOpenDashboard, onOpenReport, onOpenName, onOpenInbox, onOpenPulse)
                showSkeleton -> item(key = "loading") { DigestSkeleton() }
                loading -> Unit
                else -> item(key = "empty") {
                    EmptyState(
                        sentence = TodayCopy.DIGEST_NO_DATA,
                        how = TodayCopy.DIGEST_NO_DATA_HOW,
                        modifier = Modifier.padding(ThesisSpace.gutter),
                    )
                }
            }
        }
    }
}

/**
 * The top bar over the list, measured before the list so the list's top padding is right on the first frame (a
 * pushed screen that arrives whole must not settle by a bar's height after its first paint).
 */
@Composable
private fun BarOverContent(bar: @Composable () -> Unit, content: @Composable (Dp) -> Unit) {
    SubcomposeLayout(Modifier.fillMaxSize()) { constraints ->
        val loose = constraints.copy(minWidth = 0, minHeight = 0)
        val bars = subcompose(DigestSlot.Bar, bar).map { it.measure(loose) }
        val barHeight = bars.maxOfOrNull { it.height } ?: 0
        val body = subcompose(DigestSlot.Body) { content(barHeight.toDp()) }.map { it.measure(constraints) }
        layout(constraints.maxWidth, constraints.maxHeight) {
            body.forEach { it.place(0, 0) }
            bars.forEach { it.place(0, 0) }
        }
    }
}

private enum class DigestSlot { Bar, Body }

/** No cached state yet: the KPI grid and a section (header, two rows in their card) in skeleton form, under the header. */
@Composable
private fun DigestSkeleton() {
    ShimmerHost {
        Column(
            Modifier
                .padding(horizontal = ThesisSpace.gutter)
                .padding(top = ThesisSpace.headerToSection),
            verticalArrangement = Arrangement.spacedBy(ThesisSpace.sectionGapData),
        ) {
            SkeletonKpiGrid(featured = true)
            Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.xs)) {
                SkeletonText(ThesisType.kicker, widthFraction = 0.3f)
                SkeletonText(ThesisType.headline, widthFraction = 0.75f)
            }
            // In their card, as the loaded lists are, so the crossfade changes no shapes.
            RowGroup { repeat(2) { row(LeadingRowDividerInset) { SkeletonRow() } } }
        }
    }
}

private fun LazyListScope.digest(
    model: DigestModel,
    onOpenDashboard: () -> Unit,
    onOpenReport: ((String, String) -> Unit)?,
    onOpenName: ((String) -> Unit)?,
    onOpenInbox: ((String) -> Unit)?,
    onOpenPulse: (() -> Unit)?,
) {
    item(key = "kpis") {
        val macro = model.macro
        val items = listOf(
            KpiSpec(
                label = TodayCopy.KPI_MACRO,
                value = macro?.let { Fmt.score(it.score) } ?: Fmt.NOT_COMPUTED,
                delta = macro?.deltaValue,
                deltaTone = macro?.deltaTone ?: Tone.Neutral,
                reference = macro?.deltaReference ?: macro?.label,
            ),
            KpiSpec(
                label = TodayCopy.KPI_FILINGS,
                value = Fmt.number(model.filings.size.toLong()),
                reference = TodayCopy.amongNames(model.total),
            ),
            KpiSpec(
                label = TodayCopy.KPI_STATE_CHANGES,
                value = model.stateChanges?.let { Fmt.number(it.size.toLong()) } ?: Fmt.NOT_COMPUTED,
                reference = TodayCopy.LAST_7_DAYS,
            ),
            KpiSpec(
                label = TodayCopy.KPI_ALERTS,
                value = Fmt.number(model.alertsTotal.toLong()),
                reference = TodayCopy.LAST_7_DAYS,
            ),
        )
        // The screen's one featured grid: serif figures, as the Deep Dive KPI strip (V1).
        KpiGrid(
            items = items,
            featured = true,
            modifier = Modifier
                .padding(horizontal = ThesisSpace.gutter)
                .padding(top = ThesisSpace.headerToSection),
        )
    }

    item(key = "filings") {
        Section {
            SectionHeader(kicker = TodayCopy.FILINGS_KICKER, headline = TodayCopy.filingsHeadline(model.filings.size))
            if (model.filings.isNotEmpty()) {
                RowGroup {
                    model.filings.forEach { f ->
                        row(LeadingRowDividerInset) {
                            val open: (() -> Unit)? = when {
                                f.reportId != null && onOpenReport != null -> { { onOpenReport(f.reportId, f.ticker) } }
                                onOpenName != null -> { { onOpenName(f.ticker) } }
                                else -> null
                            }
                            TickerRow(
                                ticker = f.ticker,
                                stateTone = f.tone,
                                stateLabel = f.stateLabel,
                                line2 = f.sub,
                                onClick = { open?.invoke() },
                                modifier = if (open == null) Modifier.inert(spoken(f.ticker, f.stateLabel, f.sub)) else Modifier,
                            )
                        }
                    }
                }
            }
        }
    }

    val macro = model.macro
    if (macro != null) {
        item(key = "macro") {
            Section {
                SectionHeader(kicker = TodayCopy.MACRO_KICKER, headline = macro.title)
                PressableCard(onClick = onOpenDashboard, onClickLabel = TodayCopy.OPEN_MACRO) {
                    val p = LocalThesisPalette.current
                    // A line needs two readings: with one, a sentence instead of a lone dot over an empty chart.
                    if (macro.spark.count { it != null } >= 2) {
                        Sparkline(
                            values = macro.spark,
                            contentDescription = ChartMath.summary(
                                subject = TodayCopy.MACRO_SPARK_SUBJECT,
                                values = macro.spark,
                                format = { Fmt.score(it) },
                                window = TodayCopy.LAST_7_DAYS,
                            ),
                            modifier = Modifier.fillMaxWidth(),
                            dataKey = macro.day,
                        )
                        Text(TodayCopy.MACRO_WEEK_SCALE, style = ThesisType.caption, color = p.muted)
                    } else {
                        Text(TodayCopy.macroOneReading(Fmt.score(macro.score)), style = ThesisType.bodySmall, color = p.ink2)
                    }
                }
            }
        }
    }

    item(key = "states") {
        Section {
            SectionHeader(kicker = TodayCopy.STATE_KICKER, headline = TodayCopy.stateChangesHeadline(model.stateChanges?.size))
            val rows = model.stateChanges.orEmpty()
            if (rows.isNotEmpty()) {
                RowGroup {
                    rows.forEach { r ->
                        row(LeadingRowDividerInset) {
                            TickerRow(
                                ticker = r.ticker,
                                stateTone = r.tone,
                                stateLabel = r.stateLabel,
                                line2 = r.line2,
                                onClick = { onOpenName?.invoke(r.ticker) },
                                modifier = if (onOpenName == null) Modifier.inert(spoken(r.ticker, r.stateLabel, r.line2)) else Modifier,
                            )
                        }
                    }
                }
            }
        }
    }

    item(key = "alerts") {
        Section {
            SectionHeader(
                kicker = TodayCopy.ALERTS_KICKER,
                headline = TodayCopy.alertsHeadline(model.alertsTotal, model.alerts.firstOrNull()?.label),
            )
            if (model.alerts.isNotEmpty()) {
                RowGroup {
                    model.alerts.forEach { c ->
                        row(LeadingRowDividerInset) {
                            CategoryCountRow(
                                color = alertCategoryColor(c.category),
                                label = c.label,
                                count = c.count,
                                onClick = onOpenInbox?.let { open -> { open(c.category) } },
                            )
                        }
                    }
                }
            }
        }
    }

    val pulseLine = model.pulseLine
    if (pulseLine != null) {
        item(key = "pulse") {
            Section {
                SectionHeader(kicker = TodayCopy.LATEST_PULSE_KICKER, headline = PulseText.oneSentence(pulseLine))
                // The row only when it can open the Pulse.
                if (onOpenPulse != null) {
                    RowGroup {
                        row(LeadingRowDividerInset) {
                            ActionRow(icon = ThesisIcons.Pulse, title = TodayCopy.OPEN_PULSE, onClick = onOpenPulse)
                        }
                    }
                }
            }
        }
    }
}

/** What TalkBack reads for a row that opens nothing: "MSFT, Watch, Intact → Watch, Mon". */
private fun spoken(vararg parts: String?): String = parts.filterNotNull().filter { it.isNotBlank() }.joinToString(", ")

@Composable
private fun Section(content: @Composable () -> Unit) {
    Column(
        Modifier
            .padding(horizontal = ThesisSpace.gutter)
            .padding(top = ThesisSpace.sectionGapData),
        verticalArrangement = Arrangement.spacedBy(ThesisSpace.m),
    ) { content() }
}
