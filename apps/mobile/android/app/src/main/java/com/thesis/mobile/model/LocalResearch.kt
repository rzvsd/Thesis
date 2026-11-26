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
    val annualHistory: List<FinancialHistoryRowView>,
    /** The report's value-discipline score (Compare names); null when the report has none or an older cache entry. */
    val valueDiscipline: ValueDisciplineView? = null
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
        .takeLast(REPORT_SUMMARY_ANNUAL_ROWS),
    valueDiscipline = valueDiscipline
)

/** The report's one-line conclusion: the story headline, else the thesis statement. */
fun DeepDiveReportView.verdictSentence(): String? =
    storyHeader?.headline?.trim()?.ifBlank { null } ?: thesisStatement?.trim()?.ifBlank { null }

/** The latest annual period the report covers, for example "FY2025". */
fun DeepDiveReportView.latestFilingPeriod(): String? =
    financialAnalysis?.annualHistory.orEmpty().maxByOrNull { it.fiscalYear }?.period?.trim()?.ifBlank { null }

/**
 * The report Compare names reads for [ticker]: its monitor snapshot's report (a followed name), else [openReportId]
 * (the report being read, passed only when it is this name's), else its newest Deep Dive in [history]. So a name you
 * do not follow, opened from Search, History or Research, still has its report in the table. Null: no report yet.
 */
fun compareNamesReportId(
    ticker: String,
    snapshots: List<ThesisMonitorSnapshotView>,
    history: List<ReportHistoryItem>,
    openReportId: String?
): String? =
    snapshots.firstOrNull { it.ticker.equals(ticker, ignoreCase = true) }?.reportId?.trim()?.ifBlank { null }
        ?: openReportId?.trim()?.ifBlank { null }
        ?: history.filter { it.ticker.equals(ticker, ignoreCase = true) && it.type == "deep_dive" }
            .maxByOrNull { it.createdAt }?.reportId

/** [current] against the latest reading at or before [sinceMs] in [history] (any order). */
fun snapshotDeltaSince(current: SnapshotPoint, history: List<SnapshotPoint>, sinceMs: Long): SnapshotDelta =
    SnapshotDelta(
        ticker = current.ticker,
        current = current,
        previous = history
            .filter { it.ticker.equals(current.ticker, ignoreCase = true) && it.takenAtMs <= sinceMs }
            .maxByOrNull { it.takenAtMs }
    )

// ---- ViewModel contract for PR-3 (DESIGN-DIRECTION 5.5): what Name, Compare and Search read from UiState.

/** Everything Name(ticker) shows, assembled from data the app already has (no new endpoint). */
data class NameDetailView(
    val ticker: String,
    val snapshot: ThesisMonitorSnapshotView?,
    /** Change since the last Names visit; null until the snapshot history has a reading. */
    val delta: SnapshotDelta?,
    val summary: ReportSummaryView?,
    val notesTrail: List<NoteTrailEntry>,
    val alerts: List<AlertLedgerItemView>,
    val reports: List<ReportHistoryItem>,
    val isLoading: Boolean = false
)

/** Two reports side by side ("then vs now" or two names). */
data class CompareReportsState(
    val reportIdA: String,
    val reportIdB: String,
    val a: DeepDiveReportView? = null,
    val b: DeepDiveReportView? = null,
    val isLoading: Boolean = true,
    val error: String? = null
)

/** N names in one table: each ticker's latest report summary, null when it has no report yet. */
data class CompareNamesState(
    val tickers: List<String>,
    val summaries: Map<String, ReportSummaryView?> = emptyMap(),
    val isLoading: Boolean = true,
    val error: String? = null
)

/** Search across tickers (server), followed names, cached reports and note text. */
data class SearchResultsView(
    val query: String,
    val tickers: List<TickerSearchItem> = emptyList(),
    val names: List<String> = emptyList(),
    val reports: List<ReportSearchHit> = emptyList(),
    val notes: List<NoteTrailEntry> = emptyList(),
    val isSearchingServer: Boolean = false
) {
    val isEmpty: Boolean get() = tickers.isEmpty() && names.isEmpty() && reports.isEmpty() && notes.isEmpty()
}

data class ReportSearchHit(
    val reportId: String,
    val ticker: String?,
    val companyName: String?,
    val type: String,
    val createdAt: String
)

/** Minimum query length; shorter queries return no local hits (one letter matches half the market). */
const val SEARCH_MIN_QUERY = 1

/**
 * The client-side half of `search(query)`: followed names, report history (by ticker or cached company name)
 * and note text, case-insensitive. Newest reports first; at most [limit] hits per group.
 */
fun searchLocal(
    query: String,
    watchlist: List<String>,
    history: List<ReportHistoryItem>,
    summaries: Map<String, ReportSummaryView>,
    notes: List<NoteTrailEntry>,
    limit: Int = 20
): SearchResultsView {
    val q = query.trim()
    if (q.length < SEARCH_MIN_QUERY) return SearchResultsView(query = query)
    fun String?.hit() = this?.contains(q, ignoreCase = true) == true
    val names = watchlist.filter { it.hit() || summaries.values.any { s -> s.ticker.equals(it, true) && s.companyName.hit() } }
        .distinct().take(limit)
    val reports = history
        .filter { item -> item.ticker.hit() || summaries[item.reportId]?.companyName.hit() }
        .sortedByDescending { it.createdAt }
        .take(limit)
        .map { ReportSearchHit(it.reportId, it.ticker, summaries[it.reportId]?.companyName, it.type, it.createdAt) }
    val noteHits = notes.filter { it.text.isNotBlank() && (it.text.hit() || it.ticker.hit()) }.take(limit)
    return SearchResultsView(query = query, names = names, reports = reports, notes = noteHits)
}

/** True when data fetched at [fetchedAtMs] is younger than [maxAgeMs] at [nowMs] (tab switches skip refetch). */
fun isFresh(fetchedAtMs: Long?, nowMs: Long, maxAgeMs: Long = TAB_DATA_MAX_AGE_MS): Boolean =
    fetchedAtMs != null && fetchedAtMs > 0 && nowMs - fetchedAtMs in 0 until maxAgeMs

/** Section 5.5: a tab switch does not refetch data younger than five minutes. */
const val TAB_DATA_MAX_AGE_MS = 5 * 60 * 1000L
