package com.thesis.mobile.preview

import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathMeasure
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.components.ChapterPills
import com.thesis.mobile.ui.components.DataRow
import com.thesis.mobile.ui.components.Eyebrow
import com.thesis.mobile.ui.components.KpiGrid
import com.thesis.mobile.ui.components.KpiSpec
import com.thesis.mobile.ui.components.LiveDot
import com.thesis.mobile.ui.components.LoadingHairline
import com.thesis.mobile.ui.components.RowGroup
import com.thesis.mobile.ui.components.RowPosition
import com.thesis.mobile.ui.components.ScreenHeader
import com.thesis.mobile.ui.components.SectionHeader
import com.thesis.mobile.ui.components.SegmentedControl
import com.thesis.mobile.ui.components.SkeletonCard
import com.thesis.mobile.ui.components.ThesisCard
import com.thesis.mobile.ui.components.TickerRow
import com.thesis.mobile.ui.components.rowGroupSegment
import com.thesis.mobile.ui.motion.ContainerTransformHost
import com.thesis.mobile.ui.motion.DismissibleItem
import com.thesis.mobile.ui.motion.EntranceRegistry
import com.thesis.mobile.ui.motion.ProvideEntranceScope
import com.thesis.mobile.ui.motion.RefreshHairline
import com.thesis.mobile.ui.motion.RollingNumber
import com.thesis.mobile.ui.motion.ShimmerHost
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.motion.ThesisRefreshBox
import com.thesis.mobile.ui.motion.ThesisTransitions
import com.thesis.mobile.ui.motion.captureBounds
import com.thesis.mobile.ui.motion.rememberBoundsCapture
import com.thesis.mobile.ui.motion.rememberDrawOn
import com.thesis.mobile.ui.motion.rememberEntranceCoordinator
import com.thesis.mobile.ui.motion.rememberHairlinePhase
import com.thesis.mobile.ui.motion.rememberScrollSpy
import com.thesis.mobile.ui.motion.rewardPulse
import com.thesis.mobile.ui.motion.shimmerSweep
import com.thesis.mobile.ui.motion.staggeredEntrance
import com.thesis.mobile.ui.theme.Kit
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisShape
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone
import org.junit.Test
import java.io.File

/**
 * Motion kit renders (docs/app-redesign/DESIGN-DIRECTION.md 4, 6.2 M1): every motion at `settleMs = 0` (first
 * frame), one or two mid frames and its end, plus a reduced-motion render, in both themes. Changes are triggered
 * on the first frame (LaunchedEffect), so t000 shows the "before" state. Frames step 10 ms here so mid frames land
 * where named.
 *
 * Run: gradle -p design-preview test -PrendersOnly -Pscreens.only='^kit-motion'
 * PNGs: kit-motion-<name>-t<ms>-<dark|light>.png and kit-motion-<name>-reduced-<dark|light>.png
 */
class MotionRenders {

    // ---- Entrance --------------------------------------------------------------------------------------------

    @Test
    fun entrance() = frames("entrance", listOf(0, 70, 160, 300, 700)) { HomeLikeEntrance() }

    @Composable
    private fun HomeLikeEntrance() {
        // A fresh registry per render: the global fallback would (correctly) refuse to replay in the second theme.
        val registry = remember { EntranceRegistry() }
        ProvideEntranceScope(registry, "today-root") {
            val coordinator = rememberEntranceCoordinator(resetKey = "pulse-2025-11-24")
            Column(Modifier.padding(ThesisSpace.gutter), verticalArrangement = Arrangement.spacedBy(ThesisSpace.xxl)) {
                Column(Modifier.staggeredEntrance("header", coordinator)) {
                    ScreenHeader(title = "Good morning", eyebrow = "Today · Mon 24 Nov", deck = "Markets were mixed before the open.")
                }
                Column(Modifier.staggeredEntrance("names", coordinator)) {
                    SectionHeader(kicker = "Your names", headline = "2 of your names need a review")
                }
                ThesisCard(Modifier.staggeredEntrance("pulse", coordinator), eyebrow = "PULSE", title = "Rates eased; tech led the tape") {
                    Text("Three things moved your names overnight.", style = ThesisType.body, color = LocalThesisPalette.current.ink2)
                }
                ThesisCard(Modifier.staggeredEntrance("macro", coordinator), eyebrow = "MACRO STRESS", title = "Balanced and rising") {
                    Text("58 on the 0 to 100 scale, up 4 since Tue.", style = ThesisType.body, color = LocalThesisPalette.current.ink2)
                }
            }
        }
    }

    // ---- RollingNumber -----------------------------------------------------------------------------------------

    @Test
    fun rolling() = frames("rolling", listOf(0, 90, 180, 300, 600), heightDp = 900) { RollingSpecimens() }

    @Composable
    private fun RollingSpecimens() {
        val p = LocalThesisPalette.current
        var score by remember { mutableDoubleStateOf(41.0) }
        var big by remember { mutableDoubleStateOf(1204.0) }
        var delta by remember { mutableIntStateOf(4) }
        var pct by remember { mutableDoubleStateOf(12.5) }
        var count by remember { mutableIntStateOf(3) }
        LaunchedEffect(Unit) {
            score = 58.0
            big = 998.0
            delta = -3
            pct = 13.1
            count = 12
        }
        Column(Modifier.padding(ThesisSpace.gutter), verticalArrangement = Arrangement.spacedBy(ThesisSpace.l)) {
            Caption("Macro stress after a refresh: 41 → 58, digits roll up (serif headline figure)")
            RollingNumber(score, { it.toInt().toString() }, ThesisType.capped(ThesisType.display), color = p.ink)
            Caption("Scenario loss: 1,204 → 998, rolls down, a column leaves and the width glides")
            RollingNumber(big, { "%,d".format(java.util.Locale.US, it.toInt()) }, ThesisType.statValue, color = p.ink)
            Caption("Monitor delta: +4 → −3, the sign crossfades (it never rolls)")
            RollingNumber(delta, { if (it >= 0) "+$it" else "−${-it}" }, ThesisType.statValue, color = p.ink)
            Caption("Share: 12.5% → 13.1%, only the changed digits move")
            RollingNumber(pct, { "%.1f%%".format(java.util.Locale.US, it) }, ThesisType.statValue, color = p.ink)
            Caption("Inbox count in a sentence: 3 → 12 new")
            Row(verticalAlignment = Alignment.Bottom) {
                RollingNumber(count, { "$it" }, ThesisType.body, color = p.ink)
                Text(" new alerts since Tue", style = ThesisType.body, color = p.ink2)
            }
        }
    }

    // ---- Transitions: StateCrossfade, shared axis X ------------------------------------------------------------

    @Test
    fun stateCrossfade() = frames("state-crossfade", listOf(0, 80, 160, 400)) {
        var ready by remember { mutableStateOf(false) }
        LaunchedEffect(Unit) { ready = true }
        val reduced = com.thesis.mobile.ui.theme.LocalReducedMotion.current
        Column(Modifier.padding(ThesisSpace.gutter)) {
            Caption("Loading → Ready: out Quick EaseExit, in Base after 60 ms, size on spatial")
            AnimatedContent(ready, transitionSpec = { ThesisTransitions.stateCrossfade(reduced) }, label = "state") { r ->
                if (r) {
                    KpiGrid(
                        listOf(
                            KpiSpec("Revenue, FY2025", "$391B", "+2.0%", Tone.Favourable, "vs FY2024"),
                            KpiSpec("Operating margin, FY2025", "31.5%", "+1.2 pts", Tone.Favourable, "vs FY2024"),
                        ),
                    )
                } else {
                    SkeletonCard(bodyLines = 2)
                }
            }
        }
    }

    @Test
    fun sharedAxisX() = frames("push", listOf(0, 60, 150, 400), heightDp = 520) {
        var page by remember { mutableIntStateOf(0) }
        LaunchedEffect(Unit) { page = 1 }
        val reduced = com.thesis.mobile.ui.theme.LocalReducedMotion.current
        val shift = with(LocalDensity.current) { ThesisMotion.PushOffset.roundToPx() }
        AnimatedContent(
            page,
            Modifier.fillMaxWidth().height(480.dp),
            transitionSpec = { ThesisTransitions.sharedAxisX(forward = targetState > initialState, reduced = reduced, shiftPx = shift) },
            label = "push",
        ) { pg ->
            val p = LocalThesisPalette.current
            Column(Modifier.fillMaxSize().background(p.bg).padding(ThesisSpace.gutter)) {
                if (pg == 0) {
                    ScreenHeader(title = "Research", eyebrow = "Research")
                    Spacer(Modifier.height(ThesisSpace.l))
                    DataRow("History", "24 reports")
                } else {
                    ScreenHeader(title = "History", eyebrow = "Research", deck = "Every report you opened or built.")
                    Spacer(Modifier.height(ThesisSpace.l))
                    DataRow("AAPL 10-K FY2025", "23 days ago")
                }
            }
        }
    }

    // ---- Container transform ------------------------------------------------------------------------------------

    @Test
    fun containerTransform() = frames("transform", listOf(0, 60, 120, 180, 400), heightDp = 700, fit = false) {
        var open by remember { mutableStateOf<String?>(null) }
        val rowBounds = rememberBoundsCapture()
        LaunchedEffect(Unit) {
            androidx.compose.runtime.withFrameMillis { }
            open = "MSFT"
        }
        ContainerTransformHost(
            openKey = open,
            origin = rowBounds.boundsInRoot(),
            onClose = { open = null },
            cornerFrom = 0.dp,
            list = {
                Column(Modifier.fillMaxSize().padding(ThesisSpace.gutter)) {
                    ScreenHeader(title = "Names", eyebrow = "Names")
                    Spacer(Modifier.height(ThesisSpace.l))
                    RowGroup {
                        row { TickerRow("AAPL", Tone.Favourable, {}, company = "Apple", line2 = "Intact", figure = "72", figureCaption = "+3 since Tue") }
                        row {
                            TickerRow(
                                "MSFT", Tone.Attention, {}, Modifier.captureBounds(rowBounds), company = "Microsoft",
                                line2 = "Intact → Watch, Tue", figure = "61", figureCaption = "−5 since Tue", figureCaptionTone = Tone.Unfavourable,
                            )
                        }
                        row { TickerRow("NVDA", Tone.Favourable, {}, company = "Nvidia", line2 = "Intact", figure = "80", figureCaption = "+1 since Tue") }
                    }
                }
            },
            detail = { key ->
                val p = LocalThesisPalette.current
                Column(Modifier.fillMaxSize().background(p.bg).padding(ThesisSpace.gutter)) {
                    ScreenHeader(title = "Microsoft", eyebrow = key, deck = "Intact → Watch since Tue: cloud growth slowed for a second quarter.")
                    Spacer(Modifier.height(ThesisSpace.l))
                    KpiGrid(
                        listOf(
                            KpiSpec("Revenue, FY2025", "$282B", "+15%", Tone.Favourable, "vs FY2024"),
                            KpiSpec("Monitor score", "61", "−5", Tone.Unfavourable, "since Tue"),
                        ),
                    )
                }
            },
        )
    }

    // ---- DismissibleItem ---------------------------------------------------------------------------------------

    @Test
    fun dismiss() = frames("dismiss", listOf(0, 80, 160, 400), heightDp = 420) {
        var removing by remember { mutableStateOf(false) }
        LaunchedEffect(Unit) {
            // Lazy items compose in the measure pass, after this effect starts: wait until they have been drawn
            // once, so t000 shows the row before it leaves (DismissibleItem never animates its first paint).
            androidx.compose.runtime.withFrameMillis { }
            androidx.compose.runtime.withFrameMillis { }
            removing = true
        }
        val tickers = listOf("AAPL" to "Apple", "MSFT" to "Microsoft", "NVDA" to "Nvidia", "ASML" to "ASML Holding")
        LazyColumn(Modifier.fillMaxWidth().height(400.dp).padding(ThesisSpace.gutter)) {
            tickers.forEachIndexed { i, (t, c) ->
                item(key = t) {
                    // The segment (card surface) goes on DismissibleItem's modifier: it closes up with the row,
                    // while only the row's content fades, so no page background shows through the card.
                    DismissibleItem(
                        removing = removing && t == "MSFT",
                        onRemoved = {},
                        modifier = Modifier.rowGroupSegment(RowPosition.of(i, tickers.size)),
                    ) {
                        TickerRow(t, Tone.Neutral, {}, company = c, line2 = "Intact", figure = "70")
                    }
                }
            }
        }
    }

    // ---- Refresh -----------------------------------------------------------------------------------------------

    @Test
    fun refreshLine() = frames("refresh-line", listOf(0, 560, 1120, 1690)) {
        val phase = rememberHairlinePhase(active = true)
        Column(Modifier.padding(vertical = ThesisSpace.l), verticalArrangement = Arrangement.spacedBy(ThesisSpace.xxl)) {
            Caption("Pulled 40%: grows from the centre in ink", Modifier.padding(horizontal = ThesisSpace.gutter))
            RefreshHairline({ 0.4f }, refreshing = false, phase = phase)
            Caption("Pulled 80%", Modifier.padding(horizontal = ThesisSpace.gutter))
            RefreshHairline({ 0.8f }, refreshing = false, phase = phase)
            Caption("Armed: complete, accent (threshold haptic)", Modifier.padding(horizontal = ThesisSpace.gutter))
            RefreshHairline({ 1.1f }, refreshing = false, phase = phase)
            Caption("Refreshing: the highlight travels (static under reduced motion)", Modifier.padding(horizontal = ThesisSpace.gutter))
            RefreshHairline({ 0f }, refreshing = true, phase = phase)
            Caption("LoadingHairline (kit), same loop under a ScreenHeader", Modifier.padding(horizontal = ThesisSpace.gutter))
            LoadingHairline(active = true, modifier = Modifier.padding(horizontal = ThesisSpace.gutter))
        }
    }

    @Test
    fun refreshBox() = frames("refresh-box", listOf(0, 120, 400, 1200), heightDp = 360, fit = false) {
        ThesisRefreshBox(refreshing = true, onRefresh = {}) {
            Column(Modifier.fillMaxWidth().padding(ThesisSpace.gutter)) {
                ScreenHeader(title = "Macro stress", eyebrow = "Today", meta = "Updated 07:42")
                Spacer(Modifier.height(ThesisSpace.l))
                RowGroup {
                    row { DataRow("Stress score", "58", delta = "+4", deltaTone = Tone.Unfavourable, sub = "0 to 100, vs Tue") }
                    row { DataRow("Regime", "Balanced") }
                }
            }
        }
    }

    // ---- Shimmer and loops -------------------------------------------------------------------------------------

    @Test
    fun shimmer() = frames("shimmer", listOf(0, 600 + 350, 600 + 700, 600 + 1050)) {
        val p = LocalThesisPalette.current
        ShimmerHost {
            Column(Modifier.padding(ThesisSpace.gutter), verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
                Caption("One light across every block (root coordinates), 1400 ms sweep + 600 ms rest")
                Column(
                    Modifier.fillMaxWidth().clip(ThesisShape.card).background(p.surface).padding(ThesisSpace.cardPadding),
                    verticalArrangement = Arrangement.spacedBy(ThesisSpace.cardInnerGap),
                ) {
                    Block(0.25f, ThesisSpace.m)
                    Block(0.8f, ThesisSpace.xl)
                    Block(1f, ThesisSpace.m)
                    Block(0.6f, ThesisSpace.m)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
                    repeat(2) {
                        Column(Modifier.weight(1f).clip(ThesisShape.panel).background(p.surface).padding(ThesisSpace.m)) {
                            Block(0.6f, ThesisSpace.m)
                            Spacer(Modifier.height(ThesisSpace.s))
                            Block(0.5f, ThesisSpace.xxl)
                        }
                    }
                }
            }
        }
    }

    @Composable
    private fun Block(fraction: Float, height: androidx.compose.ui.unit.Dp) {
        val p = LocalThesisPalette.current
        Box(Modifier.fillMaxWidth(fraction).height(height).clip(ThesisShape.badge).background(p.surface2).shimmerSweep())
    }

    @Test
    fun liveDot() = frames("live-dot", listOf(0, 1000, 2000)) {
        Row(Modifier.padding(ThesisSpace.gutter), verticalAlignment = Alignment.CenterVertically) {
            LiveDot()
            Spacer(Modifier.width(ThesisSpace.s))
            Text("War Room · Live", style = ThesisType.label, color = LocalThesisPalette.current.ink)
        }
    }

    // ---- Selection: SegmentedControl glide, ChapterPills scroll-spy -------------------------------------------

    @Test
    fun segmented() = frames("segmented", listOf(0, 40, 90, 400)) {
        var selected by remember { mutableIntStateOf(0) }
        LaunchedEffect(Unit) { selected = 2 }
        Column(Modifier.padding(ThesisSpace.gutter)) {
            Caption("Indicator glides on spatial (no overshoot); labels follow its position")
            SegmentedControl(listOf("1M", "6M", "1Y"), selected, { selected = it })
        }
    }

    @Test
    fun scrollSpy() = frames("scroll-spy", listOf(0, 400), heightDp = 560, fit = false) {
        val list = rememberLazyListState(initialFirstVisibleItemIndex = 7)
        val chapters = listOf("I · Verdict", "II · Business", "III · Numbers", "IV · Risks")
        val starts = listOf(0, 6, 12, 18)
        val spy = rememberScrollSpy(list, starts)
        val p = LocalThesisPalette.current
        Column(Modifier.fillMaxSize()) {
            ChapterPills(chapters, spy.selected, spy::jumpTo)
            LazyColumn(Modifier.fillMaxSize(), state = list) {
                items(24) { i ->
                    val chapter = starts.indexOfLast { it <= i }
                    if (i in starts) {
                        Eyebrow("Chapter ${chapter + 1}", Modifier.padding(horizontal = ThesisSpace.gutter, vertical = ThesisSpace.m))
                    } else {
                        Text(
                            "${chapters[chapter]} · paragraph ${i - starts[chapter]}",
                            Modifier.fillMaxWidth().height(64.dp).padding(horizontal = ThesisSpace.gutter),
                            style = ThesisType.body,
                            color = p.ink2,
                        )
                    }
                }
            }
        }
    }

    // ---- StageProgress motion: ring fill, check draw-on, reward pulse ----------------------------------------

    @Test
    fun stage() = frames("stage", listOf(0, 80, 160, 260, 600)) {
        var done by remember { mutableStateOf(false) }
        LaunchedEffect(Unit) { done = true }
        val p = LocalThesisPalette.current
        val fill by rememberDrawOn(done)
        Column(Modifier.padding(ThesisSpace.gutter), verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
            Caption("Final stage completes: ring fills, check draws on (Base, EaseCalm), one reward pulse")
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.size(Kit.stageRing * 2).rewardPulse(done).drawBehind {
                        val stroke = Kit.ringStroke.toPx()
                        val r = size.minDimension / 2f
                        drawCircle(p.accent, r - stroke / 2f, style = Stroke(stroke))
                        drawCircle(p.accent, r * fill)
                        val check = Path().apply {
                            moveTo(size.width * 0.27f, size.height * 0.52f)
                            lineTo(size.width * 0.44f, size.height * 0.68f)
                            lineTo(size.width * 0.74f, size.height * 0.34f)
                        }
                        val measure = PathMeasure().apply { setPath(check, false) }
                        val part = Path()
                        measure.getSegment(0f, measure.length * fill, part, true)
                        drawPath(part, p.surface, style = Stroke(stroke * 1.5f, cap = StrokeCap.Round))
                    },
                )
                Spacer(Modifier.width(ThesisSpace.m))
                Text("Report ready", style = ThesisType.body, color = p.ink)
            }
        }
    }

    // ---- Helpers ------------------------------------------------------------------------------------------------

    @Composable
    private fun Caption(text: String, modifier: Modifier = Modifier) {
        Text(text, modifier, style = ThesisType.caption, color = LocalThesisPalette.current.muted)
    }

    /**
     * Renders [content] at each of [settleMs] (kit-motion-<name>-t<ms>) and once more with reduced motion at the
     * last value (kit-motion-<name>-reduced). [fit] crops to the content height (galleries); full-size otherwise.
     */
    private fun frames(
        name: String,
        settleMs: List<Int>,
        heightDp: Int = 1_200,
        fit: Boolean = true,
        content: @Composable () -> Unit,
    ) {
        val out = mutableListOf<File>()
        settleMs.forEach { ms ->
            out += renderScreen(
                name = "kit-motion-$name-t${ms.toString().padStart(3, '0')}",
                heightDp = heightDp,
                settleMs = ms.toLong(),
                frameMs = FRAME_MS,
                glow = false,
                reducedMotion = false,
                fitHeight = fit,
                content = content,
            )
        }
        out += renderScreen(
            name = "kit-motion-$name-reduced",
            heightDp = heightDp,
            settleMs = settleMs.last().toLong(),
            frameMs = FRAME_MS,
            glow = false,
            reducedMotion = true,
            fitHeight = fit,
            content = content,
        )
    }

    private companion object {
        const val FRAME_MS = 10L
    }
}
