package com.thesis.mobile.offline

import android.content.Context
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.SentimentSnapshotView

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

    suspend fun clearAll() {
        dao.clearPulse()
        dao.clearDeepDives()
        dao.clearSentimentCurrent()
        dao.clearSentimentHistory()
    }

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
