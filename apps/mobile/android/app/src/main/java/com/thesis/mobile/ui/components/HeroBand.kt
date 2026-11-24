package com.thesis.mobile.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.calculateEndPadding
import androidx.compose.foundation.layout.calculateStartPadding
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.dp
import com.thesis.mobile.ui.platform.RenderFlags
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisMaterialTheme
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.heroOf

/** True inside a [HeroBand]: kit components switch to their hero variants (Eyebrow rule, gold PrimaryButton). */
val LocalInHeroBand = staticCompositionLocalOf { false }

/** Default HeroBand padding: gutter at the sides, the Deep Dive hero's 40 / 34 top and bottom (on the scale). */
val HeroBandPadding: PaddingValues = PaddingValues(
    start = ThesisSpace.gutter,
    end = ThesisSpace.gutter,
    top = ThesisSpace.x4,
    bottom = ThesisSpace.x3,
)

/**
 * The dark, gold-lit cover band (docs/app-redesign/DESIGN-DIRECTION.md, sections 2.7 and 3 #2). Cover moments only:
 * Pulse brief, Deep Dive loading and the classic report hero, Auth, Onboarding, Paywall; at most one per screen.
 *
 * It re-provides [LocalThesisPalette] with `heroOf(p)` and wraps its content in the hero Material theme with
 * `LocalContentColor = heroInk`, so kit components and M3 Switch / TextField / Icon inside it recolour
 * automatically. It paints the hero background (165 degree heroBg -> heroBg2, gold glow top right, blue bottom
 * left) and the fading gold hairline at the bottom.
 *
 * [underTopBar]: the band runs edge to edge under the status bar and the top bar (HeroBand screens rule), so its
 * content starts below them. [contentPadding] is added inside that.
 */
@Composable
fun HeroBand(
    modifier: Modifier = Modifier,
    underTopBar: Boolean = false,
    contentPadding: PaddingValues = HeroBandPadding,
    verticalArrangement: Arrangement.Vertical = Arrangement.spacedBy(ThesisSpace.l),
    content: @Composable ColumnScope.() -> Unit,
) {
    val p = LocalThesisPalette.current
    val hero = remember(p) { heroOf(p) }
    val glows = RenderFlags.pageGlow
    val top = if (underTopBar) {
        WindowInsets.safeDrawing.only(WindowInsetsSides.Top).asPaddingValues().calculateTopPadding() + ThesisSpace.topBar
    } else {
        0.dp
    }
    val dir = LocalLayoutDirection.current
    Column(
        modifier
            .fillMaxWidth()
            .drawBehind { drawHeroBackground(hero, glows) }
            .padding(
                start = contentPadding.calculateStartPadding(dir),
                end = contentPadding.calculateEndPadding(dir),
                top = contentPadding.calculateTopPadding() + top,
                bottom = contentPadding.calculateBottomPadding(),
            ),
    ) {
        ThesisMaterialTheme(palette = hero) {
            CompositionLocalProvider(LocalInHeroBand provides true) {
                Column(verticalArrangement = verticalArrangement, content = content)
            }
        }
    }
}
