package com.thesis.mobile.ui.motion

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.lerp
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onPlaced
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.util.lerp
import com.thesis.mobile.ui.platform.BackSwipeEdge
import com.thesis.mobile.ui.platform.ThesisPredictiveBackHandler
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisShape
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

/*
 * Container transform without SharedTransitionLayout (docs/app-redesign/DESIGN-DIRECTION.md 3 #41, 4.5; playbook
 * 8a, adapted: ThesisPredictiveBackHandler instead of activity-compose, palette colours, ThesisMotion timings).
 *
 * The list row you tap becomes the page: the detail is laid out once at full size and only a clip rect, a
 * translation and alphas change per frame (no relayout). The clip grows from the row's bounds to the host, the
 * row's corner radius goes to 0, the fill goes from `surface` to `bg`, and the detail fades in over the last 70%.
 * 300 ms in, 240 ms out (`EaseStandard`). Predictive back scales the page toward .90 at the swipe edge and shifts it
 * 8 dp; commit closes (the page shrinks back into the row), cancel settles on `spatialSlow`.
 * Reduced motion: a 150 ms crossfade at full size, no scale preview.
 */

/** Holds the last placed coordinates of a tapped row, so its bounds are read at click time only. */
@Stable
class BoundsCapture {
    internal var coordinates: LayoutCoordinates? = null

    /** The row's bounds in the root, or null when it is not placed (scrolled away, disposed). */
    fun boundsInRoot(): Rect? = coordinates?.takeIf { it.isAttached }?.boundsInRoot()
}

/** A [BoundsCapture] for one row. */
@Composable
fun rememberBoundsCapture(): BoundsCapture = remember { BoundsCapture() }

/** Records this node's coordinates in [capture] on placement (no per-frame work in the list). */
fun Modifier.captureBounds(capture: BoundsCapture): Modifier = onPlaced { capture.coordinates = it }

/**
 * Hosts a list and the detail of the item [openKey] (null = only the list). [origin] is the tapped row's bounds in
 * root ([BoundsCapture.boundsInRoot] at click time); null grows from the whole host. [onClose] is called on back
 * (system or predictive): the caller sets [openKey] to null, and the page shrinks back into the row. The detail
 * must be opaque (a `ThesisScreen`). [cornerFrom] is the row's corner radius (a RowGroup middle row: 0 dp).
 */
@Composable
fun <K : Any> ContainerTransformHost(
    openKey: K?,
    origin: Rect?,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
    cornerFrom: Dp = ThesisShape.CardRadius,
    list: @Composable () -> Unit,
    detail: @Composable (K) -> Unit,
) {
    val reduced = LocalReducedMotion.current
    val p = LocalThesisPalette.current
    val progress = remember { Animatable(0f) } // 0 = the row, 1 = the full page
    val back = remember { Animatable(0f) } // predictive-back preview, 0..1
    var backEdge by remember { mutableStateOf(BackSwipeEdge.Left) }
    var shownKey by remember { mutableStateOf<K?>(null) } // keeps the detail composed while it closes
    var shownOrigin by remember { mutableStateOf<Rect?>(null) }
    var host by remember { mutableStateOf(Rect.Zero) }
    val scope = rememberCoroutineScope()
    val close by rememberUpdatedState(onClose)

    LaunchedEffect(openKey) {
        if (openKey != null) {
            shownKey = openKey
            shownOrigin = origin
            back.snapTo(0f)
            progress.animateTo(1f, tween(if (reduced) ThesisMotion.Quick else ThesisMotion.Screen, easing = ThesisMotion.EaseStandard))
        } else if (shownKey != null) {
            progress.animateTo(0f, tween(if (reduced) ThesisMotion.Quick else ThesisMotion.ScreenOut, easing = ThesisMotion.EaseStandard))
            shownKey = null
            back.snapTo(0f)
        }
    }

    ThesisPredictiveBackHandler(enabled = openKey != null) { events ->
        try {
            events.collect { e ->
                backEdge = e.swipeEdge
                if (!reduced) back.snapTo(e.progress)
            }
            close()
        } catch (e: CancellationException) {
            scope.launch { back.animateTo(0f, ThesisMotion.spatialSlow()) }
            throw e
        }
    }

    Box(modifier.fillMaxSize().onGloballyPositioned { host = it.boundsInRoot() }) {
        Box(if (shownKey != null) Modifier.clearAndSetSemantics { } else Modifier) { list() }

        val key = shownKey ?: return@Box
        val full = Rect(0f, 0f, host.width, host.height)
        val from = if (reduced) full else (shownOrigin ?: host).translate(-host.left, -host.top)

        // The list recedes under the scrim while the page grows over it.
        Box(Modifier.fillMaxSize().drawBehind { drawRect(p.scrim, alpha = progress.value) })
        Box(
            Modifier
                .fillMaxSize()
                .pointerInput(Unit) { } // the list underneath gets no touches while a page is over it
                .predictiveBackPreview({ back.value }, { backEdge })
                .containerReveal(from, { progress.value }, { back.value }, cornerFrom, p.surface, p.bg),
        ) {
            Box(
                Modifier.graphicsLayer {
                    val t = progress.value
                    alpha = if (reduced) t else ((t - ThesisMotion.TransformContentFrom) / (1f - ThesisMotion.TransformContentFrom)).coerceIn(0f, 1f)
                },
            ) { detail(key) }
        }
    }
}

/**
 * Predictive-back preview for a page: scales toward [ThesisMotion.BackScaleTo] around the edge opposite the swipe
 * and shifts [ThesisMotion.BackShift] toward it, with [progress] 0..1. Layer-phase reads only.
 */
fun Modifier.predictiveBackPreview(progress: () -> Float, edge: () -> BackSwipeEdge): Modifier = graphicsLayer {
    val b = progress()
    if (b > 0f) {
        val s = lerp(1f, ThesisMotion.BackScaleTo, b)
        scaleX = s
        scaleY = s
        val fromLeft = edge() == BackSwipeEdge.Left
        transformOrigin = TransformOrigin(if (fromLeft) 1f else 0f, 0.5f)
        translationX = (if (fromLeft) 1f else -1f) * ThesisMotion.BackShift.toPx() * b
    }
}

/**
 * The clip-reveal itself: clips the content to [from] lerped to the full bounds by [progress], with corners
 * [cornerFrom] -> 0 (a predictive-back preview rounds them again toward the sheet radius), fills the clip with
 * [fromColor] -> [toColor] and draws the content translated to the clip's top-left. Draw-phase reads; the clip
 * path is reused.
 */
fun Modifier.containerReveal(
    from: Rect,
    progress: () -> Float,
    back: () -> Float,
    cornerFrom: Dp,
    fromColor: Color,
    toColor: Color,
): Modifier = drawWithCache {
    val clip = Path()
    val full = Rect(0f, 0f, size.width, size.height)
    val cornerFromPx = cornerFrom.toPx()
    val backCornerPx = ThesisShape.SheetRadius.toPx()
    onDrawWithContent {
        val t = progress()
        val r = lerp(from, full, t)
        val corner = maxOf(lerp(cornerFromPx, 0f, t), backCornerPx * back())
        clip.reset()
        clip.addRoundRect(RoundRect(r, CornerRadius(corner)))
        clipPath(clip) {
            drawRect(lerp(fromColor, toColor, t))
            translate(left = r.left, top = r.top) { this@onDrawWithContent.drawContent() }
        }
    }
}
