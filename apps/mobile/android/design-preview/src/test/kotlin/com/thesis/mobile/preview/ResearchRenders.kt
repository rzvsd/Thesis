package com.thesis.mobile.preview

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.Composable
import com.thesis.mobile.model.SearchResultsView
import com.thesis.mobile.preview.fixtures.ResearchFixtures as F
import com.thesis.mobile.ui.screens.CompareNamesScreen
import com.thesis.mobile.ui.screens.CompareReportsScreen
import com.thesis.mobile.ui.screens.HistoryFilter
import com.thesis.mobile.ui.screens.HistoryScreen
import com.thesis.mobile.ui.screens.NameMetric
import com.thesis.mobile.ui.screens.ResearchScreen
import com.thesis.mobile.ui.screens.ScenarioStressScreen
import com.thesis.mobile.ui.screens.SearchScreen
import com.thesis.mobile.ui.screens.WarRoomScreen
import org.junit.Test

/**
 * WP-E renders (DESIGN-DIRECTION 5.12, 5.17 to 5.20, 5.26, 5.27): each screen loaded, loading, empty and error in
 * both themes, plus 1.3x and 2.0x font scale, 360 dp width and one full page (2400 dp) per screen.
 * Run: `gradle -p design-preview test -PrendersOnly -Pscreens.only='^research'`.
 */
class ResearchRenders {

    // ---- Research root (5.12)

    @Composable
    private fun Root(ticker: String = "", empty: Boolean = false) = F.Fixed {
        ResearchScreen(
            ticker = ticker,
            recentHistory = if (empty) emptyList() else F.history,
            onTickerChange = {}, onRunReport = {}, onOpenReport = {}, onOpenPulse = {},
            padding = PaddingValues(),
            onSeeAllHistory = {},
            suggestions = if (ticker.isNotEmpty()) F.suggestions else emptyList(),
            watchlist = F.watchlist,
            companyNames = F.companyNames,
            filingPeriods = F.filingPeriods,
            notedReportIds = F.noted,
            continueReading = if (empty) null else F.continueReading,
            onOpenCompareNames = {}, onOpenScenarioStress = {}, onOpenMacroStress = {}, onOpenWeeklyDigest = {},
            clock = F.clock,
        )
    }

    @Test fun root() { renderScreen("research-root") { Root() } }
    @Test fun rootEmpty() { renderScreen("research-root-empty", glow = false) { Root(empty = true) } }
    @Test fun rootStored() { renderScreen("research-root-stored", glow = false) { Root(ticker = "AAPL") } }
    @Test fun rootTyping() { renderScreen("research-root-typing", glow = false) { Root(ticker = "AA") } }
    @Test fun rootFont13() { renderScreen("research-root-font13", fontScale = 1.3f, glow = false) { Root() } }
    @Test fun rootFont20() { renderScreen("research-root-font20", fontScale = 2.0f, glow = false) { Root() } }
    @Test fun root360() { renderScreen("research-root-360", widthDp = 360, glow = false) { Root() } }
    @Test fun rootFull() { renderScreen("research-root-full", heightDp = 2400, glow = false) { Root() } }
    // Reduced motion (M3): the first frames already show the final layout (continue row in place, no entrance).
    @Test fun rootReduced() { renderScreen("research-root-reduced", reducedMotion = true, settleMs = 100, glow = false) { Root() } }
    @Test fun rootFont20Light() { renderScreen("research-root-font20-360", fontScale = 2.0f, widthDp = 360, glow = false) { Root() } }

    // ---- History (5.18)

    @Composable
    private fun History(
        loaded: Boolean = true,
        items: Boolean = true,
        error: String? = null,
        filter: HistoryFilter = HistoryFilter.All,
        compare: Boolean = false,
        picked: List<String> = emptyList(),
    ) = F.Fixed {
        HistoryScreen(
            historyItems = if (items) F.history else emptyList(),
            onBack = {}, onOpenReport = {},
            loaded = loaded, error = error,
            companyNames = F.companyNames, filingPeriods = F.filingPeriods, notedReportIds = F.noted,
            onCompareReports = { _, _ -> },
            initialFilter = filter, initialCompareMode = compare, initialPicked = picked,
            clock = F.clock,
        )
    }

    @Test fun history() { renderScreen("research-history") { History() } }
    @Test fun historyLoading() { renderScreen("research-history-loading", glow = false, settleMs = 300) { History(loaded = false, items = false) } }
    @Test fun historyEmpty() { renderScreen("research-history-empty", glow = false) { History(items = false) } }
    @Test fun historyError() { renderScreen("research-history-error", glow = false) { History(loaded = false, items = false, error = "No connection.") } }
    @Test fun historyStale() { renderScreen("research-history-stale", glow = false) { History(error = "No connection.") } }
    @Test fun historyNotes() { renderScreen("research-history-notes", glow = false) { History(filter = HistoryFilter.WithNotes) } }
    @Test fun historyCompare() { renderScreen("research-history-compare") { History(compare = true, picked = listOf("aapl-25")) } }
    @Test fun historyComparePicked() { renderScreen("research-history-compare-picked", glow = false) { History(compare = true, picked = listOf("aapl-25", "aapl-24")) } }
    @Test fun historyFont13() { renderScreen("research-history-font13", fontScale = 1.3f, glow = false) { History() } }
    @Test fun historyFont20() { renderScreen("research-history-font20", fontScale = 2.0f, glow = false) { History() } }
    @Test fun history360() { renderScreen("research-history-360", widthDp = 360, glow = false) { History(compare = true, picked = listOf("aapl-25")) } }
    @Test fun historyFull() { renderScreen("research-history-full", heightDp = 2400, glow = false) { History() } }

    // ---- Compare reports (5.17)

    @Composable
    private fun Reports(state: com.thesis.mobile.model.CompareReportsState?) = F.Fixed {
        CompareReportsScreen(state = state, onBack = {}, notes = F.compareNotes, onOpenChange = { _, _ -> }, zone = F.zone)
    }

    @Test fun compareReports() { renderScreen("research-compare-reports") { Reports(F.compareReports) } }
    @Test fun compareReportsLoading() { renderScreen("research-compare-reports-loading", glow = false, settleMs = 300) { Reports(F.compareReportsLoading) } }
    @Test fun compareReportsError() { renderScreen("research-compare-reports-error", glow = false) { Reports(F.compareReportsError) } }
    @Test
    fun compareReportsOtherCompany() {
        val other = F.compareReports.copy(b = F.aaplNewer.copy(ticker = "MSFT"))
        renderScreen("research-compare-reports-refused", glow = false) { Reports(other) }
    }
    @Test fun compareReportsFont13() { renderScreen("research-compare-reports-font13", fontScale = 1.3f, glow = false) { Reports(F.compareReports) } }
    @Test fun compareReportsFont20() { renderScreen("research-compare-reports-font20", fontScale = 2.0f, glow = false) { Reports(F.compareReports) } }
    @Test fun compareReports360() { renderScreen("research-compare-reports-360", widthDp = 360, glow = false) { Reports(F.compareReports) } }
    @Test fun compareReportsFull() { renderScreen("research-compare-reports-full", heightDp = 2400, glow = false) { Reports(F.compareReports) } }
    @Test
    fun compareReportsSameFiling() {
        val same = F.compareReports.copy(a = F.aaplNewer.copy(reportId = "aapl-25b"), b = F.aaplNewer)
        renderScreen("research-compare-reports-same", glow = false) { Reports(same) }
    }

    // ---- Compare names (5.26)

    @Composable
    private fun Names(
        state: com.thesis.mobile.model.CompareNamesState? = F.compareNames,
        sort: NameMetric? = null,
        chart: Boolean = false,
        mode: Int = 0,
    ) = F.Fixed {
        CompareNamesScreen(
            state = state, onBack = {}, disciplines = F.disciplines,
            initialSortMetric = sort, initialShowChart = chart, initialChartMode = mode, zone = F.zone,
        )
    }

    @Test fun compareNames() { renderScreen("research-compare-names") { Names() } }
    @Test fun compareNamesSorted() { renderScreen("research-compare-names-sorted", glow = false) { Names(sort = NameMetric.Operating) } }
    @Test fun compareNamesChart() { renderScreen("research-compare-names-chart", heightDp = 2400, glow = false) { Names(chart = true) } }
    @Test fun compareNamesSideBySide() { renderScreen("research-compare-names-side", heightDp = 2400, glow = false) { Names(chart = true, mode = 1) } }
    @Test fun compareNamesLoading() { renderScreen("research-compare-names-loading", glow = false, settleMs = 300) { Names(F.compareNamesLoading) } }
    @Test fun compareNamesError() { renderScreen("research-compare-names-error", glow = false) { Names(F.compareNamesError) } }
    @Test fun compareNamesEmpty() { renderScreen("research-compare-names-empty", glow = false) { Names(null) } }
    @Test fun compareNamesFont13() { renderScreen("research-compare-names-font13", fontScale = 1.3f, glow = false) { Names() } }
    @Test fun compareNamesFont20() { renderScreen("research-compare-names-font20", fontScale = 2.0f, glow = false) { Names() } }
    @Test fun compareNames360() { renderScreen("research-compare-names-360", widthDp = 360, glow = false) { Names() } }
    @Test fun compareNamesTablet() { renderScreen("research-compare-names-tablet", widthDp = 840, glow = false) { Names() } }
    @Test fun compareNamesFull() { renderScreen("research-compare-names-full", heightDp = 2400, glow = false) { Names() } }

    // ---- Search (5.27)

    @Composable
    private fun Search(query: String, results: SearchResultsView?, recent: List<String> = F.recentSearches) = F.Fixed {
        SearchScreen(
            query = query, onQueryChange = {}, results = results, onBack = {},
            recentSearches = recent, onClearRecent = {},
            companyNames = F.companyNames, filingPeriods = F.filingPeriods, notedReportIds = F.noted,
            autoFocus = false,
        )
    }

    @Test fun searchRecent() { renderScreen("research-search-recent") { Search("", null) } }
    @Test fun searchStart() { renderScreen("research-search-start", glow = false) { Search("", null, recent = emptyList()) } }
    @Test fun searchResults() { renderScreen("research-search-results") { Search("ap", F.searchResults) } }
    @Test fun searchSearching() { renderScreen("research-search-searching", glow = false, settleMs = 300) { Search("ap", F.searchLocalOnly) } }
    @Test fun searchLoading() { renderScreen("research-search-loading", glow = false, settleMs = 300) { Search("ap", null) } }
    @Test fun searchNoMatch() { renderScreen("research-search-none", glow = false) { Search("zzqx", SearchResultsView("zzqx")) } }
    @Test fun searchFont13() { renderScreen("research-search-font13", fontScale = 1.3f, glow = false) { Search("ap", F.searchResults) } }
    @Test fun searchFont20() { renderScreen("research-search-font20", fontScale = 2.0f, glow = false) { Search("ap", F.searchResults) } }
    @Test fun search360() { renderScreen("research-search-360", widthDp = 360, glow = false) { Search("ap", F.searchResults) } }
    @Test fun searchFull() { renderScreen("research-search-full", heightDp = 2400, glow = false) { Search("ap", F.searchResults) } }

    // ---- War Room (5.19)

    @Composable
    private fun War(room: com.thesis.mobile.model.WarRoomView?, error: String? = null, loading: Boolean = false, names: Boolean = true) = F.Fixed {
        WarRoomScreen(
            warRoom = room, errorMessage = error, onRefresh = {}, padding = PaddingValues(),
            onBack = {}, isLoading = loading, onOpenName = if (names) ({ _: String -> }) else null, onOpenReport = {},
        )
    }

    @Test fun warRoomLive() { renderScreen("research-war-room") { War(F.warRoomLive) } }
    @Test fun warRoomClosed() { renderScreen("research-war-room-closed", glow = false) { War(F.warRoomClosed) } }
    @Test fun warRoomPre() { renderScreen("research-war-room-pre", glow = false) { War(F.warRoomPre) } }
    @Test fun warRoomStale() { renderScreen("research-war-room-stale", glow = false) { War(F.warRoomClosed, error = "No connection.") } }
    @Test fun warRoomLoading() { renderScreen("research-war-room-loading", glow = false, settleMs = 300) { War(null, loading = true) } }
    @Test fun warRoomError() { renderScreen("research-war-room-error", glow = false) { War(null, error = "The server took too long to answer.") } }
    // Before WP-INT wires onOpenName: the related tickers as text, not buttons that do nothing.
    @Test fun warRoomUnwired() { renderScreen("research-war-room-unwired", heightDp = 2400, glow = false) { War(F.warRoomClosed, names = false) } }
    @Test fun warRoomEmpty() { renderScreen("research-war-room-empty", glow = false) { War(null) } }
    @Test fun warRoomFont13() { renderScreen("research-war-room-font13", fontScale = 1.3f, glow = false) { War(F.warRoomLive) } }
    @Test fun warRoomFont20() { renderScreen("research-war-room-font20", fontScale = 2.0f, glow = false) { War(F.warRoomLive) } }
    @Test fun warRoom360() { renderScreen("research-war-room-360", widthDp = 360, glow = false) { War(F.warRoomLive) } }
    @Test fun warRoomFull() { renderScreen("research-war-room-full", heightDp = 2400, glow = false) { War(F.warRoomLive) } }
    // Reduced motion (M3): the live mark holds still and the phase cards are open without a transition.
    @Test fun warRoomReduced() { renderScreen("research-war-room-reduced", reducedMotion = true, settleMs = 100, glow = false) { War(F.warRoomLive) } }

    // ---- Scenario Stress (5.20)

    @Composable
    private fun Stress(
        tier: String? = "PRO",
        run: com.thesis.mobile.model.ScenarioStressRunView? = F.stressRun,
        templates: Boolean = true,
        templatesError: String? = null,
        runError: String? = null,
        loadingTemplates: Boolean = false,
        running: Boolean = false,
        selected: String? = "rates_higher_for_longer",
        names: Int = F.watchlist.size,
    ) = F.Fixed {
        ScenarioStressScreen(
            userTier = tier,
            templates = if (templates) F.templates else emptyList(),
            selectedScenarioId = selected,
            run = run,
            templatesError = templatesError,
            runError = runError,
            isLoadingTemplates = loadingTemplates,
            isRunning = running,
            watchlistCount = names,
            onRefreshTemplates = {}, onSelectTemplate = {}, onRunScenario = {}, onRequireUpgrade = {},
            onBack = {}, onOpenName = {},
            zone = F.zone,
        )
    }

    @Test fun stress() { renderScreen("research-stress") { Stress() } }
    @Test fun stressFresh() { renderScreen("research-stress-fresh", glow = false) { Stress(run = null, selected = null) } }
    @Test fun stressRunning() { renderScreen("research-stress-running", glow = false, settleMs = 300) { Stress(run = null, running = true) } }
    @Test fun stressRunFailed() { renderScreen("research-stress-run-failed", glow = false) { Stress(run = null, runError = "The run timed out.") } }
    @Test fun stressTemplatesLoading() { renderScreen("research-stress-templates-loading", glow = false, settleMs = 300) { Stress(run = null, templates = false, loadingTemplates = true, selected = null) } }
    @Test fun stressTemplatesError() { renderScreen("research-stress-templates-error", glow = false) { Stress(run = null, templates = false, templatesError = "No connection.", selected = null) } }
    // No names followed: the run bar is disabled and says why.
    @Test fun stressNoNames() { renderScreen("research-stress-no-names", glow = false) { Stress(run = null, names = 0) } }
    @Test fun stressFree() { renderScreen("research-stress-free") { Stress(tier = "FREE", run = null, selected = null) } }
    @Test fun stressFont13() { renderScreen("research-stress-font13", fontScale = 1.3f, glow = false) { Stress() } }
    @Test fun stressFont20() { renderScreen("research-stress-font20", fontScale = 2.0f, glow = false) { Stress() } }
    @Test fun stress360() { renderScreen("research-stress-360", widthDp = 360, glow = false) { Stress() } }
    @Test fun stressFull() { renderScreen("research-stress-full", heightDp = 2400, glow = false) { Stress() } }
    // Reduced motion (M3): the bars are at their values on the first frames (no growth from 0).
    @Test fun stressReduced() { renderScreen("research-stress-reduced", heightDp = 2400, reducedMotion = true, settleMs = 100, glow = false) { Stress() } }
}
