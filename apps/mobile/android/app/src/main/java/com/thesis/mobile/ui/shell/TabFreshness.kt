package com.thesis.mobile.ui.shell

import com.thesis.mobile.model.isFresh
import com.thesis.mobile.ui.navigation.ShellTab

/**
 * When each tab's data last loaded (epoch ms), for the 5.5 rule: a tab switch skips data younger than five minutes.
 * A tab is marked when its loads start, so two quick switches do not fetch twice; a load that fails clears the
 * marks of the tabs it feeds ([invalidate]), so an offline start or a dropped request is retried on the next switch
 * instead of leaving the tab empty for five minutes (Research has no pull to refresh).
 */
class TabFreshness {
    private val fetchedAtMs = mutableMapOf<ShellTab, Long>()

    /** True when [tab] should load now (never loaded, older than five minutes, or [force]); marks it at [nowMs]. */
    fun claim(tab: ShellTab, nowMs: Long, force: Boolean = false): Boolean {
        if (!force && isFresh(fetchedAtMs[tab], nowMs)) return false
        fetchedAtMs[tab] = nowMs
        return true
    }

    fun mark(tab: ShellTab, nowMs: Long) {
        fetchedAtMs[tab] = nowMs
    }

    /** After a full load (start, login) the first tab switches do not fetch the same data again. */
    fun markAll(nowMs: Long) {
        ShellTab.entries.forEach { fetchedAtMs[it] = nowMs }
    }

    /** A load that feeds [tabs] failed: the next switch to each of them loads again. */
    fun invalidate(vararg tabs: ShellTab) {
        tabs.forEach { fetchedAtMs.remove(it) }
    }

    fun clear() = fetchedAtMs.clear()
}

/**
 * True when a Pulse entry for [entryDate] (null = the latest issue) must load because the shared Pulse was last
 * asked for [requestedDate] (null = the latest issue): a past day opened from Research leaves its issue in the
 * shared Pulse, which Today's brief and an undated `Pulse()` entry must not show as the latest.
 */
fun pulseEntryNeedsLoad(entryDate: String?, requestedDate: String?): Boolean =
    entryDate?.trim()?.ifBlank { null } != requestedDate
