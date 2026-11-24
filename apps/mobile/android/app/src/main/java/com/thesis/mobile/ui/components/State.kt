package com.thesis.mobile.ui.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.PullRefreshState
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.motion.rememberHaptics
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import kotlinx.coroutines.flow.distinctUntilChanged

/*
 * Screen state and refresh (docs/app-redesign/DESIGN-DIRECTION.md, section 3 #27 and #34; playbook §13 and §15).
 */

/**
 * The four kinds of screen state (#27). Screens map their ViewModel state into this and hand it to
 * [StateCrossfade] instead of an `if` ladder.
 */
@Immutable
sealed interface Loadable<out T> {
    data object Loading : Loadable<Nothing>
    data class Empty(val sentence: String? = null) : Loadable<Nothing>
    data class Failed(val cause: String? = null, val retryable: Boolean = true) : Loadable<Nothing>
    data class Ready<T>(val value: T) : Loadable<T>
}

/** The kind of a [Loadable], used as the crossfade key so Ready→Ready updates in place. */
enum class LoadableKind { Loading, Empty, Failed, Ready }

val Loadable<*>.kind: LoadableKind
    get() = when (this) {
        Loadable.Loading -> LoadableKind.Loading
        is Loadable.Empty -> LoadableKind.Empty
        is Loadable.Failed -> LoadableKind.Failed
        is Loadable.Ready -> LoadableKind.Ready
    }

/** The value when [Loadable.Ready], else null. */
fun <T> Loadable<T>.valueOrNull(): T? = (this as? Loadable.Ready<T>)?.value

/**
 * Crossfades between [Loadable] kinds (#27): fade out Quick, fade in Base after a 60 ms delay; a change inside
 * the same kind (Ready→Ready, a new error message) recomposes in place with no transition. Under reduced motion it
 * swaps instantly. The slots default to the kit's skeleton, [EmptyState] and [ErrorState].
 */
@Composable
fun <T> StateCrossfade(
    state: Loadable<T>,
    modifier: Modifier = Modifier,
    onRetry: (() -> Unit)? = null,
    loading: @Composable () -> Unit = { SkeletonCard() },
    empty: @Composable (Loadable.Empty) -> Unit = { EmptyState(sentence = it.sentence ?: "Nothing here yet.") },
    failed: @Composable (Loadable.Failed) -> Unit = {
        ErrorState(title = "This didn't load", cause = it.cause, onRetry = if (it.retryable) onRetry else null)
    },
    ready: @Composable (T) -> Unit,
) {
    val reduced = LocalReducedMotion.current
    AnimatedContent(
        targetState = state,
        modifier = modifier,
        contentKey = { it.kind },
        transitionSpec = {
            fadeIn(ThesisMotion.timed(reduced, ThesisMotion.Base, delayMillis = ThesisMotion.CrossfadeDelay)) togetherWith
                fadeOut(ThesisMotion.timed(reduced, ThesisMotion.Quick))
        },
        label = "state",
    ) { s ->
        @Suppress("UNCHECKED_CAST")
        when (s) {
            Loadable.Loading -> loading()
            is Loadable.Empty -> empty(s)
            is Loadable.Failed -> failed(s)
            is Loadable.Ready<*> -> ready((s as Loadable.Ready<T>).value)
        }
    }
}

/**
 * Pull to refresh (#34): M2 `pullRefresh` with the playbook §15 indicator, an ink arc that grows 0→300° with the
 * pull and spins at 90° while [refreshing]. [refreshing] must come from the ViewModel (no fake delays). The
 * `threshold()` haptic fires once each time the pull arms.
 */
@OptIn(ExperimentalMaterialApi::class)
@Composable
fun ThesisRefreshBox(
    refreshing: Boolean,
    onRefresh: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    indicatorTop: Dp = 0.dp,
    content: @Composable BoxScope.() -> Unit,
) {
    val state = rememberPullRefreshState(refreshing, onRefresh)
    val haptics = rememberHaptics()
    LaunchedEffect(state) {
        snapshotFlow { state.progress >= 1f }
            .distinctUntilChanged()
            .collect { armed -> if (armed && !refreshing) haptics.threshold() }
    }
    Box(modifier.pullRefresh(state, enabled)) {
        content()
        RefreshArc(
            state = state,
            refreshing = refreshing,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .offset(y = indicatorTop),
        )
    }
}

/** The pull indicator on its own: a `surface` disc with the ink arc. Visible only while pulled or refreshing. */
@OptIn(ExperimentalMaterialApi::class)
@Composable
fun RefreshArc(state: PullRefreshState, refreshing: Boolean, modifier: Modifier = Modifier) {
    RefreshArc(progress = { state.progress }, refreshing = refreshing, modifier = modifier)
}

/** [RefreshArc] driven by a raw [progress] (0..1+), for galleries and custom pull sources. */
@Composable
fun RefreshArc(progress: () -> Float, refreshing: Boolean, modifier: Modifier = Modifier) {
    val p = LocalThesisPalette.current
    val reduced = LocalReducedMotion.current
    val spin = if (refreshing && !reduced) {
        val t = rememberInfiniteTransition(label = "refresh")
        t.animateFloat(
            0f,
            360f,
            infiniteRepeatable(tween(ThesisMotion.RefreshSpin, easing = LinearEasing), RepeatMode.Restart),
            label = "spin",
        )
    } else {
        null
    }
    Box(
        modifier
            .padding(ThesisSpace.m)
            .size(ThesisSpace.touchMin)
            .graphicsLayer {
                val pulled = progress().coerceIn(0f, 1f)
                alpha = if (refreshing) 1f else pulled
                translationY = (if (refreshing) 1f else pulled) * ThesisSpace.m.toPx() - ThesisSpace.m.toPx()
            }
            .clip(CircleShape)
            .drawBehind {
                drawCircle(p.surface)
                drawCircle(p.line, style = Stroke(ThesisSpace.border.toPx()))
                val stroke = Kit.ringStroke.toPx() * 1.5f
                val inset = size.minDimension * 0.3f
                val sweep = if (refreshing) {
                    Kit.REFRESH_SWEEP_SPINNING
                } else {
                    Kit.REFRESH_SWEEP_MAX * progress().coerceIn(0f, 1f)
                }
                val start = -90f + (spin?.value ?: 0f)
                drawArc(
                    color = p.ink,
                    startAngle = start,
                    sweepAngle = sweep,
                    useCenter = false,
                    topLeft = Offset(inset, inset),
                    size = Size(size.width - 2 * inset, size.height - 2 * inset),
                    style = Stroke(stroke, cap = StrokeCap.Round),
                )
            }
            .semantics {
                contentDescription = if (refreshing) "Refreshing" else "Pull to refresh"
                if (refreshing) progressBarRangeInfo = ProgressBarRangeInfo.Indeterminate
            },
    )
}
