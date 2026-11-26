package com.thesis.mobile.preview.fixtures

import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.model.SentimentSnapshotView
import com.thesis.mobile.model.SentimentSubScoreView
import com.thesis.mobile.ui.format.Fmt
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

/**
 * WP-F fixtures (Macro Stress 5.9, Inbox 5.21): a fixed clock (Tue 25 Nov 2025, 09:30 in London), 90 days of macro
 * stress readings with the six official inputs on the last two, and an Inbox across three days.
 */
object MacroInboxFixtures {
    val zone: ZoneId = ZoneId.of("Europe/London")
    val now: Instant = Instant.parse("2025-11-25T09:30:00Z")
    val clock: Clock = Clock.fixed(now, zone)
    val fmt = Fmt(clock, zone, is24h = true)

    // ---- Macro Stress

    // Initialised before macroHistory, which reads them.
    private val LastWeek = listOf(49.0, 50.0, 48.0, 49.0, 50.0, 49.0, 49.0, 55.0)
    private const val CurveOffset = 12.0
    private const val CurveFallback = 52.0

    private fun sub(id: String, provider: String, score: Double?, raw: Double?, notes: String?, available: Boolean = true) =
        SentimentSubScoreView(
            inputName = id,
            provider = provider,
            available = available,
            weight = 1.0,
            normalizedScore = score,
            rawValue = raw,
            retrievedAt = "2025-11-24T21:00:00Z",
            notes = notes,
        )

    /** The latest inputs: rates high, prices and oil medium, jobs low; GDP missing (stale period). */
    private val latestInputs = listOf(
        sub("TREASURY_DAILY_10Y", "treasury", 85.0, 4.42, "rates|fresh|10-year above 4.25% (2025-11-21)."),
        sub("TREASURY_DAILY_2Y", "treasury", 55.0, 3.98, "rates|fresh|2-year between 3.5% and 4.25% (2025-11-21)."),
        sub("BLS_CPI_U_ALL_ITEMS", "bls", 55.0, 324.4, "inflation|fresh|CPI-U rising moderately (2025-10)."),
        sub("BLS_UNEMPLOYMENT_RATE", "bls", 25.0, 4.1, "labor|fresh|unemployment steady (2025-10)."),
        sub("EIA_WTI_SPOT", "eia", 55.0, 71.2, "energy|fresh|WTI between 60 and 80 (2025-11-21)."),
        sub("BEA_REAL_GDP", "bea", null, null, null, available = false),
    )

    private val previousInputs = listOf(
        sub("TREASURY_DAILY_10Y", "treasury", 55.0, 4.21, "rates|fresh|10-year between 3.5% and 4.25% (2025-11-20)."),
        sub("TREASURY_DAILY_2Y", "treasury", 55.0, 3.95, "rates|fresh|2-year between 3.5% and 4.25% (2025-11-20)."),
        sub("BLS_CPI_U_ALL_ITEMS", "bls", 55.0, 324.4, "inflation|fresh|CPI-U rising moderately (2025-10)."),
        sub("BLS_UNEMPLOYMENT_RATE", "bls", 25.0, 4.1, "labor|fresh|unemployment steady (2025-10)."),
        sub("EIA_WTI_SPOT", "eia", 55.0, 69.8, "energy|fresh|WTI between 60 and 80 (2025-11-20)."),
    )

    /** 90 daily readings ending Mon 24 Nov 2025 (ChartFixtures.stress90), the last two with inputs. */
    val macroHistory: List<SentimentSnapshotView> = ChartFixtures.stressDates.mapIndexed { i, date ->
        val last = i == ChartFixtures.stressDates.lastIndex
        val previous = i == ChartFixtures.stressDates.lastIndex - 1
        // The inputs' average on the last two days (49, then 55 when the 10-year moved to high pressure), a flat
        // last week before them, and the gallery's 90-day stress curve, lowered, before that.
        val fromEnd = ChartFixtures.stressDates.lastIndex - i
        val score = when {
            fromEnd < LastWeek.size -> LastWeek[LastWeek.lastIndex - fromEnd]
            else -> (ChartFixtures.stress90[i] ?: CurveFallback) - CurveOffset
        }
        SentimentSnapshotView(
            id = "macro-$date",
            marketDate = date.toString(),
            score = score,
            label = "",
            subScores = when {
                last -> latestInputs
                previous -> previousInputs
                else -> emptyList()
            },
            missingInputs = if (last) listOf("BEA_REAL_GDP:stale_period") else emptyList(),
            calculatedAt = "${date}T21:00:00Z",
        )
    }

    val macroCurrent: SentimentSnapshotView = macroHistory.last()

    /** The readings the ViewModel holds for a range (it loads one range at a time). */
    fun macroRange(days: Int): List<SentimentSnapshotView> = macroHistory.takeLast(days)

    // ---- Inbox

    private fun alert(
        id: String,
        type: String,
        category: String,
        title: String,
        body: String,
        createdAt: String,
        reason: String,
        ticker: String? = null,
        detail: String? = null,
        locked: Boolean = false,
        feedback: String? = null,
        mutedAt: String? = null,
        reportId: String? = null,
        warRoomId: String? = null,
        pulseDate: String? = null,
    ) = AlertLedgerItemView(
        id = id,
        notificationType = type,
        category = category,
        route = "inbox",
        title = title,
        body = body,
        detailBody = detail,
        detailLocked = locked,
        reasonCode = "watchlist",
        reasonText = reason,
        deliveryState = "delivered",
        feedbackState = feedback,
        mutedAt = mutedAt,
        ticker = ticker,
        reportId = reportId,
        pulseDate = pulseDate,
        createdAt = createdAt,
        updatedAt = createdAt,
        warRoomId = warRoomId,
    )

    val alerts: List<AlertLedgerItemView> = listOf(
        alert(
            "a1", "contrarian_alert", "thesis_drift",
            "NVDA thesis drifted on data center margin",
            "Gross margin guidance fell 2.1 points against the thesis assumption of a stable 75%.",
            "2025-11-25T08:12:00Z", "You follow NVDA", ticker = "NVDA",
            detail = "Data center gross margin, guided: 75.0% in Q2 FY26, 72.9% in Q3 FY26. The thesis assumed it holds above 74%.",
            reportId = "r-nvda",
        ),
        alert(
            "a2", "earnings_preview", "earnings",
            "AAPL reports Thursday after the close",
            "Consensus revenue $94.5B. Services growth is the line the thesis watches.",
            "2025-11-25T07:05:00Z", "Earnings within 3 days for a name you follow", ticker = "AAPL",
            warRoomId = "wr-aapl", locked = true,
        ),
        alert(
            "a3", "market_pulse_ready", "pulse",
            "Today’s Pulse is ready",
            "Rates led the session; 3 of your names moved more than 2%.",
            "2025-11-25T06:30:00Z", "Daily Pulse", pulseDate = "2025-11-25",
        ),
        alert(
            "a4", "freshness_decay", "macro",
            "Macro stress rose 6 points to 55",
            "The Treasury 10-year yield moved into high pressure.",
            "2025-11-24T21:40:00Z", "Macro stress changed by 5 points or more", feedback = "useful",
        ),
        alert(
            "a5", "contrarian_alert", "thesis_drift",
            "MSFT cloud growth slowed against the thesis",
            "Azure growth 33% vs the 35% the thesis assumed.",
            "2025-11-24T14:02:00Z", "You follow MSFT", ticker = "MSFT",
            detail = "Azure and other cloud services growth: 35% in Q4 FY25, 33% in Q1 FY26.",
        ),
        alert(
            "a6", "kill_switch", "system",
            "Report refresh paused for TSLA",
            "The latest 10-Q is not in the filing index yet; the report keeps its last version.",
            "2025-11-24T09:15:00Z", "A report you follow could not refresh", ticker = "TSLA",
        ),
        alert(
            "a7", "earnings_preview", "earnings",
            "AMZN earnings call transcript is in",
            "AWS operating margin 36.9%, up from 35.5%.",
            "2025-11-21T22:10:00Z", "You follow AMZN", ticker = "AMZN", reportId = "r-amzn",
        ),
        alert(
            "a8", "weekly_digest", "system",
            "Your weekly digest",
            "4 names changed this week; NVDA moved the most.",
            "2025-11-21T07:00:00Z", "Weekly digest",
            mutedAt = "2025-11-25T07:00:00Z",
        ),
    )

    /** The last visit: before this morning's three alerts. */
    val lastVisitAtMs: Long = Instant.parse("2025-11-25T06:00:00Z").toEpochMilli()
}
