package com.thesis.mobile.ui.navigation

import com.thesis.mobile.model.AlertLedgerItemView

/**
 * Data work a route asks the ViewModel to start. Routing itself never calls the network: the shell applies
 * [NavRoute] to the navigator and hands these to `MainViewModel`.
 */
sealed interface RouteAction {
    /** Load the Pulse for [date] (YYYY-MM-DD) or the latest one, and remember it as last viewed. */
    data class OpenPulse(val date: String?) : RouteAction
    data class OpenWeeklyDigest(val fromPush: Boolean) : RouteAction
    data class OpenWarRoom(val warRoomId: String) : RouteAction
    data class OpenScenarioRun(val runId: String, val scenarioId: String?) : RouteAction
    data class SelectScenario(val scenarioId: String) : RouteAction
    data class OpenReport(val reportId: String) : RouteAction
    /** Select [ticker] without building anything (a War Room notification that named a ticker). */
    data class SelectTicker(val ticker: String) : RouteAction
    /** Select [ticker] and open or build its Deep Dive. */
    data class RunDeepDive(val ticker: String) : RouteAction
    /** Analytics: a push or link landed on [tab]. */
    data class TrackLanded(val tab: String) : RouteAction
}

/**
 * Where a route lands. Exactly one of [tab] / [modal] is set. [push] goes on top of [tab]'s root (the tab's
 * stack is reset first, so a link always shows the same screen whatever was open before).
 */
data class NavRoute(
    val tab: ShellTab? = null,
    val push: Destination? = null,
    val modal: Destination? = null,
    val namesFocusTicker: String? = null,
    val actions: List<RouteAction> = emptyList()
)

/**
 * Pure mapping from notifications, links and Inbox alerts to [NavRoute]s. It keeps the destinations the app
 * had before the redesign (5.5 "deep links unchanged"), expressed as stack entries instead of tab modes:
 * - "today": Today root, or the Weekly digest pushed on it; the Pulse for the given day is loaded.
 * - "names": Names root, focused on the ticker when there is one. A thesis-drift alert (thesis_drift,
 *   contrarian_alert) with a ticker also pushes that Name at "Since the last report" (5.25), where the Inbox opens
 *   the same alert, so a push and an Inbox tap land on the same page.
 * - "research": a War Room, a Scenario Stress run, a stored report, or a Deep Dive for the ticker, pushed on
 *   the Research root; nothing pushed when the link names none of these.
 * - "inbox": Inbox root. "you": You on the modal stack.
 */
object DeepLinkRouter {

    fun route(target: LaunchTarget): NavRoute? {
        val type = target.notificationType?.trim()?.lowercase()
        val landed = RouteAction.TrackLanded(target.tab.trim().lowercase())
        return when (target.tab.trim().lowercase()) {
            "today" -> {
                val digest = !target.digestDate.isNullOrBlank() || type == "weekly_digest"
                NavRoute(
                    tab = ShellTab.Today,
                    push = if (digest) Destination.WeeklyDigest(target.digestDate?.trim()?.ifBlank { null }) else null,
                    actions = listOfNotNull(
                        RouteAction.OpenPulse(target.pulseDate?.trim()?.ifBlank { null }),
                        if (digest) RouteAction.OpenWeeklyDigest(fromPush = true) else null,
                        landed
                    )
                )
            }
            "names" -> namesRoute(normalizeTicker(target.ticker), drift = type != null && type in DRIFT_TYPES, extra = listOf(landed))
            "research" -> researchRoute(
                warRoomId = target.warRoomId,
                scenarioRunId = target.scenarioRunId,
                scenarioId = target.scenarioId,
                reportId = target.reportId,
                ticker = target.ticker,
                warRoomType = type == "earnings_war_room",
                extra = listOf(landed)
            )
            "inbox" -> NavRoute(tab = ShellTab.Inbox, actions = listOf(landed))
            "you" -> NavRoute(modal = Destination.You, actions = listOf(landed))
            else -> null
        }
    }

    /**
     * True when [routeAlert] takes [alert] somewhere other than the Inbox root. An unknown route (or "inbox") lands
     * on the Inbox root, which is where the user already is: Inbox hides "Open" for those alerts instead of offering
     * a tap that changes nothing (5.5 race fixes). No alert detail destination exists yet; when one does, unknown
     * routes push it and this returns true for every alert.
     */
    fun alertHasDestination(alert: AlertLedgerItemView): Boolean {
        val route = routeAlert(alert)
        return route.tab != ShellTab.Inbox || route.push != null || route.modal != null
    }

    /** An Inbox alert or the Home morning briefing card. Unknown routes land on Inbox. */
    fun routeAlert(alert: AlertLedgerItemView): NavRoute {
        val briefing = if (alert.notificationType == "morning_exception_briefing") alert.briefingContext else null
        val targetRoute = briefing?.leadRoute?.trim()?.lowercase()?.ifBlank { null } ?: alert.route
        val ticker = briefing?.leadTicker?.ifBlank { null } ?: alert.ticker
        val reportId = briefing?.leadReportId?.ifBlank { null } ?: alert.reportId
        val pulseDate = briefing?.leadPulseDate?.ifBlank { null } ?: alert.pulseDate
        val digestDate = briefing?.leadDigestDate?.ifBlank { null } ?: alert.digestDate
        val relatedTickers = if (briefing != null && briefing.relatedTickers.isNotEmpty()) {
            briefing.relatedTickers
        } else {
            alert.relatedTickers
        }
        return when (targetRoute) {
            "today" -> if (!digestDate.isNullOrBlank()) {
                NavRoute(
                    tab = ShellTab.Today,
                    push = Destination.WeeklyDigest(digestDate),
                    actions = listOf(RouteAction.OpenWeeklyDigest(fromPush = false))
                )
            } else {
                NavRoute(tab = ShellTab.Today, actions = listOf(RouteAction.OpenPulse(pulseDate)))
            }
            "names" -> {
                val own = normalizeTicker(ticker)
                // As the Inbox's own route (InboxModels.route): drift by type or by category, on the alert's ticker.
                val drift = own != null && briefing == null && isDriftAlert(alert)
                if (drift) {
                    namesRoute(own, drift = true, extra = emptyList())
                } else {
                    NavRoute(tab = ShellTab.Names, namesFocusTicker = own ?: relatedTickers.firstNotNullOfOrNull(::normalizeTicker))
                }
            }
            "research" -> researchRoute(
                warRoomId = alert.warRoomId,
                scenarioRunId = null,
                scenarioId = null,
                reportId = reportId,
                ticker = ticker,
                warRoomType = false,
                extra = emptyList()
            )
            "you" -> NavRoute(modal = Destination.You)
            else -> NavRoute(tab = ShellTab.Inbox)
        }
    }

    private fun researchRoute(
        warRoomId: String?,
        scenarioRunId: String?,
        scenarioId: String?,
        reportId: String?,
        ticker: String?,
        warRoomType: Boolean,
        extra: List<RouteAction>
    ): NavRoute {
        val room = warRoomId?.trim().orEmpty()
        val runId = scenarioRunId?.trim().orEmpty()
        val scenario = scenarioId?.trim().orEmpty()
        val report = reportId?.trim().orEmpty()
        val symbol = normalizeTicker(ticker)
        val (push, actions) = when {
            room.isNotBlank() -> Destination.WarRoom(room) to listOf(RouteAction.OpenWarRoom(room))
            warRoomType -> Destination.WarRoom(null) to listOfNotNull(symbol?.let(RouteAction::SelectTicker))
            runId.isNotBlank() -> Destination.ScenarioStress(runId = runId, scenarioId = scenario.ifBlank { null }) to
                listOf(RouteAction.OpenScenarioRun(runId, scenario.ifBlank { null }))
            scenario.isNotBlank() -> Destination.ScenarioStress(scenarioId = scenario) to
                listOf(RouteAction.SelectScenario(scenario))
            report.isNotBlank() -> Destination.Report(report, symbol) to listOf(RouteAction.OpenReport(report))
            symbol != null -> Destination.DeepDiveRunning(symbol) to listOf(RouteAction.RunDeepDive(symbol))
            else -> null to emptyList()
        }
        return NavRoute(tab = ShellTab.Research, push = push, actions = actions + extra)
    }

    /** The Names tab focused on [ticker]; a drift alert also pushes its Name at "Since the last report". */
    private fun namesRoute(ticker: String?, drift: Boolean, extra: List<RouteAction>): NavRoute = NavRoute(
        tab = ShellTab.Names,
        push = if (drift && ticker != null) Destination.Name(ticker, anchor = Destination.Name.ANCHOR_CHANGES) else null,
        namesFocusTicker = ticker,
        actions = extra
    )

    private fun isDriftAlert(alert: AlertLedgerItemView): Boolean {
        val type = alert.notificationType.trim().lowercase()
        val category = alert.category.trim().lowercase().replace(' ', '_').replace('-', '_')
        return type in DRIFT_TYPES || category == "thesis_drift" || category == "drift" || category == "thesisdrift"
    }

    private val DRIFT_TYPES = setOf("thesis_drift", "contrarian_alert")

    private fun normalizeTicker(raw: String?): String? = raw?.trim()?.uppercase()?.ifBlank { null }
}
