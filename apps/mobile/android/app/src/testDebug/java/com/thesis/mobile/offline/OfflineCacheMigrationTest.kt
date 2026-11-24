package com.thesis.mobile.offline

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.lang.reflect.Modifier
import java.sql.Connection
import java.sql.DriverManager

/**
 * Room migration 1 -> 2 of the offline cache, run on real SQLite (sqlite-jdbc) on the JVM: the v1 schema as
 * Room created it, some cached rows, then [OfflineCacheMigrations.MIGRATION_1_2_SQL] (exactly what
 * `OfflineCacheDatabase.MIGRATION_1_2` executes).
 *
 * Checks what Room validates when it opens the migrated database (`TableInfo`): every entity field is a
 * column with the right affinity, NOT NULL and primary-key position, and the indices have Room's names.
 * Lives in `src/testDebug` because design-preview (which runs `src/test`) has no SQLite driver.
 */
class OfflineCacheMigrationTest {

    private lateinit var db: Connection

    @Before
    fun open() {
        db = DriverManager.getConnection("jdbc:sqlite::memory:")
        OfflineCacheMigrations.SCHEMA_V1.forEach(::exec)
        exec("PRAGMA user_version = 1")
        exec(
            "INSERT INTO cached_pulse (id, reportId, generatedAt, payload, updatedAtMs) " +
                "VALUES (1, 'pulse-1', '2026-11-24T07:00:00Z', '{}', 1)"
        )
        exec(
            "INSERT INTO cached_deep_dive (reportId, ticker, payload, updatedAtMs, lastAccessedAtMs, notePinned) " +
                "VALUES ('rep-1', 'AAPL', '{}', 1, 2, 1)"
        )
        OfflineCacheMigrations.MIGRATION_1_2_SQL.forEach(::exec)
        exec("PRAGMA user_version = 2")
    }

    @After
    fun close() = db.close()

    @Test
    fun keepsTheVersionOneCaches() {
        assertEquals(listOf("pulse-1"), strings("SELECT reportId FROM cached_pulse"))
        assertEquals(listOf("AAPL"), strings("SELECT ticker FROM cached_deep_dive WHERE notePinned = 1"))
    }

    @Test
    fun reportNotesMatchTheEntity() {
        assertTableMatches(
            table = "report_notes",
            entity = ReportNoteEntity::class.java,
            nullable = setOf("ticker", "updatedAt", "filingPeriod", "verdict"),
            primaryKey = listOf("reportId"),
            indices = setOf("index_report_notes_ticker")
        )
    }

    @Test
    fun snapshotHistoryMatchesTheEntity() {
        assertTableMatches(
            table = "monitor_snapshot_history",
            entity = MonitorSnapshotHistoryEntity::class.java,
            nullable = setOf("reportId"),
            primaryKey = listOf("ticker", "takenAtMs"),
            indices = setOf("index_monitor_snapshot_history_takenAtMs")
        )
    }

    @Test
    fun reportSummariesMatchTheEntity() {
        assertTableMatches(
            table = "report_summaries",
            entity = ReportSummaryEntity::class.java,
            nullable = setOf("ticker", "companyName", "generatedAt", "filingPeriod", "verdict"),
            primaryKey = listOf("reportId"),
            indices = setOf("index_report_summaries_ticker")
        )
    }

    @Test
    fun newTablesAcceptTheDaoWrites() {
        exec(
            "INSERT OR REPLACE INTO report_notes (reportId, ticker, text, updatedAt, filingPeriod, verdict, cachedAtMs) " +
                "VALUES ('rep-1', 'AAPL', 'What I believe', '2026-11-24T07:00:00Z', 'FY2025', 'Services carry the margin', 5)"
        )
        exec(
            "INSERT OR REPLACE INTO monitor_snapshot_history (ticker, takenAtMs, state, score, freshnessScore, reportId) " +
                "VALUES ('AAPL', 100, 'intact', 62.5, 0.9, NULL), ('AAPL', 200, 'watch', 58.0, 0.8, 'rep-1')"
        )
        // Same ticker and time replaces (composite primary key), as the DAO's REPLACE insert expects.
        exec(
            "INSERT OR REPLACE INTO monitor_snapshot_history (ticker, takenAtMs, state, score, freshnessScore, reportId) " +
                "VALUES ('AAPL', 200, 'watch', 57.0, 0.8, 'rep-1')"
        )
        assertEquals(listOf("57.0"), strings("SELECT score FROM monitor_snapshot_history WHERE takenAtMs = 200"))
        assertEquals(
            listOf("watch"),
            strings(
                "SELECT state FROM monitor_snapshot_history WHERE ticker = 'AAPL' AND takenAtMs <= 250 " +
                    "ORDER BY takenAtMs DESC LIMIT 1"
            )
        )
        exec("DELETE FROM monitor_snapshot_history WHERE takenAtMs < 150")
        assertEquals(listOf("200"), strings("SELECT takenAtMs FROM monitor_snapshot_history"))
    }

    // ---- helpers

    private data class Column(val type: String, val notNull: Boolean, val pk: Int)

    private fun assertTableMatches(
        table: String,
        entity: Class<*>,
        nullable: Set<String>,
        primaryKey: List<String>,
        indices: Set<String>
    ) {
        val actual = columns(table)
        val fields = entity.declaredFields.filter { !Modifier.isStatic(it.modifiers) && !it.isSynthetic }
        assertEquals("columns of $table", fields.map { it.name }.toSet(), actual.keys)
        fields.forEach { field ->
            val column = actual.getValue(field.name)
            assertEquals("affinity of $table.${field.name}", affinity(field.type), column.type)
            assertEquals("NOT NULL of $table.${field.name}", field.name !in nullable, column.notNull)
            // A primitive field can never hold null: it must be NOT NULL.
            if (field.type.isPrimitive) assertTrue(column.notNull)
            val expectedPk = primaryKey.indexOf(field.name) + 1
            assertEquals("primary key position of $table.${field.name}", expectedPk, column.pk)
        }
        val actualIndices = strings("SELECT name FROM pragma_index_list('$table') WHERE origin = 'c'").toSet()
        assertEquals("indices of $table", indices, actualIndices)
    }

    /** Room's column affinity for a Kotlin property type. */
    private fun affinity(type: Class<*>): String = when (type) {
        String::class.java -> "TEXT"
        java.lang.Long.TYPE, java.lang.Long::class.java,
        java.lang.Integer.TYPE, java.lang.Integer::class.java,
        java.lang.Boolean.TYPE, java.lang.Boolean::class.java -> "INTEGER"
        java.lang.Double.TYPE, java.lang.Double::class.java,
        java.lang.Float.TYPE, java.lang.Float::class.java -> "REAL"
        else -> error("no affinity mapping for $type")
    }

    private fun columns(table: String): Map<String, Column> {
        val out = linkedMapOf<String, Column>()
        db.createStatement().use { statement ->
            statement.executeQuery("PRAGMA table_info(`$table`)").use { rows ->
                while (rows.next()) {
                    out[rows.getString("name")] = Column(
                        type = rows.getString("type").uppercase(),
                        notNull = rows.getInt("notnull") == 1,
                        pk = rows.getInt("pk")
                    )
                }
            }
        }
        return out
    }

    private fun exec(sql: String) {
        db.createStatement().use { it.execute(sql) }
    }

    private fun strings(sql: String): List<String> = db.createStatement().use { statement ->
        statement.executeQuery(sql).use { rows ->
            buildList { while (rows.next()) add(rows.getString(1)) }
        }
    }
}
