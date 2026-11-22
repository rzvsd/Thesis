package com.thesis.mobile.ui

import android.app.Activity
import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Newspaper
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.style.TextAlign
import androidx.lifecycle.viewmodel.compose.viewModel
import com.thesis.mobile.LaunchTarget
import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.model.ConvictionInsightCardView
import com.thesis.mobile.model.ConvictionJournalEntryView
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.EvidenceView
import com.thesis.mobile.model.NotificationPreferenceView
import com.thesis.mobile.model.OppositeCaseReportView
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.model.ScenarioStressRunView
import com.thesis.mobile.model.ScenarioStressTemplateView
import com.thesis.mobile.model.SectionView
import com.thesis.mobile.model.UserProfileView
import com.thesis.mobile.model.WarRoomView
import com.thesis.mobile.ui.copy.Phase4Copy
import com.thesis.mobile.ui.navigation.ThesisBottomBar
import com.thesis.mobile.ui.navigation.ThesisNavItem
import com.thesis.mobile.ui.screens.DeepDiveScreen
import com.thesis.mobile.ui.screens.HistoryScreen
import com.thesis.mobile.ui.screens.HomeScreen
import com.thesis.mobile.ui.screens.InboxScreen
import com.thesis.mobile.ui.screens.MonthlyCoherenceSection
import com.thesis.mobile.ui.screens.NamesScreen
import com.thesis.mobile.ui.screens.OnboardingScreen
import com.thesis.mobile.ui.screens.PulseScreen
import com.thesis.mobile.ui.screens.ScenarioStressScreen
import com.thesis.mobile.ui.screens.MacroStressDashboardScreen
import com.thesis.mobile.ui.screens.WarRoomScreen
import com.thesis.mobile.ui.screens.WelcomeScreen
import com.thesis.mobile.ui.screens.WeeklyDigestScreen
import com.thesis.mobile.ui.screens.createPulsePdfExport
import com.thesis.mobile.ui.screens.shareExport
import com.thesis.mobile.ui.theme.HeadingFont
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTheme
import com.thesis.mobile.ui.theme.ThesisTypography
import androidx.compose.material.icons.filled.History
import androidx.compose.foundation.text.KeyboardOptions
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private enum class TodayMode {
    HOME,
    PULSE,
    MACRO_STRESS_DASHBOARD,
    WEEKLY_DIGEST
}

private enum class ResearchMode {
    DEEP_DIVE,
    WAR_ROOM,
    SCENARIO,
    HISTORY
}

private enum class PortfolioMode {
    MY_NAMES,
    SETTINGS
}

@Composable
fun ThesisApp(
    launchTarget: LaunchTarget? = null,
    onLaunchHandled: () -> Unit = {},
    mainViewModel: MainViewModel = viewModel()
) {
    var uiState by remember { mutableStateOf(mainViewModel.state) }
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }
    var todayMode by rememberSaveable { mutableStateOf(TodayMode.HOME) }
    var weeklyDigestDate by rememberSaveable { mutableStateOf<String?>(null) }
    var researchMode by rememberSaveable { mutableStateOf(ResearchMode.DEEP_DIVE) }
    var namesFocusedTicker by rememberSaveable { mutableStateOf<String?>(null) }

    DisposableEffect(mainViewModel) {
        mainViewModel.observe { state -> uiState = state }
        onDispose {}
    }

    LaunchedEffect(launchTarget?.requestId, uiState.tokens) {
        val target = launchTarget ?: return@LaunchedEffect
        if (uiState.tokens == null) {
            return@LaunchedEffect
        }

        when (target.tab) {
            "today" -> {
                namesFocusedTicker = null
                mainViewModel.openPulseFromNotification(target.pulseDate)
                if (!target.digestDate.isNullOrBlank() || target.notificationType == "weekly_digest") {
                    todayMode = TodayMode.WEEKLY_DIGEST
                    weeklyDigestDate = target.digestDate
                    mainViewModel.openWeeklyDigest(fromPush = true)
                } else {
                    todayMode = TodayMode.HOME
                    weeklyDigestDate = null
                }
                mainViewModel.trackPushDeepLinkLanded(
                    targetTab = "today",
                    notificationType = target.notificationType,
                    ticker = target.ticker,
                    alertId = target.alertId,
                    warRoomId = target.warRoomId,
                    scenarioId = target.scenarioId,
                    scenarioRunId = target.scenarioRunId
                )
            }
            "names" -> {
                mainViewModel.setTab(AppTab.NAMES)
                namesFocusedTicker = target.ticker?.trim()?.uppercase()?.ifBlank { null }
                mainViewModel.trackPushDeepLinkLanded(
                    targetTab = "names",
                    notificationType = target.notificationType,
                    ticker = target.ticker,
                    alertId = target.alertId,
                    warRoomId = target.warRoomId,
                    scenarioId = target.scenarioId,
                    scenarioRunId = target.scenarioRunId
                )
            }
            "research" -> {
                namesFocusedTicker = null
                val warRoomId = target.warRoomId?.trim().orEmpty()
                val scenarioId = target.scenarioId?.trim().orEmpty()
                val scenarioRunId = target.scenarioRunId?.trim().orEmpty()
                val ticker = target.ticker?.trim().orEmpty()
                researchMode = when {
                    warRoomId.isNotBlank() || target.notificationType == "earnings_war_room" -> ResearchMode.WAR_ROOM
                    scenarioRunId.isNotBlank() || scenarioId.isNotBlank() -> ResearchMode.SCENARIO
                    else -> ResearchMode.DEEP_DIVE
                }
                mainViewModel.setTab(AppTab.RESEARCH)
                if (warRoomId.isNotBlank()) {
                    mainViewModel.openWarRoom(warRoomId)
                } else if (scenarioRunId.isNotBlank()) {
                    mainViewModel.openScenarioStressRun(
                        scenarioRunId = scenarioRunId,
                        scenarioId = scenarioId.ifBlank { null }
                    )
                } else if (scenarioId.isNotBlank()) {
                    mainViewModel.selectScenarioStressTemplate(scenarioId)
                } else if (!target.reportId.isNullOrBlank()) {
                    mainViewModel.openHistoryReport(target.reportId)
                } else if (ticker.isNotBlank()) {
                    mainViewModel.selectTicker(ticker)
                    if (researchMode == ResearchMode.DEEP_DIVE) {
                        mainViewModel.runDeepDive()
                    }
                }
                mainViewModel.trackPushDeepLinkLanded(
                    targetTab = "research",
                    notificationType = target.notificationType,
                    ticker = target.ticker,
                    alertId = target.alertId,
                    warRoomId = target.warRoomId,
                    scenarioId = target.scenarioId,
                    scenarioRunId = target.scenarioRunId
                )
            }
            "inbox" -> {
                namesFocusedTicker = null
                mainViewModel.setTab(AppTab.INBOX)
                mainViewModel.trackPushDeepLinkLanded(
                    targetTab = "inbox",
                    notificationType = target.notificationType,
                    ticker = target.ticker,
                    alertId = target.alertId,
                    warRoomId = target.warRoomId,
                    scenarioId = target.scenarioId,
                    scenarioRunId = target.scenarioRunId
                )
            }
            "you" -> {
                namesFocusedTicker = null
                mainViewModel.setTab(AppTab.YOU)
                mainViewModel.trackPushDeepLinkLanded(
                    targetTab = "you",
                    notificationType = target.notificationType,
                    ticker = target.ticker,
                    alertId = target.alertId,
                    warRoomId = target.warRoomId,
                    scenarioId = target.scenarioId,
                    scenarioRunId = target.scenarioRunId
                )
            }
        }

        onLaunchHandled()
    }

    LaunchedEffect(uiState.message, uiState.tokens) {
        val message = uiState.message
        if (!message.isNullOrBlank() && uiState.tokens != null) {
            snackbarHostState.showSnackbar(message)
            mainViewModel.clearMessage()
        }
    }

    ThesisTheme {
        if (uiState.showWelcome) {
            OnboardingScreen(onComplete = mainViewModel::completeWelcome)
            return@ThesisTheme
        }

        if (uiState.tokens == null) {
            AuthScreen(
                isLoading = uiState.isLoading,
                currentApiBaseUrl = uiState.apiBaseUrl,
                verificationToken = uiState.verificationToken,
                registerStatus = uiState.registerStatus,
                message = uiState.message,
                onSaveApiBaseUrl = mainViewModel::updateApiBaseUrl,
                onRegister = mainViewModel::register,
                onVerify = mainViewModel::verify,
                onLogin = mainViewModel::login
            )
            return@ThesisTheme
        }

        val visibleTabs = remember {
            listOf(TabItem.Today, TabItem.Names, TabItem.Research, TabItem.Inbox, TabItem.You)
        }
        val preferredResearchRoot = when {
            uiState.warRoom != null -> ResearchMode.WAR_ROOM
            uiState.scenarioStressRun != null -> ResearchMode.SCENARIO
            uiState.deepDiveReport != null -> ResearchMode.DEEP_DIVE
            !uiState.selectedTicker.isNullOrBlank() -> ResearchMode.DEEP_DIVE
            uiState.reportHistory.isNotEmpty() -> ResearchMode.HISTORY
            else -> ResearchMode.DEEP_DIVE
        }
        val morningBriefing = uiState.alertLedger.firstOrNull {
            it.notificationType == "morning_exception_briefing"
        }
        val openAlertTarget: (AlertLedgerItemView) -> Unit = { alert ->
            val briefingContext = if (alert.notificationType == "morning_exception_briefing") {
                alert.briefingContext
            } else {
                null
            }
            val targetRoute = briefingContext?.leadRoute
                ?.trim()
                ?.lowercase()
                ?.ifBlank { null }
                ?: alert.route
            val targetTicker = briefingContext?.leadTicker?.ifBlank { null } ?: alert.ticker
            val targetReportId = briefingContext?.leadReportId?.ifBlank { null } ?: alert.reportId
            val targetPulseDate = briefingContext?.leadPulseDate?.ifBlank { null } ?: alert.pulseDate
            val targetDigestDate = briefingContext?.leadDigestDate?.ifBlank { null } ?: alert.digestDate
            val targetRelatedTickers = if (
                briefingContext != null && briefingContext.relatedTickers.isNotEmpty()
            ) {
                briefingContext.relatedTickers
            } else {
                alert.relatedTickers
            }
            val normalizedTicker = targetTicker?.trim()?.uppercase()?.ifBlank { null }

            when (targetRoute) {
                "today" -> {
                    if (!targetDigestDate.isNullOrBlank()) {
                        todayMode = TodayMode.WEEKLY_DIGEST
                        weeklyDigestDate = targetDigestDate
                        mainViewModel.openWeeklyDigest(fromPush = false)
                    } else {
                        todayMode = TodayMode.HOME
                        mainViewModel.openPulseFromNotification(targetPulseDate)
                    }
                    mainViewModel.setTab(AppTab.TODAY)
                }
                "names" -> {
                    namesFocusedTicker = normalizedTicker
                        ?: targetRelatedTickers.firstOrNull()
                            ?.trim()
                            ?.uppercase()
                            ?.ifBlank { null }
                    mainViewModel.setTab(AppTab.NAMES)
                }
                "research" -> {
                    namesFocusedTicker = null
                    researchMode = ResearchMode.DEEP_DIVE
                    if (!targetReportId.isNullOrBlank()) {
                        mainViewModel.openHistoryReport(targetReportId)
                    } else if (!normalizedTicker.isNullOrBlank()) {
                        mainViewModel.selectTicker(normalizedTicker)
                        mainViewModel.runDeepDive()
                    }
                    mainViewModel.setTab(AppTab.RESEARCH)
                }
                "you" -> {
                    namesFocusedTicker = null
                    mainViewModel.setTab(AppTab.YOU)
                }
                else -> {
                    namesFocusedTicker = null
                    mainViewModel.setTab(AppTab.INBOX)
                }
            }
        }

        Scaffold(
            snackbarHost = { SnackbarHost(snackbarHostState) },
            bottomBar = {
                ThesisBottomBar(
                    items = visibleTabs.map { tab ->
                        ThesisNavItem(label = tab.label, icon = tab.icon, tag = tab.name)
                    },
                    selectedTag = visibleTabs.firstOrNull { it.target == uiState.currentTab }?.name
                        ?: TabItem.Today.name,
                    onSelect = { tag ->
                        val tab = visibleTabs.firstOrNull { it.name == tag } ?: return@ThesisBottomBar
                        val isCurrentTab = uiState.currentTab == tab.target
                        if (isCurrentTab && tab.target == AppTab.TODAY) {
                            todayMode = TodayMode.HOME
                        }
                        if (tab.target == AppTab.NAMES) {
                            namesFocusedTicker = null
                        }
                        if (isCurrentTab && tab.target == AppTab.RESEARCH) {
                            researchMode = preferredResearchRoot
                        } else if (
                            tab.target == AppTab.RESEARCH &&
                            researchMode == ResearchMode.DEEP_DIVE &&
                            uiState.deepDiveReport == null &&
                            uiState.selectedTicker.isNullOrBlank() &&
                            uiState.reportHistory.isNotEmpty()
                        ) {
                            researchMode = ResearchMode.HISTORY
                        }
                        mainViewModel.setTab(tab.target)
                    }
                )
            }
        ) { padding ->
            val showGlobalLoading = uiState.isLoading && uiState.currentTab != AppTab.RESEARCH
            if (showGlobalLoading) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    verticalArrangement = Arrangement.Center
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center
                    ) {
                        CircularProgressIndicator()
                    }
                }
            } else {
                when (uiState.currentTab) {
                    AppTab.TODAY -> when (todayMode) {
                        TodayMode.HOME -> HomeScreen(
                            pulse = uiState.pulseReport,
                            pulseLoadedFromCache = uiState.pulseLoadedFromCache,
                            pulseFreshnessText = uiState.pulseFreshnessText,
                            sentimentCurrent = uiState.sentimentCurrent,
                            sentimentHistory = uiState.sentimentHistory,
                            sentimentError = uiState.sentimentError,
                            watchlist = uiState.watchlist,
                            monitorSnapshots = uiState.monitorSnapshots,
                            morningBriefing = morningBriefing,
                            padding = padding,
                            lastViewedReport = uiState.lastViewedReport,
                            pulseError = uiState.pulseError,
                            onOpenHistory = {
                                researchMode = ResearchMode.HISTORY
                                mainViewModel.setTab(AppTab.RESEARCH)
                            },
                            onRunDeepDive = { ticker ->
                                mainViewModel.selectTicker(ticker)
                                researchMode = ResearchMode.DEEP_DIVE
                                mainViewModel.setTab(AppTab.RESEARCH)
                                mainViewModel.runDeepDive()
                            },
                            onManageNames = {
                                mainViewModel.setTab(AppTab.NAMES)
                            },
                            onRetryPulse = mainViewModel::refreshPulse,
                            onOpenMacroStressDashboard = {
                                todayMode = TodayMode.MACRO_STRESS_DASHBOARD
                                mainViewModel.openMacroStressDashboard()
                            },
                            onOpenWeeklyDigest = {
                                todayMode = TodayMode.WEEKLY_DIGEST
                                weeklyDigestDate = uiState.sentimentCurrent?.marketDate
                                mainViewModel.openWeeklyDigest(fromPush = false)
                            },
                            onOpenPulseBrief = { todayMode = TodayMode.PULSE },
                            onOpenMorningBriefing = openAlertTarget,
                            onResumeLastViewed = {
                                if (it.type == "DEEP_DIVE") {
                                    researchMode = ResearchMode.DEEP_DIVE
                                }
                                mainViewModel.resumeLastViewed(it)
                            },
                            onDismissResume = { mainViewModel.dismissResumeCard() }
                        )

                        TodayMode.PULSE -> PulseScreen(
                            pulse = uiState.pulseReport,
                            watchlist = uiState.watchlist,
                            onBack = { todayMode = TodayMode.HOME },
                            onRunDeepDive = { ticker ->
                                mainViewModel.selectTicker(ticker)
                                researchMode = ResearchMode.DEEP_DIVE
                                mainViewModel.setTab(AppTab.RESEARCH)
                                mainViewModel.runDeepDive()
                            },
                            onExportPdf = {
                                mainViewModel.exportPulsePdf { download ->
                                    val artifact = createPulsePdfExport(
                                        context,
                                        download.bytes,
                                        download.filename
                                    )
                                    shareExport(context, artifact)
                                }
                            },
                            onRefresh = mainViewModel::refreshPulse
                        )

                        TodayMode.MACRO_STRESS_DASHBOARD -> MacroStressDashboardScreen(
                            current = uiState.sentimentCurrent,
                            history = uiState.sentimentHistory,
                            selectedRangeDays = uiState.sentimentRangeDays,
                            sentimentError = uiState.sentimentError,
                            onSelectRange = { rangeDays ->
                                mainViewModel.openMacroStressDashboard(rangeDays)
                            },
                            onBack = { todayMode = TodayMode.HOME }
                        )

                        TodayMode.WEEKLY_DIGEST -> WeeklyDigestScreen(
                            digestDate = weeklyDigestDate,
                            sentimentCurrent = uiState.sentimentCurrent,
                            watchlist = uiState.watchlist,
                            monitorSnapshots = uiState.monitorSnapshots,
                            pulse = uiState.pulseReport,
                            onOpenDashboard = {
                                todayMode = TodayMode.MACRO_STRESS_DASHBOARD
                                mainViewModel.openMacroStressDashboard()
                            },
                            onBack = { todayMode = TodayMode.HOME }
                        )
                    }
                    AppTab.RESEARCH -> ResearchTab(
                        mode = researchMode,
                        onSetMode = { researchMode = it },
                        padding = padding,
                        reportHistory = uiState.reportHistory,
                        deepDiveReport = uiState.deepDiveReport,
                        warRoom = uiState.warRoom,
                        warRoomError = uiState.warRoomError,
                        isLoading = uiState.isLoading,
                        deepDiveError = uiState.deepDiveError,
                        userTier = uiState.userProfile?.tier,
                        reportNoteDraft = uiState.reportNoteDraft,
                        noteUpdatedAt = uiState.reportNote?.updatedAt,
                        isSavingNote = uiState.isSavingNote,
                        convictionTimeline = uiState.convictionTimeline,
                        convictionTimelineError = uiState.convictionTimelineError,
                        oppositeCase = uiState.oppositeCase,
                        oppositeCaseError = uiState.oppositeCaseError,
                        isGeneratingOppositeCase = uiState.isGeneratingOppositeCase,
                        scenarioStressTemplates = uiState.scenarioStressTemplates,
                        selectedScenarioStressId = uiState.selectedScenarioStressId,
                        scenarioStressRun = uiState.scenarioStressRun,
                        scenarioStressTemplatesError = uiState.scenarioStressTemplatesError,
                        scenarioStressRunError = uiState.scenarioStressRunError,
                        isLoadingScenarioStressTemplates = uiState.isLoadingScenarioStressTemplates,
                        isRunningScenarioStress = uiState.isRunningScenarioStress,
                        scenarioResult = uiState.scenarioResult,
                        isRunningScenario = uiState.isRunningScenario,
                        selectedTicker = uiState.selectedTicker ?: "",
                        watchlist = uiState.watchlist,
                        onTickerChange = mainViewModel::selectTicker,
                        onRunReport = mainViewModel::runDeepDive,
                        onReportNoteChange = mainViewModel::updateReportNoteDraft,
                        onSaveReportNote = mainViewModel::saveReportNote,
                        onGenerateOppositeCase = mainViewModel::generateOppositeCase,
                        onRefreshConvictionTimeline = { mainViewModel.refreshConvictionTimeline() },
                        onRefreshScenarioStressTemplates = { mainViewModel.refreshScenarioStressTemplates(force = true) },
                        onSelectScenarioStressTemplate = mainViewModel::selectScenarioStressTemplate,
                        onRunScenarioStress = mainViewModel::runScenarioStress,
                        onOpenScenarioStressRun = mainViewModel::openScenarioStressRun,
                        onRunScenario = mainViewModel::runScenario,
                        onRequireUpgrade = mainViewModel::requestFeatureUpgrade,
                        onSubmitReportFeedback = mainViewModel::submitReportFeedback,
                        onNotify = mainViewModel::notifyUser,
                        onOpenHistoryReport = mainViewModel::openHistoryReport,
                        onRefreshWarRoom = mainViewModel::refreshWarRoom,
                        onOpenPulseHistory = { date ->
                            mainViewModel.loadPulseByDate(
                                date = date,
                                rememberAsLastViewed = true
                            )
                            mainViewModel.setTab(AppTab.TODAY)
                        }
                    )
                    AppTab.NAMES -> NamesScreen(
                        padding = padding,
                        watchlist = uiState.watchlist,
                        monitorSnapshots = uiState.monitorSnapshots,
                        alerts = uiState.alertLedger,
                        focusTicker = namesFocusedTicker,
                        onRefresh = {
                            mainViewModel.refreshWatchlist()
                            mainViewModel.refreshMonitorSnapshots()
                            mainViewModel.refreshAlertLedger()
                        },
                        onAddTicker = mainViewModel::addWatchlistTicker,
                        onRemoveTicker = mainViewModel::removeWatchlistTicker,
                        onImportHoldingsCsv = mainViewModel::importHoldingsCsv,
                        onRunDeepDive = { ticker ->
                            mainViewModel.selectTicker(ticker)
                            researchMode = ResearchMode.DEEP_DIVE
                            mainViewModel.setTab(AppTab.RESEARCH)
                            mainViewModel.runDeepDive()
                        },
                        onOpenResearch = { ticker ->
                            mainViewModel.selectTicker(ticker)
                            researchMode = ResearchMode.DEEP_DIVE
                            mainViewModel.setTab(AppTab.RESEARCH)
                        }
                    )
                    AppTab.INBOX -> InboxScreen(
                        padding = padding,
                        alerts = uiState.alertLedger,
                        inboxError = uiState.inboxError,
                        onRefresh = mainViewModel::refreshAlertLedger,
                        onOpenAlert = openAlertTarget,
                        onSubmitFeedback = mainViewModel::submitAlertFeedback,
                        onQuietAlertType = mainViewModel::muteAlert,
                        onDisableAlertType = { type ->
                            mainViewModel.setNotificationPreference(type, false)
                        }
                    )
                    AppTab.YOU -> SettingsTab(
                        padding = padding,
                        currentApiBaseUrl = uiState.apiBaseUrl,
                        profile = uiState.userProfile,
                        convictionInsights = uiState.convictionInsights,
                        convictionInsightsError = uiState.convictionInsightsError,
                        subscriptionOffers = uiState.subscriptionOffers,
                        subscriptionActionInFlight = uiState.subscriptionActionInFlight,
                        notificationsEnabled = uiState.notificationsEnabled,
                        biometricSupported = uiState.biometricSupported,
                        biometricLockEnabled = uiState.biometricLockEnabled,
                        notificationPreferences = uiState.notificationPreferences,
                        onSetNotifications = mainViewModel::setNotificationsEnabled,
                        onSetBiometricLockEnabled = mainViewModel::setBiometricLockEnabled,
                        onSetNotificationPreference = mainViewModel::setNotificationPreference,
                        onSaveApiBaseUrl = mainViewModel::updateApiBaseUrl,
                        onSyncTier = mainViewModel::syncTierFromServer,
                        onRefreshConvictionInsights = mainViewModel::refreshConvictionInsights,
                        onRequireUpgrade = mainViewModel::requestFeatureUpgrade,
                        onRefreshOffers = mainViewModel::refreshSubscriptionOffers,
                        onStartPurchase = mainViewModel::startPurchase,
                        onRestorePurchases = mainViewModel::restorePurchases,
                        onSubmitSubscriptionFeedback = mainViewModel::submitSubscriptionFeedback,
                        onLogout = mainViewModel::logout
                    )
                }
            }
        }

        if (!uiState.paywallFeature.isNullOrBlank()) {
            val activity = (LocalContext.current as? Activity)
            UpgradeRequiredDialog(
                feature = uiState.paywallFeature,
                onDismiss = mainViewModel::dismissPaywall,
                subscriptionOffers = uiState.subscriptionOffers,
                subscriptionActionInFlight = uiState.subscriptionActionInFlight,
                onSyncTier = { mainViewModel.syncTierFromServer() },
                onStartPurchase = { preferredType ->
                    if (activity != null) {
                        mainViewModel.startPurchase(activity, preferredType)
                    }
                },
                onRestorePurchases = mainViewModel::restorePurchases,
                onRefreshOffers = mainViewModel::refreshSubscriptionOffers
            )
        }
    }
}

private enum class TabItem(
    val target: AppTab,
    val label: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector
) {
    Today(AppTab.TODAY, Phase4Copy.todayTab, Icons.Filled.Newspaper),
    Names(AppTab.NAMES, Phase4Copy.namesTab, Icons.AutoMirrored.Filled.List),
    Research(AppTab.RESEARCH, Phase4Copy.researchTab, Icons.Filled.Search),
    Inbox(AppTab.INBOX, Phase4Copy.inboxTab, Icons.Filled.Notifications),
    You(AppTab.YOU, Phase4Copy.youTab, Icons.Filled.Settings)
}


@Composable
private fun ResearchTab(
    mode: ResearchMode,
    onSetMode: (ResearchMode) -> Unit,
    padding: PaddingValues,
    reportHistory: List<ReportHistoryItem>,
    deepDiveReport: DeepDiveReportView?,
    warRoom: WarRoomView?,
    warRoomError: String?,
    isLoading: Boolean,
    deepDiveError: String?,
    userTier: String?,
    reportNoteDraft: String,
    noteUpdatedAt: String?,
    isSavingNote: Boolean,
    convictionTimeline: List<ConvictionJournalEntryView>,
    convictionTimelineError: String?,
    oppositeCase: OppositeCaseReportView?,
    oppositeCaseError: String?,
    isGeneratingOppositeCase: Boolean,
    scenarioStressTemplates: List<ScenarioStressTemplateView>,
    selectedScenarioStressId: String?,
    scenarioStressRun: ScenarioStressRunView?,
    scenarioStressTemplatesError: String?,
    scenarioStressRunError: String?,
    isLoadingScenarioStressTemplates: Boolean,
    isRunningScenarioStress: Boolean,
    scenarioResult: com.thesis.mobile.model.ScenarioResultView?,
    isRunningScenario: Boolean,
    selectedTicker: String,
    watchlist: List<String>,
    onTickerChange: (String) -> Unit,
    onRunReport: () -> Unit,
    onReportNoteChange: (String) -> Unit,
    onSaveReportNote: () -> Unit,
    onGenerateOppositeCase: () -> Unit,
    onRefreshConvictionTimeline: () -> Unit,
    onRefreshScenarioStressTemplates: () -> Unit,
    onSelectScenarioStressTemplate: (String) -> Unit,
    onRunScenarioStress: (String?) -> Unit,
    onOpenScenarioStressRun: (String, String?) -> Unit,
    onRunScenario: (Int?, Double?, Double?) -> Unit,
    onRequireUpgrade: (String) -> Unit,
    onSubmitReportFeedback: (String, String) -> Unit,
    onNotify: (String) -> Unit,
    onOpenHistoryReport: (String) -> Unit,
    onRefreshWarRoom: () -> Unit,
    onOpenPulseHistory: (String) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding)
            .background(ThesisColors.Background)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(
                    horizontal = ThesisDimens.ScreenPaddingHorizontal,
                    vertical = ThesisDimens.SpacingMd
                ),
            horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
        ) {
            SegmentButton(
                label = "Deep Dive",
                isSelected = mode == ResearchMode.DEEP_DIVE,
                onClick = { onSetMode(ResearchMode.DEEP_DIVE) }
            )
            SegmentButton(
                label = Phase4Copy.researchWarRoomLabel,
                isSelected = mode == ResearchMode.WAR_ROOM,
                onClick = { onSetMode(ResearchMode.WAR_ROOM) }
            )
            SegmentButton(
                label = Phase4Copy.researchStressLabel,
                isSelected = mode == ResearchMode.SCENARIO,
                onClick = { onSetMode(ResearchMode.SCENARIO) }
            )
            SegmentButton(
                label = "History",
                isSelected = mode == ResearchMode.HISTORY,
                onClick = { onSetMode(ResearchMode.HISTORY) }
            )
        }

        when (mode) {
            ResearchMode.DEEP_DIVE -> DeepDiveScreen(
                report = deepDiveReport,
                isLoading = isLoading,
                errorMessage = deepDiveError,
                tickerState = selectedTicker,
                recentHistory = reportHistory,
                watchlist = watchlist,
                onTickerChange = onTickerChange,
                onRunReport = onRunReport,
                userTier = userTier,
                reportNoteDraft = reportNoteDraft,
                noteUpdatedAt = noteUpdatedAt,
                isSavingNote = isSavingNote,
                convictionTimeline = convictionTimeline,
                convictionTimelineError = convictionTimelineError,
                oppositeCase = oppositeCase,
                oppositeCaseError = oppositeCaseError,
                isGeneratingOppositeCase = isGeneratingOppositeCase,
                onReportNoteChange = onReportNoteChange,
                onSaveReportNote = onSaveReportNote,
                onGenerateOppositeCase = onGenerateOppositeCase,
                onRefreshConvictionTimeline = onRefreshConvictionTimeline,
                scenarioResult = scenarioResult,
                isRunningScenario = isRunningScenario,
                onRunScenario = onRunScenario,
                onRequireUpgrade = onRequireUpgrade,
                onSubmitReportFeedback = onSubmitReportFeedback,
                onNotify = onNotify,
                onOpenHistoryReport = onOpenHistoryReport,
                onOpenPulseHistory = onOpenPulseHistory,
                onBack = {
                    onSetMode(
                        if (reportHistory.isNotEmpty()) {
                            ResearchMode.HISTORY
                        } else {
                            ResearchMode.DEEP_DIVE
                        }
                    )
                },
                padding = PaddingValues()
            )

            ResearchMode.WAR_ROOM -> WarRoomScreen(
                warRoom = warRoom,
                errorMessage = warRoomError,
                onRefresh = onRefreshWarRoom,
                padding = PaddingValues()
            )

            ResearchMode.SCENARIO -> ScenarioStressScreen(
                userTier = userTier,
                templates = scenarioStressTemplates,
                selectedScenarioId = selectedScenarioStressId,
                run = scenarioStressRun,
                templatesError = scenarioStressTemplatesError,
                runError = scenarioStressRunError,
                isLoadingTemplates = isLoadingScenarioStressTemplates,
                isRunning = isRunningScenarioStress,
                watchlistCount = watchlist.size,
                onRefreshTemplates = onRefreshScenarioStressTemplates,
                onSelectTemplate = onSelectScenarioStressTemplate,
                onRunScenario = onRunScenarioStress,
                onOpenTickerResearch = { ticker ->
                    onTickerChange(ticker)
                    onSetMode(ResearchMode.DEEP_DIVE)
                    onRunReport()
                },
                onOpenRunFromRoute = onOpenScenarioStressRun,
                onRequireUpgrade = onRequireUpgrade
            )

            ResearchMode.HISTORY -> HistoryScreen(
                historyItems = reportHistory,
                onBack = { onSetMode(ResearchMode.DEEP_DIVE) },
                onOpenReport = { item ->
                    if (item.type == "deep_dive") {
                        onOpenHistoryReport(item.reportId)
                        onSetMode(ResearchMode.DEEP_DIVE)
                    } else {
                        onOpenPulseHistory(item.createdAt.take(10))
                    }
                }
            )
        }
    }
}

@Composable
private fun PortfolioSummaryCard(
    profile: UserProfileView,
    watchlistCount: Int,
    watchlistFeatureEnabled: Boolean,
    modifier: Modifier = Modifier
) {
    val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
    val deepDiveLimit = profile.dailyDeepDiveLimit
    val deepDiveLabel = if (deepDiveLimit < 0) {
        "Unlimited"
    } else {
        "${profile.deepDivesRemainingToday} left today"
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(shape)
            .background(ThesisColors.Surface)
            .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
            .padding(ThesisDimens.CardPadding),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXs)) {
                Text(
                    text = "Portfolio",
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.TextMuted
                )
                Text(
                    text = profile.email,
                    style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.TextPrimary
                )
            }
            Text(
                text = profile.tier,
                style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                color = ThesisColors.Primary,
                modifier = Modifier
                    .clip(RoundedCornerShape(ThesisDimens.SignalBadgeCorner))
                    .background(ThesisColors.Primary.copy(alpha = 0.1f))
                    .padding(horizontal = ThesisDimens.SpacingSm, vertical = ThesisDimens.SpacingXs)
            )
        }

        HorizontalDivider(color = ThesisColors.Border)

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXs)) {
                Text(
                    text = if (watchlistFeatureEnabled) "My Names" else "Names unavailable",
                    style = ThesisTypography.bodySmall,
                    color = ThesisColors.TextMuted
                )
                Text(
                    text = if (watchlistFeatureEnabled) "$watchlistCount tracked" else "Feature disabled",
                    style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.TextPrimary
                )
            }
            Column(
                horizontalAlignment = Alignment.End,
                verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXs)
            ) {
                Text(
                    text = "Deep Dives",
                    style = ThesisTypography.bodySmall,
                    color = ThesisColors.TextMuted
                )
                Text(
                    text = deepDiveLabel,
                    style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.TextPrimary
                )
            }
        }
    }
}

@Composable
private fun PortfolioTab(
    mode: PortfolioMode,
    onSetMode: (PortfolioMode) -> Unit,
    watchlistFeatureEnabled: Boolean,
    padding: PaddingValues,
    watchlist: List<String>,
    onRefreshWatchlist: () -> Unit,
    onAddWatchlistTicker: (String) -> Unit,
    onRemoveWatchlistTicker: (String) -> Unit,
    currentApiBaseUrl: String,
    profile: UserProfileView?,
    convictionInsights: List<ConvictionInsightCardView>,
    convictionInsightsError: String?,
    subscriptionOffers: List<com.thesis.mobile.model.SubscriptionOfferView>,
    subscriptionActionInFlight: Boolean,
    notificationsEnabled: Boolean,
    biometricSupported: Boolean,
    biometricLockEnabled: Boolean,
    notificationPreferences: List<NotificationPreferenceView>,
    onSetNotifications: (Boolean) -> Unit,
    onSetBiometricLockEnabled: (Boolean) -> Unit,
    onSetNotificationPreference: (String, Boolean) -> Unit,
    onSaveApiBaseUrl: (String) -> Unit,
    onSyncTier: () -> Unit,
    onRefreshConvictionInsights: () -> Unit,
    onRequireUpgrade: (String) -> Unit,
    onRefreshOffers: () -> Unit,
    onStartPurchase: (Activity, String?) -> Unit,
    onRestorePurchases: () -> Unit,
    onSubmitSubscriptionFeedback: (String, String, String, Boolean) -> Unit,
    onLogout: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding)
            .background(ThesisColors.Background)
    ) {
        profile?.let { profileView ->
            PortfolioSummaryCard(
                profile = profileView,
                watchlistCount = watchlist.size,
                watchlistFeatureEnabled = watchlistFeatureEnabled,
                modifier = Modifier.padding(
                    start = ThesisDimens.ScreenPaddingHorizontal,
                    end = ThesisDimens.ScreenPaddingHorizontal,
                    top = ThesisDimens.SpacingMd
                )
            )
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(
                    horizontal = ThesisDimens.ScreenPaddingHorizontal,
                    vertical = ThesisDimens.SpacingMd
                ),
            horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
        ) {
            if (watchlistFeatureEnabled) {
                SegmentButton(
                    label = "My Names",
                    isSelected = mode == PortfolioMode.MY_NAMES,
                    onClick = { onSetMode(PortfolioMode.MY_NAMES) }
                )
            }
            SegmentButton(
                label = "Settings",
                isSelected = mode == PortfolioMode.SETTINGS,
                onClick = { onSetMode(PortfolioMode.SETTINGS) }
            )
        }

        if (mode == PortfolioMode.MY_NAMES && watchlistFeatureEnabled) {
            WatchlistTab(
                padding = PaddingValues(),
                items = watchlist,
                onRefresh = onRefreshWatchlist,
                onAdd = onAddWatchlistTicker,
                onRemove = onRemoveWatchlistTicker
            )
        } else {
            SettingsTab(
                padding = PaddingValues(),
                currentApiBaseUrl = currentApiBaseUrl,
                profile = profile,
                convictionInsights = convictionInsights,
                convictionInsightsError = convictionInsightsError,
                subscriptionOffers = subscriptionOffers,
                subscriptionActionInFlight = subscriptionActionInFlight,
                notificationsEnabled = notificationsEnabled,
                biometricSupported = biometricSupported,
                biometricLockEnabled = biometricLockEnabled,
                notificationPreferences = notificationPreferences,
                onSetNotifications = onSetNotifications,
                onSetBiometricLockEnabled = onSetBiometricLockEnabled,
                onSetNotificationPreference = onSetNotificationPreference,
                onSaveApiBaseUrl = onSaveApiBaseUrl,
                onSyncTier = onSyncTier,
                onRefreshConvictionInsights = onRefreshConvictionInsights,
                onRequireUpgrade = onRequireUpgrade,
                onRefreshOffers = onRefreshOffers,
                onStartPurchase = onStartPurchase,
                onRestorePurchases = onRestorePurchases,
                onSubmitSubscriptionFeedback = onSubmitSubscriptionFeedback,
                onLogout = onLogout
            )
        }
    }
}

@Composable
private fun SegmentButton(
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
    Text(
        text = label,
        style = ThesisTypography.labelLarge.copy(
            fontWeight = if (isSelected) FontWeight.Medium else FontWeight.Normal
        ),
        color = if (isSelected) ThesisColors.Primary else ThesisColors.TextMuted,
        modifier = Modifier
            .clip(shape)
            .background(if (isSelected) ThesisColors.Primary.copy(alpha = 0.1f) else Color.Transparent)
            .border(
                ThesisDimens.BorderWidth,
                if (isSelected) ThesisColors.Primary.copy(alpha = 0.3f) else ThesisColors.Border,
                shape
            )
            .clickable(enabled = !isSelected) { onClick() }
            .padding(
                horizontal = ThesisDimens.SpacingMd,
                vertical = ThesisDimens.SpacingSm
            )
    )
}


@Composable
private fun AuthScreen(
    isLoading: Boolean,
    currentApiBaseUrl: String,
    verificationToken: String?,
    registerStatus: String?,
    message: String?,
    onSaveApiBaseUrl: (String) -> Unit,
    onRegister: (String, String) -> Unit,
    onVerify: (String) -> Unit,
    onLogin: (String, String) -> Unit
) {
    var apiBaseUrl by rememberSaveable(currentApiBaseUrl) { mutableStateOf(currentApiBaseUrl) }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var verifyToken by rememberSaveable { mutableStateOf(verificationToken ?: "") }
    var passwordVisible by rememberSaveable { mutableStateOf(false) }
    var isLoginMode by rememberSaveable { mutableStateOf(true) }
    var showApiConfig by rememberSaveable { mutableStateOf(false) }
    var showVerificationPanel by rememberSaveable {
        mutableStateOf(!verificationToken.isNullOrBlank() || !registerStatus.isNullOrBlank())
    }

    LaunchedEffect(verificationToken) {
        if (!verificationToken.isNullOrBlank()) {
            verifyToken = verificationToken
        }
    }

    LaunchedEffect(registerStatus, verificationToken) {
        if (!registerStatus.isNullOrBlank() || !verificationToken.isNullOrBlank()) {
            isLoginMode = false
            showVerificationPanel = true
        }
    }

    LaunchedEffect(message) {
        val normalized = message?.lowercase().orEmpty()
        if ("verified" in normalized) {
            isLoginMode = true
            showVerificationPanel = false
            verifyToken = ""
        }
    }

    val statusColor = when {
        message.isNullOrBlank() -> ThesisColors.TextMuted
        message.contains("success", ignoreCase = true) ||
            message.contains("verified", ignoreCase = true) ||
            message.contains("saved", ignoreCase = true) ||
            message.contains("created", ignoreCase = true) -> ThesisColors.SignalPositive
        else -> ThesisColors.SignalNegative
    }

    val tfShape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
    val tfColors = OutlinedTextFieldDefaults.colors(
        focusedContainerColor = ThesisColors.Surface,
        unfocusedContainerColor = ThesisColors.Surface,
        focusedBorderColor = ThesisColors.Primary,
        unfocusedBorderColor = ThesisColors.Border,
        focusedTextColor = ThesisColors.TextPrimary,
        unfocusedTextColor = ThesisColors.TextPrimary,
        cursorColor = ThesisColors.Primary,
        focusedLabelColor = ThesisColors.Primary,
        unfocusedLabelColor = ThesisColors.TextMuted,
        focusedPlaceholderColor = ThesisColors.TextMuted.copy(alpha = 0.6f),
        unfocusedPlaceholderColor = ThesisColors.TextMuted.copy(alpha = 0.6f)
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ThesisColors.Background)
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 24.dp, vertical = 48.dp),
            verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingLg),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            item {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(top = 32.dp, bottom = 16.dp)
                ) {
                    Text(
                        text = "Thesis",
                        style = ThesisTypography.displayLarge.copy(
                            fontFamily = HeadingFont,
                            fontSize = 36.sp,
                            fontWeight = FontWeight.Normal,
                            letterSpacing = (-1).sp
                        ),
                        color = ThesisColors.TextPrimary
                    )
                    Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                    Text(
                        text = "Financial intelligence",
                        style = ThesisTypography.bodyLarge,
                        color = ThesisColors.TextMuted
                    )
                }
            }

            item {
                AuthValueCard()
            }

            item {
                Column {
                    Text(
                        text = "CONFIGURE API",
                        style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                        color = ThesisColors.Primary,
                        modifier = Modifier.clickable { showApiConfig = !showApiConfig }
                    )
                    if (showApiConfig) {
                        Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                        OutlinedTextField(
                            value = apiBaseUrl,
                            onValueChange = { apiBaseUrl = it },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("API Base URL") },
                            singleLine = true,
                            shape = tfShape,
                            colors = tfColors
                        )
                        Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                        Button(
                            onClick = { onSaveApiBaseUrl(apiBaseUrl) },
                            enabled = !isLoading,
                            shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                            colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                                containerColor = ThesisColors.SurfaceElevated,
                                contentColor = ThesisColors.TextPrimary
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(44.dp)
                        ) {
                            Text("Save URL", style = ThesisTypography.labelLarge)
                        }
                    }
                }
            }

            item {
                Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)) {
                    Text(
                        text = "EMAIL",
                        style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                        color = ThesisColors.TextMuted
                    )
                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("you@example.com", color = ThesisColors.TextMuted.copy(alpha = 0.5f)) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        singleLine = true,
                        shape = tfShape,
                        colors = tfColors
                    )
                    Text(
                        text = "PASSWORD",
                        style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                        color = ThesisColors.TextMuted
                    )
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Enter password", color = ThesisColors.TextMuted.copy(alpha = 0.5f)) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        singleLine = true,
                        shape = tfShape,
                        colors = tfColors,
                        visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        trailingIcon = {
                            IconButton(onClick = { passwordVisible = !passwordVisible }) {
                                Icon(
                                    imageVector = if (passwordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                    contentDescription = null,
                                    tint = ThesisColors.TextMuted
                                )
                            }
                        }
                    )
                }
            }

            item {
                Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)) {
                    if (isLoginMode) {
                        Button(
                            onClick = { onLogin(email, password) },
                            enabled = !isLoading && email.isNotBlank() && password.isNotBlank(),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp),
                            shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                            colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                                containerColor = ThesisColors.Primary,
                                contentColor = ThesisColors.TextInverse,
                                disabledContainerColor = ThesisColors.Primary.copy(alpha = 0.3f)
                            )
                        ) {
                            if (isLoading) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(20.dp),
                                    color = ThesisColors.TextInverse,
                                    strokeWidth = 2.dp
                                )
                            } else {
                                Text(
                                    text = "Log In",
                                    style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium)
                                )
                            }
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Text(
                                text = "Don't have an account? ",
                                style = ThesisTypography.bodyMedium,
                                color = ThesisColors.TextMuted
                            )
                            Text(
                                text = "Register",
                                style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                                color = ThesisColors.Primary,
                                modifier = Modifier.clickable { isLoginMode = false }
                            )
                        }
                    } else {
                        Button(
                            onClick = { onRegister(email, password) },
                            enabled = !isLoading && email.isNotBlank() && password.isNotBlank(),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp),
                            shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                            colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                                containerColor = ThesisColors.Primary,
                                contentColor = ThesisColors.TextInverse,
                                disabledContainerColor = ThesisColors.Primary.copy(alpha = 0.3f)
                            )
                        ) {
                            Text(
                                text = "Register",
                                style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium)
                            )
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Text(
                                text = "Already have an account? ",
                                style = ThesisTypography.bodyMedium,
                                color = ThesisColors.TextMuted
                            )
                            Text(
                                text = "Log in",
                                style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                                color = ThesisColors.Primary,
                                modifier = Modifier.clickable { isLoginMode = true }
                            )
                        }
                    }
                }
            }

            if (!registerStatus.isNullOrBlank()) {
                item {
                    Text(
                        text = "Status: $registerStatus",
                        style = ThesisTypography.bodySmall,
                        color = ThesisColors.Primary
                    )
                }
            }
            if (!message.isNullOrBlank()) {
                item {
                    Text(
                        text = message,
                        style = ThesisTypography.bodySmall,
                        color = statusColor,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            if (showVerificationPanel) {
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
                        HorizontalDivider(color = ThesisColors.Border)
                        Text(
                            text = "VERIFY ACCOUNT",
                            style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                            color = ThesisColors.TextMuted
                        )
                        OutlinedTextField(
                            value = verifyToken,
                            onValueChange = { verifyToken = it },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("Verification token") },
                            singleLine = true,
                            shape = tfShape,
                            colors = tfColors
                        )
                        Button(
                            onClick = { onVerify(verifyToken) },
                            enabled = !isLoading,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(44.dp),
                            shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                            colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                                containerColor = ThesisColors.SurfaceElevated,
                                contentColor = ThesisColors.TextPrimary
                            )
                        ) {
                            Text("Verify Account")
                        }
                    }
                }
            }

            item {
                Spacer(modifier = Modifier.height(32.dp))
                Text(
                    text = "THIS IS A RESEARCH TOOL, NOT FINANCIAL ADVICE",
                    style = ThesisTypography.labelSmall,
                    color = ThesisColors.TextMuted.copy(alpha = 0.3f),
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

@Composable
private fun AuthValueCard() {
    val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(ThesisColors.Surface)
            .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
            .padding(ThesisDimens.CardPadding),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
    ) {
        Text(
            text = "WHAT YOU GET",
            style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.TextMuted
        )
        AuthBenefitRow(
            icon = Icons.Default.Newspaper,
            title = "Morning Pulse",
            description = "What moved overnight before markets open."
        )
        HorizontalDivider(color = ThesisColors.Border)
        AuthBenefitRow(
            icon = Icons.Default.Search,
            title = "Deep Dive",
            description = "Evidence-backed research on any US company."
        )
        HorizontalDivider(color = ThesisColors.Border)
        AuthBenefitRow(
            icon = Icons.Default.AutoAwesome,
            title = "My Names",
            description = "Follow what matters across everything."
        )
    }
}

@Composable
private fun AuthBenefitRow(
    icon: ImageVector,
    title: String,
    description: String
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd),
        verticalAlignment = Alignment.Top
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = ThesisColors.Primary,
            modifier = Modifier.padding(top = 2.dp)
        )
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXs)
        ) {
            Text(
                text = title,
                style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                color = ThesisColors.TextPrimary
            )
            Text(
                text = description,
                style = ThesisTypography.bodySmall,
                color = ThesisColors.TextMuted
            )
        }
    }
}

@Composable
private fun UpgradeRequiredDialog(
    feature: String?,
    subscriptionOffers: List<com.thesis.mobile.model.SubscriptionOfferView>,
    subscriptionActionInFlight: Boolean,
    onDismiss: () -> Unit,
    onSyncTier: () -> Unit,
    onStartPurchase: (String?) -> Unit,
    onRestorePurchases: () -> Unit,
    onRefreshOffers: () -> Unit
) {
    val normalizedFeature = feature?.replace("_", " ") ?: "premium feature"
    AlertDialog(
        containerColor = ThesisColors.Surface,
        titleContentColor = ThesisColors.TextPrimary,
        textContentColor = ThesisColors.TextSecondary,
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "Upgrade to Pro",
                style = ThesisTypography.headlineLarge.copy(
                    fontFamily = HeadingFont,
                    fontWeight = FontWeight.Normal
                )
            )
        },
        text = {
            Text(
                "$normalizedFeature requires Pro. If you already upgraded, tap refresh below.",
                style = ThesisTypography.bodyMedium
            )
        },
        confirmButton = {
            Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXs)) {
                Button(
                    onClick = { onStartPurchase("MONTHLY") },
                    enabled = subscriptionOffers.any { it.packageType == "MONTHLY" } && !subscriptionActionInFlight,
                    shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                        containerColor = ThesisColors.Primary,
                        contentColor = ThesisColors.TextInverse
                    )
                ) {
                    Text("Monthly")
                }
                Button(
                    onClick = { onStartPurchase("YEARLY") },
                    enabled = subscriptionOffers.any { it.packageType == "ANNUAL" } && !subscriptionActionInFlight,
                    shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                        containerColor = ThesisColors.Primary,
                        contentColor = ThesisColors.TextInverse
                    )
                ) {
                    Text("Yearly")
                }
                TextButton(
                    onClick = onRestorePurchases,
                    enabled = !subscriptionActionInFlight
                ) {
                    Text("Restore", color = ThesisColors.Primary)
                }
            }
        },
        dismissButton = {
            Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXs)) {
                TextButton(onClick = onRefreshOffers) {
                    Text("Refresh offers", color = ThesisColors.TextMuted)
                }
                TextButton(onClick = onSyncTier) {
                    Text("I upgraded", color = ThesisColors.Primary)
                }
                TextButton(onClick = onDismiss) {
                    Text("Not now", color = ThesisColors.TextMuted)
                }
            }
        }
    )
}

@Composable
private fun PulseTab(
    padding: PaddingValues,
    pulse: PulseReportView?,
    onRefresh: () -> Unit,
    onLoadByDate: (String) -> Unit
) {
    var dateInput by rememberSaveable { mutableStateOf("") }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Text("Market Pulse", style = MaterialTheme.typography.headlineSmall)
            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onRefresh) { Text("Refresh Latest Pulse") }
            }
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(
                value = dateInput,
                onValueChange = { dateInput = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Load by date (YYYY-MM-DD)") }
            )
            Spacer(modifier = Modifier.height(8.dp))
            Button(onClick = { onLoadByDate(dateInput) }) { Text("Load Historical Pulse") }
        }

        if (pulse == null) {
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        "No pulse loaded yet. Tap refresh.",
                        modifier = Modifier.padding(14.dp)
                    )
                }
            }
        } else {
            item {
                Text("Generated at: ${pulse.generatedAt}", style = MaterialTheme.typography.bodySmall)
            }
            items(pulse.sections) { section ->
                SectionCard(section)
            }
        }
    }
}

@Composable
private fun DeepDiveTab(
    padding: PaddingValues,
    report: DeepDiveReportView?,
    history: List<ReportHistoryItem>,
    tickers: List<com.thesis.mobile.model.TickerSearchItem>,
    selectedTicker: String?,
    jobStatus: String?,
    onSearch: (String) -> Unit,
    onSelectTicker: (String) -> Unit,
    onRun: () -> Unit,
    onRefreshHistory: () -> Unit,
    onOpenHistoryReport: (String) -> Unit
) {
    var query by rememberSaveable { mutableStateOf("") }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Text("Company Deep Dive", style = MaterialTheme.typography.headlineSmall)
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Search ticker/company") }
            )
            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { onSearch(query) }) { Text("Search") }
                Button(onClick = onRun, enabled = !selectedTicker.isNullOrBlank()) { Text("Run Deep Dive") }
            }
            if (!selectedTicker.isNullOrBlank()) {
                Text("Selected: $selectedTicker")
            }
            if (!jobStatus.isNullOrBlank()) {
                Text("Job status: $jobStatus")
            }
        }

        if (tickers.isNotEmpty()) {
            item { Text("Search Results", fontWeight = FontWeight.Bold) }
            items(tickers) { ticker ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text("${ticker.symbol} - ${ticker.companyName}")
                        Text(ticker.exchange, style = MaterialTheme.typography.bodySmall)
                        Spacer(modifier = Modifier.height(8.dp))
                        AssistChip(
                            onClick = { onSelectTicker(ticker.symbol) },
                            label = { Text("Select ${ticker.symbol}") }
                        )
                    }
                }
            }
        }

        item {
            HorizontalDivider()
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Report History", fontWeight = FontWeight.Bold)
                Button(onClick = onRefreshHistory) { Text("Refresh") }
            }
        }

        if (history.isEmpty()) {
            item { Text("No prior reports yet.") }
        } else {
            items(history.filter { it.type == "deep_dive" }.take(15)) { item ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text("${item.ticker ?: "Ticker N/A"} - ${item.createdAt}")
                        Spacer(modifier = Modifier.height(8.dp))
                        AssistChip(
                            onClick = { onOpenHistoryReport(item.reportId) },
                            label = { Text("Open report") }
                        )
                    }
                }
            }
        }

        if (report != null) {
            item {
                HorizontalDivider()
                Text("Deep Dive Report: ${report.ticker ?: "N/A"}", fontWeight = FontWeight.Bold)
                Text("Signal: ${report.signalValue ?: "no_signal"}")
                Text("Confidence: ${report.confidenceLabel ?: "unknown"} (${report.confidenceScore ?: 0.0})")
            }
            items(report.sections) { section ->
                SectionCard(section)
            }
        }
    }
}

@Composable
private fun WatchlistTab(
    padding: PaddingValues,
    items: List<String>,
    onRefresh: () -> Unit,
    onAdd: (String) -> Unit,
    onRemove: (String) -> Unit
) {
    var tickerInput by rememberSaveable { mutableStateOf("") }
    val tfColors = OutlinedTextFieldDefaults.colors(
        focusedContainerColor = ThesisColors.Surface,
        unfocusedContainerColor = ThesisColors.Surface,
        focusedBorderColor = ThesisColors.Primary,
        unfocusedBorderColor = ThesisColors.Border,
        focusedTextColor = ThesisColors.TextPrimary,
        unfocusedTextColor = ThesisColors.TextPrimary,
        cursorColor = ThesisColors.Primary,
        focusedLabelColor = ThesisColors.Primary,
        unfocusedLabelColor = ThesisColors.TextMuted
    )

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding)
            .background(ThesisColors.Background),
        contentPadding = PaddingValues(
            horizontal = ThesisDimens.ScreenPaddingHorizontal,
            vertical = ThesisDimens.SpacingLg
        ),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)
    ) {
        item {
            Text(
                text = "My Names",
                style = ThesisTypography.headlineLarge.copy(
                    fontFamily = HeadingFont,
                    fontWeight = FontWeight.Normal
                ),
                color = ThesisColors.TextPrimary
            )
            Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
            Text(
                text = "Track up to 20 companies across Thesis.",
                style = ThesisTypography.bodyMedium,
                color = ThesisColors.TextMuted
            )
        }
        item {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
            ) {
                OutlinedTextField(
                    value = tickerInput,
                    onValueChange = { tickerInput = it.uppercase() },
                    modifier = Modifier.weight(1f),
                    label = { Text("Ticker") },
                    singleLine = true,
                    shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                    colors = tfColors
                )
                Button(
                    onClick = {
                        if (tickerInput.isNotBlank()) {
                            onAdd(tickerInput)
                            tickerInput = ""
                        }
                    },
                    shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                        containerColor = ThesisColors.Primary,
                        contentColor = ThesisColors.TextInverse
                    ),
                    modifier = Modifier.height(52.dp)
                ) {
                    Text("Add")
                }
            }
        }

        if (items.isEmpty()) {
            item {
                val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(shape)
                        .background(ThesisColors.Surface)
                        .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
                        .padding(ThesisDimens.CardPadding)
                ) {
                    Text(
                        text = "No names tracked yet. Add a ticker above.",
                        style = ThesisTypography.bodyMedium,
                        color = ThesisColors.TextMuted
                    )
                }
            }
        } else {
            item {
                val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(shape)
                        .background(ThesisColors.Surface)
                        .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
                ) {
                    items.forEachIndexed { index, ticker ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(
                                    horizontal = ThesisDimens.CardPadding,
                                    vertical = ThesisDimens.SpacingLg
                                ),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = ticker,
                                style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                                color = ThesisColors.TextPrimary
                            )
                            Text(
                                text = "REMOVE",
                                style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                                color = ThesisColors.SignalNegative,
                                modifier = Modifier.clickable { onRemove(ticker) }
                            )
                        }
                        if (index < items.lastIndex) {
                            HorizontalDivider(
                                color = ThesisColors.Border,
                                thickness = ThesisDimens.BorderWidth,
                                modifier = Modifier.padding(horizontal = ThesisDimens.CardPadding)
                            )
                        }
                    }
                }
            }
        }
        item {
            OutlinedButton(
                onClick = onRefresh,
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                border = androidx.compose.foundation.BorderStroke(
                    ThesisDimens.BorderWidth,
                    ThesisColors.Border
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(44.dp)
            ) {
                Text("Refresh Watchlist", color = ThesisColors.TextMuted)
            }
        }
    }
}

@Composable
private fun SettingsTab(
    padding: PaddingValues,
    currentApiBaseUrl: String,
    profile: UserProfileView?,
    convictionInsights: List<ConvictionInsightCardView>,
    convictionInsightsError: String?,
    subscriptionOffers: List<com.thesis.mobile.model.SubscriptionOfferView>,
    subscriptionActionInFlight: Boolean,
    notificationsEnabled: Boolean,
    biometricSupported: Boolean,
    biometricLockEnabled: Boolean,
    notificationPreferences: List<NotificationPreferenceView>,
    onSetNotifications: (Boolean) -> Unit,
    onSetBiometricLockEnabled: (Boolean) -> Unit,
    onSetNotificationPreference: (String, Boolean) -> Unit,
    onSaveApiBaseUrl: (String) -> Unit,
    onSyncTier: () -> Unit,
    onRefreshConvictionInsights: () -> Unit,
    onRequireUpgrade: (String) -> Unit,
    onRefreshOffers: () -> Unit,
    onStartPurchase: (Activity, String?) -> Unit,
    onRestorePurchases: () -> Unit,
    onSubmitSubscriptionFeedback: (String, String, String, Boolean) -> Unit,
    onLogout: () -> Unit
) {
    val context = LocalContext.current
    val activity = context as? Activity
    var baseUrl by rememberSaveable(currentApiBaseUrl) { mutableStateOf(currentApiBaseUrl) }
    var subscriptionFeedbackFlow by rememberSaveable { mutableStateOf("cancel") }
    var subscriptionFeedbackCode by rememberSaveable { mutableStateOf("cancel_price") }
    var subscriptionFeedbackMessage by rememberSaveable { mutableStateOf("") }
    val switchColors = androidx.compose.material3.SwitchDefaults.colors(
        checkedThumbColor = ThesisColors.Primary,
        checkedTrackColor = ThesisColors.Primary.copy(alpha = 0.2f),
        uncheckedThumbColor = ThesisColors.TextMuted,
        uncheckedTrackColor = ThesisColors.SurfaceElevated
    )

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding)
            .background(ThesisColors.Background),
        contentPadding = PaddingValues(
            horizontal = ThesisDimens.ScreenPaddingHorizontal,
            vertical = ThesisDimens.SpacingLg
        ),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXl)
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXs)) {
                Text(
                    text = Phase4Copy.youHeadline,
                    style = ThesisTypography.headlineLarge.copy(
                        fontFamily = HeadingFont,
                        fontWeight = FontWeight.Normal
                    ),
                    color = ThesisColors.TextPrimary
                )
                Text(
                    text = Phase4Copy.youSubtitle,
                    style = ThesisTypography.bodyMedium,
                    color = ThesisColors.TextMuted
                )
            }
        }
        item {
            MonthlyCoherenceSection(
                isPro = profile?.tier.equals("PRO", ignoreCase = true),
                insights = convictionInsights,
                errorMessage = convictionInsightsError,
                onRefresh = onRefreshConvictionInsights,
                onRequireUpgrade = onRequireUpgrade
            )
        }
        item {
            val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(shape)
                    .background(ThesisColors.Surface)
                    .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
                    .padding(ThesisDimens.CardPadding),
                verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
            ) {
                Text(
                    text = "DATA TRUST",
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.TextMuted
                )
                Text(
                    text = "Freshness and degraded-feed warnings stay visible across Today, Names, Research, and Inbox. Thesis marks missing evidence instead of inventing certainty.",
                    style = ThesisTypography.bodyMedium,
                    color = ThesisColors.TextPrimary
                )
            }
        }
        item {
            val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(shape)
                    .background(ThesisColors.Surface)
                    .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
                    .padding(ThesisDimens.CardPadding),
                verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
            ) {
                Text(
                    text = "NOTIFICATIONS",
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.TextMuted
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Push Notifications",
                        style = ThesisTypography.bodyMedium,
                        color = ThesisColors.TextPrimary
                    )
                    Switch(
                        checked = notificationsEnabled,
                        onCheckedChange = onSetNotifications,
                        colors = switchColors
                    )
                }

                if (biometricSupported) {
                    HorizontalDivider(color = ThesisColors.Border)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Biometric Lock",
                                style = ThesisTypography.bodyMedium,
                                color = ThesisColors.TextPrimary
                            )
                            Text(
                                text = "Require fingerprint after 5 min idle",
                                style = ThesisTypography.bodySmall,
                                color = ThesisColors.TextMuted
                            )
                        }
                        Switch(
                            checked = biometricLockEnabled,
                            onCheckedChange = onSetBiometricLockEnabled,
                            colors = switchColors
                        )
                    }
                }

                if (notificationsEnabled) {
                    HorizontalDivider(color = ThesisColors.Border)
                    notificationPreferences.forEach { preference ->
                        NotificationPreferenceRow(
                            type = preference.type,
                            enabled = preference.enabled,
                            quietUntil = preference.quietUntil,
                            notificationsEnabled = notificationsEnabled,
                            onToggle = { enabled -> onSetNotificationPreference(preference.type, enabled) },
                            switchColors = switchColors
                        )
                    }
                }

                Button(
                    onClick = {
                        val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                            putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                        }
                        context.startActivity(intent)
                    },
                    shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                        containerColor = ThesisColors.SurfaceElevated,
                        contentColor = ThesisColors.TextMuted
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(40.dp)
                ) {
                    Text("System Notification Settings", style = ThesisTypography.labelLarge)
                }
            }
        }
        item {
            val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(shape)
                    .background(ThesisColors.Surface)
                    .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
                    .padding(ThesisDimens.CardPadding),
                verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)
            ) {
                Text(
                    text = "SUBSCRIPTION",
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.TextMuted
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Tier", style = ThesisTypography.bodyMedium, color = ThesisColors.TextPrimary)
                    Text(
                        text = profile?.tier ?: "FREE",
                        style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                        color = ThesisColors.Primary,
                        modifier = Modifier
                            .clip(RoundedCornerShape(ThesisDimens.SignalBadgeCorner))
                            .background(ThesisColors.Primary.copy(alpha = 0.1f))
                            .padding(horizontal = ThesisDimens.SpacingSm, vertical = ThesisDimens.SpacingXs)
                    )
                }
                val deepDiveLimit = profile?.dailyDeepDiveLimit ?: 1
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Deep Dives", style = ThesisTypography.bodyMedium, color = ThesisColors.TextPrimary)
                    Text(
                        if (deepDiveLimit < 0) "Unlimited" else "${profile?.deepDivesRemainingToday ?: 0} / $deepDiveLimit today",
                        style = ThesisTypography.bodySmall,
                        color = ThesisColors.TextMuted
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Names limit", style = ThesisTypography.bodyMedium, color = ThesisColors.TextPrimary)
                    Text("${profile?.watchlistLimit ?: 5}", style = ThesisTypography.bodySmall, color = ThesisColors.TextMuted)
                }
                if (!profile?.billingPeriodEnd.isNullOrBlank()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Billing period end", style = ThesisTypography.bodyMedium, color = ThesisColors.TextPrimary)
                        Text(profile?.billingPeriodEnd ?: "", style = ThesisTypography.bodySmall, color = ThesisColors.TextMuted)
                    }
                }
                HorizontalDivider(color = ThesisColors.Border)
                Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
                    Button(
                        onClick = { if (activity != null) onStartPurchase(activity, "MONTHLY") },
                        enabled = activity != null && !subscriptionActionInFlight,
                        modifier = Modifier.weight(1f).height(40.dp),
                        shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                        colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                            containerColor = ThesisColors.Primary,
                            contentColor = ThesisColors.TextInverse
                        )
                    ) {
                        Text("Monthly", style = ThesisTypography.labelLarge)
                    }
                    Button(
                        onClick = { if (activity != null) onStartPurchase(activity, "YEARLY") },
                        enabled = activity != null && !subscriptionActionInFlight,
                        modifier = Modifier.weight(1f).height(40.dp),
                        shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                        colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                            containerColor = ThesisColors.Primary,
                            contentColor = ThesisColors.TextInverse
                        )
                    ) {
                        Text("Yearly", style = ThesisTypography.labelLarge)
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
                    OutlinedButton(
                        onClick = onSyncTier,
                        enabled = !subscriptionActionInFlight,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                        border = androidx.compose.foundation.BorderStroke(
                            ThesisDimens.BorderWidth,
                            ThesisColors.Border
                        )
                    ) {
                        Text("Refresh", color = ThesisColors.TextMuted)
                    }
                    OutlinedButton(
                        onClick = onRestorePurchases,
                        enabled = !subscriptionActionInFlight,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                        border = androidx.compose.foundation.BorderStroke(
                            ThesisDimens.BorderWidth,
                            ThesisColors.Border
                        )
                    ) {
                        Text("Restore", color = ThesisColors.TextMuted)
                    }
                }
                if (subscriptionOffers.isNotEmpty()) {
                    Text(
                        text = "Available offers: ${subscriptionOffers.joinToString { it.title }}",
                        style = ThesisTypography.bodySmall,
                        color = ThesisColors.TextMuted
                    )
                }
                TextButton(onClick = onRefreshOffers, enabled = !subscriptionActionInFlight) {
                    Text("Refresh offers", color = ThesisColors.Primary)
                }

                HorizontalDivider(color = ThesisColors.Border)
                Text(
                    text = "FEEDBACK",
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.TextMuted
                )
                Text(
                    text = "Tell us why you might cancel or downgrade so we can improve the Pro value.",
                    style = ThesisTypography.bodySmall,
                    color = ThesisColors.TextMuted
                )
                Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
                    OutlinedButton(
                        onClick = { subscriptionFeedbackFlow = "cancel" },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                        border = androidx.compose.foundation.BorderStroke(
                            ThesisDimens.BorderWidth,
                            if (subscriptionFeedbackFlow == "cancel") ThesisColors.Primary else ThesisColors.Border
                        )
                    ) {
                        Text(
                            "Cancel",
                            color = if (subscriptionFeedbackFlow == "cancel") ThesisColors.Primary else ThesisColors.TextMuted
                        )
                    }
                    OutlinedButton(
                        onClick = { subscriptionFeedbackFlow = "downgrade" },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                        border = androidx.compose.foundation.BorderStroke(
                            ThesisDimens.BorderWidth,
                            if (subscriptionFeedbackFlow == "downgrade") ThesisColors.Primary else ThesisColors.Border
                        )
                    ) {
                        Text(
                            "Downgrade",
                            color = if (subscriptionFeedbackFlow == "downgrade") ThesisColors.Primary else ThesisColors.TextMuted
                        )
                    }
                }

                val feedbackOptions = listOf(
                    "cancel_price" to "Price",
                    "cancel_low_value" to "Low value",
                    "cancel_too_noisy" to "Too noisy",
                    "cancel_other" to "Other"
                )
                Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
                    feedbackOptions.take(2).forEach { (code, label) ->
                        OutlinedButton(
                            onClick = { subscriptionFeedbackCode = code },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                            border = androidx.compose.foundation.BorderStroke(
                                ThesisDimens.BorderWidth,
                                if (subscriptionFeedbackCode == code) ThesisColors.Primary else ThesisColors.Border
                            )
                        ) {
                            Text(
                                label,
                                color = if (subscriptionFeedbackCode == code) ThesisColors.Primary else ThesisColors.TextMuted
                            )
                        }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
                    feedbackOptions.drop(2).forEach { (code, label) ->
                        OutlinedButton(
                            onClick = { subscriptionFeedbackCode = code },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                            border = androidx.compose.foundation.BorderStroke(
                                ThesisDimens.BorderWidth,
                                if (subscriptionFeedbackCode == code) ThesisColors.Primary else ThesisColors.Border
                            )
                        ) {
                            Text(
                                label,
                                color = if (subscriptionFeedbackCode == code) ThesisColors.Primary else ThesisColors.TextMuted
                            )
                        }
                    }
                }

                OutlinedTextField(
                    value = subscriptionFeedbackMessage,
                    onValueChange = { subscriptionFeedbackMessage = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Optional context") },
                    minLines = 2,
                    maxLines = 4,
                    shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = ThesisColors.SurfaceElevated,
                        unfocusedContainerColor = ThesisColors.SurfaceElevated,
                        focusedBorderColor = ThesisColors.Primary,
                        unfocusedBorderColor = ThesisColors.Border,
                        focusedTextColor = ThesisColors.TextPrimary,
                        unfocusedTextColor = ThesisColors.TextPrimary,
                        cursorColor = ThesisColors.Primary,
                        focusedLabelColor = ThesisColors.Primary,
                        unfocusedLabelColor = ThesisColors.TextMuted
                    )
                )

                Button(
                    onClick = {
                        onSubmitSubscriptionFeedback(
                            subscriptionFeedbackCode,
                            "settings_subscription_${subscriptionFeedbackFlow}",
                            subscriptionFeedbackMessage,
                            true
                        )
                        subscriptionFeedbackMessage = ""
                    },
                    enabled = !subscriptionActionInFlight,
                    shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                        containerColor = ThesisColors.SurfaceElevated,
                        contentColor = ThesisColors.TextPrimary
                    ),
                    modifier = Modifier.fillMaxWidth().height(40.dp)
                ) {
                    Text("Submit Feedback", style = ThesisTypography.labelLarge)
                }
            }
        }
        item {
            val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(shape)
                    .background(ThesisColors.Surface)
                    .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
                    .padding(ThesisDimens.CardPadding),
                verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
            ) {
                Text(
                    text = "DEVELOPER",
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.TextMuted
                )
                OutlinedTextField(
                    value = baseUrl,
                    onValueChange = { baseUrl = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("API Base URL") },
                    singleLine = true,
                    shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = ThesisColors.SurfaceElevated,
                        unfocusedContainerColor = ThesisColors.SurfaceElevated,
                        focusedBorderColor = ThesisColors.Primary,
                        unfocusedBorderColor = ThesisColors.Border,
                        focusedTextColor = ThesisColors.TextPrimary,
                        unfocusedTextColor = ThesisColors.TextPrimary,
                        cursorColor = ThesisColors.Primary,
                        focusedLabelColor = ThesisColors.Primary,
                        unfocusedLabelColor = ThesisColors.TextMuted
                    )
                )
                Button(
                    onClick = { onSaveApiBaseUrl(baseUrl) },
                    shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                        containerColor = ThesisColors.SurfaceElevated,
                        contentColor = ThesisColors.TextPrimary
                    ),
                    modifier = Modifier.fillMaxWidth().height(40.dp)
                ) {
                    Text("Save API URL")
                }
            }
        }
        item {
            val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(shape)
                    .background(ThesisColors.Surface)
                    .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
                    .padding(ThesisDimens.CardPadding),
                verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
            ) {
                Text(
                    text = "ABOUT",
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.TextMuted
                )
                Text(
                    text = "This is a research summary, not financial advice. Always do your own research.",
                    style = ThesisTypography.bodyMedium,
                    color = ThesisColors.TextPrimary
                )
            }
        }
        item {
            Button(
                onClick = onLogout,
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                    containerColor = ThesisColors.SignalNegative.copy(alpha = 0.16f),
                    contentColor = ThesisColors.SignalNegative
                ),
                modifier = Modifier.fillMaxWidth().height(44.dp)
            ) {
                Text("Logout")
            }
        }
    }
}

@Composable
private fun NotificationPreferenceRow(
    type: String,
    enabled: Boolean,
    quietUntil: String?,
    notificationsEnabled: Boolean,
    onToggle: (Boolean) -> Unit,
    switchColors: androidx.compose.material3.SwitchColors
) {
    val label = Phase4Copy.notificationFamilyLabel(type)
    val quietUntilLabel = quietUntil?.let(::formatNotificationQuietUntil)

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(label, style = ThesisTypography.bodyMedium, color = ThesisColors.TextPrimary)
            if (!notificationsEnabled) {
                Text(
                    Phase4Copy.notificationGlobalOffNote,
                    style = ThesisTypography.bodySmall,
                    color = ThesisColors.TextMuted
                )
            } else if (enabled && quietUntilLabel != null) {
                Text(
                    Phase4Copy.notificationQuietUntilNote(quietUntilLabel),
                    style = ThesisTypography.bodySmall,
                    color = ThesisColors.TextMuted
                )
            }
        }
        Switch(
            checked = enabled,
            onCheckedChange = onToggle,
            colors = switchColors
        )
    }
}

private fun formatNotificationQuietUntil(raw: String): String? {
    val parsed = runCatching { Instant.parse(raw) }.getOrNull() ?: return null
    if (!parsed.isAfter(Instant.now())) {
        return null
    }
    return parsed
        .atZone(ZoneId.of("America/New_York"))
        .format(DateTimeFormatter.ofPattern("MMM d, HH:mm z"))
}

@Composable
private fun SectionCard(section: SectionView) {
    val uriHandler = LocalUriHandler.current
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(section.title, fontWeight = FontWeight.Bold)
            if (!section.status.isNullOrBlank()) {
                Text("Status: ${section.status}", style = MaterialTheme.typography.bodySmall)
            }
            Spacer(modifier = Modifier.height(6.dp))
            Text(section.body)

            if (section.evidence.isNotEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text("Evidence", fontWeight = FontWeight.SemiBold)
                section.evidence.forEach { evidence ->
                    EvidenceRow(evidence = evidence, onOpen = { url ->
                        uriHandler.openUri(url)
                    })
                }
            }
        }
    }
}

@Composable
private fun EvidenceRow(
    evidence: EvidenceView,
    onOpen: (String) -> Unit
) {
    Column(modifier = Modifier.padding(top = 4.dp)) {
        Text("• ${evidence.sourceName}", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Medium)
        if (evidence.excerpt.isNotBlank()) {
            Text(evidence.excerpt, style = MaterialTheme.typography.bodySmall)
        }
        if (!evidence.url.isNullOrBlank()) {
            AssistChip(
                onClick = { onOpen(evidence.url) },
                label = { Text("Open Source") }
            )
        }
    }
}
