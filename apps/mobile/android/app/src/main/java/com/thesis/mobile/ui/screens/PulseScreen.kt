package com.thesis.mobile.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.Dp
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.ThesisMonitorSnapshotView
import com.thesis.mobile.ui.components.ActionRow
import com.thesis.mobile.ui.components.ArcSpinner
import com.thesis.mobile.ui.components.BadgeSpec
import com.thesis.mobile.ui.components.Callout
import com.thesis.mobile.ui.components.ChapterDivider
import com.thesis.mobile.ui.components.ChapterHeader
import com.thesis.mobile.ui.components.ChapterPills
import com.thesis.mobile.ui.components.DataRow
import com.thesis.mobile.ui.components.EmptyState
import com.thesis.mobile.ui.components.ErrorState
import com.thesis.mobile.ui.components.Eyebrow
import com.thesis.mobile.ui.components.HeroBand
import com.thesis.mobile.ui.components.HighlightText
import com.thesis.mobile.ui.components.Kicker
import com.thesis.mobile.ui.components.LeadingRowDividerInset
import com.thesis.mobile.ui.components.Loadable
import com.thesis.mobile.ui.components.RowGroup
import com.thesis.mobile.ui.components.SkeletonHero
import com.thesis.mobile.ui.components.SkeletonRow
import com.thesis.mobile.ui.components.StateCrossfade
import com.thesis.mobile.ui.components.StatusBadge
import com.thesis.mobile.ui.components.StatusSquare
import com.thesis.mobile.ui.components.TextAction
import com.thesis.mobile.ui.components.ThesisIconButton
import com.thesis.mobile.ui.components.ThesisRefreshBox
import com.thesis.mobile.ui.components.ThesisTopBar
import com.thesis.mobile.ui.components.TickerRow
import com.thesis.mobile.ui.components.Upshot
import com.thesis.mobile.ui.copy.KitCopy
import com.thesis.mobile.ui.copy.TodayCopy
import com.thesis.mobile.ui.format.LocalFmt
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.motion.ShimmerHost
import com.thesis.mobile.ui.motion.rememberDataEntranceCoordinator
import com.thesis.mobile.ui.motion.rememberHaptics
import com.thesis.mobile.ui.motion.rememberScrollSpy
import com.thesis.mobile.ui.motion.rememberShowSkeleton
import com.thesis.mobile.ui.motion.staggeredEntrance
import com.thesis.mobile.ui.shell.HeroUnderBars
import com.thesis.mobile.ui.theme.LocalReducedMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone
import com.thesis.mobile.ui.theme.thesisStateTone
import com.thesis.mobile.ui.today.ChapterKind
import com.thesis.mobile.ui.today.Headline
import com.thesis.mobile.ui.today.LocalTodayClock
import com.thesis.mobile.ui.today.PlainRow
import com.thesis.mobile.ui.today.PulseBrief
import com.thesis.mobile.ui.today.PulseChapter
import com.thesis.mobile.ui.today.PulseText
import com.thesis.mobile.ui.today.TapeModel
import com.thesis.mobile.ui.today.parseDay
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import java.time.Instant

/*
 * The Pulse brief (docs/app-redesign/DESIGN-DIRECTION.md 5.7): a dated morning brief read like a Deep Dive. A
 * HeroBand under the status and top bars (morning line in `heroLine`), sticky chapter pills driven by scroll-spy,
 * then the chapters the issue has content for (Markets, What changed, Your names, Watch, Headlines, Sources), the
 * upshot and a colophon. Every line comes from the issue (PulseBrief); nothing is invented when a section is missing.
 */

/** List positions: the hero, the pills, then one item per chapter. */
private const val HERO_ITEM = 0
private const val PILLS_ITEM = 1
private const val FIRST_CHAPTER_ITEM = 2

/** Width from which Signal and Noise sit side by side. */
private val SideBySideMin: Dp = ThesisSpace.x4 * 10

@Suppress("UNUSED_PARAMETER")
@Composable
fun PulseScreen(
    pulse: PulseReportView?,
    watchlist: List<String>,
    onBack: () -> Unit,
    onRunDeepDive: (String) -> Unit,
    onExportPdf: () -> Unit,
    onRefresh: () -> Unit,
    /** The shell's padding (bottom: the navigation bar); the hero runs under the status and top bars itself. */
    padding: PaddingValues = PaddingValues(),
    /** No issue yet and one is on its way (a skeleton). */
    loading: Boolean = false,
    /** The issue could not be loaded (an error state with a retry). */
    error: String? = null,
    /** A refresh the reader pulled, from the ViewModel. */
    refreshing: Boolean = false,
    /** The PDF export is running (an inline arc replaces its icon). */
    isExporting: Boolean = false,
    /** Monitor readings, for the state squares on Your names. */
    monitorSnapshots: List<ThesisMonitorSnapshotView> = emptyList(),
    /** Opens a name; without it a name row opens a Deep Dive on it (the old behaviour). */
    onOpenName: ((String) -> Unit)? = null,
    /** Copies the brief as text; without it the system clipboard is used directly. */
    onCopyText: ((String) -> Unit)? = null,
    /** Opens a source link; without it the platform's URI handler. */
    onOpenSource: ((String) -> Unit)? = null,
    /** Chapter to open at (Home's chapter rows and tape). */
    initialChapter: ChapterKind? = null,
) {
    val brief = remember(pulse, watchlist) { pulse?.let { PulseBrief.from(it, watchlist) } }
    // Nothing for the skeleton's grace period, then the skeleton (held for its minimum time).
    val showSkeleton = rememberShowSkeleton(loading = loading && pulse == null)
    val state: Loadable<PulseBrief> = when {
        brief != null && !showSkeleton -> Loadable.Ready(brief)
        showSkeleton || (loading && brief == null) -> Loadable.Loading
        brief != null -> Loadable.Ready(brief)
        error != null -> Loadable.Failed(null)
        else -> Loadable.Empty(TodayCopy.NO_PULSE_DAY)
    }
    val fmt = LocalFmt.current
    val clock = LocalTodayClock.current
    val day = parseDay(pulse?.cycleEnd) ?: brief?.generatedAt?.atZone(clock.zone)?.toLocalDate()
    val dayLabel = day?.let(fmt::marketDate)

    val clipboard = LocalClipboardManager.current
    val uri = LocalUriHandler.current
    val haptics = rememberHaptics()
    var exportWasRunning by remember { mutableStateOf(isExporting) }
    LaunchedEffect(isExporting) {
        if (exportWasRunning && !isExporting) haptics.confirm()
        exportWasRunning = isExporting
    }
    val copyText: (String) -> Unit = { text ->
        if (onCopyText != null) onCopyText(text) else clipboard.setText(AnnotatedString(text))
        haptics.confirm()
    }
    val openSource: (String) -> Unit = { url -> if (onOpenSource != null) onOpenSource(url) else runCatching { uri.openUri(url) } }
    val openName: (String) -> Unit = { t -> if (onOpenName != null) onOpenName(t) else onRunDeepDive(t) }

    val density = LocalDensity.current
    var barHeightPx by remember { mutableIntStateOf(0) }
    val barHeight = with(density) { barHeightPx.toDp() }
    val list = rememberLazyListState()

    // The top bar collapses once the hero's bottom passes under it; the pills pin under the bar when they reach it.
    val heroUnderBar by remember {
        derivedStateOf {
            val hero = list.layoutInfo.visibleItemsInfo.firstOrNull { it.index == HERO_ITEM }
            hero == null || hero.offset + hero.size <= barHeightPx
        }
    }
    val pillsPinned by remember {
        derivedStateOf {
            val pills = list.layoutInfo.visibleItemsInfo.firstOrNull { it.index == PILLS_ITEM }
            if (pills == null) list.firstVisibleItemIndex > PILLS_ITEM else pills.offset <= barHeightPx
        }
    }
    val ready = state is Loadable.Ready
    val heroShown = ready || showSkeleton
    // Over the hero (or its skeleton) the bar is transparent; the empty and error states have no hero.
    val collapsed = if (ready) heroUnderBar else !heroShown
    if (heroShown) HeroUnderBars(collapsed = collapsed)

    Box(Modifier.fillMaxSize()) {
        StateCrossfade(
            state = state,
            onRetry = onRefresh,
            loading = { if (showSkeleton) PulseSkeleton() },
            empty = {
                EmptyState(
                    sentence = TodayCopy.NO_PULSE_DAY,
                    how = TodayCopy.NO_PULSE_DAY_HOW,
                    icon = ThesisIcons.Pulse,
                    modifier = Modifier.padding(top = barHeight + ThesisSpace.l).padding(horizontal = ThesisSpace.gutter),
                )
            },
            failed = {
                ErrorState(
                    title = KitCopy.couldNotLoad(TodayCopy.PULSE_ISSUE_SUBJECT),
                    onRetry = onRefresh,
                    modifier = Modifier.padding(top = barHeight + ThesisSpace.l).padding(horizontal = ThesisSpace.gutter),
                )
            },
        ) { b ->
            ThesisRefreshBox(refreshing = refreshing, onRefresh = onRefresh, indicatorTop = barHeight) {
                Brief(
                    brief = b,
                    list = list,
                    dayLabel = dayLabel,
                    padding = padding,
                    barHeightPx = barHeightPx,
                    pillsPinned = pillsPinned,
                    monitorSnapshots = monitorSnapshots,
                    initialChapter = initialChapter,
                    onCopyTable = { copyText(TapeModel.tsv(pulse?.tape)) },
                    onOpenName = openName,
                    onOpenSource = openSource,
                )
            }
        }

        ThesisTopBar(
            modifier = Modifier.onSizeChanged { barHeightPx = it.height },
            title = TodayCopy.PULSE_TITLE,
            subtitle = dayLabel,
            onBack = onBack,
            collapsed = collapsed,
            overHero = heroShown,
        ) {
            if (ready) {
                Box(Modifier.size(ThesisSpace.touchMin), contentAlignment = Alignment.Center) {
                    if (isExporting) {
                        ArcSpinner(Modifier.clearAndSetSemantics { }, size = ThesisSpace.iconS)
                    } else {
                        ThesisIconButton(ThesisIcons.ExportPdf, TodayCopy.EXPORT_PDF, onExportPdf)
                    }
                }
                ThesisIconButton(ThesisIcons.Share, TodayCopy.COPY_AS_TEXT, {
                    copyText(brief!!.asText(listOfNotNull(TodayCopy.PULSE_TITLE, dayLabel).joinToString(" · ")))
                })
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Brief(
    brief: PulseBrief,
    list: LazyListState,
    dayLabel: String?,
    padding: PaddingValues,
    barHeightPx: Int,
    pillsPinned: Boolean,
    monitorSnapshots: List<ThesisMonitorSnapshotView>,
    initialChapter: ChapterKind?,
    onCopyTable: () -> Unit,
    onOpenName: (String) -> Unit,
    onOpenSource: (String) -> Unit,
) {
    val p = LocalThesisPalette.current
    val fmt = LocalFmt.current
    val density = LocalDensity.current
    val reduced = LocalReducedMotion.current
    val scope = rememberCoroutineScope()
    val coordinator = rememberDataEntranceCoordinator(dataKey = brief.reportId)
    val chapters = brief.chapters
    val starts = remember(chapters) { chapters.indices.map { FIRST_CHAPTER_ITEM + it } }
    val spy = rememberScrollSpy(list, starts)

    // A tapped pill keeps the selection while its scroll runs, and lands the chapter just under the pinned pills.
    var pillsHeightPx by remember { mutableIntStateOf(0) }
    var pinnedChapter by remember { mutableStateOf<Int?>(null) }
    var jump by remember { mutableStateOf<Job?>(null) }
    // A chapter lands with its header a 24 dp gap under the pinned pills (its own top padding minus that gap).
    fun landingOffset(index: Int): Int {
        val top = with(density) { (if (index == 0) ThesisSpace.x3 else ThesisSpace.chapterPadding).roundToPx() }
        val gap = with(density) { ThesisSpace.xxl.roundToPx() }
        return -(barHeightPx + pillsHeightPx) + top - gap
    }
    fun jumpTo(index: Int) {
        val target = starts.getOrNull(index) ?: return
        val offset = landingOffset(index)
        jump?.cancel()
        pinnedChapter = index
        jump = scope.launch {
            try {
                if (reduced) list.scrollToItem(target, offset) else list.animateScrollToItem(target, offset)
            } finally {
                pinnedChapter = null
            }
        }
    }
    val selected = pinnedChapter ?: spy.selected
    // Opened at a chapter (Home's rows and tape): once, after the bar and the pills have been measured.
    var openedAt by remember(brief.reportId, initialChapter) { mutableStateOf(false) }
    val measured = barHeightPx > 0 && pillsHeightPx > 0
    LaunchedEffect(brief.reportId, initialChapter, measured) {
        val i = chapters.indexOfFirst { it.kind == initialChapter }
        if (measured && !openedAt && i >= 0) {
            openedAt = true
            list.scrollToItem(starts[i], landingOffset(i))
        }
    }

    val generated = TodayCopy.generatedLine(
        brief.generatedAt?.let(fmt::time),
        brief.dataRetrievedAt?.let(fmt::time),
    )
    val titles = chapters.map { it.label }

    Box(Modifier.fillMaxSize()) {
        LazyColumn(
            state = list,
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = padding.calculateBottomPadding() + ThesisSpace.x5),
        ) {
            item(key = "hero") {
                HeroBand(underTopBar = true) {
                    Eyebrow(TodayCopy.heroEyebrow(dayLabel))
                    Text(
                        brief.morningLine.ifBlank { brief.leadConclusion },
                        modifier = Modifier.staggeredEntrance(0, coordinator),
                        style = ThesisType.capped(ThesisType.heroLine),
                        color = LocalThesisPalette.current.ink,
                    )
                    if (generated != null || brief.partial) {
                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(ThesisSpace.s),
                            verticalArrangement = Arrangement.spacedBy(ThesisSpace.xs),
                        ) {
                            if (generated != null) {
                                Text(generated, style = ThesisType.caption, color = LocalThesisPalette.current.muted)
                            }
                            if (brief.partial) StatusBadge(TodayCopy.PARTIAL_COVERAGE, Tone.Attention)
                        }
                    }
                }
            }
            item(key = "pills") {
                ChapterPills(
                    chapters = titles,
                    selectedIndex = selected,
                    onSelect = ::jumpTo,
                    modifier = Modifier
                        .onSizeChanged { pillsHeightPx = it.height }
                        .alpha(if (pillsPinned) 0f else 1f)
                        .then(if (pillsPinned) Modifier.clearAndSetSemantics { } else Modifier),
                )
            }
            chapters.forEachIndexed { i, chapter ->
                item(key = chapter.kind.name) {
                    Column(
                        Modifier
                            .staggeredEntrance(i + 1, coordinator)
                            .padding(horizontal = ThesisSpace.gutter),
                    ) {
                        Chapter(
                            index = i + 1,
                            chapter = chapter,
                            monitorSnapshots = monitorSnapshots,
                            onCopyTable = onCopyTable,
                            onOpenName = onOpenName,
                            onOpenSource = onOpenSource,
                            modifier = Modifier.padding(top = if (i == 0) ThesisSpace.x3 else ThesisSpace.chapterPadding),
                        )
                        if (i < chapters.lastIndex) ChapterDivider(Modifier.padding(top = ThesisSpace.chapterPadding))
                    }
                }
            }
            if (brief.upshot != null) {
                item(key = "upshot") {
                    Upshot(
                        brief.upshot,
                        label = TodayCopy.UPSHOT,
                        modifier = Modifier.padding(horizontal = ThesisSpace.gutter).padding(top = ThesisSpace.chapterPadding),
                    )
                }
            }
            item(key = "colophon") {
                Column(
                    Modifier
                        .padding(horizontal = ThesisSpace.gutter)
                        .padding(top = ThesisSpace.chapterPadding),
                    verticalArrangement = Arrangement.spacedBy(ThesisSpace.s),
                ) {
                    ChapterDivider()
                    Eyebrow(TodayCopy.COLOPHON, Modifier.padding(top = ThesisSpace.l))
                    if (generated != null) Text(generated, style = ThesisType.caption, color = p.muted)
                    Text(TodayCopy.DISCLAIMER, style = ThesisType.caption, color = p.muted)
                }
            }
        }
        if (pillsPinned) {
            ChapterPills(
                chapters = titles,
                selectedIndex = selected,
                onSelect = ::jumpTo,
                modifier = Modifier.padding(top = with(LocalDensity.current) { barHeightPx.toDp() }),
            )
        }
    }
}

@Composable
private fun Chapter(
    index: Int,
    chapter: PulseChapter,
    monitorSnapshots: List<ThesisMonitorSnapshotView>,
    onCopyTable: () -> Unit,
    onOpenName: (String) -> Unit,
    onOpenSource: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val p = LocalThesisPalette.current
    val fmt = LocalFmt.current
    val zone = LocalTodayClock.current.zone
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(ThesisSpace.l)) {
        ChapterHeader(
            numeral = index,
            label = chapter.label,
            title = chapter.title,
            badges = if (chapter.partial) listOf(BadgeSpec(TodayCopy.PARTIAL_COVERAGE, Tone.Attention)) else emptyList(),
        )
        when (chapter.kind) {
            ChapterKind.Markets -> {
                if (chapter.tape.isNotEmpty()) {
                    RowGroup {
                        chapter.tape.forEach { line ->
                            row { DataRow(label = line.name, value = line.level, delta = line.delta, deltaTone = line.tone) }
                        }
                    }
                    TextAction(TodayCopy.COPY_AS_TABLE, onCopyTable)
                }
                Paragraphs(chapter)
            }
            ChapterKind.Changed -> {
                Paragraphs(chapter)
                SignalNoise(chapter.signal, chapter.noise)
            }
            ChapterKind.Names -> {
                val states = monitorSnapshots.associateBy { it.ticker.trim().uppercase() }
                RowGroup {
                    chapter.names.forEach { mention ->
                        row(LeadingRowDividerInset) {
                            val state = states[mention.ticker]?.state
                            TickerRow(
                                ticker = mention.ticker,
                                stateTone = thesisStateTone(state),
                                stateLabel = TodayCopy.stateWord(state),
                                line2 = mention.sentence,
                                onClick = { onOpenName(mention.ticker) },
                            )
                        }
                    }
                }
            }
            ChapterKind.Watch -> {
                Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
                    chapter.items.forEach { item ->
                        Row(horizontalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
                            Box(Modifier.padding(top = ThesisSpace.s)) { StatusSquare(p.accent) }
                            Text(item, style = ThesisType.story, color = p.ink)
                        }
                    }
                }
            }
            ChapterKind.Headlines -> {
                RowGroup {
                    chapter.headlines.forEach { h ->
                        row { HeadlineRow(h, fmt::time, onOpenSource) }
                    }
                }
            }
            ChapterKind.Sources -> {
                if (chapter.sources.isNotEmpty()) {
                    RowGroup {
                        chapter.sources.forEach { s ->
                            row {
                                ActionRow(
                                    icon = null,
                                    title = s.label,
                                    caption = TodayCopy.sourceCaption(PulseText.host(s.url), s.at?.let { fmt.marketDate(it.atZone(zone).toLocalDate()) }),
                                    external = true,
                                    onClick = { onOpenSource(s.url) },
                                )
                            }
                        }
                    }
                }
                if (chapter.notes.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.xs)) {
                        chapter.notes.forEach { Text(TodayCopy.coverageNote(it), style = ThesisType.caption, color = p.muted) }
                    }
                }
            }
        }
    }
}

@Composable
private fun Paragraphs(chapter: PulseChapter) {
    val p = LocalThesisPalette.current
    chapter.paragraphs.forEach { para ->
        if (para.lead.isNotBlank()) {
            HighlightText(lead = para.lead, rest = para.rest)
        } else {
            Text(para.rest, style = ThesisType.story, color = p.ink)
        }
    }
}

@Composable
private fun SignalNoise(signal: String?, noise: String?) {
    if (signal == null && noise == null) return
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val wide = maxWidth >= SideBySideMin
        val blocks: List<Pair<String, String>> = listOfNotNull(signal?.let { TodayCopy.SIGNAL to it }, noise?.let { TodayCopy.NOISE to it })
        if (wide && blocks.size == 2) {
            Row(horizontalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
                blocks.forEach { (label, text) -> LabelledCallout(label, text, Modifier.weight(1f)) }
            }
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
                blocks.forEach { (label, text) -> LabelledCallout(label, text) }
            }
        }
    }
}

@Composable
private fun LabelledCallout(label: String, text: String, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(ThesisSpace.xs)) {
        Kicker(label)
        Callout(text)
    }
}

@Composable
private fun HeadlineRow(h: Headline, time: (Instant) -> String, onOpen: (String) -> Unit) {
    val caption = TodayCopy.sourceCaption(h.source, h.at?.let(time))
    if (h.url != null) {
        ActionRow(icon = null, title = h.title, caption = caption, external = true, onClick = { onOpen(h.url) })
    } else {
        PlainRow(title = h.title, caption = caption)
    }
}

/** Loading: the hero in skeleton form, then four skeleton rows. */
@Composable
private fun PulseSkeleton() {
    ShimmerHost {
        Column(Modifier.fillMaxSize()) {
            HeroBand(underTopBar = true) { SkeletonHero() }
            Column(Modifier.padding(ThesisSpace.gutter)) { repeat(4) { SkeletonRow() } }
        }
    }
}
