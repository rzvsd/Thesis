package com.thesis.mobile.preview

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.components.CardFooter
import com.thesis.mobile.ui.components.ChipRow
import com.thesis.mobile.ui.components.Eyebrow
import com.thesis.mobile.ui.components.HeroBand
import com.thesis.mobile.ui.components.KpiGrid
import com.thesis.mobile.ui.components.KpiSpec
import com.thesis.mobile.ui.components.PrimaryButton
import com.thesis.mobile.ui.components.SecondaryButton
import com.thesis.mobile.ui.components.SectionHeader
import com.thesis.mobile.ui.components.StatusBadge
import com.thesis.mobile.ui.components.ThesisCard
import com.thesis.mobile.ui.components.ThesisChip
import com.thesis.mobile.ui.components.ThesisIconButton
import com.thesis.mobile.ui.components.ThesisScreen
import com.thesis.mobile.ui.components.ThesisSwitch
import com.thesis.mobile.ui.components.ThesisTextField
import com.thesis.mobile.ui.components.ThesisTopBar
import com.thesis.mobile.ui.components.Upshot
import com.thesis.mobile.ui.components.ledeText
import com.thesis.mobile.ui.components.rememberTopBarCollapsed
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone
import org.junit.Test

/**
 * Kit component renders (section 3): every component and state, both themes, at 1.0x, 1.3x and 2.0x font scale,
 * plus the HeroBand screen at rest and collapsed and the kit inside a HeroBand.
 *
 * Run: -PrendersOnly -Pscreens.only='^kit-'   (PNGs: kit-<sheet>[-fs130|-fs200]-dark.png / -light.png)
 */
class KitComponentRenders {

    private fun sheet(name: String, fontScale: Float = 1f, widthDp: Int = PhoneSpec.WIDTH_DP) {
        val suffix = when (fontScale) {
            1f -> ""
            else -> "-fs" + (fontScale * 100).toInt()
        }
        val narrow = if (widthDp == PhoneSpec.NARROW_WIDTH_DP) "-360" else ""
        renderGallery("kit-$name$narrow$suffix", widthDp = widthDp, fontScale = fontScale, maxHeightDp = 7_000) {
            KitComponentSheets.all.getValue(name)(this)
        }
    }

    @Test fun atoms() = sheet("atoms")
    @Test fun buttons() = sheet("buttons")
    @Test fun headers() = sheet("headers")
    @Test fun chips() = sheet("chips")
    @Test fun cards() = sheet("cards")
    @Test fun data() = sheet("data")
    @Test fun controls() = sheet("controls")
    @Test fun overlays() = sheet("overlays")
    @Test fun bars() = sheet("bars")
    @Test fun loading() = sheet("loading")
    @Test fun report() = sheet("report")

    @Test fun scaled130() = KitComponentSheets.all.keys.forEach { sheet(it, fontScale = 1.3f) }
    @Test fun scaled200() = KitComponentSheets.all.keys.forEach { sheet(it, fontScale = 2.0f, widthDp = PhoneSpec.NARROW_WIDTH_DP) }

    @Test
    fun heroKit() {
        renderGallery("kit-hero-components") {
            Specimen("Kit inside HeroBand", "eyebrow rule, featured KPI grid, buttons, chips, switch, field") {
                HeroBand {
                    Eyebrow("Morning pulse · Tue 24 Nov")
                    Text("Rates eased; your names are calm.", style = ThesisType.title, color = LocalThesisPalette.current.ink)
                    KpiGrid(heroKpis, featured = true)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        ThesisChip("Overview", true, {})
                        ThesisChip("Markets", false, {})
                        StatusBadge("Calm", Tone.Favourable)
                    }
                    PrimaryButton("Open the brief", {})
                    SecondaryButton("Not now", {})
                    Row { ThesisSwitch(true, {}); ThesisSwitch(false, {}) }
                    ThesisTextField("you@example.com", {}, "Email")
                }
            }
        }
    }

    @Test
    fun heroScreenAtRest() {
        renderScreen("kit-heroband-screen-rest", glow = true) { HeroScreen(scrolled = false) }
    }

    @Test
    fun heroScreenCollapsed() {
        renderScreen("kit-heroband-screen-collapsed", glow = true) { HeroScreen(scrolled = true) }
    }
}

private val heroKpis = listOf(
    KpiSpec("S&P 500", "5,948.71", "+0.4%", Tone.Favourable, "vs close"),
    KpiSpec("10Y yield", "4.21%", "−3 bps", Tone.Neutral, "vs close"),
    KpiSpec("Macro stress", "58", "+6", Tone.Unfavourable, "vs 7 days ago"),
    KpiSpec("VIX", "14.2", "−0.8", Tone.Favourable, "vs close"),
)

/** A HeroBand screen (Pulse-like) for the "at rest / collapsed" pair: the band runs under the top bar. */
@Composable
private fun HeroScreen(scrolled: Boolean) {
    val list = rememberLazyListState()
    LaunchedEffect(scrolled) { if (scrolled) list.scrollToItem(0, HERO_SCROLL_PX) }
    val collapsed by rememberTopBarCollapsed(list)
    ThesisScreen(
        collapsed = collapsed,
        topBar = {
            ThesisTopBar(
                title = "Pulse",
                onBack = {},
                collapsed = collapsed,
                overHero = true,
                actions = { ThesisIconButton(ThesisIcons.Share, "Share", {}) },
            )
        },
    ) { padding ->
        LazyColumn(state = list, contentPadding = PaddingValues(bottom = padding.calculateBottomPadding() + ThesisSpace.x3)) {
            item {
                HeroBand(underTopBar = true) {
                    Eyebrow("Morning pulse · Tue 24 Nov")
                    Text("Rates eased overnight; your names are calm.", style = ThesisType.title, color = LocalThesisPalette.current.ink)
                    KpiGrid(heroKpis, featured = true)
                }
            }
            item {
                SectionHeader("Your names", "Two need a look", Modifier.padding(ThesisSpace.gutter))
            }
            item {
                ThesisCard(
                    Modifier.padding(horizontal = ThesisSpace.gutter),
                    eyebrow = "AAPL · Earnings Thursday",
                    title = "Services still carry the margin",
                    footer = CardFooter("10-K FY2025", "Open report", {}),
                ) {
                    Text("Consensus expects EPS of $1.60. Your note flags China.", style = ThesisType.body, color = LocalThesisPalette.current.ink2)
                }
            }
            item {
                Upshot(
                    ledeText("Nothing to do today.", " Both flags are known risks already in your notes.", LocalThesisPalette.current),
                    Modifier.padding(ThesisSpace.gutter),
                )
            }
            item {
                ChipRow { item { ThesisChip("All", true, {}) }; item { ThesisChip("Markets", false, {}) } }
            }
            items(listOf("MSFT · Cloud growth is slowing", "NVDA · Supply is the constraint", "AMZN · Retail margins recover")) { line ->
                ThesisCard(
                    Modifier.padding(horizontal = ThesisSpace.gutter, vertical = ThesisSpace.s),
                    eyebrow = line.substringBefore(" · "),
                    title = line.substringAfter(" · "),
                )
            }
        }
    }
}

private const val HERO_SCROLL_PX = 420
