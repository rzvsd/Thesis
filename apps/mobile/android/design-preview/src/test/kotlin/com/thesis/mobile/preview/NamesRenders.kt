package com.thesis.mobile.preview

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.unit.dp
import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.model.NoteTrailEntry
import com.thesis.mobile.model.SnapshotDelta
import com.thesis.mobile.preview.fixtures.NamesFixtures
import com.thesis.mobile.ui.screens.BoardFilter
import com.thesis.mobile.ui.screens.BoardSeed
import com.thesis.mobile.ui.screens.CsvImportState
import com.thesis.mobile.ui.screens.LocalBoardSeed
import com.thesis.mobile.ui.screens.NamesScreen
import com.thesis.mobile.ui.screens.SHEET_SORT
import com.thesis.mobile.ui.shell.ListDensity
import org.junit.Test

/**
 * Names (5.10) and its Notes view (5.28) with fixture data: loaded, loading, empty, error, Compact, a filter,
 * compare selection, the context sheet, the remove confirm, sort, the import panel, Notes and Notes empty, plus the
 * 1.3x / 2.0x / 360 dp / full-page variants. Run: render.sh '^names-'
 */
class NamesRenders {

    /** The status bar the shell reserves above the page in the app. */
    private val statusBar = PaddingValues(top = 24.dp)

    @Composable
    private fun Board(
        watchlist: List<String> = NamesFixtures.watchlist,
        loaded: Boolean = true,
        error: String? = null,
        refreshing: Boolean = false,
        density: ListDensity = ListDensity.Comfortable,
        notes: List<NoteTrailEntry> = NamesFixtures.notes,
        alerts: List<AlertLedgerItemView> = NamesFixtures.alerts,
        seed: BoardSeed = BoardSeed(),
        segment: Int = 0,
        lastVisit: Long = NamesFixtures.lastVisitAtMs,
        warRooms: Map<String, String> = NamesFixtures.warRooms,
        liveWarRooms: Set<String> = emptySet(),
        deltas: Map<String, SnapshotDelta> = NamesFixtures.deltas,
    ) {
        NamesFixtures.Clocked {
            CompositionLocalProvider(LocalBoardSeed provides seed) {
                NamesScreen(
                    padding = statusBar,
                    watchlist = watchlist,
                    monitorSnapshots = if (watchlist.isEmpty()) emptyList() else NamesFixtures.snapshots,
                    alerts = alerts,
                    onRefresh = {}, onAddTicker = {}, onRemoveTicker = {}, onRunDeepDive = {}, onOpenResearch = {},
                    onImportHoldingsCsv = { Result.success(NamesFixtures.importResult) },
                    warRoomByTicker = warRooms,
                    liveWarRooms = liveWarRooms,
                    refreshing = refreshing,
                    loaded = loaded,
                    error = error,
                    snapshotDeltas = deltas,
                    lastVisitAtMs = lastVisit,
                    allNotes = notes,
                    companyNames = NamesFixtures.companyNames,
                    tickerSuggestions = NamesFixtures.suggestions,
                    density = density,
                    now = NamesFixtures.now,
                    onCompare = {},
                    onCompareWith = {},
                    onExportNotes = {},
                    initialSegment = segment,
                )
            }
        }
    }

    @Test fun loaded() { renderScreen("names-loaded") { Board() } }

    @Test fun loadedFullPage() { renderScreen("names-loaded-full", heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP) { Board() } }

    /** Rubric M3: the in-app Reduce motion toggle; rows take their places without gliding. */
    @Test fun loadedReduced() { renderScreen("names-loaded-reduced", reducedMotion = true) { Board() } }

    @Test fun loaded360() { renderScreen("names-loaded-360", widthDp = PhoneSpec.NARROW_WIDTH_DP) { Board() } }

    @Test fun loadedFont13() { renderScreen("names-loaded-font130", fontScale = 1.3f) { Board() } }

    @Test fun loadedFont20() { renderScreen("names-loaded-font200", fontScale = 2.0f) { Board() } }

    @Test fun compact() { renderScreen("names-compact") { Board(density = ListDensity.Compact) } }

    @Test fun compactFullPage() {
        renderScreen("names-compact-full", heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP) { Board(density = ListDensity.Compact) }
    }

    /** First visit: no reference point yet, so no deltas, no "changed" and no "new" marks. */
    @Test fun firstVisit() { renderScreen("names-first-visit") { Board(lastVisit = 0L, deltas = emptyMap()) } }

    /** GOOGL reports today: its War Room is live, so the row's StatusSquare gives way to the LiveDot (#11, #29). */
    @Test fun warRoomLive() {
        renderScreen("names-war-room-live") { Board(alerts = NamesFixtures.alertsLive, liveWarRooms = NamesFixtures.liveWarRooms) }
    }

    @Test fun warRoomLiveSheet() {
        renderScreen("names-war-room-live-sheet") {
            Board(alerts = NamesFixtures.alertsLive, liveWarRooms = NamesFixtures.liveWarRooms, seed = BoardSeed(contextFor = "GOOGL"))
        }
    }

    @Test fun loading() { renderScreen("names-loading") { Board(watchlist = emptyList(), loaded = false) } }

    @Test fun refreshing() { renderScreen("names-refreshing", settleMs = 400) { Board(refreshing = true) } }

    @Test fun empty() { renderScreen("names-empty") { Board(watchlist = emptyList(), notes = emptyList(), alerts = emptyList()) } }

    @Test fun error() {
        renderScreen("names-error") { Board(watchlist = emptyList(), loaded = false, error = "The server did not answer in 20 seconds.") }
    }

    @Test fun errorWithData() {
        renderScreen("names-error-banner") { Board(error = "Could not refresh. Showing the last readings.") }
    }

    @Test fun filtered() { renderScreen("names-filter-changed") { Board(seed = BoardSeed(filter = BoardFilter.Changed)) } }

    @Test fun filterEmpty() {
        // No dated earnings alert and no War Room in its window: the filter is empty and offers Show all.
        renderScreen("names-filter-empty") {
            Board(seed = BoardSeed(filter = BoardFilter.EarningsSoon), alerts = emptyList(), warRooms = emptyMap())
        }
    }

    @Test fun fieldError() {
        renderScreen("names-field-error") { Board(seed = BoardSeed(input = "AAPL", inputError = "AAPL is already in your names.")) }
    }

    @Test fun selection() { renderScreen("names-compare-select") { Board(seed = BoardSeed(selected = listOf("AAPL", "MSFT"))) } }

    @Test fun contextSheet() { renderScreen("names-context-sheet") { Board(seed = BoardSeed(contextFor = "GOOGL")) } }

    @Test fun removeConfirm() { renderScreen("names-remove-confirm") { Board(seed = BoardSeed(confirmRemove = "TSLA")) } }

    @Test fun sortSheet() { renderScreen("names-sort-sheet") { Board(seed = BoardSeed(sheet = SHEET_SORT)) } }

    @Test fun importIdle() { renderScreen("names-import-idle") { Board(seed = BoardSeed(importState = CsvImportState.Idle)) } }

    @Test fun importDone() {
        renderScreen("names-import-done") { Board(seed = BoardSeed(importState = CsvImportState.Done(NamesFixtures.importResult))) }
    }

    @Test fun importFailed() {
        renderScreen("names-import-failed") {
            Board(seed = BoardSeed(importState = CsvImportState.Failed("Could not read that file. Pick a CSV under 512 KB.")))
        }
    }

    @Test fun notes() { renderScreen("names-notes") { Board(segment = 1) } }

    @Test fun notes360() { renderScreen("names-notes-360", widthDp = PhoneSpec.NARROW_WIDTH_DP, fontScale = 1.3f) { Board(segment = 1) } }

    @Test fun notesEmpty() { renderScreen("names-notes-empty") { Board(segment = 1, notes = emptyList()) } }
}
