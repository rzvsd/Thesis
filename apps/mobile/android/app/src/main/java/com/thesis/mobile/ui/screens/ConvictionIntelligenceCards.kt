package com.thesis.mobile.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import com.thesis.mobile.model.ConvictionInsightCardView
import com.thesis.mobile.model.ConvictionJournalEntryView
import com.thesis.mobile.model.OppositeCaseReportView
import com.thesis.mobile.ui.charts.kit.Timeline
import com.thesis.mobile.ui.charts.kit.TimelineItem
import com.thesis.mobile.ui.charts.kit.TimelineState
import com.thesis.mobile.ui.components.BannerTone
import com.thesis.mobile.ui.components.Callout
import com.thesis.mobile.ui.components.DataRow
import com.thesis.mobile.ui.components.InlineBanner
import com.thesis.mobile.ui.components.Kicker
import com.thesis.mobile.ui.components.RowGroup
import com.thesis.mobile.ui.components.SecondaryButton
import com.thesis.mobile.ui.components.SectionHeader
import com.thesis.mobile.ui.components.SkeletonCard
import com.thesis.mobile.ui.components.TextAction
import com.thesis.mobile.ui.components.ThesisCard
import com.thesis.mobile.ui.copy.DeepDiveCopy
import com.thesis.mobile.ui.format.LocalFmt
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.format.Fmt
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/*
 * Conviction journal, opposite case (the Deep Dive's "Your notes" chapter and the new view's Conviction tool) and
 * monthly coherence (Settings). Kit components only (5.15 "Conviction cards"): the journal is a Timeline with human
 * event labels and relative dates; the opposite case shows a skeleton while it is built; the Pro upsell is shown
 * once, as a Callout.
 */

private const val JOURNAL_SHOWN = 5
private const val POINTS_SHOWN = 3

/** An ISO timestamp as an instant, or null. */
internal fun parseInstant(raw: String?): Instant? {
    val s = raw?.trim().orEmpty()
    if (s.isEmpty()) return null
    return runCatching { Instant.parse(s) }.getOrNull() ?: runCatching { OffsetDateTime.parse(s).toInstant() }.getOrNull()
}

/** An ISO date ("2025-10-01", or a timestamp that starts with one) as a date, or null. */
internal fun parseIsoDate(raw: String?): LocalDate? {
    val s = raw?.trim().orEmpty()
    if (s.length < ISO_DATE_LENGTH) return null
    return runCatching { LocalDate.parse(s.take(ISO_DATE_LENGTH)) }.getOrNull()
}

private const val ISO_DATE_LENGTH = 10
private val MonthYear = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.US)

/**
 * A coherence card's period for its caption: "October 2025" for a whole calendar month, else the range as Fmt writes
 * it ("1 to 15 Oct", "27 Oct to 2 Nov 2025"). The API sends ISO dates; a value that does not parse is shown as sent,
 * and null when there is nothing to show.
 */
internal fun coherencePeriod(start: String?, end: String?, fmt: Fmt): String? {
    val s = parseIsoDate(start)
    val e = parseIsoDate(end)
    if (s != null && e != null && !e.isBefore(s)) {
        val wholeMonth = s.dayOfMonth == 1 && e == s.withDayOfMonth(s.lengthOfMonth())
        return if (wholeMonth) s.format(MonthYear) else fmt.weekRange(s, e)
    }
    if (s != null && e == null) return fmt.shortDate(s)
    val a = start?.trim().orEmpty()
    val b = end?.trim().orEmpty()
    return when {
        a.isNotEmpty() && b.isNotEmpty() -> DeepDiveCopy.periodRange(a, b)
        else -> a.ifEmpty { b }.ifEmpty { null }
    }
}

/** The Pro upsell, once: what the feature is, and the way to Pro. */
@Composable
private fun ProUpsell(text: String, onUpgrade: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
        Callout(text)
        TextAction(DeepDiveCopy.seePro, onClick = onUpgrade, trailing = true)
    }
}

/**
 * The conviction tools: the journal and the opposite case, or for a free user the one Pro upsell ([upsell]: the
 * classic page passes [DeepDiveCopy.deskPro] so the what-if model needs no upsell of its own).
 */
@Composable
fun DeepDiveConvictionSection(
    isPro: Boolean,
    timeline: List<ConvictionJournalEntryView>,
    timelineError: String?,
    oppositeCase: OppositeCaseReportView?,
    oppositeCaseError: String?,
    isGeneratingOppositeCase: Boolean,
    onGenerateOppositeCase: () -> Unit,
    onRefreshTimeline: () -> Unit,
    onRequireUpgrade: (String) -> Unit,
    upsell: String = DeepDiveCopy.convictionPro,
) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.l)) {
        SectionHeader(
            kicker = DeepDiveCopy.convictionKicker,
            headline = DeepDiveCopy.convictionTitle,
            deck = DeepDiveCopy.convictionDeck,
        )
        if (!isPro) {
            ProUpsell(upsell) { onRequireUpgrade("conviction_intelligence") }
            return@Column
        }
        JournalCard(timeline, timelineError, onRefreshTimeline)
        OppositeCaseCard(oppositeCase, oppositeCaseError, isGeneratingOppositeCase, onGenerateOppositeCase)
    }
}

@Composable
private fun JournalCard(timeline: List<ConvictionJournalEntryView>, errorMessage: String?, onRefresh: () -> Unit) {
    val p = LocalThesisPalette.current
    val fmt = LocalFmt.current
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
        Kicker(DeepDiveCopy.journalTitle)
        errorMessage?.takeIf { it.isNotBlank() }?.let {
            InlineBanner(it, tone = BannerTone.Error, actionLabel = DeepDiveCopy.refresh, onAction = onRefresh)
        }
        if (timeline.isEmpty()) {
            // After a failed load the journal's content is unknown: the banner says so, with no "nothing yet" line.
            if (errorMessage.isNullOrBlank()) Text(DeepDiveCopy.journalEmpty, style = ThesisType.bodySmall, color = p.muted)
        } else {
            Timeline(
                timeline.take(JOURNAL_SHOWN).mapIndexed { i, item ->
                    TimelineItem(
                        title = item.title,
                        meta = listOfNotNull(
                            journalEventLabel(item.title, item.eventType),
                            parseInstant(item.eventAt)?.let(fmt::relative),
                        ).joinToString(" · "),
                        body = item.summary.takeIf { it.isNotBlank() },
                        state = if (i == 0) TimelineState.Current else TimelineState.Done,
                    )
                },
            )
        }
        if (errorMessage.isNullOrBlank()) TextAction(DeepDiveCopy.refresh, onClick = onRefresh)
    }
}

/** The event's label for the meta line, or null when the entry's title already says it ("Opposite case built"). */
internal fun journalEventLabel(title: String, eventType: String): String? =
    DeepDiveCopy.eventLabel(eventType).takeUnless { it.equals(title.trim(), ignoreCase = true) }

@Composable
private fun OppositeCaseCard(
    oppositeCase: OppositeCaseReportView?,
    errorMessage: String?,
    isGenerating: Boolean,
    onGenerate: () -> Unit,
) {
    val p = LocalThesisPalette.current
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
        Kicker(DeepDiveCopy.oppositeTitle)
        when {
            isGenerating -> SkeletonCard(bodyLines = POINTS_SHOWN)
            oppositeCase == null -> {
                errorMessage?.takeIf { it.isNotBlank() }?.let { InlineBanner(it, tone = BannerTone.Error) }
                Text(DeepDiveCopy.oppositeEmpty, style = ThesisType.body, color = p.ink2)
                SecondaryButton(DeepDiveCopy.oppositeBuild, onClick = onGenerate)
            }
            else -> ThesisCard(title = oppositeCase.oppositeCaseSummary) {
                Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
                    oppositeCase.keyPoints.take(POINTS_SHOWN).forEach { point ->
                        Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.xs)) {
                            Text(point.title, style = ThesisType.rowTitle, color = p.ink)
                            Text(point.summary, style = ThesisType.bodySmall, color = p.ink2)
                        }
                    }
                    if (oppositeCase.decisiveFactors.isNotEmpty()) {
                        Kicker(DeepDiveCopy.decisiveFactors)
                        oppositeCase.decisiveFactors.take(POINTS_SHOWN).forEach {
                            Text(it, style = ThesisType.bodySmall, color = p.ink2)
                        }
                    }
                }
            }
        }
        if (isGenerating) {
            Text(DeepDiveCopy.oppositeBuilding, style = ThesisType.caption, color = p.muted)
        }
    }
}

@Composable
fun MonthlyCoherenceSection(
    isPro: Boolean,
    insights: List<ConvictionInsightCardView>,
    errorMessage: String?,
    onRefresh: () -> Unit,
    onRequireUpgrade: (String) -> Unit,
) {
    val p = LocalThesisPalette.current
    val fmt = LocalFmt.current
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
        SectionHeader(
            kicker = DeepDiveCopy.coherenceKicker,
            headline = DeepDiveCopy.coherenceTitle,
            deck = DeepDiveCopy.coherenceDeck,
        )
        if (!isPro) {
            ProUpsell(DeepDiveCopy.coherencePro) { onRequireUpgrade("conviction_intelligence") }
            return@Column
        }
        errorMessage?.takeIf { it.isNotBlank() }?.let {
            InlineBanner(it, tone = BannerTone.Error, actionLabel = DeepDiveCopy.refresh, onAction = onRefresh)
        }
        val latest = insights.firstOrNull()
        if (latest == null) {
            Text(DeepDiveCopy.coherenceEmpty, style = ThesisType.bodySmall, color = p.muted)
        } else {
            // One container: the findings' RowGroup sits on the page under the card's head, not in a second card.
            Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
                // The section's header carries the kicker; the period is a sans caption under the card's title,
                // never an eyebrow over dates.
                Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.xs)) {
                    TitledKicker(null, latest.title)
                    coherencePeriod(latest.periodStart, latest.periodEnd, fmt)?.let {
                        Text(it, style = ThesisType.caption, color = p.muted)
                    }
                }
                Text(latest.summary, style = ThesisType.body, color = p.ink2)
                if (latest.findings.isNotEmpty()) {
                    RowGroup {
                        latest.findings.take(POINTS_SHOWN).forEach { finding ->
                            row {
                                DataRow(
                                    label = finding.title,
                                    value = DeepDiveCopy.findingLabel(finding.findingType),
                                    sub = listOfNotNull(
                                        finding.summary.takeIf { it.isNotBlank() },
                                        finding.tickers.takeIf { it.isNotEmpty() }?.joinToString(", "),
                                    ).joinToString(" · ").ifBlank { null },
                                )
                            }
                        }
                    }
                }
            }
        }
        TextAction(DeepDiveCopy.refreshCoherence, onClick = onRefresh)
    }
}
