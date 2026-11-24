package com.thesis.mobile.model

/**
 * Client-side research data kept in the offline cache (DESIGN-DIRECTION 5.5): the notes trail, monitor
 * snapshot history and report summaries. Built from data the API already returns; no new backend.
 */

/** One report's note in a ticker's dated trail (newest first). */
data class NoteTrailEntry(
    val reportId: String,
    val ticker: String?,
    val text: String,
    /** Server `updated_at` of the note. */
    val updatedAt: String?,
    /** For example "FY2025"; null when the report did not say. */
    val filingPeriod: String?,
    /** The report's verdict sentence. */
    val verdict: String?
)

/** One monitor reading of one ticker at [takenAtMs] (epoch ms), from a board refresh. */
data class SnapshotPoint(
    val ticker: String,
    val takenAtMs: Long,
    val state: String,
    val score: Double,
    val freshnessScore: Double,
    val reportId: String?
)

/**
 * The current reading against the one before a reference time ("since your last visit"). [previous] is null
 * when no reading is that old yet: rows then show the report age instead of a delta.
 */
data class SnapshotDelta(
    val ticker: String,
    val current: SnapshotPoint,
    val previous: SnapshotPoint?
) {
    val scoreChange: Double? get() = previous?.let { current.score - it.score }
    val stateChanged: Boolean get() = previous != null && !previous.state.equals(current.state, ignoreCase = true)
}

/** What Name and Compare need from a stored report, cached on every `getDeepDiveReport`. */
data class ReportSummaryView(
    val reportId: String,
    val ticker: String?,
    val companyName: String?,
    val generatedAt: String?,
    val filingPeriod: String?,
    val verdict: String?,
    val changeSummary: DeepDiveChangeSummaryView?,
    /** The last five annual rows, oldest first. */
    val annualHistory: List<FinancialHistoryRowView>
)

/** Number of annual rows a summary keeps. */
const val REPORT_SUMMARY_ANNUAL_ROWS = 5

fun DeepDiveReportView.toReportSummary(): ReportSummaryView = ReportSummaryView(
    reportId = reportId,
    ticker = ticker?.trim()?.uppercase()?.ifBlank { null },
    companyName = issuer?.name?.trim()?.ifBlank { null },
    generatedAt = generatedAt,
    filingPeriod = latestFilingPeriod(),
    verdict = verdictSentence(),
    changeSummary = changeSummary,
    annualHistory = financialAnalysis?.annualHistory.orEmpty()
        .sortedBy { it.fiscalYear }
        .takeLast(REPORT_SUMMARY_ANNUAL_ROWS)
)

/** The report's one-line conclusion: the story headline, else the thesis statement. */
fun DeepDiveReportView.verdictSentence(): String? =
    storyHeader?.headline?.trim()?.ifBlank { null } ?: thesisStatement?.trim()?.ifBlank { null }

/** The latest annual period the report covers, for example "FY2025". */
fun DeepDiveReportView.latestFilingPeriod(): String? =
    financialAnalysis?.annualHistory.orEmpty().maxByOrNull { it.fiscalYear }?.period?.trim()?.ifBlank { null }

/** [current] against the latest reading at or before [sinceMs] in [history] (any order). */
fun snapshotDeltaSince(current: SnapshotPoint, history: List<SnapshotPoint>, sinceMs: Long): SnapshotDelta =
    SnapshotDelta(
        ticker = current.ticker,
        current = current,
        previous = history
            .filter { it.ticker.equals(current.ticker, ignoreCase = true) && it.takenAtMs <= sinceMs }
            .maxByOrNull { it.takenAtMs }
    )
