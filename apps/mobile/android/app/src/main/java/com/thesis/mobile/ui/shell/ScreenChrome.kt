package com.thesis.mobile.ui.shell

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.calculateEndPadding
import androidx.compose.foundation.layout.calculateStartPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.Dp
import com.thesis.mobile.ui.theme.ThesisSpace

/**
 * What one screen's chrome shows (DESIGN-DIRECTION 2.7 and 4.4 "Top bar: scroll under"):
 *
 * - [collapsed]: content has scrolled more than [COLLAPSE_AFTER] under the top bar, so the bar shows its
 *   background (the page bitmap at 92%) and its hairline. Measured by [nestedScroll] on the entry's content, so
 *   screens need no wiring: any `LazyColumn` or `verticalScroll` inside reports through nested scroll.
 * - [overHero]: the screen opens on a HeroBand that runs under the status bar and the top bar ([HeroUnderBars]),
 *   and it has not collapsed yet. The top bar then reads the hero palette, and the status bar gets light icons in
 *   both themes; on collapse both cross to the page palette (the bar over 200 ms).
 *
 * One per stack entry, saved with the entry's other UI state (it is remembered under the entry's
 * `SaveableStateProvider`), so a tab switch, a pop or a recreate returns with the bar as the user left it.
 * Plain snapshot state, no Android types: design-preview renders it and `ScreenChromeTest` drives it.
 */
@Stable
class ScreenChrome internal constructor(scrolledPx: Float, private val collapseAfterPx: Float) {

    /** How far the content has scrolled under the bar, in px (0 at the top). */
    internal var scrolledPx by mutableFloatStateOf(scrolledPx)
        private set

    /** Set while a screen that opens on a HeroBand is composed ([HeroUnderBars]). */
    internal var heroBand by mutableStateOf(false)

    /** A screen that draws its own top bar reports its own collapse here (null: the shell measures scroll). */
    internal var ownCollapsed by mutableStateOf<Boolean?>(null)

    /** The bar shows its background and hairline (content is under it). Changes only when the threshold is crossed. */
    val collapsed: Boolean by derivedStateOf { ownCollapsed ?: (this.scrolledPx > collapseAfterPx) }

    /** A HeroBand is under the status bar and the top bar right now. */
    val overHero: Boolean by derivedStateOf { heroBand && !collapsed }

    /**
     * Follows the content's scroll. Only what the content actually consumed moves the offset; anything left over
     * toward the top means the content is at its top, which also corrects any drift from programmatic scrolls
     * (those do not pass through nested scroll).
     */
    val nestedScroll: NestedScrollConnection = object : NestedScrollConnection {
        override fun onPostScroll(consumed: Offset, available: Offset, source: NestedScrollSource): Offset {
            onScrolled(consumedY = consumed.y, leftoverY = available.y)
            return Offset.Zero
        }
    }

    /**
     * The content is back at its top after a programmatic scroll (`scrollToItem(0)`, a tap-tab-to-top), which does
     * not pass through nested scroll: the bar drops its background and hairline, and over a HeroBand the status bar
     * turns light again, at once instead of on the next drag. A screen calls it with [LocalScreenChrome].
     */
    fun atTop() {
        scrolledPx = 0f
    }

    /** [consumedY] < 0 when the content moved up (the user scrolled down the page). */
    internal fun onScrolled(consumedY: Float, leftoverY: Float) {
        if (consumedY != 0f) scrolledPx = (scrolledPx - consumedY).coerceAtLeast(0f)
        if (leftoverY > 0f) scrolledPx = 0f
    }

    companion object {
        /** 4.4: the hairline and background fade in once content is more than 8 dp under the bar. */
        val COLLAPSE_AFTER: Dp = ThesisSpace.s

        internal fun saver(collapseAfterPx: Float): Saver<ScreenChrome, Float> = Saver(
            save = { it.scrolledPx },
            restore = { ScreenChrome(it, collapseAfterPx) }
        )
    }
}

/** The chrome of the screen being composed: its entry's in the shell, the surface's before log-in. */
val LocalScreenChrome = compositionLocalOf<ScreenChrome?> { null }

/**
 * True while the page being composed is kept alive under another page (the report base layer under a pushed
 * screen, a modal or the paywall, 4.5). The shell already hides it from Compose semantics and touch; a page that
 * hosts an Android View (the report WebView) reads this to hide the View's own accessibility tree as well and to
 * pause work nobody sees.
 */
val LocalEntryCovered = compositionLocalOf { false }

/** A [ScreenChrome] saved with the caller's saveable state (an entry's provider in the shell). */
@Composable
fun rememberScreenChrome(): ScreenChrome {
    val collapseAfterPx = with(LocalDensity.current) { ScreenChrome.COLLAPSE_AFTER.toPx() }
    return rememberSaveable(collapseAfterPx, saver = ScreenChrome.saver(collapseAfterPx)) {
        ScreenChrome(0f, collapseAfterPx)
    }
}

/**
 * Declares that the calling screen opens on a HeroBand that runs under the status bar and the top bar (2.7
 * "HeroBand screens rule": Pulse, Deep Dive loading and the classic report hero, Auth, Onboarding, Paywall).
 * While it is under them the top bar reads the hero palette and the status bar has light icons, in both themes.
 *
 * Screens under a shell top bar call it with no argument: the shell collapses the bar when content scrolls under
 * it. Screens that draw their own top bar (Pulse, Onboarding, Auth) pass their own [collapsed] state.
 * Does nothing outside a [LocalScreenChrome] (a render of the screen on its own).
 */
@Composable
fun HeroUnderBars(collapsed: Boolean? = null) {
    val chrome = LocalScreenChrome.current ?: return
    DisposableEffect(chrome) {
        chrome.heroBand = true
        onDispose {
            chrome.heroBand = false
            chrome.ownCollapsed = null
        }
    }
    SideEffect { chrome.ownCollapsed = collapsed }
}

/**
 * The shell's [PaddingValues] for an entry, without the top: a screen whose content scrolls under the top bar
 * (4.4 "Top bar: scroll under") pads its container with this and puts `calculateTopPadding()` into its list's
 * `contentPadding`, so rows pass under the bar's 92% background instead of being clipped at its bottom edge.
 */
@Composable
@ReadOnlyComposable
fun PaddingValues.exceptTop(): PaddingValues {
    val direction = LocalLayoutDirection.current
    return PaddingValues(
        start = calculateStartPadding(direction),
        end = calculateEndPadding(direction),
        bottom = calculateBottomPadding()
    )
}

