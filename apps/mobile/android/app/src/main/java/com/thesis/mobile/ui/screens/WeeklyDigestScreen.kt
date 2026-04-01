package com.thesis.mobile.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.SectionView
import com.thesis.mobile.model.SentimentSnapshotView
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@Composable
fun WeeklyDigestScreen(
    digestDate: String?,
    sentimentCurrent: SentimentSnapshotView?,
    watchlist: List<String>,
    pulse: PulseReportView?,
    onOpenDashboard: () -> Unit,
    onBack: () -> Unit
) {
    val highlights = pulse?.sections
        ?.filterNot { it.title.contains("watchlist", ignoreCase = true) }
        ?.take(3)
        .orEmpty()
    val dateLabel = digestDate
        ?.takeIf { it.isNotBlank() }
        ?: LocalDate.now().format(DateTimeFormatter.ISO_DATE)

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            start = ThesisDimens.ScreenPaddingHorizontal,
            end = ThesisDimens.ScreenPaddingHorizontal,
            top = ThesisDimens.ScreenPaddingTop,
            bottom = ThesisDimens.ScreenPaddingBottom
        ),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingLg)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Button(
                    onClick = onBack,
                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                        containerColor = ThesisColors.DarkSurface,
                        contentColor = ThesisColors.TextPrimaryDark
                    )
                ) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Back")
                }
                Text(
                    text = "Weekly Digest",
                    style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                    color = ThesisColors.TextPrimaryDark
                )
            }
        }

        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                colors = CardDefaults.cardColors(containerColor = ThesisColors.DarkSurfaceHigh)
            ) {
                Column(
                    modifier = Modifier.padding(ThesisDimens.CardPadding),
                    verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
                ) {
                    Text(
                        text = "Digest date: $dateLabel",
                        style = ThesisTypography.labelMedium,
                        color = ThesisColors.TextSecondaryDark
                    )
                    Text(
                        text = sentimentHeadline(sentimentCurrent),
                        style = ThesisTypography.bodyLarge.copy(fontWeight = FontWeight.Bold),
                        color = ThesisColors.TextPrimaryDark
                    )
                    Text(
                        text = "Watchlist coverage: ${watchlist.size} name(s).",
                        style = ThesisTypography.bodySmall,
                        color = ThesisColors.TextSecondaryDark
                    )
                    Button(
                        onClick = onOpenDashboard,
                        colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                            containerColor = ThesisColors.AccentBlue,
                            contentColor = Color.White
                        )
                    ) {
                        Text("Open Fear & Greed Dashboard")
                    }
                }
            }
        }

        item {
            Text(
                text = "This Week's Highlights",
                style = ThesisTypography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                color = ThesisColors.TextPrimaryDark
            )
        }

        if (highlights.isEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                    colors = CardDefaults.cardColors(containerColor = ThesisColors.DarkSurface)
                ) {
                    Text(
                        text = "No highlights are available yet. Pull the latest Pulse to populate this digest.",
                        style = ThesisTypography.bodySmall,
                        color = ThesisColors.TextSecondaryDark,
                        modifier = Modifier.padding(ThesisDimens.CardPadding)
                    )
                }
            }
        } else {
            items(highlights) { section ->
                DigestHighlightCard(section)
            }
        }
    }
}

@Composable
private fun DigestHighlightCard(section: SectionView) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
        colors = CardDefaults.cardColors(containerColor = ThesisColors.DarkSurface)
    ) {
        Column(
            modifier = Modifier.padding(ThesisDimens.CardPadding),
            verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
        ) {
            Text(
                text = section.title,
                style = ThesisTypography.bodyLarge.copy(fontWeight = FontWeight.Bold),
                color = ThesisColors.TextPrimaryDark
            )
            Text(
                text = summarizeDigestBody(section.body),
                style = ThesisTypography.bodySmall,
                color = ThesisColors.TextSecondaryDark
            )
        }
    }
}

private fun sentimentHeadline(snapshot: SentimentSnapshotView?): String {
    if (snapshot == null) {
        return "Fear & Greed data is not available yet."
    }
    val label = snapshot.label
        .replace('_', ' ')
        .split(' ')
        .joinToString(" ") { token -> token.replaceFirstChar { it.uppercase() } }
    return "Fear & Greed is ${snapshot.score.toInt()} ($label)."
}

private fun summarizeDigestBody(body: String): String {
    val normalized = body.replace(Regex("\\s+"), " ").trim()
    if (normalized.isBlank()) {
        return "No section summary was returned."
    }
    val sentence = normalized.split(". ").firstOrNull().orEmpty().trim().trimEnd('.')
    return if (sentence.length <= 180) sentence else sentence.take(179).trimEnd() + "…"
}
