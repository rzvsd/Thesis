package com.thesis.mobile.launch

import java.net.URI
import java.net.URLDecoder
import java.nio.charset.StandardCharsets

internal object LaunchDestinationResolver {
    private val directTabs = setOf("today", "names", "research", "inbox", "you")

    fun resolveTab(openTab: String?, notificationType: String?, uriString: String?): String? {
        val normalizedTab = openTab?.trim()?.lowercase()
        val queryOpenTab = queryParameter(uriString, "open_tab")?.trim()?.lowercase()
        val effectiveTab = normalizedTab ?: queryOpenTab
        val normalizedType = notificationType?.trim()?.lowercase()
        val normalizedUri = uriString?.trim().orEmpty().lowercase()

        return when {
            effectiveTab in directTabs -> effectiveTab
            pathId(uriString, "report") != null -> "research"
            pathId(uriString, "name") != null -> "names"
            effectiveTab == "pulse" ||
                normalizedType == "market_pulse_ready" ||
                normalizedType == "morning_exception_briefing" ||
                normalizedType == "weekly_digest" ||
                normalizedUri.contains("thesis://pulse") ||
                normalizedUri.contains("thesis://today") -> "today"
            effectiveTab == "deep_dive" ||
                effectiveTab == "war_room" ||
                effectiveTab == "scenario" ||
                normalizedType == "earnings_preview" ||
                normalizedType == "earnings_war_room" ||
                normalizedType == "contrarian_alert" ||
                normalizedType == "kill_switch" ||
                normalizedUri.contains("thesis://deep-dive") ||
                normalizedUri.contains("thesis://research") ||
                normalizedUri.contains("thesis://war-room") ||
                normalizedUri.contains("thesis://scenario") -> "research"
            normalizedType == "freshness_decay" -> "names"
            normalizedUri.contains("thesis://names") -> "names"
            normalizedUri.contains("thesis://inbox") -> "inbox"
            normalizedUri.contains("thesis://you") -> "you"
            else -> null
        }
    }

    fun resolveWarRoomId(explicitWarRoomId: String?, uriString: String?): String? {
        explicitWarRoomId?.trim()?.takeIf { it.isNotBlank() }?.let { return it }
        return queryParameter(uriString, "war_room_id")
    }

    fun resolveScenarioId(explicitScenarioId: String?, uriString: String?): String? {
        explicitScenarioId?.trim()?.takeIf { it.isNotBlank() }?.let { return it }
        return queryParameter(uriString, "scenario_id")
    }

    fun resolveScenarioRunId(explicitScenarioRunId: String?, uriString: String?): String? {
        explicitScenarioRunId?.trim()?.takeIf { it.isNotBlank() }?.let { return it }
        return queryParameter(uriString, "scenario_run_id")
    }

    /** thesis://report/{reportId}, or report_id from extras or the query. */
    fun resolveReportId(explicitReportId: String?, uriString: String?): String? {
        explicitReportId?.trim()?.takeIf { it.isNotBlank() }?.let { return it }
        return pathId(uriString, "report") ?: queryParameter(uriString, "report_id")
    }

    /** thesis://name/{TICKER}, or ticker from extras or the query. */
    fun resolveTicker(explicitTicker: String?, uriString: String?): String? {
        explicitTicker?.trim()?.takeIf { it.isNotBlank() }?.let { return it.uppercase() }
        return (pathId(uriString, "name") ?: queryParameter(uriString, "ticker"))?.uppercase()
    }

    private fun pathId(uriString: String?, host: String): String? {
        val uri = runCatching { URI(uriString) }.getOrNull() ?: return null
        if (uri.scheme != "thesis" || uri.host != host) {
            return null
        }
        return uri.path
            ?.trim('/')
            ?.substringBefore('/')
            ?.trim()
            ?.takeIf { it.isNotBlank() }
    }

    private fun queryParameter(uriString: String?, key: String): String? {
        val uri = runCatching { URI(uriString) }.getOrNull() ?: return null
        val rawQuery = uri.rawQuery ?: return null
        return rawQuery
            .split("&")
            .asSequence()
            .mapNotNull { pair ->
                val separatorIndex = pair.indexOf('=')
                if (separatorIndex < 0) {
                    return@mapNotNull null
                }
                val decodedKey = decode(pair.substring(0, separatorIndex))
                if (decodedKey != key) {
                    return@mapNotNull null
                }
                decode(pair.substring(separatorIndex + 1)).takeIf { it.isNotBlank() }
            }
            .firstOrNull()
    }

    private fun decode(value: String): String =
        URLDecoder.decode(value, StandardCharsets.UTF_8.name()).trim()
}
