package com.thesis.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Newspaper
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun HistoryScreen(
    historyItems: List<ReportHistoryItem>,
    onBack: () -> Unit,
    onOpenReport: (ReportHistoryItem) -> Unit
) {
    val groupedItems = remember(historyItems) {
        historyItems
            .sortedByDescending { it.createdAt }
            .groupBy { item -> labelForDate(item.createdAt) }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ThesisColors.DarkBackground)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(64.dp)
                .padding(horizontal = ThesisDimens.SpacingSm),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(
                    imageVector = Icons.Default.ArrowBack,
                    contentDescription = "Back",
                    tint = ThesisColors.AccentBlue
                )
            }
            Spacer(modifier = Modifier.width(ThesisDimens.SpacingXs))
            Text(
                text = "Your History",
                style = ThesisTypography.headlineLarge.copy(fontWeight = FontWeight.Bold),
                color = ThesisColors.TextPrimaryDark
            )
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(
                start = ThesisDimens.ScreenPaddingHorizontal,
                end = ThesisDimens.ScreenPaddingHorizontal,
                top = ThesisDimens.SpacingMd,
                bottom = ThesisDimens.ScreenPaddingBottom + 64.dp
            ),
            verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingLg)
        ) {
            groupedItems.forEach { (group, itemsForGroup) ->
                item {
                    Text(
                        text = group,
                        style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.5.sp),
                        color = ThesisColors.TextTertiaryDark
                    )
                }

                items(itemsForGroup) { item ->
                    HistoryCard(
                        item = item,
                        modifier = Modifier.clickable { onOpenReport(item) }
                    )
                }
            }
        }
    }
}

@Composable
private fun HistoryCard(
    item: ReportHistoryItem,
    modifier: Modifier = Modifier
) {
    val isPulse = item.type == "market_pulse"
    val icon: ImageVector = if (isPulse) Icons.Default.Newspaper else Icons.Default.Search
    val iconTint = if (isPulse) ThesisColors.AccentBlueLight else ThesisColors.AccentBlue
    val badgeColor = if (isPulse) ThesisColors.SignalNeutral else ThesisColors.AccentBlue
    val title = if (isPulse) "Market Pulse" else "${item.ticker ?: "Ticker"} Deep Dive"
    val subtitle = if (isPulse) {
        "Daily market briefing"
    } else {
        "Company research report"
    }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(ThesisColors.DarkSurfaceHigh)
            .border(1.dp, ThesisColors.DarkBorder.copy(alpha = 0.5f), RoundedCornerShape(16.dp))
            .padding(ThesisDimens.SpacingLg),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            modifier = Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(ThesisColors.DarkSurface),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = iconTint,
                    modifier = Modifier.size(20.dp)
                )
            }

            Spacer(modifier = Modifier.width(ThesisDimens.SpacingLg))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.TextPrimaryDark
                )
                Text(
                    text = "${formatTime(item.createdAt)}  •  $subtitle",
                    style = ThesisTypography.labelSmall,
                    color = ThesisColors.TextTertiaryDark
                )
            }
        }

        Box(
            modifier = Modifier
                .size(10.dp)
                .clip(CircleShape)
                .background(badgeColor)
        )
    }
}

private fun labelForDate(rawCreatedAt: String): String {
    val createdDate = runCatching {
        Instant.parse(rawCreatedAt).atZone(ZoneId.systemDefault()).toLocalDate()
    }.getOrNull() ?: return "OLDER"

    val today = LocalDate.now()
    val yesterday = today.minusDays(1)
    return when (createdDate) {
        today -> "TODAY"
        yesterday -> "YESTERDAY"
        else -> createdDate.format(DateTimeFormatter.ofPattern("MMMM d")).uppercase()
    }
}

private fun formatTime(rawCreatedAt: String): String =
    runCatching {
        Instant.parse(rawCreatedAt)
            .atZone(ZoneId.systemDefault())
            .format(DateTimeFormatter.ofPattern("HH:mm"))
    }.getOrElse { "--:--" }
