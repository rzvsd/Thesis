package com.thesis.mobile.offline

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface OfflineCacheDao {
    @Query("SELECT * FROM cached_pulse WHERE id = 1 LIMIT 1")
    suspend fun getPulse(): CachedPulseEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertPulse(entity: CachedPulseEntity)

    @Query("DELETE FROM cached_pulse")
    suspend fun clearPulse()

    @Query("SELECT * FROM cached_deep_dive WHERE reportId = :reportId LIMIT 1")
    suspend fun getDeepDive(reportId: String): CachedDeepDiveEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertDeepDive(entity: CachedDeepDiveEntity)

    @Query("UPDATE cached_deep_dive SET lastAccessedAtMs = :lastAccessedAtMs WHERE reportId = :reportId")
    suspend fun touchDeepDive(reportId: String, lastAccessedAtMs: Long)

    @Query("UPDATE cached_deep_dive SET notePinned = :notePinned, updatedAtMs = :updatedAtMs WHERE reportId = :reportId")
    suspend fun setDeepDivePinned(reportId: String, notePinned: Boolean, updatedAtMs: Long)

    @Query("SELECT COUNT(*) FROM cached_deep_dive")
    suspend fun countDeepDives(): Int

    @Query(
        "SELECT reportId FROM cached_deep_dive " +
            "WHERE notePinned = 0 ORDER BY lastAccessedAtMs ASC LIMIT :limit"
    )
    suspend fun findUnpinnedEvictionCandidates(limit: Int): List<String>

    @Query("DELETE FROM cached_deep_dive WHERE reportId IN (:reportIds)")
    suspend fun deleteDeepDiveByIds(reportIds: List<String>)

    @Query("DELETE FROM cached_deep_dive")
    suspend fun clearDeepDives()

    @Query("SELECT * FROM cached_sentiment_current WHERE id = 1 LIMIT 1")
    suspend fun getSentimentCurrent(): CachedSentimentCurrentEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertSentimentCurrent(entity: CachedSentimentCurrentEntity)

    @Query("DELETE FROM cached_sentiment_current")
    suspend fun clearSentimentCurrent()

    @Query("SELECT * FROM cached_sentiment_history ORDER BY marketDate DESC LIMIT :limit")
    suspend fun getSentimentHistory(limit: Int): List<CachedSentimentHistoryEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertSentimentHistory(entities: List<CachedSentimentHistoryEntity>)

    @Query(
        "DELETE FROM cached_sentiment_history " +
            "WHERE marketDate NOT IN (" +
            "  SELECT marketDate FROM cached_sentiment_history ORDER BY marketDate DESC LIMIT :maxRows" +
            ")"
    )
    suspend fun pruneSentimentHistory(maxRows: Int)

    @Query("DELETE FROM cached_sentiment_history")
    suspend fun clearSentimentHistory()

    // ---- report_notes

    @Query("SELECT * FROM report_notes WHERE reportId = :reportId LIMIT 1")
    suspend fun getReportNote(reportId: String): ReportNoteEntity?

    @Query("SELECT * FROM report_notes WHERE ticker = :ticker ORDER BY updatedAt DESC")
    suspend fun getReportNotesForTicker(ticker: String): List<ReportNoteEntity>

    @Query("SELECT * FROM report_notes WHERE text != '' ORDER BY updatedAt DESC")
    suspend fun getAllReportNotes(): List<ReportNoteEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertReportNote(entity: ReportNoteEntity)

    @Query("DELETE FROM report_notes")
    suspend fun clearReportNotes()

    // ---- monitor_snapshot_history

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSnapshotHistory(entities: List<MonitorSnapshotHistoryEntity>)

    @Query("SELECT * FROM monitor_snapshot_history WHERE ticker = :ticker ORDER BY takenAtMs DESC LIMIT :limit")
    suspend fun getSnapshotHistory(ticker: String, limit: Int): List<MonitorSnapshotHistoryEntity>

    @Query(
        "SELECT * FROM monitor_snapshot_history WHERE ticker = :ticker AND takenAtMs <= :atOrBeforeMs " +
            "ORDER BY takenAtMs DESC LIMIT 1"
    )
    suspend fun getSnapshotAtOrBefore(ticker: String, atOrBeforeMs: Long): MonitorSnapshotHistoryEntity?

    @Query("DELETE FROM monitor_snapshot_history WHERE takenAtMs < :olderThanMs")
    suspend fun pruneSnapshotHistory(olderThanMs: Long)

    @Query("DELETE FROM monitor_snapshot_history")
    suspend fun clearSnapshotHistory()

    // ---- report_summaries

    @Query("SELECT * FROM report_summaries WHERE reportId = :reportId LIMIT 1")
    suspend fun getReportSummary(reportId: String): ReportSummaryEntity?

    @Query("SELECT * FROM report_summaries WHERE ticker = :ticker ORDER BY generatedAt DESC")
    suspend fun getReportSummariesForTicker(ticker: String): List<ReportSummaryEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertReportSummary(entity: ReportSummaryEntity)

    @Query("DELETE FROM report_summaries")
    suspend fun clearReportSummaries()
}
