package com.thesis.mobile.ui

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
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.AssistChip
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
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.EvidenceView
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.model.SectionView
import com.thesis.mobile.ui.screens.DeepDiveScreen
import com.thesis.mobile.ui.screens.HistoryScreen
import com.thesis.mobile.ui.screens.HomeScreen
import com.thesis.mobile.ui.screens.WelcomeScreen
import com.thesis.mobile.ui.theme.ThesisTheme
import androidx.compose.material.icons.filled.History

@Composable
fun ThesisApp(
    openPulseOnStart: Boolean = false,
    pulseDateOnStart: String? = null,
    mainViewModel: MainViewModel = viewModel()
) {
    var uiState by remember { mutableStateOf(mainViewModel.state) }
    val snackbarHostState = remember { SnackbarHostState() }

    DisposableEffect(mainViewModel) {
        mainViewModel.observe { state -> uiState = state }
        onDispose {}
    }

    LaunchedEffect(openPulseOnStart, pulseDateOnStart, uiState.tokens) {
        if (openPulseOnStart && uiState.tokens != null) {
            mainViewModel.openPulseFromNotification(pulseDateOnStart)
        }
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
            WelcomeScreen(onContinue = mainViewModel::completeWelcome)
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

        val visibleTabs = remember(uiState.watchlistFeatureEnabled) {
            buildList {
                add(TabItem.Pulse)
                add(TabItem.DeepDive)
                if (uiState.watchlistFeatureEnabled) {
                    add(TabItem.Watchlist)
                }
                add(TabItem.History)
                add(TabItem.Settings)
            }
        }

        Scaffold(
            snackbarHost = { SnackbarHost(snackbarHostState) },
            bottomBar = {
                NavigationBar {
                    visibleTabs.forEach { tab ->
                        NavigationBarItem(
                            selected = uiState.currentTab == tab.target,
                            onClick = { mainViewModel.setTab(tab.target) },
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
                    AppTab.PULSE -> HomeScreen(
                        pulse = uiState.pulseReport,
                        watchlist = uiState.watchlist,
                        padding = padding,
                        lastViewedReport = uiState.lastViewedReport,
                        pulseError = uiState.pulseError,
                        onOpenHistory = { mainViewModel.setTab(AppTab.HISTORY) },
                        onRunDeepDive = { ticker ->
                            mainViewModel.selectTicker(ticker)
                            mainViewModel.setTab(AppTab.DEEP_DIVE)
                            mainViewModel.runDeepDive()
                        },
                        onManageNames = { mainViewModel.setTab(AppTab.WATCHLIST) },
                        onRetryPulse = mainViewModel::refreshPulse,
                        onResumeLastViewed = { mainViewModel.resumeLastViewed(it) },
                        onDismissResume = { mainViewModel.dismissResumeCard() }
                    )
                    AppTab.DEEP_DIVE -> DeepDiveScreen(
                        report = uiState.deepDiveReport,
                        isLoading = uiState.isLoading,
                        errorMessage = uiState.deepDiveError,
                        tickerState = uiState.selectedTicker ?: "",
                        watchlist = uiState.watchlist,
                        onTickerChange = mainViewModel::selectTicker,
                        onRunReport = mainViewModel::runDeepDive,
                        onBack = { mainViewModel.setTab(AppTab.PULSE) },
                        padding = padding
                    )
                    AppTab.WATCHLIST -> WatchlistTab(
                        padding = padding,
                        items = uiState.watchlist,
                        onRefresh = mainViewModel::refreshWatchlist,
                        onAdd = mainViewModel::addWatchlistTicker,
                        onRemove = mainViewModel::removeWatchlistTicker
                    )
                    AppTab.HISTORY -> HistoryScreen(
                        historyItems = uiState.reportHistory,
                        onBack = { mainViewModel.setTab(AppTab.PULSE) },
                        onOpenReport = { item ->
                            if (item.type == "deep_dive") {
                                mainViewModel.openHistoryReport(item.reportId)
                            } else {
                                mainViewModel.loadPulseByDate(
                                    item.createdAt.take(10),
                                    rememberAsLastViewed = true
                                )
                                mainViewModel.setTab(AppTab.PULSE)
                            }
                        }
                    )
                    AppTab.SETTINGS -> SettingsTab(
                        padding = padding,
                        currentApiBaseUrl = uiState.apiBaseUrl,
                        notificationsEnabled = uiState.notificationsEnabled,
                        onSetNotifications = mainViewModel::setNotificationsEnabled,
                        onSaveApiBaseUrl = mainViewModel::updateApiBaseUrl,
                        onLogout = mainViewModel::logout
                    )
                }
            }
        }
    }
}

private enum class TabItem(
    val target: AppTab,
    val label: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector
) {
    Pulse(AppTab.PULSE, "Pulse", Icons.Filled.Notifications),
    DeepDive(AppTab.DEEP_DIVE, "Deep Dive", Icons.Filled.Search),
    History(AppTab.HISTORY, "History", Icons.Filled.History),
    Watchlist(AppTab.WATCHLIST, "Watchlist", Icons.Filled.List),
    Settings(AppTab.SETTINGS, "Settings", Icons.Filled.Settings)
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
    notificationsEnabled: Boolean,
    onSetNotifications: (Boolean) -> Unit,
    onSaveApiBaseUrl: (String) -> Unit,
    onLogout: () -> Unit
) {
    val context = LocalContext.current
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
            OutlinedTextField(
                value = baseUrl,
                onValueChange = { baseUrl = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Product API Base URL") }
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
