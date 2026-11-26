package com.thesis.mobile.preview.fixtures

import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.model.AuthTokens
import com.thesis.mobile.model.MarketTapeFamily
import com.thesis.mobile.model.MarketTapeMoveView
import com.thesis.mobile.model.MarketTapeView
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.model.SectionView
import com.thesis.mobile.model.SentimentSnapshotView
import com.thesis.mobile.model.ThesisMonitorSnapshotView
import com.thesis.mobile.model.UserProfileView
import com.thesis.mobile.ui.UiState
import com.thesis.mobile.ui.navigation.Destination
import com.thesis.mobile.ui.navigation.ShellTab
import com.thesis.mobile.ui.shell.AppNavigator

/**
 * Fixture state for `ShellRenders`: a logged-in Pro user following three names, with a Pulse issue, the
 * macro stress reading, two alerts and a report history. Values are illustrative, dated 24 Nov 2026.
 */
object ShellFixtures {

    private fun move(id: String, label: String, family: MarketTapeFamily, value: Double, change: Double, pct: Double, unit: String) =
        MarketTapeMoveView(
            instrumentId = id, label = label, family = family, familyRaw = family.wire, value = value,
            previousValue = value - change, dailyChange = change, dailyChangePct = pct, unit = unit,
            direction = if (change > 0) "up" else if (change < 0) "down" else "flat",
            asOf = "2026-11-23", retrievedAt = "2026-11-24T06:40:00Z", sourceName = "FRED", sourceUrl = null
        )

    val pulse = PulseReportView(
        reportId = "pulse-2026-11-24",
        generatedAt = "2026-11-24T07:02:00Z",
        cycleEnd = "2026-11-24",
        sections = listOf(
            SectionView(sectionId = "summary", title = "Morning line", body = "Stocks edged higher as yields eased; credit spreads were steady."),
            SectionView(sectionId = "markets", title = "Markets", body = "S&P 500 5,525 (+0.7%), Nasdaq +1.0%, 10-year 4.29%."),
        ),
        tape = MarketTapeView(
            asOf = "2026-11-23", coverageState = "complete", summary = null,
            indices = listOf(
                move("SP500", "S&P 500", MarketTapeFamily.CoreIndex, 5525.21, 40.44, 0.74, "index"),
                move("NASDAQCOM", "Nasdaq", MarketTapeFamily.CoreIndex, 17382.94, 173.0, 1.0, "index"),
            ),
            crossAsset = listOf(
                move("DGS10", "10-year", MarketTapeFamily.Rates, 4.29, -0.03, -0.7, "percent"),
                move("VIXCLS", "VIX", MarketTapeFamily.Volatility, 16.2, -0.8, -4.7, "index"),
            )
        )
    )

    private fun snapshot(ticker: String, state: String, score: Double, reason: String) = ThesisMonitorSnapshotView(
        ticker = ticker, state = state, reason = reason, score = score, reportId = "rep-$ticker",
        reportGeneratedAt = "2026-11-01T10:00:00Z", freshnessState = "fresh", freshnessScore = 0.8, updatedAt = "2026-11-24T06:00:00Z"
    )

    private fun alert(id: String, type: String, route: String, title: String, ticker: String?, createdAt: String) =
        AlertLedgerItemView(
            id = id, notificationType = type, category = "thesis", route = route, title = title,
            body = "$title. Open to see what changed.", reasonCode = type, reasonText = "You follow ${ticker ?: "this"}.",
            deliveryState = "delivered", ticker = ticker, createdAt = createdAt, updatedAt = createdAt
        )

    val state = UiState(
        apiBaseUrl = "https://api.example.invalid",
        tokens = AuthTokens("a", "r", "2026-11-25T00:00:00Z", "2026-12-24T00:00:00Z"),
        userProfile = UserProfileView("u1", "reader@example.invalid", "PRO", null, 25, 10, 9),
        pulseReport = pulse,
        sentimentCurrent = SentimentSnapshotView("s1", "2026-11-23", 42.0, "Calm", calculatedAt = "2026-11-24T06:45:00Z"),
        watchlist = listOf("AAPL", "MSFT", "NVDA"),
        watchlistLoaded = true,
        monitorSnapshots = listOf(
            snapshot("AAPL", "intact", 78.0, "Services margin holds"),
            snapshot("MSFT", "watch", 61.0, "Cloud growth slowed two quarters"),
            snapshot("NVDA", "at_risk", 44.0, "Customer concentration rose"),
        ),
        alertLedger = listOf(
            alert("al1", "kill_switch", "names", "NVDA moved to At risk", "NVDA", "2026-11-24T06:50:00Z"),
            alert("al2", "freshness_decay", "research", "MSFT report is 90 days old", "MSFT", "2026-11-20T09:00:00Z"),
        ),
        reportHistory = listOf(
            ReportHistoryItem("rep-AAPL", "j1", "deep_dive", "AAPL", "2026-11-01T10:00:00Z"),
            ReportHistoryItem("rep-MSFT", "j2", "deep_dive", "MSFT", "2026-08-26T10:00:00Z"),
        ),
        reportHistoryLoaded = true,
        selectedTicker = "",
        lastInboxVisitAtMs = 1_763_900_000_000L // 23 Nov 2025: every alert is new
    )

    /** A navigator on [tab]'s root, or with [push] on top of it. */
    fun navigator(tab: ShellTab, push: Destination? = null, modal: Destination? = null): AppNavigator =
        AppNavigator().apply {
            selectTab(tab)
            push?.let { push(it) }
            modal?.let { openModal(it) }
        }
}
