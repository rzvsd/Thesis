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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.LightMode
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.ui.theme.HeadingFont
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
            .toList()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ThesisColors.Background)
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                top = 56.dp + ThesisDimens.ScreenPaddingTop,
                bottom = ThesisDimens.ScreenPaddingBottom,
                start = ThesisDimens.ScreenPaddingHorizontal,
                end = ThesisDimens.ScreenPaddingHorizontal
            ),
            verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXl)
        ) {
            item {
                Text(
                    text = "History",
                    style = ThesisTypography.displayMedium.copy(
                        fontFamily = HeadingFont,
                        fontWeight = FontWeight.Normal
                    ),
                    color = ThesisColors.TextPrimary
                )
            }

            if (groupedItems.isEmpty()) {
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
                            text = "No history yet. Run a Deep Dive or open the latest Pulse.",
                            style = ThesisTypography.bodyMedium,
                            color = ThesisColors.TextMuted
                        )
                    }
                }
            }

            groupedItems.forEach { (dateLabel, itemsForGroup) ->
                item {
                    Text(
                        text = dateLabel,
                        style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                        color = ThesisColors.TextMuted,
                        modifier = Modifier.padding(
                            top = ThesisDimens.SpacingMd,
                            bottom = ThesisDimens.SpacingSm
                        )
                    )

                    val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(shape)
                            .background(ThesisColors.Surface)
                            .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
                    ) {
                        itemsForGroup.forEachIndexed { index, item ->
                            val itemLabel = item.ticker ?: item.type.replace("_", " ")
                                .replaceFirstChar { it.uppercase() }
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onOpenReport(item) }
                                    .padding(
                                        horizontal = ThesisDimens.CardPadding,
                                        vertical = ThesisDimens.SpacingLg
                                    )
                                    .semantics {
                                        contentDescription = "Open $itemLabel report from ${formatTime(item.createdAt)}"
                                        role = Role.Button
                                    },
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)
                            ) {
                                Icon(
                                    imageVector = if (item.type == "market_pulse") {
                                        Icons.Default.LightMode
                                    } else {
                                        Icons.Default.Description
                                    },
                                    contentDescription = null,
                                    tint = ThesisColors.Primary,
                                    modifier = Modifier.size(18.dp)
                                )

                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = itemLabel,
                                        style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                                        color = ThesisColors.TextPrimary,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Text(
                                        text = formatTime(item.createdAt),
                                        style = ThesisTypography.labelSmall,
                                        color = ThesisColors.TextMuted
                                    )
                                }

                                Text(
                                    text = item.type.replace("_", " ").uppercase(),
                                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                                    color = ThesisColors.TextMuted
                                )
                            }

                            if (index < itemsForGroup.lastIndex) {
                                HorizontalDivider(
                                    color = ThesisColors.BorderSubtle,
                                    thickness = ThesisDimens.BorderWidth,
                                    modifier = Modifier.padding(horizontal = ThesisDimens.CardPadding)
                                )
                            }
                        }
                    }
                }
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .background(ThesisColors.Background.copy(alpha = 0.97f))
                .padding(horizontal = ThesisDimens.SpacingSm),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(
                onClick = onBack,
                modifier = Modifier.semantics {
                    contentDescription = "Navigate back"
                    role = Role.Button
                }
            ) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = ThesisColors.Primary)
            }
            Text(
                text = "History",
                style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
                color = ThesisColors.TextPrimary
            )
        }
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

private fun formatTime(rawCreatedAt: String): String = runCatching {
    Instant.parse(rawCreatedAt)
        .atZone(ZoneId.systemDefault())
        .format(DateTimeFormatter.ofPattern("HH:mm"))
}.getOrElse { "--:--" }
