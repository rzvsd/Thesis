package com.thesis.mobile.preview.fixtures

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.model.ConvictionJournalEntryView
import com.thesis.mobile.model.ConvictionThesisSnapshotView
import com.thesis.mobile.model.DeepDiveChangeSummaryView
import com.thesis.mobile.model.DeepDiveTopChangeView
import com.thesis.mobile.model.FinancialHistoryRowView
import com.thesis.mobile.model.NameDetailView
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.model.ReportSummaryView
import com.thesis.mobile.model.HoldingsImportResultView
import com.thesis.mobile.model.HoldingsImportRowErrorView
import com.thesis.mobile.model.NoteTrailEntry
import com.thesis.mobile.model.SnapshotDelta
import com.thesis.mobile.model.SnapshotPoint
import com.thesis.mobile.model.ThesisMonitorSnapshotView
import com.thesis.mobile.model.TickerSearchItem
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.format.LocalFmt
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset

/**
 * Fixture data for NamesRenders, NameRenders and their semantics tests: eight followed names on 25 Nov 2026,
 * 15:00 UTC, with a last Names visit on 21 Nov. Values are illustrative.
 */
object NamesFixtures {

    val now: Instant = Instant.parse("2026-11-25T15:00:00Z")
    val fmt = Fmt(Clock.fixed(now, ZoneOffset.UTC), ZoneOffset.UTC, is24h = true)
    val lastVisitAtMs: Long = Instant.parse("2026-11-21T09:00:00Z").toEpochMilli()

    /** Provides the fixed-clock formatter, so dates read the same on every run. */
    @Composable
    fun Clocked(content: @Composable () -> Unit) {
        CompositionLocalProvider(LocalFmt provides fmt) { content() }
    }

    val watchlist = listOf("AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "COST", "TSLA", "JPM")

    val companyNames = mapOf(
        "AAPL" to "Apple Inc.",
        "MSFT" to "Microsoft Corporation",
        "NVDA" to "NVIDIA Corporation",
        "AMZN" to "Amazon.com, Inc.",
        "GOOGL" to "Alphabet Inc.",
        "COST" to "Costco Wholesale Corporation",
        "TSLA" to "Tesla, Inc.",
        "JPM" to "JPMorgan Chase & Co.",
    )

    private fun snap(
        ticker: String,
        state: String,
        reason: String,
        score: Double,
        report: String,
        freshness: String = "current",
        freshnessScore: Double = 0.92,
        material: Int = 1,
        unreviewed: Int = 0,
        kill: String? = null,
        freshnessReason: String? = null,
    ) = ThesisMonitorSnapshotView(
        ticker = ticker, state = state, reason = reason, score = score, reportId = "rep-${ticker.lowercase()}",
        reportGeneratedAt = report, lastDeepDiveAt = report, materialEventsCount = material,
        unreviewedEventsCount = unreviewed, freshnessState = freshness, freshnessScore = freshnessScore,
        killSwitchTriggeredAt = kill, freshnessReason = freshnessReason, updatedAt = "2026-11-25T14:20:00Z",
    )

    val snapshots = listOf(
        snap("AAPL", "intact", "Services growth still carries margins through the hardware cycle.", 0.78, "2026-11-13T13:00:00Z"),
        snap(
            "MSFT", "weakened", "Capital spending grew faster than cloud revenue for a second quarter.", 0.61,
            "2026-11-12T13:00:00Z", freshness = "aging", freshnessScore = 0.71, material = 3, unreviewed = 2,
            freshnessReason = "Two filings since the report are not reviewed yet.",
        ),
        snap("NVDA", "improved", "Data-centre margins widened as supply caught up with orders.", 0.84, "2026-11-20T13:00:00Z"),
        snap(
            "AMZN", "unresolved", "The latest filing and the report disagree on retail margins.", 0.48,
            "2026-09-30T13:00:00Z", freshness = "stale", freshnessScore = 0.32, material = 4, unreviewed = 4,
            freshnessReason = "The report is 56 days old and four events are not reviewed.",
        ),
        snap("GOOGL", "intact", "Search revenue held up while cloud losses narrowed.", 0.72, "2026-11-16T13:00:00Z"),
        snap("COST", "intact", "Membership renewals stayed above 90% in every region.", 0.81, "2026-11-12T13:00:00Z"),
        snap(
            "TSLA", "weakened", "Automotive gross margin fell for a fourth straight quarter.", 0.44, "2026-11-16T13:00:00Z",
            freshness = "triggered", freshnessScore = 0.55, material = 2, unreviewed = 1,
            kill = "2026-11-22T12:00:00Z", freshnessReason = "A kill-switch condition fired on 22 Nov.",
        ),
    )

    private fun point(ticker: String, atIso: String, state: String, score: Double) =
        SnapshotPoint(ticker, Instant.parse(atIso).toEpochMilli(), state, score, 0.9, "rep-${ticker.lowercase()}")

    val deltas: Map<String, SnapshotDelta> = mapOf(
        "AAPL" to SnapshotDelta("AAPL", point("AAPL", "2026-11-25T14:20:00Z", "intact", 0.78), point("AAPL", "2026-11-21T08:00:00Z", "intact", 0.74)),
        "MSFT" to SnapshotDelta("MSFT", point("MSFT", "2026-11-25T14:20:00Z", "weakened", 0.61), point("MSFT", "2026-11-21T08:00:00Z", "intact", 0.70)),
        "NVDA" to SnapshotDelta("NVDA", point("NVDA", "2026-11-25T14:20:00Z", "improved", 0.84), point("NVDA", "2026-11-21T08:00:00Z", "intact", 0.79)),
        "GOOGL" to SnapshotDelta("GOOGL", point("GOOGL", "2026-11-25T14:20:00Z", "intact", 0.72), point("GOOGL", "2026-11-21T08:00:00Z", "intact", 0.72)),
    )

    private fun alert(
        id: String,
        ticker: String,
        category: String,
        title: String,
        createdAt: String,
        eventDate: String? = null,
        warRoomId: String? = null,
    ) = AlertLedgerItemView(
        id = id, notificationType = if (category == "earnings") "earnings_window" else "thesis_drift",
        category = category, route = "name", title = title, body = title, reasonCode = category,
        reasonText = title, deliveryState = "delivered", ticker = ticker, createdAt = createdAt,
        updatedAt = createdAt, warRoomId = warRoomId, eventDate = eventDate,
    )

    val alerts = listOf(
        alert("a1", "MSFT", "thesis", "MSFT thesis weakened", "2026-11-23T10:00:00Z"),
        alert("a2", "MSFT", "filing", "MSFT filed a 10-Q", "2026-11-22T21:00:00Z"),
        alert("a3", "GOOGL", "earnings", "GOOGL reports on 3 Dec", "2026-11-24T08:00:00Z", eventDate = "2026-12-03", warRoomId = "wr-googl"),
        alert("a4", "COST", "earnings", "COST reports on 11 Dec", "2026-11-20T08:00:00Z", eventDate = "2026-12-11"),
        alert("a5", "TSLA", "thesis", "TSLA kill switch fired", "2026-11-22T12:00:00Z"),
    )

    val warRooms = mapOf("GOOGL" to "wr-googl")

    val notes = listOf(
        NoteTrailEntry(
            "rep-aapl", "AAPL", "Services mix is the whole case. If the attach rate stalls below 1.4, revisit.",
            "2026-11-14T09:12:00Z", "FY2026", "The thesis holds: services keep margins up.",
        ),
        NoteTrailEntry(
            "rep-aapl-2025", "AAPL", "Watching China unit sales; one more weak quarter changes the picture.",
            "2025-11-06T18:40:00Z", "FY2025", "The thesis holds with a China caveat.",
        ),
        NoteTrailEntry(
            "rep-msft", "MSFT", "Capex is the question. I want cloud growth back above 30% before adding conviction.",
            "2026-11-13T07:30:00Z", "FY2026 Q1", "The thesis is weaker: spending runs ahead of revenue.",
        ),
        NoteTrailEntry(
            "rep-cost", "COST", "Renewal rate is the tell. Fee increase landed without churn.",
            "2026-11-13T12:00:00Z", "FY2026", "The thesis holds.",
        ),
    )

    val suggestions = listOf(
        TickerSearchItem("AAPL", "Apple Inc.", "NASDAQ"),
        TickerSearchItem("ADBE", "Adobe Inc.", "NASDAQ"),
        TickerSearchItem("AMD", "Advanced Micro Devices, Inc.", "NASDAQ"),
    )

    val importResult = HoldingsImportResultView(
        rows = 6,
        imported = listOf("AAPL", "MSFT", "V", "UNH"),
        newlyFollowed = listOf("V", "UNH"),
        errors = listOf(
            HoldingsImportRowErrorView(4, "BRK.B", "Ticker format not recognised."),
            HoldingsImportRowErrorView(6, null, "Shares must be a positive number."),
        ),
        watchlist = watchlist + listOf("V", "UNH"),
    )

    // ---- Name (5.11): AAPL with two reports, a change summary, five annual rows and a note trail.

    private fun year(fy: Int, revenue: Double, gross: Double, op: Double, net: Double, fcf: Double, debt: Double, cash: Double, shares: Double) =
        FinancialHistoryRowView(
            period = "FY$fy", periodType = "annual", fiscalYear = fy, revenue = revenue, grossMargin = gross,
            operatingMargin = op, netIncome = net, freeCashFlow = fcf, debtTotal = debt, cashAndEquivalents = cash,
            sharesOutstanding = shares,
        )

    val annual = listOf(
        year(2022, 394.3e9, 0.433, 0.303, 99.8e9, 111.4e9, 120.1e9, 48.3e9, 16.07e9),
        year(2023, 383.3e9, 0.441, 0.298, 97.0e9, 99.6e9, 111.1e9, 61.6e9, 15.55e9),
        year(2024, 391.0e9, 0.462, 0.315, 93.7e9, 108.8e9, 106.6e9, 65.2e9, 15.12e9),
        year(2025, 416.2e9, 0.469, 0.320, 112.0e9, 98.8e9, 98.7e9, 55.4e9, 14.84e9),
        year(2026, 431.5e9, 0.472, 0.327, 118.4e9, 120.3e9, 94.2e9, 61.0e9, 14.61e9),
    )

    val summary = ReportSummaryView(
        reportId = "rep-aapl",
        ticker = "AAPL",
        companyName = "Apple Inc.",
        generatedAt = "2026-11-13T13:00:00Z",
        filingPeriod = "FY2026",
        verdict = "The thesis holds: services keep margins up while hardware is flat.",
        changeSummary = DeepDiveChangeSummaryView(
            previousView = "Services growth offsets a soft hardware cycle, with China the open question.",
            currentView = "Services now carry the margin story on their own; China stabilised.",
            topChanges = listOf(
                DeepDiveTopChangeView("Services gross margin", "up", "high", "Mix shift to subscriptions.", "Each point of mix adds about 30 bps to the company margin."),
                DeepDiveTopChangeView("Greater China revenue", "down", "medium", "Unit sales fell 6%.", "The one region where the hardware cycle still bites."),
                DeepDiveTopChangeView("Capital returns", "mixed", "low", "Buybacks slowed, dividends rose.", "Share count still fell 1.5%."),
            ),
        ),
        annualHistory = annual,
    )

    val reports = listOf(
        ReportHistoryItem("rep-aapl", "job-1", "deep_dive", "AAPL", "2026-11-13T13:00:00Z"),
        ReportHistoryItem("rep-aapl-2025", "job-0", "deep_dive", "AAPL", "2025-11-05T13:00:00Z"),
    )

    val journal = listOf(
        ConvictionJournalEntryView("j1", "AAPL", "report_generated", "report", "rep-aapl", "2026-11-13T13:00:00Z", "Deep Dive on the FY2026 10-K", "The thesis holds; services margin up 120 bps.", reportId = "rep-aapl", thesisSnapshot = ConvictionThesisSnapshotView(monitorState = "intact")),
        ConvictionJournalEntryView("j2", "AAPL", "alert", "alert", "a9", "2026-08-01T21:00:00Z", "Thesis state confirmed Intact", "Q3 services revenue at a record.", thesisSnapshot = ConvictionThesisSnapshotView(monitorState = "intact")),
        ConvictionJournalEntryView("j3", "AAPL", "war_room", "war_room", "wr-1", "2026-07-31T20:30:00Z", "Q3 earnings War Room", "Guidance kept; China down 6%."),
    )

    private val aaplSnapshot = snapshots.first { it.ticker == "AAPL" }

    /** The full Name: report, change summary, five years, two notes, alerts. */
    val detail = NameDetailView(
        ticker = "AAPL",
        snapshot = aaplSnapshot,
        delta = deltas["AAPL"],
        summary = summary,
        notesTrail = notes.filter { it.ticker == "AAPL" },
        alerts = listOf(alert("n1", "AAPL", "filing", "AAPL filed its 10-K", "2026-11-01T21:00:00Z"), alert("n2", "AAPL", "thesis", "AAPL score rose 4 pts", "2026-11-24T08:00:00Z")),
        reports = reports,
    )

    /** First report for the name: no change summary yet, no earlier notes. */
    val detailFirstReport = detail.copy(
        summary = summary.copy(changeSummary = null),
        notesTrail = emptyList(),
        reports = reports.take(1),
        delta = null,
    )

    /** A new report with no note yet while last year's report has one: Carry forward shows. */
    val detailCarryForward = detail.copy(notesTrail = notes.filter { it.reportId == "rep-aapl-2025" })

    /** A followed name with no report at all. */
    val detailNoReport = NameDetailView(
        ticker = "JPM", snapshot = null, delta = null, summary = null, notesTrail = emptyList(), alerts = emptyList(), reports = emptyList(),
    )

    /** GOOGL: intact, with a stored report but no cached summary, a War Room in its window and an earnings date (3 Dec). */
    val detailWarRoom = NameDetailView(
        ticker = "GOOGL",
        snapshot = snapshots.first { it.ticker == "GOOGL" },
        delta = deltas["GOOGL"],
        summary = null,
        notesTrail = emptyList(),
        alerts = alerts.filter { it.ticker == "GOOGL" },
        reports = listOf(ReportHistoryItem("rep-googl", "job-g", "deep_dive", "GOOGL", "2026-11-16T13:00:00Z")),
    )

    /** GOOGL reports today: the War Room is in its Live phase (renders and tests of the LiveDot). */
    val alertsLive: List<AlertLedgerItemView> = alerts.map {
        if (it.id == "a3") it.copy(title = "GOOGL reports today", body = "GOOGL reports today", eventDate = "2026-11-25") else it
    }

    val detailWarRoomLive = detailWarRoom.copy(alerts = alertsLive.filter { it.ticker == "GOOGL" })

    val liveWarRooms: Set<String> = setOf("GOOGL")
}
