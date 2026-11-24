package com.thesis.mobile.ui.theme

import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Spacing, layout and size tokens (docs/app-redesign/DESIGN-DIRECTION.md, section 2.5).
 *
 * Screens never write numeric dp literals (exceptions: 0.dp, Dp.Hairline, Dp.Unspecified); they use these.
 * Fixed heights are banned on anything containing text: use the size tokens with heightIn(min = ...).
 */
object ThesisSpace {
    // Spacing scale. Nothing else in screens.
    val xxs: Dp = 2.dp
    val xs: Dp = 4.dp
    val s: Dp = 8.dp
    val m: Dp = 12.dp
    val l: Dp = 16.dp
    val xl: Dp = 20.dp
    val xxl: Dp = 24.dp
    val x3: Dp = 32.dp
    val x4: Dp = 40.dp
    val x5: Dp = 56.dp

    // Layout
    /** Screen gutter on every screen (the Deep Dive gutter). */
    val gutter: Dp = 16.dp
    /** Reading screens: content max width, centred. */
    val contentMaxWidth: Dp = 640.dp
    /** Data screens (Names list, CompareTable, Compare names, History) may widen to this on wide windows. */
    val dataMaxWidth: Dp = 960.dp

    // The three named text edges (rubric T4), measured from the window edge.
    /** E0: screen headers, section headers, card edges. */
    val edge0: Dp = gutter
    /** E1: text inside a card (gutter + card padding). */
    val edge1: Dp = 32.dp
    /** E2: text in rows with the 24 dp leading column (16 + 16 + 24 + 12). */
    val edge2: Dp = 68.dp

    // Vertical rhythm
    /** Top bar to ScreenHeader. */
    val headerTop: Dp = s
    /** ScreenHeader to the first section. */
    val headerToSection: Dp = xxl
    /** Between sections on data screens (Home, Names, Inbox, History, Compare, Search). */
    val sectionGapData: Dp = xxl
    /** Between sections on reading screens (Macro Stress, Name, Weekly digest). */
    val sectionGapReading: Dp = x3
    /** Between cards inside a section. */
    val cardGap: Dp = m
    /** Padding inside a card. */
    val cardPadding: Dp = l
    /** Gap between blocks inside a card. */
    val cardInnerGap: Dp = m
    /** Vertical padding of a list row. */
    val rowPaddingV: Dp = m
    /** Long reads (Pulse brief, classic Deep Dive): chapter top and bottom padding. */
    val chapterPadding: Dp = x5
    /** Leading column of a row (status square, category square, icon). */
    val leadingColumn: Dp = 24.dp
    /** Gap after the leading column. */
    val leadingGap: Dp = m

    // Row heights (minimums)
    val rowMinComfortable: Dp = 56.dp
    val rowMinComfortableTwoLine: Dp = 64.dp
    val rowMinCompact: Dp = 48.dp

    // Sizes
    val touchMin: Dp = 48.dp
    val topBar: Dp = 56.dp
    /** Bottom bar height without the navigation inset. */
    val bottomBar: Dp = 64.dp
    val tapeRow: Dp = 44.dp
    /** Visual height of a button inside its 48 dp touch area. */
    val buttonVisual: Dp = 40.dp
    /** Visual height of a chip inside its 48 dp touch area. */
    val chipHeight: Dp = 36.dp
    /** Horizontal padding of buttons and chips. */
    val controlPaddingH: Dp = l
    val iconS: Dp = 16.dp
    val iconM: Dp = 20.dp
    val iconL: Dp = 24.dp
    /** Icon tile (28 x 28, tile radius). */
    val iconTile: Dp = 28.dp
    val avatar: Dp = 32.dp
    val statusSquare: Dp = 7.dp
    val liveDot: Dp = 6.dp
    /** New-alerts dot on the Inbox tab and alert rows. */
    val newDot: Dp = 6.dp
    /** Dividers: the thinnest line the display can draw. */
    val hairline: Dp = Dp.Hairline
    /** Card and control borders. */
    val border: Dp = 1.dp
    /** Dashed "Not seen yet" border and selection-control strokes. */
    val borderStrong: Dp = 1.5.dp
    /** Focused text-field border. */
    val borderFocus: Dp = 2.dp
    /** Upshot accent bar inside the left edge. */
    val accentBar: Dp = 3.dp
    /** Sheet drag handle. */
    val dragHandleWidth: Dp = 36.dp
    val dragHandleHeight: Dp = 4.dp
    /** Minimum height of a text field. */
    val fieldMinHeight: Dp = 56.dp
}
