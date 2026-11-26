package com.thesis.mobile.preview.fixtures

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.model.BriefingContextView
import com.thesis.mobile.model.DeepDiveChangeSummaryView
import com.thesis.mobile.model.DeepDiveTopChangeView
import com.thesis.mobile.model.EvidenceView
import com.thesis.mobile.model.MarketTapeFamily
import com.thesis.mobile.model.MarketTapeMoveView
import com.thesis.mobile.model.MarketTapeView
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.ReportSummaryView
import com.thesis.mobile.model.SectionView
import com.thesis.mobile.model.SentimentSnapshotView
import com.thesis.mobile.model.SnapshotDelta
import com.thesis.mobile.model.SnapshotPoint
import com.thesis.mobile.model.ThesisMonitorSnapshotView
import com.thesis.mobile.ui.RefreshFailureKind
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.format.LocalFmt
import com.thesis.mobile.ui.motion.EntranceRegistry
import com.thesis.mobile.ui.motion.ProvideEntranceScope
import com.thesis.mobile.ui.screens.HomeScreen
import com.thesis.mobile.ui.screens.PulseScreen
import com.thesis.mobile.ui.screens.WeeklyDigestScreen
import com.thesis.mobile.ui.today.ChapterKind
import com.thesis.mobile.ui.today.LocalTodayClock
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import kotlin.math.PI
import kotlin.math.sin

/**
 * Fixtures of the Today screens (WP-A): a fixed clock (Tue 24 Nov 2026, 07:15 in New York, pre-market) with the
 * matching `LocalFmt`, the Pulse issue of 2026-04-25 from `app/src/test/resources/fixtures/pulse` re-dated to that
 * morning ([realPulse], every section and instrument as the pipeline wrote it), a richer issue with a morning line,
 * a watch list, signal and noise and an upshot ([richPulse]), seven followed names with monitor readings, a month
 * of macro stress readings and a week of alerts. Values are illustrative.
 */
object TodayFixtures {

    val zone: ZoneId = ZoneId.of("America/New_York")
    val now: Instant = Instant.parse("2026-11-24T12:15:00Z")
    val clock: Clock = Clock.fixed(now, zone)
    val fmt = Fmt(clock, zone, is24h = true)

    // ---- Pulse --------------------------------------------------------------------------------------------------

    private const val RETRIEVED = "2026-11-24T11:15:00Z"

    private fun move(
        id: String,
        label: String,
        family: MarketTapeFamily,
        value: Double,
        change: Double,
        pct: Double,
        unit: String,
        source: String,
    ) = MarketTapeMoveView(
        instrumentId = id, label = label, family = family, familyRaw = family.wire, value = value,
        previousValue = value - change, dailyChange = change, dailyChangePct = pct, unit = unit,
        direction = if (change > 0) "up" else if (change < 0) "down" else "flat",
        asOf = "2026-11-23", retrievedAt = RETRIEVED, sourceName = source,
        sourceUrl = "https://fred.stlouisfed.org/series/$id",
    )

    val tape = MarketTapeView(
        asOf = "2026-11-23",
        coverageState = "partial",
        summary = "US risk assets were broadly higher on the day. Sector leadership was unavailable in the approved free " +
            "live path for this run. Cross-asset context: VIX down by 0.78; Treasury 10Y down by 0.03; Treasury 2Y down " +
            "by 0.05; WTI up by 1.14. Coverage note: Sector ETF leadership is not available in the approved free live " +
            "path for this run.",
        indices = listOf(
            move("SP500", "S&P 500", MarketTapeFamily.CoreIndex, 5525.21, 40.44, 0.7373, "index", "FRED S&P 500"),
            move("DJIA", "Dow Jones Industrial Average", MarketTapeFamily.CoreIndex, 40413.78, 320.38, 0.7991, "index", "FRED DJIA"),
            move("NASDAQCOM", "Nasdaq Composite", MarketTapeFamily.CoreIndex, 17382.94, 260.5, 1.5213, "index", "FRED Nasdaq Composite"),
        ),
        crossAsset = listOf(
            move("VIXCLS", "VIX", MarketTapeFamily.Volatility, 17.43, -0.78, -4.2834, "index", "FRED VIX"),
            move("DGS10", "Treasury 10Y", MarketTapeFamily.Rates, 4.29, -0.03, -0.6944, "percent", "FRED Treasury 10Y"),
            move("DGS2", "Treasury 2Y", MarketTapeFamily.Rates, 3.93, -0.05, -1.2563, "percent", "FRED Treasury 2Y"),
            move("DCOILWTICO", "WTI", MarketTapeFamily.Commodity, 63.02, 1.14, 1.8423, "usd_per_barrel", "FRED WTI"),
            move("DTWEXBGS", "Nominal Broad Dollar Index", MarketTapeFamily.Currency, 120.84, 0.22, 0.1824, "index", "FRED Broad Dollar Index"),
            move("BAMLH0A0HYM2", "US High Yield OAS", MarketTapeFamily.Credit, 3.67, -0.04, -1.0782, "percent", "FRED US High Yield OAS"),
        ),
    )

    private fun ev(source: String, excerpt: String, url: String? = null) = EvidenceView(sourceName = source, excerpt = excerpt, url = url)

    private val realSections = listOf(
        SectionView(
            "macro_stress", "Macro Stress",
            "Macro pressure is elevated: CPI-U All Items (high), Treasury 10Y (medium).",
            status = "complete",
            evidence = listOf(ev("U.S. Treasury", "Treasury 10Y is 4.29 percent (2026-11-23)."), ev("BLS", "CPI-U All Items is 312.23 index (2026-10).")),
        ),
        SectionView(
            "official_macro_pressure", "Official Macro Pressure",
            "Treasury 10Y: 4.29 percent [medium] (2026-11-23). Treasury 2Y: 3.93 percent [medium] (2026-11-23). CPI-U All " +
                "Items: 312.23 index [high] (2026-10). Unemployment Rate: 4 percent [medium] (2026-10). Real GDP: 2.1 " +
                "annualized_percent [low] (2026-Q3). WTI Spot: 63.02 usd_per_barrel [low] (2026-11-23). Coverage note: IMF " +
                "forecast inputs are optional in M6 and were not available in this run.",
            status = "complete",
        ),
        SectionView(
            "market_moves", "Market Moves", "Issuer filing coverage this cycle: AAPL, MSFT.", status = "complete",
            evidence = listOf(ev("SEC EDGAR", "AAPL filed a new 8-K", "https://www.sec.gov/AAPL"), ev("SEC EDGAR", "MSFT filed a new 8-K", "https://www.sec.gov/MSFT")),
        ),
        SectionView(
            "macro_releases", "Macro Releases",
            "Treasury 10Y: 4.29 percent [medium] (2026-11-23). CPI-U All Items: 312.23 index [high] (2026-10).",
            status = "complete",
        ),
        SectionView(
            "news_summary", "News Summary", "1. Apple investor update (investor.apple.com)", status = "complete",
            evidence = listOf(ev("investor.apple.com", "Apple investor update confirms release cadence.", "https://investor.apple.com/investor-relations/")),
        ),
        SectionView("uncertainty_flags", "Uncertainty Flags", "Uncertainty flags for this cycle: data_incomplete:market_tape.", status = "data_incomplete"),
        SectionView(
            "market_tape", "Market Tape", tape.summary.orEmpty(), status = "data_incomplete",
            evidence = listOf(ev("FRED S&P 500", "S&P 500: 0.7373 index", "https://fred.stlouisfed.org/series/SP500")),
        ),
        SectionView(
            "canonical_events", "Canonical Events",
            "1. AAPL - AAPL filed a new 8-K (filing_posted). 2. MSFT - MSFT filed a new 8-K (filing_posted). 3. " +
                "BLS_CPI_U_ALL_ITEMS - CPI update published (macro_release_published).",
            status = "complete",
            evidence = listOf(ev("BLS CPI", "CPI update published", "https://www.bls.gov/cpi/")),
        ),
        SectionView(
            "bounded_context", "Bounded Context",
            "1. AAPL - Apple investor update. Population: United States still offers a large domestic demand base for " +
                "scaled consumer and enterprise franchises.",
            status = "complete",
        ),
    )

    /** The 2026-04-25 issue as the pipeline wrote it, re-dated to this morning. */
    val realPulse = PulseReportView(
        reportId = "pulse-2026-11-24-real",
        generatedAt = "2026-11-24T11:30:00Z",
        sections = realSections,
        cycleEnd = "2026-11-24",
        tape = tape,
    )

    /** An issue with every chapter: a morning line, what changed, watch items, signal and noise and an upshot. */
    val richPulse = PulseReportView(
        reportId = "pulse-2026-11-24",
        generatedAt = "2026-11-24T11:30:00Z",
        cycleEnd = "2026-11-24",
        tape = tape,
        sections = listOf(
            SectionView("morning_line", "Morning line", "Stocks rose for a third day as Treasury yields eased and credit spreads tightened."),
            SectionView(
                "what_changed", "What changed",
                "Ten-year yields fell for a fourth session, to 4.29 percent. The move followed a softer core inflation print " +
                    "and pulled the 2-year down by more, so the curve steepened slightly. Oil was the exception: WTI rose 1.8 " +
                    "percent on supply headlines.",
            ),
        ) + realSections + listOf(
            SectionView(
                "what_to_watch", "What to watch",
                "1. Durable goods orders, Wed 08:30. 2. FOMC minutes, Wed 14:00. 3. US markets close Thu for Thanksgiving " +
                    "and at 13:00 on Fri.",
            ),
            SectionView(
                "signal_vs_noise", "Signal vs noise",
                "Signal: Yields have fallen four days running while credit spreads tightened, a consistent easing in " +
                    "financial conditions. Noise: The VIX drop is within its normal holiday-week range.",
            ),
            SectionView(
                "upshot", "Upshot",
                "Rates did the work this week: lower yields and tighter credit eased conditions, while macro stress stays " +
                    "Balanced.",
            ),
        ),
    )

    /**
     * Yesterday's issue (Mon 23 Nov), as Home shows it before today's arrives: never labelled "Today’s Pulse". Its
     * tape is the one it carried, Friday's closes read Monday morning, so the tape caption takes its dated form
     * ("Tape · Fri 20 Nov"), never today's "Pre-market tape · as of 06:15".
     */
    val previousPulse = run {
        fun MarketTapeMoveView.onMonday() = copy(asOf = "2026-11-20", retrievedAt = "2026-11-23T11:15:00Z")
        richPulse.copy(
            reportId = "pulse-2026-11-23",
            generatedAt = "2026-11-23T11:30:00Z",
            cycleEnd = "2026-11-23",
            tape = tape.copy(
                asOf = "2026-11-20",
                indices = tape.indices.map { it.onMonday() },
                crossAsset = tape.crossAsset.map { it.onMonday() },
            ),
        )
    }

    /** When today's issue was due (06:30 New York): passed by the fixture clock (07:15), so it is running late. */
    val pulseDue: Instant = Instant.parse("2026-11-24T11:30:00Z")

    // ---- Macro stress -------------------------------------------------------------------------------------------

    /** Market days from 26 Oct to 20 Nov, a gentle wave from about 40 to 49, then 46 on Mon 16 Nov. */
    val sentimentHistory: List<SentimentSnapshotView> = run {
        val days = generateSequence(LocalDate.of(2026, 10, 26)) { it.plusDays(1) }
            .takeWhile { it.isBefore(LocalDate.of(2026, 11, 23)) }
            .filter { it.dayOfWeek.value <= 5 }
            .toList()
        days.mapIndexed { i, d ->
            val score = if (d == LocalDate.of(2026, 11, 16)) 46.0 else 44.0 + 5.0 * sin(i * PI / 7.0)
            SentimentSnapshotView("m$i", d.toString(), score, "Balanced", calculatedAt = "${d}T21:00:00Z")
        }
    }
    val sentimentCurrent = SentimentSnapshotView("m-now", "2026-11-23", 52.0, "Balanced", calculatedAt = "2026-11-23T21:00:00Z")

    // ---- Names --------------------------------------------------------------------------------------------------

    val watchlist = listOf("AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "JPM", "XOM")

    private fun snap(ticker: String, state: String, score: Double, reason: String, report: String) = ThesisMonitorSnapshotView(
        ticker = ticker, state = state, reason = reason, score = score, reportId = "rep-$ticker",
        reportGeneratedAt = report, freshnessState = "fresh", freshnessScore = 0.8, updatedAt = "2026-11-24T11:00:00Z",
    )

    val snapshots = listOf(
        snap("AAPL", "intact", 78.0, "Services margin held near 46% through the quarter.", "2026-11-20T21:10:00Z"),
        snap("MSFT", "watch", 61.0, "Cloud growth slowed for a second quarter.", "2026-11-19T21:05:00Z"),
        snap("NVDA", "at_risk", 44.0, "Customer concentration rose again.", "2026-10-30T21:00:00Z"),
        snap("AMZN", "intact", 72.0, "Retail operating margin widened.", "2026-11-01T21:00:00Z"),
        snap("GOOGL", "intact", 70.0, "Search revenue held its growth rate.", "2026-10-31T21:00:00Z"),
        snap("JPM", "intact", 69.0, "Net interest income guidance unchanged.", "2026-10-14T21:00:00Z"),
        snap("XOM", "intact", 64.0, "Upstream volumes in line with plan.", "2026-11-02T21:00:00Z"),
    )

    private val lastVisitMs = Instant.parse("2026-11-17T12:00:00Z").toEpochMilli()
    private val nowMs = Instant.parse("2026-11-24T11:00:00Z").toEpochMilli()

    private fun point(t: String, state: String, score: Double, at: Long) = SnapshotPoint(t, at, state, score, 0.8, "rep-$t")

    /** Since the last visit (Tue 17 Nov): MSFT went from Intact to Watch; AAPL gained 4 points. */
    val deltas: Map<String, SnapshotDelta> = mapOf(
        "MSFT" to SnapshotDelta("MSFT", point("MSFT", "watch", 61.0, nowMs), point("MSFT", "intact", 66.0, lastVisitMs)),
        "AAPL" to SnapshotDelta("AAPL", point("AAPL", "intact", 78.0, nowMs), point("AAPL", "intact", 74.0, lastVisitMs)),
        "NVDA" to SnapshotDelta("NVDA", point("NVDA", "at_risk", 44.0, nowMs), point("NVDA", "at_risk", 45.0, lastVisitMs)),
    )
    val noted = setOf("AAPL")

    val morningBriefing = AlertLedgerItemView(
        id = "mb-1", notificationType = "morning_exception_briefing", category = "pulse", route = "pulse",
        title = "Morning briefing", body = "Two of your names need a look this morning.", reasonCode = "briefing",
        reasonText = "Your morning briefing.", deliveryState = "delivered",
        briefingContext = BriefingContextView(mode = "exceptions", count = 2, watchlistCount = 7, leadTicker = "NVDA"),
        createdAt = "2026-11-24T11:35:00Z", updatedAt = "2026-11-24T11:35:00Z",
    )

    // ---- Weekly digest --------------------------------------------------------------------------------------------

    private fun alert(id: String, category: String, title: String, ticker: String?, at: String) = AlertLedgerItemView(
        id = id, notificationType = category, category = category, route = "inbox", title = title, body = title,
        reasonCode = category, reasonText = "", deliveryState = "delivered", ticker = ticker, createdAt = at, updatedAt = at,
    )

    val alerts = listOf(
        alert("a1", "thesis_drift", "MSFT moved to Watch", "MSFT", "2026-11-23T14:00:00Z"),
        alert("a2", "thesis_drift", "NVDA customer concentration rose", "NVDA", "2026-11-21T14:00:00Z"),
        alert("a3", "earnings", "AAPL filed its 10-K", "AAPL", "2026-11-20T21:30:00Z"),
        alert("a4", "macro", "Macro stress rose 6 points", null, "2026-11-23T21:30:00Z"),
        alert("a5", "pulse", "Today’s Pulse is ready", null, "2026-11-24T11:35:00Z"),
        alert("a6", "thesis_drift", "XOM report is 30 days old", "XOM", "2026-11-19T14:00:00Z"),
        alert("old", "earnings", "JPM filed its 10-Q", "JPM", "2026-10-14T21:30:00Z"),
    )

    val reportSummaries = mapOf(
        "rep-AAPL" to ReportSummaryView(
            reportId = "rep-AAPL", ticker = "AAPL", companyName = "Apple", generatedAt = "2026-11-20T21:10:00Z",
            filingPeriod = "FY2026", verdict = null,
            changeSummary = DeepDiveChangeSummaryView(
                previousView = "Intact", currentView = "Intact",
                topChanges = listOf(DeepDiveTopChangeView("Services margin: +120 bps", "up", "medium", "", "")),
            ),
            annualHistory = emptyList(),
        ),
    )

    val weeklyDeltas: List<SnapshotDelta> = listOf(
        SnapshotDelta("MSFT", point("MSFT", "watch", 61.0, Instant.parse("2026-11-23T15:00:00Z").toEpochMilli()), point("MSFT", "intact", 66.0, lastVisitMs)),
        SnapshotDelta("AAPL", point("AAPL", "intact", 78.0, nowMs), point("AAPL", "intact", 74.0, lastVisitMs)),
    )
}

/** The fixed clock and formatter every Today render and test uses. */
@Composable
fun TodayLocals(content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalTodayClock provides TodayFixtures.clock, LocalFmt provides TodayFixtures.fmt, content = content)
}

/**
 * A fresh entrance registry per composition: the default one is process-wide, so in a suite an earlier render
 * would already have played this issue's stagger and the motion frames would show the settled screen.
 */
@Composable
private fun FreshEntrances(scope: String, content: @Composable () -> Unit) {
    ProvideEntranceScope(remember { EntranceRegistry() }, scope, content)
}

// ---- Screen states ----------------------------------------------------------------------------------------------------

enum class HomeState { Loaded, Loading, Empty, Error, Offline, PreviousIssue }

@Composable
fun TodayHome(
    state: HomeState = HomeState.Loaded,
    padding: PaddingValues = PaddingValues(),
    onOpenName: (String) -> Unit = {},
    onManageNames: () -> Unit = {},
    onOpenPulseAt: (ChapterKind) -> Unit = {},
    onRetryPulse: () -> Unit = {},
    onRetryMacro: () -> Unit = {},
) = TodayLocals {
    FreshEntrances("today-home") { TodayHomeContent(state, padding, onOpenName, onManageNames, onOpenPulseAt, onRetryPulse, onRetryMacro) }
}

@Composable
private fun TodayHomeContent(
    state: HomeState,
    padding: PaddingValues,
    onOpenName: (String) -> Unit,
    onManageNames: () -> Unit,
    onOpenPulseAt: (ChapterKind) -> Unit,
    onRetryPulse: () -> Unit,
    onRetryMacro: () -> Unit,
) {
    val f = TodayFixtures
    val loaded = state == HomeState.Loaded || state == HomeState.Offline || state == HomeState.PreviousIssue
    HomeScreen(
        pulse = when {
            state == HomeState.PreviousIssue -> f.previousPulse
            loaded -> f.richPulse
            else -> null
        },
        pulseLoadedFromCache = state == HomeState.Offline,
        sentimentCurrent = if (loaded) f.sentimentCurrent else null,
        sentimentHistory = if (loaded) f.sentimentHistory else emptyList(),
        sentimentError = if (state == HomeState.Error) "HTTP 503" else null,
        watchlist = if (state == HomeState.Empty) emptyList() else f.watchlist,
        monitorSnapshots = if (loaded || state == HomeState.Error) f.snapshots else emptyList(),
        morningBriefing = if (loaded) f.morningBriefing else null,
        padding = padding,
        pulseError = if (state == HomeState.Error) "HTTP 503" else null,
        onManageNames = onManageNames,
        onRetryPulse = onRetryPulse,
        onOpenMacroStressDashboard = {},
        onOpenPulseBrief = {},
        refreshing = state == HomeState.Loading,
        snapshotDeltas = if (loaded) f.deltas else emptyMap(),
        notedTickers = f.noted,
        onOpenName = onOpenName,
        onOpenPulseAt = onOpenPulseAt,
        pulseExpectedAt = if (state == HomeState.Empty) f.pulseDue else null,
        onRetryMacro = onRetryMacro,
        pulseFailure = if (state == HomeState.Offline) RefreshFailureKind.OFFLINE else null,
    )
}

enum class PulseState { Loaded, Real, Loading, Empty, Error, Exporting, Stale, Offline }

@Composable
fun TodayPulse(
    state: PulseState = PulseState.Loaded,
    initialChapter: ChapterKind? = null,
    onOpenSource: (String) -> Unit = {},
    onCopyText: (String) -> Unit = {},
    onOpenName: (String) -> Unit = {},
) = TodayLocals {
    val f = TodayFixtures
    FreshEntrances("today-pulse") {
        PulseScreen(
            pulse = when (state) {
                PulseState.Loaded, PulseState.Exporting, PulseState.Stale -> f.richPulse
                PulseState.Real -> f.realPulse
                else -> null
            },
            watchlist = f.watchlist,
            onBack = {},
            onRunDeepDive = {},
            onExportPdf = {},
            onRefresh = {},
            loading = state == PulseState.Loading,
            error = when (state) {
                PulseState.Error, PulseState.Stale -> "HTTP 503"
                PulseState.Offline -> "Unable to resolve host"
                else -> null
            },
            pulseFailure = when (state) {
                PulseState.Stale -> RefreshFailureKind.SERVER
                PulseState.Offline -> RefreshFailureKind.OFFLINE
                else -> null
            },
            isExporting = state == PulseState.Exporting,
            monitorSnapshots = f.snapshots,
            onOpenSource = onOpenSource,
            onCopyText = onCopyText,
            initialChapter = initialChapter,
            onOpenName = onOpenName,
        )
    }
}

@Composable
fun TodayDigest(empty: Boolean = false, loading: Boolean = false, wired: Boolean = true) = TodayLocals {
    val f = TodayFixtures
    WeeklyDigestScreen(
        digestDate = "2026-11-24",
        sentimentCurrent = if (empty) null else f.sentimentCurrent,
        watchlist = if (empty) emptyList() else f.watchlist,
        monitorSnapshots = if (empty) emptyList() else f.snapshots,
        pulse = if (empty) null else f.richPulse,
        onOpenDashboard = {},
        onBack = {},
        sentimentHistory = if (empty) emptyList() else f.sentimentHistory,
        alerts = if (empty) emptyList() else f.alerts,
        stateChanges = if (empty) null else f.weeklyDeltas,
        reportSummaries = f.reportSummaries,
        onOpenReport = if (wired) { _, _ -> } else null,
        onOpenName = if (wired) { _ -> } else null,
        onOpenInbox = if (wired) { _ -> } else null,
        onOpenPulse = if (wired) { {} } else null,
        loading = loading,
    )
}
