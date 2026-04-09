package com.thesis.mobile.ui.copy

object Phase4Copy {
    const val todayTab = "Today"
    const val namesTab = "Names"
    const val researchTab = "Research"
    const val inboxTab = "Inbox"
    const val youTab = "You"

    const val namesHeadline = "Names"
    const val namesSubtitle = "Monitor conviction, catalysts, and unresolved drift across every followed name."
    const val namesTickerLabel = "Ticker"
    const val namesAddLabel = "Add"
    const val namesRefreshLabel = "Refresh board"
    const val namesTrustFreshnessLabel = "TRUST FRESHNESS"
    const val namesFocusedFromAlertPrefix = "Focused from alert:"
    const val namesFocusedBadge = "From alert"
    const val namesNoNamesTitle = "No names yet"
    const val namesNoNamesBody = "Add a ticker to start tracking thesis strength, catalysts, and unresolved drift."
    const val namesEmptySegmentTitle = "Nothing in this segment"
    const val namesEmptySegmentBody = "Your current names do not match this priority filter."
    const val namesNoBaselineState = "No baseline"
    const val namesNoBaselineDetail = "Run a Deep Dive to start freshness tracking for this name."
    const val namesNoDriftReason = "No thesis drift recorded yet."
    const val namesNoBaselineReason = "No completed Deep Dive exists yet for this name."
    const val namesCatalystSoonLabel = "Catalyst soon"
    const val namesDeepDiveLabel = "Deep Dive"
    const val namesAddNoteLabel = "Add Note"
    const val namesRemoveLabel = "Remove"
    const val inboxHeadline = "Inbox"
    const val inboxSubtitle = "Every alert, explained, reviewable, and tunable."
    const val inboxRefreshLabel = "Refresh inbox"
    const val inboxUnavailableTitle = "Inbox unavailable"
    const val inboxEmptyTitle = "No alerts yet"
    const val inboxEmptyBody = "When Thesis raises a thesis drift, earnings, or market alert, it will appear here with the reason attached."
    const val inboxFilteredEmptyTitle = "Nothing in this filter"
    const val inboxFilteredEmptyBody = "Try another category to review the full alert history."
    const val inboxOpenLabel = "Open"
    const val inboxUsefulLabel = "Useful"
    const val inboxNotUsefulLabel = "Not Useful"
    const val inboxQuiet24hLabel = "Quiet 24h"
    const val inboxTurnOffTypeLabel = "Turn Off Type"
    const val inboxQuietedBadge = "Quieted 24h"
    const val morningBriefingEyebrow = "Morning Exception Briefing"
    const val morningBriefingNoChangeAction = "Open Today"
    const val morningBriefingExceptionAction = "Review Exception"
    const val youHeadline = "You"
    const val youSubtitle = "Controls, trust posture, and subscription details in one place."
    const val notificationGlobalOffNote = "Global notifications are off. This preference will apply when they are re-enabled."

    val namesSegments = listOf("All", "At Risk", "Catalysts Soon", "Unresolved")
    val inboxSegments = listOf("All", "Thesis Drift", "Earnings", "Macro", "System")

    fun notificationFamilyLabel(type: String): String =
        when (type) {
            "earnings_preview" -> "Earnings Preview"
            "contrarian_alert" -> "Thesis Drift"
            "kill_switch" -> "Kill-Switch"
            "freshness_decay" -> "Freshness Decay"
            "morning_exception_briefing" -> "Morning Briefing"
            "weekly_digest" -> "Weekly Digest"
            "market_pulse_ready" -> "Market Pulse"
            else -> type
                .replace('_', ' ')
                .split(" ")
                .joinToString(" ") { token ->
                    token.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
                }
        }

    fun alertCategoryLabel(category: String): String =
        when (category) {
            "thesis_drift" -> "Thesis Drift"
            "earnings" -> "Earnings"
            "macro" -> "Macro"
            "system" -> "System"
            else -> notificationFamilyLabel(category)
        }

    fun notificationQuietUntilNote(formattedQuietUntil: String): String =
        "Quiet until $formattedQuietUntil."
}
