package com.thesis.mobile.ui.screens

import androidx.compose.foundation.ScrollState
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.Dp

/**
 * Fades the bottom [fade] of a scrolling block out while more of it is below, so text cut at the viewport's edge
 * reads as "keeps going" rather than as truncated (verticalScroll draws no scrollbar). A mask on this node's own
 * layer: put it outside the scroll, so it stays at the viewport's bottom edge; nothing is drawn when the content
 * fits. [mask] is any opaque palette colour; only its alpha is used.
 */
internal fun Modifier.fadeWhenMoreBelow(scroll: ScrollState, mask: Color, fade: Dp): Modifier = this
    .graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
    .drawWithContent {
        drawContent()
        if (scroll.canScrollForward) {
            val height = fade.toPx().coerceAtMost(size.height)
            drawRect(
                // DstOut keeps the content where the mask is clear and removes it where the mask is opaque.
                brush = Brush.verticalGradient(
                    colors = listOf(Color.Transparent, mask),
                    startY = size.height - height,
                    endY = size.height,
                ),
                blendMode = BlendMode.DstOut,
            )
        }
    }
