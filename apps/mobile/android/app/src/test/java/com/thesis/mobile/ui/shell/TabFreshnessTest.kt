package com.thesis.mobile.ui.shell

import com.thesis.mobile.model.TAB_DATA_MAX_AGE_MS
import com.thesis.mobile.ui.navigation.ShellTab
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TabFreshnessTest {

    private val now = 1_000_000_000L

    @Test
    fun aTabSwitchSkipsDataYoungerThanFiveMinutes() {
        val freshness = TabFreshness()
        assertTrue("never loaded", freshness.claim(ShellTab.Names, now))
        assertFalse("just loaded", freshness.claim(ShellTab.Names, now + 60_000))
        assertTrue("a forced load always runs", freshness.claim(ShellTab.Names, now + 60_000, force = true))
        assertTrue("older than five minutes", freshness.claim(ShellTab.Names, now + 60_000 + TAB_DATA_MAX_AGE_MS))
    }

    @Test
    fun aFailedStartLoadIsRetriedOnTheNextSwitch() {
        // Offline start: every tab is marked, then the report history load fails.
        val freshness = TabFreshness()
        freshness.markAll(now)
        freshness.invalidate(ShellTab.Research)
        assertTrue("Research has no pull to refresh: the next switch loads again", freshness.claim(ShellTab.Research, now + 1_000))
        assertFalse("the retry is marked like any load", freshness.claim(ShellTab.Research, now + 2_000))
        assertFalse("tabs whose loads worked stay fresh", freshness.claim(ShellTab.Names, now + 1_000))
    }

    @Test
    fun aFailureClearsEveryTabTheLoadFeeds() {
        val freshness = TabFreshness()
        freshness.markAll(now)
        freshness.invalidate(ShellTab.Today, ShellTab.Names, ShellTab.Inbox)
        assertTrue(freshness.claim(ShellTab.Today, now + 1_000))
        assertTrue(freshness.claim(ShellTab.Names, now + 1_000))
        assertTrue(freshness.claim(ShellTab.Inbox, now + 1_000))
        assertFalse(freshness.claim(ShellTab.Research, now + 1_000))
    }

    @Test
    fun clearForgetsEveryTab() {
        val freshness = TabFreshness()
        freshness.markAll(now)
        freshness.clear()
        ShellTab.entries.forEach { assertTrue(it.name, freshness.claim(it, now + 1_000)) }
    }

    @Test
    fun anUndatedPulseLoadsTheLatestWhenAPastDayHoldsTheSharedPulse() {
        // Research history opened 2026-11-20: Today's brief and an undated Pulse entry must load the latest issue.
        assertTrue(pulseEntryNeedsLoad(null, "2026-11-20"))
        assertTrue(pulseEntryNeedsLoad("  ", "2026-11-20"))
        assertFalse("the latest is already the shared Pulse", pulseEntryNeedsLoad(null, null))
    }

    @Test
    fun aDatedPulseLoadsItsDayUnlessItIsAlreadyTheSharedPulse() {
        assertTrue("the latest replaced it", pulseEntryNeedsLoad("2026-11-20", null))
        assertTrue("another day replaced it", pulseEntryNeedsLoad("2026-11-20", "2026-11-19"))
        assertFalse(pulseEntryNeedsLoad(" 2026-11-20 ", "2026-11-20"))
    }
}
