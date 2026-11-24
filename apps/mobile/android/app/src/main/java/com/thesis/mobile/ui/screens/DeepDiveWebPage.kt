package com.thesis.mobile.ui.screens

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.thesis.mobile.ui.theme.ThesisColors

/**
 * The server-rendered Deep Dive page in a WebView. The page is loaded once per [pageUrl] with [headers]
 * (the Authorization header, already limited to the API host by [DeepDiveWebPolicy.headersFor]).
 * Links to other pages open in the external browser; in-page anchors stay here. A failed main-frame
 * load calls [onMainFrameFailed] with the HTTP status (null for a network or renderer failure) so the
 * caller can refresh the token and retry, or show the native report screen instead.
 */
@Composable
internal fun DeepDiveWebPage(
    pageUrl: String,
    headers: Map<String, String>,
    backgroundColor: Color,
    onMainFrameFailed: (Int?) -> Unit,
    modifier: Modifier = Modifier
) {
    val holder = remember { WebViewHolder() }
    var isLoading by remember(pageUrl) { mutableStateOf(true) }
    var canGoBack by remember(pageUrl) { mutableStateOf(false) }
    val currentOnFailed by rememberUpdatedState(onMainFrameFailed)

    // Back goes back within the page (for example after following an in-page anchor) before it leaves.
    BackHandler(enabled = canGoBack) {
        holder.webView?.goBack()
    }

    Box(modifier = modifier) {
        key(pageUrl) {
            AndroidView(
                factory = { context ->
                    WebView(context).apply {
                        setBackgroundColor(backgroundColor.toArgb())
                        applyDeepDiveSettings(settings)
                        webViewClient = DeepDiveWebClient(
                            pageUrl = pageUrl,
                            onLoadingChange = { isLoading = it },
                            onHistoryChange = { canGoBack = it },
                            onFailed = { status -> currentOnFailed(status) },
                            openExternal = { url -> openExternalLink(context, url) }
                        )
                        holder.webView = this
                        loadUrl(pageUrl, headers)
                    }
                },
                onRelease = { webView ->
                    if (holder.webView === webView) {
                        holder.webView = null
                    }
                    webView.stopLoading()
                    webView.destroy()
                },
                modifier = Modifier.fillMaxSize()
            )
        }

        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier
                    .align(Alignment.Center)
                    .size(28.dp),
                color = ThesisColors.Primary,
                strokeWidth = 2.dp
            )
        }
    }
}

private class WebViewHolder {
    var webView: WebView? = null
}

@SuppressLint("SetJavaScriptEnabled")
private fun applyDeepDiveSettings(settings: WebSettings) {
    // The page needs inline JS for the price box and localStorage for its theme switch. Nothing else:
    // no file or content access, no extra windows, no mixed content, and no JavaScript interface.
    settings.javaScriptEnabled = true
    settings.domStorageEnabled = true
    settings.allowFileAccess = false
    settings.allowContentAccess = false
    settings.javaScriptCanOpenWindowsAutomatically = false
    settings.setSupportMultipleWindows(false)
    settings.setGeolocationEnabled(false)
    settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
    settings.cacheMode = WebSettings.LOAD_NO_CACHE
}

private class DeepDiveWebClient(
    private val pageUrl: String,
    private val onLoadingChange: (Boolean) -> Unit,
    private val onHistoryChange: (Boolean) -> Unit,
    private val onFailed: (Int?) -> Unit,
    private val openExternal: (String) -> Unit
) : WebViewClient() {
    private var failed = false

    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        if (!request.isForMainFrame) {
            return false
        }
        val target = request.url?.toString().orEmpty()
        if (request.isRedirect) {
            // A redirect away from the API host is cancelled, so the token never follows it.
            if (DeepDiveWebPolicy.allowsRedirect(target, pageUrl)) {
                return false
            }
            fail(null)
            return true
        }
        return when (DeepDiveWebPolicy.linkAction(target, pageUrl, request.hasGesture())) {
            DeepDiveLinkAction.STAY -> false
            DeepDiveLinkAction.OPEN_EXTERNAL -> {
                openExternal(target)
                true
            }
            DeepDiveLinkAction.BLOCK -> true
        }
    }

    override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
        onLoadingChange(true)
    }

    override fun onPageFinished(view: WebView, url: String?) {
        onLoadingChange(false)
    }

    override fun doUpdateVisitedHistory(view: WebView, url: String?, isReload: Boolean) {
        onHistoryChange(view.canGoBack())
    }

    override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
        if (request.isForMainFrame) {
            fail(null)
        }
    }

    override fun onReceivedHttpError(
        view: WebView,
        request: WebResourceRequest,
        errorResponse: WebResourceResponse
    ) {
        if (DeepDiveWebPolicy.isMainFrameHttpFailure(request.isForMainFrame, errorResponse.statusCode)) {
            fail(errorResponse.statusCode)
        }
    }

    override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
        // Keep the app alive; the caller removes (and destroys) this WebView and shows the native screen.
        fail(null)
        return true
    }

    private fun fail(statusCode: Int?) {
        if (failed) {
            return
        }
        failed = true
        onLoadingChange(false)
        onFailed(statusCode)
    }
}

private fun openExternalLink(context: Context, url: String) {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE)
    if (context !is Activity) {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    runCatching { context.startActivity(intent) }
}

/** Same check as the view model's: true when the active network reports internet access. */
internal fun isDeviceOnline(context: Context): Boolean = runCatching {
    val connectivity = context.getSystemService(ConnectivityManager::class.java) ?: return@runCatching true
    val capabilities = connectivity.getNetworkCapabilities(connectivity.activeNetwork)
        ?: return@runCatching false
    capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
}.getOrDefault(true)

/**
 * The device's online state, kept current while the caller is on screen (a default-network callback,
 * delivered on the main thread). Used to offer the "New view" switch once a connection comes back.
 */
@Composable
internal fun rememberDeviceOnline(): State<Boolean> {
    val context = LocalContext.current
    val online = remember { mutableStateOf(isDeviceOnline(context)) }
    DisposableEffect(context) {
        val connectivity = context.getSystemService(ConnectivityManager::class.java)
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                online.value = isDeviceOnline(context)
            }

            override fun onLost(network: Network) {
                // The default network is gone; onAvailable follows if another one takes over.
                online.value = false
            }

            override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
                online.value = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            }
        }
        val registered = connectivity != null && runCatching {
            connectivity.registerDefaultNetworkCallback(callback, Handler(Looper.getMainLooper()))
        }.isSuccess
        online.value = isDeviceOnline(context)
        onDispose {
            if (registered) {
                runCatching { connectivity?.unregisterNetworkCallback(callback) }
            }
        }
    }
    return online
}
