package com.thesis.mobile.preview

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.isFocused
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.thesis.mobile.model.NameDetailView
import com.thesis.mobile.preview.fixtures.NamesFixtures
import com.thesis.mobile.ui.copy.NamesCopy
import com.thesis.mobile.ui.platform.HapticKind
import com.thesis.mobile.ui.platform.PreviewBack
import com.thesis.mobile.ui.platform.PreviewHaptics
import com.thesis.mobile.ui.screens.BoardSeed
import com.thesis.mobile.ui.screens.LocalBoardSeed
import com.thesis.mobile.ui.screens.LocalNameSeed
import com.thesis.mobile.ui.screens.NamePager
import com.thesis.mobile.ui.screens.NameScreen
import com.thesis.mobile.ui.screens.NameSeed
import com.thesis.mobile.ui.screens.NamesScreen
import com.thesis.mobile.ui.theme.ThemeMode
import com.thesis.mobile.ui.theme.ThesisTheme
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test

/** Names and Name semantics and callbacks (5.10, 5.11; section 6.3 WP-B acceptance). */
class NamesSemanticsTest {

    @get:Rule val rule = createComposeRule()

    @Before fun clearHaptics() = PreviewHaptics.clear()

    private val removed = mutableListOf<String>()
    private val opened = mutableListOf<String>()
    private var builds = 0

    private fun board(
        seed: BoardSeed = BoardSeed(),
        undo: (suspend (String, String) -> Boolean)? = null,
        watchlist: List<String> = NamesFixtures.watchlist,
        onCompare: ((List<String>) -> Unit)? = {},
        liveWarRooms: Set<String> = emptySet(),
    ) {
        rule.setContent {
            ThesisTheme(mode = ThemeMode.Light) {
                NamesFixtures.Clocked {
                    CompositionLocalProvider(LocalBoardSeed provides seed) {
                        NamesScreen(
                            padding = PaddingValues(),
                            watchlist = watchlist,
                            monitorSnapshots = NamesFixtures.snapshots,
                            alerts = if (liveWarRooms.isEmpty()) NamesFixtures.alerts else NamesFixtures.alertsLive,
                            onRefresh = {}, onAddTicker = {}, onRemoveTicker = { removed += it }, onRunDeepDive = {}, onOpenResearch = {},
                            onImportHoldingsCsv = { Result.success(NamesFixtures.importResult) },
                            warRoomByTicker = NamesFixtures.warRooms,
                            onOpenWarRoom = { opened += it },
                            liveWarRooms = liveWarRooms,
                            snapshotDeltas = NamesFixtures.deltas,
                            lastVisitAtMs = NamesFixtures.lastVisitAtMs,
                            allNotes = NamesFixtures.notes,
                            companyNames = NamesFixtures.companyNames,
                            now = NamesFixtures.now,
                            onOpenName = { ticker, _, _ -> opened += ticker },
                            onCompare = onCompare,
                            onShowUndo = undo,
                        )
                    }
                }
            }
        }
    }

    private fun name(
        detail: NameDetailView?,
        seed: NameSeed = NameSeed(),
        onFollow: (Boolean) -> Unit = {},
        focusNote: Boolean = false,
    ) {
        rule.setContent {
            ThesisTheme(mode = ThemeMode.Light) {
                NamesFixtures.Clocked {
                    CompositionLocalProvider(LocalNameSeed provides seed) {
                        NameScreen(
                            padding = PaddingValues(),
                            ticker = detail?.ticker ?: "AAPL",
                            detail = detail,
                            following = true,
                            lastVisitAtMs = NamesFixtures.lastVisitAtMs,
                            pager = NamePager(2, 8),
                            now = NamesFixtures.now,
                            focusNote = focusNote,
                            onFollowChange = onFollow,
                            onOpenReport = { opened += it },
                            onBuildReport = { builds++ },
                            onPrevious = {},
                            onNext = {},
                        )
                    }
                }
            }
        }
    }

    @Test
    fun boardTitleIsHeadingAndTargetsAreLargeEnough() {
        board()
        rule.onNodeWithText(NamesCopy.TITLE).assertIsHeading()
        rule.assertAllTouchTargetsAtLeast()
    }

    @Test
    fun aLiveWarRoomShowsTheLiveDotAndTheSheetOffersIt() {
        board(seed = BoardSeed(contextFor = "GOOGL"), liveWarRooms = NamesFixtures.liveWarRooms)
        // The row's leading column holds the LiveDot (#11, #29): exactly one, on GOOGL.
        assertEquals(1, rule.onAllNodesWithContentDescription("Live", useUnmergedTree = true).fetchSemanticsNodes().size)
        rule.onNodeWithText(NamesCopy.WAR_ROOM).assertExists().performClick()
        assertEquals(listOf("wr-googl"), opened)
    }

    @Test
    fun aWarRoomOutsideItsLivePhaseShowsNoDotAndNoSheetAction() {
        board(seed = BoardSeed(contextFor = "GOOGL"))
        assertEquals(0, rule.onAllNodesWithContentDescription("Live", useUnmergedTree = true).fetchSemanticsNodes().size)
        rule.onNodeWithText(NamesCopy.WAR_ROOM).assertDoesNotExist()
    }

    @Test
    fun filterChipsReportSelection() {
        board()
        rule.onNodeWithText(NamesCopy.FILTER_ALL, substring = true).assertIsSelected()
        rule.onNodeWithText(NamesCopy.FILTER_CHANGED, substring = true).assertIsNotSelected().performClick()
        rule.onNodeWithText(NamesCopy.FILTER_CHANGED, substring = true).assertIsSelected()
    }

    @Test
    fun filterAndSortSurviveASwitchToNotesAndBack() {
        board()
        rule.onNodeWithText(NamesCopy.FILTER_CHANGED, substring = true).performClick()
        rule.onNodeWithText(NamesCopy.SEGMENT_NOTES).performClick()
        rule.waitForIdle()
        rule.onNodeWithText(NamesCopy.FILTER_CHANGED, substring = true).assertDoesNotExistCompat()
        rule.onNodeWithText(NamesCopy.SEGMENT_BOARD).performClick()
        rule.waitForIdle()
        rule.onNodeWithText(NamesCopy.FILTER_CHANGED, substring = true).assertIsSelected()
        rule.onNodeWithText(NamesCopy.FILTER_ALL, substring = true).assertIsNotSelected()
    }

    @Test
    fun aFifthComparePickSaysWhyItIsRefused() {
        board(seed = BoardSeed(selected = listOf("AAPL", "MSFT", "NVDA", "AMZN")))
        rule.onNodeWithText(NamesCopy.COMPARE_MAX).assertDoesNotExistCompat()
        rule.onNodeWithText("COST").performScrollTo().performClick()
        rule.onNodeWithText(NamesCopy.COMPARE_MAX).assertExists().assertIsLiveRegion()
        assertTrue(HapticKind.Reject in PreviewHaptics.log)
        // Un-picking one clears the reason.
        rule.onNodeWithText("AAPL").performScrollTo().performClick()
        rule.onNodeWithText(NamesCopy.COMPARE_MAX).assertDoesNotExistCompat()
    }

    @Test
    fun compareIsHiddenUntilItIsWired() {
        board(onCompare = null)
        rule.onNodeWithContentDescription(NamesCopy.COMPARE).assertDoesNotExistCompat()
    }

    @Test
    fun writeANoteFocusesTheNewestNote() {
        name(NamesFixtures.detail, focusNote = true)
        rule.waitForIdle()
        rule.onNode(isFocused()).assertExists()
    }

    @Test
    fun rowOpensNameWithItsTicker() {
        board()
        rule.onNodeWithText("NVIDIA Corporation", substring = true).performClick()
        assertEquals(listOf("NVDA"), opened)
    }

    @Test
    fun removeNeedsConfirmAndCommitsAfterTheCollapse() {
        board(seed = BoardSeed(confirmRemove = "TSLA"))
        assertTrue(removed.isEmpty())
        rule.onNodeWithText(NamesCopy.REMOVE_CONFIRM).performClick()
        rule.waitForIdle()
        assertEquals(listOf("TSLA"), removed)
        assertTrue(HapticKind.Reject in PreviewHaptics.log)
    }

    @Test
    fun undoKeepsTheName() {
        board(seed = BoardSeed(confirmRemove = "TSLA"), undo = { _, _ -> true })
        rule.onNodeWithText(NamesCopy.REMOVE_CONFIRM).performClick()
        rule.waitForIdle()
        assertTrue(removed.isEmpty())
    }

    @Test
    fun removeCommitsWhenTheBoardLeavesBeforeTheSnackbarResolves() {
        // The snackbar never resolves: the user switches to Notes while it shows, so the board leaves composition.
        board(seed = BoardSeed(confirmRemove = "TSLA"), undo = { _, _ -> awaitCancellation() })
        rule.onNodeWithText(NamesCopy.REMOVE_CONFIRM).performClick()
        rule.waitForIdle()
        assertTrue(removed.isEmpty())
        rule.onNodeWithText(NamesCopy.SEGMENT_NOTES).performClick()
        rule.waitForIdle()
        assertEquals(listOf("TSLA"), removed)
    }

    @Test
    fun compareSelectionEndsOnCancelAndOnSystemBack() {
        board(seed = BoardSeed(selected = listOf("AAPL", "MSFT")))
        rule.onNodeWithText(NamesCopy.CANCEL).assertExists()
        rule.runOnIdle { runBlocking { assertTrue(PreviewBack.press()) } }
        rule.waitForIdle()
        rule.onNodeWithText(NamesCopy.CANCEL).assertDoesNotExistCompat()
        // Back is not claimed once selection is off: it goes to the shell again.
        rule.runOnIdle { assertEquals(0, PreviewBack.enabledCount) }
    }

    @Test
    fun emptyBoardFocusesTheFieldAndHidesRowActions() {
        board(watchlist = emptyList())
        rule.waitForIdle()
        rule.onNode(isFocused()).assertExists()
        rule.onNodeWithContentDescription(NamesCopy.SORT).assertDoesNotExistCompat()
        rule.onNodeWithContentDescription(NamesCopy.COMPARE).assertDoesNotExistCompat()
    }

    @Test
    fun noteEditorWaitsForTheTrailAndShowsTheStoredNote() {
        val saves = mutableListOf<String>()
        val stored = NamesFixtures.notes.first().text
        // MainViewModel.openName publishes the cached detail first (empty trail on a first open), then the trail.
        val state = mutableStateOf(NamesFixtures.detail.copy(notesTrail = emptyList(), isLoading = true))
        rule.setContent {
            ThesisTheme(mode = ThemeMode.Light) {
                NamesFixtures.Clocked {
                    NameScreen(
                        padding = PaddingValues(),
                        ticker = "AAPL",
                        detail = state.value,
                        following = true,
                        now = NamesFixtures.now,
                        onSaveNote = { _, text -> saves += text; true },
                    )
                }
            }
        }
        rule.onNodeWithText(stored).assertDoesNotExistCompat()
        rule.runOnIdle { state.value = NamesFixtures.detail }
        rule.waitForIdle()
        rule.onNodeWithText(stored).assertExists()
        rule.mainClock.advanceTimeBy(3_000)
        rule.waitForIdle()
        assertTrue("showing the stored note must not save it: $saves", saves.isEmpty())
    }

    @Test
    fun nameWithStoredReportOpensAndNeverBuilds() {
        name(NamesFixtures.detail)
        rule.onNodeWithText(NamesCopy.BUILD_REPORT).assertDoesNotExistCompat()
        rule.onNodeWithText("re-run", substring = true, ignoreCase = true).assertDoesNotExistCompat()
        rule.onNodeWithText(NamesCopy.OPEN_REPORT).performScrollTo().performClick()
        assertEquals(listOf("rep-aapl"), opened)
        assertEquals(0, builds)
    }

    @Test
    fun nameWithStoredReportButNoSummaryStillOpens() {
        name(NamesFixtures.detailWarRoom)
        rule.onNodeWithText(NamesCopy.OPEN_REPORT).performScrollTo().performClick()
        assertEquals(listOf("rep-googl"), opened)
        assertEquals(0, builds)
    }

    @Test
    fun nameWithoutReportBuilds() {
        name(NamesFixtures.detailNoReport)
        rule.onNodeWithText(NamesCopy.OPEN_REPORT).assertDoesNotExistCompat()
        rule.onNodeWithText(NamesCopy.BUILD_REPORT).performScrollTo().performClick()
        assertEquals(1, builds)
    }

    @Test
    fun nameHeadingPagerAndTargets() {
        name(NamesFixtures.detail)
        rule.onNodeWithText("Apple Inc.").assertIsHeading()
        rule.onNodeWithText(NamesCopy.pagerCaption(2, 8)).assertExists()
        val actions = rule.onNodeWithContentDescription(NamesCopy.NEXT_NAME).fetchSemanticsNode().config.getOrNull(SemanticsActions.OnClick)
        assertTrue(actions != null)
        rule.assertAllTouchTargetsAtLeast()
    }

    @Test
    fun unfollowAsksFirst() {
        val changes = mutableListOf<Boolean>()
        name(NamesFixtures.detail, onFollow = { changes += it })
        rule.onNodeWithContentDescription(NamesCopy.unfollow("AAPL")).performClick()
        assertTrue(changes.isEmpty())
        rule.onNodeWithText(NamesCopy.REMOVE_CONFIRM).performClick()
        rule.waitForIdle()
        assertEquals(listOf(false), changes)
        assertTrue(HapticKind.ToggleOff in PreviewHaptics.log)
    }

    @Test
    fun loadingShowsTheTickerAsHeading() {
        name(null)
        rule.onNodeWithText("AAPL").assertIsHeading()
        rule.onNodeWithText(NamesCopy.OPEN_REPORT).assertDoesNotExistCompat()
    }

    private fun androidx.compose.ui.test.SemanticsNodeInteraction.assertDoesNotExistCompat() = assertDoesNotExist()
}
