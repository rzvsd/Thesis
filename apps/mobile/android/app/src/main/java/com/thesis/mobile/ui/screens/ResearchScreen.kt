package com.thesis.mobile.ui.screens

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import com.thesis.mobile.model.LastViewedReport
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.model.TickerSearchItem
import com.thesis.mobile.ui.components.ActionRow
import com.thesis.mobile.ui.components.EmptyState
import com.thesis.mobile.ui.components.Kicker
import com.thesis.mobile.ui.components.NoteMark
import com.thesis.mobile.ui.components.RowPosition
import com.thesis.mobile.ui.components.ScreenHeader
import com.thesis.mobile.ui.components.SectionHeader
import com.thesis.mobile.ui.components.ThesisCheckbox
import com.thesis.mobile.ui.components.ThesisIconButton
import com.thesis.mobile.ui.components.ThesisTopBar
import com.thesis.mobile.ui.components.TickerField
import com.thesis.mobile.ui.components.TickerSuggestion
import com.thesis.mobile.ui.components.LeadingRowDividerInset
import com.thesis.mobile.ui.components.RowGroup
import com.thesis.mobile.ui.components.rowGroupSegment
import com.thesis.mobile.ui.copy.ResearchCopy
import com.thesis.mobile.ui.format.LocalFmt
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.motion.DismissibleItem
import com.thesis.mobile.ui.motion.rememberHaptics
import com.thesis.mobile.ui.motion.thesisPress
import com.thesis.mobile.ui.shell.exceptTop
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.tnum
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.temporal.ChronoUnit

/** How many recent reports the root lists; History ("See all") has the rest. */
internal const val RECENT_REPORTS_SHOWN = 3

/** Most suggestions under the ticker field (#44). */
private const val SUGGESTIONS_SHOWN = 6

/** History item types (`ReportHistoryItem.type`). */
internal const val TYPE_DEEP_DIVE = "deep_dive"

/** `LastViewedReport.type` of a Deep Dive. */
private const val LAST_VIEWED_DEEP_DIVE = "DEEP_DIVE"

/** `LastViewedReport.type` of a Pulse issue. */
private const val LAST_VIEWED_PULSE = "PULSE"

/**
 * The Continue reading item: the last Deep Dive, or a past Pulse issue left mid-way (one before [today]: today's
 * issue is Home's to show) when [canResumePulse]. Null otherwise.
 */
internal fun continueItemOf(last: LastViewedReport?, today: LocalDate, canResumePulse: Boolean): LastViewedReport? = when {
    last == null -> null
    last.type.equals(LAST_VIEWED_DEEP_DIVE, ignoreCase = true) -> last
    last.type.equals(LAST_VIEWED_PULSE, ignoreCase = true) && canResumePulse ->
        last.takeIf { pulseDateOf(it)?.isBefore(today) == true }
    else -> null
}

private fun pulseDateOf(item: LastViewedReport): LocalDate? =
    item.referenceDate?.trim()?.take(10)?.let { runCatching { LocalDate.parse(it) }.getOrNull() }

/**
 * The Research tab root (DESIGN-DIRECTION 5.12): one ticker field whose action says what it will do (open the
 * report you already have, or build one), the recent reports you have opened, and the research tools.
 *
 * Under the shell's root bar (brand, search, avatar): [padding] is the shell's, top included. Running a Deep Dive
 * pushes `DeepDiveRunning(ticker)` and an opened report is a `Report(id)` entry, each showing its own progress and
 * errors, so this root has no loading or error state of its own.
 *
 * New parameters have defaults so the shell keeps compiling; WP-INT wires them (HANDOFF-E): [suggestions]
 * (`state.tickers`), [watchlist], [companyNames] and [filingPeriods] (from cached report summaries),
 * [notedReportIds] (the notes cache), [continueReading] (`state.lastViewedReport`) with [onDismissContinue], the
 * tool callbacks (a tool row shows only once its callback is set) and [onReportBounds] (container transform).
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
    /** Opens History, the full report list (5.12 "See all"), and the History tool row; null hides both. */
    onSeeAllHistory: (() -> Unit)? = null,
    suggestions: List<TickerSearchItem> = emptyList(),
    watchlist: List<String> = emptyList(),
    /** Upper-case ticker to company name. */
    companyNames: Map<String, String> = emptyMap(),
    /** Report id to its filing period ("FY2025"). */
    filingPeriods: Map<String, String> = emptyMap(),
    notedReportIds: Set<String> = emptySet(),
    continueReading: LastViewedReport? = null,
    onDismissContinue: () -> Unit = {},
    /** Resumes a past Pulse issue from Continue reading; null leaves Pulse items out (Deep Dives open by id). */
    onResumeContinue: ((LastViewedReport) -> Unit)? = null,
    onOpenCompareNames: (() -> Unit)? = null,
    onOpenScenarioStress: (() -> Unit)? = null,
    onOpenMacroStress: (() -> Unit)? = null,
    onOpenWeeklyDigest: (() -> Unit)? = null,
    /** The tapped report row's window bounds, just before [onOpenReport] (4.5 container transform). */
    onReportBounds: ((reportId: String, bounds: Rect) -> Unit)? = null,
    clock: Clock = Clock.systemDefaultZone(),
) {
    val p = LocalThesisPalette.current
    val fmt = LocalFmt.current
    val symbol = ticker.trim().uppercase()
    val stored = remember(symbol, recentHistory) { storedReportFor(symbol, recentHistory) }
    val continueItem = remember(continueReading, clock) {
        continueItemOf(continueReading, LocalDate.now(clock), canResumePulse = onResumeContinue != null)
    }
    val continuePulse = continueItem?.type?.equals(LAST_VIEWED_PULSE, ignoreCase = true) == true
    val recent = remember(recentHistory, continueItem?.reportId) { recentRows(recentHistory, continueItem?.reportId) }
    val picks = remember(symbol, suggestions, watchlist, companyNames) {
        tickerSuggestions(symbol, suggestions, watchlist, companyNames)
    }
    val haptics = rememberHaptics()
    val action = if (stored != null) ResearchCopy.OPEN_REPORT else ResearchCopy.BUILD_REPORT
    val go = {
        if (symbol.isNotEmpty()) {
            if (stored != null) {
                onOpenReport(stored.reportId)
            } else {
                // Building is the commit (4.7: press() on a commit CTA); opening a stored report is a plain tap.
                haptics.press()
                onRunReport()
            }
        }
    }
    var dismissing by remember(continueItem?.reportId) { mutableStateOf(false) }

    Box(Modifier.fillMaxSize().padding(padding.exceptTop()), contentAlignment = Alignment.TopCenter) {
        Column(
            Modifier
                .widthIn(max = ThesisSpace.contentMaxWidth)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(top = padding.calculateTopPadding() + ThesisSpace.headerTop, bottom = ThesisSpace.x5),
        ) {
            ScreenHeader(
                title = ResearchCopy.RESEARCH_TITLE,
                deck = ResearchCopy.RESEARCH_DECK,
                modifier = Modifier.padding(horizontal = ThesisSpace.gutter),
            )
            Spacer(Modifier.height(ThesisSpace.headerToSection))
            TickerField(
                value = ticker,
                onValueChange = onTickerChange,
                onSearch = go,
                label = ResearchCopy.TICKER_LABEL,
                suggestions = picks,
                onPickSuggestion = { onTickerChange(it.ticker) },
                actionLabel = action,
                modifier = Modifier.padding(horizontal = ThesisSpace.gutter),
            )
            Text(
                when {
                    symbol.isEmpty() -> ResearchCopy.FIELD_HELPER_EMPTY
                    else -> ResearchCopy.fieldHelper(
                        symbol,
                        opens = stored != null,
                        openedAgo = stored?.let { parseInstant(it.createdAt) }?.let(fmt::relative),
                    )
                },
                style = ThesisType.caption,
                color = p.ink2,
                modifier = Modifier.padding(horizontal = ThesisSpace.gutter + ThesisSpace.l, vertical = ThesisSpace.xs),
            )

            Spacer(Modifier.height(ThesisSpace.sectionGapData))
            // The last report: a Pulse brief is not a report, so the headline names the last Deep Dive.
            val last = recentHistory.filter { it.type == TYPE_DEEP_DIVE }.maxByOrNull { it.createdAt }
            val recentHeadline = ResearchCopy.recentHeadline(
                openedThisWeek = openedSince(recentHistory, clock.instant().minus(7, ChronoUnit.DAYS)),
                lastTicker = last?.ticker?.uppercase(),
                lastAgo = last?.let { parseInstant(it.createdAt) }?.let(fmt::relative),
            )
            if (recentHeadline != null) {
                SectionHeader(
                    kicker = ResearchCopy.RECENT_KICKER,
                    headline = recentHeadline,
                    deck = if (recent.isEmpty()) null else ResearchCopy.RECENT_DECK,
                    actionLabel = ResearchCopy.SEE_ALL.takeIf { recentHistory.size > RECENT_REPORTS_SHOWN },
                    onAction = onSeeAllHistory,
                    modifier = Modifier.padding(horizontal = ThesisSpace.gutter),
                )
            } else {
                // Nothing to report yet: the kicker over the empty state, not a headline that repeats it.
                Kicker(ResearchCopy.RECENT_KICKER, Modifier.padding(horizontal = ThesisSpace.gutter).semantics { heading() })
            }
            Spacer(Modifier.height(ThesisSpace.m))
            if (recent.isEmpty() && continueItem == null) {
                EmptyState(
                    sentence = ResearchCopy.RECENT_EMPTY,
                    how = ResearchCopy.RECENT_EMPTY_HOW,
                    modifier = Modifier.padding(horizontal = ThesisSpace.gutter),
                )
            } else {
                val count = recent.size + if (continueItem != null) 1 else 0
                Column(Modifier.padding(horizontal = ThesisSpace.gutter)) {
                    if (continueItem != null) {
                        DismissibleItem(
                            removing = dismissing,
                            onRemoved = onDismissContinue,
                            modifier = Modifier.rowGroupSegment(RowPosition.of(0, count), LeadingRowDividerInset),
                        ) {
                            ResearchRow(
                                icon = if (continuePulse) ThesisIcons.Pulse else ThesisIcons.DeepDive,
                                title = if (continuePulse) {
                                    ResearchCopy.continuePulse(pulseDateOf(continueItem)?.let(fmt::shortDate).orEmpty())
                                } else {
                                    ResearchCopy.continueReading(continueItem.label.uppercase())
                                },
                                line2 = ResearchCopy.continueCaption(fmt.relative(Instant.ofEpochMilli(continueItem.timestampMs))),
                                onClick = {
                                    if (continuePulse) onResumeContinue?.invoke(continueItem) else onOpenReport(continueItem.reportId)
                                },
                                trailingContent = {
                                    ThesisIconButton(
                                        ThesisIcons.Small.Close,
                                        contentDescription = ResearchCopy.DISMISS,
                                        onClick = { dismissing = true },
                                    )
                                },
                            )
                        }
                    }
                    val offset = if (continueItem != null) 1 else 0
                    recent.forEachIndexed { i, item ->
                        HistoryItemRow(
                            item = item,
                            company = item.ticker?.let { companyNames[it.uppercase()] },
                            period = filingPeriods[item.reportId],
                            hasNote = item.reportId in notedReportIds,
                            trailing = parseInstant(item.createdAt)?.let(fmt::relative)?.let(ResearchCopy::keepTogether),
                            onOpen = {
                                if (item.type == TYPE_DEEP_DIVE) onOpenReport(item.reportId) else onOpenPulse(item.createdAt.take(10))
                            },
                            onBounds = onReportBounds?.let { cb -> { r: Rect -> cb(item.reportId, r) } },
                            modifier = Modifier.rowGroupSegment(RowPosition.of(i + offset, count), LeadingRowDividerInset),
                        )
                    }
                }
            }

            val tools = researchTools(
                onOpenCompareNames, onOpenScenarioStress, onOpenMacroStress, onOpenWeeklyDigest, onSeeAllHistory,
            )
            if (tools.isNotEmpty()) {
                Spacer(Modifier.height(ThesisSpace.sectionGapData))
                SectionHeader(
                    kicker = ResearchCopy.TOOLS_KICKER,
                    headline = ResearchCopy.toolsHeadline(watchlist.size),
                    modifier = Modifier.padding(horizontal = ThesisSpace.gutter),
                )
                Spacer(Modifier.height(ThesisSpace.m))
                RowGroup(Modifier.padding(horizontal = ThesisSpace.gutter)) {
                    tools.forEach { tool ->
                        row(LeadingRowDividerInset) {
                            ActionRow(icon = tool.icon, title = tool.title, caption = tool.caption, onClick = tool.onClick)
                        }
                    }
                }
            }
        }
    }
}

/** One research tool row (5.12 item 5). */
private class ResearchTool(val icon: ImageVector, val title: String, val caption: String, val onClick: () -> Unit)

private fun researchTools(
    compare: (() -> Unit)?,
    stress: (() -> Unit)?,
    macro: (() -> Unit)?,
    digest: (() -> Unit)?,
    history: (() -> Unit)?,
): List<ResearchTool> = listOfNotNull(
    compare?.let { ResearchTool(ThesisIcons.Compare, ResearchCopy.TOOL_COMPARE, ResearchCopy.TOOL_COMPARE_CAPTION, it) },
    stress?.let { ResearchTool(ThesisIcons.ScenarioStress, ResearchCopy.TOOL_STRESS, ResearchCopy.TOOL_STRESS_CAPTION, it) },
    macro?.let { ResearchTool(ThesisIcons.MacroStress, ResearchCopy.TOOL_MACRO, ResearchCopy.TOOL_MACRO_CAPTION, it) },
    digest?.let { ResearchTool(ThesisIcons.Pulse, ResearchCopy.TOOL_DIGEST, ResearchCopy.TOOL_DIGEST_CAPTION, it) },
    history?.let { ResearchTool(ThesisIcons.History, ResearchCopy.TOOL_HISTORY, ResearchCopy.TOOL_HISTORY_CAPTION, it) },
)

/**
 * The Recent reports rows: newest first, up to three, without the report "Continue reading" already offers
 * ([continueId]), so no slot repeats it.
 */
internal fun recentRows(history: List<ReportHistoryItem>, continueId: String?): List<ReportHistoryItem> =
    history.filter { continueId == null || it.reportId != continueId }
        .sortedByDescending { it.createdAt }
        .take(RECENT_REPORTS_SHOWN)

/** The newest Deep Dive of [ticker] in [history]: the field then opens it instead of building (5.12 item 3). */
internal fun storedReportFor(ticker: String, history: List<ReportHistoryItem>): ReportHistoryItem? {
    if (ticker.isBlank()) return null
    return history
        .filter { it.type == TYPE_DEEP_DIVE && it.ticker.equals(ticker, ignoreCase = true) }
        .maxByOrNull { it.createdAt }
}

/**
 * Suggestions under the ticker field (#44): your names first, then the server's matches, up to six, by prefix of
 * ticker or a company name that contains the query. [server] is the last `searchTickers` result, which may be for
 * an earlier query, so it is filtered the same way. None while the field is empty or already holds an exact pick.
 */
internal fun tickerSuggestions(
    query: String,
    server: List<TickerSearchItem>,
    watchlist: List<String>,
    companyNames: Map<String, String>,
): List<TickerSuggestion> {
    val q = query.trim().uppercase()
    if (q.isEmpty()) return emptyList()
    val yours = watchlist.map { it.uppercase() }.toSet()
    val own = watchlist.map { it.uppercase() }.filter { it.startsWith(q) || companyNames[it]?.uppercase()?.contains(q) == true }
        .map { TickerSuggestion(it, companyNames[it], inYourNames = true) }
    val others = server
        .filter { it.symbol.uppercase() !in yours }
        .filter { it.symbol.uppercase().startsWith(q) || it.companyName.uppercase().contains(q) }
        .map { TickerSuggestion(it.symbol.uppercase(), it.companyName, inYourNames = false) }
    val all = (own + others).distinctBy { it.ticker }.take(SUGGESTIONS_SHOWN)
    return if (all.size == 1 && all[0].ticker == q) emptyList() else all
}

/** Deep Dives opened at or after [since] (a Pulse brief is not a report). */
internal fun openedSince(history: List<ReportHistoryItem>, since: Instant): Int =
    history.count { item -> item.type == TYPE_DEEP_DIVE && parseInstant(item.createdAt)?.let { !it.isBefore(since) } == true }

/** An ISO-8601 instant or offset date-time; null when unreadable. */
internal fun parseInstant(raw: String?): Instant? {
    val value = raw?.trim()?.ifBlank { null } ?: return null
    return runCatching { Instant.parse(value) }.getOrNull()
        ?: runCatching { OffsetDateTime.parse(value).toInstant() }.getOrNull()
}

/**
 * A History item as a row (Research root, History, Search): `menu_book` for a Deep Dive, `article` for a Pulse;
 * ticker (or "Pulse") with the company muted and the note mark; the filing line; the time on the right. [period]
 * is the raw period as stored ("2025-FY", "2025-Q3"); it is shown through [periodDisplay] ("FY2025", "Q3 FY25").
 */
@Composable
internal fun HistoryItemRow(
    item: ReportHistoryItem,
    company: String?,
    period: String?,
    hasNote: Boolean,
    trailing: String?,
    onOpen: () -> Unit,
    modifier: Modifier = Modifier,
    onBounds: ((Rect) -> Unit)? = null,
    selection: RowSelection? = null,
    /** Opens the row's context sheet (History: "Open AAPL"); the tap keeps opening the report. */
    onLongClick: (() -> Unit)? = null,
) {
    val deepDive = item.type == TYPE_DEEP_DIVE
    ResearchRow(
        icon = if (deepDive) ThesisIcons.DeepDive else ThesisIcons.Pulse,
        title = if (deepDive) item.ticker?.uppercase() ?: ResearchCopy.DEEP_DIVE else ResearchCopy.PULSE,
        aside = if (deepDive) company else null,
        line2 = if (deepDive) ResearchCopy.deepDiveLine(periodDisplay(period)) else ResearchCopy.PULSE_LINE,
        hasNote = hasNote,
        trailing = trailing,
        onClick = onOpen,
        onBoundsCaptured = onBounds,
        selection = selection,
        onLongClick = onLongClick,
        modifier = modifier,
    )
}

/**
 * Compare mode on a row (History 5.18 item 4): the leading column shows a checkbox; a row that cannot be picked
 * is disabled and says why in its second line.
 */
internal class RowSelection(val checked: Boolean, val disabledReason: String?, val onToggle: (Boolean) -> Unit)

/**
 * The research list row: a 24 dp leading icon (ink2), [title] (`rowTitle`) with [aside] (muted, ellipsized) and a
 * note mark, [line2] (bodySmall ink2), and one trailing atom ([trailing] caption, or [trailingContent]). The whole
 * row is the target, pressed with the kit tint only (inside a RowGroup), no chevron (2.8). With [selection] the row
 * is a checkbox (Role.Checkbox).
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
internal fun ResearchRow(
    icon: ImageVector?,
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    aside: String? = null,
    line2: String? = null,
    line2Content: (@Composable () -> Unit)? = null,
    hasNote: Boolean = false,
    trailing: String? = null,
    trailingContent: (@Composable () -> Unit)? = null,
    onBoundsCaptured: ((Rect) -> Unit)? = null,
    selection: RowSelection? = null,
    /** A long press opens the row's context sheet, with the `longPress()` haptic (as TickerRow does). */
    onLongClick: (() -> Unit)? = null,
) {
    val p = LocalThesisPalette.current
    val haptics = rememberHaptics()
    val source = remember { MutableInteractionSource() }
    var bounds by remember { mutableStateOf(Rect.Zero) }
    val enabled = selection?.disabledReason == null
    val target = if (selection != null) {
        Modifier.toggleable(
            value = selection.checked,
            interactionSource = source,
            indication = null,
            enabled = enabled,
            role = Role.Checkbox,
            onValueChange = selection.onToggle,
        )
    } else if (onLongClick != null) {
        Modifier.combinedClickable(
            interactionSource = source,
            indication = null,
            role = Role.Button,
            onLongClick = {
                haptics.longPress()
                onLongClick()
            },
            onClick = {
                onBoundsCaptured?.invoke(bounds)
                onClick()
            },
        )
    } else {
        Modifier.clickable(source, indication = null, role = Role.Button) {
            onBoundsCaptured?.invoke(bounds)
            onClick()
        }
    }
    val second = selection?.disabledReason ?: line2
    val large = LocalDensity.current.fontScale > ThesisType.MAX_DISPLAY_SCALE
    Row(
        modifier
            .fillMaxWidth()
            .then(if (onBoundsCaptured != null) Modifier.onGloballyPositioned { bounds = it.boundsInWindow() } else Modifier)
            .then(target)
            .semantics(mergeDescendants = true) { }
            .thesisPress(source, enabled = enabled)
            .heightIn(min = if (second != null || line2Content != null) ThesisSpace.rowMinComfortableTwoLine else ThesisSpace.rowMinComfortable)
            .padding(horizontal = ThesisSpace.l, vertical = ThesisSpace.rowPaddingV),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.width(ThesisSpace.leadingColumn), contentAlignment = Alignment.CenterStart) {
            when {
                selection != null -> ThesisCheckbox(checked = selection.checked, onCheckedChange = null, enabled = enabled)
                icon != null -> Icon(icon, contentDescription = null, modifier = Modifier.size(ThesisSpace.iconM), tint = p.ink2)
            }
        }
        Spacer(Modifier.width(ThesisSpace.leadingGap))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
                // A ticker title stays on one line beside its company; a longer title ("Continue reading MSFT") takes
                // the row's width and, at large font sizes, a second line instead of losing its last word.
                Text(
                    title,
                    modifier = if (aside == null) Modifier.weight(1f, fill = false) else Modifier,
                    style = ThesisType.rowTitle,
                    color = if (enabled) p.ink else p.muted,
                    maxLines = if (large) 2 else 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (aside != null) {
                    Text(
                        aside,
                        modifier = Modifier.weight(1f, fill = false),
                        style = ThesisType.bodySmall,
                        color = p.muted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                if (hasNote) NoteMark()
            }
            if (line2Content != null && selection?.disabledReason == null) {
                line2Content()
            } else if (second != null) {
                Text(
                    second,
                    style = ThesisType.bodySmall,
                    color = if (enabled) p.ink2 else p.muted,
                    maxLines = if (large) 3 else 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        if (trailingContent != null) {
            Spacer(Modifier.width(ThesisSpace.s))
            trailingContent()
        } else if (trailing != null) {
            Spacer(Modifier.width(ThesisSpace.m))
            Text(trailing, style = ThesisType.caption.tnum(), color = p.muted, maxLines = 1, softWrap = false)
        }
    }
}

/**
 * A pushed Research screen with its own top bar (History, Compare, War Room, Scenario Stress, Search): the kit
 * `ThesisTopBar` drawn over the content (content scrolls under its 92% page slice once [collapsed]), measured so
 * [content] gets the bar's height as its top padding (screens add `headerTop`), plus an optional sticky [bottomBar] (RunBar). [padding] is
 * the shell's; its top is not used, the bar takes the status bar inset itself.
 */
@Composable
internal fun ResearchBarPage(
    title: String,
    /** Null: no back arrow (a screen still under the shell's own bar until WP-INT wires its back). */
    onBack: (() -> Unit)?,
    padding: PaddingValues,
    collapsed: Boolean,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    titleAlwaysVisible: Boolean = false,
    actions: @Composable RowScope.() -> Unit = {},
    bottomBar: (@Composable () -> Unit)? = null,
    content: @Composable (contentPadding: PaddingValues) -> Unit,
) {
    val density = LocalDensity.current
    var barPx by remember { mutableIntStateOf(0) }
    var bottomPx by remember { mutableIntStateOf(0) }
    val barH: Dp = with(density) { barPx.toDp() }
    val bottomH: Dp = with(density) { bottomPx.toDp() }
    Box(modifier.fillMaxSize().padding(padding.exceptTop())) {
        content(PaddingValues(top = barH, bottom = bottomH + ThesisSpace.x5))
        ThesisTopBar(
            modifier = Modifier.align(Alignment.TopCenter).onSizeChanged { barPx = it.height },
            title = title,
            subtitle = subtitle,
            onBack = onBack,
            collapsed = collapsed,
            titleAlwaysVisible = titleAlwaysVisible,
            actions = actions,
        )
        if (bottomBar != null) {
            Box(Modifier.align(Alignment.BottomCenter).onSizeChanged { bottomPx = it.height }) { bottomBar() }
        }
    }
}

/** Centres a list at the data-screen width (2.5: data screens may widen to 960 dp; reading screens 640 dp). */
internal fun Modifier.researchWidth(data: Boolean = true): Modifier =
    fillMaxWidth()
        .wrapContentWidth(Alignment.CenterHorizontally)
        .widthIn(max = if (data) ThesisSpace.dataMaxWidth else ThesisSpace.contentMaxWidth)
