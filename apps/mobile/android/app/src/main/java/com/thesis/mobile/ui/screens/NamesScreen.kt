package com.thesis.mobile.ui.screens

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.model.ThesisMonitorSnapshotView
import com.thesis.mobile.ui.copy.Phase4Copy
import com.thesis.mobile.ui.theme.HeadingFont
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun NamesScreen(
    padding: PaddingValues,
    watchlist: List<String>,
    monitorSnapshots: List<ThesisMonitorSnapshotView>,
    alerts: List<AlertLedgerItemView>,
    onRefresh: () -> Unit,
    onAddTicker: (String) -> Unit,
    onRemoveTicker: (String) -> Unit,
    onRunDeepDive: (String) -> Unit,
    onOpenResearch: (String) -> Unit
) {
    var tickerInput by rememberSaveable { mutableStateOf("") }
    var selectedSegment by rememberSaveable { mutableStateOf(Phase4Copy.namesSegments.first()) }
    val rows = remember(watchlist, monitorSnapshots, alerts) {
        watchlist.map { ticker ->
            val snapshot = monitorSnapshots.firstOrNull { it.ticker.equals(ticker, ignoreCase = true) }
            val tickerAlerts = alerts.filter { alert ->
                alert.ticker.equals(ticker, ignoreCase = true) ||
                    alert.relatedTickers.any { related -> related.equals(ticker, ignoreCase = true) }
            }
            NamesRowModel(
                ticker = ticker,
                state = snapshot?.state ?: "watching",
                reason = snapshot?.reason ?: "No thesis drift recorded yet.",
                freshness = snapshot?.reportGeneratedAt ?: snapshot?.updatedAt,
                catalystSoon = tickerAlerts.any { it.category == "earnings" && it.mutedAt == null },
                atRisk = snapshot?.state.equals("weakened", ignoreCase = true) ||
                    tickerAlerts.any { it.category == "thesis_drift" && it.mutedAt == null },
                unresolved = snapshot?.state.equals("unresolved", ignoreCase = true)
            )
        }
    }
    val filteredRows = remember(rows, selectedSegment) {
        when (selectedSegment) {
            "At Risk" -> rows.filter { it.atRisk }
            "Catalysts Soon" -> rows.filter { it.catalystSoon }
            "Unresolved" -> rows.filter { it.unresolved }
            else -> rows
        }
    }
    val fieldColors = OutlinedTextFieldDefaults.colors(
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
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingLg)
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
                Text(
                    text = Phase4Copy.namesHeadline,
                    style = ThesisTypography.headlineLarge.copy(
                        fontFamily = HeadingFont,
                        fontWeight = FontWeight.Normal
                    ),
                    color = ThesisColors.TextPrimary
                )
                Text(
                    text = Phase4Copy.namesSubtitle,
                    style = ThesisTypography.bodyMedium,
                    color = ThesisColors.TextMuted
                )
            }
        }
        item {
            SegmentRow(
                options = Phase4Copy.namesSegments,
                selected = selectedSegment,
                onSelect = { selectedSegment = it }
            )
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
                OutlinedTextField(
                    value = tickerInput,
                    onValueChange = { tickerInput = it.uppercase() },
                    modifier = Modifier.weight(1f),
                    label = { Text("Ticker") },
                    singleLine = true,
                    shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                    colors = fieldColors
                )
                Button(
                    onClick = {
                        if (tickerInput.isNotBlank()) {
                            onAddTicker(tickerInput)
                            tickerInput = ""
                        }
                    },
                    modifier = Modifier.height(56.dp),
                    shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = ThesisColors.Primary,
                        contentColor = ThesisColors.TextInverse
                    )
                ) {
                    Text("Add")
                }
            }
        }
        item {
            OutlinedButton(
                onClick = onRefresh,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
            ) {
                Text("Refresh board", color = ThesisColors.TextMuted)
            }
        }

        if (watchlist.isEmpty()) {
            item {
                EmptyBoardCard(
                    title = "No names yet",
                    body = "Add a ticker to start tracking thesis strength, catalysts, and unresolved drift."
                )
            }
        } else if (filteredRows.isEmpty()) {
            item {
                EmptyBoardCard(
                    title = "Nothing in this segment",
                    body = "Your current names do not match this priority filter."
                )
            }
        } else {
            items(filteredRows, key = { it.ticker }) { row ->
                NamesRowCard(
                    row = row,
                    onRunDeepDive = { onRunDeepDive(row.ticker) },
                    onOpenResearch = { onOpenResearch(row.ticker) },
                    onRemoveTicker = { onRemoveTicker(row.ticker) }
                )
            }
        }
    }
}

@Composable
private fun NamesRowCard(
    row: NamesRowModel,
    onRunDeepDive: () -> Unit,
    onOpenResearch: () -> Unit,
    onRemoveTicker: () -> Unit
) {
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
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = row.ticker,
                    style = ThesisTypography.headlineLarge.copy(
                        fontFamily = HeadingFont,
                        fontWeight = FontWeight.Normal
                    ),
                    color = ThesisColors.TextPrimary
                )
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingXs))
                Text(
                    text = row.reason,
                    style = ThesisTypography.bodyMedium,
                    color = ThesisColors.TextMuted
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                StatusChip(label = row.state.replaceFirstChar { it.uppercase() }, state = row.state)
                if (row.catalystSoon) {
                    Spacer(modifier = Modifier.height(ThesisDimens.SpacingXs))
                    SecondaryChip(label = "Catalyst soon")
                }
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "TRUST FRESHNESS",
                style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                color = ThesisColors.TextMuted
            )
            Text(
                text = row.freshness?.let(::formatFreshness) ?: "No recent thesis",
                style = ThesisTypography.bodySmall,
                color = ThesisColors.TextSecondary
            )
        }

        HorizontalDivider(color = ThesisColors.Border)

        Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
            Button(
                onClick = onRunDeepDive,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                colors = ButtonDefaults.buttonColors(
                    containerColor = ThesisColors.Primary,
                    contentColor = ThesisColors.TextInverse
                )
            ) {
                Text("Deep Dive")
            }
            OutlinedButton(
                onClick = onOpenResearch,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
            ) {
                Text("Add Note", color = ThesisColors.TextMuted)
            }
            OutlinedButton(
                onClick = onRemoveTicker,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
            ) {
                Text("Remove", color = ThesisColors.SignalNegative)
            }
        }
    }
}

@Composable
private fun EmptyBoardCard(title: String, body: String) {
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
            text = title,
            style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.TextPrimary
        )
        Text(
            text = body,
            style = ThesisTypography.bodyMedium,
            color = ThesisColors.TextMuted
        )
    }
}

@Composable
private fun SegmentRow(options: List<String>, selected: String, onSelect: (String) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
        options.forEach { option ->
            val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
            Text(
                text = option,
                style = ThesisTypography.labelLarge.copy(
                    fontWeight = if (selected == option) FontWeight.Medium else FontWeight.Normal
                ),
                color = if (selected == option) ThesisColors.Primary else ThesisColors.TextMuted,
                modifier = Modifier
                    .clip(shape)
                    .background(
                        if (selected == option) ThesisColors.Primary.copy(alpha = 0.1f)
                        else ThesisColors.Surface
                    )
                    .border(
                        ThesisDimens.BorderWidth,
                        if (selected == option) ThesisColors.Primary.copy(alpha = 0.3f)
                        else ThesisColors.Border,
                        shape
                    )
                    .clickable { onSelect(option) }
                    .padding(horizontal = ThesisDimens.SpacingLg, vertical = ThesisDimens.SpacingSm)
            )
        }
    }
}

@Composable
private fun StatusChip(label: String, state: String) {
    val (background, color) = when (state.lowercase()) {
        "intact", "improved" -> ThesisColors.SignalPositive.copy(alpha = 0.12f) to ThesisColors.SignalPositive
        "weakened" -> ThesisColors.SignalNegative.copy(alpha = 0.12f) to ThesisColors.SignalNegative
        "unresolved" -> ThesisColors.SignalWarning.copy(alpha = 0.12f) to ThesisColors.SignalWarning
        else -> ThesisColors.SurfaceElevated to ThesisColors.TextMuted
    }
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(ThesisDimens.SignalBadgeCorner))
            .background(background)
            .padding(horizontal = ThesisDimens.SpacingSm, vertical = ThesisDimens.SpacingXs)
    ) {
        Text(
            text = label.uppercase(),
            style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
            color = color
        )
    }
}

@Composable
private fun SecondaryChip(label: String) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(ThesisDimens.SignalBadgeCorner))
            .background(ThesisColors.Primary.copy(alpha = 0.1f))
            .padding(horizontal = ThesisDimens.SpacingSm, vertical = ThesisDimens.SpacingXs)
    ) {
        Text(
            text = label.uppercase(),
            style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.Primary
        )
    }
}

private data class NamesRowModel(
    val ticker: String,
    val state: String,
    val reason: String,
    val freshness: String?,
    val catalystSoon: Boolean,
    val atRisk: Boolean,
    val unresolved: Boolean
)

private fun formatFreshness(raw: String): String = runCatching {
    Instant.parse(raw)
        .atZone(ZoneId.of("America/New_York"))
        .format(DateTimeFormatter.ofPattern("MMM d, HH:mm z"))
}.getOrElse { raw }
