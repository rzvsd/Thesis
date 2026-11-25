package com.thesis.mobile.preview.fixtures

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import com.thesis.mobile.model.CompareNamesState
import com.thesis.mobile.model.CompareReportsState
import com.thesis.mobile.model.DeepDiveChangeSummaryView
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.DeepDiveStoryHeaderView
import com.thesis.mobile.model.DeepDiveTopChangeView
import com.thesis.mobile.model.FinancialAnalysisView
import com.thesis.mobile.model.FinancialHistoryRowView
import com.thesis.mobile.model.IssuerView
import com.thesis.mobile.model.LastViewedReport
import com.thesis.mobile.model.NoteTrailEntry
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.model.ReportSearchHit
import com.thesis.mobile.model.ReportSummaryView
import com.thesis.mobile.model.ScenarioStressImpactView
import com.thesis.mobile.model.ScenarioStressRouteView
import com.thesis.mobile.model.ScenarioStressRuleSuggestionView
import com.thesis.mobile.model.ScenarioStressRunHeaderView
import com.thesis.mobile.model.ScenarioStressRunView
import com.thesis.mobile.model.ScenarioStressTemplateView
import com.thesis.mobile.model.SearchResultsView
import com.thesis.mobile.model.TickerSearchItem
import com.thesis.mobile.model.ValueDisciplineView
import com.thesis.mobile.model.ValueTrapWarningView
import com.thesis.mobile.model.WarRoomPhaseView
import com.thesis.mobile.model.WarRoomView
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.format.LocalFmt
import java.time.Clock
import java.time.ZoneId
import java.time.ZonedDateTime

/**
 * WP-E fixtures (Research, History, Compare reports and names, Search, War Room, Scenario Stress): plausible data
 * with no ids on screen, dates pinned to Tue 24 Nov 2026 09:00 UTC so relative times and day headers are stable.
 */
object ResearchFixtures {
    val zone: ZoneId = ZoneId.of("UTC")
    val now: ZonedDateTime = ZonedDateTime.of(2026, 11, 24, 9, 0, 0, 0, zone)
    val clock: Clock = Clock.fixed(now.toInstant(), zone)
    val fmt = Fmt(clock, zone, is24h = true)

    /** Pins `LocalFmt` to [clock] for the screens that read it. */
    @Composable
    fun Fixed(content: @Composable () -> Unit) {
        CompositionLocalProvider(LocalFmt provides fmt, content = content)
    }

    private fun ago(hours: Long): String = now.minusHours(hours).toInstant().toString()

    val watchlist = listOf("AAPL", "MSFT", "NVDA", "COST", "ASML", "V", "KO", "JPM")

    val companyNames = mapOf(
        "AAPL" to "Apple Inc.",
        "MSFT" to "Microsoft Corp.",
        "NVDA" to "NVIDIA Corp.",
        "COST" to "Costco Wholesale",
        "ASML" to "ASML Holding",
        "V" to "Visa Inc.",
        "KO" to "Coca-Cola Co.",
        "JPM" to "JPMorgan Chase",
    )

    private fun dd(id: String, ticker: String, hoursAgo: Long) = ReportHistoryItem(id, "j-$id", "deep_dive", ticker, ago(hoursAgo))
    private fun pulse(id: String, hoursAgo: Long) = ReportHistoryItem(id, "j-$id", "pulse", null, ago(hoursAgo))

    val history = listOf(
        dd("aapl-25", "AAPL", 2),
        pulse("pulse-24", 6),
        dd("msft-25", "MSFT", 20),
        dd("nvda-q3", "NVDA", 27),
        pulse("pulse-23", 30),
        dd("cost-25", "COST", 50),
        dd("aapl-24", "AAPL", 24 * 9),
        dd("asml-25", "ASML", 24 * 12),
        dd("v-25", "V", 24 * 20),
        dd("ko-25", "KO", 24 * 41),
        dd("aapl-q3", "AAPL", 24 * 60),
    )

    val filingPeriods = mapOf(
        "aapl-25" to "FY2025",
        "msft-25" to "FY2025",
        "nvda-q3" to "Q3 FY26",
        "cost-25" to "FY2025",
        "aapl-24" to "FY2024",
        "asml-25" to "FY2025",
        "v-25" to "FY2025",
        "ko-25" to "FY2025",
        "aapl-q3" to "Q3 FY25",
    )

    val noted = setOf("aapl-25", "cost-25", "aapl-24")

    val continueReading = LastViewedReport(
        reportId = "msft-25",
        label = "MSFT",
        type = "DEEP_DIVE",
        referenceDate = "2026-11-23",
        timestampMs = now.minusHours(19).toInstant().toEpochMilli(),
    )

    val suggestions = listOf(
        TickerSearchItem("AAPL", "Apple Inc.", "NASDAQ"),
        TickerSearchItem("AAP", "Advance Auto Parts", "NYSE"),
        TickerSearchItem("AAON", "AAON Inc.", "NASDAQ"),
    )

    // ---- Compare reports

    private fun fy(year: Int, revenue: Double, gross: Double, op: Double, fcf: Double, cash: Double, debt: Double, shares: Double, ni: Double) =
        FinancialHistoryRowView(
            period = "$year-FY", periodType = "annual", fiscalYear = year, revenue = revenue, grossMargin = gross,
            operatingMargin = op, netIncome = ni, freeCashFlow = fcf, debtTotal = debt, cashAndEquivalents = cash,
            sharesOutstanding = shares,
        )

    private val aaplRows = listOf(
        fy(2022, 394.3e9, 43.3, 30.3, 111.4e9, 48.3e9, 120.1e9, 15.94e9, 99.8e9),
        fy(2023, 383.3e9, 44.1, 29.8, 99.6e9, 61.6e9, 111.1e9, 15.55e9, 97.0e9),
        fy(2024, 391.0e9, 46.2, 31.5, 108.8e9, 65.2e9, 106.6e9, 15.12e9, 93.7e9),
        fy(2025, 416.2e9, 46.9, 32.0, 98.8e9, 55.4e9, 98.7e9, 14.84e9, 112.0e9),
    )

    private fun aaplReport(id: String, rows: List<FinancialHistoryRowView>, at: String, headline: String, change: DeepDiveChangeSummaryView?) =
        DeepDiveReportView(
            reportId = id, ticker = "AAPL", generatedAt = at, issuer = IssuerView("Apple Inc.", "NASDAQ"),
            storyHeader = DeepDiveStoryHeaderView(headline, "", "", "", "Intact"),
            changeSummary = change,
            financialAnalysis = FinancialAnalysisView(annualHistory = rows),
            signalValue = null, confidenceLabel = null, confidenceScore = null, sections = emptyList(),
        )

    val aaplOlder = aaplReport(
        "aapl-24", aaplRows.take(3), now.minusDays(370).toInstant().toString(),
        "Services carry the margin while hardware sales stall.", null,
    )

    val aaplNewer = aaplReport(
        "aapl-25", aaplRows, ago(2),
        "Margins kept widening as Services grew to a quarter of revenue.",
        DeepDiveChangeSummaryView(
            previousView = "Services carry the margin while hardware sales stall.",
            currentView = "Margins kept widening as Services grew to a quarter of revenue.",
            topChanges = listOf(
                DeepDiveTopChangeView("Operating margin", "up", "high", "Services mix", "More of each dollar reaches operating profit."),
                DeepDiveTopChangeView("Free cash flow", "down", "medium", "Higher capex", "Less cash left for buybacks this year."),
                DeepDiveTopChangeView("Share count", "down", "low", "Buybacks", "Each share owns a little more of the company."),
            ),
        ),
    )

    val compareReports = CompareReportsState("aapl-24", "aapl-25", a = aaplOlder, b = aaplNewer, isLoading = false)
    val compareReportsLoading = CompareReportsState("aapl-24", "aapl-25", isLoading = true)
    val compareReportsError = CompareReportsState("aapl-24", "aapl-25", isLoading = false, error = "The server took too long to answer.")

    val compareNotes = listOf(
        NoteTrailEntry("aapl-25", "AAPL", "Services margin keeps expanding while hardware is flat. Watch the China line next quarter.", ago(1), "FY2025", null),
        NoteTrailEntry("aapl-24", "AAPL", "Buybacks still eat most of the free cash flow.", now.minusDays(360).toInstant().toString(), "FY2024", null),
    )

    // ---- Compare names

    private fun summary(ticker: String, company: String, rows: List<FinancialHistoryRowView>, hoursAgo: Long) = ReportSummaryView(
        reportId = "s-$ticker", ticker = ticker, companyName = company, generatedAt = ago(hoursAgo),
        filingPeriod = rows.last().period, verdict = null, changeSummary = null, annualHistory = rows,
    )

    private val msftRows = listOf(
        fy(2023, 211.9e9, 68.9, 41.8, 59.5e9, 34.7e9, 47.2e9, 7.43e9, 72.4e9),
        fy(2024, 245.1e9, 69.8, 44.6, 74.1e9, 18.3e9, 44.9e9, 7.43e9, 88.1e9),
        fy(2025, 281.7e9, 68.8, 45.6, 71.6e9, 30.2e9, 43.2e9, 7.43e9, 101.8e9),
    )
    private val costRows = listOf(
        fy(2024, 254.5e9, 12.6, 3.4, 6.6e9, 9.9e9, 5.8e9, 0.443e9, 7.4e9),
        fy(2025, 275.2e9, 12.8, 3.6, 7.8e9, 14.2e9, 5.7e9, 0.443e9, 8.1e9),
    )

    val compareNames = CompareNamesState(
        tickers = listOf("AAPL", "MSFT", "COST", "NVDA"),
        summaries = mapOf(
            "AAPL" to summary("AAPL", "Apple Inc.", aaplRows, 2),
            "MSFT" to summary("MSFT", "Microsoft Corp.", msftRows, 20),
            "COST" to summary("COST", "Costco Wholesale", costRows, 50),
            "NVDA" to null,
        ),
        isLoading = false,
    )
    val compareNamesLoading = CompareNamesState(tickers = listOf("AAPL", "MSFT"), isLoading = true)
    val compareNamesError = CompareNamesState(tickers = listOf("AAPL", "MSFT"), isLoading = false, error = "No connection.")

    private fun discipline(score: Int, available: Int) = ValueDisciplineView(
        score = score, maxScore = 6, availableSignals = available, completeness = "partial", contextLabel = "",
        interpretation = "", doesNotProve = "", valueTrapWarning = ValueTrapWarningView(false, ""),
    )

    val disciplines = mapOf("AAPL" to discipline(4, 6), "MSFT" to discipline(5, 6), "COST" to discipline(3, 5))

    // ---- Search

    val searchResults = SearchResultsView(
        query = "ap",
        tickers = listOf(
            TickerSearchItem("AAPL", "Apple Inc.", "NASDAQ"),
            TickerSearchItem("APP", "AppLovin Corp.", "NASDAQ"),
            TickerSearchItem("APH", "Amphenol Corp.", "NYSE"),
            TickerSearchItem("APD", "Air Products", "NYSE"),
            TickerSearchItem("APA", "APA Corp.", "NASDAQ"),
            TickerSearchItem("APO", "Apollo Global", "NYSE"),
            TickerSearchItem("APTV", "Aptiv PLC", "NYSE"),
        ),
        names = listOf("AAPL"),
        reports = listOf(
            ReportSearchHit("aapl-25", "AAPL", "Apple Inc.", "deep_dive", ago(2)),
            ReportSearchHit("aapl-24", "AAPL", "Apple Inc.", "deep_dive", now.minusDays(9).toInstant().toString()),
        ),
        notes = listOf(
            NoteTrailEntry("aapl-25", "AAPL", "Services margin keeps expanding while hardware is flat; capex is the thing to watch into next year.", ago(1), "FY2025", null),
            NoteTrailEntry("cost-25", "COST", "Membership fee hike lands in the fiscal year; the renewal rate held above 90%.", ago(48), "FY2025", null),
        ),
        isSearchingServer = false,
    )

    val searchLocalOnly = searchResults.copy(tickers = emptyList(), isSearchingServer = true)

    val recentSearches = listOf("costco", "AAPL", "buyback")

    // ---- War Room

    val warRoomLive = WarRoomView(
        warRoomId = "6f1c2c0e-1d1a-4a57-9f0e-3c2b7f4f1e21",
        title = "Apple fiscal Q4 earnings",
        ticker = "AAPL",
        status = "live",
        generatedAt = now.minusMinutes(12).toInstant().toString(),
        summary = "Revenue landed just above the range given in July; Services set another record while iPhone was flat against last year.",
        phases = listOf(
            WarRoomPhaseView(
                phase = "pre", title = "What the report has to show", status = "complete",
                summary = "Coming in, the question was whether Services could keep the margin rising with iPhone flat.",
                highlights = listOf(
                    "Services gross margin above 75% would confirm the mix story.",
                    "China revenue is the line to read first after last quarter’s drop.",
                ),
                ticker = "AAPL", route = "war_room", reportId = "aapl-25", updatedAt = now.minusHours(3).toInstant().toString(),
            ),
            WarRoomPhaseView(
                phase = "live", title = "Services carried the quarter", status = "in_progress",
                summary = "Services revenue grew 14% and gross margin reached 75.6%; product margin slipped on memory costs.",
                highlights = listOf(
                    "Greater China revenue fell 2%, a smaller drop than in Q3.",
                    "Management guided December-quarter revenue growth in the low to mid single digits.",
                ),
                ticker = "AAPL", route = "war_room", reportId = "aapl-25", updatedAt = now.minusMinutes(12).toInstant().toString(),
            ),
            WarRoomPhaseView(phase = "post", title = "After the call", status = "scheduled", summary = "Written once the call ends."),
        ),
        relatedTickers = listOf("MSFT", "QCOM", "TSM", "AVGO"),
    )

    val warRoomClosed = warRoomLive.copy(status = "closed", generatedAt = now.minusHours(20).toInstant().toString())

    val warRoomPre = warRoomLive.copy(status = "ready", phases = warRoomLive.phases.take(1), relatedTickers = emptyList())

    // ---- Scenario Stress

    val templates = listOf(
        ScenarioStressTemplateView("rates_higher_for_longer", "Rates higher for longer", "The 10-year stays above 4.5% through next year.", "", true, "", ""),
        ScenarioStressTemplateView("recession_in_6m", "Recession in six months", "Two negative quarters of US GDP from spring.", "", true, "", ""),
        ScenarioStressTemplateView("usd_up_10", "Dollar up 10%", "A stronger dollar cuts the value of foreign sales.", "", true, "", ""),
        ScenarioStressTemplateView("oil_120_spike", "Oil at $120", "A supply shock pushes Brent to $120 for a quarter.", "", true, "", ""),
    )

    private val route = ScenarioStressRouteView("scenario", "rates_higher_for_longer", "run-7")

    private fun impact(t: String, score: Double, level: String, likelihood: String, rationale: String, refs: List<String> = emptyList()) =
        ScenarioStressImpactView(
            scenarioImpactId = "i-$t", scenarioRunId = "run-7", userId = "u", ticker = t, impactLevel = level,
            thesisBreakLikelihood = likelihood, stressScore = score, rationale = rationale, evidenceRefs = refs,
            route = route, createdAt = ago(1),
        )

    val stressRun = ScenarioStressRunView(
        run = ScenarioStressRunHeaderView(
            scenarioRunId = "run-7", scenarioId = "rates_higher_for_longer", userId = "u", status = "completed", runMode = "manual",
            asOf = "2026-11-24", totalNames = 8, impactedNames = 5, criticalNames = 0,
            summary = "Long-duration growth names carry most of the stress; staples and banks barely move.",
            route = route, createdAt = ago(1), completedAt = ago(1),
        ),
        impacts = listOf(
            impact("COST", 0.18, "watch", "low", "Membership income cushions a slower shopper"),
            impact("NVDA", 0.74, "high", "high", "Rich multiple meets a higher discount rate", listOf("https://www.sec.gov/nvda-10q", "a1b2c3d4-uuid")),
            impact("ASML", 0.61, "elevated", "moderate", "Customers delay fab spending when credit tightens", listOf("https://www.asml.com/investors")),
            impact("AAPL", 0.38, "elevated", "low", "Buybacks cost more with debt at higher rates"),
            impact("MSFT", 0.29, "watch", "low", "Cloud contracts hold; the multiple gives a little"),
            impact("V", 0.12, "none", "low", "Volumes track nominal spending"),
            impact("KO", 0.06, "none", "low", "Pricing power offsets a stronger dollar"),
            impact("JPM", 0.04, "none", "low", "Net interest income gains from higher rates"),
        ),
        ruleSuggestions = listOf(
            ScenarioStressRuleSuggestionView("g1", "run-7", "u", "NVDA", "valuation", "down", "Forward P/E above 40 while the 10-year is above 4.5%", "Where most of the stress sits.", 0.7, route, ago(1)),
            ScenarioStressRuleSuggestionView("g2", "run-7", "u", "ASML", "orders", "down", "Bookings fall two quarters in a row", "The first sign customers are delaying.", 0.6, route, ago(1)),
        ),
    )
}
