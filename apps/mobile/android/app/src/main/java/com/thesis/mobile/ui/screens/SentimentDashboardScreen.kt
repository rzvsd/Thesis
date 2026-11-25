package com.thesis.mobile.ui.screens

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.AnnotatedString
import com.thesis.mobile.model.SentimentSnapshotView
import com.thesis.mobile.model.SentimentSubScoreView
import com.thesis.mobile.ui.charts.kit.ChartCard
import com.thesis.mobile.ui.charts.kit.ChartHeights
import com.thesis.mobile.ui.charts.kit.ChartMath
import com.thesis.mobile.ui.charts.kit.ChartSeries
import com.thesis.mobile.ui.charts.kit.LineChart
import com.thesis.mobile.ui.charts.kit.LineChartData
import com.thesis.mobile.ui.charts.kit.LineChartReadout
import com.thesis.mobile.ui.charts.kit.ScaleBar
import com.thesis.mobile.ui.charts.kit.macroStressBands
import com.thesis.mobile.ui.charts.kit.macroStressSegments
import com.thesis.mobile.ui.charts.kit.rememberLineChartState
import com.thesis.mobile.ui.components.ActionRow
import com.thesis.mobile.ui.components.BannerTone
import com.thesis.mobile.ui.components.Callout
import com.thesis.mobile.ui.components.CardVariant
import com.thesis.mobile.ui.components.CompareColumn
import com.thesis.mobile.ui.components.CompareRow
import com.thesis.mobile.ui.components.CompareTableModel
import com.thesis.mobile.ui.components.EmptyState
import com.thesis.mobile.ui.components.ErrorState
import com.thesis.mobile.ui.components.Eyebrow
import com.thesis.mobile.ui.components.InlineBanner
import com.thesis.mobile.ui.components.Loadable
import com.thesis.mobile.ui.components.Meter
import com.thesis.mobile.ui.components.RowGroup
import com.thesis.mobile.ui.components.SectionHeader
import com.thesis.mobile.ui.components.SegmentedControl
import com.thesis.mobile.ui.components.SkeletonBlock
import com.thesis.mobile.ui.components.SkeletonChart
import com.thesis.mobile.ui.components.SkeletonText
import com.thesis.mobile.ui.components.SourceInfo
import com.thesis.mobile.ui.components.SourceSheet
import com.thesis.mobile.ui.components.StateCrossfade
import com.thesis.mobile.ui.components.StatusBadge
import com.thesis.mobile.ui.components.TextAction
import com.thesis.mobile.ui.components.ThesisCard
import com.thesis.mobile.ui.components.ThesisIconButton
import com.thesis.mobile.ui.components.ThesisRefreshBox
import com.thesis.mobile.ui.components.ThesisTopBar
import com.thesis.mobile.ui.components.ledeText
import com.thesis.mobile.ui.components.rememberTopBarCollapsed
import com.thesis.mobile.ui.copy.KitCopy
import com.thesis.mobile.ui.copy.MacroStressCopy
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.format.LocalFmt
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.motion.RollingNumber
import com.thesis.mobile.ui.motion.ShimmerHost
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.motion.rememberHaptics
import com.thesis.mobile.ui.motion.rememberShowSkeleton
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone
import com.thesis.mobile.ui.theme.macroStressDeltaTone
import com.thesis.mobile.ui.theme.macroStressLabel
import com.thesis.mobile.ui.theme.macroStressTone
import com.thesis.mobile.ui.theme.textColor
import com.thesis.mobile.ui.theme.tnum
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeoutOrNull
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import kotlin.math.abs

/*
 * Macro Stress (docs/app-redesign/DESIGN-DIRECTION.md 5.9). File name kept; the composable is MacroStressScreen.
 *
 * 1. Own top bar: back, "Macro Stress" (the shell draws no bar on this destination).
 * 2. Header: eyebrow with the reading date, the sentence first ("Stress is Balanced and rose 6 points this week"),
 *    then the score (final on first paint, RollingNumber on refresh) with an info target opening the SourceSheet,
 *    the regime badge, the change against a week ago (rising stress is Unfavourable) and the 0 to 100 ScaleBar.
 * 3. Range: SegmentedControl 7D · 14D · 30D · 90D.
 * 4. Trend: the kit LineChart, featured height, y pinned 0 to 100, regime bands, dates on the x axis, scrub
 *    rewriting the card's readout, morph on a range change, draw-on once per reading date; "Show table" opens the
 *    readings (date, score, change) and they copy out as tab-separated text.
 * 5. What drives it: a generated headline, one row per official input (meter 0 to 100, change since the previous
 *    reading), the source caption, and the missing inputs as a "Not seen yet" card with their reasons.
 * 6. How to read this: a collapsible explanation of the scale and the regimes.
 *
 * Hero motion: the chart draw-on, then scrub. Refresh: ThesisRefreshBox bound to the ViewModel's isMacroRefreshing.
 */

/** The range segments in days (5.9: default 30). */
internal val MacroStressRanges: List<Int> = listOf(7, 14, 30, 90)

private const val DEFAULT_RANGE = 30
private const val WEEK_DAYS = 7L

/** A reading counts as "a week ago" when it is 7 to 9 days old (weekends and holidays have no reading). */
private const val WEEK_DAYS_MAX = 9L

/** Pressure levels of the server's macro model (inputs are rated 25 / 55 / 85). */
private const val PRESSURE_HIGH_FROM = 75.0
private const val PRESSURE_MEDIUM_FROM = 45.0

/** Scores closer than this read as unchanged ("held steady"), matching macroStressDeltaTone's Neutral. */
private const val FLAT = 0.5

private const val SCORE_MAX = 100.0

/** One day's macro stress reading. */
@Immutable
internal data class MacroReading(val date: LocalDate, val score: Double, val snapshot: SentimentSnapshotView)

/** One official input of the score ("What drives it"). */
@Immutable
internal data class MacroFactor(
    val key: String,
    val label: String,
    val score: Double,
    val scoreText: String,
    val sub: String?,
    val change: Double?,
    val changeText: String?,
    val changeTone: Tone,
    val spoken: String,
)

/** An input the reading does not have, and why. */
@Immutable
internal data class MacroMissing(val label: String, val reason: String)

/** Everything the screen shows, built from the ViewModel's snapshots (pure; see MacroStressModelTest). */
@Immutable
internal data class MacroStressModel(
    val asOf: LocalDate?,
    val asOfText: String?,
    val score: Double,
    val label: String,
    val tone: Tone,
    val leadClause: String,
    val changeClause: String?,
    /** The change against [deltaReference]'s reading, or null with no earlier reading. */
    val delta: Double?,
    val deltaText: String?,
    val deltaReference: String?,
    val deltaTone: Tone,
    val rangeDays: Int,
    val chart: LineChartData,
    val chartTitle: String,
    val chartSummary: String,
    /** The window's first reading date ("30 Oct"), the readout change's basis; null with one reading. */
    val windowStartText: String?,
    val table: CompareTableModel?,
    val factors: List<MacroFactor>,
    val factorHeadline: String,
    val factorDeck: String?,
    val sources: List<String>,
    val missing: List<MacroMissing>,
    val sheetInputs: List<Pair<String, String>>,
)

internal object MacroStressModels {

    /** The range the screen shows: [days] when it is one of the segments, else 30. */
    fun normalizeRange(days: Int): Int = if (days in MacroStressRanges) days else DEFAULT_RANGE

    /** "2025-11-24" (or a longer ISO date-time) as a date; null when unreadable. */
    fun parseDate(raw: String?): LocalDate? =
        raw?.trim()?.take(ISO_DATE_LENGTH)?.let { runCatching { LocalDate.parse(it) }.getOrNull() }

    /** Readings oldest first, one per date (the later calculation wins), [current] included. */
    fun readings(current: SentimentSnapshotView?, history: List<SentimentSnapshotView>): List<MacroReading> {
        val byDate = linkedMapOf<LocalDate, MacroReading>()
        (history + listOfNotNull(current))
            .mapNotNull { s -> parseDate(s.marketDate)?.takeIf { s.score.isFinite() }?.let { MacroReading(it, s.score, s) } }
            .sortedWith(compareBy<MacroReading>({ it.date }, { it.snapshot.calculatedAt }))
            .forEach { byDate[it.date] = it }
        return byDate.values.sortedBy { it.date }
    }

    /**
     * The reading to compare the latest with: the newest one 7 to 9 days older ("this week"); failing that the
     * previous reading. The flag says whether it is the week basis.
     */
    fun comparison(readings: List<MacroReading>): Pair<MacroReading, Boolean>? {
        val latest = readings.lastOrNull() ?: return null
        val earlier = readings.dropLast(1)
        val week = earlier.lastOrNull { ChronoUnit.DAYS.between(it.date, latest.date) >= WEEK_DAYS }
            ?.takeIf { ChronoUnit.DAYS.between(it.date, latest.date) <= WEEK_DAYS_MAX }
        return week?.let { it to true } ?: earlier.lastOrNull()?.let { it to false }
    }

    fun build(
        current: SentimentSnapshotView?,
        history: List<SentimentSnapshotView>,
        rangeDays: Int,
        fmt: Fmt,
    ): MacroStressModel? {
        val all = readings(current, history)
        val latest = all.lastOrNull() ?: return null
        val days = normalizeRange(rangeDays)
        val score = latest.score.coerceIn(0.0, SCORE_MAX)
        val label = macroStressLabel(score)

        // Header: the change against a week ago (or the previous reading), rising stress Unfavourable.
        val comparison = comparison(all)
        val delta = comparison?.let { latest.score - it.first.score }
        val basisDate = comparison?.first?.date?.let(fmt::marketDate)
        val weekly = comparison?.second == true && comparison.first.date == latest.date.minusDays(WEEK_DAYS)
        val changeClause = when {
            delta == null || basisDate == null -> null
            comparison.second -> MacroStressCopy.changeClause(delta, MacroStressCopy.THIS_WEEK)
            else -> MacroStressCopy.changeClause(delta, MacroStressCopy.since(basisDate))
        }
        val deltaReference = when {
            basisDate == null -> null
            weekly -> MacroStressCopy.VS_WEEK_AGO
            else -> MacroStressCopy.versus(basisDate)
        }

        // Trend: the last [days] calendar days up to the latest reading.
        val window = all.filter { ChronoUnit.DAYS.between(it.date, latest.date) < days }
        val chart = LineChartData(
            series = listOf(ChartSeries(MacroStressCopy.SERIES, window.map { it.score }, subject = true)),
            xLabels = window.map { fmt.shortDate(it.date) },
            dates = window.map { it.date },
        )
        val first = window.first().score
        val chartTitle = if (window.size < 2) {
            MacroStressCopy.chartTitleOne(latest.score)
        } else {
            MacroStressCopy.chartTitle(first, latest.score, days)
        }
        val chartSummary = ChartMath.summary(
            MacroStressCopy.SERIES,
            window.map { it.score },
            { Fmt.score(it) },
            MacroStressCopy.rangeSpoken(days),
            label,
        )

        // Factors: change since the previous reading that carries inputs.
        val previous = all.dropLast(1).lastOrNull { it.snapshot.subScores.isNotEmpty() }
        val previousDate = previous?.date?.let(fmt::marketDate)
        val prevScores = previous?.snapshot?.subScores.orEmpty()
            .filter { it.available }
            .associate { it.inputName.trim().uppercase() to it.normalizedScore }
        val inputs = latest.snapshot.subScores
        val factors = inputs.filter { it.available && it.normalizedScore?.isFinite() == true }.map { s ->
            factor(s, prevScores[s.inputName.trim().uppercase()], previousDate, fmt)
        }
        val missing = missing(latest.snapshot)
        val scoreDelta = previous?.let { latest.score - it.score }

        return MacroStressModel(
            asOf = latest.date,
            asOfText = fmt.marketDate(latest.date),
            score = score,
            label = label,
            tone = macroStressTone(score),
            leadClause = MacroStressCopy.leadClause(label),
            changeClause = changeClause,
            delta = delta,
            deltaText = delta?.let { Fmt.pts(it) },
            deltaReference = deltaReference,
            deltaTone = delta?.let(::macroStressDeltaTone) ?: Tone.Neutral,
            rangeDays = days,
            chart = chart,
            chartTitle = chartTitle,
            chartSummary = chartSummary,
            windowStartText = window.takeIf { it.size > 1 }?.first()?.date?.let(fmt::shortDate),
            table = table(window, fmt),
            factors = factors,
            factorHeadline = factorHeadline(factors, scoreDelta),
            factorDeck = if (factors.any { it.change != null } && previousDate != null) MacroStressCopy.changeSince(previousDate) else null,
            sources = inputs.mapNotNull { MacroStressCopy.sourceName(it.inputName, it.provider) }.distinct(),
            missing = missing,
            sheetInputs = factors.map { it.label to listOfNotNull(it.scoreText, pressureWord(it.score)).joinToString(", ") },
        )
    }

    /** "high pressure" / "medium pressure" / "low pressure" for an input's 0 to 100 rating. */
    fun pressureWord(score: Double?): String? = when {
        score == null || !score.isFinite() -> null
        score >= PRESSURE_HIGH_FROM -> MacroStressCopy.PRESSURE_HIGH
        score >= PRESSURE_MEDIUM_FROM -> MacroStressCopy.PRESSURE_MEDIUM
        score > 0.0 -> MacroStressCopy.PRESSURE_LOW
        else -> null
    }

    /**
     * The headline over the inputs, a sentence about the result: the input that moved most in the direction of the
     * score's change since the previous reading; with no change, the input that carries the most pressure.
     */
    fun factorHeadline(factors: List<MacroFactor>, scoreDelta: Double?): String {
        if (factors.isEmpty()) return MacroStressCopy.NO_FACTORS
        if (scoreDelta != null && scoreDelta >= FLAT) {
            factors.filter { (it.change ?: 0.0) > 0.0 }.maxByOrNull { it.change!! }
                ?.let { return MacroStressCopy.didMostOfTheRise(it.label) }
        }
        if (scoreDelta != null && scoreDelta <= -FLAT) {
            factors.filter { (it.change ?: 0.0) < 0.0 }.minByOrNull { it.change!! }
                ?.let { return MacroStressCopy.didMostOfTheFall(it.label) }
        }
        val top = factors.maxOf { it.score }
        val leaders = factors.filter { abs(it.score - top) < FLAT }
        // Every input at the same level: no single input leads. Otherwise the first of the leaders (server order).
        return if (factors.size > 1 && leaders.size == factors.size) {
            MacroStressCopy.EVEN_PRESSURE
        } else {
            MacroStressCopy.carriesMost(leaders.first().label)
        }
    }

    private fun factor(s: SentimentSubScoreView, previous: Double?, previousDate: String?, fmt: Fmt): MacroFactor {
        val score = s.normalizedScore!!.coerceIn(0.0, SCORE_MAX)
        val label = MacroStressCopy.inputLabel(s.inputName)
        val change = previous?.takeIf { it.isFinite() }?.let { score - it }
        // The rows show the change alone (the section deck names the date); TalkBack hears the date too.
        val changeText = change?.let { Fmt.pts(it) }
        val changeSpoken = change?.let { c -> previousDate?.let { "${Fmt.pts(c)} ${MacroStressCopy.since(it)}" } ?: Fmt.pts(c) }
        val reading = reading(s, fmt)
        val pressure = pressureWord(score)
        val sub = listOfNotNull(reading, pressure).joinToString(" · ").ifEmpty { null }
        return MacroFactor(
            key = s.inputName.trim().uppercase(),
            label = label,
            score = score,
            scoreText = Fmt.score(score),
            sub = sub,
            change = change,
            changeText = changeText,
            changeTone = change?.let(::macroStressDeltaTone) ?: Tone.Neutral,
            spoken = MacroStressCopy.factorSpoken(label, Fmt.score(score), pressure, changeSpoken),
        )
    }

    /** The input's own reading with its period: "4.40%, 21 Nov", "index 315.6, Oct 2025", "$71.20". */
    fun reading(s: SentimentSubScoreView, fmt: Fmt): String? {
        val raw = s.rawValue?.takeIf { it.isFinite() } ?: return null
        val id = s.inputName.trim().uppercase()
        val value = when {
            id.startsWith("TREASURY") -> Fmt.pct(raw, dp = 2)
            id.startsWith("BLS_CPI") -> "index ${Fmt.number(raw, 1)}"
            id.startsWith("BLS_UNEMPLOYMENT") || id.startsWith("BEA_") -> Fmt.pct(raw, dp = 1)
            id.startsWith("EIA") -> Fmt.money(raw)
            else -> Fmt.number(raw, 2)
        }
        val period = period(s.notes, fmt)
        return if (period == null) value else "$value, $period"
    }

    private val PeriodInReason = Regex("\\(([^()]+)\\)\\.?\\s*$")
    private val YearMonth = Regex("^(\\d{4})-(\\d{2})$")
    private val YearQuarter = Regex("^(\\d{4})-?Q([1-4])$", RegexOption.IGNORE_CASE)

    /** The period at the end of the server's reason ("... (2025-10)."), as words; never a raw ISO date. */
    fun period(notes: String?, fmt: Fmt): String? {
        val raw = notes?.let { PeriodInReason.find(it)?.groupValues?.get(1)?.trim() } ?: return null
        parseDate(raw)?.takeIf { raw.length >= ISO_DATE_LENGTH }?.let { return fmt.shortDate(it) }
        YearMonth.find(raw)?.let { m ->
            val month = m.groupValues[2].toInt()
            if (month in 1..12) {
                return java.time.YearMonth.of(m.groupValues[1].toInt(), month)
                    .format(java.time.format.DateTimeFormatter.ofPattern("MMM yyyy", java.util.Locale.US))
            }
        }
        YearQuarter.find(raw)?.let { m -> return "Q${m.groupValues[2]} ${m.groupValues[1]}" }
        return null
    }

    /** Missing inputs ("BEA_REAL_GDP:stale_period") and unavailable sub-scores, each once, with the reason. */
    fun missing(snapshot: SentimentSnapshotView): List<MacroMissing> {
        val listed = snapshot.missingInputs.mapNotNull { entry ->
            val id = entry.substringBefore(':').trim().ifBlank { null } ?: return@mapNotNull null
            val code = entry.substringAfter(':', "").ifBlank { null }
            id.uppercase() to MacroStressCopy.missingReason(code)
        }
        val unavailable = snapshot.subScores.filter { !it.available || it.normalizedScore?.isFinite() != true }
            .map { it.inputName.trim().uppercase() to MacroStressCopy.missingReason(null) }
        return (listed + unavailable)
            .distinctBy { it.first }
            .map { (id, reason) -> MacroMissing(MacroStressCopy.inputLabel(id), reason) }
    }

    /** "Show table": the readings in the window, newest first, with the change from the reading before. */
    fun table(window: List<MacroReading>, fmt: Fmt): CompareTableModel? {
        if (window.isEmpty()) return null
        val rows = window.indices.reversed().map { i ->
            val r = window[i]
            val change = window.getOrNull(i - 1)?.let { r.score - it.score }
            CompareRow(
                label = fmt.marketDate(r.date),
                values = listOf(Fmt.score(r.score)),
                delta = change?.let { Fmt.number(it, 0).let { n -> if (it >= FLAT) "+$n" else n } },
                deltaTone = change?.let(::macroStressDeltaTone) ?: Tone.Neutral,
            )
        }
        return CompareTableModel(
            columns = listOf(CompareColumn(MacroStressCopy.TABLE_SCORE, subject = true)),
            rows = rows,
            labelHeader = MacroStressCopy.TABLE_DATE,
            deltaHeader = MacroStressCopy.TABLE_CHANGE,
        )
    }

    private const val ISO_DATE_LENGTH = 10
}

/**
 * The previous entry point, kept so `ThesisApp.kt` compiles until WP-INT calls [MacroStressScreen] from the shell
 * with `isMacroRefreshing` (HANDOFF-F item 2). Until then it keeps its own refresh state, as the old screen did:
 * the skeleton while nothing has answered yet (at most [FIRST_LOAD_MAX_MS]), and the pull indicator until the data
 * changes or [PULL_INDICATOR_MS] passes.
 */
@Composable
fun MacroStressDashboardScreen(
    current: SentimentSnapshotView?,
    history: List<SentimentSnapshotView>,
    selectedRangeDays: Int,
    sentimentError: String?,
    onSelectRange: (Int) -> Unit,
    onBack: () -> Unit,
    onRefresh: (() -> Unit)? = null,
) {
    var refreshing by remember { mutableStateOf(current == null && history.isEmpty() && sentimentError.isNullOrBlank()) }
    var pulls by remember { mutableIntStateOf(0) }
    val answer by rememberUpdatedState(Triple(current, history, sentimentError))
    LaunchedEffect(pulls) {
        if (!refreshing) return@LaunchedEffect
        val before = answer
        withTimeoutOrNull(if (pulls == 0) FIRST_LOAD_MAX_MS else PULL_INDICATOR_MS) {
            snapshotFlow { answer }.first { it != before }
        }
        refreshing = false
    }
    val range = MacroStressModels.normalizeRange(selectedRangeDays)
    MacroStressScreen(
        current = current,
        history = history,
        selectedRangeDays = selectedRangeDays,
        sentimentError = sentimentError,
        onSelectRange = onSelectRange,
        onBack = onBack,
        refreshing = refreshing,
        onRefresh = {
            refreshing = true
            pulls++
            onRefresh?.invoke() ?: onSelectRange(range)
        },
    )
}

private const val FIRST_LOAD_MAX_MS = 10_000L
private const val PULL_INDICATOR_MS = 1_800L

/**
 * Macro Stress (5.9). [history] is the ViewModel's readings for the selected range (any order); [current] the
 * latest snapshot. [refreshing] is `isMacroRefreshing`; [onRefresh] reloads (by default the selected range again).
 * [padding] is the shell's: its bottom keeps the last block above the navigation bar; the top bar applies the
 * status-bar inset itself.
 */
@Composable
fun MacroStressScreen(
    current: SentimentSnapshotView?,
    history: List<SentimentSnapshotView>,
    selectedRangeDays: Int,
    sentimentError: String?,
    onSelectRange: (Int) -> Unit,
    onBack: () -> Unit,
    padding: PaddingValues = PaddingValues(),
    refreshing: Boolean = false,
    onRefresh: (() -> Unit)? = null,
) {
    val fmt = LocalFmt.current
    val range = MacroStressModels.normalizeRange(selectedRangeDays)
    val model = remember(current, history, range, fmt) { MacroStressModels.build(current, history, range, fmt) }
    val refresh = onRefresh ?: { onSelectRange(range) }
    val scroll = rememberScrollState()
    val collapsed by rememberTopBarCollapsed(scroll)
    var barHeightPx by remember { mutableIntStateOf(0) }
    val barHeight = with(LocalDensity.current) { barHeightPx.toDp() }
    var sheetOpen by rememberSaveable { mutableStateOf(false) }

    val loadingFirst = model == null && refreshing && sentimentError.isNullOrBlank()
    val showSkeleton = rememberShowSkeleton(loadingFirst)
    val state: Loadable<MacroStressModel> = when {
        model != null -> Loadable.Ready(model)
        !sentimentError.isNullOrBlank() -> Loadable.Failed(sentimentError)
        loadingFirst -> Loadable.Loading
        else -> Loadable.Empty(MacroStressCopy.EMPTY)
    }

    Box(Modifier.fillMaxSize()) {
        ThesisRefreshBox(
            refreshing = refreshing,
            onRefresh = refresh,
            modifier = Modifier.fillMaxSize(),
            indicatorTop = barHeight,
        ) {
            Column(
                Modifier
                    .fillMaxSize()
                    .verticalScroll(scroll)
                    .padding(top = barHeight, bottom = padding.calculateBottomPadding() + ThesisSpace.x5)
                    .padding(horizontal = ThesisSpace.gutter),
            ) {
                StateCrossfade(
                    state = state,
                    onRetry = refresh,
                    failedSubject = MacroStressCopy.LOAD_SUBJECT,
                    loading = { if (showSkeleton) MacroSkeleton() },
                    empty = {
                        EmptyState(
                            sentence = MacroStressCopy.EMPTY,
                            how = MacroStressCopy.EMPTY_HOW,
                            modifier = Modifier.padding(top = ThesisSpace.headerTop),
                        )
                    },
                    failed = {
                        ErrorState(
                            title = KitCopy.couldNotLoad(MacroStressCopy.LOAD_SUBJECT),
                            cause = it.cause,
                            onRetry = refresh,
                            modifier = Modifier.padding(top = ThesisSpace.headerTop),
                        )
                    },
                ) { m ->
                    MacroBody(
                        model = m,
                        refreshFailed = !sentimentError.isNullOrBlank(),
                        onRetry = refresh,
                        onSelectRange = onSelectRange,
                        onOpenInfo = { sheetOpen = true },
                    )
                }
            }
        }
        ThesisTopBar(
            modifier = Modifier.onSizeChanged { barHeightPx = it.height },
            title = MacroStressCopy.TITLE,
            onBack = onBack,
            collapsed = collapsed,
            titleAlwaysVisible = true,
        )
    }

    if (sheetOpen && model != null) {
        SourceSheet(
            info = SourceInfo(
                metric = MacroStressCopy.SHEET_METRIC,
                definition = MacroStressCopy.SHEET_DEFINITION,
                form = MacroStressCopy.SHEET_FORM,
                period = model.asOfText?.let(MacroStressCopy::sheetPeriod),
                derivation = MacroStressCopy.SHEET_DERIVATION,
                inputs = model.sheetInputs,
            ),
            onDismissRequest = { sheetOpen = false },
        )
    }
}

@Composable
private fun MacroBody(
    model: MacroStressModel,
    refreshFailed: Boolean,
    onRetry: () -> Unit,
    onSelectRange: (Int) -> Unit,
    onOpenInfo: () -> Unit,
) {
    Column(Modifier.fillMaxWidth()) {
        if (refreshFailed) {
            InlineBanner(
                text = MacroStressCopy.REFRESH_FAILED,
                tone = BannerTone.Attention,
                actionLabel = KitCopy.TRY_AGAIN,
                onAction = onRetry,
                modifier = Modifier.padding(top = ThesisSpace.headerTop),
            )
        }
        MacroHeader(model, onOpenInfo, Modifier.padding(top = ThesisSpace.headerTop))
        Spacer(Modifier.height(ThesisSpace.headerToSection))
        TrendSection(model, onSelectRange)
        Spacer(Modifier.height(ThesisSpace.sectionGapReading))
        FactorSection(model)
        Spacer(Modifier.height(ThesisSpace.sectionGapReading))
        HowToRead()
    }
}

@Composable
private fun MacroHeader(model: MacroStressModel, onOpenInfo: () -> Unit, modifier: Modifier = Modifier) {
    val p = LocalThesisPalette.current
    Column(modifier.fillMaxWidth()) {
        Eyebrow(MacroStressCopy.eyebrow(model.asOf?.let { LocalFmt.current.shortDate(it) }))
        Spacer(Modifier.height(ThesisSpace.s))
        Text(
            ledeText(model.leadClause, model.changeClause, p),
            // The page's heading: the bar names the screen, this sentence says what it found.
            modifier = Modifier.semantics { heading() },
            style = ThesisType.lede,
            color = p.ink2,
        )
        Spacer(Modifier.height(ThesisSpace.l))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Row(
                Modifier
                    .weight(1f)
                    .semantics(mergeDescendants = true) {
                        contentDescription = "${MacroStressCopy.SHEET_METRIC} ${model.scoreTextSpoken()}, ${model.label}"
                    },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(verticalAlignment = Alignment.Bottom) {
                    // Final on first paint; a refresh that changes the score rolls it (4.6).
                    RollingNumber(
                        value = model.score,
                        format = { Fmt.score(it) },
                        style = ThesisType.capped(ThesisType.figure),
                        color = p.ink,
                        modifier = Modifier.alignByBaseline(),
                    )
                    Spacer(Modifier.width(ThesisSpace.s))
                    Text(
                        MacroStressCopy.OF_100,
                        modifier = Modifier.alignByBaseline(),
                        style = ThesisType.caption,
                        color = p.muted,
                    )
                }
                Spacer(Modifier.width(ThesisSpace.m))
                StatusBadge(model.label, model.tone)
            }
            ThesisIconButton(ThesisIcons.Info, contentDescription = MacroStressCopy.INFO, onClick = onOpenInfo)
        }
        Spacer(Modifier.height(ThesisSpace.xs))
        Row(Modifier.semantics(mergeDescendants = true) { }) {
            if (model.deltaText != null) {
                Text(model.deltaText, style = ThesisType.caption.tnum(), color = model.deltaTone.textColor(p))
                Spacer(Modifier.width(ThesisSpace.xs))
            }
            Text(
                model.deltaReference ?: MacroStressCopy.FIRST_READING,
                style = ThesisType.caption,
                color = p.muted,
            )
        }
        Spacer(Modifier.height(ThesisSpace.l))
        ScaleBar(
            value = model.score,
            segments = macroStressSegments(),
            contentDescription = "${MacroStressCopy.SHEET_METRIC} ${model.scoreTextSpoken()}, ${model.label}",
        )
    }
}

private fun MacroStressModel.scoreTextSpoken(): String = "${Fmt.score(score)} ${MacroStressCopy.OF_100}"

@Composable
private fun TrendSection(model: MacroStressModel, onSelectRange: (Int) -> Unit) {
    val chartState = rememberLineChartState()
    val clipboard = LocalClipboardManager.current
    val haptics = rememberHaptics()
    // "Readings copied" stands until the readings change (another range, a refresh).
    var copied by remember(model.table) { mutableStateOf(false) }
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(ThesisSpace.cardGap)) {
        SegmentedControl(
            options = MacroStressCopy.RANGES,
            selectedIndex = MacroStressRanges.indexOf(model.rangeDays).coerceAtLeast(0),
            onSelect = { i -> onSelectRange(MacroStressRanges[i]) },
        )
        Column(Modifier.fillMaxWidth()) {
            ChartCard(
                title = model.chartTitle,
                fignum = 1,
                subtitle = MacroStressCopy.chartSubtitle(model.rangeDays),
                source = MacroStressCopy.CHART_SOURCE,
                table = model.table,
                readout = {
                    LineChartReadout(
                        data = model.chart,
                        state = chartState,
                        valueFormat = { Fmt.score(it) },
                        // The kit's change runs from the window's first reading (latest or scrubbed point), so it names
                        // that basis; a two-finger window shows its own dates beside it.
                        changeFormat = { d ->
                            val start = model.windowStartText
                            if (start == null || chartState.compareRange != null) {
                                Fmt.pts(d)
                            } else {
                                MacroStressCopy.changeSinceStart(Fmt.pts(d), start)
                            }
                        },
                        nowLabel = model.asOfText,
                        changeTone = ::macroStressDeltaTone,
                    )
                },
            ) {
                LineChart(
                    data = model.chart,
                    valueFormat = { Fmt.score(it) },
                    height = ChartHeights.Featured,
                    bands = macroStressBands(),
                    yRange = 0.0..SCORE_MAX,
                    state = chartState,
                    // Draws on once per reading date: back on Macro Stress the same day, the chart is complete (4.6).
                    dataKey = model.asOf?.let { "macro-stress-$it" },
                    summary = model.chartSummary,
                )
            }
            val table = model.table
            if (table != null) {
                // Under the card's foot, at its end; the label confirms the copy (no system toast before Android 13).
                TextAction(
                    if (copied) MacroStressCopy.COPIED else MacroStressCopy.COPY_TABLE,
                    onClick = {
                        clipboard.setText(AnnotatedString(table.toTsv()))
                        haptics.confirm()
                        copied = true
                    },
                    modifier = Modifier
                        .align(Alignment.End)
                        .semantics { liveRegion = LiveRegionMode.Polite },
                )
            }
        }
    }
}

@Composable
private fun FactorSection(model: MacroStressModel) {
    val p = LocalThesisPalette.current
    Column(Modifier.fillMaxWidth()) {
        SectionHeader(
            kicker = MacroStressCopy.FACTORS_KICKER,
            headline = model.factorHeadline,
            deck = model.factorDeck,
        )
        if (model.factors.isNotEmpty()) {
            Spacer(Modifier.height(ThesisSpace.m))
            RowGroup {
                model.factors.forEach { f -> row { FactorRow(f) } }
            }
        }
        if (model.sources.isNotEmpty()) {
            Spacer(Modifier.height(ThesisSpace.s))
            Text(MacroStressCopy.sources(model.sources), style = ThesisType.caption, color = p.muted)
        }
        if (model.missing.isNotEmpty()) {
            Spacer(Modifier.height(ThesisSpace.cardGap))
            ThesisCard(variant = CardVariant.NotSeen, title = MacroStressCopy.MISSING_TITLE) {
                model.missing.forEach { m ->
                    Column(Modifier.semantics(mergeDescendants = true) { }) {
                        Text(m.label, style = ThesisType.rowTitle, color = p.ink2)
                        Text(m.reason, style = ThesisType.bodySmall, color = p.muted)
                    }
                }
            }
        }
    }
}

/** One input: label and reading on the left, its 0 to 100 rating over the change on the right, a list meter below. */
@Composable
private fun FactorRow(f: MacroFactor) {
    val p = LocalThesisPalette.current
    Column(
        Modifier
            .fillMaxWidth()
            .semantics(mergeDescendants = true) { contentDescription = f.spoken }
            .padding(horizontal = ThesisSpace.l, vertical = ThesisSpace.rowPaddingV),
        verticalArrangement = Arrangement.spacedBy(ThesisSpace.s),
    ) {
        Row(verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f)) {
                Text(f.label, style = ThesisType.body, color = p.ink)
                if (f.sub != null) Text(f.sub, style = ThesisType.bodySmall, color = p.ink2)
            }
            Spacer(Modifier.width(ThesisSpace.m))
            Column(horizontalAlignment = Alignment.End) {
                Text(f.scoreText, style = ThesisType.body.tnum(), color = p.ink)
                if (f.changeText != null) {
                    Text(f.changeText, style = ThesisType.caption.tnum(), color = f.changeTone.textColor(p))
                }
            }
        }
        Meter((f.score / SCORE_MAX).toFloat())
    }
}

/** "How to read this": a row that expands in place into the explanation (`animateContentSize`, `spatial`). */
@Composable
private fun HowToRead() {
    val reduced = LocalReducedMotion.current
    var open by rememberSaveable { mutableStateOf(false) }
    Column(
        Modifier
            .fillMaxWidth()
            .then(if (reduced) Modifier else Modifier.animateContentSize(ThesisMotion.spatial())),
        verticalArrangement = Arrangement.spacedBy(ThesisSpace.s),
    ) {
        RowGroup {
            row(dividerInset = ThesisSpace.l) {
                ActionRow(
                    icon = ThesisIcons.Info,
                    title = MacroStressCopy.HOW_TITLE,
                    caption = MacroStressCopy.HOW_CAPTION,
                    onClick = { open = !open },
                    modifier = Modifier.semantics { stateDescription = if (open) MacroStressCopy.EXPANDED else MacroStressCopy.COLLAPSED },
                )
            }
        }
        if (open) Callout(MacroStressCopy.HOW_BODY)
    }
}

/** The first load's skeleton: the header's lines, the range control's place and the chart card. */
@Composable
private fun MacroSkeleton() {
    ShimmerHost {
        Column(
            Modifier.fillMaxWidth().padding(top = ThesisSpace.headerTop),
            verticalArrangement = Arrangement.spacedBy(ThesisSpace.m),
        ) {
            SkeletonText(ThesisType.eyebrow, widthFraction = SKELETON_EYEBROW)
            SkeletonText(ThesisType.lede, widthFraction = SKELETON_LEDE)
            SkeletonText(ThesisType.figure, widthFraction = SKELETON_FIGURE)
            SkeletonBlock(Modifier.fillMaxWidth().height(ThesisSpace.s))
            Spacer(Modifier.height(ThesisSpace.m))
            SkeletonBlock(Modifier.fillMaxWidth().height(ThesisSpace.touchMin))
            SkeletonChart()
        }
    }
}

private const val SKELETON_EYEBROW = 0.4f
private const val SKELETON_LEDE = 0.85f
private const val SKELETON_FIGURE = 0.25f
