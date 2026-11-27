package com.thesis.mobile.ui.motion

import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.pulltorefresh.PullToRefreshState
import androidx.compose.material3.pulltorefresh.pullToRefresh
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
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
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch

/*
 * Pull to refresh with a travelling hairline (docs/app-redesign/DESIGN-DIRECTION.md 3 #34, 4.3 rule 5, 4.4, 4.7).
 * Not a spinner: refresh is a quiet line, the same language as the LoadingHairline under a ScreenHeader.
 *
 * - Pulling: the content follows the finger (Material3's 0.5 drag multiplier, capped just past the arming point)
 *   and opens a gap at the top; in the gap a 1 dp hairline grows from the centre outward with the pull,
 *   `line` -> `ink`.
 * - Armed (pulled past the threshold): the line is complete and turns `accent`; one `threshold()` haptic.
 * - Refreshing: the content settles to a 16 dp gap (`spatial`) and the hairline's accent highlight travels across
 *   it (`HairlineLoop`, 2.25 s linear) until the ViewModel clears [refreshing]; then the gap closes and values
 *   update in place (no blanking).
 * - Reduced motion: the content does not move; the line shows progress in place and is static while refreshing.
 *
 * The gesture is Material3 1.3's (PR-4b; PR-1 to PR-4a used Material 2's `pullRefresh`): `Modifier.pullToRefresh`
 * with our own [PullToRefreshState] ([HairlinePullState]) and the hairline as the indicator. That is exactly what
 * M3's `PullToRefreshBox` is (a Box with `Modifier.pullToRefresh`, the content, then the indicator); the Box
 * wrapper itself is not used because it takes neither `enabled` (History in compare mode, a live War Room) nor
 * `threshold` (our 72 dp, M3's default is 80 dp). Same semantics as before: a release past the threshold calls
 * [onRefresh] at once (the state does not hold the call back for an animation), no pull while refreshing.
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
// PullToRefreshState and Modifier.pullToRefresh are @ExperimentalMaterial3Api in Material3 1.3.x (the API this
// file is written against; 1.4 changes them, which needs Compose 1.8 anyway).
@OptIn(ExperimentalMaterial3Api::class)
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
    val currentRefreshing by rememberUpdatedState(refreshing)
    val scope = rememberCoroutineScope()
    val state = remember {
        HairlinePullState(
            restFraction = ThesisMotion.RefreshRest / ThesisMotion.RefreshTravel,
            scope = scope,
            isRefreshing = { currentRefreshing },
        )
    }

    LaunchedEffect(state) {
        snapshotFlow { state.distanceFraction >= 1f }
            .distinctUntilChanged()
            .collect { armed -> if (armed && !currentRefreshing) haptics.threshold() }
    }

    val loop = rememberHairlinePhase(active = refreshing)
    Box(
        modifier
            .pullToRefresh(
                isRefreshing = refreshing,
                state = state,
                enabled = enabled,
                threshold = ThesisMotion.RefreshThreshold,
                onRefresh = onRefresh,
            )
            .semantics {
                if (enabled && !refreshing) {
                    customActions = listOf(CustomAccessibilityAction(refreshLabel) { onRefresh(); true })
                }
            },
    ) {
        Box(
            Modifier.graphicsLayer {
                translationY = if (reduced) 0f else state.follow.value * with(density) { ThesisMotion.RefreshTravel.toPx() }
            },
        ) { content() }
        RefreshHairline(
            pullProgress = { state.distanceFraction },
            refreshing = refreshing,
            phase = loop,
            label = refreshingLabel,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .offset(y = indicatorTop)
                .graphicsLayer {
                    // Centre the line in the gap the content opened.
                    val gap = if (reduced) ThesisMotion.RefreshRest.toPx() else state.follow.value * ThesisMotion.RefreshTravel.toPx()
                    translationY = (gap - size.height) / 2f
                },
        )
    }
}

/**
 * Material3's pull-to-refresh driven through our own state, so the content (not a floating disc) follows the pull
 * and settles on the kit's springs.
 *
 * - [distanceFraction] is the pull as M3 measures it (1 = armed; past it M3's tension applies), or 0 once released.
 * - [follow] is how far the content follows, as a share of `RefreshTravel`: it tracks the pull (capped at
 *   `RefreshOverPull`), then settles on `spatial` to the refreshing gap ([restFraction]) or back to 0.
 * - M3's node calls [animateToThreshold] on a release past the threshold, before `onRefresh`, and again when
 *   `isRefreshing` turns true; [animateToHidden] on any other release and when the refresh ends. Both start the
 *   settle and return at once, so `onRefresh` runs on release as with M2 (no wait for an animation). The settle
 *   goes to the gap only while the ViewModel says it is refreshing, so a refresh that never starts never leaves
 *   the content hanging 16 dp down.
 * - While refreshing, M3 keeps reporting its last offset on every list scroll ([snapTo] with the armed value):
 *   that is ignored and the content stays at the gap (a box composed mid-refresh opens at the gap).
 * - [isAnimating] stays false, so a new pull can take over a settle that is still running (M2 never blocked it).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Stable
internal class HairlinePullState(
    private val restFraction: Float,
    private val scope: CoroutineScope,
    private val isRefreshing: () -> Boolean,
) : PullToRefreshState {
    private var pull by mutableFloatStateOf(0f)

    /** How far the content follows the pull, as a share of `RefreshTravel` (read in the layer phase only). */
    val follow = Animatable(0f)

    override val distanceFraction: Float get() = pull

    override val isAnimating: Boolean get() = false

    override suspend fun animateToThreshold() = settle(if (isRefreshing()) restFraction else 0f)

    override suspend fun animateToHidden() = settle(0f)

    override suspend fun snapTo(targetValue: Float) {
        if (isRefreshing()) {
            pull = 0f
            if (!follow.isRunning && follow.value != restFraction) follow.snapTo(restFraction)
            return
        }
        // A list scroll with no pull: leave a settle that is still running alone.
        if (targetValue == 0f && pull == 0f) return
        pull = targetValue
        follow.snapTo(targetValue.coerceAtMost(ThesisMotion.RefreshOverPull))
    }

    private fun settle(target: Float) {
        pull = 0f
        scope.launch { follow.animateTo(target, ThesisMotion.spatial()) }
    }
}

/**
 * The refresh line on its own (for galleries and custom pull sources): a gutter-inset 1 dp hairline. While pulled
 * (no refresh running) it grows from the centre with [pullProgress] (the pull's progress, 1 = armed) in `ink`, `accent` once armed; while
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
