package com.thesis.mobile.ui.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.copy.KitCopy
import com.thesis.mobile.ui.motion.MotionCopy
import com.thesis.mobile.ui.motion.ThesisPullRefresh
import com.thesis.mobile.ui.motion.ThesisTransitions
import com.thesis.mobile.ui.theme.LocalReducedMotion

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
 * Crossfades between [Loadable] kinds (#27, 4.4): fade out Quick with EaseExit, fade in Base after a 60 ms delay
 * (EaseStandard), the size change on the `spatial` spring; a change inside the same kind (Ready→Ready, a new
 * error message) recomposes in place with no transition. Under reduced motion it is a 150 ms crossfade (4.8: no
 * information lost) and the size snaps. The spec is the motion kit's `ThesisTransitions.stateCrossfade`. The
 * slots default to the kit's skeleton, [EmptyState] and [ErrorState]; the default error title is
 * "Couldn’t load [failedSubject]" (#26), e.g. `failedSubject = "your names"`.
 */
@Composable
fun <T> StateCrossfade(
    state: Loadable<T>,
    modifier: Modifier = Modifier,
    onRetry: (() -> Unit)? = null,
    loading: @Composable () -> Unit = { SkeletonCard() },
    failedSubject: String? = null,
    empty: @Composable (Loadable.Empty) -> Unit = { EmptyState(sentence = it.sentence ?: KitCopy.NOTHING_HERE) },
    failed: @Composable (Loadable.Failed) -> Unit = {
        ErrorState(
            title = KitCopy.couldNotLoad(failedSubject),
            cause = it.cause,
            onRetry = if (it.retryable) onRetry else null,
        )
    },
    ready: @Composable (T) -> Unit,
) {
    val reduced = LocalReducedMotion.current
    AnimatedContent(
        targetState = state,
        modifier = modifier,
        contentKey = { it.kind },
        transitionSpec = { ThesisTransitions.stateCrossfade(reduced) },
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
 * Pull to refresh (#34, 4.4): the one entry point screens call. It delegates to the motion kit's
 * `ThesisPullRefresh`: the content follows the pull, a hairline grows from the centre (`accent` once armed, with
 * the `threshold()` haptic) and, while [refreshing], the `HairlineLoop` highlight travels across a 16 dp gap; a
 * TalkBack "Refresh" action and a polite "Refreshing" status. [refreshing] must come from the ViewModel (no fake
 * delays). [refreshLabel] / [refreshingLabel] are the accessibility copy.
 */
@Composable
fun ThesisRefreshBox(
    refreshing: Boolean,
    onRefresh: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    indicatorTop: Dp = 0.dp,
    refreshLabel: String = MotionCopy.REFRESH,
    refreshingLabel: String = MotionCopy.REFRESHING,
    content: @Composable BoxScope.() -> Unit,
) {
    ThesisPullRefresh(
        refreshing = refreshing,
        onRefresh = onRefresh,
        modifier = modifier,
        enabled = enabled,
        indicatorTop = indicatorTop,
        refreshLabel = refreshLabel,
        refreshingLabel = refreshingLabel,
        content = content,
    )
}
