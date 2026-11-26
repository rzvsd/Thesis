package com.thesis.mobile.ui.shell

import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.model.HoldingsImportResultView
import com.thesis.mobile.model.LastViewedReport
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.ui.MessageAction
import com.thesis.mobile.ui.navigation.ShellTab

/**
 * Every user intent the logged-in shell can raise. `MainViewModel` implements it (it owns the navigator, so an
 * intent both moves the stack and loads the data); design-preview passes `object : ShellActions {}`.
 *
 * Every member has a no-op default so fixtures stay one line. Names do not reuse the ViewModel's older
 * functions (several have default arguments, which an override cannot keep).
 */
interface ShellActions {

    // ---- Navigation

    /** Bottom bar tap: see [AppNavigator.selectTab]; refreshes the tab's data when it is older than 5 minutes. */
    fun onSelectTab(tab: ShellTab) {}

    /** System or toolbar back. False at Today's root (the system then closes the app). */
    fun onBack(): Boolean = false

    fun onOpenYou() {}
    fun onOpenSearch() {}
    fun onCloseModal() {}

    /** An Inbox row, the morning briefing or a notification card: [com.thesis.mobile.ui.navigation.DeepLinkRouter.routeAlert]. */
    fun onOpenAlert(alert: AlertLedgerItemView) {}

    /** Pushes `Report(reportId)` and loads it. */
    fun onOpenReport(reportId: String, ticker: String? = null) {}

    /** A `Report(id)` entry is on screen but the ViewModel holds another report (after recreate or a pop). */
    fun onEnsureReport(reportId: String) {}

    /**
     * Pushes `DeepDiveRunning(ticker)` and starts the build; the entry becomes `Report(id)` when it is ready. One
     * build runs at a time: while one runs, this shows that build's entry instead (and says so for another name).
     */
    fun onRunDeepDive(ticker: String) {}

    /**
     * Run again from a `DeepDiveRunning` entry whose build failed: the entry is replaced by a new running entry
     * (no second copy on the stack) and the build starts, unless another build is running ([onRunDeepDive]).
     */
    fun onRetryDeepDive(ticker: String) {}

    /** Research tab root with [ticker] in the field (no build). */
    fun onOpenResearchFor(ticker: String) {}

    fun onOpenHistory() {}

    /** A History row: a Deep Dive opens as a report, a Pulse as `Pulse(date)`. */
    fun onOpenHistoryItem(item: ReportHistoryItem) {}

    /**
     * Pushes `Pulse(date)`; a past date loads that issue and the latest is restored when the entry leaves the stacks
     * (back, a tab reselect, a link or alert route, a jump to a tab root).
     */
    fun onOpenPulse(date: String?) {}

    /** Pushes the latest `Pulse` opened at [chapter] (a `ChapterKind` name: Home's chapter rows and tape). */
    fun onOpenPulseAt(chapter: String) { onOpenPulse(null) }

    /**
     * A `Pulse(date)` entry is on screen (null = the latest issue). Loads its issue when the shared Pulse was last
     * asked for another day or for the latest (after process death, a Today refresh while a dated entry sat in
     * another tab's stack, or an undated entry shown after a past day was opened from Research).
     */
    fun onEnsurePulse(date: String?) {}

    /** Pull to refresh on a `Pulse(date)` entry: that day's issue again (never the latest, which is another day). */
    fun onReloadPulse(date: String) {}

    fun onOpenMacroStress() {}
    fun onOpenWeeklyDigest(date: String?) {}
    fun onOpenWarRoom(warRoomId: String) {}

    /** A `WarRoom(id)` entry is on screen but another War Room (or none) is loaded. */
    fun onEnsureWarRoom(warRoomId: String) {}
    fun onOpenScenarioStress() {}

    /**
     * A `ScenarioStress` entry is on screen (restored after process death, or revisited): loads the templates when
     * none are held and, for an entry opened on a run, that run when another one (or none) is held. Pro only.
     */
    fun onEnsureScenarioStress(runId: String?, scenarioId: String?) {}
    fun onOpenName(ticker: String) {}

    /**
     * Pushes `Name(ticker, pagerScope, anchor)` and loads it (snapshot, report summary, notes trail). [pagerScope] is
     * the board order the Name pager walks; [anchor] is `Destination.Name.ANCHOR_*` or null.
     */
    fun onOpenNameIn(ticker: String, pagerScope: String?, anchor: String?) { onOpenName(ticker) }

    /** A thesis drift alert: Name at "Since the last report" (5.21.5). */
    fun onOpenNameAtChanges(ticker: String) {
        onOpenNameIn(ticker, null, com.thesis.mobile.ui.navigation.Destination.Name.ANCHOR_CHANGES)
    }

    /** The Name pager: the top `Name` entry is replaced by [ticker]'s, in the same [pagerScope] (4.5, no new entry). */
    fun onPageName(ticker: String, pagerScope: String?) {}

    /** A `Name(ticker)` entry is on screen but `UiState.nameDetail` holds another ticker (restore, pager, pop). */
    fun onEnsureName(ticker: String) {}

    /** Pushes `CompareNames(tickers)` (at most four, the table's limit) and loads each name's latest report. */
    fun onOpenCompareNames(tickers: List<String>) {}

    /** A `CompareNames` entry is on screen but `UiState.compareNames` holds other tickers. */
    fun onEnsureCompareNames(tickers: List<String>) {}

    /** Pushes `CompareReports(older, newer)` and loads both reports. */
    fun onOpenCompareReports(reportIdA: String, reportIdB: String) {}

    /** A `CompareReports` entry is on screen but `UiState.compareReports` holds another pair. */
    fun onEnsureCompareReports(reportIdA: String, reportIdB: String) {}

    /** The Inbox tab, filtered to [category] (null: every alert). */
    fun onOpenInbox(category: String?) {}

    /** The Inbox tab showing only [ticker]'s alerts, under a removable chip (Name's "See alerts", 5.11 item 3). */
    fun onOpenInboxFor(ticker: String) {}

    /** The Names tab with its add field focused (Home's empty "Add a name", 5.6). */
    fun onOpenNamesToAdd() {}

    /** The Names tab with the holdings CSV import open (You > Portfolio, 5.22). */
    fun onOpenHoldingsImport() {}
    fun onResumeLastViewed(report: LastViewedReport) {}
    fun onDismissResumeCard() {}

    // ---- Today

    fun onRefreshPulse() {}
    fun onSelectMacroRange(days: Int) {}
    fun onRefreshMacro() {}

    // ---- Names

    fun onRefreshNames() {}
    /** Follow [ticker] ("Added X to Names"). The Names board's own field adds the row in place: no message there. */
    fun onAddName(ticker: String) {}
    fun onAddNameFromBoard(ticker: String) {}
    fun onRemoveName(ticker: String) {}

    /**
     * Unfollow from outside Names (Name's follow toggle, the report bar): like [onRemoveName], and the snackbar
     * says it once the server has the new list (Names shows its own snackbar with Undo instead).
     */
    fun onUnfollowName(ticker: String) { onRemoveName(ticker) }

    /** Server ticker suggestions for a typed query (Names' add field, the Research field). */
    fun onSearchTickers(query: String) {}

    /** Fills `UiState.allNotes` from the notes cache. */
    fun onLoadAllNotes() {}

    /** Fills `UiState.notesTrails[ticker]`. */
    fun onLoadNotesTrail(ticker: String) {}

    /**
     * Saves [text] as the note of [reportId] (any report, not only the open one): true once the server has it. Name's
     * NoteBlock autosave; no snackbar (the block's footer says Saved).
     */
    suspend fun onSaveNoteFor(reportId: String, text: String): Boolean = false

    /** The same save, fire and forget in the ViewModel's scope (Name left while an edit was pending). */
    fun onSaveNoteOnLeave(reportId: String, text: String) {}
    suspend fun onImportHoldingsCsv(csv: String): Result<HoldingsImportResultView> =
        Result.failure(UnsupportedOperationException("preview"))

    // ---- Inbox

    fun onRefreshInbox() {}
    fun onSubmitAlertFeedback(alertId: String, feedback: String) {}
    fun onMuteAlert(alertId: String) {}
    fun onMarkInboxSeen() {}

    // ---- Research and the report

    fun onTickerChange(ticker: String) {}

    /** History: reload the report list (pull to refresh, Try again). */
    fun onRefreshHistory() {}

    /** Search (5.27): local hits at once, then server tickers. Blank clears the results. */
    fun onSearch(query: String) {}

    /** A submitted search is kept among the last eight (5.27 "Recent searches when empty"). */
    fun onAddRecentSearch(query: String) {}
    fun onClearRecentSearches() {}
    fun onReportNoteChange(content: String) {}
    fun onSaveReportNote() {}
    fun onGenerateOppositeCase() {}
    fun onRefreshConviction() {}
    fun onRunScenario(years: Int?, growth: Double?, wacc: Double?) {}
    fun onSubmitReportFeedback(code: String, message: String) {}
    fun onNotify(message: String) {}
    fun onRefreshPageToken(onResult: (String?) -> Unit) { onResult(null) }
    fun onRefreshWarRoom() {}

    /** The open War Room's auto-refresh (5.5/5.19, every 60 s while Live): no "loaded" message, no paywall on failure. */
    fun onAutoRefreshWarRoom() {}
    fun onRefreshScenarioTemplates() {}
    fun onSelectScenarioTemplate(scenarioId: String) {}
    fun onRunScenarioStress(scenarioId: String?) {}
    fun onOpenScenarioRun(runId: String, scenarioId: String?) {}

    // ---- You

    fun onSetNotificationsEnabled(enabled: Boolean) {}
    fun onSetBiometricLock(enabled: Boolean) {}
    fun onSetNotificationPreference(type: String, enabled: Boolean) {}

    /** The Inbox's "Turn off alerts like this": the preference off, confirmed by the Inbox's own snackbar. */
    fun onDisableAlertType(type: String) { onSetNotificationPreference(type, false) }
    fun onSaveApiBaseUrl(url: String) {}
    fun onSyncTier() {}
    fun onRefreshConvictionInsights() {}
    fun onRefreshOffers() {}
    fun onRestorePurchases() {}
    fun onSubmitSubscriptionFeedback(code: String, sourceSurface: String, message: String, promptWinBack: Boolean) {}
    fun onSetAppearance(value: AppearancePrefs) {}
    fun onLogout() {}

    // ---- Paywall and messages

    fun onRequireUpgrade(feature: String) {}
    fun onDismissPaywall() {}
    fun onMessageShown() {}

    /** The user tapped the snackbar action published with a message (`UiState.activeMessageAction`). */
    fun onMessageAction(action: MessageAction) {}
}

/**
 * What only the Android app can provide: Activity-bound actions and screens that the harness cannot compile
 * (WebView, Vico charts, app assets, `viewModel()`). `ThesisApp` builds the real one; previews use the
 * defaults, which draw nothing.
 */
class ShellPlatform(
    /** Store purchase sheet; null when no Activity is available. */
    val startPurchase: ((preferredType: String?) -> Unit)? = null,
    val exportPulsePdf: () -> Unit = {},
    val openSystemNotificationSettings: () -> Unit = {},
    /** `BuildConfig.DEBUG`: the API base URL switch in You. */
    val showDeveloperOptions: Boolean = false,
    val sampleDeepDive: @androidx.compose.runtime.Composable (
        padding: androidx.compose.foundation.layout.PaddingValues,
        onFollowName: () -> Unit,
        onDismiss: () -> Unit
    ) -> Unit = { _, _, _ -> },
    /**
     * Hands [text] to the system share sheet as a document named [fileName] (the notes export, 5.22; a note from
     * Name). Previews ignore it.
     */
    val shareText: (fileName: String, text: String) -> Unit = { _, _ -> },
    val deleteAccountSection: @androidx.compose.runtime.Composable () -> Unit = {},
    /** The Activity is RESUMED (in front of the user). Timers such as the War Room auto-refresh run only then. */
    val isResumed: Boolean = true,
    /**
     * Draws [content] with the system back handlers registered inside it switched off while `covered` is true.
     * The shell wraps the report base layer in it: the report's WebView registers `BackHandler(canGoBack)` (go back
     * within the page), and while a pushed screen, a modal or the paywall covers the report, system back must
     * reach the shell, not rewind the hidden page. Android provides a detached `OnBackPressedDispatcher` while
     * covered; previews have no back dispatcher and just draw [content].
     */
    val backScope: @androidx.compose.runtime.Composable (
        covered: Boolean,
        content: @androidx.compose.runtime.Composable () -> Unit
    ) -> Unit = { _, content -> content() },
    /**
     * The visible page has a HeroBand under the status bar ([ScreenChrome.overHero], 2.7): the status bar icons
     * turn light in both themes until it collapses. `ThesisApp` applies it to the window; previews ignore it.
     */
    val onStatusBarOverHero: (Boolean) -> Unit = {}
)
