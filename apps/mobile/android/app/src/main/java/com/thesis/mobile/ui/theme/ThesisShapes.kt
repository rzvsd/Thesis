package com.thesis.mobile.ui.theme

import androidx.compose.foundation.shape.CornerBasedShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Corner radii (docs/app-redesign/DESIGN-DIRECTION.md, section 2.6), the Deep Dive 2.0 values.
 *
 * Concentric rule: an element inset by `i` inside a shape of radius `r` uses `r - i` ([concentric]) or a pill.
 */
object ThesisShape {
    val CardRadius: Dp = 14.dp
    val PanelRadius: Dp = 12.dp
    val StatRadius: Dp = 10.dp
    val TileRadius: Dp = 8.dp
    val BadgeRadius: Dp = 6.dp
    val SheetRadius: Dp = 20.dp
    val DialogRadius: Dp = 20.dp
    /** Radius of the colour square inside a status badge (7 dp square). */
    val StatusSquareRadius: Dp = 2.dp

    /** Cards, report cards, sheets' inner cards. */
    val card: CornerBasedShape = RoundedCornerShape(CardRadius)
    /** Upshot/callout, KPI grid, price/range box, text fields, compare table. */
    val panel: CornerBasedShape = RoundedCornerShape(PanelRadius)
    /** Stat grids, no-data box. */
    val stat: CornerBasedShape = RoundedCornerShape(StatRadius)
    /** Icon tiles (28 x 28), tooltips. */
    val tile: CornerBasedShape = RoundedCornerShape(TileRadius)
    /** Status/phase badges, skeleton blocks. */
    val badge: CornerBasedShape = RoundedCornerShape(BadgeRadius)
    /** Chips, segments, buttons, the bottom dock. */
    val pill: CornerBasedShape = RoundedCornerShape(percent = 50)
    /** Bottom sheets and the dock panel: top corners only. */
    val sheet: CornerBasedShape = RoundedCornerShape(topStart = SheetRadius, topEnd = SheetRadius)
    val dialog: CornerBasedShape = RoundedCornerShape(DialogRadius)
    val statusSquare: CornerBasedShape = RoundedCornerShape(StatusSquareRadius)

    /** Radius for an element inset by [inset] inside a shape of radius [outer] (never below 0). */
    fun concentric(outer: Dp, inset: Dp): Dp = if (outer > inset) outer - inset else 0.dp
}

/**
 * Material3 shapes, so the M3 components we still use pick up the Deep Dive radii. `extraLarge` is the
 * 20 dp radius on all corners: M3 bottom sheets already take only its top corners (the `sheet` token), and
 * dialogs, which also read `extraLarge`, keep their bottom corners rounded.
 */
val ThesisMaterialShapes = Shapes(
    extraSmall = ThesisShape.badge,
    small = ThesisShape.tile,
    medium = ThesisShape.panel,
    large = ThesisShape.card,
    extraLarge = ThesisShape.dialog,
)
