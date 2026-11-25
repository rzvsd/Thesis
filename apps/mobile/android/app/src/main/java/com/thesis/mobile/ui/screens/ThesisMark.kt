package com.thesis.mobile.ui.screens

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import com.thesis.mobile.ui.theme.ThesisSpace

/**
 * The Thesis "T" mark (WP-G): a bracketed serif T, the same outline as the launcher icon and the splash mark
 * (`res/drawable/ic_mark_t.xml`, which scales this path into the adaptive icon's 66 dp safe zone). Keep the two
 * path strings identical.
 */
internal const val THESIS_MARK_PATH =
    "M10,12H90V31H88.5C87.5,24 85,20.5 78,20.5H55.5V84C55.5,87 57.5,88 62,88.5H66V91H34V88.5H38" +
        "C42.5,88 44.5,87 44.5,84V20.5H22C15,20.5 12.5,24 11.5,31H10Z"

/** Viewport of [THESIS_MARK_PATH]. */
private const val MARK_VIEWPORT = 100f

/**
 * The mark as a vector filled with [color], a palette token (the caller passes `accent`): draw it with `Image`, so
 * no colour literal and no tint are involved.
 */
@Composable
internal fun rememberThesisMark(color: Color): ImageVector = remember(color) {
    ImageVector.Builder(
        name = "ThesisMark",
        defaultWidth = ThesisSpace.iconL,
        defaultHeight = ThesisSpace.iconL,
        viewportWidth = MARK_VIEWPORT,
        viewportHeight = MARK_VIEWPORT,
    )
        .addPath(pathData = addPathNodes(THESIS_MARK_PATH), fill = SolidColor(color))
        .build()
}
