package com.thesis.mobile.preview

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.UpDownScheme
import java.io.File

/*
 * Kit gallery scaffold (section 3: "every component has a dark and light render in the kit gallery").
 *
 *   @Test fun buttons() = renderGallery("kit-buttons") {
 *       Specimen("PrimaryButton", "default / pressed / disabled / loading") { PrimaryButton(...) }
 *       Specimen("SecondaryButton") { ... }
 *   }
 *
 * renderGallery lays the specimens out in one column on the page colour, crops the PNG to their height and
 * writes kit-<name>-dark.png / -light.png like renderScreen. Specimen labels are drawn in the gallery's own
 * caption style so they never look like part of the component.
 */

/** Gallery scope: the column the specimens are stacked in. */
class GalleryScope internal constructor() {
    /** One labelled specimen. [states] lists what the specimen shows, e.g. "default / pressed / disabled". */
    @Composable
    fun Specimen(title: String, states: String? = null, content: @Composable ColumnScope.() -> Unit) {
        val p = LocalThesisPalette.current
        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp)) {
            Text(title.uppercase(), style = ThesisType.eyebrow, color = p.muted)
            if (states != null) Text(states, style = ThesisType.caption, color = p.muted)
            Box(Modifier.height(8.dp))
            Column(verticalArrangement = Arrangement.spacedBy(12.dp), content = content)
        }
        Box(Modifier.fillMaxWidth().padding(horizontal = 16.dp).height(1.dp).background(p.line))
    }

    /** Section break with a heading, for galleries that group several components. */
    @Composable
    fun Section(title: String) {
        val p = LocalThesisPalette.current
        Text(
            title, style = ThesisType.headline, color = p.ink,
            modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 28.dp, bottom = 4.dp),
        )
    }
}

/**
 * Renders a kit gallery: specimens stacked on the theme's page colour, cropped to their height (at most
 * [maxHeightDp]). Same knobs as [renderScreen]; galleries default to no page glow so long sheets stay cheap.
 */
fun renderGallery(
    name: String,
    widthDp: Int = PhoneSpec.WIDTH_DP,
    maxHeightDp: Int = 6_000,
    themes: List<PreviewTheme> = PreviewTheme.entries,
    fontScale: Float = PreviewDefaults.fontScale,
    reducedMotion: Boolean = PreviewDefaults.reducedMotion,
    glow: Boolean = false,
    upDown: UpDownScheme = UpDownScheme.Classic,
    settleMs: Long = 600,
    content: @Composable GalleryScope.() -> Unit,
): List<File> = renderScreen(
    name = if (name.startsWith("kit-")) name else "kit-$name",
    widthDp = widthDp,
    heightDp = maxHeightDp,
    themes = themes,
    settleMs = settleMs,
    fontScale = fontScale,
    reducedMotion = reducedMotion,
    glow = glow,
    upDown = upDown,
    fitHeight = true,
) {
    val p = LocalThesisPalette.current
    Column(Modifier.fillMaxWidth().background(p.bg).padding(vertical = 8.dp)) {
        GalleryScope().content()
    }
}
