package com.thesis.mobile.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Canvas
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.drawscope.CanvasDrawScope
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.toSize
import com.thesis.mobile.ui.platform.RenderFlags
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisSurface
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

/*
 * The page background (docs/app-redesign/DESIGN-DIRECTION.md, section 2.7; geometry in
 * deep-dive-visual-language.md 5.1 and 10.3): a 165 degree `bg -> bg2` gradient, a gold ellipse at the top right
 * and a blue one at the bottom left. Static: no drift, no breathing, no grain.
 *
 * It is rasterised once per (window size, palette) into an ImageBitmap held by a [PageBackgroundCache]. Every
 * ThesisScreen paints it opaque from that bitmap, and the bars (collapsed top bar, sticky ChapterPills, bottom bar,
 * RunBar, DayHeader) draw the same bitmap in window coordinates at 92%, so there is no seam through the glow.
 */

/**
 * Holds the rasterised page background. Provide one at the shell root with [ProvidePageBackground]; a
 * [ThesisScreen] without one (previews, tests) creates its own for its size.
 */
@Stable
class PageBackgroundCache {
    /** Size of the area the bitmap covers (the window, or the screen when there is no shell). */
    var areaSize: IntSize by mutableStateOf(IntSize.Zero)
        internal set

    /** Window position of that area's top-left corner. */
    var areaOrigin: Offset by mutableStateOf(Offset.Zero)
        internal set

    private var key: Any? = null
    private var bitmap: ImageBitmap? = null

    /** The bitmap for [palette] at [areaSize], rebuilt only when the size, palette or glow flag changes. */
    fun bitmapFor(palette: ThesisPalette, density: Density): ImageBitmap? {
        val size = areaSize
        if (size.width <= 0 || size.height <= 0) return null
        val glows = RenderFlags.pageGlow
        val newKey = listOf(size, palette.bg, palette.bg2, palette.glowGold, palette.glowBlue, glows, density.density)
        bitmap?.let { if (key == newKey) return it }
        val image = ImageBitmap(size.width, size.height)
        CanvasDrawScope().draw(density, LayoutDirection.Ltr, Canvas(image), size.toSize()) {
            drawPageBackground(palette, glows)
        }
        key = newKey
        bitmap = image
        return image
    }
}

/** The cache provided by the shell (or by the nearest ThesisScreen), or null. */
val LocalPageBackgroundCache = staticCompositionLocalOf<PageBackgroundCache?> { null }

/**
 * Shell root: fills `bg` (what shows while predictive back scales a screen) and provides one
 * [PageBackgroundCache] sized to this box, normally the window.
 */
@Composable
fun ProvidePageBackground(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    val p = LocalThesisPalette.current
    val cache = remember { PageBackgroundCache() }
    Box(
        modifier
            .fillMaxSize()
            .background(p.bg)
            .onSizeChanged { cache.areaSize = it }
            .onGloballyPositioned { cache.areaOrigin = it.positionInWindow() },
    ) {
        CompositionLocalProvider(LocalPageBackgroundCache provides cache, content = content)
    }
}

/**
 * Paints the page background behind this node, opaque. Draws the slice of the shared bitmap under this node's
 * window position (so it stays fixed while content or a push transition moves); without a cache it draws directly.
 */
fun Modifier.pageBackground(p: ThesisPalette): Modifier = composed {
    val cache = LocalPageBackgroundCache.current
    val density = LocalDensity.current
    var position by remember { mutableStateOf(Offset.Zero) }
    this
        .onGloballyPositioned { position = it.positionInWindow() }
        .drawBehind {
            val image = cache?.bitmapFor(p, density)
            if (image == null) {
                drawPageBackground(p, RenderFlags.pageGlow)
            } else {
                drawRect(p.bg)
                drawAreaSlice(image, position - cache.areaOrigin, alpha = 1f)
            }
        }
}

/** Where a bar draws its hairline. */
enum class BarHairline { None, Top, Bottom }

/**
 * Bar background: the page bitmap under this node at [opacity] (default [ThesisSurface.BAR_ALPHA]), plus a `line`
 * hairline. [visible] (0..1, read in the draw phase) fades both in, for the top bar that is transparent at rest.
 * Without a cache it falls back to `bg` at the same alpha. Pass [opacity] = 1 where the bar can sit over a HeroBand:
 * at 92% the band's white title ghosts through the light bar as readable text, not as glow.
 */
fun Modifier.barBackground(
    hairline: BarHairline = BarHairline.Bottom,
    opacity: Float = ThesisSurface.BAR_ALPHA,
    visible: () -> Float = { 1f },
): Modifier = composed {
    val p = LocalThesisPalette.current
    val cache = LocalPageBackgroundCache.current
    val density = LocalDensity.current
    var position by remember { mutableStateOf(Offset.Zero) }
    this
        .onGloballyPositioned { position = it.positionInWindow() }
        .drawBehind {
            val v = visible().coerceIn(0f, 1f)
            if (v <= 0f) return@drawBehind
            val image = cache?.bitmapFor(p, density)
            if (image == null) {
                drawRect(p.bg, alpha = opacity * v)
            } else {
                drawAreaSlice(image, position - cache.areaOrigin, alpha = opacity * v)
            }
            drawBarHairline(p.line, hairline, alpha = v)
        }
}

/** A bar's 1 dp hairline in [color] along the [edge] of this draw scope. */
internal fun DrawScope.drawBarHairline(color: Color, edge: BarHairline, alpha: Float = 1f) {
    val stroke = ThesisSpace.border.toPx()
    when (edge) {
        BarHairline.None -> Unit
        BarHairline.Top -> drawRect(color, size = Size(size.width, stroke), alpha = alpha)
        BarHairline.Bottom ->
            drawRect(color, topLeft = Offset(0f, size.height - stroke), size = Size(size.width, stroke), alpha = alpha)
    }
}

/** Draws the part of [image] under this node, whose top-left sits at [offset] in the image's coordinates. */
private fun DrawScope.drawAreaSlice(image: ImageBitmap, offset: Offset, alpha: Float) {
    val x = offset.x.roundToInt()
    val y = offset.y.roundToInt()
    val w = size.width.roundToInt()
    val h = size.height.roundToInt()
    val srcX = x.coerceIn(0, image.width)
    val srcY = y.coerceIn(0, image.height)
    val srcW = min(x + w, image.width) - srcX
    val srcH = min(y + h, image.height) - srcY
    if (srcW <= 0 || srcH <= 0) {
        return
    }
    drawImage(
        image = image,
        srcOffset = IntOffset(srcX, srcY),
        srcSize = IntSize(srcW, srcH),
        dstOffset = IntOffset(srcX - x, srcY - y),
        dstSize = IntSize(srcW, srcH),
        alpha = alpha,
    )
}

/** The page background itself, at this scope's size. */
internal fun DrawScope.drawPageBackground(p: ThesisPalette, glows: Boolean) {
    drawCssLinearGradient(p.bg, p.bg2, ThesisSurface.PAGE_ANGLE_DEG)
    if (!glows) return
    val gold = ThesisSurface.PageGold
    val blue = ThesisSurface.PageBlue
    clipRect {
        drawGlow(
            color = p.glowGold,
            center = Offset(size.width, 0f),
            rx = min(size.width * gold.radiusXFraction, gold.maxRadiusX.toPx()),
            ry = gold.radiusY.toPx(),
            stop = gold.stop,
        )
        drawGlow(
            color = p.glowBlue,
            center = Offset(0f, size.height),
            rx = min(size.width * blue.radiusXFraction, blue.maxRadiusX.toPx()),
            ry = blue.radiusY.toPx(),
            stop = blue.stop,
        )
    }
}

/** The HeroBand background (deep-dive-visual-language.md 5.2) for the hero palette [hero], plus its gold hairline. */
internal fun DrawScope.drawHeroBackground(hero: ThesisPalette, glows: Boolean) {
    drawCssLinearGradient(hero.bg, hero.bg2, ThesisSurface.PAGE_ANGLE_DEG)
    if (glows) {
        val gold = ThesisSurface.HeroGold
        val blue = ThesisSurface.HeroBlue
        clipRect {
            drawGlow(
                color = hero.glowGold,
                center = Offset(size.width, 0f),
                rx = size.width * gold.radiusXFraction,
                ry = size.height * gold.radiusYFraction,
                stop = gold.stop,
            )
            drawGlow(
                color = hero.glowBlue,
                center = Offset(0f, size.height),
                rx = size.width * blue.radiusXFraction,
                ry = size.height * blue.radiusYFraction,
                stop = blue.stop,
            )
        }
    }
    val stroke = ThesisSpace.border.toPx()
    val clear = hero.accent.copy(alpha = 0f)
    drawRect(
        brush = Brush.horizontalGradient(
            0f to clear,
            ThesisSurface.HERO_HAIRLINE_FROM to hero.accent,
            ThesisSurface.HERO_HAIRLINE_TO to hero.accent,
            1f to clear,
        ),
        topLeft = Offset(0f, size.height - stroke),
        size = Size(size.width, stroke),
        alpha = ThesisSurface.HERO_HAIRLINE_ALPHA,
    )
}

/** A CSS `linear-gradient(<angle>deg, from, to)` over this scope: the gradient line spans the box's corners. */
internal fun DrawScope.drawCssLinearGradient(from: Color, to: Color, angleDeg: Float) {
    val radians = Math.toRadians(angleDeg.toDouble())
    val dx = sin(radians).toFloat()
    val dy = -cos(radians).toFloat()
    val length = abs(size.width * dx) + abs(size.height * dy)
    val c = center
    val start = Offset(c.x - dx * length / 2f, c.y - dy * length / 2f)
    val end = Offset(c.x + dx * length / 2f, c.y + dy * length / 2f)
    drawRect(Brush.linearGradient(listOf(from, to), start = start, end = end))
}

/**
 * A CSS elliptical radial glow: [color] at [center] fading to transparent at [stop] of radii [rx] x [ry].
 * Brush.radialGradient is circular, so a circle of radius [ry] is scaled horizontally by rx / ry.
 */
internal fun DrawScope.drawGlow(color: Color, center: Offset, rx: Float, ry: Float, stop: Float) {
    if (rx <= 0f || ry <= 0f || color.alpha <= 0f) return
    val brush = Brush.radialGradient(
        0f to color,
        stop to color.copy(alpha = 0f),
        center = center,
        radius = ry,
    )
    withTransform({ scale(scaleX = rx / ry, scaleY = 1f, pivot = center) }) {
        drawRect(brush, topLeft = Offset(center.x - ry, center.y - ry), size = Size(ry * 2f, ry * 2f))
    }
}
