package com.thesis.mobile.ui.screens

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Dp
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType

/**
 * True when every one of [options] fits on one line in its segment of a kit `SegmentedControl` that is
 * [controlWidth] wide (equal segments, each less the segment inset and the label's own padding on both sides),
 * at the current font scale. The kit segment keeps its label on one line (maxLines = 1) and cuts what does not fit,
 * so a screen measures first and picks shorter labels or another control where this is false (A4: 2.0x on 360 dp).
 */
@Composable
internal fun segmentLabelsFit(options: List<String>, controlWidth: Dp): Boolean {
    val measurer = rememberTextMeasurer()
    val density = LocalDensity.current
    val longest = options.maxOf { measurer.measure(it, ThesisType.label).size.width }
    val segment = with(density) {
        // The kit's segment inset (4 dp, ThesisSpace.xs) plus the label's horizontal padding (ThesisSpace.s).
        (controlWidth / options.size - (ThesisSpace.xs + ThesisSpace.s) * 2).toPx()
    }
    return longest <= segment
}
