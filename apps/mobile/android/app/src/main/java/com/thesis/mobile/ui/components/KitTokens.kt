package com.thesis.mobile.ui.components

import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import com.thesis.mobile.ui.theme.ThesisSpace

/**
 * Component-internal geometry that section 2.5 does not name (Deep Dive values from deep-dive-visual-language.md
 * section 4). Kept in one place so no other kit file holds a numeric dp; HANDOFF-F2.md asks F1 to adopt these
 * into ThesisSpace, after which this object forwards to them. Screens never read it (internal).
 */
internal object Kit {
    /** Status badge vertical padding (DD phase badge 3 x 8). */
    val badgePaddingV: Dp = 3.dp

    /** KPI cell horizontal padding (DD 12 x 14). */
    val kpiCellPaddingH: Dp = 14.dp

    /** KPI grid: 3 columns from this width (2 below). */
    val kpiThreeColumnsFrom: Dp = 560.dp

    /** Gap between chips in a ChipRow and badges in a FlowRow (DD chip nav gap 6). */
    val chipGap: Dp = 6.dp

    /** SegmentedControl inner padding around the indicator. */
    val segmentInset: Dp = 4.dp

    /** StageProgress ring and the NoteBlock saved check. */
    val stageRing: Dp = 12.dp

    /** Ring stroke for StageProgress, selection controls and the arc spinner. */
    val ringStroke: Dp = 1.5.dp

    /** Checkbox box and radio ring. */
    val selectionControl: Dp = 18.dp

    /** Radio dot. */
    val radioDot: Dp = 8.dp

    /** Meter track height in lists and grids. */
    val meterTrack: Dp = 4.dp

    /** Meter track height for the one subject meter. */
    val meterTrackSubject: Dp = 8.dp

    /** PagerDots dot. */
    val pagerDot: Dp = 6.dp

    /** LiveDot ring growth (3 dp at rest to 5 dp at the peak). */
    val liveRingFrom: Dp = 3.dp
    val liveRingTo: Dp = 5.dp

    /** Chart area height: compact cards (featured charts use 240, PR-2 chart kit). */
    val chartCompact: Dp = 180.dp

    /** ChartReadout cursor dot. */
    val readoutDot: Dp = 4.dp

    /** Dashed border pattern for "Not seen yet" (dash, gap). */
    val dash: Dp = 6.dp
    val dashGap: Dp = 4.dp

    /** Link underline offset below the baseline. */
    val underlineOffset: Dp = 2.dp

    /** CompareTable: minimum value column width and cell padding. */
    val tableColumnMin: Dp = 88.dp
    val tableCellPaddingH: Dp = 12.dp
    val tableCellPaddingV: Dp = 10.dp

    /** CompareTable scroll cue: ink at this alpha, fading in at the edge where more columns wait. */
    const val TABLE_SCROLL_SHADE_ALPHA = 0.12f

    /**
     * ThesisTextField: how far the floating label stands above the outline. Material3 1.2.1 pads an
     * OutlinedTextField with a label by a fixed 8 dp at the top (internal `OutlinedTextFieldTopPadding`); the
     * kit's own fill starts this far down so it lines up with the outline.
     */
    val fieldLabelOverhang: Dp = ThesisSpace.s

    /** SuggestionList: rows shown before it scrolls. */
    const val SUGGESTIONS_MAX = 6

    /** Status badge text tracking (DD .phase: 11/600, .03em, sentence case). */
    val badgeTracking = 0.03.em

    /** Highlighter band: from 54% to 96% of the line box (DD .story .o). */
    const val HIGHLIGHT_FROM = 0.54f
    const val HIGHLIGHT_TO = 0.96f

    /** Drop cap size relative to the story font size (DD 3.6em over two lines; tuned to 2 Newsreader lines). */
    const val DROP_CAP_SCALE = 3.25f

    /** LoadingHairline highlight: share of the width and its accent alpha. */
    const val HAIRLINE_HIGHLIGHT_WIDTH = 0.20f
    const val HAIRLINE_HIGHLIGHT_ALPHA = 0.20f

    /** Meter fill in lists and grids: ink2 at this alpha. */
    const val METER_FILL_ALPHA = 0.60f

    /** StatusBadge border: tone colour mixed into line2 by this share. */
    const val BADGE_TONE_MIX = 0.55f

    /** LiveDot ring alpha (peak to rest). */
    const val LIVE_RING_ALPHA_FROM = 0.18f
    const val LIVE_RING_ALPHA_TO = 0.06f

    /** Chart fignum ("CHART 3") accent alpha (DD .9). */
    const val FIGNUM_ALPHA = 0.90f

    /** DockPanel detents, as a share of the window height. */
    const val DOCK_DETENT_HALF = 0.45f
    const val DOCK_DETENT_FULL = 0.85f

    /** NoteBlock preview lines and NotesTrail older-entry preview lines. */
    const val NOTE_PREVIEW_LINES = 3
    const val TRAIL_PREVIEW_LINES = 4

    /** Snackbar on screen: plain, and with an action (Undo). */
    const val SNACKBAR_MS = 4_000L
    const val SNACKBAR_ACTION_MS = 8_000L

    /** Pull-to-refresh arc: sweep at full pull and while refreshing (degrees). */
    const val REFRESH_SWEEP_MAX = 300f
    const val REFRESH_SWEEP_SPINNING = 90f
}
