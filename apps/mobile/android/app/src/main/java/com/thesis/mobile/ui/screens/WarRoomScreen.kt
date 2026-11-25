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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.thesis.mobile.model.WarRoomPhaseView
import com.thesis.mobile.model.WarRoomView
import com.thesis.mobile.ui.copy.Phase4Copy
import com.thesis.mobile.ui.theme.HeadingFont
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun WarRoomScreen(
    warRoom: WarRoomView?,
    errorMessage: String?,
    onRefresh: () -> Unit,
    padding: PaddingValues
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding)
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                top = ThesisDimens.ScreenPaddingTop,
                bottom = ThesisDimens.ScreenPaddingBottom,
                start = ThesisDimens.ScreenPaddingHorizontal,
                end = ThesisDimens.ScreenPaddingHorizontal
            ),
            verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingLg)
        ) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
                    Text(
                        text = Phase4Copy.researchWarRoomLabel,
                        style = ThesisTypography.displayMedium.copy(
                            fontFamily = HeadingFont,
                            fontWeight = FontWeight.Normal
                        ),
                        color = ThesisColors.TextPrimary
                    )
                    Text(
                        text = Phase4Copy.researchWarRoomSubtitle,
                        style = ThesisTypography.bodyMedium,
                        color = ThesisColors.TextMuted
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
                    verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)
                ) {
                    Text(
                        text = warRoom?.title ?: "Waiting for an earnings room",
                        style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
                        color = ThesisColors.TextPrimary
                    )
                    if (!warRoom?.warRoomId.isNullOrBlank()) {
                        Text(
                            text = "Room ${warRoom?.warRoomId}",
                            style = ThesisTypography.bodySmall,
                            color = ThesisColors.TextMuted
                        )
                    }
                    if (!warRoom?.ticker.isNullOrBlank()) {
                        Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
                            infoBadge("Ticker", warRoom?.ticker ?: "")
                            warRoom?.status?.let { status ->
                                infoBadge("Status", status.uppercase())
                            }
                        }
                    }
                    warRoom?.generatedAt?.let { generatedAt ->
                        Text(
                            text = "Updated ${formatTimestamp(generatedAt)}",
                            style = ThesisTypography.labelSmall,
                            color = ThesisColors.TextMuted
                        )
                    }
                    warRoom?.summary?.takeIf { it.isNotBlank() }?.let { summary ->
                        Text(
                            text = summary,
                            style = ThesisTypography.bodyMedium,
                            color = ThesisColors.TextSecondary
                        )
                    }
                    if (warRoom?.relatedTickers.orEmpty().isNotEmpty()) {
                        Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
                            warRoom?.relatedTickers.orEmpty().take(4).forEach { ticker ->
                                infoBadge("Related", ticker)
                            }
                        }
                    }
                    Button(
                        onClick = onRefresh,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = ThesisColors.SurfaceElevated,
                            contentColor = ThesisColors.TextPrimary
                        )
                    ) {
                        Text("Refresh War Room")
                    }
                }
            }

            if (!errorMessage.isNullOrBlank()) {
                item {
                    MessageCard(
                        title = "War Room unavailable",
                        body = errorMessage
                    )
                }
            }

            if (warRoom == null) {
                item {
                    MessageCard(
                        title = "No War Room loaded",
                        body = "Open an earnings war room notification to load pre-open, live, and post-close summaries."
                    )
                }
            } else if (warRoom.phases.isEmpty()) {
                item {
                    MessageCard(
                        title = "No phase summaries yet",
                        body = "This room will fill in as the earnings event moves through pre, live, and post stages."
                    )
                }
            } else {
                items(warRoom.phases.size) { index ->
                    WarRoomPhaseCard(phase = warRoom.phases[index])
                }
            }
        }
    }
}

@Composable
private fun WarRoomPhaseCard(phase: WarRoomPhaseView) {
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
            text = phase.phase.uppercase(),
            style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
            color = phaseAccentColor(phase.phase)
        )
        Text(
            text = phase.title,
            style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.TextPrimary
        )
        phase.status?.takeIf { it.isNotBlank() }?.let { status ->
            infoBadge("State", status.uppercase())
        }

        Text(
            text = phase.summary,
            style = ThesisTypography.bodyMedium,
            color = ThesisColors.TextSecondary
        )

        if (phase.highlights.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXs)) {
                phase.highlights.forEach { highlight ->
                    Row(verticalAlignment = Alignment.Top) {
                        Text(
                            text = "-",
                            style = ThesisTypography.bodyMedium,
                            color = ThesisColors.Primary
                        )
                        Spacer(modifier = Modifier.size(ThesisDimens.SpacingXs))
                        Text(
                            text = highlight,
                            style = ThesisTypography.bodyMedium,
                            color = ThesisColors.TextSecondary
                        )
                    }
                }
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
            phase.ticker?.takeIf { it.isNotBlank() }?.let { ticker ->
                infoBadge("Ticker", ticker)
            }
            phase.route?.takeIf { it.isNotBlank() }?.let { route ->
                infoBadge("Route", route.replace('_', ' ').uppercase())
            }
            phase.reportId?.takeIf { it.isNotBlank() }?.let { reportId ->
                infoBadge("Report", reportId)
            }
            phase.updatedAt?.takeIf { it.isNotBlank() }?.let { updatedAt ->
                infoBadge("Updated", formatTimestamp(updatedAt))
            }
        }
    }
}

@Composable
private fun infoBadge(label: String, value: String) {
    Text(
        text = "$label: $value",
        style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
        color = ThesisColors.TextPrimary,
        modifier = Modifier
            .clip(RoundedCornerShape(ThesisDimens.SignalBadgeCorner))
            .background(ThesisColors.SurfaceElevated)
            .padding(horizontal = ThesisDimens.SpacingSm, vertical = ThesisDimens.SpacingXs)
    )
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

@Composable
@ReadOnlyComposable
private fun phaseAccentColor(phase: String) = when (phase.lowercase()) {
    "pre" -> ThesisColors.SignalNeutral
    "live" -> ThesisColors.Primary
    "post" -> ThesisColors.SignalPositive
    else -> ThesisColors.TextMuted
}

private fun formatTimestamp(raw: String): String = runCatching {
    Instant.parse(raw)
        .atZone(ZoneId.of("America/New_York"))
        .format(DateTimeFormatter.ofPattern("MMM d, HH:mm z"))
}.getOrElse { raw }
