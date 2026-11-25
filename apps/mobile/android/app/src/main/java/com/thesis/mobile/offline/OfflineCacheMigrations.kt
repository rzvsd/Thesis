package com.thesis.mobile.offline

/**
 * Schema changes of [OfflineCacheDatabase], as plain SQL so a JVM test can run them on SQLite
 * (`OfflineCacheMigrationTest`). The Room `Migration` objects in [OfflineCacheDatabase] only execute these.
 *
 * The statements mirror what Room generates for the entities (column affinity, NOT NULL, primary key, index
 * names `index_<table>_<column>`), because Room compares the migrated schema with the entities on open.
 */
object OfflineCacheMigrations {

    /** Version 1 as Room created it (kept for the migration test). */
    val SCHEMA_V1: List<String> = listOf(
        "CREATE TABLE IF NOT EXISTS `cached_pulse` (`id` INTEGER NOT NULL, `reportId` TEXT NOT NULL, " +
            "`generatedAt` TEXT NOT NULL, `payload` TEXT NOT NULL, `updatedAtMs` INTEGER NOT NULL, PRIMARY KEY(`id`))",
        "CREATE TABLE IF NOT EXISTS `cached_deep_dive` (`reportId` TEXT NOT NULL, `ticker` TEXT, " +
            "`payload` TEXT NOT NULL, `updatedAtMs` INTEGER NOT NULL, `lastAccessedAtMs` INTEGER NOT NULL, " +
            "`notePinned` INTEGER NOT NULL, PRIMARY KEY(`reportId`))",
        "CREATE INDEX IF NOT EXISTS `index_cached_deep_dive_lastAccessedAtMs` ON `cached_deep_dive` (`lastAccessedAtMs`)",
        "CREATE INDEX IF NOT EXISTS `index_cached_deep_dive_notePinned` ON `cached_deep_dive` (`notePinned`)",
        "CREATE TABLE IF NOT EXISTS `cached_sentiment_current` (`id` INTEGER NOT NULL, `marketDate` TEXT NOT NULL, " +
            "`payload` TEXT NOT NULL, `updatedAtMs` INTEGER NOT NULL, PRIMARY KEY(`id`))",
        "CREATE TABLE IF NOT EXISTS `cached_sentiment_history` (`marketDate` TEXT NOT NULL, " +
            "`payload` TEXT NOT NULL, `updatedAtMs` INTEGER NOT NULL, PRIMARY KEY(`marketDate`))",
    )

    /** 1 -> 2: report notes, monitor snapshot history and report summaries. Existing caches are kept. */
    val MIGRATION_1_2_SQL: List<String> = listOf(
        "CREATE TABLE IF NOT EXISTS `report_notes` (`reportId` TEXT NOT NULL, `ticker` TEXT, `text` TEXT NOT NULL, " +
            "`updatedAt` TEXT, `filingPeriod` TEXT, `verdict` TEXT, `cachedAtMs` INTEGER NOT NULL, " +
            "PRIMARY KEY(`reportId`))",
        "CREATE INDEX IF NOT EXISTS `index_report_notes_ticker` ON `report_notes` (`ticker`)",
        "CREATE TABLE IF NOT EXISTS `monitor_snapshot_history` (`ticker` TEXT NOT NULL, `takenAtMs` INTEGER NOT NULL, " +
            "`state` TEXT NOT NULL, `score` REAL NOT NULL, `freshnessScore` REAL NOT NULL, `reportId` TEXT, " +
            "PRIMARY KEY(`ticker`, `takenAtMs`))",
        "CREATE INDEX IF NOT EXISTS `index_monitor_snapshot_history_takenAtMs` ON `monitor_snapshot_history` (`takenAtMs`)",
        "CREATE TABLE IF NOT EXISTS `report_summaries` (`reportId` TEXT NOT NULL, `ticker` TEXT, `companyName` TEXT, " +
            "`generatedAt` TEXT, `filingPeriod` TEXT, `verdict` TEXT, `payload` TEXT NOT NULL, " +
            "`cachedAtMs` INTEGER NOT NULL, PRIMARY KEY(`reportId`))",
        "CREATE INDEX IF NOT EXISTS `index_report_summaries_ticker` ON `report_summaries` (`ticker`)",
    )

    const val SNAPSHOT_HISTORY_DAYS = 90L
}
