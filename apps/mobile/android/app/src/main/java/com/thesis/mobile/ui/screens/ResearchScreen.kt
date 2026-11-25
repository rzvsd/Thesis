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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.ui.components.EmptyState
import com.thesis.mobile.ui.components.TextAction
import com.thesis.mobile.ui.components.ThesisButton
import com.thesis.mobile.ui.copy.StateCopy
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisTypography

/** How many recent reports the root lists; History ("See all") has the rest. */
private const val RECENT_REPORTS_SHOWN = 3

/**
 * The Research tab root (DESIGN-DIRECTION 5.12): ticker search, run a Deep Dive, recent reports. Also offered
 * by the Search modal until WP-E builds Search.
 *
 * Extracted from `DeepDiveScreen.kt` by F3 in PR-1 (its former search state), so the root and the report are
 * separate files: WP-E owns this one, WP-D the report. The look is unchanged from the old search state; WP-E
 * redraws it in PR-3. Running a Deep Dive pushes `DeepDiveRunning(ticker)` and an opened report is a
 * `Report(id)` entry, each showing its own progress and errors, so this root has no loading or error state.
 */
@Composable
fun ResearchScreen(
    ticker: String,
    recentHistory: List<ReportHistoryItem>,
    onTickerChange: (String) -> Unit,
    /** Starts a Deep Dive for [ticker]. */
    onRunReport: () -> Unit,
    onOpenReport: (reportId: String) -> Unit,
    onOpenPulse: (date: String) -> Unit,
    padding: PaddingValues,
    /**
     * Opens History, the full report list (5.12 "See all"). Shown under the three recent cards when there are more;
     * null hides it (the Search modal, which cannot push History under itself).
     */
    onSeeAllHistory: (() -> Unit)? = null
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding)
            .padding(ThesisDimens.ScreenPaddingHorizontal),
        contentAlignment = Alignment.Center
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
            // The empty state only while there is nothing to reopen (principle 11: the copy matches the screen).
            if (recentHistory.isEmpty()) {
                EmptyState(sentence = StateCopy.NO_REPORTS, how = StateCopy.noReportsHow, icon = ThesisIcons.Search)
            }
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "Start new research or reopen something you already explored.",
                    style = ThesisTypography.bodyMedium,
                    color = ThesisColors.TextMuted
                )
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingLg))
                OutlinedTextField(
                    value = ticker,
                    onValueChange = onTickerChange,
                    label = { Text("Ticker Symbol (e.g. AAPL)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(ThesisDimens.CardCornerRadius),
                    colors = researchFieldColors()
                )
                Spacer(modifier = Modifier.height(ThesisDimens.SpacingLg))
                ThesisButton(
                    text = "Run Deep Dive",
                    onClick = onRunReport,
                    enabled = ticker.isNotBlank()
                ) {
                    Text(
                        text = "Run Deep Dive",
                        style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium),
                        color = ThesisColors.TextInverse
                    )
                }
                if (recentHistory.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(ThesisDimens.SpacingXl))
                    Text(
                        text = "Continue Research",
                        style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium),
                        color = ThesisColors.TextPrimary
                    )
                    Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                    recentHistory
                        .sortedByDescending { it.createdAt }
                        .take(RECENT_REPORTS_SHOWN)
                        .forEach { item ->
                            RecentResearchCard(
                                item = item,
                                onClick = {
                                    if (item.type == "deep_dive") {
                                        onOpenReport(item.reportId)
                                    } else {
                                        onOpenPulse(item.createdAt.take(10))
                                    }
                                }
                            )
                            Spacer(modifier = Modifier.height(ThesisDimens.SpacingSm))
                        }
                    // Interim until WP-E's recent-reports RowGroup (PR-3): the way to reports older than these three.
                    if (onSeeAllHistory != null && recentHistory.size > RECENT_REPORTS_SHOWN) {
                        TextAction(
                            text = "See all",
                            onClick = onSeeAllHistory,
                            modifier = Modifier.align(Alignment.End),
                            trailing = true
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun RecentResearchCard(
    item: ReportHistoryItem,
    onClick: () -> Unit
) {
    val title = if (item.type == "deep_dive") {
        item.ticker?.let { "$it Deep Dive" } ?: "Deep Dive"
    } else {
        "Market Pulse"
    }
    val subtitle = if (item.type == "deep_dive") {
        "Open your last report"
    } else {
        "Open the saved pulse for ${item.createdAt.take(10)}"
    }
    val dateLabel = item.createdAt.take(10)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ThesisDimens.CardCornerRadius))
            .background(ThesisColors.Surface)
            .border(
                width = ThesisDimens.BorderWidth,
                color = ThesisColors.Border,
                shape = RoundedCornerShape(ThesisDimens.CardCornerRadius)
            )
            .clickable(onClick = onClick)
            .padding(ThesisDimens.SpacingMd),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXs)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = title,
                style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium),
                color = ThesisColors.TextPrimary,
                modifier = Modifier.weight(1f, fill = false).padding(end = ThesisDimens.SpacingSm)
            )
            // The date never breaks mid-number; the title gives way instead (A4).
            Text(
                text = dateLabel,
                style = ThesisTypography.labelSmall,
                color = ThesisColors.TextMuted,
                maxLines = 1,
                softWrap = false
            )
        }
        Text(
            text = subtitle,
            style = ThesisTypography.bodySmall,
            color = ThesisColors.TextMuted
        )
    }
}

/** Same colours as the report's fields (`DeepDiveScreen.kt`), kept here so the two files stay independent. */
@Composable
private fun researchFieldColors() = OutlinedTextFieldDefaults.colors(
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
