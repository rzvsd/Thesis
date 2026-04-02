package com.thesis.mobile.offline

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [
        CachedPulseEntity::class,
        CachedDeepDiveEntity::class,
        CachedSentimentCurrentEntity::class,
        CachedSentimentHistoryEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class OfflineCacheDatabase : RoomDatabase() {
    abstract fun dao(): OfflineCacheDao

    companion object {
        @Volatile
        private var INSTANCE: OfflineCacheDatabase? = null

        fun getInstance(context: Context): OfflineCacheDatabase =
            INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    OfflineCacheDatabase::class.java,
                    "thesis_offline_cache.db"
                ).fallbackToDestructiveMigration().build().also { INSTANCE = it }
            }
    }
}
