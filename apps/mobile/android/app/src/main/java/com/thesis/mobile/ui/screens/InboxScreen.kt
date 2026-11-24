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
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.ui.copy.Phase4Copy
import com.thesis.mobile.ui.theme.HeadingFont
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun InboxScreen(
    padding: PaddingValues,
    alerts: List<AlertLedgerItemView>,
    inboxError: String?,
    onRefresh: () -> Unit,
    onOpenAlert: (AlertLedgerItemView) -> Unit,
    onUnlockDetail: () -> Unit,
    onSubmitFeedback: (String, String) -> Unit,
    onQuietAlertType: (String) -> Unit,
    onDisableAlertType: (String) -> Unit
) {
    var selectedSegment by rememberSaveable { mutableStateOf(Phase4Copy.inboxSegments.first()) }
    val filteredAlerts = remember(alerts, selectedSegment) {
        when (selectedSegment) {
            "Thesis Drift" -> alerts.filter { it.category == "thesis_drift" }
            "Earnings" -> alerts.filter { it.category == "earnings" }
            "Macro" -> alerts.filter { it.category == "macro" }
            "System" -> alerts.filter { it.category == "system" }
            else -> alerts
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding),
        contentPadding = PaddingValues(
            horizontal = ThesisDimens.ScreenPaddingHorizontal,
            vertical = ThesisDimens.SpacingLg
        ),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingLg)
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
                Text(
                    text = Phase4Copy.inboxHeadline,
                    style = ThesisTypography.headlineLarge.copy(
                        fontFamily = HeadingFont,
                        fontWeight = FontWeight.Normal
                    ),
                    color = ThesisColors.TextPrimary
                )
                Text(
                    text = Phase4Copy.inboxSubtitle,
                    style = ThesisTypography.bodyMedium,
                    color = ThesisColors.TextMuted
                )
            }
        }
        item {
            FilterRow(
                options = Phase4Copy.inboxSegments,
                selected = selectedSegment,
                onSelect = { selectedSegment = it }
            )
        }
        item {
            OutlinedButton(
                onClick = onRefresh,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
            ) {
                Text(Phase4Copy.inboxRefreshLabel, color = ThesisColors.TextMuted)
            }
        }

        if (!inboxError.isNullOrBlank()) {
            item {
                MessageCard(
                    title = Phase4Copy.inboxUnavailableTitle,
                    body = inboxError
                )
            }
        } else if (alerts.isEmpty()) {
            item {
                MessageCard(
                    title = Phase4Copy.inboxEmptyTitle,
                    body = Phase4Copy.inboxEmptyBody
                )
            }
        } else if (filteredAlerts.isEmpty()) {
            item {
                MessageCard(
                    title = Phase4Copy.inboxFilteredEmptyTitle,
                    body = Phase4Copy.inboxFilteredEmptyBody
                )
            }
        } else {
            items(filteredAlerts, key = { it.id }) { alert ->
                InboxRowCard(
                    alert = alert,
                    onOpen = { onOpenAlert(alert) },
                    onUnlockDetail = onUnlockDetail,
                    onUseful = { onSubmitFeedback(alert.id, "useful") },
                    onNotUseful = { onSubmitFeedback(alert.id, "not_useful") },
                    onQuietAlertType = { onQuietAlertType(alert.id) },
                    onDisableAlertType = { onDisableAlertType(alert.notificationType) }
                )
            }
        }
    }
}

@Composable
private fun InboxRowCard(
    alert: AlertLedgerItemView,
    onOpen: () -> Unit,
    onUnlockDetail: () -> Unit,
    onUseful: () -> Unit,
    onNotUseful: () -> Unit,
    onQuietAlertType: () -> Unit,
    onDisableAlertType: () -> Unit
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
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(ThesisDimens.SignalBadgeCorner))
                    .background(ThesisColors.Primary.copy(alpha = 0.1f))
                    .padding(horizontal = ThesisDimens.SpacingSm, vertical = ThesisDimens.SpacingXs)
            ) {
                Text(
                    text = Phase4Copy.alertCategoryLabel(alert.category).uppercase(),
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.Primary
                )
            }
            Text(
                text = formatAlertTimestamp(alert.createdAt),
                style = ThesisTypography.bodySmall,
                color = ThesisColors.TextMuted
            )
        }

        Text(
            text = alert.title,
            style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.TextPrimary
        )
        Text(
            text = alert.body,
            style = ThesisTypography.bodyMedium,
            color = ThesisColors.TextSecondary
        )
        if (!alert.detailBody.isNullOrBlank()) {
            Text(
                text = alert.detailBody,
                style = ThesisTypography.bodyMedium,
                color = ThesisColors.TextPrimary
            )
        } else if (alert.detailLocked) {
            TextButton(onClick = onUnlockDetail) {
                Text(Phase4Copy.inboxUnlockDetailLabel, color = ThesisColors.Primary)
            }
        }
        Text(
            text = alert.reasonText,
            style = ThesisTypography.bodySmall,
            color = ThesisColors.TextMuted
        )
        if (!alert.ticker.isNullOrBlank() || alert.feedbackState != null || alert.mutedAt != null) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = listOfNotNull(
                        alert.ticker?.takeIf { it.isNotBlank() },
                        alert.feedbackState?.let { "Feedback: ${it.replace('_', ' ')}" },
                        alert.mutedAt?.let { Phase4Copy.inboxQuietedBadge }
                    ).joinToString("  ·  "),
                    style = ThesisTypography.bodySmall,
                    color = ThesisColors.TextMuted
                )
            }
        }

        HorizontalDivider(color = ThesisColors.Border)

        Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
            Button(
                onClick = onOpen,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                colors = ButtonDefaults.buttonColors(
                    containerColor = ThesisColors.Primary,
                    contentColor = ThesisColors.TextInverse
                )
            ) {
                Text(Phase4Copy.inboxOpenLabel)
            }
            OutlinedButton(
                onClick = onUseful,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
            ) {
                Text(Phase4Copy.inboxUsefulLabel, color = ThesisColors.TextMuted)
            }
            OutlinedButton(
                onClick = onNotUseful,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
            ) {
                Text(Phase4Copy.inboxNotUsefulLabel, color = ThesisColors.TextMuted)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
            OutlinedButton(
                onClick = onQuietAlertType,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
            ) {
                Text(Phase4Copy.inboxQuiet24hLabel, color = ThesisColors.TextMuted)
            }
            OutlinedButton(
                onClick = onDisableAlertType,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
            ) {
                Text(Phase4Copy.inboxTurnOffTypeLabel, color = ThesisColors.TextMuted)
            }
        }
    }
}

@Composable
private fun FilterRow(options: List<String>, selected: String, onSelect: (String) -> Unit) {
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
private fun MessageCard(title: String, body: String) {
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

private fun formatAlertTimestamp(raw: String): String = runCatching {
    Instant.parse(raw)
        .atZone(ZoneId.of("America/New_York"))
        .format(DateTimeFormatter.ofPattern("MMM d, HH:mm z"))
}.getOrElse { raw }
