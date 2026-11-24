// Preview implementation of app/.../ui/platform/CardShadow.kt (Android: drawBehind + framework
// Paint.setShadowLayer on API 28+, nothing on 26-27; section 2.7). Same public API; see F4 HANDOFF.
// Here Skia draws the equivalent: a rounded rect with a Gaussian mask filter (sigma = blur / 2, as CSS does).
package com.thesis.mobile.ui.platform

import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.Dp
import org.jetbrains.skia.FilterBlurMode
import org.jetbrains.skia.MaskFilter

/**
 * The Deep Dive card shadow, CSS `box-shadow: 0 <offsetY> <blur> <spread> <color>` (DD: `0 10px 28px -20px`,
 * ink @ 35%): a soft shadow under the bottom edge only, not a Material halo. The caller (the kit card) passes the
 * geometry so no literals live here; draw it before the card's own background. No-op when [enabled] is false
 * (dark theme: `palette.cardShadow`).
 */
fun Modifier.thesisCardShadow(
    enabled: Boolean,
    color: Color,
    cornerRadius: Dp,
    offsetY: Dp,
    blur: Dp,
    spread: Dp,
): Modifier {
    if (!enabled) return this
    return drawBehind {
        val spreadPx = spread.toPx()
        val left = -spreadPx
        val top = -spreadPx + offsetY.toPx()
        val right = size.width + spreadPx
        val bottom = size.height + spreadPx + offsetY.toPx()
        if (right <= left || bottom <= top) return@drawBehind
        val radius = (cornerRadius.toPx() + spreadPx).coerceAtLeast(0f)
        val sigma = blur.toPx() / 2f
        val paint = Paint()
        paint.asFrameworkPaint().apply {
            isAntiAlias = true
            this.color = color.toArgb()
            if (sigma > 0f) maskFilter = MaskFilter.makeBlur(FilterBlurMode.NORMAL, sigma)
        }
        drawIntoCanvas { canvas ->
            canvas.drawRoundRect(left, top, right, bottom, radius, radius, paint)
        }
    }
}
