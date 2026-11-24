package com.thesis.mobile.ui.components

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.calculateEndPadding
import androidx.compose.foundation.layout.calculateStartPadding
import androidx.compose.foundation.layout.displayCutout
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.SubcomposeLayout
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.Dp
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace

/*
 * The page scaffold (docs/app-redesign/DESIGN-DIRECTION.md, section 3 #1). Every screen paints the page background
 * itself, opaque and fixed to the window, so push transitions and the container transform never double-expose
 * text; screens never call background(...) themselves.
 */

/**
 * Receives the screen's `collapsed` flag (content scrolled under the top bar). The shell provides it to drive the
 * status-bar icon appearance on HeroBand screens (section 2.7); the default does nothing.
 */
val LocalTopBarCollapsedSink = staticCompositionLocalOf<(Boolean) -> Unit> { {} }

/** True once [state] has scrolled more than [threshold] (8 dp): the top bar fades its background in. */
@Composable
fun rememberTopBarCollapsed(state: LazyListState, threshold: Dp = ThesisSpace.s): State<Boolean> {
    val px = with(LocalDensity.current) { threshold.toPx() }
    return remember(state, px) {
        derivedStateOf { state.firstVisibleItemIndex > 0 || state.firstVisibleItemScrollOffset > px }
    }
}

/** [rememberTopBarCollapsed] for a scrolling Column. */
@Composable
fun rememberTopBarCollapsed(state: ScrollState, threshold: Dp = ThesisSpace.s): State<Boolean> {
    val px = with(LocalDensity.current) { threshold.toPx() }
    return remember(state, px) { derivedStateOf { state.value > px } }
}

/** Insets the content avoids (system bars and cutout); the keyboard is handled by `imePadding` on the layout. */
private val ContentInsets: WindowInsets
    get() = WindowInsets.systemBars.union(WindowInsets.displayCutout)

/**
 * Page scaffold (#1): paints `pageBackground` behind everything (from the shared cached bitmap; it creates its own
 * cache when no shell provides one), places the optional [topBar] over the content (content scrolls under it) and
 * the optional [bottomBar] (RunBar, dock) at the bottom, and passes [content] the padding to use as its list's
 * `contentPadding`: the bars' heights or the system-bar insets, plus the horizontal insets. The keyboard pushes
 * the layout up (`imePadding`; needs `adjustResize`). [collapsed] is published to [LocalTopBarCollapsedSink].
 * The snackbar host is the shell's.
 */
@Composable
fun ThesisScreen(
    modifier: Modifier = Modifier,
    topBar: (@Composable () -> Unit)? = null,
    bottomBar: (@Composable () -> Unit)? = null,
    collapsed: Boolean = false,
    content: @Composable (PaddingValues) -> Unit,
) {
    val p = LocalThesisPalette.current
    val parent = LocalPageBackgroundCache.current
    val cache = parent ?: remember { PageBackgroundCache() }
    val sink = rememberUpdatedState(LocalTopBarCollapsedSink.current)
    LaunchedEffect(collapsed) { sink.value(collapsed) }

    val insets = ContentInsets.asPaddingValues()
    val dir = LocalLayoutDirection.current
    val sizing = if (parent == null) {
        Modifier
            .onSizeChanged { cache.areaSize = it }
            .onGloballyPositioned { cache.areaOrigin = it.positionInWindow() }
    } else {
        Modifier
    }
    CompositionLocalProvider(LocalPageBackgroundCache provides cache) {
        Box(
            modifier
                .fillMaxSize()
                .then(sizing)
                .pageBackground(p),
        ) {
            SubcomposeLayout(Modifier.fillMaxSize().imePadding()) { constraints ->
                val loose = constraints.copy(minWidth = 0, minHeight = 0)
                val top = if (topBar != null) subcompose(ScaffoldSlot.Top, topBar).map { it.measure(loose) } else emptyList()
                val bottom = if (bottomBar != null) subcompose(ScaffoldSlot.Bottom, bottomBar).map { it.measure(loose) } else emptyList()
                val topH = top.maxOfOrNull { it.height } ?: 0
                val bottomH = bottom.maxOfOrNull { it.height } ?: 0
                val padding = PaddingValues(
                    start = insets.calculateStartPadding(dir),
                    end = insets.calculateEndPadding(dir),
                    top = if (topBar != null) topH.toDp() else insets.calculateTopPadding(),
                    bottom = if (bottomBar != null) bottomH.toDp() else insets.calculateBottomPadding(),
                )
                val body = subcompose(ScaffoldSlot.Content) { content(padding) }.map { it.measure(constraints) }
                layout(constraints.maxWidth, constraints.maxHeight) {
                    body.forEach { it.place(0, 0) }
                    top.forEach { it.place(0, 0) }
                    bottom.forEach { it.place(0, constraints.maxHeight - it.height) }
                }
            }
        }
    }
}

private enum class ScaffoldSlot { Top, Bottom, Content }

/** Top inset only (status bar and cutout), for bars drawn edge to edge. */
internal val TopBarInsets: WindowInsets
    get() = WindowInsets.systemBars.union(WindowInsets.displayCutout).only(WindowInsetsSides.Top + WindowInsetsSides.Horizontal)

/** Bottom inset only (navigation bar), for bottom bars drawn edge to edge. */
internal val BottomBarInsets: WindowInsets
    get() = WindowInsets.systemBars.only(WindowInsetsSides.Bottom + WindowInsetsSides.Horizontal)
