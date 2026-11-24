package com.thesis.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.thesis.mobile.model.ConvictionJournalEntryView
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.OppositeCaseReportView
import com.thesis.mobile.model.ScenarioResultView
import com.thesis.mobile.ui.components.SignalBadge
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography

/**
 * The app-only parts of an open Deep Dive (notes, conviction and the opposite case, the scenario run,
 * Scenario Stress, feedback and export). The web page does not have these, so the web view keeps them
 * one tap away in a row above the page, each opening the same native section the classic view shows.
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
    val onOpenScenarioStress: (() -> Unit)?
)

internal enum class DeepDiveTool(val label: String) {
    NOTES("Notes"),
    CONVICTION("Conviction"),
    SCENARIO("Scenario"),
    STRESS("Stress test"),
    FEEDBACK("Feedback"),
    EXPORT("Export")
}

internal object DeepDiveWebCopy {
    const val classicView = "Classic view"
    const val newView = "New view"
    const val loadFailed = "The new view did not load. Showing the classic view."
    const val needsConnection = "The new view needs an internet connection."
}

/**
 * Shows an open Deep Dive as the server-rendered page when [DeepDiveWebPolicy.chooseView] allows it,
 * and otherwise (offline, failed load, sample report, offline copy of a report, classic view picked)
 * shows [nativeReport] as before. [nativeReport] gets a callback that switches to the new view, or null
 * when the new view cannot be offered right now (no connection, no server id, no session).
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
    // Saved across rotation, so a failed load is not retried (with its notice again) and an open tool stays open.
    var classicChosen by rememberSaveable(report.reportId) { mutableStateOf(false) }
    var newViewChosen by rememberSaveable(report.reportId) { mutableStateOf(false) }
    var pageLoadFailed by rememberSaveable(report.reportId) { mutableStateOf(false) }
    var attempt by rememberSaveable(report.reportId) { mutableStateOf(0) }
    var openTool by rememberSaveable(report.reportId) { mutableStateOf<DeepDiveTool?>(null) }
    // Export PDF prints the loaded page (same template as the share link).
    val printer = remember(report.reportId) { DeepDivePagePrinter() }
    // Checked when the report opens and on each retry. The live value only decides whether to offer the switch.
    val isOnline = remember(report.reportId, attempt) { isDeviceOnline(context) }
    val isOnlineNow by rememberDeviceOnline()
    // One token refresh per attempt after a 401. Kept in memory only: a token never goes into saved state.
    var tokenRetried by remember(report.reportId, attempt) { mutableStateOf(false) }
    var refreshedToken by remember(report.reportId, attempt) { mutableStateOf<String?>(null) }
    var isRefreshingToken by remember(report.reportId, attempt) { mutableStateOf(false) }

    // The paywall is drawn in the activity window, under a dialog's window, so a tool dialog closes when
    // the paywall opens (also when the server, not the dialog, asked for the upgrade).
    val isPaywallOpen = webPage?.isPaywallOpen == true
    LaunchedEffect(isPaywallOpen) {
        if (isPaywallOpen) {
            openTool = null
        }
    }

    val background = MaterialTheme.colorScheme.background
    val theme = if (background.luminance() < 0.5f) DeepDiveWebTheme.DARK else DeepDiveWebTheme.LIGHT
    val choice = DeepDiveWebPolicy.chooseView(
        reportId = report.reportId,
        access = webPage,
        isOnline = isOnline,
        pageLoadFailed = pageLoadFailed,
        classicChosen = classicChosen,
        newViewChosen = newViewChosen
    )
    val pageUrl = webPage?.let { DeepDiveWebPolicy.pageUrl(it.apiBaseUrl, report.reportId, theme) }

    if (choice == DeepDiveViewChoice.NATIVE || webPage == null || pageUrl == null) {
        // Sample reports and reports without a session keep today's screen untouched (no switch shown).
        // Offline, the switch appears once a connection is back.
        val offerNewView = DeepDiveWebPolicy.canShowWebPage(report.reportId, webPage, isOnlineNow)
        val openNewView: () -> Unit = {
            if (isDeviceOnline(context)) {
                classicChosen = false
                newViewChosen = true
                pageLoadFailed = false
                attempt += 1
            } else {
                tools.onNotify(DeepDiveWebCopy.needsConnection)
            }
        }
        nativeReport(openNewView.takeIf { offerNewView })
        return
    }

    val headers = DeepDiveWebPolicy.headersFor(
        pageUrl,
        webPage.apiBaseUrl,
        refreshedToken ?: webPage.accessToken
    )
    val markFailed: () -> Unit = {
        if (!pageLoadFailed) {
            pageLoadFailed = true
            tools.onNotify(DeepDiveWebCopy.loadFailed)
        }
    }
    val onMainFrameFailed: (Int?) -> Unit = { status ->
        val refresh = webPage.refreshAccessToken
        if (refresh != null && DeepDiveWebPolicy.shouldRetryWithFreshToken(status, tokenRetried, true)) {
            tokenRetried = true
            isRefreshingToken = true
            refresh { newToken ->
                isRefreshingToken = false
                if (newToken.isNullOrBlank()) {
                    markFailed()
                } else {
                    refreshedToken = newToken
                }
            }
        } else {
            markFailed()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding)
            .background(background)
    ) {
        DeepDiveWebTopBar(
            ticker = report.ticker ?: "Ticker",
            signalValue = report.signalValue,
            onBack = onBack,
            onClassicView = {
                classicChosen = true
                newViewChosen = false
            }
        )
        DeepDiveToolRow(
            showStress = tools.onOpenScenarioStress != null,
            onPick = { tool ->
                if (tool == DeepDiveTool.STRESS) {
                    tools.onOpenScenarioStress?.invoke()
                } else {
                    openTool = tool
                }
            }
        )
        val pageModifier = Modifier
            .fillMaxWidth()
            .weight(1f)
        if (isRefreshingToken) {
            // The 401 body is not shown; the page loads again once the token is refreshed.
            Box(modifier = pageModifier, contentAlignment = Alignment.Center) {
                CircularProgressIndicator(
                    modifier = Modifier.size(28.dp),
                    color = ThesisColors.Primary,
                    strokeWidth = 2.dp
                )
            }
        } else {
            // A refreshed token gives a new WebView, so the page loads once more with the new header.
            key(refreshedToken) {
                DeepDiveWebPage(
                    pageUrl = pageUrl,
                    headers = headers,
                    backgroundColor = background,
                    onMainFrameFailed = onMainFrameFailed,
                    modifier = pageModifier,
                    printer = printer
                )
            }
        }
    }

    openTool?.let { tool ->
        DeepDiveToolDialog(
            tool = tool,
            report = report,
            tools = tools,
            printer = printer,
            onDismiss = { openTool = null }
        )
    }
}

@Composable
private fun DeepDiveWebTopBar(
    ticker: String,
    signalValue: String?,
    onBack: () -> Unit,
    onClassicView: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(56.dp)
            .background(ThesisColors.Background.copy(alpha = 0.97f))
            .padding(horizontal = ThesisDimens.SpacingSm),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) {
                Icon(
                    imageVector = Icons.Default.ArrowBack,
                    contentDescription = "Back",
                    tint = ThesisColors.Primary
                )
            }
            Text(
                text = ticker,
                style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
                color = ThesisColors.TextPrimary
            )
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
        ) {
            ViewTogglePill(label = DeepDiveWebCopy.classicView, onClick = onClassicView)
            SignalBadge(signalValue = signalValue)
        }
    }
}

/** The small "Classic view" / "New view" switch; the classic screen's top bar uses it too. */
@Composable
internal fun ViewTogglePill(label: String, onClick: () -> Unit) {
    ToolPill(label = label, onClick = onClick)
}

@Composable
private fun DeepDiveToolRow(
    showStress: Boolean,
    onPick: (DeepDiveTool) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(ThesisColors.Background)
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = ThesisDimens.SpacingMd, vertical = ThesisDimens.SpacingXs),
        horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm),
        verticalAlignment = Alignment.CenterVertically
    ) {
        DeepDiveTool.values()
            .filter { it != DeepDiveTool.STRESS || showStress }
            .forEach { tool ->
                ToolPill(label = tool.label, onClick = { onPick(tool) })
            }
    }
}

@Composable
private fun ToolPill(label: String, onClick: () -> Unit) {
    val shape = RoundedCornerShape(ThesisDimens.SignalBadgeCorner)
    Text(
        text = label,
        style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium),
        color = ThesisColors.TextPrimary,
        modifier = Modifier
            .clip(shape)
            .background(ThesisColors.Surface)
            .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp)
    )
}

@Composable
private fun DeepDiveToolDialog(
    tool: DeepDiveTool,
    report: DeepDiveReportView,
    tools: DeepDiveNativeTools,
    printer: DeepDivePagePrinter,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    // The paywall opens behind this dialog's window, so close the dialog before asking for an upgrade.
    val requireUpgrade: (String) -> Unit = { feature ->
        onDismiss()
        tools.onRequireUpgrade(feature)
    }
    val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = ThesisDimens.SpacingMd, vertical = ThesisDimens.SpacingXl)
                .clip(shape)
                .background(ThesisColors.Surface)
                .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
                .verticalScroll(rememberScrollState())
                .padding(ThesisDimens.CardPadding),
            verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = listOfNotNull(report.ticker, tool.label).joinToString(" · "),
                    style = ThesisTypography.labelSmall,
                    color = ThesisColors.TextMuted
                )
                IconButton(onClick = onDismiss, modifier = Modifier.size(40.dp)) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Close",
                        tint = ThesisColors.TextSecondary
                    )
                }
            }

            when (tool) {
                DeepDiveTool.NOTES -> NotesSection(
                    noteDraft = tools.reportNoteDraft,
                    noteUpdatedAt = tools.noteUpdatedAt,
                    isSaving = tools.isSavingNote,
                    onNoteChange = tools.onReportNoteChange,
                    onSave = tools.onSaveReportNote
                )

                DeepDiveTool.CONVICTION -> DeepDiveConvictionSection(
                    isPro = tools.isPro,
                    timeline = tools.convictionTimeline,
                    timelineError = tools.convictionTimelineError,
                    oppositeCase = tools.oppositeCase,
                    oppositeCaseError = tools.oppositeCaseError,
                    isGeneratingOppositeCase = tools.isGeneratingOppositeCase,
                    onGenerateOppositeCase = tools.onGenerateOppositeCase,
                    onRefreshTimeline = tools.onRefreshConvictionTimeline,
                    onRequireUpgrade = requireUpgrade
                )

                DeepDiveTool.SCENARIO -> ScenarioSection(
                    isPro = tools.isPro,
                    valuation = report.valuation,
                    isRunning = tools.isRunningScenario,
                    scenarioResult = tools.scenarioResult,
                    onRunScenario = tools.onRunScenario,
                    onRequireUpgrade = requireUpgrade
                )

                DeepDiveTool.FEEDBACK -> ReportFeedbackSection(onSubmit = tools.onSubmitReportFeedback)

                DeepDiveTool.EXPORT -> ExportSection(
                    isPro = tools.isPro,
                    onRequireUpgrade = requireUpgrade,
                    onNotify = tools.onNotify,
                    onExportPdf = {
                        // The page's own PDF (print of the new view); the app's PDF only if printing is not possible.
                        onDismiss()
                        if (!printer.print(context, report.ticker)) {
                            shareExport(context, createPdfExport(context, report, ReportExportType.FULL_REPORT))
                        }
                    },
                    onExportCard = {
                        shareExport(context, createShareCard(context, report))
                    },
                    onExportMemo = {
                        shareExport(context, createPdfExport(context, report, ReportExportType.INVESTMENT_MEMO))
                    }
                )

                // Stress test navigates straight to Scenario Stress and never opens this dialog.
                DeepDiveTool.STRESS -> Unit
            }
            Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
        }
    }
}
