package com.thesis.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.HelpOutline
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.EvidenceView
import com.thesis.mobile.model.ScenarioResultView
import com.thesis.mobile.model.SectionView
import com.thesis.mobile.ui.components.ConfidenceRing
import com.thesis.mobile.ui.components.DeepDiveUnavailableState
import com.thesis.mobile.ui.components.EvidenceDots
import com.thesis.mobile.ui.components.NoDeepDivesEmptyState
import com.thesis.mobile.ui.components.OfflineEmptyState
import com.thesis.mobile.ui.components.SectionAccordion
import com.thesis.mobile.ui.components.SignalBadge
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography

@Composable
fun DeepDiveScreen(
    report: DeepDiveReportView?,
    isLoading: Boolean,
    errorMessage: String?,
    userTier: String?,
    reportNoteDraft: String,
    noteUpdatedAt: String?,
    isSavingNote: Boolean,
    onReportNoteChange: (String) -> Unit,
    onSaveReportNote: () -> Unit,
    scenarioResult: ScenarioResultView?,
    isRunningScenario: Boolean,
    onRunScenario: (Int?, Double?, Double?) -> Unit,
    onRequireUpgrade: (String) -> Unit,
    onNotify: (String) -> Unit,
    tickerState: String,
    watchlist: List<String>,
    onTickerChange: (String) -> Unit,
    onRunReport: () -> Unit,
    onBack: () -> Unit,
    padding: PaddingValues
) {
    if (report == null) {
        if (isLoading) {
            DeepDiveLoadingScreen(modifier = Modifier.padding(padding))
        } else {
            DeepDiveSearchState(
                tickerState = tickerState,
                isLoading = isLoading,
                errorMessage = errorMessage,
                onTickerChange = onTickerChange,
                onRunReport = onRunReport,
                padding = padding
            )
        }
        return
    }

    DeepDiveReportState(
        report = report,
        userTier = userTier,
        reportNoteDraft = reportNoteDraft,
        noteUpdatedAt = noteUpdatedAt,
        isSavingNote = isSavingNote,
        onReportNoteChange = onReportNoteChange,
        onSaveReportNote = onSaveReportNote,
        scenarioResult = scenarioResult,
        isRunningScenario = isRunningScenario,
        onRunScenario = onRunScenario,
        onRequireUpgrade = onRequireUpgrade,
        onNotify = onNotify,
        watchlist = watchlist,
        onBack = onBack,
        padding = padding
    )
}

@Composable
private fun DeepDiveSearchState(
    tickerState: String,
    isLoading: Boolean,
    errorMessage: String?,
    onTickerChange: (String) -> Unit,
    onRunReport: () -> Unit,
    padding: PaddingValues
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding)
            .padding(ThesisDimens.ScreenPaddingHorizontal),
        contentAlignment = Alignment.Center
    ) {
        if (!errorMessage.isNullOrBlank()) {
            if (errorMessage.contains("No internet connection", ignoreCase = true)) {
                OfflineEmptyState(onRetry = onRunReport)
            } else {
                DeepDiveUnavailableState(
                    message = errorMessage,
                    onRetry = onRunReport
                )
            }
            return
        }

        NoDeepDivesEmptyState {
            Column(modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(
                    value = tickerState,
                    onValueChange = onTickerChange,
                    label = { Text("Ticker Symbol (e.g. AAPL)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingLg))

                Button(
                    onClick = onRunReport,
                    enabled = !isLoading && tickerState.isNotBlank(),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp)
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            color = ThesisColors.TextPrimaryDark
                        )
                    } else {
                        Text(
                            text = "Run Deep Dive",
                            style = ThesisTypography.labelLarge
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DeepDiveReportState(
    report: DeepDiveReportView,
    userTier: String?,
    reportNoteDraft: String,
    noteUpdatedAt: String?,
    isSavingNote: Boolean,
    onReportNoteChange: (String) -> Unit,
    onSaveReportNote: () -> Unit,
    scenarioResult: ScenarioResultView?,
    isRunningScenario: Boolean,
    onRunScenario: (Int?, Double?, Double?) -> Unit,
    onRequireUpgrade: (String) -> Unit,
    onNotify: (String) -> Unit,
    watchlist: List<String>,
    onBack: () -> Unit,
    padding: PaddingValues
) {
    val ticker = report.ticker ?: "Ticker"
    val isWatched = report.ticker != null && watchlist.contains(report.ticker)
    val highlights = deriveHighlights(report)
    val context = LocalContext.current
    val isPro = userTier.equals("PRO", ignoreCase = true)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding)
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                top = 56.dp + ThesisDimens.ScreenPaddingTop,
                bottom = ThesisDimens.ScreenPaddingBottom + 80.dp,
                start = ThesisDimens.ScreenPaddingHorizontal,
                end = ThesisDimens.ScreenPaddingHorizontal
            ),
            verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXxl)
        ) {
            item {
                HeaderSection(ticker = ticker, isWatched = isWatched)
            }

            report.thesisStatement?.takeIf { it.isNotBlank() }?.let { thesis ->
                item {
                    SummarySection(
                        title = "Thesis Statement",
                        icon = Icons.Default.PushPin,
                        iconColor = ThesisColors.AccentBlue,
                        content = thesis
                    )
                }
            }

            item {
                SignalBlockSection(report = report)
            }

            items(highlights.size) { index ->
                val highlight = highlights[index]
                SummarySection(
                    title = highlight.title,
                    icon = highlight.icon,
                    iconColor = highlight.iconColor,
                    content = highlight.content,
                    isCaution = highlight.isCaution
                )
            }

            if (report.sections.isNotEmpty()) {
                item {
                    Text(
                        text = "Deep Dive Modules",
                        style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                        color = ThesisColors.TextPrimaryDark
                    )
                }
            }

            items(report.sections.size) { index ->
                val section = report.sections[index]
                SectionAccordion(
                    title = section.title,
                    statusText = section.status ?: "UNKNOWN",
                    initiallyExpanded = section.status.equals("complete", ignoreCase = true),
                    content = {
                        Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)) {
                            Text(
                                text = section.body.ifBlank { "No section summary returned." },
                                style = ThesisTypography.bodyMedium,
                                color = ThesisColors.TextSecondaryDark
                            )

                            if (section.evidence.isNotEmpty()) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    EvidenceDots(count = section.evidence.size)
                                    Spacer(modifier = Modifier.size(ThesisDimens.SpacingSm))
                                    Text(
                                        text = "${section.evidence.size} sources",
                                        style = ThesisTypography.labelSmall,
                                        color = ThesisColors.TextTertiaryDark
                                    )
                                }

                                EvidenceList(evidence = section.evidence)
                            }
                        }
                    },
                    modifier = Modifier.padding(bottom = ThesisDimens.SpacingSm)
                )
            }

            item {
                NotesSection(
                    noteDraft = reportNoteDraft,
                    noteUpdatedAt = noteUpdatedAt,
                    isSaving = isSavingNote,
                    onNoteChange = onReportNoteChange,
                    onSave = onSaveReportNote
                )
            }

            item {
                ScenarioSection(
                    isPro = isPro,
                    valuation = report.valuation,
                    isRunning = isRunningScenario,
                    scenarioResult = scenarioResult,
                    onRunScenario = onRunScenario,
                    onRequireUpgrade = onRequireUpgrade
                )
            }

            item {
                ExportSection(
                    isPro = isPro,
                    onRequireUpgrade = onRequireUpgrade,
                    onNotify = onNotify,
                    onExportPdf = {
                        val artifact = createPdfExport(context, report, ReportExportType.FULL_REPORT)
                        shareExport(context, artifact)
                    },
                    onExportCard = {
                        val artifact = createShareCard(context, report)
                        shareExport(context, artifact)
                    },
                    onExportMemo = {
                        val artifact = createPdfExport(context, report, ReportExportType.INVESTMENT_MEMO)
                        shareExport(context, artifact)
                    }
                )
            }

            item {
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingXxl))
                Text(
                    text = "This is a research summary, not financial advice. Always do your own research.",
                    style = ThesisTypography.labelSmall,
                    color = ThesisColors.TextTertiaryDark,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .background(ThesisColors.DarkBackground.copy(alpha = 0.95f))
                .padding(horizontal = ThesisDimens.SpacingSm),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Back",
                        tint = ThesisColors.AccentBlue
                    )
                }
                Text(
                    text = ticker,
                    style = ThesisTypography.headlineLarge.copy(fontWeight = FontWeight.Bold),
                    color = ThesisColors.TextPrimaryDark
                )
            }

            SignalBadge(signalValue = report.signalValue)
        }
    }
}

@Composable
private fun HeaderSection(ticker: String, isWatched: Boolean) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top
        ) {
            Column {
                Text(
                    text = ticker,
                    style = ThesisTypography.displayLarge.copy(fontSize = 44.sp, fontWeight = FontWeight.ExtraBold),
                    color = ThesisColors.TextPrimaryDark
                )
                Text(
                    text = "Evidence-backed company research",
                    style = ThesisTypography.bodyMedium,
                    color = ThesisColors.TextSecondaryDark
                )
            }

            if (isWatched) {
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(percent = 50))
                        .background(ThesisColors.AccentBlue.copy(alpha = 0.1f))
                        .border(1.dp, ThesisColors.AccentBlue.copy(alpha = 0.2f), RoundedCornerShape(percent = 50))
                        .padding(horizontal = ThesisDimens.SpacingMd, vertical = ThesisDimens.SpacingXs),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.AutoAwesome,
                        contentDescription = null,
                        tint = ThesisColors.AccentBlue,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.size(ThesisDimens.SpacingXs))
                    Text(
                        text = "In My Names",
                        style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.sp),
                        color = ThesisColors.AccentBlue
                    )
                }
            }
        }
    }
}

@Composable
private fun SignalBlockSection(report: DeepDiveReportView) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)
    ) {
        Box(
            modifier = Modifier
                .weight(1f)
                .height(156.dp)
                .clip(RoundedCornerShape(ThesisDimens.CardCornerRadius))
                .background(signalContainerColor(report.signalValue))
                .border(2.dp, signalBorderColor(report.signalValue), RoundedCornerShape(ThesisDimens.CardCornerRadius))
                .padding(ThesisDimens.CardPadding)
        ) {
            Column(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "CURRENT SIGNAL",
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.5.sp),
                    color = signalTextColor(report.signalValue)
                )
                SignalBadge(signalValue = report.signalValue)
                Text(
                    text = report.signalValue?.uppercase() ?: "NO SIGNAL",
                    style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                    color = signalTextColor(report.signalValue)
                )
            }
        }

        Box(
            modifier = Modifier
                .weight(1f)
                .height(156.dp)
                .clip(RoundedCornerShape(ThesisDimens.CardCornerRadius))
                .background(ThesisColors.DarkSurfaceHigh)
                .padding(ThesisDimens.CardPadding),
            contentAlignment = Alignment.Center
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                ConfidenceRing(
                    score = (report.confidenceScore ?: 0.0).toFloat(),
                    modifier = Modifier.size(64.dp)
                )
                Spacer(modifier = Modifier.size(ThesisDimens.SpacingMd))
                Column {
                    Text(
                        text = "CONFIDENCE",
                        style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.sp),
                        color = ThesisColors.TextTertiaryDark
                    )
                    Text(
                        text = report.confidenceLabel?.uppercase() ?: "UNKNOWN",
                        style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                        color = ThesisColors.TextPrimaryDark
                    )
                }
            }
        }
    }
}

@Composable
private fun SummarySection(
    title: String,
    icon: ImageVector,
    iconColor: Color,
    content: String,
    isCaution: Boolean = false
) {
    Column {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(bottom = ThesisDimens.SpacingSm)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = iconColor,
                modifier = Modifier.size(16.dp)
            )
            Spacer(modifier = Modifier.size(ThesisDimens.SpacingSm))
            Text(
                text = title.uppercase(),
                style = ThesisTypography.labelMedium.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.sp),
                color = ThesisColors.TextSecondaryDark
            )
        }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(ThesisDimens.CardCornerRadius))
                .background(if (isCaution) ThesisColors.DarkSurface else ThesisColors.DarkSurfaceHigh)
                .border(2.dp, iconColor.copy(alpha = 0.4f), RoundedCornerShape(ThesisDimens.CardCornerRadius))
                .padding(ThesisDimens.SpacingLg)
        ) {
            Text(
                text = content,
                style = ThesisTypography.bodyLarge,
                color = if (isCaution) ThesisColors.TextSecondaryDark else ThesisColors.TextPrimaryDark,
                fontStyle = if (isCaution) FontStyle.Italic else FontStyle.Normal
            )
        }
    }
}

@Composable
private fun EvidenceList(evidence: List<EvidenceView>) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
        evidence.forEach { item ->
            Column {
                Text(
                    text = "Source: ${item.sourceName}",
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Bold),
                    color = ThesisColors.TextPrimaryDark
                )
                if (item.excerpt.isNotBlank()) {
                    Text(
                        text = item.excerpt,
                        style = ThesisTypography.bodySmall,
                        color = ThesisColors.TextSecondaryDark
                    )
                }
                if (!item.url.isNullOrBlank()) {
                    Text(
                        text = item.url,
                        style = ThesisTypography.labelSmall,
                        color = ThesisColors.AccentBlueLight
                    )
                }
            }
        }
    }
}

@Composable
private fun NotesSection(
    noteDraft: String,
    noteUpdatedAt: String?,
    isSaving: Boolean,
    onNoteChange: (String) -> Unit,
    onSave: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
        Text(
            text = "My Notes",
            style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Bold),
            color = ThesisColors.TextPrimaryDark
        )
        OutlinedTextField(
            value = noteDraft,
            onValueChange = onNoteChange,
            modifier = Modifier.fillMaxWidth(),
            minLines = 4,
            maxLines = 8,
            label = { Text("Add your notes for this report") }
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = noteUpdatedAt?.let { "Last saved: $it" } ?: "No saved note yet.",
                style = ThesisTypography.labelSmall,
                color = ThesisColors.TextTertiaryDark
            )
            Button(onClick = onSave, enabled = !isSaving) {
                Text(if (isSaving) "Saving..." else "Save Note")
            }
        }
    }
}

@Composable
private fun ScenarioSection(
    isPro: Boolean,
    valuation: com.thesis.mobile.model.ValuationDisplayView?,
    isRunning: Boolean,
    scenarioResult: ScenarioResultView?,
    onRunScenario: (Int?, Double?, Double?) -> Unit,
    onRequireUpgrade: (String) -> Unit
) {
    var projectionYearsText by remember(valuation?.assumptions?.projectionYears) {
        mutableStateOf(valuation?.assumptions?.projectionYears?.toString().orEmpty())
    }
    var terminalGrowthText by remember(valuation?.assumptions?.terminalGrowthRate) {
        mutableStateOf(valuation?.assumptions?.terminalGrowthRate?.toString().orEmpty())
    }
    var waccText by remember(valuation?.assumptions?.wacc) {
        mutableStateOf(valuation?.assumptions?.wacc?.toString().orEmpty())
    }

    LaunchedEffect(valuation?.assumptions?.projectionYears, valuation?.assumptions?.terminalGrowthRate, valuation?.assumptions?.wacc) {
        projectionYearsText = valuation?.assumptions?.projectionYears?.toString().orEmpty()
        terminalGrowthText = valuation?.assumptions?.terminalGrowthRate?.toString().orEmpty()
        waccText = valuation?.assumptions?.wacc?.toString().orEmpty()
    }

    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
        Text(
            text = "What-If Scenario",
            style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Bold),
            color = ThesisColors.TextPrimaryDark
        )
        Text(
            text = "Adjust deterministic DCF assumptions and compare base vs scenario outputs.",
            style = ThesisTypography.bodySmall,
            color = ThesisColors.TextSecondaryDark
        )

        if (valuation == null) {
            Text(
                text = "Valuation data is unavailable for this report.",
                style = ThesisTypography.bodySmall,
                color = ThesisColors.TextTertiaryDark
            )
            return@Column
        }

        OutlinedTextField(
            value = projectionYearsText,
            onValueChange = { projectionYearsText = it },
            label = { Text("Projection years") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = terminalGrowthText,
            onValueChange = { terminalGrowthText = it },
            label = { Text("Terminal growth rate") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = waccText,
            onValueChange = { waccText = it },
            label = { Text("WACC") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Button(
            onClick = {
                if (!isPro) {
                    onRequireUpgrade("what_if_scenario")
                    return@Button
                }
                onRunScenario(
                    projectionYearsText.toIntOrNull(),
                    terminalGrowthText.toDoubleOrNull(),
                    waccText.toDoubleOrNull()
                )
            },
            enabled = !isRunning,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(if (isRunning) "Running..." else "Run Scenario")
        }

        scenarioResult?.let { result ->
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(ThesisDimens.CardCornerRadius))
                    .background(ThesisColors.DarkSurfaceHigh)
                    .border(1.dp, ThesisColors.DarkBorder, RoundedCornerShape(ThesisDimens.CardCornerRadius))
                    .padding(ThesisDimens.CardPadding)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXs)) {
                    Text(
                        text = "Scenario Result",
                        style = ThesisTypography.labelMedium.copy(fontWeight = FontWeight.Bold),
                        color = ThesisColors.TextPrimaryDark
                    )
                    Text(
                        text = "Base fair value: ${result.base.fairValueMid?.let { String.format("%.2f", it) } ?: "n/a"}",
                        style = ThesisTypography.bodySmall,
                        color = ThesisColors.TextSecondaryDark
                    )
                    Text(
                        text = "Scenario fair value: ${result.scenario.fairValueMid?.let { String.format("%.2f", it) } ?: "n/a"}",
                        style = ThesisTypography.bodySmall,
                        color = ThesisColors.TextSecondaryDark
                    )
                    Text(
                        text = "Scenario implied upside: ${result.scenario.impliedUpsidePct?.let { String.format("%.2f%%", it) } ?: "n/a"}",
                        style = ThesisTypography.bodySmall,
                        color = ThesisColors.TextSecondaryDark
                    )
                }
            }
        }
    }
}

@Composable
private fun ExportSection(
    isPro: Boolean,
    onRequireUpgrade: (String) -> Unit,
    onNotify: (String) -> Unit,
    onExportPdf: () -> Unit,
    onExportCard: () -> Unit,
    onExportMemo: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
        Text(
            text = "Export",
            style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Bold),
            color = ThesisColors.TextPrimaryDark
        )
        Text(
            text = "Create a PDF, share card, or investment memo from this report.",
            style = ThesisTypography.bodySmall,
            color = ThesisColors.TextSecondaryDark
        )

        fun runExport(action: () -> Unit) {
            if (!isPro) {
                onRequireUpgrade("report_export")
                return
            }
            runCatching { action() }
                .onSuccess { onNotify("Export generated.") }
                .onFailure { onNotify(it.message ?: "Export failed.") }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
            OutlinedButton(
                onClick = { runExport(onExportPdf) },
                modifier = Modifier.weight(1f)
            ) {
                Text("PDF")
            }
            OutlinedButton(
                onClick = { runExport(onExportCard) },
                modifier = Modifier.weight(1f)
            ) {
                Text("Share Card")
            }
            OutlinedButton(
                onClick = { runExport(onExportMemo) },
                modifier = Modifier.weight(1f)
            ) {
                Text("Memo")
            }
        }
    }
}

private data class HighlightCard(
    val title: String,
    val content: String,
    val icon: ImageVector,
    val iconColor: Color,
    val isCaution: Boolean = false
)

private fun deriveHighlights(report: DeepDiveReportView): List<HighlightCard> {
    val sections = report.sections.filter { it.body.isNotBlank() }
    val lead = sections.getOrNull(0)?.body?.let(::summarize)
        ?: "This report is available, but the lead section did not return a usable summary."
    val support = sections.getOrNull(1)?.body?.let(::summarize)
        ?: "Review the report modules below for the supporting evidence behind this signal."
    val caution = sections
        .filter { !it.status.isNullOrBlank() && it.status != "complete" }
        .joinToString(separator = ", ") { it.title }
        .ifBlank {
            report.confidenceLabel?.let {
                "Confidence is ${it.lowercase()}. Review the evidence modules before acting on the signal."
            } ?: "Confidence details are limited. Review the evidence modules before acting on the signal."
        }

    return listOf(
        HighlightCard(
            title = "Lead Finding",
            content = lead,
            icon = Icons.Default.PushPin,
            iconColor = ThesisColors.AccentBlue
        ),
        HighlightCard(
            title = "Supporting Context",
            content = support,
            icon = Icons.Default.Bolt,
            iconColor = ThesisColors.SignalPositive
        ),
        HighlightCard(
            title = "Read With Caution",
            content = caution,
            icon = Icons.Default.HelpOutline,
            iconColor = ThesisColors.SignalWarning,
            isCaution = true
        )
    )
}

private fun summarize(text: String, limit: Int = 180): String {
    val normalized = text.replace(Regex("\\s+"), " ").trim()
    if (normalized.isBlank()) {
        return "No summary returned."
    }
    return if (normalized.length <= limit) normalized else normalized.take(limit - 1).trimEnd() + "…"
}

private fun signalContainerColor(signal: String?): Color = when (signal?.uppercase()) {
    "POSITIVE" -> ThesisColors.SignalPositive.copy(alpha = 0.15f)
    "NEGATIVE" -> ThesisColors.SignalNegative.copy(alpha = 0.15f)
    else -> ThesisColors.DarkSurfaceHigh
}

private fun signalBorderColor(signal: String?): Color = when (signal?.uppercase()) {
    "POSITIVE" -> ThesisColors.SignalPositive.copy(alpha = 0.35f)
    "NEGATIVE" -> ThesisColors.SignalNegative.copy(alpha = 0.35f)
    else -> ThesisColors.DarkBorder
}

private fun signalTextColor(signal: String?): Color = when (signal?.uppercase()) {
    "POSITIVE" -> ThesisColors.SignalPositive
    "NEGATIVE" -> ThesisColors.SignalNegative
    else -> ThesisColors.TextPrimaryDark
}
