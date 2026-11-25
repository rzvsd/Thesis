package com.thesis.mobile.ui.shell

import com.thesis.mobile.ui.MessageAction
import com.thesis.mobile.ui.UiState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** `UiState.activeMessageAction`: a snackbar action rides only on the message it was published with. */
class MessageActionTest {

    private val open = MessageAction.OpenReport("Deep Dive ready.", reportId = "rep_1", ticker = "AAPL")

    @Test
    fun actionShowsWithItsOwnMessage() {
        val state = UiState(message = "Deep Dive ready.", messageAction = open)
        assertEquals(open, state.activeMessageAction)
        assertEquals("Open", state.activeMessageAction?.label)
    }

    @Test
    fun laterMessageDoesNotInheritTheAction() {
        val state = UiState(message = "Watchlist updated.", messageAction = open)
        assertNull(state.activeMessageAction)
        assertNull(UiState(message = null, messageAction = open).activeMessageAction)
    }
}
