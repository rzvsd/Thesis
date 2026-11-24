package com.thesis.mobile.ui.motion

import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawOutline
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.util.lerp
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

/*
 * The one press language (docs/app-redesign/DESIGN-DIRECTION.md, sections 1.2 principle 9 and 4.4).
 *
 * On touch-down an `ink` tint (ThesisMotion.pressTint: 6% on paper, 8% on graphite) fades in over `Press`
 * (90 ms) and fades out over `Quick` on release. Standalone buttons and cards also scale to 0.97 and come back
 * with `pressRelease`. No ripple, no border flash, no darkening, and no custom Indication class (deprecated in
 * Compose 1.7): kit clickables use `clickable(interactionSource, indication = null)` + [thesisPress].
 * Everything is read in the layer and draw phases, so a press never recomposes the component.
 */

/** Animated press state: [tint] and [scale] progress, both 0 (rest) to 1 (pressed). */
@Stable
class PressProgress internal constructor() {
    internal val tint = Animatable(0f)
    internal val scale = Animatable(0f)

    /** Tint progress, 0..1. Read it in the draw phase. */
    val tintValue: Float get() = tint.value

    /** Scale progress, 0..1. Read it in the layer phase. */
    val scaleValue: Float get() = scale.value
}

/**
 * Follows [source]'s press interactions. Driven by the interaction stream (not `collectIsPressedAsState`), so a
 * 40 ms tap inside a scrolling list still shows a complete dip: a release that arrives before the press-in has
 * finished first completes it, then fades out.
 */
@Composable
fun rememberPressProgress(source: InteractionSource): PressProgress {
    val progress = remember { PressProgress() }
    LaunchedEffect(source) {
        source.interactions.collectLatest { interaction ->
            when (interaction) {
                is PressInteraction.Press -> coroutineScope {
                    launch { progress.tint.animateTo(1f, ThesisMotion.pressIn()) }
                    launch { progress.scale.animateTo(1f, ThesisMotion.pressIn()) }
                }
                is PressInteraction.Release, is PressInteraction.Cancel -> coroutineScope {
                    launch {
                        if (progress.tint.value < 1f) progress.tint.animateTo(1f, ThesisMotion.pressIn())
                        progress.tint.animateTo(0f, ThesisMotion.quick())
                    }
                    launch {
                        if (progress.scale.value < 1f) progress.scale.animateTo(1f, ThesisMotion.pressIn())
                        progress.scale.animateTo(0f, ThesisMotion.pressRelease())
                    }
                }
            }
        }
    }
    return progress
}

/**
 * Draws the kit press feedback for [interactionSource]: the ink tint over the content (clipped to [shape] when
 * given, otherwise the full bounds, which is what rows inside a RowGroup want) and, when [scale] is true, the
 * 0.97 press scale. Put it before the component's own clip and background so the scale includes them; pair it
 * with `clickable(interactionSource, indication = null, ...)` on the same or an enclosing node.
 *
 * Under reduced motion the tint stays and the scale is dropped (section 4.8). [enabled] = false draws nothing.
 */
fun Modifier.thesisPress(
    interactionSource: InteractionSource,
    scale: Boolean = false,
    shape: Shape? = null,
    enabled: Boolean = true,
): Modifier = composed {
    if (!enabled) return@composed Modifier
    val progress = rememberPressProgress(interactionSource)
    val reduced = LocalReducedMotion.current
    val tint = ThesisMotion.pressTint(LocalThesisPalette.current)
    val scaled = if (scale && !reduced) {
        Modifier.graphicsLayer {
            val s = lerp(1f, ThesisMotion.PressScaleButton, progress.scaleValue)
            scaleX = s
            scaleY = s
        }
    } else {
        Modifier
    }
    scaled.drawWithContent {
        drawContent()
        val t = progress.tintValue
        if (t > 0f) drawPressTint(tint, t, shape)
    }
}

private fun androidx.compose.ui.graphics.drawscope.ContentDrawScope.drawPressTint(tint: Color, t: Float, shape: Shape?) {
    if (shape == null) {
        drawRect(tint, alpha = t)
    } else {
        drawOutline(shape.createOutline(size, layoutDirection, this), tint, alpha = t)
    }
}
