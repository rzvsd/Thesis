package com.thesis.mobile.preview

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.unit.dp
import com.thesis.mobile.model.NameDetailView
import com.thesis.mobile.preview.fixtures.NamesFixtures
import com.thesis.mobile.ui.screens.LocalNameSeed
import com.thesis.mobile.ui.screens.NamePager
import com.thesis.mobile.ui.screens.NameScreen
import com.thesis.mobile.ui.screens.NameSeed
import com.thesis.mobile.ui.screens.filingsFigures
import com.thesis.mobile.ui.screens.filingsSource
import com.thesis.mobile.ui.screens.monitorTiles
import java.time.ZoneOffset
import org.junit.Test

/**
 * Name (5.11) with fixture data: with and without a report, change summary, notes trail, carry forward, War Room,
 * Pro and non-Pro, loading and error, a SourceSheet, the remove confirm, the five years, the reports selection, and
 * the 1.3x / 2.0x / 360 dp / full-page variants. Run: render.sh '^name-'
 */
class NameRenders {

    private val statusBar = PaddingValues(top = 24.dp)

    @Composable
    private fun Name(
        detail: NameDetailView? = NamesFixtures.detail,
        ticker: String = detail?.ticker ?: "AAPL",
        following: Boolean = true,
        error: String? = null,
        isPro: Boolean = true,
        warRoomId: String? = null,
        warRoomLive: Boolean = false,
        pager: NamePager? = NamePager(4, 8),
        seed: NameSeed = NameSeed(),
    ) {
        NamesFixtures.Clocked {
            CompositionLocalProvider(LocalNameSeed provides seed) {
                NameScreen(
                    padding = statusBar,
                    ticker = ticker,
                    detail = detail,
                    following = following,
                    error = error,
                    companyName = NamesFixtures.companyNames[ticker],
                    lastVisitAtMs = NamesFixtures.lastVisitAtMs,
                    warRoomId = warRoomId,
                    warRoomLive = warRoomLive,
                    isPro = isPro,
                    journal = NamesFixtures.journal,
                    pager = pager,
                    now = NamesFixtures.now,
                    onPrevious = {},
                    onNext = {},
                    onSeeAlerts = {},
                    onSaveNote = { _, _ -> true },
                    onCompareWith = {},
                    onBack = {},
                )
            }
        }
    }

    @Test fun full() { renderScreen("name-full") { Name() } }

    /** Rubric M3: the in-app Reduce motion toggle. */
    @Test fun fullReduced() { renderScreen("name-full-reduced", reducedMotion = true) { Name() } }

    @Test fun fullPage() { renderScreen("name-full-page", heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP) { Name() } }

    @Test fun fullPageYears() {
        renderScreen("name-full-page-years", heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP, themes = listOf(PreviewTheme.entries.first())) {
            Name(seed = NameSeed(showYears = true, selectReports = listOf("rep-aapl")))
        }
    }

    @Test fun narrow() { renderScreen("name-360", widthDp = PhoneSpec.NARROW_WIDTH_DP) { Name() } }

    @Test fun font13() { renderScreen("name-font130", fontScale = 1.3f) { Name() } }

    @Test fun font20() { renderScreen("name-font200", fontScale = 2.0f) { Name() } }

    @Test fun firstReport() {
        renderScreen("name-first-report", heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP) { Name(detail = NamesFixtures.detailFirstReport, isPro = false) }
    }

    @Test fun carryForward() {
        renderScreen("name-carry-forward", heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP) { Name(detail = NamesFixtures.detailCarryForward) }
    }

    @Test fun noReport() {
        renderScreen("name-no-report", heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP) { Name(detail = NamesFixtures.detailNoReport, isPro = false) }
    }

    @Test fun warRoom() {
        renderScreen("name-war-room", heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP) {
            Name(detail = NamesFixtures.detailWarRoom, warRoomId = "wr-googl", isPro = false)
        }
    }

    @Test fun warRoomLive() {
        renderScreen("name-war-room-live", heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP) {
            Name(detail = NamesFixtures.detailWarRoomLive, warRoomId = "wr-googl", warRoomLive = true, isPro = false)
        }
    }

    @Test fun warRoomLiveReduced() {
        renderScreen("name-war-room-live-reduced", heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP, reducedMotion = true) {
            Name(detail = NamesFixtures.detailWarRoomLive, warRoomId = "wr-googl", warRoomLive = true, isPro = false)
        }
    }

    @Test fun reportsSelecting() {
        renderScreen("name-reports-select", heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP, themes = listOf(PreviewTheme.entries.first())) {
            // A shorter page (no change summary, no five years, non-Pro), so Reports is inside the 2400 dp frame.
            val short = NamesFixtures.detail.copy(
                summary = NamesFixtures.detail.summary?.copy(changeSummary = null, annualHistory = emptyList()),
            )
            Name(detail = short, isPro = false, seed = NameSeed(selectReports = listOf("rep-aapl")))
        }
    }

    @Test fun trailLoading() {
        renderScreen("name-trail-loading", heightDp = PhoneSpec.FULL_PAGE_HEIGHT_DP, themes = listOf(PreviewTheme.entries.first())) {
            Name(detail = NamesFixtures.detail.copy(notesTrail = emptyList(), isLoading = true))
        }
    }

    @Test fun notFollowed() { renderScreen("name-not-followed") { Name(following = false, pager = null) } }

    @Test fun loading() { renderScreen("name-loading") { Name(detail = null) } }

    @Test fun error() { renderScreen("name-error") { Name(detail = null, error = "The server did not answer in 20 seconds.") } }

    @Test fun scoreSource() {
        val info = monitorTiles(NamesFixtures.detail, NamesFixtures.lastVisitAtMs, NamesFixtures.now, NamesFixtures.fmt, ZoneOffset.UTC)[0].second
        renderScreen("name-source-score") { Name(seed = NameSeed(source = info)) }
    }

    @Test fun filingSource() {
        val info = filingsSource(filingsFigures(NamesFixtures.annual)!!, 2)
        renderScreen("name-source-margin") { Name(seed = NameSeed(source = info)) }
    }

    @Test fun removeConfirm() { renderScreen("name-remove-confirm") { Name(seed = NameSeed(confirmRemove = true)) } }

    @Test fun moreSheet() { renderScreen("name-more-sheet") { Name(seed = NameSeed(moreOpen = true)) } }
}
