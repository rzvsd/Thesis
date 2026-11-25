package com.thesis.mobile.ui.shell

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** The top bar's collapse (4.4 "Top bar: scroll under") and the hero status bar (2.7), from scroll alone. */
class ScreenChromeTest {

    private fun chrome() = ScreenChrome(scrolledPx = 0f, collapseAfterPx = 8f)

    @Test
    fun theBarCollapsesOnceContentIsPastTheThresholdAndOpensAtTheTop() {
        val chrome = chrome().apply { heroBand = true }
        assertTrue(chrome.overHero)
        chrome.onScrolled(consumedY = -20f, leftoverY = 0f)
        assertTrue(chrome.collapsed)
        assertFalse(chrome.overHero)
        chrome.onScrolled(consumedY = 0f, leftoverY = 4f)
        assertFalse(chrome.collapsed)
        assertTrue(chrome.overHero)
    }

    @Test
    fun aProgrammaticJumpToTheTopOpensTheBarAtOnce() {
        // scrollToItem(0) does not pass through nested scroll; the screen reports it with atTop().
        val chrome = chrome().apply { heroBand = true }
        chrome.onScrolled(consumedY = -400f, leftoverY = 0f)
        assertTrue(chrome.collapsed)
        chrome.atTop()
        assertFalse(chrome.collapsed)
        assertTrue(chrome.overHero)
    }
}
