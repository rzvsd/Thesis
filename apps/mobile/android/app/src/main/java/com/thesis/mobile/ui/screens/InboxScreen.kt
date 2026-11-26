package com.thesis.mobile.ui.screens

import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.background
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.calculateEndPadding
import androidx.compose.foundation.layout.calculateStartPadding
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import com.thesis.mobile.model.AlertLedgerItemView
import com.thesis.mobile.ui.components.BannerTone
import com.thesis.mobile.ui.components.Callout
import com.thesis.mobile.ui.components.ChipRow
import com.thesis.mobile.ui.components.DayHeader
import com.thesis.mobile.ui.components.DialogAction
import com.thesis.mobile.ui.components.EmptyState
import com.thesis.mobile.ui.components.ErrorState
import com.thesis.mobile.ui.components.InlineBanner
import com.thesis.mobile.ui.components.AlertRow
import com.thesis.mobile.ui.components.LeadingRowDividerInset
import com.thesis.mobile.ui.components.RowPosition
import com.thesis.mobile.ui.components.ScreenHeader
import com.thesis.mobile.ui.components.SheetActionRow
import com.thesis.mobile.ui.components.SkeletonRow
import com.thesis.mobile.ui.components.SwipeToQuiet
import com.thesis.mobile.ui.components.TextAction
import com.thesis.mobile.ui.components.TextActionImpl
import com.thesis.mobile.ui.components.ThesisChip
import com.thesis.mobile.ui.components.ThesisDialog
import com.thesis.mobile.ui.components.ThesisIconButton
import com.thesis.mobile.ui.components.ThesisRefreshBox
import com.thesis.mobile.ui.components.ThesisSheet
import com.thesis.mobile.ui.components.ThesisSnackbarHost
import com.thesis.mobile.ui.components.rowGroupSegment
import com.thesis.mobile.ui.components.showThesisSnackbar
import com.thesis.mobile.ui.copy.InboxCopy
import com.thesis.mobile.ui.copy.KitCopy
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.format.LocalFmt
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.motion.DismissibleItem
import com.thesis.mobile.ui.motion.ShimmerHost
import com.thesis.mobile.ui.motion.ThesisMotion
import com.thesis.mobile.ui.motion.rememberHaptics
import com.thesis.mobile.ui.motion.rememberShowSkeleton
import com.thesis.mobile.ui.motion.thesisItemMotion
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisShape
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.alertCategoryColor
import kotlinx.coroutines.launch
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId

/*
 * Inbox (docs/app-redesign/DESIGN-DIRECTION.md 5.21), a bottom tab under the shell's root bar.
 *
 * 1. ScreenHeader "Inbox" with the lede "3 new since your last visit" and "Mark all as seen".
 * 2. ChipRow category filters with counts, keyed by the category key ("thesis_drift"), never the English label;
 *    a filter change fades the list in (150 ms).
 * 3. Day-grouped list: sticky DayHeaders (Today, Yesterday, then dates), AlertRows on rowGroupSegment cards.
 *    Swipe toward the start quiets the alert for 24 hours: the row collapses (DismissibleItem) and a snackbar
 *    offers Undo. The server call is made only when the snackbar goes without Undo, so Undo needs no unmute.
 * 4. A tap expands the row in place: the change (or the Pro lock), the reason, Open (route), Useful / Not useful
 *    (single-select, kept), and More actions: Quiet for 24 hours, Turn off this type (dialog, then Undo).
 * 5. Routing: thesis drift opens the Name at "Since the last report", earnings with a War Room open the War Room.
 *
 * States: skeleton rows on first load, pull to refresh bound to isInboxRefreshing, action errors never wipe the
 * list (the ViewModel's snackbar reports them), a refresh failure with alerts loaded is a banner over the list.
 */

/** Category keys in their filter order; any other key follows, alphabetically. */
private val CategoryOrder = listOf("thesis_drift", "earnings", "macro", "pulse", "system")

/** How long a quiet lasts (the server's mute window). */
private val QuietWindow: Duration = Duration.ofHours(24)

/** Where an alert's Open goes. */
internal sealed interface InboxRoute {
    /** Thesis drift: the Name page at its "Since the last report" block. */
    data class NameChanges(val ticker: String) : InboxRoute

    /** An earnings alert with a War Room. */
    data class WarRoom(val id: String) : InboxRoute

    /** Everything else: the alert's own route (DeepLinkRouter). */
    data object Alert : InboxRoute
}

/** One day of the list: its header and its alerts, newest first. */
@Immutable
internal data class InboxDay(val date: LocalDate?, val label: String, val alerts: List<AlertLedgerItemView>)

/** One filter chip: the category key (null for All), its label and how many alerts it holds. */
@Immutable
internal data class InboxFilter(val key: String?, val label: String, val count: Int)

/** The screen's pure logic (see InboxModelTest). */
internal object InboxModels {

    /** The alert's category key: "thesis_drift", "earnings", "macro", "pulse", "system" or the server's own key. */
    fun categoryKey(alert: AlertLedgerItemView): String {
        val key = alert.category.trim().lowercase().replace(' ', '_').replace('-', '_')
        return when (key) {
            "", "other" -> "system"
            "drift", "thesisdrift" -> "thesis_drift"
            else -> key
        }
    }

    /**
     * All, then each category present, in [CategoryOrder], with its count. [keep] (the selected category) stays
     * as a chip, at 0, while its only alert waits on its Undo, so the selection does not jump to All and back.
     */
    fun filters(alerts: List<AlertLedgerItemView>, keep: String? = null): List<InboxFilter> {
        val counts = alerts.groupingBy(::categoryKey).eachCount()
        val keys = (counts.keys + listOfNotNull(keep)).sortedWith(compareBy({ CategoryOrder.indexOf(it).let { i -> if (i < 0) Int.MAX_VALUE else i } }, { it }))
        return listOf(InboxFilter(null, InboxCopy.ALL, alerts.size)) +
            keys.map { InboxFilter(it, InboxCopy.category(it), counts[it] ?: 0) }
    }

    /** The alerts in category [key] (all of them for null). */
    fun filter(alerts: List<AlertLedgerItemView>, key: String?): List<AlertLedgerItemView> =
        if (key == null) alerts else alerts.filter { categoryKey(it) == key }

    /** The server's ISO time ("2025-11-24T07:02:00Z", or with an offset) as an instant; null when unreadable. */
    fun instant(raw: String?): Instant? {
        val s = raw?.trim()?.ifEmpty { null } ?: return null
        return runCatching { Instant.parse(s) }.getOrNull()
            ?: runCatching { OffsetDateTime.parse(s).toInstant() }.getOrNull()
    }

    /** Whether the alert is quiet now: muted less than 24 hours ago (an unreadable mute time counts as quiet). */
    fun isQuiet(alert: AlertLedgerItemView, now: Instant): Boolean {
        val raw = alert.mutedAt?.takeIf { it.isNotBlank() } ?: return false
        val at = instant(raw) ?: return true
        return now.isBefore(at.plus(QuietWindow))
    }

    /** The last visit, or null when none is recorded (UiState keeps 0 for "never"). */
    fun visit(lastVisitAtMs: Long?): Long? = lastVisitAtMs?.takeIf { it > 0L }

    /** Whether the alert arrived after the last visit to the Inbox (no visit recorded: nothing is new). */
    fun isNew(alert: AlertLedgerItemView, lastVisitAtMs: Long?): Boolean {
        val visit = visit(lastVisitAtMs) ?: return false
        val at = instant(alert.createdAt) ?: return false
        return at.toEpochMilli() > visit
    }

    fun newCount(alerts: List<AlertLedgerItemView>, lastVisitAtMs: Long?): Int = alerts.count { isNew(it, lastVisitAtMs) }

    /** The header lede: new since the last visit, or the total when no visit is recorded (null or 0). */
    fun lede(alerts: List<AlertLedgerItemView>, lastVisitAtMs: Long?): String? = when {
        alerts.isEmpty() -> null
        visit(lastVisitAtMs) == null -> InboxCopy.total(alerts.size)
        else -> InboxCopy.newSinceLastVisit(newCount(alerts, lastVisitAtMs))
    }

    /** Newest first, grouped by day in [zone]: "Today", "Yesterday", then "Mon 24 Nov". Undated alerts last. */
    fun groupByDay(alerts: List<AlertLedgerItemView>, zone: ZoneId, today: LocalDate, fmt: Fmt): List<InboxDay> {
        val sorted = alerts.sortedWith(compareByDescending<AlertLedgerItemView> { instant(it.createdAt) ?: Instant.MIN })
        return sorted.groupBy { instant(it.createdAt)?.atZone(zone)?.toLocalDate() }
            .map { (date, items) -> InboxDay(date, dayLabel(date, today, fmt), items) }
    }

    fun dayLabel(date: LocalDate?, today: LocalDate, fmt: Fmt): String = when (date) {
        null -> InboxCopy.UNDATED
        today -> InboxCopy.TODAY
        today.minusDays(1) -> InboxCopy.YESTERDAY
        else -> fmt.marketDate(date)
    }

    /**
     * Where Open goes: thesis drift with a ticker to the Name at its changes; earnings with a War Room to the War
     * Room; otherwise the alert's own route when it has somewhere to go ([canOpen]); else nowhere (no Open).
     * [canOpenName] / [canOpenWarRoom] say whether the screen can open those directly; without that, the special
     * routes are offered only when the alert's own route ([canOpen], the fallback) goes somewhere, so Open never
     * lands back on the Inbox.
     */
    fun route(
        alert: AlertLedgerItemView,
        canOpen: Boolean,
        canOpenName: Boolean = true,
        canOpenWarRoom: Boolean = true,
    ): InboxRoute? {
        val key = categoryKey(alert)
        val type = alert.notificationType.trim().lowercase()
        val ticker = alert.ticker?.trim()?.takeIf { it.isNotEmpty() }
        val warRoom = alert.warRoomId?.trim()?.takeIf { it.isNotEmpty() }
        return when {
            ticker != null && (canOpenName || canOpen) &&
                (key == "thesis_drift" || type == "thesis_drift" || type == "contrarian_alert") ->
                InboxRoute.NameChanges(ticker)
            warRoom != null && (canOpenWarRoom || canOpen) && (key == "earnings" || type.startsWith("earnings")) ->
                InboxRoute.WarRoom(warRoom)
            canOpen -> InboxRoute.Alert
            else -> null
        }
    }

    /** The Open action's label: names what it opens. */
    fun openLabel(alert: AlertLedgerItemView, route: InboxRoute): String = when (route) {
        is InboxRoute.NameChanges -> InboxCopy.openName(route.ticker)
        is InboxRoute.WarRoom -> InboxCopy.OPEN_WAR_ROOM
        InboxRoute.Alert -> {
            val type = alert.notificationType.trim().lowercase()
            when {
                !alert.reportId.isNullOrBlank() -> InboxCopy.OPEN_REPORT
                type == "weekly_digest" || !alert.digestDate.isNullOrBlank() -> InboxCopy.OPEN_DIGEST
                type == "market_pulse_ready" || !alert.pulseDate.isNullOrBlank() -> InboxCopy.OPEN_PULSE
                else -> InboxCopy.OPEN
            }
        }
    }
}

/** A row on its way out: quieted (Undo pending) or waiting for its collapse to finish. */
private enum class RowExit { Collapsing, Collapsed }

/**
 * The Inbox tab. [padding] is the shell's: its top clears the root bar (the list starts under it, so the day
 * headers stick below the bar), its bottom the navigation bar.
 *
 * [onQuietAlertType] takes the alert id (24 hour mute), [onDisableAlertType] the notification type; both are
 * called only once the Undo snackbar has gone (or the screen leaves). [snackbarHostState] is the shell's host;
 * without one the screen draws its own above [padding]'s bottom. [refreshError] is a failed reload with alerts
 * already shown; [inboxError] (load or action) only replaces the list when there is no list to show.
 * [inboxErrorKey] changes with every error the ViewModel reports (HANDOFF-F item 4), so a second failure with the
 * same message still brings a refused quiet back; without it the screen reacts to a change of message only.
 */
@OptIn(ExperimentalFoundationApi::class, ExperimentalMaterial3Api::class)
@Composable
fun InboxScreen(
    padding: PaddingValues,
    alerts: List<AlertLedgerItemView>,
    inboxError: String?,
    onRefresh: () -> Unit,
    onOpenAlert: (AlertLedgerItemView) -> Unit,
    onUnlockDetail: () -> Unit,
    onSubmitFeedback: (String, String) -> Unit,
    onQuietAlertType: (String) -> Unit,
    onDisableAlertType: (String) -> Unit,
    /** False for an alert whose "Open" would only land back on Inbox (`DeepLinkRouter.alertHasDestination`). */
    canOpenAlert: (AlertLedgerItemView) -> Boolean = { true },
    isRefreshing: Boolean = false,
    /** True before the first load has answered (skeleton rows). */
    isLoading: Boolean = false,
    lastInboxVisitAtMs: Long? = null,
    onMarkAllSeen: (() -> Unit)? = null,
    onOpenName: ((String) -> Unit)? = null,
    /** The Name page scrolled to "Since the last report"; falls back to [onOpenName]. */
    onOpenNameAtChanges: ((String) -> Unit)? = null,
    onOpenWarRoom: ((String) -> Unit)? = null,
    initialCategory: String? = null,
    /**
     * A category asked for by another screen (the weekly digest's alert rows), applied when it changes; then
     * [onCategoryRequestHandled] is called so the caller clears it. Clearing it keeps the selection.
     */
    categoryRequest: String? = null,
    onCategoryRequestHandled: () -> Unit = {},
    /** Only the alerts about this ticker (its own or a related one), until its chip is removed. */
    initialTicker: String? = null,
    /**
     * A ticker asked for by another screen (Name's "See alerts", 5.11 item 3): the list shows that name's alerts
     * under a removable chip ("AAPL ×"); then [onTickerRequestHandled] is called so the caller clears it.
     */
    tickerRequest: String? = null,
    onTickerRequestHandled: () -> Unit = {},
    /** The alert to open expanded (a notification tap that lands on the Inbox). */
    initialExpandedId: String? = null,
    refreshError: String? = null,
    inboxErrorKey: Any? = null,
    snackbarHostState: SnackbarHostState? = null,
    clock: Clock = Clock.systemDefaultZone(),
) {
    val fmt = LocalFmt.current
    val haptics = rememberHaptics()
    val scope = rememberCoroutineScope()
    val localHost = remember { SnackbarHostState() }
    val host = snackbarHostState ?: localHost
    val layoutDirection = LocalLayoutDirection.current

    var category by rememberSaveable { mutableStateOf(initialCategory) }
    // Declared before the category request reads it: a category asked for ends a name's scope.
    var ticker by rememberSaveable { mutableStateOf(initialTicker?.trim()?.uppercase()?.ifBlank { null }) }
    LaunchedEffect(categoryRequest) {
        if (categoryRequest != null) {
            category = categoryRequest
            // Weekly digest > Alerts by category after Name > See alerts: the scope would hide the category's
            // other names (and drop the category when none of the scoped alerts has it), so the request ends it.
            ticker = null
            onCategoryRequestHandled()
        }
    }
    LaunchedEffect(tickerRequest) {
        if (tickerRequest != null) {
            // A name's alerts in every category: the category filter would hide some of them.
            ticker = tickerRequest.trim().uppercase().ifBlank { null }
            category = null
            onTickerRequestHandled()
        }
    }
    var expandedId by rememberSaveable { mutableStateOf(initialExpandedId) }
    var showQuiet by rememberSaveable { mutableStateOf(false) }
    var menuFor by remember { mutableStateOf<AlertLedgerItemView?>(null) }
    var confirmTurnOff by remember { mutableStateOf<AlertLedgerItemView?>(null) }
    // Rows quieted on this screen: collapsing / collapsed while their Undo snackbar shows, then committed.
    val exits = remember { mutableStateMapOf<String, RowExit>() }
    val committed = remember { mutableStateMapOf<String, Boolean>() }
    // The height of each row on its way out (px), and those already shorter than the card's corner radius.
    val exitHeights = remember { mutableStateMapOf<String, Int>() }
    val cornerPx = with(LocalDensity.current) { ThesisShape.CardRadius.roundToPx() }
    val closing by remember(cornerPx) {
        derivedStateOf { exits.keys.filter { (exitHeights[it] ?: Int.MAX_VALUE) < cornerPx }.toSet() }
    }
    // Bumped on Undo so the row's swipe state starts again from rest.
    val restores = remember { mutableStateMapOf<String, Int>() }
    // Feedback shown before the server answers; dropped when an error comes back (the list keeps the server's).
    val feedback = remember { mutableStateMapOf<String, String>() }
    val currentAlerts by rememberUpdatedState(alerts)
    LaunchedEffect(inboxError, inboxErrorKey) {
        if (!inboxError.isNullOrBlank()) {
            feedback.clear()
            // A quiet the server did not take (no mutedAt): bring the row back, so it can be quieted again.
            committed.keys.removeAll { id -> currentAlerts.none { it.id == id && !it.mutedAt.isNullOrBlank() } }
        }
    }

    val quietCall by rememberUpdatedState(onQuietAlertType)
    val disableCall by rememberUpdatedState(onDisableAlertType)

    val now = clock.instant()
    val today = LocalDate.now(clock)
    // Name's "See alerts": that name's alerts only; the rest of the Inbox (chips, lede, counts) reads within them.
    val scoped = ticker?.let { t -> alerts.filter { it.concerns(t) } } ?: alerts
    val quietIds = scoped.filter { committed[it.id] == true || (InboxModels.isQuiet(it, now) && it.id !in exits) }.map { it.id }.toSet()
    // The rows in the list: a row quieted here stays composed while its Undo shows (it comes back in place)...
    val visible = scoped.filter { it.id !in quietIds }
    // ...but no longer counts: the chips, the lede and the new count drop it at once, and Undo puts it back.
    val counted = visible.filter { it.id !in exits }
    val selected = category?.takeIf { key -> visible.any { InboxModels.categoryKey(it) == key } }
    val filters = remember(counted, selected) { InboxModels.filters(counted, keep = selected) }
    val shown = InboxModels.filter(if (showQuiet) scoped else visible, selected)
    val days = remember(shown, today, fmt) { InboxModels.groupByDay(shown, clock.zone, today, fmt) }
    val lede = InboxModels.lede(counted, lastInboxVisitAtMs)
    val newCount = InboxModels.newCount(counted, lastInboxVisitAtMs)

    val quiet: (AlertLedgerItemView) -> Unit = { alert ->
        if (alert.id !in exits) {
            if (expandedId == alert.id) expandedId = null
            exits[alert.id] = RowExit.Collapsing
            scope.launch {
                host.currentSnackbarData?.dismiss()
                var undone = false
                try {
                    undone = host.showThesisSnackbar(InboxCopy.QUIETED, InboxCopy.UNDO) == SnackbarResult.ActionPerformed
                } finally {
                    if (undone) {
                        exits.remove(alert.id)
                        exitHeights.remove(alert.id)
                        restores[alert.id] = (restores[alert.id] ?: 0) + 1
                    } else {
                        committed[alert.id] = true
                        exits.remove(alert.id)
                        exitHeights.remove(alert.id)
                        quietCall(alert.id)
                    }
                }
            }
        }
    }
    val turnOff: (AlertLedgerItemView) -> Unit = { alert ->
        val family = InboxCopy.family(alert.notificationType)
        scope.launch {
            host.currentSnackbarData?.dismiss()
            var undone = false
            try {
                undone = host.showThesisSnackbar(InboxCopy.turnedOff(family), InboxCopy.UNDO) == SnackbarResult.ActionPerformed
            } finally {
                if (!undone) disableCall(alert.notificationType)
            }
        }
    }
    val open: (AlertLedgerItemView, InboxRoute) -> Unit = { alert, route ->
        when (route) {
            is InboxRoute.NameChanges -> (onOpenNameAtChanges ?: onOpenName)?.invoke(route.ticker) ?: onOpenAlert(alert)
            is InboxRoute.WarRoom -> onOpenWarRoom?.invoke(route.id) ?: onOpenAlert(alert)
            InboxRoute.Alert -> onOpenAlert(alert)
        }
    }

    // Filters swap with a 150 ms fade (5.21); the first composition shows the list at once.
    val listAlpha = remember { Animatable(1f) }
    var lastCategory by remember { mutableStateOf(selected) }
    LaunchedEffect(selected) {
        if (selected != lastCategory) {
            lastCategory = selected
            listAlpha.snapTo(0f)
            listAlpha.animateTo(1f, ThesisMotion.quick())
        }
    }

    val loadingFirst = alerts.isEmpty() && (isLoading || isRefreshing) && inboxError.isNullOrBlank()
    val showSkeleton = rememberShowSkeleton(loadingFirst)
    val listState = rememberLazyListState()
    val bottom = padding.calculateBottomPadding()

    Box(
        Modifier
            .fillMaxSize()
            .padding(
                start = padding.calculateStartPadding(layoutDirection),
                end = padding.calculateEndPadding(layoutDirection),
            ),
    ) {
        ThesisRefreshBox(
            refreshing = isRefreshing,
            onRefresh = onRefresh,
            modifier = Modifier
                .fillMaxSize()
                .padding(top = padding.calculateTopPadding()),
        ) {
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = bottom + ThesisSpace.x5),
            ) {
                item(key = "header", contentType = "header") {
                    InboxHeader(
                        lede = lede,
                        // Mark all as seen marks every alert: offered on the whole Inbox only, never in a name's scope.
                        markAllSeen = if (newCount > 0 && ticker == null) onMarkAllSeen else null,
                    )
                }
                val scopeTicker = ticker
                if (visible.isNotEmpty() || scopeTicker != null) {
                    item(key = "filters", contentType = "filters") {
                        ChipRow(Modifier.padding(bottom = ThesisSpace.headerToSection)) {
                            if (scopeTicker != null) {
                                item(key = "ticker") {
                                    val remove = InboxCopy.removeTickerFilter(scopeTicker)
                                    ThesisChip(
                                        label = scopeTicker,
                                        selected = true,
                                        onClick = { ticker = null },
                                        modifier = Modifier.semantics { contentDescription = remove },
                                        leadingIcon = ThesisIcons.Small.Close,
                                        role = Role.Button,
                                    )
                                }
                            }
                            if (visible.isNotEmpty()) items(filters.size, key = { filters[it].key ?: "all" }) { i ->
                                val f = filters[i]
                                ThesisChip(
                                    label = f.label,
                                    selected = f.key == selected,
                                    onClick = { category = f.key },
                                    count = f.count,
                                )
                            }
                        }
                    }
                }
                when {
                    alerts.isEmpty() && showSkeleton -> item(key = "skeleton", contentType = "skeleton") { InboxSkeleton() }
                    alerts.isEmpty() && loadingFirst -> Unit
                    alerts.isEmpty() && !inboxError.isNullOrBlank() -> item(key = "error", contentType = "state") {
                        ErrorState(
                            title = KitCopy.couldNotLoad(InboxCopy.LOAD_SUBJECT),
                            cause = inboxError,
                            onRetry = onRefresh,
                            modifier = Modifier.padding(horizontal = ThesisSpace.gutter),
                        )
                    }
                    scopeTicker != null && scoped.isEmpty() -> item(key = "ticker-empty", contentType = "state") {
                        EmptyState(
                            sentence = InboxCopy.noAlertsFor(scopeTicker),
                            how = InboxCopy.NO_ALERTS_FOR_HOW,
                            actionLabel = InboxCopy.SHOW_ALL,
                            onAction = { ticker = null },
                            modifier = Modifier.padding(horizontal = ThesisSpace.gutter),
                        )
                    }
                    visible.isEmpty() && !showQuiet && alerts.isNotEmpty() -> item(key = "all-quiet", contentType = "state") {
                        EmptyState(
                            sentence = InboxCopy.ALL_QUIET,
                            how = InboxCopy.ALL_QUIET_HOW,
                            icon = ThesisIcons.Quiet,
                            modifier = Modifier.padding(horizontal = ThesisSpace.gutter).padding(bottom = ThesisSpace.l),
                        )
                    }
                    visible.isEmpty() && !showQuiet -> item(key = "empty", contentType = "state") {
                        EmptyState(
                            sentence = InboxCopy.EMPTY,
                            how = InboxCopy.EMPTY_HOW,
                            icon = ThesisIcons.Inbox,
                            modifier = Modifier.padding(horizontal = ThesisSpace.gutter),
                        )
                    }
                    shown.isEmpty() -> item(key = "filtered-empty", contentType = "state") {
                        EmptyState(
                            sentence = InboxCopy.filteredEmpty(selected?.let(InboxCopy::category) ?: InboxCopy.ALL),
                            how = InboxCopy.FILTERED_EMPTY_HOW,
                            actionLabel = InboxCopy.SHOW_ALL,
                            onAction = { category = null },
                            modifier = Modifier.padding(horizontal = ThesisSpace.gutter),
                        )
                    }
                    else -> {
                        if (!refreshError.isNullOrBlank()) {
                            item(key = "refresh-failed", contentType = "banner") {
                                InlineBanner(
                                    text = InboxCopy.REFRESH_FAILED,
                                    tone = BannerTone.Attention,
                                    actionLabel = KitCopy.TRY_AGAIN,
                                    onAction = onRefresh,
                                    modifier = Modifier
                                        .padding(horizontal = ThesisSpace.gutter)
                                        .padding(bottom = ThesisSpace.l)
                                        .semantics { liveRegion = LiveRegionMode.Polite },
                                )
                            }
                        }
                        alertDays(
                            days = days,
                            exits = exits,
                            restores = restores,
                            closing = closing,
                            alpha = { listAlpha.value },
                            row = { alert ->
                                val route = InboxModels.route(
                                    alert,
                                    canOpen = canOpenAlert(alert),
                                    canOpenName = onOpenNameAtChanges != null || onOpenName != null,
                                    canOpenWarRoom = onOpenWarRoom != null,
                                )
                                val quietNow = InboxModels.isQuiet(alert, now) || committed[alert.id] == true
                                InboxRow(
                                    alert = alert,
                                    categoryKey = InboxModels.categoryKey(alert),
                                    time = InboxModels.instant(alert.createdAt)?.let(fmt::time).orEmpty(),
                                    isNew = InboxModels.isNew(alert, lastInboxVisitAtMs),
                                    expanded = expandedId == alert.id,
                                    quietSince = if (quietNow) InboxModels.instant(alert.mutedAt)?.let(fmt::relative) else null,
                                    openLabel = route?.let { InboxModels.openLabel(alert, it) },
                                    feedback = feedback[alert.id] ?: alert.feedbackState,
                                    swipeEnabled = !quietNow,
                                    onToggle = { expandedId = if (expandedId == alert.id) null else alert.id },
                                    onOpen = { route?.let { open(alert, it) } },
                                    onOpenName = onOpenName,
                                    onUnlockDetail = onUnlockDetail,
                                    onFeedback = { value ->
                                        if ((feedback[alert.id] ?: alert.feedbackState) != value) {
                                            feedback[alert.id] = value
                                            onSubmitFeedback(alert.id, value)
                                        }
                                    },
                                    onQuiet = { quiet(alert) },
                                    onMore = { menuFor = alert },
                                )
                            },
                            onExitHeight = { id, height -> if (id in exits) exitHeights[id] = height else exitHeights.remove(id) },
                            onCollapsed = { id -> if (exits[id] == RowExit.Collapsing) exits[id] = RowExit.Collapsed },
                        )
                    }
                }
                // Counted within the filter, so the footer never points at alerts the filter hides anyway.
                val quietCount = InboxModels.filter(scoped.filter { it.id in quietIds }, selected).size
                if (quietCount > 0 && alerts.isNotEmpty()) {
                    item(key = "quiet-footer", contentType = "footer") {
                        QuietFooter(
                            count = quietCount,
                            showing = showQuiet,
                            onToggle = { showQuiet = !showQuiet },
                            modifier = thesisItemMotion(),
                        )
                    }
                }
            }
        }
        if (snackbarHostState == null) {
            ThesisSnackbarHost(
                hostState = localHost,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = bottom),
            )
        }
    }

    menuFor?.let { alert ->
        ThesisSheet(onDismissRequest = { menuFor = null }, title = alert.title) {
            if (!InboxModels.isQuiet(alert, now) && committed[alert.id] != true) {
                SheetActionRow(
                    icon = ThesisIcons.Quiet,
                    label = InboxCopy.QUIET_24H,
                    onClick = {
                        menuFor = null
                        quiet(alert)
                    },
                )
            }
            SheetActionRow(
                icon = ThesisIcons.Remove,
                label = InboxCopy.TURN_OFF_TYPE,
                destructive = true,
                onClick = {
                    menuFor = null
                    confirmTurnOff = alert
                },
            )
        }
    }
    confirmTurnOff?.let { alert ->
        val family = InboxCopy.family(alert.notificationType)
        ThesisDialog(
            onDismissRequest = { confirmTurnOff = null },
            title = InboxCopy.turnOffTitle(family),
            body = InboxCopy.TURN_OFF_BODY,
            confirm = DialogAction(InboxCopy.TURN_OFF_CONFIRM, onClick = {
                haptics.reject()
                confirmTurnOff = null
                turnOff(alert)
            }),
            dismiss = DialogAction(InboxCopy.CANCEL, onClick = { confirmTurnOff = null }),
            destructive = true,
        )
    }
}

/**
 * The day groups: a sticky [DayHeader] per day, then its rows as one card (rowGroupSegment). The segment is the
 * [DismissibleItem]'s own container, so a row on its way out closes up with its slice of the card (its corners
 * and border intact, no page background through the card) while only its content fades. It keeps its shape, and
 * its neighbours theirs, until its slice is shorter than the card's corner radius ([closing], measured through
 * [onExitHeight]): from there the neighbour takes the card's edge at full radius while the last sliver closes,
 * so the corners never shrink to square and nothing snaps when the collapse ends ([onCollapsed]). A day whose
 * rows have all gone loses its header. The day's top and bottom spacing are items of their own, so they never
 * collapse with a row.
 */
@OptIn(ExperimentalFoundationApi::class)
private fun LazyListScope.alertDays(
    days: List<InboxDay>,
    exits: Map<String, RowExit>,
    restores: Map<String, Int>,
    closing: Set<String>,
    alpha: () -> Float,
    row: @Composable (AlertLedgerItemView) -> Unit,
    onExitHeight: (String, Int) -> Unit,
    onCollapsed: (String) -> Unit,
) {
    days.forEach { day ->
        val present = day.alerts.filter { exits[it.id] != RowExit.Collapsed }
        // The rows that shape the card: a row nearly closed no longer counts for its neighbours.
        val shaping = present.filter { it.id !in closing }
        val dayKey = day.date ?: "undated"
        // A day whose rows have all collapsed loses its header; the rows stay composed (they come back on Undo).
        if (present.isNotEmpty()) {
            // Headers fade in and out with their day (4.4 item motion); the list pins and moves them itself.
            stickyHeader(key = "day-$dayKey", contentType = "day") {
                Box(thesisItemMotion(placement = false)) { DayHeader(day.label) }
            }
            item(key = "day-top-$dayKey", contentType = "day-gap") { Spacer(thesisItemMotion().height(ThesisSpace.s)) }
        }
        day.alerts.forEach { alert ->
            val position = when {
                alert.id in closing && alert in present -> RowPosition.of(present.indexOf(alert), present.size)
                alert in shaping -> RowPosition.of(shaping.indexOf(alert), shaping.size)
                else -> RowPosition.Only
            }
            item(key = alert.id, contentType = "alert") {
                DismissibleItem(
                    removing = alert.id in exits,
                    onRemoved = { onCollapsed(alert.id) },
                    // Survivors glide (`spatial`); alerts that Show quiet brings in or takes out fade (4.4, PR-4b).
                    modifier = thesisItemMotion()
                        .onSizeChanged { onExitHeight(alert.id, it.height) }
                        .padding(horizontal = ThesisSpace.gutter)
                        .rowGroupSegment(position, LeadingRowDividerInset),
                ) {
                    // The filter fade (150 ms) is on the content, so the card itself never thins out.
                    Box(Modifier.graphicsLayer { this.alpha = alpha() }) {
                        // A new swipe state after Undo, so the row comes back at rest.
                        key(restores[alert.id] ?: 0) { row(alert) }
                    }
                }
            }
        }
        if (present.isNotEmpty()) {
            item(key = "day-end-$dayKey", contentType = "day-gap") { Spacer(thesisItemMotion().height(ThesisSpace.sectionGapData)) }
        }
    }
}

@Composable
private fun InboxHeader(lede: String?, markAllSeen: (() -> Unit)?) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = ThesisSpace.gutter)
            .padding(top = ThesisSpace.headerTop, bottom = ThesisSpace.headerToSection),
    ) {
        ScreenHeader(title = InboxCopy.TITLE, deck = lede)
        if (markAllSeen != null) {
            TextAction(InboxCopy.MARK_ALL_SEEN, onClick = markAllSeen)
        }
    }
}

/** One alert: the swipe to quiet around the kit's AlertRow, with the expanded detail. */
@Composable
private fun InboxRow(
    alert: AlertLedgerItemView,
    categoryKey: String,
    time: String,
    isNew: Boolean,
    expanded: Boolean,
    quietSince: String?,
    openLabel: String?,
    feedback: String?,
    swipeEnabled: Boolean,
    onToggle: () -> Unit,
    onOpen: () -> Unit,
    onOpenName: ((String) -> Unit)?,
    onUnlockDetail: () -> Unit,
    onFeedback: (String) -> Unit,
    onQuiet: () -> Unit,
    onMore: () -> Unit,
) {
    val ticker = alert.ticker?.trim()?.takeIf { it.isNotEmpty() }
    val category = InboxCopy.category(categoryKey)
    SwipeToQuiet(onQuiet = onQuiet, enabled = swipeEnabled, actionLabel = InboxCopy.QUIET_24H) {
        AlertRow(
            categoryColor = alertCategoryColor(categoryKey),
            // Line 1 shows the ticker: the title does not repeat it (V3). The sheet keeps the full title.
            title = InboxCopy.rowTitle(alert.title, ticker),
            body = alert.body,
            time = time,
            onClick = onToggle,
            // Opaque, so the swipe's Quiet background shows only where the row has moved away.
            modifier = Modifier.background(LocalThesisPalette.current.surface),
            // Line 1 is never empty: an alert without a ticker (Pulse, Macro, system) carries its category there,
            // muted and not tappable, so every row has the same rhythm. TalkBack then hears the category once.
            ticker = ticker ?: category,
            onTickerClick = if (ticker != null && onOpenName != null) ({ onOpenName(ticker) }) else null,
            isNew = isNew,
            expanded = expanded,
            categoryLabel = if (ticker != null) category else null,
        ) {
            AlertDetail(
                alert = alert,
                quietSince = quietSince,
                openLabel = openLabel,
                feedback = feedback,
                onOpen = onOpen,
                onUnlockDetail = onUnlockDetail,
                onFeedback = onFeedback,
                onMore = onMore,
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun AlertDetail(
    alert: AlertLedgerItemView,
    quietSince: String?,
    openLabel: String?,
    feedback: String?,
    onOpen: () -> Unit,
    onUnlockDetail: () -> Unit,
    onFeedback: (String) -> Unit,
    onMore: () -> Unit,
) {
    val p = LocalThesisPalette.current
    val detail = alert.detailBody?.trim()?.takeIf { it.isNotEmpty() }
    Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
        when {
            // The summary's size, set apart by colour only (V3: three sizes a card).
            detail != null -> Text(detail, style = ThesisType.bodySmall, color = p.ink)
            // The Pro lock, set apart from the detail text (5.21.4); its action follows the callout.
            alert.detailLocked -> Column {
                Callout(InboxCopy.PRO_LOCKED)
                // The card foot's inline action: its 48 dp target overhangs the line, so the action sits on the
                // card's 8 dp rhythm instead of opening a 40 dp gap (HANDOFF-F 9f asks to make this public).
                TextActionImpl(
                    InboxCopy.UNLOCK,
                    onClick = onUnlockDetail,
                    modifier = Modifier.padding(top = ThesisSpace.s),
                    inlineTouch = true,
                )
            }
        }
        alert.reasonText.trim().takeIf { it.isNotEmpty() }?.let { reason ->
            Text(
                reason,
                style = ThesisType.caption,
                color = p.muted,
                modifier = Modifier.semantics { contentDescription = "${InboxCopy.REASON}: $reason" },
            )
        }
        if (quietSince != null) {
            Text(InboxCopy.quietSince(quietSince), style = ThesisType.caption, color = p.muted)
        }
        // One line of 48 dp targets: the feedback pair, then Open and More actions at the end. Two stacked lines of
        // 48 dp targets left about 40 dp of air between them; a narrow row or a large font wraps Open to a line
        // of its own.
        FlowRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(ThesisSpace.s),
            verticalArrangement = Arrangement.Center,
        ) {
            Row(
                Modifier
                    .align(Alignment.CenterVertically)
                    .selectableGroup()
                    .semantics { contentDescription = InboxCopy.FEEDBACK_GROUP },
                horizontalArrangement = Arrangement.spacedBy(ThesisSpace.s),
            ) {
                ThesisChip(
                    label = InboxCopy.USEFUL,
                    selected = feedback == FEEDBACK_USEFUL,
                    onClick = { onFeedback(FEEDBACK_USEFUL) },
                    role = Role.RadioButton,
                )
                ThesisChip(
                    label = InboxCopy.NOT_USEFUL,
                    selected = feedback == FEEDBACK_NOT_USEFUL,
                    onClick = { onFeedback(FEEDBACK_NOT_USEFUL) },
                    role = Role.RadioButton,
                )
            }
            Spacer(Modifier.weight(1f))
            Row(Modifier.align(Alignment.CenterVertically), verticalAlignment = Alignment.CenterVertically) {
                if (openLabel != null) TextAction(openLabel, onClick = onOpen, trailing = true)
                ThesisIconButton(ThesisIcons.Overflow, contentDescription = InboxCopy.MORE_ACTIONS, onClick = onMore)
            }
        }
    }
}

@Composable
private fun QuietFooter(count: Int, showing: Boolean, onToggle: () -> Unit, modifier: Modifier = Modifier) {
    val p = LocalThesisPalette.current
    Row(
        modifier
            .fillMaxWidth()
            .padding(horizontal = ThesisSpace.gutter),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(if (showing) InboxCopy.quietShown(count) else InboxCopy.quietHidden(count), style = ThesisType.caption, color = p.muted, modifier = Modifier.weight(1f))
        TextAction(if (showing) InboxCopy.HIDE_QUIET else InboxCopy.SHOW_QUIET, onClick = onToggle)
    }
}

@Composable
private fun InboxSkeleton() {
    ShimmerHost {
        Column(Modifier.padding(horizontal = ThesisSpace.gutter).padding(top = ThesisSpace.s)) {
            repeat(SKELETON_ROWS) { i ->
                Box(Modifier.rowGroupSegment(RowPosition.of(i, SKELETON_ROWS), LeadingRowDividerInset)) { SkeletonRow() }
            }
        }
    }
}

private const val SKELETON_ROWS = 6
private const val FEEDBACK_USEFUL = "useful"
private const val FEEDBACK_NOT_USEFUL = "not_useful"
