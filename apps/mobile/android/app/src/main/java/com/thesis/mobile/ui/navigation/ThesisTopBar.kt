package com.thesis.mobile.ui.navigation

import androidx.compose.runtime.Composable
import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.ui.components.Avatar
import com.thesis.mobile.ui.components.ThesisIconButton
import com.thesis.mobile.ui.components.ThesisTopBar
import com.thesis.mobile.ui.icons.ThesisIcons
import java.time.LocalDate
import java.time.OffsetDateTime

/**
 * Root top bar of the four tabs (DESIGN-DIRECTION 5.5, kit `ThesisTopBar` 3 #3): the `THESIS` brand on the left,
 * Search and the You avatar (initials, 3 #36) on the right. The bell is gone (Inbox is a tab). The avatar has no
 * selected tint (accent is the brand's, 2.8).
 */
@Composable
fun ShellRootTopBar(
    initials: String,
    onOpenSearch: () -> Unit,
    onOpenProfile: () -> Unit
) {
    ThesisTopBar(
        actions = {
            ThesisIconButton(ThesisIcons.Search, contentDescription = "Search", onClick = onOpenSearch)
            Avatar(initials = initials, onClick = onOpenProfile, contentDescription = "You")
        }
    )
}

/**
 * Top bar of a pushed screen that has no header of its own: back and the [title] (none when blank, because the
 * screen carries its own headline: no repeated words, rubric V3).
 */
@Composable
fun ThesisBackTopBar(title: String, onBack: () -> Unit) {
    ThesisTopBar(title = title.ifBlank { null }, onBack = onBack, titleAlwaysVisible = title.isNotBlank())
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
