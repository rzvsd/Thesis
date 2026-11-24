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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.LightMode
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.SectionView
import com.thesis.mobile.model.SentimentSnapshotView
import com.thesis.mobile.model.ThesisMonitorSnapshotView
import com.thesis.mobile.ui.theme.HeadingFont
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography

@Composable
fun WeeklyDigestScreen(
    digestDate: String?,
    sentimentCurrent: SentimentSnapshotView?,
    watchlist: List<String>,
    monitorSnapshots: List<ThesisMonitorSnapshotView>,
    pulse: PulseReportView?,
    onOpenDashboard: () -> Unit,
    onBack: () -> Unit
) {
    val sections = pulse?.sections?.filter { it.body.isNotBlank() }.orEmpty()
    val scoreText = sentimentCurrent?.score?.toInt()?.toString() ?: "--"
    val labelText = sentimentCurrent?.label
        ?.replace("_", " ")
        ?.replaceFirstChar { it.uppercase() }
        ?: "Unavailable"

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
            verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXxl)
        ) {
            item {
                Column {
                    Text(
                        text = "Weekly Digest",
                        style = ThesisTypography.displayMedium.copy(
                            fontFamily = HeadingFont,
                            fontWeight = FontWeight.Normal
                        ),
                        color = ThesisColors.TextPrimary
                    )
                    Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                    Text(
                        text = digestDate?.let { "Week of $it" } ?: "Latest digest",
                        style = ThesisTypography.bodyLarge,
                        color = ThesisColors.TextMuted
                    )
                }
            }

            item {
                val shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(shape)
                        .background(ThesisColors.Surface)
                        .border(ThesisDimens.BorderWidth, ThesisColors.Border, shape)
                        .padding(ThesisDimens.CardPadding),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.LightMode,
                            contentDescription = null,
                            tint = ThesisColors.Primary,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.size(ThesisDimens.SpacingMd))
                        Column {
                            Text(
                                text = "Macro Stress",
                                style = ThesisTypography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                                color = ThesisColors.TextPrimary
                            )
                            Text(
                                text = labelText,
                                style = ThesisTypography.labelSmall,
                                color = sentimentColorDigest(sentimentCurrent?.label)
                            )
                        }
                    }

                    Text(
                        text = scoreText,
                        style = ThesisTypography.headlineLarge.copy(
                            fontFamily = HeadingFont,
                            fontWeight = FontWeight.Normal
                        ),
                        color = ThesisColors.TextPrimary
                    )
                }
            }

            if (watchlist.isNotEmpty()) {
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
                        Text(
                            text = "Names Tracked",
                            style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
                            color = ThesisColors.TextPrimary
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)) {
                            watchlist.take(8).forEach { ticker ->
                                val state = monitorSnapshots.firstOrNull {
                                    it.ticker.equals(ticker, ignoreCase = true)
                                }?.state?.replaceFirstChar { it.uppercase() }
                                Text(
                                    text = if (state.isNullOrBlank()) ticker else "$ticker · $state",
                                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                                    color = ThesisColors.TextPrimary,
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(ThesisDimens.SignalBadgeCorner))
                                        .background(ThesisColors.SurfaceElevated)
                                        .border(
                                            ThesisDimens.BorderWidth,
                                            ThesisColors.Border,
                                            RoundedCornerShape(ThesisDimens.SignalBadgeCorner)
                                        )
                                        .padding(
                                            horizontal = ThesisDimens.SpacingSm,
                                            vertical = ThesisDimens.SpacingXs
                                        )
                                )
                            }
                        }
                    }
                }
            }

            if (sections.isEmpty()) {
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
                            text = "No weekly digest available yet. This feature updates every Sunday.",
                            style = ThesisTypography.bodyMedium,
                            color = ThesisColors.TextMuted
                        )
                    }
                }
            }

            items(sections.size) { index ->
                val section = sections[index]
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
                        Text(
                            text = section.title,
                            style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
                            color = ThesisColors.TextPrimary,
                            modifier = Modifier.weight(1f)
                        )
                        section.status?.let { status ->
                            Text(
                                text = status.uppercase(),
                                style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                                color = ThesisColors.TextMuted,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(ThesisDimens.SignalBadgeCorner))
                                    .background(ThesisColors.SurfaceElevated)
                                    .padding(
                                        horizontal = ThesisDimens.SpacingSm,
                                        vertical = ThesisDimens.SpacingXs
                                    )
                            )
                        }
                    }
                    Text(
                        text = truncateDigestBody(section.body),
                        style = ThesisTypography.bodyMedium,
                        color = ThesisColors.TextSecondary
                    )
                }
            }

            item {
                Button(
                    onClick = onOpenDashboard,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .semantics {
                            contentDescription = "Open Sentiment Dashboard"
                            role = Role.Button
                        },
                    shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = ThesisColors.SurfaceElevated,
                        contentColor = ThesisColors.TextPrimary
                    )
                ) {
                    Text(
                        text = "Open Sentiment Dashboard",
                        style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium)
                    )
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
                text = "Weekly Digest",
                style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Medium),
                color = ThesisColors.TextPrimary
            )
        }
    }
}

@Composable
@ReadOnlyComposable
private fun sentimentColorDigest(label: String?): Color = when (label?.lowercase()) {
    "extreme_fear", "fear" -> ThesisColors.SignalNegative
    "greed", "extreme_greed" -> ThesisColors.SignalPositive
    "neutral" -> ThesisColors.SignalNeutral
    else -> ThesisColors.TextMuted
}

private fun truncateDigestBody(body: String): String {
    val sentence = body.split(". ").firstOrNull()?.trim()?.trimEnd('.') ?: body.trim()
    return if (sentence.length <= 180) sentence else sentence.take(179).trimEnd() + "\u2026"
}
