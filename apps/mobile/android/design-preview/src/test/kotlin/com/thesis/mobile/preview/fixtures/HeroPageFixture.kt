package com.thesis.mobile.preview.fixtures

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.thesis.mobile.ui.components.Eyebrow
import com.thesis.mobile.ui.components.HeroBand
import com.thesis.mobile.ui.components.ScreenHeader
import com.thesis.mobile.ui.shell.HeroUnderBars
import com.thesis.mobile.ui.shell.ShellPlatform
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType

/**
 * A shell entry that opens on a HeroBand under the status bar and the shell's top bar (2.7 "HeroBand screens
 * rule"), for the shell's hero tests and renders until PR-3's screens call [HeroUnderBars] themselves. It stands
 * in for Today's sample slot, so a new account's Today (no names, no reports) shows it under the root bar.
 */
@Composable
fun HeroPageFixture(padding: PaddingValues) {
    HeroUnderBars()
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = padding.calculateBottomPadding())) {
        item {
            HeroBand(underTopBar = true) {
                Eyebrow("Pulse · 24 Nov")
                Text("Pre-market", style = ThesisType.display, color = LocalThesisPalette.current.ink)
                Text(
                    "Stocks edged higher as yields eased; credit spreads were steady.",
                    style = ThesisType.heroLine,
                    color = LocalThesisPalette.current.ink2
                )
            }
        }
        items(40) { row ->
            Text(
                "Row ${row + 1}: rates, credit and the tape, one line each.",
                modifier = Modifier.padding(horizontal = ThesisSpace.gutter, vertical = ThesisSpace.m),
                style = ThesisType.body,
                color = LocalThesisPalette.current.ink
            )
        }
    }
}

/** Stand-in for the Android-only `SampleDeepDiveScreen` in Today's sample slot (headline, deck, a few lines). */
@Composable
fun SamplePageFixture(padding: PaddingValues) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = padding) {
        item {
            ScreenHeader(
                title = "A sample Deep Dive",
                modifier = Modifier.padding(horizontal = ThesisSpace.gutter, vertical = ThesisSpace.l),
                eyebrow = "Sample · AAPL",
                deck = "What a finished report looks like before you follow your first name."
            )
        }
        items(12) { row ->
            Text(
                "Chapter ${row + 1}: the thesis, the numbers and what would change the call.",
                modifier = Modifier.padding(horizontal = ThesisSpace.gutter, vertical = ThesisSpace.m),
                style = ThesisType.body,
                color = LocalThesisPalette.current.ink
            )
        }
    }
}

/** Today's state for a new account (no names, no reports): Today's root shows the sample slot. */
val newAccountState = ShellFixtures.state.copy(
    watchlist = emptyList(),
    watchlistLoaded = true,
    reportHistory = emptyList(),
    reportHistoryLoaded = true
)

/** A platform whose sample slot is [HeroPageFixture]; [onStatusBarOverHero] records the shell's status bar calls. */
fun heroPlatform(onStatusBarOverHero: (Boolean) -> Unit = {}) = ShellPlatform(
    sampleDeepDive = { padding, _, _ -> HeroPageFixture(padding) },
    onStatusBarOverHero = onStatusBarOverHero
)
