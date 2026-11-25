package com.thesis.mobile.preview

import com.thesis.mobile.preview.fixtures.HomeState
import com.thesis.mobile.preview.fixtures.PulseState
import com.thesis.mobile.preview.fixtures.TodayDigest
import com.thesis.mobile.preview.fixtures.TodayHome
import com.thesis.mobile.preview.fixtures.TodayPulse
import com.thesis.mobile.ui.today.ChapterKind
import org.junit.Test

/**
 * Renders of the Today screens (WP-A, section 6.0 rule 6): Home, the Pulse brief and the Weekly digest in every
 * state, dark and light, plus 1.3x, 2.0x, the 360 dp phone and a full page. Fixed clock (Tue 24 Nov 2026, 07:15
 * New York). Run: render.sh '^today-'
 */
class TodayRenders {

    private val full = PhoneSpec.FULL_PAGE_HEIGHT_DP

    // ---- Home --------------------------------------------------------------------------------------------------

    @Test fun homeLoaded() { renderScreen("today-home-loaded") { TodayHome(HomeState.Loaded) } }
    @Test fun homeLoading() { renderScreen("today-home-loading") { TodayHome(HomeState.Loading) } }
    @Test fun homeEmpty() { renderScreen("today-home-empty") { TodayHome(HomeState.Empty) } }
    @Test fun homeError() { renderScreen("today-home-error") { TodayHome(HomeState.Error) } }
    @Test fun homeOffline() { renderScreen("today-home-offline") { TodayHome(HomeState.Offline) } }
    @Test fun homeScale13() { renderScreen("today-home-1_3x", fontScale = 1.3f, glow = false) { TodayHome() } }
    @Test fun homeScale20() { renderScreen("today-home-2_0x", fontScale = 2.0f, glow = false) { TodayHome() } }
    @Test fun homeNarrow() { renderScreen("today-home-360", widthDp = PhoneSpec.NARROW_WIDTH_DP, heightDp = 780, glow = false) { TodayHome() } }
    @Test fun homeNarrow20() { renderScreen("today-home-360-2_0x", widthDp = PhoneSpec.NARROW_WIDTH_DP, heightDp = 780, fontScale = 2.0f, glow = false) { TodayHome() } }
    @Test fun homeFull() { renderScreen("today-home-full", heightDp = full, glow = false) { TodayHome() } }

    // Motion (M1, M3): the first-open stagger at 0, 150, 250 and 400 ms (each fixture has its own entrance registry, so
    // the stagger plays in every render), and reduced motion (no stagger, nothing lost).
    @Test fun homeStagger0() { renderScreen("today-home-stagger-000", settleMs = 0, themes = listOf(PreviewTheme.DARK), glow = false) { TodayHome() } }
    @Test fun homeStagger150() { renderScreen("today-home-stagger-150", settleMs = 150, themes = listOf(PreviewTheme.DARK), glow = false) { TodayHome() } }
    @Test fun homeStagger250() { renderScreen("today-home-stagger-250", settleMs = 250, themes = listOf(PreviewTheme.DARK), glow = false) { TodayHome() } }
    @Test fun homeStagger400() { renderScreen("today-home-stagger-400", settleMs = 400, themes = listOf(PreviewTheme.DARK), glow = false) { TodayHome() } }
    @Test fun homeReduced() { renderScreen("today-home-reduced", settleMs = 150, reducedMotion = true, themes = listOf(PreviewTheme.DARK), glow = false) { TodayHome() } }

    // ---- Pulse -------------------------------------------------------------------------------------------------

    @Test fun pulseLoaded() { renderScreen("today-pulse-loaded") { TodayPulse(PulseState.Loaded) } }
    @Test fun pulseReal() { renderScreen("today-pulse-real", heightDp = full, glow = false) { TodayPulse(PulseState.Real) } }
    @Test fun pulseLoading() { renderScreen("today-pulse-loading") { TodayPulse(PulseState.Loading) } }
    @Test fun pulseEmpty() { renderScreen("today-pulse-empty") { TodayPulse(PulseState.Empty) } }
    @Test fun pulseError() { renderScreen("today-pulse-error") { TodayPulse(PulseState.Error) } }
    @Test fun pulseExporting() { renderScreen("today-pulse-exporting", settleMs = 600) { TodayPulse(PulseState.Exporting) } }
    @Test fun pulseScrolled() { renderScreen("today-pulse-scrolled") { TodayPulse(initialChapter = ChapterKind.Changed) } }
    @Test fun pulseScale13() { renderScreen("today-pulse-1_3x", fontScale = 1.3f, glow = false) { TodayPulse() } }
    @Test fun pulseScale20() { renderScreen("today-pulse-2_0x", fontScale = 2.0f, glow = false) { TodayPulse() } }
    @Test fun pulseNarrow() { renderScreen("today-pulse-360", widthDp = PhoneSpec.NARROW_WIDTH_DP, glow = false) { TodayPulse() } }
    @Test fun pulseFull() { renderScreen("today-pulse-full", heightDp = full, glow = false) { TodayPulse() } }
    @Test fun pulseStale() { renderScreen("today-pulse-stale") { TodayPulse(PulseState.Stale) } }
    // The brief's tail: Watch, Headlines and Sources (coverage notes, qualified source rows).
    @Test fun pulseTailRich() { renderScreen("today-pulse-tail-rich", glow = false) { TodayPulse(initialChapter = ChapterKind.Headlines) } }
    @Test fun pulseTailReal() { renderScreen("today-pulse-tail-real", glow = false) { TodayPulse(PulseState.Real, initialChapter = ChapterKind.Changed) } }
    @Test fun pulseSourcesReal() { renderScreen("today-pulse-sources-real", heightDp = full, glow = false) { TodayPulse(PulseState.Real, initialChapter = ChapterKind.Sources) } }
    @Test fun pulseWatch360x2() {
        renderScreen("today-pulse-watch-360-2_0x", widthDp = PhoneSpec.NARROW_WIDTH_DP, fontScale = 2.0f, glow = false) {
            TodayPulse(initialChapter = ChapterKind.Watch)
        }
    }

    @Test fun pulseStagger0() { renderScreen("today-pulse-stagger-000", settleMs = 0, themes = listOf(PreviewTheme.DARK), glow = false) { TodayPulse() } }
    @Test fun pulseStagger150() { renderScreen("today-pulse-stagger-150", settleMs = 150, themes = listOf(PreviewTheme.DARK), glow = false) { TodayPulse() } }
    @Test fun pulseStagger250() { renderScreen("today-pulse-stagger-250", settleMs = 250, themes = listOf(PreviewTheme.DARK), glow = false) { TodayPulse() } }
    @Test fun pulseStagger400() { renderScreen("today-pulse-stagger-400", settleMs = 400, themes = listOf(PreviewTheme.DARK), glow = false) { TodayPulse() } }
    @Test fun pulseReduced() { renderScreen("today-pulse-reduced", settleMs = 150, reducedMotion = true, themes = listOf(PreviewTheme.LIGHT), glow = false) { TodayPulse() } }

    // ---- Weekly digest -----------------------------------------------------------------------------------------

    @Test fun digestLoaded() { renderScreen("today-digest-loaded") { TodayDigest() } }
    @Test fun digestEmpty() { renderScreen("today-digest-empty") { TodayDigest(empty = true) } }
    @Test fun digestLoading() { renderScreen("today-digest-loading") { TodayDigest(empty = true, loading = true) } }
    // A pushed screen arrives whole: the first frame already shows the header and KPIs under the bar (no stagger, no jump).
    @Test fun digestFirstFrame() { renderScreen("today-digest-frame-000", settleMs = 0, themes = listOf(PreviewTheme.DARK), glow = false) { TodayDigest() } }
    @Test fun digestScale13() { renderScreen("today-digest-1_3x", fontScale = 1.3f, glow = false) { TodayDigest() } }
    @Test fun digestScale20() { renderScreen("today-digest-2_0x", fontScale = 2.0f, glow = false) { TodayDigest() } }
    @Test fun digestNarrow() { renderScreen("today-digest-360", widthDp = PhoneSpec.NARROW_WIDTH_DP, glow = false) { TodayDigest() } }
    @Test fun digestFull() { renderScreen("today-digest-full", heightDp = full, glow = false) { TodayDigest() } }
}
