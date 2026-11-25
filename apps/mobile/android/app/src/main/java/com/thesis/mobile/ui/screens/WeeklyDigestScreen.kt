package com.thesis.mobile.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
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
import com.thesis.mobile.ui.components.SectionHeader
import com.thesis.mobile.ui.components.ThesisTopBar
import com.thesis.mobile.ui.components.TickerRow
import com.thesis.mobile.ui.copy.TodayCopy
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.format.LocalFmt
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.motion.rememberDataEntranceCoordinator
import com.thesis.mobile.ui.motion.staggeredEntrance
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
) {
    val fmt = LocalFmt.current
    val clock = LocalTodayClock.current
    val pulseLine = remember(pulse, watchlist) {
        pulse?.let { PulseBrief.from(it, watchlist) }?.let { b -> b.morningLine.ifBlank { b.leadConclusion } }
    }
    val model = remember(digestDate, sentimentCurrent, sentimentHistory, watchlist, monitorSnapshots, alerts, stateChanges, reportSummaries, pulseLine) {
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
    val density = LocalDensity.current
    var barHeightPx by remember { mutableIntStateOf(0) }
    val barHeight = with(density) { barHeightPx.toDp() }
    val coordinator = rememberDataEntranceCoordinator(dataKey = model.end)
    val entrance: Modifier.(Int) -> Modifier = { i -> staggeredEntrance(i, coordinator) }

    Box(Modifier.fillMaxSize()) {
        LazyColumn(
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
                        .entrance(0)
                        .padding(horizontal = ThesisSpace.gutter)
                        .padding(top = ThesisSpace.headerTop),
                )
            }
            if (model.isEmpty) {
                item(key = "empty") {
                    EmptyState(
                        sentence = TodayCopy.DIGEST_NO_DATA,
                        how = TodayCopy.DIGEST_NO_DATA_HOW,
                        modifier = Modifier.padding(ThesisSpace.gutter),
                    )
                }
            } else {
                digest(model, entrance, onOpenDashboard, onOpenReport, onOpenName, onOpenInbox, onOpenPulse)
            }
        }
        ThesisTopBar(
            modifier = Modifier.onSizeChanged { barHeightPx = it.height },
            title = TodayCopy.DIGEST_TITLE,
            subtitle = fmt.weekRange(model.start, model.end),
            onBack = onBack,
            titleAlwaysVisible = true,
        )
    }
}

private fun LazyListScope.digest(
    model: DigestModel,
    entrance: Modifier.(Int) -> Modifier,
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
                value = model.filings.size.toString(),
                reference = TodayCopy.amongNames(model.total),
            ),
            KpiSpec(
                label = TodayCopy.KPI_STATE_CHANGES,
                value = model.stateChanges?.size?.toString() ?: Fmt.NOT_COMPUTED,
                reference = TodayCopy.LAST_7_DAYS,
            ),
            KpiSpec(
                label = TodayCopy.KPI_ALERTS,
                value = model.alertsTotal.toString(),
                reference = TodayCopy.LAST_7_DAYS,
            ),
        )
        KpiGrid(
            items = items,
            modifier = Modifier
                .entrance(1)
                .padding(horizontal = ThesisSpace.gutter)
                .padding(top = ThesisSpace.headerToSection),
        )
    }

    item(key = "filings") {
        Section(Modifier.entrance(2)) {
            SectionHeader(kicker = TodayCopy.FILINGS_KICKER, headline = TodayCopy.filingsHeadline(model.filings.size))
            if (model.filings.isNotEmpty()) {
                RowGroup {
                    model.filings.forEach { f ->
                        row(LeadingRowDividerInset) {
                            TickerRow(
                                ticker = f.ticker,
                                stateTone = f.tone,
                                stateLabel = f.stateLabel,
                                line2 = f.sub,
                                onClick = {
                                    when {
                                        f.reportId != null && onOpenReport != null -> onOpenReport(f.reportId, f.ticker)
                                        onOpenName != null -> onOpenName(f.ticker)
                                    }
                                },
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
            Section(Modifier.entrance(3)) {
                SectionHeader(kicker = TodayCopy.MACRO_KICKER, headline = macro.title)
                PressableCard(onClick = onOpenDashboard, onClickLabel = TodayCopy.OPEN_MACRO) {
                    val p = LocalThesisPalette.current
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
                }
            }
        }
    }

    item(key = "states") {
        Section(Modifier.entrance(4)) {
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
                            )
                        }
                    }
                }
            }
        }
    }

    item(key = "alerts") {
        Section(Modifier.entrance(5)) {
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
                                onClick = { onOpenInbox?.invoke(c.category) },
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
            Section(Modifier.entrance(6)) {
                SectionHeader(kicker = TodayCopy.LATEST_PULSE_KICKER, headline = PulseText.oneSentence(pulseLine))
                RowGroup {
                    row(LeadingRowDividerInset) {
                        ActionRow(icon = ThesisIcons.Pulse, title = TodayCopy.OPEN_PULSE, onClick = { onOpenPulse?.invoke() })
                    }
                }
            }
        }
    }
}

@Composable
private fun Section(modifier: Modifier, content: @Composable () -> Unit) {
    Column(
        modifier
            .padding(horizontal = ThesisSpace.gutter)
            .padding(top = ThesisSpace.sectionGapData),
        verticalArrangement = Arrangement.spacedBy(ThesisSpace.m),
    ) { content() }
}
