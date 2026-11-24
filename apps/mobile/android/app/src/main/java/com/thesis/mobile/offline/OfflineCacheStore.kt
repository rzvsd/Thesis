package com.thesis.mobile.offline

import android.content.Context
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.NoteTrailEntry
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.ReportNoteView
import com.thesis.mobile.model.ReportSummaryView
import com.thesis.mobile.model.SentimentSnapshotView
import com.thesis.mobile.model.SnapshotPoint
import com.thesis.mobile.model.ThesisMonitorSnapshotView
import com.thesis.mobile.model.latestFilingPeriod
import com.thesis.mobile.model.toReportSummary
import com.thesis.mobile.model.verdictSentence

class OfflineCacheStore private constructor(
    private val dao: OfflineCacheDao
) {
    suspend fun cachePulse(pulse: PulseReportView) {
        dao.upsertPulse(
            CachedPulseEntity(
                reportId = pulse.reportId,
                generatedAt = pulse.generatedAt,
                payload = OfflineJsonCodec.encodePulseReport(pulse),
                updatedAtMs = System.currentTimeMillis()
            )
        )
    }

    suspend fun getCachedPulse(): PulseReportView? =
        dao.getPulse()?.payload?.let(OfflineJsonCodec::decodePulseReport)

    suspend fun cacheDeepDive(report: DeepDiveReportView, notePinned: Boolean = false) {
        dao.upsertDeepDive(
            CachedDeepDiveEntity(
                reportId = report.reportId,
                ticker = report.ticker,
                payload = OfflineJsonCodec.encodeDeepDiveReport(report),
                updatedAtMs = System.currentTimeMillis(),
                lastAccessedAtMs = System.currentTimeMillis(),
                notePinned = notePinned
            )
        )
        pruneDeepDiveCache()
    }

    suspend fun getCachedDeepDive(reportId: String): DeepDiveReportView? {
        val row = dao.getDeepDive(reportId) ?: return null
        dao.touchDeepDive(reportId, System.currentTimeMillis())
        return OfflineJsonCodec.decodeDeepDiveReport(row.payload)
    }

    suspend fun setDeepDiveNotePinned(reportId: String, pinned: Boolean) {
        dao.setDeepDivePinned(reportId, pinned, System.currentTimeMillis())
    }

    suspend fun cacheSentiment(
        current: SentimentSnapshotView?,
        history: List<SentimentSnapshotView>
    ) {
        current?.let { snapshot ->
            dao.upsertSentimentCurrent(
                CachedSentimentCurrentEntity(
                    marketDate = snapshot.marketDate,
                    payload = OfflineJsonCodec.encodeSentimentSnapshot(snapshot),
                    updatedAtMs = System.currentTimeMillis()
                )
            )
        }
        val payloadRows = history.map { snapshot ->
            CachedSentimentHistoryEntity(
                marketDate = snapshot.marketDate,
                payload = OfflineJsonCodec.encodeSentimentSnapshot(snapshot),
                updatedAtMs = System.currentTimeMillis()
            )
        }
        if (payloadRows.isNotEmpty()) {
            dao.upsertSentimentHistory(payloadRows)
            dao.pruneSentimentHistory(MAX_SENTIMENT_HISTORY_ROWS)
        }
    }

    suspend fun getCachedSentimentCurrent(): SentimentSnapshotView? =
        dao.getSentimentCurrent()?.payload?.let(OfflineJsonCodec::decodeSentimentSnapshot)

    suspend fun getCachedSentimentHistory(limit: Int): List<SentimentSnapshotView> {
        val bounded = limit.coerceAtLeast(1).coerceAtMost(MAX_SENTIMENT_HISTORY_ROWS)
        return dao.getSentimentHistory(bounded)
            .mapNotNull { row -> OfflineJsonCodec.decodeSentimentSnapshot(row.payload) }
    }

    // ---- Notes trail (5.5): written through on every load and save of a report note.

    /**
     * Stores [note] for [reportId]. [report] (when it is the report the note belongs to) adds the ticker,
     * filing period and verdict; without it, those are kept from the previous row.
     */
    suspend fun cacheReportNote(reportId: String, note: ReportNoteView, report: DeepDiveReportView? = null) {
        val previous = dao.getReportNote(reportId)
        val owner = report?.takeIf { it.reportId == reportId }
        dao.upsertReportNote(
            ReportNoteEntity(
                reportId = reportId,
                ticker = owner?.ticker?.trim()?.uppercase()?.ifBlank { null } ?: previous?.ticker,
                text = note.content,
                updatedAt = note.updatedAt.ifBlank { null } ?: previous?.updatedAt,
                filingPeriod = owner?.latestFilingPeriod() ?: previous?.filingPeriod,
                verdict = owner?.verdictSentence() ?: previous?.verdict,
                cachedAtMs = System.currentTimeMillis()
            )
        )
    }

    suspend fun getCachedReportNote(reportId: String): NoteTrailEntry? = dao.getReportNote(reportId)?.toTrailEntry()

    /** The ticker's notes, newest first, including empty ones (a report the user opened but did not annotate). */
    suspend fun getNotesTrail(ticker: String): List<NoteTrailEntry> =
        dao.getReportNotesForTicker(ticker.trim().uppercase()).map { it.toTrailEntry() }

    /** Every non-empty note, newest first (Notes view, search, export). */
    suspend fun getAllNotes(): List<NoteTrailEntry> = dao.getAllReportNotes().map { it.toTrailEntry() }

    // ---- Monitor snapshot history (5.5): appended on each board refresh, kept 90 days.

    suspend fun appendSnapshotHistory(
        snapshots: List<ThesisMonitorSnapshotView>,
        takenAtMs: Long = System.currentTimeMillis()
    ) {
        if (snapshots.isEmpty()) return
        dao.insertSnapshotHistory(
            snapshots.mapNotNull { snapshot ->
                val ticker = snapshot.ticker.trim().uppercase().ifBlank { return@mapNotNull null }
                MonitorSnapshotHistoryEntity(
                    ticker = ticker,
                    takenAtMs = takenAtMs,
                    state = snapshot.state,
                    score = snapshot.score,
                    freshnessScore = snapshot.freshnessScore,
                    reportId = snapshot.reportId
                )
            }
        )
        dao.pruneSnapshotHistory(takenAtMs - SNAPSHOT_HISTORY_MS)
    }

    suspend fun getSnapshotHistory(ticker: String, limit: Int = 90): List<SnapshotPoint> =
        dao.getSnapshotHistory(ticker.trim().uppercase(), limit.coerceIn(1, 1_000)).map { it.toPoint() }

    /** The latest reading of [ticker] taken at or before [atOrBeforeMs] (for "since your last visit"). */
    suspend fun getSnapshotAtOrBefore(ticker: String, atOrBeforeMs: Long): SnapshotPoint? =
        dao.getSnapshotAtOrBefore(ticker.trim().uppercase(), atOrBeforeMs)?.toPoint()

    // ---- Report summaries (5.5): cached on every getDeepDiveReport.

    suspend fun cacheReportSummary(report: DeepDiveReportView) {
        val summary = report.toReportSummary()
        dao.upsertReportSummary(
            ReportSummaryEntity(
                reportId = summary.reportId,
                ticker = summary.ticker,
                companyName = summary.companyName,
                generatedAt = summary.generatedAt,
                filingPeriod = summary.filingPeriod,
                verdict = summary.verdict,
                payload = OfflineJsonCodec.encodeReportSummary(summary),
                cachedAtMs = System.currentTimeMillis()
            )
        )
    }

    suspend fun getReportSummary(reportId: String): ReportSummaryView? =
        dao.getReportSummary(reportId)?.payload?.let(OfflineJsonCodec::decodeReportSummary)

    suspend fun getReportSummariesForTicker(ticker: String): List<ReportSummaryView> =
        dao.getReportSummariesForTicker(ticker.trim().uppercase())
            .mapNotNull { OfflineJsonCodec.decodeReportSummary(it.payload) }

    suspend fun clearAll() {
        dao.clearPulse()
        dao.clearDeepDives()
        dao.clearSentimentCurrent()
        dao.clearSentimentHistory()
        dao.clearReportNotes()
        dao.clearSnapshotHistory()
        dao.clearReportSummaries()
    }

    private fun ReportNoteEntity.toTrailEntry() = NoteTrailEntry(
        reportId = reportId,
        ticker = ticker,
        text = text,
        updatedAt = updatedAt,
        filingPeriod = filingPeriod,
        verdict = verdict
    )

    private fun MonitorSnapshotHistoryEntity.toPoint() = SnapshotPoint(
        ticker = ticker,
        takenAtMs = takenAtMs,
        state = state,
        score = score,
        freshnessScore = freshnessScore,
        reportId = reportId
    )

    private suspend fun pruneDeepDiveCache() {
        val overage = dao.countDeepDives() - MAX_DEEP_DIVE_ROWS
        if (overage <= 0) {
            return
        }
        val candidates = dao.findUnpinnedEvictionCandidates(overage)
        if (candidates.isNotEmpty()) {
            dao.deleteDeepDiveByIds(candidates)
        }
    }

    companion object {
        private const val MAX_DEEP_DIVE_ROWS = 25
        private const val MAX_SENTIMENT_HISTORY_ROWS = 90
        private const val SNAPSHOT_HISTORY_MS = OfflineCacheMigrations.SNAPSHOT_HISTORY_DAYS * 24 * 60 * 60 * 1000L

        @Volatile
        private var INSTANCE: OfflineCacheStore? = null

        fun getInstance(context: Context): OfflineCacheStore =
            INSTANCE ?: synchronized(this) {
                INSTANCE ?: OfflineCacheStore(
                    OfflineCacheDatabase.getInstance(context).dao()
                ).also { INSTANCE = it }
            }
    }
}
