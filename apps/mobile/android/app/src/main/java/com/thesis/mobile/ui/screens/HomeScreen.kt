package com.thesis.mobile.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
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
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Constraints
import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.model.LastViewedReport
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.SentimentSnapshotView
import com.thesis.mobile.model.SnapshotDelta
import com.thesis.mobile.model.ThesisMonitorSnapshotView
import com.thesis.mobile.ui.RefreshFailureKind
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
import com.thesis.mobile.ui.today.NameRowModel
import com.thesis.mobile.ui.today.MarketCalendar
import com.thesis.mobile.ui.today.MarketPhase
import com.thesis.mobile.ui.today.NamesSummary
import com.thesis.mobile.ui.today.PulseBrief
import com.thesis.mobile.ui.today.PulseChapterRow
import com.thesis.mobile.ui.today.PulseText
import com.thesis.mobile.ui.today.TapeModel
import com.thesis.mobile.ui.today.parseDay
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
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
    /**
     * When the next issue is expected, for the no-Pulse state ("Expected by 06:30", or "Running late: it was due
     * by 06:30" once that time has passed); null when not known.
     */
    pulseExpectedAt: Instant? = null,
    /** Reloads macro stress (`onRefreshMacro`): the macro card's "Try again" and, with [onRetryPulse], the pull. */
    onRetryMacro: (() -> Unit)? = null,
    /**
     * Why the last Pulse refresh failed, when it did: the cached-copy banner and the error state say "offline"
     * only for [RefreshFailureKind.OFFLINE]. Null when unknown (the banner then says "Couldn’t refresh").
     */
    pulseFailure: RefreshFailureKind? = null,
) {
    val fmt = LocalFmt.current
    val clock = LocalTodayClock.current
    // The eyebrow's market phase and the greeting follow the clock: re-read on every refresh and new issue, and
    // at each minute boundary while Home is composed (09:30 turns PRE-MARKET into MARKET OPEN without a refresh).
    // The wait runs off the composition's dispatcher: it is wall-clock time, and a UI test's idle check (which
    // drives that dispatcher's virtual time) would otherwise advance it minute after minute and never go idle.
    var now by remember(clock) { mutableStateOf(clock.instant()) }
    LaunchedEffect(clock, pulse?.reportId, refreshing) {
        now = clock.instant()
        while (true) {
            val wait = MINUTE_MS - now.toEpochMilli().mod(MINUTE_MS)
            withContext(Dispatchers.Default) { delay(wait) }
            now = clock.instant()
        }
    }
    val today = remember(now, clock) { now.atZone(clock.zone).toLocalDate() }

    val brief = remember(pulse, watchlist) { pulse?.let { PulseBrief.from(it, watchlist) } }
    // Keyed on the clock and the formatter too: a 24 h, locale or date setting change re-words the captions.
    val names = remember(watchlist, monitorSnapshots, snapshotDeltas, notedTickers, today, clock, fmt) {
        HomeNames.summary(watchlist, monitorSnapshots, snapshotDeltas, notedTickers, clock, fmt)
    }
    val macro = remember(sentimentCurrent, sentimentHistory, fmt) { MacroModel.summary(sentimentCurrent, sentimentHistory, fmt) }

    // One refresh line at a time (4.3 rule 10): the pull's own hairline when the reader pulled, else the header's.
    // A pull is over when its refresh has started and ended; when no refresh starts within a short window (the
    // ViewModel had nothing to do, or `refreshing` is not wired), it is over too, so a later background refresh
    // shows the header's hairline, not the pull's.
    var pulled by remember { mutableStateOf(false) }
    val refreshingNow by rememberUpdatedState(refreshing)
    LaunchedEffect(pulled) {
        if (!pulled) return@LaunchedEffect
        val started = withTimeoutOrNull(PULL_START_WINDOW_MS) { snapshotFlow { refreshingNow }.first { it } }
        if (started != null) snapshotFlow { refreshingNow }.first { !it }
        pulled = false
    }

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
                    // Home shows both: the pull reloads the Pulse and macro stress (spec 5.6).
                    onRetryPulse()
                    onRetryMacro?.invoke()
                },
                indicatorTop = padding.calculateTopPadding(),
            ) {
                HomeList(
                    padding = padding,
                    brief = brief,
                    pulse = pulse,
                    pulseError = pulseError,
                    fromCache = pulseLoadedFromCache,
                    pulseFailure = pulseFailure,
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
                    onRetryMacro = onRetryMacro,
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
    fromCache: Boolean,
    pulseFailure: RefreshFailureKind?,
    names: NamesSummary,
    macro: MacroSummary?,
    sentimentError: String?,
    morningBriefing: AlertLedgerItemView?,
    now: Instant,
    today: LocalDate,
    headerRefreshing: Boolean,
    pulseExpectedAt: Instant?,
    onManageNames: () -> Unit,
    onRetryPulse: () -> Unit,
    onRetryMacro: (() -> Unit)?,
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

    // The phase is New York's; it is shown only when the reader's date is New York's date too (in Tokyo at 07:00
    // Wednesday, New York is still in Tuesday's session: "WED 25 NOV · AFTER THE CLOSE" would mislead).
    val phase = remember(now, today) {
        MarketCalendar.phase(now)?.takeIf { now.atZone(MarketCalendar.NewYork).toLocalDate() == today }
    }
    val generated = brief?.generatedAt
    val header = HeaderText(
        date = fmt.marketDate(today),
        phase = phase?.let(::phaseWord),
        morningLine = brief?.morningLine?.ifBlank { null },
        greeting = TodayCopy.greeting(now.atZone(clock.zone).hour),
        meta = generated?.let { at ->
            if (at.atZone(clock.zone).toLocalDate() == today) TodayCopy.asOf(fmt.time(at)) else fmt.asOf(at)
        },
    )
    // The briefing's six instruments (5.6); the Pulse's Markets chapter has the whole tape.
    val tape = remember(pulse?.tape) { TapeModel.items(TapeModel.homeLines(TapeModel.lines(pulse?.tape))) }

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
                HomeHeader(header, headerRefreshing)
                if (fromCache && pulse != null) {
                    // The day too when the copy is not today's ("Offline · showing 06:30, Fri 20 Nov").
                    val shown = generated?.let { at ->
                        val day = at.atZone(clock.zone).toLocalDate()
                        if (day == today) fmt.time(at) else TodayCopy.timeOnDay(fmt.time(at), fmt.marketDate(day))
                    }
                    val text = if (pulseFailure == RefreshFailureKind.OFFLINE) TodayCopy.offlineShowing(shown) else TodayCopy.staleShowing(shown)
                    InlineBanner(text, tone = BannerTone.Neutral)
                }
            }
        }

        item(key = "tape") {
            // Always composed (a block never gains its entrance node after its first paint); empty when no tape.
            Box(Modifier.entrance(HomeBlock.TAPE)) {
                if (tape.isNotEmpty()) {
                    val caption = tapeCaption(brief, phase, today, fmt, clock)
                    // Past 1.3x the caption alone would fill the visible width: it moves above the instruments.
                    val largeText = LocalDensity.current.fontScale > ThesisType.MAX_DISPLAY_SCALE
                    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.xs)) {
                        if (largeText) {
                            Text(
                                caption,
                                modifier = Modifier.padding(horizontal = ThesisSpace.gutter),
                                style = ThesisType.caption,
                                color = LocalThesisPalette.current.muted,
                            )
                        }
                        TapeRow(
                            items = tape,
                            caption = if (largeText) null else caption,
                            onClick = { onOpenPulseAt(ChapterKind.Markets) },
                        )
                    }
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
                MacroBlock(macro, sentimentError, onOpenMacro, onRetryMacro)
            }
        }

        // "Today's Pulse" only over today's issue: on a weekend, a holiday or before the next issue, Home shows the
        // last issue under its date ("Pulse · Fri 20 Nov"), never as today's.
        val issueDay = parseDay(pulse?.cycleEnd) ?: generated?.atZone(clock.zone)?.toLocalDate()
        val marketDay = MarketCalendar.isTradingDay(today)
        val pulseKicker = when {
            brief == null -> if (marketDay) TodayCopy.PULSE_KICKER else TodayCopy.PULSE_TITLE
            issueDay == null -> TodayCopy.LATEST_PULSE_KICKER
            issueDay == today -> TodayCopy.PULSE_KICKER
            else -> TodayCopy.datedPulseKicker(fmt.marketDate(issueDay))
        }
        val noPulse: Pair<String, String> = when {
            !marketDay -> TodayCopy.NO_PULSE_CLOSED to TodayCopy.nextIssue(fmt.marketDate(MarketCalendar.nextTradingDay(today)))
            pulseExpectedAt != null -> {
                val day = pulseExpectedAt.atZone(clock.zone).toLocalDate()
                val label = if (day == today) fmt.time(pulseExpectedAt) else TodayCopy.timeOnDay(fmt.time(pulseExpectedAt), fmt.marketDate(day))
                TodayCopy.NO_PULSE to if (now.isBefore(pulseExpectedAt)) TodayCopy.expectedBy(label) else TodayCopy.runningLate(label)
            }
            else -> TodayCopy.NO_PULSE to TodayCopy.NO_PULSE_HOW
        }
        pulseBlock(
            kicker = pulseKicker,
            noPulse = noPulse,
            brief = brief,
            pulseError = pulseError,
            offline = pulseFailure == RefreshFailureKind.OFFLINE,
            morningBriefing = morningBriefing,
            entrance = { Modifier.entrance(HomeBlock.PULSE) },
            onRetry = onRetryPulse,
            onOpenPulse = onOpenPulse,
            onOpenPulseAt = onOpenPulseAt,
            onOpenMorningBriefing = onOpenMorningBriefing,
        )
    }
}

private data class HeaderText(val date: String, val phase: String?, val morningLine: String?, val greeting: String, val meta: String?)

/** Lines Home's headline may take (spec 5.6: the morning line in `headline`, max 2 lines). */
private const val HEADLINE_LINES = 2

private const val MINUTE_MS = 60_000L

/** How long a pull waits for its refresh to start before it counts as over (not motion timing). */
private const val PULL_START_WINDOW_MS = 1_500L

/**
 * The header with the morning line shortened to what fits two `headline` lines at this width and font scale: the
 * whole first sentence when it fits, else the sentence cut at its last clause boundary that fits (never mid-word,
 * never an ellipsis). Measured, not counted: a character budget cannot know the width, the font or the scale.
 */
@Composable
private fun HomeHeader(header: HeaderText, refreshing: Boolean) {
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val measurer = rememberTextMeasurer()
        val style = ThesisType.capped(ThesisType.headline)
        val width = constraints.maxWidth
        // The eyebrow on one line when it fits, else the date over the phase (no " · " left at a line end).
        val eyebrowStyle = ThesisType.eyebrow
        val eyebrow = remember(header.date, header.phase, width, eyebrowStyle, measurer) {
            val line = TodayCopy.eyebrow(header.date, header.phase)
            val oneLine = !measurer.measure(
                line.uppercase(),
                style = eyebrowStyle,
                maxLines = 1,
                constraints = Constraints(maxWidth = width),
            ).hasVisualOverflow
            if (oneLine) line else TodayCopy.eyebrowStacked(header.date, header.phase)
        }
        val title = remember(header.morningLine, header.greeting, width, style, measurer) {
            val line = header.morningLine ?: return@remember header.greeting
            PulseText.fitHeadline(line) { candidate ->
                !measurer.measure(
                    candidate,
                    style = style,
                    maxLines = HEADLINE_LINES,
                    constraints = Constraints(maxWidth = width),
                ).hasVisualOverflow
            }
        }
        ScreenHeader(
            title = title,
            eyebrow = eyebrow,
            meta = header.meta,
            refreshing = refreshing,
            compact = true,
        )
    }
}

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
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            val fitted = fitNameRows(names.rows, constraints.maxWidth)
            RowGroup {
                names.rows.forEachIndexed { i, r ->
                    val (line2, caption) = fitted[i]
                    row(LeadingRowDividerInset) {
                        TickerRow(
                            ticker = r.ticker,
                            stateTone = r.tone,
                            onClick = { onOpenName(r.ticker) },
                            line2 = line2,
                            figure = r.figure,
                            figureCaption = caption,
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
}

/** Lines a name's reason may take: the kit TickerRow sets line 2 on one line up to 1.3x and on two above it. */
private const val REASON_LINES = 1
private const val REASON_LINES_LARGE = 2

/**
 * Each row's reason line and caption, measured against the row's real width and font scale (the kit TickerRow's
 * anatomy: 16 dp padding each side, the 24 dp leading column and its gap, then the trailing figure block up to 1.3x).
 * The long captions ("−1 since 17 Nov", "Report · 23 days ago") stay only when every row's whole reason fits next to
 * them; otherwise every row takes the compact one ("−1", "Report · 23d"), and if that is still too wide the report
 * age is left out (the score stays); one level for the group, so the trailing column reads alike. Each
 * reason is then the longest of its forms (the sentence, then cut at a clause) that fits whole: the reason keeps its
 * meaning before the caption keeps its words. Measured, not counted: a character budget cannot know the font.
 */
@Composable
private fun fitNameRows(rows: List<NameRowModel>, rowWidthPx: Int): List<Pair<String, String?>> {
    val measurer = rememberTextMeasurer()
    val density = LocalDensity.current
    val large = density.fontScale > ThesisType.MAX_DISPLAY_SCALE
    return remember(rows, rowWidthPx, density, measurer) {
        val lineStyle = ThesisType.bodySmall
        val figureStyle = ThesisType.body.tnum()
        val captionStyle = ThesisType.caption.tnum()
        val fixed = with(density) {
            (ThesisSpace.l * 2 + ThesisSpace.leadingColumn + ThesisSpace.leadingGap).roundToPx()
        }
        val figureGap = with(density) { ThesisSpace.m.roundToPx() }
        fun widthOf(text: String?, style: TextStyle): Int =
            if (text == null) 0 else measurer.measure(text, style = style, maxLines = 1, softWrap = false).size.width
        fun textWidth(r: NameRowModel, caption: String?): Int {
            if (large || (r.figure == null && caption == null)) return (rowWidthPx - fixed).coerceAtLeast(1)
            val block = maxOf(widthOf(r.figure, figureStyle), widthOf(caption, captionStyle))
            return (rowWidthPx - fixed - figureGap - block).coerceAtLeast(1)
        }
        fun fits(text: String, width: Int): Boolean = !measurer.measure(
            text,
            style = lineStyle,
            maxLines = if (large) REASON_LINES_LARGE else REASON_LINES,
            constraints = Constraints(maxWidth = width),
        ).hasVisualOverflow
        // Captions from the most to the least said: long, compact, then without the report age (metadata; a score
        // change is data and stays). The first level at which every whole reason fits is used for every row.
        val levels: List<(NameRowModel) -> String?> = listOf(
            { it.figureCaption },
            { it.figureCaptionShort },
            { if (it.figureCaptionIsAge) null else it.figureCaptionShort },
        )
        // Above 1.3x the figure block sits under the text and its caption wraps: it takes no room from the reason.
        val level = if (large) {
            levels.first()
        } else {
            levels.firstOrNull { caption -> rows.all { r -> fits(r.line2Forms.first(), textWidth(r, caption(r))) } } ?: levels.last()
        }
        rows.map { r ->
            val caption = level(r)
            val width = textWidth(r, caption)
            (r.line2Forms.firstOrNull { fits(it, width) } ?: r.line2Forms.last()) to caption
        }
    }
}

// ---- Macro stress -----------------------------------------------------------------------------------------------------

@Composable
private fun MacroBlock(macro: MacroSummary?, error: String?, onOpen: () -> Unit, onRetry: (() -> Unit)?) {
    val p = LocalThesisPalette.current
    Box(Modifier.padding(horizontal = ThesisSpace.gutter)) {
        when {
            // "Try again" only when it reloads macro stress itself (never the Pulse under this label).
            macro == null && error != null -> Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
                // Labelled like the Pulse block's error: the card never stands alone without its section.
                Kicker(TodayCopy.MACRO_EYEBROW)
                ErrorState(title = TodayCopy.MACRO_FAILED, onRetry = onRetry)
            }
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
                // A line needs two readings: with one (a first install), no lone dot over an empty chart.
                if (macro.spark.count { it != null } >= 2) {
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
}

// ---- Today's Pulse ----------------------------------------------------------------------------------------------------

/** Chapters Home lists (Sources is the brief's appendix, not a story row). */
private const val HOME_CHAPTERS = 4

private fun LazyListScope.pulseBlock(
    kicker: String,
    noPulse: Pair<String, String>,
    brief: PulseBrief?,
    pulseError: String?,
    offline: Boolean,
    morningBriefing: AlertLedgerItemView?,
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
                    SectionHeader(kicker = kicker, headline = brief.leadConclusion)
                    // Each row says something the headline above does not: the chapter the lead conclusion came from
                    // shows its next sentence instead (rubric V3).
                    val chapters = brief.chapters
                        .filter { it.kind != ChapterKind.Sources }
                        .mapNotNull { c -> c.rowSentence(brief.leadConclusion)?.let { c to it } }
                        .take(HOME_CHAPTERS)
                    RowGroup {
                        if (morningBriefing != null) {
                            // No icon: every title in the group starts on one edge with the chapter rows.
                            row {
                                ActionRow(
                                    icon = null,
                                    title = morningBriefing.title.trim().ifBlank { TodayCopy.MORNING_BRIEFING },
                                    caption = briefingCaption(morningBriefing),
                                    onClick = { onOpenMorningBriefing(morningBriefing) },
                                )
                            }
                        }
                        chapters.forEach { (chapter, sentence) ->
                            row {
                                PulseChapterRow(
                                    title = chapter.label,
                                    sentence = PulseText.oneSentence(sentence),
                                    partial = chapter.partial,
                                    onClick = { onOpenPulseAt(chapter.kind) },
                                )
                            }
                        }
                    }
                    TextAction(TodayCopy.READ_PULSE, onOpenPulse, trailing = true)
                }
                pulseError != null -> {
                    Kicker(kicker)
                    if (offline) {
                        ErrorState(title = StateCopy.OFFLINE_TITLE, cause = StateCopy.OFFLINE_CAUSE, onRetry = onRetry)
                    } else {
                        ErrorState(title = KitCopy.couldNotLoad(TodayCopy.PULSE_SUBJECT), onRetry = onRetry)
                    }
                }
                else -> {
                    Kicker(kicker)
                    EmptyState(
                        sentence = noPulse.first,
                        how = noPulse.second,
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

/**
 * No cache yet: the final layout in skeleton form (header, the tape's one line, three name rows in their card, the
 * macro card), so the crossfade to the loaded screen changes no shapes.
 */
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
            Box(Modifier.fillMaxWidth().height(ThesisSpace.tapeRow), contentAlignment = Alignment.CenterStart) {
                SkeletonText(ThesisType.caption)
            }
            Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.xs)) {
                SkeletonText(ThesisType.kicker, widthFraction = 0.3f)
                SkeletonText(ThesisType.headline, widthFraction = 0.75f)
            }
            RowGroup {
                repeat(3) { row(LeadingRowDividerInset) { SkeletonRow() } }
            }
            SkeletonCard(bodyLines = 3)
        }
    }
}
