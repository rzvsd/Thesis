package com.thesis.mobile.ui.platform

import android.os.Build
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.Dp

/**
 * The Deep Dive card shadow, CSS `box-shadow: 0 <offsetY> <blur> <spread> <color>` (DD: `0 10px 28px -20px`,
 * ink @ 35%; docs/app-redesign/DESIGN-DIRECTION.md, section 2.7): a soft shadow under the bottom edge only, not
 * a Material halo. Drawn with the framework paint's shadow layer, which hardware canvases support for shapes from
 * API 28. On API 26-27 (no shadow layer on a hardware canvas) a one-pixel hairline in [color] under the bottom edge,
 * between the corners, stands in for it, so light cards still sit on the page. The caller (the kit card) passes the
 * geometry from tokens and draws it before its own clip and background. No-op when [enabled] is false (dark theme:
 * `palette.cardShadow`).
 * design-preview compiles its shim (a Skia blur of the same geometry) instead: keep the public API identical.
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
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return drawBehind {
        val radius = cornerRadius.toPx()
        if (size.width <= radius * 2f) return@drawBehind
        val y = size.height + 0.5f // the pixel row just under the card
        drawLine(color, start = Offset(radius, y), end = Offset(size.width - radius, y), strokeWidth = 1f)
    }
    return drawBehind {
        val spreadPx = spread.toPx()
        val left = -spreadPx
        val top = -spreadPx
        val right = size.width + spreadPx
        val bottom = size.height + spreadPx
        if (right <= left || bottom <= top) return@drawBehind
        val radius = (cornerRadius.toPx() + spreadPx).coerceAtLeast(0f)
        // CSS blur B is a Gaussian sigma of B/2; Android converts a shadow radius r to sigma 0.57735 r + 0.5.
        val shadowRadius = ((blur.toPx() / 2f - 0.5f) / 0.57735f).coerceAtLeast(0f)
        val paint = Paint()
        paint.asFrameworkPaint().apply {
            isAntiAlias = true
            this.color = android.graphics.Color.TRANSPARENT // only the shadow is drawn
            setShadowLayer(shadowRadius, 0f, offsetY.toPx(), color.toArgb())
        }
        drawIntoCanvas { it.drawRoundRect(left, top, right, bottom, radius, radius, paint) }
    }
}
