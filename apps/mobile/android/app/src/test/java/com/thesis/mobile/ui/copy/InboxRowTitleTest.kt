package com.thesis.mobile.ui.copy

import org.junit.Assert.assertEquals
import org.junit.Test

/** `InboxCopy.rowTitle`: an Inbox row whose line 1 shows the ticker does not repeat it in its title (rubric V3). */
class InboxRowTitleTest {

    @Test
    fun `a leading ticker goes and the title starts with a capital`() {
        assertEquals("Thesis drifted on data center margin", InboxCopy.rowTitle("NVDA thesis drifted on data center margin", "NVDA"))
        assertEquals("Reports Thursday after the close", InboxCopy.rowTitle("AAPL reports Thursday after the close", "aapl"))
        assertEquals("Earnings preview", InboxCopy.rowTitle("MSFT: earnings preview", "MSFT"))
    }

    @Test
    fun `a trailing for or on the ticker goes`() {
        assertEquals("Report refresh paused", InboxCopy.rowTitle("Report refresh paused for TSLA", "TSLA"))
        assertEquals("New 10-Q filed", InboxCopy.rowTitle("New 10-Q filed on AMZN.", "AMZN"))
    }

    @Test
    fun `a title that names the ticker in passing, or only the ticker, is kept`() {
        assertEquals("NVDA’s margin narrowed", InboxCopy.rowTitle("NVDA’s margin narrowed", "NVDA"))
        assertEquals("Margin narrowed at NVDAX peers", InboxCopy.rowTitle("Margin narrowed at NVDAX peers", "NVDA"))
        assertEquals("NVDA", InboxCopy.rowTitle("NVDA", "NVDA"))
        assertEquals("Today’s Pulse is ready", InboxCopy.rowTitle("Today’s Pulse is ready", null))
    }
}
