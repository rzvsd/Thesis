package com.thesis.mobile.ui

import com.thesis.mobile.network.ProductApiException
import org.json.JSONException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException
import java.net.SocketTimeoutException

class RefreshFailureTest {
    @Test
    fun `network error while offline is the only offline case`() {
        assertEquals(RefreshFailureKind.OFFLINE, RefreshFailure.classify(IOException("x"), deviceOnline = false))
        assertEquals(RefreshFailureKind.UNREACHABLE, RefreshFailure.classify(SocketTimeoutException("timeout"), deviceOnline = true))
        assertEquals(RefreshFailureKind.SERVER, RefreshFailure.classify(ProductApiException(500, "boom"), deviceOnline = false))
        assertEquals(RefreshFailureKind.APP, RefreshFailure.classify(JSONException("bad"), deviceOnline = true))
        assertEquals(RefreshFailureKind.APP, RefreshFailure.classify(IllegalStateException("bad"), deviceOnline = false))
    }

    @Test
    fun `only the offline message talks about being offline`() {
        RefreshFailureKind.values().forEach { kind ->
            val texts = listOfNotNull(
                RefreshFailure.cachedPulseMessage(kind),
                RefreshFailure.cachedMacroStressMessage(kind),
                RefreshFailure.noCacheMessage(kind)
            )
            texts.forEach { text ->
                assertFalse(text, text.contains("network is unavailable"))
                assertEquals(text, kind == RefreshFailureKind.OFFLINE, text.contains("offline"))
            }
        }
        assertNull(RefreshFailure.noCacheMessage(RefreshFailureKind.SERVER))
    }

    @Test
    fun `log line keeps class and network message but drops other messages`() {
        val timeout = RefreshFailure.logLine("pulse", SocketTimeoutException("timeout\nafter 10s"), RefreshFailureKind.UNREACHABLE)
        assertTrue(timeout, timeout.contains("java.net.SocketTimeoutException"))
        assertTrue(timeout, timeout.contains("message=timeout after 10s"))

        val parse = RefreshFailure.logLine("pulse", JSONException("Value secret-body of type"), RefreshFailureKind.APP)
        assertTrue(parse, parse.contains("org.json.JSONException"))
        assertFalse(parse, parse.contains("secret-body"))

        val server = RefreshFailure.logLine("pulse", ProductApiException(503, "down", "unavailable"), RefreshFailureKind.SERVER)
        assertTrue(server, server.contains("http=503"))
        assertTrue(server, server.contains("code=unavailable"))
    }
}
