package com.thesis.mobile.ui.motion

import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.State
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import com.thesis.mobile.ui.theme.LocalReducedMotion
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/*
 * Scroll-spy for ChapterPills (docs/app-redesign/DESIGN-DIRECTION.md 3 #17; playbook 11). The pills and the content
 * are linked both ways: the selection follows the chapter whose start has crossed the reading line (45% of the
 * viewport going down; it hands back only once that start drops below 50%, so a chapter start resting near the line
 * does not flicker the pills), and a tap scrolls to the chapter while the selection is pinned to the tapped chapter
 * (no flicker through the chapters in between).
 *
 *   val spy = rememberScrollSpy(listState, chapterStarts)
 *   ChapterPills(titles, selectedIndex = spy.selected, onSelect = spy::jumpTo)
 */

/** Scroll-spy over a lazy list whose chapters start at the item indices [chapterStarts] (ascending). */
@Stable
class ScrollSpyState internal constructor(
    private val list: LazyListState,
    private val chapterStarts: List<Int>,
    private val scope: CoroutineScope,
    private val reduced: () -> Boolean,
) {
    private var pinned by mutableStateOf<Int?>(null)

    // Not snapshot state: the hysteresis memory of the last computed chapter (read and written only inside the
    // derived calculation, so it never triggers recomposition by itself).
    private var lastSpied = 0

    private val spied: State<Int> = derivedStateOf { spy() }

    /** The chapter to show as selected: the tapped one while its scroll runs, else the spied one. */
    val selected: Int get() = pinned ?: spied.value

    /** Scrolls to chapter [index] (glides; jumps under reduced motion), keeping the pill on it meanwhile. */
    fun jumpTo(index: Int) {
        val target = chapterStarts.getOrNull(index) ?: return
        pinned = index
        scope.launch {
            try {
                if (reduced()) list.scrollToItem(target) else list.animateScrollToItem(target)
            } finally {
                lastSpied = index
                pinned = null
            }
        }
    }

    private fun spy(): Int {
        if (chapterStarts.isEmpty()) return 0
        val info = list.layoutInfo
        val viewport = info.viewportEndOffset - info.viewportStartOffset
        if (viewport <= 0) return lastSpied.coerceIn(chapterStarts.indices)
        val first = list.firstVisibleItemIndex
        val visible = info.visibleItemsInfo
        // A chapter is "crossed" when its start item is above the line: scrolled past, or its top above the line.
        fun crossed(chapter: Int, share: Float): Boolean {
            val start = chapterStarts[chapter]
            if (start < first) return true
            val item = visible.firstOrNull { it.index == start } ?: return false
            return item.offset <= info.viewportStartOffset + viewport * share
        }
        var chosen = 0
        for (c in chapterStarts.indices) {
            // The current chapter holds until its start falls below 50%; others need to pass 45%.
            val share = if (c == lastSpied) HOLD_LINE else ENTER_LINE
            if (crossed(c, share)) chosen = c
        }
        // At the end of the list the last chapters may never reach the line: select the last visible start.
        if (!list.canScrollForward) {
            val lastVisible = chapterStarts.indices.lastOrNull { c -> visible.any { it.index == chapterStarts[c] } }
            if (lastVisible != null && lastVisible > chosen) chosen = lastVisible
        }
        lastSpied = chosen
        return chosen
    }

    private companion object {
        const val ENTER_LINE = 0.45f
        const val HOLD_LINE = 0.50f
    }
}

/** A [ScrollSpyState] for [list]; recreated when [chapterStarts] changes. */
@Composable
fun rememberScrollSpy(list: LazyListState, chapterStarts: List<Int>): ScrollSpyState {
    val scope = rememberCoroutineScope()
    val reduced = LocalReducedMotion.current
    val reducedRef = remember { booleanArrayOf(reduced) }
    reducedRef[0] = reduced
    return remember(list, chapterStarts) { ScrollSpyState(list, chapterStarts, scope) { reducedRef[0] } }
}
