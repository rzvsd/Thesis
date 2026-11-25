package com.thesis.mobile.ui.motion

import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.distinctUntilChanged

/*
 * Pull to refresh with a travelling hairline (docs/app-redesign/DESIGN-DIRECTION.md 3 #34, 4.3 rule 5, 4.4, 4.7;
 * playbook 15 for the M2 pullRefresh plumbing). Not a spinner: refresh is a quiet line, the same language as the
 * LoadingHairline under a ScreenHeader.
 *
 * - Pulling: the content follows the finger (M2's 0.5 resistance, capped just past the arming point) and opens a
 *   gap at the top; in the gap a 1 dp hairline grows from the centre outward with the pull, `line` -> `ink`.
 * - Armed (pulled past the threshold): the line is complete and turns `accent`; one `threshold()` haptic.
 * - Refreshing: the content settles to a 16 dp gap (`spatial`) and the hairline's accent highlight travels across
 *   it (`HairlineLoop`, 2.25 s linear) until the ViewModel clears [refreshing]; then the gap closes and values
 *   update in place (no blanking).
 * - Reduced motion: the content does not move; the line shows progress in place and is static while refreshing.
 *
 * `refreshing` must come from the ViewModel (no fake delays). TalkBack: the box offers a "Refresh" action, and
 * the line announces "Refreshing" while it runs.
 */

/**
 * Pull-to-refresh container. Screens do not call it directly: the kit's `ui.components.ThesisRefreshBox` (spec
 * 3 #34) stays the one public entry point and delegates here, so the two packages never export the same name.
 * [indicatorTop] is where the gap opens (below a transparent top bar, for example).
 * [refreshLabel] / [refreshingLabel] are the accessibility action and status (screens pass their copy).
 */
@OptIn(ExperimentalMaterialApi::class)
@Composable
fun ThesisPullRefresh(
    refreshing: Boolean,
    onRefresh: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    indicatorTop: Dp = 0.dp,
    refreshLabel: String = MotionCopy.REFRESH,
    refreshingLabel: String = MotionCopy.REFRESHING,
    content: @Composable BoxScope.() -> Unit,
) {
    val density = LocalDensity.current
    val reduced = LocalReducedMotion.current
    val haptics = rememberHaptics()
    val state = rememberPullRefreshState(
        refreshing = refreshing,
        onRefresh = onRefresh,
        refreshThreshold = ThesisMotion.RefreshThreshold,
        refreshingOffset = ThesisMotion.RefreshRest,
    )
    val currentRefreshing by rememberUpdatedState(refreshing)
    val restFraction = ThesisMotion.RefreshRest / ThesisMotion.RefreshTravel
    // How far the content follows, as a share of RefreshTravel: tracks the finger, then settles on springs.
    val follow = remember { Animatable(0f) }

    LaunchedEffect(state) {
        snapshotFlow { state.progress >= 1f }
            .distinctUntilChanged()
            .collect { armed -> if (armed && !currentRefreshing) haptics.threshold() }
    }
    LaunchedEffect(state) {
        snapshotFlow { state.progress }.collectLatest { pulled ->
            if (pulled > 0f) {
                follow.snapTo(pulled.coerceAtMost(ThesisMotion.RefreshOverPull))
            } else {
                follow.animateTo(if (currentRefreshing) restFraction else 0f, ThesisMotion.spatial())
            }
        }
    }
    LaunchedEffect(refreshing) {
        if (state.progress == 0f) follow.animateTo(if (refreshing) restFraction else 0f, ThesisMotion.spatial())
    }

    val loop = rememberHairlinePhase(active = refreshing)
    Box(
        modifier
            .pullRefresh(state, enabled)
            .semantics {
                if (enabled && !refreshing) {
                    customActions = listOf(CustomAccessibilityAction(refreshLabel) { onRefresh(); true })
                }
            },
    ) {
        Box(
            Modifier.graphicsLayer {
                translationY = if (reduced) 0f else follow.value * with(density) { ThesisMotion.RefreshTravel.toPx() }
            },
        ) { content() }
        RefreshHairline(
            pullProgress = { state.progress },
            refreshing = refreshing,
            phase = loop,
            label = refreshingLabel,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .offset(y = indicatorTop)
                .graphicsLayer {
                    // Centre the line in the gap the content opened.
                    val gap = if (reduced) ThesisMotion.RefreshRest.toPx() else follow.value * ThesisMotion.RefreshTravel.toPx()
                    translationY = (gap - size.height) / 2f
                },
        )
    }
}

/**
 * The refresh line on its own (for galleries and custom pull sources): a gutter-inset 1 dp hairline. While pulled
 * (no refresh running) it grows from the centre with [pullProgress] (M2's progress, 1 = armed) in `ink`, `accent` once armed; while
 * [refreshing] the full `line` shows with the travelling accent highlight driven by [phase] (static under reduced
 * motion). Invisible at rest. Draw-phase reads only.
 */
@Composable
fun RefreshHairline(
    pullProgress: () -> Float,
    refreshing: Boolean,
    phase: State<Float>,
    modifier: Modifier = Modifier,
    label: String = MotionCopy.REFRESHING,
) {
    val p = LocalThesisPalette.current
    val highlight = hairlineHighlight(p)
    Box(
        modifier
            .fillMaxWidth()
            .padding(horizontal = ThesisSpace.gutter)
            .height(ThesisSpace.border)
            .then(
                if (refreshing) {
                    Modifier.clearAndSetSemantics {
                        contentDescription = label
                        liveRegion = LiveRegionMode.Polite
                        progressBarRangeInfo = ProgressBarRangeInfo.Indeterminate
                    }
                } else {
                    Modifier.clearAndSetSemantics { }
                },
            )
            .drawBehind {
                val pulled = pullProgress()
                if (refreshing) {
                    drawRect(p.line)
                    val t = phase.value
                    if (t >= 0f) drawTravellingHighlight(t, highlight) else drawRect(highlight)
                } else if (pulled > 0f) {
                    val share = pulled.coerceAtMost(1f)
                    drawRect(p.line, alpha = share)
                    val w = size.width * share
                    drawRect(
                        if (pulled >= 1f) p.accent else p.ink,
                        topLeft = Offset((size.width - w) / 2f, 0f),
                        size = Size(w, size.height),
                    )
                }
            },
    )
}

/** Fallback copy for the motion kit (screens pass their own from ui/copy). */
object MotionCopy {
    const val REFRESH = "Refresh"
    const val REFRESHING = "Refreshing"
}
