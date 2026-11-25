package com.thesis.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.SectionView
import com.thesis.mobile.ui.motion.rememberDataEntranceCoordinator
import com.thesis.mobile.ui.motion.staggeredEntrance
import com.thesis.mobile.ui.theme.HeadingFont
import com.thesis.mobile.ui.theme.ThesisColors
import com.thesis.mobile.ui.theme.ThesisDimens
import com.thesis.mobile.ui.theme.ThesisSpace
import com.thesis.mobile.ui.theme.ThesisType
import com.thesis.mobile.ui.theme.ThesisTypography
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@OptIn(ExperimentalMaterialApi::class)
@Composable
fun PulseScreen(
    pulse: PulseReportView?,
    watchlist: List<String>,
    onBack: () -> Unit,
    onRunDeepDive: (String) -> Unit,
    onExportPdf: () -> Unit,
    onRefresh: () -> Unit
) {
    val sections = pulse?.sections.orEmpty()
    val brief = remember(pulse, watchlist) { buildPulseBrief(sections, watchlist) }
    val generatedAt = pulse?.generatedAt?.let(::formatBriefTimestamp)
    val dateLabel = remember { LocalDate.now().format(DateTimeFormatter.ofPattern("EEEE, MMM d")) }
    // First-open entrance (4.3 rule 2): the first 8 blocks stagger once per issue and entry; never on a refresh,
    // a pop back or a recreation. Nothing staggers before the issue has loaded.
    // The modifier is applied from the first paint, so blocks drawn before the issue never blank when it lands.
    val coordinator = rememberDataEntranceCoordinator(dataKey = pulse?.reportId)
    val entrance: (Int) -> Modifier = { order -> Modifier.staggeredEntrance(order, coordinator) }
    var isRefreshing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val pullRefreshState = rememberPullRefreshState(
        refreshing = isRefreshing,
        onRefresh = {
            isRefreshing = true
            onRefresh()
            scope.launch {
                delay(1200L)
                isRefreshing = false
            }
        }
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .pullRefresh(pullRefreshState)
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                top = ThesisDimens.ScreenPaddingTop,
                bottom = ThesisDimens.ScreenPaddingBottom,
                start = ThesisDimens.ScreenPaddingHorizontal,
                end = ThesisDimens.ScreenPaddingHorizontal
            ),
            verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingXl)
        ) {
            item {
                Box(entrance(0)) {
                    BriefTopBar(
                        dateLabel = dateLabel,
                        generatedAt = generatedAt,
                        onBack = onBack,
                        onExportPdf = onExportPdf,
                        onRefresh = onRefresh
                    )
                }
            }

            item {
                Box(entrance(1)) {
                    MorningLineCard(brief.morningLine)
                }
            }

            brief.tape?.let { section ->
                item {
                    Box(entrance(2)) {
                        BriefSection(
                            eyebrow = "YESTERDAY",
                            title = "What happened",
                            body = section.summary,
                            supportingRows = section.rows
                        )
                    }
                }
            }

            item {
                Box(entrance(3)) {
                    BriefSection(
                        eyebrow = "DELTA",
                        title = "What changed",
                        body = brief.whatChanged,
                        supportingRows = brief.deltaRows
                    )
                }
            }

            item {
                Box(entrance(4)) {
                    BriefSection(
                        eyebrow = "READ",
                        title = "The interesting bit",
                        body = brief.interestingBit
                    )
                }
            }

            if (brief.nameRows.isNotEmpty()) {
                item {
                    Box(entrance(5)) {
                        YourNamesBrief(
                            rows = brief.nameRows,
                            comment = brief.namesComment,
                            onRunDeepDive = onRunDeepDive
                        )
                    }
                }
            }

            if (brief.watchRows.isNotEmpty()) {
                item {
                    Box(entrance(6)) {
                        BriefSection(
                            eyebrow = "WATCH",
                            title = "Things to watch",
                            body = "Only items backed by current Pulse inputs are shown.",
                            supportingRows = brief.watchRows
                        )
                    }
                }
            }

            if (brief.headlineRows.isNotEmpty()) {
                item {
                    Box(entrance(7)) {
                        BriefSection(
                            eyebrow = "HEADLINES",
                            title = "Worth knowing",
                            body = "Headline metadata only. Thesis does not summarize article bodies here.",
                            supportingRows = brief.headlineRows
                        )
                    }
                }
            }

            item {
                Box {
                    SignalNoiseCard(signal = brief.signal, noise = brief.noise)
                }
            }

            item {
                Box {
                    SourcesFooter(sources = brief.sources, omissions = brief.omissions)
                }
            }
        }

        PullRefreshIndicator(
            refreshing = isRefreshing,
            state = pullRefreshState,
            modifier = Modifier.align(Alignment.TopCenter),
            backgroundColor = ThesisColors.SurfaceElevated,
            contentColor = ThesisColors.Primary
        )
    }
}

@Composable
private fun BriefTopBar(
    dateLabel: String,
    generatedAt: String?,
    onBack: () -> Unit,
    onExportPdf: () -> Unit,
    onRefresh: () -> Unit
) {
    // Title row (back, brand + title, actions), then the date under the title: side by side, the date column
    // squeezed the title to one letter per line at large font scales (A4).
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Back to Today",
                    tint = ThesisColors.TextPrimary
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "THESIS",
                    style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
                    color = ThesisColors.Primary
                )
                Text(
                    text = "Morning Brief",
                    // Capped at 1.3x like every display title (2.3), so the words never break at 2.0x.
                    style = ThesisType.capped(ThesisTypography.headlineLarge.copy(fontFamily = HeadingFont)),
                    color = ThesisColors.TextPrimary
                )
            }
            IconButton(onClick = onExportPdf) {
                Icon(
                    imageVector = Icons.Default.Share,
                    contentDescription = "Export Pulse PDF",
                    tint = ThesisColors.TextMuted
                )
            }
            IconButton(onClick = onRefresh) {
                Icon(
                    imageVector = Icons.Default.Refresh,
                    contentDescription = "Refresh Pulse",
                    tint = ThesisColors.TextMuted
                )
            }
        }
        Column(modifier = Modifier.padding(start = ThesisSpace.touchMin)) {
            Text(
                text = dateLabel.uppercase(),
                style = ThesisTypography.labelSmall,
                color = ThesisColors.TextMuted
            )
            if (!generatedAt.isNullOrBlank()) {
                Text(
                    text = "Updated $generatedAt",
                    style = ThesisTypography.bodySmall,
                    color = ThesisColors.TextMuted
                )
            }
        }
    }
}

@Composable
private fun MorningLineCard(line: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ThesisDimens.CardCornerRadius))
            .background(ThesisColors.Surface)
            .border(ThesisDimens.BorderWidth, ThesisColors.Border, RoundedCornerShape(ThesisDimens.CardCornerRadius))
            .padding(ThesisDimens.CardPadding)
    ) {
        Text(
            text = line,
            style = ThesisTypography.bodyLarge.copy(fontWeight = FontWeight.Medium),
            color = ThesisColors.TextPrimary
        )
    }
}

@Composable
private fun BriefSection(
    eyebrow: String,
    title: String,
    body: String,
    supportingRows: List<BriefRow> = emptyList()
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)
    ) {
        SectionLabel(eyebrow)
        Text(
            text = title,
            style = ThesisTypography.headlineLarge.copy(fontFamily = HeadingFont),
            color = ThesisColors.TextPrimary
        )
        if (body.isNotBlank()) {
            Text(
                text = body,
                style = ThesisTypography.bodyMedium,
                color = ThesisColors.TextSecondary
            )
        }
        if (supportingRows.isNotEmpty()) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(ThesisDimens.CardCornerRadius))
                    .background(ThesisColors.Surface)
                    .border(
                        ThesisDimens.BorderWidth,
                        ThesisColors.Border,
                        RoundedCornerShape(ThesisDimens.CardCornerRadius)
                    )
            ) {
                supportingRows.forEachIndexed { index, row ->
                    BriefRowView(row = row)
                    if (index != supportingRows.lastIndex) {
                        HorizontalDivider(color = ThesisColors.BorderSubtle)
                    }
                }
            }
        }
    }
}

@Composable
private fun BriefRowView(row: BriefRow) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = ThesisDimens.CardPadding, vertical = ThesisDimens.SpacingMd),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = row.label,
                style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium),
                color = ThesisColors.TextPrimary
            )
            if (row.detail.isNotBlank()) {
                Text(
                    text = row.detail,
                    style = ThesisTypography.bodySmall,
                    color = ThesisColors.TextMuted
                )
            }
        }
        if (row.value.isNotBlank()) {
            Text(
                text = row.value,
                style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium),
                color = row.tone.color()
            )
        }
    }
}

@Composable
private fun YourNamesBrief(
    rows: List<BriefRow>,
    comment: String,
    onRunDeepDive: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)) {
        SectionLabel("YOUR NAMES")
        Text(
            text = "Tracked context",
            style = ThesisTypography.headlineLarge.copy(fontFamily = HeadingFont),
            color = ThesisColors.TextPrimary
        )
        if (comment.isNotBlank()) {
            Text(
                text = comment,
                style = ThesisTypography.bodyMedium,
                color = ThesisColors.TextSecondary
            )
        }
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(ThesisDimens.CardCornerRadius))
                .background(ThesisColors.Surface)
                .border(ThesisDimens.BorderWidth, ThesisColors.Border, RoundedCornerShape(ThesisDimens.CardCornerRadius))
        ) {
            rows.forEachIndexed { index, row ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onRunDeepDive(row.label) }
                        .padding(horizontal = ThesisDimens.CardPadding, vertical = ThesisDimens.SpacingMd)
                        .semantics {
                            contentDescription = "Open ${row.label} deep dive"
                            role = Role.Button
                        },
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = row.label,
                            style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium),
                            color = ThesisColors.TextPrimary
                        )
                        Text(
                            text = row.detail,
                            style = ThesisTypography.bodySmall,
                            color = ThesisColors.TextMuted
                        )
                    }
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = null,
                        tint = ThesisColors.Primary,
                        modifier = Modifier.size(16.dp)
                    )
                }
                if (index != rows.lastIndex) {
                    HorizontalDivider(color = ThesisColors.BorderSubtle)
                }
            }
        }
    }
}

@Composable
private fun SignalNoiseCard(signal: String, noise: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(ThesisDimens.CardCornerRadius))
            .background(ThesisColors.Surface)
            .border(ThesisDimens.BorderWidth, ThesisColors.Border, RoundedCornerShape(ThesisDimens.CardCornerRadius))
            .padding(ThesisDimens.CardPadding),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)
    ) {
        SectionLabel("SIGNAL VS NOISE")
        SignalNoiseLine(label = "Signal", body = signal, color = ThesisColors.SignalPositive)
        SignalNoiseLine(label = "Noise", body = noise, color = ThesisColors.SignalWarning)
    }
}

@Composable
private fun SignalNoiseLine(label: String, body: String, color: Color) {
    Row(horizontalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingMd)) {
        Text(
            text = "$label:",
            style = ThesisTypography.labelLarge.copy(fontWeight = FontWeight.Medium),
            color = color
        )
        Text(
            text = body,
            style = ThesisTypography.bodyMedium,
            color = ThesisColors.TextSecondary,
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun SourcesFooter(sources: List<String>, omissions: List<String>) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(ThesisDimens.SpacingSm)
    ) {
        SectionLabel("SOURCES")
        Text(
            text = if (sources.isEmpty()) {
                "Sources are attached to the stored Pulse evidence."
            } else {
                sources.joinToString(", ")
            },
            style = ThesisTypography.bodySmall,
            color = ThesisColors.TextMuted
        )
        if (omissions.isNotEmpty()) {
            Text(
                text = "Coverage notes: ${omissions.joinToString("; ")}",
                style = ThesisTypography.bodySmall,
                color = ThesisColors.TextMuted
            )
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text.uppercase(),
        style = ThesisTypography.labelSmall.copy(fontWeight = FontWeight.Medium),
        color = ThesisColors.Primary
    )
}

private data class PulseBrief(
    val morningLine: String,
    val tape: BriefSectionModel?,
    val whatChanged: String,
    val deltaRows: List<BriefRow>,
    val interestingBit: String,
    val nameRows: List<BriefRow>,
    val namesComment: String,
    val watchRows: List<BriefRow>,
    val headlineRows: List<BriefRow>,
    val signal: String,
    val noise: String,
    val sources: List<String>,
    val omissions: List<String>
)

private data class BriefSectionModel(
    val summary: String,
    val rows: List<BriefRow>
)

private data class BriefRow(
    val label: String,
    val value: String = "",
    val detail: String = "",
    val tone: RowTone = RowTone.NEUTRAL
)

private enum class RowTone {
    POSITIVE,
    NEGATIVE,
    NEUTRAL;

    @Composable
    @ReadOnlyComposable
    fun color(): Color = when (this) {
        POSITIVE -> ThesisColors.SignalPositive
        NEGATIVE -> ThesisColors.SignalNegative
        NEUTRAL -> ThesisColors.TextSecondary
    }
}

private fun buildPulseBrief(sections: List<SectionView>, watchlist: List<String>): PulseBrief {
    val marketTape = findSection(sections, "market_tape", "market tape")
    val whatChanged = findSection(sections, "what_changed", "what changed")
    val interesting = findSection(sections, "interesting", "interesting bit")
    val portfolio = findSection(sections, "portfolio_radar", "your names", "portfolio")
    val watch = findSection(sections, "what_to_watch", "what to watch", "calendar", "macro releases")
    val headlines = findSection(sections, "news_summary", "headlines", "news")
    val signalNoise = findSection(sections, "signal_vs_noise", "signal vs noise")
    val macro = findSection(sections, "official_macro_pressure", "macro regime", "macro pressure")

    val tapeRows = extractMetricRows(marketTape?.body.orEmpty()).take(8)
    val tapeSummary = summarizeBody(marketTape?.body)
    val deltaBody = summarizeBody(whatChanged?.body)
    val deltaRows = extractBullets(whatChanged?.body.orEmpty()).take(6).map {
        BriefRow(label = it)
    }
    val interestingBody = summarizeBody(interesting?.body).ifBlank {
        deriveInterestingBit(marketTape, macro)
    }
    val nameRows = buildNameRows(watchlist, portfolio, sections).take(6)
    val watchRows = extractBullets(watch?.body.orEmpty()).take(5).map {
        BriefRow(label = it)
    }
    val headlineRows = extractBullets(headlines?.body.orEmpty()).take(4).map {
        BriefRow(label = it)
    }
    val signal = extractSignalNoise(signalNoise?.body.orEmpty(), "signal")
        ?: deriveSignal(marketTape, whatChanged)
    val noise = extractSignalNoise(signalNoise?.body.orEmpty(), "noise")
        ?: "One daily move does not prove a durable regime shift."

    return PulseBrief(
        morningLine = deriveMorningLine(sections, marketTape, whatChanged),
        tape = marketTape?.let {
            BriefSectionModel(
                summary = tapeSummary.ifBlank { "Market tape is available, with details below." },
                rows = tapeRows.ifEmpty { extractBullets(it.body).take(5).map { item -> BriefRow(label = item) } }
            )
        },
        whatChanged = deltaBody.ifBlank {
            if (sections.isEmpty()) {
                "Pulse has not produced a current issue yet."
            } else {
                "No material daily change was highlighted by the current Pulse issue."
            }
        },
        deltaRows = deltaRows,
        interestingBit = interestingBody,
        nameRows = nameRows,
        namesComment = deriveNamesComment(nameRows),
        watchRows = watchRows,
        headlineRows = headlineRows,
        signal = signal,
        noise = noise,
        sources = collectSources(sections),
        omissions = collectOmissions(sections)
    )
}

private fun findSection(sections: List<SectionView>, vararg keys: String): SectionView? =
    sections.firstOrNull { section ->
        val haystack = "${section.sectionId.orEmpty()} ${section.title}".lowercase()
        keys.any { key -> haystack.contains(key.lowercase()) }
    }

private fun deriveMorningLine(
    sections: List<SectionView>,
    marketTape: SectionView?,
    whatChanged: SectionView?
): String {
    val explicit = sections.firstOrNull {
        val key = "${it.sectionId.orEmpty()} ${it.title}".lowercase()
        key.contains("morning_line") || key.contains("morning line")
    }
    val explicitLine = summarizeBody(explicit?.body, maxSentences = 1)
    if (explicitLine.isNotBlank()) return explicitLine

    val changedLine = summarizeBody(whatChanged?.body, maxSentences = 1)
    if (changedLine.isNotBlank()) return changedLine

    val tapeLine = summarizeBody(marketTape?.body, maxSentences = 1)
    if (tapeLine.isNotBlank()) return tapeLine

    return "Markets, macro, and your names are quiet until the next Pulse issue lands."
}

private fun deriveInterestingBit(marketTape: SectionView?, macro: SectionView?): String {
    val tape = summarizeBody(marketTape?.body, maxSentences = 1)
    val macroLine = summarizeBody(macro?.body, maxSentences = 1)
    return when {
        tape.isNotBlank() && macroLine.isNotBlank() -> "$tape Macro context remains the constraint to keep in view."
        tape.isNotBlank() -> tape
        macroLine.isNotBlank() -> macroLine
        else -> "The useful read today is restraint: if the inputs are quiet, the product should not invent urgency."
    }
}

private fun deriveSignal(marketTape: SectionView?, whatChanged: SectionView?): String {
    val source = summarizeBody(whatChanged?.body, maxSentences = 1)
        .ifBlank { summarizeBody(marketTape?.body, maxSentences = 1) }
    return source.ifBlank { "No confirmed daily signal cleared the current Pulse inputs." }
}

private fun buildNameRows(
    watchlist: List<String>,
    portfolio: SectionView?,
    sections: List<SectionView>
): List<BriefRow> {
    val overlayBody = portfolio?.body.orEmpty()
    val rowsFromPortfolio = watchlist.mapNotNull { ticker ->
        val line = extractTickerLine(ticker, overlayBody)
            ?: sections.firstOrNull { it.body.contains(ticker, ignoreCase = true) }?.let {
                "${it.title}: ${summarizeBody(it.body, maxSentences = 1)}"
            }
        if (line == null) null else BriefRow(label = ticker, detail = line)
    }
    return rowsFromPortfolio.ifEmpty {
        watchlist.take(4).map {
            BriefRow(label = it, detail = "Tracked. No company-specific Pulse evidence highlighted today.")
        }
    }
}

private fun deriveNamesComment(rows: List<BriefRow>): String =
    if (rows.isEmpty()) {
        ""
    } else {
        "Your tracked names are shown only when Thesis has watchlist context or approved Pulse evidence."
    }

private fun extractMetricRows(body: String): List<BriefRow> {
    val tokens = Regex("""(?i)\b(SPX|S&P 500|NASDAQ|NDX|DOW|DJIA|RUSSELL 2000|RUT|VIX|10Y|2Y|OIL|WTI|CREDIT|DOLLAR)\b[^+\-\n]*(?:([+\-]\d+(?:\.\d+)?\s?(?:%|bps|pts?)?))?""")
        .findAll(body)
        .map { match ->
            val label = match.groupValues[1].uppercase()
            val value = match.groupValues.getOrNull(2).orEmpty()
            BriefRow(
                label = label,
                value = value,
                detail = "",
                tone = toneFromValue(value)
            )
        }
        .toList()
    return tokens.distinctBy { it.label }
}

private fun extractBullets(body: String): List<String> {
    val normalized = body.replace("\r", "\n")
    val lineBullets = normalized.lines()
        .map { it.trim().trimStart('-', '*', '\u2022').trim() }
        .filter { it.length > 4 }
    if (lineBullets.size > 1) return lineBullets

    return normalized
        .split(Regex("""(?<=[.!?])\s+"""))
        .map { it.trim() }
        .filter { it.length > 12 }
}

private fun extractTickerLine(ticker: String, body: String): String? {
    val line = body.lines().firstOrNull { it.contains(ticker, ignoreCase = true) }
    if (!line.isNullOrBlank()) return line.trim().trimStart('-', '*', '\u2022').trim()
    val sentence = body.split(Regex("""(?<=[.!?])\s+"""))
        .firstOrNull { it.contains(ticker, ignoreCase = true) }
    return sentence?.trim()
}

private fun extractSignalNoise(body: String, label: String): String? {
    val regex = Regex("""(?i)\b$label\s*:\s*([^.\n]+[.]?)""")
    return regex.find(body)?.groupValues?.getOrNull(1)?.trim()?.takeIf { it.isNotBlank() }
}

private fun summarizeBody(body: String?, maxSentences: Int = 2): String {
    val clean = body
        ?.replace(Regex("""\s+"""), " ")
        ?.trim()
        .orEmpty()
    if (clean.isBlank()) return ""
    return clean
        .split(Regex("""(?<=[.!?])\s+"""))
        .filter { it.isNotBlank() }
        .take(maxSentences)
        .joinToString(" ")
        .ifBlank { clean.take(180) }
}

private fun toneFromValue(value: String): RowTone {
    val normalized = value.trim()
    return when {
        normalized.startsWith("+") -> RowTone.POSITIVE
        normalized.startsWith("-") -> RowTone.NEGATIVE
        else -> RowTone.NEUTRAL
    }
}

private fun collectSources(sections: List<SectionView>): List<String> =
    sections.flatMap { section ->
        section.evidence.mapNotNull { evidence ->
            val excerpt = evidence.excerpt.trim()
            excerpt.takeIf { it.isNotBlank() }?.substringBefore(":")?.take(42)
        }
    }
        .map { it.trim() }
        .filter { it.isNotBlank() }
        .distinct()
        .take(8)

private fun collectOmissions(sections: List<SectionView>): List<String> =
    sections.filter { section ->
        val status = section.status.orEmpty().lowercase()
        status.contains("partial") || status.contains("incomplete") || status.contains("unavailable")
    }
        .map { "${it.title}: ${plainStatus(it.status)}" }
        .distinct()
        .take(4)

private fun plainStatus(status: String?): String =
    when (status?.lowercase()) {
        "data_incomplete" -> "coverage incomplete"
        "data_unavailable" -> "coverage unavailable"
        "partial" -> "partial coverage"
        else -> status?.replace('_', ' ') ?: "coverage note"
    }

private fun formatBriefTimestamp(raw: String): String? =
    runCatching {
        Instant.parse(raw)
            .atZone(ZoneId.systemDefault())
            .format(DateTimeFormatter.ofPattern("h:mm a"))
    }.getOrNull()
