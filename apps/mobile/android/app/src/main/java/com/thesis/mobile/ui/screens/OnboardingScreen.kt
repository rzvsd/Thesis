package com.thesis.mobile.ui.screens

import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsBottomHeight
import androidx.compose.foundation.layout.windowInsetsTopHeight
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PagerState
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import com.thesis.mobile.ui.components.ChapterHeader
import com.thesis.mobile.ui.components.Eyebrow
import com.thesis.mobile.ui.components.HeroBand
import com.thesis.mobile.ui.components.PagerDots
import com.thesis.mobile.ui.components.PrimaryButton
import com.thesis.mobile.ui.components.RowGroup
import com.thesis.mobile.ui.components.TertiaryButton
import com.thesis.mobile.ui.components.TickerRow
import com.thesis.mobile.ui.components.ledeText
import com.thesis.mobile.ui.copy.AccountCopy
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.platform.ThesisBackHandler
import com.thesis.mobile.ui.shell.HeroUnderBars
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone
import kotlinx.coroutines.launch

/** One onboarding page: the product fragment it shows, then its eyebrow, title and lede. */
private enum class OnboardingPage(val eyebrow: String, val title: String, val lede: String) {
    Desk(AccountCopy.ONBOARDING_DESK_EYEBROW, AccountCopy.ONBOARDING_DESK_TITLE, AccountCopy.ONBOARDING_DESK_LEDE),
    Pulse(AccountCopy.ONBOARDING_PULSE_EYEBROW, AccountCopy.ONBOARDING_PULSE_TITLE, AccountCopy.ONBOARDING_PULSE_LEDE),
    DeepDive(AccountCopy.ONBOARDING_DIVE_EYEBROW, AccountCopy.ONBOARDING_DIVE_TITLE, AccountCopy.ONBOARDING_DIVE_LEDE),
    Names(AccountCopy.ONBOARDING_NAMES_EYEBROW, AccountCopy.ONBOARDING_NAMES_TITLE, AccountCopy.ONBOARDING_NAMES_LEDE),
    Advice(AccountCopy.ONBOARDING_ADVICE_EYEBROW, AccountCopy.ONBOARDING_ADVICE_TITLE, AccountCopy.ONBOARDING_ADVICE_LEDE),
}

/** Number of onboarding pages (for tests and renders). */
const val ONBOARDING_PAGE_COUNT = 5

/**
 * Steps of a page's entrance cascade (5.2: eyebrow, title, lede at 0 / 60 / 120 ms). The product fragment above the
 * eyebrow enters with it, on step 0.
 */
private const val CASCADE_STEPS = 3

/**
 * Onboarding (DESIGN-DIRECTION 5.2): one full-screen HeroBand with a pager of five pages, each a real product
 * fragment (the T mark, the Pulse morning line, a Deep Dive chapter opening, two followed names) above an eyebrow,
 * a serif title and a lede, left-aligned on the gutter. Under the pager: page dots, the gold primary button
 * ("Continue", then "Get started") and "Skip" (on the last page, the research-tool disclaimer).
 *
 * Every page scrolls on its own and fills the pager's height with flexible space, so nothing is fixed: at 1.3x and
 * 2.0x font scale the text grows and the page scrolls, its bottom edge fading while more is below. Each page's elements enter once, the first time it shows:
 * fade and an 8 dp rise, [ThesisMotion.Enter] each, [ThesisMotion.CrossfadeDelay] apart (the fragment with the
 * eyebrow, then the title, then the lede); nothing moves under
 * reduced motion. System back goes to the previous page.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun OnboardingScreen(
    onComplete: () -> Unit,
    initialPage: Int = 0,
) {
    val pages = OnboardingPage.entries
    val pagerState = rememberPagerState(initialPage = initialPage.coerceIn(0, pages.lastIndex)) { pages.size }
    val scope = rememberCoroutineScope()
    val reduced = LocalReducedMotion.current
    // Pages whose entrance has played (a bit per page), kept across rotation so nothing replays.
    var played by rememberSaveable { mutableIntStateOf(0) }
    val isLast = pagerState.currentPage == pages.lastIndex

    fun goTo(page: Int) {
        scope.launch {
            if (reduced) pagerState.scrollToPage(page) else pagerState.animateScrollToPage(page, animationSpec = ThesisMotion.spatialSlow())
        }
    }

    ThesisBackHandler(enabled = pagerState.currentPage > 0) { goTo(pagerState.currentPage - 1) }
    HeroUnderBars(collapsed = false)

    // The band's gold bottom rule separates it from a page below; here there is none, so the band runs one rule
    // width past the bottom of the screen and draws the rule off-screen, not along the gesture bar. The content
    // still ends at the screen edge (bottom padding of the same width). HANDOFF-G 22 asks for a HeroBand option.
    val rule = ThesisSpace.border
    HeroBand(
        modifier = Modifier
            .fillMaxSize()
            .layout { measurable, constraints ->
                val extra = rule.roundToPx()
                val tall = constraints.maxHeight + extra
                val placeable = measurable.measure(constraints.copy(minHeight = tall, maxHeight = tall))
                layout(constraints.maxWidth, constraints.maxHeight) { placeable.place(0, 0) }
            },
        contentPadding = PaddingValues(bottom = rule),
        verticalArrangement = Arrangement.Top,
    ) {
        Column(Modifier.fillMaxSize()) {
            Spacer(Modifier.windowInsetsTopHeight(WindowInsets.safeDrawing))
            HorizontalPager(
                state = pagerState,
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                verticalAlignment = Alignment.Top,
            ) { index ->
                val page = pages[index]
                val showing = pagerState.currentPage == index || pagerState.targetPage == index
                OnboardingPageContent(
                    page = page,
                    showing = showing,
                    played = reduced || played and (1 shl index) != 0,
                    onPlayed = { played = played or (1 shl index) },
                )
            }
            OnboardingControls(
                pagerState = pagerState,
                isLast = isLast,
                onNext = { if (isLast) onComplete() else goTo(pagerState.currentPage + 1) },
                onSkip = onComplete,
            )
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun OnboardingControls(pagerState: PagerState, isLast: Boolean, onNext: () -> Unit, onSkip: () -> Unit) {
    val p = LocalThesisPalette.current
    Column(
        Modifier
            .fillMaxWidth()
            .widthIn(max = ThesisSpace.contentMaxWidth)
            .padding(horizontal = ThesisSpace.gutter)
            .padding(top = ThesisSpace.l),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        PagerDots(count = pagerState.pageCount, current = pagerState.currentPage)
        Spacer(Modifier.height(ThesisSpace.xxl))
        PrimaryButton(
            text = if (isLast) AccountCopy.ONBOARDING_START else AccountCopy.ONBOARDING_CONTINUE,
            onClick = onNext,
            modifier = Modifier.fillMaxWidth(),
            commit = isLast,
        )
        // Skip and, on the last page, the disclaimer share one slot. Both are always laid out (the hidden one
        // invisible, silent and inert), so the slot is as tall as the taller of the two on every page and the dots
        // and the button above never move when the last page arrives.
        Box(
            Modifier
                .fillMaxWidth()
                .heightIn(min = ThesisSpace.touchMin)
                .padding(top = ThesisSpace.xs),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                AccountCopy.DISCLAIMER,
                modifier = Modifier.shownIf(isLast),
                style = ThesisType.caption,
                color = p.muted,
                textAlign = TextAlign.Center,
            )
            TertiaryButton(AccountCopy.ONBOARDING_SKIP, onSkip, modifier = Modifier.shownIf(!isLast), enabled = !isLast)
        }
        Spacer(Modifier.height(ThesisSpace.s))
        Spacer(Modifier.windowInsetsBottomHeight(WindowInsets.safeDrawing))
    }
}

/** Kept in the layout either way; drawn, announced and tappable only while [shown]. */
private fun Modifier.shownIf(shown: Boolean): Modifier =
    if (shown) this else this.alpha(0f).clearAndSetSemantics { }

@Composable
private fun OnboardingPageContent(page: OnboardingPage, showing: Boolean, played: Boolean, onPlayed: () -> Unit) {
    val p = LocalThesisPalette.current
    val progress = remember { Animatable(if (played) 1f else 0f) }
    LaunchedEffect(showing, played) {
        when {
            played -> progress.snapTo(1f)
            showing -> {
                progress.animateTo(
                    targetValue = 1f,
                    animationSpec = ThesisMotion.timed(
                        reduced = false,
                        durationMillis = CASCADE_TOTAL_MILLIS,
                        easing = ThesisMotion.Linear,
                    ),
                )
                onPlayed()
            }
        }
    }
    val rise = with(LocalDensity.current) { ThesisMotion.EnterOffset.toPx() }
    fun Modifier.step(i: Int): Modifier = graphicsLayer {
        val t = cascadeAt(progress.value, i)
        alpha = t
        translationY = (1f - t) * rise
    }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val pageHeight = maxHeight
        val scroll = rememberScrollState()
        Column(
            Modifier
                .fillMaxWidth()
                .fadeWhenMoreBelow(scroll, mask = p.ink)
                .verticalScroll(scroll)
                .heightIn(min = pageHeight)
                .widthIn(max = ThesisSpace.contentMaxWidth)
                .padding(horizontal = ThesisSpace.gutter),
        ) {
            Spacer(Modifier.height(ThesisSpace.xxl))
            Spacer(Modifier.weight(1f))
            Box(Modifier.fillMaxWidth().step(0)) { PageFragment(page) }  // with the eyebrow, at 0 ms
            Spacer(Modifier.height(ThesisSpace.x4))
            Spacer(Modifier.weight(0.25f))
            Eyebrow(page.eyebrow, modifier = Modifier.step(0))
            Spacer(Modifier.height(ThesisSpace.m))
            Text(
                page.title,
                modifier = Modifier
                    .step(1)
                    .semantics { heading() },
                style = ThesisType.capped(ThesisType.title),
                color = p.ink,
            )
            Spacer(Modifier.height(ThesisSpace.m))
            Text(page.lede, modifier = Modifier.step(2), style = ThesisType.lede, color = p.ink2)
            Spacer(Modifier.height(ThesisSpace.l))
        }
    }
}

/**
 * Fades the bottom 80 dp ([ThesisSpace.x5] + [ThesisSpace.xxl], about one lede line at 2.0x) of a scrolling page out while more of it is below (large font scales on short
 * screens), so a lede cut by the controls reads as "keeps going" rather than as truncated text. A mask on this
 * node's own layer (outside the scroll, so it stays at the viewport's bottom edge); nothing is drawn when the page
 * fits. [mask] is an opaque palette colour; only its alpha is used.
 */
private fun Modifier.fadeWhenMoreBelow(scroll: ScrollState, mask: Color): Modifier = this
    .graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
    .drawWithContent {
        drawContent()
        if (scroll.canScrollForward) {
            val fade = (ThesisSpace.x5 + ThesisSpace.xxl).toPx()
            drawRect(
                // Only the mask's alpha counts ([mask] is any opaque token): DstOut keeps the content where it is clear.
                brush = Brush.verticalGradient(
                    colors = listOf(Color.Transparent, mask),
                    startY = size.height - fade,
                    endY = size.height,
                ),
                blendMode = BlendMode.DstOut,
            )
        }
    }

/** Total length of a page's cascade: the last element starts [CASCADE_STEPS] - 1 delays in and runs Enter. */
private const val CASCADE_TOTAL_MILLIS = ThesisMotion.Enter + (CASCADE_STEPS - 1) * ThesisMotion.CrossfadeDelay

/** Eased 0..1 progress of cascade element [index] when the page's linear driver is at [driver]. */
internal fun cascadeAt(driver: Float, index: Int): Float {
    if (driver >= 1f) return 1f
    val elapsed = driver * CASCADE_TOTAL_MILLIS - index * ThesisMotion.CrossfadeDelay
    val t = (elapsed / ThesisMotion.Enter).coerceIn(0f, 1f)
    return ThesisMotion.EaseEnter.transform(t)
}

/** The product fragment at the top of each page: what the feature looks like in the app. */
@Composable
private fun PageFragment(page: OnboardingPage) {
    val p = LocalThesisPalette.current
    when (page) {
        OnboardingPage.Desk -> Image(
            imageVector = rememberThesisMark(p.accent),
            contentDescription = null,
            modifier = Modifier.size(ThesisSpace.x5 + ThesisSpace.s),
        )
        // A plain caption names the fragment: the page's own ruled eyebrow ("Pulse") is the only kicker (V3).
        OnboardingPage.Pulse -> Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
            Text(AccountCopy.ONBOARDING_PULSE_FRAGMENT_EYEBROW, style = ThesisType.caption, color = p.ink2)
            Text(AccountCopy.ONBOARDING_PULSE_FRAGMENT, style = ThesisType.heroLine, color = p.ink)
        }
        OnboardingPage.DeepDive -> ChapterHeader(
            numeral = 2,
            label = AccountCopy.ONBOARDING_DIVE_CHAPTER,
            title = AccountCopy.ONBOARDING_DIVE_CHAPTER_TITLE,
            lede = ledeText(AccountCopy.ONBOARDING_DIVE_CHAPTER_LEAD, AccountCopy.ONBOARDING_DIVE_CHAPTER_REST, p),
            small = true,
        )
        OnboardingPage.Names -> NamesFragment()
        OnboardingPage.Advice -> Unit
    }
}

/** Two followed names as rows ([AccountCopy.ONBOARDING_NAMES_SAMPLE]); a picture of the Names list, so it takes no taps and reads as one description. */
@Composable
private fun NamesFragment() {
    Box(
        Modifier
            .fillMaxWidth()
            .clearAndSetSemantics { contentDescription = AccountCopy.ONBOARDING_NAMES_FRAGMENT_DESCRIPTION },
    ) {
        RowGroup {
            AccountCopy.ONBOARDING_NAMES_SAMPLE.forEach { name ->
                row {
                    TickerRow(
                        ticker = name.ticker,
                        stateTone = if (name.holding) Tone.Favourable else Tone.Attention,
                        onClick = {},
                        company = name.company,
                        line2 = name.line2,
                        figure = name.score,
                        figureCaption = name.change,
                        figureCaptionTone = if (name.up) Tone.Favourable else Tone.Unfavourable,
                        stateLabel = name.state,
                    )
                }
            }
        }
        // Swallows taps: the rows are a picture here, not navigation.
        Box(
            Modifier
                .matchParentSize()
                .pointerInput(Unit) { detectTapGestures { } },
        )
    }
}
