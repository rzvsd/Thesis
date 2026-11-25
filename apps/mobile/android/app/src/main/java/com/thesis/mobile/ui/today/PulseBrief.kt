package com.thesis.mobile.ui.today

import androidx.compose.runtime.Immutable
import com.thesis.mobile.model.EvidenceView
import com.thesis.mobile.model.MarketTapeFamily
import com.thesis.mobile.model.PulseReportView
import com.thesis.mobile.model.SectionView
import com.thesis.mobile.ui.copy.TodayCopy
import java.time.Instant
import java.time.LocalDate

/*
 * The Pulse brief model (docs/app-redesign/DESIGN-DIRECTION.md 5.7): one Pulse issue read into the brief's
 * chapters (Markets, What changed, Your names, Watch, Headlines, Sources), its morning line and its lead
 * conclusion. Home (5.6 block 6) shows the same chapters as rows. Built once per issue, off the composition's hot
 * path (`remember(pulse, watchlist)`); nothing here is invented: a chapter exists only when the issue has content
 * for it, and when a section is missing the brief has no prose in its place (principle 11).
 */

enum class ChapterKind { Markets, Changed, Names, Watch, Headlines, Sources }

/** A story paragraph: the lead phrase (highlighted) and the rest. [lead] is empty for a plain paragraph. */
@Immutable
data class Paragraph(val lead: String, val rest: String) {
    val text: String get() = listOf(lead, rest).filter { it.isNotBlank() }.joinToString(" ")
}

/** A followed name the issue mentions, with the sentence that mentions it. */
@Immutable
data class NameMention(val ticker: String, val sentence: String)

/** A headline row: what was published, by whom and when, and where it opens. */
@Immutable
data class Headline(val title: String, val source: String?, val at: Instant?, val url: String?)

/** A source the issue cites, opening in the browser. */
@Immutable
data class SourceRef(val label: String, val url: String, val at: Instant?)

@Immutable
data class PulseChapter(
    val kind: ChapterKind,
    /** The kicker ("Markets"). */
    val label: String,
    /** The headline: a sentence from the issue, or a generated one when the issue has only rows. */
    val title: String,
    /** Coverage of this chapter's inputs is incomplete (a "Partial coverage" badge). */
    val partial: Boolean = false,
    val paragraphs: List<Paragraph> = emptyList(),
    val tape: List<TapeLine> = emptyList(),
    val names: List<NameMention> = emptyList(),
    val items: List<String> = emptyList(),
    val headlines: List<Headline> = emptyList(),
    val sources: List<SourceRef> = emptyList(),
    /** Coverage notes about the pipeline (Sources chapter), never mixed into the story. */
    val notes: List<String> = emptyList(),
    val signal: String? = null,
    val noise: String? = null,
) {
    /**
     * The chapter in one sentence for a row under a headline that already says [shown] (Home's Today's Pulse: the
     * lead conclusion is the What changed headline). The title when it differs, else the chapter's next sentence;
     * null when the chapter has nothing else to say (the row is then left out rather than repeat the headline).
     */
    fun rowSentence(shown: String?): String? {
        if (title != shown) return title
        val next = paragraphs.firstOrNull()?.text?.let { PulseText.sentences(it).firstOrNull() }
            ?: items.firstOrNull()
            ?: names.firstOrNull()?.let { "${it.ticker}: ${it.sentence}" }
            ?: headlines.firstOrNull()?.title
        return next?.takeIf { it != shown }
    }

    /** This chapter with its headline replaced by its next sentence (that sentence leaves the paragraphs). */
    internal fun promoteNextSentence(fallback: String): PulseChapter {
        val first = paragraphs.firstOrNull() ?: return copy(title = fallback)
        val sentences = PulseText.sentences(first.text)
        val head = sentences.firstOrNull() ?: return copy(title = fallback)
        val rest = sentences.drop(1)
        val remaining = buildList {
            if (rest.isNotEmpty()) {
                val (lead, tail) = PulseText.leadAndRest(rest)
                add(Paragraph(lead, tail))
            }
            addAll(paragraphs.drop(1))
        }
        return copy(title = head, paragraphs = remaining)
    }
}

@Immutable
data class PulseBrief(
    val reportId: String,
    /** The morning line: one sentence, the hero line of the brief and Home's header title. */
    val morningLine: String,
    /** The issue's lead conclusion (Home's Today's Pulse headline), never the morning line again. */
    val leadConclusion: String,
    val generatedAt: Instant?,
    /** When the tape's data was retrieved (a time), else null. */
    val dataRetrievedAt: Instant?,
    /** The market day the tape describes. */
    val dataDay: LocalDate?,
    val chapters: List<PulseChapter>,
    val upshot: String?,
    /** Any input of the issue is incomplete. */
    val partial: Boolean,
) {
    fun chapter(kind: ChapterKind): PulseChapter? = chapters.firstOrNull { it.kind == kind }

    /**
     * The hero carries the "Partial coverage" badge only when no chapter carries it: an incomplete chapter says so
     * in its own header, and the same caveat twice within one screen is noise (rubric V3).
     */
    val heroPartial: Boolean get() = partial && chapters.none { it.partial }

    /** Plain text of the brief ("Copy as text"): the morning line, then each chapter's headline and content. */
    fun asText(heading: String): String = buildString {
        appendLine(heading)
        appendLine()
        appendLine(morningLine)
        chapters.forEachIndexed { i, c ->
            appendLine()
            appendLine("${(i + 1).toString().padStart(2, '0')} ${c.label}")
            appendLine(c.title)
            c.tape.forEach { appendLine("${it.name}\t${it.level}\t${it.delta}") }
            c.paragraphs.forEach { appendLine(it.text) }
            c.names.forEach { appendLine("${it.ticker}: ${it.sentence}") }
            c.items.forEach { appendLine("· $it") }
            c.headlines.forEach { h -> appendLine(listOfNotNull(h.title, h.source).joinToString(" · ")) }
            c.signal?.let { appendLine("${TodayCopy.SIGNAL}: $it") }
            c.noise?.let { appendLine("${TodayCopy.NOISE}: $it") }
            c.sources.forEach { appendLine("${it.label}: ${it.url}") }
            c.notes.forEach { appendLine(TodayCopy.coverageNote(it)) }
        }
        upshot?.let {
            appendLine()
            appendLine("${TodayCopy.UPSHOT}: $it")
        }
    }.trimEnd()

    companion object {
        /** Section keys, matched against the section id and title (lower case, `_` read as a space). */
        private val MorningKeys = listOf("morning line", "morning_line")
        private val TapeKeys = listOf("market tape", "market_tape")
        private val ChangedKeys = listOf("what changed", "what_changed", "interesting")
        private val MacroKeys = listOf("macro stress", "macro_stress")
        private val MovesKeys = listOf("market moves", "market_moves", "canonical events", "canonical_events")
        private val NamesKeys = listOf("portfolio radar", "portfolio_radar", "your names", "watchlist")
        private val WatchKeys = listOf("what to watch", "what_to_watch", "calendar", "earnings calendar")
        private val NewsKeys = listOf("news summary", "news_summary", "headlines", "news")
        private val SignalKeys = listOf("signal vs noise", "signal_vs_noise")
        private val UpshotKeys = listOf("upshot", "bottom line", "bottom_line", "takeaway")
        private val FlagKeys = listOf("uncertainty flags", "uncertainty_flags")

        private val IncompleteStatus = setOf("data_incomplete", "data_unavailable", "partial", "failed", "incomplete")

        fun isPartial(section: SectionView?): Boolean = section?.status?.trim()?.lowercase() in IncompleteStatus

        /** Builds the brief of [pulse] for a reader following [watchlist]. */
        fun from(pulse: PulseReportView, watchlist: List<String>): PulseBrief {
            val sections = pulse.sections
            fun find(keys: List<String>): SectionView? = sections.firstOrNull { matches(it, keys) }
            fun findAll(keys: List<String>): List<SectionView> = sections.filter { matches(it, keys) }

            val morning = find(MorningKeys)
            val tapeSection = find(TapeKeys)
            val changed = findAll(ChangedKeys)
            val macro = find(MacroKeys)
            val moves = findAll(MovesKeys)
            val namesSection = find(NamesKeys)
            val watch = findAll(WatchKeys)
            val news = find(NewsKeys)
            val signalNoise = find(SignalKeys)
            val upshotSection = find(UpshotKeys)
            val flags = find(FlagKeys)

            val coverageNotes = mutableListOf<String>()
            val tapeLines = TapeModel.lines(pulse.tape)

            // ---- 01 Markets
            val tapeStory = PulseText.splitCoverage(PulseText.clean(pulse.tape?.summary ?: tapeSection?.body))
            coverageNotes += tapeStory.second
            val markets = if (tapeLines.isNotEmpty() || tapeStory.first.isNotEmpty()) {
                val story = tapeStory.first.filterNot { it.startsWith("Cross-asset context", ignoreCase = true) }
                PulseChapter(
                    kind = ChapterKind.Markets,
                    label = TodayCopy.CHAPTER_MARKETS,
                    title = story.firstOrNull() ?: TodayCopy.marketsFallback(tapeLines.size),
                    partial = isPartial(tapeSection) || pulse.tape?.coverageState?.lowercase() == "partial",
                    paragraphs = story.drop(1).take(2).map { Paragraph("", it) },
                    tape = tapeLines,
                )
            } else {
                null
            }

            // ---- 02 What changed
            val changedSections = changed + listOfNotNull(macro) + moves
            val changedParagraphs = mutableListOf<Paragraph>()
            changedSections.forEach { section ->
                val items = PulseText.listItems(section.body)
                if (items != null) {
                    items.forEach { changedParagraphs += Paragraph("", it) }
                } else {
                    val (story, notes) = PulseText.splitCoverage(PulseText.clean(section.body))
                    coverageNotes += notes
                    if (story.isNotEmpty()) {
                        val (lead, rest) = PulseText.leadAndRest(story)
                        changedParagraphs += Paragraph(lead, rest)
                    }
                }
            }
            val dedupedChanged = changedParagraphs.distinctBy { it.text }
            val signal = signalNoise?.body?.let { extractLabelled(it, "signal") }
            val noise = signalNoise?.body?.let { extractLabelled(it, "noise") }
            val whatChanged = if (dedupedChanged.isNotEmpty() || signal != null || noise != null) {
                // The chapter headline is the first sentence; it is not repeated in the first paragraph.
                val first = dedupedChanged.firstOrNull()
                val firstSentences = first?.let { PulseText.sentences(it.text) }.orEmpty()
                val title = firstSentences.firstOrNull() ?: TodayCopy.CHANGED_FALLBACK
                val remainder = firstSentences.drop(1)
                val paragraphs = buildList {
                    if (remainder.isNotEmpty()) {
                        val (lead, rest) = PulseText.leadAndRest(remainder)
                        add(Paragraph(lead, rest))
                    }
                    addAll(dedupedChanged.drop(1))
                }
                PulseChapter(
                    kind = ChapterKind.Changed,
                    label = TodayCopy.CHAPTER_CHANGED,
                    title = title,
                    partial = changedSections.any(::isPartial),
                    paragraphs = paragraphs,
                    signal = signal,
                    noise = noise,
                )
            } else {
                null
            }

            // ---- 03 Your names
            val mentions = nameMentions(watchlist, namesSection, sections)
            val names = if (mentions.isNotEmpty()) {
                PulseChapter(
                    kind = ChapterKind.Names,
                    label = TodayCopy.CHAPTER_NAMES,
                    title = TodayCopy.namesInBrief(mentions.size),
                    partial = isPartial(namesSection),
                    names = mentions,
                )
            } else {
                null
            }

            // ---- 04 Watch
            val watchItems = mutableListOf<String>()
            var watchTitle: String? = null
            watch.forEach { section ->
                val items = PulseText.listItems(section.body)
                if (items != null) {
                    watchItems += items
                } else {
                    val (story, notes) = PulseText.splitCoverage(PulseText.clean(section.body))
                    coverageNotes += notes
                    if (watchTitle == null && story.size > 1) {
                        watchTitle = story.first()
                        watchItems += story.drop(1)
                    } else {
                        watchItems += story
                    }
                }
            }
            val watchChapter = if (watchItems.isNotEmpty()) {
                val items = watchItems.distinct()
                // A list with no sentence of its own leads with its first item ("Durable goods orders, Wed
                // 08:30."), a fact rather than a count; the rest stay in the list.
                val title = watchTitle ?: items.first()
                PulseChapter(
                    kind = ChapterKind.Watch,
                    label = TodayCopy.CHAPTER_WATCH,
                    title = title,
                    partial = watch.any(::isPartial),
                    items = if (watchTitle == null) items.drop(1) else items,
                )
            } else {
                null
            }

            // ---- 05 Headlines
            val headlines = news?.let(::headlinesOf).orEmpty()
            val headlinesChapter = if (headlines.isNotEmpty()) {
                PulseChapter(
                    kind = ChapterKind.Headlines,
                    label = TodayCopy.CHAPTER_HEADLINES,
                    title = TodayCopy.headlinesHeadline(headlines.size),
                    partial = isPartial(news),
                    headlines = headlines,
                )
            } else {
                null
            }

            // ---- 06 Sources: every cited link, plus coverage notes and section statuses.
            val sources = buildList {
                pulse.tape?.moves?.forEach { m ->
                    val url = m.sourceUrl?.trim()?.ifBlank { null } ?: return@forEach
                    add(SourceRef(m.sourceName?.trim()?.ifBlank { null } ?: m.label, url, parseInstant(m.retrievedAt)))
                }
                sections.forEach { s -> s.evidence.forEach { e -> sourceOf(e)?.let(::add) } }
            }.distinctBy { it.url }
            flags?.body?.let { body ->
                val cleaned = PulseText.clean(body)
                val text = cleaned.substringAfter(":", cleaned).trim().trimEnd('.')
                if (text.isNotBlank()) coverageNotes += text.replaceFirstChar { it.uppercase() }
            }
            // Section statuses only when the issue has no flags of its own (they say the same thing).
            if (flags == null) {
                sections.filter(::isPartial).forEach { s -> coverageNotes += "${s.title.trim()}: ${statusWords(s.status)}" }
            }
            val notes = coverageNotes.map { it.trim().trimEnd('.') }.filter { it.isNotBlank() }.distinct()
            val sourcesChapter = if (sources.isNotEmpty() || notes.isNotEmpty()) {
                PulseChapter(
                    kind = ChapterKind.Sources,
                    label = TodayCopy.CHAPTER_SOURCES,
                    title = if (sources.isNotEmpty()) TodayCopy.sourcesHeadline(sources.size) else TodayCopy.coverageNote(notes.first()),
                    sources = sources,
                    notes = notes,
                )
            } else {
                null
            }

            val built = listOfNotNull(markets, whatChanged, names, watchChapter, headlinesChapter, sourcesChapter)

            // Morning line: the issue's own, else the first sentence of the tape, what changed or macro stress.
            val morningLine = listOf(
                PulseText.firstSentence(morning?.body),
                markets?.title?.takeIf { tapeStory.first.isNotEmpty() }.orEmpty(),
                whatChanged?.title?.takeIf { dedupedChanged.isNotEmpty() }.orEmpty(),
            ).firstOrNull { it.isNotBlank() } ?: ""
            val leadConclusion = listOf(
                whatChanged?.title?.takeIf { dedupedChanged.isNotEmpty() }.orEmpty(),
                PulseText.firstSentence(macro?.body),
                markets?.title?.takeIf { tapeStory.first.isNotEmpty() }.orEmpty(),
            ).firstOrNull { it.isNotBlank() && it != morningLine } ?: TodayCopy.briefChapters(built.size)

            // A chapter whose headline became the morning line leads with its next sentence instead, so the hero and
            // chapter 01 never print the same sentence (rubric V3). Markets with nothing more to say leads with
            // its levels, read from the tape.
            val chapters = built.map { c ->
                if (morningLine.isBlank() || c.title != morningLine) return@map c
                when (c.kind) {
                    ChapterKind.Markets -> c.promoteNextSentence(TodayCopy.marketsLevels(marketsLead(tapeLines)) ?: TodayCopy.marketsFallback(tapeLines.size))
                    ChapterKind.Changed -> c.promoteNextSentence(TodayCopy.CHANGED_FALLBACK)
                    else -> c
                }
            }

            val upshot = upshotSection?.body?.let { PulseText.clean(it) }?.ifBlank { null }

            return PulseBrief(
                reportId = pulse.reportId,
                morningLine = morningLine,
                leadConclusion = leadConclusion,
                generatedAt = parseInstant(pulse.generatedAt),
                dataRetrievedAt = pulse.tape?.moves?.mapNotNull { parseInstant(it.retrievedAt) }?.maxOrNull(),
                dataDay = parseDay(pulse.tape?.asOf),
                chapters = chapters,
                upshot = upshot,
                partial = sections.any(::isPartial) || pulse.tape?.coverageState?.lowercase() == "partial",
            )
        }

        /** The broad index and the 10-year (else the first rate) the Markets headline reads its levels from. */
        private fun marketsLead(lines: List<TapeLine>): List<TapeLine> = listOfNotNull(
            lines.firstOrNull { it.family == MarketTapeFamily.CoreIndex },
            lines.firstOrNull { it.id.uppercase() == "DGS10" } ?: lines.firstOrNull { it.family == MarketTapeFamily.Rates },
        )

        private fun normalized(s: String?): String = s.orEmpty().lowercase().replace('_', ' ').trim()

        private fun matches(section: SectionView, keys: List<String>): Boolean {
            val id = normalized(section.sectionId)
            val title = normalized(section.title)
            return keys.any { key ->
                val k = normalized(key)
                id == k || title == k || id.contains(k) || title.contains(k)
            }
        }

        private fun statusWords(status: String?): String = when (status?.trim()?.lowercase()) {
            "data_unavailable", "failed" -> "unavailable"
            else -> "coverage incomplete"
        }

        private fun extractLabelled(body: String, label: String): String? =
            Regex("(?i)\\b$label\\s*:\\s*([^\\n]+?)(?=\\s*\\b(?:signal|noise)\\s*:|$)")
                .find(body.replace(Regex("\\s+"), " "))
                ?.groupValues?.getOrNull(1)?.trim()?.let(PulseText::clean)?.ifBlank { null }

        private fun sourceOf(e: EvidenceView): SourceRef? {
            val url = e.url?.trim()?.ifBlank { null } ?: return null
            if (!url.startsWith("http://") && !url.startsWith("https://")) return null
            val label = e.sourceName.trim().ifBlank { PulseText.host(url) ?: url }
            return SourceRef(label, url, null)
        }

        private fun headlinesOf(news: SectionView): List<Headline> {
            val fromEvidence = news.evidence.mapNotNull { e ->
                val title = PulseText.clean(e.excerpt).ifBlank { null } ?: return@mapNotNull null
                Headline(title, e.sourceName.trim().ifBlank { null } ?: PulseText.host(e.url), null, e.url?.trim()?.ifBlank { null })
            }
            if (fromEvidence.isNotEmpty()) return fromEvidence.distinctBy { it.title }
            val items = PulseText.listItems(news.body) ?: PulseText.splitCoverage(PulseText.clean(news.body)).first
            return items.map { item ->
                // "Apple investor update (investor.apple.com)." -> title and source.
                val m = Regex("^(.*?)\\s*\\(([^()]+\\.[a-z]{2,})\\)\\.?$").find(item)
                if (m != null) Headline(m.groupValues[1].trim().trimEnd('.') + ".", m.groupValues[2], null, null)
                else Headline(item, null, null, null)
            }.distinctBy { it.title }
        }

        private fun candidatesIn(body: String?): List<String> =
            PulseText.listItems(body) ?: PulseText.splitCoverage(PulseText.clean(body)).first

        /**
         * Followed names the issue mentions: the names section's line for the ticker first, else the first sentence
         * of any section that names it (whole word).
         */
        private fun nameMentions(watchlist: List<String>, namesSection: SectionView?, sections: List<SectionView>): List<NameMention> =
            watchlist.map { it.trim().uppercase() }.filter { it.isNotBlank() }.distinct().mapNotNull { ticker ->
                val word = Regex("\\b${Regex.escape(ticker)}\\b")
                fun sentenceIn(body: String?): String? = candidatesIn(body).firstOrNull { word.containsMatchIn(it) }
                // Elsewhere, a sentence the ticker opens ("AAPL filed a new 8-K.") reads better than a list of names.
                val elsewhere = sections.filter { it !== namesSection }.flatMap { candidatesIn(it.body) }.filter { word.containsMatchIn(it) }
                val sentence = sentenceIn(namesSection?.body)
                    ?: elsewhere.firstOrNull { it.startsWith(ticker) }
                    ?: elsewhere.firstOrNull()
                sentence?.let { NameMention(ticker, PulseText.oneSentence(it)) }
            }
    }
}
