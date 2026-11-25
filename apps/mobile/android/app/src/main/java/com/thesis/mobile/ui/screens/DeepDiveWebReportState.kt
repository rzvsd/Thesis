package com.thesis.mobile.ui.screens

import androidx.compose.animation.Crossfade
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.AnnotatedString
import com.thesis.mobile.model.ConvictionJournalEntryView
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.OppositeCaseReportView
import com.thesis.mobile.model.ScenarioResultView
import com.thesis.mobile.ui.components.DockDetent
import com.thesis.mobile.ui.components.DockItem
import com.thesis.mobile.ui.components.TextAction
import com.thesis.mobile.ui.components.ThesisSheet
import com.thesis.mobile.ui.components.rememberNoteAutosave
import com.thesis.mobile.ui.copy.ReportCopy
import com.thesis.mobile.ui.format.LocalFmt
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.motion.rememberHaptics
import com.thesis.mobile.ui.parseInstantMs
import com.thesis.mobile.ui.screens.report.CompareStep
import com.thesis.mobile.ui.screens.report.ExportJob
import com.thesis.mobile.ui.screens.report.PAGE_PROGRESS_UNKNOWN
import com.thesis.mobile.ui.screens.report.PageSelection
import com.thesis.mobile.ui.screens.report.ReportCompareContent
import com.thesis.mobile.ui.screens.report.ReportDockScroll
import com.thesis.mobile.ui.screens.report.ReportFallbackBanner
import com.thesis.mobile.ui.screens.report.ReportFeedbackPanel
import com.thesis.mobile.ui.screens.report.ReportHostExtras
import com.thesis.mobile.ui.screens.report.ReportHostFrame
import com.thesis.mobile.ui.screens.report.ReportNotesPanel
import com.thesis.mobile.ui.screens.report.ReportOverflowContent
import com.thesis.mobile.ui.screens.report.ReportPanel
import com.thesis.mobile.ui.screens.report.ReportQuote
import com.thesis.mobile.ui.screens.report.earlierNoteFor
import com.thesis.mobile.ui.screens.report.earlierNoteOf
import com.thesis.mobile.ui.screens.report.earlierReportsFor
import com.thesis.mobile.ui.screens.report.otherNamesFor
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import java.time.Instant
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

/**
 * The app-only parts of an open Deep Dive (notes, conviction and the opposite case, the scenario run,
 * Scenario Stress, feedback and export). The web page does not have these: the report host offers them in its dock
 * and overflow (5.13), the classic view in its own sections. [host] carries what the report host needs beyond the
 * classic tools (follow, compare, the notes trail); its defaults keep callers compiling until they pass it.
 */
data class DeepDiveNativeTools(
    val isPro: Boolean,
    val reportNoteDraft: String,
    val noteUpdatedAt: String?,
    val isSavingNote: Boolean,
    val convictionTimeline: List<ConvictionJournalEntryView>,
    val convictionTimelineError: String?,
    val oppositeCase: OppositeCaseReportView?,
    val oppositeCaseError: String?,
    val isGeneratingOppositeCase: Boolean,
    val scenarioResult: ScenarioResultView?,
    val isRunningScenario: Boolean,
    val onReportNoteChange: (String) -> Unit,
    val onSaveReportNote: () -> Unit,
    val onGenerateOppositeCase: () -> Unit,
    val onRefreshConvictionTimeline: () -> Unit,
    val onRunScenario: (Int?, Double?, Double?) -> Unit,
    val onRequireUpgrade: (String) -> Unit,
    val onSubmitReportFeedback: (String, String) -> Unit,
    val onNotify: (String) -> Unit,
    val onOpenScenarioStress: (() -> Unit)?,
    val host: ReportHostExtras = ReportHostExtras(),
)

/** The classic screen's switch labels and the host's notices (kept for the classic view's callers). */
internal object DeepDiveWebCopy {
    const val classicView = ReportCopy.CLASSIC_VIEW
    const val newView = ReportCopy.NEW_VIEW
    const val loadFailed = ReportCopy.LOAD_FAILED
    const val needsConnection = ReportCopy.NEEDS_CONNECTION
}

/** Paywall feature keys the host asks for (the same as the classic view's). */
private const val FEATURE_EXPORT = "report_export"
private const val FEATURE_CONVICTION = "conviction_intelligence"

/** How long a note save may take to start before the host stops waiting for it. */
private const val NOTE_SAVE_START_MS = 2_000L

/**
 * Shows an open Deep Dive (5.13) as the server-rendered page when [DeepDiveWebPolicy.chooseView] allows it: the
 * report's own bar, the page, its dock (Notes, Compare, Stress, Conviction) and overflow (Classic view, Export PDF,
 * Share card, Report feedback). Otherwise (offline, failed load, sample report, offline copy of a report, classic
 * view picked) it shows [nativeReport]; after a failed load the classic view carries a "Try again" banner.
 * [nativeReport] gets a callback that switches to the new view, or null when the new view cannot be offered right
 * now (no connection, no server id, no session).
 */
@Composable
internal fun DeepDiveReportHost(
    report: DeepDiveReportView,
    webPage: DeepDiveWebPageAccess?,
    tools: DeepDiveNativeTools,
    onBack: () -> Unit,
    padding: PaddingValues,
    nativeReport: @Composable (onOpenNewView: (() -> Unit)?) -> Unit
) {
    val context = LocalContext.current
    val p = LocalThesisPalette.current
    val reduced = LocalReducedMotion.current
    // Saved across rotation, so a failed load is not retried (with its banner again) and an open panel stays open.
    var classicChosen by rememberSaveable(report.reportId) { mutableStateOf(false) }
    var newViewChosen by rememberSaveable(report.reportId) { mutableStateOf(false) }
    var pageLoadFailed by rememberSaveable(report.reportId) { mutableStateOf(false) }
    var attempt by rememberSaveable(report.reportId) { mutableIntStateOf(0) }
    // Checked when the report opens and on each retry. The live value only decides whether to offer the switch.
    val isOnline = remember(report.reportId, attempt) { isDeviceOnline(context) }
    val isOnlineNow by rememberDeviceOnline()

    // The theme of the page follows the app's palette (never a luminance guess), so the two never disagree.
    val theme = if (p.isLight) DeepDiveWebTheme.LIGHT else DeepDiveWebTheme.DARK
    val choice = DeepDiveWebPolicy.chooseView(
        reportId = report.reportId,
        access = webPage,
        isOnline = isOnline,
        pageLoadFailed = pageLoadFailed,
        classicChosen = classicChosen,
        newViewChosen = newViewChosen
    )
    val pageUrl = webPage?.let { DeepDiveWebPolicy.pageUrl(it.apiBaseUrl, report.reportId, theme) }
    val showPage = choice == DeepDiveViewChoice.WEB_PAGE && webPage != null && pageUrl != null

    Crossfade(
        targetState = showPage,
        animationSpec = ThesisMotion.timed(reduced, ThesisMotion.Base),
        label = "reportView",
    ) { page ->
        if (page && webPage != null && pageUrl != null) {
            ReportWebHost(
                report = report,
                webPage = webPage,
                pageUrl = pageUrl,
                tools = tools,
                onBack = onBack,
                padding = padding,
                attempt = attempt,
                onClassicView = {
                    classicChosen = true
                    newViewChosen = false
                },
                onFailed = { pageLoadFailed = true },
            )
        } else {
            // Sample reports and reports without a session keep the classic screen untouched (no switch shown).
            // Offline, the switch appears once a connection is back.
            val offerNewView = DeepDiveWebPolicy.canShowWebPage(report.reportId, webPage, isOnlineNow)
            val openNewView: () -> Unit = {
                if (isDeviceOnline(context)) {
                    classicChosen = false
                    newViewChosen = true
                    pageLoadFailed = false
                    attempt += 1
                } else {
                    tools.onNotify(ReportCopy.NEEDS_CONNECTION)
                }
            }
            Box(Modifier.fillMaxSize()) {
                nativeReport(openNewView.takeIf { offerNewView })
                // A failed page leaves the classic view with a way back to the new one (never a silent swap).
                if (pageLoadFailed && !classicChosen && offerNewView) {
                    ReportFallbackBanner(
                        onRetry = openNewView,
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .padding(bottom = padding.calculateBottomPadding()),
                    )
                }
            }
        }
    }
}

/** The page with its chrome, panels and sheets (5.13). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ReportWebHost(
    report: DeepDiveReportView,
    webPage: DeepDiveWebPageAccess,
    pageUrl: String,
    tools: DeepDiveNativeTools,
    onBack: () -> Unit,
    padding: PaddingValues,
    attempt: Int,
    onClassicView: () -> Unit,
    onFailed: () -> Unit,
) {
    val context = LocalContext.current
    val p = LocalThesisPalette.current
    val haptics = rememberHaptics()
    val scope = rememberCoroutineScope()
    val clipboard = LocalClipboardManager.current
    val slopPx = with(LocalDensity.current) { ThesisSpace.s.roundToPx() }
    val extras = tools.host
    val ticker = report.ticker?.trim()?.uppercase()?.ifBlank { null } ?: ReportCopy.EXPORT_REPORT_TITLE
    val currentTools by rememberUpdatedState(tools)

    var panel by rememberSaveable(report.reportId) { mutableStateOf(ReportPanel.None) }
    var compareStep by rememberSaveable(report.reportId) { mutableStateOf(CompareStep.Choose) }
    var notesDetent by rememberSaveable(report.reportId) { mutableStateOf(DockDetent.Half) }
    var feedbackDetent by rememberSaveable(report.reportId) { mutableStateOf(DockDetent.Half) }
    var exporting by remember(report.reportId) { mutableStateOf(ExportJob.None) }
    var scrollNoteToEnd by remember(report.reportId) { mutableIntStateOf(0) }
    var dockVisible by remember(report.reportId) { mutableStateOf(true) }
    // Export PDF prints the loaded page (same template as the share link).
    val printer = remember(report.reportId) { DeepDivePagePrinter() }
    // One token refresh per attempt after a 401. Kept in memory only: a token never goes into saved state.
    var tokenRetried by remember(report.reportId, attempt) { mutableStateOf(false) }
    var refreshedToken by remember(report.reportId, attempt) { mutableStateOf<String?>(null) }
    var isRefreshingToken by remember(report.reportId, attempt) { mutableStateOf(false) }
    // Per WebView (a refreshed token gives a new one): loaded once it has finished, and its progress.
    var pageLoaded by remember(report.reportId, attempt, refreshedToken) { mutableStateOf(false) }
    var progress by remember(report.reportId, attempt, refreshedToken) { mutableIntStateOf(PAGE_PROGRESS_UNKNOWN) }

    // The paywall is drawn in the activity window, under a sheet's window, so an open sheet or panel closes when
    // the paywall opens (also when the server, not the host, asked for the upgrade).
    val isPaywallOpen = webPage.isPaywallOpen
    LaunchedEffect(isPaywallOpen) {
        if (isPaywallOpen) panel = ReportPanel.None
    }

    val headers = DeepDiveWebPolicy.headersFor(pageUrl, webPage.apiBaseUrl, refreshedToken ?: webPage.accessToken)
    val onMainFrameFailed: (Int?) -> Unit = { status ->
        val refresh = webPage.refreshAccessToken
        if (refresh != null && DeepDiveWebPolicy.shouldRetryWithFreshToken(status, tokenRetried, true)) {
            tokenRetried = true
            isRefreshingToken = true
            refresh { newToken ->
                isRefreshingToken = false
                if (newToken.isNullOrBlank()) onFailed() else refreshedToken = newToken
            }
        } else {
            onFailed()
        }
    }

    // Notes autosave in the new view (the classic view keeps its own Save). Keyed by the report, so the draft the
    // report opened with is never saved back as if it were an edit.
    val autosave = key(report.reportId) {
        rememberNoteAutosave(
            text = tools.reportNoteDraft,
            save = rememberNoteSave { currentTools },
            onLeave = { currentTools.onSaveReportNote() },
        )
    }

    val addToNote: (PageSelection) -> Unit = { selection ->
        val quote = ReportQuote.format(selection, ReportQuote.sourceLabel(report))
        currentTools.onReportNoteChange(ReportQuote.append(currentTools.reportNoteDraft, quote))
        panel = ReportPanel.Notes
        scrollNoteToEnd += 1
    }

    val requirePro: (String) -> Boolean = { feature ->
        if (!currentTools.isPro) {
            panel = ReportPanel.None
            currentTools.onRequireUpgrade(feature)
        }
        currentTools.isPro
    }
    val finishExport: (Boolean) -> Unit = { ok ->
        exporting = ExportJob.None
        panel = ReportPanel.None
        if (ok) {
            haptics.confirm()
        } else {
            haptics.reject()
            currentTools.onNotify(ReportCopy.EXPORT_FAILED)
        }
    }
    val exportPdf: () -> Unit = {
        if (exporting == ExportJob.None && requirePro(FEATURE_EXPORT)) {
            exporting = ExportJob.Pdf
            scope.launch {
                // One frame for the arc before the print framework takes the main thread.
                withFrameNanos { }
                // The page's own PDF (print of the new view); the app's PDF (built off the main thread) otherwise.
                val ok = printer.print(context, report.ticker) || try {
                    shareExport(context, renderReportPdf(context, report, ReportExportType.FULL_REPORT))
                    true
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    false
                }
                finishExport(ok)
            }
        }
    }
    val shareCard: () -> Unit = {
        if (exporting == ExportJob.None && requirePro(FEATURE_EXPORT)) {
            exporting = ExportJob.Card
            scope.launch {
                val ok = try {
                    shareExport(context, renderShareCard(context, report))
                    true
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    false
                }
                finishExport(ok)
            }
        }
    }

    val dockItems = buildList {
        add(DockItem(ReportCopy.DOCK_NOTES, { panel = ReportPanel.Notes }))
        if (extras.onCompareNames != null || extras.onCompareReports != null) {
            add(
                DockItem(ReportCopy.DOCK_COMPARE, {
                    compareStep = CompareStep.Choose
                    panel = ReportPanel.Compare
                })
            )
        }
        tools.onOpenScenarioStress?.let { open -> add(DockItem(ReportCopy.DOCK_STRESS, open)) }
        add(
            DockItem(
                label = ReportCopy.DOCK_CONVICTION,
                onClick = { if (requirePro(FEATURE_CONVICTION)) panel = ReportPanel.Conviction },
                badge = if (tools.isPro) null else ReportCopy.PRO_BADGE,
            )
        )
    }

    ReportHostFrame(
        ticker = ticker,
        padding = padding,
        onBack = onBack,
        following = extras.isFollowing,
        onFollowChange = { on -> extras.onFollowChange?.invoke(on) },
        onOverflow = { panel = ReportPanel.Overflow },
        pageLoaded = pageLoaded && !isRefreshingToken,
        progress = progress,
        dockItems = dockItems,
        dockVisible = dockVisible && panel != ReportPanel.Notes && panel != ReportPanel.Feedback,
        overlays = {
            val fmt = LocalFmt.current
            val earlier = earlierNoteFor(report.reportId, extras.notesTrail)?.let { earlierNoteOf(it) }
            ReportNotesPanel(
                visible = panel == ReportPanel.Notes,
                onDismiss = { panel = ReportPanel.None },
                detent = notesDetent,
                onDetentChange = { notesDetent = it },
                note = tools.reportNoteDraft,
                onNoteChange = tools.onReportNoteChange,
                filing = ReportQuote.sourceLabel(report).removePrefix(ticker).trim().ifBlank { null },
                saveState = autosave.state,
                savedAgo = parseInstantMs(tools.noteUpdatedAt)?.let { fmt.relative(Instant.ofEpochMilli(it)) },
                onRetry = autosave::retry,
                onCopy = { clipboard.setText(AnnotatedString(currentTools.reportNoteDraft)) }
                    .takeIf { tools.reportNoteDraft.isNotBlank() },
                earlier = earlier,
                onCarryForward = {
                    val text = earlierNoteFor(report.reportId, currentTools.host.notesTrail)?.text.orEmpty()
                    if (text.isNotBlank()) currentTools.onReportNoteChange(text.trim())
                },
                scrollToEnd = scrollNoteToEnd,
            )
            ReportFeedbackPanel(
                visible = panel == ReportPanel.Feedback,
                onDismiss = { panel = ReportPanel.None },
                detent = feedbackDetent,
                onDetentChange = { feedbackDetent = it },
                onSubmit = { code, details -> currentTools.onSubmitReportFeedback(code, details) },
            )
        },
    ) { pageModifier ->
        if (!isRefreshingToken) {
            // A refreshed token gives a new WebView, so the page loads once more with the new header.
            key(refreshedToken) {
                DeepDiveWebPage(
                    pageUrl = pageUrl,
                    headers = headers,
                    backgroundColor = p.bg,
                    onMainFrameFailed = onMainFrameFailed,
                    modifier = pageModifier,
                    printer = printer,
                    onProgress = { progress = it },
                    onLoaded = { pageLoaded = true },
                    onScroll = { scrollY, dy ->
                        dockVisible = ReportDockScroll.visibleAfter(dockVisible, scrollY, dy, slopPx)
                    },
                    onAddToNote = addToNote,
                )
            }
        }
    }

    when (panel) {
        ReportPanel.Overflow -> ThesisSheet(onDismissRequest = { if (exporting == ExportJob.None) panel = ReportPanel.None }) {
            ReportOverflowContent(
                exporting = exporting,
                onClassicView = {
                    panel = ReportPanel.None
                    onClassicView()
                },
                onExportPdf = exportPdf,
                onShareCard = shareCard,
                onFeedback = { panel = ReportPanel.Feedback },
            )
        }
        ReportPanel.Compare -> ThesisSheet(
            onDismissRequest = { panel = ReportPanel.None },
            title = if (compareStep == CompareStep.Choose) ReportCopy.compareTitle(ticker) else null,
        ) {
            ReportCompareContent(
                ticker = ticker,
                step = compareStep,
                onStep = { compareStep = it },
                otherNames = otherNamesFor(ticker, extras.watchlist),
                earlierReports = earlierReportsFor(report.reportId, ticker, extras.reportHistory),
                onCompareNames = extras.onCompareNames?.let { open ->
                    { tickers: List<String> ->
                        panel = ReportPanel.None
                        open(tickers)
                    }
                },
                onCompareReport = extras.onCompareReports?.let { open ->
                    { earlierId: String ->
                        panel = ReportPanel.None
                        open(earlierId, report.reportId)
                    }
                },
            )
        }
        ReportPanel.Conviction -> ThesisSheet(onDismissRequest = { panel = ReportPanel.None }) {
            // The paywall opens behind this sheet's window, so the sheet closes before asking for an upgrade.
            Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState())) {
                DeepDiveConvictionSection(
                    isPro = tools.isPro,
                    timeline = tools.convictionTimeline,
                    timelineError = tools.convictionTimelineError,
                    oppositeCase = tools.oppositeCase,
                    oppositeCaseError = tools.oppositeCaseError,
                    isGeneratingOppositeCase = tools.isGeneratingOppositeCase,
                    onGenerateOppositeCase = tools.onGenerateOppositeCase,
                    onRefreshTimeline = tools.onRefreshConvictionTimeline,
                    onRequireUpgrade = { feature ->
                        panel = ReportPanel.None
                        tools.onRequireUpgrade(feature)
                    }
                )
            }
        }
        else -> Unit
    }
}

/**
 * The autosave's save for the view model's fire-and-forget note save: asks for the save, waits for it to start
 * and finish (`isSavingNote`), and reports success when the saved time moved. A save that never starts (no report
 * open) counts as failed after [NOTE_SAVE_START_MS], so the footer offers "Try again" instead of spinning.
 */
@Composable
private fun rememberNoteSave(tools: () -> DeepDiveNativeTools): suspend (String) -> Boolean {
    val latest by rememberUpdatedState(tools)
    return remember<suspend (String) -> Boolean> {
        { _ ->
            val before = latest().noteUpdatedAt
            latest().onSaveReportNote()
            val started = withTimeoutOrNull(NOTE_SAVE_START_MS) {
                snapshotFlow { latest().isSavingNote || latest().noteUpdatedAt != before }.first { it }
            } != null
            if (started) snapshotFlow { latest().isSavingNote }.first { !it }
            latest().noteUpdatedAt != before
        }
    }
}

/** The classic view's switch to the new view (and back): a text action in the bar (accent, 48 dp). */
@Composable
internal fun ViewTogglePill(label: String, onClick: () -> Unit) {
    TextAction(text = label, onClick = onClick)
}
