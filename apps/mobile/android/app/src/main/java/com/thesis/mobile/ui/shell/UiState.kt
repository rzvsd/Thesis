// Package `com.thesis.mobile.ui` (not `.shell`) on purpose: `UiState` and `defaultNotificationPreferences` keep
// their names, so `Phase4CopyTest` and every screen import stay valid. Lives in ui/shell so design-preview
// compiles it (MainViewModel.kt is Android-only) and `ThesisShell` can take it.
package com.thesis.mobile.ui

import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.model.AuthTokens
import com.thesis.mobile.model.CompareNamesState
import com.thesis.mobile.model.CompareReportsState
import com.thesis.mobile.model.ConvictionInsightCardView
import com.thesis.mobile.model.ConvictionJournalEntryView
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.LastViewedReport
import com.thesis.mobile.model.NameDetailView
import com.thesis.mobile.model.NoteTrailEntry
import com.thesis.mobile.model.NotificationPreferenceView
import com.thesis.mobile.model.OppositeCaseReportView
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.model.ReportNoteView
import com.thesis.mobile.model.ReportSummaryView
import com.thesis.mobile.model.ScenarioResultView
import com.thesis.mobile.model.ScenarioStressRunView
import com.thesis.mobile.model.ScenarioStressTemplateView
import com.thesis.mobile.model.SearchResultsView
import com.thesis.mobile.model.SentimentSnapshotView
import com.thesis.mobile.model.SnapshotDelta
import com.thesis.mobile.model.SubscriptionOfferView
import com.thesis.mobile.model.ThesisMonitorSnapshotView
import com.thesis.mobile.model.TickerSearchItem
import com.thesis.mobile.model.UserProfileView
import com.thesis.mobile.model.WarRoomView
import com.thesis.mobile.ui.screens.AuthStatus
import com.thesis.mobile.ui.screens.RemoveFailure
import com.thesis.mobile.ui.shell.AppearancePrefs

/**
 * Everything the logged-in app renders. One immutable value published by `MainViewModel`; navigation state is
 * not here (the `AppNavigator` owns it: `currentTab` was deleted in PR-1).
 */
data class UiState(
    val showWelcome: Boolean = false,
    val apiBaseUrl: String = "",
    val notificationsEnabled: Boolean = true,
    val watchlistFeatureEnabled: Boolean = true,
    val notificationPreferences: List<NotificationPreferenceView> = defaultNotificationPreferences(),
    val tokens: AuthTokens? = null,
    val verificationToken: String? = null,
    val registerStatus: String? = null,
    val message: String? = null,
    /** The snackbar action for [message]; see [activeMessageAction]. */
    val messageAction: MessageAction? = null,
    /** Log in, register or verify in flight (Auth's buttons). */
    val authBusy: Boolean = false,
    /** The Auth status line (5.3): a typed result, so Auth never guesses tone or mode from [message]'s words. */
    val authStatus: AuthStatus? = null,
    val tickers: List<TickerSearchItem> = emptyList(),
    val selectedTicker: String? = null,
    val jobStatus: String? = null,
    /** A Deep Dive build is running (created or resumed); [jobStatus] has its server status. */
    val isDeepDiveRunning: Boolean = false,
    /**
     * Upper-case ticker of the Deep Dive build that is running, or that ran last ([deepDiveError] is its failure).
     * A `DeepDiveRunning(ticker)` entry shows progress and a failure only when this is its own ticker; otherwise
     * its build is no longer running.
     */
    val deepDiveBuildTicker: String? = null,
    /** A stored report is being fetched for a `Report(id)` entry. */
    val isOpeningReport: Boolean = false,
    val deepDiveReport: DeepDiveReportView? = null,
    // True when deepDiveReport is the offline copy shown because the API could not be reached.
    val deepDiveLoadedFromCache: Boolean = false,
    val deepDiveError: String? = null,
    val reportNote: ReportNoteView? = null,
    val reportNoteDraft: String = "",
    val isSavingNote: Boolean = false,
    val convictionTimeline: List<ConvictionJournalEntryView> = emptyList(),
    val convictionTimelineError: String? = null,
    val convictionInsights: List<ConvictionInsightCardView> = emptyList(),
    val convictionInsightsError: String? = null,
    val oppositeCase: OppositeCaseReportView? = null,
    val oppositeCaseError: String? = null,
    val isGeneratingOppositeCase: Boolean = false,
    val scenarioStressTemplates: List<ScenarioStressTemplateView> = emptyList(),
    val selectedScenarioStressId: String? = null,
    val scenarioStressRun: ScenarioStressRunView? = null,
    val scenarioStressTemplatesError: String? = null,
    val scenarioStressRunError: String? = null,
    val isLoadingScenarioStressTemplates: Boolean = false,
    val isRunningScenarioStress: Boolean = false,
    val scenarioResult: ScenarioResultView? = null,
    val isRunningScenario: Boolean = false,
    val pulseReport: PulseReportView? = null,
    val pulseLoadedFromCache: Boolean = false,
    val pulseError: String? = null,
    /**
     * Why the last Pulse refresh failed (null on success): Home's and the Pulse's cached-copy banners say "Offline"
     * only for [RefreshFailureKind.OFFLINE], since [pulseLoadedFromCache] is true after any failure.
     */
    val pulseFailureKind: RefreshFailureKind? = null,
    val isPulseRefreshing: Boolean = false,
    val sentimentCurrent: SentimentSnapshotView? = null,
    val sentimentHistory: List<SentimentSnapshotView> = emptyList(),
    val sentimentRangeDays: Int = 30,
    val sentimentError: String? = null,
    val isMacroRefreshing: Boolean = false,
    val alertLedger: List<AlertLedgerItemView> = emptyList(),
    /** The last Inbox failure, a load or an action (mute, feedback); action errors also go to the snackbar. */
    val inboxError: String? = null,
    /** The last failed alert ledger load (the list fetch only), null once a load succeeds (5.21). */
    val inboxLoadError: String? = null,
    /** Counts every reported Inbox error, so the same message twice is still a new error to the screen. */
    val inboxErrorSeq: Int = 0,
    /** The alert ledger has answered once (loaded or failed) this session: the Inbox skeleton ends. */
    val inboxLoaded: Boolean = false,
    val isInboxRefreshing: Boolean = false,
    val monitorSnapshots: List<ThesisMonitorSnapshotView> = emptyList(),
    /** Watchlist or monitor snapshots refreshing (Names board). */
    val isBoardRefreshing: Boolean = false,
    val isWarRoomLoading: Boolean = false,
    val warRoom: WarRoomView? = null,
    val warRoomError: String? = null,
    val reportHistory: List<ReportHistoryItem> = emptyList(),
    val watchlist: List<String> = emptyList(),
    val reportHistoryLoaded: Boolean = false,
    val isHistoryLoading: Boolean = false,
    val watchlistLoaded: Boolean = false,
    /** The last failed watchlist load, null once one succeeds: Names ends its skeleton and offers Try again. */
    val watchlistLoadError: String? = null,
    /** The last failed report history load, null once one succeeds: History ends its skeleton and offers Try again. */
    val historyLoadError: String? = null,
    /** The last remove the server refused (Names brings the row back). */
    val watchlistRemoveFailure: RemoveFailure? = null,
    val lastViewedReport: LastViewedReport? = null,
    val biometricSupported: Boolean = false,
    val biometricLockEnabled: Boolean = false,
    val userProfile: UserProfileView? = null,
    val paywallFeature: String? = null,
    val subscriptionOffers: List<SubscriptionOfferView> = emptyList(),
    val subscriptionActionInFlight: Boolean = false,
    // ---- Preferences and "since your last visit" (client-only, SessionStore)
    val appearance: AppearancePrefs = AppearancePrefs(),
    val lastInboxVisitAtMs: Long = 0L,
    val lastNamesVisitAtMs: Long = 0L,
    // ---- Client data layer for PR-3 (5.5)
    /** Change since the last Names visit per ticker, from the snapshot history. */
    val snapshotDeltas: Map<String, SnapshotDelta> = emptyMap(),
    val nameDetail: NameDetailView? = null,
    /** Notes trail per ticker (newest first), filled by `notesTrail(ticker)`. */
    val notesTrails: Map<String, List<NoteTrailEntry>> = emptyMap(),
    /** Every non-empty note, newest first, filled by `allNotes()`. */
    val allNotes: List<NoteTrailEntry> = emptyList(),
    val compareReports: CompareReportsState? = null,
    val compareNames: CompareNamesState? = null,
    val searchResults: SearchResultsView? = null,
    /** The last eight submitted searches, newest first (SessionStore). */
    val recentSearches: List<String> = emptyList(),
    /**
     * Cached report summaries by report id (company name, filing period, change summary), for the rows that name a
     * company or a filing (Names, Research, History, Search, the weekly digest).
     */
    val reportSummaries: Map<String, ReportSummaryView> = emptyMap(),
    /** Each followed name's reading now against its reading a week ago (the weekly digest's state changes). */
    val weeklyStateChanges: List<SnapshotDelta>? = null
) {
    /** Upper-case ticker to company name, from [reportSummaries]. */
    val companyNames: Map<String, String>
        get() = reportSummaries.values
            .mapNotNull { s -> s.ticker?.trim()?.uppercase()?.ifBlank { null }?.let { t -> s.companyName?.trim()?.ifBlank { null }?.let { t to it } } }
            .toMap()

    /** Report id to the filing period its report read ("FY2025"), from [reportSummaries]. */
    val filingPeriods: Map<String, String>
        get() = reportSummaries.mapNotNull { (id, s) -> s.filingPeriod?.trim()?.ifBlank { null }?.let { id to it } }.toMap()

    /** Report ids with a non-empty note ([allNotes]). */
    val notedReportIds: Set<String>
        get() = allNotes.filter { it.text.isNotBlank() }.map { it.reportId }.toSet()

    /** Deep Dive screen spinner: a report is opening or building (replaces the old global `isLoading`). */
    val isReportBusy: Boolean get() = isOpeningReport || isDeepDiveRunning

    /**
     * The action to offer with [message]: [messageAction] only while it was published with this very message, so a
     * later message without an action never inherits one.
     */
    val activeMessageAction: MessageAction? get() = messageAction?.takeIf { it.message == message }

    /** Inbox tab dot: an alert arrived after the last Inbox visit. */
    val hasNewInboxItems: Boolean
        get() = alertLedger.any { alert -> (parseInstantMs(alert.createdAt) ?: 0L) > lastInboxVisitAtMs }
}

/** A snackbar action published together with one [message] (`UiState.messageAction`). */
sealed interface MessageAction {
    /** The message this action belongs to. */
    val message: String
    /** The snackbar button label. */
    val label: String

    /**
     * "Deep Dive ready." after the user backed out of the build (5.14 allows it), so no running entry became the
     * report: Open pushes `Report(reportId)`.
     */
    data class OpenReport(
        override val message: String,
        val reportId: String,
        val ticker: String?,
        override val label: String = "Open"
    ) : MessageAction
}

/** Epoch ms of an ISO-8601 instant or offset date-time; null when unreadable. */
internal fun parseInstantMs(raw: String?): Long? {
    val value = raw?.trim()?.ifBlank { null } ?: return null
    return runCatching { java.time.Instant.parse(value).toEpochMilli() }.getOrNull()
        ?: runCatching { java.time.OffsetDateTime.parse(value).toInstant().toEpochMilli() }.getOrNull()
}


internal fun defaultNotificationPreferences(): List<NotificationPreferenceView> =
    listOf(
        NotificationPreferenceView(type = "earnings_preview", enabled = true, quietUntil = null),
        NotificationPreferenceView(type = "earnings_war_room", enabled = true, quietUntil = null),
        NotificationPreferenceView(type = "contrarian_alert", enabled = true, quietUntil = null),
        NotificationPreferenceView(type = "kill_switch", enabled = true, quietUntil = null),
        NotificationPreferenceView(type = "freshness_decay", enabled = true, quietUntil = null),
        NotificationPreferenceView(type = "morning_exception_briefing", enabled = true, quietUntil = null),
        NotificationPreferenceView(type = "weekly_digest", enabled = true, quietUntil = null),
        NotificationPreferenceView(type = "market_pulse_ready", enabled = true, quietUntil = null),
        NotificationPreferenceView(type = "pulse_email", enabled = true, quietUntil = null)
    )
