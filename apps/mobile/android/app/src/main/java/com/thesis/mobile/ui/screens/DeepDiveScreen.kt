package com.thesis.mobile.ui.screens

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.animateScrollBy
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import com.thesis.mobile.model.ConvictionJournalEntryView
import com.thesis.mobile.model.DeepDiveReportView
import com.thesis.mobile.model.IssuerView
import com.thesis.mobile.model.OppositeCaseReportView
import com.thesis.mobile.model.ScenarioResultView
import com.thesis.mobile.model.ValuationDisplayView
import com.thesis.mobile.ui.charts.kit.RangeBar
import com.thesis.mobile.ui.components.ActionRow
import com.thesis.mobile.ui.components.BannerTone
import com.thesis.mobile.ui.components.Callout
import com.thesis.mobile.ui.components.ChapterPills
import com.thesis.mobile.ui.components.ChipRow
import com.thesis.mobile.ui.components.DataRow
import com.thesis.mobile.ui.components.EmptyState
import com.thesis.mobile.ui.components.ErrorState
import com.thesis.mobile.ui.components.HeroBand
import com.thesis.mobile.ui.components.InlineBanner
import com.thesis.mobile.ui.components.Kicker
import com.thesis.mobile.ui.components.KpiSpec
import com.thesis.mobile.ui.components.Loadable
import com.thesis.mobile.ui.components.NoteBlock
import com.thesis.mobile.ui.components.NumberField
import com.thesis.mobile.ui.components.ReportTopBar
import com.thesis.mobile.ui.components.RowGroup
import com.thesis.mobile.ui.components.RunBar
import com.thesis.mobile.ui.components.SecondaryButton
import com.thesis.mobile.ui.components.SectionHeader
import com.thesis.mobile.ui.components.SheetActionRow
import com.thesis.mobile.ui.components.SkeletonCard
import com.thesis.mobile.ui.components.SkeletonHero
import com.thesis.mobile.ui.components.StateCrossfade
import com.thesis.mobile.ui.components.TextAction
import com.thesis.mobile.ui.components.ThesisChip
import com.thesis.mobile.ui.components.ThesisSheet
import com.thesis.mobile.ui.components.ThesisTextField
import com.thesis.mobile.ui.components.rememberNoteAutosave
import com.thesis.mobile.ui.copy.DeepDiveCopy
import com.thesis.mobile.ui.copy.KitCopy
import com.thesis.mobile.ui.copy.StateCopy
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.format.LocalFmt
import com.thesis.mobile.ui.format.Missing
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.motion.rememberHaptics
import com.thesis.mobile.ui.motion.rememberScrollSpy
import com.thesis.mobile.ui.shell.HeroUnderBars
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

/**
 * One report (a `Report(id)`, `ReportClassic(id)` or `DeepDiveRunning(ticker)` entry): the report itself, the
 * build or open in progress, or why it failed. The ticker search and recent reports are the Research root's
 * ([ResearchScreen], 5.12). A loaded report shows the server-rendered page when it can ([DeepDiveReportHost]),
 * else the classic view (5.15), which reads like the page: hero, sticky chapter pills, chapters, upshots.
 *
 * [onFollowChange] follows or unfollows the report's name from the top bar; [following] overrides the
 * [watchlist] lookup.
 */
@Composable
fun DeepDiveScreen(
    report: DeepDiveReportView?,
    isLoading: Boolean,
    errorMessage: String?,
    userTier: String?,
    reportNoteDraft: String,
    noteUpdatedAt: String?,
    isSavingNote: Boolean,
    convictionTimeline: List<ConvictionJournalEntryView>,
    convictionTimelineError: String?,
    oppositeCase: OppositeCaseReportView?,
    oppositeCaseError: String?,
    isGeneratingOppositeCase: Boolean,
    onReportNoteChange: (String) -> Unit,
    onSaveReportNote: () -> Unit,
    onGenerateOppositeCase: () -> Unit,
    onRefreshConvictionTimeline: () -> Unit,
    scenarioResult: ScenarioResultView?,
    isRunningScenario: Boolean,
    onRunScenario: (Int?, Double?, Double?) -> Unit,
    onRequireUpgrade: (String) -> Unit,
    onSubmitReportFeedback: (String, String) -> Unit,
    onNotify: (String) -> Unit,
    watchlist: List<String>,
    /** The error card's button: opens the stored report again, or runs the build again (principle 11). */
    onRetry: () -> Unit,
    onBack: () -> Unit,
    padding: PaddingValues,
    onOpenScenarioStress: (() -> Unit)? = null,
    webPage: DeepDiveWebPageAccess? = null,
    /** Label of the error card's button: what [onRetry] does ("Open report again"); null keeps "Try again". */
    retryLabel: String? = null,
    following: Boolean? = null,
    onFollowChange: ((Boolean) -> Unit)? = null,
    /**
     * True when the entry opens a stored report (nothing is being generated): the loading state is the page's own
     * skeleton, not the build screen. Defaults to the Report entry's signal (only it passes a [retryLabel]);
     * HANDOFF-D asks WP-INT to pass it explicitly.
     */
    openingStoredReport: Boolean = retryLabel != null,
) {
    // Loading → report (or → failed) crossfades instead of swapping in one frame (#27, 4.4); a newer report for
    // the same entry updates in place.
    val state: Loadable<DeepDiveReportView> = when {
        report != null -> Loadable.Ready(report)
        isLoading -> Loadable.Loading
        else -> Loadable.Failed(errorMessage)
    }
    StateCrossfade(
        state = state,
        modifier = Modifier.fillMaxSize(),
        loading = {
            if (openingStoredReport) ReportOpeningSkeleton(padding) else DeepDiveLoadingScreen(modifier = Modifier.padding(padding))
        },
        failed = { DeepDiveFailedState(errorMessage = errorMessage, onRetry = onRetry, retryLabel = retryLabel, padding = padding) },
    ) { shown ->
        val tools = DeepDiveNativeTools(
            isPro = userTier.equals("PRO", ignoreCase = true),
            reportNoteDraft = reportNoteDraft,
            noteUpdatedAt = noteUpdatedAt,
            isSavingNote = isSavingNote,
            convictionTimeline = convictionTimeline,
            convictionTimelineError = convictionTimelineError,
            oppositeCase = oppositeCase,
            oppositeCaseError = oppositeCaseError,
            isGeneratingOppositeCase = isGeneratingOppositeCase,
            scenarioResult = scenarioResult,
            isRunningScenario = isRunningScenario,
            onReportNoteChange = onReportNoteChange,
            onSaveReportNote = onSaveReportNote,
            onGenerateOppositeCase = onGenerateOppositeCase,
            onRefreshConvictionTimeline = onRefreshConvictionTimeline,
            onRunScenario = onRunScenario,
            onRequireUpgrade = onRequireUpgrade,
            onSubmitReportFeedback = onSubmitReportFeedback,
            onNotify = onNotify,
            onOpenScenarioStress = onOpenScenarioStress,
        )
        val isFollowing = following ?: (shown.ticker != null && watchlist.any { it.equals(shown.ticker, ignoreCase = true) })
        DeepDiveReportHost(shown, webPage, tools, onBack, padding) { onOpenNewView ->
            DeepDiveClassic(
                report = shown,
                tools = tools,
                following = isFollowing,
                onFollowChange = onFollowChange ?: {},
                onBack = onBack,
                padding = padding,
                onOpenNewView = onOpenNewView,
            )
        }
    }
}

/**
 * A stored report on its way (5.15, principle 3): the page's own skeleton, the hero then a card, and one honest line.
 * No build steps: nothing is being generated.
 */
@Composable
private fun ReportOpeningSkeleton(padding: PaddingValues) {
    Column(
        Modifier
            .fillMaxSize()
            .padding(padding)
            .semantics { liveRegion = LiveRegionMode.Polite },
    ) {
        HeroBand { SkeletonHero() }
        ReadingColumn(Modifier.padding(top = ThesisSpace.xxl)) { SkeletonCard() }
        Text(
            DeepDiveCopy.openingReport,
            Modifier.padding(ThesisSpace.gutter),
            style = ThesisType.caption,
            color = LocalThesisPalette.current.muted,
        )
    }
}

/**
 * A report entry with nothing to show: its open or build failed ([errorMessage]), or a build entry outlived its
 * job (MainViewModel normally drops those). The button retries this entry; it never shows the ticker search.
 */
@Composable
private fun DeepDiveFailedState(errorMessage: String?, onRetry: () -> Unit, retryLabel: String?, padding: PaddingValues) {
    Box(
        Modifier
            .fillMaxSize()
            .padding(padding)
            .padding(ThesisSpace.gutter),
        contentAlignment = Alignment.Center,
    ) {
        if (errorMessage?.contains("No internet connection", ignoreCase = true) == true) {
            ErrorState(title = StateCopy.OFFLINE_TITLE, cause = StateCopy.OFFLINE_CAUSE, onRetry = onRetry)
        } else {
            ErrorState(
                title = StateCopy.deepDiveUnavailable,
                cause = errorMessage?.ifBlank { null } ?: DeepDiveCopy.noLongerRunning,
                retryLabel = retryLabel ?: KitCopy.TRY_AGAIN,
                onRetry = onRetry,
            )
        }
    }
}

// -------------------------------------------------------------------------------------------------------------
// The classic view
// -------------------------------------------------------------------------------------------------------------

private sealed interface ClassicSheet {
    data object More : ClassicSheet
    data class Quote(val source: QuoteSource, val text: String) : ClassicSheet
}

/**
 * The classic report (5.15): its own ReportTopBar (the shell shows none on a loaded report), the "Classic view"
 * banner when the new view can open, then the page. Long-press on a paragraph opens the quote sheet ("Add to note",
 * "Copy paragraph"); the overflow opens exports and feedback.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun DeepDiveClassic(
    report: DeepDiveReportView,
    tools: DeepDiveNativeTools,
    following: Boolean,
    onFollowChange: (Boolean) -> Unit,
    onBack: () -> Unit,
    padding: PaddingValues,
    onOpenNewView: (() -> Unit)?,
    fiveYear: FiveYearSeries? = null,
) {
    val p = LocalThesisPalette.current
    val context = LocalContext.current
    val uriHandler = LocalUriHandler.current
    val clipboard = LocalClipboardManager.current
    val listState = rememberLazyListState()
    var sheet by remember { mutableStateOf<ClassicSheet?>(null) }
    val filing = ClassicFormat.filingLabel(report.filingRead?.form, report.filingRead?.period)
    val plan = remember(report, fiveYear) { classicPlan(report, fiveYear, withDesk = true) }
    val kpis = remember(report, plan) { heroKpis(report, plan.fiveYear) }

    fun requirePro(action: () -> Unit) {
        if (!tools.isPro) {
            tools.onRequireUpgrade("report_export")
            return
        }
        runCatching(action).onFailure { tools.onNotify(DeepDiveCopy.exportFailed) }
    }
    val exportPdf = { requirePro { shareExport(context, createPdfExport(context, report, ReportExportType.FULL_REPORT)) } }
    val exportCard = { requirePro { shareExport(context, createShareCard(context, report)) } }
    val exportMemo = { requirePro { shareExport(context, createPdfExport(context, report, ReportExportType.INVESTMENT_MEMO)) } }

    // The entries and their lambdas are built once per report (and per Pro state, which changes which blocks
    // exist), so a sheet, a note keystroke or a running scenario does not hand every list item new lambdas. The
    // blocks read the tools through this state, so each recomposes only when what it reads changes.
    val current by rememberUpdatedState(tools)
    val hasStress = tools.onOpenScenarioStress != null
    val items = remember(report, plan, tools.isPro, hasStress) {
        // Free users see one Pro upsell on the page (5.15): the desk's, which names the what-if model too.
        val whatIf = report.valuation?.takeIf { tools.isPro }
        val ctx = ClassicContext(
            ticker = report.ticker,
            filing = filing,
            onQuote = { source, text -> sheet = ClassicSheet.Quote(source, text) },
            onOpenUrl = { url -> runCatching { uriHandler.openUri(url) } },
            whatIf = whatIf?.let { valuation ->
                @Composable {
                    ScenarioSection(
                        isPro = current.isPro,
                        valuation = valuation,
                        isRunning = current.isRunningScenario,
                        scenarioResult = current.scenarioResult,
                        onRunScenario = current.onRunScenario,
                        onRequireUpgrade = current.onRequireUpgrade,
                    )
                }
            },
            desk = deskBlocks(
                report = report,
                filing = filing,
                hasStress = hasStress,
                tools = { current },
                exports = DeskExports(
                    pdf = { shareExport(context, createPdfExport(context, report, ReportExportType.FULL_REPORT)) },
                    card = { shareExport(context, createShareCard(context, report)) },
                    memo = { shareExport(context, createPdfExport(context, report, ReportExportType.INVESTMENT_MEMO)) },
                ),
            ),
        )
        ClassicItems().apply { addChapters(report, plan, ctx) }
    }
    val jumpHolder = remember { arrayOfNulls<(String) -> Unit>(1) }

    Column(Modifier.fillMaxSize()) {
        Box(
            Modifier
                .fillMaxWidth()
                .background(p.surface)
                .padding(top = padding.calculateTopPadding()),
        ) {
            ReportTopBar(
                ticker = report.ticker?.uppercase() ?: report.readerTicker(),
                onBack = onBack,
                following = following,
                onFollowChange = onFollowChange,
                onOverflow = { sheet = ClassicSheet.More },
            )
        }
        ClassicReportList(
            report = report,
            plan = plan,
            items = items,
            kpis = kpis,
            sample = false,
            listState = listState,
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(bottom = padding.calculateBottomPadding() + ThesisSpace.x5),
            beforeHero = onOpenNewView?.let { open ->
                {
                    InlineBanner(
                        DeepDiveCopy.classicBanner,
                        actionLabel = DeepDiveCopy.openNewView,
                        onAction = open,
                    )
                }
            },
            onJump = { jump -> jumpHolder[0] = jump },
        )
    }

    when (val s = sheet) {
        ClassicSheet.More -> ThesisSheet(onDismissRequest = { sheet = null }, title = DeepDiveCopy.moreTitle) {
            onOpenNewView?.let { open ->
                SheetActionRow(ThesisIcons.DeepDive, DeepDiveCopy.openNewView, onClick = {
                    sheet = null
                    open()
                })
            }
            SheetActionRow(ThesisIcons.ExportPdf, DeepDiveCopy.exportPdf, onClick = {
                sheet = null
                exportPdf()
            })
            SheetActionRow(ThesisIcons.Share, DeepDiveCopy.shareCard, onClick = {
                sheet = null
                exportCard()
            })
            SheetActionRow(ThesisIcons.Document, DeepDiveCopy.memoPdf, onClick = {
                sheet = null
                exportMemo()
            })
            SheetActionRow(ThesisIcons.Notes, DeepDiveCopy.reportFeedback, onClick = {
                sheet = null
                jumpHolder[0]?.invoke(FEEDBACK_ENTRY)
            })
        }
        is ClassicSheet.Quote -> ThesisSheet(onDismissRequest = { sheet = null }, title = DeepDiveCopy.quoteSheetTitle) {
            Text(
                s.text,
                Modifier.padding(horizontal = ThesisSpace.gutter, vertical = ThesisSpace.s),
                style = ThesisType.story,
                color = p.ink2,
                maxLines = QUOTE_PREVIEW_LINES,
                overflow = TextOverflow.Ellipsis,
            )
            SheetActionRow(ThesisIcons.Notes, DeepDiveCopy.addToNote, onClick = {
                tools.onReportNoteChange(NoteQuotes.append(tools.reportNoteDraft, NoteQuotes.format(s.text, s.source)))
                tools.onSaveReportNote()
                tools.onNotify(DeepDiveCopy.addedToNote)
                sheet = null
            })
            SheetActionRow(ThesisIcons.Copy, DeepDiveCopy.copyParagraph, onClick = {
                clipboard.setText(AnnotatedString(s.text))
                tools.onNotify(DeepDiveCopy.copied)
                sheet = null
            })
        }
        null -> Unit
    }
}

private const val QUOTE_PREVIEW_LINES = 6

/** The list entry of the desk's feedback block (the overflow's "Report feedback" lands on it, not on the note). */
private const val FEEDBACK_ENTRY = "desk-feedback"

/** What the export rows run (the Pro gate is ExportSection's). */
private class DeskExports(val pdf: () -> Unit, val card: () -> Unit, val memo: () -> Unit)

/** The "Your notes" chapter's blocks; each reads the tools through [tools] when it composes. */
private fun deskBlocks(
    report: DeepDiveReportView,
    filing: String?,
    hasStress: Boolean,
    tools: () -> DeepDiveNativeTools,
    exports: DeskExports,
): List<Pair<String, @Composable () -> Unit>> = buildList {
    add(
        "notes" to @Composable {
            val t = tools()
            NotesSection(
                noteDraft = t.reportNoteDraft,
                noteUpdatedAt = t.noteUpdatedAt,
                isSaving = t.isSavingNote,
                onNoteChange = t.onReportNoteChange,
                onSave = t.onSaveReportNote,
                filing = listOfNotNull(report.ticker?.uppercase(), filing).joinToString(" ").ifBlank { null },
            )
        },
    )
    add(
        "conviction" to @Composable {
            val t = tools()
            DeepDiveConvictionSection(
                isPro = t.isPro,
                timeline = t.convictionTimeline,
                timelineError = t.convictionTimelineError,
                oppositeCase = t.oppositeCase,
                oppositeCaseError = t.oppositeCaseError,
                isGeneratingOppositeCase = t.isGeneratingOppositeCase,
                onGenerateOppositeCase = t.onGenerateOppositeCase,
                onRefreshTimeline = t.onRefreshConvictionTimeline,
                onRequireUpgrade = t.onRequireUpgrade,
                upsell = if (report.valuation != null) DeepDiveCopy.deskPro else DeepDiveCopy.convictionPro,
            )
        },
    )
    if (hasStress) {
        add(
            "stress" to @Composable {
                ActionRow(
                    icon = ThesisIcons.ScenarioStress,
                    title = DeepDiveCopy.stressAction,
                    onClick = { tools().onOpenScenarioStress?.invoke() },
                    caption = DeepDiveCopy.stressCaption,
                )
            },
        )
    }
    add("feedback" to @Composable { ReportFeedbackSection(onSubmit = { c, d -> tools().onSubmitReportFeedback(c, d) }) })
    add(
        "export" to @Composable {
            val t = tools()
            ExportSection(
                isPro = t.isPro,
                onRequireUpgrade = t.onRequireUpgrade,
                onNotify = t.onNotify,
                onExportPdf = exports.pdf,
                onExportCard = exports.card,
                onExportMemo = exports.memo,
            )
        },
    )
}

private fun DeepDiveReportView.readerTicker(): String = issuer?.name ?: DeepDiveCopy.deepDive

/**
 * The page as one list: optional banner, the hero, the sticky chapter pills (with scroll-spy) when there are two
 * chapters or more, the chapters, the disclaimer. [onJump] hands the screen a jump to one entry by its key (the
 * overflow's "Report feedback" goes to the desk's feedback block), which lands it just below the sticky pills.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
internal fun ClassicReportList(
    report: DeepDiveReportView,
    plan: ClassicPlan,
    items: ClassicItems,
    kpis: List<KpiSpec>,
    sample: Boolean,
    listState: LazyListState,
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(),
    underTopBar: Boolean = false,
    pills: Boolean = plan.chapters.size >= 2,
    beforeHero: (@Composable () -> Unit)? = null,
    afterHero: (@Composable () -> Unit)? = null,
    onJump: ((String) -> Unit) -> Unit = {},
) {
    val p = LocalThesisPalette.current
    val prefix = listOfNotNull(beforeHero, afterHero).size + 1
    val offset = prefix + if (pills) 1 else 0
    val starts = items.chapterStarts.map { it + offset }
    val spy = rememberScrollSpy(listState, starts)
    val scope = rememberCoroutineScope()
    val reduced = LocalReducedMotion.current
    onJump { key ->
        val at = items.entries.indexOfFirst { it.key.substringBefore('#') == key }
        if (at >= 0) scope.launch { listState.jumpToEntry(at + offset, reduced) }
    }
    LazyColumn(modifier.fillMaxSize(), state = listState, contentPadding = contentPadding) {
        beforeHero?.let { banner ->
            item("banner") { ReadingColumn(Modifier.padding(vertical = ThesisSpace.s)) { banner() } }
        }
        item("hero") { ClassicHero(report, kpis, sample, underTopBar) }
        afterHero?.let { block ->
            item("after-hero") { ReadingColumn(Modifier.padding(top = ThesisSpace.l)) { block() } }
        }
        if (pills) {
            stickyHeader("pills") {
                ChapterPills(plan.chapters.map { it.label }, spy.selected, { spy.jumpTo(it) })
            }
        }
        items.entries.forEach { entry ->
            item(entry.key, contentType = entry.key.substringBefore('-')) {
                ReadingColumn(Modifier.padding(top = entry.top)) { entry.content() }
            }
        }
        item("footer") {
            ReadingColumn(Modifier.padding(top = ThesisSpace.x5, bottom = ThesisSpace.xxl)) {
                Text(DeepDiveCopy.disclaimer, style = ThesisType.caption, color = p.muted)
            }
        }
    }
}

/**
 * Scrolls item [index] to the top of the list (glides; jumps under reduced motion), then out from under the sticky
 * pills, which would otherwise cover its first lines. Near the end of the list, where the item cannot reach the
 * top, it stays where the scroll left it.
 */
private suspend fun LazyListState.jumpToEntry(index: Int, reduced: Boolean) {
    if (reduced) scrollToItem(index) else animateScrollToItem(index)
    val info = layoutInfo
    val pills = info.visibleItemsInfo.firstOrNull { it.key == "pills" }?.size ?: return
    val item = info.visibleItemsInfo.firstOrNull { it.index == index } ?: return
    val under = (pills - (item.offset - info.viewportStartOffset)).toFloat()
    if (under > 0f) {
        if (reduced) scrollBy(-under) else animateScrollBy(-under)
    }
}

// -------------------------------------------------------------------------------------------------------------
// The sample (5.16): the same page, under Today's root bar, with the follow bar
// -------------------------------------------------------------------------------------------------------------

/**
 * The bundled sample as the classic page: hero under the root bar ("Sample report" badge), the sample note, its
 * chapters (no desk, no pills: the root bar sits where they would stick) and a sticky "Follow your first name"
 * bar. [report] null while the asset is parsed (a skeleton), [failed] when it could not be read.
 */
@Composable
internal fun SampleDeepDiveContent(
    report: DeepDiveReportView?,
    fiveYear: FiveYearSeries?,
    padding: PaddingValues,
    onFollowName: () -> Unit,
    onDismiss: () -> Unit,
    failed: Boolean = false,
) {
    // The root bar takes its over-hero palette only while a HeroBand is under it: the page or its skeleton, never
    // the failed state (an EmptyState on the page background).
    if (report != null || !failed) HeroUnderBars()
    val uriHandler = LocalUriHandler.current
    val listState = rememberLazyListState()
    Box(Modifier.fillMaxSize()) {
        when {
            report != null -> {
                val shown = remember(report) { sampleWithIssuer(report) }
                val plan = remember(shown, fiveYear) { classicPlan(shown, fiveYear, withDesk = false) }
                val kpis = remember(shown, plan) { heroKpis(shown, plan.fiveYear) }
                val items = remember(shown, plan) {
                    val ctx = ClassicContext(
                        ticker = shown.ticker,
                        filing = ClassicFormat.filingLabel(shown.filingRead?.form, shown.filingRead?.period),
                        onQuote = null,
                        onOpenUrl = { url -> runCatching { uriHandler.openUri(url) } },
                    )
                    ClassicItems().apply { addChapters(shown, plan, ctx) }
                }
                ClassicReportList(
                    report = shown,
                    plan = plan,
                    items = items,
                    kpis = kpis,
                    sample = true,
                    listState = listState,
                    contentPadding = PaddingValues(bottom = padding.calculateBottomPadding() + SAMPLE_BAR_SPACE),
                    underTopBar = true,
                    pills = false,
                    afterHero = {
                        InlineBanner(DeepDiveCopy.sampleNote, actionLabel = DeepDiveCopy.closeSample, onAction = onDismiss)
                    },
                )
            }
            failed -> Box(
                Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(ThesisSpace.gutter),
                contentAlignment = Alignment.Center,
            ) {
                // Nothing to retry (the asset is in the app): the one action closes the sample, with no retry icon.
                EmptyState(
                    sentence = DeepDiveCopy.sampleFailed,
                    modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                    actionLabel = DeepDiveCopy.closeSample,
                    onAction = onDismiss,
                )
            }
            else -> Column(Modifier.fillMaxSize()) {
                HeroBand(underTopBar = true) { SkeletonHero() }
                ReadingColumn(Modifier.padding(top = ThesisSpace.xxl)) { SkeletonCard() }
                Text(
                    DeepDiveCopy.loadingSample,
                    Modifier.padding(ThesisSpace.gutter),
                    style = ThesisType.caption,
                    color = LocalThesisPalette.current.muted,
                )
            }
        }
        RunBar(
            label = DeepDiveCopy.followFirstName,
            onClick = onFollowName,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = padding.calculateBottomPadding()),
        )
    }
}

private val SAMPLE_BAR_SPACE = ThesisSpace.x5 + ThesisSpace.x4

/**
 * The bundled sample names only its ticker; the hero shows the company ("Microsoft", with "MSFT" in the meta line),
 * as the page does. Any other report is returned as it is.
 */
internal fun sampleWithIssuer(report: DeepDiveReportView): DeepDiveReportView =
    if (report.issuer?.name.isNullOrBlank() && report.ticker.equals(DeepDiveCopy.sampleTicker, ignoreCase = true)) {
        report.copy(issuer = IssuerView(DeepDiveCopy.sampleIssuer))
    } else {
        report
    }

// -------------------------------------------------------------------------------------------------------------
// Desk tools (also opened one at a time from the new view's tool row, DeepDiveWebReportState.kt)
// -------------------------------------------------------------------------------------------------------------

/**
 * The report's note: NoteBlock with autosave. [onSave] asks the view model to save the draft; a save counts as
 * done when [isSaving] has gone up and come down again.
 */
@Composable
internal fun NotesSection(
    noteDraft: String,
    noteUpdatedAt: String?,
    isSaving: Boolean,
    onNoteChange: (String) -> Unit,
    onSave: () -> Unit,
    filing: String? = null,
) {
    val fmt = LocalFmt.current
    val clipboard = LocalClipboardManager.current
    val saving by rememberUpdatedState(isSaving)
    val save by rememberUpdatedState(onSave)
    val autosave = rememberNoteAutosave(
        text = noteDraft,
        save = {
            save()
            withTimeoutOrNull(SAVE_START_MS) { snapshotFlow { saving }.first { it } }
            withTimeoutOrNull(SAVE_END_MS) { snapshotFlow { saving }.first { !it } } != null
        },
        onLeave = { save() },
    )
    NoteBlock(
        value = noteDraft,
        onValueChange = onNoteChange,
        filing = filing,
        saveState = autosave.state,
        savedAgo = parseReportInstant(noteUpdatedAt)?.let(fmt::relative),
        onRetry = { autosave.retry() },
        onCopy = { clipboard.setText(AnnotatedString(noteDraft)) }.takeIf { noteDraft.isNotBlank() },
    )
}

private const val SAVE_START_MS = 2_000L
private const val SAVE_END_MS = 20_000L

/** The what-if inputs, read in percent and handed to the model as fractions. */
internal object ScenarioInput {
    const val MAX_YEARS = 30

    private fun clean(s: String): String = s.trim().removeSuffix("%").trim().replace(Fmt.MINUS, "-").replace(',', '.')

    /** Whole years from 1 to 30; null when blank or out of range. */
    fun years(s: String): Int? = clean(s).toIntOrNull()?.takeIf { it in 1..MAX_YEARS }

    /** A percent ("2.5", "2.5%", "−1"); null when it is not a number. */
    fun percent(s: String): Double? = clean(s).toDoubleOrNull()?.takeIf { it.isFinite() }

    /** A stored fraction (0.025) as the field's percent text ("2.5"). */
    fun fieldText(fraction: Double?): String = fraction?.let { Fmt.number(it * 100.0, 1).replace(Fmt.MINUS, "-") }.orEmpty()

    /** The three errors (years, growth, rate) for the fields as typed; blank fields keep the report's value. */
    fun errors(years: String, growth: String, wacc: String): Triple<String?, String?, String?> {
        val y = if (years.isNotBlank() && years(years) == null) DeepDiveCopy.errYears else null
        val g = if (growth.isNotBlank() && percent(growth) == null) DeepDiveCopy.errPercent else null
        val gv = percent(growth)
        val wv = percent(wacc)
        val w = when {
            wacc.isNotBlank() && wv == null -> DeepDiveCopy.errPercent
            gv != null && wv != null && wv <= gv -> DeepDiveCopy.errWaccAboveGrowth
            else -> null
        }
        return Triple(y, g, w)
    }
}

/**
 * Change the model's assumptions (5.15 "What-if"): projection years, terminal growth and discount rate in percent,
 * checked as typed; the result shows the report's model value, yours, and yours against the price in the report.
 */
@Composable
internal fun ScenarioSection(
    isPro: Boolean,
    valuation: ValuationDisplayView?,
    isRunning: Boolean,
    scenarioResult: ScenarioResultView?,
    onRunScenario: (Int?, Double?, Double?) -> Unit,
    onRequireUpgrade: (String) -> Unit,
) {
    val p = LocalThesisPalette.current
    val haptics = rememberHaptics()
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
        SectionHeader(kicker = DeepDiveCopy.whatIfKicker, headline = DeepDiveCopy.whatIfTitle, deck = DeepDiveCopy.whatIfDeck)
        if (valuation == null) {
            Text(DeepDiveCopy.noValuation, style = ThesisType.bodySmall, color = p.muted)
            return@Column
        }
        if (!isPro) {
            Callout(DeepDiveCopy.proOnlyWhatIf)
            TextAction(DeepDiveCopy.seePro, onClick = { onRequireUpgrade("what_if_scenario") }, trailing = true)
            return@Column
        }
        val a = valuation.assumptions
        var years by rememberSaveable(valuation) { mutableStateOf(a?.projectionYears?.toString().orEmpty()) }
        var growth by rememberSaveable(valuation) { mutableStateOf(ScenarioInput.fieldText(a?.terminalGrowthRate)) }
        var wacc by rememberSaveable(valuation) { mutableStateOf(ScenarioInput.fieldText(a?.wacc)) }
        val (yearsError, growthError, waccError) = ScenarioInput.errors(years, growth, wacc)
        NumberField(years, { years = it }, DeepDiveCopy.projectionYears, unit = DeepDiveCopy.years, error = yearsError)
        NumberField(growth, { growth = it }, DeepDiveCopy.terminalGrowth, unit = "%", error = growthError)
        NumberField(wacc, { wacc = it }, DeepDiveCopy.discountRate, unit = "%", error = waccError)
        val valid = yearsError == null && growthError == null && waccError == null
        SecondaryButton(
            text = if (isRunning) DeepDiveCopy.running else DeepDiveCopy.runScenario,
            onClick = {
                if (!valid) {
                    haptics.reject()
                    return@SecondaryButton
                }
                onRunScenario(
                    ScenarioInput.years(years),
                    ScenarioInput.percent(growth)?.let { it / 100.0 },
                    ScenarioInput.percent(wacc)?.let { it / 100.0 },
                )
            },
            enabled = valid && !isRunning,
            loading = isRunning,
        )
        scenarioResult?.let { ScenarioResultCard(it) }
    }
}

/**
 * The what-if result, on the page under the section's header (one container: the rows' own panel, no card around
 * it): the report's model value, yours, and the price in report with how far your value sits from it. Rows and the
 * range bar write each value the same way (ClassicFormat.rangeMoney: whole dollars, cents only when the value has
 * them), so "$228" never also reads "$228.00" in one block.
 */
@Composable
private fun ScenarioResultCard(result: ScenarioResultView) {
    val p = LocalThesisPalette.current
    val base = result.base.fairValueMid
    val mine = result.scenario.fairValueMid
    val price = result.scenario.spotPrice ?: result.base.spotPrice
    Column(Modifier.padding(top = ThesisSpace.s), verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
        TitledKicker(DeepDiveCopy.modelValue, DeepDiveCopy.modelResultTitle)
        RowGroup {
            row { DataRow(DeepDiveCopy.baseCase, modelMoney(base)) }
            row {
                DataRow(
                    label = DeepDiveCopy.yourInputs,
                    value = modelMoney(mine),
                    delta = if (base != null && mine != null && base != 0.0) Fmt.signedPct((mine / base - 1.0) * 100.0) else null,
                )
            }
            if (price != null && mine != null && price > 0.0) {
                val gap = (mine / price - 1.0) * 100.0
                row {
                    DataRow(
                        label = DeepDiveCopy.priceInReport,
                        value = ClassicFormat.rangeMoney(price),
                        delta = DeepDiveCopy.yourValueGap(Fmt.signedPct(gap)),
                        deltaTone = if (gap >= 0) Tone.Favourable else Tone.Unfavourable,
                    )
                }
            }
        }
        val low = result.scenario.fairValueLow
        val high = result.scenario.fairValueHigh
        if (low != null && high != null) {
            RangeBar(
                bear = low,
                bull = high,
                format = ClassicFormat::rangeMoney,
                base = base,
                price = price,
                yourValue = mine,
                priceLabel = DeepDiveCopy.priceInReport,
            )
        }
        result.deterministicModel?.let(DeepDiveCopy::modelName)?.let {
            Text(it, style = ThesisType.caption, color = p.muted)
        }
        if (result.omissions.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
                Kicker(DeepDiveCopy.leftOut)
                result.omissions.forEach { Text(it.omissionText, style = ThesisType.bodySmall, color = p.ink2) }
            }
        }
    }
}

/** A model value as the range bar writes it; a value the model did not compute says so. */
private fun modelMoney(v: Double?): String = v?.let(ClassicFormat::rangeMoney) ?: Fmt.money(null, missing = Missing.NotComputed)

/** "Was this report useful?": chips with no preselection, an optional line, and Send with a sent state. */
@Composable
internal fun ReportFeedbackSection(onSubmit: (String, String) -> Unit) {
    var category by rememberSaveable { mutableStateOf<String?>(null) }
    var details by rememberSaveable { mutableStateOf("") }
    var sent by rememberSaveable { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
        SectionHeader(kicker = DeepDiveCopy.reportFeedback, headline = DeepDiveCopy.feedbackTitle, deck = DeepDiveCopy.feedbackDeck)
        if (sent) {
            InlineBanner(DeepDiveCopy.sent, tone = BannerTone.Neutral)
            return@Column
        }
        ChipRow(contentPadding = PaddingValues()) {
            DeepDiveCopy.feedbackOptions.forEach { (key, label) ->
                item(key) {
                    ThesisChip(
                        label = label,
                        selected = category == key,
                        onClick = { category = if (category == key) null else key },
                        role = androidx.compose.ui.semantics.Role.RadioButton,
                    )
                }
            }
        }
        ThesisTextField(
            value = details,
            onValueChange = { details = it },
            label = DeepDiveCopy.feedbackDetails,
            singleLine = false,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
        )
        SecondaryButton(
            text = DeepDiveCopy.send,
            onClick = {
                val c = category ?: return@SecondaryButton
                onSubmit(c, details.trim())
                sent = true
            },
            enabled = category != null,
            commit = true,
        )
    }
}

/** Export: the full report as a PDF, the share card, the memo text; Pro only, failures said plainly. */
@Composable
internal fun ExportSection(
    isPro: Boolean,
    onRequireUpgrade: (String) -> Unit,
    onNotify: (String) -> Unit,
    onExportPdf: () -> Unit,
    onExportCard: () -> Unit,
    onExportMemo: () -> Unit,
) {
    fun runExport(action: () -> Unit) {
        if (!isPro) {
            onRequireUpgrade("report_export")
            return
        }
        runCatching(action).onFailure { onNotify(DeepDiveCopy.exportFailed) }
    }
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
        Kicker(DeepDiveCopy.exportTitle)
        RowGroup {
            row(LeadingInset) {
                ActionRow(ThesisIcons.ExportPdf, DeepDiveCopy.exportPdf, { runExport(onExportPdf) }, caption = DeepDiveCopy.exportPdfCaption)
            }
            row(LeadingInset) {
                ActionRow(ThesisIcons.Share, DeepDiveCopy.shareCard, { runExport(onExportCard) }, caption = DeepDiveCopy.shareCardCaption)
            }
            row(LeadingInset) {
                ActionRow(ThesisIcons.Document, DeepDiveCopy.memoPdf, { runExport(onExportMemo) }, caption = DeepDiveCopy.memoCaption)
            }
        }
    }
}

private val LeadingInset = com.thesis.mobile.ui.components.LeadingRowDividerInset
