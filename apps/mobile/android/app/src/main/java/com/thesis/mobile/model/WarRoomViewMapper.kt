package com.thesis.mobile.model

import org.json.JSONArray
import org.json.JSONObject

object WarRoomViewMapper {
    fun mapWarRoomView(json: JSONObject): WarRoomView? {
        val root = json.optJSONObject("data") ?: json
        val warRoomId = root.optFirstString("war_room_id", "warRoomId", "id") ?: return null
        val timelineRows = root.optJSONArray("timeline")
        val phases = buildList {
            parsePhaseArray(root.optJSONArray("phases"))?.let { addAll(it) }
            listOf("pre", "live", "post").forEach { phaseKey ->
                mapWarRoomPhase(root, phaseKey)?.let { add(it) }
            }
            addAll(parseTimelinePhases(timelineRows))
        }
            .distinctBy { it.phase.lowercase() }
            .sortedBy { phaseOrder(it.phase) }
        val latestTimelineEvent = latestTimelineEvent(timelineRows)
        val summary = root.optFirstString("summary", "overview", "body", "description")
            ?: latestTimelineEvent?.optFirstString("reason_text", "summary", "body", "description")
        val generatedAt = root.optFirstString("generated_at", "created_at", "updated_at")
            ?: latestTimelineEvent?.optFirstString("created_at", "updated_at", "timestamp")

        return WarRoomView(
            warRoomId = warRoomId,
            title = root.optFirstString("title", "headline", "name"),
            ticker = root.optFirstString("ticker", "symbol"),
            status = root.optFirstString("status", "state"),
            generatedAt = generatedAt,
            summary = summary,
            phases = phases,
            relatedTickers = parseStringList(root.optJSONArray("related_tickers"))
        )
    }

    private fun parsePhaseArray(rows: JSONArray?): List<WarRoomPhaseView>? {
        if (rows == null || rows.length() == 0) {
            return null
        }

        return (0 until rows.length()).mapNotNull { index ->
            val row = rows.optJSONObject(index) ?: return@mapNotNull null
            mapWarRoomPhase(row, row.optFirstString("phase", "mode", "stage") ?: "phase_$index")
        }
    }

    private fun parseTimelinePhases(rows: JSONArray?): List<WarRoomPhaseView> {
        if (rows == null || rows.length() == 0) {
            return emptyList()
        }

        val grouped = linkedMapOf<String, MutableList<JSONObject>>()
        for (index in 0 until rows.length()) {
            val row = rows.optJSONObject(index) ?: continue
            val phase = row.optFirstString("phase", "stage", "mode")?.lowercase() ?: continue
            grouped.getOrPut(phase) { mutableListOf() }.add(row)
        }

        return grouped.mapNotNull { (phase, events) ->
            if (events.isEmpty()) {
                return@mapNotNull null
            }
            val highlights = events
                .mapNotNull { event ->
                    event.optFirstString("reason_text", "reason", "summary", "body", "description")
                }
                .filter { it.isNotBlank() }
                .takeLast(4)
            val latest = events.last()

            WarRoomPhaseView(
                phase = phase,
                title = phaseTitle(phase),
                summary = highlights.lastOrNull()
                    ?: latest.optFirstString("event_type", "type")
                    ?: "",
                highlights = highlights,
                status = latest.optFirstString("event_type", "type", "status"),
                ticker = latest.optFirstString("ticker", "symbol"),
                route = latest.optFirstString("route", "target_route"),
                reportId = latest.optFirstString("report_id", "target_report_id"),
                updatedAt = latest.optFirstString("created_at", "updated_at", "timestamp")
            )
        }
    }

    private fun mapWarRoomPhase(root: JSONObject, phaseKey: String): WarRoomPhaseView? {
        val phaseObject = firstJsonObject(
            root.optJSONObject(phaseKey),
            root.optJSONObject("${phaseKey}_summary"),
            root.optJSONObject("${phaseKey}_report"),
            root.optJSONObject("${phaseKey}_data"),
            root.optJSONObject("${phaseKey}_section")
        )

        val directSummary = root.optFirstString(
            phaseKey,
            "${phaseKey}_summary",
            "${phaseKey}_body",
            "${phaseKey}_description"
        )

        if (phaseObject == null && directSummary.isNullOrBlank()) {
            return null
        }

        val payload = phaseObject ?: JSONObject()
        val phaseLabel = payload.optFirstString("phase", "mode", "stage") ?: phaseKey
        val summary = payload.optFirstString("summary", "body", "text", "description")
            ?: directSummary
            ?: payload.optFirstString("headline", "title")
            ?: ""
        val highlights = parseStringList(
            payload.optJSONArray("highlights")
                ?: payload.optJSONArray("bullets")
                ?: payload.optJSONArray("points")
                ?: payload.optJSONArray("actions")
        )

        return WarRoomPhaseView(
            phase = phaseLabel,
            title = payload.optFirstString("title", "headline", "label", "name")
                ?: phaseTitle(phaseKey),
            summary = summary,
            highlights = highlights,
            status = payload.optFirstString("status", "state"),
            ticker = payload.optFirstString("ticker", "symbol", "lead_ticker"),
            route = payload.optFirstString("route", "target_route", "lead_route", "downstream_route"),
            reportId = payload.optFirstString("report_id", "target_report_id", "lead_report_id"),
            updatedAt = payload.optFirstString("updated_at", "generated_at", "timestamp")
        )
    }

    private fun phaseTitle(phaseKey: String): String =
        phaseKey
            .replace('_', ' ')
            .split(" ")
            .joinToString(" ") { token ->
                token.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
            }

    private fun parseStringList(rows: JSONArray?): List<String> {
        if (rows == null) {
            return emptyList()
        }

        return (0 until rows.length()).mapNotNull { index ->
            rows.optString(index).trim().takeIf { it.isNotBlank() }
        }
    }

    private fun firstJsonObject(vararg candidates: JSONObject?): JSONObject? =
        candidates.firstOrNull { it != null }

    private fun JSONObject.optNullableString(key: String): String? {
        val value = optString(key, "")
        return if (value.isBlank()) null else value
    }

    private fun JSONObject.optFirstString(vararg keys: String): String? {
        keys.forEach { key ->
            val value = optString(key).trim()
            if (value.isNotBlank()) {
                return value
            }
        }
        return null
    }

    private fun phaseOrder(phase: String): Int = when (phase.lowercase()) {
        "pre" -> 0
        "live" -> 1
        "post" -> 2
        else -> 3
    }

    private fun latestTimelineEvent(rows: JSONArray?): JSONObject? {
        if (rows == null || rows.length() == 0) {
            return null
        }

        var latest: JSONObject? = null
        var latestTs: String? = null
        for (index in 0 until rows.length()) {
            val row = rows.optJSONObject(index) ?: continue
            val ts = row.optFirstString("created_at", "updated_at", "timestamp") ?: continue
            if (latestTs == null || ts > latestTs) {
                latest = row
                latestTs = ts
            }
        }
        return latest ?: rows.optJSONObject(rows.length() - 1)
    }
}
