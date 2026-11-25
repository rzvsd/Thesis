package com.thesis.mobile.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.model.LastViewedReport
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.SentimentSnapshotView
import com.thesis.mobile.model.SnapshotDelta
import com.thesis.mobile.model.ThesisMonitorSnapshotView
import com.thesis.mobile.ui.charts.kit.ChartMath
import com.thesis.mobile.ui.charts.kit.Sparkline
import com.thesis.mobile.ui.components.ActionRow
import com.thesis.mobile.ui.components.BannerTone
import com.thesis.mobile.ui.components.EmptyState
import com.thesis.mobile.ui.components.ErrorState
import com.thesis.mobile.ui.components.InlineBanner
import com.thesis.mobile.ui.components.Kicker
import com.thesis.mobile.ui.components.LeadingRowDividerInset
import com.thesis.mobile.ui.components.Loadable
import com.thesis.mobile.ui.components.PressableCard
import com.thesis.mobile.ui.components.RowGroup
import com.thesis.mobile.ui.components.ScreenHeader
import com.thesis.mobile.ui.components.SectionHeader
import com.thesis.mobile.ui.components.SkeletonBlock
import com.thesis.mobile.ui.components.SkeletonCard
import com.thesis.mobile.ui.components.SkeletonRow
import com.thesis.mobile.ui.components.SkeletonText
import com.thesis.mobile.ui.components.StateCrossfade
import com.thesis.mobile.ui.components.StatusBadge
import com.thesis.mobile.ui.components.TapeRow
import com.thesis.mobile.ui.components.TextAction
import com.thesis.mobile.ui.components.ThesisCard
import com.thesis.mobile.ui.components.ThesisRefreshBox
import com.thesis.mobile.ui.components.TickerRow
import com.thesis.mobile.ui.copy.KitCopy
import com.thesis.mobile.ui.copy.StateCopy
import com.thesis.mobile.ui.copy.TodayCopy
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.format.LocalFmt
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.motion.RollingNumber
import com.thesis.mobile.ui.motion.ShimmerHost
import com.thesis.mobile.ui.motion.rememberDataEntranceCoordinator
import com.thesis.mobile.ui.motion.rememberShowSkeleton
import com.thesis.mobile.ui.motion.staggeredEntrance
import com.thesis.mobile.ui.shell.exceptTop
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.textColor
import com.thesis.mobile.ui.theme.tnum
import com.thesis.mobile.ui.today.ChapterKind
import com.thesis.mobile.ui.today.HomeNames
import com.thesis.mobile.ui.today.LocalTodayClock
import com.thesis.mobile.ui.today.MacroModel
import com.thesis.mobile.ui.today.MacroSummary
import com.thesis.mobile.ui.today.MarketCalendar
import com.thesis.mobile.ui.today.MarketPhase
import com.thesis.mobile.ui.today.NamesSummary
import com.thesis.mobile.ui.today.PulseBrief
import com.thesis.mobile.ui.today.PulseChapterRow
import com.thesis.mobile.ui.today.PulseText
import com.thesis.mobile.ui.today.TapeModel
import java.time.Instant
import java.time.LocalDate

/*
 * Today / Home (docs/app-redesign/DESIGN-DIRECTION.md 5.6): a briefing in five blocks under the shell's root bar:
 * the header (date, market phase, the Pulse's morning line, one timestamp), the tape, your names, macro stress and
 * today's Pulse. "Your names" starts above the fold on a 360 x 780 phone. Built from the kit only; every headline is
 * a sentence generated from data (TodayCopy). Moved off Home: "Continue reading", Weekly digest and History (now in
 * Research), the full-Pulse toggle and the Deep Dive suggestion.
 */

/** Section keys, also the stagger order. */
private object HomeBlock {
    const val HEADER = 0
    const val TAPE = 1
    const val NAMES = 2
    const val MACRO = 3
    const val PULSE = 4
}

@Suppress("UNUSED_PARAMETER")
@Composable
fun HomeScreen(
    pulse: PulseReportView?,
    pulseLoadedFromCache: Boolean,
    pulseFreshnessText: String?,
    sentimentCurrent: SentimentSnapshotView?,
    sentimentHistory: List<SentimentSnapshotView>,
    sentimentError: String?,
    watchlist: List<String>,
    monitorSnapshots: List<ThesisMonitorSnapshotView>,
    morningBriefing: AlertLedgerItemView? = null,
    padding: PaddingValues,
    lastViewedReport: LastViewedReport? = null,
    pulseError: String? = null,
    onOpenHistory: () -> Unit,
    onRunDeepDive: (String) -> Unit,
    onManageNames: () -> Unit,
    onRetryPulse: () -> Unit,
    onOpenMacroStressDashboard: () -> Unit,
    onOpenWeeklyDigest: () -> Unit,
    onOpenPulseBrief: () -> Unit,
    onOpenMorningBriefing: (AlertLedgerItemView) -> Unit = {},
    onResumeLastViewed: ((LastViewedReport) -> Unit)? = null,
    onDismissResume: (() -> Unit)? = null,
    /** `isPulseRefreshing || isMacroRefreshing` from the ViewModel (never a fake delay). */
    refreshing: Boolean = false,
    /** Monitor readings against the last visit ("since your last visit"), by ticker. */
    snapshotDeltas: Map<String, SnapshotDelta> = emptyMap(),
    /** Tickers with a note (the local notes cache): a NoteMark on their row. */
    notedTickers: Set<String> = emptySet(),
    /** Opens a name (container transform); without it the row opens the Names tab. */
    onOpenName: ((String) -> Unit)? = null,
    /** Opens the Pulse at a chapter (the tape opens Markets); without it, the Pulse at its top. */
    onOpenPulseAt: ((ChapterKind) -> Unit)? = null,
    /** When the next issue is expected ("06:30"), for the no-Pulse state; null when not known. */
    pulseExpectedAt: String? = null,
) {
    val fmt = LocalFmt.current
    val clock = LocalTodayClock.current
    val now = remember(clock, pulse?.reportId, refreshing) { clock.instant() }
    val today = remember(now, clock) { now.atZone(clock.zone).toLocalDate() }

    val brief = remember(pulse, watchlist) { pulse?.let { PulseBrief.from(it, watchlist) } }
    val names = remember(watchlist, monitorSnapshots, snapshotDeltas, notedTickers, today) {
        HomeNames.summary(watchlist, monitorSnapshots, snapshotDeltas, notedTickers, clock, fmt)
    }
    val macro = remember(sentimentCurrent, sentimentHistory) { MacroModel.summary(sentimentCurrent, sentimentHistory, fmt) }

    // One refresh line at a time (4.3 rule 10): the pull's own hairline when the reader pulled, else the header's.
    var pulled by remember { mutableStateOf(false) }
    LaunchedEffect(refreshing) { if (!refreshing) pulled = false }

    // No cache and a load in flight: nothing for the skeleton's grace period (no flash of empty states), then
    // the skeleton, held for its minimum time once the data lands.
    val noCache = refreshing && pulse == null && pulseError == null && sentimentCurrent == null
    val showSkeleton = rememberShowSkeleton(loading = noCache)
    val loading = noCache || showSkeleton
    val openPulseAt: (ChapterKind) -> Unit = { kind -> onOpenPulseAt?.invoke(kind) ?: onOpenPulseBrief() }
    val openName: (String) -> Unit = { ticker -> onOpenName?.invoke(ticker) ?: onManageNames() }

    Box(Modifier.fillMaxSize().padding(padding.exceptTop())) {
        StateCrossfade(state = if (loading) Loadable.Loading else Loadable.Ready(Unit), loading = { if (showSkeleton) HomeSkeleton(padding) }) {
            ThesisRefreshBox(
                refreshing = refreshing && pulled,
                onRefresh = {
                    pulled = true
                    onRetryPulse()
                },
                indicatorTop = padding.calculateTopPadding(),
            ) {
                HomeList(
                    padding = padding,
                    brief = brief,
                    pulse = pulse,
                    pulseError = pulseError,
                    offline = pulseLoadedFromCache,
                    names = names,
                    macro = macro,
                    sentimentError = sentimentError,
                    morningBriefing = morningBriefing,
                    now = now,
                    today = today,
                    headerRefreshing = refreshing && !pulled,
                    pulseExpectedAt = pulseExpectedAt,
                    onManageNames = onManageNames,
                    onRetryPulse = onRetryPulse,
                    onOpenMacro = onOpenMacroStressDashboard,
                    onOpenPulse = onOpenPulseBrief,
                    onOpenPulseAt = openPulseAt,
                    onOpenName = openName,
                    onOpenMorningBriefing = onOpenMorningBriefing,
                )
            }
        }
    }
}

@Composable
private fun HomeList(
    padding: PaddingValues,
    brief: PulseBrief?,
    pulse: PulseReportView?,
    pulseError: String?,
    offline: Boolean,
    names: NamesSummary,
    macro: MacroSummary?,
    sentimentError: String?,
    morningBriefing: AlertLedgerItemView?,
    now: Instant,
    today: LocalDate,
    headerRefreshing: Boolean,
    pulseExpectedAt: String?,
    onManageNames: () -> Unit,
    onRetryPulse: () -> Unit,
    onOpenMacro: () -> Unit,
    onOpenPulse: () -> Unit,
    onOpenPulseAt: (ChapterKind) -> Unit,
    onOpenName: (String) -> Unit,
    onOpenMorningBriefing: (AlertLedgerItemView) -> Unit,
) {
    val fmt = LocalFmt.current
    val clock = LocalTodayClock.current
    // Staggers once per issue, only when Home opens on a loaded issue (4.3 rule 2).
    val coordinator = rememberDataEntranceCoordinator(dataKey = pulse?.reportId)
    fun Modifier.entrance(block: Int) = staggeredEntrance(block, coordinator)

    val phase = remember(now) { MarketCalendar.phase(now) }
    val generated = brief?.generatedAt
    val header = HeaderText(
        eyebrow = TodayCopy.eyebrow(fmt.marketDate(today), phase?.let(::phaseWord)),
        title = brief?.morningLine?.ifBlank { null }?.let { PulseText.oneSentence(it, 160) }
            ?: TodayCopy.greeting(now.atZone(clock.zone).hour),
        meta = generated?.let { at ->
            if (at.atZone(clock.zone).toLocalDate() == today) TodayCopy.asOf(fmt.time(at)) else fmt.asOf(at)
        },
    )
    val tape = remember(pulse?.tape) { TapeModel.items(TapeModel.lines(pulse?.tape)) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(top = padding.calculateTopPadding(), bottom = ThesisSpace.x5),
    ) {
        item(key = "header") {
            Column(
                Modifier
                    .entrance(HomeBlock.HEADER)
                    .padding(horizontal = ThesisSpace.gutter)
                    .padding(top = ThesisSpace.headerTop, bottom = ThesisSpace.l),
                verticalArrangement = Arrangement.spacedBy(ThesisSpace.l),
            ) {
                ScreenHeader(
                    title = header.title,
                    eyebrow = header.eyebrow,
                    meta = header.meta,
                    refreshing = headerRefreshing,
                    compact = true,
                )
                if (offline && pulse != null) {
                    InlineBanner(TodayCopy.offlineShowing(generated?.let(fmt::time)), tone = BannerTone.Neutral)
                }
            }
        }

        item(key = "tape") {
            // Always composed (a block never gains its entrance node after its first paint); empty when no tape.
            Box(Modifier.entrance(HomeBlock.TAPE)) {
                if (tape.isNotEmpty()) {
                    TapeRow(
                        items = tape,
                        caption = tapeCaption(brief, phase, today, fmt, clock),
                        onClick = { onOpenPulseAt(ChapterKind.Markets) },
                    )
                }
            }
        }

        item(key = "names") {
            Box(Modifier.entrance(HomeBlock.NAMES).padding(top = ThesisSpace.sectionGapData)) {
                NamesBlock(names, onManageNames, onOpenName)
            }
        }

        item(key = "macro") {
            Box(Modifier.entrance(HomeBlock.MACRO).padding(top = ThesisSpace.sectionGapData)) {
                MacroBlock(macro, sentimentError, onOpenMacro, onRetryPulse)
            }
        }

        pulseBlock(
            brief = brief,
            pulseError = pulseError,
            morningBriefing = morningBriefing,
            pulseExpectedAt = pulseExpectedAt,
            entrance = { Modifier.entrance(HomeBlock.PULSE) },
            onRetry = onRetryPulse,
            onOpenPulse = onOpenPulse,
            onOpenPulseAt = onOpenPulseAt,
            onOpenMorningBriefing = onOpenMorningBriefing,
        )
    }
}

private data class HeaderText(val eyebrow: String, val title: String, val meta: String?)

private fun phaseWord(phase: MarketPhase): String = when (phase) {
    MarketPhase.PreMarket -> TodayCopy.PHASE_PRE_MARKET
    MarketPhase.Open -> TodayCopy.PHASE_OPEN
    MarketPhase.AfterClose -> TodayCopy.PHASE_AFTER_CLOSE
}

/** "Pre-market tape · as of 06:15" for today's data, "Tape · Fri 24 Apr" for an older snapshot. */
private fun tapeCaption(brief: PulseBrief?, phase: MarketPhase?, today: LocalDate, fmt: Fmt, clock: java.time.Clock): String {
    val retrieved = brief?.dataRetrievedAt
    val retrievedDay = retrieved?.atZone(clock.zone)?.toLocalDate()
    return when {
        retrieved != null && retrievedDay == today ->
            TodayCopy.tapeCaption(phase?.let(::phaseWord), fmt.time(retrieved), null)
        brief?.dataDay != null -> TodayCopy.tapeCaption(null, null, fmt.marketDate(brief.dataDay))
        retrievedDay != null -> TodayCopy.tapeCaption(null, null, fmt.marketDate(retrievedDay))
        else -> TodayCopy.tapeCaption(null, null, null)
    }
}

// ---- Your names -----------------------------------------------------------------------------------------------------

@Composable
private fun NamesBlock(names: NamesSummary, onManageNames: () -> Unit, onOpenName: (String) -> Unit) {
    Column(Modifier.padding(horizontal = ThesisSpace.gutter), verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
        if (names.total == 0) {
            Kicker(TodayCopy.NAMES_KICKER)
            EmptyState(
                sentence = TodayCopy.NO_NAMES,
                how = TodayCopy.NO_NAMES_HOW,
                actionLabel = TodayCopy.ADD_NAME,
                onAction = onManageNames,
                primaryAction = true,
            )
            return@Column
        }
        SectionHeader(
            kicker = TodayCopy.NAMES_KICKER,
            headline = names.headline,
            actionLabel = TodayCopy.NAMES_ACTION,
            onAction = onManageNames,
        )
        RowGroup {
            names.rows.forEach { r ->
                row(LeadingRowDividerInset) {
                    TickerRow(
                        ticker = r.ticker,
                        stateTone = r.tone,
                        onClick = { onOpenName(r.ticker) },
                        line2 = r.line2,
                        figure = r.figure,
                        figureCaption = r.figureCaption,
                        figureCaptionTone = r.figureCaptionTone,
                        stateLabel = r.stateLabel,
                        hasNote = r.hasNote,
                    )
                }
            }
            if (names.more > 0) {
                row(LeadingRowDividerInset) {
                    ActionRow(icon = null, title = TodayCopy.moreNames(names.more), onClick = onManageNames, reserveLeading = true)
                }
            }
        }
    }
}

// ---- Macro stress -----------------------------------------------------------------------------------------------------

@Composable
private fun MacroBlock(macro: MacroSummary?, error: String?, onOpen: () -> Unit, onRetry: () -> Unit) {
    val p = LocalThesisPalette.current
    Box(Modifier.padding(horizontal = ThesisSpace.gutter)) {
        when {
            macro == null && error != null -> ErrorState(title = TodayCopy.MACRO_FAILED, onRetry = onRetry)
            macro == null -> ThesisCard(eyebrow = TodayCopy.MACRO_EYEBROW, title = TodayCopy.MACRO_NO_READING) {
                Text(TodayCopy.MACRO_NO_READING_HOW, style = ThesisType.bodySmall, color = p.ink2)
            }
            else -> PressableCard(
                onClick = onOpen,
                onClickLabel = TodayCopy.OPEN_MACRO,
                eyebrow = TodayCopy.MACRO_EYEBROW,
                title = macro.title,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
                    // Final on the first paint; rolls only when a refresh changes it.
                    RollingNumber(value = macro.score, format = { Fmt.score(it) }, style = ThesisType.figure.tnum(), color = p.ink)
                    StatusBadge(macro.label, macro.tone)
                }
                if (macro.deltaValue != null && macro.deltaReference != null) {
                    Row(horizontalArrangement = Arrangement.spacedBy(ThesisSpace.xs)) {
                        Text(macro.deltaValue, style = ThesisType.caption.tnum(), color = macro.deltaTone.textColor(p))
                        Text(macro.deltaReference, style = ThesisType.caption, color = p.muted)
                    }
                }
                Sparkline(
                    values = macro.spark,
                    contentDescription = ChartMath.summary(
                        subject = TodayCopy.MACRO_SPARK_SUBJECT,
                        values = macro.spark,
                        format = { Fmt.score(it) },
                        window = TodayCopy.lastDays(macro.sparkDays),
                    ),
                    modifier = Modifier.fillMaxWidth(),
                    dataKey = macro.day,
                )
                Text(TodayCopy.macroScale(macro.sparkDays), style = ThesisType.caption, color = p.muted)
            }
        }
    }
}

// ---- Today's Pulse ----------------------------------------------------------------------------------------------------

/** Chapters Home lists (Sources is the brief's appendix, not a story row). */
private const val HOME_CHAPTERS = 4

private fun LazyListScope.pulseBlock(
    brief: PulseBrief?,
    pulseError: String?,
    morningBriefing: AlertLedgerItemView?,
    pulseExpectedAt: String?,
    entrance: @Composable () -> Modifier,
    onRetry: () -> Unit,
    onOpenPulse: () -> Unit,
    onOpenPulseAt: (ChapterKind) -> Unit,
    onOpenMorningBriefing: (AlertLedgerItemView) -> Unit,
) {
    item(key = "pulse") {
        Column(
            entrance()
                .padding(top = ThesisSpace.sectionGapData)
                .padding(horizontal = ThesisSpace.gutter),
            verticalArrangement = Arrangement.spacedBy(ThesisSpace.m),
        ) {
            when {
                brief != null -> {
                    SectionHeader(kicker = TodayCopy.PULSE_KICKER, headline = brief.leadConclusion)
                    val chapters = brief.chapters.filter { it.kind != ChapterKind.Sources }.take(HOME_CHAPTERS)
                    RowGroup {
                        if (morningBriefing != null) {
                            row(LeadingRowDividerInset) {
                                ActionRow(
                                    icon = ThesisIcons.Pulse,
                                    title = morningBriefing.title.trim().ifBlank { TodayCopy.MORNING_BRIEFING },
                                    caption = briefingCaption(morningBriefing),
                                    onClick = { onOpenMorningBriefing(morningBriefing) },
                                )
                            }
                        }
                        chapters.forEach { chapter ->
                            row {
                                PulseChapterRow(
                                    title = chapter.label,
                                    sentence = PulseText.oneSentence(chapter.title),
                                    partial = chapter.partial,
                                    onClick = { onOpenPulseAt(chapter.kind) },
                                )
                            }
                        }
                    }
                    TextAction(TodayCopy.READ_PULSE, onOpenPulse, trailing = true)
                }
                pulseError != null -> {
                    Kicker(TodayCopy.PULSE_KICKER)
                    if (pulseError.contains("No internet connection", ignoreCase = true)) {
                        ErrorState(title = StateCopy.OFFLINE_TITLE, cause = StateCopy.OFFLINE_CAUSE, onRetry = onRetry)
                    } else {
                        ErrorState(title = KitCopy.couldNotLoad(TodayCopy.PULSE_SUBJECT), onRetry = onRetry)
                    }
                }
                else -> {
                    Kicker(TodayCopy.PULSE_KICKER)
                    EmptyState(
                        sentence = TodayCopy.NO_PULSE,
                        how = pulseExpectedAt?.let(TodayCopy::expectedBy) ?: TodayCopy.NO_PULSE_HOW,
                        icon = ThesisIcons.Pulse,
                    )
                }
            }
        }
    }
}

private fun briefingCaption(alert: AlertLedgerItemView): String? {
    val ctx = alert.briefingContext
    val fromContext = ctx?.let {
        TodayCopy.briefingContext(it.mode, it.count ?: 0, it.watchlistCount ?: 0, it.leadTicker?.trim()?.ifBlank { null })
    }
    return fromContext ?: alert.body.trim().ifBlank { null }?.let { PulseText.oneSentence(PulseText.clean(it)) }
}

// ---- Loading ----------------------------------------------------------------------------------------------------------

/** No cache yet: the final layout in skeleton form (header, tape, three name rows, the macro card). */
@Composable
private fun HomeSkeleton(padding: PaddingValues) {
    ShimmerHost {
        Column(
            Modifier
                .fillMaxSize()
                .padding(top = padding.calculateTopPadding() + ThesisSpace.headerTop)
                .padding(horizontal = ThesisSpace.gutter),
            verticalArrangement = Arrangement.spacedBy(ThesisSpace.l),
        ) {
            SkeletonText(ThesisType.eyebrow, widthFraction = 0.4f)
            SkeletonText(ThesisType.headline, widthFraction = 0.9f, lines = 2)
            SkeletonText(ThesisType.caption, widthFraction = 0.25f)
            SkeletonBlock(Modifier.fillMaxWidth().height(ThesisSpace.tapeRow))
            Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.xs)) {
                SkeletonText(ThesisType.kicker, widthFraction = 0.3f)
                SkeletonText(ThesisType.headline, widthFraction = 0.75f)
            }
            Column {
                repeat(3) { SkeletonRow() }
            }
            SkeletonCard(bodyLines = 3)
        }
    }
}
