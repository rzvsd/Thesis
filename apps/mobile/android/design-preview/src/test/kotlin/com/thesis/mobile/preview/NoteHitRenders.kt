package com.thesis.mobile.preview

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import com.thesis.mobile.preview.fixtures.NamesFixtures
import com.thesis.mobile.ui.screens.NameAnchor
import com.thesis.mobile.ui.screens.NameScreen
import org.junit.Test

/**
 * A note search hit's landing (5.27, PR-4b WP-K): Name scrolled to the matched trail entry (the oldest AAPL note,
 * opened whole), with the accent rule in the gutter while it holds (`-mark`, 600 ms in), and after it has faded.
 * Reduced motion: no scroll animation, the rule crossfades. Run: render.sh '^name-note-hit'
 */
class NoteHitRenders {

    @Composable
    private fun Hit(noteKey: String? = "rep-aapl-2025") {
        NamesFixtures.Clocked {
            NameScreen(
                padding = PaddingValues(top = 24.dp),
                ticker = "AAPL",
                detail = NamesFixtures.detail,
                following = true,
                companyName = NamesFixtures.companyNames["AAPL"],
                lastVisitAtMs = NamesFixtures.lastVisitAtMs,
                isPro = true,
                journal = NamesFixtures.journal,
                now = NamesFixtures.now,
                scrollTo = NameAnchor.Notes,
                noteKey = noteKey,
                onBack = {},
            )
        }
    }

    @Test fun mark() { renderScreen("name-note-hit-mark", settleMs = 600) { Hit() } }

    @Test fun settled() { renderScreen("name-note-hit") { Hit() } }

    @Test fun reduced() { renderScreen("name-note-hit-reduced", reducedMotion = true, settleMs = 600) { Hit() } }

    @Test fun narrowLarge() { renderScreen("name-note-hit-360-fs200", widthDp = PhoneSpec.NARROW_WIDTH_DP, fontScale = 2.0f, settleMs = 600) { Hit() } }

    /** The newest entry (the editor) as the hit. */
    @Test fun newest() { renderScreen("name-note-hit-newest-mark", settleMs = 600) { Hit("rep-aapl") } }
}
