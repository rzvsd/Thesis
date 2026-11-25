package com.thesis.mobile.offline

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [
        CachedPulseEntity::class,
        CachedDeepDiveEntity::class,
        CachedSentimentCurrentEntity::class,
        CachedSentimentHistoryEntity::class,
        ReportNoteEntity::class,
        MonitorSnapshotHistoryEntity::class,
        ReportSummaryEntity::class
    ],
    version = 2,
    exportSchema = false
)
abstract class OfflineCacheDatabase : RoomDatabase() {
    abstract fun dao(): OfflineCacheDao

    companion object {
        @Volatile
        private var INSTANCE: OfflineCacheDatabase? = null

        /** Adds the notes, snapshot-history and report-summary tables; the v1 caches stay as they are. */
        val MIGRATION_1_2: Migration = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                OfflineCacheMigrations.MIGRATION_1_2_SQL.forEach { statement -> db.execSQL(statement) }
            }
        }

        fun getInstance(context: Context): OfflineCacheDatabase =
            INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    OfflineCacheDatabase::class.java,
                    "thesis_offline_cache.db"
                )
                    .addMigrations(MIGRATION_1_2)
                    // Still a cache: an unknown future path (a downgrade) rebuilds it instead of crashing.
                    .fallbackToDestructiveMigration()
                    .build()
                    .also { INSTANCE = it }
            }
    }
}
