package com.thesis.mobile.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import com.thesis.mobile.model.NoteTrailEntry
import com.thesis.mobile.model.ReportHistoryItem
import com.thesis.mobile.model.ReportSearchHit
import com.thesis.mobile.model.SearchResultsView
import com.thesis.mobile.model.TickerSearchItem
import com.thesis.mobile.ui.components.EmptyState
import com.thesis.mobile.ui.components.Eyebrow
import com.thesis.mobile.ui.components.HighlightText
import com.thesis.mobile.ui.components.LeadingRowDividerInset
import com.thesis.mobile.ui.components.LoadingHairline
import com.thesis.mobile.ui.components.RowPosition
import com.thesis.mobile.ui.components.SkeletonRow
import com.thesis.mobile.ui.components.TextAction
import com.thesis.mobile.ui.components.ThesisIconButton
import com.thesis.mobile.ui.components.ThesisTextField
import com.thesis.mobile.ui.components.rememberTopBarCollapsed
import com.thesis.mobile.ui.components.rowGroupSegment
import com.thesis.mobile.ui.copy.ResearchCopy
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.format.LocalFmt
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.motion.thesisPress
import com.thesis.mobile.ui.theme.Kit
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import kotlin.math.abs

/*
 * Search (DESIGN-DIRECTION 5.27): one field, focused on open, over your names, SEC companies, the reports on this
 * phone and your note text. Results come in four groups under eyebrows (Your names · Companies · Reports · Notes),
 * up to five rows each with "Show all"; a note hit shows the excerpt that starts at the matched word, the word
 * marked with the Deep Dive highlight band. Recent searches when the field is empty. Data-screen density.
 */

/** Rows per group before "Show all" (5.27). */
internal const val SEARCH_GROUP_SHOWN = 5

/** Longest note excerpt, in characters, after the matched word. */
private const val EXCERPT_MAX = 140

/** A note excerpt: [lead] is the matched word (highlighted), [rest] what follows; [clipped] when text came before. */
@Immutable
internal data class NoteExcerpt(val lead: String, val rest: String, val clipped: Boolean)

/**
 * The excerpt of [text] around [query]: it starts at the beginning of the word that holds the first match, the
 * lead runs to the end of that word, and the rest is cut at a word boundary near [max] characters with "…".
 * Whitespace runs collapse to one space. No match: the start of the note, with no lead.
 */
internal fun noteExcerpt(text: String, query: String, max: Int = EXCERPT_MAX): NoteExcerpt {
    val flat = text.replace(Regex("\\s+"), " ").trim()
    val q = query.trim()
    val at = if (q.isEmpty()) -1 else flat.indexOf(q, ignoreCase = true)
    if (at < 0) return NoteExcerpt(lead = "", rest = clip(flat, max), clipped = false)
    var start = at
    while (start > 0 && !flat[start - 1].isWhitespace()) start--
    var end = at + q.length
    while (end < flat.length && flat[end].isLetterOrDigit()) end++
    val lead = flat.substring(start, end)
    val rest = clip(flat.substring(end), max)
    return NoteExcerpt(lead = lead, rest = rest, clipped = start > 0)
}

/** Lines of a note excerpt. */
private const val EXCERPT_LINES = 3

private fun clip(s: String, max: Int): String {
    if (s.length <= max) return s
    val cut = s.lastIndexOf(' ', max).takeIf { it > max / 2 } ?: max
    return s.substring(0, cut).trimEnd(' ', ',', ';', ':', '.') + "…"
}

/** The four result groups, de-duplicated: a company already in your names is not repeated under Companies. */
@Immutable
internal data class SearchGroups(
    val names: List<String>,
    val companies: List<TickerSearchItem>,
    val reports: List<ReportSearchHit>,
    val notes: List<NoteTrailEntry>,
) {
    val isEmpty: Boolean get() = names.isEmpty() && companies.isEmpty() && reports.isEmpty() && notes.isEmpty()
}

internal fun searchGroups(results: SearchResultsView): SearchGroups {
    val names = results.names.map { it.trim().uppercase() }.filter { it.isNotEmpty() }.distinct()
    val own = names.toSet()
    return SearchGroups(
        names = names,
        companies = results.tickers.filter { it.symbol.uppercase() !in own }.distinctBy { it.symbol.uppercase() },
        reports = results.reports.distinctBy { it.reportId },
        notes = results.notes.filter { it.text.isNotBlank() },
    )
}

private enum class SearchGroup { Names, Companies, Reports, Notes }

/**
 * Search. Draws its own top bar (back, "Search"); the shell gives it none and wires [onQueryChange] to
 * `vm.search` (HANDOFF-E). [companyNames] and [filingPeriods] come from cached report summaries, [notedReportIds]
 * from the notes cache, [recentSearches] from the session store. A tap on a name or company opens Name, a report
 * opens the report, a note opens Name at "Your notes" on that entry ([onOpenNote]). The query is recorded as a
 * recent search ([onSubmit]) on the keyboard's Search action and before any result opens.
 */
@Composable
fun SearchScreen(
    query: String,
    onQueryChange: (String) -> Unit,
    results: SearchResultsView?,
    onBack: () -> Unit,
    padding: PaddingValues = PaddingValues(),
    recentSearches: List<String> = emptyList(),
    onPickRecent: (String) -> Unit = onQueryChange,
    onClearRecent: (() -> Unit)? = null,
    companyNames: Map<String, String> = emptyMap(),
    filingPeriods: Map<String, String> = emptyMap(),
    notedReportIds: Set<String> = emptySet(),
    onOpenName: (ticker: String) -> Unit = {},
    onOpenReport: (reportId: String) -> Unit = {},
    onOpenNote: (ticker: String?, reportId: String) -> Unit = { _, id -> onOpenReport(id) },
    onSubmit: (String) -> Unit = {},
    autoFocus: Boolean = true,
) {
    val p = LocalThesisPalette.current
    val fmt = LocalFmt.current
    val focus = remember { FocusRequester() }
    val focusManager = LocalFocusManager.current
    val listState = rememberLazyListState()
    val collapsed by rememberTopBarCollapsed(listState)
    val expanded = remember { mutableStateMapOf<SearchGroup, Boolean>() }
    val trimmed = query.trim()
    val current = results?.takeIf { it.query.trim().equals(trimmed, ignoreCase = true) }
    val groups = remember(current) { current?.let(::searchGroups) }
    val searching = trimmed.isNotEmpty() && (current == null || current.isSearchingServer)

    LaunchedEffect(Unit) { if (autoFocus) runCatching { focus.requestFocus() } }
    // A result tap records the query too: most searches end on a tap, not on the keyboard's Search key.
    fun record() {
        if (trimmed.isNotEmpty()) onSubmit(trimmed)
    }

    ResearchBarPage(
        title = ResearchCopy.SEARCH_TITLE,
        onBack = onBack,
        padding = padding,
        collapsed = collapsed,
        titleAlwaysVisible = true,
    ) { inner ->
        LazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize().researchWidth(data = true),
            contentPadding = PaddingValues(top = inner.calculateTopPadding() + ThesisSpace.headerTop, bottom = inner.calculateBottomPadding()),
        ) {
            item(key = "field", contentType = "field") {
                Column(Modifier.padding(horizontal = ThesisSpace.gutter)) {
                    ThesisTextField(
                        value = query,
                        onValueChange = onQueryChange,
                        label = ResearchCopy.SEARCH_LABEL,
                        placeholder = ResearchCopy.SEARCH_PLACEHOLDER,
                        modifier = Modifier.focusRequester(focus),
                        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.None, imeAction = ImeAction.Search),
                        keyboardActions = KeyboardActions(onSearch = {
                            focusManager.clearFocus()
                            if (trimmed.isNotEmpty()) onSubmit(trimmed)
                        }),
                        trailing = if (query.isNotEmpty()) {
                            { ThesisIconButton(ThesisIcons.Close, contentDescription = ResearchCopy.CLEAR_SEARCH, onClick = { onQueryChange("") }) }
                        } else {
                            null
                        },
                    )
                    Spacer(Modifier.height(ThesisSpace.s))
                    LoadingHairline(active = searching)
                    if (searching && groups != null) {
                        Text(ResearchCopy.SEARCHING, style = ThesisType.caption, color = p.muted, modifier = Modifier.padding(top = ThesisSpace.xs))
                    }
                }
            }

            when {
                trimmed.isEmpty() && recentSearches.isNotEmpty() -> recentItems(recentSearches, onPickRecent, onClearRecent)
                trimmed.isEmpty() -> item(key = "start") {
                    EmptyState(
                        sentence = ResearchCopy.SEARCH_START,
                        how = ResearchCopy.SEARCH_START_HOW,
                        icon = ThesisIcons.Search,
                        modifier = Modifier.padding(horizontal = ThesisSpace.gutter, vertical = ThesisSpace.l),
                    )
                }
                groups == null -> item(key = "loading") {
                    Column(Modifier.padding(top = ThesisSpace.l)) {
                        repeat(SEARCH_GROUP_SHOWN - 1) { SkeletonRow() }
                    }
                }
                groups.isEmpty && !searching -> item(key = "none") {
                    EmptyState(
                        sentence = ResearchCopy.searchNoMatch(trimmed),
                        how = ResearchCopy.SEARCH_NO_MATCH_HOW,
                        icon = ThesisIcons.Search,
                        modifier = Modifier.padding(horizontal = ThesisSpace.gutter, vertical = ThesisSpace.l),
                    )
                }
                else -> {
                    group(
                        key = SearchGroup.Names,
                        title = ResearchCopy.GROUP_NAMES,
                        items = groups.names,
                        expanded = expanded,
                        divider = { LeadingRowDividerInset },
                    ) { ticker, mod ->
                        ResearchRow(
                            icon = ThesisIcons.FollowFilled,
                            title = ticker,
                            aside = companyNames[ticker],
                            line2 = ResearchCopy.IN_YOUR_NAMES,
                            onClick = {
                                record()
                                onOpenName(ticker)
                            },
                            modifier = mod,
                        )
                    }
                    group(
                        key = SearchGroup.Companies,
                        title = ResearchCopy.GROUP_COMPANIES,
                        items = groups.companies,
                        expanded = expanded,
                        divider = { LeadingRowDividerInset },
                    ) { item, mod ->
                        ResearchRow(
                            icon = ThesisIcons.Names,
                            title = item.symbol.uppercase(),
                            aside = item.exchange.ifBlank { null },
                            line2 = item.companyName.ifBlank { null },
                            onClick = {
                                record()
                                onOpenName(item.symbol.uppercase())
                            },
                            modifier = mod,
                        )
                    }
                    group(
                        key = SearchGroup.Reports,
                        title = ResearchCopy.GROUP_REPORTS,
                        items = groups.reports,
                        expanded = expanded,
                        divider = { LeadingRowDividerInset },
                    ) { hit, mod ->
                        HistoryItemRow(
                            item = ReportHistoryItem(hit.reportId, jobId = "", type = hit.type, ticker = hit.ticker, createdAt = hit.createdAt),
                            company = hit.companyName ?: hit.ticker?.let { companyNames[it.uppercase()] },
                            period = filingPeriods[hit.reportId],
                            hasNote = hit.reportId in notedReportIds,
                            trailing = parseInstant(hit.createdAt)?.let(fmt::relative),
                            onOpen = {
                                record()
                                onOpenReport(hit.reportId)
                            },
                            modifier = mod,
                        )
                    }
                    group(
                        key = SearchGroup.Notes,
                        title = ResearchCopy.GROUP_NOTES,
                        items = groups.notes,
                        expanded = expanded,
                        divider = { ThesisSpace.l },
                    ) { note, mod ->
                        NoteHitRow(
                            note = note,
                            query = trimmed,
                            fmt = fmt,
                            onOpen = {
                                record()
                                onOpenNote(note.ticker, note.reportId)
                            },
                            modifier = mod,
                        )
                    }
                }
            }
        }
    }
}

private fun LazyListScope.recentItems(recent: List<String>, onPick: (String) -> Unit, onClear: (() -> Unit)?) {
    item(key = "recent-head") {
        Row(
            Modifier.fillMaxWidth().padding(start = ThesisSpace.gutter, end = ThesisSpace.s, top = ThesisSpace.l, bottom = ThesisSpace.xs),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Eyebrow(ResearchCopy.RECENT_SEARCHES, Modifier.weight(1f).semantics { heading() })
            if (onClear != null) TextAction(ResearchCopy.CLEAR_RECENT, onClick = onClear)
        }
    }
    val shown = recent.map { it.trim() }.filter { it.isNotEmpty() }.distinct()
    shown.forEachIndexed { i, q ->
        item(key = "recent-$q") {
            ResearchRow(
                icon = ThesisIcons.History,
                title = q,
                onClick = { onPick(q) },
                modifier = Modifier.padding(horizontal = ThesisSpace.gutter).rowGroupSegment(RowPosition.of(i, shown.size), LeadingRowDividerInset),
            )
        }
    }
}

/**
 * One group: an eyebrow, up to five rows in one row group, and "Show all N" / "Show fewer" when there are more.
 * Nothing at all when the group is empty.
 */
private fun <T> LazyListScope.group(
    key: SearchGroup,
    title: String,
    items: List<T>,
    expanded: MutableMap<SearchGroup, Boolean>,
    divider: @Composable () -> Dp,
    row: @Composable (T, Modifier) -> Unit,
) {
    if (items.isEmpty()) return
    val open = expanded[key] == true
    val shown = if (open) items else items.take(SEARCH_GROUP_SHOWN)
    item(key = "head-$key") {
        Eyebrow(
            title,
            Modifier
                .padding(start = ThesisSpace.gutter, end = ThesisSpace.gutter, top = ThesisSpace.sectionGapData, bottom = ThesisSpace.s)
                .semantics { heading() },
        )
    }
    shown.forEachIndexed { i, value ->
        item(key = "$key-$i") {
            row(value, Modifier.padding(horizontal = ThesisSpace.gutter).rowGroupSegment(RowPosition.of(i, shown.size), divider()))
        }
    }
    if (items.size > SEARCH_GROUP_SHOWN) {
        item(key = "more-$key") {
            TextAction(
                if (open) ResearchCopy.SHOW_FEWER else ResearchCopy.showAll(items.size),
                onClick = { expanded[key] = !open },
                modifier = Modifier.padding(horizontal = ThesisSpace.gutter),
            )
        }
    }
}

/**
 * A note hit: ticker and filing period over the excerpt, the matched word on the highlight band; the date on the
 * right. The excerpt is set in `story` serif, as notes are everywhere else, and starts with "…" when it starts
 * mid-note.
 */
@Composable
private fun NoteHitRow(note: NoteTrailEntry, query: String, fmt: Fmt, onOpen: () -> Unit, modifier: Modifier = Modifier) {
    val p = LocalThesisPalette.current
    val excerpt = remember(note.text, query) { noteExcerpt(note.text, query) }
    val source = remember { MutableInteractionSource() }
    Column(
        modifier
            .fillMaxWidth()
            .heightIn(min = ThesisSpace.rowMinComfortableTwoLine)
            .thesisPress(source)
            .clickable(interactionSource = source, indication = null, role = Role.Button, onClick = onOpen)
            .padding(horizontal = ThesisSpace.l, vertical = ThesisSpace.rowPaddingV),
        verticalArrangement = Arrangement.spacedBy(ThesisSpace.xs),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                listOfNotNull(note.ticker?.uppercase(), periodDisplay(note.filingPeriod)).joinToString(" · ").ifBlank { ResearchCopy.GROUP_NOTES },
                style = ThesisType.rowTitle,
                color = p.ink,
                modifier = Modifier.weight(1f),
            )
            parseInstant(note.updatedAt)?.let { Text(fmt.relative(it), style = ThesisType.caption, color = p.muted) }
        }
        if (excerpt.lead.isEmpty()) {
            Text(excerpt.rest, style = ThesisType.story, color = p.ink2, maxLines = EXCERPT_LINES, overflow = TextOverflow.Ellipsis)
        } else if (!excerpt.clipped) {
            // The excerpt starts at the matched word, so the kit's lead band marks exactly the term (5.27).
            HighlightText(lead = excerpt.lead, rest = excerpt.rest, style = ThesisType.story)
        } else {
            ClippedExcerpt(excerpt)
        }
    }
}

/**
 * An excerpt that starts mid-note: "… " then the matched word on the highlight band, then the rest, in `story`.
 * The kit's HighlightText bands from the first character, which would mark the ellipsis too; until it takes a
 * band range (HANDOFF-E, WP-K) this draws the same band (Kit.HIGHLIGHT_FROM to HIGHLIGHT_TO of each line, on
 * `highlight`) behind the word only.
 */
@Composable
private fun ClippedExcerpt(excerpt: NoteExcerpt) {
    val p = LocalThesisPalette.current
    val prefix = ResearchCopy.EXCERPT_CLIPPED
    val text = buildAnnotatedString {
        append(prefix)
        withStyle(ThesisType.lead) { append(excerpt.lead) }
        if (excerpt.rest.isNotEmpty()) {
            if (!excerpt.rest.startsWith(' ')) append(' ')
            append(excerpt.rest)
        }
    }
    val from = prefix.length
    val to = prefix.length + excerpt.lead.length
    var layout by remember { mutableStateOf<TextLayoutResult?>(null) }
    Text(
        text,
        modifier = Modifier.drawBehind {
            val l = layout ?: return@drawBehind
            val end = minOf(to, l.layoutInput.text.length)
            if (end <= from) return@drawBehind
            for (line in l.getLineForOffset(from)..l.getLineForOffset(end - 1)) {
                val a = maxOf(from, l.getLineStart(line))
                val b = minOf(end, l.getLineEnd(line, visibleEnd = true))
                if (b <= a) continue
                val x1 = l.getHorizontalPosition(a, usePrimaryDirection = true)
                val x2 = l.getHorizontalPosition(b, usePrimaryDirection = true)
                val top = l.getLineTop(line)
                val h = l.getLineBottom(line) - top
                drawRect(
                    p.highlight,
                    topLeft = Offset(minOf(x1, x2), top + h * Kit.HIGHLIGHT_FROM),
                    size = Size(abs(x2 - x1), h * (Kit.HIGHLIGHT_TO - Kit.HIGHLIGHT_FROM)),
                )
            }
        },
        style = ThesisType.story,
        color = p.ink,
        maxLines = EXCERPT_LINES,
        overflow = TextOverflow.Ellipsis,
        onTextLayout = { layout = it },
    )
}
