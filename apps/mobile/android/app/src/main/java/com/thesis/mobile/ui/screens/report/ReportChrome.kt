package com.thesis.mobile.ui.screens.report

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.unit.Dp
import com.thesis.mobile.ui.components.BannerTone
import com.thesis.mobile.ui.components.DockItem
import com.thesis.mobile.ui.components.HeroBand
import com.thesis.mobile.ui.components.HeroBandPadding
import com.thesis.mobile.ui.components.InlineBanner
import com.thesis.mobile.ui.components.ReportDock
import com.thesis.mobile.ui.components.ReportTopBar
import com.thesis.mobile.ui.components.SkeletonBlock
import com.thesis.mobile.ui.components.SkeletonHero
import com.thesis.mobile.ui.components.SkeletonText
import com.thesis.mobile.ui.copy.ReportCopy
import com.thesis.mobile.ui.motion.ShimmerHost
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.shell.exceptTop
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType

/*
 * The report host's chrome (docs/app-redesign/DESIGN-DIRECTION.md 5.13): one bar ([ReportTopBar], the page has no
 * app bar of its own in embed mode), the page, the loading skeleton with its progress hairline, and the dock. The
 * page itself is a slot, so the frame renders in design-preview without a WebView.
 */

/** Progress (0..100) of a page load the host knows nothing about yet. */
const val PAGE_PROGRESS_UNKNOWN = 0

/**
 * The open report: [ReportTopBar] on `surface` (running under the status bar), then the [page] filling the rest,
 * the dock floating over it and [overlays] (the notes and feedback panels) on top.
 *
 * While [pageLoaded] is false the page area shows [ReportPageSkeleton] (the hero in the hero palette, as the page
 * opens) with a 2 dp accent hairline at its top that follows [progress]; when the page finishes, the skeleton
 * fades away over `Base`, so the page crossfades in without a jump. The dock appears with the page.
 *
 * [padding] is the shell's padding for the entry: its top (the status bar) is painted in `surface` above the bar.
 */
@Composable
fun ReportHostFrame(
    ticker: String,
    padding: PaddingValues,
    onBack: () -> Unit,
    following: Boolean,
    onFollowChange: (Boolean) -> Unit,
    onOverflow: () -> Unit,
    pageLoaded: Boolean,
    progress: Int,
    dockItems: List<DockItem>,
    dockVisible: Boolean,
    modifier: Modifier = Modifier,
    overlays: @Composable BoxScope.() -> Unit = {},
    page: @Composable (Modifier) -> Unit,
) {
    val p = LocalThesisPalette.current
    Column(modifier.fillMaxSize().padding(padding.exceptTop())) {
        Column(Modifier.fillMaxWidth().background(p.surface)) {
            Spacer(Modifier.height(padding.calculateTopPadding()))
            ReportTopBar(
                ticker = ticker,
                onBack = onBack,
                following = following,
                onFollowChange = onFollowChange,
                onOverflow = onOverflow,
            )
        }
        Box(Modifier.fillMaxWidth().weight(1f)) {
            page(Modifier.fillMaxSize())
            PageLoadingLayer(loaded = pageLoaded, progress = progress)
            ReportDock(
                items = dockItems,
                modifier = Modifier.align(Alignment.BottomCenter),
                visible = dockVisible && pageLoaded,
            )
            overlays()
        }
    }
}

/**
 * The skeleton over the page while it loads, and the progress hairline at its top. Fades out over `Base` when
 * [loaded] (at once under reduced motion); not composed once it has faded.
 */
@Composable
private fun BoxScope.PageLoadingLayer(loaded: Boolean, progress: Int) {
    val reduced = LocalReducedMotion.current
    val shown by animateFloatAsState(
        targetValue = if (loaded) 0f else 1f,
        animationSpec = ThesisMotion.timed(reduced, ThesisMotion.Base),
        label = "pageSkeleton",
    )
    if (shown <= 0f) return
    Box(Modifier.matchParentSize().graphicsLayer { alpha = shown }) {
        ShimmerHost(running = !loaded) {
            ReportPageSkeleton(Modifier.fillMaxSize())
        }
        PageProgressHairline(progress = progress, modifier = Modifier.align(Alignment.TopStart))
    }
}

/**
 * The page as it opens, in skeleton: the cover in the hero palette (eyebrow, two serif bars, the KPI grid), then
 * the chapter chips and the first chapter's head on the page background. Same order and rhythm as the page, so the
 * crossfade does not jump. [heroTop] is added above the hero's content when the band runs under bars (the generation
 * screen's open-report state); the report host's skeleton sits below its own bar and leaves it null.
 */
@Composable
fun ReportPageSkeleton(modifier: Modifier = Modifier, heroTop: Dp? = null) {
    val p = LocalThesisPalette.current
    Column(
        modifier
            .background(p.bg)
            .clearAndSetSemantics { contentDescription = ReportCopy.PAGE_LOADING },
    ) {
        val heroPadding = if (heroTop == null) {
            HeroBandPadding
        } else {
            PaddingValues(
                start = ThesisSpace.gutter,
                end = ThesisSpace.gutter,
                top = heroTop + ThesisSpace.x4,
                bottom = ThesisSpace.x3,
            )
        }
        HeroBand(contentPadding = heroPadding) { SkeletonHero() }
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = ThesisSpace.gutter, vertical = ThesisSpace.m),
            horizontalArrangement = Arrangement.spacedBy(ThesisSpace.s),
        ) {
            ChipWidths.forEach { fraction ->
                SkeletonBlock(Modifier.weight(fraction).height(ThesisSpace.chipHeight))
            }
        }
        Column(
            Modifier.fillMaxWidth().padding(horizontal = ThesisSpace.gutter, vertical = ThesisSpace.x3),
            verticalArrangement = Arrangement.spacedBy(ThesisSpace.m),
        ) {
            SkeletonText(ThesisType.kicker, widthFraction = 0.35f)
            SkeletonText(ThesisType.capped(ThesisType.title), widthFraction = 0.8f)
            SkeletonText(ThesisType.lede, lines = 3)
        }
    }
}

/** Relative widths of the skeleton chapter chips (Summary, Business, Countries, ...). */
private val ChipWidths = listOf(1.0f, 1.05f, 1.1f, 0.7f)

/**
 * The page's load progress (5.13): a 2 dp accent line from the start edge, its length following [progress]
 * (0..100) on the `effects` spring. Announced as a progress bar.
 */
@Composable
fun PageProgressHairline(progress: Int, modifier: Modifier = Modifier) {
    val p = LocalThesisPalette.current
    val reduced = LocalReducedMotion.current
    val target = progress.coerceIn(0, MAX_PROGRESS) / MAX_PROGRESS.toFloat()
    val fraction by animateFloatAsState(
        targetValue = target,
        animationSpec = if (reduced) ThesisMotion.timed(true, 0) else ThesisMotion.effects(),
        label = "pageProgress",
    )
    Box(
        modifier
            .fillMaxWidth()
            .height(ThesisSpace.borderFocus)
            .clearAndSetSemantics {
                contentDescription = ReportCopy.PAGE_LOADING
                progressBarRangeInfo = ProgressBarRangeInfo(target, 0f..1f)
            }
            .drawBehind { drawRect(p.accent, size = Size(size.width * fraction, size.height)) },
    )
}

private const val MAX_PROGRESS = 100

/**
 * The classic view after the page failed (5.13): the classic report with an [InlineBanner] floating above its
 * bottom edge, "The new view didn't load." and "Try again". The banner never replaces the report.
 */
@Composable
fun ReportFallbackBanner(onRetry: () -> Unit, modifier: Modifier = Modifier) {
    InlineBanner(
        text = ReportCopy.LOAD_FAILED,
        modifier = modifier.padding(ThesisSpace.gutter),
        tone = BannerTone.Attention,
        actionLabel = ReportCopy.TRY_AGAIN,
        onAction = onRetry,
    )
}
