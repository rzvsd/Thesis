package com.thesis.mobile.ui.screens

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Rect
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.print.PrintAttributes
import android.print.PrintManager
import android.view.ActionMode
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.webkit.JsPromptResult
import android.webkit.JsResult
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import com.thesis.mobile.ui.copy.ReportCopy
import com.thesis.mobile.ui.platform.ThesisBackHandler
import com.thesis.mobile.ui.screens.report.PageSelection
import com.thesis.mobile.ui.screens.report.ReportQuote
import com.thesis.mobile.ui.shell.LocalEntryCovered

/**
 * The server-rendered Deep Dive page in a WebView. The page is loaded once per [pageUrl] with [headers]
 * (the Authorization header, already limited to the API host by [DeepDiveWebPolicy.headersFor]).
 * Links to other pages open in the external browser; in-page anchors stay here. A failed main-frame
 * load calls [onMainFrameFailed] with the HTTP status (null for a network or renderer failure) so the
 * caller can refresh the token and retry, or show the native report screen instead.
 *
 * The host draws the loading state (docs/app-redesign/DESIGN-DIRECTION.md 5.13): [onProgress] reports the load
 * (0..100), [onLoaded] fires once the main frame finished without failing, and [onScroll] reports the page's
 * scroll position and step for the dock. [onAddToNote], when set, adds "Add to note" to the text-selection menu:
 * the selection and its chapter are read with [ReportQuote.SelectionScript] (`evaluateJavascript`, no JavaScript
 * interface), so the page's security settings stay as they are.
 *
 * The shell keeps the report composed under pages pushed over it and under modals ([LocalEntryCovered]). While it
 * is covered, the WebView's own View tree leaves the accessibility tree (the shell clears only the Compose
 * semantics, which an `AndroidView`'s children do not follow) and the page's animations are paused.
 */
@Composable
internal fun DeepDiveWebPage(
    pageUrl: String,
    headers: Map<String, String>,
    backgroundColor: Color,
    onMainFrameFailed: (Int?) -> Unit,
    modifier: Modifier = Modifier,
    printer: DeepDivePagePrinter? = null,
    onProgress: (Int) -> Unit = {},
    onLoaded: () -> Unit = {},
    onScroll: (scrollY: Int, dy: Int) -> Unit = { _, _ -> },
    onAddToNote: ((PageSelection) -> Unit)? = null,
) {
    val holder = remember { WebViewHolder() }
    var canGoBack by remember(pageUrl) { mutableStateOf(false) }
    val currentOnFailed by rememberUpdatedState(onMainFrameFailed)
    val currentOnProgress by rememberUpdatedState(onProgress)
    val currentOnLoaded by rememberUpdatedState(onLoaded)
    val currentOnScroll by rememberUpdatedState(onScroll)
    val currentOnAddToNote by rememberUpdatedState(onAddToNote)
    val covered = LocalEntryCovered.current

    // Back goes back within the page (for example after following an in-page anchor) before it leaves.
    ThesisBackHandler(enabled = canGoBack) {
        holder.webView?.goBack()
    }

    Box(modifier = modifier) {
        key(pageUrl) {
            AndroidView(
                factory = { context ->
                    ReportWebView(context).apply {
                        setBackgroundColor(backgroundColor.toArgb())
                        applyDeepDiveSettings(settings)
                        webViewClient = DeepDiveWebClient(
                            pageUrl = pageUrl,
                            onLoadingChange = { printer?.isLoading = it },
                            onLoaded = { currentOnLoaded() },
                            onHistoryChange = { canGoBack = it },
                            onFailed = { status -> currentOnFailed(status) },
                            openExternal = { url -> openExternalLink(context, url) }
                        )
                        webChromeClient = DeepDiveChromeClient(onProgress = { currentOnProgress(it) })
                        setOnScrollChangeListener { _, _, scrollY, _, oldScrollY ->
                            currentOnScroll(scrollY, scrollY - oldScrollY)
                        }
                        addToNote = { selection -> currentOnAddToNote?.invoke(selection) }
                        holder.webView = this
                        printer?.webView = this
                        printer?.isLoading = true
                        loadUrl(pageUrl, headers)
                    }
                },
                onRelease = { webView ->
                    if (holder.webView === webView) {
                        holder.webView = null
                    }
                    holder.forget(webView)
                    printer?.let { if (it.webView === webView) it.webView = null }
                    webView.setOnScrollChangeListener(null)
                    webView.stopLoading()
                    webView.destroy()
                },
                update = { webView ->
                    holder.applyCovered(webView, covered)
                    webView.addToNoteEnabled = onAddToNote != null
                },
                modifier = Modifier.fillMaxSize()
            )
        }
    }
}

/**
 * The page's WebView, with "Add to note" in its text-selection menu while [addToNoteEnabled]. Chromium starts the
 * selection menu through [startActionMode]; the callback is wrapped so the item is added on create and again on
 * every prepare (Chromium rebuilds the menu), and everything else goes to Chromium's own callback.
 */
private class ReportWebView(context: Context) : WebView(context) {
    var addToNote: (PageSelection) -> Unit = {}
    var addToNoteEnabled: Boolean = false

    override fun startActionMode(callback: ActionMode.Callback?): ActionMode? =
        super.startActionMode(wrap(callback))

    override fun startActionMode(callback: ActionMode.Callback?, type: Int): ActionMode? =
        super.startActionMode(wrap(callback), type)

    private fun wrap(callback: ActionMode.Callback?): ActionMode.Callback? =
        if (callback == null || !addToNoteEnabled || callback is AddToNoteCallback) {
            callback
        } else {
            AddToNoteCallback(callback, ReportCopy.ADD_TO_NOTE, ::readSelection)
        }

    /** Reads the selection and its chapter, hands them on, then closes the menu (which clears the selection). */
    private fun readSelection(mode: ActionMode) {
        evaluateJavascript(ReportQuote.SelectionScript) { json ->
            ReportQuote.parseSelection(json)?.let { addToNote(it) }
            mode.finish()
        }
    }
}

private class AddToNoteCallback(
    private val wrapped: ActionMode.Callback,
    private val label: String,
    private val onAdd: (ActionMode) -> Unit,
) : ActionMode.Callback2() {
    override fun onCreateActionMode(mode: ActionMode, menu: Menu): Boolean {
        val created = wrapped.onCreateActionMode(mode, menu)
        if (created) addItem(menu)
        return created
    }

    override fun onPrepareActionMode(mode: ActionMode, menu: Menu): Boolean {
        val changed = wrapped.onPrepareActionMode(mode, menu)
        return addItem(menu) || changed
    }

    override fun onActionItemClicked(mode: ActionMode, item: MenuItem): Boolean {
        if (item.itemId == ADD_TO_NOTE_ITEM_ID) {
            onAdd(mode)
            return true
        }
        return wrapped.onActionItemClicked(mode, item)
    }

    override fun onDestroyActionMode(mode: ActionMode) {
        wrapped.onDestroyActionMode(mode)
    }

    override fun onGetContentRect(mode: ActionMode, view: View, outRect: Rect) {
        if (wrapped is ActionMode.Callback2) {
            wrapped.onGetContentRect(mode, view, outRect)
        } else {
            super.onGetContentRect(mode, view, outRect)
        }
    }

    /** Adds the item once; true when the menu changed. */
    private fun addItem(menu: Menu): Boolean {
        if (menu.findItem(ADD_TO_NOTE_ITEM_ID) != null) return false
        menu.add(Menu.NONE, ADD_TO_NOTE_ITEM_ID, ADD_TO_NOTE_ORDER, label)
            .setShowAsAction(MenuItem.SHOW_AS_ACTION_IF_ROOM)
        return true
    }
}

/** Menu id of "Add to note": outside the range Chromium uses for its own items (android.R.id values). */
private const val ADD_TO_NOTE_ITEM_ID = 0x0D0E_0001

/** After Copy and Share, before the overflow items. */
private const val ADD_TO_NOTE_ORDER = 50

/**
 * Load progress only. Every dialog the page could open (alert, confirm, prompt, leave-page) is cancelled, as it was
 * before this client existed; new windows, file choosers and permission requests keep their default (refused).
 */
private class DeepDiveChromeClient(private val onProgress: (Int) -> Unit) : WebChromeClient() {
    override fun onProgressChanged(view: WebView, newProgress: Int) {
        onProgress(newProgress)
    }

    override fun onJsAlert(view: WebView, url: String?, message: String?, result: JsResult): Boolean {
        result.cancel()
        return true
    }

    override fun onJsConfirm(view: WebView, url: String?, message: String?, result: JsResult): Boolean {
        result.cancel()
        return true
    }

    override fun onJsPrompt(
        view: WebView,
        url: String?,
        message: String?,
        defaultValue: String?,
        result: JsPromptResult,
    ): Boolean {
        result.cancel()
        return true
    }

    override fun onJsBeforeUnload(view: WebView, url: String?, message: String?, result: JsResult): Boolean {
        result.cancel()
        return true
    }
}

private class WebViewHolder {
    var webView: WebView? = null
    private var pausedView: WebView? = null

    /**
     * Covered by another page or a modal: hide the WebView's View tree from TalkBack and pause its animations
     * ([WebView.onPause] leaves JavaScript and other WebViews alone); uncovered: restore both. Only on a change.
     */
    fun applyCovered(view: WebView, covered: Boolean) {
        val target = if (covered) {
            View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        } else {
            View.IMPORTANT_FOR_ACCESSIBILITY_AUTO
        }
        if (view.importantForAccessibility != target) view.importantForAccessibility = target
        if (covered && pausedView !== view) {
            view.onPause()
            pausedView = view
        } else if (!covered && pausedView === view) {
            view.onResume()
            pausedView = null
        }
    }

    /** [view] is being destroyed: drop the reference. */
    fun forget(view: WebView) {
        if (pausedView === view) pausedView = null
    }
}

/**
 * Export PDF for the in-app page: prints the loaded WebView with Android's print framework, so the PDF is the
 * same page and template as the share link (its print CSS: A4, light colours, page numbers). The user picks
 * "Save as PDF" (or a printer) in the system dialog. Main thread only.
 */
internal class DeepDivePagePrinter {
    internal var webView: WebView? = null
    internal var isLoading: Boolean = true

    /** True when the system print dialog opened; false means the caller should use the app's own PDF. */
    fun print(context: Context, ticker: String?): Boolean {
        val view = webView ?: return false
        if (!DeepDiveWebPolicy.exportPrintsPage(hasPage = true, isLoading = isLoading)) {
            return false
        }
        val activity = context.findActivity() ?: return false
        val manager = activity.getSystemService(Context.PRINT_SERVICE) as? PrintManager ?: return false
        val jobName = DeepDiveWebPolicy.printJobName(ticker)
        return runCatching {
            val attributes = PrintAttributes.Builder()
                .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                .build()
            manager.print(jobName, view.createPrintDocumentAdapter(jobName), attributes)
            true
        }.getOrDefault(false)
    }
}

private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext?.findActivity()
    else -> null
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
    private val onLoaded: () -> Unit,
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
        // A failed load (a 401 body, an error page) never counts as loaded: the skeleton stays until the retry.
        if (!failed) onLoaded()
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
