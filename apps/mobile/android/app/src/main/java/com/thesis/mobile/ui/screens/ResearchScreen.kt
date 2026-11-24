package com.thesis.mobile.ui.screens

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.Composable
import com.thesis.mobile.model.ReportHistoryItem

/**
 * The Research tab root (DESIGN-DIRECTION 5.17): ticker search, run a Deep Dive, recent reports.
 *
 * PR-1 (F3) separates the logic only: the root no longer doubles as the report screen. Running a Deep Dive
 * pushes `DeepDiveRunning(ticker)` and a finished or opened report is a `Report(id)` entry, so this screen
 * never shows a report or the build progress. The look is today's Deep Dive search state, reused through
 * [DeepDiveScreen] with no report; WP-E redraws it in PR-3.
 */
@Composable
fun ResearchScreen(
    ticker: String,
    recentHistory: List<ReportHistoryItem>,
    watchlist: List<String>,
    /** The last Deep Dive start or report open failure, shown under the field. */
    errorMessage: String?,
    onTickerChange: (String) -> Unit,
    /** Starts a Deep Dive for [ticker]. */
    onRunReport: () -> Unit,
    onOpenReport: (reportId: String) -> Unit,
    onOpenPulse: (date: String) -> Unit,
    padding: PaddingValues
) {
    DeepDiveScreen(
        report = null,
        isLoading = false,
        errorMessage = errorMessage,
        recentHistory = recentHistory,
        userTier = null,
        reportNoteDraft = "",
        noteUpdatedAt = null,
        isSavingNote = false,
        convictionTimeline = emptyList(),
        convictionTimelineError = null,
        oppositeCase = null,
        oppositeCaseError = null,
        isGeneratingOppositeCase = false,
        onReportNoteChange = {},
        onSaveReportNote = {},
        onGenerateOppositeCase = {},
        onRefreshConvictionTimeline = {},
        scenarioResult = null,
        isRunningScenario = false,
        onRunScenario = { _, _, _ -> },
        onRequireUpgrade = {},
        onSubmitReportFeedback = { _, _ -> },
        onNotify = {},
        onOpenHistoryReport = onOpenReport,
        onOpenPulseHistory = onOpenPulse,
        tickerState = ticker,
        watchlist = watchlist,
        onTickerChange = onTickerChange,
        onRunReport = onRunReport,
        onBack = {},
        padding = padding
    )
}
