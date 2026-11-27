package com.thesis.mobile.ui.shell

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.core.snap
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.SnackbarResult
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.thesis.mobile.ui.RefreshFailure
import com.thesis.mobile.ui.UiState
import com.thesis.mobile.ui.components.showThesisSnackbar
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.navigation.DeepLinkRouter
import com.thesis.mobile.ui.navigation.Destination
import com.thesis.mobile.ui.navigation.warRoomsInEarningsWindow
import com.thesis.mobile.ui.screens.BoardInputs
import com.thesis.mobile.ui.screens.CompareNamesScreen
import com.thesis.mobile.ui.screens.CompareReportsScreen
import com.thesis.mobile.ui.screens.DeepDiveScreen
import com.thesis.mobile.ui.screens.DeepDiveWebPageAccess
import com.thesis.mobile.ui.screens.HistoryFilter
import com.thesis.mobile.ui.screens.HistoryScreen
import com.thesis.mobile.ui.screens.HomeScreen
import com.thesis.mobile.ui.screens.InboxScreen
import com.thesis.mobile.ui.screens.MacroStressScreen
import com.thesis.mobile.ui.screens.NameAnchor
import com.thesis.mobile.ui.screens.NameScreen
import com.thesis.mobile.ui.screens.NamesScreen
import com.thesis.mobile.ui.screens.NotesMarkdown
import com.thesis.mobile.ui.screens.PaywallScreen
import com.thesis.mobile.ui.screens.PulseScreen
import com.thesis.mobile.ui.screens.ResearchScreen
import com.thesis.mobile.ui.screens.ScenarioStressScreen
import com.thesis.mobile.ui.screens.SearchScreen
import com.thesis.mobile.ui.screens.SettingsScreen
import com.thesis.mobile.ui.screens.WarRoomScreen
import com.thesis.mobile.ui.screens.WeeklyDigestScreen
import com.thesis.mobile.ui.screens.nameNeighbours
import com.thesis.mobile.ui.screens.namePagerOf
import com.thesis.mobile.ui.screens.namesBoardOrder
import com.thesis.mobile.ui.screens.report.CompareNamesPickerSheet
import com.thesis.mobile.ui.screens.report.ReportHostExtras
import com.thesis.mobile.ui.screens.report.ReportOpeningBar
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.today.ChapterKind
import java.time.LocalDate
import java.time.ZoneId
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** How often an open War Room refreshes itself while Live (5.19: every 60 s, only while Live and resumed). */
internal const val WAR_ROOM_REFRESH_MS = 60_000L

/** `WarRoomView.status` of a room whose earnings call is under way (`earningsWarRoomStates` "live"). */
private const val WAR_ROOM_LIVE = "live"

/**
 * The screen for one stack entry. [padding] is the entry's own inner padding (its top bar, the bottom bar when
 * its destination shows it, and system insets); screens that take no padding parameter are padded here.
 */
@Composable
internal fun ShellContentScope.Content(entry: NavEntry, padding: PaddingValues) {
    when (val destination = entry.destination) {
        Destination.Today -> TodayRoot(padding)
        Destination.Names -> NamesRoot(padding)
        // A build or an open always pushes its own entry (DeepDiveRunning, Report), which shows its error; the
        // root keeps its field and recent list whatever the shared deepDiveError says.
        Destination.Research -> ResearchRoot(padding)
        Destination.Inbox -> InboxRoot(padding)
        is Destination.Pulse -> {
            // Like Report(id) and WarRoom(id): a restored or revisited entry asks for its issue again (its day, or the
            // latest when a past day replaced it). Only while it is the top entry, so the entry under a predictive-back
            // preview does not load early.
            val onTop = navigator.tabTop.entryId == entry.entryId
            LaunchedEffect(entry.entryId, onTop) {
                if (onTop) actions.onEnsurePulse(destination.date)
            }
            // The cached copy after a failed refresh: the hero's banner names it ("Offline · showing this issue").
            val cachedFailure = state.pulseFailureKind?.takeIf { state.pulseLoadedFromCache && state.pulseReport != null }
            PulseScreen(
                pulse = state.pulseReport,
                watchlist = state.watchlist,
                onBack = { actions.onBack() },
                onRunDeepDive = actions::onRunDeepDive,
                onExportPdf = platform.exportPulsePdf,
                // A dated entry refreshes its own day: the latest issue would replace it under a header naming
                // another date.
                onRefresh = {
                    val day = destination.date
                    if (day != null) actions.onReloadPulse(day) else actions.onRefreshPulse()
                },
                padding = padding,
                loading = state.pulseReport == null && state.isPulseRefreshing,
                error = state.pulseError ?: cachedFailure?.let(RefreshFailure::cachedPulseMessage),
                refreshing = state.isPulseRefreshing,
                isExporting = state.isExportingPulse,
                exportDoneAt = state.pulseExportDoneAt,
                pulseFailure = state.pulseFailureKind,
                monitorSnapshots = state.monitorSnapshots,
                onOpenName = { ticker -> actions.onOpenNameIn(ticker, null, null) },
                initialChapter = destination.chapter?.let { name -> ChapterKind.entries.firstOrNull { it.name == name } }
            )
        }
        Destination.MacroStress -> MacroStressScreen(
            current = state.sentimentCurrent,
            history = state.sentimentHistory,
            selectedRangeDays = state.sentimentRangeDays,
            sentimentError = state.sentimentError,
            onSelectRange = actions::onSelectMacroRange,
            onBack = { actions.onBack() },
            padding = padding,
            refreshing = state.isMacroRefreshing,
            onRefresh = actions::onRefreshMacro
        )
        is Destination.WeeklyDigest -> WeeklyDigestScreen(
            digestDate = destination.date,
            sentimentCurrent = state.sentimentCurrent,
            watchlist = state.watchlist,
            monitorSnapshots = state.monitorSnapshots,
            pulse = state.pulseReport,
            onOpenDashboard = actions::onOpenMacroStress,
            onBack = { actions.onBack() },
            padding = padding,
            sentimentHistory = state.sentimentHistory,
            alerts = state.alertLedger,
            stateChanges = state.weeklyStateChanges,
            reportSummaries = state.reportSummaries,
            onOpenReport = { reportId, ticker -> actions.onOpenReport(reportId, ticker) },
            onOpenName = { ticker -> actions.onOpenNameIn(ticker, null, null) },
            onOpenInbox = { category -> actions.onOpenInbox(category) },
            onOpenPulse = { actions.onOpenPulse(null) },
            loading = state.sentimentCurrent == null && state.isMacroRefreshing
        )
        is Destination.History -> HistoryScreen(
            historyItems = state.reportHistory,
            onBack = { actions.onBack() },
            onOpenReport = actions::onOpenHistoryItem,
            padding = padding,
            // A failed first load is an answer too: the skeleton ends on the failed state with Try again.
            loaded = state.reportHistoryLoaded || state.historyLoadError != null,
            refreshing = state.isHistoryLoading && state.reportHistoryLoaded,
            error = state.historyLoadError,
            onRefresh = actions::onRefreshHistory,
            companyNames = state.companyNames,
            filingPeriods = state.filingPeriods,
            notedReportIds = state.notedReportIds,
            onCompareReports = actions::onOpenCompareReports,
            onOpenName = { ticker -> actions.onOpenNameIn(ticker, null, null) },
            initialFilter = HistoryFilter.entries.firstOrNull { it.name.equals(destination.filter, ignoreCase = true) }
                ?: HistoryFilter.All
        )
        is Destination.Report -> ReportEntry(entry, destination.reportId, destination.ticker, classic = false, padding = padding)
        is Destination.ReportClassic ->
            ReportEntry(entry, destination.reportId, destination.ticker, classic = true, padding = padding)
        // Loading only while this entry's own build runs. MainViewModel drops a running entry restored after its
        // job ended (dropIdleRunningEntries); should one still show with no job, it shows its build's error (or
        // that the build is no longer running) with a retry, instead of spinning forever. Another name's build
        // (started from another tab after this one ended) never shows here: neither its progress nor its error.
        // Retry always builds this entry's ticker, never the shared selectedTicker (the Research field).
        is Destination.DeepDiveRunning -> {
            val own = state.deepDiveBuildTicker?.equals(destination.ticker, ignoreCase = true) == true
            DeepDiveScreenFor(
                report = null,
                isLoading = own && state.isDeepDiveRunning,
                errorMessage = (if (own) state.deepDiveError else null) ?: buildEndedMessage(destination.ticker),
                padding = padding,
                classic = false,
                onRetry = { actions.onRetryDeepDive(destination.ticker) },
                ticker = destination.ticker,
                building = true,
                jobStatus = if (own) state.jobStatus else null
            )
        }
        is Destination.WarRoom -> {
            val id = destination.warRoomId
            val warRoom = state.warRoom?.takeIf { id == null || it.warRoomId == id }
            LaunchedEffect(entry.entryId) {
                if (id != null && state.warRoom?.warRoomId != id) actions.onEnsureWarRoom(id)
            }
            // Auto-refresh (5.19): every 60 s, only while the room is Live, this entry is the visible top (no
            // modal over it) and the Activity is resumed. Leaving any of those cancels the loop; coming back
            // starts a new one. Silent: no "loaded" snackbar and no paywall from a background refresh.
            val refreshing = warRoom?.status.equals(WAR_ROOM_LIVE, ignoreCase = true) &&
                platform.isResumed &&
                navigator.tabTop.entryId == entry.entryId &&
                navigator.modalStack.isEmpty()
            LaunchedEffect(entry.entryId, refreshing) {
                while (refreshing) {
                    delay(WAR_ROOM_REFRESH_MS)
                    actions.onAutoRefreshWarRoom()
                }
            }
            WarRoomScreen(
                warRoom = warRoom,
                errorMessage = state.warRoomError,
                onRefresh = actions::onRefreshWarRoom,
                padding = padding,
                onBack = { actions.onBack() },
                isLoading = state.isWarRoomLoading && warRoom == null,
                refreshing = state.isWarRoomLoading && warRoom != null,
                onOpenName = { ticker -> actions.onOpenNameIn(ticker, null, null) },
                onOpenReport = { reportId -> actions.onOpenReport(reportId) }
            )
        }
        is Destination.ScenarioStress -> {
            // Like WarRoom(id): a restored entry (process death skips the Research tab refresh for 5 minutes)
            // loads its templates and the run it was opened on. Keyed on the tier as well, because the profile
            // (and with it Pro) arrives after the restore; a free tier asks for nothing (no paywall from here).
            val isPro = state.userProfile?.tier.equals(PRO_TIER, ignoreCase = true)
            LaunchedEffect(entry.entryId, isPro) {
                if (isPro) actions.onEnsureScenarioStress(destination.runId, destination.scenarioId)
            }
            ScenarioStressScreen(
                userTier = state.userProfile?.tier,
                templates = state.scenarioStressTemplates,
                selectedScenarioId = state.selectedScenarioStressId,
                run = state.scenarioStressRun,
                templatesError = state.scenarioStressTemplatesError,
                runError = state.scenarioStressRunError,
                isLoadingTemplates = state.isLoadingScenarioStressTemplates,
                isRunning = state.isRunningScenarioStress,
                watchlistCount = state.watchlist.size,
                onRefreshTemplates = actions::onRefreshScenarioTemplates,
                onSelectTemplate = actions::onSelectScenarioTemplate,
                onRunScenario = actions::onRunScenarioStress,
                onRequireUpgrade = actions::onRequireUpgrade,
                onBack = { actions.onBack() },
                padding = padding,
                onOpenName = { ticker -> actions.onOpenNameIn(ticker, null, null) }
            )
        }
        Destination.You, is Destination.YouPage -> SettingsScreen(
            padding = padding,
            currentApiBaseUrl = state.apiBaseUrl,
            profile = state.userProfile,
            convictionInsights = state.convictionInsights,
            convictionInsightsError = state.convictionInsightsError,
            subscriptionActionInFlight = state.subscriptionActionInFlight,
            notificationsEnabled = state.notificationsEnabled,
            biometricSupported = state.biometricSupported,
            biometricLockEnabled = state.biometricLockEnabled,
            notificationPreferences = state.notificationPreferences,
            onSetNotifications = actions::onSetNotificationsEnabled,
            onSetBiometricLockEnabled = actions::onSetBiometricLock,
            onSetNotificationPreference = actions::onSetNotificationPreference,
            onSaveApiBaseUrl = actions::onSaveApiBaseUrl,
            onSyncTier = actions::onSyncTier,
            onRefreshConvictionInsights = actions::onRefreshConvictionInsights,
            onRequireUpgrade = actions::onRequireUpgrade,
            onRestorePurchases = actions::onRestorePurchases,
            onSubmitSubscriptionFeedback = actions::onSubmitSubscriptionFeedback,
            onLogout = actions::onLogout,
            onOpenSystemNotificationSettings = platform.openSystemNotificationSettings,
            showDeveloperOptions = platform.showDeveloperOptions,
            deleteAccountSection = platform.deleteAccountSection,
            appearance = state.appearance,
            onSetAppearance = actions::onSetAppearance,
            notes = state.allNotes,
            onLoadNotes = actions::onLoadAllNotes,
            onExportNotes = { fileName, markdown -> platform.shareText(fileName, markdown) },
            onImportHoldings = actions::onOpenHoldingsImport
        )
        Destination.Search -> SearchEntry(padding)
        is Destination.Paywall -> PaywallScreen(
            alerts = state.alertLedger,
            watchlist = state.watchlist,
            offers = state.subscriptionOffers,
            actionInFlight = state.subscriptionActionInFlight,
            onPurchase = { type -> platform.startPurchase?.invoke(type) },
            onRestore = actions::onRestorePurchases,
            onRefreshOffers = actions::onRefreshOffers,
            onDismiss = { actions.onDismissPaywall() },
            // On the modal stack (5.23): the frame's back bar is the paywall's bar, the HeroBand runs under it.
            padding = padding,
            apiBaseUrl = state.apiBaseUrl
        )
        is Destination.Name -> NameEntry(entry, destination, padding)
        is Destination.CompareReports -> CompareReportsEntry(destination, padding)
        is Destination.CompareNames -> CompareNamesEntry(destination, padding)
    }
}

/** The Research root (5.12), with the names picker Tools > Compare names opens when you follow more than four. */
@Composable
private fun ShellContentScope.ResearchRoot(padding: PaddingValues) {
    var pickNames by rememberSaveable { mutableStateOf(false) }
    ResearchScreen(
        ticker = state.selectedTicker.orEmpty(),
        recentHistory = state.reportHistory,
        onTickerChange = { typed ->
            actions.onTickerChange(typed)
            actions.onSearchTickers(typed)
        },
        onRunReport = { actions.onRunDeepDive(state.selectedTicker.orEmpty()) },
        onOpenReport = { reportId -> actions.onOpenReport(reportId) },
        onOpenPulse = { date -> actions.onOpenPulse(date) },
        padding = padding,
        // History on the Research stack (5.12 "See all"); the root lists only the three latest.
        onSeeAllHistory = actions::onOpenHistory,
        suggestions = state.tickers,
        watchlist = state.watchlist,
        companyNames = state.companyNames,
        filingPeriods = state.filingPeriods,
        notedReportIds = state.notedReportIds,
        continueReading = state.lastViewedReport,
        onDismissContinue = actions::onDismissResumeCard,
        onResumeContinue = actions::onResumeLastViewed,
        // Compare names (the table takes 2 to 4): up to four followed names line up at once; with more, the names
        // picker asks which. Hidden with fewer than two.
        onOpenCompareNames = state.watchlist.takeIf { it.size >= 2 }?.let { names ->
            {
                if (names.size <= COMPARE_NAMES_MAX) actions.onOpenCompareNames(names) else pickNames = true
            }
        },
        onOpenScenarioStress = actions::onOpenScenarioStress,
        onOpenMacroStress = actions::onOpenMacroStress,
        onOpenWeeklyDigest = { actions.onOpenWeeklyDigest(state.sentimentCurrent?.marketDate) }
    )
    if (pickNames) {
        CompareNamesPickerSheet(
            ticker = null,
            otherNames = state.watchlist.map { it.trim().uppercase() }.filter { it.isNotEmpty() }.distinct(),
            onDismiss = { pickNames = false },
            onCompare = { tickers ->
                pickNames = false
                actions.onOpenCompareNames(tickers.take(COMPARE_NAMES_MAX))
            }
        )
    }
}

/** The Names root (5.10), with the names picker its context sheet's "Compare with…" opens. */
@Composable
private fun ShellContentScope.NamesRoot(padding: PaddingValues) {
    var compareWith by rememberSaveable { mutableStateOf<String?>(null) }
    NamesScreen(
        padding = padding,
        watchlist = state.watchlist,
        monitorSnapshots = state.monitorSnapshots,
        alerts = state.alertLedger,
        focusTicker = navigator.namesFocusTicker,
        onRefresh = actions::onRefreshNames,
        onAddTicker = actions::onAddNameFromBoard,
        onRemoveTicker = actions::onRemoveName,
        warRoomByTicker = warRoomsInEarningsWindow(state.alertLedger),
        onOpenWarRoom = actions::onOpenWarRoom,
        onImportHoldingsCsv = { csv -> actions.onImportHoldingsCsv(csv) },
        onRunDeepDive = actions::onRunDeepDive,
        onOpenResearch = actions::onOpenResearchFor,
        liveWarRooms = liveWarRoomTickers(),
        refreshing = state.isBoardRefreshing,
        loaded = state.watchlistLoaded,
        // A failed first load ends the skeleton with the failed state and its Try again (5.10).
        error = state.watchlistLoadError,
        snapshotDeltas = state.snapshotDeltas,
        lastVisitAtMs = state.lastNamesVisitAtMs,
        allNotes = state.allNotes,
        companyNames = state.companyNames,
        tickerSuggestions = state.tickers,
        density = state.appearance.namesDensity,
        onDensityChange = { actions.onSetAppearance(state.appearance.copy(namesDensity = it)) },
        onQueryTickers = actions::onSearchTickers,
        onLoadNotes = actions::onLoadAllNotes,
        // The row's bounds: Name grows from the tapped row (4.5 container transform).
        onOpenName = { ticker, pagerScope, bounds ->
            navigator.pushFrom(bounds) { actions.onOpenNameIn(ticker, pagerScope, null) }
        },
        onOpenNotes = { ticker -> actions.onOpenNameIn(ticker, null, Destination.Name.ANCHOR_NOTES) },
        onWriteNote = { ticker -> actions.onOpenNameIn(ticker, null, Destination.Name.ANCHOR_WRITE_NOTE) },
        onOpenReport = { reportId, ticker -> actions.onOpenReport(reportId, ticker) },
        onCompare = actions::onOpenCompareNames,
        onCompareWith = { ticker -> compareWith = ticker },
        onExportNotes = { exportNotes() },
        onShowUndo = { message, action ->
            // The Undo answers the row the reader just removed: it replaces any snackbar on screen instead of
            // waiting behind it (as the Inbox's quiet and turn-off do).
            snackbarHostState.currentSnackbarData?.dismiss()
            snackbarHostState.showThesisSnackbar(message, action) == SnackbarResult.ActionPerformed
        },
        focusAddField = navigator.namesFocusAdd,
        openImport = navigator.namesOpenImport,
        onRequestHandled = navigator::clearNamesRequests,
        removeFailure = state.watchlistRemoveFailure
    )
    CompareWithPicker(compareWith, onDismiss = { compareWith = null })
}

/**
 * The names picker for "Compare with…" ([subject]; null shows nothing): up to three of the other followed names,
 * then Compare names. Research > Tools passes no subject through [CompareNamesPickerSheet] directly.
 */
@Composable
private fun ShellContentScope.CompareWithPicker(subject: String?, onDismiss: () -> Unit) {
    val ticker = subject?.trim()?.uppercase()?.ifBlank { null } ?: return
    CompareNamesPickerSheet(
        ticker = ticker,
        otherNames = state.watchlist.map { it.trim().uppercase() }.filter { it.isNotEmpty() && it != ticker }.distinct(),
        onDismiss = onDismiss,
        onCompare = { tickers ->
            onDismiss()
            actions.onOpenCompareNames(tickers.take(COMPARE_NAMES_MAX))
        }
    )
}

/** Most names Compare names lines up (the kit table's four value columns). */
internal const val COMPARE_NAMES_MAX = 4

/** Tickers whose War Room is in its Live phase (the open room's status, `WAR_ROOM_LIVE`). */
private fun ShellContentScope.liveWarRoomTickers(): Set<String> =
    state.warRoom
        ?.takeIf { it.status.equals(WAR_ROOM_LIVE, ignoreCase = true) }
        ?.ticker?.trim()?.uppercase()?.ifBlank { null }
        ?.let { setOf(it) }
        .orEmpty()

/** Every note as one Markdown document, to the system share sheet (Names' Notes view, You > Your notes). */
private fun ShellContentScope.exportNotes() {
    val zone = ZoneId.systemDefault()
    val today = LocalDate.now(zone)
    platform.shareText(NotesMarkdown.fileName(today), NotesMarkdown.build(state.allNotes, today, zone))
}

/**
 * The Inbox root. A category asked for by another screen (the weekly digest) is applied by the screen, then
 * cleared; the screen keeps the selection (no key on the one-shot value, which would rebuild it unfiltered).
 */
@Composable
private fun ShellContentScope.InboxRoot(padding: PaddingValues) {
    InboxScreen(
        padding = padding,
        alerts = state.alertLedger,
        // 5.21: a failed load shows in the list (or its banner); action errors are the snackbar's only.
        inboxError = state.inboxLoadError,
        onRefresh = actions::onRefreshInbox,
        onOpenAlert = actions::onOpenAlert,
        // An alert whose route only lands back on Inbox has nothing to open (5.5 race fixes, audit A).
        canOpenAlert = DeepLinkRouter::alertHasDestination,
        onUnlockDetail = { actions.onRequireUpgrade("filing_change_detail") },
        onSubmitFeedback = actions::onSubmitAlertFeedback,
        onQuietAlertType = actions::onMuteAlert,
        onDisableAlertType = actions::onDisableAlertType,
        isRefreshing = state.isInboxRefreshing,
        isLoading = !state.inboxLoaded,
        lastInboxVisitAtMs = state.lastInboxVisitAtMs.takeIf { it > 0L },
        onMarkAllSeen = actions::onMarkInboxSeen,
        onOpenName = { ticker -> actions.onOpenNameIn(ticker, null, null) },
        onOpenNameAtChanges = actions::onOpenNameAtChanges,
        onOpenWarRoom = actions::onOpenWarRoom,
        categoryRequest = navigator.inboxCategory,
        onCategoryRequestHandled = navigator::clearInboxCategory,
        tickerRequest = navigator.inboxTicker,
        onTickerRequestHandled = navigator::clearInboxTicker,
        refreshError = state.inboxLoadError?.takeIf { state.alertLedger.isNotEmpty() },
        inboxErrorKey = state.inboxErrorSeq,
        snackbarHostState = snackbarHostState
    )
}

/** Search (5.27, modal): the query lives with the entry; results come from the ViewModel's search. */
@Composable
private fun ShellContentScope.SearchEntry(padding: PaddingValues) {
    var query by rememberSaveable { mutableStateOf(state.searchResults?.query.orEmpty()) }
    // A query restored after process death has no results in the new ViewModel: ask again, so the screen never
    // waits on a search nobody started.
    LaunchedEffect(Unit) {
        if (query.isNotBlank() && state.searchResults?.query != query) actions.onSearch(query)
    }
    SearchScreen(
        query = query,
        onQueryChange = { typed ->
            query = typed
            actions.onSearch(typed)
        },
        results = state.searchResults?.takeIf { query.isNotBlank() },
        onBack = { actions.onBack() },
        padding = padding,
        recentSearches = state.recentSearches,
        onPickRecent = { recent ->
            query = recent
            actions.onSearch(recent)
        },
        onClearRecent = actions::onClearRecentSearches.takeIf { state.recentSearches.isNotEmpty() },
        companyNames = state.companyNames,
        filingPeriods = state.filingPeriods,
        notedReportIds = state.notedReportIds,
        onOpenName = { ticker -> actions.onOpenNameIn(ticker, null, null) },
        onOpenReport = { reportId -> actions.onOpenReport(reportId) },
        onOpenNote = { ticker, reportId ->
            if (ticker.isNullOrBlank()) {
                actions.onOpenReport(reportId)
            } else {
                // Name at "Your notes", on the matched note's own trail entry (PR-4b, WP-K).
                actions.onOpenNameIn(ticker, null, noteEntryAnchor(reportId))
            }
        },
        onSubmit = actions::onAddRecentSearch
    )
}

/**
 * A `Name(ticker)` entry (5.11). The pager walks the board in the order the Names root shows it ([namesBoardOrder]
 * with the same inputs), and paging replaces this entry with the neighbour's.
 */
@Composable
private fun ShellContentScope.NameEntry(entry: NavEntry, destination: Destination.Name, padding: PaddingValues) {
    val ticker = destination.ticker.trim().uppercase()
    val onTop = navigator.top.entryId == entry.entryId
    LaunchedEffect(ticker, onTop) {
        if (onTop) actions.onEnsureName(ticker)
    }
    // The journal is one shared list (the last report's ticker), so Name loads its own; keyed on Pro so a profile
    // that arrives after entry still loads it.
    val isPro = state.userProfile?.tier.equals(PRO_TIER, ignoreCase = true)
    LaunchedEffect(ticker, onTop, isPro) {
        if (onTop && isPro) actions.onRefreshConvictionFor(ticker)
    }
    val warRooms = warRoomsInEarningsWindow(state.alertLedger)
    val live = liveWarRoomTickers()
    val notedTickers = state.allNotes.filter { it.text.isNotBlank() }.mapNotNull { it.ticker?.trim()?.uppercase() }.toSet()
    val order = remember(destination.pagerScope, state.watchlist, state.monitorSnapshots, state.alertLedger, state.snapshotDeltas, notedTickers) {
        namesBoardOrder(
            destination.pagerScope,
            BoardInputs(
                watchlist = state.watchlist,
                snapshots = state.monitorSnapshots,
                alerts = state.alertLedger,
                deltas = state.snapshotDeltas,
                notedTickers = notedTickers,
                companyNames = state.companyNames,
                warRooms = warRooms,
                liveWarRooms = live,
                lastVisitAtMs = state.lastNamesVisitAtMs
            )
        )
    }
    val (previous, next) = nameNeighbours(order, ticker)
    val scope = rememberCoroutineScope()
    var compareWith by rememberSaveable { mutableStateOf<String?>(null) }
    NameScreen(
        padding = padding,
        ticker = ticker,
        detail = state.nameDetail?.takeIf { it.ticker.equals(ticker, ignoreCase = true) },
        following = state.watchlist.any { it.equals(ticker, ignoreCase = true) },
        companyName = state.companyNames[ticker],
        lastVisitAtMs = state.lastNamesVisitAtMs,
        warRoomId = warRooms[ticker],
        isPro = isPro,
        journal = state.convictionTimeline,
        pager = namePagerOf(order, ticker),
        warRoomLive = ticker in live,
        focusNote = destination.anchor == Destination.Name.ANCHOR_WRITE_NOTE,
        scrollTo = when {
            destination.anchor == Destination.Name.ANCHOR_NOTES -> NameAnchor.Notes
            noteEntryOf(destination.anchor) != null -> NameAnchor.Notes
            destination.anchor == Destination.Name.ANCHOR_CHANGES -> NameAnchor.Changes
            else -> null
        },
        noteKey = noteEntryOf(destination.anchor),
        onRetry = { actions.onEnsureName(ticker) },
        onFollowChange = { on -> if (on) actions.onAddName(ticker) else actions.onUnfollowName(ticker) },
        onOpenReport = { reportId -> actions.onOpenReport(reportId, ticker) },
        onBuildReport = { actions.onRunDeepDive(ticker) },
        onSaveNote = { reportId, text -> actions.onSaveNoteFor(reportId, text) },
        onLeaveNote = actions::onSaveNoteOnLeave,
        onShareNote = { text -> platform.shareText("$ticker note", text) },
        onOpenWarRoom = actions::onOpenWarRoom,
        onSeeAlerts = { actions.onOpenInboxFor(ticker) },
        onSeePro = { actions.onRequireUpgrade(FEATURE_CONVICTION) },
        onCompareReports = actions::onOpenCompareReports,
        onCompareWith = { compareWith = ticker },
        onPrevious = previous?.let { neighbour -> { actions.onPageName(neighbour, destination.pagerScope) } },
        onNext = next?.let { neighbour -> { actions.onPageName(neighbour, destination.pagerScope) } },
        onShowMessage = { message -> scope.launch { snackbarHostState.showThesisSnackbar(message) } },
        onBack = { actions.onBack() }
    )
    CompareWithPicker(compareWith, onDismiss = { compareWith = null })
}

/** A `CompareReports(older, newer)` entry (5.17): loads its pair when the ViewModel holds another one. */
@Composable
private fun ShellContentScope.CompareReportsEntry(destination: Destination.CompareReports, padding: PaddingValues) {
    val a = destination.reportIdA
    val b = destination.reportIdB
    LaunchedEffect(a, b) { actions.onEnsureCompareReports(a, b) }
    val compare = state.compareReports?.takeIf { it.reportIdA == a && it.reportIdB == b }
    val ticker = (compare?.b?.ticker ?: compare?.a?.ticker)?.trim()?.uppercase()?.ifBlank { null }
    LaunchedEffect(ticker) { if (ticker != null) actions.onLoadNotesTrail(ticker) }
    CompareReportsScreen(
        state = compare,
        onBack = { actions.onBack() },
        padding = padding,
        notes = ticker?.let { state.notesTrails[it] }.orEmpty(),
        onRetry = { actions.onEnsureCompareReports(a, b) },
        onOpenReport = { reportId -> actions.onOpenReport(reportId, ticker) },
        onOpenChange = { reportId, _ -> actions.onOpenReport(reportId, ticker) },
        onOpenName = { t -> actions.onOpenNameIn(t, null, null) }
    )
}

/** A `CompareNames(tickers)` entry (5.26): loads its names when the ViewModel holds others. */
@Composable
private fun ShellContentScope.CompareNamesEntry(destination: Destination.CompareNames, padding: PaddingValues) {
    val tickers = destination.tickers.map { it.trim().uppercase() }.filter { it.isNotEmpty() }.distinct()
    LaunchedEffect(tickers) { actions.onEnsureCompareNames(tickers) }
    val compare = state.compareNames?.takeIf { it.tickers == tickers.take(COMPARE_NAMES_MAX) }
    CompareNamesScreen(
        state = compare,
        onBack = { actions.onBack() },
        padding = padding,
        // Each report's own score; a summary cached before it carried one has none (the row is then left out).
        disciplines = compare?.summaries?.mapValues { (_, summary) -> summary?.valueDiscipline }.orEmpty(),
        onRetry = { actions.onEnsureCompareNames(tickers) },
        // "Build report" opens the Research flow with the ticker in the field (no silent build).
        onBuildReport = actions::onOpenResearchFor,
        onOpenName = { ticker -> actions.onOpenNameIn(ticker, null, null) },
        onOpenReport = { reportId, ticker -> actions.onOpenReport(reportId, ticker) }
    )
}

/**
 * Today's root: Home, or the sample Deep Dive for a new account (no names, no reports). The two swap as a content
 * state change (4.4: out `Quick` `EaseExit`, in `Base` after 60 ms), never in one frame: the sample replaces Home
 * once the empty watchlist and history arrive, and "Not now" returns to Home. 150 ms crossfade under reduced
 * motion (4.8).
 */
@Composable
private fun ShellContentScope.TodayRoot(padding: PaddingValues) {
    val showSample = !sampleDismissed &&
        state.watchlistLoaded && state.watchlist.isEmpty() &&
        state.reportHistoryLoaded && state.reportHistory.isEmpty()
    val reduced = LocalReducedMotion.current
    AnimatedContent(
        targetState = showSample,
        modifier = Modifier.fillMaxSize(),
        transitionSpec = {
            val swap = if (reduced) {
                fadeIn(ThesisMotion.timed(reduced = false, durationMillis = ThesisMotion.Quick)) togetherWith
                    fadeOut(ThesisMotion.timed(reduced = false, durationMillis = ThesisMotion.Quick))
            } else {
                fadeIn(ThesisMotion.timed(reduced = false, ThesisMotion.Base, delayMillis = ThesisMotion.CrossfadeDelay)) togetherWith
                    fadeOut(ThesisMotion.timed(reduced = false, ThesisMotion.Quick, easing = ThesisMotion.EaseExit))
            }
            swap using SizeTransform(clip = false) { _, _ -> snap() }
        },
        label = "today-root"
    ) { sample ->
        if (sample) {
            platform.sampleDeepDive(
                padding,
                {
                    onDismissSample()
                    actions.onSelectTab(com.thesis.mobile.ui.navigation.ShellTab.Names)
                },
                onDismissSample
            )
        } else {
            TodayHome(padding)
        }
    }
}

@Composable
private fun ShellContentScope.TodayHome(padding: PaddingValues) {
    HomeScreen(
        pulse = state.pulseReport,
        pulseLoadedFromCache = state.pulseLoadedFromCache,
        sentimentCurrent = state.sentimentCurrent,
        sentimentHistory = state.sentimentHistory,
        sentimentError = state.sentimentError,
        watchlist = state.watchlist,
        monitorSnapshots = state.monitorSnapshots,
        morningBriefing = state.alertLedger.firstOrNull { it.notificationType == "morning_exception_briefing" },
        padding = padding,
        pulseError = state.pulseError,
        onManageNames = { actions.onSelectTab(com.thesis.mobile.ui.navigation.ShellTab.Names) },
        onRetryPulse = actions::onRefreshPulse,
        onOpenMacroStressDashboard = actions::onOpenMacroStress,
        onOpenPulseBrief = { actions.onOpenPulse(null) },
        onOpenMorningBriefing = actions::onOpenAlert,
        refreshing = state.isPulseRefreshing || state.isMacroRefreshing,
        snapshotDeltas = state.snapshotDeltas,
        notedTickers = state.allNotes.filter { it.text.isNotBlank() }.mapNotNull { it.ticker?.trim()?.uppercase() }.toSet(),
        onOpenNameFrom = { ticker, bounds -> navigator.pushFrom(bounds) { actions.onOpenNameIn(ticker, null, null) } },
        onOpenPulseAt = { chapter -> actions.onOpenPulseAt(chapter.name) },
        onRetryMacro = actions::onRefreshMacro,
        pulseFailure = state.pulseFailureKind,
        onAddName = actions::onOpenNamesToAdd
    )
}

/**
 * A `Report(id)` entry. The ViewModel holds one open report; when it holds another one (after a recreate, a
 * second report opened on another tab, or a build started from a screen pushed over this one) the entry asks
 * for its own again.
 *
 * The base layer keeps a report composed under pushed screens, so a key on `reportId` alone is not enough: the
 * effect also re-runs when the entry comes back on top, when the held report changes, and when an open
 * finishes. It asks only while the entry is on top and no open is in flight, and at most once per held report,
 * so a failed open shows its error (with a retry that opens this report again) instead of retrying in a loop.
 */
@Composable
private fun ShellContentScope.ReportEntry(
    entry: NavEntry,
    reportId: String,
    entryTicker: String?,
    classic: Boolean,
    padding: PaddingValues
) {
    val report = state.deepDiveReport?.takeIf { it.reportId == reportId }
    val onTop = navigator.tabTop.entryId == entry.entryId
    val heldId = state.deepDiveReport?.reportId
    var askedWhileHolding by remember(reportId) { mutableStateOf<String?>(NOT_ASKED) }
    LaunchedEffect(reportId, onTop, heldId, state.isOpeningReport) {
        if (onTop && heldId != reportId && !state.isOpeningReport && askedWhileHolding != (heldId ?: NONE_HELD)) {
            askedWhileHolding = heldId ?: NONE_HELD
            actions.onEnsureReport(reportId)
        }
    }
    DeepDiveScreenFor(
        report = report,
        isLoading = reportEntryLoading(reportId, state),
        errorMessage = state.deepDiveError,
        padding = padding,
        classic = classic,
        // The error card's button opens this stored report again; it never starts a new build (principle 11).
        onRetry = { actions.onEnsureReport(reportId) },
        retryLabel = OPEN_REPORT_AGAIN,
        ticker = report?.ticker ?: entryTicker,
        building = false
    )
}

/** A `Report(id)` entry is still opening its report (no report yet, no error). */
internal fun reportEntryLoading(reportId: String, state: UiState): Boolean =
    state.deepDiveReport?.reportId != reportId && (state.isOpeningReport || state.deepDiveError == null)

/** `UserProfileView.tier` of a Pro subscriber (as `MainViewModel.isProTier`). */
private const val PRO_TIER = "PRO"

/** The paywall feature key of Conviction Intelligence (Name's journal "See Pro"). */
private const val FEATURE_CONVICTION = "conviction_intelligence"

/** A `DeepDiveRunning(ticker)` entry whose own build is not the one running or last run. */
private fun buildEndedMessage(ticker: String): String = "The ${ticker.uppercase()} Deep Dive is no longer running."

/** The failed report entry's button says what it does: open the stored report again (principle 11). */
private const val OPEN_REPORT_AGAIN = "Open report again"

private const val NOT_ASKED = "\u0000not-asked"
private const val NONE_HELD = "\u0000none"


@Composable
private fun ShellContentScope.DeepDiveScreenFor(
    report: com.thesis.mobile.model.DeepDiveReportView?,
    isLoading: Boolean,
    errorMessage: String?,
    padding: PaddingValues,
    classic: Boolean,
    onRetry: () -> Unit,
    retryLabel: String? = null,
    ticker: String? = null,
    building: Boolean,
    jobStatus: String? = null
) {
    val symbol = ticker?.trim()?.uppercase()?.ifBlank { null }
    val following = symbol != null && state.watchlist.any { it.equals(symbol, ignoreCase = true) }
    val onFollowChange: ((Boolean) -> Unit)? = symbol?.let { t ->
        { on: Boolean -> if (on) actions.onAddName(t) else actions.onUnfollowName(t) }
    }
    DeepDiveScreen(
        report = report,
        isLoading = isLoading,
        errorMessage = errorMessage,
        watchlist = state.watchlist,
        onRetry = onRetry,
        retryLabel = retryLabel,
        userTier = state.userProfile?.tier,
        reportNoteDraft = state.reportNoteDraft,
        noteUpdatedAt = state.reportNote?.updatedAt,
        isSavingNote = state.isSavingNote,
        convictionTimeline = state.convictionTimeline,
        convictionTimelineError = state.convictionTimelineError,
        oppositeCase = state.oppositeCase,
        oppositeCaseError = state.oppositeCaseError,
        isGeneratingOppositeCase = state.isGeneratingOppositeCase,
        onReportNoteChange = actions::onReportNoteChange,
        onSaveReportNote = actions::onSaveReportNote,
        onGenerateOppositeCase = actions::onGenerateOppositeCase,
        onRefreshConvictionTimeline = actions::onRefreshConviction,
        scenarioResult = state.scenarioResult,
        isRunningScenario = state.isRunningScenario,
        onRunScenario = actions::onRunScenario,
        onRequireUpgrade = actions::onRequireUpgrade,
        onSubmitReportFeedback = actions::onSubmitReportFeedback,
        onNotify = actions::onNotify,
        onOpenScenarioStress = actions::onOpenScenarioStress,
        webPage = if (classic) null else DeepDiveWebPageAccess(
            apiBaseUrl = state.apiBaseUrl,
            accessToken = state.tokens?.accessToken,
            reportLoadedFromCache = state.deepDiveLoadedFromCache,
            isPaywallOpen = navigator.modalStack.any { it.destination is Destination.Paywall },
            refreshAccessToken = actions::onRefreshPageToken
        ),
        onBack = { actions.onBack() },
        padding = padding,
        following = following,
        onFollowChange = onFollowChange,
        openingStoredReport = !building,
        building = building,
        ticker = symbol,
        jobStatus = jobStatus,
        // While a stored report opens, its skeleton sits under the same ReportTopBar the host draws next (the shell
        // shows no bar then, topBarFor), so the open crossfades under one chrome.
        reportBar = if (!building && symbol != null) {
            ReportOpeningBar(
                ticker = symbol,
                onBack = { actions.onBack() },
                following = following,
                onFollowChange = onFollowChange
            )
        } else {
            null
        },
        host = ReportHostExtras(
            isFollowing = following,
            onFollowChange = onFollowChange,
            watchlist = state.watchlist,
            reportHistory = state.reportHistory,
            notesTrail = symbol?.let { state.notesTrails[it] }.orEmpty(),
            onCompareNames = { tickers -> actions.onOpenCompareNames(tickers.take(COMPARE_NAMES_MAX)) },
            onCompareReports = actions::onOpenCompareReports
        )
    )
}

/**
 * A note search hit's `Destination.Name` anchor: "Your notes" at one trail entry, named by its key (the report id):
 * `notes:<reportId>`. It rides in the existing anchor field, so the destination's codec and saved stacks need no
 * change (docs/app-redesign/handoff/HANDOFF-K.md: WP-INT may move it next to `Destination.Name.ANCHOR_NOTES`).
 */
internal fun noteEntryAnchor(reportId: String): String = Destination.Name.ANCHOR_NOTES + NOTE_ENTRY_MARK + reportId

/** The trail entry key a [noteEntryAnchor] names; null for any other anchor. */
internal fun noteEntryOf(anchor: String?): String? =
    anchor?.takeIf { it.startsWith(Destination.Name.ANCHOR_NOTES + NOTE_ENTRY_MARK) }
        ?.substring(Destination.Name.ANCHOR_NOTES.length + NOTE_ENTRY_MARK.length)
        ?.ifBlank { null }

private const val NOTE_ENTRY_MARK = ":"
