package com.thesis.mobile.ui.screens

import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import com.thesis.mobile.model.DeepDiveReaderOutline
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.DeepDiveVisualPanelView
import com.thesis.mobile.model.DueDiligenceSectionView
import com.thesis.mobile.model.EvidenceLadderPanelView
import com.thesis.mobile.model.FinancialDerivedMetricView
import com.thesis.mobile.model.IndicatorView
import com.thesis.mobile.model.MetricDeltaPanelView
import com.thesis.mobile.model.RangeBandPanelView
import com.thesis.mobile.model.ScenarioComparePanelView
import com.thesis.mobile.model.SectionView
import com.thesis.mobile.model.TimelinePanelView
import com.thesis.mobile.model.TrustScorecardPanelView
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
import com.thesis.mobile.ui.theme.Kit
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone
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

    /** In place of [Evidence] when the report has only explainers to show: no sources or counts to promise. */
    Reading(DeepDiveCopy.chReading),
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
        val memo = report.investmentMemo
        val hasEvidence = sectionsToShow || outline.dueDiligenceSections.isNotEmpty() ||
            memo?.materialClaims?.isNotEmpty() == true || memo?.unsupportedClaims?.isNotEmpty() == true ||
            memo?.sparseDataHonestyNote.has() || report.coverageTruth != null ||
            report.trustMetadata?.missingDataNotes?.isNotEmpty() == true || outline.evidencePanels.isNotEmpty() ||
            trustScorecards(report).isNotEmpty()
        val hasExplainers = report.explainers != null || report.indicatorsRead?.education?.isNotEmpty() == true
        // A chapter of explainers alone is titled as what it is, not "Where the figures come from".
        if (hasEvidence) add(ClassicChapter.Evidence) else if (hasExplainers) add(ClassicChapter.Reading)
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
                    DeepDiveCopy.valueTitleRange(ClassicFormat.wholeMoney(low), ClassicFormat.wholeMoney(high))
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
        ClassicChapter.Reading -> ChapterHead(DeepDiveCopy.readingTitle)
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
    private var figures = 0

    /** The next chart card's number: CHART 1, 2, ... in page order, across chapters (5.15 renderer anatomy). */
    fun nextFigure(): Int = ++figures

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
            ClassicChapter.Evidence, ClassicChapter.Reading -> evidenceBlocks(report, plan, ctx)
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

/**
 * A kicker over a story paragraph ("Why now", "The good"), the paragraph quotable. The kicker keeps the accent:
 * up/down colour is for figures only (T3), so "The good" and "The bad" are not toned.
 */
@Composable
private fun LabeledParagraph(label: String, text: String, onQuote: ((String) -> Unit)?) {
    val p = LocalThesisPalette.current
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
        Kicker(label)
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

/** A kicker over a serif card title: the head of a block that sits on the page, not in a second card. */
@Composable
internal fun TitledKicker(kicker: String?, title: String?) {
    val p = LocalThesisPalette.current
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
        kicker?.let { Kicker(it) }
        title?.let { Text(it, Modifier.semantics { heading() }, style = ThesisType.cardTitle, color = p.ink) }
    }
}

/**
 * What a kill switch watches and its line ("Line: Gross margin under 44%"); the signal is named only when the line
 * does not already name it.
 */
internal fun killSwitchSub(signalType: String, threshold: String?): String? {
    val line = threshold?.trim()?.takeIf { it.isNotEmpty() }
    val signal = signalType.takeIf { it.isNotBlank() }?.let(ClassicFormat::humanize)
        ?.takeUnless { line != null && line.contains(it, ignoreCase = true) }
    return listOfNotNull(signal, line?.let(DeepDiveCopy::threshold)).joinToString(" · ").ifBlank { null }
}

/**
 * A kill switch: the condition and, under it, what it watches and its line. The square stays neutral grey: the
 * report carries the line but not the latest reading (HANDOFF-D), so the row has no state to colour.
 */
@Composable
private fun KillSwitchRow(condition: String, sub: String?) {
    val p = LocalThesisPalette.current
    Row(
        Modifier
            .fillMaxWidth()
            .semantics(mergeDescendants = true) {}
            .heightIn(min = if (sub != null) ThesisSpace.rowMinComfortableTwoLine else ThesisSpace.rowMinComfortable)
            .padding(horizontal = ThesisSpace.l, vertical = ThesisSpace.rowPaddingV),
        horizontalArrangement = Arrangement.spacedBy(ThesisSpace.m),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        StatusSquare(Tone.Unknown)
        Column(Modifier.weight(1f)) {
            Text(condition, style = ThesisType.body, color = p.ink)
            if (sub != null) Text(sub, style = ThesisType.bodySmall, color = p.ink2)
        }
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
        heroLine(report)?.let { Text(it, style = ThesisType.heroLine, color = p.ink) }
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
    var expanded by rememberSaveable(section.title) { mutableStateOf(expandedByDefault) }
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
                maxLines = if (expanded) Int.MAX_VALUE else COLLAPSED_LINES,
                overflow = TextOverflow.Ellipsis,
            )
            if (body.length > COLLAPSE_CHARS) {
                TextAction(
                    if (expanded) DeepDiveCopy.hideFull else DeepDiveCopy.readFull,
                    onClick = { expanded = !expanded },
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
    val points = filingPoints(report)
    if (points.isNotEmpty()) add("filing-top") { Points(points) }
    val tables = deltaTables(f.metricDeltas)
    if (tables.isNotEmpty()) {
        val choices = tables.map { t ->
            TableChoice(t.basis.label(), deltaTableModel(t, f.form), deltaTableModel(t, f.form, compact = true))
        }
        add("filing-table") { TablesBlock(DeepDiveCopy.changesTitle, choices) }
    }
    ClassicFormat.clean(f.whatChanged)?.let { add("filing-changed") { LabeledParagraph(DeepDiveCopy.filingTitle, it, quote) } }
    ClassicFormat.clean(f.theGood)?.let {
        add("filing-good") { LabeledParagraph(DeepDiveCopy.theGood, it, quote) }
    }
    ClassicFormat.clean(f.theBad)?.let {
        add("filing-bad") { LabeledParagraph(DeepDiveCopy.theBad, it, quote) }
    }
    ClassicFormat.clean(f.whatToWatchNext)?.let { add("filing-watch") { LabeledParagraph(DeepDiveCopy.watchNext, it, quote) } }
}

private const val MAX_TOP_CHANGES = 5

/**
 * The filing's top changes that the chapter does not already say in words: a point that the lede or "What changed"
 * repeats sentence for sentence is dropped (the sample's memo restates its top changes in both).
 */
internal fun filingPoints(report: DeepDiveReportView): List<String> {
    val f = report.filingRead ?: return emptyList()
    val said = listOfNotNull(filingLede(report)?.let { (lead, rest) -> "$lead $rest" }, ClassicFormat.clean(f.whatChanged))
        .joinToString(" ")
        .lowercase()
    return f.topChanges.mapNotNull(ClassicFormat::clean)
        .filterNot { said.contains(it.lowercase()) }
        .take(MAX_TOP_CHANGES)
}

/**
 * A table the block can show in two shapes: [full] (before, now, change) where it fits the width, else [compact]
 * (now and the change against the reference period), so no column is ever cut at the panel edge.
 */
internal class TableChoice(val label: String, val full: CompareTableModel, val compact: CompareTableModel)

/** A kicker, an optional title and summary, the segmented control when there are several tables, the table. */
@Composable
private fun TablesBlock(kicker: String, choices: List<TableChoice>, title: String? = null, summary: String? = null) {
    val p = LocalThesisPalette.current
    var selected by rememberSaveable { mutableIntStateOf(0) }
    val choice = choices[selected.coerceIn(0, choices.lastIndex)]
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
        Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
            Kicker(kicker)
            title?.let { Text(it, style = ThesisType.cardTitle, color = p.ink) }
            summary?.let { Text(it, style = ThesisType.bodySmall, color = p.ink2) }
        }
        if (choices.size > 1) SegmentedControl(choices.map { it.label }, selected, { selected = it })
        FittingCompareTable(choice.full, choice.compact)
    }
}

/**
 * The table that fits the width at the current font size, so no column is cut at the panel edge: [full] as it
 * is; else [full] with its row labels wrapped between words ("Operating / margin"); else [compact] the same way.
 * At sizes where even that cannot fit (2.0x on 360 dp) CompareTable's own scroll takes over.
 */
@Composable
private fun FittingCompareTable(full: CompareTableModel, compact: CompareTableModel) {
    val measurer = rememberTextMeasurer()
    val density = LocalDensity.current
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val widthPx = constraints.maxWidth
        val shown = remember(full, compact, widthPx, density) {
            val fit = TableFit(measurer, density)
            fit.fitted(full, widthPx) ?: fit.fitted(compact, widthPx) ?: compact
        }
        CompareTable(shown)
    }
}

/**
 * CompareTable's widths, measured ahead: each value column as wide as its widest cell and never under
 * `Kit.tableColumnMin`, 12 dp cell padding each side; the label column takes what is left.
 */
private class TableFit(private val measurer: TextMeasurer, density: Density) {
    private val pad = with(density) { Kit.tableCellPaddingH.roundToPx() } * 2
    private val colMin = with(density) { Kit.tableColumnMin.roundToPx() }

    private fun w(text: String, style: TextStyle): Int =
        if (text.isEmpty()) 0 else measurer.measure(AnnotatedString(text), style, softWrap = false, maxLines = 1).size.width

    private fun column(head: Int, cells: List<String>): Int =
        maxOf(colMin, head + pad, (cells.maxOfOrNull { w(it, ThesisType.tableNum) } ?: 0) + pad)

    /** [model] as it fits [width]: unchanged, or with its labels wrapped between words; null when it cannot fit. */
    fun fitted(model: CompareTableModel, width: Int): CompareTableModel? {
        val values = model.columns.mapIndexed { c, col ->
            column(maxOf(w(col.period, ThesisType.tableHead), w(col.filing.orEmpty(), ThesisType.tick)), model.rows.map { it.values[c] })
        }.sum()
        val delta = model.deltaHeader?.let { header ->
            column(w(header, ThesisType.tableHead), model.rows.map { it.delta ?: model.missingDelta })
        } ?: 0
        val room = width - values - delta - pad
        if (w(model.labelHeader, ThesisType.tableHead) > room) return null
        val labels = model.rows.map { model.labelOf(it) }
        if (labels.all { w(it, ThesisType.bodySmall) <= room }) return model
        val wrappable = model.rows.all { it.unit.isNullOrBlank() }
        if (!wrappable || labels.any { l -> l.split(' ').any { w(it, ThesisType.bodySmall) > room } }) return null
        return model.copy(rows = model.rows.map { it.copy(label = wrap(it.label, room)) })
    }

    /** [label] in lines no wider than [room], broken between words only. */
    private fun wrap(label: String, room: Int): String {
        val lines = mutableListOf<String>()
        var line = ""
        label.split(' ').filter { it.isNotEmpty() }.forEach { word ->
            val candidate = if (line.isEmpty()) word else "$line $word"
            if (line.isEmpty() || w(candidate, ThesisType.bodySmall) <= room) {
                line = candidate
            } else {
                lines += line
                line = word
            }
        }
        if (line.isNotEmpty()) lines += line
        return lines.joinToString("\n")
    }
}

/**
 * One basis as a table. Full: before, now (the subject column, with its form) and the change with its tone.
 * [compact]: now and the change, the reference period named in the change header ("vs FY2024").
 */
internal fun deltaTableModel(table: DeltaTable, form: String?, compact: Boolean = false): CompareTableModel {
    val now = CompareColumn(table.currentPeriod.ifBlank { DeepDiveCopy.now }, filing = form?.ifBlank { null }, subject = true)
    val before = CompareColumn(table.referencePeriod.ifBlank { DeepDiveCopy.before })
    return CompareTableModel(
        columns = if (compact) listOf(now) else listOf(before, now),
        rows = table.rows.map { d ->
            val current = ClassicFormat.value(d.currentValue, d.unit)
            CompareRow(
                label = d.label,
                values = if (compact) listOf(current) else listOf(ClassicFormat.value(d.referenceValue, d.unit), current),
                delta = ClassicFormat.change(d),
                deltaTone = ClassicFormat.tone(d.direction),
            )
        },
        deltaHeader = if (compact && table.referencePeriod.isNotBlank()) {
            DeepDiveCopy.vsPeriod(table.referencePeriod)
        } else {
            DeepDiveCopy.changeHeader
        },
    )
}

// -------------------------------------------------------------------------------------------------------------
// Financials
// -------------------------------------------------------------------------------------------------------------

private fun ClassicItems.financialsBlocks(report: DeepDiveReportView, plan: ClassicPlan, quote: ((String) -> Unit)?) {
    val five = plan.fiveYear
    if (five != null && five.hasRevenue) {
        val n = nextFigure()
        add("fin-five") { FiveYearCard(five, n, report.reportId) }
    }
    if (five != null && five.hasMargins) {
        val n = nextFigure()
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
    // Every visual panel type has one home: metric deltas here; range bands, valuation bridges and scenario
    // compares in Price and value; timelines in Risks; evidence ladders and trust scorecards in Evidence. A
    // non-metric panel that lands in financialPanels only because its title says "margin" is drawn by its home.
    plan.outline.financialPanels.filterIsInstance<MetricDeltaPanelView>().forEachIndexed { i, panel ->
        if (panel.metrics.isNotEmpty()) {
            val choices = metricDeltaTables(panel)
            add("fin-delta-$i") {
                TablesBlock(
                    kicker = panel.eyebrow ?: DeepDiveCopy.deltasTitle,
                    choices = choices,
                    title = panel.title,
                    summary = ClassicFormat.clean(panel.summary),
                )
            }
        }
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

private fun moneyValue(v: Double): String = Fmt.money(v)

private fun pctValue(v: Double): String = Fmt.pct(v, 1)

@Composable
private fun FiveYearCard(five: FiveYearSeries, fignum: Int, key: String) {
    // The title names free cash flow (the chapter head already says revenue), so free cash flow takes the gold slot
    // and the readout, as the renderer gives the titled series the gold; revenue keeps its place as the first column.
    val fcfGrowth = five.growthPct(five.freeCashFlow)
    val titled = fcfGrowth != null
    val series = listOf(
        ChartSeries(DeepDiveCopy.revenue, five.revenue, subject = !titled, colorIndex = if (titled) 1 else null),
        ChartSeries(DeepDiveCopy.freeCashFlow, five.freeCashFlow, subject = titled, colorIndex = if (titled) 0 else null),
    ).filter { s -> s.values.any { it != null } }
    ChartCard(
        title = fcfGrowth?.let { growthWords(DeepDiveCopy.freeCashFlow, it) } ?: DeepDiveCopy.financialsTitle,
        fignum = fignum,
        subtitle = if (five.consecutive) DeepDiveCopy.fiveYearSubtitleRevenue else DeepDiveCopy.fiveYearSubtitleRevenueSelected,
        source = five.source,
        legend = legendFor(series, bars = true),
        table = chartTable(five.labels, series, ::moneyValue, DeepDiveCopy.fiscalYear),
    ) {
        ColumnChart(series, five.labels, valueFormat = ::moneyValue, tickFormat = ClassicFormat::wholeMoney, dataKey = key)
    }
}

@Composable
private fun MarginsCard(five: FiveYearSeries, fignum: Int, key: String) {
    val op = five.operatingMargin
    val first = op.indexOfFirst { it != null }
    val last = op.indexOfLast { it != null }
    // The series the title names (operating margin) is drawn gold and carries the readout; gross margin keeps its
    // place first in each column group and in the legend.
    val titled = first >= 0 && last > first
    val series = listOf(
        ChartSeries(DeepDiveCopy.grossMargin, five.grossMargin, colorIndex = if (titled) 1 else null),
        ChartSeries(DeepDiveCopy.operatingMargin, five.operatingMargin, subject = true, colorIndex = if (titled) 0 else null),
    ).filter { s -> s.values.any { it != null } }
    val title = if (titled) {
        val points = op[last]!! - op[first]!!
        DeepDiveCopy.marginsTitleMove(DeepDiveCopy.operatingMargin, ClassicFormat.moved(points >= 0, Fmt.bpsFromPoints(points)))
    } else {
        DeepDiveCopy.marginsTitle
    }
    // Selected years (gaps between them) as columns: a line across uneven gaps would draw slopes the data does not
    // have.
    ChartCard(
        title = title,
        fignum = fignum,
        subtitle = if (five.consecutive) DeepDiveCopy.fiveYearSubtitleMargins else DeepDiveCopy.fiveYearSubtitleMarginsSelected,
        source = five.source,
        legend = legendFor(series, bars = !five.consecutive),
        table = chartTable(five.labels, series, ::pctValue, DeepDiveCopy.fiscalYear),
    ) {
        if (five.consecutive) {
            LineChart(LineChartData(series, five.labels), valueFormat = ::pctValue, tickFormat = ClassicFormat::wholePct, dataKey = key)
        } else {
            ColumnChart(series, five.labels, valueFormat = ::pctValue, tickFormat = ClassicFormat::wholePct, dataKey = key)
        }
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

/**
 * An indicator group's kicker and whether each row names its own period: when every row has the same period it is
 * said once, in the kicker ("Profitability, FY2025"), as the page puts it once in the card's head; rows name a
 * period only when they differ.
 */
internal fun indicatorGroupHead(label: String, rows: List<IndicatorView>): Pair<String, Boolean> {
    val periods = rows.map { ClassicFormat.periodLabel(it.period) }.distinct()
    val shared = periods.singleOrNull()
    return if (shared != null) "$label, $shared" to false else label to (periods.size > 1)
}

@Composable
private fun IndicatorGroup(label: String, rows: List<IndicatorView>) {
    val (kicker, perRow) = indicatorGroupHead(label, rows)
    Group(kicker) {
        RowGroup {
            rows.forEach { ind ->
                row {
                    DataRow(
                        label = ind.label,
                        value = ClassicFormat.value(ind.value, ind.unit),
                        sub = if (perRow) ClassicFormat.periodLabel(ind.period) else null,
                    )
                }
            }
        }
    }
}

/**
 * A metric-delta panel as tables (5.15: "instead of four boxes"), one per basis: the basis is the segmented
 * control's label and the caption under "Now" ("on the quarter"), not a suffix on every row. The change is a signed
 * percent: the panel's items carry no unit, so margins cannot be told apart for bps (HANDOFF-D).
 */
internal fun metricDeltaTables(panel: MetricDeltaPanelView): List<TableChoice> =
    panel.metrics.groupBy { it.basis.lowercase() }.map { (basis, metrics) ->
        val known = basis == "yoy" || basis == "qoq"
        val caption = DeepDiveCopy.basisLabel(basis).takeIf { known }
        fun model(compact: Boolean) = CompareTableModel(
            columns = listOfNotNull(
                CompareColumn(DeepDiveCopy.before).takeUnless { compact },
                CompareColumn(DeepDiveCopy.now, filing = caption, subject = true),
            ),
            rows = metrics.map { m ->
                val now = ClassicFormat.plain(m.currentValue)
                CompareRow(
                    label = m.label,
                    values = if (compact) listOf(now) else listOf(ClassicFormat.plain(m.referenceValue), now),
                    delta = m.deltaPct?.let { Fmt.signedPct(it) },
                    deltaTone = ClassicFormat.tone(m.direction),
                )
            },
            deltaHeader = DeepDiveCopy.changeHeader,
        )
        val segment = when (basis) {
            "yoy" -> DeepDiveCopy.basisYear
            "qoq" -> DeepDiveCopy.basisQuarter
            else -> DeepDiveCopy.changeHeader
        }
        TableChoice(segment, model(compact = false), model(compact = true))
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
    val low = v?.fairValueLow
    val high = v?.fairValueHigh
    if (low != null && high != null) {
        val fig = nextFigure()
        val subtitle = DeepDiveCopy.modelRangeSubtitle(
            v.assumptions?.projectionYears,
            v.assumptions?.terminalGrowthRate?.let { Fmt.pct(it * PERCENT, 1) },
            v.assumptions?.wacc?.let { Fmt.pct(it * PERCENT, 1) },
        )
        add("value-range") { ModelRangeCard(low, high, v.fairValueMid, v.spotPrice, fig, subtitle) }
    }
    rangeBands(plan.outline.valuationPanels, if (low != null && high != null) low to high else null).forEachIndexed { i, band ->
        val fig = nextFigure()
        add("value-band-$i") {
            ModelRangeCard(band.lowValue!!, band.highValue!!, band.midValue, band.referenceValue, fig, ClassicFormat.clean(band.summary))
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
                    StatusBadge(DeepDiveCopy.classification(ClassicFormat.classificationLabel(it), ir.classificationConfidence), Tone.Neutral)
                }
                if (ir.classificationReasons.isNotEmpty()) Points(ir.classificationReasons)
                ir.trapWarnings.forEach { Callout(it) }
            }
        }
    }
    report.valueDiscipline?.let { vd ->
        add("value-discipline") {
            val p = LocalThesisPalette.current
            Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
                TitledKicker(DeepDiveCopy.discipline, DeepDiveCopy.disciplineTitle(vd.score, vd.maxScore))
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
                    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
                        Kicker(DeepDiveCopy.doesNotProve)
                        Text(it, style = ThesisType.bodySmall, color = p.ink2)
                    }
                }
                if (vd.valueTrapWarning.triggered) {
                    ClassicFormat.clean(vd.valueTrapWarning.summary)?.let { Callout(it) }
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
                Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
                    TitledKicker(panel.eyebrow ?: DeepDiveCopy.modelValue, panel.title)
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

/**
 * The range-band panels to draw as range charts: those with both ends, except one that repeats the valuation's own
 * range ([drawn], already chart-drawn from the valuation) to the cent.
 */
internal fun rangeBands(panels: List<DeepDiveVisualPanelView>, drawn: Pair<Double, Double>?): List<RangeBandPanelView> =
    panels.filterIsInstance<RangeBandPanelView>().filter { b ->
        val lo = b.lowValue
        val hi = b.highValue
        lo != null && hi != null && (drawn == null || !(sameCents(lo, drawn.first) && sameCents(hi, drawn.second)))
    }

private fun sameCents(a: Double, b: Double): Boolean = Math.round(a * PERCENT) == Math.round(b * PERCENT)

/**
 * The range chart's conclusion title, generated from where the price in report sits: outside the range, against the
 * base case (rounded to whole percent; within half a percent reads "at"), or inside the range. Neutral words only:
 * never "upside", "target" or "cheap" (5.15, C1). With no price, the base case; with neither, the caption.
 */
internal fun modelRangeTitle(low: Double, high: Double, mid: Double?, price: Double?): String {
    if (price == null || !price.isFinite()) {
        return mid?.takeIf { it.isFinite() }?.let { DeepDiveCopy.rangeTitleBase(ClassicFormat.rangeMoney(it)) }
            ?: DeepDiveCopy.modelRangeCaption
    }
    return when {
        price < minOf(low, high) -> DeepDiveCopy.rangeTitleBelowBear
        price > maxOf(low, high) -> DeepDiveCopy.rangeTitleAboveBull
        mid != null && mid.isFinite() && mid > 0.0 -> {
            val gap = (price / mid - 1.0) * PERCENT
            if (kotlin.math.abs(gap) < AT_BASE_PCT) {
                DeepDiveCopy.rangeTitleAtBase
            } else {
                DeepDiveCopy.rangeTitleVsBase(Fmt.pct(kotlin.math.abs(gap), 0), above = gap > 0)
            }
        }
        else -> DeepDiveCopy.rangeTitleInside
    }
}

private const val AT_BASE_PCT = 0.5

/** Bear to bull model range with the price stored in the report (never "upside"; 5.15). */
@Composable
private fun ModelRangeCard(low: Double, high: Double, mid: Double?, price: Double?, fignum: Int, subtitle: String?) {
    ChartCard(
        title = modelRangeTitle(low, high, mid, price),
        fignum = fignum,
        subtitle = listOfNotNull(DeepDiveCopy.modelRangeCaption, subtitle).joinToString(". "),
        source = DeepDiveCopy.valuationSource,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
            RangeBar(
                bear = low,
                bull = high,
                format = ClassicFormat::rangeMoney,
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
                        row { KillSwitchRow(condition = k.conditionText, sub = killSwitchSub(k.signalType, k.thresholdDescription)) }
                    }
                }
            }
        }
    }
    val top = plan.outline.topRisks
    if (top.isNotEmpty()) add("risk-top") { Group(DeepDiveCopy.topRisks) { Points(top) } }
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
        val fig = nextFigure()
        add("ev-bars") {
            ChartCard(
                title = DeepDiveCopy.mostSources(counted.maxBy { it.evidence.size }.title),
                fignum = fig,
                source = DeepDiveCopy.evidenceSource,
            ) {
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
            val fig = nextFigure()
            add("ev-ladder-$i") {
                ChartCard(
                    title = panel.title,
                    fignum = fig,
                    subtitle = ClassicFormat.clean(panel.summary),
                    source = DeepDiveCopy.evidenceSource,
                ) {
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
    trustScorecards(report).forEachIndexed { i, panel -> add("ev-trust-$i") { TrustScorecard(panel) } }
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
    // Explainers say "How to read this report" once: on the first explainer card inside Evidence, and not at all in
    // the Reading chapter, whose own header already says it (V3: no kicker repeating the headline).
    var howToEyebrow: String? = if (ClassicChapter.Reading in plan.chapters) null else DeepDiveCopy.howToRead
    fun nextHowToEyebrow(): String? = howToEyebrow.also { howToEyebrow = null }
    report.explainers?.let { explainers ->
        val lines = listOf(explainers.confidence, explainers.freshness, explainers.valuation, explainers.omissions)
            .mapNotNull(ClassicFormat::clean)
        if (lines.isNotEmpty()) {
            val eyebrow = nextHowToEyebrow()
            add("ev-howto") {
                val p = LocalThesisPalette.current
                ThesisCard(eyebrow = eyebrow) {
                    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
                        lines.forEach { Text(it, style = ThesisType.bodySmall, color = p.ink2) }
                    }
                }
            }
        }
    }
    report.indicatorsRead?.education.orEmpty().forEachIndexed { i, box ->
        val eyebrow = nextHowToEyebrow()
        add("ev-edu-$i") {
            val p = LocalThesisPalette.current
            ThesisCard(eyebrow = eyebrow, title = box.title.takeIf { it.isNotBlank() }) {
                Text(box.body, style = ThesisType.bodySmall, color = p.ink2)
                ClassicFormat.clean(box.example)?.let {
                    Spacer(Modifier.height(ThesisSpace.s))
                    Text(it, style = ThesisType.caption, color = p.muted)
                }
            }
        }
    }
}

/**
 * The report's trust scorecards (freshness, contradictions, valuation state, evidence count). The reader outline
 * puts them in no chapter bucket, so they are read from the panels directly; one with nothing stated is skipped.
 */
internal fun trustScorecards(report: DeepDiveReportView): List<TrustScorecardPanelView> =
    report.visualPanels.filterIsInstance<TrustScorecardPanelView>().filter { t ->
        t.freshnessState.has() || t.contradictionState.has() || t.valuationState.has() || t.evidenceCount != null
    }

/** A trust scorecard's rows: (label, value) for each state the panel states, states in words. */
internal fun trustScorecardRows(panel: TrustScorecardPanelView): List<Pair<String, String>> = listOfNotNull(
    panel.freshnessState?.takeIf { it.isNotBlank() }?.let { DeepDiveCopy.checkFreshness to DeepDiveCopy.freshnessBadge(it) },
    panel.contradictionState?.takeIf { it.isNotBlank() }?.let { DeepDiveCopy.checkContradictions to ClassicFormat.humanize(it) },
    panel.valuationState?.takeIf { it.isNotBlank() }?.let { DeepDiveCopy.checkValuation to ClassicFormat.humanize(it) },
    panel.evidenceCount?.let { DeepDiveCopy.checkEvidence to DeepDiveCopy.sourcesCount(it) },
)

@Composable
private fun TrustScorecard(panel: TrustScorecardPanelView) {
    val p = LocalThesisPalette.current
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
        TitledKicker(panel.eyebrow?.takeIf { it.isNotBlank() } ?: DeepDiveCopy.reportChecks, panel.title.takeIf { it.isNotBlank() })
        ClassicFormat.clean(panel.summary)?.let { Text(it, style = ThesisType.body, color = p.ink2) }
        RowGroup {
            trustScorecardRows(panel).forEach { (label, value) -> row { DataRow(label, value) } }
        }
    }
}

/** The sources that open in the browser, five at first and "Show all n" for the rest. */
@Composable
private fun SourceList(sources: List<OpenSource>, onOpenUrl: (String) -> Unit) {
    var showAll by rememberSaveable { mutableStateOf(false) }
    val shown = if (showAll) sources else sources.take(SOURCES_SHOWN)
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
                if (showAll) DeepDiveCopy.showFewer else DeepDiveCopy.showAllSources(sources.size),
                onClick = { showAll = !showAll },
            )
        }
    }
}

@Composable
private fun DueDiligenceCard(section: DueDiligenceSectionView) {
    val p = LocalThesisPalette.current
    var expanded by rememberSaveable(section.sectionId) { mutableStateOf(false) }
    val more = section.narrativeParagraphs.isNotEmpty() || section.keyPoints.isNotEmpty() || section.omissions.isNotEmpty()
    ThesisCard(
        eyebrow = DeepDiveCopy.coverageState(section.coverageState),
        title = section.title,
        footer = section.evidenceRefs.size.takeIf { it > 0 }?.let { CardFooter(source = DeepDiveCopy.sourcesCount(it)) },
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
            Text(section.summary, style = ThesisType.body, color = p.ink2)
            if (expanded) {
                section.narrativeParagraphs.forEach { Text(it, style = ThesisType.body, color = p.ink2) }
                if (section.keyPoints.isNotEmpty()) Points(section.keyPoints)
                if (section.omissions.isNotEmpty()) Points(section.omissions, Tone.Unknown)
            }
            if (more) {
                TextAction(
                    if (expanded) DeepDiveCopy.hideFull else DeepDiveCopy.readFull,
                    onClick = { expanded = !expanded },
                )
            }
        }
    }
}
