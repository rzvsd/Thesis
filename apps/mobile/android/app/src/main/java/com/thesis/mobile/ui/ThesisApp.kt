package com.thesis.mobile.ui

import android.app.Activity
import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.thesis.mobile.LaunchTarget
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.EvidenceView
import com.thesis.mobile.model.NotificationPreferenceView
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.model.SectionView
import com.thesis.mobile.model.UserProfileView
import com.thesis.mobile.ui.screens.DeepDiveScreen
import com.thesis.mobile.ui.screens.HistoryScreen
import com.thesis.mobile.ui.screens.HomeScreen
import com.thesis.mobile.ui.screens.WelcomeScreen
import com.thesis.mobile.ui.theme.ThesisTheme
import androidx.compose.material.icons.filled.History

private enum class ResearchMode {
    DEEP_DIVE,
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
    val snackbarHostState = remember { SnackbarHostState() }
    var researchMode by rememberSaveable { mutableStateOf(ResearchMode.DEEP_DIVE) }
    var portfolioMode by rememberSaveable { mutableStateOf(PortfolioMode.MY_NAMES) }

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
            "pulse" -> mainViewModel.openPulseFromNotification(target.pulseDate)
            "deep_dive" -> {
                val ticker = target.ticker?.trim().orEmpty()
                if (ticker.isNotBlank()) {
                    mainViewModel.selectTicker(ticker)
                }
                researchMode = ResearchMode.DEEP_DIVE
                mainViewModel.setTab(AppTab.RESEARCH)
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
            WelcomeScreen(
                onContinue = mainViewModel::completeWelcome,
                onLoginClick = mainViewModel::completeWelcome
            )
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

        val visibleTabs = remember { listOf(TabItem.Today, TabItem.Research, TabItem.Portfolio) }

        Scaffold(
            snackbarHost = { SnackbarHost(snackbarHostState) },
            bottomBar = {
                NavigationBar {
                    visibleTabs.forEach { tab ->
                        NavigationBarItem(
                            selected = uiState.currentTab == tab.target,
                            onClick = {
                                if (tab.target == AppTab.RESEARCH) {
                                    researchMode = ResearchMode.DEEP_DIVE
                                }
                                if (tab.target == AppTab.PORTFOLIO && !uiState.watchlistFeatureEnabled) {
                                    portfolioMode = PortfolioMode.SETTINGS
                                }
                                mainViewModel.setTab(tab.target)
                            },
                            icon = { Icon(tab.icon, contentDescription = tab.label) },
                            label = { Text(tab.label) }
                        )
                    }
                }
            }
        ) { padding ->
            if (uiState.isLoading) {
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
                    AppTab.TODAY -> HomeScreen(
                        pulse = uiState.pulseReport,
                        watchlist = uiState.watchlist,
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
                            portfolioMode = PortfolioMode.MY_NAMES
                            mainViewModel.setTab(AppTab.PORTFOLIO)
                        },
                        onRetryPulse = mainViewModel::refreshPulse,
                        onResumeLastViewed = { mainViewModel.resumeLastViewed(it) },
                        onDismissResume = { mainViewModel.dismissResumeCard() }
                    )
                    AppTab.RESEARCH -> ResearchTab(
                        mode = researchMode,
                        onSetMode = { researchMode = it },
                        padding = padding,
                        reportHistory = uiState.reportHistory,
                        deepDiveReport = uiState.deepDiveReport,
                        isLoading = uiState.isLoading,
                        deepDiveError = uiState.deepDiveError,
                        selectedTicker = uiState.selectedTicker ?: "",
                        watchlist = uiState.watchlist,
                        onTickerChange = mainViewModel::selectTicker,
                        onRunReport = mainViewModel::runDeepDive,
                        onOpenHistoryReport = mainViewModel::openHistoryReport,
                        onOpenPulseHistory = { date ->
                            mainViewModel.loadPulseByDate(
                                date = date,
                                rememberAsLastViewed = true
                            )
                            mainViewModel.setTab(AppTab.TODAY)
                        }
                    )
                    AppTab.PORTFOLIO -> PortfolioTab(
                        mode = portfolioMode,
                        onSetMode = { portfolioMode = it },
                        watchlistFeatureEnabled = uiState.watchlistFeatureEnabled,
                        padding = padding,
                        watchlist = uiState.watchlist,
                        onRefreshWatchlist = mainViewModel::refreshWatchlist,
                        onAddWatchlistTicker = mainViewModel::addWatchlistTicker,
                        onRemoveWatchlistTicker = mainViewModel::removeWatchlistTicker,
                        currentApiBaseUrl = uiState.apiBaseUrl,
                        profile = uiState.userProfile,
                        subscriptionOffers = uiState.subscriptionOffers,
                        subscriptionActionInFlight = uiState.subscriptionActionInFlight,
                        notificationsEnabled = uiState.notificationsEnabled,
                        notificationPreferences = uiState.notificationPreferences,
                        onSetNotifications = mainViewModel::setNotificationsEnabled,
                        onSetNotificationPreference = mainViewModel::setNotificationPreference,
                        onSaveApiBaseUrl = mainViewModel::updateApiBaseUrl,
                        onSyncTier = mainViewModel::syncTierFromServer,
                        onRefreshOffers = mainViewModel::refreshSubscriptionOffers,
                        onStartPurchase = mainViewModel::startPurchase,
                        onRestorePurchases = mainViewModel::restorePurchases,
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
    Today(AppTab.TODAY, "Today", Icons.Filled.Notifications),
    Research(AppTab.RESEARCH, "Research", Icons.Filled.Search),
    Portfolio(AppTab.PORTFOLIO, "Portfolio", Icons.AutoMirrored.Filled.List)
}


@Composable
private fun ResearchTab(
    mode: ResearchMode,
    onSetMode: (ResearchMode) -> Unit,
    padding: PaddingValues,
    reportHistory: List<ReportHistoryItem>,
    deepDiveReport: DeepDiveReportView?,
    isLoading: Boolean,
    deepDiveError: String?,
    selectedTicker: String,
    watchlist: List<String>,
    onTickerChange: (String) -> Unit,
    onRunReport: () -> Unit,
    onOpenHistoryReport: (String) -> Unit,
    onOpenPulseHistory: (String) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Button(
                onClick = { onSetMode(ResearchMode.DEEP_DIVE) },
                enabled = mode != ResearchMode.DEEP_DIVE
            ) {
                Text("Deep Dive")
            }
            Button(
                onClick = { onSetMode(ResearchMode.HISTORY) },
                enabled = mode != ResearchMode.HISTORY
            ) {
                Text("History")
            }
        }

        when (mode) {
            ResearchMode.DEEP_DIVE -> DeepDiveScreen(
                report = deepDiveReport,
                isLoading = isLoading,
                errorMessage = deepDiveError,
                tickerState = selectedTicker,
                watchlist = watchlist,
                onTickerChange = onTickerChange,
                onRunReport = onRunReport,
                onBack = { onSetMode(ResearchMode.HISTORY) },
                padding = PaddingValues()
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
    subscriptionOffers: List<com.thesis.mobile.model.SubscriptionOfferView>,
    subscriptionActionInFlight: Boolean,
    notificationsEnabled: Boolean,
    notificationPreferences: List<NotificationPreferenceView>,
    onSetNotifications: (Boolean) -> Unit,
    onSetNotificationPreference: (String, Boolean) -> Unit,
    onSaveApiBaseUrl: (String) -> Unit,
    onSyncTier: () -> Unit,
    onRefreshOffers: () -> Unit,
    onStartPurchase: (Activity, String?) -> Unit,
    onRestorePurchases: () -> Unit,
    onLogout: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Button(
                onClick = { onSetMode(PortfolioMode.MY_NAMES) },
                enabled = mode != PortfolioMode.MY_NAMES && watchlistFeatureEnabled
            ) {
                Text("My Names")
            }
            Button(
                onClick = { onSetMode(PortfolioMode.SETTINGS) },
                enabled = mode != PortfolioMode.SETTINGS
            ) {
                Text("Settings")
            }
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
                subscriptionOffers = subscriptionOffers,
                subscriptionActionInFlight = subscriptionActionInFlight,
                notificationsEnabled = notificationsEnabled,
                notificationPreferences = notificationPreferences,
                onSetNotifications = onSetNotifications,
                onSetNotificationPreference = onSetNotificationPreference,
                onSaveApiBaseUrl = onSaveApiBaseUrl,
                onSyncTier = onSyncTier,
                onRefreshOffers = onRefreshOffers,
                onStartPurchase = onStartPurchase,
                onRestorePurchases = onRestorePurchases,
                onLogout = onLogout
            )
        }
    }
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

    LaunchedEffect(verificationToken) {
        if (!verificationToken.isNullOrBlank()) {
            verifyToken = verificationToken
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("Thesis Android MVP", style = MaterialTheme.typography.headlineSmall)
        Text("Register, verify, and login to access Pulse and Deep Dive.")
        Text("If login/register fails on first run, confirm the Product API URL below.")

        OutlinedTextField(
            value = apiBaseUrl,
            onValueChange = { apiBaseUrl = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Product API Base URL") },
            placeholder = { Text("http://192.168.1.114:3001") },
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = MaterialTheme.colorScheme.onSurface,
                unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
                focusedContainerColor = MaterialTheme.colorScheme.surface,
                unfocusedContainerColor = MaterialTheme.colorScheme.surface
            )
        )
        Button(
            onClick = { onSaveApiBaseUrl(apiBaseUrl) },
            enabled = !isLoading
        ) { Text("Save API URL") }

        HorizontalDivider()

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Email") },
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = MaterialTheme.colorScheme.onSurface,
                unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
                focusedContainerColor = MaterialTheme.colorScheme.surface,
                unfocusedContainerColor = MaterialTheme.colorScheme.surface
            )
        )
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Password") },
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = MaterialTheme.colorScheme.onSurface,
                unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
                focusedContainerColor = MaterialTheme.colorScheme.surface,
                unfocusedContainerColor = MaterialTheme.colorScheme.surface
            )
        )

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                onClick = { onRegister(email, password) },
                enabled = !isLoading
            ) { Text("Register") }
            Button(
                onClick = { onLogin(email, password) },
                enabled = !isLoading
            ) { Text("Login") }
        }

        if (!registerStatus.isNullOrBlank()) {
            Text("Register status: $registerStatus")
        }
        if (!message.isNullOrBlank()) {
            Text(message, color = MaterialTheme.colorScheme.error)
        }

        HorizontalDivider()

        OutlinedTextField(
            value = verifyToken,
            onValueChange = { verifyToken = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Verification token") },
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = MaterialTheme.colorScheme.onSurface,
                unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
                focusedContainerColor = MaterialTheme.colorScheme.surface,
                unfocusedContainerColor = MaterialTheme.colorScheme.surface
            )
        )
        Button(
            onClick = { onVerify(verifyToken) },
            enabled = !isLoading
        ) { Text("Verify Account") }
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
        onDismissRequest = onDismiss,
        title = { Text("Upgrade Required") },
        text = {
            Text(
                "This action needs Pro access ($normalizedFeature). " +
                    "If you upgraded in Google Play, tap \"I upgraded\" to refresh."
            )
        },
        confirmButton = {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                val monthly = subscriptionOffers.firstOrNull { it.packageType == "MONTHLY" }
                val yearly = subscriptionOffers.firstOrNull { it.packageType == "ANNUAL" }
                TextButton(
                    onClick = { onStartPurchase("MONTHLY") },
                    enabled = monthly != null && !subscriptionActionInFlight
                ) { Text("Buy Monthly") }
                TextButton(
                    onClick = { onStartPurchase("YEARLY") },
                    enabled = yearly != null && !subscriptionActionInFlight
                ) { Text("Buy Yearly") }
                TextButton(
                    onClick = onRestorePurchases,
                    enabled = !subscriptionActionInFlight
                ) { Text("Restore Purchases") }
            }
        },
        dismissButton = {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                TextButton(onClick = onRefreshOffers) {
                    Text("Refresh offers")
                }
                TextButton(onClick = onSyncTier) {
                    Text("I upgraded")
                }
                TextButton(onClick = onDismiss) {
                    Text("Not now")
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

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Text("Watchlist", style = MaterialTheme.typography.headlineSmall)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = tickerInput,
                    onValueChange = { tickerInput = it.uppercase() },
                    label = { Text("Ticker") }
                )
                Button(onClick = { onAdd(tickerInput) }) { Text("Add") }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onRefresh) { Text("Refresh") }
            }
        }

        if (items.isEmpty()) {
            item { Text("No watchlist tickers yet.") }
        } else {
            items(items) { ticker ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(ticker)
                        AssistChip(
                            onClick = { onRemove(ticker) },
                            label = { Text("Remove") }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SettingsTab(
    padding: PaddingValues,
    currentApiBaseUrl: String,
    profile: UserProfileView?,
    subscriptionOffers: List<com.thesis.mobile.model.SubscriptionOfferView>,
    subscriptionActionInFlight: Boolean,
    notificationsEnabled: Boolean,
    notificationPreferences: List<NotificationPreferenceView>,
    onSetNotifications: (Boolean) -> Unit,
    onSetNotificationPreference: (String, Boolean) -> Unit,
    onSaveApiBaseUrl: (String) -> Unit,
    onSyncTier: () -> Unit,
    onRefreshOffers: () -> Unit,
    onStartPurchase: (Activity, String?) -> Unit,
    onRestorePurchases: () -> Unit,
    onLogout: () -> Unit
) {
    val context = LocalContext.current
    val activity = context as? Activity
    var baseUrl by rememberSaveable(currentApiBaseUrl) { mutableStateOf(currentApiBaseUrl) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("Settings", style = MaterialTheme.typography.headlineSmall)
        }
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("Notifications")
                Switch(
                    checked = notificationsEnabled,
                    onCheckedChange = onSetNotifications
                )
            }
        }
        if (!notificationsEnabled) {
            item {
                Text(
                    "Push is disabled while notifications are off.",
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
        item {
            Button(onClick = {
                val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                    putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                }
                context.startActivity(intent)
            }) {
                Text("Open Android Notification Settings")
            }
        }
        item {
            HorizontalDivider()
            Text("Notification Types", fontWeight = FontWeight.Bold)
            notificationPreferences.forEach { preference ->
                NotificationPreferenceRow(
                    type = preference.type,
                    enabled = preference.enabled,
                    notificationsEnabled = notificationsEnabled,
                    onToggle = { enabled -> onSetNotificationPreference(preference.type, enabled) }
                )
            }
        }
        item {
            HorizontalDivider()
            Text("Subscription", fontWeight = FontWeight.Bold)
            Text("Tier: ${profile?.tier ?: "FREE"}")
            if (!profile?.billingPeriodEnd.isNullOrBlank()) {
                Text("Billing period end: ${profile?.billingPeriodEnd}")
            }
            Text("Watchlist limit: ${profile?.watchlistLimit ?: 5}")
            val deepDiveLimit = profile?.dailyDeepDiveLimit ?: 1
            val deepDiveText = if (deepDiveLimit < 0) "Unlimited" else "$deepDiveLimit / day"
            Text("Deep Dive limit: $deepDiveText")
            if (profile != null && deepDiveLimit >= 0) {
                Text("Deep Dives remaining today: ${profile.deepDivesRemainingToday}")
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onSyncTier, enabled = !subscriptionActionInFlight) {
                    Text("Refresh subscription")
                }
                Button(onClick = onRefreshOffers, enabled = !subscriptionActionInFlight) {
                    Text("Refresh offers")
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = { if (activity != null) onStartPurchase(activity, "MONTHLY") },
                    enabled = activity != null && !subscriptionActionInFlight
                ) {
                    Text("Buy monthly")
                }
                Button(
                    onClick = { if (activity != null) onStartPurchase(activity, "YEARLY") },
                    enabled = activity != null && !subscriptionActionInFlight
                ) {
                    Text("Buy yearly")
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onRestorePurchases, enabled = !subscriptionActionInFlight) {
                    Text("Restore purchases")
                }
                Button(onClick = {
                    val intent = Intent(Intent.ACTION_VIEW).apply {
                        data = android.net.Uri.parse("https://play.google.com/store/account/subscriptions")
                    }
                    context.startActivity(intent)
                }) {
                    Text("Manage subscription")
                }
            }
            if (subscriptionOffers.isNotEmpty()) {
                Text(
                    "Available offers: ${subscriptionOffers.joinToString { it.title }}",
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
        item {
            OutlinedTextField(
                value = baseUrl,
                onValueChange = { baseUrl = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Product API Base URL") },
                placeholder = { Text("http://192.168.1.114:3001") },
                singleLine = true
            )
        }
        item {
            Button(onClick = { onSaveApiBaseUrl(baseUrl) }) {
                Text("Save API URL")
            }
        }
        item {
            HorizontalDivider()
            Text("About", fontWeight = FontWeight.Bold)
            Text("This is a research summary, not financial advice. Always do your own research.")
        }
        item {
            Button(onClick = onLogout) { Text("Logout") }
        }
    }
}

@Composable
private fun NotificationPreferenceRow(
    type: String,
    enabled: Boolean,
    notificationsEnabled: Boolean,
    onToggle: (Boolean) -> Unit
) {
    val label = when (type) {
        "earnings_preview" -> "Earnings preview"
        "contrarian_alert" -> "Contrarian alert"
        "weekly_digest" -> "Weekly digest"
        "market_pulse_ready" -> "Market Pulse ready"
        else -> type.replace('_', ' ').replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
    }

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(label)
            if (!notificationsEnabled) {
                Text(
                    "Global notifications are off. This preference will apply when they are re-enabled.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        Switch(
            checked = enabled,
            onCheckedChange = onToggle
        )
    }
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
