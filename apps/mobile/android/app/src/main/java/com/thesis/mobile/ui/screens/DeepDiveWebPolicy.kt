package com.thesis.mobile.ui.screens

import java.net.URI
import java.net.URLEncoder

/**
 * What the in-app Deep Dive page needs from the app: the API base URL and the current access token
 * (null, or a blank token, means the page cannot be shown and the native report screen is used), whether
 * the open report is the offline copy the app fell back to, whether the paywall is showing, and a way to
 * refresh the access token after the page answers 401 (it calls back with the new token, or null).
 */
data class DeepDiveWebPageAccess(
    val apiBaseUrl: String,
    val accessToken: String?,
    val reportLoadedFromCache: Boolean = false,
    val isPaywallOpen: Boolean = false,
    val refreshAccessToken: (((String?) -> Unit) -> Unit)? = null
) {
    // Never print the token (for example in a crash report or a log line).
    override fun toString(): String =
        "DeepDiveWebPageAccess(apiBaseUrl=$apiBaseUrl, hasToken=${!accessToken.isNullOrBlank()}, " +
            "reportLoadedFromCache=$reportLoadedFromCache, isPaywallOpen=$isPaywallOpen)"
}

enum class DeepDiveWebTheme(val query: String) {
    LIGHT("light"),
    DARK("dark")
}

/** What the WebView does with a navigation that the page starts. */
enum class DeepDiveLinkAction {
    /** The page itself (for example an in-page #anchor): the WebView handles it. */
    STAY,

    /** An http/https link that is not the page: it opens in the external browser, without the token. */
    OPEN_EXTERNAL,

    /** Anything else (other schemes, broken URLs, navigations without a tap): ignored. */
    BLOCK
}

enum class DeepDiveViewChoice {
    WEB_PAGE,
    NATIVE
}

/**
 * Pure rules for the server-rendered Deep Dive page shown inside the app
 * (GET {apiBase}/v1/reports/{reportId}/page?theme=light|dark&embed=1 with a Bearer token).
 * No Android types here, so the JVM unit tests cover every rule.
 */
object DeepDiveWebPolicy {
    const val AUTH_HEADER = "Authorization"

    // Hosts where plain http is accepted, for local development builds only.
    private val localDevHosts = setOf("127.0.0.1", "localhost", "10.0.2.2", "::1", "[::1]")

    // A bearer token is a single opaque word. Anything with spaces or control characters is refused,
    // so a broken token can never add extra header lines.
    private val tokenPattern = Regex("^[A-Za-z0-9._~+/=-]+$")

    /**
     * Reports that came from the server have an id; sample reports and blank ids do not. Dot-only ids are
     * refused too, because "." and ".." path segments would change the request path.
     */
    fun hasServerReportId(reportId: String?): Boolean {
        val id = reportId?.trim().orEmpty()
        return id.isNotEmpty() && id.any { it != '.' } && !id.startsWith("sample", ignoreCase = true)
    }

    /** Percent-encodes one path segment (spaces become %20, slashes become %2F). */
    fun encodePathSegment(value: String): String =
        URLEncoder.encode(value, "UTF-8").replace("+", "%20")

    /** The page URL for a report, or null when the base URL or the report id cannot be used. */
    fun pageUrl(apiBaseUrl: String, reportId: String, theme: DeepDiveWebTheme): String? {
        val base = apiBaseUrl.trim().trimEnd('/')
        if (originOf(base) == null || !isTransportAllowed(base)) {
            return null
        }
        if (!hasServerReportId(reportId)) {
            return null
        }
        val segment = encodePathSegment(reportId.trim())
        return "$base/v1/reports/$segment/page?theme=${theme.query}&embed=1"
    }

    /**
     * Headers for loading [url]. The Authorization header is only added when [url] has the same scheme,
     * host and port as the API base URL, uses https (or http on a local development host), and the
     * token is a well-formed single word. Every other host gets no headers at all.
     */
    fun headersFor(url: String, apiBaseUrl: String, accessToken: String?): Map<String, String> {
        val token = accessToken?.trim().orEmpty()
        if (token.isEmpty() || !tokenPattern.matches(token)) {
            return emptyMap()
        }
        if (!isSameOrigin(url, apiBaseUrl) || !isTransportAllowed(url)) {
            return emptyMap()
        }
        return mapOf(AUTH_HEADER to "Bearer $token")
    }

    /**
     * Decides what happens when the page starts a navigation to [target] while showing [pageUrl].
     * [hasGesture] is false for navigations a script starts without a tap; those never leave the app.
     */
    fun linkAction(target: String, pageUrl: String, hasGesture: Boolean = true): DeepDiveLinkAction {
        if (isSamePage(target, pageUrl)) {
            return DeepDiveLinkAction.STAY
        }
        val uri = parse(target) ?: return DeepDiveLinkAction.BLOCK
        val scheme = uri.scheme?.lowercase()
        if ((scheme == "http" || scheme == "https") && !uri.host.isNullOrBlank() && hasGesture) {
            return DeepDiveLinkAction.OPEN_EXTERNAL
        }
        return DeepDiveLinkAction.BLOCK
    }

    /** A main-frame redirect is followed only when it stays on the page's own origin. */
    fun allowsRedirect(target: String, pageUrl: String): Boolean = isSameOrigin(target, pageUrl)

    /** A main-frame HTTP status that means the page did not load (401, 404, 5xx and so on). */
    fun isMainFrameHttpFailure(isForMainFrame: Boolean, statusCode: Int): Boolean =
        isForMainFrame && statusCode >= 400

    /**
     * A 401 from the page usually means the access token expired while the app made no other call, and
     * the WebView cannot refresh it. The app then refreshes the token once and loads the page again.
     * Any other failure, or a second 401, falls back to the native screen.
     */
    fun shouldRetryWithFreshToken(statusCode: Int?, alreadyRetried: Boolean, canRefresh: Boolean): Boolean =
        statusCode == 401 && !alreadyRetried && canRefresh

    /**
     * The web page is shown only when every condition holds: the person did not pick the classic view,
     * the page has not failed to load, the device is online, the report has a server id, and the
     * session has a usable base URL and token. A report the app loaded from its offline copy (because
     * the API could not be reached) stays on the native screen too, unless the person asked for the
     * new view. Otherwise the native report screen is shown as before.
     */
    fun chooseView(
        reportId: String?,
        access: DeepDiveWebPageAccess?,
        isOnline: Boolean,
        pageLoadFailed: Boolean,
        classicChosen: Boolean,
        newViewChosen: Boolean = false
    ): DeepDiveViewChoice {
        if (classicChosen || pageLoadFailed) {
            return DeepDiveViewChoice.NATIVE
        }
        if (access?.reportLoadedFromCache == true && !newViewChosen) {
            return DeepDiveViewChoice.NATIVE
        }
        return if (canShowWebPage(reportId, access, isOnline)) {
            DeepDiveViewChoice.WEB_PAGE
        } else {
            DeepDiveViewChoice.NATIVE
        }
    }

    /**
     * Whether the web page could be shown at all, ignoring the classic view choice, past failures and
     * whether the report came from the offline copy. The native screen offers the "New view" switch
     * only when this is true.
     */
    fun canShowWebPage(reportId: String?, access: DeepDiveWebPageAccess?, isOnline: Boolean): Boolean {
        if (!isOnline || access == null || reportId == null) {
            return false
        }
        val url = pageUrl(access.apiBaseUrl, reportId, DeepDiveWebTheme.DARK) ?: return false
        return headersFor(url, access.apiBaseUrl, access.accessToken).isNotEmpty()
    }

    private fun isSamePage(target: String, pageUrl: String): Boolean {
        val a = parse(target) ?: return false
        val b = parse(pageUrl) ?: return false
        return isSameOrigin(target, pageUrl) &&
            (a.rawPath ?: "") == (b.rawPath ?: "") &&
            (a.rawQuery ?: "") == (b.rawQuery ?: "")
    }

    private fun isSameOrigin(a: String, b: String): Boolean {
        val left = originOf(a) ?: return false
        val right = originOf(b) ?: return false
        return left == right
    }

    private fun isTransportAllowed(url: String): Boolean {
        val uri = parse(url) ?: return false
        return when (uri.scheme?.lowercase()) {
            "https" -> true
            "http" -> uri.host?.lowercase() in localDevHosts
            else -> false
        }
    }

    private data class Origin(val scheme: String, val host: String, val port: Int)

    private fun originOf(url: String): Origin? {
        val uri = parse(url) ?: return null
        val scheme = uri.scheme?.lowercase() ?: return null
        if (scheme != "http" && scheme != "https") {
            return null
        }
        if (uri.rawUserInfo != null) {
            return null
        }
        val host = uri.host?.lowercase()?.takeIf { it.isNotBlank() } ?: return null
        val port = when {
            uri.port != -1 -> uri.port
            scheme == "https" -> 443
            else -> 80
        }
        return Origin(scheme, host, port)
    }

    private fun parse(url: String): URI? = runCatching { URI(url.trim()) }.getOrNull()
}
