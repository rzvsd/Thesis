package com.thesis.mobile.ui.screens

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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.AnnotatedString
import com.thesis.mobile.model.ScenarioStressImpactView
import com.thesis.mobile.model.ScenarioStressRunView
import com.thesis.mobile.model.ScenarioStressTemplateView
import com.thesis.mobile.ui.charts.kit.ChartCard
import com.thesis.mobile.ui.charts.kit.RankedBar
import com.thesis.mobile.ui.charts.kit.RankedBars
import com.thesis.mobile.ui.components.ActionRow
import com.thesis.mobile.ui.components.BannerTone
import com.thesis.mobile.ui.components.Callout
import com.thesis.mobile.ui.components.CardVariant
import com.thesis.mobile.ui.components.EmptyState
import com.thesis.mobile.ui.components.ErrorState
import com.thesis.mobile.ui.components.InlineBanner
import com.thesis.mobile.ui.components.KpiGrid
import com.thesis.mobile.ui.components.KpiSpec
import com.thesis.mobile.ui.components.Loadable
import com.thesis.mobile.ui.components.RunBar
import com.thesis.mobile.ui.components.ScreenHeader
import com.thesis.mobile.ui.components.SectionHeader
import com.thesis.mobile.ui.components.SkeletonCard
import com.thesis.mobile.ui.components.SkeletonKpiGrid
import com.thesis.mobile.ui.components.StateCrossfade
import com.thesis.mobile.ui.components.StatusBadge
import com.thesis.mobile.ui.components.TextAction
import com.thesis.mobile.ui.components.ThesisCard
import com.thesis.mobile.ui.components.ThesisDivider
import com.thesis.mobile.ui.components.ThesisIconButton
import com.thesis.mobile.ui.components.rememberTopBarCollapsed
import com.thesis.mobile.ui.copy.KitCopy
import com.thesis.mobile.ui.copy.ResearchCopy
import com.thesis.mobile.ui.format.Fmt
import com.thesis.mobile.ui.format.LocalFmt
import com.thesis.mobile.ui.icons.ThesisIcons
import com.thesis.mobile.ui.motion.rememberHaptics
import com.thesis.mobile.ui.motion.thesisPress
import com.thesis.mobile.ui.theme.LocalThesisPalette
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.Tone
import com.thesis.mobile.ui.theme.textColor
import java.net.URI
import java.time.LocalDate
import java.time.ZoneId

/*
 * Scenario Stress (DESIGN-DIRECTION 5.20): pick one macro shock, run it across the names you follow, and read which
 * name it touches first. Header with the names count, a Pro gate for everyone else, the scenario cards (radio
 * group), a run bar at the bottom, then the results: KPIs, ranked stress bars (descending, toned by level, scale
 * stated, one line each), a by-name list that carries each name's rationale and badges once and opens to its
 * evidence and the Name page, and guardrails as plain callouts.
 * Removed: duplicated title, "Reopen run", the always-amber "Critical: 0", `%.2f` scores and the two spinners.
 */

// ---- Pure model (unit-tested)

/** A stress score as 0 to 100: the contract sends 0..1; a value already above 1 is taken as 0..100. */
internal fun stressScore100(raw: Double): Double? {
    if (raw.isNaN() || raw.isInfinite()) return null
    val scaled = if (raw <= 1.0) raw * 100.0 else raw
    return scaled.coerceIn(0.0, 100.0)
}

/** Impact level → tone: critical/high Unfavourable, elevated/watch Attention, none Neutral, unknown Unknown. */
internal fun stressTone(level: String?): Tone = when (level?.trim()?.lowercase()) {
    "critical", "high" -> Tone.Unfavourable
    "elevated", "watch" -> Tone.Attention
    "none" -> Tone.Neutral
    else -> Tone.Unknown
}

/** Thesis break likelihood → badge text and tone (very high/high: likely; moderate: possible; low: unlikely). */
internal fun breakBadge(likelihood: String?): PhaseBadge? = when (likelihood?.trim()?.lowercase()?.replace(' ', '_')) {
    "very_high", "high" -> PhaseBadge(ResearchCopy.BREAK_LIKELY, Tone.Unfavourable)
    "moderate", "medium" -> PhaseBadge(ResearchCopy.BREAK_POSSIBLE, Tone.Attention)
    "low", "very_low" -> PhaseBadge(ResearchCopy.BREAK_UNLIKELY, Tone.Neutral)
    null, "" -> null
    else -> PhaseBadge(ResearchCopy.humanize(likelihood) ?: likelihood, Tone.Unknown)
}

/** One name's result, ready to draw. [evidence] keeps web links only (ids are never rendered). */
@Immutable
internal data class StressRow(
    val ticker: String,
    val score: Double?,
    val scoreText: String,
    val rationale: String?,
    val tone: Tone,
    val impact: String,
    val breakBadge: PhaseBadge?,
    val evidence: List<String>,
)

private val webLink = Regex("^https?://\\S+$", RegexOption.IGNORE_CASE)

/**
 * The run's impacts as rows, sorted by stress score descending (missing scores last, ties by ticker), each with its
 * one-line rationale. This is the order of the chart and the by-name list.
 */
internal fun stressRows(run: ScenarioStressRunView): List<StressRow> =
    run.impacts
        .map { it.toRow() }
        .sortedWith(compareBy<StressRow>({ it.score == null }, { -(it.score ?: 0.0) }, { it.ticker }))

private fun ScenarioStressImpactView.toRow(): StressRow {
    val score = stressScore100(stressScore)
    return StressRow(
        ticker = ticker.trim().uppercase(),
        score = score,
        scoreText = Fmt.score(score),
        rationale = rationale.trim().lineSequence().firstOrNull { it.isNotBlank() }?.trim(),
        tone = stressTone(impactLevel),
        impact = ResearchCopy.impactWord(impactLevel),
        breakBadge = breakBadge(thesisBreakLikelihood),
        evidence = evidenceRefs.map { it.trim() }.filter { webLink.matches(it) }.distinct(),
    )
}

/**
 * The rows as single-line bars for [RankedBars]: the rationale is said once, in "By name" under the chart, so the
 * results do not list every name twice (until the kit's bars take a row tap and a badge, HANDOFF-E).
 */
internal fun stressBars(rows: List<StressRow>): List<RankedBar> =
    rows.map { RankedBar(label = it.ticker, value = it.score, valueText = it.scoreText, tone = it.tone) }

/**
 * "Copy as table": tab-separated, a header line then one line per name in rank order. The score is a plain number
 * (0 to 100, the scale in its header) that a spreadsheet reads as a number; a missing score or break likelihood is
 * an empty cell.
 */
internal fun stressTsv(rows: List<StressRow>): String = buildString {
    append(listOf(ResearchCopy.TABLE_TICKER, ResearchCopy.TABLE_SCORE, ResearchCopy.TABLE_IMPACT, ResearchCopy.TABLE_BREAK).joinToString("\t"))
    rows.forEach { r ->
        append('\n')
        append(listOf(r.ticker, rawCell(r.score, 0), r.impact, r.breakBadge?.text.orEmpty()).joinToString("\t") { it.replace('\t', ' ') })
    }
}

/**
 * The one badge a "By name" row carries: the thesis-break likelihood, unless it is "unlikely" (the common case, so
 * it would repeat on most rows). The impact level is not repeated: the score's colour says it (V3).
 */
internal fun stressRowBadge(row: StressRow): PhaseBadge? = row.breakBadge?.takeIf { it.text != ResearchCopy.BREAK_UNLIKELY }

/** The run's as-of date as "Mon 24 Nov" (a date or an instant on the wire); null when unreadable. */
internal fun stressAsOf(raw: String?, fmt: Fmt, zone: ZoneId): String? {
    val value = raw?.trim()?.ifBlank { null } ?: return null
    parseInstant(value)?.let { return fmt.marketDate(it.atZone(zone).toLocalDate()) }
    return runCatching { fmt.marketDate(LocalDate.parse(value.take(10))) }.getOrNull()
}

private fun hostOf(url: String): String = runCatching { URI(url).host?.removePrefix("www.") }.getOrNull() ?: url

// ---- Screen

/**
 * Scenario Stress. Draws its own top bar (back, "Scenario Stress", Copy as table once a run is in); the shell gives
 * it none (HANDOFF-E). [onOpenName] opens a name's Name page ("Open NVDA" in an opened row; hidden while null).
 * [onOpenTickerResearch] (the shell wires it to a Deep Dive build) and [onOpenRunFromRoute] are kept for the shell's
 * call site only: nothing on this screen builds a report, and the "Reopen run" button is gone (5.20). With [onBack]
 * null there is no back arrow (the shell's own bar still shows until WP-INT wires it).
 */
@Composable
fun ScenarioStressScreen(
    userTier: String?,
    templates: List<ScenarioStressTemplateView>,
    selectedScenarioId: String?,
    run: ScenarioStressRunView?,
    templatesError: String?,
    runError: String?,
    isLoadingTemplates: Boolean,
    isRunning: Boolean,
    watchlistCount: Int,
    onRefreshTemplates: () -> Unit,
    onSelectTemplate: (String) -> Unit,
    onRunScenario: (String?) -> Unit,
    @Suppress("UNUSED_PARAMETER") onOpenTickerResearch: (String) -> Unit,
    @Suppress("UNUSED_PARAMETER") onOpenRunFromRoute: (String, String?) -> Unit,
    onRequireUpgrade: (String) -> Unit,
    onBack: (() -> Unit)? = null,
    padding: PaddingValues = PaddingValues(),
    onOpenName: ((ticker: String) -> Unit)? = null,
    zone: ZoneId = ZoneId.systemDefault(),
) {
    val fmt = LocalFmt.current
    val haptics = rememberHaptics()
    val clipboard = LocalClipboardManager.current
    val scroll = rememberScrollState()
    val collapsed by rememberTopBarCollapsed(scroll)
    val isPro = userTier.equals("PRO", ignoreCase = true)
    val active = templates.filter { it.active }.ifEmpty { templates }
    val selected = active.firstOrNull { it.scenarioId == selectedScenarioId }
    val rows = remember(run) { run?.let(::stressRows).orEmpty() }
    var copied by remember(run) { mutableStateOf(false) }

    ResearchBarPage(
        title = ResearchCopy.STRESS_TITLE,
        onBack = onBack,
        padding = padding,
        collapsed = collapsed,
        actions = {
            if (isPro && run != null && rows.isNotEmpty()) {
                ThesisIconButton(
                    icon = ThesisIcons.Copy,
                    contentDescription = if (copied) ResearchCopy.COPIED else ResearchCopy.COPY_TABLE,
                    onClick = {
                        clipboard.setText(AnnotatedString(stressTsv(rows)))
                        haptics.confirm()
                        copied = true
                    },
                )
            }
        },
        bottomBar = if (isPro && active.isNotEmpty()) {
            {
                RunBar(
                    label = selected?.let { ResearchCopy.runLabel(it.title, watchlistCount) } ?: ResearchCopy.PICK_SCENARIO,
                    onClick = {
                        haptics.press()
                        onRunScenario(selected?.scenarioId)
                    },
                    // A run reads the names you follow: with none there is nothing to run, and the caption says so.
                    caption = ResearchCopy.RUN_NEEDS_NAMES.takeIf { watchlistCount <= 0 },
                    enabled = selected != null && !isRunning && watchlistCount > 0,
                    loading = isRunning,
                )
            }
        } else {
            null
        },
    ) { inner ->
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(scroll)
                .researchWidth(data = true)
                .padding(top = inner.calculateTopPadding() + ThesisSpace.headerTop, bottom = inner.calculateBottomPadding())
                .padding(horizontal = ThesisSpace.gutter),
        ) {
            ScreenHeader(title = ResearchCopy.STRESS_TITLE, deck = ResearchCopy.stressDeck(watchlistCount))
            if (!isPro) {
                Spacer(Modifier.height(ThesisSpace.headerToSection))
                Callout(ResearchCopy.STRESS_PRO)
                Spacer(Modifier.height(ThesisSpace.s))
                TextAction(ResearchCopy.SEE_PRO, onClick = { onRequireUpgrade("scenario_stress") })
                return@Column
            }

            Spacer(Modifier.height(ThesisSpace.headerToSection))
            SectionHeader(
                kicker = ResearchCopy.SCENARIOS_KICKER,
                headline = if (active.isEmpty()) ResearchCopy.PICK_SCENARIO else ResearchCopy.scenariosHeadline(active.size),
            )
            Spacer(Modifier.height(ThesisSpace.m))
            when {
                active.isEmpty() && isLoadingTemplates -> {
                    SkeletonCard(bodyLines = 1)
                    Spacer(Modifier.height(ThesisSpace.cardGap))
                    SkeletonCard(bodyLines = 1)
                }
                active.isEmpty() && !templatesError.isNullOrBlank() -> ErrorState(
                    title = KitCopy.couldNotLoad(ResearchCopy.SCENARIOS_FAILED),
                    cause = templatesError,
                    onRetry = onRefreshTemplates,
                )
                active.isEmpty() -> EmptyState(
                    sentence = ResearchCopy.NO_SCENARIOS,
                    how = ResearchCopy.NO_SCENARIOS_HOW,
                    icon = ThesisIcons.ScenarioStress,
                    actionLabel = KitCopy.TRY_AGAIN,
                    onAction = onRefreshTemplates,
                )
                else -> TemplateCards(
                    templates = active,
                    selectedId = selected?.scenarioId,
                    enabled = !isRunning,
                    onSelect = {
                        haptics.segment()
                        onSelectTemplate(it)
                    },
                )
            }

            Spacer(Modifier.height(ThesisSpace.sectionGapData))
            val results: Loadable<ScenarioStressRunView> = when {
                run != null -> Loadable.Ready(run)
                isRunning -> Loadable.Loading
                !runError.isNullOrBlank() -> Loadable.Failed(runError, retryable = selected != null)
                else -> Loadable.Empty(ResearchCopy.NO_RUN)
            }
            if (run != null && !runError.isNullOrBlank() && !isRunning) {
                InlineBanner(text = ResearchCopy.RUN_STALE, tone = BannerTone.Attention)
                Spacer(Modifier.height(ThesisSpace.m))
            }
            StateCrossfade(
                state = results,
                onRetry = { onRunScenario(selected?.scenarioId) },
                loading = { ResultsSkeleton() },
                empty = { EmptyState(sentence = ResearchCopy.NO_RUN, how = ResearchCopy.NO_RUN_HOW, icon = ThesisIcons.ScenarioStress) },
                failed = {
                    ErrorState(
                        title = ResearchCopy.RUN_FAILED,
                        cause = it.cause,
                        onRetry = if (it.retryable) ({ onRunScenario(selected?.scenarioId) }) else null,
                    )
                },
            ) { ready ->
                Column {
                    StressResults(
                        run = ready,
                        rows = rows,
                        fmt = fmt,
                        zone = zone,
                        onOpenName = onOpenName,
                    )
                }
            }
        }
    }
}

@Composable
private fun TemplateCards(
    templates: List<ScenarioStressTemplateView>,
    selectedId: String?,
    enabled: Boolean,
    onSelect: (String) -> Unit,
) {
    val p = LocalThesisPalette.current
    Column(Modifier.selectableGroup(), verticalArrangement = Arrangement.spacedBy(ThesisSpace.cardGap)) {
        templates.forEach { template ->
            val isSelected = template.scenarioId == selectedId
            val interaction = remember { MutableInteractionSource() }
            ThesisCard(
                modifier = Modifier
                    .thesisPress(interaction, enabled = enabled)
                    .selectable(
                        selected = isSelected,
                        enabled = enabled,
                        role = Role.RadioButton,
                        interactionSource = interaction,
                        indication = null,
                        onClick = { onSelect(template.scenarioId) },
                    ),
                variant = if (isSelected) CardVariant.Selected else CardVariant.Plain,
                // The Selected variant draws its check in the eyebrow row; give that row a word instead of a gap.
                eyebrow = if (isSelected) ResearchCopy.SELECTED_SCENARIO else null,
                title = template.title,
            ) {
                val line = template.summary.ifBlank { template.hypothesis }.trim()
                if (line.isNotEmpty()) Text(line, style = ThesisType.bodySmall, color = p.ink2, maxLines = 2)
            }
        }
    }
}

@Composable
private fun ResultsSkeleton() {
    SkeletonKpiGrid()
    Spacer(Modifier.height(ThesisSpace.cardGap))
    SkeletonCard(bodyLines = 5)
}

@Composable
private fun StressResults(
    run: ScenarioStressRunView,
    rows: List<StressRow>,
    fmt: Fmt,
    zone: ZoneId,
    onOpenName: ((String) -> Unit)?,
) {
    val p = LocalThesisPalette.current
    val header = run.run
    val asOf = stressAsOf(header.asOf, fmt, zone)
    val impacted = header.impactedNames.coerceAtLeast(0)
    val top = rows.firstOrNull { it.score != null && it.tone != Tone.Neutral }?.ticker

    SectionHeader(kicker = ResearchCopy.RESULTS_KICKER, headline = ResearchCopy.resultsHeadline(top, impacted))
    if (header.summary.isNotBlank()) {
        Spacer(Modifier.height(ThesisSpace.s))
        Text(header.summary.trim(), style = ThesisType.story, color = p.ink2)
    }
    if (header.status.equals("degraded", ignoreCase = true)) {
        Spacer(Modifier.height(ThesisSpace.m))
        InlineBanner(text = ResearchCopy.RUN_DEGRADED, tone = BannerTone.Attention)
    }
    Spacer(Modifier.height(ThesisSpace.m))
    // Two KPIs, one row: the as-of date is on the chart's source line, and a third tile left an empty fourth cell
    // (a deviation from 5.20's three KPIs, noted in HANDOFF-E). Critical stays neutral: KpiSpec cannot tone its
    // value yet (requested from WP-K).
    KpiGrid(
        items = listOf(
            KpiSpec(ResearchCopy.KPI_AFFECTED, ResearchCopy.ofTotal(impacted, header.totalNames.coerceAtLeast(impacted))),
            KpiSpec(ResearchCopy.KPI_CRITICAL, Fmt.number(header.criticalNames.toLong())),
        ),
    )

    if (rows.isNotEmpty()) {
        Spacer(Modifier.height(ThesisSpace.cardGap))
        ChartCard(
            title = ResearchCopy.STRESS_CHART_TITLE,
            source = asOf?.let(ResearchCopy::stressSource),
        ) {
            RankedBars(
                items = stressBars(rows),
                scaleLabel = ResearchCopy.STRESS_SCALE,
                dataKey = header.scenarioRunId,
            )
        }

        Spacer(Modifier.height(ThesisSpace.sectionGapData))
        SectionHeader(kicker = ResearchCopy.BY_NAME, headline = ResearchCopy.names(rows.size).replaceFirstChar { it.uppercase() })
        Spacer(Modifier.height(ThesisSpace.m))
        ThesisCard {
            rows.forEachIndexed { i, row ->
                if (i > 0) ThesisDivider()
                StressNameRow(row = row, onOpenName = onOpenName)
            }
        }
    }

    val guardrails = run.ruleSuggestions.filter { it.conditionText.isNotBlank() }
    if (guardrails.isNotEmpty()) {
        Spacer(Modifier.height(ThesisSpace.sectionGapData))
        SectionHeader(kicker = ResearchCopy.GUARDRAILS_KICKER, headline = ResearchCopy.guardrailsHeadline(guardrails.size))
        Spacer(Modifier.height(ThesisSpace.m))
        Column(verticalArrangement = Arrangement.spacedBy(ThesisSpace.s)) {
            guardrails.forEach { g ->
                val text = buildString {
                    append(ResearchCopy.guardrailLine(g.ticker.trim().uppercase(), g.conditionText.trim()))
                    g.rationale.trim().ifBlank { null }?.let { append("\n").append(it) }
                }
                Callout(text)
            }
        }
    }
}

/**
 * A name's line in "By name": ticker and score (in its level's colour), the rationale, and a break badge only when
 * a break is possible or likely ([stressRowBadge]).
 * Tapping opens its evidence links and "Open AAPL" (the Name page, when [onOpenName] is set). No haptic on open:
 * toggle() is for follow and notification switches (4.7).
 */
@Composable
private fun StressNameRow(row: StressRow, onOpenName: ((String) -> Unit)?) {
    val p = LocalThesisPalette.current
    val uri = LocalUriHandler.current
    var open by remember(row.ticker) { mutableStateOf(false) }
    val interaction = remember { MutableInteractionSource() }
    Column(Modifier.fillMaxWidth()) {
        Column(
            Modifier
                .fillMaxWidth()
                .heightIn(min = ThesisSpace.rowMinComfortableTwoLine)
                .thesisPress(interaction)
                .toggleable(
                    value = open,
                    interactionSource = interaction,
                    indication = null,
                    role = Role.Button,
                    onValueChange = { open = it },
                )
                .semantics(mergeDescendants = true) {
                    stateDescription = if (open) ResearchCopy.EXPANDED else ResearchCopy.COLLAPSED
                }
                .padding(vertical = ThesisSpace.s),
            verticalArrangement = Arrangement.spacedBy(ThesisSpace.xs),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(row.ticker, style = ThesisType.rowTitle, color = p.ink, modifier = Modifier.weight(1f))
                // The level is said by colour on screen; TalkBack hears it in words.
                Text(
                    row.scoreText,
                    style = ThesisType.tableNum,
                    color = row.tone.textColor(p),
                    modifier = Modifier.semantics { contentDescription = "${row.scoreText}, ${row.impact}" },
                )
            }
            row.rationale?.let { Text(it, style = ThesisType.bodySmall, color = p.ink2) }
            stressRowBadge(row)?.let { StatusBadge(it.text, it.tone) }
        }
        if (open) {
            if (row.evidence.isEmpty()) {
                Text(
                    ResearchCopy.NO_EVIDENCE,
                    style = ThesisType.caption,
                    color = p.muted,
                    modifier = Modifier.padding(bottom = ThesisSpace.s),
                )
            }
            row.evidence.forEach { link ->
                ActionRow(
                    icon = ThesisIcons.Document,
                    title = hostOf(link),
                    caption = ResearchCopy.EVIDENCE,
                    external = true,
                    onClick = { runCatching { uri.openUri(link) } },
                )
            }
            if (onOpenName != null) {
                ActionRow(icon = ThesisIcons.Names, title = ResearchCopy.openName(row.ticker), onClick = { onOpenName(row.ticker) })
            }
        }
    }
}
