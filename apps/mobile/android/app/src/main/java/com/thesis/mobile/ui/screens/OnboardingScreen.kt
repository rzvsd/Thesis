package com.thesis.mobile.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.Newspaper
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thesis.mobile.ui.components.PlasmaOrb
import com.thesis.mobile.ui.theme.HeadingFont
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private data class OnboardingPage(
    val overline: String,
    val headline: String,
    val body: String,
    val icon: ImageVector,
    val sampleLabel: String,
    val sampleValue: String
)

private val pages = listOf(
    OnboardingPage(
        overline = "MORNING PULSE",
        headline = "Know what changed\nbefore markets open",
        body = "A structured daily briefing on overnight moves, sentiment shifts, and what matters for your names.",
        icon = Icons.Default.LightMode,
        sampleLabel = "Fear & Greed",
        sampleValue = "42 Fear"
    ),
    OnboardingPage(
        overline = "DEEP DIVE",
        headline = "Evidence-backed\ncompany research",
        body = "Thesis, signal, confidence, risks, valuation — synthesized from filings, news, and alternative data in ~90 seconds.",
        icon = Icons.Default.Search,
        sampleLabel = "AAPL Signal",
        sampleValue = "Positive  7/10"
    ),
    OnboardingPage(
        overline = "YOUR NAMES",
        headline = "Follow what\nmatters most",
        body = "Track up to 20 companies. They appear in your pulse, research, and alerts across Thesis.",
        icon = Icons.Default.Newspaper,
        sampleLabel = "Names Tracked",
        sampleValue = "AAPL  NVDA  MSFT"
    ),
    OnboardingPage(
        overline = "RESEARCH TOOL",
        headline = "Every position\nneeds one",
        body = "Thesis is a research aid, not financial advice. Built for investors who do their own thinking.",
        icon = Icons.Default.Shield,
        sampleLabel = "Status",
        sampleValue = "Ready"
    )
)

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun OnboardingScreen(
    onComplete: () -> Unit
) {
    val pagerState = rememberPagerState(pageCount = { pages.size })
    val scope = rememberCoroutineScope()
    val isLastPage by remember { derivedStateOf { pagerState.currentPage == pages.lastIndex } }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ThesisColors.Background)
    ) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxSize()
        ) { pageIndex ->
            OnboardingPageContent(
                page = pages[pageIndex],
                pageIndex = pageIndex,
                isActive = pagerState.currentPage == pageIndex
            )
        }

        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 40.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXl)
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                repeat(pages.size) { index ->
                    val isActive = pagerState.currentPage == index
                    val width by animateFloatAsState(
                        targetValue = if (isActive) 24f else 6f,
                        animationSpec = tween(300, easing = FastOutSlowInEasing),
                        label = "indicator$index"
                    )
                    Box(
                        modifier = Modifier
                            .height(6.dp)
                            .width(width.dp)
                            .clip(CircleShape)
                            .background(if (isActive) ThesisColors.Primary else ThesisColors.Border)
                    )
                }
            }

            Button(
                onClick = {
                    if (isLastPage) {
                        onComplete()
                    } else {
                        scope.launch {
                            pagerState.animateScrollToPage(
                                pagerState.currentPage + 1,
                                animationSpec = tween(500, easing = FastOutSlowInEasing)
                            )
                        }
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                colors = ButtonDefaults.buttonColors(
                    containerColor = ThesisColors.Primary,
                    contentColor = ThesisColors.TextInverse
                )
            ) {
                Text(
                    text = if (isLastPage) "Get Started" else "Continue",
                    style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium)
                )
                if (!isLastPage) {
                    Spacer(modifier = Modifier.width(8.dp))
                    Icon(Icons.Default.ArrowForward, null, modifier = Modifier.size(18.dp))
                }
            }

            if (!isLastPage) {
                TextButton(onClick = onComplete) {
                    Text(
                        text = "Skip",
                        style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                        color = ThesisColors.TextMuted
                    )
                }
            }

            if (isLastPage) {
                Text(
                    text = "THIS IS A RESEARCH TOOL, NOT FINANCIAL ADVICE",
                    style = ThesisTypography.labelSmall,
                    color = ThesisColors.TextMuted.copy(alpha = 0.3f),
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}

@Composable
private fun OnboardingPageContent(page: OnboardingPage, pageIndex: Int, isActive: Boolean) {
    var elementsVisible by remember { mutableStateOf(false) }

    LaunchedEffect(isActive) {
        if (isActive) {
            elementsVisible = false
            delay(150)
            elementsVisible = true
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 28.dp)
            .padding(top = 80.dp, bottom = 220.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        AnimatedVisibility(
            visible = elementsVisible,
            enter = fadeIn(tween(600)) + slideInVertically(tween(700, easing = FastOutSlowInEasing)) { -40 }
        ) {
            if (pageIndex == 0) {
                PlasmaOrb(size = 120.dp, intensity = 0.5f)
            } else {
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .clip(RoundedCornerShape(ThesisDimens.CardCornerRadiusMd))
                        .background(ThesisColors.Surface)
                        .border(
                            ThesisDimens.BorderWidth,
                            ThesisColors.Primary.copy(alpha = 0.2f),
                            RoundedCornerShape(ThesisDimens.CardCornerRadiusMd)
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = page.icon,
                        contentDescription = null,
                        tint = ThesisColors.Primary,
                        modifier = Modifier.size(36.dp)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(40.dp))

        AnimatedVisibility(
            visible = elementsVisible,
            enter = fadeIn(tween(500, delayMillis = 200)) + slideInVertically(tween(500, delayMillis = 200)) { 20 }
        ) {
            Text(
                text = page.overline,
                style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                color = ThesisColors.Primary,
                modifier = Modifier.padding(bottom = ThesisDimens.SpacingMd)
            )
        }

        AnimatedVisibility(
            visible = elementsVisible,
            enter = fadeIn(tween(600, delayMillis = 350)) + slideInVertically(tween(600, delayMillis = 350)) { 30 }
        ) {
            Text(
                text = page.headline,
                style = ThesisTypography.displayMedium.copy(
                    fontFamily = HeadingFont,
                    fontWeight = FontWeight.Normal,
                    lineHeight = 38.sp
                ),
                color = ThesisColors.TextPrimary,
                textAlign = TextAlign.Center
            )
        }

        Spacer(modifier = Modifier.height(ThesisDimens.SpacingXl))

        AnimatedVisibility(
            visible = elementsVisible,
            enter = fadeIn(tween(500, delayMillis = 500)) + slideInVertically(tween(500, delayMillis = 500)) { 20 }
        ) {
            Text(
                text = page.body,
                style = ThesisTypography.bodyLarge,
                color = ThesisColors.TextMuted,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 8.dp)
            )
        }

        Spacer(modifier = Modifier.height(ThesisDimens.SpacingXxl))

        AnimatedVisibility(
            visible = elementsVisible,
            enter = fadeIn(tween(600, delayMillis = 650)) + slideInVertically(tween(600, delayMillis = 650)) { 30 }
        ) {
            val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
            Row(
                modifier = Modifier
                    .clip(shape)
                    .background(ThesisColors.Surface)
                    .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
                    .padding(horizontal = ThesisDimens.SpacingXl, vertical = ThesisDimens.SpacingMd),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)
            ) {
                Text(
                    text = page.sampleLabel,
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.TextMuted
                )
                Text(
                    text = page.sampleValue,
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.Primary
                )
            }
        }
    }
}
