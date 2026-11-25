package com.thesis.mobile.ui.screens

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.ui.components.BannerTone
import com.thesis.mobile.ui.components.ChipRow
import com.thesis.mobile.ui.components.DayHeader
import com.thesis.mobile.ui.components.EmptyState
import com.thesis.mobile.ui.components.ErrorState
import com.thesis.mobile.ui.components.InlineBanner
import com.thesis.mobile.ui.components.LeadingRowDividerInset
import com.thesis.mobile.ui.components.RowPosition
import com.thesis.mobile.ui.components.RunBar
import com.thesis.mobile.ui.components.ScreenHeader
import com.thesis.mobile.ui.components.SkeletonRow
import com.thesis.mobile.ui.components.TextAction
import com.thesis.mobile.ui.components.ThesisChip
import com.thesis.mobile.ui.components.ThesisIconButton
import com.thesis.mobile.ui.components.ThesisRefreshBox
import com.thesis.mobile.ui.components.ThesisTextField
import com.thesis.mobile.ui.components.rememberTopBarCollapsed
import com.thesis.mobile.ui.components.rowGroupSegment
import com.thesis.mobile.ui.copy.KitCopy
import com.thesis.mobile.ui.copy.ResearchCopy
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.format.LocalFmt
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.platform.ThesisBackHandler
import com.thesis.mobile.ui.theme.ThesisSpace
import java.time.Clock
import java.time.LocalDate
import java.time.ZoneId

/** History's filter chips (5.18 item 2). */
enum class HistoryFilter { All, DeepDives, Pulse, WithNotes }

/** One day of History: its header label and its items, newest first. */
@Immutable
internal data class HistoryDay(val date: LocalDate?, val items: List<ReportHistoryItem>)

/** Skeleton rows while History loads for the first time. */
private const val SKELETON_ROWS = 6

/** Reports picked in compare mode. */
private const val COMPARE_PICKS = 2

/**
 * History (DESIGN-DIRECTION 5.18): every report and Pulse you have opened (your job history), grouped by day under
 * sticky day headers, with filters (All, Deep Dives, Pulse, With notes) and a local ticker filter. Deep Dive rows
 * open the report (they capture their bounds for the container transform), Pulse rows open that day's Pulse.
 *
 * Compare mode (the top bar's `compare_arrows`): pick two Deep Dives of one company from like-for-like filings
 * (10-K with 10-K, or the same fiscal quarter); every other row is disabled and says why; the RunBar opens Compare
 * reports with the older report first.
 *
 * The screen draws its own top bar (on the page bitmap at 92%, so no seam through the glow; PR-2 review item), so
 * the shell gives it none (`ShellTopBar.None`, as today). New parameters have defaults; WP-INT wires them
 * (HANDOFF-E): [loaded] (`reportHistoryLoaded`), [refreshing] (`isHistoryLoading`), [error], [onRefresh],
 * [companyNames] and [filingPeriods] (cached report summaries), [notedReportIds] (notes cache),
 * [onCompareReports] (push `CompareReports(older, newer)`), [onReportBounds] (container transform).
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun HistoryScreen(
    historyItems: List<ReportHistoryItem>,
    onBack: () -> Unit,
    onOpenReport: (ReportHistoryItem) -> Unit,
    padding: PaddingValues = PaddingValues(),
    loaded: Boolean = true,
    refreshing: Boolean = false,
    error: String? = null,
    onRefresh: () -> Unit = {},
    companyNames: Map<String, String> = emptyMap(),
    filingPeriods: Map<String, String> = emptyMap(),
    notedReportIds: Set<String> = emptySet(),
    onCompareReports: ((olderReportId: String, newerReportId: String) -> Unit)? = null,
    onReportBounds: ((ReportHistoryItem, Rect) -> Unit)? = null,
    initialFilter: HistoryFilter = HistoryFilter.All,
    initialQuery: String = "",
    initialCompareMode: Boolean = false,
    initialPicked: List<String> = emptyList(),
    clock: Clock = Clock.systemDefaultZone(),
) {
    val fmt = LocalFmt.current
    val listState = rememberLazyListState()
    val collapsed by rememberTopBarCollapsed(listState)
    var filter by rememberSaveable { mutableStateOf(initialFilter) }
    var query by rememberSaveable { mutableStateOf(initialQuery) }
    var compareMode by rememberSaveable { mutableStateOf(initialCompareMode) }
    val picked = remember { mutableStateListOf<String>().apply { addAll(initialPicked) } }

    val visible = remember(historyItems, filter, query, notedReportIds, companyNames) {
        filterHistory(historyItems, filter, query, notedReportIds, companyNames)
    }
    val days = remember(visible, clock) { historyDays(visible, clock.zone) }
    val today = remember(clock) { LocalDate.now(clock) }
    val byId = remember(historyItems) { historyItems.associateBy { it.reportId } }
    val picks = picked.mapNotNull { byId[it] }
    val canCompare = onCompareReports != null
    val leaveCompare = {
        compareMode = false
        picked.clear()
    }
    // System back leaves compare mode first (R1), like the bar's back arrow and Cancel.
    ThesisBackHandler(enabled = compareMode, onBack = leaveCompare)

    ResearchBarPage(
        title = ResearchCopy.HISTORY_TITLE,
        onBack = { if (compareMode) leaveCompare() else onBack() },
        padding = padding,
        collapsed = collapsed,
        actions = {
            if (compareMode) {
                TextAction(ResearchCopy.COMPARE_CANCEL, onClick = leaveCompare, modifier = Modifier.padding(end = ThesisSpace.s))
            } else if (canCompare) {
                ThesisIconButton(ThesisIcons.Compare, contentDescription = ResearchCopy.COMPARE_ACTION, onClick = { compareMode = true })
            }
        },
        bottomBar = if (compareMode) {
            {
                val pair = orderedPair(picks, filingPeriods)
                RunBar(
                    label = if (pair != null) {
                        ResearchCopy.compareRun(
                            pair.first.ticker.orEmpty().uppercase(),
                            periodDisplay(filingPeriods[pair.first.reportId]).orEmpty(),
                            periodDisplay(filingPeriods[pair.second.reportId]).orEmpty(),
                        )
                    } else {
                        ResearchCopy.COMPARE_PICK_TWO
                    },
                    caption = ResearchCopy.COMPARE_PICK_ONE_MORE.takeIf { picks.size == 1 },
                    enabled = pair != null,
                    commit = false,
                    onClick = {
                        if (pair != null) {
                            onCompareReports?.invoke(pair.first.reportId, pair.second.reportId)
                            compareMode = false
                            picked.clear()
                        }
                    },
                )
            }
        } else {
            null
        },
    ) { inner ->
        ThesisRefreshBox(
            refreshing = refreshing,
            onRefresh = onRefresh,
            enabled = loaded && !compareMode,
            modifier = Modifier.padding(top = inner.calculateTopPadding()),
        ) {
            // Padded below the bar instead of scrolling under it, so the sticky day headers stick under the bar.
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize().researchWidth(data = true),
                contentPadding = PaddingValues(
                    top = ThesisSpace.headerTop,
                    bottom = inner.calculateBottomPadding(),
                ),
            ) {
                item(key = "header", contentType = "header") {
                    ScreenHeader(
                        title = ResearchCopy.HISTORY_TITLE,
                        deck = ResearchCopy.HISTORY_DECK,
                        meta = if (loaded && historyItems.isNotEmpty()) {
                            ResearchCopy.historyMeta(
                                historyItems.size,
                                historyItems.maxByOrNull { it.createdAt }?.let { parseInstant(it.createdAt) }?.let(fmt::relative),
                            )
                        } else {
                            null
                        },
                        refreshing = refreshing && loaded,
                        modifier = Modifier.padding(horizontal = ThesisSpace.gutter),
                    )
                }
                item(key = "controls", contentType = "controls") {
                    Spacer(Modifier.height(ThesisSpace.headerToSection))
                    if (compareMode) {
                        InlineBanner(
                            text = ResearchCopy.COMPARE_BANNER,
                            modifier = Modifier.padding(horizontal = ThesisSpace.gutter),
                        )
                    } else if (loaded && historyItems.isNotEmpty()) {
                        HistoryFilters(
                            items = historyItems,
                            noted = notedReportIds,
                            selected = filter,
                            onSelect = { filter = it },
                        )
                        Spacer(Modifier.height(ThesisSpace.s))
                        ThesisTextField(
                            value = query,
                            onValueChange = { query = it.uppercase() },
                            label = ResearchCopy.FILTER_FIELD,
                            keyboardOptions = KeyboardOptions(
                                capitalization = KeyboardCapitalization.Characters,
                                autoCorrect = false,
                                imeAction = ImeAction.Search,
                            ),
                            modifier = Modifier.padding(horizontal = ThesisSpace.gutter),
                        )
                    }
                    if (error != null && historyItems.isNotEmpty()) {
                        Spacer(Modifier.height(ThesisSpace.m))
                        InlineBanner(
                            text = ResearchCopy.HISTORY_REFRESH_FAILED,
                            tone = BannerTone.Error,
                            actionLabel = KitCopy.TRY_AGAIN,
                            onAction = onRefresh,
                            modifier = Modifier.padding(horizontal = ThesisSpace.gutter),
                        )
                    }
                    Spacer(Modifier.height(ThesisSpace.sectionGapData))
                }
                when {
                    !loaded -> items(SKELETON_ROWS, contentType = { "skeleton" }) { i ->
                        SkeletonRow(
                            Modifier
                                .padding(horizontal = ThesisSpace.gutter)
                                .rowGroupSegment(RowPosition.of(i, SKELETON_ROWS), LeadingRowDividerInset),
                        )
                    }
                    historyItems.isEmpty() && error != null -> item(key = "error") {
                        ErrorState(
                            title = KitCopy.couldNotLoad(ResearchCopy.HISTORY_TITLE),
                            cause = error,
                            onRetry = onRefresh,
                            modifier = Modifier.padding(horizontal = ThesisSpace.gutter),
                        )
                    }
                    historyItems.isEmpty() -> item(key = "empty") {
                        EmptyState(
                            sentence = ResearchCopy.HISTORY_EMPTY,
                            how = ResearchCopy.HISTORY_EMPTY_HOW,
                            icon = ThesisIcons.History,
                            modifier = Modifier.padding(horizontal = ThesisSpace.gutter),
                        )
                    }
                    days.isEmpty() -> item(key = "no-match") {
                        EmptyState(
                            sentence = if (query.isNotBlank()) ResearchCopy.historyNoMatch(query.trim()) else ResearchCopy.HISTORY_NO_NOTES,
                            modifier = Modifier.padding(horizontal = ThesisSpace.gutter),
                        )
                    }
                    else -> days.forEach { day ->
                        val label = dayLabel(day.date, today, fmt)
                        stickyHeader(key = "day-${day.date}", contentType = "day") { DayHeader(label) }
                        item(key = "gap-${day.date}", contentType = "gap") { Spacer(Modifier.height(ThesisSpace.s)) }
                        day.items.forEachIndexed { i, item ->
                            item(key = "row-${day.date}-$i-${item.reportId}", contentType = "row") {
                                val instant = parseInstant(item.createdAt)
                                HistoryItemRow(
                                    item = item,
                                    company = item.ticker?.let { companyNames[it.uppercase()] },
                                    period = filingPeriods[item.reportId],
                                    hasNote = item.reportId in notedReportIds,
                                    trailing = instant?.let(fmt::time),
                                    onOpen = { onOpenReport(item) },
                                    onBounds = onReportBounds?.let { cb -> { r: Rect -> cb(item, r) } },
                                    selection = if (compareMode) {
                                        RowSelection(
                                            checked = item.reportId in picked,
                                            disabledReason = historyPickBlock(item, picks, filingPeriods),
                                            onToggle = { on ->
                                                if (on && picked.size < COMPARE_PICKS) picked += item.reportId
                                                if (!on) picked -= item.reportId
                                            },
                                        )
                                    } else {
                                        null
                                    },
                                    modifier = Modifier
                                        .padding(horizontal = ThesisSpace.gutter)
                                        .rowGroupSegment(RowPosition.of(i, day.items.size), LeadingRowDividerInset),
                                )
                            }
                        }
                        item(key = "end-${day.date}", contentType = "gap") { Spacer(Modifier.height(ThesisSpace.xxl)) }
                    }
                }
            }
        }
    }
}

/** The four filter chips with their counts, scrolling at 360 dp (ChipRow). */
@Composable
private fun HistoryFilters(
    items: List<ReportHistoryItem>,
    noted: Set<String>,
    selected: HistoryFilter,
    onSelect: (HistoryFilter) -> Unit,
) {
    val counts = remember(items, noted) { HistoryFilter.entries.associateWith { f -> filterHistory(items, f, "", noted, emptyMap()).size } }
    ChipRow {
        HistoryFilter.entries.forEach { f ->
            item(key = f.name) {
                ThesisChip(
                    label = filterLabel(f),
                    selected = f == selected,
                    count = counts[f],
                    onClick = { onSelect(f) },
                )
            }
        }
    }
}

private fun filterLabel(f: HistoryFilter): String = when (f) {
    HistoryFilter.All -> ResearchCopy.FILTER_ALL
    HistoryFilter.DeepDives -> ResearchCopy.FILTER_DEEP_DIVES
    HistoryFilter.Pulse -> ResearchCopy.FILTER_PULSE
    HistoryFilter.WithNotes -> ResearchCopy.FILTER_NOTES
}

/** "Today", "Yesterday", "Mon 17 Nov", "24 Nov 2024" (the DayHeader caps it). */
internal fun dayLabel(date: LocalDate?, today: LocalDate, fmt: Fmt): String = when (date) {
    null -> ResearchCopy.HISTORY_TITLE
    today -> ResearchCopy.TODAY
    today.minusDays(1) -> ResearchCopy.YESTERDAY
    else -> fmt.marketDate(date)
}

/**
 * The items [filter] and [query] keep, newest first. [query] matches the ticker or the company name (case
 * insensitive); Pulse rows match the word "Pulse".
 */
internal fun filterHistory(
    items: List<ReportHistoryItem>,
    filter: HistoryFilter,
    query: String,
    noted: Set<String>,
    companyNames: Map<String, String>,
): List<ReportHistoryItem> {
    val q = query.trim()
    return items
        .filter { item ->
            when (filter) {
                HistoryFilter.All -> true
                HistoryFilter.DeepDives -> item.type == TYPE_DEEP_DIVE
                HistoryFilter.Pulse -> item.type != TYPE_DEEP_DIVE
                HistoryFilter.WithNotes -> item.reportId in noted
            }
        }
        .filter { item ->
            q.isEmpty() ||
                item.ticker?.contains(q, ignoreCase = true) == true ||
                item.ticker?.let { companyNames[it.uppercase()] }?.contains(q, ignoreCase = true) == true ||
                (item.type != TYPE_DEEP_DIVE && ResearchCopy.PULSE.contains(q, ignoreCase = true))
        }
        .sortedByDescending { it.createdAt }
}

/** Groups [items] (newest first) by their day in [zone]; unreadable dates go last under one group. */
internal fun historyDays(items: List<ReportHistoryItem>, zone: ZoneId): List<HistoryDay> =
    items
        .groupBy { item -> parseInstant(item.createdAt)?.atZone(zone)?.toLocalDate() }
        .map { (date, list) -> HistoryDay(date, list.sortedByDescending { it.createdAt }) }
        .sortedWith(compareByDescending<HistoryDay> { it.date != null }.thenByDescending { it.date })

/**
 * Why [item] cannot be picked next in compare mode, or null when it can (5.18 item 4): only Deep Dives, at most
 * two, one company, like-for-like filings (10-K with 10-K, or the same fiscal quarter), never the same period
 * twice. A picked row can always be unpicked.
 *
 * [periods] is report id to the report's period. Until WP-INT passes the period of the filing each report read
 * (HANDOFF-E), it is the latest annual row a report holds, so a report on a 10-Q reads as annual here; Compare
 * reports reads each report's own filing and refuses a pair that is not like for like, saying why. The captions
 * therefore speak of the period, never of "the same filing".
 */
internal fun historyPickBlock(
    item: ReportHistoryItem,
    picked: List<ReportHistoryItem>,
    periods: Map<String, String>,
): String? {
    if (item.type != TYPE_DEEP_DIVE) return ResearchCopy.WHY_PULSE
    if (picked.any { it.reportId == item.reportId }) return null
    if (picked.size >= COMPARE_PICKS) return ResearchCopy.WHY_TWO_PICKED
    val key = filingKeyOf(periods[item.reportId]) ?: return ResearchCopy.WHY_UNKNOWN_FILING
    val first = picked.firstOrNull() ?: return null
    if (!first.ticker.equals(item.ticker, ignoreCase = true)) return ResearchCopy.WHY_OTHER_COMPANY
    val firstKey = filingKeyOf(periods[first.reportId]) ?: return ResearchCopy.WHY_UNKNOWN_FILING
    return when {
        !likeForLike(firstKey, key) -> ResearchCopy.WHY_NOT_LIKE
        firstKey == key -> ResearchCopy.whySamePeriod(key.annual)
        else -> null
    }
}

/** The two picks as (older, newer) by fiscal period, or null until two comparable reports are picked. */
internal fun orderedPair(
    picks: List<ReportHistoryItem>,
    periods: Map<String, String>,
): Pair<ReportHistoryItem, ReportHistoryItem>? {
    if (picks.size != COMPARE_PICKS) return null
    val (a, b) = picks
    val ka = filingKeyOf(periods[a.reportId]) ?: return null
    val kb = filingKeyOf(periods[b.reportId]) ?: return null
    if (!a.ticker.equals(b.ticker, ignoreCase = true) || !likeForLike(ka, kb) || ka == kb) return null
    return if (ka.fiscalYear <= kb.fiscalYear) a to b else b to a
}
