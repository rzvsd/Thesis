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
