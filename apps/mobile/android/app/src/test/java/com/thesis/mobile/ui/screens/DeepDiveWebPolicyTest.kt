package com.thesis.mobile.ui.screens

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DeepDiveWebPolicyTest {
    private val base = "https://api.thesis.test/functions/v1/api"
    private val token = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1In0.c2lnbg"
    private val access = DeepDiveWebPageAccess(apiBaseUrl = base, accessToken = token)
    private val page = "$base/v1/reports/r-1/page?theme=dark&embed=1"

    @Test
    fun `page url carries theme and embed and keeps the base path`() {
        assertEquals(page, DeepDiveWebPolicy.pageUrl(base, "r-1", DeepDiveWebTheme.DARK))
        assertEquals(
            "$base/v1/reports/r-1/page?theme=light&embed=1",
            DeepDiveWebPolicy.pageUrl("$base/", " r-1 ", DeepDiveWebTheme.LIGHT)
        )
    }

    @Test
    fun `page url encodes the report id as one path segment`() {
        assertEquals(
            "$base/v1/reports/a%2Fb%20c%3Fd%23e/page?theme=dark&embed=1",
            DeepDiveWebPolicy.pageUrl(base, "a/b c?d#e", DeepDiveWebTheme.DARK)
        )
        assertEquals("x%2B1", DeepDiveWebPolicy.encodePathSegment("x+1"))
    }

    @Test
    fun `page url is refused for sample ids blank ids and unusable base urls`() {
        assertNull(DeepDiveWebPolicy.pageUrl(base, "", DeepDiveWebTheme.DARK))
        assertNull(DeepDiveWebPolicy.pageUrl(base, "sample-report", DeepDiveWebTheme.DARK))
        assertNull(DeepDiveWebPolicy.pageUrl("", "r-1", DeepDiveWebTheme.DARK))
        assertNull(DeepDiveWebPolicy.pageUrl("ftp://api.thesis.test", "r-1", DeepDiveWebTheme.DARK))
        assertNull(DeepDiveWebPolicy.pageUrl("http://api.thesis.test", "r-1", DeepDiveWebTheme.DARK))
        assertNull(DeepDiveWebPolicy.pageUrl("https://user:pw@api.thesis.test", "r-1", DeepDiveWebTheme.DARK))
        assertEquals(
            "http://10.0.2.2:3001/v1/reports/r-1/page?theme=dark&embed=1",
            DeepDiveWebPolicy.pageUrl("http://10.0.2.2:3001", "r-1", DeepDiveWebTheme.DARK)
        )
    }

    @Test
    fun `only the api host gets the authorization header`() {
        assertEquals(mapOf("Authorization" to "Bearer $token"), DeepDiveWebPolicy.headersFor(page, base, token))
        assertEquals(
            mapOf("Authorization" to "Bearer $token"),
            DeepDiveWebPolicy.headersFor("https://API.thesis.test:443/x", base, token)
        )
        assertTrue(DeepDiveWebPolicy.headersFor("https://www.sec.gov/Archives/x", base, token).isEmpty())
        assertTrue(DeepDiveWebPolicy.headersFor("https://evil.thesis.test.example/x", base, token).isEmpty())
        assertTrue(DeepDiveWebPolicy.headersFor("https://thesis.test/x", base, token).isEmpty())
        assertTrue(DeepDiveWebPolicy.headersFor("https://api.thesis.test:8443/x", base, token).isEmpty())
        assertTrue(DeepDiveWebPolicy.headersFor("http://api.thesis.test/x", base, token).isEmpty())
        assertTrue(DeepDiveWebPolicy.headersFor("https://user@api.thesis.test/x", base, token).isEmpty())
        assertTrue(DeepDiveWebPolicy.headersFor("not a url", base, token).isEmpty())
    }

    @Test
    fun `no header for a missing or malformed token`() {
        assertTrue(DeepDiveWebPolicy.headersFor(page, base, null).isEmpty())
        assertTrue(DeepDiveWebPolicy.headersFor(page, base, "  ").isEmpty())
        assertTrue(DeepDiveWebPolicy.headersFor(page, base, "abc\r\nX-Other: 1").isEmpty())
        assertTrue(DeepDiveWebPolicy.headersFor(page, base, "two words").isEmpty())
    }

    @Test
    fun `in-page anchors stay and other links open outside`() {
        assertEquals(DeepDiveLinkAction.STAY, DeepDiveWebPolicy.linkAction("$page#valuation", page))
        assertEquals(DeepDiveLinkAction.STAY, DeepDiveWebPolicy.linkAction(page, page))
        assertEquals(
            DeepDiveLinkAction.OPEN_EXTERNAL,
            DeepDiveWebPolicy.linkAction("https://www.sec.gov/cgi-bin/browse-edgar?CIK=320193", page)
        )
        assertEquals(DeepDiveLinkAction.OPEN_EXTERNAL, DeepDiveWebPolicy.linkAction("http://example.org/", page))
        // Same host, other path or other query: not the page itself, so it leaves the app (without a token).
        assertEquals(DeepDiveLinkAction.OPEN_EXTERNAL, DeepDiveWebPolicy.linkAction("$base/download", page))
        assertEquals(
            DeepDiveLinkAction.OPEN_EXTERNAL,
            DeepDiveWebPolicy.linkAction("$base/v1/reports/r-1/page?theme=light&embed=1", page)
        )
    }

    @Test
    fun `other schemes and script navigations are blocked`() {
        assertEquals(DeepDiveLinkAction.BLOCK, DeepDiveWebPolicy.linkAction("intent://x#Intent;end", page))
        assertEquals(DeepDiveLinkAction.BLOCK, DeepDiveWebPolicy.linkAction("javascript:alert(1)", page))
        assertEquals(DeepDiveLinkAction.BLOCK, DeepDiveWebPolicy.linkAction("file:///data/x", page))
        assertEquals(DeepDiveLinkAction.BLOCK, DeepDiveWebPolicy.linkAction("content://x/y", page))
        assertEquals(DeepDiveLinkAction.BLOCK, DeepDiveWebPolicy.linkAction("https:///nohost", page))
        assertEquals(
            DeepDiveLinkAction.BLOCK,
            DeepDiveWebPolicy.linkAction("https://www.sec.gov/", page, hasGesture = false)
        )
        assertEquals(DeepDiveLinkAction.STAY, DeepDiveWebPolicy.linkAction("$page#risks", page, hasGesture = false))
    }

    @Test
    fun `redirects are followed only on the same origin`() {
        assertTrue(DeepDiveWebPolicy.allowsRedirect("$base/v1/reports/r-1/page?theme=dark&embed=1&v=2", page))
        assertFalse(DeepDiveWebPolicy.allowsRedirect("https://other.test/login", page))
        assertFalse(DeepDiveWebPolicy.allowsRedirect("http://api.thesis.test/x", page))
    }

    @Test
    fun `main frame http errors count as a failed load`() {
        assertTrue(DeepDiveWebPolicy.isMainFrameHttpFailure(isForMainFrame = true, statusCode = 401))
        assertTrue(DeepDiveWebPolicy.isMainFrameHttpFailure(isForMainFrame = true, statusCode = 404))
        assertTrue(DeepDiveWebPolicy.isMainFrameHttpFailure(isForMainFrame = true, statusCode = 503))
        assertFalse(DeepDiveWebPolicy.isMainFrameHttpFailure(isForMainFrame = true, statusCode = 200))
        assertFalse(DeepDiveWebPolicy.isMainFrameHttpFailure(isForMainFrame = true, statusCode = 304))
        assertFalse(DeepDiveWebPolicy.isMainFrameHttpFailure(isForMainFrame = false, statusCode = 500))
    }

    @Test
    fun `web page is chosen only when every condition holds`() {
        fun choose(
            reportId: String? = "r-1",
            pageAccess: DeepDiveWebPageAccess? = access,
            online: Boolean = true,
            failed: Boolean = false,
            classic: Boolean = false,
            newView: Boolean = false
        ) = DeepDiveWebPolicy.chooseView(reportId, pageAccess, online, failed, classic, newView)

        assertEquals(DeepDiveViewChoice.WEB_PAGE, choose())
        assertEquals(DeepDiveViewChoice.NATIVE, choose(online = false))
        assertEquals(DeepDiveViewChoice.NATIVE, choose(failed = true))
        assertEquals(DeepDiveViewChoice.NATIVE, choose(classic = true))
        assertEquals(DeepDiveViewChoice.NATIVE, choose(reportId = null))
        assertEquals(DeepDiveViewChoice.NATIVE, choose(reportId = " "))
        assertEquals(DeepDiveViewChoice.NATIVE, choose(reportId = "sample-report"))
        assertEquals(DeepDiveViewChoice.NATIVE, choose(pageAccess = null))
        assertEquals(DeepDiveViewChoice.NATIVE, choose(pageAccess = access.copy(accessToken = null)))
        assertEquals(DeepDiveViewChoice.NATIVE, choose(pageAccess = access.copy(apiBaseUrl = "")))
        assertEquals(
            DeepDiveViewChoice.NATIVE,
            choose(pageAccess = access.copy(apiBaseUrl = "http://192.168.1.20:3001"))
        )
    }

    @Test
    fun `offline copy of a report stays native until the new view is asked for`() {
        val cached = access.copy(reportLoadedFromCache = true)
        // The API could not be reached, so the app showed its offline copy: no request to the page.
        assertEquals(
            DeepDiveViewChoice.NATIVE,
            DeepDiveWebPolicy.chooseView("r-1", cached, isOnline = true, pageLoadFailed = false, classicChosen = false)
        )
        // The switch is still offered when online, and picking it loads the page.
        assertTrue(DeepDiveWebPolicy.canShowWebPage("r-1", cached, isOnline = true))
        assertFalse(DeepDiveWebPolicy.canShowWebPage("r-1", cached, isOnline = false))
        assertEquals(
            DeepDiveViewChoice.WEB_PAGE,
            DeepDiveWebPolicy.chooseView(
                "r-1",
                cached,
                isOnline = true,
                pageLoadFailed = false,
                classicChosen = false,
                newViewChosen = true
            )
        )
        assertEquals(
            DeepDiveViewChoice.NATIVE,
            DeepDiveWebPolicy.chooseView(
                "r-1",
                cached,
                isOnline = true,
                pageLoadFailed = true,
                classicChosen = false,
                newViewChosen = true
            )
        )
    }

    @Test
    fun `a 401 refreshes the token once and other failures fall back`() {
        assertTrue(DeepDiveWebPolicy.shouldRetryWithFreshToken(401, alreadyRetried = false, canRefresh = true))
        assertFalse(DeepDiveWebPolicy.shouldRetryWithFreshToken(401, alreadyRetried = true, canRefresh = true))
        assertFalse(DeepDiveWebPolicy.shouldRetryWithFreshToken(401, alreadyRetried = false, canRefresh = false))
        assertFalse(DeepDiveWebPolicy.shouldRetryWithFreshToken(403, alreadyRetried = false, canRefresh = true))
        assertFalse(DeepDiveWebPolicy.shouldRetryWithFreshToken(404, alreadyRetried = false, canRefresh = true))
        assertFalse(DeepDiveWebPolicy.shouldRetryWithFreshToken(500, alreadyRetried = false, canRefresh = true))
        assertFalse(DeepDiveWebPolicy.shouldRetryWithFreshToken(null, alreadyRetried = false, canRefresh = true))
    }

    @Test
    fun `page access never prints the token`() {
        val text = access.copy(refreshAccessToken = { done -> done(null) }).toString()
        assertFalse(text.contains(token))
        assertTrue(text.contains("hasToken=true"))
    }

    @Test
    fun `server report ids are recognised`() {
        assertTrue(DeepDiveWebPolicy.hasServerReportId("m7-report-001"))
        assertTrue(DeepDiveWebPolicy.hasServerReportId("6f1c2d3e-0000-4000-8000-000000000001"))
        assertFalse(DeepDiveWebPolicy.hasServerReportId(null))
        assertFalse(DeepDiveWebPolicy.hasServerReportId(""))
        assertFalse(DeepDiveWebPolicy.hasServerReportId("Sample-AAPL"))
        // Dot-only ids would turn into "." or ".." path segments and change the path.
        assertFalse(DeepDiveWebPolicy.hasServerReportId(".."))
        assertNull(DeepDiveWebPolicy.pageUrl(base, ".", DeepDiveWebTheme.DARK))
    }

    @Test
    fun printJobNameUsesACleanTicker() {
        assertEquals("Thesis AAPL Deep Dive", DeepDiveWebPolicy.printJobName("aapl"))
        assertEquals("Thesis BRK.B Deep Dive", DeepDiveWebPolicy.printJobName("BRK.B"))
        assertEquals("Thesis ABC Deep Dive", DeepDiveWebPolicy.printJobName("A/B\nC"))
        assertEquals("Thesis Deep Dive", DeepDiveWebPolicy.printJobName(null))
        assertEquals("Thesis Deep Dive", DeepDiveWebPolicy.printJobName("  "))
    }

    @Test
    fun exportPrintsThePageOnlyOnceItHasLoaded() {
        assertTrue(DeepDiveWebPolicy.exportPrintsPage(hasPage = true, isLoading = false))
        assertFalse(DeepDiveWebPolicy.exportPrintsPage(hasPage = true, isLoading = true))
        assertFalse(DeepDiveWebPolicy.exportPrintsPage(hasPage = false, isLoading = false))
    }
}
