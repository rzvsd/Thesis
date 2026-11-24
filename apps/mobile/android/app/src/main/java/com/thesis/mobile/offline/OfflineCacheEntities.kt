package com.thesis.mobile.offline

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(tableName = "cached_pulse")
data class CachedPulseEntity(
    @PrimaryKey
    val id: Int = 1,
    val reportId: String,
    val generatedAt: String,
    val payload: String,
    val updatedAtMs: Long
)

@Entity(
    tableName = "cached_deep_dive",
    indices = [Index("lastAccessedAtMs"), Index("notePinned")]
)
data class CachedDeepDiveEntity(
    @PrimaryKey
    val reportId: String,
    val ticker: String?,
    val payload: String,
    val updatedAtMs: Long,
    val lastAccessedAtMs: Long,
    val notePinned: Boolean
)

@Entity(tableName = "cached_sentiment_current")
data class CachedSentimentCurrentEntity(
    @PrimaryKey
    val id: Int = 1,
    val marketDate: String,
    val payload: String,
    val updatedAtMs: Long
)

@Entity(tableName = "cached_sentiment_history")
data class CachedSentimentHistoryEntity(
    @PrimaryKey
    val marketDate: String,
    val payload: String,
    val updatedAtMs: Long
)

// ---- Version 2 (DESIGN-DIRECTION 5.5 "client data layer"): local caches that give notes, Name deltas and
// Compare a home without new backend. Created by OfflineCacheMigrations.MIGRATION_1_2; the SQL there must
// match these declarations exactly (Room validates the schema after migrating).

/** One note per report, written through on every load and save of the report note. */
@Entity(tableName = "report_notes", indices = [Index("ticker")])
data class ReportNoteEntity(
    @PrimaryKey
    val reportId: String,
    val ticker: String?,
    val text: String,
    /** Server `updated_at` of the note (ISO 8601). */
    val updatedAt: String?,
    /** The report's filing period, for example "FY2025", when known. */
    val filingPeriod: String?,
    /** The report's one-sentence verdict, shown in the notes trail. */
    val verdict: String?,
    val cachedAtMs: Long
)

/** A monitor reading per ticker, appended on each board refresh and kept for 90 days. */
@Entity(
    tableName = "monitor_snapshot_history",
    primaryKeys = ["ticker", "takenAtMs"],
    indices = [Index("takenAtMs")]
)
data class MonitorSnapshotHistoryEntity(
    val ticker: String,
    val takenAtMs: Long,
    val state: String,
    val score: Double,
    val freshnessScore: Double,
    val reportId: String?
)

/** What Name and Compare need from a report without keeping the whole payload. */
@Entity(tableName = "report_summaries", indices = [Index("ticker")])
data class ReportSummaryEntity(
    @PrimaryKey
    val reportId: String,
    val ticker: String?,
    val companyName: String?,
    val generatedAt: String?,
    val filingPeriod: String?,
    val verdict: String?,
    /** A trimmed report (issuer, story header, change summary, annual history) in the deep-dive cache format. */
    val payload: String,
    val cachedAtMs: Long
)
