package com.thesis.mobile.ui.screens

import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import com.thesis.mobile.model.DeepDiveReaderOutline
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.DueDiligenceSectionView
import com.thesis.mobile.model.EvidenceLadderPanelView
import com.thesis.mobile.model.FinancialDerivedMetricView
import com.thesis.mobile.model.IndicatorView
import com.thesis.mobile.model.MetricDeltaPanelView
import com.thesis.mobile.model.RangeBandPanelView
import com.thesis.mobile.model.ScenarioComparePanelView
import com.thesis.mobile.model.SectionView
import com.thesis.mobile.model.TimelinePanelView
import com.thesis.mobile.model.ValuationBridgePanelView
import com.thesis.mobile.model.memoSection
import com.thesis.mobile.model.readerIssuerMetadataLine
import com.thesis.mobile.model.readerIssuerName
import com.thesis.mobile.model.toReaderOutline
import com.thesis.mobile.ui.charts.kit.ChartCard
import com.thesis.mobile.ui.charts.kit.ChartSeries
import com.thesis.mobile.ui.charts.kit.ColumnChart
import com.thesis.mobile.ui.charts.kit.LineChart
import com.thesis.mobile.ui.charts.kit.LineChartData
import com.thesis.mobile.ui.charts.kit.RangeBar
import com.thesis.mobile.ui.charts.kit.RankedBar
import com.thesis.mobile.ui.charts.kit.RankedBars
import com.thesis.mobile.ui.charts.kit.Timeline
import com.thesis.mobile.ui.charts.kit.TimelineItem
import com.thesis.mobile.ui.charts.kit.chartTable
import com.thesis.mobile.ui.charts.kit.legendFor
import com.thesis.mobile.ui.components.ActionRow
import com.thesis.mobile.ui.components.BadgeSpec
import com.thesis.mobile.ui.components.BannerTone
import com.thesis.mobile.ui.components.BigQuestion
import com.thesis.mobile.ui.components.Callout
import com.thesis.mobile.ui.components.CardFooter
import com.thesis.mobile.ui.components.ChapterDivider
import com.thesis.mobile.ui.components.ChapterHeader
import com.thesis.mobile.ui.components.CompareColumn
import com.thesis.mobile.ui.components.CompareRow
import com.thesis.mobile.ui.components.CompareTable
import com.thesis.mobile.ui.components.CompareTableModel
import com.thesis.mobile.ui.components.DataRow
import com.thesis.mobile.ui.components.Eyebrow
import com.thesis.mobile.ui.components.HeroBand
import com.thesis.mobile.ui.components.HighlightText
import com.thesis.mobile.ui.components.InlineBanner
import com.thesis.mobile.ui.components.Kicker
import com.thesis.mobile.ui.components.KpiGrid
import com.thesis.mobile.ui.components.KpiSpec
import com.thesis.mobile.ui.components.ReportChange
import com.thesis.mobile.ui.components.RowGroup
import com.thesis.mobile.ui.components.SegmentedControl
import com.thesis.mobile.ui.components.SinceLastReport
import com.thesis.mobile.ui.components.SinceLastReportModel
import com.thesis.mobile.ui.components.StatusBadge
import com.thesis.mobile.ui.components.StatusSquare
import com.thesis.mobile.ui.components.TextAction
import com.thesis.mobile.ui.components.ThesisCard
import com.thesis.mobile.ui.components.Upshot
import com.thesis.mobile.ui.components.ledeText
import com.thesis.mobile.ui.copy.DeepDiveCopy
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.format.LocalFmt
import com.thesis.mobile.ui.format.Missing
import com.thesis.mobile.ui.format.PeriodKind
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.motion.rememberHaptics
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone
import com.thesis.mobile.ui.theme.textColor
import java.time.LocalDate
import java.time.OffsetDateTime

/*
 * The classic Deep Dive's chapters (docs/app-redesign/DESIGN-DIRECTION.md 5.15): which chapters a report has, the
 * header and upshot of each (generated from the data where it can be), and the blocks inside them, built from kit
 * components only. The screen (DeepDiveScreen.kt) puts them in one LazyColumn under the hero and the sticky
 * chapter pills. Figures go through Fmt (via ClassicFormat in DeepDiveNativeMemo.kt).
 */

/** The chapters in the page's order; the pill label is the chapter kicker. */
internal enum class ClassicChapter(val label: String) {
    Summary(DeepDiveCopy.chSummary),
    Findings(DeepDiveCopy.chFindings),
    Filing(DeepDiveCopy.chFiling),
    Financials(DeepDiveCopy.chFinancials),
    Value(DeepDiveCopy.chValue),
    Risks(DeepDiveCopy.chRisks),
    Evidence(DeepDiveCopy.chEvidence),
    Desk(DeepDiveCopy.chDesk),
}

/** What a report shows: its chapters, the reader outline they draw on and the five-year series. */
internal data class ClassicPlan(
    val chapters: List<ClassicChapter>,
    val outline: DeepDiveReaderOutline,
    val fiveYear: FiveYearSeries?,
) {
    fun numberOf(chapter: ClassicChapter): Int = chapters.indexOf(chapter) + 1
}

private fun String?.has(): Boolean = !this.isNullOrBlank()

/** The chapters [report] has content for, in order; [withDesk] adds "Your notes" (not in the sample). */
internal fun classicPlan(report: DeepDiveReportView, fiveYear: FiveYearSeries?, withDesk: Boolean): ClassicPlan {
    val outline = report.toReaderOutline()
    val five = report.fiveYear(fiveYear)
    val fa = report.financialAnalysis
    val chapters = buildList {
        if (report.storyHeader != null || report.investmentMemo != null || report.changeSummary != null) {
            add(ClassicChapter.Summary)
        }
        if (!outline.usesStructuredArtifact && report.sections.isNotEmpty()) add(ClassicChapter.Findings)
        if (report.filingRead != null) add(ClassicChapter.Filing)
        val hasMetrics = fa != null && (fa.trendMetrics.isNotEmpty() || fa.qualityMetrics.isNotEmpty() || fa.omissions.isNotEmpty())
        if (five != null || report.indicatorsRead != null || outline.financialPanels.isNotEmpty() || hasMetrics) {
            add(ClassicChapter.Financials)
        }
        if (report.valuation != null || report.valueDiscipline != null || outline.valuationPanels.isNotEmpty() ||
            report.indicatorsRead?.valueLens.has()
        ) {
            add(ClassicChapter.Value)
        }
        if (report.killSwitchConditions.isNotEmpty() || outline.topRisks.isNotEmpty() || outline.riskPanels.isNotEmpty() ||
            report.memoSection("risks") != null
        ) {
            add(ClassicChapter.Risks)
        }
        val sectionsToShow = report.sections.isNotEmpty() &&
            (outline.usesStructuredArtifact || report.sections.any { it.evidence.isNotEmpty() })
        if (sectionsToShow || outline.dueDiligenceSections.isNotEmpty() ||
            report.investmentMemo?.materialClaims?.isNotEmpty() == true || report.coverageTruth != null ||
            report.explainers != null || report.indicatorsRead?.education?.isNotEmpty() == true ||
            outline.evidencePanels.isNotEmpty()
        ) {
            add(ClassicChapter.Evidence)
        }
        if (withDesk) add(ClassicChapter.Desk)
    }
    return ClassicPlan(chapters, outline, five)
}

/** A chapter's header: the generated title, the lede (lead clause and the rest) and the source caption. */
internal data class ChapterHead(val title: String, val lede: Pair<String, String>? = null, val source: String? = null)

private fun lede(text: String?): Pair<String, String>? = ClassicFormat.clean(text)?.let(ClassicFormat::splitLead)

private fun growthWords(label: String, growth: Pair<Int, Double>): String =
    DeepDiveCopy.financialsTitleGrowth(
        label,
        ClassicFormat.moved(growth.second >= 0, Fmt.pct(growth.second, 0)),
        Fmt.period(PeriodKind.FY, growth.first),
    )

/** The header of [chapter], its title generated from the data where the data says something. */
internal fun chapterHead(report: DeepDiveReportView, plan: ClassicPlan, chapter: ClassicChapter): ChapterHead {
    val filing = ClassicFormat.filingLabel(report.filingRead?.form, report.filingRead?.period)
    return when (chapter) {
        ClassicChapter.Summary -> ChapterHead(
            title = report.storyHeader?.headline?.takeIf { it.isNotBlank() && it != heroLine(report) }
                ?: DeepDiveCopy.summaryTitle,
            lede = lede(report.storyHeader?.whyNow),
        )
        ClassicChapter.Findings -> ChapterHead(DeepDiveCopy.findingsTitle)
        ClassicChapter.Filing -> ChapterHead(
            title = filingHeadline(report.filingRead?.metricDeltas.orEmpty()),
            lede = filingLede(report),
            source = filing?.let { "${DeepDiveCopy.filingSource}, $it" } ?: DeepDiveCopy.filingSource,
        )
        ClassicChapter.Financials -> {
            val five = plan.fiveYear
            ChapterHead(
                title = five?.growthPct(five.revenue)?.let { growthWords(DeepDiveCopy.revenue, it) }
                    ?: DeepDiveCopy.financialsTitle,
                lede = lede(report.indicatorsRead?.businessQuality),
                source = five?.source,
            )
        }
        ClassicChapter.Value -> {
            val v = report.valuation
            val low = v?.fairValueLow
            val high = v?.fairValueHigh
            ChapterHead(
                title = if (low != null && high != null) {
                    DeepDiveCopy.valueTitleRange(Fmt.money(low), Fmt.money(high))
                } else {
                    DeepDiveCopy.valueTitle
                },
                lede = lede(report.indicatorsRead?.valueLens),
                source = if (v != null) DeepDiveCopy.valuationSource else null,
            )
        }
        ClassicChapter.Risks -> ChapterHead(
            title = report.killSwitchConditions.size.takeIf { it > 0 }?.let(DeepDiveCopy::risksTitleCount)
                ?: DeepDiveCopy.risksTitle,
            lede = lede(report.memoSection("risks")?.narrative),
        )
        ClassicChapter.Evidence -> {
            val total = report.trustMetadata?.evidenceCount ?: report.sections.sumOf { it.evidence.size }
            val withEvidence = report.sections.count { it.evidence.isNotEmpty() }
            ChapterHead(
                title = if (total > 0) DeepDiveCopy.evidenceTitleCount(total, withEvidence) else DeepDiveCopy.evidenceTitle,
                lede = lede(report.coverageTruth?.summary),
            )
        }
        ClassicChapter.Desk -> ChapterHead(DeepDiveCopy.deskTitle, lede = ClassicFormat.splitLead(DeepDiveCopy.deskLede))
    }
}

/** The filing read as the chapter's lede, without the sentence the hero already shows. */
private fun filingLede(report: DeepDiveReportView): Pair<String, String>? {
    val read = ClassicFormat.clean(report.filingRead?.theFilingRead) ?: return null
    val (lead, rest) = ClassicFormat.splitLead(read)
    return if (heroLine(report) == lead) lede(rest) else lede(read)
}

/** The line that closes [chapter] when the data has one (5.15 item 4: "Each chapter ends with an Upshot"). */
internal fun chapterUpshot(report: DeepDiveReportView, chapter: ClassicChapter): String? = ClassicFormat.clean(
    when (chapter) {
        ClassicChapter.Summary -> report.storyHeader?.readerTakeaway
        ClassicChapter.Filing -> report.filingRead?.takeaway
        ClassicChapter.Financials -> report.indicatorsRead?.takeaway
        ClassicChapter.Value -> report.valueDiscipline?.interpretation
        else -> null
    },
)

/** The hero's thesis line: the report's thesis, else the story headline, else the filing read's first sentence. */
internal fun heroLine(report: DeepDiveReportView): String? =
    ClassicFormat.clean(report.thesisStatement)
        ?: ClassicFormat.clean(report.storyHeader?.headline)
        ?: ClassicFormat.clean(report.filingRead?.theFilingRead)?.let { ClassicFormat.splitLead(it).first }
        ?: ClassicFormat.clean(report.indicatorsRead?.takeaway)?.let { ClassicFormat.splitLead(it).first }

/** "Deep Dive · from the 10-Q for Q4 FY25" (the Eyebrow sets it in capitals). */
internal fun heroEyebrow(report: DeepDiveReportView): String {
    val f = report.filingRead
    val form = f?.form?.trim()?.ifBlank { null }
    val period = ClassicFormat.periodWords(f?.period ?: report.indicatorsRead?.period ?: report.historical?.latestPeriod)
    return when {
        form != null && period != null -> DeepDiveCopy.fromFiling(form, period)
        period != null -> DeepDiveCopy.fromPeriod(period)
        else -> DeepDiveCopy.deepDive
    }
}

/** The hero's badges: sample, freshness, evidence count, confidence; only those the report states. */
internal fun heroBadges(report: DeepDiveReportView, sample: Boolean): List<BadgeSpec> = buildList {
    if (sample) add(BadgeSpec(DeepDiveCopy.sampleBadge, Tone.Neutral))
    report.trustMetadata?.freshnessState?.takeIf { it.isNotBlank() }?.let { state ->
        val tone = when (state.lowercase()) {
            "fresh" -> Tone.Favourable
            "degraded" -> Tone.Attention
            "stale" -> Tone.Unfavourable
            else -> Tone.Unknown
        }
        add(BadgeSpec(DeepDiveCopy.freshnessBadge(state), tone))
    }
    val evidence = report.trustMetadata?.evidenceCount ?: report.sections.sumOf { it.evidence.size }.takeIf { it > 0 }
    evidence?.let { add(BadgeSpec(DeepDiveCopy.evidenceBadge(it), Tone.Neutral)) }
    (report.confidence?.label ?: report.confidenceLabel)?.takeIf { it.isNotBlank() }?.let {
        add(BadgeSpec(DeepDiveCopy.confidenceBadge(it), Tone.Neutral))
    }
}

/** The report's date from its ISO timestamp, or null. */
internal fun reportDate(raw: String?): LocalDate? {
    val s = raw?.trim().orEmpty()
    if (s.isEmpty()) return null
    return runCatching { OffsetDateTime.parse(s).toLocalDate() }.getOrNull()
        ?: runCatching { LocalDate.parse(s.take(ISO_DATE_LENGTH)) }.getOrNull()
}

private const val ISO_DATE_LENGTH = 10

/** The filing eyebrow may wrap at 2.0x font scale; it is never cut (A4). */
private const val EYEBROW_MAX_LINES = 4

// -------------------------------------------------------------------------------------------------------------
// The list the screen shows: entries with their top spacing, and where each chapter starts
// -------------------------------------------------------------------------------------------------------------

internal class ClassicEntry(val key: String, val top: Dp, val content: @Composable () -> Unit)

/** The chapter entries in list order; [chapterStarts] holds the index of each chapter's header entry. */
internal class ClassicItems {
    val entries = mutableListOf<ClassicEntry>()
    val chapterStarts = mutableListOf<Int>()

    fun add(key: String, top: Dp = ThesisSpace.xxl, content: @Composable () -> Unit) {
        entries += ClassicEntry("$key#${entries.size}", top, content)
    }
}

/**
 * What the chapters need from the screen: where quotes go ("Add to note"), how a source opens, and the
 * interactive blocks the screen owns (the what-if model and the desk tools). A null [onQuote] turns quoting off.
 */
internal class ClassicContext(
    val ticker: String?,
    val filing: String?,
    val onQuote: ((QuoteSource, String) -> Unit)?,
    val onOpenUrl: (String) -> Unit,
    val whatIf: (@Composable () -> Unit)? = null,
    val desk: List<Pair<String, @Composable () -> Unit>> = emptyList(),
)

/** Adds every chapter of [plan] to the list: header, blocks, upshot. */
internal fun ClassicItems.addChapters(report: DeepDiveReportView, plan: ClassicPlan, ctx: ClassicContext) {
    plan.chapters.forEach { chapter ->
        val number = plan.numberOf(chapter)
        val source = QuoteSource(number, chapter.label, ctx.ticker, ctx.filing)
        val quote: ((String) -> Unit)? = ctx.onQuote?.let { q -> { text: String -> q(source, text) } }
        chapterStarts += entries.size
        val head = chapterHead(report, plan, chapter)
        add("${chapter.name}-head", top = ThesisSpace.x3) { ClassicChapterHeader(number, chapter, head) }
        when (chapter) {
            ClassicChapter.Summary -> summaryBlocks(report, quote)
            ClassicChapter.Findings -> findingsBlocks(report, quote)
            ClassicChapter.Filing -> filingBlocks(report, quote)
            ClassicChapter.Financials -> financialsBlocks(report, plan, quote)
            ClassicChapter.Value -> valueBlocks(report, plan, ctx, quote)
            ClassicChapter.Risks -> riskBlocks(report, plan, quote)
            ClassicChapter.Evidence -> evidenceBlocks(report, plan, ctx)
            ClassicChapter.Desk -> ctx.desk.forEach { (key, block) -> add("desk-$key") { block() } }
        }
        chapterUpshot(report, chapter)?.let { text ->
            add("${chapter.name}-upshot") {
                Upshot(text, Modifier.quotable(text, quote), label = DeepDiveCopy.readerTakeaway)
            }
        }
    }
}

// -------------------------------------------------------------------------------------------------------------
// Shared pieces
// -------------------------------------------------------------------------------------------------------------

/** The page's reading width: 640 dp at most, centred, with the 16 dp gutter. */
@Composable
internal fun ReadingColumn(
    modifier: Modifier = Modifier,
    verticalArrangement: Arrangement.Vertical = Arrangement.Top,
    content: @Composable ColumnScope.() -> Unit,
) {
    Box(modifier.fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
        Column(
            Modifier
                .widthIn(max = ThesisSpace.contentMaxWidth)
                .fillMaxWidth()
                .padding(horizontal = ThesisSpace.gutter),
            verticalArrangement = verticalArrangement,
            content = content,
        )
    }
}

/**
 * Long-press on a paragraph offers "Add to note" (5.15 item 5); TalkBack gets the same as a custom action. With a
 * null [onQuote] the text is plain.
 */
@Composable
internal fun Modifier.quotable(text: String, onQuote: ((String) -> Unit)?): Modifier {
    if (onQuote == null) return this
    val haptics = rememberHaptics()
    return this
        .pointerInput(text, onQuote) {
            detectTapGestures(onLongPress = {
                haptics.longPress()
                onQuote(text)
            })
        }
        .semantics(mergeDescendants = true) {
            customActions = listOf(
                CustomAccessibilityAction(DeepDiveCopy.addToNote) {
                    onQuote(text)
                    true
                },
            )
        }
}

@Composable
private fun ClassicChapterHeader(number: Int, chapter: ClassicChapter, head: ChapterHead) {
    val p = LocalThesisPalette.current
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.x3)) {
        ChapterDivider()
        ChapterHeader(
            numeral = number,
            label = chapter.label,
            title = head.title,
            lede = head.lede?.let { (lead, rest) -> ledeText(lead, rest.ifBlank { null }, p) },
            source = head.source,
        )
    }
}

/** A kicker over a story paragraph ("Why now", "The good"), the paragraph quotable. */
@Composable
private fun LabeledParagraph(label: String, text: String, onQuote: ((String) -> Unit)?, labelTone: Tone? = null) {
    val p = LocalThesisPalette.current
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
        Kicker(label, color = labelTone?.textColor(p) ?: Color.Unspecified)
        Text(text, Modifier.quotable(text, onQuote), style = ThesisType.story, color = p.ink)
    }
}

/** Plain points, each with a small status square; no gold dashes. */
@Composable
private fun Points(items: List<String>, tone: Tone = Tone.Neutral) {
    val p = LocalThesisPalette.current
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
        items.forEach { item ->
            Row(horizontalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
                StatusSquare(tone, Modifier.padding(top = ThesisSpace.s))
                Text(item, Modifier.weight(1f), style = ThesisType.body, color = p.ink2)
            }
        }
    }
}

/** A kicker and the block under it. */
@Composable
private fun Group(label: String, content: @Composable ColumnScope.() -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
        Kicker(label)
        content()
    }
}

// -------------------------------------------------------------------------------------------------------------
// Hero
// -------------------------------------------------------------------------------------------------------------

/**
 * The cover (5.15 item 2): eyebrow from the filing (gold, with the 28 dp rule), the company in `display`, the meta
 * line and badges, the thesis line, then the featured KpiGrid of the filing's key lines.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun ClassicHero(
    report: DeepDiveReportView,
    kpis: List<KpiSpec>,
    sample: Boolean,
    underTopBar: Boolean = false,
) {
    val fmt = LocalFmt.current
    HeroBand(underTopBar = underTopBar) {
        val p = LocalThesisPalette.current
        Eyebrow(heroEyebrow(report), maxLines = EYEBROW_MAX_LINES)
        Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.xs)) {
            Text(
                report.readerIssuerName(),
                Modifier.semantics { heading() },
                style = ThesisType.capped(ThesisType.display),
                color = p.ink,
            )
            val meta = listOfNotNull(
                report.readerIssuerMetadataLine(),
                reportDate(report.generatedAt ?: report.trustMetadata?.generatedAt)?.let {
                    DeepDiveCopy.reportDated(fmt.marketDate(it))
                },
            ).joinToString(" · ")
            if (meta.isNotBlank()) Text(meta, style = ThesisType.caption, color = p.muted)
        }
        val badges = heroBadges(report, sample)
        if (badges.isNotEmpty()) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(ThesisSpace.s),
                verticalArrangement = Arrangement.spacedBy(ThesisSpace.s),
            ) {
                badges.forEach { StatusBadge(it.text, it.tone) }
            }
        }
        heroLine(report)?.let { Text(it, style = ThesisType.heroLine, color = p.ink2) }
        if (kpis.isNotEmpty()) KpiGrid(kpis, featured = true)
    }
}

// -------------------------------------------------------------------------------------------------------------
// Summary
// -------------------------------------------------------------------------------------------------------------

private fun ClassicItems.summaryBlocks(report: DeepDiveReportView, quote: ((String) -> Unit)?) {
    val story = report.storyHeader
    val opening = ClassicFormat.clean(story?.thesisSummary) ?: ClassicFormat.clean(report.investmentMemo?.companyAngle)
    opening?.let { text ->
        val (lead, rest) = ClassicFormat.splitLead(text)
        add("summary-story") { HighlightText(lead, rest, Modifier.quotable(text, quote), dropCap = true) }
    }
    ClassicFormat.clean(report.investmentMemo?.decisionQuestion)?.let { q ->
        add("summary-question") { BigQuestion(q, eyebrow = DeepDiveCopy.bigQuestion) }
    }
    ClassicFormat.clean(report.investmentMemo?.companyAngle)?.takeIf { it != opening }?.let { angle ->
        add("summary-angle") { LabeledParagraph(DeepDiveCopy.companyAngle, angle, quote) }
    }
    report.changeSummary?.let { change ->
        val model = SinceLastReportModel(
            previousView = change.previousView,
            previousFiling = DeepDiveCopy.previousReport,
            currentView = change.currentView,
            currentFiling = ClassicFormat.filingLabel(report.filingRead?.form, report.filingRead?.period)
                ?: DeepDiveCopy.thisReport,
            changes = change.topChanges.take(MAX_CHANGES).map { c ->
                val up = when (c.direction.lowercase()) {
                    "up", "improved", "improving", "positive", "increased" -> true
                    "down", "weakened", "deteriorating", "negative", "decreased" -> false
                    else -> null
                }
                ReportChange(
                    title = c.title,
                    directionLabel = ClassicFormat.humanize(c.direction),
                    up = up,
                    tone = ClassicFormat.tone(c.direction),
                    whyItMatters = ClassicFormat.clean(c.whyItMatters),
                )
            },
            drift = report.trustMetadata?.thesisDrift?.status?.takeIf { it.isNotBlank() }
                ?.let { BadgeSpec(ClassicFormat.humanize(it), Tone.Attention) },
        )
        add("summary-since") { SinceLastReport(model) }
    }
    report.investmentMemo?.sections.orEmpty()
        .filter { it.sectionId != "risks" && it.sectionId != "valuation" && it.narrative.isNotBlank() }
        .forEach { section ->
            add("summary-memo-${section.sectionId}") {
                Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
                    LabeledParagraph(section.title, section.narrative.trim(), quote)
                    if (section.keyPoints.isNotEmpty()) Points(section.keyPoints)
                }
            }
        }
}

private const val MAX_CHANGES = 3

// -------------------------------------------------------------------------------------------------------------
// Findings (reports without the structured memo: their sections as cards)
// -------------------------------------------------------------------------------------------------------------

private fun ClassicItems.findingsBlocks(report: DeepDiveReportView, quote: ((String) -> Unit)?) {
    report.sections.forEachIndexed { i, section ->
        add("findings-$i") { SectionCard(section, quote, expandedByDefault = true) }
    }
}

@Composable
private fun SectionCard(section: SectionView, quote: ((String) -> Unit)?, expandedByDefault: Boolean) {
    val p = LocalThesisPalette.current
    var expanded by rememberSaveable(section.title) { mutableIntStateOf(if (expandedByDefault) 1 else 0) }
    val body = ClassicFormat.clean(section.body)
    ThesisCard(
        eyebrow = DeepDiveCopy.sectionStatus(section.status),
        title = section.title,
        footer = section.evidence.size.takeIf { it > 0 }?.let { CardFooter(source = DeepDiveCopy.sourcesCount(it)) },
    ) {
        if (body == null) {
            Text(DeepDiveCopy.noSectionSummary, style = ThesisType.bodySmall, color = p.muted)
        } else {
            Text(
                section.body.trim(),
                Modifier.quotable(body, quote),
                style = ThesisType.body,
                color = p.ink2,
                maxLines = if (expanded == 1) Int.MAX_VALUE else COLLAPSED_LINES,
                overflow = TextOverflow.Ellipsis,
            )
            if (body.length > COLLAPSE_CHARS) {
                TextAction(
                    if (expanded == 1) DeepDiveCopy.hideFull else DeepDiveCopy.readFull,
                    onClick = { expanded = 1 - expanded },
                )
            }
        }
    }
}

private const val COLLAPSED_LINES = 4
private const val COLLAPSE_CHARS = 280

// -------------------------------------------------------------------------------------------------------------
// The filing
// -------------------------------------------------------------------------------------------------------------

private fun ClassicItems.filingBlocks(report: DeepDiveReportView, quote: ((String) -> Unit)?) {
    val f = report.filingRead ?: return
    if (f.topChanges.isNotEmpty()) add("filing-top") { Points(f.topChanges.take(MAX_TOP_CHANGES)) }
    val tables = deltaTables(f.metricDeltas)
    if (tables.isNotEmpty()) {
        add("filing-table") { DeltaTablesCard(tables, f.form) }
    }
    ClassicFormat.clean(f.whatChanged)?.let { add("filing-changed") { LabeledParagraph(DeepDiveCopy.filingTitle, it, quote) } }
    ClassicFormat.clean(f.theGood)?.let {
        add("filing-good") { LabeledParagraph(DeepDiveCopy.theGood, it, quote, Tone.Favourable) }
    }
    ClassicFormat.clean(f.theBad)?.let {
        add("filing-bad") { LabeledParagraph(DeepDiveCopy.theBad, it, quote, Tone.Unfavourable) }
    }
    ClassicFormat.clean(f.whatToWatchNext)?.let { add("filing-watch") { LabeledParagraph(DeepDiveCopy.watchNext, it, quote) } }
}

private const val MAX_TOP_CHANGES = 5

/** Every line that moved, one CompareTable per basis, a segmented control between them. */
@Composable
private fun DeltaTablesCard(tables: List<DeltaTable>, form: String?) {
    var selected by rememberSaveable { mutableIntStateOf(0) }
    val table = tables[selected.coerceIn(0, tables.lastIndex)]
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
        Kicker(DeepDiveCopy.changesTitle)
        if (tables.size > 1) SegmentedControl(tables.map { it.basis.label() }, selected, { selected = it })
        CompareTable(deltaTableModel(table, form))
    }
}

/** One basis as a table: before, now (the subject column, with its form) and the change with its tone. */
internal fun deltaTableModel(table: DeltaTable, form: String?): CompareTableModel = CompareTableModel(
    columns = listOf(
        CompareColumn(table.referencePeriod.ifBlank { DeepDiveCopy.before }),
        CompareColumn(table.currentPeriod.ifBlank { DeepDiveCopy.now }, filing = form?.ifBlank { null }, subject = true),
    ),
    rows = table.rows.map { d ->
        CompareRow(
            label = d.label,
            values = listOf(ClassicFormat.value(d.referenceValue, d.unit), ClassicFormat.value(d.currentValue, d.unit)),
            delta = ClassicFormat.change(d),
            deltaTone = ClassicFormat.tone(d.direction),
        )
    },
    labelHeader = DeepDiveCopy.metricHeader,
    deltaHeader = DeepDiveCopy.changeHeader,
)

// -------------------------------------------------------------------------------------------------------------
// Financials
// -------------------------------------------------------------------------------------------------------------

private fun ClassicItems.financialsBlocks(report: DeepDiveReportView, plan: ClassicPlan, quote: ((String) -> Unit)?) {
    val five = plan.fiveYear
    var fig = 1
    if (five != null && five.hasRevenue) {
        val n = fig++
        add("fin-five") { FiveYearCard(five, n, report.reportId) }
    }
    if (five != null && five.hasMargins) {
        val n = fig
        add("fin-margins") { MarginsCard(five, n, report.reportId) }
    }
    val ir = report.indicatorsRead
    ClassicFormat.clean(ir?.fiveYearRead)?.let { add("fin-read") { LabeledParagraph(DeepDiveCopy.fiveYearRead, it, quote) } }
    val fa = report.financialAnalysis
    if (fa != null && fa.trendMetrics.isNotEmpty()) {
        add("fin-trends") { MetricGroup(DeepDiveCopy.trendMetrics, fa.trendMetrics) }
    }
    if (fa != null && fa.qualityMetrics.isNotEmpty()) {
        add("fin-quality") { MetricGroup(DeepDiveCopy.qualityMetrics, fa.qualityMetrics) }
    }
    indicatorGroups(ir?.indicators.orEmpty().filter { it.group != "valuation" }).forEach { (label, rows) ->
        add("fin-ind-$label") { IndicatorGroup(label, rows) }
    }
    plan.outline.financialPanels.filterIsInstance<MetricDeltaPanelView>().forEachIndexed { i, panel ->
        if (panel.metrics.isNotEmpty()) add("fin-delta-$i") { MetricDeltaCard(panel) }
    }
    ClassicFormat.clean(ir?.cashFlowRead)?.let { add("fin-cash") { LabeledParagraph(DeepDiveCopy.cashFlow, it, quote) } }
    ClassicFormat.clean(ir?.balanceSheetRead)?.let { add("fin-balance") { LabeledParagraph(DeepDiveCopy.balanceSheet, it, quote) } }
    val omissions = fa?.omissions.orEmpty()
    if (omissions.isNotEmpty()) {
        add("fin-omitted") {
            Group(DeepDiveCopy.omitted) { Points(omissions.map { "${it.label}: ${it.reason}" }, Tone.Unknown) }
        }
    }
}

/** Number of chart cards the Financials chapter draws, so the Value chapter's figure numbers continue. */
private fun financialFigures(plan: ClassicPlan): Int =
    (if (plan.fiveYear?.hasRevenue == true) 1 else 0) + (if (plan.fiveYear?.hasMargins == true) 1 else 0)

private fun moneyTick(v: Double): String = Fmt.money(v)

private fun pctTick(v: Double): String = Fmt.pct(v, 1)

@Composable
private fun FiveYearCard(five: FiveYearSeries, fignum: Int, key: String) {
    val series = listOf(
        ChartSeries(DeepDiveCopy.revenue, five.revenue, subject = true),
        ChartSeries(DeepDiveCopy.freeCashFlow, five.freeCashFlow),
    ).filter { s -> s.values.any { it != null } }
    ChartCard(
        title = five.growthPct(five.freeCashFlow)?.let { growthWords(DeepDiveCopy.freeCashFlow, it) }
            ?: DeepDiveCopy.financialsTitle,
        fignum = fignum,
        subtitle = DeepDiveCopy.fiveYearSubtitleRevenue,
        source = five.source,
        legend = legendFor(series, bars = true),
        table = chartTable(five.labels, series, ::moneyTick, DeepDiveCopy.fiscalYear),
    ) {
        ColumnChart(series, five.labels, valueFormat = ::moneyTick, dataKey = key)
    }
}

@Composable
private fun MarginsCard(five: FiveYearSeries, fignum: Int, key: String) {
    val series = listOf(
        ChartSeries(DeepDiveCopy.grossMargin, five.grossMargin),
        ChartSeries(DeepDiveCopy.operatingMargin, five.operatingMargin, subject = true),
    ).filter { s -> s.values.any { it != null } }
    val op = five.operatingMargin
    val first = op.indexOfFirst { it != null }
    val last = op.indexOfLast { it != null }
    val title = if (first >= 0 && last > first) {
        val points = op[last]!! - op[first]!!
        DeepDiveCopy.marginsTitleMove(DeepDiveCopy.operatingMargin, ClassicFormat.moved(points >= 0, Fmt.bpsFromPoints(points)))
    } else {
        DeepDiveCopy.marginsTitle
    }
    ChartCard(
        title = title,
        fignum = fignum,
        subtitle = DeepDiveCopy.fiveYearSubtitleMargins,
        source = five.source,
        legend = legendFor(series),
        table = chartTable(five.labels, series, ::pctTick, DeepDiveCopy.fiscalYear),
    ) {
        LineChart(LineChartData(series, five.labels), valueFormat = ::pctTick, dataKey = key)
    }
}

@Composable
private fun MetricGroup(label: String, metrics: List<FinancialDerivedMetricView>) {
    Group(label) {
        RowGroup {
            metrics.forEach { m ->
                row {
                    DataRow(
                        label = m.label,
                        value = if (m.status.equals("available", true)) {
                            ClassicFormat.value(m.value, m.unit, Missing.NotComputed)
                        } else {
                            Fmt.NOT_COMPUTED
                        },
                        delta = m.direction.takeIf { it.isNotBlank() && !it.equals("unknown", true) }
                            ?.let(ClassicFormat::humanize),
                        deltaTone = ClassicFormat.tone(m.direction),
                        sub = ClassicFormat.clean(m.note),
                    )
                }
            }
        }
    }
}

@Composable
private fun IndicatorGroup(label: String, rows: List<IndicatorView>) {
    Group(label) {
        RowGroup {
            rows.forEach { ind ->
                row {
                    DataRow(
                        label = ind.label,
                        value = ClassicFormat.value(ind.value, ind.unit),
                        sub = ClassicFormat.periodLabel(ind.period),
                    )
                }
            }
        }
    }
}

/** A metric-delta panel as one table (5.15: "instead of four boxes"): before, now, change, basis in the label. */
@Composable
private fun MetricDeltaCard(panel: MetricDeltaPanelView) {
    val model = CompareTableModel(
        columns = listOf(CompareColumn(DeepDiveCopy.before), CompareColumn(DeepDiveCopy.now, subject = true)),
        rows = panel.metrics.map { m ->
            CompareRow(
                label = "${m.label}, ${DeepDiveCopy.basisLabel(m.basis)}",
                values = listOf(ClassicFormat.plain(m.referenceValue), ClassicFormat.plain(m.currentValue)),
                delta = m.deltaPct?.let { Fmt.signedPct(it) },
                deltaTone = ClassicFormat.tone(m.direction),
            )
        },
        labelHeader = DeepDiveCopy.metricHeader,
        deltaHeader = DeepDiveCopy.changeHeader,
    )
    ThesisCard(eyebrow = panel.eyebrow ?: DeepDiveCopy.deltasTitle, title = panel.title) {
        ClassicFormat.clean(panel.summary)?.let {
            Text(it, style = ThesisType.bodySmall, color = LocalThesisPalette.current.ink2)
            Spacer(Modifier.height(ThesisSpace.m))
        }
        CompareTable(model)
    }
}

// -------------------------------------------------------------------------------------------------------------
// Price and value
// -------------------------------------------------------------------------------------------------------------

private fun ClassicItems.valueBlocks(
    report: DeepDiveReportView,
    plan: ClassicPlan,
    ctx: ClassicContext,
    quote: ((String) -> Unit)?,
) {
    val v = report.valuation
    val fig = financialFigures(plan) + 1
    val low = v?.fairValueLow
    val high = v?.fairValueHigh
    if (low != null && high != null) {
        val subtitle = DeepDiveCopy.modelRangeSubtitle(
            v.assumptions?.projectionYears,
            v.assumptions?.terminalGrowthRate?.let { Fmt.pct(it * PERCENT, 1) },
            v.assumptions?.wacc?.let { Fmt.pct(it * PERCENT, 1) },
        )
        add("value-range") { ModelRangeCard(low, high, v.fairValueMid, v.spotPrice, fig, subtitle) }
    } else {
        val band = plan.outline.valuationPanels.filterIsInstance<RangeBandPanelView>().firstOrNull()
        val bandLow = band?.lowValue
        val bandHigh = band?.highValue
        if (band != null && bandLow != null && bandHigh != null) {
            add("value-band") {
                ModelRangeCard(bandLow, bandHigh, band.midValue, band.referenceValue, fig, ClassicFormat.clean(band.summary))
            }
        }
    }
    ClassicFormat.clean(v?.degradedReason)?.let { reason ->
        add("value-degraded") { InlineBanner(reason, tone = BannerTone.Attention) }
    }
    ctx.whatIf?.let { block -> add("value-whatif") { block() } }
    val ir = report.indicatorsRead
    if (ir != null && (ir.classification.has() || ir.trapWarnings.isNotEmpty() || ir.classificationReasons.isNotEmpty())) {
        add("value-lens") {
            Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
                Kicker(DeepDiveCopy.valueLens)
                ir.classification?.takeIf { it.isNotBlank() }?.let {
                    StatusBadge(DeepDiveCopy.classification(ClassicFormat.humanize(it), ir.classificationConfidence), Tone.Neutral)
                }
                if (ir.classificationReasons.isNotEmpty()) Points(ir.classificationReasons)
                ir.trapWarnings.forEach { Callout(it) }
            }
        }
    }
    report.valueDiscipline?.let { vd ->
        add("value-discipline") {
            val p = LocalThesisPalette.current
            ThesisCard(eyebrow = DeepDiveCopy.discipline, title = DeepDiveCopy.disciplineTitle(vd.score, vd.maxScore)) {
                Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
                    if (vd.signals.isNotEmpty()) {
                        RowGroup {
                            vd.signals.forEach { s ->
                                row {
                                    DataRow(
                                        label = s.label,
                                        value = ClassicFormat.humanize(s.status),
                                        sub = ClassicFormat.clean(s.reason),
                                    )
                                }
                            }
                        }
                    }
                    ClassicFormat.clean(vd.doesNotProve)?.let {
                        Kicker(DeepDiveCopy.doesNotProve)
                        Text(it, style = ThesisType.bodySmall, color = p.ink2)
                    }
                    if (vd.valueTrapWarning.triggered) {
                        ClassicFormat.clean(vd.valueTrapWarning.summary)?.let { Callout(it) }
                    }
                }
            }
        }
    }
    val multiples = ir?.indicators.orEmpty().filter { it.group == "valuation" }
    if (multiples.isNotEmpty()) add("value-multiples") { IndicatorGroup(DeepDiveCopy.valuationIndicators, multiples) }
    plan.outline.valuationPanels.forEachIndexed { i, panel ->
        when (panel) {
            is ValuationBridgePanelView -> if (panel.points.isNotEmpty()) {
                add("value-bridge-$i") {
                    ThesisCard(eyebrow = panel.eyebrow, title = panel.title) {
                        RankedBars(
                            items = panel.points.map { pt ->
                                RankedBar(pt.label, pt.value, Fmt.money(pt.value), tone = ClassicFormat.tone(pt.tone))
                            },
                            scaleLabel = DeepDiveCopy.modelValue,
                            sorted = false,
                        )
                    }
                }
            }
            is ScenarioComparePanelView -> add("value-compare-$i") {
                ThesisCard(eyebrow = panel.eyebrow, title = panel.title) {
                    RowGroup {
                        row { DataRow(panel.baseLabel, Fmt.money(panel.baseValue, missing = Missing.NotComputed)) }
                        row { DataRow(panel.scenarioLabel, Fmt.money(panel.scenarioValue, missing = Missing.NotComputed)) }
                    }
                }
            }
            else -> Unit
        }
    }
    ClassicFormat.clean(report.memoSection("valuation")?.narrative)?.let { text ->
        add("value-memo") { LabeledParagraph(DeepDiveCopy.memoKicker, text, quote) }
    }
}

private const val PERCENT = 100.0

/** Bear to bull model range with the price stored in the report (never "upside"; 5.15). */
@Composable
private fun ModelRangeCard(low: Double, high: Double, mid: Double?, price: Double?, fignum: Int, subtitle: String?) {
    ChartCard(
        title = DeepDiveCopy.modelRangeTitle,
        fignum = fignum,
        subtitle = subtitle,
        source = DeepDiveCopy.valuationSource,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
            RangeBar(
                bear = low,
                bull = high,
                format = ::moneyTick,
                base = mid,
                price = price,
                priceLabel = DeepDiveCopy.priceInReport,
            )
            if (price == null) {
                Text(DeepDiveCopy.noPriceStored, style = ThesisType.caption, color = LocalThesisPalette.current.muted)
            }
        }
    }
}

// -------------------------------------------------------------------------------------------------------------
// Risks
// -------------------------------------------------------------------------------------------------------------

private fun ClassicItems.riskBlocks(report: DeepDiveReportView, plan: ClassicPlan, quote: ((String) -> Unit)?) {
    if (report.killSwitchConditions.isNotEmpty()) {
        add("risk-kill") {
            Group(DeepDiveCopy.killSwitches) {
                RowGroup {
                    report.killSwitchConditions.forEach { k ->
                        row {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                StatusSquare(Tone.Attention, Modifier.padding(start = ThesisSpace.l))
                                DataRow(
                                    label = k.conditionText,
                                    value = ClassicFormat.humanize(k.signalType),
                                    modifier = Modifier.weight(1f),
                                    sub = k.thresholdDescription?.takeIf { it.isNotBlank() }?.let(DeepDiveCopy::threshold),
                                )
                            }
                        }
                    }
                }
            }
        }
    }
    val top = plan.outline.topRisks
    if (top.isNotEmpty()) add("risk-top") { Group(DeepDiveCopy.topRisks) { Points(top, Tone.Unfavourable) } }
    plan.outline.riskPanels.filterIsInstance<TimelinePanelView>().forEachIndexed { i, panel ->
        if (panel.points.isNotEmpty()) {
            add("risk-timeline-$i") {
                ThesisCard(eyebrow = panel.eyebrow, title = panel.title) {
                    Timeline(panel.points.map { TimelineItem(title = it.label, meta = it.value) })
                }
            }
        }
    }
    val watch = report.watchItems.filterNot { it in top }
    if (watch.isNotEmpty()) add("risk-watch") { Group(DeepDiveCopy.watchNext) { Points(watch) } }
    report.memoSection("risks")?.keyPoints?.filterNot { it in top }?.takeIf { it.isNotEmpty() }?.let { points ->
        add("risk-memo") { Group(DeepDiveCopy.memoKicker) { Points(points) } }
    }
    report.trustMetadata?.contradictions.orEmpty().takeIf { it.isNotEmpty() }?.let { list ->
        add("risk-contradictions") {
            val p = LocalThesisPalette.current
            Group(DeepDiveCopy.contradictions) {
                list.forEach { c ->
                    Text(c.description, Modifier.quotable(c.description, quote), style = ThesisType.body, color = p.ink2)
                }
            }
        }
    }
}

// -------------------------------------------------------------------------------------------------------------
// Evidence
// -------------------------------------------------------------------------------------------------------------

/** A source the reader can open: its section, name, excerpt and web address. */
internal data class OpenSource(val section: String, val name: String, val excerpt: String, val url: String)

/** The report's sources that have a web address, in section order, without duplicates. */
internal fun openSources(report: DeepDiveReportView): List<OpenSource> = report.sections.flatMap { s ->
    s.evidence.mapNotNull { e ->
        val url = e.url?.trim()?.takeIf { it.startsWith("https://") || it.startsWith("http://") }
        url?.let { OpenSource(s.title, e.sourceName, e.excerpt, it) }
    }
}.distinctBy { it.url }

private const val SOURCES_SHOWN = 5
private const val EXCERPT_CHARS = 140

private fun ClassicItems.evidenceBlocks(report: DeepDiveReportView, plan: ClassicPlan, ctx: ClassicContext) {
    val counted = report.sections.filter { it.evidence.isNotEmpty() }
    if (counted.size >= 2) {
        add("ev-bars") {
            ChartCard(title = DeepDiveCopy.mostSources(counted.maxBy { it.evidence.size }.title)) {
                RankedBars(
                    items = counted.map { s ->
                        RankedBar(s.title, s.evidence.size.toDouble(), DeepDiveCopy.sourcesCount(s.evidence.size))
                    },
                    scaleLabel = DeepDiveCopy.sourcesPerSection,
                    dataKey = report.reportId,
                )
            }
        }
    }
    plan.outline.evidencePanels.filterIsInstance<EvidenceLadderPanelView>().forEachIndexed { i, panel ->
        if (panel.rungs.isNotEmpty()) {
            add("ev-ladder-$i") {
                ChartCard(title = panel.title, subtitle = ClassicFormat.clean(panel.summary)) {
                    RankedBars(
                        items = panel.rungs.map { r ->
                            RankedBar(r.label, r.count.toDouble(), DeepDiveCopy.sourcesCount(r.count), tone = ClassicFormat.tone(r.tone))
                        },
                        scaleLabel = DeepDiveCopy.sourcesPerSection,
                        sorted = false,
                    )
                }
            }
        }
    }
    val sources = openSources(report)
    if (sources.isNotEmpty()) add("ev-sources") { SourceList(sources, ctx.onOpenUrl) }
    plan.outline.dueDiligenceSections.forEach { section ->
        add("ev-dd-${section.sectionId}") { DueDiligenceCard(section) }
    }
    if (plan.outline.usesStructuredArtifact) {
        report.sections.forEachIndexed { i, section ->
            add("ev-section-$i", top = if (i == 0) ThesisSpace.xxl else ThesisSpace.m) {
                Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
                    if (i == 0) Kicker(DeepDiveCopy.sectionsTitle)
                    SectionCard(section, null, expandedByDefault = false)
                }
            }
        }
    }
    val memo = report.investmentMemo
    if (memo != null && memo.materialClaims.isNotEmpty()) {
        add("ev-claims") {
            val p = LocalThesisPalette.current
            Group(DeepDiveCopy.claims) {
                memo.materialClaims.forEach { claim ->
                    Column(
                        Modifier.padding(vertical = ThesisSpace.xs),
                        verticalArrangement = Arrangement.spacedBy(ThesisSpace.xs),
                    ) {
                        Text(claim.statement, style = ThesisType.body, color = p.ink)
                        claim.supports.forEach { s ->
                            Text(DeepDiveCopy.supportLine(s.supportType, s.summary), style = ThesisType.caption, color = p.muted)
                        }
                    }
                }
            }
        }
    }
    if (memo != null && memo.unsupportedClaims.isNotEmpty()) {
        add("ev-unsupported") { Group(DeepDiveCopy.unsupportedClaims) { Points(memo.unsupportedClaims, Tone.Attention) } }
    }
    report.coverageTruth?.let { cov ->
        if (cov.covered.isNotEmpty() || cov.missing.isNotEmpty()) {
            add("ev-coverage") {
                val p = LocalThesisPalette.current
                Group(DeepDiveCopy.coverage) {
                    if (cov.covered.isNotEmpty()) {
                        Text(DeepDiveCopy.covered, style = ThesisType.label, color = p.ink)
                        Points(cov.covered, Tone.Favourable)
                    }
                    if (cov.missing.isNotEmpty()) {
                        Text(DeepDiveCopy.missing, style = ThesisType.label, color = p.ink)
                        Points(cov.missing, Tone.Unknown)
                    }
                }
            }
        }
    }
    report.trustMetadata?.missingDataNotes.orEmpty().takeIf { it.isNotEmpty() }?.let { notes ->
        add("ev-missing") { Group(DeepDiveCopy.missingData) { Points(notes, Tone.Unknown) } }
    }
    ClassicFormat.clean(memo?.sparseDataHonestyNote)?.let { note -> add("ev-honesty") { Callout(note) } }
    report.explainers?.let { explainers ->
        val lines = listOf(explainers.confidence, explainers.freshness, explainers.valuation, explainers.omissions)
            .mapNotNull(ClassicFormat::clean)
        if (lines.isNotEmpty()) {
            add("ev-howto") {
                val p = LocalThesisPalette.current
                ThesisCard(eyebrow = DeepDiveCopy.howToRead) {
                    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
                        lines.forEach { Text(it, style = ThesisType.bodySmall, color = p.ink2) }
                    }
                }
            }
        }
    }
    report.indicatorsRead?.education.orEmpty().forEachIndexed { i, box ->
        add("ev-edu-$i") {
            val p = LocalThesisPalette.current
            ThesisCard(eyebrow = DeepDiveCopy.howToRead, title = box.title) {
                Text(box.body, style = ThesisType.bodySmall, color = p.ink2)
                ClassicFormat.clean(box.example)?.let {
                    Spacer(Modifier.height(ThesisSpace.s))
                    Text(it, style = ThesisType.caption, color = p.muted)
                }
            }
        }
    }
}

/** The sources that open in the browser, five at first and "Show all n" for the rest. */
@Composable
private fun SourceList(sources: List<OpenSource>, onOpenUrl: (String) -> Unit) {
    var showAll by rememberSaveable { mutableIntStateOf(0) }
    val shown = if (showAll == 1) sources else sources.take(SOURCES_SHOWN)
    Group(DeepDiveCopy.openSources) {
        RowGroup {
            shown.forEach { s ->
                row {
                    ActionRow(
                        icon = ThesisIcons.Document,
                        title = s.name,
                        onClick = { onOpenUrl(s.url) },
                        caption = listOfNotNull(s.section, ClassicFormat.clean(s.excerpt)?.take(EXCERPT_CHARS)).joinToString(" · "),
                        external = true,
                    )
                }
            }
        }
        if (sources.size > SOURCES_SHOWN) {
            TextAction(
                if (showAll == 1) DeepDiveCopy.showFewer else DeepDiveCopy.showAllSources(sources.size),
                onClick = { showAll = 1 - showAll },
            )
        }
    }
}

@Composable
private fun DueDiligenceCard(section: DueDiligenceSectionView) {
    val p = LocalThesisPalette.current
    var expanded by rememberSaveable(section.sectionId) { mutableIntStateOf(0) }
    val more = section.narrativeParagraphs.isNotEmpty() || section.keyPoints.isNotEmpty() || section.omissions.isNotEmpty()
    ThesisCard(
        eyebrow = DeepDiveCopy.coverageState(section.coverageState),
        title = section.title,
        footer = section.evidenceRefs.size.takeIf { it > 0 }?.let { CardFooter(source = DeepDiveCopy.sourcesCount(it)) },
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
            Text(section.summary, style = ThesisType.body, color = p.ink2)
            if (expanded == 1) {
                section.narrativeParagraphs.forEach { Text(it, style = ThesisType.body, color = p.ink2) }
                if (section.keyPoints.isNotEmpty()) Points(section.keyPoints)
                if (section.omissions.isNotEmpty()) Points(section.omissions, Tone.Unknown)
            }
            if (more) {
                TextAction(
                    if (expanded == 1) DeepDiveCopy.hideFull else DeepDiveCopy.readFull,
                    onClick = { expanded = 1 - expanded },
                )
            }
        }
    }
}
