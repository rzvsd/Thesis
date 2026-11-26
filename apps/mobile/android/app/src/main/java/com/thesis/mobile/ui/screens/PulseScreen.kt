package com.thesis.mobile.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Dp
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.ThesisMonitorSnapshotView
import com.thesis.mobile.ui.RefreshFailureKind
import com.thesis.mobile.ui.components.ActionRow
import com.thesis.mobile.ui.components.ArcSpinner
import com.thesis.mobile.ui.components.BadgeSpec
import com.thesis.mobile.ui.components.BannerTone
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
import com.thesis.mobile.ui.components.InlineBanner
import com.thesis.mobile.ui.components.Kicker
import com.thesis.mobile.ui.components.LeadingRowDividerInset
import com.thesis.mobile.ui.components.LocalInHeroBand
import com.thesis.mobile.ui.components.Loadable
import com.thesis.mobile.ui.components.RowGroup
import com.thesis.mobile.ui.components.SkeletonRow
import com.thesis.mobile.ui.components.SkeletonText
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
import com.thesis.mobile.ui.copy.StateCopy
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
import com.thesis.mobile.ui.today.inert
import com.thesis.mobile.ui.today.parseDay
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.first
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

/**
 * Content width from which Signal and Noise sit side by side: spec 5.7's 400 dp is the window width, and the
 * callouts are measured inside the two 16 dp gutters (a 412 dp phone gives 380 dp).
 */
private val SideBySideMin: Dp = ThesisSpace.x4 * 10 - ThesisSpace.gutter * 2

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
    /**
     * When the last PDF export finished successfully (any value that changes per export, such as its epoch ms): a
     * change plays the confirm haptic (4.7 "export done"). A failed export never changes it, so it never confirms.
     */
    exportDoneAt: Long? = null,
    /**
     * Why the last refresh failed, when [error] is set: with an issue shown, the hero's banner says "Offline ·
     * showing this issue" for [RefreshFailureKind.OFFLINE], else "Couldn’t refresh · showing this issue"; with no
     * issue, the error state says "You’re offline" for OFFLINE (as Home's Pulse block).
     */
    pulseFailure: RefreshFailureKind? = null,
    /** Monitor readings, for the state squares on Your names. */
    monitorSnapshots: List<ThesisMonitorSnapshotView> = emptyList(),
    /** Opens a name; without it the name rows are plain text (a tap never starts a Deep Dive build). */
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
    // Confirm only on a success signal: the first value is the state on arrival, not an export that just finished.
    var lastExportDone by remember { mutableStateOf(exportDoneAt) }
    LaunchedEffect(exportDoneAt) {
        if (exportDoneAt != null && exportDoneAt != lastExportDone) haptics.confirm()
        lastExportDone = exportDoneAt
    }
    // No haptic for a copy: 4.7 keeps confirm for a note saved, an export done and a Deep Dive ready. The feedback
    // is the platform's (the shell's toast through onCopyText, or the system's clipboard notice).
    val copyText: (String) -> Unit = { text ->
        if (onCopyText != null) onCopyText(text) else clipboard.setText(AnnotatedString(text))
    }
    val openSource: (String) -> Unit = { url -> if (onOpenSource != null) onOpenSource(url) else runCatching { uri.openUri(url) } }

    val density = LocalDensity.current
    var barHeightPx by remember { mutableIntStateOf(0) }
    val barHeight = with(density) { barHeightPx.toDp() }
    val list = rememberLazyListState()

    // The top bar collapses once the hero's bottom passes under it; the pills pin under the bar when they reach it.
    val heroUnderBar by remember {
        derivedStateOf {
            val hero = list.layoutInfo.visibleItemsInfo.firstOrNull { it.index == HERO_ITEM }
            // Before the first layout the hero is not in the list info yet: not collapsed (no flash of a filled bar).
            if (hero == null) list.firstVisibleItemIndex > HERO_ITEM else hero.offset + hero.size <= barHeightPx
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
                // Offline says so (as Home's Pulse block does); any other failure is a plain "Couldn't load".
                val offline = pulseFailure == RefreshFailureKind.OFFLINE
                ErrorState(
                    title = if (offline) StateCopy.OFFLINE_TITLE else KitCopy.couldNotLoad(TodayCopy.PULSE_ISSUE_SUBJECT),
                    cause = if (offline) StateCopy.OFFLINE_CAUSE else null,
                    onRetry = onRefresh,
                    modifier = Modifier.padding(top = barHeight + ThesisSpace.l).padding(horizontal = ThesisSpace.gutter),
                )
            },
        ) { b ->
            ThesisRefreshBox(refreshing = refreshing, onRefresh = onRefresh, indicatorTop = barHeight) {
                // A refresh failed while an issue is shown: a banner under the hero line. The meta line right above
                // it already gives the issue's time (and the eyebrow its date), so the banner does not repeat them.
                val stale = when {
                    error == null -> null
                    pulseFailure == RefreshFailureKind.OFFLINE -> TodayCopy.OFFLINE_SHOWING_ISSUE
                    else -> TodayCopy.STALE_SHOWING_ISSUE
                }
                Brief(
                    brief = b,
                    list = list,
                    dayLabel = dayLabel,
                    staleBanner = stale,
                    padding = padding,
                    barHeightPx = barHeightPx,
                    pillsPinned = pillsPinned,
                    monitorSnapshots = monitorSnapshots,
                    initialChapter = initialChapter,
                    onCopyTable = { copyText(TapeModel.tsv(pulse?.tape)) },
                    onOpenName = onOpenName,
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
                        // The PDF action gives way to the spinner: TalkBack hears why (rubric A3).
                        ArcSpinner(
                            Modifier.clearAndSetSemantics {
                                contentDescription = TodayCopy.EXPORTING_PDF
                                liveRegion = LiveRegionMode.Polite
                            },
                            size = ThesisSpace.iconS,
                        )
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
    staleBanner: String?,
    padding: PaddingValues,
    barHeightPx: Int,
    pillsPinned: Boolean,
    monitorSnapshots: List<ThesisMonitorSnapshotView>,
    initialChapter: ChapterKind?,
    onCopyTable: () -> Unit,
    onOpenName: ((String) -> Unit)?,
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

    // A tapped pill (or the chapter the screen opened at) keeps the selection while its scroll runs and after it
    // lands, until the reader scrolls on: the scroll-spy reads at 45% of the viewport, so after a short chapter
    // lands under the pinned pills the next chapter's start has already crossed that line, and the spy alone would
    // light the next pill. The landing is just under the pinned pills.
    val showPills = chapters.size >= 2
    var pillsHeightPx by remember { mutableIntStateOf(0) }
    var pinnedChapter by remember { mutableStateOf<Int?>(null) }
    var jump by remember { mutableStateOf<Job?>(null) }
    var jumpSeq by remember { mutableIntStateOf(0) }
    // A chapter lands with its header a 24 dp gap under the pinned pills (its own top padding minus that gap).
    fun landingOffset(index: Int): Int {
        val top = with(density) { (if (index == 0) ThesisSpace.x3 else ThesisSpace.chapterPadding).roundToPx() }
        val gap = with(density) { ThesisSpace.xxl.roundToPx() }
        return -(barHeightPx + pillsHeightPx) + top - gap
    }
    fun jumpTo(index: Int, instant: Boolean = reduced) {
        val target = starts.getOrNull(index) ?: return
        val offset = landingOffset(index)
        jump?.cancel()
        val seq = ++jumpSeq
        pinnedChapter = index
        jump = scope.launch {
            try {
                if (instant) list.scrollToItem(target, offset) else list.animateScrollToItem(target, offset)
                // Landed: hold the selection until the list moves from here (a drag, a fling, a TalkBack scroll).
                val landed = list.firstVisibleItemIndex to list.firstVisibleItemScrollOffset
                snapshotFlow { list.firstVisibleItemIndex to list.firstVisibleItemScrollOffset }.first { it != landed }
            } finally {
                // A newer jump has taken the pin over: a cancelled one must not clear it.
                if (jumpSeq == seq) pinnedChapter = null
            }
        }
    }
    val selected = pinnedChapter ?: spy.selected
    // Opened at a chapter (Home's rows and tape): once, after the bar and the pills have been measured.
    var openedAt by remember(brief.reportId, initialChapter) { mutableStateOf(false) }
    val measured = barHeightPx > 0 && (pillsHeightPx > 0 || !showPills)
    LaunchedEffect(brief.reportId, initialChapter, measured) {
        val i = chapters.indexOfFirst { it.kind == initialChapter }
        if (measured && !openedAt && i >= 0) {
            openedAt = true
            jumpTo(i, instant = true)
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
                    if (generated != null || brief.heroPartial) {
                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(ThesisSpace.s),
                            verticalArrangement = Arrangement.spacedBy(ThesisSpace.xs),
                        ) {
                            if (generated != null) {
                                Text(generated, style = ThesisType.caption, color = LocalThesisPalette.current.muted)
                            }
                            // Only when no chapter says it in its own header (once per screen).
                            if (brief.heroPartial) StatusBadge(TodayCopy.PARTIAL_COVERAGE, Tone.Attention)
                        }
                    }
                    if (staleBanner != null) InlineBanner(staleBanner, tone = BannerTone.Neutral)
                }
            }
            // Always an item (the chapters' list positions stay fixed); empty for a one-chapter issue, where a lone
            // pill would navigate nowhere.
            item(key = "pills") {
                if (showPills) {
                    ChapterPills(
                        chapters = titles,
                        selectedIndex = selected,
                        onSelect = { jumpTo(it) },
                        modifier = Modifier
                            .onSizeChanged { pillsHeightPx = it.height }
                            .alpha(if (pillsPinned) 0f else 1f)
                            .then(if (pillsPinned) Modifier.clearAndSetSemantics { } else Modifier),
                    )
                }
            }
            chapters.forEachIndexed { i, chapter ->
                item(key = chapter.kind.name, contentType = "chapter") {
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
                    // Echoes the hero's eyebrow: the kit draws the 28 dp accent rule and the accent colour for an
                    // eyebrow in a hero band, so the colophon's eyebrow is set as one.
                    CompositionLocalProvider(LocalInHeroBand provides true) {
                        Eyebrow(TodayCopy.COLOPHON, Modifier.padding(top = ThesisSpace.l))
                    }
                    if (generated != null) Text(generated, style = ThesisType.caption, color = p.muted)
                    Text(TodayCopy.DISCLAIMER, style = ThesisType.caption, color = p.muted)
                }
            }
        }
        if (pillsPinned && showPills) {
            ChapterPills(
                chapters = titles,
                selectedIndex = selected,
                onSelect = { jumpTo(it) },
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
    onOpenName: ((String) -> Unit)?,
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
                // The issue's events (filings, releases): a compact list, never story paragraphs.
                if (chapter.items.isNotEmpty()) MarkedList(chapter.items, ThesisType.body)
                SignalNoise(chapter.signal, chapter.noise)
            }
            ChapterKind.Names -> {
                val states = monitorSnapshots.associateBy { it.ticker.trim().uppercase() }
                RowGroup {
                    chapter.names.forEach { mention ->
                        row(LeadingRowDividerInset) {
                            val state = states[mention.ticker]?.state
                            val stateWord = TodayCopy.stateWord(state)
                            TickerRow(
                                ticker = mention.ticker,
                                stateTone = thesisStateTone(state),
                                stateLabel = stateWord,
                                line2 = mention.sentence,
                                onClick = { onOpenName?.invoke(mention.ticker) },
                                modifier = if (onOpenName == null) {
                                    Modifier.inert(listOf(mention.ticker, stateWord, mention.sentence).joinToString(", "))
                                } else {
                                    Modifier
                                },
                            )
                        }
                    }
                }
            }
            ChapterKind.Watch -> MarkedList(chapter.items, ThesisType.story)
            ChapterKind.Headlines -> {
                // The headline above quotes the top story: its source opens from the first row.
                val lead = chapter.leadHeadline
                val leadSource = lead?.source ?: lead?.url?.let(PulseText::host)
                if (lead?.url != null || chapter.headlines.isNotEmpty()) {
                    RowGroup {
                        if (lead?.url != null) {
                            row {
                                ActionRow(
                                    icon = null,
                                    title = TodayCopy.readAt(leadSource ?: lead.url),
                                    caption = lead.at?.let(fmt::time),
                                    external = true,
                                    onClick = { onOpenSource(lead.url) },
                                )
                            }
                        }
                        chapter.headlines.forEach { h ->
                            row { HeadlineRow(h, fmt::time, onOpenSource) }
                        }
                    }
                } else if (leadSource != null) {
                    Text(leadSource, style = ThesisType.caption, color = p.muted)
                }
            }
            ChapterKind.Sources -> {
                if (chapter.sources.isNotEmpty()) {
                    RowGroup {
                        chapter.sources.forEach { s ->
                            // The host only when it adds something ("investor.apple.com / investor.apple.com" does not).
                            val host = PulseText.host(s.url)?.takeUnless { it.equals(s.label, ignoreCase = true) }
                            row {
                                ActionRow(
                                    icon = null,
                                    title = s.title,
                                    caption = TodayCopy.sourceCaption(host, s.at?.let { fmt.marketDate(it.atZone(zone).toLocalDate()) }),
                                    external = true,
                                    onClick = { onOpenSource(s.url) },
                                )
                            }
                        }
                    }
                }
                if (chapter.notes.isNotEmpty()) {
                    // One label, then the notes as sentences (never "Coverage:" on every line).
                    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.xs)) {
                        Eyebrow(TodayCopy.COVERAGE)
                        chapter.notes.forEach { Text(it, style = ThesisType.caption, color = p.muted) }
                    }
                }
            }
        }
    }
}

/**
 * A list with neutral square marks (gold is never a bullet, principle 3). Each mark is centred on its item's first
 * line, from the style's line height at the current font scale (a fixed offset drifts at 2.0x).
 */
@Composable
private fun MarkedList(items: List<String>, style: TextStyle) {
    val p = LocalThesisPalette.current
    val lineHeight = with(LocalDensity.current) { style.lineHeight.toDp() }
    val markTop = (lineHeight - ThesisSpace.statusSquare) / 2
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
        items.forEach { item ->
            Row(horizontalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
                StatusSquare(p.muted, Modifier.padding(top = markTop))
                Text(item, style = style, color = p.ink)
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
            // One height for the pair (the taller one's), as the Deep Dive's card pairs.
            Row(Modifier.height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
                blocks.forEach { (label, text) -> LabelledCallout(label, text, Modifier.weight(1f).fillMaxHeight(), fill = true) }
            }
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
                blocks.forEach { (label, text) -> LabelledCallout(label, text) }
            }
        }
    }
}

/** A kicker over a callout; with [fill] the callout takes the column's remaining height (a side-by-side pair). */
@Composable
private fun LabelledCallout(label: String, text: String, modifier: Modifier = Modifier, fill: Boolean = false) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(ThesisSpace.xs)) {
        Kicker(label)
        Callout(text, if (fill) Modifier.weight(1f) else Modifier)
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

/**
 * Loading: the final layout in skeleton form, so the crossfade changes no shapes. The hero as the loaded one is
 * (eyebrow, the morning line's two `heroLine` lines, the meta line; no KPI grid, which the kit's SkeletonHero would
 * draw and the brief never shows), then the first chapter: its header and four rows in their card, as Markets.
 */
@Composable
private fun PulseSkeleton() {
    ShimmerHost {
        Column(Modifier.fillMaxSize()) {
            HeroBand(underTopBar = true) {
                SkeletonText(ThesisType.eyebrow, widthFraction = 0.4f)
                SkeletonText(ThesisType.capped(ThesisType.heroLine), widthFraction = 0.9f, lines = 2)
                SkeletonText(ThesisType.caption, widthFraction = 0.3f)
            }
            Column(
                Modifier
                    .padding(horizontal = ThesisSpace.gutter)
                    .padding(top = ThesisSpace.x3),
                verticalArrangement = Arrangement.spacedBy(ThesisSpace.l),
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.m)) {
                    SkeletonText(ThesisType.kicker, widthFraction = 0.3f)
                    SkeletonText(ThesisType.capped(ThesisType.title), widthFraction = 0.85f, lines = 2)
                }
                // Two-line rows: a market row's level sits over its change, the height of a two-line row.
                RowGroup { repeat(4) { row { SkeletonRow() } } }
            }
        }
    }
}
