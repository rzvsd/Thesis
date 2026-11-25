package com.thesis.mobile.ui.today

import androidx.compose.runtime.Immutable
import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.model.ReportSummaryView
import com.thesis.mobile.model.SentimentSnapshotView
import com.thesis.mobile.model.SnapshotDelta
import com.thesis.mobile.model.ThesisMonitorSnapshotView
import com.thesis.mobile.ui.copy.TodayCopy
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.theme.Tone
import com.thesis.mobile.ui.theme.macroStressDeltaTone
import com.thesis.mobile.ui.theme.macroStressLabel
import com.thesis.mobile.ui.theme.macroStressTone
import com.thesis.mobile.ui.theme.thesisStateTone
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

/*
 * Models of the Today screens (docs/app-redesign/DESIGN-DIRECTION.md 5.6 blocks 4 and 5, 5.8): the names rows and
 * their headline, the macro stress summary with its 7-day comparison, and the weekly digest. Pure functions of the
 * data the app already holds and a clock, so the screens stay thin and the rules are unit-tested.
 */

/** Day words for "since" captions: "today", "yesterday", "Tue" within the week, else "17 Nov". */
internal fun dayWord(at: Instant, clock: Clock, fmt: Fmt): String {
    val zone = clock.zone
    val day = at.atZone(zone).toLocalDate()
    val today = LocalDate.now(clock)
    val days = ChronoUnit.DAYS.between(day, today)
    return when {
        days <= 0L -> "today"
        days == 1L -> "yesterday"
        days < 7L -> day.format(Weekday)
        else -> fmt.shortDate(day)
    }
}

private val Weekday = DateTimeFormatter.ofPattern("EEE", Locale.US)

// ---- Your names ---------------------------------------------------------------------------------------------------

/** One row of Home's names group. */
@Immutable
data class NameRowModel(
    val ticker: String,
    val tone: Tone,
    val stateLabel: String,
    val line2: String,
    val figure: String?,
    val figureCaption: String?,
    val figureCaptionTone: Tone,
    val hasNote: Boolean,
    val changed: Boolean,
)

@Immutable
data class NamesSummary(
    val headline: String,
    val rows: List<NameRowModel>,
    /** Names not shown ("+N more"). */
    val more: Int,
    val total: Int,
)

object HomeNames {

    const val LIMIT = 5

    /** Severity first (the Names default order): At risk, Watch, no reading, Intact. */
    private fun severity(tone: Tone): Int = when (tone) {
        Tone.Unfavourable -> 0
        Tone.Attention -> 1
        Tone.Unknown, Tone.Neutral -> 2
        Tone.Favourable -> 3
    }

    fun summary(
        watchlist: List<String>,
        snapshots: List<ThesisMonitorSnapshotView>,
        deltas: Map<String, SnapshotDelta>,
        notedTickers: Set<String>,
        clock: Clock,
        fmt: Fmt,
        limit: Int = LIMIT,
    ): NamesSummary {
        val tickers = watchlist.map { it.trim().uppercase() }.filter { it.isNotEmpty() }.distinct()
        val byTicker = snapshots.associateBy { it.ticker.trim().uppercase() }
        val noted = notedTickers.map { it.uppercase() }.toSet()
        val all = tickers.mapIndexed { index, ticker ->
            index to row(ticker, byTicker[ticker], deltas[ticker] ?: deltas[ticker.lowercase()], ticker in noted, clock, fmt)
        }
        val ordered = all.sortedWith(
            compareBy<Pair<Int, NameRowModel>>({ severity(it.second.tone) }, { if (it.second.changed) 0 else 1 }, { it.first }),
        ).map { it.second }
        val monitored = tickers.count { byTicker[it] != null }
        val changed = ordered.count { it.changed }
        val review = ordered.count { it.tone == Tone.Attention || it.tone == Tone.Unfavourable }
        val intact = ordered.count { it.tone == Tone.Favourable }
        return NamesSummary(
            headline = TodayCopy.namesHeadline(tickers.size, monitored, changed, review, intact),
            rows = ordered.take(limit),
            more = (ordered.size - limit).coerceAtLeast(0),
            total = tickers.size,
        )
    }

    private fun row(
        ticker: String,
        snapshot: ThesisMonitorSnapshotView?,
        delta: SnapshotDelta?,
        hasNote: Boolean,
        clock: Clock,
        fmt: Fmt,
    ): NameRowModel {
        val state = snapshot?.state ?: delta?.current?.state
        val tone = thesisStateTone(state)
        val previous = delta?.previous
        val changed = delta?.stateChanged == true
        val line2 = when {
            changed && previous != null && delta != null ->
                TodayCopy.stateChange(
                    TodayCopy.stateWord(previous.state),
                    TodayCopy.stateWord(delta.current.state),
                    dayWord(Instant.ofEpochMilli(delta.current.takenAtMs), clock, fmt),
                )
            snapshot != null && snapshot.reason.isNotBlank() -> PulseText.oneSentence(PulseText.clean(snapshot.reason), 90)
            snapshot != null -> TodayCopy.stateWord(snapshot.state)
            else -> TodayCopy.NO_READING_YET
        }
        val score = snapshot?.score ?: delta?.current?.score
        val scoreChange = delta?.scoreChange
        val reportAt = parseInstant(snapshot?.reportGeneratedAt)
        val (caption, captionTone) = when {
            scoreChange != null && previous != null ->
                TodayCopy.scoreSince(scoreChange, dayWord(Instant.ofEpochMilli(previous.takenAtMs), clock, fmt)) to
                    scoreTone(scoreChange)
            reportAt != null -> TodayCopy.reportAge(fmt.relative(reportAt)) to Tone.Neutral
            snapshot != null -> TodayCopy.NO_REPORT_YET to Tone.Unknown
            else -> null to Tone.Neutral
        }
        return NameRowModel(
            ticker = ticker,
            tone = tone,
            stateLabel = TodayCopy.stateWord(state),
            line2 = line2,
            figure = score?.let { Fmt.score(it) },
            figureCaption = caption,
            figureCaptionTone = captionTone,
            hasNote = hasNote,
            changed = changed,
        )
    }

    /** A stronger monitor score is favourable; a change that rounds to 0 is neutral. */
    private fun scoreTone(delta: Double): Tone = when {
        Math.round(delta) == 0L -> Tone.Neutral
        delta > 0 -> Tone.Favourable
        else -> Tone.Unfavourable
    }
}

// ---- Macro stress -------------------------------------------------------------------------------------------------

@Immutable
data class MacroSummary(
    val score: Double,
    val label: String,
    val tone: Tone,
    val title: String,
    /** "+6 pts" (null when there is no earlier reading). */
    val deltaValue: String?,
    /** "vs 7 days ago" or "since Mon 17 Nov". */
    val deltaReference: String?,
    val deltaTone: Tone,
    val delta: Double?,
    /** Readings over the window, oldest first (the sparkline). */
    val spark: List<Double?>,
    val sparkDays: Int,
    val day: LocalDate?,
)

object MacroModel {

    /**
     * Macro stress now against the reading [compareDays] earlier: the latest reading on or before that day, else
     * the earliest one there is ("since" its date). The sparkline covers the last [windowDays] days.
     */
    fun summary(
        current: SentimentSnapshotView?,
        history: List<SentimentSnapshotView>,
        fmt: Fmt,
        windowDays: Int = 30,
        compareDays: Long = 7,
    ): MacroSummary? {
        if (current == null || current.score.isNaN()) return null
        val day = parseDay(current.marketDate)
        val dated = history
            .mapNotNull { s -> parseDay(s.marketDate)?.let { it to s } }
            .filter { day == null || it.first.isBefore(day) }
            .sortedBy { it.first }
        val target = day?.minusDays(compareDays)
        val exact = target?.let { t -> dated.lastOrNull { !it.first.isAfter(t) } }
        val reference = exact ?: dated.firstOrNull()
        val delta = reference?.let { current.score - it.second.score }
        val refText = reference?.let { (d, _) -> if (d == target) TodayCopy.VS_7_DAYS else TodayCopy.since(fmt.marketDate(d)) }
        val trend = delta?.let {
            when {
                it >= 0.5 -> TodayCopy.TREND_RISING
                it <= -0.5 -> TodayCopy.TREND_EASING
                else -> TodayCopy.TREND_STEADY
            }
        }
        val label = macroStressLabel(current.score)
        val windowStart = day?.minusDays(windowDays.toLong() - 1)
        val spark = (dated.filter { windowStart == null || !it.first.isBefore(windowStart) }.map { it.second.score } + current.score)
        return MacroSummary(
            score = current.score,
            label = label,
            tone = macroStressTone(current.score),
            title = TodayCopy.macroTitle(label, trend),
            deltaValue = delta?.let { Fmt.pts(it) },
            deltaReference = refText,
            deltaTone = delta?.let { macroStressDeltaTone(it) } ?: Tone.Neutral,
            delta = delta,
            spark = spark,
            sparkDays = windowDays,
            day = day,
        )
    }
}

// ---- Weekly digest ------------------------------------------------------------------------------------------------

@Immutable
data class FilingRowModel(val ticker: String, val reportId: String?, val sub: String, val tone: Tone, val stateLabel: String)

@Immutable
data class StateChangeRowModel(val ticker: String, val line2: String, val tone: Tone, val stateLabel: String)

@Immutable
data class CategoryCount(val category: String, val label: String, val count: Int)

@Immutable
data class DigestModel(
    val start: LocalDate,
    val end: LocalDate,
    val total: Int,
    val macro: MacroSummary?,
    val filings: List<FilingRowModel>,
    /** Null when the snapshot history is not available. */
    val stateChanges: List<StateChangeRowModel>?,
    val alerts: List<CategoryCount>,
    val alertsTotal: Int,
    val pulseLine: String?,
    val pulseDate: String?,
) {
    val lede: String
        get() = TodayCopy.digestLede(macro?.delta, filings.size, stateChanges?.size, alertsTotal, total)

    /** Nothing to sum up: no names, no macro reading, no alerts and no Pulse. */
    val isEmpty: Boolean get() = total == 0 && macro == null && alertsTotal == 0 && pulseLine == null
}

object DigestBuilder {

    fun build(
        digestDate: String?,
        clock: Clock,
        fmt: Fmt,
        watchlist: List<String>,
        monitorSnapshots: List<ThesisMonitorSnapshotView>,
        sentimentCurrent: SentimentSnapshotView?,
        sentimentHistory: List<SentimentSnapshotView>,
        alerts: List<AlertLedgerItemView>,
        weeklyDeltas: List<SnapshotDelta>?,
        reportSummaries: Map<String, ReportSummaryView>,
        pulseLine: String?,
        pulseDate: String?,
    ): DigestModel {
        val end = parseDay(digestDate) ?: LocalDate.now(clock)
        val start = end.minusDays(6)
        val zone = clock.zone
        fun inWeek(at: Instant?): Boolean {
            val d = at?.atZone(zone)?.toLocalDate() ?: return false
            return !d.isBefore(start) && !d.isAfter(end)
        }
        val tickers = watchlist.map { it.trim().uppercase() }.filter { it.isNotEmpty() }.toSet()
        // Strictly the names the reader follows: with an empty watchlist nothing is "among your names".
        val followed = monitorSnapshots.filter { it.ticker.trim().uppercase() in tickers }

        val filings = followed
            .mapNotNull { s -> parseInstant(s.reportGeneratedAt)?.takeIf(::inWeek)?.let { s to it } }
            .sortedByDescending { it.second }
            .map { (s, at) ->
                val change = s.reportId?.let { reportSummaries[it] }?.changeSummary?.topChanges?.firstOrNull()?.title
                    ?.let { PulseText.clean(it) }?.ifBlank { null }
                FilingRowModel(
                    ticker = s.ticker.trim().uppercase(),
                    reportId = s.reportId,
                    sub = change ?: TodayCopy.reportAge(fmt.relative(at)),
                    tone = thesisStateTone(s.state),
                    stateLabel = TodayCopy.stateWord(s.state),
                )
            }

        val stateChanges = weeklyDeltas?.filter { it.stateChanged }?.mapNotNull { d ->
            val prev = d.previous ?: return@mapNotNull null
            StateChangeRowModel(
                ticker = d.ticker.trim().uppercase(),
                line2 = TodayCopy.stateChange(
                    TodayCopy.stateWord(prev.state),
                    TodayCopy.stateWord(d.current.state),
                    dayWord(Instant.ofEpochMilli(d.current.takenAtMs), clock, fmt),
                ),
                tone = thesisStateTone(d.current.state),
                stateLabel = TodayCopy.stateWord(d.current.state),
            )
        }

        val weekAlerts = alerts.filter { inWeek(parseInstant(it.createdAt)) }
        val byCategory = weekAlerts
            .groupBy { it.category.trim().lowercase() }
            .map { (k, v) -> CategoryCount(k, TodayCopy.categoryName(k), v.size) }
            .sortedWith(compareByDescending<CategoryCount> { it.count }.thenBy { it.label })

        return DigestModel(
            start = start,
            end = end,
            total = tickers.size,
            macro = MacroModel.summary(sentimentCurrent, sentimentHistory, fmt, windowDays = 7),
            filings = filings,
            stateChanges = stateChanges,
            alerts = byCategory,
            alertsTotal = weekAlerts.size,
            pulseLine = pulseLine?.ifBlank { null },
            pulseDate = pulseDate,
        )
    }
}
