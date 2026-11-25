package com.thesis.mobile.ui.navigation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisTypography
import java.time.LocalDate
import java.time.OffsetDateTime

/**
 * Root top bar of the four tabs (DESIGN-DIRECTION 5.5): brand on the left, Search and the You avatar on the
 * right. The bell is gone (Inbox is a tab). [profileSelected] is true while You is open on the modal stack.
 */
@Composable
fun ThesisTopBar(
    profileSelected: Boolean,
    onOpenSearch: () -> Unit,
    onOpenProfile: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(ThesisColors.Background)
            .statusBarsPadding()
            .heightIn(min = 56.dp)
            .padding(start = ThesisDimens.ScreenPaddingHorizontal, end = ThesisDimens.SpacingSm),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Brand as the accent eyebrow (component #3). labelSmall is the M3 slot F1 remaps to `eyebrow` (2.3).
        Text(
            text = "THESIS",
            style = ThesisTypography.labelSmall,
            color = ThesisColors.Primary,
            modifier = Modifier
                .weight(1f)
                .semantics { heading() }
        )
        IconButton(onClick = onOpenSearch) {
            Icon(
                imageVector = Icons.Filled.Search,
                contentDescription = "Search",
                tint = ThesisColors.TextSecondary
            )
        }
        IconButton(onClick = onOpenProfile) {
            Icon(
                imageVector = Icons.Filled.AccountCircle,
                contentDescription = "You",
                tint = if (profileSelected) ThesisColors.Primary else ThesisColors.TextSecondary
            )
        }
    }
}

/** Top bar of a pushed screen that has no header of its own: back arrow and title. */
@Composable
fun ThesisBackTopBar(title: String, onBack: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(ThesisColors.Background)
            .statusBarsPadding()
            .heightIn(min = 56.dp)
            .padding(horizontal = ThesisDimens.SpacingXs),
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconButton(onClick = onBack) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "Back",
                tint = ThesisColors.TextPrimary
            )
        }
        Text(
            text = title,
            style = ThesisTypography.titleMedium.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.TextPrimary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f, fill = false).semantics { heading() }
        )
    }
}

/** Back row for screens that are opened from a Deep Dive or a name, not from a tab. */
@Composable
fun SubScreenBackRow(title: String, onBack: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = ThesisDimens.SpacingSm),
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconButton(onClick = onBack) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "Back",
                tint = ThesisColors.Primary
            )
        }
        Text(
            text = title,
            style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.TextPrimary
        )
    }
}

/**
 * Ticker -> War Room id for names inside their earnings window. The window comes from the
 * earnings War Room alerts the server already sends (event date, else alert date):
 * from 3 days before to 7 days after.
 */
fun warRoomsInEarningsWindow(
    alerts: List<AlertLedgerItemView>,
    today: LocalDate = LocalDate.now()
): Map<String, String> =
    alerts
        .asSequence()
        .filter { it.notificationType == "earnings_war_room" }
        .mapNotNull { alert ->
            val ticker = alert.ticker?.trim()?.uppercase()?.ifBlank { null } ?: return@mapNotNull null
            val warRoomId = alert.warRoomId?.trim()?.ifBlank { null } ?: return@mapNotNull null
            val anchor = parseDay(alert.eventDate) ?: parseDay(alert.createdAt) ?: return@mapNotNull null
            if (today.isBefore(anchor.minusDays(3)) || today.isAfter(anchor.plusDays(7))) {
                return@mapNotNull null
            }
            Triple(ticker, warRoomId, alert.createdAt)
        }
        .sortedBy { it.third }
        .associate { (ticker, warRoomId, _) -> ticker to warRoomId }

private fun parseDay(raw: String?): LocalDate? {
    val value = raw?.trim()?.ifBlank { null } ?: return null
    return runCatching { LocalDate.parse(value.take(10)) }.getOrNull()
        ?: runCatching { OffsetDateTime.parse(value).toLocalDate() }.getOrNull()
}
